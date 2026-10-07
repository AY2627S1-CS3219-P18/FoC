/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Background worker process entrypoint (Phase 4 plan Task 13): wires the outbox relay, the
 *        BullMQ task workers, the two job handlers, the mock Order/Message clients and the
 *        dead-letter repository. A separate process from the API, with standard SIGINT/SIGTERM
 *        shutdown that lets the active job finish (team answers, 2026-09-30). No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Signal handlers now log a failed shutdown and exit non-zero instead of leaving an unhandled
 *        rejection. No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { createMysqlDeadLetterRepository } from '../persistence/mysqlDeadLetterRepository.js';
import { createMysqlOutboxRepository } from '../persistence/mysqlOutboxRepository.js';
import { createBullJobQueue } from '../queue/bullQueue.js';
import { PHOTO_DELETION_TASK_NAME } from '../queue/photoDeletionJob.js';
import { SUSPENSION_TASK_NAME } from '../queue/tasks.js';
import { createConfiguredPhotoStorage } from '../storage/s3PhotoStorage.js';
import { createMockMessageClient, createMockOrderClient } from './downstream.js';
import { createPhotoCleanupHandler, createSuspensionHandler } from './handlers.js';
import { createJobProcessor } from './jobProcessor.js';
import { createOutboxRelay } from './outboxRelay.js';
import { startRelay } from './startRelay.js';
import { startWorkers } from './startWorkers.js';

const connection = { host: config.redis.host, port: config.redis.port };
const deadLetters = createMysqlDeadLetterRepository(pool);
const jobQueue = createBullJobQueue(connection);

const processor = createJobProcessor({
  handlers: {
    [PHOTO_DELETION_TASK_NAME]: createPhotoCleanupHandler(createConfiguredPhotoStorage(config.photoStore)),
    [SUSPENSION_TASK_NAME]: createSuspensionHandler({
      order: createMockOrderClient({ fail: config.mockDownstreamFailure }),
      message: createMockMessageClient({ fail: config.mockDownstreamFailure }),
    }),
  },
  deadLetters,
});

const relay = await startRelay(
  connection,
  createOutboxRelay({ outbox: createMysqlOutboxRepository(pool), queue: jobQueue, deadLetters }),
);
const workers = startWorkers(connection, processor);
console.log('supplier-service worker started');

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; taking no new jobs and waiting for the active job to finish.`);
  await relay.close(); // stop moving outbox rows first
  // Worker.close() stops fetching and waits for the job in progress (no built-in timeout).
  await Promise.all(workers.map((worker) => worker.close()));
  await jobQueue.close();
  await pool.end();
  console.log('supplier-service worker stopped');
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    shutdown(signal).catch((error) => {
      console.error('Worker shutdown failed:', error);
      process.exit(1);
    });
  });
}
