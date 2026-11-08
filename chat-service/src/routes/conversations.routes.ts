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
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented the team-specified read receipt endpoint.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented the team-specified participant addition endpoint.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented the team-specified system notification endpoint.
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
  postSystemNotification,
  postParticipant,
  postRead,
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
  publishRead?: import("../realtime/messages.js").ReadPublisher,
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
  // AI-generated (edited by <name>).
  router.post(
    "/:conversationID/read",
    createAuthenticate(userServiceUrl, verifyToken),
    postRead(prisma, publishRead),
  );
  // AI-generated (edited by <name>).
  router.post(
    "/:conversationID/participants",
    authenticateMessage(apiKey, userServiceUrl, verifyToken),
    (req, res, next) => {
      if (req.user) {
        res.sendStatus(403);
        return;
      }
      next();
    },
    postParticipant(prisma),
  );
  router.post("/", authenticateService(apiKey), postConversation(prisma));
  return router;
}

// AI-generated (edited by <name>).
export function systemNotificationsRouter(
  prisma: PrismaClient,
  apiKey: string,
  userServiceUrl: string,
  verifyToken?: TokenVerifier,
  publish?: MessagePublisher,
) {
  const router = Router();
  router.post(
    "/send-system-notification",
    authenticateMessage(apiKey, userServiceUrl, verifyToken),
    (req, res, next) => {
      if (req.user) {
        res.sendStatus(403);
        return;
      }
      next();
    },
    postSystemNotification(prisma, publish),
  );
  return router;
}
