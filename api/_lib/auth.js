// 로그인 상태 관리(세션). 외부 인증 라이브러리 없이 Node 기본 crypto만 쓴다 — 원리를 보여주기 위한 교육용 구현이다.
// 실서비스에서는 검증된 인증 서비스(Supabase Auth, 소셜 로그인, 학교 통합인증 등)를 쓴다.
//
// 흐름: 로그인 성공 → 무작위 토큰 생성 → 토큰의 해시만 sessions 표에 저장 → 토큰 원문은 HttpOnly 쿠키로 브라우저에 전달
//       이후 요청 → 쿠키의 토큰을 해시해서 sessions 표에서 찾음 → 역할·만료를 매번 검사
import crypto from 'node:crypto';
import { getDb } from './db.js';
import { parseCookies, setCookie, clearCookie } from './http.js';

export const USER_COOKIE = 'psy_session';
export const ADMIN_COOKIE = 'psy_admin';
const LIFETIME = { user: 24 * 3600, admin: 12 * 3600 }; // 초: 사용자 1일, 진행자 12시간

export const LOCK_LIMIT = 5;          // 연속 실패 5회면
export const LOCK_MINUTES = 5;        // 5분 잠금

export function validUsername(u) {
  return typeof u === 'string' && /^[A-Za-z0-9]{4,20}$/.test(u);
}
export function validPassword(p) {
  return typeof p === 'string' && p.length >= 8 && p.length <= 100;
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// 길이가 달라도 걸리는 시간이 같도록 해시를 비교한다(진행자 비밀번호 확인용)
export function safeEqual(a, b) {
  return crypto.timingSafeEqual(Buffer.from(sha256(String(a)), 'hex'), Buffer.from(sha256(String(b)), 'hex'));
}

const cookieName = (role) => (role === 'admin' ? ADMIN_COOKIE : USER_COOKIE);

// 새 세션 발급. 같은 브라우저에 이전 세션이 있으면 지운다(로그인할 때마다 새 토큰).
export async function startSession(req, res, role, userId = null) {
  const db = await getDb();
  const old = parseCookies(req)[cookieName(role)];
  if (old) await db.deleteSession(sha256(old));
  const token = crypto.randomBytes(32).toString('base64url');
  await db.createSession({
    token_hash: sha256(token),
    role,
    user_id: userId,
    expires_at: new Date(Date.now() + LIFETIME[role] * 1000).toISOString(),
  });
  setCookie(res, cookieName(role), token, LIFETIME[role]);
}

// 요청의 쿠키로 세션을 찾는다. 없거나, 역할이 다르거나, 만료됐으면 null
export async function getSession(req, role) {
  const token = parseCookies(req)[cookieName(role)];
  if (!token) return null;
  const db = await getDb();
  const s = await db.findSession(sha256(token));
  if (!s || s.role !== role) return null;
  if (Date.parse(s.expires_at) < Date.now()) {
    await db.deleteSession(s.token_hash);
    return null;
  }
  return s;
}

export async function endSession(req, res, role) {
  const token = parseCookies(req)[cookieName(role)];
  if (token) {
    const db = await getDb();
    await db.deleteSession(sha256(token));
  }
  clearCookie(res, cookieName(role));
}
