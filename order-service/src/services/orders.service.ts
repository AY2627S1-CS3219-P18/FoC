import type { PrismaClient } from '../db/prisma.js';
import type {
  OrderRequest,
  RequestStatus,
} from '../generated/prisma/client.js';
import { checkTransition, type ActorId } from '../domain/order-status.js';
import type { CreateOrderPayload } from '../types/orders.js';
import { ErrorCode } from '../constants/errors.js';
import {
  isIsoDateString,
  isNonEmptyString,
  isUuid,
} from '../utils/validation.js';

export type CreateOrderResult =
  { ok: true; order: OrderRequest } | { ok: false; errors: ErrorCode[] };

export const createOrder = async (
  prisma: PrismaClient,
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
  } else if (
    !Number.isInteger(requestPayload.credits) ||
    requestPayload.credits <= 0
  ) {
    errors.push(ErrorCode.INVALID_CREDITS_OFFERED);
  }
  // Optional fields: only validated when present.
  if (
    requestPayload.completeBy != null &&
    !isIsoDateString(requestPayload.completeBy)
  ) {
    errors.push(ErrorCode.INVALID_COMPLETE_BY);
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

  console.log('CREATING REQUEST');
  const order = await prisma.orderRequest.create({
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
  return { ok: true, order };
};

export type TransitionResult =
  { ok: true; order: OrderRequest } | { ok: false; error: ErrorCode };

export const transitionOrder = async (
  prisma: PrismaClient,
  orderId: string,
  to: RequestStatus,
  actorId: ActorId,
): Promise<TransitionResult> => {
  const order = await prisma.orderRequest.findUnique({
    where: { id: orderId },
  });
  if (!order) return { ok: false, error: ErrorCode.ORDER_NOT_FOUND };

  const check = checkTransition(order, to, actorId);
  if (!check.ok) return check;

  // use versioning to prevent data race by updating only on row with same version as found order
  const { count } = await prisma.orderRequest.updateMany({
    where: { id: order.id, version: order.version },
    data: {
      status: to,
      version: { increment: 1 },
      ...(to === 'accepted' && { courierId: actorId, acceptedAt: new Date() }),
      ...(to === 'delivered' && { deliveredAt: new Date() }),
    },
  });
  if (count === 0) return { ok: false, error: ErrorCode.ORDER_CONFLICT };

  const updated = await prisma.orderRequest.findUniqueOrThrow({
    where: { id: order.id },
  });
  return { ok: true, order: updated };
};
