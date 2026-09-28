-- AI Assistance Disclosure:
-- Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
--  2026-09-26: Recess iteration - initial schema (balances, transaction_log).
--    Implements the team's recorded schema decisions in credit-service-context.md §5
--    and the field list in F20.1.1. Conventions (TIMESTAMPTZ NOW(), gen_random_uuid(),
--    snake_case, DO $$ enum idiom, CREATE TABLE IF NOT EXISTS) follow the team's
--    existing user-service/src/db/init.sql.
--    No requirements, architecture, schema, or API decisions were made by the AI tool.
--    Author review: Wee Jean

-- ---------------------------------------------------------------------------
-- Transaction types (F20.1.1)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE transaction_type_enum AS ENUM ('allocation', 'reservation', 'transfer', 'release');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- balances
--
-- context §5: two columns per user, total_balance and reserved_balance.
-- Unreserved is NOT stored; it is computed as total_balance - reserved_balance.
--
-- user_id carries no FOREIGN KEY: it is owned by User Service, and Credit Service
-- reads no other service's database (context §3).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS balances (
  user_id           UUID PRIMARY KEY,
  total_balance     INTEGER NOT NULL DEFAULT 0,
  reserved_balance  INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT balances_total_non_negative
    CHECK (total_balance >= 0),
  CONSTRAINT balances_reserved_non_negative
    CHECK (reserved_balance >= 0),
  -- Keeps unreserved (total - reserved) from ever going negative, which is the
  -- invariant F19.2.2 and F19.2.3 depend on.
  CONSTRAINT balances_reserved_not_exceeding_total
    CHECK (reserved_balance <= total_balance)
);

-- ---------------------------------------------------------------------------
-- transaction_log
--
-- context §5: lives in the same database as balances and is written in the same
-- transaction as the balance update, so a failure rolls both back together.
--
-- Columns are the seven fields F20.1.1 lists.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transaction_log (
  transaction_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type     transaction_type_enum NOT NULL,
  originating_user_id  UUID,
  destination_user_id  UUID,
  amount               INTEGER NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id           UUID,

  CONSTRAINT transaction_log_amount_positive
    CHECK (amount > 0),

  -- Which party columns each transaction type must fill.
  --
  -- F20.1.1 reads "Originating user (not applicable for allocation)" and
  -- "Destination user (applicable to transfer only)", which taken literally leaves an
  -- allocation row naming nobody. Team decision 2026-09-26: an allocation records the
  -- new user as the DESTINATION, so the credits can be attributed and F19.5.2 can
  -- return it. Everything else follows F20.1.1 as written.
  CONSTRAINT transaction_log_party_shape CHECK (
    CASE transaction_type
      WHEN 'allocation'  THEN originating_user_id IS NULL     AND destination_user_id IS NOT NULL
      WHEN 'reservation' THEN originating_user_id IS NOT NULL AND destination_user_id IS NULL
      WHEN 'release'     THEN originating_user_id IS NOT NULL AND destination_user_id IS NULL
      WHEN 'transfer'    THEN originating_user_id IS NOT NULL AND destination_user_id IS NOT NULL
    END
  ),

  -- An allocation happens at registration and has no request behind it; every other
  -- operation is driven by one (context §3, inbound triggers).
  CONSTRAINT transaction_log_request_id_shape CHECK (
    (transaction_type =  'allocation' AND request_id IS NULL)
    OR
    (transaction_type <> 'allocation' AND request_id IS NOT NULL)
  )
);

-- F19.3.2 - at most one credit transfer recorded per request. context §4 requires this
-- to be a database constraint rather than check-then-write application logic.
-- Placed now so the guarantee exists before transfer is built in week 7.
CREATE UNIQUE INDEX IF NOT EXISTS transaction_log_one_transfer_per_request
  ON transaction_log (request_id)
  WHERE transaction_type = 'transfer';

-- Team decision 2026-09-26: at most one reservation per request, mirroring F19.3.2.
-- Without it a repeated "request created" trigger from Order Service reserves twice.
CREATE UNIQUE INDEX IF NOT EXISTS transaction_log_one_reservation_per_request
  ON transaction_log (request_id)
  WHERE transaction_type = 'reservation';

-- Supports F19.5.2 ("records in which they are the originating or destination user").
CREATE INDEX IF NOT EXISTS transaction_log_originating_user_idx
  ON transaction_log (originating_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transaction_log_destination_user_idx
  ON transaction_log (destination_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- NFR8.2.3 - append-only transaction log.  NOT YET ENFORCED.  Week 7.
--
-- context §5 specifies enforcement by `REVOKE UPDATE, DELETE` on the application
-- role. Two things are still undecided, so the statements are left inert rather
-- than guessed at:
--
--   1. The application role has no name yet. The sibling services connect as the
--      `postgres` superuser, and a superuser bypasses REVOKE entirely, so a REVOKE
--      written today would enforce nothing.
--   2. Creating a dedicated least-privilege role changes compose.yaml and .env,
--      which are outside this service folder.
--
-- Once the team names the role, uncomment and substitute it:
--
--   REVOKE UPDATE, DELETE ON transaction_log FROM <application_role>;
--
-- ---------------------------------------------------------------------------
