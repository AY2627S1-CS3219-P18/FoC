/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Generated unit tests for the authenticate middleware (missing/non-Bearer header, invalid
 *        token, valid token, User Service unreachable). No requirements, architecture, schema, or
 *        API decisions were made by the AI tool.
 * Author review: Congchen
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from './errorHandler.js';
import { authenticate } from './authenticate.js';

function buildApp(): express.Express {
  const app = express();
  app.use(authenticate);
  app.get('/whoami', (req, res) => res.json({ user: req.user }));
  app.use(errorHandler);
  return app;
}

describe('authenticate', () => {
  const app = buildApp();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/whoami');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a request whose header is not a Bearer token', async () => {
    const res = await request(app).get('/whoami').set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  it('rejects when the User Service reports the token invalid', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    const res = await request(app).get('/whoami').set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
  });

  it('attaches the resolved identity when the User Service confirms the token', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ user_id: 'u-1', role: 'admin' }), { status: 200 }),
    );
    const res = await request(app).get('/whoami').set('Authorization', 'Bearer good-token');
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ user_id: 'u-1', role: 'admin' });
  });

  it('maps a network failure reaching the User Service to 500', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await request(app).get('/whoami').set('Authorization', 'Bearer good-token');
    expect(res.status).toBe(500);
  });
});
