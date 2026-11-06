/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-07
 * Scope: Implemented the team-specified chat creation endpoint and supporting scaffold.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */
import type { PrismaClient } from "../db/prisma.js";
export interface CreationInput {
  orderId: string;
  requesterId: string;
  orderDescription: string;
}
export async function createConversation(
  prisma: PrismaClient,
  input: CreationInput,
) {
  const find = () =>
    prisma.conversation.findUnique({
      where: { orderId: input.orderId },
      include: { participants: true },
    });
  const existingResult = (
    row: NonNullable<Awaited<ReturnType<typeof find>>>,
  ) => ({
    conflict:
      row.title !== input.orderDescription ||
      !row.participants.some(
        (p) => p.role === "REQUESTER" && p.userId === input.requesterId,
      ),
    created: false,
    conversation: row,
  });
  const existing = await find();
  if (existing) return existingResult(existing);
  try {
    // A nested Prisma write commits the conversation and requester together.
    const now = new Date();
    const conversation = await prisma.conversation.create({
      data: {
        orderId: input.orderId,
        title: input.orderDescription,
        createdAt: now,
        updatedAt: now,
        participants: {
          create: {
            userId: input.requesterId,
            role: "REQUESTER",
            joinedAt: now,
          },
        },
      },
      include: { participants: true },
    });
    return { conflict: false, created: true, conversation };
  } catch (error) {
    // Concurrent identical requests may race on the unique orderId constraint.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const winner = await find();
      if (winner) return existingResult(winner);
    }
    throw error;
  }
}
