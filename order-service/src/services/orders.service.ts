/*
 * AI Assistance Disclosure:
 * Tool: GitHub Copilot (model: GPT-5.6 Luna), date: 2026-10-12
 * Scope: Narrowed edit-order validation and Prisma error handling; unsupported
 *        fields now return a validation error and missing orders remain
 *        ORDER_NOT_FOUND. No requirements, architecture, schema, or API
 *        decisions were made by the AI tool.
 * Author review: tng wen xi
 * Scope (2026-10-12): Applied optimistic locking to editOrder by matching the
 *        fetched version and incrementing it atomically.
 * Author review: tng wen xi
 * Scope (2026-10-12): Added system-actor maintenance transitions for automatic
 *        completion after delivery and expiry at the acceptance deadline.
 * Author review: tng wen xi
 * Scope (2026-10-12): Formatted the maintenance timestamp as ISO-8601 for
 *        readable, timezone-explicit logs.
 * Author review: tng wen xi
 * Scope (2026-10-13): Persisted credit reservation identifiers and recorded
 *        successful expiry-time credit release.
 * Author review: tng wen xi
 * Scope (2026-10-13): Released the persisted reservation after successful
 *        requester cancellation.
 * Author review: tng wen xi
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope (2026-10-20): Issue #4 per George's decisions (2026-10-19/20) - createOrder
 *        writes a `pending` order and its credit_reserve outbox row in one transaction
 *        (no credit call in the request path); cancel/expire of a funded order writes a
 *        credit_release outbox row in the same transaction as the status change,
 *        replacing the inline reservationId release; `credits` is no longer editable.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import type { PrismaClient } from '../db/prisma.js';
import { insertOutboxRows } from '../db/outbox.repository.js';
import {
  buildReleaseTask,
  buildReserveTask,
  type OutboxTask,
} from '../queue/tasks.js';
import {
  Prisma,
  RequestStatus,
  type OrderRequest,
} from '../generated/prisma/client.js';
import {
  checkTransition,
  SYSTEM_ACTOR,
  type ActorId,
} from '../domain/order-status.js';
import type { CreateOrderPayload, EditOrderPayload } from '../types/orders.js';
import { ErrorCode, ErrorMessage } from '../constants/errors.js';
import { isIsoDateString, isNonEmptyString } from '../utils/validation.js';

// `credits` is deliberately absent: credit-service allows one reservation per
// request, so the offer is fixed at creation (George, 2026-10-20).
const EDITABLE_ORDER_FIELDS = new Set([
  'supplierId',
  'description',
  'deliveryLocation',
  'completeBy',
  'additionalDetails',
]);

export type CreateOrderResult =
  { ok: true; order: OrderRequest } | { ok: false; errors: ErrorCode[] };

export type EditOrderResult =
  { ok: true; order: OrderRequest } | { ok: false; errors: ErrorCode[] };

export type GetOrderResult =
  { ok: true; orders: OrderRequest[] } | { ok: false; errors: any };

const validateCredits = (credits: number) => {
  return Number.isInteger(credits) && credits > 0;
};

const validateCompleteBy = (
  completeBy: string | null,
  now: Date = new Date(),
) => {
  const errors = [];

  if (completeBy !== null) {
    if (!isIsoDateString(completeBy)) {
      errors.push(ErrorCode.INVALID_COMPLETE_BY);
    } else if (Date.parse(completeBy) <= now.getTime()) {
      // F9.1.1: complete-by must be later than the current time
      errors.push(ErrorCode.COMPLETE_BY_IN_PAST);
    }
  }
  return errors;
};

const validateAdditionalDetails = (additionalDetails: string | null) => {
  return additionalDetails === null || typeof additionalDetails === 'string';
};

export const createOrder = async (
  prisma: PrismaClient,
  requesterId: string,
  requestPayload: CreateOrderPayload,
): Promise<CreateOrderResult> => {
  const errors: ErrorCode[] = [];

  console.log('VALIDATING PAYLOAD');
  if (!requestPayload.supplierId) {
    errors.push(ErrorCode.MISSING_SUPPLIER);
  } else if (
    !Number.isInteger(requestPayload.supplierId) ||
    requestPayload.supplierId <= 0
  ) {
    errors.push(ErrorCode.INVALID_SUPPLIER);
  }
  if (!requestPayload.description) {
    errors.push(ErrorCode.MISSING_DESCRIPTION);
  } else if (!isNonEmptyString(requestPayload.description)) {
    errors.push(ErrorCode.INVALID_DESCRIPTION);
  }
  if (!requestPayload.deliveryLocation) {
    errors.push(ErrorCode.MISSING_DELIVERY_LOCATION);
  } else if (!isNonEmptyString(requestPayload.deliveryLocation)) {
    errors.push(ErrorCode.INVALID_DELIVERY_LOCATION);
  }
  if (requestPayload.credits === undefined || requestPayload.credits === null) {
    errors.push(ErrorCode.MISSING_CREDITS_OFFERED);
  } else if (!validateCredits(requestPayload.credits)) {
    errors.push(ErrorCode.INVALID_CREDITS_OFFERED);
  }

  // optional fields
  if (requestPayload.completeBy !== undefined) {
    errors.push(...validateCompleteBy(requestPayload.completeBy));
  }
  if (
    requestPayload.additionalDetails === undefined ||
    !validateAdditionalDetails(requestPayload.additionalDetails)
  ) {
    errors.push(ErrorCode.INVALID_ADDITIONAL_DETAILS);
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  // Issue #4: the order starts `pending` and is hidden until credit-service confirms
  // the reservation. The reserve call itself happens in the worker; here we only
  // commit the order and its outbox task together, so neither can exist without
  // the other. The order id is the reservation's idempotency key (requestId).
  console.log('CREATING REQUEST');
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.orderRequest.create({
      data: {
        requesterId,
        supplierId: requestPayload.supplierId,
        description: requestPayload.description,
        deliveryLocation: requestPayload.deliveryLocation,
        credits: requestPayload.credits,
        completeBy: requestPayload.completeBy
          ? new Date(requestPayload.completeBy)
          : null,
        additionalDetails: requestPayload.additionalDetails ?? null,
        status: 'pending',
      },
    });
    await insertOutboxRows(tx, created.version, [
      buildReserveTask({
        requestId: created.id,
        userId: requesterId,
        amount: created.credits,
      }),
    ]);
    return created;
  });
  return { ok: true, order };
};

export const editOrder = async (
  prisma: PrismaClient,
  actorId: ActorId,
  orderId: string,
  payload: EditOrderPayload,
): Promise<EditOrderResult> => {
  const errors: ErrorCode[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (!EDITABLE_ORDER_FIELDS.has(key)) {
      errors.push(ErrorCode.INVALID_FIELD);
      continue;
    }

    // Validate fields
    if (key == 'completeBy') {
      if (typeof value != 'string' && value != null) {
        errors.push(ErrorCode.INVALID_COMPLETE_BY);
      } else {
        errors.push(...validateCompleteBy(value));
      }
    }
  }
  if (errors.length) {
    return {
      ok: false,
      errors: errors,
    };
  }
  try {
    const order = await prisma.orderRequest.findUniqueOrThrow({
      where: {
        id: orderId,
      },
    });

    // Ensure that request was sent by order requester
    if (order.requesterId != actorId) {
      return {
        ok: false,
        errors: [ErrorCode.FORBIDDEN],
      };
    }

    const { count } = await prisma.orderRequest.updateMany({
      where: { id: order.id, version: order.version },
      data: {
        ...payload,
        version: { increment: 1 },
      },
    });
    if (count === 0) {
      return { ok: false, errors: [ErrorCode.ORDER_CONFLICT] };
    }

    const updatedOrder = await prisma.orderRequest.findUniqueOrThrow({
      where: { id: order.id },
    });
    return { ok: true, order: updatedOrder };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return { ok: false, errors: [ErrorCode.ORDER_NOT_FOUND] };
    }
    throw error;
  }
};

export const getOrders = async (
  prisma: PrismaClient,
  statusFilter: RequestStatus | undefined,
): Promise<GetOrderResult> => {
  if (
    statusFilter !== undefined &&
    !Object.values(RequestStatus).includes(statusFilter)
  ) {
    const errorCode = ErrorCode.INVALID_STATUS;
    return {
      ok: false,
      errors: ErrorMessage[errorCode],
    };
  }
  try {
    const orders = await prisma.orderRequest.findMany({
      where: statusFilter
        ? {
            status: statusFilter,
          }
        : undefined,
    });

    return {
      ok: true,
      orders: orders,
    };
  } catch (error) {
    // TODO: retry and log
    return {
      ok: false,
      errors: error,
    };
  }
};

export type TransitionResult =
  { ok: true; order: OrderRequest } | { ok: false; error: ErrorCode };

export async function runRequestMaintenance(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<{ completed: number; expired: number }> {
  console.log(
    'Running runRequestMaintenance, current time:',
    now.toISOString(),
  );
  const deliveredCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [deliveredOrders, openOrders] = await Promise.all([
    prisma.orderRequest.findMany({
      where: {
        status: 'delivered',
        deliveredAt: { lte: deliveredCutoff },
      },
    }),
    prisma.orderRequest.findMany({
      where: {
        status: 'open',
        completeBy: { not: null, lte: now },
      },
    }),
  ]);

  let completed = 0;
  for (const order of deliveredOrders) {
    const result = await transitionOrder(
      prisma,
      order.id,
      'completed',
      SYSTEM_ACTOR,
      now,
    );
    if (result.ok) completed += 1;
  }

  // Expiring a funded order queues its credit release in the same transaction
  // (see transitionOrder), so nothing here talks to credit-service directly.
  let expired = 0;
  for (const order of openOrders) {
    const result = await transitionOrder(
      prisma,
      order.id,
      'expired',
      SYSTEM_ACTOR,
      now,
    );
    if (result.ok) expired += 1;
  }

  return { completed, expired };
}

/** Statuses in which credit-service holds a reservation for the order. */
const FUNDED_STATUSES: ReadonlySet<RequestStatus> = new Set([
  'open',
  'accepted',
  'picked_up',
]);

export interface TransitionOptions {
  /**
   * Queue a credit release even though the order is not yet funded. Used by the
   * reservation saga when it gives up after transient failures: the reserve may have
   * committed on credit-service's side without us hearing back (George, 2026-10-19).
   */
  releaseCredits?: boolean;
}

/** Credit tasks that must commit together with moving `order` to `to`. */
function creditTasksFor(
  order: OrderRequest,
  to: RequestStatus,
  options: TransitionOptions,
): OutboxTask[] {
  const endsOrder = to === 'cancelled' || to === 'expired';
  if (!endsOrder) return [];
  if (FUNDED_STATUSES.has(order.status) || options.releaseCredits) {
    return [buildReleaseTask(order.id)];
  }
  return [];
}

export const transitionOrder = async (
  prisma: PrismaClient,
  orderId: string,
  to: RequestStatus,
  actorId: ActorId,
  now: Date = new Date(),
  options: TransitionOptions = {},
): Promise<TransitionResult> => {
  const order = await prisma.orderRequest.findUnique({
    where: { id: orderId },
  });
  if (!order) return { ok: false, error: ErrorCode.ORDER_NOT_FOUND };

  const check = checkTransition(order, to, actorId, now);
  if (!check.ok) return check;

  const tasks = creditTasksFor(order, to, options);

  // use versioning to prevent data race by updating only on row with same version as found order;
  // any credit task commits in the same transaction, so a lost race writes nothing.
  const applied = await prisma.$transaction(async (tx) => {
    const { count } = await tx.orderRequest.updateMany({
      where: { id: order.id, version: order.version },
      data: {
        status: to,
        version: { increment: 1 },
        ...(to === 'accepted' && { courierId: actorId, acceptedAt: now }),
        ...(to === 'delivered' && { deliveredAt: now }),
      },
    });
    if (count === 0) return false;
    await insertOutboxRows(tx, order.version + 1, tasks);
    return true;
  });
  if (!applied) return { ok: false, error: ErrorCode.ORDER_CONFLICT };

  const updated = await prisma.orderRequest.findUniqueOrThrow({
    where: { id: order.id },
  });
  return { ok: true, order: updated };
};
