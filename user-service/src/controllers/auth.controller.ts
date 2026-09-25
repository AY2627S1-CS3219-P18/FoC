// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4b - registration controller
// Author review:
// 25/09/2026: Stage 4c - login controller
// Author review:
// 25/09/2026: Stage 4d - logout + refresh controllers
// Author review:
// 25/09/2026: Stage 4e - verify controller
// Author review:
// 25/09/2026: Stage 5d - register returns OTP_SENT
// Author review:
// 25/09/2026: Stage 5e - verifyOtp and resendOtp controllers
// Author review:
// 25/09/2026: Stage 5 - normalise email and username (lowercase) at the request boundary
// Author review:
// 25/09/2026: Stage 6b - forgotPassword controller
// Author review:
// 25/09/2026: Stage 6d - resetPassword controller
// Author review:

import { z } from 'zod';
import { config } from '../config.js';
import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { REFRESH_COOKIE_OPTIONS } from '../utils/cookies.js';
import { verifyAccessToken } from '../utils/jwt.js';

// Emails are matched case-sensitively in the DB, so normalise them once here.
const emailField = z
  .string({
    required_error: 'Email is required',
    invalid_type_error: 'Email must be a string',
  })
  .trim()
  .toLowerCase();

// Usernames are matched case-insensitively too. Not trimmed, so leading/trailing
// spaces still fail the service's "no spaces" rule.
const usernameField = z
  .string({
    required_error: 'Username is required',
    invalid_type_error: 'Username must be a string',
  })
  .toLowerCase();

const registerSchema = z
  .object({
    username: usernameField,
    email: emailField,
    password: z.string({
      required_error: 'Password is required',
      invalid_type_error: 'Password must be a string',
    }),
  })
  .strict();

export const register = asyncHandler(async (req, res) => {
  const { username, email, password } = registerSchema.parse(req.body);
  await authService.register({ username, email, password });
  res.status(201).json({ message: 'Verification code sent to your email', code: 'OTP_SENT' });
});

const loginSchema = z
  .object({
    // Both usernames and emails are stored lowercase, so match on the lowercase form.
    identifier: z
      .string({
        required_error: 'Username/Email is required',
        invalid_type_error: 'Username/Email must be a string',
      })
      .trim()
      .toLowerCase(),
    password: z.string({
      required_error: 'Password is required',
      invalid_type_error: 'Password must be a string',
    }),
  })
  .strict();

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = loginSchema.parse(req.body);

  const { accessToken, refreshToken, user } = await authService.login(
    { identifier, password },
    req.headers['user-agent'] ?? null,
    req.ip ?? null,
  );

  res.cookie('refreshToken', refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: config.jwt.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({ accessToken, user });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken: string =
    typeof req.cookies.refreshToken === 'string' ? req.cookies.refreshToken : '';

  await authService.logout(refreshToken);

  res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);
  res.status(200).json({ message: 'Logged out successfully', code: 'LOGOUT_SUCCESS' });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken: string =
    typeof req.cookies.refreshToken === 'string' ? req.cookies.refreshToken : '';

  const { accessToken } = await authService.refresh(refreshToken);

  res.status(200).json({ accessToken });
});

export const verify = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Invalid token', code: 'INVALID_TOKEN' });
    return;
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const { user_id, role } = verifyAccessToken(token);
    res.status(200).json({ user_id, role });
  } catch {
    res.status(401).json({ message: 'Invalid token', code: 'INVALID_TOKEN' });
  }
});

// API-facing purpose -> DB enum value. Extend here in later stages.
const PURPOSE_MAP = { registration: 'Registration' } as const;

const purposeSchema = z.enum(['registration'], {
  errorMap: (issue) => {
    if (issue.code === 'invalid_enum_value') return { message: 'Invalid purpose' };
    if (issue.code === 'invalid_type' && issue.received === 'undefined') {
      return { message: 'Purpose is required' };
    }
    return { message: 'Purpose must be a string' };
  },
});

const verifyOtpSchema = z
  .object({
    email: emailField,
    otp: z.string({
      required_error: 'OTP is required',
      invalid_type_error: 'OTP must be a string',
    }),
    purpose: purposeSchema,
  })
  .strict();

const resendOtpSchema = z.object({ email: emailField, purpose: purposeSchema }).strict();

export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp, purpose } = verifyOtpSchema.parse(req.body);
  switch (PURPOSE_MAP[purpose]) {
    case 'Registration':
      await authService.verifyRegistrationOtp({ email, otp });
      break;
  }
  res.status(200).json({
    message: 'Registration complete. You can now log in.',
    code: 'REGISTER_SUCCESS',
  });
});

export const resendOtp = asyncHandler(async (req, res) => {
  const { email, purpose } = resendOtpSchema.parse(req.body);
  switch (PURPOSE_MAP[purpose]) {
    case 'Registration':
      await authService.resendRegistrationOtp({ email });
      break;
  }
  res.status(200).json({
    message: 'A new verification code has been sent to your email',
    code: 'OTP_SENT',
  });
});

const forgotPasswordSchema = z.object({ email: emailField }).strict();

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword({ email });
  res.status(200).json({ message: 'A reset code has been sent to your email', code: 'OTP_SENT' });
});

const resetPasswordSchema = z
  .object({
    email: emailField,
    otp: z.string({
      required_error: 'OTP is required',
      invalid_type_error: 'OTP must be a string',
    }),
    newPassword: z.string({
      required_error: 'New password is required',
      invalid_type_error: 'New password must be a string',
    }),
  })
  .strict();

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = resetPasswordSchema.parse(req.body);
  await authService.resetPassword({ email, otp, newPassword });
  res.status(200).json({
    message: 'Password reset successful. Please log in with your new password.',
    code: 'PASSWORD_RESET_SUCCESS',
  });
});
