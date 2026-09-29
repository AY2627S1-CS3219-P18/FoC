/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Photo-deletion job builder (Phase 3 plan Task 1). The queue key and task name are the
 *        values the team supplied. No requirements, architecture, schema, or API decisions were
 *        made by the AI tool.
 * Author review:
 */
import { randomUUID } from 'node:crypto';
import type { Job } from './jobQueue.js';

export const PHOTO_DELETION_QUEUE_KEY = 'queue:image:cleanup';
export const PHOTO_DELETION_TASK_NAME = 'image_cleanup';

export function buildPhotoDeletionJob(photo: { photoId: number; location: string }): Job {
  return {
    id: randomUUID(),
    task_name: PHOTO_DELETION_TASK_NAME,
    payload: { photo_id: photo.photoId, photo_location: photo.location },
  };
}
