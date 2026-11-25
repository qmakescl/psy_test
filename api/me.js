// GET /api/me — 로그인한 사람의 아이디와 지난 결과 목록. 누구의 결과인지는 쿠키(세션)로만 정한다.
import { handler, sendJson } from './_lib/http.js';
import { getDb } from './_lib/db.js';
import { getSession } from './_lib/auth.js';
import { round1 } from '../lib/scoring.js';

export default handler('me', ['GET'], async (req, res) => {
  const session = await getSession(req, 'user');
  if (!session) return sendJson(res, 401, { error: '로그인이 필요해요' });
  const db = await getDb();
  const user = await db.findUserById(session.user_id);
  if (!user) return sendJson(res, 401, { error: '로그인이 필요해요' });
  const rows = await db.listResponses({ userId: session.user_id });
  sendJson(res, 200, {
    username: user.username,
    results: rows.reverse().map((r) => ({ created_at: r.created_at, session_code: r.session_code, score: round1(r.score_mean) })),
  });
});
