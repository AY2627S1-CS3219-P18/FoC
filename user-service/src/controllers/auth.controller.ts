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

import { z } from 'zod';
import { config } from '../config.js';
import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { REFRESH_COOKIE_OPTIONS } from '../utils/cookies.js';
import { verifyAccessToken } from '../utils/jwt.js';

const registerSchema = z
  .object({
    username: z.string({
      required_error: 'Username is required',
      invalid_type_error: 'Username must be a string',
    }),
    email: z.string({
      required_error: 'Email is required',
      invalid_type_error: 'Email must be a string',
    }),
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
    identifier: z.string({
      required_error: 'Username/Email is required',
      invalid_type_error: 'Username/Email must be a string',
    }),
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
