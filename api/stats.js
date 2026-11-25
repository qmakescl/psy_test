// GET /api/stats — 현재 회차의 반 분포(참가자 결과 화면용).
// 응답을 받는 동안에는 건수만, 진행자가 마감한 뒤에는 분포와 평균(5건 이상일 때)을 돌려준다.
import { handler, sendJson } from './_lib/http.js';
import { getDb, readSettings } from './_lib/db.js';
import { targetRows, isVisible, publicView } from './_lib/stats.js';

export default handler('stats', ['GET'], async (req, res) => {
  const settings = await readSettings();
  const db = await getDb();
  const rows = targetRows(await db.listResponses({ sessionCode: settings.sessionCode }));
  sendJson(res, 200, { session_code: settings.sessionCode, phase: settings.phase, ...publicView(rows, isVisible(settings.sessionCode, settings)) });
});
