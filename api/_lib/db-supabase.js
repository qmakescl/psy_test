// Supabase(Postgres) 연결. 비밀 키는 Vercel 환경변수 SUPABASE_SECRET_KEY에만 있다.
// 비밀 키는 RLS를 거치지 않으므로, '누가 무엇을 볼 수 있나'는 각 API 함수가 직접 검사한다.
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ITEM_COLS = Array.from({ length: 10 }, (_, i) => `item_${String(i + 1).padStart(2, '0')}`);
const RESPONSE_COLS = ['id', 'user_id', 'session_code', ...ITEM_COLS, 'score_mean', 'scale_version', 'created_at'].join(',');

function check({ data, error }) {
  if (error) {
    const e = new Error(`DB 오류: ${error.message}`);
    e.code = error.code;
    throw e;
  }
  return data;
}

export async function getSettings() {
  const rows = check(await sb.from('settings').select('key,value'));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSettings(values) {
  const rows = Object.entries(values).map(([key, value]) => ({ key, value: String(value) }));
  check(await sb.from('settings').upsert(rows));
}

export async function findUserByUsername(username) {
  return check(await sb.from('users').select('*').eq('username', username).maybeSingle());
}

export async function findUserById(id) {
  return check(await sb.from('users').select('id,username').eq('id', id).maybeSingle());
}

export async function createUser(user) {
  const res = await sb.from('users').insert(user).select('id,username').single();
  if (res.error && res.error.code === '23505') {
    throw Object.assign(new Error('이미 있는 아이디예요'), { status: 409 });
  }
  return check(res);
}

export async function updateUser(id, fields) {
  check(await sb.from('users').update(fields).eq('id', id));
}

export async function createSession(row) {
  check(await sb.from('sessions').insert(row));
}

export async function findSession(tokenHash) {
  return check(await sb.from('sessions').select('*').eq('token_hash', tokenHash).maybeSingle());
}

export async function deleteSession(tokenHash) {
  check(await sb.from('sessions').delete().eq('token_hash', tokenHash));
}

export async function deleteExpiredSessions() {
  check(await sb.from('sessions').delete().lt('expires_at', new Date().toISOString()));
}

export async function insertResponse(row) {
  check(await sb.from('responses').insert(row));
}

// 응답 목록. 집단별 평균 계산에 쓰도록 응답자의 연령대·성별을 붙여서 돌려준다(게스트는 null).
export async function listResponses({ sessionCode, userId } = {}) {
  let q = sb.from('responses').select(`${RESPONSE_COLS},users(age_group,gender)`).order('created_at');
  if (sessionCode) q = q.eq('session_code', sessionCode);
  if (userId) q = q.eq('user_id', userId);
  const rows = check(await q);
  return rows.map(({ users, ...r }) => ({ ...r, age_group: users?.age_group ?? null, gender: users?.gender ?? null }));
}

export async function logError(endpoint, message) {
  check(await sb.from('error_logs').insert({ endpoint, message }));
}

// 샘플 회차 다시 만들기(scripts/seed-sample.js)에서만 쓴다
export async function deleteSampleData(sessionCode) {
  check(await sb.from('responses').delete().eq('session_code', sessionCode));
  check(await sb.from('users').delete().eq('is_sample', true));
}
