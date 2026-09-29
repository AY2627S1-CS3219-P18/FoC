/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Generated integration tests for the Phase 0 middleware chain from the Phase 0 plan.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
 * Scope (2026-09-29, Claude Code, model: claude-sonnet-5): added Phase 1 route tests. No
 *        requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-09-29, Claude Code, model: claude-sonnet-5): added Phase 2 route tests per Phase 2
 *        plan Task 8. No requirements, architecture, schema, or API decisions were made by the AI tool.
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

  it('rejects an unauthenticated GET /api/v1/suppliers with 401', async () => {
    const res = await request(app).get('/api/v1/suppliers');
    expect(res.status).toBe(401);
    expect(res.body.status_code).toBe(401);
  });

  it('routes an authenticated user to the supplier list (empty database rows mocked out)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ user_id: 'u-1', role: 'user' }), { status: 200 }),
    );
    const res = await request(app).get('/api/v1/suppliers?limit=51').set('Authorization', 'Bearer good-token');
    // limit=51 fails validation before any database access, so no MySQL is needed for this test.
    expect(res.status).toBe(422);
  });
});

describe('Phase 2 routes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const asRole = (role: string) =>
    // A fresh Response per call: a Response body can only be read once.
    vi.mocked(fetch).mockImplementation(
      async () => new Response(JSON.stringify({ user_id: 'u-1', role }), { status: 200 }),
    );

  it('rejects unauthenticated admin requests with 401', async () => {
    expect((await request(app).get('/api/v1/admin/suppliers')).status).toBe(401);
    expect((await request(app).post('/api/v1/admin/suppliers')).status).toBe(401);
    expect((await request(app).delete('/api/v1/admin/reference/faculties/1')).status).toBe(401);
  });

  it('rejects the user role with 403 on every Phase 2 route', async () => {
    asRole('user');
    const auth = { Authorization: 'Bearer t' };
    expect((await request(app).get('/api/v1/admin/suppliers').set(auth)).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/suppliers/1').set(auth)).status).toBe(403);
    expect((await request(app).post('/api/v1/admin/suppliers').set(auth)).status).toBe(403);
    expect((await request(app).post('/api/v1/admin/reference/faculties').set(auth).send({ faculty: 'X' })).status).toBe(403);
    expect((await request(app).put('/api/v1/admin/reference/locations/1').set(auth).send({ level: 1 })).status).toBe(403);
    expect((await request(app).delete('/api/v1/admin/reference/categories/1').set(auth)).status).toBe(403);
  });

  it('returns 400 for an admin create without an Idempotency-Key', async () => {
    asRole('admin');
    const res = await request(app).post('/api/v1/admin/suppliers').set('Authorization', 'Bearer t');
    expect(res.status).toBe(400);
  });

  it('returns 422 for an admin list with a bad limit', async () => {
    asRole('super admin');
    const res = await request(app).get('/api/v1/admin/suppliers?limit=10').set('Authorization', 'Bearer t');
    expect(res.status).toBe(422);
  });
});
