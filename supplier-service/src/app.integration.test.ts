/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Generated integration tests for the Phase 0 middleware chain from the Phase 0 plan.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from './app.js';

describe('app (Phase 0 middleware chain)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects an unauthenticated request to any /api/v1 route with 401', async () => {
    const res = await request(app).get('/api/v1/__probe');
    expect(res.status).toBe(401);
    expect(res.body.status_code).toBe(401);
  });

  it('returns 404 for an unknown route once authenticated', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ user_id: 'u-1', role: 'user' }), { status: 200 }),
    );

    const res = await request(app).get('/api/v1/__probe').set('Authorization', 'Bearer good-token');
    expect(res.status).toBe(404);
  });

  it('does not set any CORS headers (single-origin API gateway, §3)', async () => {
    const res = await request(app).get('/api/v1/__probe');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
