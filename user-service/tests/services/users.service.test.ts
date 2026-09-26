/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated Vitest integration tests (real test DB) for users.service.ts, covering the
 *        Stage 9 Verification bullets in instructions.md.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as usersService from '../../src/services/users.service.js';
import {
  getRefreshTokens,
  getUserByEmail,
  seedRefreshToken,
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

    const users = await usersService.listUsers();
    expect(users.map((u) => u.status).sort()).toEqual(['active', 'pending', 'suspended']);
    for (const u of users) {
      expect(u).not.toHaveProperty('password_hash');
      expect(Object.keys(u).sort()).toEqual(
        ['created_at', 'email', 'id', 'role', 'status', 'updated_at', 'username'].sort(),
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
      const got = await usersService.getUserById(u.id);
      expect(got).toMatchObject({ id: u.id, username: u.username, email: u.email, status });
      expect(got).not.toHaveProperty('password_hash');
    },
  );

  it('throws 404 USER_NOT_FOUND for an id that does not exist', async () => {
    await expect(usersService.getUserById(UNKNOWN_ID)).rejects.toMatchObject({
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

    const result = await usersService.changeUserStatus('admin', target.id, 'suspended');
    expect(result.status).toBe('suspended');
    expect(result).not.toHaveProperty('password_hash');
    const tokens = await getRefreshTokens(target.id);
    expect(tokens).toHaveLength(2);
    expect(tokens.every((t) => t.is_revoked)).toBe(true);
  });

  it('unsuspends a suspended user without touching their tokens', async () => {
    const target = await createActiveUser(1);
    await seedRefreshToken(target.id, 'tok-a');
    await usersService.changeUserStatus('admin', target.id, 'suspended');
    const before = await getRefreshTokens(target.id);

    const result = await usersService.changeUserStatus('admin', target.id, 'active');
    expect(result.status).toBe('active');
    expect(await getRefreshTokens(target.id)).toEqual(before);
  });

  it('throws 404 USER_NOT_FOUND for a nonexistent target', async () => {
    await expect(
      usersService.changeUserStatus('admin', UNKNOWN_ID, 'suspended'),
    ).rejects.toMatchObject({ status: 404, code: 'USER_NOT_FOUND' });
  });

  describe('target role restriction', () => {
    it('admin may suspend a plain user', async () => {
      const t = await createUserWithRole(1, 'user');
      expect((await usersService.changeUserStatus('admin', t.id, 'suspended')).status).toBe(
        'suspended',
      );
    });

    it('admin may not suspend an admin: 403 FORBIDDEN, nothing changes', async () => {
      const t = await createUserWithRole(1, 'admin');
      await seedRefreshToken(t.id, 'tok-a');
      await expect(usersService.changeUserStatus('admin', t.id, 'suspended')).rejects.toMatchObject(
        { status: 403, code: 'FORBIDDEN' },
      );
      expect((await getUserByEmail(t.email))!.status).toBe('active');
      expect((await getRefreshTokens(t.id))[0]!.is_revoked).toBe(false);
    });

    it.each(['admin', 'super admin'])(
      '%s may not suspend a super admin: 403 SUPER_ADMIN_IMMUTABLE',
      async (requestorRole) => {
        const t = await createUserWithRole(1, 'super admin');
        await expect(
          usersService.changeUserStatus(requestorRole, t.id, 'suspended'),
        ).rejects.toMatchObject({ status: 403, code: 'SUPER_ADMIN_IMMUTABLE' });
        expect((await getUserByEmail(t.email))!.status).toBe('active');
      },
    );

    it('super admin may suspend a plain user and an admin', async () => {
      const u = await createUserWithRole(1, 'user');
      const a = await createUserWithRole(2, 'admin');
      expect((await usersService.changeUserStatus('super admin', u.id, 'suspended')).status).toBe(
        'suspended',
      );
      expect((await usersService.changeUserStatus('super admin', a.id, 'suspended')).status).toBe(
        'suspended',
      );
    });

    it('checks the role restriction before the pending-target rule', async () => {
      const t = await createUserWithRole(1, 'super admin');
      await setUserStatus(t.id, 'pending');
      await expect(
        usersService.changeUserStatus('admin', t.id, 'suspended'),
      ).rejects.toMatchObject({ code: 'SUPER_ADMIN_IMMUTABLE' });
    });
  });

  describe('pending target', () => {
    it.each(['suspended', 'active'] as const)(
      'cannot be set to %s: 422 CANNOT_CHANGE_STATUS_PENDING_USER, stays pending',
      async (status) => {
        const pending = await registerPending(1);
        await expect(
          usersService.changeUserStatus('admin', pending.id, status),
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
      await usersService.changeUserStatus('admin', t.id, 'suspended');
      const userBefore = (await getUserByEmail(t.email))!;
      const tokensBefore = await getRefreshTokens(t.id);

      const result = await usersService.changeUserStatus('admin', t.id, 'suspended');
      expect(result.status).toBe('suspended');
      expect(result.updated_at).toEqual(userBefore.updated_at);
      expect((await getUserByEmail(t.email))!.updated_at).toEqual(userBefore.updated_at);
      expect((await getRefreshTokens(t.id)).map((x) => x.revoked_at)).toEqual(
        tokensBefore.map((x) => x.revoked_at),
      );
    });

    it('unsuspending an already-active user returns it unchanged and revokes nothing', async () => {
      const t = await createActiveUser(1);
      await seedRefreshToken(t.id, 'tok-a');
      const userBefore = (await getUserByEmail(t.email))!;

      const result = await usersService.changeUserStatus('admin', t.id, 'active');
      expect(result.status).toBe('active');
      expect(result.updated_at).toEqual(userBefore.updated_at);
      expect((await getUserByEmail(t.email))!.updated_at).toEqual(userBefore.updated_at);
      expect((await getRefreshTokens(t.id))[0]!.is_revoked).toBe(false);
    });
  });

  it('does not change the target role', async () => {
    const t = await createUserWithRole(1, 'user');
    await setUserRole(t.id, 'user');
    const result = await usersService.changeUserStatus('admin', t.id, 'suspended');
    expect(result.role).toBe('user');
  });
});
