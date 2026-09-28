// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-26
// 26/09/2026: Stage 7 - SQL helpers for manipulating test DB state directly
// Author review:
import type pg from 'pg';
import pool from '../../src/db/pool.js';
import { sha256 } from '../../src/utils/hash.js';
import type { OtpPurpose, OtpRow } from '../../src/db/queries/otp.queries.js';
import type { RefreshTokenRow } from '../../src/db/queries/tokens.queries.js';
import type { UserRow } from '../../src/db/queries/users.queries.js';

export async function truncateAll(): Promise<void> {
  await pool.query('TRUNCATE users CASCADE');
}

export async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  const r = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
  return r.rows[0];
}

export async function getUserByUsername(username: string): Promise<UserRow | undefined> {
  const r = await pool.query<UserRow>('SELECT * FROM users WHERE username = $1', [username]);
  return r.rows[0];
}

export async function countUsers(): Promise<number> {
  const r = await pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM users');
  return Number(r.rows[0]!.count);
}

export async function getOtps(userId: string, purpose?: OtpPurpose): Promise<OtpRow[]> {
  const r = purpose
    ? await pool.query<OtpRow>(
        'SELECT * FROM users_otps WHERE user_id = $1 AND purpose = $2 ORDER BY created_at',
        [userId, purpose],
      )
    : await pool.query<OtpRow>('SELECT * FROM users_otps WHERE user_id = $1 ORDER BY created_at', [
        userId,
      ]);
  return r.rows;
}

export async function getRefreshTokens(userId: string): Promise<RefreshTokenRow[]> {
  const r = await pool.query<RefreshTokenRow>(
    'SELECT * FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at',
    [userId],
  );
  return r.rows;
}

export async function getRefreshTokenByPlain(plain: string): Promise<RefreshTokenRow | undefined> {
  const r = await pool.query<RefreshTokenRow>(
    'SELECT * FROM refresh_tokens WHERE token_hash = $1',
    [sha256(plain)],
  );
  return r.rows[0];
}

export async function setUserStatus(
  userId: string,
  status: 'pending' | 'active' | 'suspended',
): Promise<void> {
  await pool.query('UPDATE users SET status = $2 WHERE id = $1', [userId, status]);
}

export async function setUserRole(
  userId: string,
  role: 'user' | 'admin' | 'super admin',
): Promise<void> {
  await pool.query('UPDATE users SET role = $2 WHERE id = $1', [userId, role]);
}

// Puts every OTP of the user (optionally one purpose) in the past, so it has expired.
export async function expireOtps(userId: string, purpose?: OtpPurpose): Promise<void> {
  await pool.query(
    `UPDATE users_otps SET expires_at = NOW() - INTERVAL '1 minute'
     WHERE user_id = $1 AND ($2::purpose_enum IS NULL OR purpose = $2)`,
    [userId, purpose ?? null],
  );
}

// Moves created_at back, so the resend cooldown (or rolling window) has passed.
export async function backdateOtps(
  userId: string,
  minutes: number,
  purpose?: OtpPurpose,
): Promise<void> {
  await pool.query(
    `UPDATE users_otps SET created_at = created_at - make_interval(mins => $3)
     WHERE user_id = $1 AND ($2::purpose_enum IS NULL OR purpose = $2)`,
    [userId, purpose ?? null, minutes],
  );
}

export async function expireRefreshToken(plain: string): Promise<void> {
  await pool.query(
    `UPDATE refresh_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE token_hash = $1`,
    [sha256(plain)],
  );
}

// Inserts an OTP with a known plaintext, for tests that skip the email step.
export async function seedOtp(
  userId: string,
  purpose: OtpPurpose,
  otp: string,
  opts: { newEmail?: string } = {},
): Promise<void> {
  await pool.query(
    `UPDATE users_otps SET consumed_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [userId, purpose],
  );
  await pool.query(
    `INSERT INTO users_otps (user_id, otp_hash, purpose, new_email, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')`,
    [userId, sha256(otp), purpose, opts.newEmail ?? null],
  );
}

// Inserts a refresh token with a known plaintext, without going through login.
export async function seedRefreshToken(userId: string, plain: string): Promise<void> {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [userId, sha256(plain)],
  );
}

// Runs fn inside a transaction that already holds the user's row lock, so the caller can start
// a service call that will block on that lock, change state, and release it by returning.
export async function withHeldUserLock<T>(
  userId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Resolves once at least `count` other backend(s) are waiting on a row lock.
export async function waitForLockWaiters(count = 1, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await pool.query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if (Number(r.rows[0]!.n) >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for a query to block on a lock');
}
