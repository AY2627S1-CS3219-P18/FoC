/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Tests for the supplier update saga (Phase 3 plan Task 6).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-09-30, Claude Code, model: claude-sonnet-5-5): added softDelete: vi.fn() to the repository fake so it still satisfies the interface (Phase 4 plan Task 4).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { describe, expect, it, vi } from 'vitest';
import type { CurrentSupplier, SupplierWriteRepository } from '../../src/persistence/supplierWriteRepository.js';
import { PHOTO_DELETION_QUEUE_KEY, PHOTO_DELETION_TASK_NAME } from '../../src/queue/photoDeletionJob.js';
import { createInMemoryPhotoStorage } from '../storage/inMemoryPhotoStorage.js';
import { AppError } from '../../src/utils/AppError.js';
import type { UpdateSupplierInput } from '../../src/validation/supplierUpdateInput.js';
import { createSupplierUpdateService } from '../../src/business/supplierUpdateService.js';

const NOW = new Date('2026-09-29T02:00:00Z');
const current: CurrentSupplier = {
  supplierId: 101, name: 'Campus Store', type: 'Store', locationId: 4, isDeleted: false, version: 3,
  photos: [{ photoId: 1, location: 'loc-a' }, { photoId: 2, location: 'loc-b' }],
};
const png = { buffer: Buffer.from('p'), mimeType: 'image/png' as const };
const base: UpdateSupplierInput = { version: 3, isPhotoDirty: false };

function setup(overrides: Partial<SupplierWriteRepository> = {}, queueError?: Error) {
  const repo: SupplierWriteRepository = {
    findByIdentity: vi.fn().mockResolvedValue(null),
    locationExists: vi.fn().mockResolvedValue(true),
    findMissingCategoryIds: vi.fn().mockResolvedValue([]),
    insertSupplier: vi.fn(),
    reactivateSupplier: vi.fn(),
    findCurrent: vi.fn().mockResolvedValue(current),
    updateSupplier: vi.fn().mockResolvedValue({ removedPhotos: [] }),
    softDelete: vi.fn(),
    ...overrides,
  };
  const storage = createInMemoryPhotoStorage();
  const reader = { getAdminSupplier: vi.fn().mockResolvedValue({ id: 101, version: 4 }) };
  const queue = { enqueue: queueError ? vi.fn().mockRejectedValue(queueError) : vi.fn().mockResolvedValue(undefined) };
  const service = createSupplierUpdateService({ repo, storage, reader, queue, clock: () => NOW });
  return { repo, storage, reader, queue, service };
}

describe('updateSupplier', () => {
  it('404s an unknown or soft-deleted supplier', async () => {
    const missing = setup({ findCurrent: vi.fn().mockResolvedValue(null) });
    await expect(missing.service.updateSupplier(101, base, [])).rejects.toMatchObject({ statusCode: 404 });
    const deleted = setup({ findCurrent: vi.fn().mockResolvedValue({ ...current, isDeleted: true }) });
    await expect(deleted.service.updateSupplier(101, base, [])).rejects.toMatchObject({ statusCode: 404 });
  });

  it('409s a stale version before uploading anything', async () => {
    const { service, storage, repo } = setup();
    await expect(service.updateSupplier(101, { ...base, version: 2 }, [png])).rejects.toMatchObject({ statusCode: 409 });
    expect(storage.objects.size).toBe(0);
    expect(repo.updateSupplier).not.toHaveBeenCalled();
  });

  it('writes only the sent fields and returns 200 with the admin detail', async () => {
    const { service, repo, reader, queue } = setup();
    const result = await service.updateSupplier(101, { ...base, name: 'New Name', isActive: false }, []);

    expect(result).toEqual({ statusCode: 200, body: { id: 101, version: 4 } });
    expect(repo.updateSupplier).toHaveBeenCalledWith(101, {
      version: 3, now: '2026-09-29 10:00:00', name: 'New Name', isActive: false,
    });
    expect(reader.getAdminSupplier).toHaveBeenCalledWith(101);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('422s a collision with another supplier but allows the supplier itself', async () => {
    const other = setup({ findByIdentity: vi.fn().mockResolvedValue({ supplierId: 7, isDeleted: false }) });
    await expect(other.service.updateSupplier(101, { ...base, name: 'Dup' }, [])).rejects.toMatchObject({ statusCode: 422 });
    const same = setup({ findByIdentity: vi.fn().mockResolvedValue({ supplierId: 101, isDeleted: false }) });
    await expect(same.service.updateSupplier(101, { ...base, name: 'campus store' }, [])).resolves.toMatchObject({ statusCode: 200 });
  });

  it('422s an unknown location and unknown categories', async () => {
    const loc = setup({ locationExists: vi.fn().mockResolvedValue(false) });
    await expect(loc.service.updateSupplier(101, { ...base, locationId: 9 }, [])).rejects.toMatchObject({ statusCode: 422 });
    const cat = setup({ findMissingCategoryIds: vi.fn().mockResolvedValue([9]) });
    await expect(cat.service.updateSupplier(101, { ...base, categoryIds: [9] }, [])).rejects.toMatchObject({ statusCode: 422 });
  });

  it('re-derives hours when the type changes to Facility, and requires hours when it changes to Store', async () => {
    const toFacility = setup();
    await toFacility.service.updateSupplier(101, { ...base, type: 'Facility' }, []);
    expect(toFacility.repo.updateSupplier).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ type: 'Facility', hours: [{ day: 8, open: '00:00', close: '23:59', is24h: true }] }),
    );
    const toStore = setup({ findCurrent: vi.fn().mockResolvedValue({ ...current, type: 'Facility' }) });
    await expect(toStore.service.updateSupplier(101, { ...base, type: 'Store' }, [])).rejects.toMatchObject({ statusCode: 422 });
  });

  it('parses sent Store hours into the change', async () => {
    const { service, repo } = setup();
    await service.updateSupplier(101, { ...base, openingHours: '[{"day":1,"open":"09:00","close":"18:00"}]' }, []);
    expect(repo.updateSupplier).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ hours: [{ day: 1, open: '09:00', close: '18:00', is24h: false }] }),
    );
  });

  it('uploads new photos, writes the resolved order, and enqueues one job per excluded photo', async () => {
    const removed = [{ photoId: 1, location: 'loc-a' }];
    const { service, repo, queue, storage } = setup({ updateSupplier: vi.fn().mockResolvedValue({ removedPhotos: removed }) });
    await service.updateSupplier(
      101,
      { ...base, isPhotoDirty: true, photoIds: [2, 'ph-1'], placeholderIds: ['ph-1'] },
      [png],
    );

    expect(storage.objects.size).toBe(1);
    expect(repo.updateSupplier).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ photos: [{ kind: 'existing', photoId: 2 }, { kind: 'new', location: 'memory://photos/1' }] }),
    );
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(queue.enqueue).toHaveBeenCalledWith(
      PHOTO_DELETION_QUEUE_KEY,
      expect.objectContaining({ task_name: PHOTO_DELETION_TASK_NAME, payload: { photo_id: 1, photo_location: 'loc-a' } }),
    );
  });

  it('422s uploaded files while isPhotoDirty is false, uploading nothing', async () => {
    const { service, storage } = setup();
    await expect(service.updateSupplier(101, base, [png])).rejects.toMatchObject({ statusCode: 422 });
    expect(storage.objects.size).toBe(0);
  });

  it('500s and saves nothing when an upload fails, cleaning up earlier uploads', async () => {
    const { service, storage, repo } = setup();
    const original = storage.upload.bind(storage);
    let calls = 0;
    storage.upload = async (file) => {
      calls += 1;
      if (calls === 2) throw new Error('boom');
      return original(file);
    };
    await expect(
      service.updateSupplier(101, { ...base, isPhotoDirty: true, photoIds: ['a', 'b'], placeholderIds: ['a', 'b'] }, [png, png]),
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(repo.updateSupplier).not.toHaveBeenCalled();
    expect(storage.objects.size).toBe(0);
  });

  it('cleans up new uploads and 500s when the transaction fails', async () => {
    const { service, storage, queue } = setup({ updateSupplier: vi.fn().mockRejectedValue(new Error('db')) });
    await expect(
      service.updateSupplier(101, { ...base, isPhotoDirty: true, photoIds: ['a'], placeholderIds: ['a'] }, [png]),
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(storage.objects.size).toBe(0);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('cleans up and rethrows the 409 raised inside the transaction', async () => {
    const conflict = new AppError(409, 'Conflict', 'stale');
    const { service, storage } = setup({ updateSupplier: vi.fn().mockRejectedValue(conflict) });
    await expect(
      service.updateSupplier(101, { ...base, isPhotoDirty: true, photoIds: ['a'], placeholderIds: ['a'] }, [png]),
    ).rejects.toBe(conflict);
    expect(storage.objects.size).toBe(0);
  });

  it('500s when the deletion job cannot be enqueued after commit', async () => {
    const removed = [{ photoId: 1, location: 'loc-a' }];
    const { service } = setup({ updateSupplier: vi.fn().mockResolvedValue({ removedPhotos: removed }) }, new Error('redis'));
    await expect(
      service.updateSupplier(101, { ...base, isPhotoDirty: true, photoIds: [2] }, []),
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});
