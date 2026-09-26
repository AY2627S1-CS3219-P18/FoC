// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-26
// 26/09/2026: Stage 7 - HTTP-level fixtures (register, activate, login)
// Author review:
import request from 'supertest';
import app from '../../src/app.js';
import { getUserByEmail } from './db.js';
import { latestOtpFor } from './email.js';
import { PASSWORD } from './constants.js';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
}

export function userInput(n: number | string = 1, password = PASSWORD) {
  return { username: `user${n}`, email: `user${n}@example.com`, password };
}

// Registers through the API and leaves the account pending.
export async function registerPending(
  n: number | string = 1,
  password = PASSWORD,
): Promise<TestUser> {
  const input = userInput(n, password);
  const res = await request(app).post('/auth/register').send(input);
  if (res.status !== 201)
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const row = (await getUserByEmail(input.email))!;
  return { id: row.id, ...input };
}

// Registers and verifies the OTP, so the account is active.
export async function createActiveUser(
  n: number | string = 1,
  password = PASSWORD,
): Promise<TestUser> {
  const user = await registerPending(n, password);
  const res = await request(app)
    .post('/auth/verify-otp')
    .send({ email: user.email, otp: latestOtpFor(user.email), purpose: 'registration' });
  if (res.status !== 200)
    throw new Error(`verify failed: ${res.status} ${JSON.stringify(res.body)}`);
  return user;
}

export async function loginUser(user: TestUser, password = user.password) {
  return request(app).post('/auth/login').send({ identifier: user.email, password });
}

// Logs in and returns the tokens plus the raw refresh cookie value.
export async function loginTokens(
  user: TestUser,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await loginUser(user);
  if (res.status !== 200)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { accessToken: res.body.accessToken, refreshToken: cookieValue(res, 'refreshToken')! };
}

export function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((c) => c.startsWith(`${name}=`));
  return found?.split(';')[0]?.slice(name.length + 1);
}

export function refreshCookie(token: string): string {
  return `refreshToken=${token}`;
}
