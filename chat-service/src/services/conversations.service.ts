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
 * Scope (2026-11-08, Codex, model: GPT-6): Enforced the supplied requester and active courier limits.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented the team-specified system notification endpoint.
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

// AI-generated
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

// AI-generated (edited by <name>).
export async function sendMessage(
  prisma: PrismaClient,
  conversationId: string,
  senderId: string | null,
  validate: () => { type: "TEXT" | "SYSTEM"; content: string } | 400 | 422,
) {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.findUnique({
      where: { conversationId },
      select: {
        status: true,
        participants: { select: { userId: true, revokedAt: true } },
      },
    });
    if (!conversation) return { status: 404 as const };
    const participant = conversation.participants.find(
      (p) => p.userId === senderId,
    );
    if (senderId !== null && !participant) return { status: 403 as const };
    const input = validate();
    if (typeof input === "number") return { status: input };
    if (
      conversation.status !== "ACTIVE" ||
      (senderId !== null && participant!.revokedAt !== null)
    )
      return { status: 409 as const };
    const now = new Date();
    const row = await tx.message.create({
      data: {
        chatId: conversationId,
        senderId,
        type: input.type,
        content: input.content,
        createdAt: now,
      },
    });
    await tx.conversation.update({
      where: { conversationId },
      data: { updatedAt: now },
    });
    return {
      status: 201 as const,
      message: {
        messageId: row.id,
        conversationId: row.chatId,
        senderId: row.senderId,
        type: row.type,
        content: row.content,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      },
      userIds: conversation.participants
        .filter((p) => p.revokedAt === null)
        .map((p) => p.userId),
    };
  });
}

// AI-generated (edited by <name>).
export async function markConversationRead(
  prisma: PrismaClient,
  conversationId: string,
  userId: string,
  lastReadMessageId: string,
) {
  // Compare-and-set retries prevent concurrent requests from moving the cursor backwards.
  for (;;) {
    const conversation = await prisma.conversation.findUnique({
      where: { conversationId },
      include: { participants: true },
    });
    if (!conversation) return { status: 404 as const };
    const participant = conversation.participants.find(
      (p) => p.userId === userId,
    );
    if (!participant) return { status: 403 as const };
    if (participant.revokedAt !== null) return { status: 409 as const };
    const target = await prisma.message.findUnique({
      where: { id: lastReadMessageId },
    });
    if (!target) return { status: 404 as const };
    if (target.chatId !== conversationId) return { status: 400 as const };
    const currentId = participant.lastReadMessageId;
    const currentIsLater =
      currentId && currentId !== target.id
        ? await prisma.message.findFirst({
            where: {
              id: currentId,
              chatId: conversationId,
              OR: [
                { createdAt: { gt: target.createdAt } },
                { createdAt: target.createdAt, id: { gt: target.id } },
              ],
            },
          })
        : null;
    const retainedId = currentIsLater ? currentId! : target.id;
    const updated = await prisma.chatParticipant.updateMany({
      where: {
        id: participant.id,
        lastReadMessageId: currentId,
        revokedAt: null,
      },
      data: { lastReadMessageId: retainedId },
    });
    if (updated.count === 0) continue;
    return {
      status: 200 as const,
      receipt: { conversationId, userId, lastReadMessageId: retainedId },
    };
  }
}

// AI-generated
export async function addParticipant(
  prisma: PrismaClient,
  conversationId: string,
  input: { userId: string; role: "COURIER" | "REQUESTER" },
) {
  return prisma.$transaction(async (tx) => {
    // Serialize additions on this conversation before checking existing membership.
    const locked = await tx.conversation.updateMany({
      where: { conversationId, status: "ACTIVE" },
      data: { conversationId },
    });
    const conversation = await tx.conversation.findUnique({
      where: { conversationId },
      select: {
        participants: {
          where: {
            OR: [
              { userId: input.userId },
              input.role === "REQUESTER"
                ? { role: "REQUESTER" }
                : { role: "COURIER", revokedAt: null },
            ],
          },
          select: { id: true },
        },
      },
    });
    if (!conversation) return { status: 404 as const };
    if (locked.count === 0 || conversation.participants.length > 0)
      return { status: 409 as const };
    const row = await tx.chatParticipant.create({
      data: { chatId: conversationId, userId: input.userId, role: input.role },
    });
    return {
      status: 200 as const,
      participant: {
        conversationParticipantId: row.id,
        conversationId: row.chatId,
        userId: row.userId,
        joinedAt: row.joinedAt.toISOString(),
        role: row.role,
      },
    };
  });
}

// AI-generated
export async function sendSystemNotification(
  prisma: PrismaClient,
  input: { orderId: string; message: string },
) {
  const conversation = await prisma.conversation.findUnique({
    where: { orderId: input.orderId },
    select: { conversationId: true },
  });
  if (!conversation) return { status: 404 as const };
  return sendMessage(prisma, conversation.conversationId, null, () => ({
    type: "SYSTEM",
    content: input.message,
  }));
}
