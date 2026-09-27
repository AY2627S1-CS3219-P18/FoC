/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated the me service (changeActiveView) as specified in
 *        instructions.md Stage 11.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added getOwnProfile as specified in instructions.md Stage 12a.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added changeUsername as specified in instructions.md Stage 12b.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import * as userQueries from '../db/queries/users.queries.js';
import { withTransaction } from '../db/transaction.js';
import { AppError } from '../utils/AppError.js';
import { USERNAME_MESSAGE, USERNAME_REGEX } from './auth.service.js';
import { toPublicUser, type PublicUser } from './users.service.js';

function isPgUniqueViolation(err: unknown): err is { code: string; constraint?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  );
}

// A plain single-row UPDATE: no lock or transaction, since there is no transition rule and no
// side effect to keep atomic with the write.
export async function changeActiveView(
  userId: string,
  activeView: 'requester' | 'courier',
): Promise<PublicUser> {
  const row = await userQueries.updateActiveView(userId, activeView);
  if (!row) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }
  return toPublicUser(row);
}

export async function getOwnProfile(
  userId: string,
): Promise<{ username: string; email: string }> {
  const user = await userQueries.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }
  return { username: user.username, email: user.email };
}

export async function changeUsername(
  userId: string,
  newUsername: string,
): Promise<{ username: string; email: string }> {
  if (!USERNAME_REGEX.test(newUsername)) {
    throw new AppError(400, USERNAME_MESSAGE, 'VALIDATION_ERROR');
  }

  return withTransaction(async (client) => {
    const locked = await userQueries.lockUserById(userId, client);
    if (!locked) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    if (newUsername === locked.username) {
      throw new AppError(
        409,
        'New username must be different from your current username',
        'USERNAME_UNCHANGED',
      );
    }

    const existing = await userQueries.findByUsername(newUsername, client);
    if (existing && existing.id !== userId) {
      throw new AppError(409, 'Username already in use', 'USERNAME_TAKEN');
    }

    let updated;
    try {
      updated = await userQueries.updateUsername(locked.id, newUsername, client);
    } catch (err) {
      if (isPgUniqueViolation(err) && (err.constraint ?? '').includes('username')) {
        throw new AppError(409, 'Username already in use', 'USERNAME_TAKEN');
      }
      throw err;
    }

    return { username: updated.username, email: updated.email };
  });
}
