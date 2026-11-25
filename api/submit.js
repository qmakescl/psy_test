// POST /api/submit — 응답 제출. { answers: [1–5 정수 10개], consent: true(게스트일 때) }
// 점수는 브라우저가 보낸 값을 믿지 않고, lib/scoring.js로 서버에서 다시 계산해 저장한다.
import { handler, readJson, sendJson } from './_lib/http.js';
import { getDb, readSettings } from './_lib/db.js';
import { getSession } from './_lib/auth.js';
import { ITEMS, SCALE } from '../lib/items.js';
import { scoreResponses, round1, binIndex } from '../lib/scoring.js';

export default handler('submit', ['POST'], async (req, res) => {
  const { answers, consent } = await readJson(req);
  const settings = await readSettings();
  if (settings.phase === 'closed') return sendJson(res, 409, { error: '응답이 마감되었어요' });

  const session = await getSession(req, 'user');
  if (!session) {
    if (!settings.allowGuest) return sendJson(res, 401, { error: '로그인이 필요해요' });
    if (consent !== true) return sendJson(res, 400, { error: '동의한 경우에만 응답을 저장할 수 있어요' });
  }

  const score = scoreResponses(answers, ITEMS); // 1–5 정수 10개가 아니면 null
  if (score === null) return sendJson(res, 400, { error: '10문항 모두 1–5 중에서 골라 주세요' });

  const row = {
    user_id: session ? session.user_id : null,
    session_code: settings.sessionCode, // 회차는 서버가 정한다
    score_mean: score,                  // 반올림 전 값 저장
    scale_version: SCALE.version,
    consented_at: session ? null : new Date().toISOString(), // 게스트는 응답 행에 동의 시각 기록
  };
  answers.forEach((v, i) => { row[`item_${String(i + 1).padStart(2, '0')}`] = v; });
  const db = await getDb();
  await db.insertResponse(row);
  sendJson(res, 201, { score: round1(score), bin: binIndex(score), session_code: settings.sessionCode, guest: !session });
});
