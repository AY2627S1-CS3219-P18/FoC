/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-07
 * Scope: Implemented the team-specified chat creation endpoint and supporting scaffold.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */
import { Router } from "express";
import type { PrismaClient } from "../db/prisma.js";
import { authenticateService } from "../middleware/authenticate-service.js";
import { postConversation } from "../controllers/conversations.controller.js";
export function conversationsRouter(prisma: PrismaClient, apiKey: string) {
  const router = Router();
  router.post("/", authenticateService(apiKey), postConversation(prisma));
  return router;
}
