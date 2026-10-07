/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Implemented the SupplierWriteRepository interface from the Phase 2 plan (Task 7).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-09-30, Claude Code, model: claude-sonnet-5-5): added CurrentSupplier, PhotoWrite, SupplierChange and the findCurrent/updateSupplier methods (Phase 3 Task 5).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import type { CurrentPhoto } from '../business/photoPlan.js';
import type { HourInput } from '../validation/supplierInput.js';

export interface NewSupplier {
  name: string;
  type: 'Store' | 'Facility';
  desc: string | null;
  locationId: number;
  categoryIds: number[];
  hours: HourInput[];
  /** Locations returned by the photo store, in display order (index = display_order, from 0). */
  photoLocations: string[];
  createdBy: string;
  /** Singapore wall-clock 'YYYY-MM-DD HH:MM:SS' written to created_on / updated_on (Arch §6.2). */
  now: string;
}

export interface ExistingSupplier {
  supplierId: number;
  isDeleted: boolean;
}

export interface CurrentSupplier {
  supplierId: number;
  name: string;
  type: 'Store' | 'Facility';
  locationId: number;
  isDeleted: boolean;
  version: number;
  /** In display order. */
  photos: CurrentPhoto[];
}

export type PhotoWrite = { kind: 'existing'; photoId: number } | { kind: 'new'; location: string };

/** Only the keys present are written (Phase 3: partial update). */
export interface SupplierChange {
  version: number;
  /** Singapore wall-clock 'YYYY-MM-DD HH:MM:SS' (Arch §6.2). */
  now: string;
  name?: string;
  type?: 'Store' | 'Facility';
  desc?: string | null;
  locationId?: number;
  isActive?: boolean;
  categoryIds?: number[];
  hours?: HourInput[];
  /** Final ordered photo list (index = display_order); omitted = photos untouched. */
  photos?: PhotoWrite[];
}

export interface SupplierWriteRepository {
  findCurrent(supplierId: number): Promise<CurrentSupplier | null>;
  /**
   * One transaction (Arch §8.2 step 3): matches supplier_id + version, applies the sent fields,
   * replaces categories/hours if sent, deletes excluded photo rows, appends new ones and reorders,
   * bumps updated_on and version. No matching row → AppError 409; duplicate identity → AppError 422.
   * Returns the excluded photos so the caller can enqueue their cloud deletion.
   */
  updateSupplier(supplierId: number, change: SupplierChange): Promise<{ removedPhotos: CurrentPhoto[] }>;
  findByIdentity(name: string, type: 'Store' | 'Facility', locationId: number): Promise<ExistingSupplier | null>;
  locationExists(locationId: number): Promise<boolean>;
  /** Returns the ids from the input that do not exist. */
  findMissingCategoryIds(categoryIds: number[]): Promise<number[]>;
  /** One transaction: supplier, category map, hours and photos. Duplicate race → AppError 422. */
  insertSupplier(input: NewSupplier): Promise<number>;
  /**
   * One transaction (Arch §6.2): reverses the soft delete, sets is_active true, replaces desc,
   * categories, hours and photo rows with the submitted ones, sets updated_on and increments
   * version. Returns the replaced photo locations so the cloud objects can be cleaned up later.
   */
  reactivateSupplier(supplierId: number, input: NewSupplier): Promise<{ replacedPhotoLocations: string[] }>;
}
