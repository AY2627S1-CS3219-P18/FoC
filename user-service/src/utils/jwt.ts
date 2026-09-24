// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4a - JWT verification utility
// Author review:
// 25/09/2026: Stage 4c - JWT signing utility
// Author review:

import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const publicKey = readFileSync(config.jwt.publicKeyPath, 'utf8');
const privateKey = readFileSync(config.jwt.privateKeyPath, 'utf8');

export function verifyAccessToken(token: string): { user_id: string; role: string } {
  const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;

  return {
    user_id: payload.sub as string,
    role: payload.role as string,
  };
}

export function signAccessToken({ userId, role }: { userId: string; role: string }): string {
  return jwt.sign({ role }, privateKey, {
    algorithm: 'RS256',
    subject: userId,
    expiresIn: `${config.jwt.accessTokenTtlMinutes}m`,
  });
}
