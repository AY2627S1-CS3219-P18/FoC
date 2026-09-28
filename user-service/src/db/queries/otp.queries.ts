// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 5c - OTP queries
// Author review:
// 25/09/2026: Stage 6 pre-work - countOtps optional rolling window (sinceMinutes)
// Author review:

import type { Queryable } from "../transaction.js";

export type OtpPurpose =
  | "Registration"
  | "Forgot Password"
  | "Change Email"
  | "Change Password"
  | "Admin Action";

export interface OtpRow {
  id: string;
  user_id: string;
  otp_hash: string;
  new_email: string | null;
  purpose: OtpPurpose;
  attempts_count: number;
  max_attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
}

export type OtpRowWithNow = OtpRow & { db_now: Date };


export async function createOtp(
  {
    userId,
    otpHash,
    purpose,
    newEmail,
    ttlMinutes,
  }: {
    userId: string;
    otpHash: string;
    purpose: OtpPurpose;
    newEmail: string | null;
    ttlMinutes: number;
  },
  db: Queryable,
): Promise<OtpRow> {
  const result = await db.query<OtpRow>(
    `INSERT INTO users_otps (user_id, otp_hash, purpose, new_email, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + make_interval(mins => $5)) RETURNING *`,
    [userId, otpHash, purpose, newEmail, ttlMinutes],
  );
  return result.rows[0]!;
}

export async function invalidateActiveOtps(
  userId: string,
  purpose: OtpPurpose,
  db: Queryable,
): Promise<void> {
  await db.query(
    `UPDATE users_otps SET consumed_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [userId, purpose],
  );
}

export async function findLatestOtp(
  userId: string,
  purpose: OtpPurpose,
  db: Queryable,
): Promise<OtpRowWithNow | null> {
  const result = await db.query<OtpRowWithNow>(
    `SELECT *, clock_timestamp() AS db_now FROM users_otps
     WHERE user_id = $1 AND purpose = $2
     ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose],
  );
  return result.rows[0] ?? null;
}

// Without sinceMinutes, counts every row (registration). With it, counts only rows
// created within that many minutes, compared against the database clock.
export async function countOtps(
  userId: string,
  purpose: OtpPurpose,
  db: Queryable,
  sinceMinutes?: number,
): Promise<number> {
  const result =
    sinceMinutes === undefined
      ? await db.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM users_otps WHERE user_id = $1 AND purpose = $2`,
          [userId, purpose],
        )
      : await db.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM users_otps
           WHERE user_id = $1 AND purpose = $2
             AND created_at > clock_timestamp() - make_interval(mins => $3)`,
          [userId, purpose, sinceMinutes],
        );
  return Number(result.rows[0]!.count);
}

export async function incrementAttempts(
  otpId: string,
  db: Queryable,
): Promise<number> {
  const result = await db.query<{ attempts_count: number }>(
    `UPDATE users_otps SET attempts_count = attempts_count + 1
     WHERE id = $1 RETURNING attempts_count`,
    [otpId],
  );
  return result.rows[0]!.attempts_count;
}

export async function consumeOtp(
  otpId: string,
  db: Queryable,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE users_otps SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL`,
    [otpId],
  );
  return (result.rowCount ?? 0) > 0;
}
