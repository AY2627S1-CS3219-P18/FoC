/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope: Issue #4 - end-to-end test of the credit-reservation saga against a real
 *        Postgres (migrations applied): createOrder -> outbox -> relay -> reserve job ->
 *        open, and cancel -> release job -> creditReleasedAt, plus the failure paths.
 *        Credit-service and Redis are faked (HTTP client and BullMQ queue stand-ins).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Scope (2026-10-20): Issue #11 - listing against the real database: every page of every
 *        sort walked end to end (no gaps, no duplicates, nulls last/first), filters, and
 *        pending orders hidden.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Scope (2026-10-20): Issue #5 - concurrent accepts against the real database: exactly
 *        one courier wins (F12.2.1), the rest get ORDER_CONFLICT or INVALID_TRANSITION.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Scope (2026-10-20): Added coverage for the re-drive of transient credit_release
 *        dead letters (George, 2026-10-20).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Scope (2026-10-20): `failed` status - reservation failures end in `failed`.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 */

import { config as loadDotenv } from 'dotenv';
import type {
  CreditCallResult,
  CreditsClient,
} from '../src/clients/credits.client.js';
import { loadEnv } from '../src/config/env.js';
import { createDeadLetterRepository } from '../src/db/dead-letter.repository.js';
import { createOutboxRepository } from '../src/db/outbox.repository.js';
import { createPrismaClient } from '../src/db/prisma.js';
import type { QueuedJob } from '../src/queue/bull-queue.js';
import {
  createOrder,
  transitionOrder,
} from '../src/services/orders.service.js';
import {
  createCreditJobProcessor,
  type CreditJob,
} from '../src/worker/credit-jobs.js';
import { createOutboxRelay } from '../src/worker/outbox-relay.js';
import { createReleaseRedrive } from '../src/worker/release-redrive.js';
import type {
  OrderEvent,
  OrderEventPublisher,
} from '../src/realtime/order-events.js';
import {
  listOrders,
  PAGE_SIZE,
} from '../src/services/order-listing.service.js';

// Requires a migrated Postgres at DATABASE_URL (e.g. `docker compose up -d order-db`).
loadDotenv({ quiet: true });
const prisma = createPrismaClient(loadEnv().DATABASE_URL);

const REQUESTER = '0192f0c4-0000-7000-8000-00000000000a';
const SUPPLIER = 1; // supplier-service integer id
const payload = {
  supplierId: SUPPLIER,
  description: '1x chicken rice',
  deliveryLocationId: 12,
  credits: 4,
  additionalDetails: null,
};

/** Relay into an in-memory list instead of Redis, then run each job like BullMQ would. */
function harness(
  reserve: () => CreditCallResult,
  release = (): CreditCallResult => ({ ok: true }),
) {
  const queued: QueuedJob[] = [];
  const releaseMock = vi.fn(async () => release());
  const credits: CreditsClient = {
    reserve: vi.fn(async () => reserve()),
    release: releaseMock,
  };
  const published: OrderEvent[] = [];
  const events: OrderEventPublisher = {
    publish: async (batch) => void published.push(...batch),
  };
  const relayOnce = createOutboxRelay({
    outbox: createOutboxRepository(prisma),
    queue: {
      enqueue: async (_key, job) => void queued.push(job),
      close: async () => {},
    },
    deadLetters: createDeadLetterRepository(prisma),
    log: () => {},
  });
  const processJob = createCreditJobProcessor({
    prisma,
    credits,
    events,
    log: () => {},
  });
  async function drain(attemptsMade = 0) {
    await relayOnce();
    const jobs = queued.splice(0);
    for (const j of jobs) {
      const job: CreditJob = {
        id: j.id,
        name: j.taskName,
        data: j.payload,
        attemptsMade,
        opts: { attempts: 5 },
      };
      await processJob(job).catch(() => {});
    }
    return jobs;
  }
  return { releaseMock, published, drain };
}

beforeEach(async () => {
  await prisma.outbox.deleteMany();
  await prisma.deadLetterJob.deleteMany();
  await prisma.orderRequest.deleteMany();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('credit reservation saga (e2e)', () => {
  it('creates a pending order with its reserve task in one commit', async () => {
    const result = await createOrder(prisma, REQUESTER, payload);
    if (!result.ok) throw new Error('create failed');

    expect(result.order.status).toBe('pending');
    const rows = await prisma.outbox.findMany();
    expect(rows).toEqual([
      expect.objectContaining({
        taskName: 'credit_reserve',
        payload: { requestId: result.order.id, userId: REQUESTER, amount: 4 },
        version: 0,
      }),
    ]);
  });

  it('opens the order once credit-service reserves, and empties the outbox', async () => {
    const h = harness(() => ({ ok: true }));
    const result = await createOrder(prisma, REQUESTER, payload);
    if (!result.ok) throw new Error('create failed');

    const jobs = await h.drain();

    expect(jobs.map((j) => j.taskName)).toEqual(['credit_reserve']);
    expect(jobs[0]!.id).toMatch(/^outbox-\d+$/);
    const order = await prisma.orderRequest.findUniqueOrThrow({
      where: { id: result.order.id },
    });
    expect(order).toMatchObject({ status: 'open', version: 1 });
    expect(await prisma.outbox.count()).toBe(0);
    expect(h.published).toEqual([
      expect.objectContaining({
        name: 'order:created',
        payload: expect.objectContaining({ orderId: order.id, status: 'open' }),
      }),
    ]);
  });

  it('fails the order without a release on a permanent failure', async () => {
    const h = harness(() => ({
      ok: false,
      kind: 'permanent',
      status: 422,
      code: 'INSUFFICIENT_UNRESERVED_CREDITS',
    }));
    const result = await createOrder(prisma, REQUESTER, payload);
    if (!result.ok) throw new Error('create failed');

    await h.drain();

    const order = await prisma.orderRequest.findUniqueOrThrow({
      where: { id: result.order.id },
    });
    expect(order.status).toBe('failed');
    expect(await prisma.outbox.count()).toBe(0); // no release queued
  });

  it('on the last transient failure fails the order and queues a release that then runs', async () => {
    const h = harness(() => ({
      ok: false,
      kind: 'transient',
      code: 'fetch failed',
    }));
    const result = await createOrder(prisma, REQUESTER, payload);
    if (!result.ok) throw new Error('create failed');

    await h.drain(4); // the 5th and final attempt
    const order = await prisma.orderRequest.findUniqueOrThrow({
      where: { id: result.order.id },
    });
    expect(order.status).toBe('failed');

    const jobs = await h.drain(); // relays and runs the queued release
    expect(jobs.map((j) => j.taskName)).toEqual(['credit_release']);
    expect(h.releaseMock).toHaveBeenCalledWith({ requestId: order.id });
    const released = await prisma.orderRequest.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(released.creditReleasedAt).toBeInstanceOf(Date);
  });

  it('requester cancellation of an open order queues and runs a release', async () => {
    const h = harness(() => ({ ok: true }));
    const result = await createOrder(prisma, REQUESTER, payload);
    if (!result.ok) throw new Error('create failed');
    await h.drain();

    await expect(
      transitionOrder(prisma, result.order.id, 'cancelled', REQUESTER),
    ).resolves.toMatchObject({ ok: true });
    const jobs = await h.drain();

    expect(jobs.map((j) => j.taskName)).toEqual(['credit_release']);
    const order = await prisma.orderRequest.findUniqueOrThrow({
      where: { id: result.order.id },
    });
    expect(order.creditReleasedAt).toBeInstanceOf(Date);
  });

  it('a transition that loses the version race writes no outbox row', async () => {
    const h = harness(() => ({ ok: true }));
    const result = await createOrder(prisma, REQUESTER, payload);
    if (!result.ok) throw new Error('create failed');
    await h.drain();

    // Someone else bumps the version between our read and write.
    const stale = await prisma.orderRequest.findUniqueOrThrow({
      where: { id: result.order.id },
    });
    await prisma.orderRequest.update({
      where: { id: stale.id },
      data: { version: { increment: 1 } },
    });
    const { count } = await prisma.$transaction(async (tx) =>
      tx.orderRequest.updateMany({
        where: { id: stale.id, version: stale.version },
        data: { status: 'cancelled' },
      }),
    );

    expect(count).toBe(0);
    expect(await prisma.outbox.count()).toBe(0);
  });

  it('dead-letters an outbox row with no registered queue', async () => {
    const h = harness(() => ({ ok: true }));
    await prisma.outbox.create({
      data: { taskName: 'mystery_task', payload: { x: 1 }, version: 0 },
    });

    await h.drain();

    expect(await prisma.outbox.count()).toBe(0);
    expect(await prisma.deadLetterJob.findMany()).toEqual([
      expect.objectContaining({
        taskName: 'mystery_task',
        status: 'UNRESOLVED',
        payload: { x: 1 },
      }),
    ]);
  });
});

describe('release dead-letter re-drive (e2e)', () => {
  const redriveOnce = createReleaseRedrive({ prisma, log: () => {} });
  const transientTrace =
    'Error: Credit release failed (transient): fetch failed\n    at release (...)';

  async function deadLetter(
    taskName: string,
    errorTrace: string,
    requestId: string,
  ) {
    return prisma.deadLetterJob.create({
      data: {
        jobId: 'outbox-99',
        taskName,
        payload: { requestId },
        errorTrace,
        failedAt: new Date(),
      },
    });
  }

  it('re-drives a transient release failure as a fresh outbox row and marks it REDRIVEN', async () => {
    const result = await createOrder(prisma, REQUESTER, payload);
    if (!result.ok) throw new Error('create failed');
    const dl = await deadLetter(
      'credit_release',
      transientTrace,
      result.order.id,
    );

    await expect(redriveOnce()).resolves.toBe(1);

    expect(
      await prisma.deadLetterJob.findUniqueOrThrow({ where: { id: dl.id } }),
    ).toMatchObject({ status: 'REDRIVEN' });
    const rows = await prisma.outbox.findMany({
      where: { taskName: 'credit_release' },
    });
    expect(rows).toEqual([
      expect.objectContaining({ payload: { requestId: result.order.id } }),
    ]);
    // A second pass finds nothing left to re-drive.
    await expect(redriveOnce()).resolves.toBe(0);
  });

  it('leaves permanent release failures and reserve dead letters alone', async () => {
    await deadLetter(
      'credit_release',
      'UnrecoverableError: Credit release rejected: 409 ALREADY_TRANSFERRED',
      REQUESTER,
    );
    await deadLetter(
      'credit_reserve',
      'Error: Credit reserve retries exhausted: fetch failed',
      REQUESTER,
    );

    await expect(redriveOnce()).resolves.toBe(0);
    expect(await prisma.outbox.count()).toBe(0);
    expect(
      await prisma.deadLetterJob.count({ where: { status: 'UNRESOLVED' } }),
    ).toBe(2);
  });

  it('a re-driven release runs to completion once credit-service is back', async () => {
    const h = harness(() => ({ ok: true }));
    const result = await createOrder(prisma, REQUESTER, payload);
    if (!result.ok) throw new Error('create failed');
    await h.drain(); // order is open
    await prisma.outbox.deleteMany();
    await deadLetter('credit_release', transientTrace, result.order.id);

    await redriveOnce();
    const jobs = await h.drain();

    expect(jobs.map((j) => j.taskName)).toEqual(['credit_release']);
    expect(h.releaseMock).toHaveBeenCalledWith({ requestId: result.order.id });
    const order = await prisma.orderRequest.findUniqueOrThrow({
      where: { id: result.order.id },
    });
    expect(order.creditReleasedAt).toBeInstanceOf(Date);
  });
});

describe('accept (e2e)', () => {
  it('exactly one of many concurrent accepts wins (F12.2.1)', async () => {
    const h = harness(() => ({ ok: true }));
    const result = await createOrder(prisma, REQUESTER, payload);
    if (!result.ok) throw new Error('create failed');
    await h.drain(); // open

    const couriers = Array.from(
      { length: 8 },
      (_, i) =>
        `0192f0c4-0000-7000-8000-0000000001${String(i).padStart(2, '0')}`,
    );
    const outcomes = await Promise.all(
      couriers.map((c) =>
        transitionOrder(prisma, result.order.id, 'accepted', c),
      ),
    );

    const winners = outcomes.filter((o) => o.ok);
    expect(winners).toHaveLength(1);
    for (const o of outcomes.filter((x) => !x.ok)) {
      expect(['ORDER_CONFLICT', 'INVALID_TRANSITION']).toContain(
        (o as { error: string }).error,
      );
    }
    const order = await prisma.orderRequest.findUniqueOrThrow({
      where: { id: result.order.id },
    });
    expect(order.status).toBe('accepted');
    expect(couriers).toContain(order.courierId);
    expect(order.acceptedAt).toBeInstanceOf(Date);
    expect(await prisma.outbox.count()).toBe(0); // accepting queues no credit task
  });
});

describe('listing (e2e)', () => {
  const BASE = Date.parse('2030-01-01T00:00:00.000Z');
  const COUNT = 130; // > 2 pages

  /** 130 open orders: repeated credits, repeated and null complete-by, varied locations. */
  async function seed() {
    await prisma.orderRequest.createMany({
      data: Array.from({ length: COUNT }, (_, i) => ({
        requesterId: REQUESTER,
        supplierId: SUPPLIER,
        description: `order ${i}`,
        deliveryLocationId: (i % 3) + 1,
        credits: (i % 7) + 1,
        completeBy: i % 5 === 0 ? null : new Date(BASE + (i % 11) * 60_000),
        additionalDetails: null,
        status: 'open' as const,
      })),
    });
  }

  async function walk(query: Record<string, string>) {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const result = await listOrders(
        prisma,
        cursor ? { ...query, cursor } : query,
      );
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      expect(result.orders.length).toBeLessThanOrEqual(PAGE_SIZE);
      seen.push(...result.orders.map((o) => o.id));
      cursor = result.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    return seen;
  }

  async function expectedOrder(
    field: 'completeBy' | 'credits' | 'createdAt',
    order: 'asc' | 'desc',
  ) {
    const all = await prisma.orderRequest.findMany({
      where: { status: 'open' },
    });
    const key = (o: (typeof all)[number]) =>
      o[field] === null
        ? null
        : Number(o[field] instanceof Date ? o[field].getTime() : o[field]);
    return all
      .sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        if (ka !== kb) {
          // completeBy nulls: last ascending, first descending.
          if (ka === null) return order === 'asc' ? 1 : -1;
          if (kb === null) return order === 'asc' ? -1 : 1;
          return order === 'asc' ? ka - kb : kb - ka;
        }
        return a.id < b.id ? -1 : 1;
      })
      .map((o) => o.id);
  }

  it.each([
    ['completeBy', 'asc'],
    ['completeBy', 'desc'],
    ['credits', 'asc'],
    ['credits', 'desc'],
    ['createdAt', 'asc'],
    ['createdAt', 'desc'],
  ] as const)(
    'pages through sort=%s order=%s with no gaps or duplicates',
    async (sort, order) => {
      await seed();
      const seen = await walk({ sort, order });
      expect(new Set(seen).size).toBe(COUNT);
      expect(seen).toEqual(await expectedOrder(sort, order));
    },
  );

  it('applies combined filters, with no-deadline orders matching expiresAfter', async () => {
    await seed();
    const after = new Date(BASE + 5 * 60_000).toISOString();
    const seen = await walk({
      location: '2',
      minCredits: '3',
      maxCredits: '5',
      expiresAfter: after,
    });

    const rows = await prisma.orderRequest.findMany({
      where: { id: { in: seen } },
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.deliveryLocationId).toBe(2);
      expect(r.credits).toBeGreaterThanOrEqual(3);
      expect(r.credits).toBeLessThanOrEqual(5);
      expect(r.completeBy === null || r.completeBy > new Date(after)).toBe(
        true,
      );
    }
    expect(rows.some((r) => r.completeBy === null)).toBe(true);
  });

  it('never lists pending orders by default', async () => {
    const created = await createOrder(prisma, REQUESTER, payload); // stays pending
    if (!created.ok) throw new Error('create failed');
    const seen = await walk({});
    expect(seen).not.toContain(created.order.id);
  });
});
