/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-07
 * Scope: Implemented the team-specified chat creation endpoint and supporting scaffold.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented conversation listing.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented the team-specified message sending and realtime delivery.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented the team-specified read receipt endpoint.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented team-specified chat room subscriptions and realtime frontend updates.
 * Author review: tng wen xi
 */
import "dotenv/config";
import { createServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { createApp } from "./app.js";
import { loadEnv, redisConnectionOptions } from "./config/env.js";
import { createPrismaClient } from "./db/prisma.js";
import { createTokenVerifier } from "./middleware/authenticate.js";
import { createSocketServer } from "./realtime/socket-server.js";
import {
  createReadPublisher,
  createMessagePublisher,
} from "./realtime/messages.js";
// AI-generated (edited by <name>).
const env = loadEnv();
const prisma = createPrismaClient(env.DATABASE_URL);
const verifyToken = createTokenVerifier(env.USER_SERVICE_URL);
const adapterPub = new Redis(redisConnectionOptions(env));
const adapterSub = adapterPub.duplicate();
const server = createServer();
const io = createSocketServer(server, { verifyToken, prisma });
io.adapter(createAdapter(adapterPub, adapterSub, { key: "chat-socket.io" }));
server.on(
  "request",
  createApp({
    prisma,
    apiKey: env.CHAT_SERVICE_API_KEY,
    userServiceUrl: env.USER_SERVICE_URL,
    verifyToken,
    publish: createMessagePublisher(io),
    publishRead: createReadPublisher(io),
  }),
);
server.listen(env.PORT, () =>
  console.log(`chat-service listening on :${env.PORT}`),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();
  void io.close(() => {
    adapterPub.disconnect();
    adapterSub.disconnect();
    void prisma.$disconnect().finally(() => clearTimeout(timer));
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
