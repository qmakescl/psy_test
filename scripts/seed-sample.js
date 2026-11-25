// 샘플 회차 만들기: npm run seed (.env.local의 SUPABASE_URL, SUPABASE_SECRET_KEY, SAMPLE_PASSWORD 사용)
// 샘플 계정 sample01–sample05(연령대·성별 임의 등록)와 합성 게스트 응답 15건을 SAMPLE 회차로 넣는다.
// 다시 실행하면 기존 샘플 자료를 지우고 새로 만든다.
import { getDb } from '../api/_lib/db.js';
import { seedSample, SAMPLE_SESSION } from '../api/_lib/sample-data.js';

const password = process.env.SAMPLE_PASSWORD;
if (!password || password.length < 8) {
  console.error('SAMPLE_PASSWORD(8자 이상)를 .env.local에 넣어 주세요.');
  process.exit(1);
}
const db = await getDb();
await seedSample(db, password);
const rows = await db.listResponses({ sessionCode: SAMPLE_SESSION });
console.log(`샘플 회차 ${SAMPLE_SESSION}: 응답 ${rows.length}건(샘플 계정 5 + 합성 게스트 15)을 만들었습니다.`);
