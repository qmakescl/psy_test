// POST /api/admin/login — 진행자 로그인. { password }
// 환경변수 ADMIN_PASSWORD와 비교한다. 5번 연속 틀리면 5분 잠금(실패 횟수는 settings 표에 기록).
import { handler, readJson, sendJson } from '../_lib/http.js';
import { getDb, readSettings } from '../_lib/db.js';
import { safeEqual, startSession, LOCK_LIMIT, LOCK_MINUTES } from '../_lib/auth.js';

export default handler('admin/login', ['POST'], async (req, res) => {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error('ADMIN_PASSWORD 환경변수가 없습니다');
  const { password } = await readJson(req);
  const s = await readSettings();
  const db = await getDb();

  if (s.adminLockedUntil && s.adminLockedUntil.getTime() > Date.now()) {
    return sendJson(res, 423, { error: `여러 번 틀려서 잠겼어요. ${LOCK_MINUTES}분 뒤에 다시 시도해 주세요.` });
  }
  if (typeof password !== 'string' || !safeEqual(password, expected)) {
    const failed = s.adminFailed + 1;
    const lock = failed >= LOCK_LIMIT;
    await db.setSettings({
      admin_failed_attempts: lock ? 0 : failed,
      admin_locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : '',
    });
    return sendJson(res, 401, { error: '진행자 비밀번호가 맞지 않아요' });
  }
  await db.setSettings({ admin_failed_attempts: 0, admin_locked_until: '' });
  await startSession(req, res, 'admin');
  sendJson(res, 200, { ok: true });
});
