/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Typed the response shapes already specified in SupplierServiceArchitecture.md §7.3
 *        (SupplierSummary, paginated envelope, detailed supplier, reference options). No
 *        requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
 * Scope (2026-09-29, Claude Code, model: claude-sonnet-5): added Paginated<T> and the admin
 *        response types per Phase 2 plan Task 3 (Arch §7). No requirements, architecture, schema,
 *        or API decisions were made by the AI tool.
 * Author review: Congchen
  * Scope (2026-09-30, Claude Code, model: claude-sonnet-5-5): returned location_id, faculty_id and categories as {category, category_id} objects in supplier responses. Per the team's
 *        decision in chat; no other requirements, architecture, schema, or API decisions were made by the
 *        AI tool.
 * Author review: Congchen
 */

export interface PhotoDto {
  photoId: number;
  photoLocation: string;
  displayOrder: number;
}

export interface SupplierSummary {
  id: number;
  name: string;
  type: 'Store' | 'Facility';
  location_id: number;
  location: string;
  faculty_id: number;
  faculty: string;
  level: number;
  categories: CategoryOption[];
  photos: PhotoDto[];
  isOpen: boolean;
}

export interface OpeningHourDto {
  day: number;
  open: string;
  close: string;
}

export interface SupplierDetail extends SupplierSummary {
  desc: string | null;
  openingHours: OpeningHourDto[];
}

export interface Paginated<T> {
  metadata: {
    totalRecords: number;
    currPage: number;
    limit: number;
    totalPages: number;
  };
  data: T[];
}

export type PaginatedSuppliers = Paginated<SupplierSummary>;

export interface AdminSupplierSummary extends SupplierSummary {
  isActive: boolean;
  isDeleted: boolean;
}

export interface AdminSupplierDetail extends SupplierDetail {
  isActive: boolean;
  isDeleted: boolean;
  createdOn: string;
  createdBy: string;
  updatedOn: string;
  version: number;
}

export interface LocationOption {
  location_id: number;
  location: string;
  faculty_id: number;
  faculty: string;
}

export interface CategoryOption {
  category: string;
  category_id: number;
}
