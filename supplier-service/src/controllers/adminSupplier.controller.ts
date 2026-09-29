/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Controller for the admin supplier list and detail endpoints (Phase 2 plan Task 3;
 *        SupplierServiceArchitecture.md §7). Reuses the Phase 1 query validation. No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import type { SupplierService } from '../business/supplierService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParamSchema, listQuerySchema, parseOrThrow } from '../validation/supplierQuery.js';

export function createAdminSupplierController(reader: SupplierService) {
  return {
    list: asyncHandler(async (req, res) => {
      const query = parseOrThrow(listQuerySchema, req.query, 'query');
      res.status(200).json(
        await reader.listAdminSuppliers({
          page: query.page,
          search: query.search === '' ? undefined : query.search,
          locationId: query.location_id,
          categoryId: query.category_id,
          isOpen: query.isOpen,
          sortOrder: query.sortOrder,
        }),
      );
    }),

    detail: asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(idParamSchema, req.params, 'path');
      res.status(200).json(await reader.getAdminSupplier(id));
    }),
  };
}
