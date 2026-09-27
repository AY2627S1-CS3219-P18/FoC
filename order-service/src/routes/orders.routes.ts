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
  return router;
}
