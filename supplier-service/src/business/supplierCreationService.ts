/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Implemented the supplier creation workflow (upload, transaction, cleanup) from the Phase 2 plan (Task 7).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import type { NewSupplier, SupplierWriteRepository } from '../persistence/supplierWriteRepository.js';
import type { PhotoFile, PhotoStorage } from '../storage/photoStorage.js';
import { AppError } from '../utils/AppError.js';
import { sgtDatetime } from '../utils/time.js';
import type { CreateSupplierInput } from '../validation/supplierInput.js';

export interface CreationResult {
  statusCode: 200 | 201;
  body: unknown;
}

interface Dependencies {
  repo: SupplierWriteRepository;
  storage: PhotoStorage;
  reader: { getAdminSupplier(supplierId: number): Promise<unknown> };
  clock?: () => Date;
}

function invalid(field: string, message: string): AppError {
  return new AppError(422, 'Unprocessable Entity', message, { details: [{ field, location: 'body', message }] });
}

export function createSupplierCreationService({ repo, storage, reader, clock = () => new Date() }: Dependencies) {
  async function removeUploaded(locations: string[]): Promise<void> {
    // Best effort: a failed cleanup must not mask the original error.
    await Promise.allSettled(locations.map((location) => storage.delete(location)));
  }

  return {
    async createSupplier(
      input: CreateSupplierInput,
      photos: PhotoFile[],
      actor: { userId: string },
    ): Promise<CreationResult> {
      if (!(await repo.locationExists(input.locationId))) {
        throw invalid('location_id', 'The selected location does not exist.');
      }
      const missing = await repo.findMissingCategoryIds(input.categoryIds);
      if (missing.length > 0) {
        throw invalid('category_id', `Unknown category id(s): ${missing.join(', ')}.`);
      }

      const existing = await repo.findByIdentity(input.name, input.type, input.locationId);
      if (existing !== null && !existing.isDeleted) {
        throw invalid('name', 'A supplier with the same name, type and location already exists.');
      }

      // Step 2: upload first; a failure aborts the save (Arch §8.2).
      const uploaded: string[] = [];
      try {
        for (const photo of photos) {
          uploaded.push(await storage.upload(photo));
        }
      } catch {
        await removeUploaded(uploaded);
        throw new AppError(500, 'Internal Server Error', 'Photo upload failed.');
      }

      const record: NewSupplier = {
        ...input,
        photoLocations: uploaded,
        createdBy: actor.userId,
        now: sgtDatetime(clock()),
      };

      // Steps 3-4: one transaction; on failure remove the new cloud objects.
      let supplierId: number;
      try {
        if (existing === null) {
          supplierId = await repo.insertSupplier(record);
        } else {
          await repo.reactivateSupplier(existing.supplierId, record);
          supplierId = existing.supplierId;
        }
      } catch (error) {
        await removeUploaded(uploaded);
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Internal Server Error', 'Supplier could not be saved.');
      }

      return { statusCode: existing === null ? 201 : 200, body: await reader.getAdminSupplier(supplierId) };
    },
  };
}

export type SupplierCreationService = ReturnType<typeof createSupplierCreationService>;
