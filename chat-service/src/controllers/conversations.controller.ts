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
 */
import type { RequestHandler } from "express";
import { z } from "zod";
import type { PrismaClient } from "../db/prisma.js";
import {
  addParticipant,
  markConversationRead,
  sendMessage,
  listConversations,
  listMessages,
  getConversationDetails,
  createConversation,
} from "../services/conversations.service.js";
const bodySchema = z.object({
  orderId: z.uuid(),
  requesterId: z.uuid(),
  orderDescription: z
    .string()
    .refine(
      (value) => value.trim().length > 0,
      "orderDescription must not be empty",
    ),
});
export function postConversation(prisma: PrismaClient): RequestHandler {
  return async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid conversation creation request",
          details: parsed.error.issues.map((issue) => {
            const field = String(issue.path[0] ?? "body");
            return {
              field,
              message:
                req.body?.[field] === undefined
                  ? `${field} is required`
                  : issue.message,
            };
          }),
        },
      });
      return;
    }
    const result = await createConversation(prisma, parsed.data);
    if (result.conflict) {
      res.status(409).json({
        success: false,
        error: {
          code: "ORDER_ID_CONFLICT",
          message:
            "A conversation already exists for this order with different creation details",
        },
      });
      return;
    }
    const row = result.conversation;
    res.status(result.created ? 201 : 200).json({
      success: true,
      data: {
        conversationId: row.conversationId,
        orderId: row.orderId,
        title: row.title,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      },
    });
  };
}

// AI-generated (edited by <name>).
const cursorSchema = z
  .object({ updatedAt: z.iso.datetime(), id: z.uuid() })
  .strict();
const querySchema = z
  .object({
    limit: z
      .string()
      .regex(/^[0-9]+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(50))
      .default(20),
    cursor: z
      .string()
      .min(1)
      .transform((value, ctx) => {
        try {
          // Reject malformed base64 rather than relying on Buffer's permissive decoder.
          if (
            !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
              value,
            )
          )
            throw new Error();
          return cursorSchema.parse(
            JSON.parse(Buffer.from(value, "base64").toString("utf8")),
          );
        } catch {
          ctx.addIssue({ code: "custom", message: "Invalid cursor" });
          return z.NEVER;
        }
      })
      .optional(),
    status: z
      .enum(["active", "archived"])
      .transform((v) =>
        v === "active" ? ("ACTIVE" as const) : ("ARCHIVED" as const),
      )
      .optional(),
    role: z
      .enum(["courier", "requester"])
      .transform((v) =>
        v === "courier" ? ("COURIER" as const) : ("REQUESTER" as const),
      )
      .optional(),
  })
  .strict();
export function getConversations(prisma: PrismaClient): RequestHandler {
  return async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid conversation query parameters",
        code: "VALIDATION_ERROR",
      });
      return;
    }
    try {
      res
        .status(200)
        .json(await listConversations(prisma, req.user!.user_id, parsed.data));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
}

// AI-generated (edited by <name>).
export function getConversation(prisma: PrismaClient): RequestHandler {
  return async (req, res) => {
    const parsed = z.uuid().safeParse(req.params.conversationID);
    if (!parsed.success) {
      res.sendStatus(400);
      return;
    }
    try {
      const result = await getConversationDetails(
        prisma,
        parsed.data,
        req.user!.user_id,
      );
      if (result === null) {
        res.sendStatus(404);
        return;
      }
      if (result === false) {
        res.sendStatus(403);
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
}

// AI-generated (edited by <name>).
const messageCursorSchema = z
  .object({ createdAt: z.iso.datetime(), id: z.uuid() })
  .strict();
const messageQuerySchema = z
  .object({
    limit: z
      .string()
      .regex(/^[0-9]+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(50))
      .default(20),
    cursor: z
      .string()
      .min(1)
      .transform((value, ctx) => {
        try {
          // Reject malformed base64 rather than relying on Buffer's permissive decoder.
          if (
            !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
              value,
            )
          )
            throw new Error();
          return messageCursorSchema.parse(
            JSON.parse(Buffer.from(value, "base64").toString("utf8")),
          );
        } catch {
          ctx.addIssue({ code: "custom", message: "Invalid cursor" });
          return z.NEVER;
        }
      })
      .optional(),
  })
  .strict();

export function getMessages(prisma: PrismaClient): RequestHandler {
  return async (req, res) => {
    const id = z.uuid().safeParse(req.params.conversationID);
    const query = messageQuerySchema.safeParse(req.query);
    if (!id.success || !query.success) {
      res.sendStatus(400);
      return;
    }
    try {
      const result = await listMessages(
        prisma,
        id.data,
        req.user!.user_id,
        query.data,
      );
      if (result === null) {
        res.sendStatus(404);
        return;
      }
      if (result === false) {
        res.sendStatus(403);
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
}

// AI-generated (edited by <name>).
const sendMessageSchema = z.object({
  type: z.literal("TEXT"),
  content: z.string().refine((value) => value.trim().length > 0),
});
export function postMessage(
  prisma: PrismaClient,
  publish?: import("../realtime/messages.js").MessagePublisher,
): RequestHandler {
  return async (req, res) => {
    const id = z.uuid().safeParse(req.params.conversationID);
    if (!id.success) {
      res.sendStatus(400);
      return;
    }
    try {
      const result = await sendMessage(
        prisma,
        id.data,
        req.user?.user_id ?? null,
        () => {
          if (req.user && req.body?.type === "SYSTEM") return 422;
          const parsed = sendMessageSchema.safeParse(req.body);
          return parsed.success ? parsed.data : 400;
        },
      );
      if (result.status !== 201) {
        res.sendStatus(result.status);
        return;
      }
      // The transaction has committed before any socket can receive this message.
      try {
        publish?.(result.message!, result.userIds!);
      } catch (error) {
        console.error(error);
      }
      res.status(201).json(result.message);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
}

// AI-generated (edited by <name>).
export function postRead(
  prisma: PrismaClient,
  publishRead?: import("../realtime/messages.js").ReadPublisher,
): RequestHandler {
  return async (req, res) => {
    const id = z.uuid().safeParse(req.params.conversationID);
    const body = z.object({ lastReadMessageId: z.uuid() }).safeParse(req.body);
    if (!id.success || !body.success) {
      res.sendStatus(400);
      return;
    }
    try {
      const result = await markConversationRead(
        prisma,
        id.data,
        req.user!.user_id,
        body.data.lastReadMessageId,
      );
      if (result.status !== 200) {
        res.sendStatus(result.status);
        return;
      }
      try {
        publishRead?.(result.receipt!);
      } catch (error) {
        console.error(error);
      }
      res.status(200).json(result.receipt);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
}

// AI-generated (edited by <name>).
export function postParticipant(prisma: PrismaClient): RequestHandler {
  return async (req, res) => {
    const id = z.uuid().safeParse(req.params.conversationID);
    const body = z
      .object({
        userId: z.uuid(),
        role: z.enum(["COURIER", "REQUESTER"]),
      })
      .safeParse(req.body);
    if (!id.success || !body.success) {
      res.sendStatus(400);
      return;
    }
    try {
      const result = await addParticipant(prisma, id.data, body.data);
      if (result.status !== 200) {
        res.sendStatus(result.status);
        return;
      }
      res.status(200).json(result.participant);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
}
