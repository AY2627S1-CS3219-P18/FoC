-- AI Assistance Disclosure:
-- Tool: Claude Code (model: claude-opus-5), date: 2026-10-16
--  2026-10-16: Week 7/8 catch-up - privilege matrix for the least-privilege application
--    role, implementing NFR8.2.3 as specified in credit-service-context.md §5.
--    Applied by both grant-app-role.sh (container) and tests/setup/globalSetup.ts, so
--    the runtime and the test harness enforce identical privileges.
--    No requirements, architecture, schema, or API decisions were made by the AI tool.
--    Author review:

-- The role name is a fixed constant. The team specified "a named least-privilege role"
-- without naming it; `credit_app` is used throughout. Role creation (and its password)
-- is the caller's job — this file only grants.

-- CONNECT is granted to PUBLIC by default on a new database, so it is not repeated here;
-- that keeps this file free of the database name and usable against any of them.
GRANT USAGE ON SCHEMA public TO credit_app;

-- balances: the service reads, creates and updates rows.
GRANT SELECT, INSERT, UPDATE ON balances TO credit_app;

-- transaction_log: append-only. SELECT and INSERT only.
-- The absence of UPDATE and DELETE here is what enforces NFR8.2.3; a superuser would
-- bypass it, which is why the service must not connect as one.
GRANT SELECT, INSERT ON transaction_log TO credit_app;

-- Defence in depth: revoke explicitly in case a future grant is written too broadly,
-- and so the intent is visible in the schema rather than implied by omission.
REVOKE UPDATE, DELETE, TRUNCATE ON transaction_log FROM credit_app;
REVOKE DELETE, TRUNCATE ON balances FROM credit_app;
