/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-09-27
 * Scope: Unit tests for the team-authored transition guard (order-status.ts).
 *        The expected edges/roles below restate the team's ticket; no
 *        requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: <pending — team member to sign>
 */

import { ErrorCode } from '../constants/errors.js';
import type {
  OrderRequest,
  RequestStatus,
} from '../generated/prisma/client.js';
import {
  checkTransition,
  roleOf,
  SYSTEM_ACTOR,
  type ActorRole,
} from './order-status.js';

const REQUESTER = '0192f0c4-0000-7000-8000-00000000000a';
const COURIER = '0192f0c4-0000-7000-8000-00000000000b';
const STRANGER = '0192f0c4-0000-7000-8000-00000000000c';

const STATUSES = [
  'open',
  'accepted',
  'picked_up',
  'delivered',
  'completed',
  'expired',
  'cancelled',
] as RequestStatus[];

const ROLES: ActorRole[] = ['requester', 'courier', 'system', 'other'];

const ACTOR_FOR: Record<ActorRole, string> = {
  requester: REQUESTER,
  courier: COURIER,
  system: SYSTEM_ACTOR,
  other: STRANGER,
};

/**
 * The spec, restated independently of the implementation so the test catches
 * accidental edits to ALLOWED_TRANSITIONS. Key: "from>to" → roles allowed.
 */
const SPEC: Record<string, ActorRole[]> = {
  'open>accepted': ['other'],
  'open>expired': ['system'],
  'open>cancelled': ['requester'],
  'accepted>picked_up': ['courier'],
  'accepted>cancelled': ['requester', 'courier'],
  'picked_up>delivered': ['courier'],
  'picked_up>cancelled': ['requester', 'courier'],
  'delivered>completed': ['requester'],
};

/** A courier only exists once the order has been accepted. */
function orderIn(status: RequestStatus): OrderRequest {
  const hasCourier = status !== 'open';
  return {
    id: '0192f0c4-0000-7000-8000-000000000001',
    requesterId: REQUESTER,
    courierId: hasCourier ? COURIER : null,
    status,
    version: 0,
  } as OrderRequest;
}

describe('roleOf', () => {
  const order = orderIn('accepted');

  it.each([
    [REQUESTER, 'requester'],
    [COURIER, 'courier'],
    [SYSTEM_ACTOR, 'system'],
    [STRANGER, 'other'],
  ])('%s → %s', (actorId, role) => {
    expect(roleOf(order, actorId)).toBe(role);
  });

  it('nobody is the courier before acceptance', () => {
    expect(roleOf(orderIn('open'), COURIER)).toBe('other');
  });
});

describe('checkTransition: every from × to × role', () => {
  const cases = STATUSES.flatMap((from) =>
    STATUSES.flatMap((to) => ROLES.map((role) => ({ from, to, role }))),
  )
    // Skip combinations that can't occur, e.g. a "courier" on an open order.
    .filter(
      ({ from, role }) => roleOf(orderIn(from), ACTOR_FOR[role]) === role,
    );

  it.each(cases)('$from → $to as $role', ({ from, to, role }) => {
    const allowedRoles = SPEC[`${from}>${to}`];
    const expected = !allowedRoles
      ? { ok: false, error: ErrorCode.INVALID_TRANSITION }
      : allowedRoles.includes(role)
        ? { ok: true }
        : { ok: false, error: ErrorCode.FORBIDDEN };

    expect(checkTransition(orderIn(from), to, ACTOR_FOR[role])).toEqual(
      expected,
    );
  });
});

describe('checkTransition: rules worth naming', () => {
  it('a requester cannot accept their own order', () => {
    expect(checkTransition(orderIn('open'), 'accepted', REQUESTER)).toEqual({
      ok: false,
      error: ErrorCode.FORBIDDEN,
    });
  });

  it('a courier cannot mark their own delivery completed', () => {
    expect(checkTransition(orderIn('delivered'), 'completed', COURIER)).toEqual(
      { ok: false, error: ErrorCode.FORBIDDEN },
    );
  });

  it('users cannot expire orders; only the system can', () => {
    expect(checkTransition(orderIn('open'), 'expired', REQUESTER)).toEqual({
      ok: false,
      error: ErrorCode.FORBIDDEN,
    });
  });

  it.each(['completed', 'expired', 'cancelled'] as RequestStatus[])(
    '%s is terminal',
    (from) => {
      for (const to of STATUSES) {
        expect(checkTransition(orderIn(from), to, SYSTEM_ACTOR)).toEqual({
          ok: false,
          error: ErrorCode.INVALID_TRANSITION,
        });
      }
    },
  );

  it('cannot skip steps (open → delivered)', () => {
    expect(checkTransition(orderIn('open'), 'delivered', STRANGER)).toEqual({
      ok: false,
      error: ErrorCode.INVALID_TRANSITION,
    });
  });
});
