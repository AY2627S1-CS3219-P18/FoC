// AI Assistance Disclosure:
// Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
//  2026-09-26: Recess iteration - allocation (F19.1.1) and reservation (F19.2.1-F19.2.3),
//    each wrapped in one database transaction that writes balances and transaction_log
//    together (NFR8.1.1, F20.1.1, context §5).
//    The error `code` strings and the HTTP statuses they map to are NOT team-decided;
//    they are pending sign-off - see credit-service/README.md.
//    Author review: Wee Jean

import { INITIAL_ALLOCATION_CREDITS } from '../domain/constants.js';
import { withTransaction } from '../db/transaction.js';
import { AppError } from '../utils/AppError.js';
import pool from '../db/pool.js';
import {
  PG_UNIQUE_VIOLATION,
  creditCourierForTransfer,
  debitRequesterForTransfer,
  decreaseReservedBalance,
  findReservation,
  hasTransactionOfType,
  increaseReservedBalance,
  insertInitialBalance,
  insertTransaction,
  isPgError,
  lockBalanceForUpdate,
  lockTwoBalancesForUpdate,
  pgConstraint,
  readBalance,
  type BalanceRow,
  type TransactionRow,
} from '../db/queries/credits.queries.js';

export interface BalanceView {
  userId: string;
  totalBalance: number;
  reservedBalance: number;
  /** Derived, never stored (context §5). */
  unreservedBalance: number;
}

export interface CreditOperationResult {
  balance: BalanceView;
  transaction: TransactionRow;
}

function toBalanceView(row: BalanceRow): BalanceView {
  return {
    userId: row.user_id,
    totalBalance: row.total_balance,
    reservedBalance: row.reserved_balance,
    unreservedBalance: row.total_balance - row.reserved_balance,
  };
}

/**
 * F19.1.1 - allocate the starting credits to a newly registered user.
 *
 * One transaction: create the balance row, then log the allocation. If either statement
 * fails the other is rolled back, so a user can never end up with credits that were
 * never logged, or a logged allocation that granted nothing.
 */
export async function allocateInitialCredits(userId: string): Promise<CreditOperationResult> {
  return withTransaction(async (client) => {
    const balance = await insertInitialBalance(client, userId, INITIAL_ALLOCATION_CREDITS);

    if (!balance) {
      // The row already existed. Registration is a once-per-user event, so this is a
      // repeated trigger rather than a second entitlement: no credits, no log entry.
      throw new AppError(
        409,
        'Credits have already been allocated to this user.',
        'ALREADY_ALLOCATED',
      );
    }

    const transaction = await insertTransaction(client, {
      transactionType: 'allocation',
      // Team decision 2026-09-26: an allocation names the new user as destination.
      originatingUserId: null,
      destinationUserId: userId,
      amount: INITIAL_ALLOCATION_CREDITS,
      requestId: null,
    });

    return { balance: toBalanceView(balance), transaction };
  });
}

/**
 * F19.2.1 - reserve the offered credits when a request is created.
 * F19.2.3 - reject when the offer exceeds the requester's unreserved balance.
 *
 * One transaction: lock the balance row, check unreserved against the offer, move the
 * credits into reserved, then log the reservation. The `FOR UPDATE` lock is what makes
 * two simultaneous reservations for the same user safe (NFR8.1.1) - the second one waits,
 * then re-reads the balance the first one left behind rather than the balance it saw
 * before the first committed.
 */
export async function reserveCredits(
  userId: string,
  requestId: string,
  amount: number,
): Promise<CreditOperationResult> {
  return withTransaction(async (client) => {
    const current = await lockBalanceForUpdate(client, userId);

    if (!current) {
      throw new AppError(404, 'No credit balance exists for this user.', 'BALANCE_NOT_FOUND');
    }

    const unreserved = current.total_balance - current.reserved_balance;
    if (amount > unreserved) {
      // F19.2.3. Reserved credits are unavailable to any other transaction (F19.2.2),
      // which is exactly why the comparison is against unreserved and not total.
      throw new AppError(
        422,
        `Offer of ${amount} credits exceeds the unreserved balance of ${unreserved}.`,
        'INSUFFICIENT_UNRESERVED_CREDITS',
      );
    }

    const balance = await increaseReservedBalance(client, userId, amount);

    let transaction: TransactionRow;
    try {
      transaction = await insertTransaction(client, {
        transactionType: 'reservation',
        originatingUserId: userId,
        destinationUserId: null,
        amount,
        requestId,
      });
    } catch (err) {
      // Team decision 2026-09-26: one reservation per request, enforced by a unique
      // partial index. A repeated "request created" trigger lands here, and the throw
      // rolls back the reserved_balance increase above.
      if (
        isPgError(err, PG_UNIQUE_VIOLATION) &&
        pgConstraint(err) === 'transaction_log_one_reservation_per_request'
      ) {
        throw new AppError(
          409,
          'Credits have already been reserved for this request.',
          'RESERVATION_ALREADY_EXISTS',
        );
      }
      throw err;
    }

    return { balance: toBalanceView(balance), transaction };
  });
}

/**
 * F19.3.1 - move the reserved credits from the requester to the courier.
 * F19.3.2 - at most one transfer per request.
 *
 * The amount and the requester are read back from the reservation row, not taken from
 * the caller, so a transfer can only ever move exactly what was held. The courier comes
 * from the request body: Credit Service does not look couriers up and keeps no courier
 * reference of its own (team decision 2026-10-16).
 *
 * Idempotent on requestId, so a later retry of a failed completion is safe to send.
 */
export async function transferCredits(
  requestId: string,
  courierId: string,
): Promise<CreditOperationResult> {
  return withTransaction(async (client) => {
    const reservation = await findReservation(client, requestId);
    if (!reservation) {
      throw new AppError(
        404,
        'No credits are reserved for this request.',
        'RESERVATION_NOT_FOUND',
      );
    }

    if (await hasTransactionOfType(client, requestId, 'transfer')) {
      throw new AppError(
        409,
        'Credits for this request have already been transferred.',
        'ALREADY_TRANSFERRED',
      );
    }

    // Not specified by any requirement; see API.md. Released credits are back in the
    // requester's unreserved balance, so transferring them would move credits that are
    // no longer held and drive reserved_balance negative.
    if (await hasTransactionOfType(client, requestId, 'release')) {
      throw new AppError(
        409,
        'Credits for this request have already been released.',
        'ALREADY_RELEASED',
      );
    }

    const { requesterId, amount } = reservation;
    const locked = await lockTwoBalancesForUpdate(client, requesterId, courierId);

    if (!locked.has(courierId)) {
      // Deliberately not created here: credits may only enter the economy through
      // F19.1.1 (team decision 2026-10-16).
      throw new AppError(404, 'The courier has no credit balance.', 'COURIER_NOT_FOUND');
    }
    if (!locked.has(requesterId)) {
      throw new AppError(
        404,
        'The requester has no credit balance.',
        'BALANCE_NOT_FOUND',
      );
    }

    const requesterBalance = await debitRequesterForTransfer(client, requesterId, amount);
    await creditCourierForTransfer(client, courierId, amount);

    let transaction: TransactionRow;
    try {
      transaction = await insertTransaction(client, {
        transactionType: 'transfer',
        originatingUserId: requesterId,
        destinationUserId: courierId,
        amount,
        requestId,
      });
    } catch (err) {
      // F19.3.2 under concurrency: two completions racing both pass the check above,
      // and the unique index settles it. The throw rolls back both balance updates.
      if (
        isPgError(err, PG_UNIQUE_VIOLATION) &&
        pgConstraint(err) === 'transaction_log_one_transfer_per_request'
      ) {
        throw new AppError(
          409,
          'Credits for this request have already been transferred.',
          'ALREADY_TRANSFERRED',
        );
      }
      throw err;
    }

    // The requester's balance is returned: it is the wallet the caller debited.
    return { balance: toBalanceView(requesterBalance), transaction };
  });
}

/**
 * F19.4.1 - return the reserved credits to the requester when a request is cancelled
 * or expires.
 *
 * Takes only a requestId. Credit Service has no clock and does not detect expiry; the
 * caller decides why the credits are coming back (team decision 2026-10-16), so both
 * cancellation and expiry arrive here identically.
 *
 * Reserved falls by the amount; total is untouched (context §5).
 */
export async function releaseCredits(requestId: string): Promise<CreditOperationResult> {
  return withTransaction(async (client) => {
    const reservation = await findReservation(client, requestId);
    if (!reservation) {
      throw new AppError(
        404,
        'No credits are reserved for this request.',
        'RESERVATION_NOT_FOUND',
      );
    }

    if (await hasTransactionOfType(client, requestId, 'release')) {
      throw new AppError(
        409,
        'Credits for this request have already been released.',
        'ALREADY_RELEASED',
      );
    }

    // Not specified by any requirement; see API.md. Transferred credits belong to the
    // courier and are no longer the requester's to reclaim.
    if (await hasTransactionOfType(client, requestId, 'transfer')) {
      throw new AppError(
        409,
        'Credits for this request have already been transferred.',
        'ALREADY_TRANSFERRED',
      );
    }

    const { requesterId, amount } = reservation;
    const current = await lockBalanceForUpdate(client, requesterId);
    if (!current) {
      throw new AppError(404, 'No credit balance exists for this user.', 'BALANCE_NOT_FOUND');
    }

    const balance = await decreaseReservedBalance(client, requesterId, amount);

    let transaction: TransactionRow;
    try {
      transaction = await insertTransaction(client, {
        transactionType: 'release',
        originatingUserId: requesterId,
        destinationUserId: null,
        amount,
        requestId,
      });
    } catch (err) {
      if (
        isPgError(err, PG_UNIQUE_VIOLATION) &&
        pgConstraint(err) === 'transaction_log_one_release_per_request'
      ) {
        throw new AppError(
          409,
          'Credits for this request have already been released.',
          'ALREADY_RELEASED',
        );
      }
      throw err;
    }

    return { balance: toBalanceView(balance), transaction };
  });
}

/**
 * F19.5.1 - read a user's total, reserved and unreserved balance.
 *
 * No transaction and no lock: this is a point-in-time read, and holding a lock would
 * make a read block the writes it is reporting on.
 */
export async function getBalance(userId: string): Promise<BalanceView> {
  const row = await readBalance(pool, userId);
  if (!row) {
    throw new AppError(404, 'No credit balance exists for this user.', 'BALANCE_NOT_FOUND');
  }
  return toBalanceView(row);
}
