/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-09-27
 * Scope: Unit tests for team-authored createOrder validation rules and the
 *        F9.1.2 reserve-then-create flow.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Scope (2026-09-29): Added getOrders unit tests for unfiltered and status-filtered queries.
 * Author review: tng wen xi
 */

import type {
  CreditsClient,
  ReserveResult,
} from '../clients/credits.client.js';
import { ErrorCode } from '../constants/errors.js';
import type { PrismaClient } from '../db/prisma.js';
import type { CreateOrderPayload } from '../types/orders.js';
import { createOrder, getOrders } from './orders.service.js';

const NOW = new Date('2026-09-27T12:00:00.000Z');
const LATER = '2026-09-27T14:00:00.000Z';
const EARLIER = '2026-09-27T10:00:00.000Z';

const REQUESTER = '0192f0c4-7a1e-7c3a-9b2d-3f4e5a6b7c8d';
const SUPPLIER = '0192f0c4-7a1e-7c3a-9b2d-000000000001';

const valid: CreateOrderPayload = {
  supplierId: SUPPLIER,
  description: '1x chicken rice',
  deliveryLocation: 'COM1 Basement',
  credits: 4,
};

function fakes({
  reserve = async (): Promise<ReserveResult> => ({
    ok: true,
    reservationId: 'res-1',
  }),
  create = async ({ data }: { data: object }): Promise<object> => ({
    id: 'generated',
    ...data,
  }),
}: {
  reserve?: CreditsClient['reserve'];
  create?: (args: { data: object }) => Promise<object>;
} = {}) {
  const credits = { reserve: vi.fn(reserve), release: vi.fn(async () => {}) };
  const orderRequest = { create: vi.fn(create) };
  return {
    prisma: { orderRequest } as unknown as PrismaClient,
    credits,
    create: orderRequest.create,
  };
}

// Simulates an untyped JSON body (what Express actually hands us).
async function run(payload: object, deps: ReturnType<typeof fakes> = fakes()) {
  const result = await createOrder(
    deps.prisma,
    deps.credits,
    REQUESTER,
    payload as unknown as CreateOrderPayload,
    NOW,
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
    });

    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: {
        requesterId: REQUESTER,
        supplierId: SUPPLIER,
        description: '1x chicken rice',
        deliveryLocation: 'COM1 Basement',
        credits: 4,
        completeBy: new Date(LATER),
        additionalDetails: null,
      },
    });
  });

  it('reports every missing required field, without reserving credits', async () => {
    const { result, create, credits } = await run({});
    expect(result).toEqual({
      ok: false,
      errors: [
        ErrorCode.MISSING_SUPPLIER,
        ErrorCode.MISSING_DESCRIPTION,
        ErrorCode.MISSING_DELIVERY_LOCATION,
        ErrorCode.MISSING_CREDITS_OFFERED,
      ],
    });
    expect(credits.reserve).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ['supplierId not a UUID', { supplierId: 's1' }, ErrorCode.INVALID_SUPPLIER],
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
      'deliveryLocation not text',
      { deliveryLocation: {} },
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
    const { result, create, credits } = await run({ ...valid, ...override });
    expect(result).toEqual({ ok: false, errors: [code] });
    expect(credits.reserve).not.toHaveBeenCalled();
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

describe('createOrder: credit reservation (F9.1.2)', () => {
  it('reserves the offered credits before creating the request', async () => {
    const deps = fakes();
    const order: string[] = [];
    deps.credits.reserve.mockImplementation(async () => {
      order.push('reserve');
      return { ok: true, reservationId: 'res-1' };
    });
    deps.create.mockImplementation(async ({ data }) => {
      order.push('create');
      return { id: 'generated', ...data };
    });

    const { result } = await run(valid, deps);

    expect(result.ok).toBe(true);
    expect(deps.credits.reserve).toHaveBeenCalledWith({
      requesterId: REQUESTER,
      amount: 4,
    });
    expect(order).toEqual(['reserve', 'create']);
  });

  it('does not create the request when credits are insufficient', async () => {
    const { result, create } = await run(
      valid,
      fakes({
        reserve: async () => ({ ok: false, reason: 'INSUFFICIENT_CREDITS' }),
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: [ErrorCode.INSUFFICIENT_CREDITS],
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('does not create the request when credit-service says unavailable', async () => {
    const { result, create } = await run(
      valid,
      fakes({ reserve: async () => ({ ok: false, reason: 'UNAVAILABLE' }) }),
    );
    expect(result).toEqual({
      ok: false,
      errors: [ErrorCode.CREDIT_SERVICE_UNAVAILABLE],
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('treats a crashing credit-service call as unavailable', async () => {
    const { result, create } = await run(
      valid,
      fakes({
        reserve: async () => {
          throw new Error('ECONNREFUSED');
        },
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: [ErrorCode.CREDIT_SERVICE_UNAVAILABLE],
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('releases the reservation if saving the request fails', async () => {
    const deps = fakes({
      create: async () => {
        throw new Error('db down');
      },
    });
    await expect(run(valid, deps)).rejects.toThrow('db down');
    expect(deps.credits.release).toHaveBeenCalledWith('res-1');
  });

  it('still surfaces the original error if releasing also fails', async () => {
    const deps = fakes({
      create: async () => {
        throw new Error('db down');
      },
    });
    deps.credits.release.mockRejectedValue(new Error('credit-service down'));
    await expect(run(valid, deps)).rejects.toThrow('db down');
  });
});

describe('getOrders', () => {
  const orders = [
    { id: 'open-1', status: 'open', description: 'Chicken rice' },
    { id: 'accepted-1', status: 'accepted', description: 'Coffee' },
    { id: 'delivered-1', status: 'delivered', description: 'Textbooks' },
  ];

  function prismaWithFindMany() {
    const findMany = vi.fn();
    const prisma = {
      orderRequest: { findMany },
    } as unknown as PrismaClient;
    return { findMany, prisma };
  }

  it('returns all orders when no status filter is provided', async () => {
    const { findMany, prisma } = prismaWithFindMany();
    findMany.mockResolvedValue(orders);

    await expect(getOrders(prisma, undefined)).resolves.toEqual(orders);
    expect(findMany).toHaveBeenCalledWith({ where: undefined });
  });

  it.each([
    ['open', [orders[0]]],
    ['accepted', [orders[1]]],
    ['delivered', [orders[2]]],
  ] as const)(
    'passes the %s status filter to Prisma',
    async (status, result) => {
      const { findMany, prisma } = prismaWithFindMany();
      findMany.mockResolvedValue(result);

      await expect(getOrders(prisma, status)).resolves.toEqual(result);
      expect(findMany).toHaveBeenCalledWith({ where: { status } });
    },
  );

  it('returns an empty list when no orders match the status filter', async () => {
    const { findMany, prisma } = prismaWithFindMany();
    findMany.mockResolvedValue([]);

    await expect(getOrders(prisma, 'cancelled')).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({ where: { status: 'cancelled' } });
  });

  it('propagates database errors', async () => {
    const { findMany, prisma } = prismaWithFindMany();
    const error = new Error('db down');
    findMany.mockRejectedValue(error);

    await expect(getOrders(prisma, undefined)).rejects.toBe(error);
  });
});
