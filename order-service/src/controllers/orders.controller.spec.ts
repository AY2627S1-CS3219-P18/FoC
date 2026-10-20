/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-09-27
 * Scope: HTTP-level tests for POST /orders status codes.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Scope (2026-09-29): Added HTTP-level tests for GET /orders results, filters, and failures.
 * Author review: tng wen xi
 * Scope (2026-10-13): Updated create-order response expectations for generated
 *        order and reservation identifiers.
 * Author review: tng wen xi
 * Scope (2026-10-04): Updated GET /orders HTTP expectations and test doubles to
 *        match the service result contract and controller failure responses.
 * Author review: tng wen xi
 * Scope (2026-10-07): Added POST /orders/:id transition controller coverage for
 *        successful pickup, forbidden actors, and invalid transitions.
 * Author review: tng wen xi
 * Scope (2026-10-08): Added F17 HTTP coverage for requester cancellation of
 *        open and deadline-reached requests and cancellation failures.
 * Author review: tng wen xi
 * Scope (2026-10-12): Added HTTP coverage for unsupported edit-order fields.
 * Author review: tng wen xi
 * Scope (2026-10-12): Updated create-order fixtures for additional-details
 *        validation and added successful, forbidden, and conflict edit-order
 *        HTTP coverage.
 * Author review: tng wen xi
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope (2026-10-20): Issue #5 - POST /orders/:id/accept HTTP coverage: 200 with the
 *        courier assigned; 403 self-accept; 409 for expired, cancelled, pending, already
 *        assigned, and lost optimistic-lock race.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Issue #4 - POST /orders now answers 202 with a `pending` order and
 *        an outbox reserve task (no credit call in the request path); dropped the
 *        422/503 credit cases that moved to the worker; fakes gained $transaction/outbox.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import request from 'supertest';
import type { RequestHandler } from 'express';
import { createApp } from '../app.js';
import type { PrismaClient } from '../db/prisma.js';

const USER = '0192f0c4-7a1e-7c3a-9b2d-3f4e5a6b7c8d';
const body = {
  supplierId: 1,
  description: '1x chicken rice',
  deliveryLocation: 'COM1 Basement',
  credits: 4,
  additionalDetails: null,
};

function appWith(
  findMany: (args: {
    where?: { status: string };
  }) => Promise<object[]> = async () => [],
  orderRequestOverrides: Partial<{
    create: (args: { data: object }) => Promise<object>;
    findUnique: (args: { where: { id: string } }) => Promise<object | null>;
    updateMany: (args: {
      where: { id: string; version: number };
      data: object;
    }) => Promise<{ count: number }>;
    findUniqueOrThrow: (args: { where: { id: string } }) => Promise<object>;
  }> = {},
) {
  const outbox = { createMany: vi.fn(async () => ({ count: 1 })) };
  const prisma = {
    outbox,
    // Interactive transactions run the callback against the same fake client.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
    orderRequest: {
      create: async ({ data }: { data: object }) => ({ id: 'new', ...data }),
      findMany,
      findUnique: async () => null,
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => ({ id: 'order-1', status: 'picked_up' }),
      ...orderRequestOverrides,
    },
  } as unknown as PrismaClient;
  const authenticate: RequestHandler = (req, res, next) => {
    const userId = req.get('x-user-id') ?? USER;
    req.user = { user_id: userId, role: 'user' };
    next();
  };
  return Object.assign(createApp({ prisma, authenticate }), { outbox });
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('POST /orders', () => {
  it('202 with the pending request, queueing its credit reservation', async () => {
    const app = appWith();
    const res = await request(app)
      .post('/orders')
      .set('x-user-id', USER)
      .send(body)
      .expect(202);
    expect(res.body).toMatchObject({ credits: 4, status: 'pending' });
    expect(res.body.id).toEqual(expect.any(String));
    expect(app.outbox.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          taskName: 'credit_reserve',
          payload: { requestId: res.body.id, userId: USER, amount: 4 },
        }),
      ],
    });
  });

  it('400 when complete-by is in the past', async () => {
    await request(appWith())
      .post('/orders')
      .set('x-user-id', USER)
      .send({ ...body, completeBy: '2000-01-01T00:00:00.000Z' })
      .expect(400, { message: 'Complete-by time must be in the future.' });
  });
});

describe('PATCH /orders/:id/edit', () => {
  const orderId = '0192f0c4-0000-7000-8000-000000000001';
  const requesterId = '0192f0c4-0000-7000-8000-00000000000a';

  it('200 with the updated order when the requester edits it', async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const updatedOrder = {
      id: orderId,
      requesterId,
      description: 'Updated description',
      version: 4,
    };
    const res = await request(
      appWith(async () => [], {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            ...updatedOrder,
            version: 3,
          })
          .mockResolvedValueOnce(updatedOrder),
        updateMany,
      }),
    )
      .patch(`/orders/${orderId}/edit`)
      .set('x-user-id', requesterId)
      .send({ description: 'Updated description' })
      .expect(200);

    expect(res.body).toEqual(updatedOrder);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: orderId, version: 3 },
      data: {
        description: 'Updated description',
        version: { increment: 1 },
      },
    });
  });

  it('403 when a non-requester edits the order', async () => {
    await request(
      appWith(async () => [], {
        findUniqueOrThrow: async () => ({
          id: orderId,
          requesterId: USER,
          version: 3,
        }),
      }),
    )
      .patch(`/orders/${orderId}/edit`)
      .set('x-user-id', requesterId)
      .send({ description: 'Updated description' })
      .expect(403, {
        message: 'You are not allowed to perform this action.',
      });
  });

  it('409 when the order changed before the edit was saved', async () => {
    await request(
      appWith(async () => [], {
        findUniqueOrThrow: async () => ({
          id: orderId,
          requesterId,
          version: 3,
        }),
        updateMany: async () => ({ count: 0 }),
      }),
    )
      .patch(`/orders/${orderId}/edit`)
      .set('x-user-id', requesterId)
      .send({ description: 'Updated description' })
      .expect(409, {
        message:
          'This order was changed by someone else. Refresh and try again.',
      });
  });

  it('returns a user-facing validation message for unsupported fields', async () => {
    await request(appWith())
      .patch('/orders/order-1/edit')
      .set('x-user-id', USER)
      .send({ unsupported: true })
      .expect(400, {
        message: 'Payload contains an unsupported field.',
      });
  });
});

describe('GET /orders', () => {
  const orders = [
    { id: 'open-1', status: 'open', description: 'Chicken rice' },
    { id: 'accepted-1', status: 'accepted', description: 'Coffee' },
    { id: 'cancelled-1', status: 'cancelled', description: 'Textbooks' },
  ];

  it('returns different orders across multiple statuses without a filter', async () => {
    const findMany = vi.fn(async () => orders);
    const res = await request(appWith(findMany)).get('/orders').expect(200);

    expect(res.body).toEqual({ ok: true, orders });
    expect(findMany).toHaveBeenCalledWith({ where: undefined });
  });

  it.each([
    ['open', [orders[0]!]],
    ['accepted', [orders[1]!]],
    ['cancelled', [orders[2]!]],
  ] as const)(
    'returns only %s orders when filtered',
    async (status, filtered) => {
      const findMany = vi.fn(
        async ({ where }: { where?: { status: string } }) =>
          where ? [...filtered] : orders,
      );
      const res = await request(appWith(findMany))
        .get('/orders')
        .query({ status })
        .expect(200);

      expect(res.body).toEqual({ ok: true, orders: filtered });
      expect(findMany).toHaveBeenCalledWith({ where: { status } });
    },
  );

  it('returns 500 for an invalid status filter without querying the database', async () => {
    const findMany = vi.fn(async () => orders);
    await request(appWith(findMany))
      .get('/orders')
      .query({ status: 'not-a-status' })
      .expect(500, {
        ok: false,
        errors: 'Status provided is invalid.',
      });

    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns an empty list with success when no orders match', async () => {
    const findMany = vi.fn(async () => []);
    const res = await request(appWith(findMany))
      .get('/orders')
      .query({ status: 'expired' })
      .expect(200);

    expect(res.body).toEqual({ ok: true, orders: [] });
  });

  it('returns 500 when listing orders fails', async () => {
    const findMany = vi.fn(async () => {
      throw new Error('db down');
    });
    const res = await request(appWith(findMany)).get('/orders').expect(500);

    expect(res.body).toEqual({ ok: false, errors: {} });
  });
});

describe('POST /orders/:id/accept', () => {
  const orderId = '0192f0c4-0000-7000-8000-000000000001';
  const requesterId = '0192f0c4-0000-7000-8000-00000000000a';
  const courierId = '0192f0c4-0000-7000-8000-00000000000b';
  const otherCourier = '0192f0c4-0000-7000-8000-00000000000c';

  const openOrder = {
    id: orderId,
    status: 'open',
    requesterId,
    courierId: null,
    completeBy: null,
    version: 1,
  };

  function acceptApp(current: object, updatedRows = 1) {
    const updateMany = vi.fn(async () => ({ count: updatedRows }));
    const app = appWith(async () => [], {
      findUnique: async () => current,
      updateMany,
      findUniqueOrThrow: async () => ({
        ...current,
        status: 'accepted',
        courierId,
        version: 2,
      }),
    });
    return { app, updateMany };
  }

  it('200: assigns the accepting user as courier (F12.1.1, F12.1.4)', async () => {
    const { app, updateMany } = acceptApp(openOrder);
    const res = await request(app)
      .post(`/orders/${orderId}/accept`)
      .set('x-user-id', courierId)
      .expect(200);

    expect(res.body).toMatchObject({
      ok: true,
      order: { id: orderId, status: 'accepted', courierId },
    });
    // F12.2.1: conditional on the version read, with the server's clock.
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: orderId, version: 1 },
      data: {
        status: 'accepted',
        version: { increment: 1 },
        courierId,
        acceptedAt: expect.any(Date),
      },
    });
  });

  it('403 when the requester accepts their own order (F11.2.1)', async () => {
    const { app, updateMany } = acceptApp(openOrder);
    await request(app)
      .post(`/orders/${orderId}/accept`)
      .set('x-user-id', requesterId)
      .expect(403);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('409 when the order is past its complete-by (F11.2.2)', async () => {
    const { app, updateMany } = acceptApp({
      ...openOrder,
      completeBy: new Date('2000-01-01T00:00:00.000Z'),
    });
    const res = await request(app)
      .post(`/orders/${orderId}/accept`)
      .set('x-user-id', courierId)
      .expect(409);
    expect(res.body).toMatchObject({ ok: false, error: 'ORDER_EXPIRED' });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['expired', { status: 'expired' }],
    ['cancelled', { status: 'cancelled' }],
    ['still pending its credit reservation', { status: 'pending' }],
    [
      'already assigned (F11.2.3)',
      { status: 'accepted', courierId: otherCourier },
    ],
  ])('409 when the order is %s', async (_name, override) => {
    const { app, updateMany } = acceptApp({ ...openOrder, ...override });
    const res = await request(app)
      .post(`/orders/${orderId}/accept`)
      .set('x-user-id', courierId)
      .expect(409);
    expect(res.body).toMatchObject({ ok: false, error: 'INVALID_TRANSITION' });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('409 to the loser of a concurrent accept (F12.2.1)', async () => {
    const { app } = acceptApp(openOrder, 0);
    const res = await request(app)
      .post(`/orders/${orderId}/accept`)
      .set('x-user-id', courierId)
      .expect(409);
    expect(res.body).toMatchObject({ ok: false, error: 'ORDER_CONFLICT' });
  });

  it('401 when the authenticated identity is not a user id', async () => {
    const { app } = acceptApp(openOrder);
    await request(app)
      .post(`/orders/${orderId}/accept`)
      .set('x-user-id', 'not-a-uuid') // the test authenticate stub copies this to req.user
      .expect(401);
  });
});

describe('POST /orders/:id/pickup', () => {
  const orderId = '0192f0c4-0000-7000-8000-000000000001';
  const requesterId = '0192f0c4-0000-7000-8000-00000000000a';
  const courierId = '0192f0c4-0000-7000-8000-00000000000b';

  it('200 when the courier is allowed to pick up the order', async () => {
    const res = await request(
      appWith(async () => [], {
        findUnique: async () => ({
          id: orderId,
          status: 'accepted',
          requesterId,
          courierId,
          version: 3,
        }),
        updateMany: async () => ({ count: 1 }),
        findUniqueOrThrow: async () => ({
          id: orderId,
          status: 'picked_up',
          requesterId,
          courierId,
          version: 4,
        }),
      }),
    )
      .post(`/orders/${orderId}/pickup`)
      .set('x-user-id', courierId)
      .expect(200);

    expect(res.body).toMatchObject({
      ok: true,
      order: { id: orderId, status: 'picked_up', courierId },
    });
  });

  it('403 when the actor is not allowed to pick up the order', async () => {
    await request(
      appWith(async () => [], {
        findUnique: async () => ({
          id: orderId,
          status: 'accepted',
          requesterId,
          courierId,
          version: 3,
        }),
      }),
    )
      .post(`/orders/${orderId}/pickup`)
      .set('x-user-id', requesterId)
      .expect(403, { ok: false, error: 'FORBIDDEN' });
  });

  it('409 when the requested transition is not valid from the current status', async () => {
    await request(
      appWith(async () => [], {
        findUnique: async () => ({
          id: orderId,
          status: 'open',
          requesterId,
          courierId: null,
          version: 3,
        }),
      }),
    )
      .post(`/orders/${orderId}/deliver`)
      .set('x-user-id', courierId)
      .expect(409, { ok: false, error: 'INVALID_TRANSITION' });
  });
});

describe('POST /orders/:id/cancel', () => {
  const orderId = '0192f0c4-0000-7000-8000-000000000001';
  const requesterId = '0192f0c4-0000-7000-8000-00000000000a';
  const courierId = '0192f0c4-0000-7000-8000-00000000000b';

  it('200 when the requester cancels an open order', async () => {
    const res = await request(
      appWith(async () => [], {
        findUnique: async () => ({
          id: orderId,
          status: 'open',
          requesterId,
          courierId: null,
          version: 3,
        }),
        updateMany: async () => ({ count: 1 }),
        findUniqueOrThrow: async () => ({
          id: orderId,
          status: 'cancelled',
          requesterId,
          courierId: null,
          version: 4,
        }),
      }),
    )
      .post(`/orders/${orderId}/cancel`)
      .set('x-user-id', requesterId)
      .expect(200);

    expect(res.body).toMatchObject({
      ok: true,
      order: { id: orderId, status: 'cancelled' },
    });
  });

  it('200 when the requester cancels an ongoing order after complete-by', async () => {
    const res = await request(
      appWith(async () => [], {
        findUnique: async () => ({
          id: orderId,
          status: 'accepted',
          requesterId,
          courierId,
          completeBy: new Date('2000-01-01T00:00:00.000Z'),
          version: 3,
        }),
        updateMany: async () => ({ count: 1 }),
        findUniqueOrThrow: async () => ({
          id: orderId,
          status: 'cancelled',
          requesterId,
          courierId,
          version: 4,
        }),
      }),
    )
      .post(`/orders/${orderId}/cancel`)
      .set('x-user-id', requesterId)
      .expect(200);

    expect(res.body).toMatchObject({
      ok: true,
      order: { status: 'cancelled' },
    });
  });

  it('400 when an ongoing order has not reached complete-by', async () => {
    await request(
      appWith(async () => [], {
        findUnique: async () => ({
          id: orderId,
          status: 'accepted',
          requesterId,
          courierId,
          completeBy: new Date('2099-01-01T00:00:00.000Z'),
          version: 3,
        }),
      }),
    )
      .post(`/orders/${orderId}/cancel`)
      .set('x-user-id', requesterId)
      .expect(400, { ok: false, error: 'DEADLINE_NOT_REACHED' });
  });

  it('403 when a courier tries to cancel an order', async () => {
    await request(
      appWith(async () => [], {
        findUnique: async () => ({
          id: orderId,
          status: 'accepted',
          requesterId,
          courierId,
          completeBy: new Date('2000-01-01T00:00:00.000Z'),
          version: 3,
        }),
      }),
    )
      .post(`/orders/${orderId}/cancel`)
      .set('x-user-id', courierId)
      .expect(403, { ok: false, error: 'FORBIDDEN' });
  });
});
