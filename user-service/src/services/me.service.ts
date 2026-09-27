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
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added verifyEmailChangeOtp, resendChangeEmailOtp and resendChangePasswordOtp as
 *        specified in instructions.md Stage 12d. Factored initiateEmailChange's inline
 *        requestOtp-result switch into a shared helper reused by all three (no behavior change).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added initiatePasswordChange and confirmPasswordChange as specified in
 *        instructions.md Stage 12e.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import bcrypt from 'bcrypt';
import * as otpQueries from '../db/queries/otp.queries.js';
import * as tokenQueries from '../db/queries/tokens.queries.js';
import * as userQueries from '../db/queries/users.queries.js';
import { withTransaction } from '../db/transaction.js';
import { AppError } from '../utils/AppError.js';
import {
  EMAIL_REGEX,
  OTP_REGEX,
  PASSWORD_MESSAGE,
  PASSWORD_REGEX,
  USERNAME_MESSAGE,
  USERNAME_REGEX,
} from './auth.service.js';
import { checkOtp, requestOtp, type RequestOtpResult } from './otp.service.js';
import { toPublicUser, type PublicUser } from './users.service.js';

const BCRYPT_WORK_FACTOR = 10;

function isPgUniqueViolation(err: unknown): err is { code: string; constraint?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  );
}

// Shared by initiateEmailChange, resendChangeEmailOtp and resendChangePasswordOtp.
// no-user/not-verified cannot occur at any of these call sites, since each already holds
// the user row locked and active, but the switch stays exhaustive.
function throwOnUnsentOtp(result: RequestOtpResult): void {
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
    throwOnUnsentOtp(result);
  });
}

// The OTP row's new_email is always set for a Change Email purpose: initiateEmailChange is
// the only writer, and it always passes newEmail.
export async function verifyEmailChangeOtp(userId: string, otp: string): Promise<void> {
  const result = await withTransaction(async (client) => {
    const locked = await userQueries.lockUserById(userId, client);
    if (!locked) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    const pending = await otpQueries.findLatestOtp(userId, 'Change Email', client);
    if (!pending) {
      throw new AppError(400, 'Invalid or expired OTP', 'INVALID_OTP');
    }

    const check = await checkOtp({ userId, purpose: 'Change Email', otp }, client);
    if (check.ok) {
      try {
        await userQueries.updateEmail(locked.id, pending.new_email!, client);
      } catch (err) {
        if (isPgUniqueViolation(err) && (err.constraint ?? '').includes('email')) {
          // Someone else took the address in the meantime. The whole transaction, including
          // the OTP consumption above, rolls back, so the OTP stays usable for another email.
          throw new AppError(409, 'Email already in use', 'EMAIL_TAKEN');
        }
        throw err;
      }
    }
    return check;
  });

  // Thrown only after commit so the incremented attempt count is persisted.
  if (!result.ok) {
    throw new AppError(400, 'Invalid or expired OTP', 'INVALID_OTP');
  }
}

export async function resendChangeEmailOtp(userId: string): Promise<void> {
  await withTransaction(async (client) => {
    const locked = await userQueries.lockUserById(userId, client);
    if (!locked) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    const pending = await otpQueries.findLatestOtp(userId, 'Change Email', client);
    if (!pending || pending.consumed_at) {
      throw new AppError(400, 'No pending email change found', 'NO_PENDING_EMAIL_CHANGE');
    }

    const result = await requestOtp(
      {
        userId: locked.id,
        email: locked.email,
        purpose: 'Change Email',
        newEmail: pending.new_email!,
      },
      client,
    );
    throwOnUnsentOtp(result);
  });
}

export async function resendChangePasswordOtp(userId: string): Promise<void> {
  await withTransaction(async (client) => {
    const locked = await userQueries.lockUserById(userId, client);
    if (!locked) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    const pending = await otpQueries.findLatestOtp(userId, 'Change Password', client);
    if (!pending || pending.consumed_at) {
      throw new AppError(400, 'No pending password change found', 'NO_PENDING_PASSWORD_CHANGE');
    }

    const result = await requestOtp(
      { userId: locked.id, email: locked.email, purpose: 'Change Password' },
      client,
    );
    throwOnUnsentOtp(result);
  });
}

// newPassword is validated here but never written anywhere — it is discarded once this
// call returns. confirmPasswordChange re-supplies and applies it.
export async function initiatePasswordChange(
  userId: string,
  { currentPassword, newPassword }: { currentPassword: string; newPassword: string },
): Promise<void> {
  if (!PASSWORD_REGEX.test(newPassword)) {
    throw new AppError(400, PASSWORD_MESSAGE, 'VALIDATION_ERROR');
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
  const sameAsCurrent = await bcrypt.compare(newPassword, user.password_hash);
  if (sameAsCurrent) {
    throw new AppError(
      400,
      'New password must be different from your current password',
      'PASSWORD_UNCHANGED',
    );
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

    const result = await requestOtp(
      { userId: locked.id, email: locked.email, purpose: 'Change Password' },
      client,
    );
    throwOnUnsentOtp(result);
  });
}

export async function confirmPasswordChange(
  userId: string,
  { otp, newPassword }: { otp: string; newPassword: string },
): Promise<void> {
  if (!PASSWORD_REGEX.test(newPassword)) {
    throw new AppError(400, PASSWORD_MESSAGE, 'VALIDATION_ERROR');
  }
  if (!OTP_REGEX.test(otp)) {
    throw new AppError(400, 'OTP must be a 6-digit code', 'VALIDATION_ERROR');
  }

  const result = await withTransaction(async (client) => {
    const locked = await userQueries.lockUserById(userId, client);
    if (!locked) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    // Re-checked here in case the password changed between initiate and confirm.
    const sameAsCurrent = await bcrypt.compare(newPassword, locked.password_hash);
    if (sameAsCurrent) {
      throw new AppError(
        400,
        'New password must be different from your current password',
        'PASSWORD_UNCHANGED',
      );
    }

    const check = await checkOtp({ userId, purpose: 'Change Password', otp }, client);
    if (check.ok) {
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_WORK_FACTOR);
      await userQueries.updatePasswordHash(locked.id, passwordHash, client);
      // Same transaction as the password change, so no old session outlives it.
      await tokenQueries.revokeAllRefreshTokensForUser(locked.id, client);
    }
    return check;
  });

  // Thrown only after commit so the incremented attempt count is persisted.
  if (!result.ok) {
    throw new AppError(400, 'Invalid or expired OTP', 'INVALID_OTP');
  }
}
