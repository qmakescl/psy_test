// API 흐름 테스트 — 메모리 DB로 로컬 서버를 띄우고 실제 HTTP 요청을 보낸다.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_DRIVER = 'memory';
process.env.ADMIN_PASSWORD = 'test-admin-pass';
process.env.SAMPLE_PASSWORD = 'test-sample-pass';
process.env.PORT = '3999';
const BASE = 'http://localhost:3999';
let server;

before(async () => {
  server = (await import('../scripts/dev-server.js')).default;
  await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
});
after(() => server.close());

// 쿠키를 기억하는 간단한 브라우저 흉내
function client(origin = BASE) {
  const jar = {};
  return async (path, body, extraHeaders = {}) => {
    const headers = { Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...extraHeaders };
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; if (origin) headers.Origin = origin; }
    const res = await fetch(BASE + path, { method: body !== undefined ? 'POST' : 'GET', headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      if (/Max-Age=0/.test(c)) delete jar[k]; else jar[k] = v;
    }
    return { status: res.status, data: await res.json().catch(() => null), headers: res.headers, jar };
  };
}

const answers = [4, 2, 4, 2, 4, 2, 4, 2, 4, 2]; // 정방향 4, 역문항 2 → 4.0

test('설정값 공개', async () => {
  const { status, data } = await client()('/api/config');
  assert.equal(status, 200);
  assert.equal(data.allow_guest, false);
  assert.equal(data.phase, 'collecting');
});

test('POST는 같은 출처에서 보낸 것만 받는다', async () => {
  assert.equal((await client(null)('/api/signup', { username: 'abcd1', password: '12345678', consent: true })).status, 403);
  assert.equal((await client('https://evil.example')('/api/signup', { username: 'abcd1', password: '12345678', consent: true })).status, 403);
});

test('가입 → 바로 로그인 → 제출 → 내 결과 → 로그아웃', async () => {
  const c = client();
  assert.equal((await c('/api/signup', { username: 'tester1', password: '12345678' })).status, 400, '동의 없으면 거부');
  const s = await c('/api/signup', { username: 'tester1', password: '12345678', consent: true });
  assert.equal(s.status, 201);
  const cookie = s.headers.getSetCookie()[0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal((await c('/api/signup', { username: 'tester1', password: '12345678', consent: true })).status, 409, '중복 아이디');

  assert.equal((await c('/api/submit', { answers: [1, 2, 3] })).status, 400, '잘못된 응답');
  const sub = await c('/api/submit', { answers });
  assert.equal(sub.status, 201);
  assert.equal(sub.data.score, 4);
  assert.equal(sub.headers.get('cache-control'), 'no-store');

  const me = await c('/api/me');
  assert.equal(me.data.username, 'tester1');
  assert.equal(me.data.results.length, 1);

  await c('/api/logout', {});
  assert.equal((await c('/api/me')).status, 401);
});

test('남의 결과는 볼 수 없다(내 결과는 쿠키로만 정해짐)', async () => {
  const c = client();
  await c('/api/signup', { username: 'tester2', password: '12345678', consent: true });
  const me = await c('/api/me?user=tester1');
  assert.equal(me.data.username, 'tester2');
  assert.equal(me.data.results.length, 0);
});

test('로그인 5번 실패하면 잠긴다', async () => {
  const c = client();
  for (let i = 0; i < 5; i++) assert.equal((await c('/api/login', { username: 'tester2', password: 'wrongpass' })).status, 401);
  assert.equal((await c('/api/login', { username: 'tester2', password: '12345678' })).status, 423);
});

test('게스트: 허용 전에는 거부, 허용 후에는 동의가 있어야 저장', async () => {
  const guest = client();
  assert.equal((await guest('/api/submit', { answers, consent: true })).status, 401);
  const admin = client();
  await admin('/api/admin/login', { password: 'test-admin-pass' });
  await admin('/api/admin/settings', { allow_guest: true });
  assert.equal((await guest('/api/submit', { answers })).status, 400);
  assert.equal((await guest('/api/submit', { answers, consent: true })).status, 201);
});

test('응답 받는 중에는 건수만, 마감 후에는 분포', async () => {
  const pub = client();
  const before = await pub('/api/stats');
  assert.equal(before.data.reason, 'collecting');
  assert.equal(before.data.distribution, undefined);

  const admin = client();
  assert.equal((await admin('/api/admin/stats?view=live')).status, 401, '로그인 전');
  assert.equal((await admin('/api/admin/login', { password: 'nope' })).status, 401);
  assert.equal((await admin('/api/admin/login', { password: 'test-admin-pass' })).status, 200);
  const live = await admin('/api/admin/stats?view=live');
  assert.equal(live.data.reason, 'collecting');
  assert.ok(Array.isArray(live.data.trend));

  for (let i = 0; i < 3; i++) await client()('/api/submit', { answers, consent: true }); // 게스트 3건 추가 → 총 5건
  await admin('/api/admin/settings', { phase: 'closed' });
  const after = await pub('/api/stats');
  assert.equal(after.data.n, 5);
  assert.equal(after.data.distribution.length, 8);
  assert.equal((await client()('/api/submit', { answers, consent: true })).status, 409, '마감 후 제출 거부');

  const live2 = await admin('/api/admin/stats?view=live');
  assert.equal(live2.data.groups.age_group.available, false, '실제 참가자는 연령대 없음');
  assert.ok(!JSON.stringify(live2.data).includes('tester1'), '아이디가 응답에 없음');
});

test('샘플 회차: 연령대·성별이 있고 5명 미만 집단이라 숨김, 통계분석 가능', async () => {
  const admin = client();
  await admin('/api/admin/login', { password: 'test-admin-pass' });
  const live = await admin('/api/admin/stats?view=live&session=SAMPLE');
  assert.equal(live.data.n, 20);
  assert.equal(live.data.groups.gender.hidden, true);
  const a = await admin('/api/admin/stats?view=analysis&session=SAMPLE');
  assert.equal(a.data.n, 20);
  assert.ok(a.data.alpha > a.data.alpha_raw);
  assert.equal(a.data.small_sample, true);
  const s = await admin('/api/admin/stats?view=sessions');
  assert.ok(s.data.sessions.some((x) => x.session_code === 'SAMPLE' && x.alpha !== undefined));
  assert.equal((await admin('/api/admin/settings', { session_code: 'SAMPLE' })).status, 400);
});

test('샘플 계정으로 로그인할 수 있다', async () => {
  assert.equal((await client()('/api/login', { username: 'sample01', password: 'test-sample-pass' })).status, 200);
});

test('진행자 로그아웃 후에는 진행자 화면 접근 불가', async () => {
  const admin = client();
  await admin('/api/admin/login', { password: 'test-admin-pass' });
  assert.equal((await admin('/api/admin/stats?view=items')).status, 200);
  await admin('/api/logout', {});
  assert.equal((await admin('/api/admin/stats?view=items')).status, 401);
});

test('공개되면 안 되는 경로는 404', async () => {
  for (const p of ['/api/_lib/db.js', '/scripts/dev-server.js', '/.env.example', '/sql/schema.sql']) {
    const res = await fetch(BASE + p);
    assert.equal(res.status, 404, p);
  }
});
