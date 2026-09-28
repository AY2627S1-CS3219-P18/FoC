// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-26
// 26/09/2026: Stage 7 - per-file env, throwaway JWT keys, email mock, pool cleanup
// Author review:
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { afterAll, vi } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: resolve(root, '.env.test') });

// Throwaway RS256 key pair, so tests do not depend on the gitignored keys/ folder.
const keyDir = join(tmpdir(), 'foc-user-service-test-keys');
const privatePath = join(keyDir, 'private.pem');
const publicPath = join(keyDir, 'public.pem');
if (!existsSync(privatePath) || !existsSync(publicPath)) {
  mkdirSync(keyDir, { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  writeFileSync(privatePath, privateKey);
  writeFileSync(publicPath, publicKey);
}
process.env.JWT_PRIVATE_KEY_PATH = privatePath;
process.env.JWT_PUBLIC_KEY_PATH = publicPath;

// Email is mocked for every file (OTP capture and forced failures). email.service.test.ts
// loads the real module with vi.importActual.
vi.mock('../../src/services/email.service.js', () => ({
  sendOtpEmail: vi.fn(async () => {}),
}));

afterAll(async () => {
  const { default: pool } = await import('../../src/db/pool.js');
  await pool.end();
});
