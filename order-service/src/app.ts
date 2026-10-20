/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-09-23
 * Scope: Project scaffolding / infrastructure only. No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope (2026-10-20): Issue #4 - dropped the credit client from AppDeps; the API no longer calls
 *        credit-service.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Issue #6 - createApp takes the order-event publisher; REST auth is
 *        Wen Xi's authenticate middleware (George, 2026-10-20: keep hers).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import express, { type Express } from 'express';
import type { PrismaClient } from './db/prisma.js';
import type { RequestHandler } from 'express';
import { createAuthenticate } from './middleware/authenticate.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.routes.js';
import { ordersRouter } from './routes/orders.routes.js';
import type { OrderEventPublisher } from './realtime/order-events.js';

export interface AppDeps {
  prisma: PrismaClient;
  authenticate?: RequestHandler;
  userServiceUrl?: string;
  /** Where writes publish order events (the Socket.IO sink in production). */
  events?: OrderEventPublisher;
}

/**
 * Builds the Express app without listening, so tests can drive it with
 * supertest and inject fake dependencies.
 */
export function createApp({
  prisma,
  authenticate,
  userServiceUrl = 'http://localhost:3001',
  events,
}: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/health', healthRouter(prisma));
  app.use(
    '/orders',
    authenticate ?? createAuthenticate(userServiceUrl),
    ordersRouter(prisma, { events }),
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
