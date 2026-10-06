/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Wrote the tests for the MySQL write repository from the Phase 2 plan (Task 7).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-09-29 update): Reactivation now also replaces supplier_name with the submitted spelling (Phase 2 Task 7 review fix).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-09-30, Claude Code, model: claude-sonnet-5): moved from src/persistence/mysqlSupplierWriteRepository.test.ts to test/persistence/mysqlSupplierWriteRepository.test.ts and updated
 *        the relative imports; no test logic changed. No requirements, architecture, schema, or
 *        API decisions were made by the AI tool.
 * Author review:
 */
import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { createMysqlSupplierWriteRepository } from '../../src/persistence/mysqlSupplierWriteRepository.js';
import type { NewSupplier } from '../../src/persistence/supplierWriteRepository.js';

const input: NewSupplier = {
  name: 'Campus Store',
  type: 'Store',
  desc: 'desc',
  locationId: 4,
  categoryIds: [2, 3],
  hours: [{ day: 1, open: '09:00', close: '18:00', is24h: false }],
  photoLocations: ['loc-a', 'loc-b'],
  createdBy: 'u-1',
  now: '2026-09-29 10:00:00',
};

function fakePool(steps: Array<unknown | Error>) {
  const conn = {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
    query: vi.fn(),
  };
  for (const step of steps) {
    if (step instanceof Error) conn.query.mockRejectedValueOnce(step);
    else conn.query.mockResolvedValueOnce([step, []]);
  }
  const pool = { getConnection: vi.fn().mockResolvedValue(conn), query: vi.fn() };
  return { pool: pool as unknown as Pool, conn, poolQuery: pool.query };
}

const sqls = (conn: { query: { mock: { calls: unknown[][] } } }) =>
  conn.query.mock.calls.map((c) => String(c[0]).replace(/\s+/g, ' ').trim());

describe('insertSupplier', () => {
  it('inserts supplier, categories, hours and 0-based photos in one transaction', async () => {
    const { pool, conn } = fakePool([{ insertId: 11 }, {}, {}, {}]);
    const id = await createMysqlSupplierWriteRepository(pool).insertSupplier(input);

    expect(id).toBe(11);
    expect(conn.beginTransaction).toHaveBeenCalled();
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
    expect(conn.query.mock.calls[0]?.[1]).toEqual(['Campus Store', 'Store', 'desc', 4, '2026-09-29 10:00:00', 'u-1', '2026-09-29 10:00:00']);
    expect(conn.query.mock.calls[1]?.[1]).toEqual([[[11, 2], [11, 3]]]);
    expect(conn.query.mock.calls[2]?.[1]).toEqual([[[11, 1, '09:00', '18:00', 0]]]);
    expect(conn.query.mock.calls[3]?.[1]).toEqual([[[11, 'loc-a', 0], [11, 'loc-b', 1]]]);
  });

  it('skips empty child inserts', async () => {
    const { pool, conn } = fakePool([{ insertId: 5 }, {}]);
    await createMysqlSupplierWriteRepository(pool).insertSupplier({ ...input, categoryIds: [], photoLocations: [] });
    expect(sqls(conn)).toHaveLength(2); // supplier + hours
  });

  it('rolls back and maps a duplicate-key race to 422', async () => {
    const dup = Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
    const { pool, conn } = fakePool([dup]);

    await expect(createMysqlSupplierWriteRepository(pool).insertSupplier(input)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  it('rolls back on any other failure and rethrows it', async () => {
    const { pool, conn } = fakePool([{ insertId: 5 }, new Error('boom')]);
    await expect(createMysqlSupplierWriteRepository(pool).insertSupplier(input)).rejects.toThrow('boom');
    expect(conn.rollback).toHaveBeenCalled();
  });
});

describe('reactivateSupplier', () => {
  it('locks the row, clears the soft delete, bumps version and replaces children', async () => {
    const { pool, conn } = fakePool([
      [{ is_deleted: 1 }], // SELECT ... FOR UPDATE
      [{ photo_location: 'old-1' }, { photo_location: 'old-2' }], // old photos
      {}, // UPDATE supplier
      {}, {}, {}, // DELETE map, hours, photos
      {}, {}, {}, // INSERT map, hours, photos
    ]);

    const result = await createMysqlSupplierWriteRepository(pool).reactivateSupplier(11, input);

    expect(result).toEqual({ replacedPhotoLocations: ['old-1', 'old-2'] });
    const statements = sqls(conn);
    expect(statements[0]).toContain('FOR UPDATE');
    expect(statements[2]).toContain('supplier_name = ?');
    expect(statements[2]).toContain('is_active = TRUE');
    expect(statements[2]).toContain('is_deleted = FALSE');
    expect(statements[2]).toContain('version = version + 1');
    expect(conn.query.mock.calls[2]?.[1]).toEqual(['Campus Store', 'desc', '2026-09-29 10:00:00', 11]);
    expect(statements.slice(3, 6).every((s) => s.startsWith('DELETE FROM'))).toBe(true);
    expect(conn.commit).toHaveBeenCalled();
  });

  it('rejects with 422 when the supplier is no longer soft-deleted', async () => {
    const { pool, conn } = fakePool([[{ is_deleted: 0 }]]);
    await expect(createMysqlSupplierWriteRepository(pool).reactivateSupplier(11, input)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(conn.rollback).toHaveBeenCalled();
  });
});

describe('lookups', () => {
  it('findByIdentity maps the row', async () => {
    const { pool, poolQuery } = fakePool([]);
    poolQuery.mockResolvedValueOnce([[{ supplier_id: 3, is_deleted: 1 }], []]);
    expect(await createMysqlSupplierWriteRepository(pool).findByIdentity('A', 'Store', 4)).toEqual({
      supplierId: 3,
      isDeleted: true,
    });
  });

  it('findMissingCategoryIds returns only the ids that were not found', async () => {
    const { pool, poolQuery } = fakePool([]);
    poolQuery.mockResolvedValueOnce([[{ category_id: 2 }], []]);
    expect(await createMysqlSupplierWriteRepository(pool).findMissingCategoryIds([2, 9])).toEqual([9]);
  });

  it('locationExists is true only when a row is found', async () => {
    const { pool, poolQuery } = fakePool([]);
    poolQuery.mockResolvedValueOnce([[{ location_id: 4 }], []]).mockResolvedValueOnce([[], []]);
    const repo = createMysqlSupplierWriteRepository(pool);
    expect(await repo.locationExists(4)).toBe(true);
    expect(await repo.locationExists(5)).toBe(false);
  });
});
