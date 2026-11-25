// POST /api/login — 로그인. { username, password }
// 같은 아이디로 5번 연속 틀리면 5분 동안 잠근다.
import { handler, readJson, sendJson } from './_lib/http.js';
import { getDb } from './_lib/db.js';
import { verifyPassword } from './_lib/password.js';
import { startSession, LOCK_LIMIT, LOCK_MINUTES } from './_lib/auth.js';

const WRONG = '아이디 또는 비밀번호가 맞지 않아요';

export default handler('login', ['POST'], async (req, res) => {
  const { username, password } = await readJson(req);
  if (typeof username !== 'string' || typeof password !== 'string') return sendJson(res, 400, { error: WRONG });

  const db = await getDb();
  await db.deleteExpiredSessions(); // 만료된 세션 정리
  const user = await db.findUserByUsername(username);
  if (!user) return sendJson(res, 401, { error: WRONG });

  if (user.locked_until && Date.parse(user.locked_until) > Date.now()) {
    return sendJson(res, 423, { error: `여러 번 틀려서 잠겼어요. ${LOCK_MINUTES}분 뒤에 다시 시도해 주세요.` });
  }
  if (!(await verifyPassword(password, user.password_hash, user.password_salt))) {
    const failed = (user.failed_attempts || 0) + 1;
    const lock = failed >= LOCK_LIMIT;
    await db.updateUser(user.id, {
      failed_attempts: lock ? 0 : failed,
      locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
    });
    return sendJson(res, 401, { error: WRONG });
  }
  await db.updateUser(user.id, { failed_attempts: 0, locked_until: null });
  await startSession(req, res, 'user', user.id);
  sendJson(res, 200, { username: user.username });
});
