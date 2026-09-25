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

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { config } from '../config.js';
import * as tokenQueries from '../db/queries/tokens.queries.js';
import * as userQueries from '../db/queries/users.queries.js';
import { withTransaction } from '../db/transaction.js';
import { AppError } from '../utils/AppError.js';
import { sha256 } from '../utils/hash.js';
import { signAccessToken } from '../utils/jwt.js';
import * as otpQueries from '../db/queries/otp.queries.js';
import { checkOtp, issueOtp } from './otp.service.js';

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,255}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const OTP_REGEX = /^\d{6}$/;

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
    throw new AppError(
      400,
      'Username must contain between 3 and 255 chars and have no spaces or special characters.',
      'VALIDATION_ERROR',
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new AppError(400, 'Please enter a valid email', 'VALIDATION_ERROR');
  }

  if (!PASSWORD_REGEX.test(password)) {
    throw new AppError(
      400,
      'Password must contain at least 8 characters, with at least one uppercase, one lowercase, one digit and one special character. ',
      'VALIDATION_ERROR',
    );
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
  user: { id: string; username: string; email: string; role: string };
}> {
  const user =
    (await userQueries.findByUsername(identifier)) ?? (await userQueries.findByEmail(identifier));

  if (!user) {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  if (user.status === 'pending') {
    throw new AppError(403, 'Account not verified', 'ACCOUNT_NOT_VERIFIED');
  }

  if (user.status === 'suspended') {
    throw new AppError(403, 'Account suspended', 'ACCOUNT_SUSPENDED');
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role });

  const refreshTokenPlain = randomBytes(32).toString('hex');
  const refreshTokenHash = sha256(refreshTokenPlain);

  await tokenQueries.createRefreshToken({
    userId: user.id,
    tokenHash: refreshTokenHash,
    ttlDays: config.jwt.refreshTokenTtlDays,
    userAgent,
    ipAddress,
  });

  return {
    accessToken,
    refreshToken: refreshTokenPlain,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
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

if (!tokenRow || tokenRow.is_revoked || tokenRow.expires_at.getTime() < tokenRow.db_now.getTime()) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const user = await userQueries.findById(tokenRow.user_id);
  if (!user) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  if (user.status === 'suspended') {
    throw new AppError(403, 'Account suspended', 'ACCOUNT_SUSPENDED');
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role });

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
      // TODO(credit-service): emit user-registered event here
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
        'Maximum OTP resends reached. Please register again later.',
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
