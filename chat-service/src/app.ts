/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-07
 * Scope: Implemented the team-specified chat creation endpoint and supporting scaffold.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented conversation listing.
 * Author review:
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
}: {
  prisma: PrismaClient;
  apiKey: string;
  userServiceUrl?: string;
  verifyToken?: TokenVerifier;
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use("/chat/conversations", conversationsRouter(prisma, apiKey, userServiceUrl, verifyToken));
  return app;
}
