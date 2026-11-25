// 서버 오류를 DB error_logs 표에 한 줄 남긴다.
// Vercel 런타임 로그는 1시간만 남기 때문이다. 요청 본문·비밀번호·쿠키 값은 기록하지 않는다.
import { getDb } from './db.js';

export async function logError(endpoint, err) {
  const message = String((err && err.message) || err).slice(0, 500);
  console.error(`[${endpoint}]`, message);
  try {
    const db = await getDb();
    await db.logError(endpoint, message);
  } catch {
    // 기록 자체가 실패해도 응답은 계속 돌려준다
  }
}
