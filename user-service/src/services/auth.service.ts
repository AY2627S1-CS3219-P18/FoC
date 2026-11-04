// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4b - registration
// Author review:
// 25/09/2026: Stage 4c - login + tokens
// Author review:
// 25/09/2026: Stage 4d - logout + refresh
// Author review:
// 25/09/2026: Stage 5d - pending registration with OTP
// Author review:
// 25/09/2026: Stage 5e - verify and resend registration OTP
// Author review:
// 25/09/2026: Stage 6 pre-work - login creates refresh token under user row lock
// Author review:
// 25/09/2026: Stage 6 pre-work - registration resend-limit message text
// Author review:
// 25/09/2026: Stage 6 pre-work - refresh locks user then token in a transaction
// Author review:
// 25/09/2026: Stage 6b - forgotPassword
// Author review:
// 25/09/2026: Stage 6c - verifyForgotPasswordOtp
// Author review:
// 25/09/2026: Stage 6d - resetPassword
// Author review:
// 25/09/2026: Stage 6e - resendForgotPasswordOtp
// Author review:
// 27/09/2026: Stage 11 - login returns activeView
// Author review:
// 27/09/2026: Stage 12b - exported USERNAME_REGEX, EMAIL_REGEX, USERNAME_MESSAGE for reuse in me.service.ts
// Author review:
// 27/09/2026: Stage 12e - exported OTP_REGEX for reuse in me.service.ts
// Author review:
// 2026-10-21: Stage 14d - insert the credit-allocation outbox row after activation, same
//   transaction/client. No requirements, architecture, schema, or API decisions were made by
//   the AI tool — see instructions.md Stage 14 for the governing decision.
// Author review:
// 2026-11-04: Stage 17 - moved PASSWORD_REGEX/PASSWORD_MESSAGE into utils/passwordPolicy.ts
//   (re-exported here) so src/scripts/setupLocalDev.ts can import the policy without
//   transitively importing config.ts. No requirements, architecture, schema, or API decisions
//   were made by the AI tool.
// Author review:
// 2026-11-04: Stage 18b/18c - login() checks and records the escalating login lockout before
//   the password check (throwIfLoginLocked/recordLoginFailure), with the failure that hits the
//   threshold itself rejected as ACCOUNT_LOCKED (429) rather than INVALID_CREDENTIALS once its
//   lock write has committed. forgotPassword's switch on requestOtp's result now runs after
//   that call's transaction commits, not inside it, so an OTP send-escalation cap hit's write
//   (Stage 18c) is never rolled back by the OTP_RESEND_LIMIT throw; its message/Retry-After
//   also now match the escalation level. Governing decision: instructions.md Stage 18.
//   No requirements, architecture, schema, or API decisions were made by the AI tool.
// Author review:

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { config } from '../config.js';
import * as creditOutboxQueries from '../db/queries/creditOutbox.queries.js';
import * as tokenQueries from '../db/queries/tokens.queries.js';
import * as userQueries from '../db/queries/users.queries.js';
import type { UserRowWithNow } from '../db/queries/users.queries.js';
import { withTransaction, type Queryable } from '../db/transaction.js';
import { AppError } from '../utils/AppError.js';
import { sha256 } from '../utils/hash.js';
import { signAccessToken } from '../utils/jwt.js';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../utils/passwordPolicy.js';
import * as otpQueries from '../db/queries/otp.queries.js';
import { durationHoursForLevel, effectiveEscalationLevel, escalationWording } from './lockEscalation.js';
import { checkOtp, issueOtp, requestOtp } from './otp.service.js';

function accountLockedMessage(lockLevel: number): string {
  return `Too many failed login attempts. Please try again in ${escalationWording(lockLevel)}.`;
}

// Shared with me.service.ts (initiateEmailChange / initiatePasswordChange), which count a
// wrong current password on the same login-lockout counter (Stage 18b). Safe to throw directly
// (rather than returning a result for the caller to throw after commit, as recordLoginFailure
// below does): nothing has been written yet in either caller's transaction at the point this is
// called, so there is nothing a rollback would undo.
export function throwIfLoginLocked(row: UserRowWithNow): void {
  if (!row.login_locked_until || row.login_locked_until.getTime() <= row.db_now.getTime()) {
    return;
  }
  const retryAfterSeconds = Math.ceil(
    (row.login_locked_until.getTime() - row.db_now.getTime()) / 1000,
  );
  throw new AppError(429, accountLockedMessage(row.login_lock_level), 'ACCOUNT_LOCKED', retryAfterSeconds);
}

export type RecordLoginFailureResult =
  | { locked: false }
  | { locked: true; lockLevel: number; retryAfterSeconds: number };

// Call inside a transaction, against a row already locked with lockUserByIdWithNow, when a
// password attempt on that row's account failed. Not called for pending/suspended accounts
// (Stage 18b: "what does not count").
//
// Returns rather than throws when the threshold is hit on this very call: the lock write must
// commit, so the caller throws accountLockedAppError(result) itself only after its
// withTransaction call resolves (the same "thrown only after commit" pattern used elsewhere in
// this file for OTP attempt counts) — the 5th failure in the window is itself rejected with
// ACCOUNT_LOCKED, per the Stage 18b Verification bullet.
export async function recordLoginFailure(
  row: UserRowWithNow,
  db: Queryable,
): Promise<RecordLoginFailureResult> {
  const windowMs = config.lock.loginFailureWindowMinutes * 60_000;
  const windowStart = row.login_failure_window_start;
  const windowExpired = !windowStart || row.db_now.getTime() - windowStart.getTime() > windowMs;
  const newCount = windowExpired ? 1 : row.login_failed_attempts + 1;

  if (newCount >= config.lock.maxLoginFailures) {
    const currentLevel = effectiveEscalationLevel(
      row.login_lock_level,
      row.login_locked_until,
      row.db_now,
    );
    const newLevel = currentLevel + 1;
    const durationHours = durationHoursForLevel(newLevel);
    const lockedUntil = new Date(row.db_now.getTime() + durationHours * 3_600_000);
    await userQueries.lockLoginAccount(row.id, { lockedUntil, lockLevel: newLevel }, db);
    return { locked: true, lockLevel: newLevel, retryAfterSeconds: durationHours * 3600 };
  }

  await userQueries.recordLoginFailure(
    row.id,
    { failedAttempts: newCount, windowStart: windowExpired ? row.db_now : windowStart },
    db,
  );
  return { locked: false };
}

export function accountLockedAppError(result: { lockLevel: number; retryAfterSeconds: number }): AppError {
  return new AppError(429, accountLockedMessage(result.lockLevel), 'ACCOUNT_LOCKED', result.retryAfterSeconds);
}

export { PASSWORD_MESSAGE, PASSWORD_REGEX };

export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,255}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const USERNAME_MESSAGE =
  'Username must contain between 3 and 255 chars and have no spaces or special characters.';

export const OTP_REGEX = /^\d{6}$/;

const BCRYPT_WORK_FACTOR = 10;

function isPgUniqueViolation(err: unknown): err is { code: string; constraint?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  );
}

export async function register({
  username,
  email,
  password,
}: {
  username: string;
  email: string;
  password: string;
}): Promise<void> {
  if (!USERNAME_REGEX.test(username)) {
    throw new AppError(400, USERNAME_MESSAGE, 'VALIDATION_ERROR');
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new AppError(400, 'Please enter a valid email', 'VALIDATION_ERROR');
  }

  if (!PASSWORD_REGEX.test(password)) {
    throw new AppError(400, PASSWORD_MESSAGE, 'VALIDATION_ERROR');
  }

  await withTransaction(async (client) => {
    await userQueries.deleteStalePendingUsers({ username, email }, client);

    // A live pending user (unexpired OTP) still counts as taken: this is the reservation.
    const existingUsername = await userQueries.findByUsername(username, client);
    if (existingUsername) {
      throw new AppError(409, 'Username already in use', 'USERNAME_TAKEN');
    }

    const existingEmail = await userQueries.findByEmail(email, client);
    if (existingEmail) {
      throw new AppError(409, 'Email already in use', 'EMAIL_TAKEN');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    let userId: string;
    try {
      const user = await userQueries.createUser(
        { username, email, passwordHash, status: 'pending' },
        client,
      );
      userId = user.id;
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        const constraint = err.constraint ?? '';
        if (constraint.includes('username')) {
          throw new AppError(409, 'Username already in use', 'USERNAME_TAKEN');
        }
        if (constraint.includes('email')) {
          throw new AppError(409, 'Email already in use', 'EMAIL_TAKEN');
        }
      }
      throw err;
    }

    await issueOtp({ userId, email, purpose: 'Registration' }, client);
  });
}

export async function login(
  { identifier, password }: { identifier: string; password: string },
  userAgent: string | null,
  ipAddress: string | null,
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string; email: string; role: string; activeView: string };
}> {
  const user =
    (await userQueries.findByUsername(identifier)) ?? (await userQueries.findByEmail(identifier));

  if (!user) {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  // bcrypt is slow, so compute it before taking the row lock below. Its result is used only
  // after the lock check and the stale-hash re-check inside the transaction.
  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  const refreshTokenPlain = randomBytes(32).toString('hex');
  const refreshTokenHash = sha256(refreshTokenPlain);

  // Lock the user and re-check everything against the locked row, so a reset, suspend or
  // another login's failure/lock that committed in between is never missed.
  const outcome = await withTransaction(async (client) => {
    const locked = await userQueries.lockUserByIdWithNow(user.id, client);
    if (!locked) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Check order (Stage 18b): the lock check runs before the password check, whatever
    // password was sent. Nothing has been written yet, so throwing here directly is safe.
    throwIfLoginLocked(locked);

    // Stale-hash guard: the pre-lock bcrypt result is only valid if the hash has not changed
    // since (e.g. a concurrent password reset).
    const effectiveMatch = passwordMatches && locked.password_hash === user.password_hash;
    const countsTowardLock = locked.status !== 'pending' && locked.status !== 'suspended';

    if (!effectiveMatch) {
      if (countsTowardLock) {
        const failureResult = await recordLoginFailure(locked, client);
        // The 5th failure in the window is itself rejected with ACCOUNT_LOCKED, not
        // INVALID_CREDENTIALS, but the lock write must commit before that is thrown.
        if (failureResult.locked) {
          return { kind: 'locked' as const, result: failureResult };
        }
      }
      return { kind: 'invalid' as const };
    }

    if (locked.status === 'pending') {
      throw new AppError(403, 'Account not verified', 'ACCOUNT_NOT_VERIFIED');
    }
    if (locked.status === 'suspended') {
      throw new AppError(403, 'Account suspended', 'ACCOUNT_SUSPENDED');
    }

    // A successful login clears the failure count, the window and the escalation level.
    await userQueries.resetLoginLock(locked.id, client);

    await tokenQueries.createRefreshToken(
      {
        userId: user.id,
        tokenHash: refreshTokenHash,
        ttlDays: config.jwt.refreshTokenTtlDays,
        userAgent,
        ipAddress,
      },
      client,
    );
    return { kind: 'success' as const, role: locked.role, activeView: locked.active_view };
  });

  if (outcome.kind === 'locked') {
    throw accountLockedAppError(outcome.result);
  }
  if (outcome.kind === 'invalid') {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  const accessToken = signAccessToken({ userId: user.id, role: outcome.role });

  return {
    accessToken,
    refreshToken: refreshTokenPlain,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: outcome.role,
      activeView: outcome.activeView,
    },
  };
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = sha256(refreshToken);

  await withTransaction(async (client) => {
    const tokenRow = await tokenQueries.lockRefreshToken(tokenHash, client);
    if (!tokenRow || tokenRow.is_revoked) {
      throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
    await tokenQueries.revokeRefreshToken(tokenHash, client);
  });
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string }> {
  const tokenHash = sha256(refreshToken);
  const tokenRow = await tokenQueries.findRefreshToken(tokenHash);

  if (
    !tokenRow ||
    tokenRow.is_revoked ||
    tokenRow.expires_at.getTime() < tokenRow.db_now.getTime()
  ) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // Lock order: user row first, then token row (see the lock ordering rule in Stage 4d).
  // Re-check on the locked rows, so a logout, reset or suspend that committed while this
  // request waited cannot be followed by a freshly issued access token.
  const { id, role } = await withTransaction(async (client) => {
    const lockedUser = await userQueries.lockUserById(tokenRow.user_id, client);
    if (!lockedUser) {
      throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const lockedToken = await tokenQueries.lockRefreshToken(tokenHash, client);
    if (
      !lockedToken ||
      lockedToken.is_revoked ||
      lockedToken.expires_at.getTime() < lockedToken.db_now.getTime()
    ) {
      throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    if (lockedUser.status === 'suspended') {
      throw new AppError(403, 'Account suspended', 'ACCOUNT_SUSPENDED');
    }

    // Role comes from the freshly locked row, so a promotion applies on the next refresh.
    return { id: lockedUser.id, role: lockedUser.role };
  });

  const accessToken = signAccessToken({ userId: id, role });

  return { accessToken };
}

export async function verifyRegistrationOtp({
  email,
  otp,
}: {
  email: string;
  otp: string;
}): Promise<void> {
  if (!OTP_REGEX.test(otp)) {
    throw new AppError(400, 'OTP must be a 6-digit code', 'VALIDATION_ERROR');
  }

  const result = await withTransaction(async (client) => {
    const user = await userQueries.findByEmail(email, client);
    if (!user || user.status !== 'pending') {
      throw new AppError(400, 'Invalid or expired OTP', 'INVALID_OTP');
    }

    const locked = await userQueries.lockUserById(user.id, client);

    if (!locked || locked.status !== 'pending') {
      throw new AppError(400, 'Invalid or expired OTP', 'INVALID_OTP');
    }

    const check = await checkOtp({ userId: user.id, purpose: 'Registration', otp }, client);
    if (check.ok) {
      const activated = await userQueries.activateUser(user.id, client);
      if (!activated) {
        throw new AppError(400, 'Invalid or expired OTP', 'INVALID_OTP');
      }
      await creditOutboxQueries.insertCreditAllocation(user.id, client);
    }
    return check;
  });

  // Thrown only after commit so the incremented attempt count is persisted.
  if (!result.ok) {
    throw new AppError(400, 'Invalid or expired OTP', 'INVALID_OTP');
  }
}

export async function resendRegistrationOtp({ email }: { email: string }): Promise<void> {
  await withTransaction(async (client) => {
    const user = await userQueries.findByEmail(email, client);
    if (!user || user.status !== 'pending') {
      throw new AppError(400, 'No pending registration found', 'NO_PENDING_REGISTRATION');
    }

    const locked = await userQueries.lockUserById(user.id, client);

    if (!locked || locked.status !== 'pending') {
      throw new AppError(400, 'No pending registration found', 'NO_PENDING_REGISTRATION');
    }

    const count = await otpQueries.countOtps(user.id, 'Registration', client);
    if (count - 1 >= config.otp.maxResends) {
      throw new AppError(
        429,
        'Maximum OTP resends reached. Please try registering again in about 10 minutes.',
        'OTP_RESEND_LIMIT',
      );
    }

    const latest = await otpQueries.findLatestOtp(user.id, 'Registration', client);
    if (latest) {
      const availableAt = latest.created_at.getTime() + config.otp.resendCooldownSeconds * 1000;
      const remainingMs = availableAt - latest.db_now.getTime();
      if (remainingMs > 0) {
        throw new AppError(
          429,
          'Please wait before requesting another OTP',
          'OTP_RESEND_COOLDOWN',
          Math.ceil(remainingMs / 1000),
        );
      }
    }

    await issueOtp({ userId: user.id, email: user.email, purpose: 'Registration' }, client);
  });
}

export async function forgotPassword({ email }: { email: string }): Promise<void> {
  // A cap hit writes the new escalation level/block end (Stage 18c) inside the same
  // transaction that calls requestOtp, so the switch below runs after this transaction has
  // committed rather than inside it, or that write would be rolled back by the throw.
  const result = await withTransaction(async (client) => {
    // Plain read is a cheap early exit; requestOtp re-checks after locking the row.
    const user = await userQueries.findByEmail(email, client);
    if (!user) {
      throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');
    }
    if (user.status === 'pending') {
      throw new AppError(
        403,
        'Account not verified. Please finish registration first.',
        'ACCOUNT_NOT_VERIFIED',
      );
    }

    return requestOtp({ userId: user.id, email: user.email, purpose: 'Forgot Password' }, client);
  });

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
        `Maximum OTP resends reached. Please try again in ${escalationWording(result.level)}.`,
        'OTP_RESEND_LIMIT',
        result.retryAfterSeconds,
      );
    case 'no-user':
      throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');
    case 'not-verified':
      throw new AppError(
        403,
        'Account not verified. Please finish registration first.',
        'ACCOUNT_NOT_VERIFIED',
      );
  }
}

// Same operation as forgotPassword (both request a fresh OTP through requestOtp), so it is
// implemented once there and reused here for POST /auth/resend-otp.
export async function resendForgotPasswordOtp({ email }: { email: string }): Promise<void> {
  await forgotPassword({ email });
}

// Non-consuming check: the code stays valid until reset-password consumes it.
export async function verifyForgotPasswordOtp({
  email,
  otp,
}: {
  email: string;
  otp: string;
}): Promise<void> {
  if (!OTP_REGEX.test(otp)) {
    throw new AppError(400, 'OTP must be a 6-digit code', 'VALIDATION_ERROR');
  }

  const result = await withTransaction(async (client) => {
    const user = await userQueries.findByEmail(email, client);
    if (!user) {
      throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');
    }
    if (user.status === 'pending') {
      throw new AppError(
        403,
        'Account not verified. Please finish registration first.',
        'ACCOUNT_NOT_VERIFIED',
      );
    }

    // Re-check after the lock: the pre-lock read can be stale. Suspended accounts are allowed.
    const locked = await userQueries.lockUserById(user.id, client);
    if (!locked) {
      throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');
    }
    if (locked.status === 'pending') {
      throw new AppError(
        403,
        'Account not verified. Please finish registration first.',
        'ACCOUNT_NOT_VERIFIED',
      );
    }

    return checkOtp({ userId: user.id, purpose: 'Forgot Password', otp }, client, false);
  });

  // Thrown only after commit so the incremented attempt count is persisted.
  if (!result.ok) {
    throw new AppError(400, 'Invalid or expired OTP', 'INVALID_OTP');
  }
}

export async function resetPassword({
  email,
  otp,
  newPassword,
}: {
  email: string;
  otp: string;
  newPassword: string;
}): Promise<void> {
  if (!PASSWORD_REGEX.test(newPassword)) {
    throw new AppError(400, PASSWORD_MESSAGE, 'VALIDATION_ERROR');
  }
  if (!OTP_REGEX.test(otp)) {
    throw new AppError(400, 'OTP must be a 6-digit code', 'VALIDATION_ERROR');
  }

  const result = await withTransaction(async (client) => {
    const user = await userQueries.findByEmail(email, client);
    if (!user) {
      throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');
    }
    if (user.status === 'pending') {
      throw new AppError(
        403,
        'Account not verified. Please finish registration first.',
        'ACCOUNT_NOT_VERIFIED',
      );
    }

    // Lock the user row first (lock order: user, then its refresh tokens).
    // Re-check after the lock: the pre-lock read can be stale. Suspended accounts are allowed.
    const locked = await userQueries.lockUserById(user.id, client);
    if (!locked) {
      throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');
    }
    if (locked.status === 'pending') {
      throw new AppError(
        403,
        'Account not verified. Please finish registration first.',
        'ACCOUNT_NOT_VERIFIED',
      );
    }

    // Default consuming check: this is the real gate.
    const check = await checkOtp({ userId: user.id, purpose: 'Forgot Password', otp }, client);
    if (check.ok) {
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_WORK_FACTOR);
      await userQueries.updatePasswordHash(user.id, passwordHash, client);
      // Same transaction as the password change, so no old session outlives it.
      await tokenQueries.revokeAllRefreshTokensForUser(user.id, client);
    }
    return check;
  });

  // Thrown only after commit so the incremented attempt count is persisted.
  if (!result.ok) {
    throw new AppError(400, 'Invalid or expired OTP', 'INVALID_OTP');
  }
}
