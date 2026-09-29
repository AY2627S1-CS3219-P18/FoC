/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Generated unit tests for the 30 req/min/IP rate limiter (SupplierServiceSpec.md, "Phase 0 — Foundations").
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { errorHandler } from './errorHandler.js';
import { createRateLimiter } from './rateLimit.js';

function buildApp(): express.Express {
  const app = express();
  app.set('trust proxy', true);
  app.use(createRateLimiter());
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('rateLimit', () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
  });

  it('allows requests under the limit', async () => {
    for (let i = 0; i < 30; i++) {
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
    }
  });

  it('rejects the 31st request within the same window with 429', async () => {
    for (let i = 0; i < 30; i++) {
      await request(app).get('/ping');
    }

    const res = await request(app).get('/ping');

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      status_code: 429,
      error: 'Too Many Requests',
    });
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('tracks separate IPs independently', async () => {
    for (let i = 0; i < 30; i++) {
      await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.1');
    }
    const blocked = await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.1');
    const otherIp = await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.2');

    expect(blocked.status).toBe(429);
    expect(otherIp.status).toBe(200);
  });
});
