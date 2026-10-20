/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope: Issue #4 - end-to-end test of the credit-reservation saga against a real
 *        Postgres (migrations applied): createOrder -> outbox -> relay -> reserve job ->
 *        open, and cancel -> release job -> creditReleasedAt, plus the failure paths.
 *        Credit-service and Redis are faked (HTTP client and BullMQ queue stand-ins).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
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

// Requires a migrated Postgres at DATABASE_URL (e.g. `docker compose up -d order-db`).
loadDotenv({ quiet: true });
const prisma = createPrismaClient(loadEnv().DATABASE_URL);

const REQUESTER = '0192f0c4-0000-7000-8000-00000000000a';
const SUPPLIER = 1; // supplier-service integer id
const payload = {
  supplierId: SUPPLIER,
  description: '1x chicken rice',
  deliveryLocation: 'COM1 Basement',
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
  const notify = vi.fn(async () => {});
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
    notifier: { notify },
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
  return { releaseMock, notify, drain };
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
    expect(h.notify).toHaveBeenCalledWith(
      REQUESTER,
      'order:created',
      expect.objectContaining({ orderId: order.id, status: 'open' }),
    );
  });

  it('cancels without a release on a permanent failure', async () => {
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
    expect(order.status).toBe('cancelled');
    expect(await prisma.outbox.count()).toBe(0); // no release queued
  });

  it('on the last transient failure cancels and queues a release that then runs', async () => {
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
    expect(order.status).toBe('cancelled');

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
