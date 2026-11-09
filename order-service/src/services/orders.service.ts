/*
 * AI Assistance Disclosure:
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented precise delivery details per the team spec. No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
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
 * Author review: george-yeo
 * Scope (2026-10-20): Issue #11 - deliveryLocationId (supplier location id) replaces the
 *        free-text deliveryLocation on create and edit; getOrders moved to
 *        order-listing.service.ts.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Scope (2026-10-20): Issue #6 - transitions and edits publish order events after the
 *        transaction commits (best-effort; REST stays the source of truth).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Author review: george-yeo
 * Scope (2026-10-20): `failed` status - moving to `failed` can queue a credit release (the
 *        retries-exhausted path, as cancellation did before).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Scope (2026-10-20): F9.1.1 / F18.1.1 - additional details are optional on
 *        create (a missing field is no longer rejected); edit is refused with
 *        ORDER_NOT_EDITABLE unless the request is open, and the versioned write also
 *        requires `open`.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Scope (2026-10-20): Edit validates every editable field with create's rules: supplierId
 *        (positive INTEGER id), description (non-empty text), additionalDetails (text or
 *        null), alongside the existing location and complete-by checks; create's supplierId
 *        check also caps at the INTEGER range (George, 2026-10-20: "validate the edit").
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Scope (2026-10-21): Credit transfer - moving an order to `completed` (requester confirm or
 *        the system's auto-complete) writes a `credit_transfer` outbox row in the same
 *        transaction (transfer contract agreed with Wee Jean, 2026-10-20).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-22
 * Scope (2026-10-22): getOrder for GET /orders/:id - an order the viewer may not read
 *        (canViewOrder) answers ORDER_NOT_FOUND like a missing one, so the endpoint does
 *        not reveal which ids exist.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-23
 * Scope (2026-10-23): createOrder / editOrder check that supplierId and deliveryLocationId
 *        exist in supplier-service (caller's token passed through) after the shape checks;
 *        not found -> SUPPLIER_NOT_FOUND / DELIVERY_LOCATION_NOT_FOUND, supplier-service
 *        unreachable -> SUPPLIER_SERVICE_UNAVAILABLE, nothing written (George, 2026-10-23).
 *        Edit checks only the fields it changes, after the requester / open checks.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented or tested the team-specified order chat delivery and message ID deduplication.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented team-specified status notifications and username fallback.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented or tested team-specified order-based courier participant delivery.
 * Author review:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-11-09
 * Scope (2026-11-09): createOrder with no completeBy (absent or null) stores now + 1 hour
 *        instead of NULL; editOrder with completeBy: null keeps the stored value (George,
 *        2026-11-09). Existing NULL rows are not touched.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-11-09): createOrder reserves credits synchronously (one credit-service call,
 *        no retry) and settles the order to open / failed before returning; the outbox
 *        credit_reserve task is gone. A requester with a pending order gets
 *        ORDER_PENDING_EXISTS; a per-requester advisory lock guards the check (George,
 *        2026-11-09).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import type { PrismaClient } from '../db/prisma.js';
import { insertOutboxRows } from '../db/outbox.repository.js';
import {
  buildChatCreateTask,
  buildChatNotificationTask,
  buildChatParticipantTask,
  buildReleaseTask,
  buildTransferTask,
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
import { canViewOrder, type Viewer } from '../domain/order-access.js';
import type { SuppliersClient } from '../clients/suppliers.client.js';
import type { CreditsClient } from '../clients/credits.client.js';
import type { CreateOrderPayload, EditOrderPayload } from '../types/orders.js';
import {
  eventsForEdit,
  eventsForTransition,
  publishSafely,
  type OrderEventPublisher,
} from '../realtime/order-events.js';
import { ErrorCode } from '../constants/errors.js';
import {
  isIsoDateString,
  isNonEmptyString,
  isPositiveInt,
} from '../utils/validation.js';

// `credits` is deliberately absent: credit-service allows one reservation per
// request, so the offer is fixed at creation (George, 2026-10-20).
const EDITABLE_ORDER_FIELDS = new Set([
  'supplierId',
  'description',
  'deliveryLocationId',
  'deliveryDetails',
  'completeBy',
  'additionalDetails',
]);

// A new order without a complete-by gets one an hour from creation, and then behaves
// exactly like a requester-chosen deadline (George, 2026-11-09).
export const DEFAULT_COMPLETE_BY_MS = 60 * 60 * 1000;

export type CreateOrderResult =
  { ok: true; order: OrderRequest } | { ok: false; errors: ErrorCode[] };

export type EditOrderResult =
  { ok: true; order: OrderRequest } | { ok: false; errors: ErrorCode[] };

const checkDeliveryDetails = (
  value: unknown,
): { error: ErrorCode } | { value: string } => {
  if (value === undefined || value === null)
    return { error: ErrorCode.MISSING_DELIVERY_DETAILS };
  if (typeof value !== 'string')
    return { error: ErrorCode.INVALID_DELIVERY_DETAILS };
  const trimmed = value.trim();
  if (!trimmed) return { error: ErrorCode.MISSING_DELIVERY_DETAILS };
  if (trimmed.length > 250)
    return { error: ErrorCode.INVALID_DELIVERY_DETAILS };
  return { value: trimmed };
};

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

/** supplier-service, and the caller's own `Bearer …` header to call it with. */
export interface ReferenceCheck {
  suppliers: SuppliersClient;
  authorization: string;
}

/**
 * Checks the given ids exist in supplier-service, in parallel. Any unanswered check makes
 * the whole result SUPPLIER_SERVICE_UNAVAILABLE, so a request is never half-validated.
 */
async function checkReferences(
  { suppliers, authorization }: ReferenceCheck,
  ids: { supplierId?: number; deliveryLocationId?: number },
): Promise<ErrorCode[]> {
  const [supplier, location] = await Promise.all([
    ids.supplierId === undefined
      ? 'found'
      : suppliers.supplierExists(ids.supplierId, authorization),
    ids.deliveryLocationId === undefined
      ? 'found'
      : suppliers.locationExists(ids.deliveryLocationId, authorization),
  ]);
  if (supplier === 'unavailable' || location === 'unavailable') {
    return [ErrorCode.SUPPLIER_SERVICE_UNAVAILABLE];
  }
  const errors: ErrorCode[] = [];
  if (supplier === 'not_found') errors.push(ErrorCode.SUPPLIER_NOT_FOUND);
  if (location === 'not_found')
    errors.push(ErrorCode.DELIVERY_LOCATION_NOT_FOUND);
  return errors;
}

export const createOrder = async (
  prisma: PrismaClient,
  requesterId: string,
  requestPayload: CreateOrderPayload,
  refs: ReferenceCheck,
  credits: CreditsClient,
  events?: OrderEventPublisher,
): Promise<CreateOrderResult> => {
  const errors: ErrorCode[] = [];

  console.log('VALIDATING PAYLOAD');
  if (!requestPayload.supplierId) {
    errors.push(ErrorCode.MISSING_SUPPLIER);
  } else if (!isPositiveInt(requestPayload.supplierId)) {
    errors.push(ErrorCode.INVALID_SUPPLIER);
  }
  if (!requestPayload.description) {
    errors.push(ErrorCode.MISSING_DESCRIPTION);
  } else if (!isNonEmptyString(requestPayload.description)) {
    errors.push(ErrorCode.INVALID_DESCRIPTION);
  }
  if (
    requestPayload.deliveryLocationId === undefined ||
    requestPayload.deliveryLocationId === null
  ) {
    errors.push(ErrorCode.MISSING_DELIVERY_LOCATION);
  } else if (!isPositiveInt(requestPayload.deliveryLocationId)) {
    errors.push(ErrorCode.INVALID_DELIVERY_LOCATION);
  }
  const details = checkDeliveryDetails(requestPayload.deliveryDetails);
  if ('error' in details) errors.push(details.error);
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
    requestPayload.additionalDetails !== undefined &&
    !validateAdditionalDetails(requestPayload.additionalDetails)
  ) {
    errors.push(ErrorCode.INVALID_ADDITIONAL_DETAILS);
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  const missing = await checkReferences(refs, {
    supplierId: requestPayload.supplierId,
    deliveryLocationId: requestPayload.deliveryLocationId,
  });
  if (missing.length) return { ok: false, errors: missing };

  // The order is written `pending`, then credit-service is called once, in this request,
  // with no retry; the order settles to `open` or `failed` before the response (George,
  // 2026-11-09). A requester with a `pending` order cannot create another until it settles.
  // The advisory lock serialises one requester's creates, so two at once cannot both pass
  // the pending check. The order id is the reservation's idempotency key (requestId).
  console.log('CREATING REQUEST');
  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${requesterId}))`;
    const pending = await tx.orderRequest.findFirst({
      where: { requesterId, status: 'pending' },
      select: { id: true },
    });
    if (pending) return null;
    return tx.orderRequest.create({
      data: {
        requesterId,
        supplierId: requestPayload.supplierId,
        description: requestPayload.description,
        deliveryLocationId: requestPayload.deliveryLocationId,
        deliveryDetails: 'value' in details ? details.value : '',
        credits: requestPayload.credits,
        completeBy: requestPayload.completeBy
          ? new Date(requestPayload.completeBy)
          : new Date(Date.now() + DEFAULT_COMPLETE_BY_MS),
        additionalDetails: requestPayload.additionalDetails ?? null,
        status: 'pending',
      },
    });
  });
  if (!created) return { ok: false, errors: [ErrorCode.ORDER_PENDING_EXISTS] };

  const reserved = await credits.reserve({
    requestId: created.id,
    userId: requesterId,
    amount: created.credits,
  });

  if (reserved.ok) {
    const order = await settleReservation(prisma, created.id, 'open', { events });
    return { ok: true, order };
  }

  if (reserved.kind === 'permanent') {
    // credit-service refused, so nothing was reserved and nothing needs releasing.
    await settleReservation(prisma, created.id, 'failed', {
      events,
      reason: reserved.code,
    });
    return {
      ok: false,
      errors: [
        reserved.code === INSUFFICIENT_UNRESERVED_CREDITS
          ? ErrorCode.INSUFFICIENT_CREDITS
          : ErrorCode.CREDIT_RESERVE_REJECTED,
      ],
    };
  }

  // Unreachable or 5xx: the reserve may still have committed on credit-service's side
  // without us hearing back, so the failure also queues a release (George, 2026-11-09).
  await settleReservation(prisma, created.id, 'failed', {
    events,
    reason: ErrorCode.CREDIT_SERVICE_UNAVAILABLE,
    releaseCredits: true,
  });
  return { ok: false, errors: [ErrorCode.CREDIT_SERVICE_UNAVAILABLE] };
};

/** credit-service's code for a requester without enough unreserved credits. */
const INSUFFICIENT_UNRESERVED_CREDITS = 'INSUFFICIENT_UNRESERVED_CREDITS';

/** Moves a just-created `pending` order to its reservation outcome, as the system. */
async function settleReservation(
  prisma: PrismaClient,
  orderId: string,
  to: 'open' | 'failed',
  options: TransitionOptions,
): Promise<OrderRequest> {
  const result = await transitionOrder(
    prisma,
    orderId,
    to,
    SYSTEM_ACTOR,
    new Date(),
    options,
  );
  // Only this request moves its own pending order, so a refusal here is a bug.
  if (!result.ok) {
    throw new Error(`Order ${orderId} could not move to ${to}: ${result.error}`);
  }
  return result.order;
}

export type GetOrderResult =
  | { ok: true; order: OrderRequest }
  | { ok: false; error: ErrorCode.ORDER_NOT_FOUND };

/** One order, if `viewer` may read it (see canViewOrder); otherwise not found. */
export const getOrder = async (
  prisma: PrismaClient,
  viewer: Viewer,
  orderId: string,
): Promise<GetOrderResult> => {
  const order = await prisma.orderRequest.findUnique({
    where: { id: orderId },
  });
  if (!order || !canViewOrder(order, viewer)) {
    return { ok: false, error: ErrorCode.ORDER_NOT_FOUND };
  }
  return { ok: true, order };
};

export const editOrder = async (
  prisma: PrismaClient,
  actorId: ActorId,
  orderId: string,
  payload: EditOrderPayload,
  refs: ReferenceCheck,
  events?: OrderEventPublisher,
): Promise<EditOrderResult> => {
  const errors: ErrorCode[] = [];
  const details = checkDeliveryDetails(payload.deliveryDetails);
  if ('error' in details) errors.push(details.error);
  for (const [key, value] of Object.entries(payload)) {
    if (!EDITABLE_ORDER_FIELDS.has(key)) {
      errors.push(ErrorCode.INVALID_FIELD);
      continue;
    }

    // Validate fields with the same rules as create (F18.1.2: edit in accordance with F9.1.1)
    if (key == 'supplierId') {
      if (!isPositiveInt(value)) {
        errors.push(ErrorCode.INVALID_SUPPLIER);
      }
    } else if (key == 'description') {
      if (!isNonEmptyString(value)) {
        errors.push(ErrorCode.INVALID_DESCRIPTION);
      }
    } else if (key == 'additionalDetails') {
      if (value !== null && typeof value !== 'string') {
        errors.push(ErrorCode.INVALID_ADDITIONAL_DETAILS);
      }
    } else if (key == 'deliveryLocationId') {
      if (!isPositiveInt(value)) {
        errors.push(ErrorCode.INVALID_DELIVERY_LOCATION);
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

    // F18.1.1: only open requests can be edited.
    if (order.status !== 'open') {
      return { ok: false, errors: [ErrorCode.ORDER_NOT_EDITABLE] };
    }

    // Only the ids being changed, and only once the caller may edit at all.
    const missing = await checkReferences(refs, {
      supplierId: payload.supplierId,
      deliveryLocationId: payload.deliveryLocationId,
    });
    if (missing.length) return { ok: false, errors: missing };

    // completeBy: null means "no change": the stored deadline stays (George, 2026-11-09).
    const { completeBy, ...changes } = payload;

    // `status: 'open'` in the guard too: an accept that lands between the read and this
    // write makes the edit a version conflict instead of editing an accepted order.
    const { count } = await prisma.orderRequest.updateMany({
      where: { id: order.id, version: order.version, status: 'open' },
      data: {
        ...changes,
        ...(completeBy != null && { completeBy }),
        deliveryDetails: 'value' in details ? details.value : '',
        version: { increment: 1 },
      },
    });
    if (count === 0) {
      return { ok: false, errors: [ErrorCode.ORDER_CONFLICT] };
    }

    const updatedOrder = await prisma.orderRequest.findUniqueOrThrow({
      where: { id: order.id },
    });
    if (events) await publishSafely(events, eventsForEdit(updatedOrder));
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

export type TransitionResult =
  { ok: true; order: OrderRequest } | { ok: false; error: ErrorCode };

export async function runRequestMaintenance(
  prisma: PrismaClient,
  now: Date = new Date(),
  events?: OrderEventPublisher,
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
      { events },
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
      { events },
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
   * Queue a credit release even though the order is not yet funded. Used by createOrder
   * when the reserve call fails transiently: the reserve may have committed on
   * credit-service's side without us hearing back (George, 2026-10-19 / 2026-11-09).
   */
  releaseCredits?: boolean;
  /** Courier username lookup supplied by the acceptance request; never persisted. */
  acceptanceUsername?: () => Promise<string | undefined>;
  /** Where to publish the resulting order event once the change has committed. */
  events?: OrderEventPublisher;
  /** Reason carried on the event (a failed reservation's code). */
  reason?: string;
}

/** Tasks that must commit together with moving `order` to `to`. */
function creditTasksFor(
  order: OrderRequest,
  to: RequestStatus,
  options: TransitionOptions,
): OutboxTask[] {
  // AI-generated (edited by <name>).
  if (order.status === 'pending' && to === 'open')
    return [buildChatCreateTask(order)];
  // Completion pays the courier: credit-service moves the reserved credits.
  if (to === 'completed' && order.courierId) {
    return [
      buildTransferTask({ requestId: order.id, courierId: order.courierId }),
    ];
  }
  const endsOrder = to === 'cancelled' || to === 'expired' || to === 'failed';
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
  // AI-generated (edited by <name>).
  const messages: Partial<Record<RequestStatus, string>> = {
    cancelled: 'The order has been cancelled',
    expired: 'The order has expired',
    accepted: 'The order has been accepted',
    picked_up: 'The order has been picked up',
    delivered: 'The order has been delivered',
    completed: 'The order has been marked as completed',
  };
  let message = messages[to];
  if (to === 'accepted' && options.acceptanceUsername) {
    try {
      const username = await options.acceptanceUsername();
      if (username) message += ` by ${username}`;
    } catch {
      // The team-specified fallback also covers network and malformed-response errors.
    }
  }
  if (to === 'accepted')
    tasks.push(buildChatParticipantTask(order.id, actorId));
  if (message) tasks.push(buildChatNotificationTask(order.id, message));

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
  // After commit: subscribers never see a change that might still roll back.
  if (options.events) {
    await publishSafely(
      options.events,
      eventsForTransition(updated, order.status, options.reason),
    );
  }
  return { ok: true, order: updated };
};
