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
 */

import { Queue, Worker, type Job } from 'bullmq';
import { config as loadDotenv } from 'dotenv';
import { createPrismaClient } from './db/prisma.js';
import { loadEnv } from './config/env.js';
import { runRequestMaintenance } from './services/orders.service.js';

loadDotenv({ quiet: true });

const env = loadEnv();
const connection = { host: env.REDIS_HOST, port: env.REDIS_PORT };
const queueName = 'order-request-maintenance';
const queue = new Queue(queueName, { connection });
const prisma = createPrismaClient(env.DATABASE_URL);

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

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down maintenance worker`);
  try {
    await worker.close();
    await queue.close();
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
