/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated Vitest HTTP tests (supertest, real test DB) for GET /users, GET /users/:id
 *        and PUT /users/:id/status, covering the Stage 9 Verification bullets in
 *        instructions.md.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added HTTP tests for PUT /users/:id/role, covering the Stage 10 Verification bullets.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import {
  getRefreshTokens,
  getUserByEmail,
  seedRefreshToken,
  setUserStatus,
  truncateAll,
} from '../helpers/db.js';
import { resetEmailMock } from '../helpers/email.js';
import {
  accessTokenFor,
  bearer,
  createActiveUser,
  createUserWithRole,
  loginTokens,
  refreshCookie,
  registerPending,
  type TestUser,
} from '../helpers/fixtures.js';
import { signExpiredToken } from '../helpers/keys.js';

resetEmailMock();
beforeEach(truncateAll);
afterEach(truncateAll);

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const UNAUTHORIZED = { message: 'Unauthorized', code: 'UNAUTHORIZED' };
const FORBIDDEN = { message: 'Forbidden', code: 'FORBIDDEN' };

// Caller fixtures: each logs in after the role is set, so the access token carries that role.
async function callerToken(role: 'user' | 'admin' | 'super admin', n: number | string = 'caller') {
  const user = await createUserWithRole(n, role);
  return { user, token: await accessTokenFor(user) };
}

const get = (path: string, token?: string) => {
  const r = request(app).get(path);
  return token ? r.set('Authorization', bearer(token)) : r;
};
const put = (path: string, token: string | undefined, body: unknown) => {
  const r = request(app).put(path);
  return (token ? r.set('Authorization', bearer(token)) : r).send(body as object);
};

const putStatus = (token: string, target: TestUser | { id: string }, status: unknown) =>
  put(`/users/${target.id}/status`, token, { status });

describe('GET /users', () => {
  it('rejects a request with no Authorization header with 401 UNAUTHORIZED', async () => {
    const res = await get('/users');
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('rejects an expired token with 401 UNAUTHORIZED', async () => {
    const res = await get('/users', signExpiredToken({ role: 'admin' }));
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('rejects a regular user with 403 FORBIDDEN', async () => {
    const { token } = await callerToken('user');
    const res = await get('/users', token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(FORBIDDEN);
  });

  it.each(['admin', 'super admin'] as const)('allows a %s and wraps the list in { users }', async (role) => {
    const { token } = await callerToken(role);
    const res = await get('/users', token);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['users']);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users).toHaveLength(1);
  });

  it('returns pending, active and suspended users, each with a status and no password_hash', async () => {
    const { token } = await callerToken('admin');
    const pending = await registerPending(1);
    const suspended = await createActiveUser(2);
    await setUserStatus(suspended.id, 'suspended');
    const active = await createActiveUser(3);

    const res = await get('/users', token);
    expect(res.status).toBe(200);
    const byId = new Map<string, { status: string }>(
      res.body.users.map((u: { id: string; status: string }) => [u.id, u]),
    );
    expect(byId.get(pending.id)!.status).toBe('pending');
    expect(byId.get(suspended.id)!.status).toBe('suspended');
    expect(byId.get(active.id)!.status).toBe('active');
    for (const u of res.body.users) {
      expect(u).not.toHaveProperty('password_hash');
      expect(Object.keys(u).sort()).toEqual(
        ['created_at', 'email', 'id', 'role', 'status', 'updated_at', 'username'].sort(),
      );
    }
  });
});

describe('GET /users/:id', () => {
  it('rejects a request with no token with 401 and a regular user with 403', async () => {
    const target = await createActiveUser(1);
    expect((await get(`/users/${target.id}`)).status).toBe(401);
    const { token } = await callerToken('user');
    const res = await get(`/users/${target.id}`, token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(FORBIDDEN);
  });

  it('returns an existing user minus password_hash', async () => {
    const { token } = await callerToken('admin');
    const target = await createActiveUser(1);
    const res = await get(`/users/${target.id}`, token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: target.id,
      username: target.username,
      email: target.email,
      status: 'active',
      role: 'user',
    });
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it("returns a pending user's record with status 'pending'", async () => {
    const { token } = await callerToken('admin');
    const pending = await registerPending(1);
    const res = await get(`/users/${pending.id}`, token);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it("returns a suspended user's record with status 'suspended'", async () => {
    const { token } = await callerToken('admin');
    const target = await createActiveUser(1);
    await setUserStatus(target.id, 'suspended');
    const res = await get(`/users/${target.id}`, token);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suspended');
  });

  it('returns 404 USER_NOT_FOUND for a well-formed UUID that does not exist', async () => {
    const { token } = await callerToken('admin');
    const res = await get(`/users/${UNKNOWN_ID}`, token);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'User not found', code: 'USER_NOT_FOUND' });
  });

  it('returns 400 VALIDATION_ERROR "Invalid user ID" for a non-UUID id', async () => {
    const { token } = await callerToken('admin');
    const res = await get('/users/abc123', token);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Invalid user ID', code: 'VALIDATION_ERROR' });
  });
});

describe('PUT /users/:id/status', () => {
  describe('authentication and authorization', () => {
    it('rejects a request with no token with 401 UNAUTHORIZED', async () => {
      const target = await createActiveUser(1);
      const res = await put(`/users/${target.id}/status`, undefined, { status: 'suspended' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(UNAUTHORIZED);
    });

    it('rejects a regular user with 403 FORBIDDEN and changes nothing', async () => {
      const { token } = await callerToken('user');
      const target = await createActiveUser(1);
      const res = await putStatus(token, target, 'suspended');
      expect(res.status).toBe(403);
      expect(res.body).toEqual(FORBIDDEN);
      expect((await getUserByEmail(target.email))!.status).toBe('active');
    });
  });

  describe('suspend and unsuspend', () => {
    it('suspends an active user: status suspended in the DB and all their refresh tokens revoked', async () => {
      const { token } = await callerToken('admin');
      const target = await createActiveUser(1);
      await loginTokens(target);
      await seedRefreshToken(target.id, 'extra-token');

      const res = await putStatus(token, target, 'suspended');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: target.id, status: 'suspended' });
      expect(res.body).not.toHaveProperty('password_hash');
      expect((await getUserByEmail(target.email))!.status).toBe('suspended');
      const tokens = await getRefreshTokens(target.id);
      expect(tokens.length).toBeGreaterThanOrEqual(2);
      expect(tokens.every((t) => t.is_revoked)).toBe(true);
    });

    it('unsuspends a suspended user: status flips back and no token rows are touched', async () => {
      const { token } = await callerToken('admin');
      const target = await createActiveUser(1);
      await seedRefreshToken(target.id, 'tok-a');
      await putStatus(token, target, 'suspended');
      const tokensBefore = await getRefreshTokens(target.id);

      const res = await putStatus(token, target, 'active');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
      expect((await getUserByEmail(target.email))!.status).toBe('active');
      expect(await getRefreshTokens(target.id)).toEqual(tokensBefore);
    });

    it("after a suspend, POST /auth/refresh with the user's pre-suspension cookie gets 401", async () => {
      const { token } = await callerToken('admin');
      const target = await createActiveUser(1);
      const { refreshToken } = await loginTokens(target);

      await putStatus(token, target, 'suspended');
      const res = await request(app).post('/auth/refresh').set('Cookie', refreshCookie(refreshToken));
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('returns 404 USER_NOT_FOUND for a nonexistent target', async () => {
      const { token } = await callerToken('admin');
      const res = await putStatus(token, { id: UNKNOWN_ID }, 'suspended');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found', code: 'USER_NOT_FOUND' });
    });
  });

  describe('request validation', () => {
    it("rejects status 'pending' with 400 VALIDATION_ERROR", async () => {
      const { token } = await callerToken('admin');
      const target = await createActiveUser(1);
      const res = await putStatus(token, target, 'pending');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: "Status must be 'active' or 'suspended'",
        code: 'VALIDATION_ERROR',
      });
      expect((await getUserByEmail(target.email))!.status).toBe('active');
    });

    it('rejects a missing status with "Status is required"', async () => {
      const { token } = await callerToken('admin');
      const target = await createActiveUser(1);
      const res = await put(`/users/${target.id}/status`, token, {});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Status is required', code: 'VALIDATION_ERROR' });
    });

    it('rejects a non-string status with "Status must be a string"', async () => {
      const { token } = await callerToken('admin');
      const target = await createActiveUser(1);
      const res = await putStatus(token, target, 123);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Status must be a string', code: 'VALIDATION_ERROR' });
    });

    it('rejects an extra field with "Request contains unexpected fields"', async () => {
      const { token } = await callerToken('admin');
      const target = await createActiveUser(1);
      const res = await put(`/users/${target.id}/status`, token, {
        status: 'suspended',
        role: 'admin',
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Request contains unexpected fields',
        code: 'VALIDATION_ERROR',
      });
      expect((await getUserByEmail(target.email))!.status).toBe('active');
    });

    it('rejects a non-UUID id with 400 "Invalid user ID"', async () => {
      const { token } = await callerToken('admin');
      const res = await put('/users/abc123/status', token, { status: 'suspended' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Invalid user ID', code: 'VALIDATION_ERROR' });
    });
  });

  describe('target role restriction', () => {
    it('admin suspends a plain user: 200', async () => {
      const { token } = await callerToken('admin');
      const target = await createUserWithRole(1, 'user');
      expect((await putStatus(token, target, 'suspended')).status).toBe(200);
    });

    it('admin suspends an admin: 403 FORBIDDEN, target unchanged', async () => {
      const { token } = await callerToken('admin');
      const target = await createUserWithRole(1, 'admin');
      const res = await putStatus(token, target, 'suspended');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect((await getUserByEmail(target.email))!.status).toBe('active');
    });

    it('admin suspends the super admin: 403 SUPER_ADMIN_IMMUTABLE', async () => {
      const { token } = await callerToken('admin');
      const target = await createUserWithRole(1, 'super admin');
      const res = await putStatus(token, target, 'suspended');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUPER_ADMIN_IMMUTABLE');
      expect((await getUserByEmail(target.email))!.status).toBe('active');
    });

    it('super admin suspends a plain user: 200', async () => {
      const { token } = await callerToken('super admin');
      const target = await createUserWithRole(1, 'user');
      expect((await putStatus(token, target, 'suspended')).status).toBe(200);
    });

    it('super admin suspends an admin: 200', async () => {
      const { token } = await callerToken('super admin');
      const target = await createUserWithRole(1, 'admin');
      const res = await putStatus(token, target, 'suspended');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('suspended');
    });

    it('super admin attempts to suspend the super admin account: 403 SUPER_ADMIN_IMMUTABLE', async () => {
      const { user, token } = await callerToken('super admin');
      const res = await putStatus(token, user, 'suspended');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        message: 'Cannot modify a super administrator',
        code: 'SUPER_ADMIN_IMMUTABLE',
      });
      expect((await getUserByEmail(user.email))!.status).toBe('active');
    });
  });

  describe('pending target', () => {
    it.each(['suspended', 'active'] as const)(
      'status %s on a pending user: 422 CANNOT_CHANGE_STATUS_PENDING_USER, user stays pending',
      async (status) => {
        const { token } = await callerToken('admin');
        const pending = await registerPending(1);
        const res = await putStatus(token, pending, status);
        expect(res.status).toBe(422);
        expect(res.body).toEqual({
          message: 'Cannot change the status of a pending user',
          code: 'CANNOT_CHANGE_STATUS_PENDING_USER',
        });
        expect((await getUserByEmail(pending.email))!.status).toBe('pending');
      },
    );
  });

  describe('no-op requests', () => {
    it('suspending an already-suspended user: 200, unchanged user, updated_at and revoked_at untouched', async () => {
      const { token } = await callerToken('admin');
      const target = await createActiveUser(1);
      await seedRefreshToken(target.id, 'tok-a');
      await putStatus(token, target, 'suspended');
      const userBefore = (await getUserByEmail(target.email))!;
      const tokensBefore = await getRefreshTokens(target.id);

      const res = await putStatus(token, target, 'suspended');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('suspended');
      expect(new Date(res.body.updated_at)).toEqual(userBefore.updated_at);
      expect((await getUserByEmail(target.email))!.updated_at).toEqual(userBefore.updated_at);
      expect((await getRefreshTokens(target.id)).map((t) => t.revoked_at)).toEqual(
        tokensBefore.map((t) => t.revoked_at),
      );
    });

    it('unsuspending an already-active user: 200, unchanged user, no revocation', async () => {
      const { token } = await callerToken('admin');
      const target = await createActiveUser(1);
      await seedRefreshToken(target.id, 'tok-a');
      const userBefore = (await getUserByEmail(target.email))!;

      const res = await putStatus(token, target, 'active');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
      expect(new Date(res.body.updated_at)).toEqual(userBefore.updated_at);
      expect((await getUserByEmail(target.email))!.updated_at).toEqual(userBefore.updated_at);
      expect((await getRefreshTokens(target.id))[0]!.is_revoked).toBe(false);
    });
  });
});

const putRole = (token: string, target: TestUser | { id: string }, role: unknown) =>
  put(`/users/${target.id}/role`, token, { role });

describe('PUT /users/:id/role', () => {
  describe('authentication and authorization', () => {
    it('rejects a request with no token with 401 UNAUTHORIZED', async () => {
      const target = await createActiveUser(1);
      const res = await put(`/users/${target.id}/role`, undefined, { role: 'admin' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(UNAUTHORIZED);
    });

    it('rejects a regular admin with 403 FORBIDDEN, before the handler runs (role unchanged)', async () => {
      const { token } = await callerToken('admin');
      const target = await createActiveUser(1);
      const res = await putRole(token, target, 'admin');
      expect(res.status).toBe(403);
      expect(res.body).toEqual(FORBIDDEN);
      expect((await getUserByEmail(target.email))!.role).toBe('user');
    });

    it('rejects an admin even for an invalid body or id: authorize runs first', async () => {
      const { token } = await callerToken('admin');
      const res = await put('/users/abc123/role', token, { role: 'super admin' });
      expect(res.status).toBe(403);
      expect(res.body).toEqual(FORBIDDEN);
    });

    it('rejects a regular user with 403 FORBIDDEN', async () => {
      const { token } = await callerToken('user');
      const target = await createActiveUser(1);
      const res = await putRole(token, target, 'admin');
      expect(res.status).toBe(403);
      expect(res.body).toEqual(FORBIDDEN);
      expect((await getUserByEmail(target.email))!.role).toBe('user');
    });
  });

  describe('promote and demote', () => {
    it('promotes a regular user to admin: 200, role updated, all their refresh tokens revoked', async () => {
      const { token } = await callerToken('super admin');
      const target = await createActiveUser(1);
      await loginTokens(target);
      await seedRefreshToken(target.id, 'extra-token');

      const res = await putRole(token, target, 'admin');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: target.id, role: 'admin', status: 'active' });
      expect(res.body).not.toHaveProperty('password_hash');
      expect((await getUserByEmail(target.email))!.role).toBe('admin');
      const tokens = await getRefreshTokens(target.id);
      expect(tokens.length).toBeGreaterThanOrEqual(2);
      expect(tokens.every((t) => t.is_revoked)).toBe(true);
    });

    it('demotes an admin to user: 200, tokens revoked', async () => {
      const { token } = await callerToken('super admin');
      const target = await createUserWithRole(1, 'admin');
      await loginTokens(target);

      const res = await putRole(token, target, 'user');
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('user');
      expect((await getUserByEmail(target.email))!.role).toBe('user');
      expect((await getRefreshTokens(target.id)).every((t) => t.is_revoked)).toBe(true);
    });
  });

  describe('targets that cannot be changed', () => {
    it('super admin targeting their own id: 403 SELF_ROLE_CHANGE', async () => {
      const { user, token } = await callerToken('super admin');
      const res = await putRole(token, user, 'user');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'Cannot modify your own role', code: 'SELF_ROLE_CHANGE' });
      expect((await getUserByEmail(user.email))!.role).toBe('super admin');
    });

    it('super admin targeting another super admin account: 403 SUPER_ADMIN_IMMUTABLE', async () => {
      const { token } = await callerToken('super admin');
      const other = await createUserWithRole('sa2', 'super admin');
      const res = await putRole(token, other, 'user');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        message: 'Cannot modify a super administrator',
        code: 'SUPER_ADMIN_IMMUTABLE',
      });
      expect((await getUserByEmail(other.email))!.role).toBe('super admin');
    });

    it('nonexistent target: 404 USER_NOT_FOUND', async () => {
      const { token } = await callerToken('super admin');
      const res = await putRole(token, { id: UNKNOWN_ID }, 'admin');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found', code: 'USER_NOT_FOUND' });
    });

    it('a pending user: 422 CANNOT_CHANGE_ROLE_PENDING_USER, role unchanged', async () => {
      const { token } = await callerToken('super admin');
      const pending = await registerPending(1);
      const res = await putRole(token, pending, 'admin');
      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        message: 'Cannot change the role of a pending user',
        code: 'CANNOT_CHANGE_ROLE_PENDING_USER',
      });
      expect((await getUserByEmail(pending.email))!.role).toBe('user');
    });

    it('a suspended user: 422 CANNOT_CHANGE_ROLE_SUSPENDED_USER, role unchanged, no token rows touched', async () => {
      const { token } = await callerToken('super admin');
      const target = await createActiveUser(1);
      await seedRefreshToken(target.id, 'tok-a');
      await setUserStatus(target.id, 'suspended');
      const tokensBefore = await getRefreshTokens(target.id);

      const res = await putRole(token, target, 'admin');
      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        message: 'Cannot change the role of a suspended user',
        code: 'CANNOT_CHANGE_ROLE_SUSPENDED_USER',
      });
      expect((await getUserByEmail(target.email))!.role).toBe('user');
      expect(await getRefreshTokens(target.id)).toEqual(tokensBefore);
    });
  });

  describe('request validation', () => {
    it("rejects role 'super admin' with 400 \"Role must be 'admin' or 'user'\"", async () => {
      const { token } = await callerToken('super admin');
      const target = await createActiveUser(1);
      const res = await putRole(token, target, 'super admin');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: "Role must be 'admin' or 'user'",
        code: 'VALIDATION_ERROR',
      });
      expect((await getUserByEmail(target.email))!.role).toBe('user');
    });

    it('rejects a missing role with "Role is required"', async () => {
      const { token } = await callerToken('super admin');
      const target = await createActiveUser(1);
      const res = await put(`/users/${target.id}/role`, token, {});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Role is required', code: 'VALIDATION_ERROR' });
    });

    it('rejects a non-string role with "Role must be a string"', async () => {
      const { token } = await callerToken('super admin');
      const target = await createActiveUser(1);
      const res = await putRole(token, target, 123);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Role must be a string', code: 'VALIDATION_ERROR' });
    });

    it('rejects an extra field with "Request contains unexpected fields"', async () => {
      const { token } = await callerToken('super admin');
      const target = await createActiveUser(1);
      const res = await put(`/users/${target.id}/role`, token, { role: 'admin', status: 'active' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Request contains unexpected fields',
        code: 'VALIDATION_ERROR',
      });
      expect((await getUserByEmail(target.email))!.role).toBe('user');
    });

    it('rejects a non-UUID target id with 400 "Invalid user ID"', async () => {
      const { token } = await callerToken('super admin');
      const res = await put('/users/abc123/role', token, { role: 'admin' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Invalid user ID', code: 'VALIDATION_ERROR' });
    });
  });

  describe('stale access tokens and revoked refresh tokens', () => {
    it('after a promotion, the pre-promotion access token (role user) is still rejected by an admin route with 403', async () => {
      const { token } = await callerToken('super admin');
      const target = await createActiveUser(1);
      const { accessToken: oldToken } = await loginTokens(target);

      expect((await putRole(token, target, 'admin')).status).toBe(200);
      const res = await get('/users', oldToken);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(FORBIDDEN);
    });

    it('after a promotion, refreshing with the pre-promotion cookie gets 401 INVALID_REFRESH_TOKEN', async () => {
      const { token } = await callerToken('super admin');
      const target = await createActiveUser(1);
      const { refreshToken } = await loginTokens(target);

      await putRole(token, target, 'admin');
      const res = await request(app).post('/auth/refresh').set('Cookie', refreshCookie(refreshToken));
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it("after a demotion, the demoted admin's old access token still works on an admin route within its lifetime", async () => {
      const { token } = await callerToken('super admin');
      const target = await createUserWithRole(1, 'admin');
      const { accessToken: oldToken } = await loginTokens(target);

      expect((await putRole(token, target, 'user')).status).toBe(200);
      const res = await get('/users', oldToken);
      expect(res.status).toBe(200);
    });

    it('after a demotion, refreshing with the old cookie gets 401 INVALID_REFRESH_TOKEN', async () => {
      const { token } = await callerToken('super admin');
      const target = await createUserWithRole(1, 'admin');
      const { refreshToken } = await loginTokens(target);

      await putRole(token, target, 'user');
      const res = await request(app).post('/auth/refresh').set('Cookie', refreshCookie(refreshToken));
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('no-op requests', () => {
    it('promoting an admin to admin again: 200, unchanged user, no refresh tokens revoked', async () => {
      const { token } = await callerToken('super admin');
      const target = await createUserWithRole(1, 'admin');
      await seedRefreshToken(target.id, 'tok-a');
      const before = (await getUserByEmail(target.email))!;

      const res = await putRole(token, target, 'admin');
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('admin');
      expect(new Date(res.body.updated_at)).toEqual(before.updated_at);
      expect((await getUserByEmail(target.email))!.updated_at).toEqual(before.updated_at);
      expect((await getRefreshTokens(target.id))[0]!.is_revoked).toBe(false);
    });

    it('demoting a user to user again: 200, unchanged user, no refresh tokens revoked', async () => {
      const { token } = await callerToken('super admin');
      const target = await createActiveUser(1);
      await seedRefreshToken(target.id, 'tok-a');
      const before = (await getUserByEmail(target.email))!;

      const res = await putRole(token, target, 'user');
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('user');
      expect(new Date(res.body.updated_at)).toEqual(before.updated_at);
      expect((await getUserByEmail(target.email))!.updated_at).toEqual(before.updated_at);
      expect((await getRefreshTokens(target.id))[0]!.is_revoked).toBe(false);
    });
  });
});
