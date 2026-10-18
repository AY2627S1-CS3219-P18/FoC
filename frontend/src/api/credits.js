/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5), date: 2026-10-19
 * Scope: Created the Credit Service calls the frontend makes (balance, transaction history), following
 *        the contract in credit-service/API.md. Holds the single shape transform between the API rows
 *        and what the Wallet page renders. No requirements, architecture, schema, or API decisions were
 *        made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-opus-5), date: 2026-10-19
 * Scope: Counterparty names now come from GET /users/public, so non-admins resolve them too.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { request } from './http'

const BASE = '/credits'

// --- balance ----------------------------------------------------------------------------
// 200 { balance: { userId, totalBalance, reservedBalance, unreservedBalance } }
// 403 FORBIDDEN reading someone else's, 404 BALANCE_NOT_FOUND, 503 IDENTITY_PROVIDER_UNAVAILABLE.
export const getBalance = (userId) => request(BASE + '/balance/' + userId).then((r) => r.balance)

// --- transaction history ------------------------------------------------------------------
// The API row is { transaction_id, transaction_type, originating_user_id, destination_user_id,
// amount, created_at, request_id }. Everything below turns that into what the page renders, so the
// page never sees snake_case or has to work out what a row means.

const DAY = 86_400_000

// "Today" / "Yesterday" / "3 Sep" — the column is narrow, so older rows lose the year unless it
// differs from the current one.
function shortDate(iso) {
  const then = new Date(iso)
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const age = midnight.getTime() - then.getTime()
  if (age < 0) return 'Today'
  if (age < DAY) return 'Yesterday'
  const sameYear = then.getFullYear() === new Date().getFullYear()
  return then.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  })
}

const fullTimestamp = (iso) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

// What each type did to the viewer's TOTAL balance, and who the other party was.
//
// `delta` is the effect on the total, which is 0 for a reservation and a release: F19.2.2 holds
// reserved credits rather than spending them, so showing them as a loss would be wrong. `direction`
// carries the distinction the number cannot, and the page renders "held" / "returned" instead of a
// signed figure for those two.
function describe(type, isOutgoing, amount) {
  switch (type) {
    case 'allocation':
      return { direction: 'in', delta: amount, usesCounterparty: false }
    case 'reservation':
      return { direction: 'hold', delta: 0, usesCounterparty: false }
    case 'release':
      return { direction: 'return', delta: 0, usesCounterparty: false }
    case 'transfer':
      return {
        direction: isOutgoing ? 'out' : 'in',
        delta: isOutgoing ? -amount : amount,
        usesCounterparty: true,
      }
    default:
      // An unknown type must still render rather than crash the page.
      return { direction: 'in', delta: 0, usesCounterparty: false }
  }
}

function toRow(row, viewerId) {
  const isOutgoing = row.originating_user_id === viewerId
  const { direction, delta, usesCounterparty } = describe(row.transaction_type, isOutgoing, row.amount)
  return {
    id: row.transaction_id,
    // Credit Service's own vocabulary, unchanged: allocation | reservation | transfer | release.
    type: row.transaction_type,
    amount: row.amount,
    delta,
    direction,
    counterpartyId: usesCounterparty
      ? isOutgoing
        ? row.destination_user_id
        : row.originating_user_id
      : null,
    requestId: row.request_id,
    createdAt: row.created_at,
    date: shortDate(row.created_at),
    timestamp: fullTimestamp(row.created_at),
  }
}

/**
 * One page of the caller's own history, newest first, 20 rows.
 *
 * `cursor` is the opaque `nextCursor` from the previous page; omit it for the first page. The
 * returned `nextCursor` is null on the last page.
 */
export async function listTransactions(viewerId, cursor) {
  const body = await request(BASE + '/transactions', { query: { cursor } })
  return {
    transactions: body.transactions.map((row) => toRow(row, viewerId)),
    nextCursor: body.nextCursor,
  }
}

/**
 * Display names for a batch of counterparty ids - one request for a whole page, never one
 * per row.
 *
 * GET /users/public needs a token but no particular role, so this now works for ordinary
 * users as well as admins. Ids that match nothing are simply absent from the response; the
 * caller keeps its shortened-id fallback for those.
 */
export async function resolveUserNames(ids) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()
  // The endpoint caps the batch at 50; a page is 20 rows, so this only bites if a caller
  // ever asks for several pages at once.
  const { users } = await request('/users/public', {
    query: { ids: unique.slice(0, 50).join(',') },
  })
  return new Map(users.map((u) => [u.id, u.username]))
}
