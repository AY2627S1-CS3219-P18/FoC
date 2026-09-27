import { Router } from 'express';
import type { PrismaClient } from '../db/prisma.js';
import * as ordersController from '../controllers/orders.controller.js';

export function ordersRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.post('/', ordersController.createOrder(prisma));
  return router;
}
