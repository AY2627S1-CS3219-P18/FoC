/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Tests for the Redis job producer (Phase 3 plan Task 1).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { createRedisJobQueue } from '../../src/queue/jobQueue.js';
import {
  PHOTO_DELETION_QUEUE_KEY,
  PHOTO_DELETION_TASK_NAME,
  buildPhotoDeletionJob,
} from '../../src/queue/photoDeletionJob.js';

describe('redis job queue', () => {
  it('pushes the job as JSON onto the given list', async () => {
    const lpush = vi.fn().mockResolvedValue(1);
    const queue = createRedisJobQueue({ lpush } as unknown as Redis);
    await queue.enqueue('q', { id: 'j-1', task_name: 't', payload: { a: 1 } });
    expect(lpush).toHaveBeenCalledWith('q', JSON.stringify({ id: 'j-1', task_name: 't', payload: { a: 1 } }));
  });

  it('lets a Redis failure propagate', async () => {
    const queue = createRedisJobQueue({ lpush: vi.fn().mockRejectedValue(new Error('down')) } as unknown as Redis);
    await expect(queue.enqueue('q', { id: 'j', task_name: 't', payload: {} })).rejects.toThrow('down');
  });
});

describe('buildPhotoDeletionJob', () => {
  it('carries photo_id and photo_location with a unique id', () => {
    const a = buildPhotoDeletionJob({ photoId: 7, location: 'loc-7' });
    const b = buildPhotoDeletionJob({ photoId: 7, location: 'loc-7' });
    expect(a.task_name).toBe(PHOTO_DELETION_TASK_NAME);
    expect(a.payload).toEqual({ photo_id: 7, photo_location: 'loc-7' });
    expect(a.id).not.toBe(b.id);
    expect(PHOTO_DELETION_QUEUE_KEY.length).toBeGreaterThan(0);
  });
});
