/*
 * AI Assistance Disclosure:
 * Tool: GitHub Copilot SDK in VS Code (model: GPT-5.6 Luna), date: 2026-10-12
 * Scope: Added the BullMQ maintenance worker for automatic request completion
 *        and acceptance-deadline expiry. No requirements, architecture, schema,
 *        or API decisions were made by the AI tool.
 * Author review: tng wen xi
 * Scope (2026-10-12): Ensured signal shutdown exits after closing worker,
 *        queue, and database resources so tsx watch can restart the process.
 * Author review: tng wen xi
 * Scope (2026-10-13): Passed the credit client into maintenance execution so
 *        expiry can release the persisted reservation.
 * Author review: tng wen xi
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope (2026-10-20): Issue #4 - also runs the outbox relay (1 s scheduler) and the
 *        credit-job worker (reserve/release over HTTP with BullMQ retries, dead-letter on
 *        final failure), mirroring supplier-service's worker; real credit client
 *        (George, 2026-10-20). Maintenance no longer calls credit-service directly.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Also runs the minute-by-minute re-drive of transient
 *        credit_release dead letters (George, 2026-10-20).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { Queue, Worker, type Job } from 'bullmq';
import { config as loadDotenv } from 'dotenv';
import { createPrismaClient } from './db/prisma.js';
import { loadEnv } from './config/env.js';
import { runRequestMaintenance } from './services/orders.service.js';
import { createHttpCreditsClient } from './clients/credits.client.js';
import { createOutboxRepository } from './db/outbox.repository.js';
import { createDeadLetterRepository } from './db/dead-letter.repository.js';
import { createBullJobQueue, splitQueueKey } from './queue/bull-queue.js';
import { CREDIT_QUEUE_KEY } from './queue/tasks.js';
import { createOutboxRelay, startRelay } from './worker/outbox-relay.js';
import {
  createCreditJobProcessor,
  isFinalFailure,
} from './worker/credit-jobs.js';
import { createLogNotifier } from './notifications/notifier.js';
import {
  createReleaseRedrive,
  startReleaseRedrive,
} from './worker/release-redrive.js';

loadDotenv({ quiet: true });

const env = loadEnv();
const connection = { host: env.REDIS_HOST, port: env.REDIS_PORT };
const queueName = 'order-request-maintenance';
const queue = new Queue(queueName, { connection });
const prisma = createPrismaClient(env.DATABASE_URL);
const credits = createHttpCreditsClient(env.CREDIT_SERVICE_URL);
const deadLetters = createDeadLetterRepository(prisma);

async function processMaintenanceJob(_job: Job): Promise<void> {
  const result = await runRequestMaintenance(prisma);
  if (result.completed > 0 || result.expired > 0) {
    console.log(
      `Request maintenance: completed ${result.completed}, expired ${result.expired}`,
    );
  }
}

const worker = new Worker(queueName, processMaintenanceJob, {
  connection,
  concurrency: 1,
});

worker.on('error', (error) => {
  console.error('Order maintenance worker error:', error);
});

await queue.upsertJobScheduler(
  'request-maintenance-sweep',
  { every: 60_000 },
  { name: 'request-maintenance-sweep', data: {} },
);

// ---- Issue #4: outbox relay + credit jobs -----------------------------------
const jobQueue = createBullJobQueue(connection);
const relay = await startRelay(
  connection,
  createOutboxRelay({
    outbox: createOutboxRepository(prisma),
    queue: jobQueue,
    deadLetters,
  }),
);

const redrive = await startReleaseRedrive(
  connection,
  createReleaseRedrive({ prisma }),
);

const creditQueue = splitQueueKey(CREDIT_QUEUE_KEY);
const creditWorker = new Worker(
  creditQueue.name,
  createCreditJobProcessor({ prisma, credits, notifier: createLogNotifier() }),
  { connection, prefix: creditQueue.prefix, concurrency: 1 },
);
creditWorker.on('error', (error) => {
  console.error(`[${CREDIT_QUEUE_KEY}] worker error:`, error);
});
creditWorker.on('failed', (job, error) => {
  if (!job || !isFinalFailure(job, error)) return;
  // Retries exhausted (or not retryable): record it for an administrator.
  void deadLetters
    .insert({
      jobId: String(job.id),
      taskName: job.name,
      payload: job.data,
      errorTrace: error.stack ?? error.message,
      failedAt: new Date(),
    })
    .catch((dlqError: unknown) => {
      console.error(`Could not dead-letter job ${job.id}:`, dlqError);
    });
});

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down maintenance worker`);
  try {
    // Stop taking new jobs and let the active ones finish.
    await Promise.all([
      worker.close(),
      creditWorker.close(),
      relay.close(),
      redrive.close(),
    ]);
    await queue.close();
    await jobQueue.close();
    await prisma.$disconnect();
  } catch (error) {
    console.error('Failed to shut down maintenance worker cleanly:', error);
    process.exitCode = 1;
  } finally {
    process.exit(process.exitCode ?? 0);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
