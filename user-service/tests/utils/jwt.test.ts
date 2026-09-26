// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-26
// 26/09/2026: Stage 7 - unit tests for jwt.ts (claim shape, algorithm, verification)
// Author review:
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../../src/utils/jwt.js';
import {
  publicKey,
  signExpiredToken,
  signToken,
  signWithOtherKey,
  tamperSignature,
} from '../helpers/keys.js';

describe('signAccessToken', () => {
  it('produces an RS256 token with claims { sub, role } and a ~15 minute expiry', () => {
    const token = signAccessToken({ userId: 'abc', role: 'admin' });
    const decoded = jwt.decode(token, { complete: true })!;
    const payload = decoded.payload as jwt.JwtPayload;

    expect(decoded.header.alg).toBe('RS256');
    expect(payload.sub).toBe('abc');
    expect(payload.role).toBe('admin');
    expect(payload.exp! - payload.iat!).toBe(15 * 60);
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'role', 'sub']);
  });

  it('is verifiable with the public key', () => {
    const token = signAccessToken({ userId: 'abc', role: 'user' });
    expect(() => jwt.verify(token, publicKey(), { algorithms: ['RS256'] })).not.toThrow();
  });
});

describe('verifyAccessToken', () => {
  it('returns { user_id, role } from a valid token', () => {
    expect(verifyAccessToken(signToken({ sub: 'u1', role: 'super admin' }))).toEqual({
      user_id: 'u1',
      role: 'super admin',
    });
  });

  it('throws on an expired token', () => {
    expect(() => verifyAccessToken(signExpiredToken())).toThrow();
  });

  it('throws on a tampered signature', () => {
    expect(() => verifyAccessToken(tamperSignature(signToken()))).toThrow();
  });

  it('throws on a token signed by a different key pair', () => {
    expect(() => verifyAccessToken(signWithOtherKey())).toThrow();
  });

  it('throws on garbage', () => {
    expect(() => verifyAccessToken('not-a-jwt')).toThrow();
    expect(() => verifyAccessToken('')).toThrow();
  });

  it('rejects an HS256 token signed with the public key (algorithm pinned to RS256)', () => {
    const forged = jwt.sign({ role: 'super admin' }, publicKey(), {
      algorithm: 'HS256',
      subject: 'attacker',
      expiresIn: '15m',
    });
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('rejects an unsigned (alg none) token', () => {
    const forged = jwt.sign({ role: 'super admin' }, '', {
      algorithm: 'none',
      subject: 'attacker',
    });
    expect(() => verifyAccessToken(forged)).toThrow();
  });
});
