/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Defined the persistence interface the business layer depends on, as required by
 *        SupplierServiceArchitecture.md §5 and SupplierServiceSpec.md Phase 0/1. Read operations
 *        only; the visibility rule (§7) is part of every query. No requirements, architecture,
 *        schema, or API decisions were made by the AI tool.
 * Author review:
 */

export interface SupplierRow {
  supplierId: number;
  name: string;
  type: 'Store' | 'Facility';
  desc: string | null;
  location: string;
  faculty: string;
  level: number;
}

export interface CategoryLinkRow {
  supplierId: number;
  category: string;
}

export interface HourRow {
  supplierId: number;
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday (§6.2)
  open: string; // 'HH:MM'
  close: string; // 'HH:MM'
}

export interface PhotoRow {
  supplierId: number;
  photoId: number;
  photoLocation: string;
  displayOrder: number;
}

export interface LocationRow {
  locationId: number;
  location: string;
  facultyId: number;
  faculty: string;
}

export interface CategoryRow {
  categoryId: number;
  category: string;
}

export interface ListCriteria {
  search?: string;
  locationId?: number;
  categoryId?: number;
  sortOrder: 'A-Z' | 'Z-A';
}

export interface ListFilter extends ListCriteria {
  limit: number;
  offset: number;
}

export interface SupplierRepository {
  /** User-facing page: only suppliers with is_deleted = false AND is_active = true. */
  findVisiblePage(filter: ListFilter): Promise<{ rows: SupplierRow[]; total: number }>;
  /**
   * Same visibility rule and criteria, no paging. Used when the computed isOpen filter must be
   * applied to the whole result set before a page is cut.
   */
  findAllVisible(criteria: ListCriteria): Promise<SupplierRow[]>;
  /** Same visibility rule; null when the id is missing, deleted, or inactive. */
  findVisibleById(supplierId: number): Promise<SupplierRow | null>;
  findCategoryLinks(supplierIds: number[]): Promise<CategoryLinkRow[]>;
  findHours(supplierIds: number[]): Promise<HourRow[]>;
  findPhotos(supplierIds: number[]): Promise<PhotoRow[]>;
  listLocations(): Promise<LocationRow[]>;
  listCategories(): Promise<CategoryRow[]>;
}
