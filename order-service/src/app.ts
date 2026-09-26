/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-09-23
 * Scope: Project scaffolding / infrastructure only. No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 */

import express, { type Express } from 'express';
import type { PrismaClient } from './db/prisma.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.routes.js';
import { requestsRouter } from './routes/requests.routes.js';

export interface AppDeps {
  prisma: PrismaClient;
}

/**
 * Builds the Express app without listening, so tests can drive it with
 * supertest and inject a fake Prisma client.
 */
export function createApp({ prisma }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/health', healthRouter(prisma));
  app.use('/requests', requestsRouter(prisma));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
