/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Generated the Express app wiring: rate limiter, auth middleware and error handler under
 *        /api/v1 (SupplierServiceArchitecture.md §7 intro). No CORS, since a single API gateway
 *        fronts all FoC services (§3); no health-check route (§7.5 deferred); no supplier-domain
 *        routes this phase. No requirements, architecture, schema, or API decisions were made by
 *        the AI tool.
 * Author review: Congchen
 */
import express from 'express';
import { config } from './config.js';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimit.js';

const app = express();

app.set('trust proxy', true);
app.use(express.json());
app.use(createRateLimiter());

const apiV1 = express.Router();
apiV1.use(authenticate);
// Phase 1+ mounts supplier routes on `apiV1` here.
app.use('/api/v1', apiV1);

app.use(errorHandler);

if (config.env !== 'test') {
  app.listen(config.server.port, () => {
    console.log(`supplier-service listening on port ${config.server.port}`);
  });
}

export default app;
