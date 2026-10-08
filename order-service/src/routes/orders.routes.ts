import { Router } from 'express';
import type { CreditsClient } from '../clients/credits.client.js';
import type { PrismaClient } from '../db/prisma.js';
import * as ordersController from '../controllers/orders.controller.js';

export function ordersRouter(
  prisma: PrismaClient,
  credits: CreditsClient,
): Router {
  const router = Router();
  router.post('/', ordersController.createOrder(prisma, credits));
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
  return router;
}
