/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Tests for the image_cleanup and supplier_suspension handlers (Phase 4 plan Task 10). No
 *        requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-09-30, Claude Code, model: claude-sonnet-5-5): added two idempotency tests (Phase 4 plan
 *        Task 15): repeating a cleanup job, and re-running a suspension job after a partial failure.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { UnrecoverableError } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { createPhotoCleanupHandler, createSuspensionHandler } from '../../src/worker/handlers.js';

describe('photo cleanup handler', () => {
  it('deletes the cloud object at photo_location', async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    await createPhotoCleanupHandler({ delete: del })({ photo_id: 7, photo_location: 'loc-7' });
    expect(del).toHaveBeenCalledWith('loc-7');
  });

  it('treats an invalid payload as a bad job (unrecoverable) and deletes nothing', async () => {
    const del = vi.fn();
    const error = await createPhotoCleanupHandler({ delete: del })({ photo_id: 7 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(del).not.toHaveBeenCalled();
  });

  it('lets a storage failure propagate as an ordinary, retryable error', async () => {
    const del = vi.fn().mockRejectedValue(new Error('s3 down'));
    const error = await createPhotoCleanupHandler({ delete: del })({ photo_id: 7, photo_location: 'x' }).catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({ message: 's3 down' });
    expect(error).not.toBeInstanceOf(UnrecoverableError);
  });

  it('is safe to run twice for the same job (storage deletion is idempotent)', async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    const handler = createPhotoCleanupHandler({ delete: del });
    await handler({ photo_id: 7, photo_location: 'loc-7' });
    await expect(handler({ photo_id: 7, photo_location: 'loc-7' })).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledTimes(2);
  });
});

describe('suspension handler', () => {
  it('cancels uncollected orders, then notifies, for the supplier', async () => {
    const calls: string[] = [];
    const order = { deleteUncollectedRequests: vi.fn(async () => void calls.push('order')) };
    const message = { notifyAffected: vi.fn(async () => void calls.push('message')) };
    await createSuspensionHandler({ order, message })({ supplier_id: 101 });
    expect(order.deleteUncollectedRequests).toHaveBeenCalledWith(101);
    expect(message.notifyAffected).toHaveBeenCalledWith(101);
    expect(calls).toEqual(['order', 'message']);
  });

  it('does not notify when the order call fails', async () => {
    const order = { deleteUncollectedRequests: vi.fn().mockRejectedValue(new Error('order down')) };
    const message = { notifyAffected: vi.fn() };
    await expect(createSuspensionHandler({ order, message })({ supplier_id: 101 })).rejects.toThrow('order down');
    expect(message.notifyAffected).not.toHaveBeenCalled();
  });

  it('treats a payload without a numeric supplier_id as a bad job', async () => {
    const order = { deleteUncollectedRequests: vi.fn() };
    const message = { notifyAffected: vi.fn() };
    const error = await createSuspensionHandler({ order, message })({ supplier_id: 'x' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(order.deleteUncollectedRequests).not.toHaveBeenCalled();
  });

  it('can be re-run as a unit after a partial failure: the order call repeats, the notification then goes out', async () => {
    const order = { deleteUncollectedRequests: vi.fn().mockResolvedValue(undefined) };
    const message = { notifyAffected: vi.fn().mockRejectedValueOnce(new Error('msg down')).mockResolvedValue(undefined) };
    const handler = createSuspensionHandler({ order, message });
    await expect(handler({ supplier_id: 101 })).rejects.toThrow('msg down');
    await expect(handler({ supplier_id: 101 })).resolves.toBeUndefined();
    expect(order.deleteUncollectedRequests).toHaveBeenCalledTimes(2);
    expect(message.notifyAffected).toHaveBeenCalledTimes(2);
  });
});
