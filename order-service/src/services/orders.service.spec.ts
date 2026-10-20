/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-09-27
 * Scope: Unit tests for team-authored createOrder validation rules and the
 *        F9.1.2 reserve-then-create flow.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Scope (2026-09-29): Added getOrders unit tests for unfiltered and status-filtered queries.
 * Author review: tng wen xi
 * Scope (2026-10-04): Updated getOrders unit tests for result objects, invalid
 *        status handling, and database-error results.
 * Author review: tng wen xi
 * Scope (2026-10-07): Added transitionOrder unit coverage for missing orders,
 *        forbidden actors, invalid edges, optimistic-lock conflicts, and success.
 * Author review:
 * Scope (2026-10-08): Added F17 cancellation transition coverage for open and
 *        deadline-reached requests, including deadline and actor failures.
 * Author review: tng wen xi
 * Scope (2026-10-12): Added edit-order coverage for unsupported fields and
 *        Prisma not-found errors.
 * Author review: tng wen xi
 * Scope (2026-10-12): Added edit-order optimistic-lock success and conflict
 *        coverage.
 * Author review: tng wen xi
 * Scope (2026-10-12): Added maintenance-worker coverage for system-actor
 *        completion, deadline expiry, and optimistic-lock races.
 * Author review: tng wen xi
 * Scope (2026-10-12): Updated create-order fixtures for additional-details
 *        validation and added edit-order not-found and forbidden coverage.
 * Author review: tng wen xi
 * Scope (2026-10-13): Added cancellation credit-release coverage.
 * Author review: tng wen xi
 * Scope (2026-10-13): Added deadline-boundary, missing-reservation, release
 *        failure, and terminal-state lifecycle coverage.
 * Author review: tng wen xi
 * Scope (2026-10-13): Updated fixtures for persisted reservation identifiers
 *        and credit release inputs.
 * Author review: tng wen xi
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope (2026-10-20): Issue #4 - createOrder now writes a pending order + credit_reserve
 *        outbox row in one transaction; cancel/expire of a funded order queues a
 *        credit_release outbox row in the transition's transaction instead of releasing
 *        inline by reservationId; `credits` is no longer editable. Rewrote the affected
 *        cases and added fakes for $transaction and outbox.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Issue #11 - fixtures use deliveryLocationId; getOrders cases moved
 *        to order-listing.service.spec.ts with the new listing.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): `failed` status - pending orders settle to `failed`; pending ->
 *        cancelled is no longer a transition.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { ErrorCode } from '../constants/errors.js';
import type { PrismaClient } from '../db/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  RequestStatus,
  type OrderRequest,
} from '../generated/prisma/client.js';
import type { CreateOrderPayload } from '../types/orders.js';
import {
  createOrder,
  editOrder,
  runRequestMaintenance,
  transitionOrder,
} from './orders.service.js';

const NOW = new Date('2026-09-27T12:00:00.000Z');
const LATER = '2099-09-27T14:00:00.000Z';
const EARLIER = '2026-09-27T10:00:00.000Z';

const REQUESTER = '0192f0c4-7a1e-7c3a-9b2d-3f4e5a6b7c8d';
const SUPPLIER = 1;
const OTHER_USER = '0192f0c4-7a1e-7c3a-9b2d-4f5e6a7b8c9d';

const valid: CreateOrderPayload = {
  supplierId: SUPPLIER,
  description: '1x chicken rice',
  deliveryLocationId: 12,
  credits: 4,
  additionalDetails: null,
};

function fakes({
  create = async ({ data }: { data: object }): Promise<object> => ({
    id: 'generated',
    version: 0,
    ...data,
  }),
  createOutbox = async (): Promise<{ count: number }> => ({ count: 1 }),
}: {
  create?: (args: { data: object }) => Promise<object>;
  createOutbox?: (args: { data: object[] }) => Promise<{ count: number }>;
} = {}) {
  const orderRequest = { create: vi.fn(create) };
  const outbox = { createMany: vi.fn(createOutbox) };
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prisma),
  );
  const prisma = { orderRequest, outbox, $transaction };
  return {
    prisma: prisma as unknown as PrismaClient,
    outbox,
    $transaction,
    create: orderRequest.create,
  };
}

type OutboxFake = { createMany: ReturnType<typeof vi.fn> };

/** Adds an interactive-$transaction fake (runs the callback on the same client) and an outbox. */
function withTx(fake: object): PrismaClient {
  const outbox: OutboxFake = { createMany: vi.fn(async () => ({ count: 1 })) };
  const prisma: Record<string, unknown> = { outbox, ...fake };
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prisma),
  );
  return prisma as unknown as PrismaClient;
}

function outboxOf(prisma: PrismaClient): OutboxFake {
  return (prisma as unknown as { outbox: OutboxFake }).outbox;
}

const releaseRow = (requestId: string, version: number) => ({
  data: [{ taskName: 'credit_release', payload: { requestId }, version }],
});

// Simulates an untyped JSON body (what Express actually hands us).
async function run(payload: object, deps: ReturnType<typeof fakes> = fakes()) {
  const result = await createOrder(
    deps.prisma,
    REQUESTER,
    payload as unknown as CreateOrderPayload,
  );
  return { result, ...deps };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('createOrder: validation', () => {
  it('creates the order with only the allowed fields', async () => {
    const { result, create } = await run({
      ...valid,
      completeBy: LATER,
      status: 'completed',
      courierId: REQUESTER,
      version: 99,
      additionalDetails: null,
    });

    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requesterId: REQUESTER,
        supplierId: SUPPLIER,
        description: '1x chicken rice',
        deliveryLocationId: 12,
        credits: 4,
        completeBy: new Date(LATER),
        additionalDetails: null,
        status: 'pending',
      }),
    });
  });

  it('reports every missing required field, without queueing a reservation', async () => {
    const { result, create, outbox } = await run({});
    expect(result).toEqual({
      ok: false,
      errors: [
        ErrorCode.MISSING_SUPPLIER,
        ErrorCode.MISSING_DESCRIPTION,
        ErrorCode.MISSING_DELIVERY_LOCATION,
        ErrorCode.MISSING_CREDITS_OFFERED,
        ErrorCode.INVALID_ADDITIONAL_DETAILS,
      ],
    });
    expect(outbox.createMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    [
      'supplierId not a positive integer',
      { supplierId: 's1' },
      ErrorCode.INVALID_SUPPLIER,
    ],
    [
      'description not text',
      { description: 123 },
      ErrorCode.INVALID_DESCRIPTION,
    ],
    [
      'description whitespace',
      { description: '   ' },
      ErrorCode.INVALID_DESCRIPTION,
    ],
    [
      'deliveryLocationId not an id',
      { deliveryLocationId: 'COM1 Basement' },
      ErrorCode.INVALID_DELIVERY_LOCATION,
    ],
    ['credits 0', { credits: 0 }, ErrorCode.INVALID_CREDITS_OFFERED],
    ['credits negative', { credits: -2 }, ErrorCode.INVALID_CREDITS_OFFERED],
    ['credits fractional', { credits: 1.5 }, ErrorCode.INVALID_CREDITS_OFFERED],
    ['credits as string', { credits: '5' }, ErrorCode.INVALID_CREDITS_OFFERED],
    [
      'completeBy garbage',
      { completeBy: 'tomorrow' },
      ErrorCode.INVALID_COMPLETE_BY,
    ],
    [
      'completeBy not a string',
      { completeBy: 123 },
      ErrorCode.INVALID_COMPLETE_BY,
    ],
    [
      'completeBy in the past (F9.1.1)',
      { completeBy: EARLIER },
      ErrorCode.COMPLETE_BY_IN_PAST,
    ],
    [
      'completeBy exactly now (F9.1.1)',
      { completeBy: NOW.toISOString() },
      ErrorCode.COMPLETE_BY_IN_PAST,
    ],
    [
      'additionalDetails not text',
      { additionalDetails: 5 },
      ErrorCode.INVALID_ADDITIONAL_DETAILS,
    ],
  ])('rejects %s', async (_name, override, code) => {
    const { result, create, outbox } = await run({ ...valid, ...override });
    expect(result).toEqual({ ok: false, errors: [code] });
    expect(outbox.createMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts null optional fields (completeBy null = indefinite)', async () => {
    const { result } = await run({
      ...valid,
      completeBy: null,
      additionalDetails: null,
    });
    expect(result.ok).toBe(true);
  });
});

describe('createOrder: pending order + reserve task (issue #4)', () => {
  it('creates the order as pending and queues its reservation in the same transaction', async () => {
    const deps = fakes();
    const { result } = await run(valid, deps);

    expect(result.ok).toBe(true);
    expect(deps.$transaction).toHaveBeenCalledTimes(1);
    expect(deps.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'pending', credits: 4 }),
    });
    // F9.1.2: approval waits on credit-service; the order id is the requestId.
    expect(deps.outbox.createMany).toHaveBeenCalledWith({
      data: [
        {
          taskName: 'credit_reserve',
          payload: { requestId: 'generated', userId: REQUESTER, amount: 4 },
          version: 0,
        },
      ],
    });
  });

  it('surfaces a failed outbox write (the transaction rolls the order back)', async () => {
    const deps = fakes({
      createOutbox: async () => {
        throw new Error('db down');
      },
    });
    await expect(run(valid, deps)).rejects.toThrow('db down');
  });
});

describe('editOrder', () => {
  function prismaWithEdit({ updatedRows = 1 } = {}) {
    const order = {
      id: 'order-1',
      requesterId: REQUESTER,
      version: 3,
    } as OrderRequest;
    const findUniqueOrThrow = vi.fn(async () => order);
    const updateMany = vi.fn(async () => ({ count: updatedRows }));
    const prisma = {
      orderRequest: { findUniqueOrThrow, updateMany },
    } as unknown as PrismaClient;
    return { findUniqueOrThrow, updateMany, prisma, order };
  }

  it('rejects unsupported fields before querying the database', async () => {
    const findUniqueOrThrow = vi.fn();
    const prisma = {
      orderRequest: { findUniqueOrThrow },
    } as unknown as PrismaClient;

    await expect(
      editOrder(prisma, REQUESTER, 'order-1', {
        description: 'Updated description',
        unsupported: true,
      } as never),
    ).resolves.toEqual({
      ok: false,
      errors: [ErrorCode.INVALID_FIELD],
    });
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('rejects editing credits, which are fixed at creation (issue #4)', async () => {
    const findUniqueOrThrow = vi.fn();
    const prisma = {
      orderRequest: { findUniqueOrThrow },
    } as unknown as PrismaClient;

    await expect(
      editOrder(prisma, REQUESTER, 'order-1', { credits: 8 }),
    ).resolves.toEqual({ ok: false, errors: [ErrorCode.INVALID_FIELD] });
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('updates only the fetched version and increments it', async () => {
    const { prisma, updateMany, findUniqueOrThrow, order } = prismaWithEdit();
    const updatedOrder = {
      ...order,
      description: 'Updated description',
      version: 4,
    };
    findUniqueOrThrow
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce(updatedOrder);

    await expect(
      editOrder(prisma, REQUESTER, order.id, {
        description: 'Updated description',
      }),
    ).resolves.toEqual({ ok: true, order: updatedOrder });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: order.id, version: order.version },
      data: {
        description: 'Updated description',
        version: { increment: 1 },
      },
    });
    expect(findUniqueOrThrow).toHaveBeenCalledTimes(2);
  });

  it('returns FORBIDDEN when the actor is not the requester', async () => {
    const { prisma, updateMany, order } = prismaWithEdit();

    await expect(
      editOrder(prisma, OTHER_USER, order.id, {
        description: 'Updated description',
      }),
    ).resolves.toEqual({
      ok: false,
      errors: [ErrorCode.FORBIDDEN],
    });

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('returns ORDER_CONFLICT when the fetched version is stale', async () => {
    const { prisma, updateMany, findUniqueOrThrow, order } = prismaWithEdit({
      updatedRows: 0,
    });

    await expect(
      editOrder(prisma, REQUESTER, order.id, {
        description: 'Updated description',
      }),
    ).resolves.toEqual({
      ok: false,
      errors: [ErrorCode.ORDER_CONFLICT],
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: order.id, version: order.version },
      data: {
        description: 'Updated description',
        version: { increment: 1 },
      },
    });
    expect(findUniqueOrThrow).toHaveBeenCalledTimes(1);
  });

  it('returns ORDER_NOT_FOUND when the order does not exist', async () => {
    const findUniqueOrThrow = vi.fn(async () => {
      throw new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: '7.10.0',
      });
    });
    const prisma = {
      orderRequest: { findUniqueOrThrow },
    } as unknown as PrismaClient;

    await expect(
      editOrder(prisma, REQUESTER, 'missing-order', {
        description: 'Updated description',
      }),
    ).resolves.toEqual({
      ok: false,
      errors: [ErrorCode.ORDER_NOT_FOUND],
    });
  });
});

describe('runRequestMaintenance', () => {
  it('queues a credit release in the same transaction as the expiry', async () => {
    const open = {
      id: 'open-order',
      status: 'open',
      requesterId: REQUESTER,
      courierId: null,
      version: 2,
      completeBy: new Date('2026-10-12T11:00:00.000Z'),
    } as OrderRequest;
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([open]);
    const findUnique = vi.fn().mockResolvedValueOnce(open);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = withTx({
      orderRequest: {
        findMany,
        findUnique,
        updateMany,
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...open,
          status: 'expired',
        }),
      },
    });
    const now = new Date('2026-10-12T12:00:00.000Z');

    await expect(runRequestMaintenance(prisma, now)).resolves.toEqual({
      completed: 0,
      expired: 1,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: open.id, version: open.version },
      data: { status: 'expired', version: { increment: 1 } },
    });
    expect(outboxOf(prisma).createMany).toHaveBeenCalledWith(
      releaseRow(open.id, 3),
    );
  });

  it('expires at the exact delivery deadline', async () => {
    const open = {
      id: 'open-order',
      status: 'open',
      requesterId: REQUESTER,
      courierId: null,
      version: 2,
      completeBy: new Date('2026-10-12T12:00:00.000Z'),
    } as OrderRequest;
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([open]);
    const prisma = withTx({
      orderRequest: {
        findMany,
        findUnique: vi.fn().mockResolvedValueOnce(open),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...open,
          status: 'expired',
        }),
      },
    });

    await expect(
      runRequestMaintenance(prisma, new Date('2026-10-12T12:00:00.000Z')),
    ).resolves.toEqual({ completed: 0, expired: 1 });
  });

  it('does not expire an open request before its delivery deadline', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const findUnique = vi.fn();
    const updateMany = vi.fn();
    const prisma = withTx({
      orderRequest: {
        findMany,
        findUnique,
        updateMany,
      },
    });

    await expect(
      runRequestMaintenance(prisma, new Date('2026-10-12T11:59:59.999Z')),
    ).resolves.toEqual({ completed: 0, expired: 0 });

    expect(findUnique).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('queues no release when expiry loses the optimistic-lock race', async () => {
    const open = {
      id: 'open-order',
      status: 'open',
      requesterId: REQUESTER,
      courierId: null,
      version: 2,
      completeBy: new Date('2026-10-12T11:00:00.000Z'),
    } as OrderRequest;
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([open]);
    const prisma = withTx({
      orderRequest: {
        findMany,
        findUnique: vi.fn().mockResolvedValueOnce(open),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });

    await expect(
      runRequestMaintenance(prisma, new Date('2026-10-12T12:00:00.000Z')),
    ).resolves.toEqual({ completed: 0, expired: 0 });

    expect(outboxOf(prisma).createMany).not.toHaveBeenCalled();
  });

  it('uses system transitions for delivered and expired requests', async () => {
    const delivered = {
      id: 'delivered-order',
      status: 'delivered',
      requesterId: REQUESTER,
      courierId: null,
      version: 1,
    } as OrderRequest;
    const open = {
      id: 'open-order',
      status: 'open',
      requesterId: REQUESTER,
      courierId: null,
      version: 2,
      completeBy: new Date('2026-10-12T11:00:00.000Z'),
    } as OrderRequest;
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([delivered])
      .mockResolvedValueOnce([open]);
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(delivered)
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce({ ...open, status: 'expired' });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = withTx({
      orderRequest: {
        findMany,
        findUnique,
        updateMany,
        findUniqueOrThrow: vi.fn(),
      },
    });
    const now = new Date('2026-10-12T12:00:00.000Z');

    await expect(runRequestMaintenance(prisma, now)).resolves.toEqual({
      completed: 1,
      expired: 1,
    });

    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: 'delivered',
        deliveredAt: { lte: new Date('2026-10-11T12:00:00.000Z') },
      },
    });
    expect(findMany).toHaveBeenNthCalledWith(2, {
      where: {
        status: 'open',
        completeBy: { not: null, lte: now },
      },
    });
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: delivered.id, version: delivered.version },
      data: {
        status: 'completed',
        version: { increment: 1 },
      },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: open.id, version: open.version },
      data: {
        status: 'expired',
        version: { increment: 1 },
      },
    });
  });

  it('does not count a transition that loses an optimistic-lock race', async () => {
    const delivered = {
      id: 'delivered-order',
      status: 'delivered',
      requesterId: REQUESTER,
      courierId: null,
      version: 1,
    } as OrderRequest;
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([delivered])
      .mockResolvedValueOnce([]);
    const prisma = withTx({
      orderRequest: {
        findMany,
        findUnique: vi.fn().mockResolvedValue(delivered),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });

    await expect(
      runRequestMaintenance(prisma, new Date('2026-10-12T12:00:00.000Z')),
    ).resolves.toEqual({
      completed: 0,
      expired: 0,
    });
  });
});

describe('transitionOrder', () => {
  const orderId = '0192f0c4-0000-7000-8000-000000000001';
  const requesterId = '0192f0c4-0000-7000-8000-00000000000a';
  const courierId = '0192f0c4-0000-7000-8000-00000000000b';

  function prismaWithTransition(
    current: Partial<OrderRequest> | null,
    { updatedRows = 1 } = {},
  ) {
    const row =
      current && ({ id: orderId, version: 3, ...current } as OrderRequest);
    const orderRequest = {
      findUnique: vi.fn(async () => row),
      updateMany: vi.fn(async () => ({ count: updatedRows })),
      findUniqueOrThrow: vi.fn(async () => ({ ...row, status: 'picked_up' })),
    };

    return {
      prisma: withTx({ orderRequest }),
      orderRequest,
    };
  }

  it('returns ORDER_NOT_FOUND when the order does not exist', async () => {
    const { prisma, orderRequest } = prismaWithTransition(null);

    await expect(
      transitionOrder(prisma, orderId, 'accepted', courierId),
    ).resolves.toEqual({ ok: false, error: ErrorCode.ORDER_NOT_FOUND });
    expect(orderRequest.updateMany).not.toHaveBeenCalled();
  });

  it('returns INVALID_TRANSITION when the status edge is not allowed', async () => {
    const { prisma, orderRequest } = prismaWithTransition({
      status: 'open',
      requesterId,
      courierId: null,
    });

    await expect(
      transitionOrder(prisma, orderId, 'delivered', courierId),
    ).resolves.toEqual({ ok: false, error: ErrorCode.INVALID_TRANSITION });
    expect(orderRequest.updateMany).not.toHaveBeenCalled();
  });

  it('returns FORBIDDEN when the actor is not allowed to transition the order', async () => {
    const { prisma, orderRequest } = prismaWithTransition({
      status: 'open',
      requesterId,
      courierId: null,
    });

    await expect(
      transitionOrder(prisma, orderId, 'accepted', requesterId),
    ).resolves.toEqual({ ok: false, error: ErrorCode.FORBIDDEN });
    expect(orderRequest.updateMany).not.toHaveBeenCalled();
  });

  it('updates the order and sets the courier and acceptedAt values', async () => {
    const { prisma, orderRequest } = prismaWithTransition({
      status: 'open',
      requesterId,
      courierId: null,
    });

    const result = await transitionOrder(
      prisma,
      orderId,
      'accepted',
      courierId,
    );

    expect(orderRequest.updateMany).toHaveBeenCalledWith({
      where: { id: orderId, version: 3 },
      data: {
        status: 'accepted',
        version: { increment: 1 },
        courierId,
        acceptedAt: expect.any(Date),
      },
    });
    expect(result).toMatchObject({ ok: true, order: { status: 'picked_up' } });
  });

  it('allows the requester to cancel an open order', async () => {
    const { prisma, orderRequest } = prismaWithTransition({
      status: 'open',
      requesterId,
      courierId: null,
    });

    const result = await transitionOrder(
      prisma,
      orderId,
      'cancelled',
      requesterId,
    );

    expect(orderRequest.updateMany).toHaveBeenCalledWith({
      where: { id: orderId, version: 3 },
      data: {
        status: 'cancelled',
        version: { increment: 1 },
      },
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('queues a credit release with a successful cancellation of a funded order', async () => {
    const { prisma } = prismaWithTransition({
      status: 'open',
      requesterId,
      courierId: null,
    });

    await expect(
      transitionOrder(
        prisma,
        orderId,
        'cancelled',
        requesterId,
        new Date('2026-10-13T12:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ ok: true });

    expect(outboxOf(prisma).createMany).toHaveBeenCalledWith(
      releaseRow(orderId, 4),
    );
  });

  it('queues no release when cancellation loses the optimistic-lock race', async () => {
    const { prisma, orderRequest } = prismaWithTransition(
      {
        status: 'open',
        requesterId,
        courierId: null,
      },
      { updatedRows: 0 },
    );

    await expect(
      transitionOrder(
        prisma,
        orderId,
        'cancelled',
        requesterId,
        new Date('2026-10-13T12:00:00.000Z'),
      ),
    ).resolves.toEqual({ ok: false, error: ErrorCode.ORDER_CONFLICT });

    expect(outboxOf(prisma).createMany).not.toHaveBeenCalled();
    expect(orderRequest.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('queues no credit task for transitions that do not end the order', async () => {
    const { prisma } = prismaWithTransition({
      status: 'open',
      requesterId,
      courierId: null,
    });

    await transitionOrder(prisma, orderId, 'accepted', courierId);

    expect(outboxOf(prisma).createMany).not.toHaveBeenCalled();
  });

  it('fails a pending order without a release unless asked (permanent reserve failure)', async () => {
    const { prisma } = prismaWithTransition({
      status: 'pending',
      requesterId,
      courierId: null,
    });

    await expect(
      transitionOrder(prisma, orderId, 'failed', 'system'),
    ).resolves.toMatchObject({ ok: true });
    expect(outboxOf(prisma).createMany).not.toHaveBeenCalled();
  });

  it('fails a pending order with a release when asked (reserve retries exhausted)', async () => {
    const { prisma } = prismaWithTransition({
      status: 'pending',
      requesterId,
      courierId: null,
    });

    await expect(
      transitionOrder(prisma, orderId, 'failed', 'system', new Date(), {
        releaseCredits: true,
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(outboxOf(prisma).createMany).toHaveBeenCalledWith(
      releaseRow(orderId, 4),
    );
  });

  it('only lets the system settle a pending order', async () => {
    const { prisma, orderRequest } = prismaWithTransition({
      status: 'pending',
      requesterId,
      courierId: null,
    });

    await expect(
      transitionOrder(prisma, orderId, 'failed', requesterId),
    ).resolves.toEqual({ ok: false, error: ErrorCode.FORBIDDEN });
    await expect(
      transitionOrder(prisma, orderId, 'cancelled', 'system'),
    ).resolves.toEqual({ ok: false, error: ErrorCode.INVALID_TRANSITION });
    await expect(
      transitionOrder(prisma, orderId, 'accepted', courierId),
    ).resolves.toEqual({ ok: false, error: ErrorCode.INVALID_TRANSITION });
    expect(orderRequest.updateMany).not.toHaveBeenCalled();
  });

  it('cancels at the exact complete-by deadline', async () => {
    const deadline = new Date('2026-10-13T12:00:00.000Z');
    const { prisma } = prismaWithTransition({
      status: 'accepted',
      requesterId,
      courierId,
      completeBy: deadline,
    });

    await expect(
      transitionOrder(prisma, orderId, 'cancelled', requesterId, deadline),
    ).resolves.toMatchObject({ ok: true });
  });

  it('rejects ongoing cancellation when complete-by is missing', async () => {
    const { prisma, orderRequest } = prismaWithTransition({
      status: 'picked_up',
      requesterId,
      courierId,
      completeBy: null,
    });

    await expect(
      transitionOrder(
        prisma,
        orderId,
        'cancelled',
        requesterId,
        new Date('2026-10-13T12:00:00.000Z'),
      ),
    ).resolves.toEqual({
      ok: false,
      error: ErrorCode.DEADLINE_NOT_REACHED,
    });
    expect(orderRequest.updateMany).not.toHaveBeenCalled();
  });

  it.each(['completed', 'expired', 'cancelled'] as RequestStatus[])(
    'rejects cancellation from terminal status %s',
    async (status) => {
      const { prisma, orderRequest } = prismaWithTransition({
        status,
        requesterId,
        courierId,
        completeBy: new Date('2026-10-13T10:00:00.000Z'),
      });

      await expect(
        transitionOrder(
          prisma,
          orderId,
          'cancelled',
          requesterId,
          new Date('2026-10-13T12:00:00.000Z'),
        ),
      ).resolves.toEqual({
        ok: false,
        error: ErrorCode.INVALID_TRANSITION,
      });
      expect(orderRequest.updateMany).not.toHaveBeenCalled();
    },
  );

  it('rejects cancelling a non-open order before its complete-by deadline', async () => {
    const { prisma, orderRequest } = prismaWithTransition({
      status: 'accepted',
      requesterId,
      courierId,
      completeBy: new Date('2026-10-08T14:00:00.000Z'),
    });

    await expect(
      transitionOrder(
        prisma,
        orderId,
        'cancelled',
        requesterId,
        new Date('2026-10-08T12:00:00.000Z'),
      ),
    ).resolves.toEqual({ ok: false, error: ErrorCode.DEADLINE_NOT_REACHED });
    expect(orderRequest.updateMany).not.toHaveBeenCalled();
  });

  it('allows the requester to cancel a non-open order after its complete-by deadline', async () => {
    const { prisma, orderRequest } = prismaWithTransition({
      status: 'accepted',
      requesterId,
      courierId,
      completeBy: new Date('2026-10-08T11:00:00.000Z'),
    });

    const result = await transitionOrder(
      prisma,
      orderId,
      'cancelled',
      requesterId,
      new Date('2026-10-08T12:00:00.000Z'),
    );

    expect(orderRequest.updateMany).toHaveBeenCalledWith({
      where: { id: orderId, version: 3 },
      data: {
        status: 'cancelled',
        version: { increment: 1 },
      },
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('does not allow a courier to cancel a request after its deadline', async () => {
    const { prisma, orderRequest } = prismaWithTransition({
      status: 'accepted',
      requesterId,
      courierId,
      completeBy: new Date('2026-10-08T11:00:00.000Z'),
    });

    await expect(
      transitionOrder(
        prisma,
        orderId,
        'cancelled',
        courierId,
        new Date('2026-10-08T12:00:00.000Z'),
      ),
    ).resolves.toEqual({ ok: false, error: ErrorCode.FORBIDDEN });
    expect(orderRequest.updateMany).not.toHaveBeenCalled();
  });

  it('returns ORDER_CONFLICT when optimistic locking fails', async () => {
    const { prisma, orderRequest } = prismaWithTransition(
      {
        status: 'open',
        requesterId,
        courierId: null,
      },
      { updatedRows: 0 },
    );

    await expect(
      transitionOrder(prisma, orderId, 'accepted', courierId),
    ).resolves.toEqual({ ok: false, error: ErrorCode.ORDER_CONFLICT });
    expect(orderRequest.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
