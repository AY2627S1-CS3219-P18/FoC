<!--
  AI Assistance Disclosure:
  Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
   2026-09-26: Recess iteration - documents how to run the service and what was built.
     No requirements, architecture, schema, or API decisions were made by the AI tool.
     Author review: Wee Jean
   2026-10-16: Week 7/8 catch-up - transfer, release, balance read, append-only
     enforcement and the dedicated test database.
     No requirements, architecture, schema, or API decisions were made by the AI tool.
     Author review:
-->

# Credit Service

Owns credit balances and the transaction log for FoC. Standing context, including the
requirements this implements and the team's schema decisions, is in
[`credit-service-context.md`](./credit-service-context.md).

## Status

The full API contract is in [API.md](./API.md) — that is what Order Service builds
against.

| Requirement | State |
|---|---|
| F19.1.1 — allocate 20 credits on registration | Implemented |
| F19.2.1–F19.2.3 — reserve, hold, reject over-offer | Implemented |
| F19.3.1 — transfer reserved credits to the courier | Implemented |
| F19.3.2 — at most one transfer per request | Implemented, enforced by a unique index |
| F19.4.1 — release on cancellation or expiry | Implemented |
| F19.5.1 — view total, reserved and unreserved | Implemented, **unauthenticated** (see below) |
| F20.1.1 — log every credit operation | Implemented on all four write paths |
| NFR8.1.1 — atomic concurrent balance updates | Implemented, mutation-checked |
| NFR8.1.2 — complete rollback on a failed transfer | Implemented, mutation-checked |
| NFR8.2.3 — append-only transaction log | **Enforced** by database privilege |
| F19.5.2, F20.2, F20.2.1 | Blocked on authentication |
| NFR8.2.1, NFR8.2.2 | Not started |

### Authentication is blocked

No endpoint authenticates its caller. `GET /credits/balance/:userId` should let a user
read only their own balance unless they are ranked `admin` or above; that rule lives in
`src/auth/roleRank.ts` and is unit-tested, and the middleware applying it is in
`src/middleware/requireBalanceAccess.ts` — **written but not mounted**.

It cannot be mounted because verifying a User Service token needs its RS256 public key,
which lives in `user-service/keys/` and is git-ignored and absent. Nothing was
substituted for it: a hardcoded key or an unverified decode would look like
authentication while providing none.

### Append-only (NFR8.2.3)

The tables are owned by the bootstrap superuser. The service connects as `credit_app`,
which holds `SELECT, INSERT, UPDATE` on `balances` and only `SELECT, INSERT` on
`transaction_log`. A `DELETE` or `UPDATE` against the log fails with
`42501 insufficient_privilege`. `tests/db/append-only.test.ts` asserts this, and first
asserts the test role is not a superuser — without that, every other assertion there
would be vacuous.

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

The suite runs against a **dedicated database**, `credit_db_test`, which
`tests/setup/globalSetup.ts` drops and recreates on every run from `src/db/init.sql`
and `src/db/grants.sql` — the same two files the container bootstrap applies, so the
suite and production cannot drift apart. It refuses to run against a database whose
name does not end in `_test`.

Tests connect as `credit_app_test`, a test-only copy of the production role with
identical grants. It is deliberately **not** `credit_app`: globalSetup resets the
password of whatever role it is given, which would break a running container.

Because that role has no `DELETE` anywhere, tests cannot tidy up after themselves.
Isolation comes from the rebuilt database plus a fresh UUID per case.

Settings live in `.env.test`, which is committed — the values are throwaway and the
database is destroyed each run. `DB_OWNER_USER` / `DB_OWNER_PASSWORD` there must match
`CREDIT_DB_USER` / `CREDIT_DB_PASSWORD` in the root `.env`.

## The two tables

Both live in the same database and are written in the same transaction, which is what
makes a partial write impossible (context §5).

**`balances`** — one row per user. `total_balance` and `reserved_balance` are stored;
unreserved is always computed as the difference, never stored. CHECK constraints keep
both non-negative and `reserved <= total`.

**`transaction_log`** — append-only history, one row per credit operation, carrying the
seven fields F20.1.1 lists. Partial unique indexes enforce one transfer per request
(F19.3.2) and one reservation per request.

## API

See [API.md](./API.md) for every endpoint: method, path, request body, success response
and every error code, plus an explicit list of what had to be invented because no
requirement or team decision covered it.
