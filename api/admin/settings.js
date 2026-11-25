// POST /api/admin/settings — 현장 설정 바꾸기. { allow_guest?, session_code?, phase? }
// DB settings 표에 저장하므로 다시 배포하지 않아도 바로 반영된다.
import { handler, readJson, sendJson } from '../_lib/http.js';
import { getDb, readSettings } from '../_lib/db.js';
import { getSession } from '../_lib/auth.js';
import { SAMPLE_SESSION } from '../_lib/sample-data.js';

export default handler('admin/settings', ['POST'], async (req, res) => {
  if (!(await getSession(req, 'admin'))) return sendJson(res, 401, { error: '진행자 로그인이 필요해요' });
  const body = await readJson(req);
  const changes = {};
  if ('allow_guest' in body) {
    if (typeof body.allow_guest !== 'boolean') return sendJson(res, 400, { error: 'allow_guest는 true/false' });
    changes.allow_guest = String(body.allow_guest);
  }
  if ('session_code' in body) {
    const code = String(body.session_code).trim();
    if (!/^[A-Za-z0-9-]{1,30}$/.test(code)) return sendJson(res, 400, { error: '회차 코드는 영문·숫자·하이픈 30자 이내' });
    if (code === SAMPLE_SESSION) return sendJson(res, 400, { error: `${SAMPLE_SESSION}는 샘플 회차 이름이라 쓸 수 없어요` });
    changes.session_code = code;
  }
  if ('phase' in body) {
    if (!['collecting', 'closed'].includes(body.phase)) return sendJson(res, 400, { error: 'phase는 collecting 또는 closed' });
    changes.phase = body.phase;
  }
  const db = await getDb();
  if (Object.keys(changes).length) await db.setSettings(changes);
  const s = await readSettings();
  sendJson(res, 200, { allow_guest: s.allowGuest, session_code: s.sessionCode, phase: s.phase });
});
