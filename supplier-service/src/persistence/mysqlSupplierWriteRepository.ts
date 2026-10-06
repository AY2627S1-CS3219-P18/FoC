/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Implemented the MySQL write repository (create/reactivate transactions) from the Phase 2 plan (Task 7).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-09-29 update): Reactivation now also replaces supplier_name with the submitted spelling (Phase 2 Task 7 review fix).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { AppError } from '../utils/AppError.js';
import type { NewSupplier, SupplierWriteRepository } from './supplierWriteRepository.js';

function duplicate(): AppError {
  const message = 'A supplier with the same name, type and location already exists.';
  return new AppError(422, 'Unprocessable Entity', message, {
    details: [{ field: 'name', location: 'body', message }],
  });
}

export function createMysqlSupplierWriteRepository(pool: Pool): SupplierWriteRepository {
  async function inTransaction<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await work(conn);
      await conn.commit();
      return result;
    } catch (error) {
      // A failed rollback must not mask the original error; release still runs in finally.
      await conn.rollback().catch(() => undefined);
      throw error;
    } finally {
      conn.release();
    }
  }

  async function insertChildren(conn: PoolConnection, supplierId: number, input: NewSupplier): Promise<void> {
    if (input.categoryIds.length > 0) {
      await conn.query('INSERT INTO supplier_category_map (supplier_id, category_id) VALUES ?', [
        input.categoryIds.map((categoryId) => [supplierId, categoryId]),
      ]);
    }
    if (input.hours.length > 0) {
      await conn.query(
        'INSERT INTO supplier_hours (supplier_id, day_of_week, open_time, close_time, is_24h) VALUES ?',
        [input.hours.map((hour) => [supplierId, hour.day, hour.open, hour.close, hour.is24h ? 1 : 0])],
      );
    }
    if (input.photoLocations.length > 0) {
      await conn.query('INSERT INTO supplier_photos (supplier_id, photo_location, display_order) VALUES ?', [
        input.photoLocations.map((location, index) => [supplierId, location, index]),
      ]);
    }
  }

  return {
    async findByIdentity(name, type, locationId) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT supplier_id, is_deleted FROM supplier
         WHERE supplier_name = ? AND supplier_type = ? AND location_id = ?`,
        [name, type, locationId],
      );
      const row = rows[0];
      return row === undefined ? null : { supplierId: Number(row.supplier_id), isDeleted: Boolean(row.is_deleted) };
    },

    async locationExists(locationId) {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT location_id FROM supplier_locations WHERE location_id = ?',
        [locationId],
      );
      return rows.length > 0;
    },

    async findMissingCategoryIds(categoryIds) {
      if (categoryIds.length === 0) return [];
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT category_id FROM supplier_categories WHERE category_id IN (?)',
        [categoryIds],
      );
      const found = new Set(rows.map((row) => Number(row.category_id)));
      return categoryIds.filter((id) => !found.has(id));
    },

    async insertSupplier(input) {
      try {
        return await inTransaction(async (conn) => {
          const [result] = await conn.query<ResultSetHeader>(
            `INSERT INTO supplier
               (supplier_name, supplier_type, supplier_desc, location_id, created_on, created_by, updated_on)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [input.name, input.type, input.desc, input.locationId, input.now, input.createdBy, input.now],
          );
          const supplierId = Number(result.insertId);
          await insertChildren(conn, supplierId, input);
          return supplierId;
        });
      } catch (error) {
        if ((error as { code?: string } | null)?.code === 'ER_DUP_ENTRY') throw duplicate();
        throw error;
      }
    },

    async reactivateSupplier(supplierId, input) {
      return inTransaction(async (conn) => {
        const [current] = await conn.query<RowDataPacket[]>(
          'SELECT is_deleted FROM supplier WHERE supplier_id = ? FOR UPDATE',
          [supplierId],
        );
        if (current[0] === undefined || !current[0].is_deleted) {
          throw duplicate();
        }

        const [oldPhotos] = await conn.query<RowDataPacket[]>(
          'SELECT photo_location FROM supplier_photos WHERE supplier_id = ? ORDER BY display_order',
          [supplierId],
        );

        await conn.query(
          `UPDATE supplier
           SET supplier_name = ?, supplier_desc = ?, is_active = TRUE, is_deleted = FALSE, updated_on = ?, version = version + 1
           WHERE supplier_id = ?`,
          [input.name, input.desc, input.now, supplierId],
        );
        await conn.query('DELETE FROM supplier_category_map WHERE supplier_id = ?', [supplierId]);
        await conn.query('DELETE FROM supplier_hours WHERE supplier_id = ?', [supplierId]);
        await conn.query('DELETE FROM supplier_photos WHERE supplier_id = ?', [supplierId]);
        await insertChildren(conn, supplierId, input);

        return { replacedPhotoLocations: oldPhotos.map((row) => String(row.photo_location)) };
      });
    },
  };
}
