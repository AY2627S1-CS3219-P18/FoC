/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Business-layer workflows for the Phase 1 read endpoints (SupplierServiceSpec.md Phase 1;
 *        SupplierServiceArchitecture.md §4, §6.2, §7.2, §7.3): assembles summary/detail responses
 *        from persistence rows, computes isOpen, applies the isOpen filter, and builds pagination
 *        metadata over the fixed 50-entry page. How the isOpen filter is paged (in memory, over all
 *        rows matching the other filters) is an implementation choice listed in the Phase 1 plan.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import type {
  CategoryLinkRow,
  HourRow,
  PhotoRow,
  SupplierRepository,
  SupplierRow,
} from '../persistence/supplierRepository.js';
import type {
  CategoryOption,
  LocationOption,
  PaginatedSuppliers,
  SupplierDetail,
  SupplierSummary,
} from '../types/supplier.js';
import { AppError } from '../utils/AppError.js';
import { computeIsOpen } from './isOpen.js';

const PAGE_SIZE = 50;

export interface ListParams {
  page: number;
  search?: string;
  locationId?: number;
  categoryId?: number;
  isOpen?: boolean;
  sortOrder: 'A-Z' | 'Z-A';
}

interface Assembled {
  summary: SupplierSummary;
  hours: HourRow[];
}

function envelope(page: number, total: number, data: SupplierSummary[]): PaginatedSuppliers {
  return {
    metadata: {
      totalRecords: total,
      currPage: page,
      limit: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
    data,
  };
}

export function createSupplierService(
  repo: SupplierRepository,
  clock: () => Date = () => new Date(),
) {
  async function assemble(rows: SupplierRow[]): Promise<Assembled[]> {
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.supplierId);
    const [categoryLinks, hours, photos]: [CategoryLinkRow[], HourRow[], PhotoRow[]] =
      await Promise.all([repo.findCategoryLinks(ids), repo.findHours(ids), repo.findPhotos(ids)]);
    const now = clock();

    return rows.map((row) => {
      const ownHours = hours.filter((hour) => hour.supplierId === row.supplierId);
      return {
        hours: ownHours,
        summary: {
          id: row.supplierId,
          name: row.name,
          type: row.type,
          location: row.location,
          faculty: row.faculty,
          level: row.level,
          categories: categoryLinks
            .filter((link) => link.supplierId === row.supplierId)
            .map((link) => link.category),
          photos: photos
            .filter((photo) => photo.supplierId === row.supplierId)
            .map((photo) => ({
              photoId: photo.photoId,
              photoLocation: photo.photoLocation,
              displayOrder: photo.displayOrder,
            })),
          isOpen: computeIsOpen(ownHours, now),
        },
      };
    });
  }

  return {
    async listSuppliers(params: ListParams): Promise<PaginatedSuppliers> {
      const criteria = {
        search: params.search,
        locationId: params.locationId,
        categoryId: params.categoryId,
        sortOrder: params.sortOrder,
      };
      const offset = (params.page - 1) * PAGE_SIZE;

      if (params.isOpen === undefined) {
        const { rows, total } = await repo.findVisiblePage({ ...criteria, limit: PAGE_SIZE, offset });
        const assembled = await assemble(rows);
        return envelope(params.page, total, assembled.map((item) => item.summary));
      }

      // isOpen is computed, not stored, so filter the whole matching set before cutting the page.
      const all = await assemble(await repo.findAllVisible(criteria));
      const matching = all
        .map((item) => item.summary)
        .filter((summary) => summary.isOpen === params.isOpen);
      return envelope(params.page, matching.length, matching.slice(offset, offset + PAGE_SIZE));
    },

    async getSupplier(supplierId: number): Promise<SupplierDetail> {
      const row = await repo.findVisibleById(supplierId);
      if (row === null) {
        throw new AppError(404, 'Not Found', 'Supplier not found.');
      }
      const [assembled] = await assemble([row]);
      if (assembled === undefined) {
        throw new AppError(404, 'Not Found', 'Supplier not found.');
      }

      return {
        ...assembled.summary,
        desc: row.desc,
        openingHours: assembled.hours
          .map((hour) => ({ day: hour.dayOfWeek, open: hour.open, close: hour.close }))
          .sort((a, b) => a.day - b.day),
      };
    },

    async listLocations(): Promise<{ locations: LocationOption[] }> {
      const rows = await repo.listLocations();
      return {
        locations: rows.map((row) => ({
          location_id: row.locationId,
          location: row.location,
          faculty_id: row.facultyId,
          faculty: row.faculty,
        })),
      };
    },

    async listCategories(): Promise<{ categories: CategoryOption[] }> {
      const rows = await repo.listCategories();
      return {
        categories: rows.map((row) => ({ category_id: row.categoryId, category: row.category })),
      };
    },
  };
}

export type SupplierService = ReturnType<typeof createSupplierService>;
