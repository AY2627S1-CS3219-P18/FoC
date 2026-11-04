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
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Updated the expected keys for the new active_view column (Stage 11); no new test cases.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-04
 * Scope: Updated the expected GET /users keys for isLocked/lockedUntil/lockLevel, and added
 *        HTTP tests for the `locked` filter and POST /users/:id/unlock, covering the Stage 18d
 *        Verification bullets in instructions.md.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-04
 * Scope: GET /users/:id now asserts the email is masked for a different caller and unmasked
 *        for the caller's own row; added GET /users/:id/full-email HTTP tests covering
 *        instructions.md Stage 20a's Verification bullets (NFR3.1.1).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/app.js';
import {
  dbNow,
  getRefreshTokens,
  getUserByEmail,
  setLoginLockState,
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

  it.each(['admin', 'super admin'] as const)(
    'allows a %s and returns the paginated shape',
    async (role) => {
      const { token } = await callerToken(role);
      const res = await get('/users', token);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(
        ['page', 'pageSize', 'total', 'totalPages', 'users'].sort(),
      );
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(50);
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users).toHaveLength(1);
    },
  );

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
        [
          'activeView',
          'createdAt',
          'email',
          'id',
          'isLocked',
          'lockLevel',
          'lockedUntil',
          'role',
          'status',
          'updatedAt',
          'username',
        ].sort(),
      );
    }
  });
});

describe('GET /users locked filter and fields (Stage 18d)', () => {
  it('returns isLocked/lockedUntil/lockLevel, and locked=true|false filters the result set', async () => {
    const { token } = await callerToken('admin');
    const locked = await createActiveUser(1);
    await setLoginLockState(locked.id, { lockLevel: 1, lockedUntilMinutesFromNow: 60 });
    const notLocked = await createActiveUser(2);

    const lockedRes = await get('/users?locked=true', token);
    expect(lockedRes.status).toBe(200);
    expect(lockedRes.body.users.map((u: { id: string }) => u.id)).toEqual([locked.id]);
    expect(lockedRes.body.users[0]).toMatchObject({ isLocked: true, lockLevel: 1 });
    expect(typeof lockedRes.body.users[0].lockedUntil).toBe('string');

    const notLockedRes = await get('/users?locked=false', token);
    const notLockedIds = notLockedRes.body.users.map((u: { id: string }) => u.id);
    // Also includes the admin caller created by callerToken(), which is active and not locked.
    expect(notLockedIds).toContain(notLocked.id);
    expect(notLockedIds).not.toContain(locked.id);
  });

  it("rejects an invalid locked value with 400 VALIDATION_ERROR \"locked must be 'true' or 'false'\"", async () => {
    const { token } = await callerToken('admin');
    const res = await get('/users?locked=maybe', token);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: "locked must be 'true' or 'false'",
      code: 'VALIDATION_ERROR',
    });
  });
});

describe('POST /users/:id/unlock', () => {
  const unlock = (token: string | undefined, target: { id: string }) => {
    const r = request(app).post(`/users/${target.id}/unlock`);
    return token ? r.set('Authorization', bearer(token)) : r;
  };

  it('rejects a request with no Authorization header with 401 UNAUTHORIZED', async () => {
    const target = await createActiveUser(1);
    const res = await unlock(undefined, target);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('rejects a regular user with 403 FORBIDDEN', async () => {
    const { token } = await callerToken('user');
    const target = await createActiveUser(1);
    const res = await unlock(token, target);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(FORBIDDEN);
  });

  it('an admin can unlock a plain user: 200, isLocked false, lockedUntil null, lockLevel 0', async () => {
    const { token } = await callerToken('admin');
    const target = await createActiveUser(1);
    await setLoginLockState(target.id, { lockLevel: 1, lockedUntilMinutesFromNow: 60 });

    const res = await unlock(token, target);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isLocked: false, lockedUntil: null, lockLevel: 0 });
  });

  it('rejects an admin unlocking another admin with 403 FORBIDDEN, but a super admin may', async () => {
    const { token: adminToken } = await callerToken('admin', 'caller1');
    const target = await createUserWithRole('target', 'admin');
    await setLoginLockState(target.id, { lockLevel: 1, lockedUntilMinutesFromNow: 60 });

    const res = await unlock(adminToken, target);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      message: 'Only a super admin may unlock an admin',
      code: 'FORBIDDEN',
    });

    const { token: saToken } = await callerToken('super admin', 'caller2');
    const saRes = await unlock(saToken, target);
    expect(saRes.status).toBe(200);
    expect(saRes.body.isLocked).toBe(false);
  });

  it('rejects unlocking a super admin with 403 SUPER_ADMIN_IMMUTABLE', async () => {
    const { token } = await callerToken('super admin', 'caller1');
    const target = await createUserWithRole('target', 'super admin');
    await setLoginLockState(target.id, { lockLevel: 1, lockedUntilMinutesFromNow: 60 });

    const res = await unlock(token, target);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      message: 'Cannot modify a super administrator',
      code: 'SUPER_ADMIN_IMMUTABLE',
    });
  });

  it('returns 404 USER_NOT_FOUND for an id that does not exist', async () => {
    const { token } = await callerToken('admin');
    const res = await unlock(token, { id: UNKNOWN_ID });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'User not found', code: 'USER_NOT_FOUND' });
  });

  it('returns 400 VALIDATION_ERROR "Invalid user ID" for a non-UUID id', async () => {
    const { token } = await callerToken('admin');
    const res = await unlock(token, { id: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Invalid user ID', code: 'VALIDATION_ERROR' });
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

  it('returns an existing user minus password_hash, with the email masked (Stage 20, NFR3.1.1)', async () => {
    const { token } = await callerToken('admin');
    const target = await createActiveUser(1);
    const res = await get(`/users/${target.id}`, token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: target.id,
      username: target.username,
      status: 'active',
      role: 'user',
    });
    expect(res.body.email).not.toBe(target.email);
    expect(res.body.email).toMatch(/^.\*\*\*@example\.com$/);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it("does not mask the caller's own row (Stage 20, NFR3.1.1)", async () => {
    const { user, token } = await callerToken('admin');
    const res = await get(`/users/${user.id}`, token);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
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

describe('GET /users/:id/full-email (Stage 20a, NFR3.1.1)', () => {
  const getWithUa = (path: string, token: string | undefined, ua?: string) => {
    const r = request(app).get(path);
    const withToken = token ? r.set('Authorization', bearer(token)) : r;
    return ua === undefined ? withToken : withToken.set('User-Agent', ua);
  };

  it('rejects a request with no token with 401, a regular user with 403; neither logs', async () => {
    const target = await createActiveUser(1);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const noToken = await get(`/users/${target.id}/full-email`);
    expect(noToken.status).toBe(401);
    expect(noToken.body).toEqual(UNAUTHORIZED);

    const { token } = await callerToken('user');
    const res = await get(`/users/${target.id}/full-email`, token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(FORBIDDEN);

    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    error.mockRestore();
  });

  it.each(['admin', 'super admin'] as const)(
    '%s unmasks a user, a pending user, a suspended user and an admin',
    async (role) => {
      const { token } = await callerToken(role);
      const user = await createActiveUser(1);
      const pending = await registerPending(2);
      const suspended = await createActiveUser(3);
      await setUserStatus(suspended.id, 'suspended');
      const admin2 = await createUserWithRole('admin2', 'admin');

      for (const target of [user, pending, suspended, admin2]) {
        const res = await get(`/users/${target.id}/full-email`, token);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ email: target.email });
      }
    },
  );

  it('any caller targeting a super admin gets 403 FORBIDDEN', async () => {
    const { token } = await callerToken('admin');
    const sa = await createUserWithRole('sa', 'super admin');
    const res = await get(`/users/${sa.id}/full-email`, token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      message: "Cannot unmask a super administrator's email",
      code: 'FORBIDDEN',
    });
  });

  it('returns 404 USER_NOT_FOUND for an unknown UUID', async () => {
    const { token } = await callerToken('admin');
    const res = await get(`/users/${UNKNOWN_ID}/full-email`, token);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'User not found', code: 'USER_NOT_FOUND' });
  });

  it('returns 400 VALIDATION_ERROR "Invalid user ID" for a non-UUID id', async () => {
    const { token } = await callerToken('admin');
    const res = await get('/users/not-a-uuid/full-email', token);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Invalid user ID', code: 'VALIDATION_ERROR' });
  });

  it('admin targeting their own id is granted; super admin targeting their own id is denied', async () => {
    const { user: admin, token: adminToken } = await callerToken('admin', 'ownadmin');
    const own = await get(`/users/${admin.id}/full-email`, adminToken);
    expect(own.status).toBe(200);
    expect(own.body).toEqual({ email: admin.email });

    const { user: sa, token: saToken } = await callerToken('super admin', 'ownsa');
    const ownSa = await get(`/users/${sa.id}/full-email`, saToken);
    expect(ownSa.status).toBe(403);
    expect(ownSa.body.code).toBe('FORBIDDEN');
  });

  it('logs exactly one granted line with actor/target ids and usernames, a quoted user agent, and no email', async () => {
    const { user: admin, token } = await callerToken('admin');
    const target = await createActiveUser(1);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await getWithUa(`/users/${target.id}/full-email`, token, 'Mozilla/5.0 Test');
    expect(res.status).toBe(200);

    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0]![0] as string;
    expect(line).toContain('[UNMASK EMAIL]');
    expect(line).toContain(`actorId=${admin.id}`);
    expect(line).toContain(`actorUsername=${admin.username}`);
    expect(line).toContain(`targetId=${target.id}`);
    expect(line).toContain(`targetUsername=${target.username}`);
    expect(line).toContain('userAgent="Mozilla/5.0 Test"');
    expect(line).toContain('outcome=granted');
    expect(line).not.toContain(target.email);
    expect(line).not.toContain('@');
    log.mockRestore();
  });

  it('a missing User-Agent header is logged as userAgent=-', async () => {
    const { token } = await callerToken('admin');
    const target = await createActiveUser(1);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await getWithUa(`/users/${target.id}/full-email`, token);

    expect(log.mock.calls[0]![0]).toContain('userAgent=-');
    log.mockRestore();
  });

  it('a denied attempt (unknown target) logs targetUsername=- and the raw, quoted id for an invalid one', async () => {
    const { token } = await callerToken('admin');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await get(`/users/${UNKNOWN_ID}/full-email`, token);
    expect(error.mock.calls[0]![0]).toContain(`targetId=${JSON.stringify(UNKNOWN_ID)}`);
    expect(error.mock.calls[0]![0]).toContain('targetUsername=-');
    error.mockClear();

    await get('/users/not-a-uuid/full-email', token);
    expect(error.mock.calls[0]![0]).toContain(`targetId=${JSON.stringify('not-a-uuid')}`);
    expect(error.mock.calls[0]![0]).toContain('targetUsername=-');
    expect(error.mock.calls[0]![0]).toContain('reason=VALIDATION_ERROR');
    error.mockRestore();
  });

  it("the logged timestamp comes from the database clock, not the service's own clock", async () => {
    const { token } = await callerToken('admin');
    const target = await createActiveUser(1);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const before = await dbNow();

    await get(`/users/${target.id}/full-email`, token);

    const after = await dbNow();
    const match = /timestamp=([^\s]+)/.exec(log.mock.calls[0]![0] as string);
    expect(match).not.toBeNull();
    const logged = new Date(match![1]!);
    expect(logged.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(logged.getTime()).toBeLessThanOrEqual(after.getTime());
    log.mockRestore();
  });

  it('returns 500 INTERNAL_ERROR and no email when writing the log line throws', async () => {
    const { token } = await callerToken('admin');
    const target = await createActiveUser(1);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {
      throw new Error('log sink down');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await get(`/users/${target.id}/full-email`, token);
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(res.body).not.toHaveProperty('email');
    log.mockRestore();
    errorSpy.mockRestore();
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
      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(refreshToken));
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
      expect(new Date(res.body.updatedAt)).toEqual(userBefore.updated_at);
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
      expect(new Date(res.body.updatedAt)).toEqual(userBefore.updated_at);
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
      expect(res.body).toEqual({
        message: 'Cannot modify your own role',
        code: 'SELF_ROLE_CHANGE',
      });
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
      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(refreshToken));
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
      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(refreshToken));
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
      expect(new Date(res.body.updatedAt)).toEqual(before.updated_at);
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
      expect(new Date(res.body.updatedAt)).toEqual(before.updated_at);
      expect((await getUserByEmail(target.email))!.updated_at).toEqual(before.updated_at);
      expect((await getRefreshTokens(target.id))[0]!.is_revoked).toBe(false);
    });
  });
});
