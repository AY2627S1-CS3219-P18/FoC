/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-09-23
 * Scope: Project scaffolding / infrastructure only. No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 */

import express, { type Express } from 'express';
import type { CreditsClient } from './clients/credits.client.js';
import type { PrismaClient } from './db/prisma.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.routes.js';
import { ordersRouter } from './routes/orders.routes.js';

export interface AppDeps {
  prisma: PrismaClient;
  credits: CreditsClient;
}

/**
 * Builds the Express app without listening, so tests can drive it with
 * supertest and inject fake dependencies.
 */
export function createApp({ prisma, credits }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/health', healthRouter(prisma));
  app.use('/orders', ordersRouter(prisma, credits));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
