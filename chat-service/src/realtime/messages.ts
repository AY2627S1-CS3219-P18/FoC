/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-08
 * Scope: Implemented the team-specified message sending and realtime delivery.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */
import type { Server } from "socket.io";
import type { sendMessage } from "../services/conversations.service.js";
export type SentMessage = NonNullable<
  Awaited<ReturnType<typeof sendMessage>>["message"]
>;
export type MessagePublisher = (
  message: SentMessage,
  userIds: string[],
) => void;
export function createMessagePublisher(io: Server): MessagePublisher {
  return (message, userIds) => {
    // One union broadcast delivers once even when a socket belongs to several rooms.
    io.to([
      `chat:${message.conversationId}`,
      ...userIds.map((id) => `user:${id}`),
    ]).emit("message:sent", message);
  };
}
