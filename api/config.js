// GET /api/config — 화면에 필요한 공개 설정값(게스트 허용, 현재 회차, 응답 받는 중인지)
import { handler, sendJson } from './_lib/http.js';
import { readSettings } from './_lib/db.js';
import { SCALE } from '../lib/items.js';

export default handler('config', ['GET'], async (req, res) => {
  const s = await readSettings();
  sendJson(res, 200, { allow_guest: s.allowGuest, session_code: s.sessionCode, phase: s.phase, scale_version: SCALE.version });
});
