// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-26
// 26/09/2026: Stage 7 - integration tests for otp.service.ts (issueOtp, requestOtp, checkOtp)
// Author review:
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as otpQueries from '../../src/db/queries/otp.queries.js';
import * as userQueries from '../../src/db/queries/users.queries.js';
import { withTransaction } from '../../src/db/transaction.js';
import { checkOtp, issueOtp, requestOtp } from '../../src/services/otp.service.js';
import { AppError } from '../../src/utils/AppError.js';
import { sha256 } from '../../src/utils/hash.js';
import {
  backdateOtps,
  expireOtps,
  getOtps,
  seedOtp,
  setUserStatus,
  truncateAll,
} from '../helpers/db.js';
import {
  emailCallsFor,
  failNextEmail,
  resetEmailMock,
  sendOtpEmailMock,
} from '../helpers/email.js';

resetEmailMock();

let userId: string;
const email = 'alice@example.com';

beforeEach(async () => {
  await truncateAll();
  userId = (
    await userQueries.createUser({ username: 'alice', email, passwordHash: 'h', status: 'active' })
  ).id;
});
afterEach(truncateAll);

describe('issueOtp', () => {
  it('stores a SHA-256 hash (never the plaintext) and emails the plaintext code', async () => {
    await withTransaction((c) => issueOtp({ userId, email, purpose: 'Forgot Password' }, c));

    const [row] = await getOtps(userId);
    const [call] = emailCallsFor(email);
    expect(call!.otp).toMatch(/^\d{6}$/);
    expect(call!.purpose).toBe('Forgot Password');
    expect(row!.otp_hash).toBe(sha256(call!.otp));
    expect(row!.otp_hash).not.toContain(call!.otp);
    expect(row!.new_email).toBeNull();
    expect(row!.expires_at.getTime() - row!.created_at.getTime()).toBe(10 * 60 * 1000);
  });

  it('invalidates the previous active OTP of the same purpose only', async () => {
    await seedOtp(userId, 'Forgot Password', '111111');
    await seedOtp(userId, 'Registration', '222222');
    await withTransaction((c) => issueOtp({ userId, email, purpose: 'Forgot Password' }, c));

    const forgot = await getOtps(userId, 'Forgot Password');
    expect(forgot).toHaveLength(2);
    expect(forgot[0]!.consumed_at).not.toBeNull();
    expect(forgot[1]!.consumed_at).toBeNull();
    expect((await getOtps(userId, 'Registration'))[0]!.consumed_at).toBeNull();
  });

  it('sends to newEmail when given and stores it on the row', async () => {
    await withTransaction((c) =>
      issueOtp({ userId, email, purpose: 'Registration', newEmail: 'new@example.com' }, c),
    );
    expect(emailCallsFor('new@example.com')).toHaveLength(1);
    expect(emailCallsFor(email)).toHaveLength(0);
    expect((await getOtps(userId))[0]!.new_email).toBe('new@example.com');
  });

  it('throws 503 EMAIL_SEND_FAILED when sending fails, and the caller’s transaction rolls back', async () => {
    await seedOtp(userId, 'Forgot Password', '111111');
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    failNextEmail();

    const err = await withTransaction((c) =>
      issueOtp({ userId, email, purpose: 'Forgot Password' }, c),
    ).catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({
      status: 503,
      code: 'EMAIL_SEND_FAILED',
      message: 'Unable to send verification email. Please try again.',
    });
    // Rolled back: still exactly the seeded, still-active OTP.
    const rows = await getOtps(userId, 'Forgot Password');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.consumed_at).toBeNull();
    // The error log never contains an OTP.
    expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(/\b\d{6}\b/);
    errorLog.mockRestore();
  });
});

describe('requestOtp', () => {
  const run = (uid = userId, purpose: otpQueries.OtpPurpose = 'Forgot Password') =>
    withTransaction((c) => requestOtp({ userId: uid, email, purpose }, c));

  it('sends and reports sent for an active user', async () => {
    expect(await run()).toEqual({ status: 'sent' });
    expect(emailCallsFor(email)).toHaveLength(1);
    expect(await getOtps(userId, 'Forgot Password')).toHaveLength(1);
  });

  it('allows a suspended user', async () => {
    await setUserStatus(userId, 'suspended');
    expect(await run()).toEqual({ status: 'sent' });
  });

  it('reports no-user for an unknown user id', async () => {
    expect(await run('00000000-0000-0000-0000-000000000000')).toEqual({ status: 'no-user' });
    expect(sendOtpEmailMock).not.toHaveBeenCalled();
  });

  it('reports not-verified for a pending user, without sending', async () => {
    await setUserStatus(userId, 'pending');
    expect(await run()).toEqual({ status: 'not-verified' });
    expect(sendOtpEmailMock).not.toHaveBeenCalled();
    expect(await getOtps(userId)).toHaveLength(0);
  });

  it('throttles inside the cooldown with retryAfterSeconds, sending nothing and keeping the live OTP', async () => {
    await run();
    sendOtpEmailMock.mockClear();

    const result = await run();
    expect(result).toMatchObject({ status: 'throttled', reason: 'cooldown' });
    const retry = (result as { retryAfterSeconds: number }).retryAfterSeconds;
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(60);

    expect(sendOtpEmailMock).not.toHaveBeenCalled();
    const rows = await getOtps(userId, 'Forgot Password');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.consumed_at).toBeNull();
  });

  it('allows a resend once the cooldown has passed and invalidates the previous OTP', async () => {
    await run();
    await backdateOtps(userId, 2);
    expect(await run()).toEqual({ status: 'sent' });

    const rows = await getOtps(userId, 'Forgot Password');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.consumed_at).not.toBeNull();
    expect(rows[1]!.consumed_at).toBeNull();
  });

  it('allows the initial request plus 5 resends inside the window, then throttles with reason limit', async () => {
    for (let i = 0; i < 6; i++) {
      expect(await run()).toEqual({ status: 'sent' });
      await backdateOtps(userId, 2);
    }
    sendOtpEmailMock.mockClear();

    expect(await run()).toEqual({ status: 'throttled', reason: 'limit' });
    expect(sendOtpEmailMock).not.toHaveBeenCalled();
    expect(await getOtps(userId, 'Forgot Password')).toHaveLength(6);
  });

  it('the limit is a rolling window: rows older than resendWindowMinutes stop counting', async () => {
    for (let i = 0; i < 6; i++) {
      await run();
      await backdateOtps(userId, 2);
    }
    expect(await run()).toEqual({ status: 'throttled', reason: 'limit' });

    await backdateOtps(userId, 61);
    expect(await run()).toEqual({ status: 'sent' });
  });

  it('propagates EMAIL_SEND_FAILED as 503 and leaves the previous OTP valid', async () => {
    await run();
    await backdateOtps(userId, 2);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    failNextEmail();

    await expect(run()).rejects.toMatchObject({ status: 503, code: 'EMAIL_SEND_FAILED' });

    const rows = await getOtps(userId, 'Forgot Password');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.consumed_at).toBeNull();
  });

  it('is scoped per purpose', async () => {
    await run(userId, 'Forgot Password');
    expect(await run(userId, 'Change Password')).toEqual({ status: 'sent' });
  });
});

describe('checkOtp', () => {
  const check = (
    otp: string,
    consume?: boolean,
    purpose: otpQueries.OtpPurpose = 'Forgot Password',
  ) => withTransaction((c) => checkOtp({ userId, purpose, otp }, c, consume));

  it('throws INVALID_OTP when the user has no OTP for the purpose', async () => {
    await expect(check('123456')).rejects.toMatchObject({ status: 400, code: 'INVALID_OTP' });
  });

  it('throws INVALID_OTP when the latest OTP is already consumed', async () => {
    await seedOtp(userId, 'Forgot Password', '123456');
    expect(await check('123456')).toEqual({ ok: true });
    await expect(check('123456')).rejects.toMatchObject({ status: 400, code: 'INVALID_OTP' });
  });

  it('throws 400 OTP_EXPIRED once expires_at has passed, even for the correct code', async () => {
    await seedOtp(userId, 'Forgot Password', '123456');
    await expireOtps(userId);
    await expect(check('123456')).rejects.toMatchObject({
      status: 400,
      code: 'OTP_EXPIRED',
      message: 'OTP has expired. Please request a new one.',
    });
  });

  it('throws 429 OTP_ATTEMPTS_EXCEEDED at max_attempts, even for the correct code', async () => {
    await seedOtp(userId, 'Forgot Password', '123456');
    for (let i = 0; i < 5; i++) expect(await check('000000')).toEqual({ ok: false });
    await expect(check('123456')).rejects.toMatchObject({
      status: 429,
      code: 'OTP_ATTEMPTS_EXCEEDED',
    });
  });

  it('returns { ok: false } for a wrong code and the attempt increment survives the commit', async () => {
    await seedOtp(userId, 'Forgot Password', '123456');
    expect(await check('000000')).toEqual({ ok: false });
    expect(await check('000001')).toEqual({ ok: false });
    expect((await getOtps(userId))[0]!.attempts_count).toBe(2);
  });

  it('a wrong code does not consume the OTP', async () => {
    await seedOtp(userId, 'Forgot Password', '123456');
    await check('000000');
    expect((await getOtps(userId))[0]!.consumed_at).toBeNull();
  });

  it('consumes the OTP on a correct code by default', async () => {
    await seedOtp(userId, 'Forgot Password', '123456');
    expect(await check('123456')).toEqual({ ok: true });
    expect((await getOtps(userId))[0]!.consumed_at).not.toBeNull();
  });

  it('with consume=false a correct code leaves the OTP unconsumed and re-checkable', async () => {
    await seedOtp(userId, 'Forgot Password', '123456');
    expect(await check('123456', false)).toEqual({ ok: true });
    expect((await getOtps(userId))[0]!.consumed_at).toBeNull();
    expect(await check('123456', false)).toEqual({ ok: true });
    expect(await check('123456', true)).toEqual({ ok: true });
    expect((await getOtps(userId))[0]!.consumed_at).not.toBeNull();
  });

  it('with consume=false a wrong guess still increments attempts', async () => {
    await seedOtp(userId, 'Forgot Password', '123456');
    expect(await check('000000', false)).toEqual({ ok: false });
    expect((await getOtps(userId))[0]!.attempts_count).toBe(1);
  });

  it('only the latest OTP is checked; an older code no longer works', async () => {
    await seedOtp(userId, 'Forgot Password', '111111');
    await seedOtp(userId, 'Forgot Password', '222222');
    expect(await check('111111')).toEqual({ ok: false });
    expect(await check('222222')).toEqual({ ok: true });
  });

  it('is scoped to the purpose', async () => {
    await seedOtp(userId, 'Registration', '123456');
    await expect(check('123456', true, 'Forgot Password')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
  });
});
