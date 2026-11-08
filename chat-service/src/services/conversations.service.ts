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
export async function listConversations(
  prisma: PrismaClient,
  userId: string,
  input: ListInput,
) {
  const participant = { userId, ...(input.role ? { role: input.role } : {}) };
  const rows = await prisma.conversation.findMany({
    where: {
      participants: { some: participant },
      ...(input.status ? { status: input.status } : {}),
      ...(input.cursor
        ? {
            OR: [
              { updatedAt: { lt: new Date(input.cursor.updatedAt) } },
              {
                updatedAt: new Date(input.cursor.updatedAt),
                conversationId: { lt: input.cursor.id },
              },
            ],
          }
        : {}),
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
  const conversations = await Promise.all(
    page.map(async (row) => {
      const readId = row.participants[0]!.lastReadMessageId;
      const read =
        readId === null
          ? null
          : await prisma.message.findFirstOrThrow({
              where: { id: readId, chatId: row.conversationId },
              select: { createdAt: true, id: true },
            });
      const unreadCount = await prisma.message.count({
        where: {
          chatId: row.conversationId,
          // SQL NOT alone excludes NULL senders; include system messages explicitly.
          AND: [
            { OR: [{ senderId: null }, { senderId: { not: userId } }] },
            ...(read
              ? [
                  {
                    OR: [
                      { createdAt: { gt: read.createdAt } },
                      { createdAt: read.createdAt, id: { gt: read.id } },
                    ],
                  },
                ]
              : []),
          ],
        },
      });
      const last = row.messages[0];
      return {
        id: row.conversationId,
        orderId: row.orderId,
        lastMessage: last
          ? {
              content: last.content,
              type: last.type,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        unreadCount,
        updatedAt: row.updatedAt.toISOString(),
      };
    }),
  );
  const last = page.at(-1);
  return {
    conversations,
    nextCursor:
      hasMore && last
        ? {
            updatedAt: last.updatedAt.toISOString(),
            id: last.conversationId,
          }
        : null,
    hasMore,
  };
}

// AI-generated (edited by <name>).
export async function getConversationDetails(
  prisma: PrismaClient,
  conversationId: string,
  userId: string,
) {
  const conversation = await prisma.conversation.findUnique({
    where: { conversationId },
    select: {
      conversationId: true,
      orderId: true,
      status: true,
      title: true,
      participants: { select: { userId: true, role: true, joinedAt: true } },
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!conversation) return null;
  // Revoked participants retain access to conversation details.
  if (
    !conversation.participants.some(
      (participant) => participant.userId === userId,
    )
  )
    return false;
  return {
    ...conversation,
    participants: conversation.participants.map((participant) => ({
      ...participant,
      joinedAt: participant.joinedAt.toISOString(),
    })),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

// AI-generated (edited by <name>).
export async function listMessages(
  prisma: PrismaClient,
  conversationId: string,
  userId: string,
  input: { limit: number; cursor?: { createdAt: string; id: string } },
) {
  const conversation = await prisma.conversation.findUnique({
    where: { conversationId },
    select: { participants: { select: { userId: true } } },
  });
  if (!conversation) return null;
  if (!conversation.participants.some((p) => p.userId === userId)) return false;
  const rows = await prisma.message.findMany({
    where: {
      chatId: conversationId,
      ...(input.cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(input.cursor.createdAt) } },
              {
                createdAt: new Date(input.cursor.createdAt),
                id: { lt: input.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    select: {
      id: true,
      chatId: true,
      senderId: true,
      type: true,
      content: true,
      metadata: true,
      createdAt: true,
    },
  });
  const hasMore = rows.length > input.limit;
  const page = rows.slice(0, input.limit);
  const last = page.at(-1);
  return {
    data: page.map((row) => ({
      messageId: row.id,
      conversationId: row.chatId,
      senderId: row.senderId,
      type: row.type,
      content: row.content,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
    })),
    pagination: {
      nextCursor:
        hasMore && last
          ? { createdAt: last.createdAt.toISOString(), id: last.id }
          : null,
      hasMore,
    },
  };
}
