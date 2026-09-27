import type {
  OrderRequest,
  RequestStatus,
} from '../generated/prisma/client.js';
import { ErrorCode } from '../constants/errors.js';

export type ActorRole = 'requester' | 'courier' | 'system' | 'other';
export const SYSTEM_ACTOR = 'system';
export type ActorId = string; // user UUID, or SYSTEM_ACTOR for internal callers

const ALLOWED_TRANSITIONS: Record<
  RequestStatus,
  Partial<Record<RequestStatus, readonly ActorRole[]>>
> = {
  open: { accepted: ['other'], expired: ['system'], cancelled: ['requester'] },
  accepted: { picked_up: ['courier'], cancelled: ['requester', 'courier'] },
  picked_up: { delivered: ['courier'], cancelled: ['requester', 'courier'] },
  delivered: { completed: ['requester'] },
  completed: {},
  expired: {},
  cancelled: {},
};

export function roleOf(order: OrderRequest, actorId: ActorId): ActorRole {
  if (actorId === SYSTEM_ACTOR) return 'system';
  if (actorId === order.requesterId) return 'requester';
  if (actorId === order.courierId) return 'courier';
  return 'other';
}

export type TransitionCheck =
  | { ok: true }
  | { ok: false; error: ErrorCode.INVALID_TRANSITION | ErrorCode.FORBIDDEN };

export function checkTransition(
  order: OrderRequest,
  to: RequestStatus,
  actorId: ActorId,
): TransitionCheck {
  const allowedRoles = ALLOWED_TRANSITIONS[order.status][to];
  if (!allowedRoles) return { ok: false, error: ErrorCode.INVALID_TRANSITION };
  if (!allowedRoles.includes(roleOf(order, actorId)))
    return { ok: false, error: ErrorCode.FORBIDDEN };
  return { ok: true };
}
