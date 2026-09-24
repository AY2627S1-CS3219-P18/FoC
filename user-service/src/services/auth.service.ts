// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4b - registration
// Author review:

import bcrypt from 'bcrypt';
import * as userQueries from '../db/queries/users.queries.js';
import { AppError } from '../utils/AppError.js';

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,255}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

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

  const existingUsername = await userQueries.findByUsername(username);
  if (existingUsername) {
    throw new AppError(409, 'Username already in use', 'USERNAME_TAKEN');
  }

  const existingEmail = await userQueries.findByEmail(email);
  if (existingEmail) {
    throw new AppError(409, 'Email already in use', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

  try {
    await userQueries.createUser({ username, email, passwordHash });
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
}
