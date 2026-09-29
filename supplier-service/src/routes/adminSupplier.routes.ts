/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Router for the admin supplier list and detail endpoints, restricted to admin and super
 *        admin (Phase 2 plan Task 3; SupplierServiceArchitecture.md §7). No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { Router } from 'express';
import type { SupplierService } from '../business/supplierService.js';
import { createAdminSupplierController } from '../controllers/adminSupplier.controller.js';
import { requireRole } from '../middleware/requireRole.js';

export function createAdminSupplierRouter(reader: SupplierService): Router {
  const controller = createAdminSupplierController(reader);
  const router = Router();

  router.use(requireRole('admin', 'super admin'));
  router.get('/', controller.list);
  router.get('/:id', controller.detail);

  return router;
}
