import { Router } from 'express';
import type { PrismaClient } from '../db/prisma.js';
import * as requestsController from '../controllers/requests.controller.js';

export function requestsRouter(db: Pick<PrismaClient, '$queryRaw'>): Router {
  const router = Router();

  router.post('/', requestsController.createRequest);

  return router;
}
