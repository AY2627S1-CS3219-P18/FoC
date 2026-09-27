/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-09-27
 * Scope: Unit tests for team-authored createOrder validation rules.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 */

import { ErrorCode } from '../constants/errors.js';
import type { PrismaClient } from '../db/prisma.js';
import type { CreateOrderPayload } from '../types/orders.js';
import { createOrder } from './orders.service.js';

const REQUESTER = '0192f0c4-7a1e-7c3a-9b2d-3f4e5a6b7c8d';
const SUPPLIER = '0192f0c4-7a1e-7c3a-9b2d-000000000001';

const valid: CreateOrderPayload = {
  supplierId: SUPPLIER,
  description: '1x chicken rice',
  deliveryLocation: 'COM1 Basement',
  credits: 4,
};

function fakePrisma() {
  const create = vi.fn(async ({ data }: { data: object }) => ({
    id: 'generated',
    ...data,
  }));
  return {
    prisma: { orderRequest: { create } } as unknown as PrismaClient,
    create,
  };
}

// Simulates an untyped JSON body (what Express actually hands us).
const run = (payload: Record<string, unknown>) => {
  const { prisma, create } = fakePrisma();
  return createOrder(
    prisma,
    REQUESTER,
    payload as unknown as CreateOrderPayload,
  ).then((result) => ({ result, create }));
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('createOrder', () => {
  it('creates the order with only the allowed fields', async () => {
    const { result, create } = await run({
      ...valid,
      completeBy: '2026-09-27T12:00:00.000Z',
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
        completeBy: new Date('2026-09-27T12:00:00.000Z'),
        additionalDetails: null,
      },
    });
  });

  it('reports every missing required field', async () => {
    const { result, create } = await run({});
    expect(result).toEqual({
      ok: false,
      errors: [
        ErrorCode.MISSING_SUPPLIER,
        ErrorCode.MISSING_DESCRIPTION,
        ErrorCode.MISSING_DELIVERY_LOCATION,
        ErrorCode.MISSING_CREDITS_OFFERED,
      ],
    });
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
      'additionalDetails not text',
      { additionalDetails: 5 },
      ErrorCode.INVALID_ADDITIONAL_DETAILS,
    ],
  ])('rejects %s', async (_name, override, code) => {
    const { result, create } = await run({ ...valid, ...override });
    expect(result).toEqual({ ok: false, errors: [code] });
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts null optional fields', async () => {
    const { result } = await run({
      ...valid,
      completeBy: null,
      additionalDetails: null,
    });
    expect(result.ok).toBe(true);
  });
});
