// 비밀번호 해시. 원문은 저장하지 않고, 사용자마다 다른 무작위 salt와 함께 scrypt로 만든 해시만 저장한다.
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, KEYLEN)).toString('hex');
  return { hash, salt };
}

export async function verifyPassword(password, hash, salt) {
  const candidate = await scrypt(password, salt, KEYLEN);
  const stored = Buffer.from(hash, 'hex');
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}
