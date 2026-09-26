// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-26
// 26/09/2026: Stage 7 - tests for the authenticate middleware and its agreement with GET /auth/verify
// Author review:
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { authenticate } from '../../src/middleware/authenticate.js';
import { signExpiredToken, signToken, signWithOtherKey, tamperSignature } from '../helpers/keys.js';

// Throwaway protected route, mounted here only (nothing is added to app.ts / server.ts).
const protectedApp = express();
protectedApp.get('/protected', authenticate, (req, res) => {
  res.status(200).json({ user: req.user });
});

const UNAUTHORIZED = { message: 'Unauthorized', code: 'UNAUTHORIZED' };

describe('authenticate middleware', () => {
  it('rejects a request with no Authorization header with 401 UNAUTHORIZED', async () => {
    const res = await request(protectedApp).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('rejects a non-Bearer Authorization header', async () => {
    const res = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Basic ${signToken()}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('rejects an expired token', async () => {
    const res = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${signExpiredToken()}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('rejects a token with a tampered signature', async () => {
    const res = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${tamperSignature(signToken())}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('rejects a well-formed token signed with a different key pair', async () => {
    const res = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${signWithOtherKey()}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('rejects garbage after "Bearer "', async () => {
    const res = await request(protectedApp)
      .get('/protected')
      .set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('attaches { user_id, role } to req.user for a valid token', async () => {
    const res = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${signToken({ sub: 'u-1', role: 'admin' })}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ user_id: 'u-1', role: 'admin' });
  });
});

describe('authenticate and GET /auth/verify agree on the same token', () => {
  const cases: [string, () => string][] = [
    ['valid', () => signToken({ sub: 'u-1', role: 'user' })],
    ['expired', () => signExpiredToken()],
    ['tampered', () => tamperSignature(signToken())],
    ['wrong key', () => signWithOtherKey()],
  ];

  it.each(cases)('%s token is accepted or rejected by both', async (_name, make) => {
    const token = make();
    const viaMiddleware = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    const viaVerify = await request(app)
      .get('/auth/verify')
      .set('Authorization', `Bearer ${token}`);

    expect(viaMiddleware.status === 200).toBe(viaVerify.status === 200);
    if (viaVerify.status === 200) {
      expect(viaVerify.body).toEqual({ user_id: 'u-1', role: 'user' });
      expect(viaMiddleware.body.user).toEqual(viaVerify.body);
    }
  });
});
