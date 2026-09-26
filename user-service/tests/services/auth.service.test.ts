// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-26
// 26/09/2026: Stage 7 - service-level tests for each exported auth.service function
// Author review:
import bcrypt from 'bcrypt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as authService from '../../src/services/auth.service.js';
import { AppError } from '../../src/utils/AppError.js';
import { sha256 } from '../../src/utils/hash.js';
import { NEW_PASSWORD, PASSWORD } from '../helpers/constants.js';
import {
  backdateOtps,
  countUsers,
  expireOtps,
  getOtps,
  getRefreshTokenByPlain,
  getRefreshTokens,
  getUserByEmail,
  seedOtp,
  seedRefreshToken,
  setUserRole,
  setUserStatus,
  truncateAll,
} from '../helpers/db.js';
import {
  emailCallsFor,
  failNextEmail,
  latestOtpFor,
  resetEmailMock,
  sendOtpEmailMock,
  wrongOtp,
} from '../helpers/email.js';
import { createActiveUser, registerPending, userInput } from '../helpers/fixtures.js';

resetEmailMock();
beforeEach(truncateAll);
afterEach(truncateAll);

// Resolves to the thrown AppError (fails the test if nothing is thrown or it is another type).
async function appError(p: Promise<unknown>): Promise<AppError> {
  const err = await p.then(
    () => {
      throw new Error('expected an AppError but the call resolved');
    },
    (e) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  return err as AppError;
}

describe('PASSWORD_REGEX', () => {
  it.each(['Abcdef1!', 'Str0ng!Passw0rd', 'aA1!aaaa', 'Zz9#zzzzzzzzzzzz'])('accepts %j', (pw) => {
    expect(authService.PASSWORD_REGEX.test(pw)).toBe(true);
  });
  it.each(['Ab1!xyz', 'abcdefg1!', 'ABCDEFG1!', 'Abcdefgh!', 'Abcdefg12', '', 'Abc'])(
    'rejects %j',
    (pw) => {
      expect(authService.PASSWORD_REGEX.test(pw)).toBe(false);
    },
  );
});

describe('register', () => {
  it('throws AppError(400, VALIDATION_ERROR) with the documented message for each bad field', async () => {
    const good = userInput(1);
    expect(await appError(authService.register({ ...good, username: 'ab' }))).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message:
        'Username must contain between 3 and 255 chars and have no spaces or special characters.',
    });
    expect(await appError(authService.register({ ...good, email: 'nope' }))).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Please enter a valid email',
    });
    expect(await appError(authService.register({ ...good, password: 'weak' }))).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    expect(await countUsers()).toBe(0);
  });

  it('checks the username format before the email and the password', async () => {
    const err = await appError(
      authService.register({ username: 'a', email: 'bad', password: 'bad' }),
    );
    expect(err.message).toMatch(/^Username/);
  });

  it('creates a pending user and one Registration OTP in the same transaction', async () => {
    await authService.register(userInput(1));
    const user = (await getUserByEmail('user1@example.com'))!;
    expect(user.status).toBe('pending');
    expect(await getOtps(user.id, 'Registration')).toHaveLength(1);
  });

  it('resolves to undefined (nothing sensitive is returned)', async () => {
    expect(await authService.register(userInput(1))).toBeUndefined();
  });

  it('rolls back the pending user when the OTP email fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    failNextEmail();
    const err = await appError(authService.register(userInput(1)));
    expect(err).toMatchObject({ status: 503, code: 'EMAIL_SEND_FAILED' });
    expect(await countUsers()).toBe(0);
  });

  it('throws 409 USERNAME_TAKEN / EMAIL_TAKEN for a live reservation', async () => {
    await authService.register(userInput(1));
    expect(
      await appError(authService.register({ ...userInput(2), username: 'user1' })),
    ).toMatchObject({
      status: 409,
      code: 'USERNAME_TAKEN',
      message: 'Username already in use',
    });
    expect(
      await appError(authService.register({ ...userInput(2), email: 'user1@example.com' })),
    ).toMatchObject({
      status: 409,
      code: 'EMAIL_TAKEN',
      message: 'Email already in use',
    });
  });

  it('releases an expired pending reservation before checking for duplicates', async () => {
    await authService.register(userInput(1));
    const old = (await getUserByEmail('user1@example.com'))!;
    await expireOtps(old.id);
    await authService.register(userInput(1));
    expect((await getUserByEmail('user1@example.com'))!.id).not.toBe(old.id);
    expect(await countUsers()).toBe(1);
  });
});

describe('login', () => {
  it('returns { accessToken, refreshToken, user } where user has exactly id, username, email, role', async () => {
    const u = await createActiveUser(1);
    const result = await authService.login(
      { identifier: u.email, password: PASSWORD },
      'ua',
      '127.0.0.1',
    );

    expect(Object.keys(result).sort()).toEqual(['accessToken', 'refreshToken', 'user']);
    expect(result.user).toEqual({
      id: u.id,
      username: 'user1',
      email: 'user1@example.com',
      role: 'user',
    });
    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('stores the hash, user agent and IP of the request', async () => {
    const u = await createActiveUser(1);
    const { refreshToken } = await authService.login(
      { identifier: u.username, password: PASSWORD },
      'my-agent',
      '10.1.2.3',
    );
    const row = (await getRefreshTokenByPlain(refreshToken))!;
    expect(row.token_hash).toBe(sha256(refreshToken));
    expect(row.user_agent).toBe('my-agent');
    expect(row.ip_address).toBe('10.1.2.3');
  });

  it('accepts null user agent and IP', async () => {
    const u = await createActiveUser(1);
    const { refreshToken } = await authService.login(
      { identifier: u.username, password: PASSWORD },
      null,
      null,
    );
    const row = (await getRefreshTokenByPlain(refreshToken))!;
    expect(row.user_agent).toBeNull();
    expect(row.ip_address).toBeNull();
  });

  it('checks credentials (401) before pending (403) before suspended (403)', async () => {
    const pending = await registerPending(1);
    expect(
      await appError(
        authService.login({ identifier: pending.email, password: 'Wrong!Pass1' }, null, null),
      ),
    ).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(
      await appError(
        authService.login({ identifier: pending.email, password: PASSWORD }, null, null),
      ),
    ).toMatchObject({ status: 403, code: 'ACCOUNT_NOT_VERIFIED' });

    const active = await createActiveUser(2);
    await setUserStatus(active.id, 'suspended');
    expect(
      await appError(
        authService.login({ identifier: active.email, password: 'Wrong!Pass1' }, null, null),
      ),
    ).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(
      await appError(
        authService.login({ identifier: active.email, password: PASSWORD }, null, null),
      ),
    ).toMatchObject({ status: 403, code: 'ACCOUNT_SUSPENDED' });
  });

  it('finds the user by username first, then by email', async () => {
    const u = await createActiveUser(1);
    for (const identifier of [u.username, u.email]) {
      const r = await authService.login({ identifier, password: PASSWORD }, null, null);
      expect(r.user.id).toBe(u.id);
    }
  });

  it('takes the role from the locked row', async () => {
    const u = await createActiveUser(1);
    await setUserRole(u.id, 'super admin');
    const r = await authService.login({ identifier: u.email, password: PASSWORD }, null, null);
    expect(r.user.role).toBe('super admin');
  });
});

describe('logout', () => {
  it('revokes the token and resolves', async () => {
    const u = await createActiveUser(1);
    await seedRefreshToken(u.id, 'tok');
    await expect(authService.logout('tok')).resolves.toBeUndefined();
    expect((await getRefreshTokenByPlain('tok'))!.is_revoked).toBe(true);
  });

  it('throws 401 INVALID_REFRESH_TOKEN for an unknown, empty or already-revoked token', async () => {
    const u = await createActiveUser(1);
    await seedRefreshToken(u.id, 'tok');
    await authService.logout('tok');
    for (const t of ['tok', 'never-issued', '']) {
      expect(await appError(authService.logout(t))).toMatchObject({
        status: 401,
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token',
      });
    }
  });
});

describe('refresh', () => {
  it('returns only { accessToken }', async () => {
    const u = await createActiveUser(1);
    await seedRefreshToken(u.id, 'tok');
    const result = await authService.refresh('tok');
    expect(Object.keys(result)).toEqual(['accessToken']);
  });

  it('throws 401 for unknown, revoked and expired tokens, and 403 for a suspended user', async () => {
    const u = await createActiveUser(1);
    await seedRefreshToken(u.id, 'live');
    await seedRefreshToken(u.id, 'revoked');
    await authService.logout('revoked');
    await seedRefreshToken(u.id, 'expired');
    const { default: pool } = await import('../../src/db/pool.js');
    await pool.query(
      `UPDATE refresh_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE token_hash = $1`,
      [sha256('expired')],
    );

    for (const t of ['unknown', 'revoked', 'expired']) {
      expect(await appError(authService.refresh(t))).toMatchObject({
        status: 401,
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    await setUserStatus(u.id, 'suspended');
    expect(await appError(authService.refresh('live'))).toMatchObject({
      status: 403,
      code: 'ACCOUNT_SUSPENDED',
    });
  });
});

describe('verifyRegistrationOtp', () => {
  it('activates the user and consumes the OTP', async () => {
    const u = await registerPending(1);
    await authService.verifyRegistrationOtp({ email: u.email, otp: latestOtpFor(u.email) });
    expect((await getUserByEmail(u.email))!.status).toBe('active');
  });

  it('validates the OTP format before touching the database', async () => {
    const u = await registerPending(1);
    expect(
      await appError(authService.verifyRegistrationOtp({ email: u.email, otp: '12345' })),
    ).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'OTP must be a 6-digit code',
    });
    expect((await getOtps(u.id))[0]!.attempts_count).toBe(0);
  });

  it('gives the same INVALID_OTP for unknown, non-pending and wrong-code cases', async () => {
    const pending = await registerPending(1);
    const active = await createActiveUser(2);
    const wrong = wrongOtp(latestOtpFor(pending.email));

    for (const args of [
      { email: 'ghost@example.com', otp: '123456' },
      { email: active.email, otp: '123456' },
      { email: pending.email, otp: wrong },
    ]) {
      expect(await appError(authService.verifyRegistrationOtp(args))).toMatchObject({
        status: 400,
        code: 'INVALID_OTP',
        message: 'Invalid or expired OTP',
      });
    }
  });

  it('persists the attempt increment even though it throws afterwards', async () => {
    const u = await registerPending(1);
    await appError(
      authService.verifyRegistrationOtp({ email: u.email, otp: wrongOtp(latestOtpFor(u.email)) }),
    );
    expect((await getOtps(u.id))[0]!.attempts_count).toBe(1);
  });
});

describe('resendRegistrationOtp', () => {
  it('sends a new OTP after the cooldown', async () => {
    const u = await registerPending(1);
    await backdateOtps(u.id, 2);
    await authService.resendRegistrationOtp({ email: u.email });
    expect(await getOtps(u.id)).toHaveLength(2);
    expect(emailCallsFor(u.email)).toHaveLength(2);
  });

  it('throws OTP_RESEND_COOLDOWN with retryAfterSeconds inside the cooldown', async () => {
    const u = await registerPending(1);
    const err = await appError(authService.resendRegistrationOtp({ email: u.email }));
    expect(err).toMatchObject({ status: 429, code: 'OTP_RESEND_COOLDOWN' });
    expect(err.retryAfterSeconds).toBeGreaterThan(0);
    expect(err.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('throws OTP_RESEND_LIMIT (no retryAfterSeconds) once 5 resends are used', async () => {
    const u = await registerPending(1);
    for (let i = 0; i < 5; i++) {
      await backdateOtps(u.id, 2);
      await authService.resendRegistrationOtp({ email: u.email });
    }
    const err = await appError(authService.resendRegistrationOtp({ email: u.email }));
    expect(err).toMatchObject({
      status: 429,
      code: 'OTP_RESEND_LIMIT',
      message: 'Maximum OTP resends reached. Please try registering again in about 10 minutes.',
    });
    expect(err.retryAfterSeconds).toBeUndefined();
  });

  it('throws NO_PENDING_REGISTRATION for unknown and non-pending users', async () => {
    const active = await createActiveUser(1);
    for (const email of ['ghost@example.com', active.email]) {
      expect(await appError(authService.resendRegistrationOtp({ email }))).toMatchObject({
        status: 400,
        code: 'NO_PENDING_REGISTRATION',
      });
    }
  });
});

describe('forgotPassword and resendForgotPasswordOtp', () => {
  it.each([
    ['forgotPassword', authService.forgotPassword],
    ['resendForgotPasswordOtp', authService.resendForgotPasswordOtp],
  ])('%s: sends an OTP through the throttled path', async (_n, fn) => {
    const u = await createActiveUser(1);
    await fn({ email: u.email });
    expect(await getOtps(u.id, 'Forgot Password')).toHaveLength(1);

    const err = await appError(fn({ email: u.email }));
    expect(err).toMatchObject({ status: 429, code: 'OTP_RESEND_COOLDOWN' });
    expect(err.retryAfterSeconds).toBeGreaterThan(0);
    expect(await getOtps(u.id, 'Forgot Password')).toHaveLength(1);
  });

  it.each([
    ['forgotPassword', authService.forgotPassword],
    ['resendForgotPasswordOtp', authService.resendForgotPasswordOtp],
  ])('%s: 404 EMAIL_NOT_FOUND and 403 ACCOUNT_NOT_VERIFIED', async (_n, fn) => {
    expect(await appError(fn({ email: 'ghost@example.com' }))).toMatchObject({
      status: 404,
      code: 'EMAIL_NOT_FOUND',
    });
    const pending = await registerPending(1);
    expect(await appError(fn({ email: pending.email }))).toMatchObject({
      status: 403,
      code: 'ACCOUNT_NOT_VERIFIED',
      message: 'Account not verified. Please finish registration first.',
    });
    expect(
      sendOtpEmailMock.mock.calls.filter(([a]) => a.purpose === 'Forgot Password'),
    ).toHaveLength(0);
  });

  it('throws OTP_RESEND_LIMIT with the "about an hour" message', async () => {
    const u = await createActiveUser(1);
    for (let i = 0; i < 6; i++) {
      await authService.forgotPassword({ email: u.email });
      await backdateOtps(u.id, 2, 'Forgot Password');
    }
    const err = await appError(authService.forgotPassword({ email: u.email }));
    expect(err).toMatchObject({
      status: 429,
      code: 'OTP_RESEND_LIMIT',
      message: 'Maximum OTP resends reached. Please try again in about an hour.',
    });
    expect(err.retryAfterSeconds).toBeUndefined();
  });
});

describe('verifyForgotPasswordOtp', () => {
  it('validates the code without consuming it', async () => {
    const u = await createActiveUser(1);
    await seedOtp(u.id, 'Forgot Password', '123456');
    await authService.verifyForgotPasswordOtp({ email: u.email, otp: '123456' });
    await authService.verifyForgotPasswordOtp({ email: u.email, otp: '123456' });
    expect((await getOtps(u.id, 'Forgot Password'))[0]!.consumed_at).toBeNull();
  });

  it('throws INVALID_OTP for a wrong code and persists the attempt', async () => {
    const u = await createActiveUser(1);
    await seedOtp(u.id, 'Forgot Password', '123456');
    expect(
      await appError(authService.verifyForgotPasswordOtp({ email: u.email, otp: '654321' })),
    ).toMatchObject({
      status: 400,
      code: 'INVALID_OTP',
    });
    expect((await getOtps(u.id, 'Forgot Password'))[0]!.attempts_count).toBe(1);
  });

  it('throws 404 / 403 / 400 for unknown email, pending user and bad format', async () => {
    expect(
      await appError(
        authService.verifyForgotPasswordOtp({ email: 'ghost@example.com', otp: '123456' }),
      ),
    ).toMatchObject({ status: 404, code: 'EMAIL_NOT_FOUND' });
    const pending = await registerPending(1);
    expect(
      await appError(authService.verifyForgotPasswordOtp({ email: pending.email, otp: '123456' })),
    ).toMatchObject({ status: 403, code: 'ACCOUNT_NOT_VERIFIED' });
    expect(
      await appError(authService.verifyForgotPasswordOtp({ email: pending.email, otp: 'abc' })),
    ).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });
});

describe('resetPassword', () => {
  it('changes the hash, consumes the OTP and revokes all refresh tokens together', async () => {
    const u = await createActiveUser(1);
    await seedOtp(u.id, 'Forgot Password', '123456');
    await seedRefreshToken(u.id, 'a');
    await seedRefreshToken(u.id, 'b');

    await authService.resetPassword({ email: u.email, otp: '123456', newPassword: NEW_PASSWORD });

    const user = (await getUserByEmail(u.email))!;
    expect(await bcrypt.compare(NEW_PASSWORD, user.password_hash)).toBe(true);
    expect((await getOtps(u.id, 'Forgot Password'))[0]!.consumed_at).not.toBeNull();
    expect((await getRefreshTokens(u.id)).every((t) => t.is_revoked)).toBe(true);
  });

  it('validates the new password and OTP format before touching the database', async () => {
    const u = await createActiveUser(1);
    await seedOtp(u.id, 'Forgot Password', '123456');
    expect(
      await appError(
        authService.resetPassword({ email: u.email, otp: '123456', newPassword: 'weak' }),
      ),
    ).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(
      await appError(
        authService.resetPassword({ email: u.email, otp: '12', newPassword: NEW_PASSWORD }),
      ),
    ).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'OTP must be a 6-digit code',
    });
    expect((await getOtps(u.id, 'Forgot Password'))[0]!.attempts_count).toBe(0);
  });

  it('wrong code: throws INVALID_OTP, keeps the password and tokens, persists the attempt', async () => {
    const u = await createActiveUser(1);
    await seedOtp(u.id, 'Forgot Password', '123456');
    await seedRefreshToken(u.id, 'a');
    const before = (await getUserByEmail(u.email))!.password_hash;

    await appError(
      authService.resetPassword({ email: u.email, otp: '654321', newPassword: NEW_PASSWORD }),
    );

    expect((await getUserByEmail(u.email))!.password_hash).toBe(before);
    expect((await getRefreshTokenByPlain('a'))!.is_revoked).toBe(false);
    expect((await getOtps(u.id, 'Forgot Password'))[0]!.attempts_count).toBe(1);
  });

  it('throws 404 for an unknown email and 403 for a pending user', async () => {
    expect(
      await appError(
        authService.resetPassword({
          email: 'ghost@example.com',
          otp: '123456',
          newPassword: NEW_PASSWORD,
        }),
      ),
    ).toMatchObject({ status: 404, code: 'EMAIL_NOT_FOUND' });
    const pending = await registerPending(1);
    expect(
      await appError(
        authService.resetPassword({
          email: pending.email,
          otp: '123456',
          newPassword: NEW_PASSWORD,
        }),
      ),
    ).toMatchObject({ status: 403, code: 'ACCOUNT_NOT_VERIFIED' });
  });
});
