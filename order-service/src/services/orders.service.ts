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
 */

import type {
  CreditsClient,
  ReserveResult,
} from '../clients/credits.client.js';
import type { PrismaClient } from '../db/prisma.js';
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
import {
  isIsoDateString,
  isNonEmptyString,
  isUuid,
} from '../utils/validation.js';

const EDITABLE_ORDER_FIELDS = new Set([
  'supplierId',
  'description',
  'deliveryLocation',
  'credits',
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
  credits: CreditsClient,
  requesterId: string,
  requestPayload: CreateOrderPayload,
): Promise<CreateOrderResult> => {
  const errors: ErrorCode[] = [];

  console.log('VALIDATING PAYLOAD');
  if (!requestPayload.supplierId) {
    errors.push(ErrorCode.MISSING_SUPPLIER);
  } else if (!isUuid(requestPayload.supplierId)) {
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

  // use temporary stub for credit reservation
  const reservation = await credits
    .reserve({ requesterId, amount: requestPayload.credits })
    .catch((err: unknown): ReserveResult => {
      console.error('Credit reservation failed:', err);
      return { ok: false, reason: 'UNAVAILABLE' };
    });
  if (!reservation.ok) {
    return {
      ok: false,
      errors: [
        reservation.reason === 'INSUFFICIENT_CREDITS'
          ? ErrorCode.INSUFFICIENT_CREDITS
          : ErrorCode.CREDIT_SERVICE_UNAVAILABLE,
      ],
    };
  }

  console.log('CREATING REQUEST');
  let order: OrderRequest;
  try {
    order = await prisma.orderRequest.create({
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
      },
    });
  } catch (err) {
    await credits.release(reservation.reservationId).catch((releaseErr) => {
      console.error(
        `Failed to release reservation ${reservation.reservationId}:`,
        releaseErr,
      ); // TODO(team): consider retrying release if it fails, or logging to a monitoring system
    });
    throw err;
  }
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
    if (key == 'credits') {
      if (typeof value != 'number' || !validateCredits(value)) {
        errors.push(ErrorCode.INVALID_CREDITS_OFFERED);
      }
    } else if (key == 'completeBy') {
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

export const transitionOrder = async (
  prisma: PrismaClient,
  orderId: string,
  to: RequestStatus,
  actorId: ActorId,
  now: Date = new Date(),
): Promise<TransitionResult> => {
  const order = await prisma.orderRequest.findUnique({
    where: { id: orderId },
  });
  if (!order) return { ok: false, error: ErrorCode.ORDER_NOT_FOUND };

  const check = checkTransition(order, to, actorId, now);
  if (!check.ok) return check;

  // use versioning to prevent data race by updating only on row with same version as found order
  const { count } = await prisma.orderRequest.updateMany({
    where: { id: order.id, version: order.version },
    data: {
      status: to,
      version: { increment: 1 },
      ...(to === 'accepted' && { courierId: actorId, acceptedAt: now }),
      ...(to === 'delivered' && { deliveredAt: now }),
    },
  });
  if (count === 0) return { ok: false, error: ErrorCode.ORDER_CONFLICT };

  const updated = await prisma.orderRequest.findUniqueOrThrow({
    where: { id: order.id },
  });
  return { ok: true, order: updated };
};
