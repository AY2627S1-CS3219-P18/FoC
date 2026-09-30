/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Handlers for the image_cleanup and supplier_suspension job types (Phase 4 plan Task 10);
 *        SupplierServiceArchitecture.md §8.1, §8.2. Payload shapes are the recorded/team-supplied ones;
 *        an invalid payload is a bad job (team answer 2026-09-30). No requirements, architecture,
 *        schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { UnrecoverableError } from 'bullmq';
import { z } from 'zod';
import type { PhotoStorage } from '../storage/photoStorage.js';
import type { MessageClient, OrderClient } from './downstream.js';

/** Resolves on success; a rejection is a failed attempt, an UnrecoverableError a bad job (no retries). */
export type JobHandler = (payload: unknown) => Promise<void>;

const photoCleanupPayload = z.object({ photo_id: z.number().int(), photo_location: z.string().min(1) });
const suspensionPayload = z.object({ supplier_id: z.number().int().positive() });

function parsePayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.') || 'payload'}: ${issue.message}`);
    throw new UnrecoverableError(`Invalid job payload: ${issues.join('; ')}`);
  }
  return result.data;
}

export function createPhotoCleanupHandler(storage: Pick<PhotoStorage, 'delete'>): JobHandler {
  return async (payload) => {
    const { photo_location } = parsePayload(photoCleanupPayload, payload);
    await storage.delete(photo_location);
  };
}

export function createSuspensionHandler({ order, message }: { order: OrderClient; message: MessageClient }): JobHandler {
  return async (payload) => {
    const { supplier_id } = parsePayload(suspensionPayload, payload);
    // Order cancellation first, then the notification (Arch §8.1); the job is retried as a unit.
    await order.deleteUncollectedRequests(supplier_id);
    await message.notifyAffected(supplier_id);
  };
}
