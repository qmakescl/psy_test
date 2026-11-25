// POST /api/logout — 로그아웃. 쿠키를 지우고 sessions 표의 행도 지운다(참가자·진행자 모두).
import { handler, sendJson } from './_lib/http.js';
import { endSession } from './_lib/auth.js';

export default handler('logout', ['POST'], async (req, res) => {
  await endSession(req, res, 'user');
  await endSession(req, res, 'admin');
  sendJson(res, 200, { ok: true });
});
