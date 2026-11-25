// 메모리 DB — 로컬 연습용(npm run dev, npm test). 서버를 끄면 모두 사라진다.
// db-supabase.js와 같은 함수 이름을 가지므로 API 코드는 어느 쪽인지 모른 채 동작한다.
import crypto from 'node:crypto';
import { seedSample } from './sample-data.js';

const store = { settings: {}, users: [], sessions: [], responses: [], error_logs: [] };
const now = () => new Date().toISOString();

export async function getSettings() { return { ...store.settings }; }
export async function setSettings(values) {
  for (const [k, v] of Object.entries(values)) store.settings[k] = String(v);
}

export async function findUserByUsername(username) {
  return store.users.find((u) => u.username === username) || null;
}
export async function findUserById(id) {
  const u = store.users.find((x) => x.id === id);
  return u ? { id: u.id, username: u.username } : null;
}
export async function createUser(user) {
  if (store.users.some((u) => u.username === user.username)) {
    throw Object.assign(new Error('이미 있는 아이디예요'), { status: 409 });
  }
  const row = { id: crypto.randomUUID(), failed_attempts: 0, locked_until: null, age_group: null, gender: null, is_sample: false, created_at: now(), ...user };
  store.users.push(row);
  return { id: row.id, username: row.username };
}
export async function updateUser(id, fields) {
  Object.assign(store.users.find((u) => u.id === id) || {}, fields);
}

export async function createSession(row) { store.sessions.push({ created_at: now(), ...row }); }
export async function findSession(tokenHash) { return store.sessions.find((s) => s.token_hash === tokenHash) || null; }
export async function deleteSession(tokenHash) { store.sessions = store.sessions.filter((s) => s.token_hash !== tokenHash); }
export async function deleteExpiredSessions() {
  const t = Date.now();
  store.sessions = store.sessions.filter((s) => Date.parse(s.expires_at) >= t);
}

export async function insertResponse(row) {
  store.responses.push({ id: crypto.randomUUID(), created_at: now(), ...row });
}
export async function listResponses({ sessionCode, userId } = {}) {
  return store.responses
    .filter((r) => (!sessionCode || r.session_code === sessionCode) && (!userId || r.user_id === userId))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => {
      const u = r.user_id ? store.users.find((x) => x.id === r.user_id) : null;
      return { ...r, age_group: u?.age_group ?? null, gender: u?.gender ?? null };
    });
}

export async function logError(endpoint, message) { store.error_logs.push({ endpoint, message, created_at: now() }); }

export async function deleteSampleData(sessionCode) {
  const sampleIds = new Set(store.users.filter((u) => u.is_sample).map((u) => u.id));
  store.responses = store.responses.filter((r) => r.session_code !== sessionCode);
  store.users = store.users.filter((u) => !sampleIds.has(u.id));
}

// 처음 불릴 때 샘플 회차를 채운다. 비밀번호는 환경변수 SAMPLE_PASSWORD, 없으면 무작위로 만들어 콘솔에 보여준다.
let samplePassword = process.env.SAMPLE_PASSWORD;
if (!samplePassword) {
  samplePassword = crypto.randomBytes(6).toString('base64url');
  console.log(`[메모리 DB] 샘플 계정 sample01–sample05 비밀번호(이번 실행에서만 유효): ${samplePassword}`);
}
await seedSample({ deleteSampleData, createUser, insertResponse }, samplePassword);
