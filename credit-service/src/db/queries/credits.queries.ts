// AI Assistance Disclosure:
// Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
//  2026-09-26: Recess iteration - queries for balances and transaction_log.
//    Column names and the write-path effects follow credit-service-context.md §5;
//    the transaction_log fields follow F20.1.1.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review: Wee Jean

import type pg from 'pg';

/** Postgres SQLSTATE codes we handle by name rather than by message text. */
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_CHECK_VIOLATION = '23514';

export interface BalanceRow {
  user_id: string;
  total_balance: number;
  reserved_balance: number;
}

export type TransactionType = 'allocation' | 'reservation' | 'transfer' | 'release';

export interface TransactionRow {
  transaction_id: string;
  transaction_type: TransactionType;
  originating_user_id: string | null;
  destination_user_id: string | null;
  amount: number;
  created_at: Date;
  request_id: string | null;
}

const BALANCE_COLUMNS = 'user_id, total_balance, reserved_balance';

/**
 * Creates the user's balance row with their starting credits (F19.1.1).
 *
 * Returns null when the row already existed. The PRIMARY KEY on user_id makes this the
 * race-safe way to answer "is this the first allocation?" - two concurrent calls both
 * reach the INSERT, exactly one gets a row back, and the loser is told the credits were
 * already allocated rather than writing a second log entry.
 */
export async function insertInitialBalance(
  client: pg.PoolClient,
  userId: string,
  credits: number,
): Promise<BalanceRow | null> {
  const { rows } = await client.query<BalanceRow>(
    `INSERT INTO balances (user_id, total_balance, reserved_balance)
     VALUES ($1, $2, 0)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING ${BALANCE_COLUMNS}`,
    [userId, credits],
  );
  return rows[0] ?? null;
}

/**
 * Reads a balance and holds a row lock until the surrounding transaction ends.
 *
 * `FOR UPDATE` is what satisfies NFR8.1.1: concurrent reservations for the same user
 * queue behind each other instead of both reading the same stale unreserved figure.
 * context §4 is explicit that atomicity comes from Postgres, never from assumptions
 * about Node's event loop.
 */
export async function lockBalanceForUpdate(
  client: pg.PoolClient,
  userId: string,
): Promise<BalanceRow | null> {
  const { rows } = await client.query<BalanceRow>(
    `SELECT ${BALANCE_COLUMNS} FROM balances WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  return rows[0] ?? null;
}

/** Reservation write path (context §5): total unchanged, reserved + amount. */
export async function increaseReservedBalance(
  client: pg.PoolClient,
  userId: string,
  amount: number,
): Promise<BalanceRow> {
  const { rows } = await client.query<BalanceRow>(
    `UPDATE balances
        SET reserved_balance = reserved_balance + $2,
            updated_at = NOW()
      WHERE user_id = $1
      RETURNING ${BALANCE_COLUMNS}`,
    [userId, amount],
  );
  const row = rows[0];
  if (!row) {
    // Unreachable: callers lock the row first, so it exists for the whole transaction.
    throw new Error(`increaseReservedBalance: no balance row for user ${userId}`);
  }
  return row;
}

export interface TransactionEntry {
  transactionType: TransactionType;
  originatingUserId: string | null;
  destinationUserId: string | null;
  amount: number;
  requestId: string | null;
}

/**
 * Appends one row to the transaction log (F20.1.1).
 *
 * Always called on the same client, inside the same transaction, as the balance write
 * it describes (context §5). transaction_id and created_at are database defaults, so the
 * log's identity and timestamp do not depend on application clocks.
 */
export async function insertTransaction(
  client: pg.PoolClient,
  entry: TransactionEntry,
): Promise<TransactionRow> {
  const { rows } = await client.query<TransactionRow>(
    `INSERT INTO transaction_log
       (transaction_type, originating_user_id, destination_user_id, amount, request_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING transaction_id, transaction_type, originating_user_id,
               destination_user_id, amount, created_at, request_id`,
    [
      entry.transactionType,
      entry.originatingUserId,
      entry.destinationUserId,
      entry.amount,
      entry.requestId,
    ],
  );
  const row = rows[0];
  if (!row) {
    throw new Error('insertTransaction: INSERT ... RETURNING produced no row');
  }
  return row;
}

/** True when `err` is a Postgres error carrying the given SQLSTATE. */
export function isPgError(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === code
  );
}

/** The constraint name Postgres reports, if the error carries one. */
export function pgConstraint(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'constraint' in err) {
    const value = (err as { constraint?: unknown }).constraint;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}
