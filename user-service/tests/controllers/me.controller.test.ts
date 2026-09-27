/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated Vitest HTTP tests (supertest, real test DB) for PUT /users/me/active-view
 *        and the activeView addition to POST /auth/login's response, covering the Stage 11b
 *        Verification bullets in instructions.md.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { getUserByEmail, truncateAll } from '../helpers/db.js';
import { resetEmailMock } from '../helpers/email.js';
import { accessTokenFor, bearer, createActiveUser, loginUser } from '../helpers/fixtures.js';

resetEmailMock();
beforeEach(truncateAll);
afterEach(truncateAll);

const UNAUTHORIZED = { message: 'Unauthorized', code: 'UNAUTHORIZED' };

const putActiveView = (token: string | undefined, body: unknown) => {
  const r = request(app).put('/users/me/active-view');
  return (token ? r.set('Authorization', bearer(token)) : r).send(body as object);
};

describe('PUT /users/me/active-view', () => {
  it('toggles the caller to courier: 200, response and DB both updated', async () => {
    const user = await createActiveUser(1);
    const token = await accessTokenFor(user);

    const res = await putActiveView(token, { activeView: 'courier' });
    expect(res.status).toBe(200);
    expect(res.body.active_view).toBe('courier');
    expect((await getUserByEmail(user.email))!.active_view).toBe('courier');
  });

  it('toggles back to requester: 200, response and DB both updated', async () => {
    const user = await createActiveUser(1);
    const token = await accessTokenFor(user);
    await putActiveView(token, { activeView: 'courier' });

    const res = await putActiveView(token, { activeView: 'requester' });
    expect(res.status).toBe(200);
    expect(res.body.active_view).toBe('requester');
    expect((await getUserByEmail(user.email))!.active_view).toBe('requester');
  });

  it('setting a value the user already has still returns 200 unchanged (no no-op branch needed)', async () => {
    const user = await createActiveUser(1);
    const token = await accessTokenFor(user);

    const res = await putActiveView(token, { activeView: 'requester' });
    expect(res.status).toBe(200);
    expect(res.body.active_view).toBe('requester');
  });

  it('rejects a request with no Authorization header: 401 UNAUTHORIZED', async () => {
    const res = await putActiveView(undefined, { activeView: 'courier' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('rejects an invalid enum value: 400 VALIDATION_ERROR', async () => {
    const user = await createActiveUser(1);
    const token = await accessTokenFor(user);
    const res = await putActiveView(token, { activeView: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: "Active view must be 'requester' or 'courier'",
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects a missing activeView field: 400 VALIDATION_ERROR', async () => {
    const user = await createActiveUser(1);
    const token = await accessTokenFor(user);
    const res = await putActiveView(token, {});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Active view is required', code: 'VALIDATION_ERROR' });
  });

  it('rejects a wrong-type activeView field: 400 VALIDATION_ERROR', async () => {
    const user = await createActiveUser(1);
    const token = await accessTokenFor(user);
    const res = await putActiveView(token, { activeView: 123 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: 'Active view must be a string',
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects an unrecognized extra field: 400 VALIDATION_ERROR', async () => {
    const user = await createActiveUser(1);
    const token = await accessTokenFor(user);
    const res = await putActiveView(token, { activeView: 'courier', extra: true });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: 'Request contains unexpected fields',
      code: 'VALIDATION_ERROR',
    });
  });
});

describe('active_view defaults and login response', () => {
  it('a newly registered-and-activated user defaults to requester without calling this endpoint', async () => {
    const user = await createActiveUser(1);
    expect((await getUserByEmail(user.email))!.active_view).toBe('requester');
  });

  it("POST /auth/login's response includes activeView reflecting the current value", async () => {
    const user = await createActiveUser(1);
    const token = await accessTokenFor(user);
    await putActiveView(token, { activeView: 'courier' });

    const res = await loginUser(user);
    expect(res.status).toBe(200);
    expect(res.body.user.activeView).toBe('courier');
  });
});
