/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Supplier update workflow (validate, upload, transaction, cleanup, enqueue) from the Phase 3
 *        plan Task 6; SupplierServiceArchitecture.md §6.2, §7.5, §8.2. No requirements, architecture,
 *        schema, or API decisions were made by the AI tool.
 * Author review:
 */
import type { PhotoWrite, SupplierChange, SupplierWriteRepository } from '../persistence/supplierWriteRepository.js';
import type { JobQueue } from '../queue/jobQueue.js';
import { PHOTO_DELETION_QUEUE_KEY, buildPhotoDeletionJob } from '../queue/photoDeletionJob.js';
import type { PhotoFile, PhotoStorage } from '../storage/photoStorage.js';
import { AppError } from '../utils/AppError.js';
import { sgtDatetime } from '../utils/time.js';
import { resolveHours } from '../validation/supplierInput.js';
import type { UpdateSupplierInput } from '../validation/supplierUpdateInput.js';
import { buildPhotoPlan } from './photoPlan.js';

export interface UpdateResult {
  statusCode: 200;
  body: unknown;
}

interface Dependencies {
  repo: SupplierWriteRepository;
  storage: PhotoStorage;
  reader: { getAdminSupplier(supplierId: number): Promise<unknown> };
  queue: JobQueue;
  clock?: () => Date;
}

function invalid(field: string, message: string): AppError {
  return new AppError(422, 'Unprocessable Entity', message, { details: [{ field, location: 'body', message }] });
}

export function createSupplierUpdateService({ repo, storage, reader, queue, clock = () => new Date() }: Dependencies) {
  async function removeUploaded(locations: string[]): Promise<void> {
    // Best effort: a failed cleanup must not mask the original error.
    await Promise.allSettled(locations.map((location) => storage.delete(location)));
  }

  return {
    async updateSupplier(supplierId: number, input: UpdateSupplierInput, files: PhotoFile[]): Promise<UpdateResult> {
      const current = await repo.findCurrent(supplierId);
      if (current === null || current.isDeleted) throw new AppError(404, 'Not Found', 'Supplier not found.');
      if (input.version !== current.version) {
        throw new AppError(409, 'Conflict', 'The supplier was modified by someone else. Re-fetch it and retry.');
      }

      const type = input.type ?? current.type;
      const locationId = input.locationId ?? current.locationId;
      const name = input.name ?? current.name;

      if (input.locationId !== undefined && !(await repo.locationExists(input.locationId))) {
        throw invalid('location_id', 'The selected location does not exist.');
      }
      if (input.categoryIds !== undefined) {
        const missing = await repo.findMissingCategoryIds(input.categoryIds);
        if (missing.length > 0) throw invalid('category_id', `Unknown category id(s): ${missing.join(', ')}.`);
      }
      const clash = await repo.findByIdentity(name, type, locationId);
      if (clash !== null && clash.supplierId !== supplierId) {
        throw invalid('name', 'A supplier with the same name, type and location already exists.');
      }

      const change: SupplierChange = { version: input.version, now: sgtDatetime(clock()) };
      if (input.name !== undefined) change.name = input.name;
      if (input.type !== undefined) change.type = input.type;
      if (input.desc !== undefined) change.desc = input.desc;
      if (input.locationId !== undefined) change.locationId = input.locationId;
      if (input.isActive !== undefined) change.isActive = input.isActive;
      if (input.categoryIds !== undefined) change.categoryIds = input.categoryIds;

      const hoursSent = input.openingHours !== undefined || input.is24h !== undefined;
      if (hoursSent || (input.type !== undefined && input.type !== current.type)) {
        change.hours = resolveHours(type, input.openingHours, input.is24h ?? false);
      }

      const plan = input.isPhotoDirty
        ? buildPhotoPlan(current.photos, input.photoIds ?? [], input.placeholderIds ?? [], files.length)
        : null;
      if (plan === null && files.length > 0) {
        throw invalid('photos', 'Photos were uploaded but isPhotoDirty is not true.');
      }

      // Step 2: upload first; a failure aborts the save (Arch §8.2).
      const uploaded: string[] = [];
      try {
        for (const file of files) uploaded.push(await storage.upload(file));
      } catch {
        await removeUploaded(uploaded);
        throw new AppError(500, 'Internal Server Error', 'Photo upload failed.');
      }
      if (plan !== null) {
        change.photos = plan.entries.map(
          (entry): PhotoWrite =>
            entry.kind === 'existing'
              ? { kind: 'existing', photoId: entry.photoId }
              : { kind: 'new', location: uploaded[entry.fileIndex] as string },
        );
      }

      // Steps 3-4: one transaction; on failure remove the new cloud objects.
      let removedPhotos: Array<{ photoId: number; location: string }>;
      try {
        ({ removedPhotos } = await repo.updateSupplier(supplierId, change));
      } catch (error) {
        await removeUploaded(uploaded);
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Internal Server Error', 'Supplier could not be saved.');
      }

      // Steps 5-6: after commit, enqueue deletion of the excluded photos' cloud objects.
      try {
        for (const photo of removedPhotos) {
          await queue.enqueue(PHOTO_DELETION_QUEUE_KEY, buildPhotoDeletionJob(photo));
        }
      } catch {
        throw new AppError(500, 'Internal Server Error', 'Photo cleanup could not be queued.');
      }

      return { statusCode: 200, body: await reader.getAdminSupplier(supplierId) };
    },
  };
}

export type SupplierUpdateService = ReturnType<typeof createSupplierUpdateService>;
