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
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added initiateEmailChange as specified in instructions.md Stage 12c.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import bcrypt from 'bcrypt';
import * as userQueries from '../db/queries/users.queries.js';
import { withTransaction } from '../db/transaction.js';
import { AppError } from '../utils/AppError.js';
import { EMAIL_REGEX, USERNAME_MESSAGE, USERNAME_REGEX } from './auth.service.js';
import { requestOtp } from './otp.service.js';
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

export async function initiateEmailChange(
  userId: string,
  { currentPassword, newEmail }: { currentPassword: string; newEmail: string },
): Promise<void> {
  if (!EMAIL_REGEX.test(newEmail)) {
    throw new AppError(400, 'Please enter a valid email', 'VALIDATION_ERROR');
  }

  // Unlocked read first: bcrypt is slow, so verify before taking the row lock.
  const user = await userQueries.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }
  const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!passwordMatches) {
    throw new AppError(401, 'Current password is incorrect', 'INVALID_PASSWORD');
  }
  if (newEmail === user.email) {
    throw new AppError(
      409,
      'New email must be different from your current email',
      'EMAIL_UNCHANGED',
    );
  }
  const existing = await userQueries.findByEmail(newEmail);
  if (existing && existing.id !== userId) {
    throw new AppError(409, 'Email already in use', 'EMAIL_TAKEN');
  }

  await withTransaction(async (client) => {
    const locked = await userQueries.lockUserById(userId, client);
    if (!locked) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    // Re-verify against the locked row: the pre-lock read can be stale.
    const stillMatches = await bcrypt.compare(currentPassword, locked.password_hash);
    if (!stillMatches) {
      throw new AppError(401, 'Current password is incorrect', 'INVALID_PASSWORD');
    }

    if (newEmail === locked.email) {
      throw new AppError(
        409,
        'New email must be different from your current email',
        'EMAIL_UNCHANGED',
      );
    }
    const stillExisting = await userQueries.findByEmail(newEmail, client);
    if (stillExisting && stillExisting.id !== userId) {
      throw new AppError(409, 'Email already in use', 'EMAIL_TAKEN');
    }

    const result = await requestOtp(
      { userId: locked.id, email: locked.email, purpose: 'Change Email', newEmail },
      client,
    );

    // Same mapping as forgotPassword; no-user/not-verified cannot occur here since the
    // user row is already locked and active, but the switch stays exhaustive.
    switch (result.status) {
      case 'sent':
        return;
      case 'throttled':
        if (result.reason === 'cooldown') {
          throw new AppError(
            429,
            'Please wait before requesting another OTP',
            'OTP_RESEND_COOLDOWN',
            result.retryAfterSeconds,
          );
        }
        throw new AppError(
          429,
          'Maximum OTP resends reached. Please try again in about an hour.',
          'OTP_RESEND_LIMIT',
        );
      case 'no-user':
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
      case 'not-verified':
        throw new AppError(
          403,
          'Account not verified. Please finish registration first.',
          'ACCOUNT_NOT_VERIFIED',
        );
    }
  });
}
