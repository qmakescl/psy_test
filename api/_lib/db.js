// DB 연결 선택. 실제 배포는 Supabase, 로컬 연습(npm run dev)은 메모리 DB를 쓴다.
// 두 파일(db-supabase.js, db-memory.js)은 같은 함수 이름을 가진다.

export const DEFAULT_SETTINGS = {
  allow_guest: 'false',        // 게스트 응답 허용
  session_code: 'KNU-2026-12', // 현재 회차 코드 — 새 응답이 이 회차로 저장된다
  phase: 'collecting',         // collecting: 응답 받는 중(건수만 공개) / closed: 마감(집계 공개)
  admin_failed_attempts: '0',  // 진행자 로그인 연속 실패 횟수
  admin_locked_until: '',      // 진행자 로그인 잠금 해제 시각(ISO), 비어 있으면 잠금 없음
};

let driver;

export async function getDb() {
  if (!driver) {
    if (process.env.DB_DRIVER === 'memory') {
      driver = await import('./db-memory.js');
    } else {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
        throw new Error('SUPABASE_URL 또는 SUPABASE_SECRET_KEY 환경변수가 없습니다');
      }
      driver = await import('./db-supabase.js');
    }
  }
  return driver;
}

// settings 표 값을 화면·코드에서 쓰기 좋은 모양으로 바꾼다
export async function readSettings() {
  const db = await getDb();
  const s = { ...DEFAULT_SETTINGS, ...(await db.getSettings()) };
  return {
    allowGuest: s.allow_guest === 'true',
    sessionCode: s.session_code,
    phase: s.phase === 'closed' ? 'closed' : 'collecting',
    adminFailed: Number(s.admin_failed_attempts) || 0,
    adminLockedUntil: s.admin_locked_until ? new Date(s.admin_locked_until) : null,
  };
}
