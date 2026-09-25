// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 5c - OTP service
// Author review:
// 25/09/2026: Stage 6 pre-work - checkOtp optional consume flag
// Author review:
// 25/09/2026: Stage 6a - requestOtp (locked, rate-limited OTP request)
// Author review:

import { config } from "../config.js";
import * as otpQueries from "../db/queries/otp.queries.js";
import type { OtpPurpose } from "../db/queries/otp.queries.js";
import * as userQueries from "../db/queries/users.queries.js";
import type { Queryable } from "../db/transaction.js";
import { AppError } from "../utils/AppError.js";
import { hashesMatch, sha256 } from "../utils/hash.js";
import { generateOtp } from "../utils/otp.js";
import { sendOtpEmail } from "./email.service.js";

export async function issueOtp(
  {
    userId,
    email,
    purpose,
    newEmail,
  }: { userId: string; email: string; purpose: OtpPurpose; newEmail?: string },
  db: Queryable,
): Promise<void> {
  await otpQueries.invalidateActiveOtps(userId, purpose, db);

  const otp = generateOtp();
  await otpQueries.createOtp(
    {
      userId,
      otpHash: sha256(otp),
      purpose,
      newEmail: newEmail ?? null,
      ttlMinutes: config.otp.ttlMinutes,
    },
    db,
  );

  try {
    await sendOtpEmail({ to: newEmail ?? email, otp, purpose });
  } catch (err) {
    // Never log the OTP itself.
    console.error(
      "Failed to send OTP email:",
      err instanceof Error ? err.message : err,
    );
    throw new AppError(
      503,
      "Unable to send verification email. Please try again.",
      "EMAIL_SEND_FAILED",
    );
  }
}

export type RequestOtpResult =
  | { status: "sent" }
  | { status: "no-user" }
  | { status: "not-verified" }
  | { status: "throttled"; reason: "limit" }
  | { status: "throttled"; reason: "cooldown"; retryAfterSeconds: number };

// Any endpoint that sends an OTP must go through this, never issueOtp directly.
// Must run inside withTransaction. It only reports what happened; callers decide the response.
// When throttled, nothing is sent and the existing OTP is not invalidated.
export async function requestOtp(
  {
    userId,
    email,
    purpose,
    newEmail,
  }: { userId: string; email: string; purpose: OtpPurpose; newEmail?: string },
  db: Queryable,
): Promise<RequestOtpResult> {
  const locked = await userQueries.lockUserById(userId, db);
  if (!locked) {
    return { status: "no-user" };
  }
  // A pending account never gets OTPs here; registration has its own resend.
  if (locked.status === "pending") {
    return { status: "not-verified" };
  }

  // Rolling window, so the limit is never permanent.
  const count = await otpQueries.countOtps(
    userId,
    purpose,
    db,
    config.otp.resendWindowMinutes,
  );
  if (count - 1 >= config.otp.maxResends) {
    return { status: "throttled", reason: "limit" };
  }

  const latest = await otpQueries.findLatestOtp(userId, purpose, db);
  if (latest) {
    const availableAt =
      latest.created_at.getTime() + config.otp.resendCooldownSeconds * 1000;
    const remainingMs = availableAt - latest.db_now.getTime();
    if (remainingMs > 0) {
      return {
        status: "throttled",
        reason: "cooldown",
        retryAfterSeconds: Math.ceil(remainingMs / 1000),
      };
    }
  }

  await issueOtp({ userId, email, purpose, newEmail }, db);
  return { status: "sent" };
}

// Must run inside a transaction that already holds the user row lock.
// Returns { ok: false } on a wrong guess instead of throwing, so the caller's
// transaction commits and the incremented attempt count is not rolled back.
export async function checkOtp(
  {
    userId,
    purpose,
    otp,
  }: { userId: string; purpose: OtpPurpose; otp: string },
  db: Queryable,
  consume: boolean = true,
): Promise<{ ok: boolean }> {
  const row = await otpQueries.findLatestOtp(userId, purpose, db);
  if (!row || row.consumed_at) {
    throw new AppError(400, "Invalid or expired OTP", "INVALID_OTP");
  }
  if (row.expires_at.getTime() <= row.db_now.getTime()) {
    throw new AppError(
      400,
      "OTP has expired. Please request a new one.",
      "OTP_EXPIRED",
    );
  }
  if (row.attempts_count >= row.max_attempts) {
    throw new AppError(
      429,
      "Too many incorrect attempts. Please request a new OTP.",
      "OTP_ATTEMPTS_EXCEEDED",
    );
  }

  if (!hashesMatch(sha256(otp), row.otp_hash)) {
    await otpQueries.incrementAttempts(row.id, db);
    return { ok: false };
  }

  // consume=false validates the code without using it up (wrong guesses still count above).
  if (consume) {
    const consumed = await otpQueries.consumeOtp(row.id, db);
    if (!consumed) {
      throw new AppError(400, "Invalid or expired OTP", "INVALID_OTP");
    }
  }
  return { ok: true };
}
