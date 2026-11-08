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
 */
import type { TokenVerifier } from "./middleware/authenticate.js";
import express from "express";
import type { PrismaClient } from "./db/prisma.js";
import { conversationsRouter } from "./routes/conversations.routes.js";
export function createApp({
  prisma,
  apiKey,
  userServiceUrl = "http://user-service:3001",
  verifyToken,
  publish,
}: {
  prisma: PrismaClient;
  apiKey: string;
  userServiceUrl?: string;
  verifyToken?: TokenVerifier;
  publish?: import("./realtime/messages.js").MessagePublisher;
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use(
    "/chat/conversations",
    conversationsRouter(prisma, apiKey, userServiceUrl, verifyToken, publish),
  );
  return app;
}
