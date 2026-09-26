<!--
  AI Assistance Disclosure:
  Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
   2026-09-26: Recess iteration - documents how to run the service and what was built.
     No requirements, architecture, schema, or API decisions were made by the AI tool.
     Author review:
-->

# Credit Service

Owns credit balances and the transaction log for FoC. Standing context, including the
requirements this implements and the team's schema decisions, is in
[`credit-service-context.md`](./credit-service-context.md).

## Status — Recess iteration

| Requirement | State |
|---|---|
| F19.1.1 — allocate 20 credits on registration | Implemented |
| F19.2.1 — reserve offered credits on request creation | Implemented |
| F19.2.2 — reserved credits unavailable to other transactions | Implemented |
| F19.2.3 — reject offers above the unreserved balance | Implemented |
| F20.1.1 — log every credit operation | Implemented for both write paths (moved to Recess, team decision 2026-09-26) |
| NFR8.1.1 — atomic concurrent balance updates | Implemented, covered by `tests/concurrency/` |
| NFR8.2.3 — append-only log | **Not enforced.** Week 7; see `src/db/init.sql` |
| F19.3, F19.4, F19.5, F20.2 | Not started — weeks 7–9 |

`/credits/transfer`, `/credits/release`, `/credits/balance/:userId`,
`/credits/transactions` and `/credits/transactions/all` are **not** stubbed. They arrive
in their own iterations.

## Running it

`credit-db` and `credit-service` are defined in the root `compose.yaml`. Set the
`CREDIT_*` variables in the root `.env` (see `.env.example`), then from the repo root:

```bash
docker compose up --build credit-service
```

That publishes the API on `${CREDIT_SERVICE_PORT:-3003}` and the database on
`${CREDIT_DB_PORT:-5435}`.

To run the service on the host instead, against the containerised database:

```bash
docker compose up -d credit-db
cd credit-service
cp .env.example .env      # then set DB_HOST=localhost and DB_PORT=5435
npm install
npm run dev
```

`init.sql` is applied by the Postgres image on first start of an empty data volume, the
same mechanism `user-service` uses. Changing the schema means recreating the volume
(`docker compose down -v credit-db`) or applying the change by hand.

## Tests

```bash
npm test
```

The tests talk to a real database — the guarantees being checked are database
guarantees, so mocking the driver would test nothing. Point `.env` at a running
`credit-db` first. `tests/concurrency/` is the evidence for NFR8.1.1: it fires
simultaneous reservations at one balance and asserts the unreserved figure is never
overdrawn.

## The two tables

Both live in the same database and are written in the same transaction, which is what
makes a partial write impossible (context §5).

**`balances`** — one row per user. `total_balance` and `reserved_balance` are stored;
unreserved is always computed as the difference, never stored. CHECK constraints keep
both non-negative and `reserved <= total`.

**`transaction_log`** — append-only history, one row per credit operation, carrying the
seven fields F20.1.1 lists. Partial unique indexes enforce one transfer per request
(F19.3.2) and one reservation per request.

## API — pending team sign-off

`credit-service-context.md` §8 fixes the method and path of each endpoint. It does not
specify request bodies, response bodies, or status codes, and `AGENTS.md` §2.1 treats
those as team decisions. **The shapes below were written to make the service runnable and
are not yet approved.**

### `POST /credits/allocate` — F19.1.1

```jsonc
// request
{ "userId": "<uuid>" }

// 201
{
  "balance": { "userId": "<uuid>", "totalBalance": 20, "reservedBalance": 0, "unreservedBalance": 20 },
  "transaction": { "transaction_id": "<uuid>", "transaction_type": "allocation", ... }
}
```

### `POST /credits/reserve` — F19.2.1, F19.2.3

```jsonc
// request
{ "userId": "<uuid>", "requestId": "<uuid>", "amount": 4 }

// 201 — same envelope as above, with transaction_type "reservation"
```

### Error responses

```jsonc
{ "error": { "code": "INSUFFICIENT_UNRESERVED_CREDITS", "message": "..." } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `INVALID_REQUEST_BODY` | Body fails validation |
| 404 | `BALANCE_NOT_FOUND` | Reserving for a user with no balance row |
| 409 | `ALREADY_ALLOCATED` | Allocation attempted twice for one user |
| 409 | `RESERVATION_ALREADY_EXISTS` | Same `requestId` reserved twice |
| 422 | `INSUFFICIENT_UNRESERVED_CREDITS` | F19.2.3 — offer exceeds unreserved |
| 500 | `BALANCE_INVARIANT_VIOLATION` | A balance CHECK constraint fired; the write rolled back |
| 500 | `INTERNAL_ERROR` | Anything else |

Authentication is absent. Context §3 records it as an open question with User Service
and blocks F19.5.2 and F20.2.1; nothing here assumes an answer.
