/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-07
 * Scope: Implemented the team-specified chat creation endpoint and supporting scaffold.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */
import type { RequestHandler } from "express";
import { z } from "zod";
import type { PrismaClient } from "../db/prisma.js";
import { createConversation } from "../services/conversations.service.js";
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
      res
        .status(409)
        .json({
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
