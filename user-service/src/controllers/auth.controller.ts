// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4b - registration controller
// Author review:
// 25/09/2026: Stage 4c - login controller
// Author review:

import { z } from 'zod';
import { config } from '../config.js';
import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { REFRESH_COOKIE_OPTIONS } from '../utils/cookies.js';

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
  res.status(201).json({ message: 'User registered successfully', code: 'REGISTER_SUCCESS' });
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
