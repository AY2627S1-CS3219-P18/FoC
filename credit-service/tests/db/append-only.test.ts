// AI Assistance Disclosure:
// Tool: Claude Code (model: claude-opus-5), date: 2026-10-16
//  2026-10-16: Week 7/8 catch-up - evidence for NFR8.2.3. The suite connects as the
//    least-privilege role, so these assert the real production privileges.
//    Requires a running credit-db; see credit-service/README.md.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review:

import { afterAll, describe, expect, it } from 'vitest';
import pool from '../../src/db/pool.js';
import { closePool, givenReservation } from '../helpers/db.js';

/** 42501 is insufficient_privilege — the error a missing GRANT produces. */
const PG_INSUFFICIENT_PRIVILEGE = '42501';

afterAll(async () => {
  await closePool();
});

describe('NFR8.2.3 — the transaction log is append-only', () => {
  it('connects as the least-privilege role, not a superuser', async () => {
    const { rows } = await pool.query<{ user: string; superuser: boolean }>(
      `SELECT current_user AS user,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser`,
    );
    // If this fails, every other assertion in this file is meaningless: a superuser
    // bypasses GRANT and REVOKE entirely.
    expect(rows[0]?.user).toBe(process.env.DB_USER);
    expect(rows[0]?.superuser).toBe(false);
  });

  it('refuses DELETE on transaction_log', async () => {
    const { requestId } = await givenReservation(3);

    await expect(
      pool.query('DELETE FROM transaction_log WHERE request_id = $1', [requestId]),
    ).rejects.toMatchObject({ code: PG_INSUFFICIENT_PRIVILEGE });

    // The row is still there.
    const { rows } = await pool.query('SELECT 1 FROM transaction_log WHERE request_id = $1', [
      requestId,
    ]);
    expect(rows).toHaveLength(1);
  });

  it('refuses UPDATE on transaction_log', async () => {
    const { requestId } = await givenReservation(3);

    await expect(
      pool.query('UPDATE transaction_log SET amount = 999 WHERE request_id = $1', [requestId]),
    ).rejects.toMatchObject({ code: PG_INSUFFICIENT_PRIVILEGE });

    const { rows } = await pool.query<{ amount: number }>(
      'SELECT amount FROM transaction_log WHERE request_id = $1',
      [requestId],
    );
    expect(rows[0]?.amount).toBe(3);
  });

  it('refuses TRUNCATE on transaction_log', async () => {
    await expect(pool.query('TRUNCATE transaction_log')).rejects.toMatchObject({
      code: PG_INSUFFICIENT_PRIVILEGE,
    });
  });

  it('refuses DELETE on balances', async () => {
    const { requesterId } = await givenReservation(2);

    await expect(
      pool.query('DELETE FROM balances WHERE user_id = $1', [requesterId]),
    ).rejects.toMatchObject({ code: PG_INSUFFICIENT_PRIVILEGE });
  });

  it('still allows the writes the service actually needs', async () => {
    // SELECT and INSERT on the log, SELECT/INSERT/UPDATE on balances. If any of these
    // were revoked too, the service would be broken rather than merely safe.
    const { requesterId, requestId } = await givenReservation(1);
    const { rows } = await pool.query('SELECT 1 FROM transaction_log WHERE request_id = $1', [
      requestId,
    ]);
    expect(rows).toHaveLength(1);
    await expect(
      pool.query('UPDATE balances SET updated_at = NOW() WHERE user_id = $1', [requesterId]),
    ).resolves.toBeDefined();
  });
});
