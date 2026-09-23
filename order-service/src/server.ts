/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-09-23
 * Scope: Project scaffolding / infrastructure only. No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review: <pending — team member to sign>
 */

import { config as loadDotenv } from 'dotenv';
import { createApp } from './app.js';
import { loadEnv, type Env } from './config/env.js';
import { createPrismaClient } from './db/prisma.js';

// Local runs read order-service/.env; in Docker, compose injects the env.
loadDotenv({ quiet: true });

let env: Env;
try {
  env = loadEnv();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
const prisma = createPrismaClient(env.DATABASE_URL);
const app = createApp({ prisma });

const server = app.listen(env.PORT, (err) => {
  if (err) throw err;
  console.log(`order-service listening on :${env.PORT} (${env.NODE_ENV})`);
});

// Graceful shutdown on `docker stop` (SIGTERM) / Ctrl+C (SIGINT).
let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close((err) => {
    void prisma.$disconnect().finally(() => process.exit(err ? 1 : 0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
