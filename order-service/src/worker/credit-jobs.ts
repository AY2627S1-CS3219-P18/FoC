/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope: Issue #4 - worker handlers for the credit_reserve / credit_release jobs,
 *        implementing George's saga decisions (2026-10-19/20):
 *        - reserve ok (incl. RESERVATION_ALREADY_EXISTS): pending -> open (order:created);
 *        - reserve permanent failure (422/404): pending -> cancelled, no release, notify
 *          with credit-service's code;
 *        - reserve transient failure: retry; on the last attempt cancel, queue a release
 *          and notify, then fail the job so it is dead-lettered;
 *        - release ok (incl. 404/409): stamp creditReleasedAt; transient: retry;
 *          permanent: dead-letter without retries.
 *        Failure reason string RESERVE_RETRIES_EXHAUSTED is named by convention
 *        (UPPER_SNAKE like credit-service's codes).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Issue #6 - reservation outcomes are published as order events
 *        (order:created on success, order:cancelled with the reason on failure) through
 *        transitionOrder, replacing the log-only notifier from issue #4.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Exported the transient-release message so the dead-letter
 *        re-drive can select transient release failures only (George, 2026-10-20).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { UnrecoverableError, type Job } from 'bullmq';
import type { CreditsClient } from '../clients/credits.client.js';
import type { PrismaClient } from '../db/prisma.js';
import { SYSTEM_ACTOR } from '../domain/order-status.js';
import type { OrderRequest } from '../generated/prisma/client.js';
import type { OrderEventPublisher } from '../realtime/order-events.js';
import { transitionOrder } from '../services/orders.service.js';
import {
  CREDIT_RELEASE_TASK,
  CREDIT_RESERVE_TASK,
  isReleasePayload,
  isReservePayload,
} from '../queue/tasks.js';

export const RESERVE_RETRIES_EXHAUSTED = 'RESERVE_RETRIES_EXHAUSTED';

/** Start of the error a transient release failure throws; the re-drive matches on it. */
export const TRANSIENT_RELEASE_FAILURE = 'Credit release failed (transient)';

export interface CreditJobDeps {
  prisma: PrismaClient;
  credits: CreditsClient;
  events?: OrderEventPublisher;
  clock?: () => Date;
  log?: (message: string) => void;
}

/** The subset of a BullMQ job the handlers read; keeps them testable without Redis. */
export type CreditJob = Pick<
  Job,
  'id' | 'name' | 'data' | 'attemptsMade' | 'opts'
>;

function isLastAttempt(job: CreditJob): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}

export function createCreditJobProcessor({
  prisma,
  credits,
  events,
  clock = () => new Date(),
  log = console.error,
}: CreditJobDeps) {
  /** Moves a pending order to `to`; resolves to the updated order, or null if it had moved on. */
  /** Publishes the order event (with `reason` on a failure) once committed. */
  async function settle(
    orderId: string,
    to: 'open' | 'cancelled',
    {
      releaseCredits = false,
      reason,
    }: { releaseCredits?: boolean; reason?: string } = {},
  ): Promise<OrderRequest | null> {
    const result = await transitionOrder(
      prisma,
      orderId,
      to,
      SYSTEM_ACTOR,
      clock(),
      { releaseCredits, events, reason },
    );
    if (result.ok) return result.order;
    // Not pending any more (a duplicate job already settled it) or the order is gone.
    log(`Reservation for ${orderId} not applied (${to}): ${result.error}`);
    return null;
  }

  async function reserve(job: CreditJob): Promise<void> {
    if (!isReservePayload(job.data)) {
      throw new UnrecoverableError(`Invalid ${CREDIT_RESERVE_TASK} payload.`);
    }
    const { requestId } = job.data;

    const order = await prisma.orderRequest.findUnique({
      where: { id: requestId },
    });
    if (!order)
      throw new UnrecoverableError(`Order ${requestId} does not exist.`);
    if (order.status !== 'pending') return; // already settled by an earlier run

    const result = await credits.reserve(job.data);

    if (result.ok) {
      await settle(requestId, 'open');
      return;
    }

    if (result.kind === 'permanent') {
      // Nothing was reserved, so nothing to release.
      await settle(requestId, 'cancelled', { reason: result.code });
      return;
    }

    if (!isLastAttempt(job)) {
      throw new Error(`Credit reserve failed (transient): ${result.code}`);
    }

    // Out of retries. The reserve may still have committed on credit-service's side
    // without us hearing back, so queue a release with the cancellation.
    await settle(requestId, 'cancelled', {
      releaseCredits: true,
      reason: RESERVE_RETRIES_EXHAUSTED,
    });
    // Fail the job so the dead-letter handler records it.
    throw new Error(`Credit reserve retries exhausted: ${result.code}`);
  }

  async function release(job: CreditJob): Promise<void> {
    if (!isReleasePayload(job.data)) {
      throw new UnrecoverableError(`Invalid ${CREDIT_RELEASE_TASK} payload.`);
    }
    const { requestId } = job.data;

    const result = await credits.release({ requestId });
    if (result.ok) {
      await prisma.orderRequest.updateMany({
        where: { id: requestId, creditReleasedAt: null },
        data: { creditReleasedAt: clock() },
      });
      return;
    }
    if (result.kind === 'permanent') {
      throw new UnrecoverableError(
        `Credit release rejected: ${result.status ?? ''} ${result.code}`.trim(),
      );
    }
    throw new Error(`${TRANSIENT_RELEASE_FAILURE}: ${result.code}`);
  }

  return async function processCreditJob(job: CreditJob): Promise<void> {
    switch (job.name) {
      case CREDIT_RESERVE_TASK:
        return reserve(job);
      case CREDIT_RELEASE_TASK:
        return release(job);
      default:
        throw new UnrecoverableError(`No handler for task_name "${job.name}".`);
    }
  };
}

/** True once BullMQ will not run the job again. */
export function isFinalFailure(job: CreditJob, err: Error): boolean {
  return (
    err instanceof UnrecoverableError ||
    job.attemptsMade >= (job.opts.attempts ?? 1)
  );
}
