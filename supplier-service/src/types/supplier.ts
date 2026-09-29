/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Typed the response shapes already specified in SupplierServiceArchitecture.md §7.3
 *        (SupplierSummary, paginated envelope, detailed supplier, reference options). No
 *        requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
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
  location: string;
  faculty: string;
  level: number;
  categories: string[];
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

export interface PaginatedSuppliers {
  metadata: {
    totalRecords: number;
    currPage: number;
    limit: number;
    totalPages: number;
  };
  data: SupplierSummary[];
}

export interface LocationOption {
  location_id: number;
  location: string;
  faculty_id: number;
  faculty: string;
}

export interface CategoryOption {
  category_id: number;
  category: string;
}
