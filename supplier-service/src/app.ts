/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Generated the Express app wiring: rate limiter, auth middleware and error handler under
 *        /api/v1 (SupplierServiceArchitecture.md §7 intro). No CORS, since a single API gateway
 *        fronts all FoC services (§3); no health-check route (§7.5 deferred); no supplier-domain
 *        routes this phase. No requirements, architecture, schema, or API decisions were made by
 *        the AI tool.
 * Author review: Congchen
 * Scope (2026-09-29, Claude Code, model: claude-sonnet-5): mounted the Phase 1 /suppliers router on
 *        apiV1. No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import express from 'express';
import { createSupplierService } from './business/supplierService.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { createMysqlSupplierRepository } from './persistence/mysqlSupplierRepository.js';
import { createSupplierRouter } from './routes/supplier.routes.js';

const app = express();

app.set('trust proxy', true);
app.use(express.json());
app.use(createRateLimiter());

const apiV1 = express.Router();
apiV1.use(authenticate);
apiV1.use(
  '/suppliers',
  createSupplierRouter(createSupplierService(createMysqlSupplierRepository(pool))),
);
// Phase 2+ mounts /admin routes on `apiV1` here.
app.use('/api/v1', apiV1);

app.use(errorHandler);

if (config.env !== 'test') {
  app.listen(config.server.port, () => {
    console.log(`supplier-service listening on port ${config.server.port}`);
  });
}

export default app;
