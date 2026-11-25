// POST /api/signup — 가입. { username, password, consent: true }
// 아이디·비밀번호만 받는다(연령대·성별은 받지 않음 — 샘플 계정으로만 보여준다).
// 가입에 성공하면 곧바로 로그인 상태(세션 쿠키 발급)가 된다.
import { handler, readJson, sendJson } from './_lib/http.js';
import { getDb } from './_lib/db.js';
import { hashPassword } from './_lib/password.js';
import { startSession, validUsername, validPassword } from './_lib/auth.js';

export default handler('signup', ['POST'], async (req, res) => {
  const { username, password, consent } = await readJson(req);
  if (consent !== true) return sendJson(res, 400, { error: '동의한 경우에만 가입할 수 있어요' });
  if (!validUsername(username)) return sendJson(res, 400, { error: '아이디는 영문·숫자 4–20자로 정해 주세요' });
  if (!validPassword(password)) return sendJson(res, 400, { error: '비밀번호는 8자 이상으로 정해 주세요' });

  const db = await getDb();
  const { hash, salt } = await hashPassword(password); // 원문은 저장하지 않는다
  const user = await db.createUser({
    username,
    password_hash: hash,
    password_salt: salt,
    consented_at: new Date().toISOString(), // 동의 시각은 서버 시각으로 기록
  });
  await startSession(req, res, 'user', user.id);
  sendJson(res, 201, { username: user.username });
});
