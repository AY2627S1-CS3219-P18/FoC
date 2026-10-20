/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope (2026-10-20): Issue #4 - credit client removed from the router deps (credit calls moved to
 *        the worker).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { Router } from 'express';
import type { PrismaClient } from '../db/prisma.js';
import * as ordersController from '../controllers/orders.controller.js';

export function ordersRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.post('/', ordersController.createOrder(prisma));
  router.get('/', ordersController.getOrders(prisma));
  router.post(
    '/:id/pickup',
    ordersController.transitionOrder(prisma, 'picked_up'),
  );
  router.post(
    '/:id/deliver',
    ordersController.transitionOrder(prisma, 'delivered'),
  );
  router.post(
    '/:id/complete',
    ordersController.transitionOrder(prisma, 'completed'),
  );
  router.post(
    '/:id/cancel',
    ordersController.transitionOrder(prisma, 'cancelled'),
  );
  router.patch('/:id/edit', ordersController.editOrder(prisma));
  return router;
}
