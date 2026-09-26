/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated the users service (listUsers, getUserById, changeUserStatus) as specified in
 *        instructions.md Stage 9.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import * as tokenQueries from '../db/queries/tokens.queries.js';
import * as userQueries from '../db/queries/users.queries.js';
import type { UserRow } from '../db/queries/users.queries.js';
import { withTransaction } from '../db/transaction.js';
import { AppError } from '../utils/AppError.js';

export type PublicUser = Omit<UserRow, 'password_hash'>;

// password_hash must never leave the service layer.
function toPublicUser(row: UserRow): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...rest } = row;
  return rest;
}

export async function listUsers(): Promise<PublicUser[]> {
  const rows = await userQueries.listAllUsers();
  return rows.map(toPublicUser);
}

// The id's UUID format is validated at the controller before this is called.
export async function getUserById(id: string): Promise<PublicUser> {
  const row = await userQueries.findById(id);
  if (!row) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }
  return toPublicUser(row);
}

export async function changeUserStatus(
  requestorRole: string,
  targetId: string,
  status: 'active' | 'suspended',
): Promise<PublicUser> {
  return withTransaction(async (client) => {
    const locked = await userQueries.lockUserById(targetId, client);
    if (!locked) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    // Target-role restriction.
    if (locked.role === 'super admin') {
      throw new AppError(403, 'Cannot modify a super administrator', 'SUPER_ADMIN_IMMUTABLE');
    }
    if (locked.role === 'admin' && requestorRole === 'admin') {
      throw new AppError(403, 'Only a super admin may suspend an admin', 'FORBIDDEN');
    }

    if (locked.status === 'pending') {
      throw new AppError(422, 'Cannot change the status of a pending user', 'CANNOT_CHANGE_STATUS_PENDING_USER');
    }

    // Already in the requested status: success, no write and no token revocation.
    if (locked.status === status) {
      return toPublicUser(locked);
    }

    const updated = await userQueries.updateUserStatus(locked.id, status, client);

    // Same transaction as the status change, so no session outlives the suspension.
    if (status === 'suspended') {
      await tokenQueries.revokeAllRefreshTokensForUser(locked.id, client);
    }

    return toPublicUser(updated);
  });
}
