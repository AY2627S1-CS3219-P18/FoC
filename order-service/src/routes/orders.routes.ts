/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope (2026-10-20): Issue #4 - credit client removed from the router deps (credit calls moved to
 *        the worker).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Issue #5 - POST /orders/:id/accept, following the existing
 *        POST /orders/:id/<action> transition routes.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Issue #6 - GET /orders/active (F12.1.3, path by convention under
 *        /orders); writes receive the order-event publisher. Authentication is applied to
 *        all of /orders by Wen Xi's middleware in app.ts.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { Router } from 'express';
import type { RequestStatus } from '../generated/prisma/client.js';
import type { OrderEventPublisher } from '../realtime/order-events.js';
import type { PrismaClient } from '../db/prisma.js';
import * as ordersController from '../controllers/orders.controller.js';

export interface OrdersRouterDeps {
  events?: OrderEventPublisher;
}

export function ordersRouter(
  prisma: PrismaClient,
  { events }: OrdersRouterDeps = {},
): Router {
  const router = Router();
  const transition = (status: RequestStatus) =>
    ordersController.transitionOrder(prisma, status, events);

  router.get('/', ordersController.getOrders(prisma));
  router.get('/active', ordersController.getActiveDeliveries(prisma));
  router.post('/', ordersController.createOrder(prisma));
  router.post('/:id/accept', transition('accepted'));
  router.post('/:id/pickup', transition('picked_up'));
  router.post('/:id/deliver', transition('delivered'));
  router.post('/:id/complete', transition('completed'));
  router.post('/:id/cancel', transition('cancelled'));
  router.patch('/:id/edit', ordersController.editOrder(prisma, events));
  return router;
}
