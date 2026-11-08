/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-07
 * Scope: Implemented the team-specified chat creation endpoint and supporting scaffold.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented conversation listing.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented the team-specified conversation details endpoint.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented the team-specified message listing endpoint.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented the team-specified message sending and realtime delivery.
 * Author review: tng wen xi
 */
import { authenticateMessage } from "../middleware/authenticate-message.js";
import type { MessagePublisher } from "../realtime/messages.js";
import { Router } from "express";
import type { PrismaClient } from "../db/prisma.js";
import { authenticateService } from "../middleware/authenticate-service.js";
import {
  createAuthenticate,
  type TokenVerifier,
} from "../middleware/authenticate.js";
import {
  postMessage,
  getConversation,
  getMessages,
  getConversations,
  postConversation,
} from "../controllers/conversations.controller.js";
export function conversationsRouter(
  prisma: PrismaClient,
  apiKey: string,
  userServiceUrl: string,
  verifyToken?: TokenVerifier,
  publish?: MessagePublisher,
) {
  const router = Router();
  router.get(
    "/",
    createAuthenticate(userServiceUrl, verifyToken),
    getConversations(prisma),
  );
  // AI-generated
  router.get(
    "/:conversationID",
    createAuthenticate(userServiceUrl, verifyToken),
    getConversation(prisma),
  );
  // AI-generated
  router.get(
    "/:conversationID/messages",
    createAuthenticate(userServiceUrl, verifyToken),
    getMessages(prisma),
  );
  // AI-generated (edited by <name>).
  router.post(
    "/:conversationID/messages",
    authenticateMessage(apiKey, userServiceUrl, verifyToken),
    postMessage(prisma, publish),
  );
  router.post("/", authenticateService(apiKey), postConversation(prisma));
  return router;
}
