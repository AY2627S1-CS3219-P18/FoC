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
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-22
 * Scope: Replaced toPublicUser/PublicUser with the shared toUserResponse mapper
 *        (src/services/userResponse.ts), per instructions.md Stage 15c.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-04
 * Scope: listUsers takes the `locked` filter, and added unlockUser (POST /users/:id/unlock),
 *        per instructions.md Stage 18d. Its permission rules mirror changeUserStatus's.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-04
 * Scope: listUsers, getUserById, changeUserStatus, changeUserRole and unlockUser now take the
 *        requester's ID and pass it to toUserResponse for email masking (NFR3.1.1). Added
 *        getFullEmail (GET /users/:id/full-email) and logUnmaskValidationFailure, with the
 *        `[UNMASK EMAIL]` console log shared by both. Per instructions.md Stage 20.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import * as otpQueries from '../db/queries/otp.queries.js';
import * as tokenQueries from '../db/queries/tokens.queries.js';
import * as userQueries from '../db/queries/users.queries.js';
import { withTransaction } from '../db/transaction.js';
import { AppError } from '../utils/AppError.js';
import { toUserResponse, type UserResponse } from './userResponse.js';

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
  locked?: boolean;
  sortBy: 'username' | 'email' | 'createdAt';
  sortDir: 'asc' | 'desc';
  requesterId: string;
}

export interface ListUsersResult {
  users: UserResponse[];
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
  locked,
  sortBy,
  sortDir,
  requesterId,
}: ListUsersParams): Promise<ListUsersResult> {
  const offset = (page - 1) * PAGE_SIZE;
  const { rows, total } = await userQueries.listUsersPage({
    usernameContains: username,
    email,
    status,
    role,
    locked,
    sortBy,
    sortDir,
    limit: PAGE_SIZE,
    offset,
  });

  return {
    users: rows.map((row) => toUserResponse(row, requesterId)),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

// The id's UUID format is validated at the controller before this is called.
export async function getUserById(id: string, requesterId: string): Promise<UserResponse> {
  const row = await userQueries.findById(id);
  if (!row) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }
  return toUserResponse(row, requesterId);
}

export async function changeUserStatus(
  requesterId: string,
  requestorRole: string,
  targetId: string,
  status: 'active' | 'suspended',
): Promise<UserResponse> {
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
      return toUserResponse(locked, requesterId);
    }

    const updated = await userQueries.updateUserStatus(locked.id, status, client);

    // Same transaction as the status change, so no session outlives the suspension.
    if (status === 'suspended') {
      await tokenQueries.revokeAllRefreshTokensForUser(locked.id, client);
    }

    return toUserResponse(updated, requesterId);
  });
}

export async function changeUserRole(
  requesterId: string,
  targetId: string,
  newRole: 'admin' | 'user',
): Promise<UserResponse> {
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
      return toUserResponse(locked, requesterId);
    }

    const updated = await userQueries.updateUserRole(locked.id, newRole, client);

    // Same transaction as the role change, so the old role cannot be extended by refreshing.
    await tokenQueries.revokeAllRefreshTokensForUser(locked.id, client);

    return toUserResponse(updated, requesterId);
  });
}

// POST /users/:id/unlock. Permission rules mirror changeUserStatus's: SUPER_ADMIN_IMMUTABLE on
// a super-admin target, FORBIDDEN when an admin targets another admin (Stage 18d).
export async function unlockUser(
  requesterId: string,
  requestorRole: string,
  targetId: string,
): Promise<UserResponse> {
  return withTransaction(async (client) => {
    const locked = await userQueries.lockUserById(targetId, client);
    if (!locked) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    if (locked.role === 'super admin') {
      throw new AppError(403, 'Cannot modify a super administrator', 'SUPER_ADMIN_IMMUTABLE');
    }
    if (locked.role === 'admin' && requestorRole === 'admin') {
      throw new AppError(403, 'Only a super admin may unlock an admin', 'FORBIDDEN');
    }

    // Clears the login lock and its escalation, and the OTP send blocks and their escalation
    // for all three purposes.
    await userQueries.resetLoginLock(locked.id, client);
    await otpQueries.clearSendBlocksForUser(locked.id, client);

    return toUserResponse(
      {
        ...locked,
        login_failed_attempts: 0,
        login_failure_window_start: null,
        login_locked_until: null,
        login_lock_level: 0,
      },
      requesterId,
    );
  });
}

function formatUserAgent(userAgent: string | null | undefined): string {
  return userAgent ? JSON.stringify(userAgent) : '-';
}

// Shared by getFullEmail and logUnmaskValidationFailure. Never logs an email, masked or full.
function logUnmaskAttempt({
  actorId,
  actorUsername,
  targetId,
  targetUsername,
  timestamp,
  userAgent,
  outcome,
  reason,
}: {
  actorId: string;
  actorUsername: string;
  targetId: string;
  // null means the target row could not be identified: not found, or :id failed validation.
  targetUsername: string | null;
  timestamp: Date;
  userAgent: string | null | undefined;
  outcome: 'granted' | 'denied';
  reason?: string;
}): void {
  const targetIdPart = targetUsername === null ? JSON.stringify(targetId) : targetId;
  const base =
    `[UNMASK EMAIL] actorId=${actorId} actorUsername=${actorUsername} ` +
    `targetId=${targetIdPart} targetUsername=${targetUsername ?? '-'} ` +
    `timestamp=${timestamp.toISOString()} userAgent=${formatUserAgent(userAgent)} outcome=${outcome}`;
  const line = reason ? `${base} reason=${reason}` : base;

  if (outcome === 'granted') {
    console.log(line);
  } else {
    console.error(line);
  }
}

// GET /users/:id/full-email. No transaction or lock: a read with no state change. The granted
// log line is written before returning; if it throws, the email is not returned (propagates to
// the global handler as 500 INTERNAL_ERROR).
export async function getFullEmail(
  actorId: string,
  targetId: string,
  userAgent: string | null | undefined,
): Promise<{ email: string }> {
  const actor = await userQueries.findByIdWithNow(actorId);
  const actorUsername = actor!.username;
  const timestamp = actor!.db_now;

  const target = await userQueries.findById(targetId);
  if (!target) {
    logUnmaskAttempt({
      actorId,
      actorUsername,
      targetId,
      targetUsername: null,
      timestamp,
      userAgent,
      outcome: 'denied',
      reason: 'USER_NOT_FOUND',
    });
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  if (target.role === 'super admin') {
    logUnmaskAttempt({
      actorId,
      actorUsername,
      targetId,
      targetUsername: target.username,
      timestamp,
      userAgent,
      outcome: 'denied',
      reason: 'FORBIDDEN',
    });
    throw new AppError(403, "Cannot unmask a super administrator's email", 'FORBIDDEN');
  }

  logUnmaskAttempt({
    actorId,
    actorUsername,
    targetId,
    targetUsername: target.username,
    timestamp,
    userAgent,
    outcome: 'granted',
  });
  return { email: target.email };
}

// For the controller's VALIDATION_ERROR case: :id fails .uuid() before getFullEmail is ever
// called, but the attempt is still logged.
export async function logUnmaskValidationFailure(
  actorId: string,
  rawTargetId: string,
  userAgent: string | null | undefined,
): Promise<void> {
  const actor = await userQueries.findByIdWithNow(actorId);
  logUnmaskAttempt({
    actorId,
    actorUsername: actor!.username,
    targetId: rawTargetId,
    targetUsername: null,
    timestamp: actor!.db_now,
    userAgent,
    outcome: 'denied',
    reason: 'VALIDATION_ERROR',
  });
}
