/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Route tests for the admin supplier list and detail endpoints (Phase 2 plan Task 3):
 *        role restriction, filter pass-through and error mapping. No requirements, architecture,
 *        schema, or API decisions were made by the AI tool.
 * Author review:
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { SupplierService } from '../business/supplierService.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { createAdminSupplierRouter } from './adminSupplier.routes.js';

function buildApp(overrides: Record<string, unknown> = {}) {
  const service = {
    listAdminSuppliers: vi.fn().mockResolvedValue({
      metadata: { totalRecords: 0, currPage: 1, limit: 50, totalPages: 0 },
      data: [],
    }),
    getAdminSupplier: vi.fn().mockResolvedValue({ id: 101, version: 2 }),
    ...overrides,
  };
  const app = express();
  app.use((req, _res, next) => {
    const role = req.headers['x-test-role'];
    if (typeof role === 'string') req.user = { user_id: 'u-1', role };
    next();
  });
  app.use('/api/v1/admin/suppliers', createAdminSupplierRouter(service as unknown as SupplierService));
  app.use(errorHandler);
  return { app, service };
}

describe.each(['admin', 'super admin'])('role %s', (role) => {
  it('may list and read admin suppliers', async () => {
    const { app } = buildApp();
    expect((await request(app).get('/api/v1/admin/suppliers').set('x-test-role', role)).status).toBe(200);
    expect((await request(app).get('/api/v1/admin/suppliers/101').set('x-test-role', role)).status).toBe(200);
  });
});

describe('access control', () => {
  it('rejects the user role with 403 and never reaches the service', async () => {
    const { app, service } = buildApp();
    const res = await request(app).get('/api/v1/admin/suppliers').set('x-test-role', 'user');
    expect(res.status).toBe(403);
    expect(service.listAdminSuppliers).not.toHaveBeenCalled();
  });

  it('rejects a request with no identity with 403', async () => {
    const { app } = buildApp();
    expect((await request(app).get('/api/v1/admin/suppliers/101')).status).toBe(403);
  });
});

describe('list validation and filters', () => {
  it('passes the same filters as the user list', async () => {
    const { app, service } = buildApp();
    await request(app)
      .get('/api/v1/admin/suppliers?search=store&location_id=4&category_id=2&isOpen=true&sortOrder=Z-A&page=2')
      .set('x-test-role', 'admin');

    expect(service.listAdminSuppliers).toHaveBeenCalledWith({
      page: 2,
      search: 'store',
      locationId: 4,
      categoryId: 2,
      isOpen: true,
      sortOrder: 'Z-A',
    });
  });

  it('rejects a limit other than 50 with 422', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/v1/admin/suppliers?limit=10').set('x-test-role', 'admin');
    expect(res.status).toBe(422);
  });

  it('maps an unknown id to 404', async () => {
    const { app } = buildApp({
      getAdminSupplier: vi.fn().mockRejectedValue(new AppError(404, 'Not Found', 'Supplier not found.')),
    });
    const res = await request(app).get('/api/v1/admin/suppliers/999').set('x-test-role', 'admin');
    expect(res.status).toBe(404);
  });
});
