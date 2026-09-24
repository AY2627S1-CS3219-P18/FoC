// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 5c - checkOtp branching tests
// Author review:

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config.js", () => ({
  config: { otp: { ttlMinutes: 10, resendCooldownSeconds: 60, maxResends: 5 } },
}));
vi.mock("../db/queries/otp.queries.js");
vi.mock("./email.service.js", () => ({ sendOtpEmail: vi.fn() }));

import * as otpQueries from "../db/queries/otp.queries.js";
import type { Queryable } from "../db/transaction.js";
import { sha256 } from "../utils/hash.js";
import { checkOtp } from "./otp.service.js";

const db = {} as Queryable;
const args = { userId: "u1", purpose: "Registration" as const, otp: "123456" };

function row(overrides: Partial<otpQueries.OtpRow> = {}): otpQueries.OtpRow {
  return {
    id: "o1",
    user_id: "u1",
    otp_hash: sha256("123456"),
    new_email: null,
    purpose: "Registration",
    attempts_count: 0,
    max_attempts: 5,
    expires_at: new Date(Date.now() + 60_000),
    consumed_at: null,
    created_at: new Date(),
    ...overrides,
  };
}

describe("checkOtp", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws INVALID_OTP when no OTP exists", async () => {
    vi.mocked(otpQueries.findLatestOtp).mockResolvedValue(null);
    await expect(checkOtp(args, db)).rejects.toMatchObject({
      code: "INVALID_OTP",
    });
  });

  it("throws INVALID_OTP when already consumed", async () => {
    vi.mocked(otpQueries.findLatestOtp).mockResolvedValue(
      row({ consumed_at: new Date() }),
    );
    await expect(checkOtp(args, db)).rejects.toMatchObject({
      code: "INVALID_OTP",
    });
  });

  it("throws OTP_EXPIRED when past expiry", async () => {
    vi.mocked(otpQueries.findLatestOtp).mockResolvedValue(
      row({ expires_at: new Date(Date.now() - 1000) }),
    );
    await expect(checkOtp(args, db)).rejects.toMatchObject({
      code: "OTP_EXPIRED",
    });
  });

  it("throws OTP_ATTEMPTS_EXCEEDED even for the correct code once the limit is hit", async () => {
    vi.mocked(otpQueries.findLatestOtp).mockResolvedValue(
      row({ attempts_count: 5 }),
    );
    await expect(checkOtp(args, db)).rejects.toMatchObject({
      status: 429,
      code: "OTP_ATTEMPTS_EXCEEDED",
    });
    expect(otpQueries.consumeOtp).not.toHaveBeenCalled();
  });

  it("returns ok:false and increments attempts on a wrong code (no throw)", async () => {
    vi.mocked(otpQueries.findLatestOtp).mockResolvedValue(row());
    await expect(checkOtp({ ...args, otp: "000000" }, db)).resolves.toEqual({
      ok: false,
    });
    expect(otpQueries.incrementAttempts).toHaveBeenCalledWith("o1", db);
    expect(otpQueries.consumeOtp).not.toHaveBeenCalled();
  });

  it("consumes and returns ok:true on a correct code", async () => {
    vi.mocked(otpQueries.findLatestOtp).mockResolvedValue(row());
    vi.mocked(otpQueries.consumeOtp).mockResolvedValue(true);
    await expect(checkOtp(args, db)).resolves.toEqual({ ok: true });
  });

  it("throws INVALID_OTP if consume loses a race", async () => {
    vi.mocked(otpQueries.findLatestOtp).mockResolvedValue(row());
    vi.mocked(otpQueries.consumeOtp).mockResolvedValue(false);
    await expect(checkOtp(args, db)).rejects.toMatchObject({
      code: "INVALID_OTP",
    });
  });
});
