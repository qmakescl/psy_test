// 요청·응답을 다루는 작은 도구 모음. Node 기본 기능만 쓴다.
// '_'로 시작하는 폴더는 Vercel이 주소(API)로 만들지 않는다 — 서버 함수끼리 나눠 쓰는 코드.
import { logError } from './log.js';

// JSON으로 응답한다. 개인 결과·진행자 화면이 브라우저나 중간 서버에 저장되지 않도록 no-store를 붙인다.
export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// 요청 본문(JSON)을 읽는다. 10KB를 넘으면 거부한다.
export async function readJson(req) {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object') return req.body; // Vercel이 미리 읽어 둔 경우
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 10_000) throw Object.assign(new Error('본문이 너무 큽니다'), { status: 413 });
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('JSON 형식이 아닙니다'), { status: 400 });
  }
}

export function getQuery(req) {
  return new URL(req.url, 'http://localhost').searchParams;
}

export function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

// 로그인 쿠키: HttpOnly(자바스크립트로 못 읽음) · Secure(https로만 전송) · SameSite=Lax(다른 사이트에서 보내는 POST에는 안 붙음)
export function setCookie(res, name, value, maxAgeSeconds) {
  const cookie = `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, cookie) : cookie);
}

export function clearCookie(res, name) {
  setCookie(res, name, '', 0);
}

// 상태를 바꾸는 요청(POST)은 우리 사이트 화면에서 보낸 것인지 Origin(없으면 Referer) 머리글로 확인한다.
function sameOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const from = req.headers.origin || req.headers.referer;
  if (!host || !from) return false;
  try {
    return new URL(from).host === host;
  } catch {
    return false;
  }
}

// 모든 API 함수를 이것으로 감싼다: 허용 메서드 확인 → POST 출처 확인 → 실행 → 예외는 error_logs에 기록
export function handler(endpoint, methods, fn) {
  return async function (req, res) {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '));
        return sendJson(res, 405, { error: '허용되지 않는 요청 방식입니다' });
      }
      if (req.method === 'POST' && !sameOrigin(req)) {
        return sendJson(res, 403, { error: '이 사이트 화면에서 보낸 요청만 받습니다' });
      }
      await fn(req, res);
    } catch (err) {
      if (err.status && err.status < 500) return sendJson(res, err.status, { error: err.message });
      await logError(endpoint, err);
      sendJson(res, 500, { error: '서버에서 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.' });
    }
  };
}
