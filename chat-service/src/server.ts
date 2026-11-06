/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-07
 * Scope: Implemented the team-specified chat creation endpoint and supporting scaffold.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */
import "dotenv/config";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createPrismaClient } from "./db/prisma.js";
const env = loadEnv();
const prisma = createPrismaClient(env.DATABASE_URL);
const server = createApp({ prisma, apiKey: env.CHAT_SERVICE_API_KEY }).listen(
  env.PORT,
  () => console.log(`chat-service listening on :${env.PORT}`),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();
  server.close(() => {
    void prisma.$disconnect().finally(() => {
      clearTimeout(timer);
    });
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
