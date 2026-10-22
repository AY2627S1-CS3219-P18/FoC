/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated the users service (listUsers, getUserById, changeUserStatus) as specified in
 *        instructions.md Stage 9.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added changeUserRole as specified in instructions.md Stage 10.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Exported toPublicUser so me.service.ts can reuse it (Stage 11).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-22
 * Scope: listUsers takes pagination/search/filter/sort params and returns the paginated
 *        shape, per instructions.md Stage 15b.
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
export function toPublicUser(row: UserRow): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...rest } = row;
  return rest;
}

/** Everything a caller without a role may see about another user: who they are, nothing else. */
export interface PublicUserSummary {
  id: string;
  username: string;
}

/**
 * Display names for a batch of ids.
 *
 * Unknown ids are left out of the result rather than raising: a caller resolving a page
 * of references should not have the whole page fail because one user was deleted.
 */
export async function listPublicUsers(ids: string[]): Promise<PublicUserSummary[]> {
  return userQueries.findPublicSummariesByIds(ids);
}

export async function getPublicUserById(id: string): Promise<PublicUserSummary> {
  const [row] = await userQueries.findPublicSummariesByIds([id]);
  if (!row) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }
  return row;
}

const PAGE_SIZE = 50;

export interface ListUsersParams {
  page: number;
  username?: string;
  email?: string;
  status?: 'pending' | 'active' | 'suspended';
  role?: 'user' | 'admin' | 'super admin';
  sortBy: 'username' | 'email' | 'createdAt';
  sortDir: 'asc' | 'desc';
}

export interface ListUsersResult {
  users: PublicUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function listUsers({
  page,
  username,
  email,
  status,
  role,
  sortBy,
  sortDir,
}: ListUsersParams): Promise<ListUsersResult> {
  const offset = (page - 1) * PAGE_SIZE;
  const { rows, total } = await userQueries.listUsersPage({
    usernameContains: username,
    email,
    status,
    role,
    sortBy,
    sortDir,
    limit: PAGE_SIZE,
    offset,
  });

  return {
    users: rows.map(toPublicUser),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
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

export async function changeUserRole(
  requesterId: string,
  targetId: string,
  newRole: 'admin' | 'user',
): Promise<PublicUser> {
  if (targetId === requesterId) {
    throw new AppError(403, 'Cannot modify your own role', 'SELF_ROLE_CHANGE');
  }

  return withTransaction(async (client) => {
    const locked = await userQueries.lockUserById(targetId, client);
    if (!locked) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    if (locked.role === 'super admin') {
      throw new AppError(403, 'Cannot modify a super administrator', 'SUPER_ADMIN_IMMUTABLE');
    }

    // Only an active target's role can change. Checked before the no-op case.
    if (locked.status === 'pending') {
      throw new AppError(
        422,
        'Cannot change the role of a pending user',
        'CANNOT_CHANGE_ROLE_PENDING_USER',
      );
    }
    if (locked.status === 'suspended') {
      throw new AppError(
        422,
        'Cannot change the role of a suspended user',
        'CANNOT_CHANGE_ROLE_SUSPENDED_USER',
      );
    }

    // Already has the requested role: success, no write and no token revocation.
    if (locked.role === newRole) {
      return toPublicUser(locked);
    }

    const updated = await userQueries.updateUserRole(locked.id, newRole, client);

    // Same transaction as the role change, so the old role cannot be extended by refreshing.
    await tokenQueries.revokeAllRefreshTokensForUser(locked.id, client);

    return toPublicUser(updated);
  });
}
