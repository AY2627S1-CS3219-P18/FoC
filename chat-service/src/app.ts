/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-07
 * Scope: Implemented the team-specified chat creation endpoint and supporting scaffold.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */
import express from "express";
import type { PrismaClient } from "./db/prisma.js";
import { conversationsRouter } from "./routes/conversations.routes.js";
export function createApp({
  prisma,
  apiKey,
}: {
  prisma: PrismaClient;
  apiKey: string;
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use("/chat/conversations", conversationsRouter(prisma, apiKey));
  return app;
}
