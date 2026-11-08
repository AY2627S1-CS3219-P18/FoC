/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope: Issue #4 - outbox task builders and task -> queue routing. Mirrors
 *        supplier-service's src/queue/tasks.ts (SupplierServiceArchitecture.md §8.1):
 *        `queue:<group>:<name>` keys, snake_case task names, one map from task name to
 *        queue. Reserve and release share one order-side queue (George, 2026-10-20);
 *        payloads are camelCase (George, 2026-10-20) and carry exactly what
 *        credit-service/API.md's reserve and release bodies take. The queue key and
 *        task names are derived from supplier-service's convention.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Scope (2026-10-21): Credit transfer - `credit_transfer` tasks with payload
 *        { requestId, courierId } relay to `queue:credit:transfer` (contract agreed with
 *        Wee Jean, 2026-10-20).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented or tested the team-specified order chat delivery and message ID deduplication.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented team-specified status notifications and username fallback.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented or tested team-specified order-based courier participant delivery.
 * Author review:
 */

import { randomUUID } from 'node:crypto';

/** What a write transaction hands to the outbox: a task name and its payload. */
export interface OutboxTask {
  taskName: string;
  payload: unknown;
}

/** Order-side queue for the credit calls the worker makes over HTTP. */
export const CREDIT_QUEUE_KEY = 'queue:order:credit';

export const CHAT_PARTICIPANT_TASK = 'chat_participant';
export interface ChatParticipantPayload {
  orderId: string;
  userId: string;
  role: 'COURIER';
}
export function buildChatParticipantTask(
  orderId: string,
  userId: string,
): OutboxTask {
  return {
    taskName: CHAT_PARTICIPANT_TASK,
    payload: { orderId, userId, role: 'COURIER' },
  };
}

export const CHAT_CREATE_TASK = 'chat_create';
export const CHAT_NOTIFICATION_TASK = 'chat_notification';

export const CREDIT_RESERVE_TASK = 'credit_reserve';
export const CREDIT_RELEASE_TASK = 'credit_release';

export interface CreditReservePayload {
  requestId: string; // the order id
  userId: string; // the requester
  amount: number;
}

export interface CreditReleasePayload {
  requestId: string; // the order id
}

export function buildReserveTask(payload: CreditReservePayload): OutboxTask {
  return { taskName: CREDIT_RESERVE_TASK, payload };
}

export function buildReleaseTask(requestId: string): OutboxTask {
  return { taskName: CREDIT_RELEASE_TASK, payload: { requestId } };
}

/** credit-service's queue for transfers on completion; consumed by credit-service only. */
export const CREDIT_TRANSFER_QUEUE_KEY = 'queue:credit:transfer';
export const CREDIT_TRANSFER_TASK = 'credit_transfer';

/** Same fields as POST /credits/transfer; amount and requester come from the reservation. */
export interface CreditTransferPayload {
  requestId: string; // the order id
  courierId: string;
}

export function buildTransferTask(payload: CreditTransferPayload): OutboxTask {
  return { taskName: CREDIT_TRANSFER_TASK, payload };
}

const QUEUE_KEY_BY_TASK = new Map<string, string>([
  [CHAT_CREATE_TASK, CREDIT_QUEUE_KEY],
  [CHAT_PARTICIPANT_TASK, CREDIT_QUEUE_KEY],
  [CHAT_NOTIFICATION_TASK, CREDIT_QUEUE_KEY],
  [CREDIT_RESERVE_TASK, CREDIT_QUEUE_KEY],
  [CREDIT_RELEASE_TASK, CREDIT_QUEUE_KEY],
  [CREDIT_TRANSFER_TASK, CREDIT_TRANSFER_QUEUE_KEY],
]);

/** The queue a task is relayed to, or undefined for an unknown task name. */
export function queueKeyForTask(taskName: string): string | undefined {
  return QUEUE_KEY_BY_TASK.get(taskName);
}

export function isReservePayload(p: unknown): p is CreditReservePayload {
  const v = p as Partial<CreditReservePayload> | null;
  return (
    typeof v?.requestId === 'string' &&
    typeof v.userId === 'string' &&
    Number.isInteger(v.amount)
  );
}

export function isReleasePayload(p: unknown): p is CreditReleasePayload {
  return (
    typeof (p as Partial<CreditReleasePayload> | null)?.requestId === 'string'
  );
}

// AI-generated (edited by <name>).
export interface ChatCreatePayload {
  orderId: string;
  requesterId: string;
  orderDescription: string;
  messageId: string;
}
export function buildChatCreateTask(order: {
  id: string;
  requesterId: string;
  description: string;
}): OutboxTask {
  return {
    taskName: CHAT_CREATE_TASK,
    payload: {
      orderId: order.id,
      requesterId: order.requesterId,
      orderDescription: order.description,
      messageId: randomUUID(),
    },
  };
}

// AI-generated (edited by <name>).
export interface ChatNotificationPayload {
  orderId: string;
  messageId: string;
  message: string;
}

export function buildChatNotificationTask(
  orderId: string,
  message: string,
): OutboxTask {
  return {
    taskName: CHAT_NOTIFICATION_TASK,
    payload: { orderId, messageId: randomUUID(), message },
  };
}
