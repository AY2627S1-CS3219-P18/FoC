/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope: Issue #4 - unit tests for the credit_reserve / credit_release job handlers:
 *        each branch of George's saga decisions (success, permanent failure, transient
 *        retry, retries exhausted) and release outcomes.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Issue #6 - outcomes asserted as published order events (rooms and
 *        payload) instead of the removed log-only notifier.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { UnrecoverableError } from 'bullmq';
import type {
  CreditCallResult,
  CreditsClient,
} from '../clients/credits.client.js';
import type { PrismaClient } from '../db/prisma.js';
import type { OrderRequest } from '../generated/prisma/client.js';
import type {
  OrderEvent,
  OrderEventPublisher,
} from '../realtime/order-events.js';
import {
  createCreditJobProcessor,
  isFinalFailure,
  type CreditJob,
} from './credit-jobs.js';

const ORDER_ID = '0192f0c4-0000-7000-8000-000000000001';
const REQUESTER = '0192f0c4-0000-7000-8000-00000000000a';
const NOW = new Date('2026-10-20T12:00:00.000Z');

const reservePayload = { requestId: ORDER_ID, userId: REQUESTER, amount: 4 };

function job(
  name: string,
  data: unknown,
  { attemptsMade = 0, attempts = 5 } = {},
): CreditJob {
  return { id: 'outbox-1', name, data, attemptsMade, opts: { attempts } };
}

/** Fake Prisma whose order row changes status when transitionOrder writes it. */
function setup(
  status: OrderRequest['status'] | null,
  reserveResult: CreditCallResult = { ok: true },
  releaseResult: CreditCallResult = { ok: true },
) {
  let row: OrderRequest | null =
    status &&
    ({
      id: ORDER_ID,
      requesterId: REQUESTER,
      courierId: null,
      status,
      version: 0,
      updatedAt: NOW,
      createdAt: NOW,
      completeBy: null,
      supplierId: 9,
      description: '1x chicken rice',
      deliveryLocationId: 12,
      credits: 4,
      additionalDetails: null,
    } as OrderRequest);

  const outbox = { createMany: vi.fn(async () => ({ count: 1 })) };
  const orderRequest = {
    findUnique: vi.fn(async () => row),
    findUniqueOrThrow: vi.fn(async () => row),
    updateMany: vi.fn(
      async (args: {
        where: { version?: number };
        data: { status?: string };
      }) => {
        if (row && args.data.status && args.where.version === row.version) {
          row = {
            ...row,
            status: args.data.status as OrderRequest['status'],
            version: row.version + 1,
          };
        }
        return { count: 1 };
      },
    ),
  };
  const prisma: Record<string, unknown> = { orderRequest, outbox };
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prisma),
  );

  const reserve = vi.fn(async () => reserveResult);
  const release = vi.fn(async () => releaseResult);
  const published: OrderEvent[] = [];
  const publish = vi.fn(async (events: OrderEvent[]) => {
    published.push(...events);
  });
  const credits: CreditsClient = { reserve, release };
  const events: OrderEventPublisher = { publish };
  const processJob = createCreditJobProcessor({
    prisma: prisma as unknown as PrismaClient,
    credits,
    events,
    clock: () => NOW,
    log: () => {},
  });
  return {
    processJob,
    reserve,
    release,
    published,
    outbox,
    orderRequest,
    row: () => row,
  };
}

describe('credit_reserve', () => {
  it('opens the order and notifies the requester when credits are reserved', async () => {
    const t = setup('pending');
    await t.processJob(job('credit_reserve', reservePayload));

    expect(t.reserve).toHaveBeenCalledWith(reservePayload);
    expect(t.row()?.status).toBe('open');
    expect(t.published).toEqual([
      expect.objectContaining({
        name: 'order:created',
        rooms: [`user:${REQUESTER}`, 'listing'],
        payload: expect.objectContaining({
          orderId: ORDER_ID,
          status: 'open',
          version: 1,
          occurredAt: NOW.toISOString(),
          order: expect.objectContaining({
            deliveryLocationId: 12,
            credits: 4,
          }),
        }),
      }),
    ]);
    expect(t.outbox.createMany).not.toHaveBeenCalled();
  });

  it('cancels without a release and passes the failure on a permanent failure', async () => {
    const t = setup('pending', {
      ok: false,
      kind: 'permanent',
      status: 422,
      code: 'INSUFFICIENT_UNRESERVED_CREDITS',
    });
    await t.processJob(job('credit_reserve', reservePayload));

    expect(t.row()?.status).toBe('cancelled');
    expect(t.outbox.createMany).not.toHaveBeenCalled();
    expect(t.published).toEqual([
      expect.objectContaining({
        name: 'order:cancelled',
        rooms: [`user:${REQUESTER}`],
        payload: expect.objectContaining({
          reason: 'INSUFFICIENT_UNRESERVED_CREDITS',
        }),
      }),
    ]);
  });

  it('throws to retry a transient failure, leaving the order pending', async () => {
    const t = setup('pending', {
      ok: false,
      kind: 'transient',
      code: 'fetch failed',
    });
    await expect(
      t.processJob(job('credit_reserve', reservePayload, { attemptsMade: 2 })),
    ).rejects.toThrow('transient');

    expect(t.row()?.status).toBe('pending');
    expect(t.published).toEqual([]);
  });

  it('on the last attempt cancels, queues a release, notifies, and fails the job', async () => {
    const t = setup('pending', {
      ok: false,
      kind: 'transient',
      status: 503,
      code: 'X',
    });
    await expect(
      t.processJob(job('credit_reserve', reservePayload, { attemptsMade: 4 })),
    ).rejects.toThrow('retries exhausted');

    expect(t.row()?.status).toBe('cancelled');
    expect(t.outbox.createMany).toHaveBeenCalledWith({
      data: [
        {
          taskName: 'credit_release',
          payload: { requestId: ORDER_ID },
          version: 1,
        },
      ],
    });
    expect(t.published).toEqual([
      expect.objectContaining({
        name: 'order:cancelled',
        payload: expect.objectContaining({
          reason: 'RESERVE_RETRIES_EXHAUSTED',
        }),
      }),
    ]);
  });

  it('does nothing when the order was already settled (duplicate job)', async () => {
    const t = setup('open');
    await t.processJob(job('credit_reserve', reservePayload));
    expect(t.reserve).not.toHaveBeenCalled();
    expect(t.published).toEqual([]);
  });

  it('rejects a bad payload or a missing order without retries', async () => {
    const t = setup(null);
    await expect(
      t.processJob(job('credit_reserve', { requestId: ORDER_ID })),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(
      t.processJob(job('credit_reserve', reservePayload)),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});

describe('credit_release', () => {
  it('stamps creditReleasedAt once credit-service confirms', async () => {
    const t = setup('cancelled');
    await t.processJob(job('credit_release', { requestId: ORDER_ID }));

    expect(t.release).toHaveBeenCalledWith({ requestId: ORDER_ID });
    expect(t.orderRequest.updateMany).toHaveBeenCalledWith({
      where: { id: ORDER_ID, creditReleasedAt: null },
      data: { creditReleasedAt: NOW },
    });
  });

  it('throws to retry a transient failure', async () => {
    const t = setup(
      'cancelled',
      { ok: true },
      {
        ok: false,
        kind: 'transient',
        code: 'fetch failed',
      },
    );
    await expect(
      t.processJob(job('credit_release', { requestId: ORDER_ID })),
    ).rejects.not.toBeInstanceOf(UnrecoverableError);
    expect(t.orderRequest.updateMany).not.toHaveBeenCalled();
  });

  it('fails without retries on a permanent rejection', async () => {
    const t = setup(
      'cancelled',
      { ok: true },
      {
        ok: false,
        kind: 'permanent',
        status: 409,
        code: 'ALREADY_TRANSFERRED',
      },
    );
    await expect(
      t.processJob(job('credit_release', { requestId: ORDER_ID })),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});

describe('unknown tasks and final failures', () => {
  it('rejects an unknown task name without retries', async () => {
    const t = setup('pending');
    await expect(t.processJob(job('credit_adjust', {}))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('isFinalFailure: true when retries are used up or the error is unrecoverable', () => {
    expect(
      isFinalFailure(job('x', {}, { attemptsMade: 5 }), new Error('e')),
    ).toBe(true);
    expect(
      isFinalFailure(job('x', {}, { attemptsMade: 3 }), new Error('e')),
    ).toBe(false);
    expect(
      isFinalFailure(
        job('x', {}, { attemptsMade: 1 }),
        new UnrecoverableError('e'),
      ),
    ).toBe(true);
  });
});
