/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Wrote the creation service tests from the Phase 2 plan (Task 7).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-09-30, Claude Code, model: claude-sonnet-5): moved from src/business/supplierCreationService.test.ts to test/business/supplierCreationService.test.ts and updated
 *        the relative imports; no test logic changed. No requirements, architecture, schema, or
 *        API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-09-30, Claude Code, model: claude-sonnet-5-5): the repository fake gains findCurrent and updateSupplier so it type-checks (Phase 3 Task 5).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { describe, expect, it, vi } from 'vitest';
import type { SupplierWriteRepository } from '../../src/persistence/supplierWriteRepository.js';
import { createInMemoryPhotoStorage } from '../storage/inMemoryPhotoStorage.js';
import { AppError } from '../../src/utils/AppError.js';
import type { CreateSupplierInput } from '../../src/validation/supplierInput.js';
import { createSupplierCreationService } from '../../src/business/supplierCreationService.js';

const NOW = new Date('2026-09-29T02:00:00Z');
const input: CreateSupplierInput = {
  name: 'Campus Store',
  type: 'Store',
  desc: null,
  locationId: 4,
  categoryIds: [2],
  hours: [{ day: 1, open: '09:00', close: '18:00', is24h: false }],
};
const png = { buffer: Buffer.from('p'), mimeType: 'image/png' as const };
const jpg = { buffer: Buffer.from('j'), mimeType: 'image/jpeg' as const };
const actor = { userId: 'u-1' };

function setup(overrides: Partial<SupplierWriteRepository> = {}) {
  const repo: SupplierWriteRepository = {
    findByIdentity: vi.fn().mockResolvedValue(null),
    locationExists: vi.fn().mockResolvedValue(true),
    findMissingCategoryIds: vi.fn().mockResolvedValue([]),
    insertSupplier: vi.fn().mockResolvedValue(101),
    reactivateSupplier: vi.fn().mockResolvedValue({ replacedPhotoLocations: [] }),
    findCurrent: vi.fn().mockResolvedValue(null),
    updateSupplier: vi.fn().mockResolvedValue({ removedPhotos: [] }),
    ...overrides,
  };
  const storage = createInMemoryPhotoStorage();
  const reader = { getAdminSupplier: vi.fn().mockResolvedValue({ id: 101, version: 0 }) };
  const service = createSupplierCreationService({ repo, storage, reader, clock: () => NOW });
  return { repo, storage, reader, service };
}

describe('create', () => {
  it('uploads photos in order, inserts, and returns 201 with the admin detail', async () => {
    const { service, repo, storage, reader } = setup();
    const result = await service.createSupplier(input, [png, jpg], actor);

    expect(result).toEqual({ statusCode: 201, body: { id: 101, version: 0 } });
    expect(repo.insertSupplier).toHaveBeenCalledWith({
      ...input,
      photoLocations: ['memory://photos/1', 'memory://photos/2'],
      createdBy: 'u-1',
      now: '2026-09-29 10:00:00',
    });
    expect(storage.objects.size).toBe(2);
    expect(reader.getAdminSupplier).toHaveBeenCalledWith(101);
  });

  it('creates with no photos', async () => {
    const { service, repo } = setup();
    await service.createSupplier(input, [], actor);
    expect(repo.insertSupplier).toHaveBeenCalledWith(expect.objectContaining({ photoLocations: [] }));
  });

  it('rejects an unknown location with 422 before uploading anything', async () => {
    const { service, storage } = setup({ locationExists: vi.fn().mockResolvedValue(false) });
    await expect(service.createSupplier(input, [png], actor)).rejects.toMatchObject({ statusCode: 422 });
    expect(storage.objects.size).toBe(0);
  });

  it('rejects unknown categories with 422', async () => {
    const { service } = setup({ findMissingCategoryIds: vi.fn().mockResolvedValue([9]) });
    await expect(service.createSupplier(input, [], actor)).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects a duplicate of an active supplier with 422 and uploads nothing', async () => {
    const { service, storage, repo } = setup({
      findByIdentity: vi.fn().mockResolvedValue({ supplierId: 7, isDeleted: false }),
    });
    await expect(service.createSupplier(input, [png], actor)).rejects.toMatchObject({ statusCode: 422 });
    expect(storage.objects.size).toBe(0);
    expect(repo.insertSupplier).not.toHaveBeenCalled();
  });
});

describe('reactivation', () => {
  it('reactivates a soft-deleted match, returns 200, and keeps its supplier_id', async () => {
    const { service, repo, reader } = setup({
      findByIdentity: vi.fn().mockResolvedValue({ supplierId: 7, isDeleted: true }),
    });
    const result = await service.createSupplier(input, [png], actor);

    expect(result.statusCode).toBe(200);
    expect(repo.insertSupplier).not.toHaveBeenCalled();
    expect(repo.reactivateSupplier).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ photoLocations: ['memory://photos/1'], now: '2026-09-29 10:00:00' }),
    );
    expect(reader.getAdminSupplier).toHaveBeenCalledWith(7);
  });
});

describe('failure handling (Arch §8.2 steps 2 and 4)', () => {
  it('returns 500 and removes earlier uploads when a later upload fails', async () => {
    const { service, storage, repo } = setup();
    const upload = storage.upload.bind(storage);
    let calls = 0;
    storage.upload = async (file) => {
      calls += 1;
      if (calls === 2) throw new Error('storage down');
      return upload(file);
    };

    await expect(service.createSupplier(input, [png, jpg], actor)).rejects.toMatchObject({ statusCode: 500 });
    expect(storage.objects.size).toBe(0);
    expect(repo.insertSupplier).not.toHaveBeenCalled();
  });

  it('removes uploaded photos and returns 500 when the transaction fails', async () => {
    const { service, storage } = setup({ insertSupplier: vi.fn().mockRejectedValue(new Error('db down')) });
    await expect(service.createSupplier(input, [png], actor)).rejects.toMatchObject({ statusCode: 500 });
    expect(storage.objects.size).toBe(0);
  });

  it('removes uploaded photos and keeps the 422 when the DB reports a duplicate race', async () => {
    const race = new AppError(422, 'Unprocessable Entity', 'duplicate');
    const { service, storage } = setup({ insertSupplier: vi.fn().mockRejectedValue(race) });
    await expect(service.createSupplier(input, [png], actor)).rejects.toBe(race);
    expect(storage.objects.size).toBe(0);
  });
});
