import type {
  CreditsClient,
  ReserveResult,
} from '../clients/credits.client.js';
import type { PrismaClient } from '../db/prisma.js';
import {
  RequestStatus,
  type OrderRequest,
} from '../generated/prisma/client.js';
import { checkTransition, type ActorId } from '../domain/order-status.js';
import type { CreateOrderPayload } from '../types/orders.js';
import { ErrorCode, ErrorMessage } from '../constants/errors.js';
import {
  isIsoDateString,
  isNonEmptyString,
  isUuid,
} from '../utils/validation.js';

export type CreateOrderResult =
  { ok: true; order: OrderRequest } | { ok: false; errors: ErrorCode[] };

export type GetOrderResult =
  { ok: true; orders: OrderRequest[] } | { ok: false; errors: any };

export const createOrder = async (
  prisma: PrismaClient,
  credits: CreditsClient,
  requesterId: string,
  requestPayload: CreateOrderPayload,
  now: Date = new Date(),
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
  } else if (
    !Number.isInteger(requestPayload.credits) ||
    requestPayload.credits <= 0
  ) {
    errors.push(ErrorCode.INVALID_CREDITS_OFFERED);
  }

  // optional fields
  if (requestPayload.completeBy != null) {
    if (!isIsoDateString(requestPayload.completeBy)) {
      errors.push(ErrorCode.INVALID_COMPLETE_BY);
    } else if (Date.parse(requestPayload.completeBy) <= now.getTime()) {
      // F9.1.1: complete-by must be later than the current time
      errors.push(ErrorCode.COMPLETE_BY_IN_PAST);
    }
  }
  if (
    requestPayload.additionalDetails != null &&
    typeof requestPayload.additionalDetails !== 'string'
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
