/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated Vitest integration tests (real test DB) for users.service.ts, covering the
 *        Stage 9 Verification bullets in instructions.md.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added tests for changeUserRole, covering the Stage 10 Verification bullets.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Updated the expected keys for the new active_view column (Stage 11); no new test cases.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-04
 * Scope: Updated the expected UserResponse keys for isLocked/lockedUntil/lockLevel, and added
 *        coverage for listUsers' `locked` filter and unlockUser's permission rules and effect
 *        (clears the login lock and the OTP send blocks), per instructions.md Stage 18d.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-04
 * Scope: listUsers/getUserById/changeUserStatus/unlockUser calls pass the new requesterId
 *        param (fixture, not a new assertion, except the new masking test below). Added a
 *        getUserById masking test, and a getFullEmail/logUnmaskValidationFailure suite
 *        covering instructions.md Stage 20's 20a Verification bullets (NFR3.1.1).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersService from '../../src/services/users.service.js';
import {
  dbNow,
  getOtps,
  getRefreshTokens,
  getUserByEmail,
  getUserById,
  seedRefreshToken,
  setLoginLockState,
  setOtpSendBlock,
  setUserRole,
  setUserStatus,
  truncateAll,
} from '../helpers/db.js';
import { resetEmailMock } from '../helpers/email.js';
import { createActiveUser, createUserWithRole, registerPending } from '../helpers/fixtures.js';

resetEmailMock();
beforeEach(truncateAll);
afterEach(truncateAll);

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('listUsers', () => {
  it('returns every status with a status field and never a password_hash', async () => {
    await createActiveUser(1);
    await registerPending(2);
    const suspended = await createActiveUser(3);
    await setUserStatus(suspended.id, 'suspended');

    const result = await usersService.listUsers({
      page: 1,
      sortBy: 'createdAt',
      sortDir: 'desc',
      requesterId: UNKNOWN_ID,
    });
    expect(result.users.map((u) => u.status).sort()).toEqual(['active', 'pending', 'suspended']);
    for (const u of result.users) {
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

describe('getUserById', () => {
  it.each(['active', 'pending', 'suspended'] as const)(
    'returns a %s user with its status and no password_hash',
    async (status) => {
      const u = await createActiveUser(1);
      await setUserStatus(u.id, status);
      // Requester is the target's own id (self-view), so email comes back unmasked here;
      // masking itself is covered separately below.
      const got = await usersService.getUserById(u.id, u.id);
      expect(got).toMatchObject({ id: u.id, username: u.username, email: u.email, status });
      expect(got).not.toHaveProperty('password_hash');
    },
  );

  it('masks the email unless the requester is the target themselves (Stage 20, NFR3.1.1)', async () => {
    const u = await createActiveUser(1);
    const masked = await usersService.getUserById(u.id, UNKNOWN_ID);
    expect(masked.email).not.toBe(u.email);
    expect(masked.email).toMatch(/^.\*\*\*@/);

    const unmasked = await usersService.getUserById(u.id, u.id);
    expect(unmasked.email).toBe(u.email);
  });

  it('throws 404 USER_NOT_FOUND for an id that does not exist', async () => {
    await expect(usersService.getUserById(UNKNOWN_ID, UNKNOWN_ID)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  });
});

describe('changeUserStatus', () => {
  it('suspends an active user, revokes all their refresh tokens and strips password_hash', async () => {
    const target = await createActiveUser(1);
    await seedRefreshToken(target.id, 'tok-a');
    await seedRefreshToken(target.id, 'tok-b');

    const result = await usersService.changeUserStatus(UNKNOWN_ID, 'admin', target.id, 'suspended');
    expect(result.status).toBe('suspended');
    expect(result).not.toHaveProperty('password_hash');
    const tokens = await getRefreshTokens(target.id);
    expect(tokens).toHaveLength(2);
    expect(tokens.every((t) => t.is_revoked)).toBe(true);
  });

  it('unsuspends a suspended user without touching their tokens', async () => {
    const target = await createActiveUser(1);
    await seedRefreshToken(target.id, 'tok-a');
    await usersService.changeUserStatus(UNKNOWN_ID, 'admin', target.id, 'suspended');
    const before = await getRefreshTokens(target.id);

    const result = await usersService.changeUserStatus(UNKNOWN_ID, 'admin', target.id, 'active');
    expect(result.status).toBe('active');
    expect(await getRefreshTokens(target.id)).toEqual(before);
  });

  it('throws 404 USER_NOT_FOUND for a nonexistent target', async () => {
    await expect(
      usersService.changeUserStatus(UNKNOWN_ID, 'admin', UNKNOWN_ID, 'suspended'),
    ).rejects.toMatchObject({ status: 404, code: 'USER_NOT_FOUND' });
  });

  describe('target role restriction', () => {
    it('admin may suspend a plain user', async () => {
      const t = await createUserWithRole(1, 'user');
      expect(
        (await usersService.changeUserStatus(UNKNOWN_ID, 'admin', t.id, 'suspended')).status,
      ).toBe('suspended');
    });

    it('admin may not suspend an admin: 403 FORBIDDEN, nothing changes', async () => {
      const t = await createUserWithRole(1, 'admin');
      await seedRefreshToken(t.id, 'tok-a');
      await expect(
        usersService.changeUserStatus(UNKNOWN_ID, 'admin', t.id, 'suspended'),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
      expect((await getUserByEmail(t.email))!.status).toBe('active');
      expect((await getRefreshTokens(t.id))[0]!.is_revoked).toBe(false);
    });

    it.each(['admin', 'super admin'])(
      '%s may not suspend a super admin: 403 SUPER_ADMIN_IMMUTABLE',
      async (requestorRole) => {
        const t = await createUserWithRole(1, 'super admin');
        await expect(
          usersService.changeUserStatus(UNKNOWN_ID, requestorRole, t.id, 'suspended'),
        ).rejects.toMatchObject({ status: 403, code: 'SUPER_ADMIN_IMMUTABLE' });
        expect((await getUserByEmail(t.email))!.status).toBe('active');
      },
    );

    it('super admin may suspend a plain user and an admin', async () => {
      const u = await createUserWithRole(1, 'user');
      const a = await createUserWithRole(2, 'admin');
      expect(
        (await usersService.changeUserStatus(UNKNOWN_ID, 'super admin', u.id, 'suspended')).status,
      ).toBe('suspended');
      expect(
        (await usersService.changeUserStatus(UNKNOWN_ID, 'super admin', a.id, 'suspended')).status,
      ).toBe('suspended');
    });

    it('checks the role restriction before the pending-target rule', async () => {
      const t = await createUserWithRole(1, 'super admin');
      await setUserStatus(t.id, 'pending');
      await expect(
        usersService.changeUserStatus(UNKNOWN_ID, 'admin', t.id, 'suspended'),
      ).rejects.toMatchObject({ code: 'SUPER_ADMIN_IMMUTABLE' });
    });
  });

  describe('pending target', () => {
    it.each(['suspended', 'active'] as const)(
      'cannot be set to %s: 422 CANNOT_CHANGE_STATUS_PENDING_USER, stays pending',
      async (status) => {
        const pending = await registerPending(1);
        await expect(
          usersService.changeUserStatus(UNKNOWN_ID, 'admin', pending.id, status),
        ).rejects.toMatchObject({
          status: 422,
          message: 'Cannot change the status of a pending user',
          code: 'CANNOT_CHANGE_STATUS_PENDING_USER',
        });
        expect((await getUserByEmail(pending.email))!.status).toBe('pending');
      },
    );
  });

  describe('no-op requests', () => {
    it('suspending an already-suspended user returns it unchanged: same updated_at and revoked_at', async () => {
      const t = await createActiveUser(1);
      await seedRefreshToken(t.id, 'tok-a');
      await usersService.changeUserStatus(UNKNOWN_ID, 'admin', t.id, 'suspended');
      const userBefore = (await getUserByEmail(t.email))!;
      const tokensBefore = await getRefreshTokens(t.id);

      const result = await usersService.changeUserStatus(UNKNOWN_ID, 'admin', t.id, 'suspended');
      expect(result.status).toBe('suspended');
      expect(result.updatedAt).toEqual(userBefore.updated_at);
      expect((await getUserByEmail(t.email))!.updated_at).toEqual(userBefore.updated_at);
      expect((await getRefreshTokens(t.id)).map((x) => x.revoked_at)).toEqual(
        tokensBefore.map((x) => x.revoked_at),
      );
    });

    it('unsuspending an already-active user returns it unchanged and revokes nothing', async () => {
      const t = await createActiveUser(1);
      await seedRefreshToken(t.id, 'tok-a');
      const userBefore = (await getUserByEmail(t.email))!;

      const result = await usersService.changeUserStatus(UNKNOWN_ID, 'admin', t.id, 'active');
      expect(result.status).toBe('active');
      expect(result.updatedAt).toEqual(userBefore.updated_at);
      expect((await getUserByEmail(t.email))!.updated_at).toEqual(userBefore.updated_at);
      expect((await getRefreshTokens(t.id))[0]!.is_revoked).toBe(false);
    });
  });

  it('does not change the target role', async () => {
    const t = await createUserWithRole(1, 'user');
    await setUserRole(t.id, 'user');
    const result = await usersService.changeUserStatus(UNKNOWN_ID, 'admin', t.id, 'suspended');
    expect(result.role).toBe('user');
  });
});

describe('changeUserRole', () => {
  async function superAdmin() {
    return createUserWithRole('sa', 'super admin');
  }

  it('promotes a user to admin, revokes all their refresh tokens and strips password_hash', async () => {
    const sa = await superAdmin();
    const target = await createActiveUser(1);
    await seedRefreshToken(target.id, 'tok-a');
    await seedRefreshToken(target.id, 'tok-b');

    const result = await usersService.changeUserRole(sa.id, target.id, 'admin');
    expect(result.role).toBe('admin');
    expect(result).not.toHaveProperty('password_hash');
    expect((await getUserByEmail(target.email))!.role).toBe('admin');
    const tokens = await getRefreshTokens(target.id);
    expect(tokens).toHaveLength(2);
    expect(tokens.every((t) => t.is_revoked)).toBe(true);
  });

  it('demotes an admin to user and revokes all their refresh tokens', async () => {
    const sa = await superAdmin();
    const target = await createUserWithRole(1, 'admin');
    await seedRefreshToken(target.id, 'tok-a');

    const result = await usersService.changeUserRole(sa.id, target.id, 'user');
    expect(result.role).toBe('user');
    expect((await getRefreshTokens(target.id)).every((t) => t.is_revoked)).toBe(true);
  });

  it('does not change the target status', async () => {
    const sa = await superAdmin();
    const target = await createActiveUser(1);
    expect((await usersService.changeUserRole(sa.id, target.id, 'admin')).status).toBe('active');
  });

  it('rejects changing your own role: 403 SELF_ROLE_CHANGE, before touching the DB', async () => {
    const sa = await superAdmin();
    await expect(usersService.changeUserRole(sa.id, sa.id, 'user')).rejects.toMatchObject({
      status: 403,
      message: 'Cannot modify your own role',
      code: 'SELF_ROLE_CHANGE',
    });
    expect((await getUserByEmail(sa.email))!.role).toBe('super admin');
  });

  it('self-targeting is rejected even for an id that does not exist', async () => {
    await expect(
      usersService.changeUserRole(UNKNOWN_ID, UNKNOWN_ID, 'admin'),
    ).rejects.toMatchObject({ code: 'SELF_ROLE_CHANGE' });
  });

  it('rejects a super admin target (a second super admin): 403 SUPER_ADMIN_IMMUTABLE', async () => {
    const sa = await superAdmin();
    const other = await createUserWithRole('sa2', 'super admin');
    await seedRefreshToken(other.id, 'tok-a');
    await expect(usersService.changeUserRole(sa.id, other.id, 'user')).rejects.toMatchObject({
      status: 403,
      message: 'Cannot modify a super administrator',
      code: 'SUPER_ADMIN_IMMUTABLE',
    });
    expect((await getUserByEmail(other.email))!.role).toBe('super admin');
    expect((await getRefreshTokens(other.id))[0]!.is_revoked).toBe(false);
  });

  it('throws 404 USER_NOT_FOUND for a nonexistent target', async () => {
    const sa = await superAdmin();
    await expect(usersService.changeUserRole(sa.id, UNKNOWN_ID, 'admin')).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  });

  describe('non-active target', () => {
    it.each(['admin', 'user'] as const)(
      'a pending user cannot be set to %s: 422 CANNOT_CHANGE_ROLE_PENDING_USER, role unchanged',
      async (role) => {
        const sa = await superAdmin();
        const pending = await registerPending(1);
        await expect(usersService.changeUserRole(sa.id, pending.id, role)).rejects.toMatchObject({
          status: 422,
          message: 'Cannot change the role of a pending user',
          code: 'CANNOT_CHANGE_ROLE_PENDING_USER',
        });
        expect((await getUserByEmail(pending.email))!.role).toBe('user');
      },
    );

    it.each(['admin', 'user'] as const)(
      'a suspended user cannot be set to %s: 422 CANNOT_CHANGE_ROLE_SUSPENDED_USER, tokens untouched',
      async (role) => {
        const sa = await superAdmin();
        const target = await createActiveUser(1);
        await seedRefreshToken(target.id, 'tok-a');
        await setUserStatus(target.id, 'suspended');
        await expect(usersService.changeUserRole(sa.id, target.id, role)).rejects.toMatchObject({
          status: 422,
          message: 'Cannot change the role of a suspended user',
          code: 'CANNOT_CHANGE_ROLE_SUSPENDED_USER',
        });
        expect((await getUserByEmail(target.email))!.role).toBe('user');
        expect((await getRefreshTokens(target.id))[0]!.is_revoked).toBe(false);
      },
    );

    it('is rejected before the no-op case: a suspended user "set" to their current role', async () => {
      const sa = await superAdmin();
      const target = await createUserWithRole(1, 'admin');
      await setUserStatus(target.id, 'suspended');
      await expect(usersService.changeUserRole(sa.id, target.id, 'admin')).rejects.toMatchObject({
        code: 'CANNOT_CHANGE_ROLE_SUSPENDED_USER',
      });
    });

    it('checks the super admin rule before the non-active rule', async () => {
      const sa = await superAdmin();
      const other = await createUserWithRole('sa2', 'super admin');
      await setUserStatus(other.id, 'suspended');
      await expect(usersService.changeUserRole(sa.id, other.id, 'user')).rejects.toMatchObject({
        code: 'SUPER_ADMIN_IMMUTABLE',
      });
    });
  });

  describe('no-op requests', () => {
    it('promoting an admin to admin returns it unchanged: same updated_at, no revocation', async () => {
      const sa = await superAdmin();
      const target = await createUserWithRole(1, 'admin');
      await seedRefreshToken(target.id, 'tok-a');
      const before = (await getUserByEmail(target.email))!;

      const result = await usersService.changeUserRole(sa.id, target.id, 'admin');
      expect(result.role).toBe('admin');
      expect(result.updatedAt).toEqual(before.updated_at);
      expect((await getUserByEmail(target.email))!.updated_at).toEqual(before.updated_at);
      expect((await getRefreshTokens(target.id))[0]!.is_revoked).toBe(false);
    });

    it('demoting a user to user returns it unchanged: same updated_at, no revocation', async () => {
      const sa = await superAdmin();
      const target = await createActiveUser(1);
      await seedRefreshToken(target.id, 'tok-a');
      const before = (await getUserByEmail(target.email))!;

      const result = await usersService.changeUserRole(sa.id, target.id, 'user');
      expect(result.role).toBe('user');
      expect(result.updatedAt).toEqual(before.updated_at);
      expect((await getUserByEmail(target.email))!.updated_at).toEqual(before.updated_at);
      expect((await getRefreshTokens(target.id))[0]!.is_revoked).toBe(false);
    });
  });
});

describe('listUsers locked filter (Stage 18d)', () => {
  it('locked=true/false partition the result set', async () => {
    const locked = await createActiveUser(1);
    await setLoginLockState(locked.id, { lockLevel: 1, lockedUntilMinutesFromNow: 60 });
    const notLocked = await createActiveUser(2);

    const lockedOnly = await usersService.listUsers({
      page: 1,
      locked: true,
      sortBy: 'createdAt',
      sortDir: 'desc',
      requesterId: UNKNOWN_ID,
    });
    expect(lockedOnly.users.map((u) => u.id)).toEqual([locked.id]);
    expect(lockedOnly.users[0]!.isLocked).toBe(true);
    expect(lockedOnly.users[0]!.lockLevel).toBe(1);

    const notLockedOnly = await usersService.listUsers({
      page: 1,
      locked: false,
      sortBy: 'createdAt',
      sortDir: 'desc',
      requesterId: UNKNOWN_ID,
    });
    expect(notLockedOnly.users.map((u) => u.id)).toEqual([notLocked.id]);
  });

  it('an expired lock counts as not locked', async () => {
    const u = await createActiveUser(1);
    await setLoginLockState(u.id, { lockLevel: 1, lockedUntilMinutesFromNow: -1 });
    const result = await usersService.listUsers({
      page: 1,
      locked: false,
      sortBy: 'createdAt',
      sortDir: 'desc',
      requesterId: UNKNOWN_ID,
    });
    expect(result.users.map((r) => r.id)).toContain(u.id);
  });
});

describe('unlockUser (Stage 18d)', () => {
  it('clears the login lock and its escalation', async () => {
    await createUserWithRole('sa', 'super admin');
    const target = await createActiveUser(1);
    await setLoginLockState(target.id, {
      lockLevel: 2,
      lockedUntilMinutesFromNow: 60,
      failedAttempts: 5,
    });

    const result = await usersService.unlockUser(UNKNOWN_ID, 'super admin', target.id);
    expect(result).toMatchObject({ isLocked: false, lockedUntil: null, lockLevel: 0 });

    const row = (await getUserById(target.id))!;
    expect(row.login_failed_attempts).toBe(0);
    expect(row.login_failure_window_start).toBeNull();
    expect(row.login_locked_until).toBeNull();
    expect(row.login_lock_level).toBe(0);
  });

  it('clears the OTP send blocks and their escalation for all three purposes', async () => {
    const target = await createActiveUser(1);
    for (const purpose of ['Forgot Password', 'Change Email', 'Change Password'] as const) {
      await setOtpSendBlock(target.id, purpose, { level: 2, blockedUntilMinutesFromNow: 60 });
    }

    await usersService.unlockUser(UNKNOWN_ID, 'super admin', target.id);

    for (const purpose of ['Forgot Password', 'Change Email', 'Change Password'] as const) {
      const rows = await getOtps(target.id, purpose);
      for (const row of rows) {
        expect(row.send_escalation_level).toBe(0);
        expect(row.send_blocked_until).toBeNull();
      }
    }
  });

  it('throws 404 USER_NOT_FOUND for an id that does not exist', async () => {
    await expect(usersService.unlockUser(UNKNOWN_ID, 'admin', UNKNOWN_ID)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  });

  it('throws 403 SUPER_ADMIN_IMMUTABLE on a super-admin target', async () => {
    const otherSa = await createUserWithRole('sa2', 'super admin');
    await setLoginLockState(otherSa.id, { lockLevel: 1, lockedUntilMinutesFromNow: 60 });
    await expect(
      usersService.unlockUser(UNKNOWN_ID, 'super admin', otherSa.id),
    ).rejects.toMatchObject({
      status: 403,
      code: 'SUPER_ADMIN_IMMUTABLE',
    });
  });

  it('throws 403 FORBIDDEN when an admin targets another admin, but a super admin may unlock an admin', async () => {
    const admin2 = await createUserWithRole('admin2', 'admin');
    await setLoginLockState(admin2.id, { lockLevel: 1, lockedUntilMinutesFromNow: 60 });
    await expect(usersService.unlockUser(UNKNOWN_ID, 'admin', admin2.id)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });

    const result = await usersService.unlockUser(UNKNOWN_ID, 'super admin', admin2.id);
    expect(result.isLocked).toBe(false);
  });

  it('an admin may unlock a plain user', async () => {
    const target = await createActiveUser(1);
    await setLoginLockState(target.id, { lockLevel: 1, lockedUntilMinutesFromNow: 60 });
    const result = await usersService.unlockUser(UNKNOWN_ID, 'admin', target.id);
    expect(result.isLocked).toBe(false);
  });
});

describe('getFullEmail / logUnmaskValidationFailure (Stage 20a, NFR3.1.1)', () => {
  const UA = 'Mozilla/5.0 Test Agent';

  it('an admin may unmask a plain user, a pending user, a suspended user and another admin', async () => {
    const admin = await createUserWithRole('admin', 'admin');
    const user = await createActiveUser(1);
    const pending = await registerPending(2);
    const suspended = await createActiveUser(3);
    await setUserStatus(suspended.id, 'suspended');
    const admin2 = await createUserWithRole('admin2', 'admin');

    for (const target of [user, pending, suspended, admin2]) {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await usersService.getFullEmail(admin.id, target.id, UA);
      expect(result).toEqual({ email: target.email });
      expect(log).toHaveBeenCalledTimes(1);
      log.mockRestore();
    }
  });

  it('a super admin may unmask a plain user and an admin', async () => {
    const sa = await createUserWithRole('sa', 'super admin');
    const user = await createActiveUser(1);
    const admin = await createUserWithRole('admin', 'admin');

    for (const target of [user, admin]) {
      expect(await usersService.getFullEmail(sa.id, target.id, UA)).toEqual({
        email: target.email,
      });
    }
  });

  it('any caller targeting a super admin is denied FORBIDDEN, with a denied log line', async () => {
    const admin = await createUserWithRole('admin', 'admin');
    const sa = await createUserWithRole('sa', 'super admin');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(usersService.getFullEmail(admin.id, sa.id, UA)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: "Cannot unmask a super administrator's email",
    });
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]![0]).toContain('outcome=denied reason=FORBIDDEN');
    expect(error.mock.calls[0]![0]).toContain(`targetUsername=${sa.username}`);
  });

  it('a super admin targeting their own id is also denied (no self-exception)', async () => {
    const sa = await createUserWithRole('sa', 'super admin');
    await expect(usersService.getFullEmail(sa.id, sa.id, UA)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('an admin targeting their own id is granted, with one granted log line', async () => {
    const admin = await createUserWithRole('admin', 'admin');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await usersService.getFullEmail(admin.id, admin.id, UA);
    expect(result).toEqual({ email: admin.email });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('an unknown target UUID is denied USER_NOT_FOUND, with targetUsername=-', async () => {
    const admin = await createUserWithRole('admin', 'admin');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(usersService.getFullEmail(admin.id, UNKNOWN_ID, UA)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]![0]).toContain(`targetId=${JSON.stringify(UNKNOWN_ID)}`);
    expect(error.mock.calls[0]![0]).toContain('targetUsername=-');
    expect(error.mock.calls[0]![0]).toContain('outcome=denied reason=USER_NOT_FOUND');
  });

  it('the log line carries actor id/username, target id/username, a quoted user agent, and no email', async () => {
    const admin = await createUserWithRole('admin', 'admin');
    const target = await createActiveUser(1);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await usersService.getFullEmail(admin.id, target.id, UA);

    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0]![0] as string;
    expect(line).toContain('[UNMASK EMAIL]');
    expect(line).toContain(`actorId=${admin.id}`);
    expect(line).toContain(`actorUsername=${admin.username}`);
    expect(line).toContain(`targetId=${target.id}`);
    expect(line).toContain(`targetUsername=${target.username}`);
    expect(line).toContain(`userAgent=${JSON.stringify(UA)}`);
    expect(line).toContain('outcome=granted');
    expect(line).not.toContain(target.email);
    expect(line).not.toContain('@');
  });

  it('missing user agent is logged as userAgent=-', async () => {
    const admin = await createUserWithRole('admin', 'admin');
    const target = await createActiveUser(1);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await usersService.getFullEmail(admin.id, target.id, undefined);

    expect(log.mock.calls[0]![0]).toContain('userAgent=-');
  });

  it("the logged timestamp comes from the database clock, not the service's own clock", async () => {
    const admin = await createUserWithRole('admin', 'admin');
    const target = await createActiveUser(1);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const before = await dbNow();
    await usersService.getFullEmail(admin.id, target.id, UA);
    const after = await dbNow();

    const line = log.mock.calls[0]![0] as string;
    const match = /timestamp=([^\s]+)/.exec(line);
    expect(match).not.toBeNull();
    const logged = new Date(match![1]!);
    expect(logged.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(logged.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('logging the granted line failing propagates, so the email is not returned', async () => {
    const admin = await createUserWithRole('admin', 'admin');
    const target = await createActiveUser(1);
    vi.spyOn(console, 'log').mockImplementation(() => {
      throw new Error('log sink down');
    });

    await expect(usersService.getFullEmail(admin.id, target.id, UA)).rejects.toThrow(
      'log sink down',
    );
  });

  describe('logUnmaskValidationFailure', () => {
    it('logs denied VALIDATION_ERROR with the raw, quoted id and targetUsername=-', async () => {
      const admin = await createUserWithRole('admin', 'admin');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      await usersService.logUnmaskValidationFailure(admin.id, 'not-a-uuid', UA);

      expect(error).toHaveBeenCalledTimes(1);
      const line = error.mock.calls[0]![0] as string;
      expect(line).toContain(`actorId=${admin.id}`);
      expect(line).toContain(`actorUsername=${admin.username}`);
      expect(line).toContain(`targetId=${JSON.stringify('not-a-uuid')}`);
      expect(line).toContain('targetUsername=-');
      expect(line).toContain('outcome=denied reason=VALIDATION_ERROR');
    });
  });
});
