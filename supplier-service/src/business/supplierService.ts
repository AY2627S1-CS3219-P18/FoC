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
 * Scope (2026-09-29, Claude Code, model: claude-sonnet-5): generalised list/detail assembly and
 *        added the admin list/detail workflows per Phase 2 plan Task 3 (Arch §7). No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import type {
  AdminSupplierRow,
  CategoryLinkRow,
  HourRow,
  ListCriteria,
  ListFilter,
  PhotoRow,
  SupplierRepository,
  SupplierRow,
} from '../persistence/supplierRepository.js';
import type {
  AdminSupplierDetail,
  AdminSupplierSummary,
  CategoryOption,
  LocationOption,
  Paginated,
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

interface Assembled<R extends SupplierRow> {
  row: R;
  summary: SupplierSummary;
  hours: HourRow[];
}

interface PageSource<R extends SupplierRow> {
  page(filter: ListFilter): Promise<{ rows: R[]; total: number }>;
  all(criteria: ListCriteria): Promise<R[]>;
}

function envelope<T>(page: number, total: number, data: T[]): Paginated<T> {
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
  async function assemble<R extends SupplierRow>(rows: R[]): Promise<Assembled<R>[]> {
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.supplierId);
    const [categoryLinks, hours, photos]: [CategoryLinkRow[], HourRow[], PhotoRow[]] =
      await Promise.all([repo.findCategoryLinks(ids), repo.findHours(ids), repo.findPhotos(ids)]);
    const now = clock();

    return rows.map((row) => {
      const ownHours = hours.filter((hour) => hour.supplierId === row.supplierId);
      return {
        row,
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

  async function listPage<R extends SupplierRow, S>(
    params: ListParams,
    source: PageSource<R>,
    decorate: (item: Assembled<R>) => S,
  ): Promise<Paginated<S>> {
    const criteria = {
      search: params.search,
      locationId: params.locationId,
      categoryId: params.categoryId,
      sortOrder: params.sortOrder,
    };
    const offset = (params.page - 1) * PAGE_SIZE;

    if (params.isOpen === undefined) {
      const { rows, total } = await source.page({ ...criteria, limit: PAGE_SIZE, offset });
      const assembled = await assemble(rows);
      return envelope(params.page, total, assembled.map(decorate));
    }

    // isOpen is computed, not stored, so filter the whole matching set before cutting the page.
    const all = await assemble(await source.all(criteria));
    const matching = all.filter((item) => item.summary.isOpen === params.isOpen);
    return envelope(params.page, matching.length, matching.slice(offset, offset + PAGE_SIZE).map(decorate));
  }

  function toDetail(item: Assembled<SupplierRow>): SupplierDetail {
    return {
      ...item.summary,
      desc: item.row.desc,
      openingHours: item.hours
        .map((hour) => ({ day: hour.dayOfWeek, open: hour.open, close: hour.close }))
        .sort((a, b) => a.day - b.day),
    };
  }

  return {
    listSuppliers(params: ListParams): Promise<PaginatedSuppliers> {
      return listPage(
        params,
        {
          page: (filter) => repo.findVisiblePage(filter),
          all: (criteria) => repo.findAllVisible(criteria),
        },
        (item) => item.summary,
      );
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
      return toDetail(assembled);
    },

    listAdminSuppliers(params: ListParams): Promise<Paginated<AdminSupplierSummary>> {
      return listPage<AdminSupplierRow, AdminSupplierSummary>(
        params,
        {
          page: (filter) => repo.findAdminPage(filter),
          all: (criteria) => repo.findAllAdmin(criteria),
        },
        (item) => ({ ...item.summary, isActive: item.row.isActive, isDeleted: item.row.isDeleted }),
      );
    },

    async getAdminSupplier(supplierId: number): Promise<AdminSupplierDetail> {
      const row = await repo.findAdminById(supplierId);
      if (row === null) {
        throw new AppError(404, 'Not Found', 'Supplier not found.');
      }
      const [assembled] = await assemble([row]);
      if (assembled === undefined) {
        throw new AppError(404, 'Not Found', 'Supplier not found.');
      }
      return {
        ...toDetail(assembled),
        isActive: row.isActive,
        isDeleted: row.isDeleted,
        createdOn: row.createdOn,
        createdBy: row.createdBy,
        updatedOn: row.updatedOn,
        version: row.version,
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
