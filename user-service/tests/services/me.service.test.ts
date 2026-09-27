/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated Vitest integration tests (real test DB) for me.service.ts, covering the
 *        Stage 11b Verification bullets in instructions.md that apply at the service layer.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as meService from '../../src/services/me.service.js';
import { getUserByEmail, truncateAll } from '../helpers/db.js';
import { resetEmailMock } from '../helpers/email.js';
import { createActiveUser } from '../helpers/fixtures.js';

resetEmailMock();
beforeEach(truncateAll);
afterEach(truncateAll);

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('changeActiveView', () => {
  it('toggles an active user to courier, updating the DB column and stripping password_hash', async () => {
    const user = await createActiveUser(1);
    const result = await meService.changeActiveView(user.id, 'courier');
    expect(result.active_view).toBe('courier');
    expect(result).not.toHaveProperty('password_hash');
    expect((await getUserByEmail(user.email))!.active_view).toBe('courier');
  });

  it('toggles back to requester', async () => {
    const user = await createActiveUser(1);
    await meService.changeActiveView(user.id, 'courier');
    const result = await meService.changeActiveView(user.id, 'requester');
    expect(result.active_view).toBe('requester');
    expect((await getUserByEmail(user.email))!.active_view).toBe('requester');
  });

  it('setting the same value it already has still returns 200 with no special no-op branch', async () => {
    const user = await createActiveUser(1);
    // Default is already 'requester'; there is no existing-value check (unlike status/role).
    const result = await meService.changeActiveView(user.id, 'requester');
    expect(result.active_view).toBe('requester');
  });

  it('returns the full user row shape minus password_hash', async () => {
    const user = await createActiveUser(1);
    const result = await meService.changeActiveView(user.id, 'courier');
    expect(Object.keys(result).sort()).toEqual(
      ['active_view', 'created_at', 'email', 'id', 'role', 'status', 'updated_at', 'username'].sort(),
    );
  });

  it('throws 404 USER_NOT_FOUND for a nonexistent user id', async () => {
    await expect(meService.changeActiveView(UNKNOWN_ID, 'courier')).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  });
});
