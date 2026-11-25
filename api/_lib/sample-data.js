// 샘플 회차(SAMPLE) — 실제 참가자가 아닌, 미리 만든 가상 자료.
// · 샘플 계정 5개: 연령대·성별을 임의로 등록했다. '가입할 때 기본 정보를 받는 서비스'라면
//   DB에 어떻게 쌓이고 집단별 평균이 어떻게 숨겨지는지를 이 계정들로 보여준다(실제 참가자는 기본 정보를 받지 않음).
// · 합성 게스트 응답 15건: 통계분석(10건 이상 필요)을 시연할 수 있게 채운다.
// data/sample_practice.csv 는 이 20건으로 만든 실습용 파일이다(npm run make:csv).
import { ITEMS, SCALE } from '../../lib/items.js';
import { scoreResponses } from '../../lib/scoring.js';
import { hashPassword } from './password.js';

export const SAMPLE_SESSION = 'SAMPLE';

export const SAMPLE_ACCOUNTS = [
  { username: 'sample01', age_group: '20s', gender: 'female', answers: [4, 1, 3, 3, 4, 2, 3, 3, 3, 2] },
  { username: 'sample02', age_group: '30s', gender: 'male',   answers: [1, 4, 2, 5, 3, 5, 1, 5, 1, 3] },
  { username: 'sample03', age_group: '20s', gender: 'female', answers: [4, 5, 3, 4, 1, 3, 3, 2, 4, 3] },
  { username: 'sample04', age_group: '40s', gender: 'na',     answers: [5, 1, 4, 2, 4, 2, 3, 3, 3, 2] },
  { username: 'sample05', age_group: '50s+', gender: 'male',  answers: [4, 2, 2, 1, 4, 3, 5, 3, 3, 2] },
];

export const SAMPLE_GUEST_ANSWERS = [
  [3, 4, 4, 4, 3, 3, 2, 2, 2, 3], [3, 1, 4, 4, 3, 2, 4, 2, 3, 3], [1, 4, 1, 4, 2, 4, 1, 3, 1, 4],
  [1, 5, 2, 4, 1, 4, 1, 5, 1, 4], [5, 2, 5, 1, 3, 3, 5, 1, 4, 2], [4, 4, 4, 2, 3, 3, 3, 1, 2, 4],
  [4, 3, 4, 1, 3, 2, 4, 3, 2, 2], [4, 2, 3, 2, 5, 4, 4, 2, 4, 1], [1, 3, 1, 5, 1, 3, 1, 5, 3, 5],
  [4, 1, 5, 3, 4, 2, 4, 2, 4, 3], [3, 3, 2, 3, 2, 4, 2, 3, 2, 4], [3, 1, 3, 1, 4, 3, 4, 3, 3, 1],
  [1, 3, 4, 5, 2, 4, 2, 4, 2, 4], [4, 3, 2, 2, 3, 3, 3, 4, 1, 4], [1, 5, 2, 4, 1, 5, 2, 4, 2, 4],
];

const BASE_TIME = Date.parse('2026-11-20T01:00:00Z'); // 한국 시각 10:00

function responseRow(answers, userId, minute) {
  const at = new Date(BASE_TIME + minute * 60_000).toISOString();
  const row = { user_id: userId, session_code: SAMPLE_SESSION, score_mean: scoreResponses(answers, ITEMS), scale_version: SCALE.version, created_at: at, consented_at: userId ? null : at };
  answers.forEach((v, i) => { row[`item_${String(i + 1).padStart(2, '0')}`] = v; });
  return row;
}

// db: getDb()가 돌려준 모듈. password: 샘플 계정 공통 비밀번호(저장소에 적지 않는다)
export async function seedSample(db, password) {
  await db.deleteSampleData(SAMPLE_SESSION);
  for (const [i, acc] of SAMPLE_ACCOUNTS.entries()) {
    const { hash, salt } = await hashPassword(password);
    const user = await db.createUser({
      username: acc.username, password_hash: hash, password_salt: salt,
      age_group: acc.age_group, gender: acc.gender, is_sample: true,
      consented_at: new Date(BASE_TIME + i * 60_000).toISOString(),
    });
    await db.insertResponse(responseRow(acc.answers, user.id, i));
  }
  for (const [i, answers] of SAMPLE_GUEST_ANSWERS.entries()) {
    await db.insertResponse(responseRow(answers, null, 5 + i));
  }
}
