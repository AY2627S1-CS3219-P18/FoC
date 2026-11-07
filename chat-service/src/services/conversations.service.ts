/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-07
 * Scope: Implemented the team-specified chat creation endpoint and supporting scaffold.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented conversation listing.
 * Author review:
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

// AI-generated (edited by <name>).
export interface ListInput {
  limit: number;
  cursor?: { updatedAt: string; id: string };
  status?: "ACTIVE" | "ARCHIVED";
  role?: "COURIER" | "REQUESTER";
}
export async function listConversations(prisma: PrismaClient, userId: string, input: ListInput) {
  const participant = { userId, ...(input.role ? { role: input.role } : {}) };
  const rows = await prisma.conversation.findMany({
    where: {
      participants: { some: participant },
      ...(input.status ? { status: input.status } : {}),
      ...(input.cursor ? { OR: [
        { updatedAt: { lt: new Date(input.cursor.updatedAt) } },
        { updatedAt: new Date(input.cursor.updatedAt), conversationId: { lt: input.cursor.id } },
      ] } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { conversationId: "desc" }],
    take: input.limit + 1,
    include: {
      participants: { where: { userId } },
      messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
    },
  });
  const hasMore = rows.length > input.limit;
  const page = rows.slice(0, input.limit);
  const conversations = await Promise.all(page.map(async (row) => {
    const readId = row.participants[0]!.lastReadMessageId;
    const read = readId === null ? null : await prisma.message.findFirstOrThrow({
      where: { id: readId, chatId: row.conversationId },
      select: { createdAt: true, id: true },
    });
    const unreadCount = await prisma.message.count({ where: {
      chatId: row.conversationId,
      // SQL NOT alone excludes NULL senders; include system messages explicitly.
      AND: [
        { OR: [{ senderId: null }, { senderId: { not: userId } }] },
        ...(read ? [{ OR: [
          { createdAt: { gt: read.createdAt } },
          { createdAt: read.createdAt, id: { gt: read.id } },
        ] }] : []),
      ],
    } });
    const last = row.messages[0];
    return {
      id: row.conversationId, orderId: row.orderId,
      lastMessage: last ? { content: last.content, type: last.type, createdAt: last.createdAt.toISOString() } : null,
      unreadCount, updatedAt: row.updatedAt.toISOString(),
    };
  }));
  const last = page.at(-1);
  return { conversations, nextCursor: hasMore && last ? {
    updatedAt: last.updatedAt.toISOString(), id: last.conversationId,
  } : null, hasMore };
}
