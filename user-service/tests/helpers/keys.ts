// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-26
// 26/09/2026: Stage 7 - sign test JWTs with the throwaway keys
// Author review:
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const privateKey = () => readFileSync(process.env.JWT_PRIVATE_KEY_PATH!, 'utf8');
export const publicKey = () => readFileSync(process.env.JWT_PUBLIC_KEY_PATH!, 'utf8');

export function signToken(
  claims: { sub?: string; role?: string } = {},
  options: jwt.SignOptions = {},
): string {
  const { sub = 'user-id-1', role = 'user' } = claims;
  return jwt.sign({ role }, privateKey(), {
    algorithm: 'RS256',
    subject: sub,
    expiresIn: '15m',
    ...options,
  });
}

export function signExpiredToken(claims: { sub?: string; role?: string } = {}): string {
  const { sub = 'user-id-1', role = 'user' } = claims;
  return jwt.sign({ role, exp: Math.floor(Date.now() / 1000) - 60 }, privateKey(), {
    algorithm: 'RS256',
    subject: sub,
  });
}

// Valid RS256 token, but signed by a key pair the service does not know.
export function signWithOtherKey(claims: { sub?: string; role?: string } = {}): string {
  const { sub = 'user-id-1', role = 'user' } = claims;
  const { privateKey: other } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return jwt.sign({ role }, other, { algorithm: 'RS256', subject: sub, expiresIn: '15m' });
}

// Flips the last characters of the signature segment.
export function tamperSignature(token: string): string {
  const [h, p, s] = token.split('.');
  const flipped = s!.slice(0, -4) + (s!.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  return `${h}.${p}.${flipped}`;
}
