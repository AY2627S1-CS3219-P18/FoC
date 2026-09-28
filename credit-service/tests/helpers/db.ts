// AI Assistance Disclosure:
// Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
//  2026-09-26: Recess iteration - test database helpers.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review: Wee Jean

import { randomUUID } from 'node:crypto';
import pool from '../../src/db/pool.js';

export const newUserId = (): string => randomUUID();
export const newRequestId = (): string => randomUUID();

export async function readBalance(
  userId: string,
): Promise<{ total: number; reserved: number } | null> {
  const { rows } = await pool.query<{ total_balance: number; reserved_balance: number }>(
    'SELECT total_balance, reserved_balance FROM balances WHERE user_id = $1',
    [userId],
  );
  const row = rows[0];
  return row ? { total: row.total_balance, reserved: row.reserved_balance } : null;
}

export async function countTransactions(userId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM transaction_log
      WHERE originating_user_id = $1 OR destination_user_id = $1`,
    [userId],
  );
  return Number(rows[0]?.count ?? '0');
}

/** Removes only the rows a test created, so runs do not interfere with each other. */
export async function cleanupUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await pool.query(
    `DELETE FROM transaction_log
      WHERE originating_user_id = ANY($1::uuid[]) OR destination_user_id = ANY($1::uuid[])`,
    [userIds],
  );
  await pool.query('DELETE FROM balances WHERE user_id = ANY($1::uuid[])', [userIds]);
}

export async function closePool(): Promise<void> {
  await pool.end();
}
