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
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented the team-specified system notification endpoint.
 * Author review: tng wen xi
 */
import type { TokenVerifier } from "./middleware/authenticate.js";
import express from "express";
import type { PrismaClient } from "./db/prisma.js";
import {
  conversationsRouter,
  systemNotificationsRouter,
} from "./routes/conversations.routes.js";
export function createApp({
  prisma,
  apiKey,
  userServiceUrl = "http://user-service:3001",
  verifyToken,
  publish,
  publishRead,
}: {
  prisma: PrismaClient;
  apiKey: string;
  userServiceUrl?: string;
  verifyToken?: TokenVerifier;
  publishRead?: import("./realtime/messages.js").ReadPublisher;
  publish?: import("./realtime/messages.js").MessagePublisher;
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use(
    "/chat/conversations",
    conversationsRouter(
      prisma,
      apiKey,
      userServiceUrl,
      verifyToken,
      publish,
      publishRead,
    ),
  );
  // AI-generated (edited by <name>).
  app.use(
    "/chat",
    systemNotificationsRouter(
      prisma,
      apiKey,
      userServiceUrl,
      verifyToken,
      publish,
    ),
  );
  return app;
}
