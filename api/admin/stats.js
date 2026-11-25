// GET /api/admin/stats?view=live|items|analysis|sessions&session=회차코드 — 진행자 화면용 집계
// Vercel Hobby는 배포당 함수가 12개까지라서, 탭마다 함수를 만들지 않고 view 값으로 나눈다.
// 개별 응답과 아이디는 어떤 view에서도 돌려주지 않는다.
import { handler, sendJson, getQuery } from '../_lib/http.js';
import { getDb, readSettings } from '../_lib/db.js';
import { getSession } from '../_lib/auth.js';
import { targetRows, isVisible, liveView, itemsView, analysisView, sessionsView } from '../_lib/stats.js';

const VIEWS = { live: liveView, items: itemsView, analysis: analysisView };

export default handler('admin/stats', ['GET'], async (req, res) => {
  if (!(await getSession(req, 'admin'))) return sendJson(res, 401, { error: '진행자 로그인이 필요해요' });
  const q = getQuery(req);
  const view = q.get('view') || 'live';
  const settings = await readSettings();
  const db = await getDb();
  const header = { current_session: settings.sessionCode, phase: settings.phase, allow_guest: settings.allowGuest };

  if (view === 'sessions') {
    return sendJson(res, 200, { ...header, view, sessions: sessionsView(await db.listResponses(), settings) });
  }
  if (!VIEWS[view]) return sendJson(res, 400, { error: 'view는 live, items, analysis, sessions 중 하나' });
  const session = q.get('session') || settings.sessionCode;
  const rows = targetRows(await db.listResponses({ sessionCode: session }));
  sendJson(res, 200, { ...header, view, session, ...VIEWS[view](rows, isVisible(session, settings)) });
});
