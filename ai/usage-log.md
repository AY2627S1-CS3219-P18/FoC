## 2026-09-24 — Stage 1: Project Scaffold

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Set up the user-service scaffold: package.json, .env.example, RS256 keys, .gitignore, tsconfig.json, barebones app.ts, and the src/ directory structure. Then verify with npm install and confirm key files exist. Agreed fixes: run scripts via tsx, add missing @types packages and ESLint flat config, gitignore both keys/ and .env, no dotenv, keep DB_HOST=user-db.

**What it produced:**

- user-service/package.json
- user-service/tsconfig.json
- user-service/eslint.config.js
- user-service/.env.example
- user-service/.gitignore
- user-service/src/app.ts
- user-service/keys/private.pem, user-service/keys/public.pem (generated via openssl)
- user-service/src/{routes,controllers,middleware,services,db/queries,utils}/.gitkeep

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:** gabriel yap

## 2026-09-24 — Stage 2: Database Setup

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Write the Postgres schema (enums + users/users_otps/refresh_tokens tables) in init.sql, a Zod-validated config.ts that exits clearly on missing env vars, and a pool.ts exporting a single pg.Pool sourced from config. Updated app.ts to read port from config instead of process.env.

**What it produced:**

- user-service/src/db/init.sql
- user-service/src/config.ts
- user-service/src/db/pool.ts
- user-service/src/app.ts (modified)

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:** gabriel yap

## 2026-09-24 — Stage 3: Docker Setup

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Build a multi-stage Dockerfile (dev/prod) for user-service, wire up user-db + user-service in the root compose.yaml (healthcheck, init.sql mount, env_file, volume mounts), and create .env from .env.example with a reminder to fill in SMTP. Verified end-to-end with docker compose up --build.

**What it produced:**

- user-service/Dockerfile
- user-service/.dockerignore
- compose.yaml (added user-db, user-service services + user-db-data volume)
- user-service/.env

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 4a: App Setup + Middleware

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Wire up cookie-parser/cors middleware, mount the auth router, and add the shared auth building blocks: sha256 hashing, RS256 JWT verification, Bearer-token authenticate middleware, AppError, asyncHandler, REFRESH_COOKIE_OPTIONS, and the global error handler (AppError/ZodError/malformed-JSON/500 cases). Verified against a temporary protected route + generated test JWTs (valid/expired/wrong-signature) inside Docker, then removed the scaffolding.

**What it produced:**

- user-service/src/utils/hash.ts
- user-service/src/utils/jwt.ts
- user-service/src/utils/AppError.ts
- user-service/src/utils/asyncHandler.ts
- user-service/src/utils/cookies.ts
- user-service/src/middleware/authenticate.ts
- user-service/src/types/express.d.ts
- user-service/src/routes/auth.routes.ts
- user-service/src/app.ts (modified)
- user-service/package.json (modified)
- user-service/eslint.config.js (modified)

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 4b: Registration

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement user registration: users.queries.ts (CRUD reads + insert), auth.service.ts register() with format/complexity validation and duplicate-username/email handling (both a pre-check and a race-safe unique-constraint catch), and the register controller with a strict Zod schema for presence/type checks. Verified all 12 checklist cases inside Docker, including a concurrent duplicate-registration race test.

**What it produced:**

- user-service/src/db/queries/users.queries.ts
- user-service/src/services/auth.service.ts
- user-service/src/controllers/auth.controller.ts
- user-service/src/routes/auth.routes.ts (modified)

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 4c: Login + Tokens

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement login: tokens.queries.ts for refresh token CRUD, a signAccessToken() addition to jwt.ts, auth.service.ts login() (identifier lookup by username/email, bcrypt compare, suspended check, RS256 access token + random refresh token stored as its SHA-256 hash), and the login controller (strict Zod schema, sets the refresh cookie via REFRESH_COOKIE_OPTIONS). Verified all 11 checklist cases inside Docker, including decoding the issued token to confirm claims/algorithm/expiry.

**What it produced:**

- user-service/src/db/queries/tokens.queries.ts
- user-service/src/utils/jwt.ts (modified)
- user-service/src/services/auth.service.ts (modified)
- user-service/src/controllers/auth.controller.ts (modified)
- user-service/src/routes/auth.routes.ts (modified)

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 4d: Logout + Refresh

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement logout() (revoke by token hash) and refresh() (validate not-found/revoked/expired, re-check current user status so suspension takes effect immediately and role changes propagate on next refresh rather than requiring re-login) in auth.service.ts, plus their controllers and routes (logout behind authenticate). Verified all 10 checklist cases inside Docker, including a live suspend/promote-then-refresh test confirming the new token reflects fresh DB state.

**What it produced:**

- user-service/src/services/auth.service.ts (modified)
- user-service/src/controllers/auth.controller.ts (modified)
- user-service/src/routes/auth.routes.ts (modified)

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 4e: Inter-Service Verify + Super Admin Bootstrap

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Add GET /auth/verify (reusing verifyAccessToken so it agrees with the authenticate middleware), and a super admin bootstrap that runs on startup: checks for an existing 'super admin' role, creates one from SUPER*ADMIN*_ config (reusing the registration password-complexity regex) if none exists, and is awaited before app.listen(). Added SUPER*ADMIN*_ to config.ts's Zod schema and .env/.env.example. Verified all checklist cases inside Docker, including a container restart to confirm no duplicate bootstrap.

**What it produced:**

- user-service/src/services/bootstrap.service.ts
- user-service/src/config.ts (modified)
- user-service/.env.example (modified)
- user-service/.env (modified)
- user-service/src/services/auth.service.ts (modified)
- user-service/src/db/queries/users.queries.ts (modified)
- user-service/src/controllers/auth.controller.ts (modified)
- user-service/src/routes/auth.routes.ts (modified)
- user-service/src/app.ts (modified)

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 5a: Schema, Config, Utilities

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5a: add 'pending' to status_enum, OTP env vars/config, SMTP optional in development, hashesMatch, generateOtp, withTransaction/Queryable, and user query updates (db param, status param, lockUserById, activateUser, deleteStalePendingUsers).

**What it produced:**
Modified: user-service/src/db/init.sql, src/config.ts, src/utils/hash.ts, src/db/queries/users.queries.ts, src/services/auth.service.ts, .env.example
Created: src/utils/otp.ts, src/utils/otp.test.ts, src/db/transaction.ts

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 5b: Email Service

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5b: Nodemailer-based sendOtpEmail with purpose map, text+html bodies, throw on failure, and a development-only console fallback when SMTP_HOST is empty.

**What it produced:**
Created: user-service/src/services/email.service.ts

**What I kept/changed/rejected:**
I kept all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 5c: OTP Queries + Service

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5c: otp.queries.ts (create/invalidate/findLatest/count/increment/consume), otp.service.ts (issueOtp, checkOtp returning {ok:false} instead of throwing on mismatch), plus Vitest tests for checkOtp branching.

**What it produced:**
Created: user-service/src/db/queries/otp.queries.ts, src/services/otp.service.ts, src/services/otp.service.test.ts

**What I kept/changed/rejected:**
I kept all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 5d: Registration Now Creates a Pending Account

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5d: transactional register (delete stale pending users, duplicate checks, create pending user, issue OTP), register returns 201 OTP_SENT, login rejects pending accounts with 403 ACCOUNT_NOT_VERIFIED after the credential check.

**What it produced:**
Modified: user-service/src/services/auth.service.ts, src/controllers/auth.controller.ts

**What I kept/changed/rejected:**
I kept all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 5e: Verify OTP + Resend OTP Endpoints

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5e: public POST /auth/verify-otp and /auth/resend-otp with strict Zod validation, verifyRegistrationOtp/resendRegistrationOtp in the service layer (row lock, attempt persistence, resend limit and cooldown), and Retry-After support via AppError.retryAfterSeconds.

**What it produced:**
Modified: user-service/src/utils/AppError.ts, src/app.ts, src/routes/auth.routes.ts, src/services/auth.service.ts, src/controllers/auth.controller.ts

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 6 pre-work #1: OTP resend window config

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** explain, generate
**Scope:** Implementation code, Boilerplate
**Governing decision:** `instructions.md`, Stage 6 "Changes to already-implemented code", row 1 (specified in Stage 5a: "Update `.env.example` and `.env`", "Update `src/config.ts`")

**Prompts (exact):**

> read thru the code base and instructions.md and understand what's going on. don't start coding first.

> okay let's work on the Changes to already-implemented code (do these first). do them one by one and let me know what you did after each one before asking for permission to proceed. the one that's under stage 6.

**Key responses:**
Read `instructions.md` and the `user-service` source, and summarised the codebase and where it differs from the instructions (no code changes in that turn). Then implemented row 1 only: added `OTP_RESEND_WINDOW_MINUTES=60` to the env files, added it to the Zod schema in `config.ts` (coerced positive integer), and exposed it as `config.otp.resendWindowMinutes`. `npx tsc --noEmit` reported one error in `users.queries.ts` (`createSuperAdmin` return type), which was already present and was not changed. The app was not run, so startup behaviour is unverified. Rows 2–9 are not done yet.

**Files:**

- `user-service/src/config.ts` (modified)
- `user-service/.env.example` (modified; no header added)
- `user-service/.env` (modified; gitignored, no header)

**Deviations / questions raised for the team:**
Pre-existing typecheck error at `users.queries.ts:105` (`createSuperAdmin` returns `UserRow | null` but is typed `Promise<UserRow>`); left unchanged pending a decision.

**What I kept/changed/rejected:**
Had to merge in the changes in a PR for the questions, but accepted everything else.

**Author review:** gabriel yap

## 2026-09-25 — Stage 6 pre-work #2: Windowed countOtps

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md`, Stage 6 "Changes to already-implemented code", row 2 (specified in Stage 5c, `countOtps`)

**Prompts (exact):**

> let's go with 2.

**Key responses:**
Added an optional `sinceMinutes` parameter to `countOtps` in `otp.queries.ts`. Without it the query is unchanged and counts all rows (registration, as before). With it, the query counts only rows where `created_at > clock_timestamp() - make_interval(mins => $3)`. The only existing caller (`resendRegistrationOtp`) does not pass it, so registration behaviour is unchanged. `npx tsc --noEmit` passes with no errors (the `createSuperAdmin` error noted in the previous entry no longer appears; I did not change that file). The query was not run against a database, so it is unverified at runtime.

**Files:**

- `user-service/src/db/queries/otp.queries.ts` (modified)

**Deviations / questions raised for the team:**
None

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 6 pre-work #3: checkOtp consume flag

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md`, Stage 6 "Changes to already-implemented code", row 3 (specified in Stage 6a)

**Prompts (exact):**

> let's do 3.

**Key responses:**
Added an optional third parameter `consume: boolean = true` to `checkOtp` in `otp.service.ts`. When `false`, a correct guess returns `{ ok: true }` without calling `consumeOtp`. A wrong guess still increments attempts and returns `{ ok: false }` regardless of the flag. The expiry, attempts-exceeded and missing/consumed-OTP checks are unchanged. The only existing caller (`verifyRegistrationOtp`) does not pass the argument, so registration behaviour is unchanged. `npx tsc --noEmit` passes. The `consume: false` path is not exercised yet (no caller until Stage 6c), so it is unverified at runtime.

**Files:**

- `user-service/src/services/otp.service.ts` (modified)

**Deviations / questions raised for the team:**
None

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-04 — Order-service controller test update

**Tool:** GitHub Copilot (model: GPT-5.6 Luna)
**Mode:** debug, refactor
**Scope:** Implementation code, Debugging
**Governing decision:** Existing `order-service` controller and service implementation in the working tree.

**Prompts (exact):**

> help me update the test file based on the changes i've made. also update the ai usage log.

**Key responses:**
Updated `orders.controller.spec.ts` to match the new `getOrders` result contract: successful responses use `{ ok: true, orders }`, invalid status filters return HTTP 500 with the service error result, and database failures return the serialized service error result. Ran `npm test -- src/controllers/orders.controller.spec.ts` from `order-service`; 1 test file and all 11 tests passed.

**Files:**

- `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:**
tng wen xi

## 2026-10-20 — Frontend and Order Service: Accept errand

**Tool:** Copilot SDK (model: unspecified by runtime)
**Mode:** implementation code
**Scope:** Implementation code
**Governing decision:** Existing Order Service transition logic for the `accepted` status

**Prompts (exact):**

> onaccept, make it call order service endpoint `/orders/:id/accept`

**Key responses:**
Added the order-service route backed by the existing `accepted` transition, added the frontend API client, and changed `RequestCard` to call the endpoint after login gating. `cd frontend && npm run build` passed. Focused order-service tests were not run because the frontend request was the active implementation scope.

**Files:**

- `frontend/src/api/orders.js` (modified)
- `frontend/src/components/RequestCard.jsx` (modified)
- `order-service/src/routes/orders.routes.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:**
tng wen xi

## 2026-10-20 — Frontend: Edit open errand

**Tool:** Copilot SDK (model: unspecified by runtime)
**Mode:** implementation code | refactor
**Scope:** Implementation code
**Governing decision:** Existing Order Service `PATCH /orders/:id/edit` contract and the existing Create Request form

**Prompts (exact):**

> create an edit page similar to the create page where users can edit the fields except for number of credits (for the moment)

**Key responses:**
Reused the existing request form for `/requests/:id/edit`, loaded the selected order from Order Service, connected the Activity Edit action, and submitted supplier, description, delivery location, deadline, and additional details without sending credits. Added a frontend API client and route. `cd frontend && npm run build` passed. An initial root-level build attempt was skipped because the repository root has no package.json.

**Files:**

- `frontend/src/api/orders.js` (modified)
- `frontend/src/pages/CreateRequest.jsx` (modified)
- `frontend/src/pages/Activity.jsx` (modified)
- `frontend/src/App.jsx` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I kept all changes.

**Author review:**
tng wen xi

## 2026-10-20 — Supplier Service: JWKS token verification

**Tool:** GitHub Copilot SDK in VS Code (model: GPT-5.6 Luna)
**Mode:** refactor | generate | docs
**Scope:** Implementation code | Refactor/Docs
**Governing decision:** `user-service/docs/jwks-verification-guide.md`; the User Service JWKS
endpoint and RS256 token contract documented there.

**Prompts (exact):**

> read the guide and make the relevant edits in supplier service

**Key responses:**
Replaced the Supplier Service's per-request `/auth/verify` call with cached JWKS retrieval, `kid`
lookup with one refresh on a cache miss, RS256-only local signature verification, required
`sub`/`role` claims, and expiry validation. Updated middleware tests to generate and verify real
RS256 tokens, and aligned the Supplier Service README, OpenAPI description, architecture, and
implementation spec with the JWKS contract. Verification: `npm run build` passed and all 26
Supplier Service middleware tests passed.

**Files:**

- `supplier-service/src/middleware/authenticate.ts` (modified)
- `supplier-service/test/middleware/authenticate.test.ts` (modified)
- `supplier-service/README.md` (modified)
- `supplier-service/openapi.yaml` (modified)
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I kept all changes.

**Author review:**
tng wen xi

## 2026-10-13 — order-service: Credit reservation tracking for automatic expiry

**Tool:** GitHub Copilot SDK in VS Code (model: GPT-5.6 Luna)
**Mode:** refactor | generate
**Scope:** Implementation code | Boilerplate
**Governing decision:** Team decision to persist the credit reservation identifier on `OrderRequest`; the credit-service release endpoint remains a later team-owned contract.

**Prompts (exact):**

> can you implement whatever can be implemented now

**Key responses:**
Persisted the reservation transaction identifier on each order, passed the order ID to credit reservation, and connected expiry maintenance to call the credit client's release operation after a successful system transition. Added a `creditReleasedAt` bookkeeping field and migration. The real credit-service release endpoint was not invented because its request/response fields remain pending team sign-off. Verification: 290 order-service tests passed and TypeScript typecheck passed.

**Files:**

- `order-service/prisma/schema.prisma` (modified)
- `order-service/prisma/migrations/20261013123000_add_reservation_tracking/migration.sql` (created)
- `order-service/src/clients/credits.client.ts` (modified)
- `order-service/src/services/orders.service.ts` (modified)
- `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `order-service/src/worker.ts` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**

The worker still uses the existing stub credit client until the team approves and implements the credit-service release API contract. Release-failure retry/outbox behavior remains for that follow-up.

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:**
tng wen xi

## 2026-10-13 — order-service: Release credits on cancellation

**Tool:** GitHub Copilot SDK in VS Code (model: GPT-5.6 Luna)
**Mode:** refactor
**Scope:** Implementation code
**Governing decision:** Existing cancellation transition rules in `order-service/src/domain/order-status.ts`; existing persisted reservation ID decision.

**Prompts (exact):**

> implement the credit release for transitionOrder to 'cancelled'

**Key responses:**
Passed the credit client through the HTTP transition route and released the order's persisted reservation only after the optimistic-locking status update succeeded. Recorded `creditReleasedAt` after release and added unit coverage. Verification: 292 order-service tests passed and TypeScript typecheck passed.

**Files:**

- `order-service/src/services/orders.service.ts` (modified)
- `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.ts` (modified)
- `order-service/src/routes/orders.routes.ts` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**

The application still uses the existing stub credit client, so the release call is wired but does not contact the credit service until its real release client is approved and connected.

**What I kept/changed/rejected:**
I kept all changes.

**Author review:**
tng wen xi

## 2026-10-12 — order-service: Format maintenance timestamp

**Tool:** GitHub Copilot SDK in VS Code (model: GPT-5.6 Luna)
**Mode:** refactor
**Scope:** Refactor
**Governing decision:** Existing order-service maintenance logging.

**Prompts (exact):**

> help me format the time nicely here

**Key responses:**
Changed the maintenance log from Unix milliseconds to an ISO-8601 timestamp using `Date.toISOString()`, preserving an explicit UTC timezone.

**Files:**

- `order-service/src/services/orders.service.ts` (modified)
- `ai/usage-log.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
tng wen xi

## 2026-10-12 — order-service: Fix worker watch shutdown

**Tool:** GitHub Copilot SDK in VS Code (model: GPT-5.6 Luna)
**Mode:** debug | refactor
**Scope:** Debugging | Refactor
**Governing decision:** Existing BullMQ worker lifecycle in `order-service/src/worker.ts`.

**Prompts (exact):**

> $ docker compose logs -f order-worker
> order-worker-1 | 10:26:24 AM [tsx] change in ./src/worker.ts Restarting...
> order-worker-1 | SIGTERM received, shutting down maintenance worker
> ...

**Key responses:**
Diagnosed that the signal handler awaited resource cleanup without explicitly terminating the worker process, preventing `tsx watch` from starting the replacement process. Updated shutdown to exit after cleanup and report cleanup failures.

**Files:**

- `order-service/src/worker.ts` (modified)
- `README.md` (modified)
- `ai/usage-log.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
tng wen xi

## 2026-10-12 — order-service: Route maintenance through system transitions

**Tool:** GitHub Copilot SDK in VS Code (model: GPT-5.6 Luna)
**Mode:** refactor
**Scope:** Refactor
**Governing decision:** Existing team-authored system role and transition table in `order-service/src/domain/order-status.ts`.

**Prompts (exact):**

> ohh cuz over here there is a 'system' role so i would assume it's best to call checkTransition even for system updates

**Key responses:**
Changed request maintenance to query eligible requests and call `transitionOrder` with `SYSTEM_ACTOR`, so automatic completion and expiry pass through `checkTransition` and the existing optimistic-lock path. Added coverage for successful system transitions and lost optimistic-lock races. Verification was run with the order-service typecheck and full test suite.

**Files:**

- `order-service/src/services/orders.service.ts` (modified)
- `order-service/src/services/orders.service.spec.ts` (modified)
- `ai/usage-log.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
tng wen xi

## 2026-10-07 — order-service: transitionOrder test coverage

**Tool:** GitHub Copilot (model: MAI-Code-1.1-Flash)
**Mode:** debug, generate
**Scope:** Implementation code, Debugging
**Governing decision:** Existing `order-service` controller and service implementation in the working tree.

**Prompts (exact):**

> help me write tests in these files for this new function transitionOrder

**Key responses:**
Added focused unit coverage for the service-level transition rules and HTTP coverage for the pickup/deliver routes. The tests now exercise valid accepted-to-picked_up transitions, forbidden actors, invalid status edges, missing orders, and optimistic-lock conflicts. Verification: `npx vitest run src/services/orders.service.spec.ts src/controllers/orders.controller.spec.ts` passed with 48 tests passing across 2 files.

**Files:**

- `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.ts` (modified)

**Deviations / questions raised for the team:**
The existing controller did not map `ORDER_CONFLICT` to HTTP 409, so the tightly coupled status mapping was corrected to make the new route’s optimistic-lock response consistent with its service error.

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:**
tng wen xi

## 2026-09-28 — order-service: Prisma Order Seed Fixtures

**Tool:** GitHub Copilot (model: GPT-5.6 Luna)
**Mode:** generate
**Scope:** Boilerplate
**Governing decision:** Existing `order-service/prisma/schema.prisma` model and `order-service/AGENTS.md` implementation-only rules.

**Prompts (exact):**

> help me create a seed.ts inside prisma/ with dummy data of orders for testing. include multiple orders of different statuses and different locations and different numbers of credits offered.

**Key responses:**
Added `order-service/prisma/seed.ts` with nine deterministic order fixtures covering all seven request statuses, varied campus locations, and credit amounts from 2 to 15. The script deletes only those fixed fixture IDs before inserting, loads `DATABASE_URL` through dotenv, uses the existing Prisma PostgreSQL adapter, and disconnects in a `finally` block. Focused TypeScript validation passed with the service's installed compiler; no database seed run was performed.

**Files:**

- `order-service/prisma/seed.ts` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:**

## 2026-09-29 — order-service: getOrders Service and Controller Tests

**Tool:** GitHub Copilot (model: GPT-5.6 Luna)
**Mode:** generate, debug
**Scope:** Implementation code, Debugging
**Governing decision:** Existing `order-service` service/controller behavior and `order-service/AGENTS.md` implementation-only rules.

**Prompts (exact):**

> could you add tests here for getOrders in orders service and getOrders in orders controller respectively? make sure to cover a variety of different orders (differennt statuses, different requests, invalid status filter, etc.) and remember to update the ai usage log

**Key responses:**
Added service tests covering unfiltered mixed orders, multiple valid status filters, no matches, and database errors. Added controller tests covering mixed results, valid filters, invalid status rejection, empty results, and database errors. The invalid-status test exposed that the controller sent a 400 response but continued into the service call, so the handler now returns immediately. Focused validation passed: 39 tests in the two edited spec files.

**Files:**

- `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:**

## 2026-09-25 — Stage 6 pre-work #4: Forgot Password email template

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md`, Stage 6 "Changes to already-implemented code", row 4 (specified in Stage 6a, "Update `src/services/email.service.ts`")

**Prompts (exact):**

> yes let's do 4

**Key responses:**
Added a `Forgot Password` entry to the `PURPOSE_COPY` map in `email.service.ts` with subject "Your FoC password reset code", as specified. The instructions give no intro text, so the AI wrote the one-line intro "Use the code below to reset your FoC password." in the same shape as the registration one; the body still contains the OTP and the expiry from `config.otp.ttlMinutes`, with no links. The dev-log fallback is unchanged. `npx tsc --noEmit` passes. No email was sent, so the template is unverified.

**Files:**

- `user-service/src/services/email.service.ts` (modified)

**Deviations / questions raised for the team:**
The intro sentence wording was not specified in `instructions.md`; the AI supplied it. The team may want to reword it.

**What I kept/changed/rejected:**
Okay with the wording used.

**Author review:** gabriel yap

## 2026-09-25 — Stage 6 pre-work #6: Login race-safety

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate, refactor
**Scope:** Implementation code
**Governing decision:** `instructions.md`, Stage 6 "Changes to already-implemented code", row 6 (specified in Stage 4c, "Race-safety" bullet)

**Prompts (exact):**

> let's skip 5 first. what's 6?

> yes let's do 6

**Key responses:**
Changed `login` in `auth.service.ts` so the refresh token is created inside `withTransaction` after locking the user row. The password is still verified before the lock. Inside the transaction: `lockUserById(user.id, client)`; if the locked row is null or its `password_hash` differs from the earlier read, throw `401 INVALID_CREDENTIALS`; if it is `suspended`, throw `403 ACCOUNT_SUSPENDED`; otherwise `createRefreshToken(..., client)`. The role for the access token and the response comes from the locked row, and the access token is signed after the transaction commits. The pending check and its order (401, then pending 403, then suspended 403) are unchanged. The unused `Date.now()`-based `expiresAt` variable had already been removed from the file before this change. Change #5 was deliberately skipped for now (to be done with 6c/6e, since it needs service functions that do not exist yet). `npx tsc --noEmit` passes. The race itself (login concurrent with reset or suspend) was not exercised, so it is unverified at runtime.

**Files:**

- `user-service/src/services/auth.service.ts` (modified)

**Deviations / questions raised for the team:**
Change #5 skipped for now at the user's request; because it has dependencies in Stage 6.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 6 pre-work #7: Registration resend-limit message

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md`, Stage 6 "Changes to already-implemented code", row 7 (specified in Stage 5e, `resendRegistrationOtp` step 3)

**Prompts (exact):**

> yes do 7

**Key responses:**
Changed the `OTP_RESEND_LIMIT` message in `resendRegistrationOtp` (`auth.service.ts`) from "Maximum OTP resends reached. Please register again later." to "Maximum OTP resends reached. Please try registering again in about 10 minutes.", as specified. Only the text changed; the status code, error code and limit logic are unchanged. The 10 minutes is hard-coded in the message and matches `OTP_TTL_MINUTES=10`, as `instructions.md` notes it must be updated by hand if that value changes. `npx tsc --noEmit` passes. The endpoint was not called, so the message is unverified at runtime.

**Files:**

- `user-service/src/services/auth.service.ts` (modified)

**Deviations / questions raised for the team:**
None

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 6 pre-work #8: Locked refresh

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate, refactor
**Scope:** Implementation code
**Governing decision:** `instructions.md`, Stage 6 "Changes to already-implemented code", row 8 (specified in Stage 4d, `refresh` and the lock ordering rule)

**Prompts (exact):**

> 8 now! also, for all the prev parts, the header should say pre-work for 6

**Key responses:**
Renamed the header entries added for changes #1–#4, #6 and #7 from "Stage 6 - ..." to "Stage 6 pre-work - ..." in `config.ts`, `otp.queries.ts`, `otp.service.ts`, `email.service.ts` and `auth.service.ts`. Then implemented #8. `lockRefreshToken` in `tokens.queries.ts` now selects `clock_timestamp() AS db_now` and returns `RefreshTokenRowWithNow`; `logout`, its only other caller, is unaffected. `refresh` in `auth.service.ts` keeps its plain early-exit read (not found, revoked or expired against `db_now` gives `401 INVALID_REFRESH_TOKEN`), then runs `withTransaction`: lock the user row first (null gives 401), then the token row via `lockRefreshToken`, and re-check revoked or expired on the locked token (401). It then throws `403 ACCOUNT_SUSPENDED` if the locked user is suspended, and otherwise issues the access token from the locked user's id and role. The existing expiry comparison (`expires_at < db_now`) was kept as is. `npx tsc --noEmit` passes. The lock behaviour (refresh concurrent with logout, reset or suspend, and the no-deadlock check in Stage 4d verification) was not exercised, so it is unverified at runtime.

**Files:**

- `user-service/src/db/queries/tokens.queries.ts` (modified)
- `user-service/src/services/auth.service.ts` (modified)
- `user-service/src/config.ts` (modified, header text only)
- `user-service/src/db/queries/otp.queries.ts` (modified, header text only)
- `user-service/src/services/otp.service.ts` (modified, header text only)
- `user-service/src/services/email.service.ts` (modified, header text only)

**Deviations / questions raised for the team:**
None

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 6 pre-work #9: Logout route without authenticate

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** refactor
**Scope:** Implementation code
**Governing decision:** `instructions.md`, Stage 6 "Changes to already-implemented code", row 9 (specified in Stage 4d, "Update `src/controllers/auth.controller.ts`")

**Prompts (exact):**

> 9 now

**Key responses:**
Changed the logout route in `auth.routes.ts` to `router.post('/logout', authController.logout)`, so logout depends only on the refresh cookie and still works with an expired access token. Also removed the now-unused `authenticate` import from that file (not listed in the instructions, done to avoid an unused-import warning). The `authenticate` middleware file itself is untouched and has no consumers until `GET /users/me` (Stage 7). The controller already reads the refresh cookie, so nothing else changed. `npx tsc --noEmit` passes. The route was not called, so the behaviour is unverified at runtime. Change #5 remains skipped and is planned to be done with Stages 6c/6e.

**Files:**

- `user-service/src/routes/auth.routes.ts` (modified)

**Deviations / questions raised for the team:**
Removed the unused `authenticate` import in `auth.routes.ts`, which the instructions did not explicitly list.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 6a: requestOtp

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md`, Stage 6a, "Add `requestOtp` to `src/services/otp.service.ts`"

**Prompts (exact):**

> let's do 6a

**Key responses:**
Stage 6a has three parts. The `consume` flag on `checkOtp` and the `Forgot Password` email template were already done as pre-work #3 and #4, so this entry covers only `requestOtp`, added to `otp.service.ts` and exported with a `RequestOtpResult` type. It must run inside `withTransaction` and does the following in order: lock the user (`lockUserById`; null returns `no-user`, `pending` returns `not-verified`); count OTPs in the rolling window (`countOtps` with `config.otp.resendWindowMinutes`), returning `throttled` with reason `limit` when `count - 1 >= maxResends`; check the cooldown against `db_now` from `findLatestOtp`, returning `throttled` with reason `cooldown` and `retryAfterSeconds` (rounded up); otherwise call `issueOtp` and return `sent`. `EMAIL_SEND_FAILED` from `issueOtp` propagates unchanged. When throttled, nothing is sent and the existing OTP is not invalidated. There is no caller yet (forgot-password arrives in 6b), so `requestOtp` is unexercised. `npx tsc --noEmit` passes. Not verified at runtime: throttled paths, no email sent when throttled, and the previous OTP staying valid.

**Files:**

- `user-service/src/services/otp.service.ts` (modified)

**Deviations / questions raised for the team:**
None. The interrupted first request produced no changes; the work was done on the repeated prompt.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 6b: POST /auth/forgot-password

**Governing decision:** `instructions.md`, Stage 6b (design decisions in Stage 6 header; `requestOtp` from Stage 6a)

**Prompts (exact):**

> yes

(Reply to: "Shall I create `feat/stage-6b-forgot-password` from `main` and start 6b?")

**Key responses:**
Added `forgotPassword({ email })` to `auth.service.ts`, inside `withTransaction`: `findByEmail` (none gives `404 EMAIL_NOT_FOUND`, `pending` gives `403 ACCOUNT_NOT_VERIFIED` as early exits), then `requestOtp` with purpose `Forgot Password`, mapping its result: `sent` returns; `throttled` with `cooldown` gives `429 OTP_RESEND_COOLDOWN` with `retryAfterSeconds`; `throttled` with `limit` gives `429 OTP_RESEND_LIMIT` ("try again in about an hour"); `no-user` gives `404`; `not-verified` gives `403`. `EMAIL_SEND_FAILED` propagates as `503`. Added a `forgotPassword` controller with a strict Zod schema using the shared `emailField` (returns `200 OTP_SENT`, "A reset code has been sent to your email") and the route `POST /auth/forgot-password`. The `forgot_password` purpose in `verify-otp`/`resend-otp` (pre-work #5) was not touched. `npx tsc --noEmit` passes. Ran against the dev containers (`docker compose up` of user-db and user-service): unknown email gave 404; a registered email gave 200 and one `Forgot Password` OTP row; an immediate repeat gave 429 with `Retry-After: 60`; an extra field gave 400 "Request contains unexpected fields"; a missing email gave 400 "Email is required"; with the cooldown backdated, three concurrent requests gave one 200 and two 429, leaving one active OTP row. Not run: the resend-limit path, the pending-account path, the email-send-failure path (503) and the wrong-type email path. These OTP rows were created for the bootstrap super admin account in the dev database.

**Files:**

- `user-service/src/services/auth.service.ts` (modified)
- `user-service/src/controllers/auth.controller.ts` (modified)
- `user-service/src/routes/auth.routes.ts` (modified)

**Deviations / questions raised for the team:**
None

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 6c: verify-otp for forgot_password (includes pre-work #5, verify-otp half)

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md`, Stage 6c, and Stage 6 "Changes to already-implemented code" row 5 (verify-otp half only)

**Prompts (exact):**

> go ahead. do all these and start with 6c

(Reply to the 6b hand-off: "Once you've reviewed and edited whatever you want, tell me to go ahead. I'll commit as `feat: implement forgot password endpoint (stage 6b)`, push, and open the PR. Then I'll check out `main`, pull, and branch for 6c." The 6b work was committed, pushed and opened as PR #83, then this work was started on a new branch from `main`.)

**Key responses:**
In `auth.controller.ts`: added `forgot_password` to `PURPOSE_MAP` (`'Forgot Password'`), split the shared purpose schema into `verifyPurposeSchema` (`registration`, `forgot_password`) and `resendPurposeSchema` (`registration` only), both using one shared error map ("Invalid purpose" / "Purpose is required" / "Purpose must be a string"), and made the `verifyOtp` dispatch return per purpose: registration keeps `REGISTER_SUCCESS`, `Forgot Password` calls `authService.verifyForgotPasswordOtp` and returns `200 { message: 'Code verified. You can now set a new password.', code: 'OTP_VERIFIED' }`. The purpose schema was split so `resend-otp` does not accept `forgot_password` before its service function exists (Stage 6e); otherwise it would fall through the switch and return a false success. This means row 5 is only half done: the `resend-otp` enum and dispatch are still to do in 6e. In `auth.service.ts`: added `verifyForgotPasswordOtp({ email, otp })`. It checks the OTP format (400 `VALIDATION_ERROR`), then inside `withTransaction`: `findByEmail` (none gives `404 EMAIL_NOT_FOUND`, `pending` gives `403 ACCOUNT_NOT_VERIFIED`), `lockUserById` with the same two re-checks after the lock (suspended accounts allowed), then `checkOtp(..., consume = false)`. A wrong guess returns `{ ok: false }`, and `INVALID_OTP` is thrown only after commit so the attempt increment persists. `npx tsc --noEmit` and `npx eslint src` pass. This branch was cut from `main`, so the 6b `forgot-password` endpoint (PR #83) is not on it; a `Forgot Password` OTP row for the bootstrap super admin (known code) was inserted directly in the dev database and the endpoint was tested against the running container: correct code gave 200 and left `consumed_at` NULL; re-submitting gave 200 again; a wrong code gave 400 with `attempts_count` persisted at 1; after 5 wrong codes the correct code gave 429 `OTP_ATTEMPTS_EXCEEDED`; an expired OTP gave 400 `OTP_EXPIRED`; an unknown email gave 404; a pending account's email gave 403; `purpose: "forgot password"` gave 400 "Invalid purpose"; a 5-digit OTP gave 400 "OTP must be a 6-digit code"; `resend-otp` with `forgot_password` gave 400 "Invalid purpose"; `registration` verify still works (returned INVALID_OTP for a non-pending user). Not run: the case of a suspended account, and concurrent verifies.

**Files:**

- `user-service/src/controllers/auth.controller.ts` (modified)
- `user-service/src/services/auth.service.ts` (modified)

**Deviations / questions raised for the team:**
Row 5 split across stages as described above: the verify-otp side is done here, the resend-otp side moves to 6e.

**What I kept/changed/rejected:**
Approved all changes.

**Author review:** gabriel yap

## 2026-09-25 — Stage 6d: POST /auth/reset-password

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md`, Stage 6d (and the lock ordering rule in Stage 4d)

**Prompts (exact):**

> good to go, let's go on to the next part

(Reply to the 6c hand-off asking the user to review before committing. The 6c work was then committed, pushed and opened as PR #84, and this work was started on a new branch from `main`.)

**Key responses:**
Added `revokeAllRefreshTokensForUser(userId, db)` to `tokens.queries.ts` (sets `is_revoked` and `revoked_at` on the user's non-revoked tokens) and `updatePasswordHash(userId, passwordHash, db)` to `users.queries.ts` (also sets `updated_at`). Added `resetPassword({ email, otp, newPassword })` to `auth.service.ts`: validates `newPassword` complexity with the registration message and `otp` as 6 digits (400 `VALIDATION_ERROR`), then inside `withTransaction`: `findByEmail` (none gives `404 EMAIL_NOT_FOUND`, `pending` gives `403 ACCOUNT_NOT_VERIFIED`), `lockUserById` with the same re-checks after the lock (suspended allowed), then the default consuming `checkOtp` for `Forgot Password`; on `{ ok: true }` it bcrypt-hashes the new password (work factor 10), updates the hash, and revokes all the user's refresh tokens, all in the same transaction (user row locked first, per the lock order rule). `INVALID_OTP` is thrown only after commit so wrong-guess attempts persist. To reuse the registration password message without duplicating the string, it was moved into a `PASSWORD_MESSAGE` constant that `register` now also uses (text unchanged; small refactor beyond the spec). Added the `resetPassword` controller (strict Zod schema with the shared `emailField`; messages "OTP is required", "OTP must be a string", "New password is required", "New password must be a string"; returns `200 PASSWORD_RESET_SUCCESS`) and the route `POST /auth/reset-password`. `npx tsc --noEmit` and `npx eslint src` pass. Tested against the dev containers with a freshly registered user (register, verify, login, forgot-password, reset): weak password gave 400 with the standard message; missing `newPassword` gave 400 "New password is required"; an extra field gave 400 "Request contains unexpected fields"; a 2-digit OTP gave 400 "OTP must be a 6-digit code"; a wrong OTP gave 400 `INVALID_OTP` with `attempts_count` persisted at 1; an unknown email gave 404; two concurrent resets with the correct OTP gave one 200 and one 400 `INVALID_OTP`; after the reset the user had 0 non-revoked refresh tokens (the pre-reset token was revoked and the old cookie's refresh gave 401); login with the new password gave 200 and with the old password 401; re-using the consumed OTP gave 400 `INVALID_OTP`. My first two test runs failed because of mistakes in my test script (the service was mid-restart, then a wrong log-grep pattern), not because of the code, and were rerun. Not run: 5 wrong OTPs then the correct one, an expired OTP, a pending account on this endpoint, a suspended account, and the login-loop-versus-reset race.

**Files:**

- `user-service/src/db/queries/tokens.queries.ts` (modified)
- `user-service/src/db/queries/users.queries.ts` (modified)
- `user-service/src/services/auth.service.ts` (modified)
- `user-service/src/controllers/auth.controller.ts` (modified)
- `user-service/src/routes/auth.routes.ts` (modified)

**Deviations / questions raised for the team:**
Extracted the registration password message into a `PASSWORD_MESSAGE` constant (text unchanged) so `resetPassword` reuses it; this touches `register`, which the spec did not mention.

The 6d branch was cut from a `main` that did not yet contain PR #84 (6c), so before pushing, `origin/main` was merged into it (user asked for this). The merge conflicted at the end of `auth.service.ts`, `auth.controller.ts`, `ai/usage-log.md` and `README.md`; the log and README were resolved by keeping both sides. Separately, `origin/main` itself did not typecheck after PR #84: the earlier "Merge branch 'main' into feat/stage-6c..." auto-merge had interleaved the end-of-file `forgotPassword` (6b) and `verifyForgotPasswordOtp` (6c) functions (`tsc` error TS1128 in `auth.service.ts`). While resolving this merge the AI restored those two functions from their own commits (`f797583`, `cda9a47`) and kept `resetPassword` after them, so this branch's `auth.service.ts` also carries that repair. After the merge `npx tsc --noEmit` and `npx eslint src` pass, and forgot-password, verify-otp (`forgot_password`), reset-password, login with the new and old passwords, and re-use of the consumed OTP were re-run against the containers with the expected results.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-26 — Stage 6e: resend-otp for forgot_password (includes pre-work #5, resend-otp half)

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md`, Stage 6e, and Stage 6 "Changes to already-implemented code" row 5 (resend-otp half; the verify-otp half was done in 6c)

**Prompts (exact):**

> okay, can proceed with 6e

(After PR #85 for 6d was merged into `main`, this work was started on a new branch from an updated `main`, as the user had asked.)

**Key responses:**
In `auth.controller.ts`: `resendPurposeSchema` now accepts `registration` and `forgot_password`, and `resendOtp` dispatches `'Forgot Password'` to `authService.resendForgotPasswordOtp`; the stale comment saying resend-otp does not accept `forgot_password` was removed. `PURPOSE_MAP` already contained the mapping from 6c. In `auth.service.ts`: added `resendForgotPasswordOtp({ email })`, which calls `forgotPassword` (same operation, implemented once, per the spec), so both endpoints share the `requestOtp` lock, cooldown, rolling-window limit and error mapping. The success response for resend keeps the existing body (`200 { message: 'A new verification code has been sent to your email', code: 'OTP_SENT' }`). This completes pre-work #5. `npx tsc --noEmit` and `npx eslint src` pass. Tested against the dev containers with a fresh user: a resend before verifying registration gave 403 `ACCOUNT_NOT_VERIFIED` and no `Forgot Password` row; after `forgot-password`, an immediate resend gave 429 `OTP_RESEND_COOLDOWN` with `Retry-After: 60`; with the cooldown backdated a resend gave 200 and left one active OTP row (previous consumed); after 5 successful resends (6 rows) the next gave 429 `OTP_RESEND_LIMIT` ("try again in about an hour") with no new row; after ageing all rows past the window a resend gave 200 (limit not permanent); an unknown email gave 404 with no row created; an extra field, a non-string email and `purpose: "forgot password"` each gave 400 with the expected message; a suspended account's resend gave 200; a pending account's `forgot_password` resend gave 403 with no row; and the registration resend still gave its cooldown 429. Not run: the email-send-failure 503 path, and concurrent resends for this purpose.

**Files:**

- `user-service/src/controllers/auth.controller.ts` (modified)
- `user-service/src/services/auth.service.ts` (modified)

**Deviations / questions raised for the team:**
None

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-26 — Docs: align instructions.md with the codebase

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs
**Scope:** Refactor/Docs
**Governing decision:** Code in `user-service/` as of Stage 6e; user-approved edits listed under Key responses

**Prompts (exact):**

> read through instructions.md and the code base and understand what's going on.

> is instructions.md and the code base aligned?

> Show me the changes for the "gaps and what i'd suggest"

> go for it for 1-3

**Key responses:**
Compared `instructions.md` with the user-service source (read only; the app and tests were not run). Proposed three text edits and applied them after approval: (1) the Stage 1 `package.json` block now matches the real scripts and dependency versions; (2) removed the stale sentence in Stage 5e saying the registration resend message still needed changing; (3) added a status note above the Stage 6 "Changes to already-implemented code" table saying all nine changes are implemented. No requirements, design or schema content was changed. Stage 7 was noted as not yet written down and was not drafted.

**Files:**

- `instructions.md` (modified; no header added, as it is a team-owned document)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Stage 7 (`GET /users/me` and later) is not in `instructions.md`; the team needs to write it before it can be implemented.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-26 — Stage 7: Comprehensive Test Suite (Stages 1-6)

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md` "Stage 7: Comprehensive Test Suite" including the team's answers to the ambiguity list (Test stack, Infrastructure, Mocking policy, Manual-only verification bullets, Temporary protected route, Concurrency test parameters), plus the Verification bullets of Stages 1-6

**Prompts (exact):**

> read through instructions.md and the code base to understnad what's going on

> give me any questions you have before starting stag 7

> 1. for traceability table, you can just wait until we're done with all the testing, then ask me about it again. for ambiguity list, this is the ambiguity check!
> 2. yes, split it into an app export
>    i have inserted the answers for 1-13 in instructions.md.
> 3. accept underscore.
> 4. that's correct, verify shouldn't check a user's status.

> 1. okay feel free to make these changes
> 2. let's go with (a). for this (and for any other changes you make that affect deployment later), include a note in instructions.md to reverse those changes later on.

**Key responses:**
Produced the ambiguity list before writing any tests and waited for the team's answers. Then implemented the decided setup: split `app.ts` into a pure `app` export plus `server.ts` (bootstrap, then listen) and updated the `start`/`dev` scripts and the prod `CMD`; published `user-db` on host port 5434 (temporary, with a reverse-before-deploy note in `instructions.md`); added `vitest.config.ts` (sequential files), a global setup that drops and recreates `user_service_test` from `init.sql`, per-file setup (`.env.test`, throwaway RS256 keys, mocked `sendOtpEmail`), and SQL/email/fixture helpers. Wrote 407 tests in 15 files under `user-service/tests/`, mirroring `src/`, with a separate `concurrency/` folder. Deterministic lock-interleaving tests hold a row lock, start the request, change state, then commit. No application logic was changed and no test asserts deferred features (NFR1, NFR2, rate limiting). Traceability table not written yet, as instructed.
Verification actually run: the full suite (407 passed), `eslint .` and `tsc --noEmit` for the tests were clean. Docker was not running, so the suite ran against a temporary local PostgreSQL 14 on port 5434, not the project's Postgres 16 container. Mutation check: temporarily removing `SKIP LOCKED`, the revoke-all in reset-password, and the login post-lock password re-check each made tests fail; the source was restored afterwards. `npm run build`, the Docker build, and `docker compose up` were not run.
Committed separately on `main` at the user's request: the user's own `instructions.md` edits.

**Files:**

- `user-service/src/app.ts` (modified)
- `user-service/src/server.ts` (created)
- `user-service/package.json` (modified: scripts, devDependencies supertest, @types/supertest, dotenv; no header possible)
- `user-service/package-lock.json` (modified; no header possible)
- `user-service/Dockerfile` (modified)
- `compose.yaml` (modified)
- `user-service/vitest.config.ts` (created)
- `user-service/.env.test` (created)
- `user-service/tests/tsconfig.json` (created; no header, JSON)
- `user-service/tests/setup/globalSetup.ts`, `user-service/tests/setup/setupFiles.ts` (created)
- `user-service/tests/helpers/constants.ts`, `db.ts`, `email.ts`, `fixtures.ts`, `keys.ts` (created)
- `user-service/tests/utils/hash.test.ts`, `otp.test.ts`, `jwt.test.ts` (created)
- `user-service/tests/middleware/authenticate.test.ts` (created)
- `user-service/tests/config.test.ts` (created)
- `user-service/tests/db/queries/users.queries.test.ts`, `otp.queries.test.ts`, `tokens.queries.test.ts` (created)
- `user-service/tests/services/email.service.test.ts`, `otp.service.test.ts`, `auth.service.test.ts`, `bootstrap.service.test.ts` (created)
- `user-service/tests/controllers/auth.controller.test.ts` (created)
- `user-service/tests/concurrency/races.concurrency.test.ts`, `lock-recheck.concurrency.test.ts` (created)
- `instructions.md` (modified: added "Stage 7 changes to reverse or review before deployment")
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**

- The Stage 7 "co-locate tests next to the source" bullet conflicts with the team's answer to keep tests in `user-service/tests/`; the answer was followed, with a tree mirroring `src/`.
- Stage 4b describes register returning `201 REGISTER_SUCCESS`; tests assert the current `201 OTP_SENT` from Stage 5d.
- Traceability table (`tests/TRACEABILITY.md`) is still to be written; the team asked to be asked again once testing is done.
- The temporary `5434:5432` port mapping in `compose.yaml` must be removed before deployment (see `instructions.md`).

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

---

## 2026-09-26 — Recess iteration: Credit Service schema, allocation and reservation

**Tool:** Claude Code (model: claude-opus-5)
**Mode:** generate
**Scope:** Requirements formatting | Implementation code | Boilerplate
**Governing decision:** `credit-service/credit-service-context.md` §3 (service boundaries), §4 (stack), §5 (schema decisions), §6 (F19, F20), §7 (NFR8), §8 (API surface); `docs/FoC-ProductBacklog.md` (reference only — the team directed that the context file takes precedence); schema conventions follow the team's existing `user-service/src/db/init.sql`.

**Prompts (exact):**

> Read credit-service/CONTEXT.md, paying special attention to §10 regarding the ordering problems. I agree with the flagged gaps. Please officially move F20.1.1 (logging) to the current Recess iteration, and move NFR8.1.2 (rollback) to Week 7 so it is built alongside F19.3 (transfer).
>
> With that updated plan, begin implementing the Recess iteration tasks (F19.1 and F19.2). Start by creating the PostgreSQL schema for both the balances and transaction_log tables. Ensure that all credit operations (like allocation and reservation) are wrapped in atomic database transactions that write to both tables simultaneously, fulfilling NFR8.1.1 and F20.1.1 from the start.
>
> make sure to summarise what you have change after every iteration of prompt. You are now to write all the credit service related files in credit-service folder, MAKE SURE to ask for my permission before you touch any code outside of this folder

> u can edit 1 2 and 4, for the productbacklog, you can just treat that as reference and just follow the credit service context file

Answers given to five questions the agent stopped to ask (see "Deviations" below):

> Destination = new user
>
> ai/usage-log.md + README row, docs/FoC-ProductBacklog.md, compose.yaml + .env.example, for the productbacklog make sure to ask my permission everytime you change, same goes for the other 2
>
> Unique index per request
>
> Follow user-service conventions
>
> TypeScript + vitest

**Key responses:**
Stopped before writing any SQL and asked five questions, because `AGENTS.md` §2.1 lists schema, interface and dependency choices as stop-and-ask triggers. The blocking one: F20.1.1 says originating user is "not applicable for allocation" and destination user is "applicable to transfer only", so an allocation row would name nobody and F19.5.2 could never return a user's own allocation. The team chose destination = the new user.

Recorded the team's two iteration moves in `credit-service-context.md` (F20.1.1 → Recess in §6, NFR8.1.2 → week 7 in §7, §10 gaps 1 and 2 struck through and marked resolved with the date). No rationale was written for either move; `AGENTS.md` §2 prohibits the agent drafting decision rationales. The backlog was left untouched at the team's instruction, so `docs/FoC-ProductBacklog.md` lines 216 and 274 still read week 9 and week 8 and now disagree with the context file by design.

Wrote the schema in `src/db/init.sql`: `balances` (user_id PK, total_balance, reserved_balance, timestamps, CHECK constraints for non-negative values and reserved <= total) and `transaction_log` (the seven F20.1.1 fields, CHECK constraints fixing which party columns each transaction type fills and requiring request_id on everything except allocation). Partial unique indexes enforce one transfer per request (F19.3.2, placed early) and one reservation per request (team decision this session). No FK on user_id, per §3. NFR8.2.3's `REVOKE` is deliberately left inert and documented, because the sibling services connect as the `postgres` superuser, which bypasses REVOKE entirely; it is a week 7 item.

Implemented F19.1.1 and F19.2.1–F19.2.3. Both write paths run inside one `withTransaction` (helper copied from `user-service/src/db/transaction.ts`), issuing the balance write and the `transaction_log` insert on the same client, so NFR8.1.1 and F20.1.1 hold from the first commit. Reservation takes `SELECT … FOR UPDATE` on the balance row before comparing the offer against unreserved. Allocation uses `INSERT … ON CONFLICT DO NOTHING RETURNING`, so a repeated registration trigger is resolved by the primary key rather than by a check-then-write race, and writes no second log row.

Verification actually run: `npx tsc --noEmit` and `npm run build` both exit 0. **The test suite was not run and the SQL has never been executed by a server** — the Docker daemon was not running, nothing was listening on ports 5432–5435, and `psql` is not installed, so no database was reachable. `tests/services/credits.service.test.ts` and `tests/concurrency/reserve.concurrency.test.ts` are written but unproven.

**Files:**

- `credit-service/credit-service-context.md` (modified: §6, §7, §10)
- `credit-service/src/db/init.sql` (created)
- `credit-service/src/db/pool.ts`, `src/db/transaction.ts`, `src/db/queries/credits.queries.ts` (created)
- `credit-service/src/services/credits.service.ts` (created)
- `credit-service/src/controllers/credits.controller.ts` (created)
- `credit-service/src/routes/credits.routes.ts` (created)
- `credit-service/src/middleware/errorHandler.ts` (created)
- `credit-service/src/utils/AppError.ts`, `src/utils/asyncHandler.ts` (created)
- `credit-service/src/domain/constants.ts` (created)
- `credit-service/src/app.ts`, `src/server.ts`, `src/config.ts` (created)
- `credit-service/tests/services/credits.service.test.ts` (created)
- `credit-service/tests/concurrency/reserve.concurrency.test.ts` (created)
- `credit-service/tests/helpers/db.ts` (created)
- `credit-service/vitest.config.ts` (created)
- `credit-service/tsconfig.json` (created)
- `credit-service/Dockerfile` (created — was an empty placeholder)
- `credit-service/README.md` (created — was an empty placeholder)
- `credit-service/.env.example`, `credit-service/.dockerignore` (created)
- `credit-service/package.json` (created; no header possible, JSON)
- `credit-service/package-lock.json` (created; no header possible)
- `compose.yaml` (modified: credit-db and credit-service services, credit-db-data volume)
- `.env.example` (modified: CREDIT\_\* variables)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

- **F20.1.1 contradicts itself on allocation.** Read literally, an allocation row names no user. Team answered: destination = the new user. Encoded in the `transaction_log_party_shape` CHECK constraint.
- **The API contract is not team-decided.** §8 fixes only method and path. The request bodies, response bodies and all seven status codes were written by the agent to make the service runnable and are tabulated in `credit-service/README.md` under "pending team sign-off". `AGENTS.md` §2.1 classifies these as team decisions.
- **NFR8.2.3 is not enforced.** Needs a named least-privilege application role; the current superuser connection would ignore `REVOKE`. Week 7.
- **F20.1 (parent) still reads week 9** in §6 while its only child F20.1.1 now reads Recess. Not changed without instruction.
- **Duplicate reservation protection is not in any requirement.** The team added a unique index this session; no FR covers it.
- **The backlog and the context file now disagree** on F20.1.1 and NFR8.1.2, by the team's instruction.
- Tests were written but never executed; see Key responses.

**What I kept/changed/rejected:**

**Author review:**

## 2026-10-20 — Frontend: Live activity from microservices

**Tool:** Copilot SDK (model: unspecified by runtime)
**Mode:** refactor
**Scope:** Implementation code
**Governing decision:** Existing Order Service `GET /orders` and transition routes, plus Supplier Service requester read endpoints

**Prompts (exact):**

> seems like what's shown on the card is from the options selected in the demo. now i dont want a demo anymore, i want the data shown to be from the microservices straight.

**Key responses:**
Replaced Activity's DemoContext request list with live Order Service data, filtered by the authenticated session ID. Supplier details are loaded from the Supplier Service, and status actions now call the Order Service transition endpoints before refreshing the list. The UI no longer uses demo request, supplier, or user records for Activity cards; unavailable user names are represented by role labels because the Order Service response contains IDs only. Frontend lint completed with existing warnings and the production build passed after fixing an invalid `qualifiedName` import.

**Files:**

- `frontend/src/pages/Activity.jsx` (modified)
- `frontend/src/api/orders.js` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
tng wen xi

## 2026-10-20 — Order Service: Integer supplier identifiers

**Tool:** Copilot SDK (model: unspecified by runtime)
**Mode:** refactor
**Scope:** Implementation code
**Governing decision:** Team request to align Order Service supplier references with Supplier Service integer IDs

**Prompts (exact):**

> found the problem it's here. help change it to just a normal integer id

**Key responses:**
Changed `supplierId` from UUID to a positive integer across the Prisma schema, migrations, request payload type, validation, seed data, tests, and the frontend POST payload. Added a migration that replaces the existing UUID reference column because arbitrary historical UUIDs cannot be translated reliably to Supplier Service integer IDs. Prisma client generation, type-checking, linting, and 80 focused service/controller tests passed.

**Files:**

- `order-service/prisma/schema.prisma` (modified)
- `order-service/prisma/migrations/20260927111937_create_requests/migration.sql` (modified)
- `order-service/prisma/migrations/20261020211000_supplier_id_integer/migration.sql` (created)
- `order-service/prisma/seed.ts` (modified)
- `order-service/src/types/orders.ts` (modified)
- `order-service/src/services/orders.service.ts` (modified)
- `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `frontend/src/pages/CreateRequest.jsx` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The new migration drops and recreates the supplier reference column; existing UUID supplier references are not preserved.

**What I kept/changed/rejected:**
I kept all changes.

**Author review:**
tng wen xi

## 2026-10-20 — Order Service: JWKS authentication middleware

**Tool:** Copilot SDK (model: unspecified by runtime)
**Mode:** generate | refactor
**Scope:** Implementation code
**Governing decision:** `user-service/docs/jwks-verification-guide.md` and instructions.md Stage 13

**Prompts (exact):**

> help me write the middleware for order service also so that the requests are authenticated

**Key responses:**
Implemented Order Service Bearer-token authentication using the User Service JWKS endpoint. The middleware caches RSA keys, refetches once for an unknown `kid`, pins verification to RS256, validates expiry and subject claims, and returns the documented 401 response for failures. Mounted it on all `/orders` routes, changed controllers to use the verified principal instead of `x-user-id`, wired `USER_SERVICE_URL` into service configuration and Compose, and updated controller tests with an explicit test authenticator. Type-check, lint, formatting, and focused controller tests passed.

**Files:**

- `order-service/src/middleware/authenticate.ts` (created)
- `order-service/src/types/express.d.ts` (created)
- `order-service/src/config/env.ts` (modified)
- `order-service/src/app.ts` (modified)
- `order-service/src/server.ts` (modified)
- `order-service/src/controllers/orders.controller.ts` (modified)
- `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `order-service/.env.example` (modified)
- `compose.yaml` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**

**Author review:**
tng wen xi

## 2026-10-13 — order-service: Seed reservation and release lifecycle data

**Tool:** GitHub Copilot SDK in VS Code (model: GPT-5.6 Luna)
**Mode:** refactor
**Scope:** Boilerplate
**Governing decision:** Existing `OrderRequest.reservationId` and `OrderRequest.creditReleasedAt` fields.

**Prompts (exact):**

> updaate the seed data to include the new fields of reservationid and creditsReleasedAt where necessary

**Key responses:**
Added deterministic reservation identifiers to every seeded request. Cancelled and expired requests now include release timestamps; active and completed requests retain a null release timestamp because their reservation is not released by those states.

**Files:**

- `order-service/prisma/seed.ts` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**

None.

**What I kept/changed/rejected:**
I kept all changes.

**Author review:**
tng wen xi

## 2026-10-13 — order-service: Auto-expiry and cancellation edge-case tests

**Tool:** GitHub Copilot SDK in VS Code (model: GPT-5.6 Luna)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** Existing F16.1 delivery-deadline expiry and F17 cancellation transition rules in `order-service/src/domain/order-status.ts`.

**Prompts (exact):**

> write tests for the auto expire and auto cancel based on the requirements, remember to add for edge cases too and ensure high branch coverage

**Key responses:**
Added lifecycle tests for automatic expiry and requester cancellation, including exact deadline boundaries, pre-deadline behavior, missing deadlines and reservations, terminal states, optimistic-lock races, and credit-release failures. Verification: 303 tests passed, typecheck passed, and full coverage reported 90.41% branches overall and 93.2% branches in `orders.service.ts`.

**Files:**

- `order-service/src/services/orders.service.spec.ts` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**

No production code was changed. Existing credit-service stubs remain outside this test scope.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
tng wen xi

## 2026-10-12 — Order edit optimistic locking: Version check and update

**Tool:** GitHub Copilot (model: GPT-5.6 Luna)
**Mode:** refactor
**Scope:** Implementation code
**Governing decision:** Existing `OrderRequest.version` schema field and optimistic-locking pattern in `order-service/src/services/orders.service.ts`

**Prompts (exact):**

> should version update and checking also be implemeented in this function? if so, help me implement it

**Key responses:**
Implemented optimistic locking in `editOrder`: the update now matches the version read during authorization, increments the version atomically, returns `ORDER_CONFLICT` when no row matches, and re-reads the updated order. Added success and stale-version unit tests. Type-checking and linting passed; the two new focused tests passed. The broader service test file still has 20 pre-existing `createOrder` failures unrelated to this change.

**Files:**

- `order-service/src/services/orders.service.ts` (modified)
- `order-service/src/services/orders.service.spec.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
tng wen xi

## 2026-10-12 — order-service: edit payload error handling

**Tool:** GitHub Copilot (model: GPT-5.6 Luna)
**Mode:** refactor, debug
**Scope:** Implementation code, Debugging
**Governing decision:** Existing order-service edit endpoint behavior; team-selected `INVALID_FIELD` response for unsupported JSON keys.

**Prompts (exact):**

> is there a way to find the type of error within the catch block and send the correct error code and message back to the user?

**Key responses:**
Added `INVALID_FIELD` for unsupported edit payload keys, validate those keys before querying Prisma, map Prisma `P2025` to `ORDER_NOT_FOUND`, rethrow unrelated database errors, and map edit error codes to user-facing messages in the controller. Added focused service and HTTP tests. Typecheck and focused tests passed. The broader controller/service files retain pre-existing failures related to `additionalDetails` validation.

**Files:**

- `order-service/src/constants/errors.ts` (modified)
- `order-service/src/services/orders.service.ts` (modified)
- `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.ts` (modified)
- `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The team selected adding `INVALID_FIELD` and returning HTTP 400 for unsupported JSON keys.

**What I kept/changed/rejected:**

**Author review:**

## 2026-10-12 — order-service: edit-order test coverage

**Tool:** GitHub Copilot (model: GPT-5.6 Luna)
**Mode:** refactor, debug
**Scope:** Implementation code, Debugging
**Governing decision:** Existing `PATCH /orders/:id/edit` route and service behavior in `order-service/src/routes/orders.routes.ts` and `order-service/src/services/orders.service.ts`.

**Prompts (exact):**

> Implemented this new route for updating orders. can you help me to update the tests in these files?

**Key responses:**
Updated shared create-order fixtures to include the validated optional `additionalDetails` field. Added service tests for edit authorization and missing orders, and HTTP tests for successful edits, forbidden actors, and optimistic-lock conflicts. Focused order-service tests passed.

**Files:**

- `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**

**Author review:**

## 2026-09-26 — Recess iteration: Credit Service verification run

**Tool:** Claude Code (model: claude-opus-5)
**Mode:** debug | docs
**Scope:** Implementation code | Debugging | Requirements formatting
**Governing decision:** `credit-service/credit-service-context.md` §6 (F19, F20), §7 (NFR8.1.1); team answers given in chat on 2026-09-26.

**Prompts (exact):**

> 1. this can be put on hold
> 2. move f20.1 to recess week
> 3. It's right to have left it unenforced.
> 4. remind me later
>
> Both user_id and request_id are confirmed by the team to be UUIDs.
>
> Please write the `credit-db` service for `compose.yaml` and `.env.example`.
>
> - Check the host ports mapped to `user-db` and `order-db` and pick the next free port.
> - Match their patterns exactly (Postgres image/tag, volume naming, healthchecks).
> - Ensure `init.sql` is mounted exactly how the sibling services do it.

> "Please fold it into the next substantive entry. We don't need a separate log for this minor documentation update.
> With the Docker compose file confirmed, please proceed with spinning up the database container (`docker compose up -d credit-db`) and running the test suite to verify the Recess iteration logic. Report the results of the concurrency test."

**Key responses:**

**Corrects the previous entry.** The entry above this one states "The test suite was not run and the SQL has never been executed by a server". That was true when written and is no longer true. Entries are append-only (`AGENTS.md` §5.1), so this entry records the verification rather than editing that one.

Folded in from the intervening exchange: F20.1 moved from week 9 to Recess in `credit-service-context.md` §6, so parent and child now agree (F20.1.1 had already moved). The team confirmed `user_id` and `request_id` as UUIDs — already implemented that way in `init.sql` and validated with `z.string().uuid()`, so no code changed. The team confirmed leaving NFR8.2.3 unenforced was correct, and put the API contract sign-off on hold.

The `credit-db` compose service requested in the prompt had already been written in the previous task, so it was verified rather than rewritten: host port 5435 is the next free one after order-db 5433 and user-db 5434; volume `credit-db-data` matches the `*-db-data` naming and is declared in the top-level `volumes:` block; the healthcheck is byte-identical to order-db's; `init.sql` is mounted exactly as user-db mounts its own. Two points where the siblings disagree were flagged rather than silently resolved: the Postgres tag (order-db `postgres:17` vs user-db `postgres:16-alpine` — used 16-alpine, matching user-service) and the port style (used order-db's env-driven form rather than user-db's hardcoded one, which carries a remove-before-deploy note).

Verification actually run, against a real database this time. Docker Desktop was not running and was started. `docker compose up -d credit-db` created the container; the Postgres image applied `src/db/init.sql` on first start, producing both tables and all five indexes, and the container reported healthy. `npm test` passed 10 tests in 2 files. `npx tsc --noEmit` and `npm run build` exit 0.

Concurrency results (NFR8.1.1): six simultaneous 4-credit reservations against a 20-credit balance left exactly five committed and one rejected with `INSUFFICIENT_UNRESERVED_CREDITS`, final state `reserved=20, total=20` with six log rows; ten concurrent 3-credit reservations kept `reserved` equal to three times the number of logged reservations; two simultaneous allocations for one user produced one success and one log row.

## 2026-10-16 — Frontend: Docker Compose development setup

**Tool:** GitHub Copilot (model: GPT-5.6 Luna)
**Mode:** generate, refactor, docs
**Scope:** Boilerplate, Implementation code, Refactor/Docs
**Governing decision:** Existing root Compose development workflow and frontend Vite proxy configuration.

**Prompts (exact):**

> can u set up the docker such that when i run `docker compose -f compose.yaml -f compose.dev.yaml up --build --watch` it will also run the frontend together with the backend

**Key responses:**
Added a frontend development Dockerfile and `.dockerignore`, a `frontend` service with Compose Watch sync/rebuild rules in `compose.dev.yaml`, and configurable Vite proxy targets so the container reaches the user and supplier services over the Compose network. Documented the command in the frontend README. `docker compose ... config --quiet`, `git diff --check`, and the frontend development image build passed. The image build reported eight npm audit vulnerabilities from the existing dependency tree; dependencies were not changed.

**Files:**

- `frontend/Dockerfile` (created)
- `frontend/.dockerignore` (created)
- `compose.dev.yaml` (modified)
- `frontend/vite.config.js` (modified)
- `frontend/README.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
tng wen xi

Mutation check, to show the concurrency test is not vacuous: removing `FOR UPDATE` from `lockBalanceForUpdate` made the first concurrency test fail, and the failure was informative. All six requests passed the application-level comparison because without the lock they all read `reserved_balance = 0`; the sixth was stopped by the `balances_reserved_not_exceeding_total` CHECK constraint (SQLSTATE 23514) rather than by the service. So the row lock is what produces a clean 422, and the CHECK constraint is what prevents balance corruption if the lock is ever lost. The source was restored and the suite re-run green.

NFR8.2.3 was confirmed still unenforced by deleting a `transaction_log` row while connected as the `credit` application role. Expected; it is a week 7 item.

Tests clean up after themselves — both tables were empty afterwards.

Note for whoever runs this next: the Docker environment was later found to be completely empty (no containers, volumes or images), consistent with a Docker Desktop reset rather than any command run here. Re-running `docker compose up -d credit-db` recreates everything from `init.sql`.

**Files:**

- `credit-service/credit-service-context.md` (modified: §6, F20.1 moved to Recess)
- `credit-service/tests/setup/env.ts` (created)
- `credit-service/vitest.config.ts` (modified: setupFiles)
- `credit-service/.gitignore` (created — the root .gitignore does not cover node_modules, and each sibling service carries its own)
- `credit-service/.env` (created locally for the test run; git-ignored, not committed)
- `ai/usage-log.md` (modified)

**Deviations / questions raised for the team:**

- The previous entry's verification statement is now out of date; corrected here rather than edited, per the append-only rule.
- Postgres tag and port style: the two sibling databases disagree, so "match their patterns exactly" had no single answer. Choices recorded above; switching `credit-db` to `postgres:17` is a one-line change if the team prefers order-db's tag.
- Still open and unchanged: the API contract (request/response bodies and status codes) is agent-written and on hold; NFR8.2.3 needs a named least-privilege role in week 7; author review signatures are outstanding on every credit-service file header and on both log entries.

**What I kept/changed/rejected:**

**Author review:**

---

## 2026-09-27 — Stage 8: RBAC Middleware

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md` "Stage 8: RBAC Middleware" (design decisions table, `src/middleware/authorize.ts` spec, Verification bullets, and the "Tests (Vitest)" section).

**Prompts (exact):**

> let's go with stage 8. here's the workflow:
>
> 1. before starting the stage, make sure you go to main and pull from it.
> 2. branch from main to a branch called (e.g. feat/stage-8a-name)
> 3. complete the changes.
> 4. fill in the AI declaration in usage-log.md (follow the format for the last few ones) and the AI header in individual files.
> 5. wait for further instructions.
> 6. once i approve, you can do git add, commit (feat: implement ...(stage 8a)), push the branch and PR

**Key responses:**
Pulled `main` (already up to date) and branched to `feat/stage-8-rbac-middleware`. Created `authorize(minimumRole)`, a middleware factory in `user-service/src/middleware/authorize.ts`, with the exported `ROLE_RANK` table (`user` 0, `admin` 1, `super admin` 2). The returned middleware responds `401 { message: 'Unauthorized', code: 'UNAUTHORIZED' }` when `req.user` is missing (same shape as `authenticate`), calls `next()` when the caller's rank is at least the minimum, and otherwise responds `403 { message: 'Forbidden', code: 'FORBIDDEN' }`. It is synchronous, does no DB work and does not use `asyncHandler`. Nothing is wired onto a route (Stages 9-10 do that) and there are no DB changes.

One point the spec does not state: a role name missing from `ROLE_RANK` (on the caller or as `minimumRole`) makes the comparison false, so the request gets `403`. This is a side effect of the specified comparison, not an added rule.

Wrote `tests/middleware/authorize.test.ts` (9 tests, fake req/res/next, no DB, no Express app): the six caller-by-required-role combinations from Verification, missing `req.user` gives `401` and `next()` is not called, the factory returns a function, and the middleware throws nothing and returns no promise.

Verification actually run: `tsc --noEmit` for `src` and for `tests/tsconfig.json`, and `eslint` on the two new files, were clean. The new test file passed 9/9, run with a throwaway config kept outside the repo that skips the Vitest `globalSetup`, because Docker was not running and `globalSetup` needs the `user_service_test` database. Mutation check: changing `>=` to `>` in `authorize.ts` made 2 tests fail; the source was restored afterwards. The rest of the suite was not re-run, since nothing existing was modified.

**Files:**

- `user-service/src/middleware/authorize.ts` (created)
- `user-service/tests/middleware/authorize.test.ts` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

- The full Vitest suite was not run against the database (Docker was not running); only the new DB-free test file was run.
- The instructions list `ROLE_RANK` as a plain `const` in the snippet but say to "Export a rank table"; it is exported.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

---

## 2026-09-27 — Stage 9: Admin Endpoints — View Users, Suspend/Unsuspend

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md` "Stage 9: Admin Endpoints — View Users, Suspend/Unsuspend" (design decisions table, `users.queries.ts` / `users.service.ts` / `users.controller.ts` / `users.routes.ts` specs, Verification bullets and "Tests (Vitest)" section), including the team's decisions recorded there: pending users listed and viewable with their `status`, `SUPER_ADMIN_IMMUTABLE` for any caller targeting a super admin, and `422 CANNOT_CHANGE_STATUS_PENDING_USER` for a status change on a pending user.

**Prompts (exact):**

> leave both as it is bah. finished my AI declaration already, can proceed to finish the git workflow, then start on stage 9

> sorry just merged my PR, proceed

> password_hash is removed by destructuring, not a field whitelist, so a column added later would show up in responses unless the service changes.
>
> - point me to the relevant code
>
> The pending rule returns "Cannot suspend pending user" even when the request was to set active, as specified.
>
> - can change to a generic "cannot change the status/role of pending/suspended user" (accordingly)

> can change the code as well (CANNOT*CHANGE_STATUS*...) you know the rest

**Key responses:**
Pulled `main` after the Stage 8 PR was merged and branched to `feat/stage-9-admin-users`. Implemented the three endpoints, all behind `authenticate` + `authorize('admin')` and mounted at `/users`:

- `users.queries.ts`: `listAllUsers` (every status, newest first) and `updateUserStatus` (`UPDATE ... RETURNING *`, run on the locked row).
- `users.service.ts` (new): `listUsers`, `getUserById` and `changeUserStatus`, each stripping `password_hash` before returning. `changeUserStatus` runs in `withTransaction` with `lockUserById` and checks, in order: not found (404), super admin target (403 `SUPER_ADMIN_IMMUTABLE`), admin caller on admin target (403 `FORBIDDEN`), pending target (422 `CANNOT_CHANGE_STATUS_PENDING_USER`), no-op (200, no write, no revocation). Suspending revokes all of the target's refresh tokens in the same transaction.
- `users.controller.ts` (new): Zod `.uuid('Invalid user ID')` on `req.params.id`, and a `.strict()` body schema for `status` with the specified custom messages.
- `users.routes.ts` (new) and the `/users` mount in `app.ts`.

Tests, all against the real test DB: users query tests (appended), `users.service.test.ts`, `users.controller.test.ts` (HTTP), `users.concurrency.test.ts`, and four deterministic re-check-after-lock cases (target promoted to super admin, turned pending, already suspended, or deleted while the request waited) appended to `lock-recheck.concurrency.test.ts`. A `createUserWithRole` / `accessTokenFor` / `bearer` fixture helper was added to `tests/helpers/fixtures.ts`. Every Stage 9 Verification bullet has a test.

Verification actually run: full suite 478 passed (19 files), `eslint .`, `tsc --noEmit` for `src` and for `tests/tsconfig.json`, and a build to a scratch directory were clean. Mutation checks: removing the revocation, the no-op check or the pending check each made 4 tests fail; removing `FOR UPDATE` from `lockUserById` made the lock tests fail (20 failures). Before the re-check tests were added, the looped concurrent-status test alone did NOT catch a missing row lock, which is why the deterministic tests were added. All mutated sources were restored and re-verified identical.

Environment: Docker Desktop was not running and was started. The existing `foc-user-db` container had been created before the `5434:5432` test port mapping existed, so it was recreated with `docker compose up -d --no-deps --force-recreate user-db` (the `foc_user-db-data` volume was kept). Compose needed values for the other services' required variables, which were passed inline as dummy values for that one command; no `.env` file was created.

**Files:**

- `user-service/src/db/queries/users.queries.ts` (modified)
- `user-service/src/services/users.service.ts` (created)
- `user-service/src/controllers/users.controller.ts` (created)
- `user-service/src/routes/users.routes.ts` (created)
- `user-service/src/app.ts` (modified)
- `user-service/tests/db/queries/users.queries.test.ts` (modified)
- `user-service/tests/services/users.service.test.ts` (created)
- `user-service/tests/controllers/users.controller.test.ts` (created)
- `user-service/tests/concurrency/users.concurrency.test.ts` (created)
- `user-service/tests/concurrency/lock-recheck.concurrency.test.ts` (modified)
- `user-service/tests/helpers/fixtures.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

- `password_hash` is removed with a destructure and a one-line `eslint-disable` for the unused variable, rather than a field whitelist, so any column added later will appear in responses unless the service is changed.
- The pending-target rule applies whichever status is requested (`suspended` or `active`). At the team's request its message and code were made generic: `422 CANNOT_CHANGE_STATUS_PENDING_USER`, "Cannot change the status of a pending user" (previously `CANNOT_SUSPEND_PENDING_USER`). The Stage 10 rules in `instructions.md` were reworded the same way and are not implemented yet: `CANNOT_CHANGE_ROLE_PENDING_USER` / `CANNOT_CHANGE_ROLE_SUSPENDED_USER` (previously `CANNOT_PROMOTE_*`).
- Stage 9 makes `authenticate` a route dependency for the first time. Access tokens are stateless, so a suspended user's or demoted admin's existing access token keeps working on these routes for up to 15 minutes (the documented Stage 8 trade-off).

**What I kept/changed/rejected:**
Got Claude to help modify the error codes, to make it accurate (e.g. not just "suspend", but "change status").

**Author review:** gabriel yap

---

## 2026-09-27 — Stage 10: Super Admin — Promote / Demote

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md` "Stage 10: Super Admin — Promote / Demote" (design decisions table, `updateUserRole` / `changeUserRole` / `changeRole` specs, Verification bullets and "Tests (Vitest)" section), including the team's recorded decisions there: only an `active` target's role can change (`422 CANNOT_CHANGE_ROLE_PENDING_USER` / `CANNOT_CHANGE_ROLE_SUSPENDED_USER`), and no-op requests return `200` unchanged.

**Prompts (exact):**

> go ahead. stop after opening the PR.

> let's go to 10.

**Key responses:**
Pulled `main` after the Stage 9 PR was merged and branched to `feat/stage-10-role-management`. Implemented `PUT /users/:id/role` behind `authenticate` + `authorize('super admin')`:

- `users.queries.ts`: `updateUserRole` (`UPDATE ... RETURNING *`, run on the locked row).
- `users.service.ts`: `changeUserRole(requesterId, targetId, newRole)`. Self-targeting is rejected first (403 `SELF_ROLE_CHANGE`, before any DB access). Then, in `withTransaction` with `lockUserById`: not found (404), super admin target (403 `SUPER_ADMIN_IMMUTABLE`), pending target (422 `CANNOT_CHANGE_ROLE_PENDING_USER`), suspended target (422 `CANNOT_CHANGE_ROLE_SUSPENDED_USER`), no-op (200, no write, no revocation). A real change updates the role and revokes all of the target's refresh tokens in the same transaction. `password_hash` is stripped by the existing `toPublicUser`.
- `users.controller.ts`: `changeRole`, with the Stage 9 `.uuid('Invalid user ID')` params schema and a `.strict()` body schema for `role` with the specified custom messages; the requester id comes from `req.user.user_id`.
- `users.routes.ts`: the `/:id/role` route.

Tests, all against the real test DB, appended to the Stage 9 test files: `updateUserRole` query tests; `changeUserRole` service tests; HTTP tests for `PUT /users/:id/role`; a concurrent-role test in `users.concurrency.test.ts`; and five deterministic re-check-after-lock cases in `lock-recheck.concurrency.test.ts` (target became super admin, suspended, pending, already had the role, or was deleted while the request waited). Every Stage 10 Verification bullet has a test except the one listed under Deviations.

Verification actually run: full suite 524 passed (19 files), `eslint .`, `tsc --noEmit` for `src` and for `tests/tsconfig.json`, and a build to a scratch directory were clean. Mutation checks on `changeUserRole`: removing the token revocation failed 9 tests, the no-op check 8, the suspended check 5 and the self-target check 4; the source was restored and verified identical. The first run of the concurrency test failed on a test-fixture mistake (a hyphen in a generated username, which registration rejects) and was fixed in the test only. The `foc-user-db` container from Stage 9 was still running.

**Files:**

- `user-service/src/db/queries/users.queries.ts` (modified)
- `user-service/src/services/users.service.ts` (modified)
- `user-service/src/controllers/users.controller.ts` (modified)
- `user-service/src/routes/users.routes.ts` (modified)
- `user-service/tests/db/queries/users.queries.test.ts` (modified)
- `user-service/tests/services/users.service.test.ts` (modified)
- `user-service/tests/controllers/users.controller.test.ts` (modified)
- `user-service/tests/concurrency/users.concurrency.test.ts` (modified)
- `user-service/tests/concurrency/lock-recheck.concurrency.test.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

- **One Verification bullet was not written as a test because the spec contradicts itself.** The bullet "Promote a user to admin, then that user's pre-promotion access token ... still rejected with `403` ...; after they `refresh`, the new token carries `role: admin` and the same route succeeds" cannot hold as written: a successful role change revokes ALL of the target's refresh tokens in the same transaction (Stage 10 design table), so `POST /auth/refresh` with the pre-promotion cookie returns `401 INVALID_REFRESH_TOKEN`, exactly as the demotion bullet says. The first half of the bullet (old token still gets `403`) is tested, and so is "refresh with the old cookie gets `401`" after a promotion. What the promoted user does to get a token carrying `role: admin` (for example, logging in again) is not specified, so no test asserts it. Raised for the team rather than guessed.
- The Stage 8 note that "enforcement catches up at the next `refresh` call" has the same tension for promotions, since the refresh is revoked.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-27 — Stage 11: Requester/Courier Toggle

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md` "Stage 11: Requester/Courier Toggle" (design decisions table, `init.sql`, `updateActiveView` / `changeActiveView` / `updateActiveView` controller and route specs, the `login` change and Verification bullets). The section is in the team's working copy of `instructions.md` and is committed with this change.

**Prompts (exact):**

> before you start anything, go to a new branch from main.
> after you PR, wait for further instructions.
>
> go ahed and do 11

> yes, it should be 403 and 400 for regular user and admin respectively. whwat changes are needed?

> 1. go ahead and make the change
> 2. is everything else standardised to using underscores?

> let's go to snake caes then

**Key responses:**
Pulled `main` (Stage 10 already merged) and branched to `feat/stage-11-active-view`. Implemented `PUT /users/me/active-view` behind `authenticate` only:

- `init.sql`: `active_view_enum` (`requester`, `courier`) with the same safe-creation pattern as the other enums, and `ALTER TABLE users ADD COLUMN IF NOT EXISTS active_view ... NOT NULL DEFAULT 'requester'`.
- `users.queries.ts`: `active_view` added to `UserRow`; `updateActiveView` (`UPDATE ... RETURNING *`, returns `null` when no row).
- `me.service.ts`: `changeActiveView(userId, activeView)`, a plain single-row update with no lock or transaction; `404 USER_NOT_FOUND` if no row; `password_hash` stripped. `toPublicUser` in `users.service.ts` was exported for reuse.
- `me.controller.ts`: `updateActiveView` with a `.strict()` Zod body schema and the specified messages; the user id comes only from `req.user.user_id`.
- `me.routes.ts`, and `app.ts` mounts `meRouter` at `/users/me` before `usersRouter`.
- `auth.service.ts`: `login` returns `activeView` in the `user` object, read from the row already locked in the login transaction.

No new test cases were added (the stage has no Tests section and the standing rule is not to add tests unless asked). Four existing tests asserted exact key sets and were updated for the new field: the two `login` user-object assertions (`auth.service.test.ts`, `auth.controller.test.ts`) and the two `listUsers` key lists (`users.service.test.ts`, `users.controller.test.ts`).

Verification actually run: `tsc --noEmit` for `src` and for `tests/tsconfig.json` and `eslint .` were clean. The full suite passed 524 of 524 on the final run. Two earlier full runs each had one different test fail, once with a register-normalisation assertion and once with an `ECONNRESET` in a supertest call; neither reproduced on the next run, and they were not investigated further. A throwaway supertest script (deleted afterwards, not committed) exercised the Stage 11 bullets against the test DB: `courier` returns 200 and updates the column, the same value again returns 200, no header returns 401, a bad enum, missing field, wrong type and extra field return 400, login returns `activeView`, and three concurrent calls all returned 200.

**Files:**

- `user-service/src/db/init.sql` (modified)
- `user-service/src/db/queries/users.queries.ts` (modified)
- `user-service/src/services/me.service.ts` (created)
- `user-service/src/controllers/me.controller.ts` (created)
- `user-service/src/routes/me.routes.ts` (created)
- `user-service/src/app.ts` (modified)
- `user-service/src/services/auth.service.ts` (modified)
- `user-service/src/services/users.service.ts` (modified: `toPublicUser` exported)
- `user-service/tests/services/auth.service.test.ts` (modified: fixture)
- `user-service/tests/controllers/auth.controller.test.ts` (modified: fixture)
- `user-service/tests/services/users.service.test.ts` (modified: fixture)
- `user-service/tests/controllers/users.controller.test.ts` (modified: fixture)
- `instructions.md` (Stage 11 section added by the team; not edited by the agent)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

- **`/users/me` check, resolved.** The Verification bullet originally expected `404` for a request to `/users/me`. Raised with the team: `meRouter` has no `GET` route, so `GET /users/me` always falls through to `usersRouter`'s `GET /:id` with `id = 'me'`, regardless of mount order — a regular user gets `403 FORBIDDEN` from `authorize('admin')`, an admin gets `400 VALIDATION_ERROR` (`"Invalid user ID"`) from the UUID check. The team confirmed 403/400 is correct and reworded the bullet in `instructions.md` accordingly; no code change was needed. The mount order itself was already correct, since it only needs to route `PUT /users/me/active-view` to `meRouter` first.
- **Response key name, resolved.** `PUT /users/me/active-view`'s response returns `active_view` (the same "DB row minus `password_hash`" shape as `GET /users/:id`), not `activeView` as the Verification bullet's original example showed. Raised with the team, who confirmed snake_case, matching the rest of the `/users` family; `login`'s `activeView` stays the deliberate one-off named explicitly by the Stage 11 spec. `instructions.md` was reworded to match; no code change was needed.
- `init.sql` only applies to a fresh DB volume. The dev database needs `docker compose down -v` (dev data only) or a manual `ALTER TABLE` (with `CREATE TYPE active_view_enum` first) against the running container. The test DB is recreated from `init.sql` on each run, so it is unaffected.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-27 — Stage 11b: Test Suite — Requester/Courier Toggle

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code (tests)
**Governing decision:** `instructions.md` "Stage 11b: Test Suite — Requester/Courier Toggle" (scope, ground rules inherited from Stage 7, "What to test" list, and "One thing NOT to test here"), plus the user's resolution of two points raised before writing anything: the concurrent-toggle case goes in `tests/concurrency/`, consistent with Stages 9-10, despite Stage 11b's Deliverables section naming only controller/service files; and the `tests/TRACEABILITY.md` deliverable is skipped (the file was never created in Stage 7 and updating it is out of scope here).

**Prompts (exact):**

> right, is the code from stage 11 pulled in also?

> is 11b clear?

> 1. consistent with all the previous stages
> 2. ignore the TRACEABILITY part

**Key responses:**
Branched `feat/stage-11b-active-view-tests` from `main` (which already had Stage 11 merged). Wrote the Stage 11 test suite, following Stage 7's ground rules, real-Postgres approach and layout:

- `tests/services/me.service.test.ts`: `changeActiveView` toggling to `courier` and back to `requester`, the "same value it already has" case returning normally (no no-op branch exists), the full response shape (snake_case, `password_hash` stripped), and `404 USER_NOT_FOUND` for a nonexistent id.
- `tests/controllers/me.controller.test.ts`: HTTP tests for `PUT /users/me/active-view` — the two successful toggles, the same-value case, no-`Authorization` 401, the three body-validation 400s (invalid enum, missing field, wrong type) and the extra-field 400, a newly-activated user defaulting to `requester`, and `POST /auth/login`'s response carrying the current `activeView`.
- `tests/concurrency/me.concurrency.test.ts`: concurrent `PUT /users/me/active-view` calls with different values on the same user, over `LOOP_ITERATIONS` iterations of `CONCURRENT_REQUESTS` requests each (the suite's existing shared constants) — asserts no `500`, all `200`, and a valid final value, since there is no lock here to serialize on.

Per Stage 11b's explicit carve-out, no test asserts `GET /users/me`'s current fallthrough to `usersRouter`'s `GET /:id` — that's a known, temporary gap Stage 12 closes.

Verification actually run: `tsc --noEmit` for `tests/tsconfig.json` and `eslint .` were clean. The full suite passed 540 of 540 on a clean run. One run had a single unrelated failure in the pre-existing `tests/concurrency/races.concurrency.test.ts` (a Stage 7 file, not touched here); it passed both alone and on the next full run, so it was treated as a timing flake and not investigated further.

**Files:**

- `user-service/tests/services/me.service.test.ts` (created)
- `user-service/tests/controllers/me.controller.test.ts` (created)
- `user-service/tests/concurrency/me.concurrency.test.ts` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

- Two points were raised and resolved before writing any tests (see Governing decision and Prompts above): concurrency-test placement, and skipping `TRACEABILITY.md`. Both are recorded above rather than decided unilaterally.
- No implementation code was changed to make a test pass; all tests passed against the existing Stage 11 code.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-27 — Stage 12a: GET /users/me

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md` "Stage 12: Profile Management" design-decisions table (`GET /users/me` response row) and "Stage 12a: `GET /users/me`" section (`getOwnProfile`, `getProfile`, route, Verification bullets).

**Prompts (exact):**

> read through instructions.md and the code base and understand what's going on. you will be implementing stage 12. don't do any coding first.

> you know the git workflow?

> right after the PR, pause first, let me merge the PR, then you move on to the next stage.
>
> yes, let's split by sub-stage.

**Key responses:**
Branched `feat/stage-12a-get-profile` from `main` (up to date, `instructions.md`'s Stage 12 section already committed at `c1779ee`). Implemented exactly the 12a spec:

- `me.service.ts`: `getOwnProfile(userId)` — `findById`, `404 USER_NOT_FOUND` if none, returns `{ username, email }` only (not the `toPublicUser` shape used by `changeActiveView`).
- `me.controller.ts`: `getProfile`, `asyncHandler`, no request body, calls `meService.getOwnProfile(req.user!.user_id)`, returns `200` with the object directly.
- `me.routes.ts`: `router.get('/', authenticate, meController.getProfile)`, added above the existing `active-view` route.

Verification actually run: `tsc --noEmit` for `src` and for `tests/tsconfig.json`, and `eslint .`, all clean. While verifying manually against the running container, found the container's image predated the Stage 7 fix that moved the server entry point to `server.ts` — the on-disk `package.json`/`Dockerfile` were already correct, but the image hadn't been rebuilt since, so it was running `tsx src/app.ts` (which only exports the app and never calls `.listen()`), silently exiting with code 0 on every reload. Rebuilt with `docker compose build user-service && docker compose up -d user-service`, which fixed it; not a Stage 12 code change. Root `.env` was also missing `CREDIT_DB_*`/other newer variables compose now interpolates (added from `.env.example`'s defaults, local-only, gitignored, not committed) so `docker compose` commands would run at all. Logged in as the seeded super admin and confirmed: `GET /users/me` with a valid token → `200 {"username":"superadmin","email":"superadmin@foc.com"}`, no other fields; without an `Authorization` header → `401 {"code":"UNAUTHORIZED"}`. Also noticed `POST /auth/login`'s response is missing `activeView` in this dev DB — traced to the same known gap already logged in Stage 11 (`active_view` column never migrated into the persistent dev volume, since `init.sql` only runs on a fresh one); unrelated to Stage 12a and not changed here.

**Files:**

- `user-service/src/services/me.service.ts` (modified)
- `user-service/src/controllers/me.controller.ts` (modified)
- `user-service/src/routes/me.routes.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None — the 12a spec was unambiguous. The stale-container and missing dev-DB-column issues above are pre-existing environment gaps, not spec deviations.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-27 — Stage 12b: Change Username

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md` "Stage 12: Profile Management" design-decisions table (username-change rows) and "Stage 12b: Change Username" section (`updateUsername`, `changeUsername`, controller, route, Verification bullets).

**Prompts (exact):**

> go ahead

**Key responses:**
Branched `feat/stage-12b-change-username` from `main` (up to date, Stage 12a merged). Implemented exactly the 12b spec:

- `users.queries.ts`: `updateUsername(userId, username, db)` — `UPDATE ... SET username = $2, updated_at = NOW() WHERE id = $1 RETURNING *`.
- `auth.service.ts`: exported `USERNAME_REGEX`, `EMAIL_REGEX`, `PASSWORD_REGEX`, and a new `USERNAME_MESSAGE` constant (previously an inline string in `register`), so `me.service.ts` can reuse the exact registration format rule/message per the spec ("Same format rule as registration") instead of duplicating it; `register`'s behavior is unchanged, it now reads the same constant. `EMAIL_REGEX` was also exported ahead of Stage 12c, which needs it for the same reason.
- `me.service.ts`: `changeUsername(userId, newUsername)` — format check against `USERNAME_REGEX`, then inside `withTransaction`: `lockUserById` (404 if none), same-as-current check (409 `USERNAME_UNCHANGED`), `findByUsername` taken-by-another check (409 `USERNAME_TAKEN`), `updateUsername` wrapped in try/catch for Postgres `23505` mapped to the same `USERNAME_TAKEN` (covers the concurrent race), returns `{ username, email }`.
- `me.controller.ts`: `changeUsername`, `.strict()` Zod schema with `newUsername` lowercased-only (not trimmed) and this endpoint's own required/type messages ("New username is required"/"New username must be a string") — distinct from `auth.controller.ts`'s `usernameField`, which has registration's own messages; the spec calls for the same normalisation but endpoint-specific text, unlike Stage 12c's `newEmail` which the spec says to build directly from the shared `emailField`.
- `me.routes.ts`: `router.put('/username', authenticate, meController.changeUsername)`.

Verification actually run: `tsc --noEmit` for `src` and `tests/tsconfig.json`, and `eslint .`, all clean. Manually verified against the rebuilt container (still healthy from Stage 12a) with the seeded super admin and a freshly registered second user (`testuser99`): same-username → `409 USERNAME_UNCHANGED`; valid rename → `200`, confirmed via a follow-up `GET /users/me` and reverted afterward; missing field → `400` "New username is required"; wrong type → `400` "New username must be a string"; extra field → `400` "Request contains unexpected fields"; too-short and spaced usernames → `400` with the registration format message; no `Authorization` header → `401`; second account attempting the first account's username → `409 USERNAME_TAKEN`; two concurrent `PUT /users/me/username` calls from the two accounts targeting the same new, unused username → exactly one `200`, the other `409 USERNAME_TAKEN`, no `500`s (exercises the `23505` catch path).

**Files:**

- `user-service/src/db/queries/users.queries.ts` (modified)
- `user-service/src/services/auth.service.ts` (modified: exported regex/message constants, no behavior change)
- `user-service/src/services/me.service.ts` (modified)
- `user-service/src/controllers/me.controller.ts` (modified)
- `user-service/src/routes/me.routes.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None — the 12b spec was unambiguous.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-27 — Stage 12c: Change Email — Initiate

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md` "Stage 12: Profile Management" design-decisions table (email-change rows: purpose, one-step flow, old-email-authoritative-until-verified) and "Stage 12c: Change Email — Initiate" section (`initiateEmailChange`, controller, route, Verification bullets).

**Prompts (exact):**

> go for it

**Key responses:**
Branched `feat/stage-12c-change-email-initiate` from `main` (up to date, Stage 12b merged). Implemented exactly the 12c spec:

- `email.service.ts`: added a `Change Email` entry to `PURPOSE_COPY` — subject "Confirm your new FoC email address", same body shape as the other two templates.
- `me.service.ts`: `initiateEmailChange(userId, { currentPassword, newEmail })` — format check against `EMAIL_REGEX` (now exported from `auth.service.ts`, same as `USERNAME_REGEX` in Stage 12b), unlocked `findById` + `bcrypt.compare` (bcrypt is slow, verified before locking), `EMAIL_UNCHANGED`/`EMAIL_TAKEN` checks, then inside `withTransaction`: `lockUserById`, re-verify the password against the locked row, re-check `EMAIL_UNCHANGED`/`EMAIL_TAKEN` against the locked row and a fresh `findByEmail` (closes the gap between the unlocked read and the lock), then `requestOtp({ purpose: 'Change Email', newEmail }, client)` with the exact same result mapping `forgotPassword` uses (`sent` success, `throttled` → `429` cooldown/limit, `no-user`/`not-verified` handled for exhaustiveness though unreachable here); `EMAIL_SEND_FAILED` propagates as `503` automatically since `issueOtp` throws it directly.
- `auth.controller.ts`: exported the existing `emailField` (previously module-private) so `me.controller.ts` can reuse it verbatim, per the spec's "`newEmail` uses the shared `emailField`" — unlike Stage 12b's `newUsername`, which the spec gave its own distinct messages for.
- `me.controller.ts`: `changeEmail`, `.strict()` Zod schema (`currentPassword` required/string, `newEmail` = shared `emailField`), returns `200 OTP_SENT`.
- `me.routes.ts`: `router.put('/email', authenticate, meController.changeEmail)`.

Verification actually run: `tsc --noEmit` for `src` and `tests/tsconfig.json`, and `eslint .`, all clean. Manually verified against the live container with the seeded super admin: correct password + valid unused new email → `200 OTP_SENT`, confirmed a `users_otps` row with `purpose = 'Change Email'` and `new_email` set, and the OTP itself in the dev-fallback console log; wrong current password → `401 INVALID_PASSWORD`; new email same as current → `409 EMAIL_UNCHANGED`; new email already registered (`testuser99@example.com`) → `409 EMAIL_TAKEN`; immediate repeat → `429 OTP_RESEND_COOLDOWN` with a `Retry-After` header; six requests with OTP rows backdated between each (to clear the cooldown) → the sixth returned `429 OTP_RESEND_LIMIT`, "Maximum OTP resends reached. Please try again in about an hour."; malformed email → `400 VALIDATION_ERROR`; missing `currentPassword` → `400` "Current password is required"; extra field → `400` "Request contains unexpected fields"; no `Authorization` header → `401`. Did not force an SMTP failure to check `EMAIL_SEND_FAILED` → `503` directly (would need reconfiguring and restarting the container); that code path is unchanged from `forgotPassword`, which already exercises it. Test `users_otps` rows were deleted afterward and the super admin's email was confirmed unchanged.

**Files:**

- `user-service/src/services/email.service.ts` (modified)
- `user-service/src/services/me.service.ts` (modified)
- `user-service/src/controllers/auth.controller.ts` (modified: exported `emailField`, no behavior change)
- `user-service/src/controllers/me.controller.ts` (modified)
- `user-service/src/routes/me.routes.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None — the 12c spec was unambiguous.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-27 — Stage 12d: /users/me/verify-otp and /users/me/resend-otp

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md` "Stage 12: Profile Management" design-decisions table (route split for OTP endpoints, why password-change has no verify-otp entry, resending a change-email OTP) and "Stage 12d" section (`updateEmail`, `verifyEmailChangeOtp`, `resendChangeEmailOtp`, `resendChangePasswordOtp`, controllers, routes, Verification bullets).

**Prompts (exact):**

> go

**Key responses:**
Branched `feat/stage-12d-me-otp-routes` from `main` (up to date, Stage 12c merged; also picked up an unrelated order-service change from a teammate's earlier merge). Implemented exactly the 12d spec:

- `users.queries.ts`: `updateEmail(userId, email, db)` — `UPDATE ... SET email = $2, updated_at = NOW() WHERE id = $1 RETURNING *`.
- `me.service.ts`: `verifyEmailChangeOtp(userId, otp)` — locks the user row, reads the pending `Change Email` OTP row for its `new_email`, calls the existing `checkOtp` (default consuming), and on a correct guess calls `updateEmail` wrapped in try/catch for Postgres `23505` mapped to `409 EMAIL_TAKEN` — per the spec, that throw propagates out of `withTransaction` and rolls back the whole transaction including the OTP consumption, so the OTP stays usable for a different email (verified manually, see below). `resendChangeEmailOtp` and `resendChangePasswordOtp` each lock the user, require an unconsumed pending OTP row for their purpose (else `400 NO_PENDING_EMAIL_CHANGE`/`NO_PENDING_PASSWORD_CHANGE`), then call `requestOtp` with the same cooldown/limit/sent mapping as Stage 12c. Factored that mapping (previously inlined once in `initiateEmailChange`) into a shared `throwOnUnsentOtp` helper now used by all three call sites, since Stage 12d needed the identical block twice more — a same-file DRY refactor, no behavior change, covered by the same manual re-verification of Stage 12c's cases below.
- `me.controller.ts`: `verifyOtp` — `.strict()` Zod schema, `purpose` enum `['change_email']` only ("Invalid purpose" otherwise per the spec), returns `200 EMAIL_CHANGE_SUCCESS`. `resendOtp` — `purpose` enum `['change_email', 'change_password']`, dispatches to the matching service function, returns `200 OTP_SENT`. Both read the user id only from `req.user.user_id`; neither schema accepts an `email` field. A local `mePurposeErrorMap`/schema pair, kept separate from `auth.controller.ts`'s public `/auth/verify-otp`/`/auth/resend-otp` purpose sets, per the spec's explicit "the two purpose sets stay separate."
- `me.routes.ts`: `router.post('/verify-otp', authenticate, meController.verifyOtp)` and `router.post('/resend-otp', authenticate, meController.resendOtp)`.

Verification actually run: `tsc --noEmit` for `src` and `tests/tsconfig.json`, and `eslint .`, all clean. Manually verified against the live container with the seeded super admin (and, for the race case, a second freshly-registered account): full initiate → verify happy path (`200 EMAIL_CHANGE_SUCCESS`, email updated, reverted afterward); wrong purpose on `/users/me/verify-otp` → `400` "Invalid purpose"; wrong OTP → `400 INVALID_OTP`; 5 wrong attempts then a 6th → `429 OTP_ATTEMPTS_EXCEEDED`, email unchanged; OTP with `expires_at` backdated → `400 OTP_EXPIRED`; resend for `change_email` → `200 OTP_SENT`, confirmed in the DB that the new row carries the same `new_email` and the old row's `consumed_at` is now set; resend with no pending change, for both `change_email` and `change_password` → `400 NO_PENDING_EMAIL_CHANGE`/`NO_PENDING_PASSWORD_CHANGE`; both routes with no `Authorization` header → `401`; the public `/auth/verify-otp` and `/auth/resend-otp` both still reject `change_email`/`change_password` as an invalid purpose, confirming the two purpose sets stayed separate; and the specified race — registered a second account that took superadmin's pending `new_email` first, then superadmin submitted the correct OTP → `409 EMAIL_TAKEN`, and a DB check confirmed the OTP row's `consumed_at` was still null (the transaction rollback restored it) and superadmin's email was unchanged. Testing needed the DB cooldown/created_at backdated a few times (the same OTP-resend cooldown from Stage 12c applies to every initiate/resend on this purpose) — noted here since it is not itself a Stage 12d behavior, just a side effect of reusing the same superadmin account across sub-stage testing. Test OTP rows and the decoy registered account were left in the dev DB afterward, matching how earlier stages left their test accounts (`testuser99`, etc.) in place.

**Files:**

- `user-service/src/db/queries/users.queries.ts` (modified)
- `user-service/src/services/me.service.ts` (modified)
- `user-service/src/controllers/me.controller.ts` (modified)
- `user-service/src/routes/me.routes.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None — the 12d spec was unambiguous.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-27 — Stage 12e: Change Password — Initiate + Confirm

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md` "Stage 12: Profile Management" design-decisions table (password-change flow: two calls, nothing pending stored server-side; new-password validation; password re-entry check pattern; successful-change side effect) and "Stage 12e: Change Password — Initiate + Confirm" section (`initiatePasswordChange`, `confirmPasswordChange`, controllers, routes, Verification bullets). This completes Stage 12.

**Prompts (exact):**

> let's go with e

**Key responses:**
Branched `feat/stage-12e-change-password` from `main` (up to date, Stage 12d merged). Implemented exactly the 12e spec:

- `auth.service.ts`: exported the existing `OTP_REGEX` (previously module-private), alongside the already-exported `PASSWORD_REGEX`/`PASSWORD_MESSAGE`, for reuse in `me.service.ts` — no behavior change.
- `me.service.ts`: `initiatePasswordChange(userId, { currentPassword, newPassword })` — `newPassword` complexity check, unlocked `findById` + `bcrypt.compare` for the current password (bcrypt is slow, verified before locking) and for same-as-current (`400 PASSWORD_UNCHANGED`), then inside `withTransaction`: `lockUserById`, re-verify the current password against the locked row, `requestOtp({ purpose: 'Change Password' }, client)` using the same `throwOnUnsentOtp` helper Stage 12d factored out. `newPassword` is validated but never persisted here, exactly as the spec states. `confirmPasswordChange(userId, { otp, newPassword })` — `newPassword` complexity and `OTP_REGEX` format checks, then inside `withTransaction`: `lockUserById`, re-check same-as-current against the freshly locked row (spec: "in case the password changed between initiate and confirm"), `checkOtp` (default consuming), and on `{ ok: true }` hashes the new password, `updatePasswordHash`, and `revokeAllRefreshTokensForUser` in the same transaction; on `{ ok: false }`, throws `400 INVALID_OTP` after the transaction commits (same pattern as `resetPassword` in `auth.service.ts`, so the incremented attempt count persists).
- `me.controller.ts`: `changePassword` (`PUT /users/me/password`) and `confirmPasswordChange` (`POST /users/me/confirm-password-change`), both `.strict()` Zod schemas with required/string messages matching `resetPasswordSchema`'s style (`currentPassword` follows the "Current password is required" style Stage 12c introduced). Returns match the spec's exact message/code pairs.
- `me.routes.ts`: `router.put('/password', authenticate, meController.changePassword)` and `router.post('/confirm-password-change', authenticate, meController.confirmPasswordChange)`.

Verification actually run: `tsc --noEmit` for `src` and `tests/tsconfig.json`, and `eslint .`, all clean. Manually verified end-to-end against the live container using a freshly registered test account (`pwtest1`, not the seeded super admin, to avoid any risk to the shared dev credentials): wrong current password at initiate → `401 INVALID_PASSWORD`; same-as-current `newPassword` at initiate → `400 PASSWORD_UNCHANGED`; weak `newPassword` at either step → `400 VALIDATION_ERROR`; happy path → `200 OTP_SENT` then `200 PASSWORD_CHANGE_SUCCESS`; login with the new password → `200`, with the old password → `401 INVALID_CREDENTIALS`; confirmed in the DB that the pre-change refresh tokens were revoked while a token issued by the post-change login stayed valid; wrong OTP → `400 INVALID_OTP`; 5 wrong attempts then a 6th → `429 OTP_ATTEMPTS_EXCEEDED`, password unchanged; OTP with `expires_at` backdated → `400 OTP_EXPIRED`; re-submitting an already-consumed OTP with a fresh `newPassword` (to isolate it from the `PASSWORD_UNCHANGED` check) → `400 INVALID_OTP`; confirming with a different `newPassword` than what was sent to initiate → succeeded with the confirm-step value, login with it worked, confirming initiate's validation is advisory only, per the spec's explicit note that this is intended; no `Authorization` header on either route → `401`; two concurrent `confirm-password-change` calls with the same correct OTP → exactly one `200`, the other `400`, password changed exactly once, no `500`s — run twice: with an identical `newPassword` in both requests, the loser got `400 PASSWORD_UNCHANGED` (its own pre-lock validation ran against the row after the winner's commit already matched it) rather than the `INVALID_OTP` the Verification bullet's wording assumes; with two different `newPassword` values, the loser did get `400 INVALID_OTP` as literally stated. Both are correct, non-`500`, exactly-once-success outcomes and a direct, spec-ordered consequence (the same-as-current check runs before `checkOtp`), not a bug — noted here rather than treated as a deviation.

**Files:**

- `user-service/src/services/auth.service.ts` (modified: exported `OTP_REGEX`, no behavior change)
- `user-service/src/services/me.service.ts` (modified)
- `user-service/src/controllers/me.controller.ts` (modified)
- `user-service/src/routes/me.routes.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None as spec ambiguities — see the concurrency observation above (informational, not a deviation).

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-09-25 — Supplier Service: Architecture Document

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied Supplier Service architecture and database plans in the task prompt; supplier requirements in `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**

> Requirement Context:
>
> ```markdown
> Part 2: Supplier Service
> Your task is to implement the Supplier Service backend, together with a responsive UI. The
> UI should consume the Supplier Service’s APIs to perform CRUD operations.
> Points 1-5 are the expectations for a near-complete supplier service.
> Points 1-4 are the expectations for significant progress on the supplier service.
>
> 1. Database Choice and Schema Design
>    • Which database technology have you selected?
>    • Justify your choice with reasoning specific to FoC's design. Consider the
>    nature of the data—for example, whether it is structured or contains flexible
>    content—as well as the expected query patterns and scalability requirements.
>    • Present a concrete schema. Specify the tables, collections or documents; the
>    fields they contain; and the relationships among them.
>    • Identify the metadata required for each supplier, such as its name, type and
>    location, and explain how this metadata is stored and queried.
> 2. Query Patterns & API Design
>    • Identify the key ways in which the Supplier Service will be queried, such as
>    retrieving a supplier by ID or finding suppliers by location.
>    • Define the API endpoints that expose these operations. Demonstrate the key
>    query patterns using working API calls.
>    • Explain how Supplier Service API endpoints use identity and role information
>    from the User Service to enforce access control and respond to denied
>    requests.
> 3. CRUD operations in the Backend
>    • Demonstrate a running Supplier Service connected to a database, with
>    working APIs that support CRUD operations on supplier data.
>    • The Supplier Service is an independent backend service. Its functionality must
>    be exposed through its APIs and should not depend on the UI.
>    • Demonstrate that the Supplier Service can be used and tested through its APIs
>    without the UI being present or running.
> 4. End-to-End Integration
>    • Demonstrate the complete flow from an authenticated user, through the
>    Supplier Service API, to the database.
>    • Show that users with different roles receive the appropriate API access.
>    • Focus the demonstration on the complete supplier-management experience
>    for all relevant users, including administrators where applicable.
> 5. Responsive Supplier Management UI
>    • Demonstrate the complete supplier management UI.
>    • Show the UI adapting appropriately across desktop- and mobile-sized
>    viewports.
>    • Include workflows such as:
>    • Creating, editing, and deleting suppliers
>    • Viewing supplier records
>    • Searching for suppliers
>    • Filtering and sorting results
>    • Paginating through supplier data
>    • Viewing supplier details
>    • Demonstrate integration with the Supplier Service by retrieving and modifying
>    supplier data through its APIs. The UI must use live data from the service and
>    must not rely on mock or hard-coded supplier data.
>    • Note: The demonstration should not be limited to administrator-only
>    screens.
> ```
>
> Craft an ServiceArchitecture.md document according to my specified plans. Use mermaid for any diagrams, and record my design considerations at appropriate sections:
>
> - Tiered architecture for presentation, business, persistence and database layers: such a breakdown allows for good separation of concerns across the different layers, each with their own set of responsibilities. This allows for reduced coupling and flexibility in switching out the layers/scaling, better maintainability [as a result of the concern separation], enhanced database security [due to strict interface access via the persistence layer], and the potential ability for the different tiers to be developed in parallel [although in this case I am developing this entire service myself]
> - The presentation layer in particular utilise an MVC model: this is again applying the principles of concern separation, with the frontend being solely reliant on the View, which communicates with the controller and the model. To acoomdate an SPA approach, implementation will be in the form of a WebMVC, where the View is handled client-side, usint HTTP calls to communicate with the controller which bridges the connection between server's model and the View.
> - The business layer will handle the core logic, functions, workflows
> - The persistence layer acts the abstraction between the database and the business layer
> - The database layer will utilise a relational database as the fields as defined in our project is fixed and highly structured so there is little benefit to employing a NoSQL solution. In particular, given that data related to suppliers are rarely changed and mostly read, a very lightweight solution [MySQL] will be preferred over a more robust solution that can handle complex query support [PostgreSQL]
>
> Database Schema:
>
> fields should contain supplier_name, supplier_type ["Store" vs "Facility"], supplier_category [can contain multiple of "Food", "Drinks", "Snacks", "Printing", etc.], supplier_location, supplier_faculty [subcategory of location], supplier_hours [always 24h for "Facility", and customisable for "Store"] and supplier_desc. This means separate tables for supplier, supplier_locations, supplier_categories, a junction table mapping supplier to supplier categories, supplier_hours, and supplier_photos [links to dedicated storage location]
>
> The main API interfaces for accessing supplier data, based on the backlog, will contain:
>
> - Querying truncated supplier information for display on user-facing dashboard [all fields except for desc and full opening hours. filter and search will be client-side]
> - Querying detailed information for a specific supplier [including opening hours and desc for the expanded detail page]
> - Creation of a supplier
> - Editing a supplier
> - Deleting a supplier
> - Querying truncated supplier information for display on admin dashboard [all fields except for desc and full opening hours, with additional fields like creation\_date, created\_by etc]
> - Querying full supplier information for display on admin dashboard
>
> Critique and comment on any gaps based on the requirement context and design feasibility. Due to course policy, you need not offer details on what to change to. Just the critique, gaps, and comments so so i can do further researchmyself

**Key responses:**
Created `supplier-service/ServiceArchitecture.md` containing the supplied tiered architecture, WebMVC presentation model, MySQL rationale, supplier entity/table plan, logical API operation inventory, Mermaid diagrams, and factual traceability notes. Concrete route names and unspecified schema/API choices were intentionally not invented. The architecture/design critique was limited to factual gaps because the repository policy prohibits the agent from making architecture/design decisions or drafting trade-off analyses.

**Files:**

- `supplier-service/ServiceArchitecture.md` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The plan does not specify concrete endpoint contracts, full SQL field definitions, authorization details, deletion semantics, or the service interactions associated with soft deletion; these are recorded as unresolved observations in the document.

**What I kept/changed/rejected:**
I kept all changes

**Author review: Congchen**
Additions were all based on content I provided. Reviewed.

## 2026-10-16 — Frontend: order-service request board

**Tool:** Copilot SDK (model: unspecified by runtime)
**Mode:** generate | refactor
**Scope:** Implementation code | Refactor/Docs
**Governing decision:** Existing order-service `GET /orders` contract in `order-service/src/routes/orders.routes.ts` and `order-service/src/controllers/orders.controller.ts`

**Prompts (exact):**

> can u help me implement the frontend for getting the orders from order-service instead of the way it is rn?

**Key responses:**

Replaced the RequestBoard's demo request source with the order-service list endpoint, added the frontend API client and development proxy target, and kept the existing card layout compatible with order-service records when supplier/requester records are not joined. Added loading, error, retry, and logged-out states through the existing API notice pattern. Verification: `npm run build` passed; `npm run lint` passed with pre-existing warnings; `git diff --check` passed.

**Files:**

- `frontend/src/api/orders.js` (created)
- `frontend/src/pages/RequestBoard.jsx` (modified)
- `frontend/src/components/RequestCard.jsx` (modified)
- `frontend/vite.config.js` (modified)
- `compose.dev.yaml` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:** None

**What I kept/changed/rejected:**
I accepted all changes.

**Author review:**
tng wen xi

## 2026-09-26 — Supplier Service: Photo Management and Concrete Schema

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Implementation code | Refactor/Docs
**Governing decision:** User-supplied photo-management, authentication, service-entrypoint, normalized location/faculty/level, and server-managed-field decisions in the follow-up prompt; `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**

> Photo amangement:
>
> - uploaded photos are part of the form data payload, sent alongside the request parameters in the create and edit flow for admins
> - a dedicated junction table will be used to map supplier_id to one or multiple photoids
> - images are rendered directly on the websites, sent alongside the dashboard and detail API calls
> - general accepted formats are jpeg and png, at 5mb per image and max of 10 images
> - utilise saga pattern: if file upload fails, backend save aborts and do not commit any changes the database, reporting 500 Error. if storage succeeds but if db fails, execute a cleanup of the uploaded picture(s) before returning a 500
> - photo storage will be gated behind its own authentication, and updates are only made by the admins through their authenticated sessions
> - deletion behavior and availability are up to the storage provider. Out of the service architecture
>
> other blockers:
>
> - we are operating with the assumptions that each service will provide the necessary entrypoints. This entire project is a microservices architecture mocked thought different subfolders afterall. likewise message-service is just for the future. We can asssume that order-service can take in a order-delete call, and message service can take in some sendMsg call
> - the authentication will be offloaded to google oauth following their conventions
> - location maps to location table and unique location_ids. new faculty table with faculty_ids. level is just a numerical field
> - server-managed fields are not included in the create/update bodies
>
> Based on what i have provided, generate the database schema for the various tables as well

**Key responses:**
Updated `supplier-service/SupplierServiceArchitecture.md` with multipart photo uploads, photo junction mapping, photo response references, JPEG/PNG and size/count constraints, Google OAuth ownership, assumed Order/Message Service entrypoints, normalized faculties and locations, server-managed write fields, a compensating photo-upload saga, and concrete MySQL `CREATE TABLE` definitions for supplier, locations, faculties, categories, junction tables, hours, photos, and photo mappings.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The photo provider remains intentionally undecided. Provider-specific deletion and availability behavior remains outside the Supplier Service architecture, while the service-level upload, authentication, mapping, and compensation behavior is documented.

**What I kept/changed/rejected:**
I kept all changes

**Author review: Congchen**
Additions were all based on content I provided. Reviewed.

## 2026-09-26 — Supplier Service: Traceability Gap Resolution

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied answers to the Supplier Service traceability notes in the follow-up prompt; `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**

> Fill in the gaps raised in the "Requirement traceability notes and unresolved items" section. Some of my answers:
>
> 1. I already provided all the fields and structure for the request and response envelops. Generate the structure and fill in
> 2. 50 is a fixed value for this project, based on project backlog
> 3. search just takes in text and do a simple case-insensitive string matching with supplier name/location/icategory. Remove sortBy for now as we only allow alphbet. sortOrder is just A-Z/Z-A for now.
> 4. offloaded to auth provider
> 5. use createdOn and createdBy instead
> 6. ignore the extra isOpen
> 7. users will not see suppliers that are soft-deleted or non-active. admins will still be able to see everything
> 8. elaborate
> 9. i already lited them clearly. make necessary inferences. This is unrelated to architecture design decision
> 10. what hours UUID?
> 11. 24h represented as 00:00 opening with 23:59 as closing
> 12. is_open will be calculated from the current time and cross-comparing with the opening hours
> 13. will populate in mock database
> 14. suggest
> 15. suggest
> 16. suggest

**Key responses:**
Updated `supplier-service/ServiceArchitecture.md` to fill the supplied traceability answers: fixed 50-entry pagination, case-insensitive search across name/location/category, alphabetical `A-Z`/`Z-A` sorting without `sortBy`, authentication-provider ownership, `createdOn`/`createdBy`, visibility rules, derived `is_open`, 24-hour hours representation, mock-data reference values, request/response envelopes, and route-level API examples. Remaining photo-storage and detailed UI-state choices are still identified as team-owned decisions rather than selected by the agent.

**Files:**

- `supplier-service/ServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The document does not recommend a photo-storage system or prescribe detailed responsive UI states, authentication-expiry behavior, or downstream failure semantics; these remain explicitly recorded for team decision.

**What I kept/changed/rejected:**
I kept all changes

**Author review: Congchen**
Additions were all based on content I provided. Reviewed.

## 2026-09-25 — Supplier Service: Contract and Schema Clarifications

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied Supplier Service endpoint, status-code, pagination, authentication, role, soft-delete, and table-field decisions in the follow-up prompt; `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**

> On the factual observations. Update the document based on these, and point out any other gaps:
>
> 1. API status codes: 200 OK, 201 Created, 400 Bad Request, 403 Forbidden, 422 Unprocessable Entity, 404 Not Found. Enpoints:
>    1. user dashboard: /api/suppliers. request:GET, params=page, limit, search, location_id, category_id, sortBy, sortOrder. Response: metadata=totalRecords, currPage, limit, totalPages, data=id, name, type, location, faculty, level, categories, isopen
>    2. admin dashboard: /api/admin/suppliers. same as 1, with more data in response: isActive, isDeleted, isOpen
>    3. user detailed view: /api/suppliers/:id. same as 1, but now with more data in response: desc, openingHours
>    4. admin detailed view: api/admin/suppliers/:id, same as 3, but also contain createdOn and createdBy in the response
>    5. admin create: /api/admin/suppliers. request:POST, params=all in 4
>    6. admin edit: /api/admin/suppliers/:id. request: PUT, params=whatever updated field from the whole list in 5
>    7. admin delete: /api/admin/suppliers/:id. request: DELETE
> 2. Update the document to show that API requests for querying data takes in filter, sort and search parameters which will be used to query for 50 entries at a time
> 3. clarify supplifier deletion is a soft delete from updating a new is_deleted field in supplier
> 4. add these fields into the supplier data model: is_active (whether the result is shown), is_deleted (from 3.), is_open, creation_date and creator
> 5. update to include that in case of soft deletion, past records and requests already picked up will be kept the same. For requests not yet collected, the supplier service will interact with the order service's delete API to delete the request. It will also interact with the message service's messaging API to send a msg to the request poster
> 6. The UI interface is locked behind authentication, and a JWT will be used to verify the identity and authenticate users. There will be 3 user roles - super admin, admin and user. The roles accepted by each operation is as specified in the API operation inventory section
> 7. For location table, it will consisit of an autoincrement location_id, (text) location, (text) faculty, (text) level. For hours table, it will include some autoincrement UUID, supplier_id, day_of_week (represented by int 0-6), open_time (time), close_time (time). For category table, it will consist of an autoincrement category_id and (text) category_type. The junction table contains the supplier_id and category_id, with both forming a composite key. The photo table contains an autoincremend photo_id, (text) photo_lcoation.
> 8. is considered in 7
> 9. for 24h availability, the open_time and close_time are just both set to 00:00 (or time field equivalent)
> 10. all components will be dynamic to cater to different viewports.

**Key responses:**
Updated `supplier-service/ServiceArchitecture.md` with the supplied endpoint paths, HTTP methods, query parameters, response fields, status-code set, 50-entry query behavior, authenticated JWT role model, soft-delete field and workflow, downstream Order/Message Service interactions, concrete table fields, and dynamic viewport behavior. Added further factual gap notes for unresolved contract, identifier, query, authorization, integration, and UI details.

**Files:**

- `supplier-service/ServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The prompt did not fully specify JWT claims, the meaning of `limit` relative to 50 entries, exact response/error envelopes, or downstream failure semantics. These remain recorded as factual gaps rather than being selected by the agent.

**What I kept/changed/rejected:**
I kept all changes

**Author review: Congchen**
Additions were all based on content I provided. Reviewed.

## 2026-09-27 — Supplier Service: Provider-Agnostic Photos and Auth Contract

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied Supplier Service photo-provider, photo-edit, authentication, downstream-mock, lookup-payload, and schema decisions in the follow-up prompt; repository User Service authentication contract.

**Prompts (exact):**

> - photo provide selection is still pending team selection of cloud deployement provider. It is either AWS with S3, or Google Developer Cloud with Google Cloud storage to reduce latency and configuration. The supplier service should expose a provider-agnositic interface to allow for easy swapping instead of coupling to a specific one we choose
> - photo edit semantics:
>   - for edits to the photo (add/replace/delete/reorder), a dedicated boolean variable "isPhotoDirty" will be added to supplier edit payload so the backend knows the need to process them. Alongside that, an ordered array of photo_ids will be sent to inform the backend of the new ordering/remaining photos. if new photos are uploaded too, the multipart form data will contain the binary and placeholder_ids if the new photos. The backend logic will check through the ordering, and 1. delete photos associated with excluded ids from cloud storage and mysql backend, 2. upload new photos(if any) to cloud storage, append to mysql database, 3. reorder mysql's stored display order
>   - to accomodate this, supplier table will get additioal datetime "updatedOn" field. As the relation between supplier and photos is 1:n, we can forgo the supplier_photo_map junction table and have the supplier_photos table store additional "supplier_id" and int "display_order"
> - OAuth will just be a type of authentication. Read the project main's user-service for details on the authentication and role configurations
> - downstream call contracts will be mocked until the actual API request structure are confirmed
> - what do you mean by fixing the encoding? opening hours will just be a list like [{"day": 1, "open": "09:00", "close": "17:00"}, {"day": 2, "open": "09:00", "close": "17:00"}...], category_id will just be a list [1,2,3], populated based on the user selection's mapped IDs (this means the a new API entrypoint for adding suppliers, where the text descriptions and ids of supplier_locations and supplier_categories will be sent to the FE to provide selection options. Photos will be standard form-data type photo, sent as binary data

**Key responses:**
Updated `supplier-service/SupplierServiceArchitecture.md` to align authentication with the repository User Service's RS256 JWT and `/auth/verify` contract; document the provider-agnostic AWS S3/Google Cloud Storage boundary; replace the photo junction table with direct one-to-many photo rows; record `updatedOn`, `isPhotoDirty`, ordered `photo_ids`, `placeholder_ids`, binary multipart examples, lookup metadata, and the remaining photo and API-contract gaps.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The concrete photo-storage provider and lookup endpoint path remain team decisions. The document also records unresolved external-day numbering and recovery semantics for edits that delete existing photos before a later persistence failure.

**What I kept/changed/rejected:**
I kept all changes

**Author review: Congchen**
Additions were all based on content I provided. Reviewed.

## 2026-09-27 — Supplier Service: Reference APIs and Photo Consistency Rules

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied Supplier Service reference-endpoint, error-envelope, query, opening-hours, and photo-consistency decisions in the follow-up prompt.

**Prompts (exact):**

> 1. endpoint for lookup options: a GET /api/suppliers/reference/location with the payload for locations:[{location\_id:.., location:..., faculty\_id:..., faculty:...},{}...], and a GET /api/suppliers/reference/categories categories:[{category\_id:..., category:...},{}...]. Category and location are separated on purpose as there may be a lot more locations than categories, so this would allow us to request for them separately. While the add supplier interface will always call both, but the user-oriented filtering might only require access to either of them, so respecting the concept of lazt loading, these api calls will be kept apart
> 2. All error response envelops will follow a fixed format with the status_code, error, message, timestamp and details (the exact fields, locations of the error). The status codes are listed in 7.1
> 3. for limit, 50 is fixed; for sort values are only order by A-Z/Z-A, these are not user-modifiable. For filtering, the options will be loaded from the options retrieved via the api lookup for location and categories. There is no risk of invalid fields
> 4. no. I was just giving example as a store may only only on some days of the week. The database day_of_week still maps days to 0-6, with 0 being sunday
> 5. time-zone will be fixed to singapore's UTC+8 timezone. this will be clearly recorded. overnight opening hours are just when the opening time is later (e.g., 2100) than the closing time (e.g., 0300). server calculated isOpen must accomodate this
> 6. in the photo deletion flow, cloud object deletion will be last after ensuring mysql updates (edits, deletions) are complete to reduce operational
> 7. placeholder_ids are generated randomly for each uploaded photo (binary file). the backend will process the ordering of images sent over by resolving their index positions. The association does not matter as long it is one-to-one. the backend will replace the placeholder_ids. its only purpose is to keep a reference to the new images

**Key responses:**
Updated `supplier-service/SupplierServiceArchitecture.md` with separate lazy-loaded location and category reference endpoints, the fixed error envelope, fixed 50-entry pagination and sort/filter semantics, Singapore time and overnight-hour rules, placeholder-ID resolution, and MySQL-first photo edits followed by cloud-object deletion. Remaining gaps are limited to endpoint-specific status-code mapping, post-commit cloud-deletion failure handling, downstream contract confirmation, provider selection, and live API evidence.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The prompt ended mid-sentence for the operational rationale in item 6; the documented behavior records the explicit ordering decision without adding a rationale.

**What I kept/changed/rejected:**
I kept all changes

**Author review: Congchen**
Additions were all based on content I provided. Reviewed.

## 2026-09-27 — Supplier Service: Redis Worker and Status Mapping Template

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied reference-endpoint role, status-code template, Redis job-queue, retry, and downstream workflow decisions in the follow-up prompt.

**Prompts (exact):**

> 1. the 2 new reference endpoints will be open to all roles
> 2. generate the appropriate template with the various conditions and literal status-code-meaning mappings for me to fill in the gaps
> 3. ill introduce a background worker with a job queue stored in redis, not just to ensure failed cloud deletions are retried, but also to support other features like the supplier suspension -> cancelling orders -> informing users flow, and in general allow for more robust handling of failures

**Key responses:**
Updated `supplier-service/SupplierServiceArchitecture.md` to make both reference endpoints available to `user`, `admin`, and `super admin`; added a fill-in status-code mapping template; and documented the Redis-backed background worker for post-commit photo deletion retries and queued supplier-suspension workflows involving Order and Message Services. Remaining queue failure, job contract, and downstream mapping details remain explicitly open.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The status-code template leaves project-specific endpoint mappings and queue failure behavior for the team to complete; no new mapping or retry policy was selected by the agent.

**What I kept/changed/rejected:**
I kept all changes

**Author review: Congchen**
Additions were all based on content I provided. Reviewed.

## 2026-09-27 — Supplier Service: Completeness Review and Team-Supplied Clarifications

**Tool:** Claude Code (claude-sonnet-5)
**Mode:** generate | refactor | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied concurrency, uniqueness, timezone, role, API-management, idempotency, rate-limit, versioning, and deployment decisions given directly in chat; `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**

> Review the architecture design in SupplierServiceArchitecture.md for issues

> I fixed the consistency issues 1-5. I want a review on the entire design's completeness before moving to spec

> fold into the document at appropriate locations:
> data model
>
> - concurrent edits: add an additional version col for supplier tables. All updates will include an incremented version number, so in the case of concurrent edits, the first to execute will update the records, and the later ones will not be able to find the record to update with the old version number, allowing a Concurrent Edit error to be raised (409 Conflict)
> - for supplier hours, day of week should be unique for a supplier (no multiple hours in a single day), and display_order for supplier_photos should be unique as well (photos of the same supplier cannot share the same order)
> - Exclusion of supplier_desc from search is intentional as desc will not be displayed
> - All timezones are in SGT (UTC +8)
>
> API/auth
>
> - currently super_admin and admin do not defer in capabilities. super_admin comes with additional admin management which is not part of this service.
> - following the exact same format as the read endpoints, add management endpoints for faculties, supplier_categories and supplier_locations to allow admin UI CRUD
> - PUT and DELETE are idempotent by design. There will be no issue with multiple calls. Multiple PUT leads to the same addition, and multiple DELETEs just lead to 404s after a successful execution. For POST, apply the idempotency key pattern where the client generates a UUID "idempotency key" and attach it to the request header. This key and response will be cached in redis so that subsequent retries will be flagged with 409 Conflict, or to directly return the completed response if avialbale.
> - photo_location urls will be short-lived signed URLs provided by the cloud storage
>
> Others
>
> - Introduce rate limit of 30requests/min/ip
> - Same origin will be used
> - Apply versioning /v1 to all API endpoints
> - defer health-check endpoints for now
>
> Are these clarifications sufficient to spec the supplier service

**Key responses:**
First reviewed `supplier-service/SupplierServiceArchitecture.md` for internal consistency and found five factual bugs: a duplicate blank `401 Unauthorized` row, an ER-diagram cardinality mismatch between `SUPPLIER` and `SUPPLIER_LOCATIONS`, `super admin` vs `super_admin` spelling inconsistency, a `level` field typed as numeric in the schema but stringified in JSON examples, and mixed snake_case/camelCase audit-timestamp naming — reported these without editing (the user then fixed them independently). After the user's fixes were confirmed, ran a completeness review surfacing gaps not yet covered by the document (optimistic concurrency, hours/photo uniqueness, role differentiation, lookup-table CRUD, idempotency, signed photo URLs, rate limiting, CORS/versioning/health-check policy) and reported them as open questions rather than deciding them. The user then supplied concrete answers/decisions for each; folded these verbatim decisions into the document: added `supplier.version` (optimistic concurrency, `409 Conflict` on stale edit) to the schema, table description, ERD, and DDL; added `UNIQUE` constraints on `supplier_hours(supplier_id, day_of_week)` and `supplier_photos(supplier_id, display_order)`; recorded the SGT-only timestamp policy and the intentional `supplier_desc` search exclusion; noted `admin`/`super_admin` capability parity; added CRUD management endpoints for `faculties`, `supplier_locations`, and `supplier_categories` mirroring the existing reference-endpoint format; added a new §7.5 documenting `PUT`/`DELETE` idempotency, the `POST` idempotency-key/Redis-cache pattern, and the 30 req/min/IP rate limit; recorded signed-URL photo references; added the same-origin/no-CORS note; applied `/api/v1` versioning across every endpoint path in the document; and noted the deferred health-check scope. Added new `409`/`429` rows to the status-code table and mapping template, and appended items 11–16 to the traceability section summarizing what is now resolved. Answered the final question in chat (not logged here) rather than in the document, since it was a question about the document, not new document content.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The `POST` idempotency-key header's exact name (`Idempotency-Key` was used as a placeholder pending team confirmation) and the signed photo URL's expiry duration were not specified in the prompt and remain open. No other decisions were made by the agent beyond what was explicitly supplied.

**What I kept/changed/rejected:**
I kept all changes

**Author review: Congchen**
Additions were all based on content I provided. Reviewed.

## 2026-09-27 — Supplier Service: Async Response Timing, Redis Job Contract, and Dead-Letter Table

**Tool:** Claude Code (claude-sonnet-5)
**Mode:** generate | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied response-timing, Redis job payload/retry, dead-letter-table, idempotency-header, signed-URL-duration, and downstream-deferral decisions given directly in chat.

**Prompts (exact):**

> remaining open questions:
>
> - client gets immediate response as soon as the job is enqueued
> - redis job contract: payload is generic with an id, a task name, payload with the information to be sent (for photo delete, it will contain the photo_id, for instance). This can be derived directly from the database schema already decided upon. retries will be on exponential backoff with maximum 5 retries. if the job still fails after retries are used up, a record will be added to a new table in the database for dead-letter-jobs. It will include: autoincrement id, job_id (of the failed redis task), task_name, payload (used by the redis worker), error_trace (error message from last retry), failed_at (time of last retry failure), status (defaulted as "UNRESOLVED"). This table offers visibility too
> - just use "Idempotency-Key" as the header name, unless there are conventions. signed photoURL duration is 24h for now
> - continue deferring the downstream contracts till they are built

**Key responses:**
Folded the supplied answers into `supplier-service/SupplierServiceArchitecture.md`: recorded that the API returns its response immediately once the relevant database write and Redis enqueue succeed, without waiting for the background worker, in both the soft-delete workflow (§8.1) and the photo-deletion workflow (§8.2), updating both sequence diagrams accordingly; added the `dead_letter_jobs` table (autoincrement `id`, `job_id`, `task_name`, `payload`, `error_trace`, `failed_at`, `status` defaulted to `UNRESOLVED`) to the data model table (§6.2) and MySQL DDL (§6.4); documented the generic `{id, task_name, payload}` Redis job shape and the exponential-backoff/5-attempt retry policy with dead-letter fallback in §8.1/§8.2; finalized the `Idempotency-Key` header name (removed the earlier "to be confirmed" hedge) in §7.5; set the signed photo URL duration to 24 hours in §6.3/§8.2; and updated §9 items 5, 8, 14, and 16, and added a new item 17, to reflect that these are resolved while the Order/Message Service request contracts remain an explicit, continued deferral.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None — all previously open items from this line of questioning are now resolved or explicitly marked as an intentional, continued deferral (Order/Message Service contracts) rather than a gap.

**What I kept/changed/rejected:**
I kept all changes

**Author review: Congchen**
Additions were all based on content I provided. Reviewed.

## 2026-09-27 — Supplier Service: Phased Implementation Spec

**Tool:** Claude Code (claude-sonnet-5)
**Mode:** generate | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** `supplier-service/SupplierServiceArchitecture.md` (already team-reviewed and committed) and the existing Supplier Service GitHub issues (#40–#46, #60, #61) in `AY2627S1-CS3219-P18/FoC`, tracing back to `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**

> i've commited the docs. Start specing out the supplier service. Given this is a large service, the specs may be broken up into different phases. The product backlog's supplier service features are associated with open issues within github, so they should be used to guide the sectioning of tasks where appropriate (especially after the foundations are laid out)

**Key responses:**
Read `docs/FoC-ProductBacklog.md`'s Supplier Service section and fetched the corresponding GitHub issues (`gh issue view` for #40–#46, #60, #61) to confirm their exact scope/requirement text. Created `supplier-service/SupplierServiceSpec.md`, organizing the already-decided architecture into six phases: Phase 0 (foundations — schema migrations, auth/role middleware, error envelope, rate limiting; no dedicated issue, prerequisite for all others), Phase 1 (supplier read APIs — #40/#41/#42), Phase 2 (admin visibility, lookup-table management, and creation — #43/#44), Phase 3 (admin update — #45), Phase 4 (soft-delete and downstream Redis workflow — #46), and Phase 5 (cross-cutting hardening/verification — #60/#61). Each phase cites the exact architecture section(s) it implements and quotes the backlog requirement IDs it satisfies; no new architecture, schema, or API decisions were introduced. Phase ordering is stated explicitly as technical build-dependency order, not a sprint-priority decision, since reordering the backlog is outside what the agent may do. Flagged three open questions the spec surfaced but did not resolve: (1) whether F8.2.2's duplicate-supplier check needs a schema-level `UNIQUE` constraint or an application-level check, (2) whether the Order Service's historical-record preservation (F8.3.2) needs confirmation from that service's owner, and (3) an apparent mismatch between the backlog's F8.4.1 wording ("toggling active status") and the architecture's actual soft-delete implementation (`is_deleted`, a separate flag from `is_active`).

**Files:**

- `supplier-service/SupplierServiceSpec.md` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
See the three open questions above (also recorded in the spec's closing section). No architecture, schema, or prioritization decisions were made by the agent; phase order reflects only technical dependency, and the team's existing backlog priorities/issue numbers were used as-is.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-28 — Supplier Service: API Gateway, Uniqueness Constraint, and Open-Question Resolutions

**Tool:** Claude Code (claude-sonnet-5)
**Mode:** generate | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied API-gateway/CORS explanation and answers to the spec's three open questions, given directly in chat.

**Prompts (exact):**

> fold into the spec on CORS that a single API gateway will be used to access all the services, hence the single-origin. For the open questions:
>
> 1. an application-level pre check with be done first, but backend will also verify that the supplier name, type and location fields together form a unique set
> 2. yes, confirm supplier_id as stable foreign reference
> 3. toggling active status is meant to purely updates the is_active field that controls visibility and is unrelated to is_deleted. (but if an item is soft deleted, it is also no longer visible and theres no need for the is_active state to be uppdated)

**Key responses:**
Updated both `supplier-service/SupplierServiceArchitecture.md` and `supplier-service/SupplierServiceSpec.md`. In the architecture doc: explained the same-origin/no-CORS deployment as a consequence of a single API gateway fronting all FoC services (§3, §9 item 15); added a `UNIQUE` constraint on `supplier(supplier_name, supplier_type, location_id)` to the data model (§6.2) and DDL (§6.4), enforced by both an application-level pre-check and the database constraint; clarified that `is_active` and `is_deleted` are independent flags — `is_active` is a separate admin-editable visibility toggle already settable via the generic `PUT` edit endpoint, and soft-delete (`DELETE`) only sets `is_deleted` since either flag alone hides a supplier (§6.2); and added §9 item 18 recording all of this, including a flagged edge case the team's answer didn't address: the `UNIQUE` constraint as given applies even to soft-deleted rows, which would block recreating a supplier with the same name/type/location as a previously soft-deleted one, contradicting F8.2.2's "if an _active_ supplier ... exists" wording. In the spec: updated Phase 0 (API gateway), resolved Phase 2/3/4's flagged open questions accordingly, and updated the closing "Summary of open questions" section to mark three items resolved and add the new soft-deleted-row uniqueness question in their place.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Whether the new `UNIQUE` constraint on `supplier(supplier_name, supplier_type, location_id)` should exclude soft-deleted rows (so a supplier can be recreated after a prior soft-delete), or whether such a recreation should instead reactivate the existing soft-deleted row, was not addressed by the team's answer and remains open (architecture §9 item 18, spec closing section item 4).

## 2026-10-04 — Order-service service test update

**Tool:** GitHub Copilot (model: GPT-5.6 Luna)
**Mode:** debug, refactor
**Scope:** Implementation code, Debugging
**Governing decision:** Existing `order-service` service implementation in the working tree.

**Prompts (exact):**

> update this one also

**Key responses:**
Updated `orders.service.spec.ts` to assert the new `getOrders` result objects, added invalid-status validation without a database query, and changed database-error coverage from rejection to an error result. Ran `npm test -- src/services/orders.service.spec.ts` from `order-service`; 1 test file and all 29 tests passed.

**Files:**

- `order-service/src/services/orders.service.spec.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I kept all changes

**Author review: Congchen**
Additions were all based on content I provided. Reviewed.

## 2026-09-28 — Supplier Service: Soft-Delete Recreation Resolved as Reactivation

**Tool:** Claude Code (claude-sonnet-5)
**Mode:** generate | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied resolution for the soft-deleted-row uniqueness question, given directly in chat.

**Prompts (exact):**

> in the unlikely scenario that the exact same supplier that was deleted is re-added, the soft-delete is reversed and the addition serves as an update of fields instead. This preserves the uniqueness

**Key responses:**
Updated `supplier-service/SupplierServiceArchitecture.md` (§6.2, the admin-create row in §7's endpoint table, §9 item 18) and `supplier-service/SupplierServiceSpec.md` (Phase 2, closing "Summary of open questions") to record that `POST /api/v1/admin/suppliers` now branches on the pre-check result: no match inserts normally; a match against a non-deleted supplier is rejected (F8.2.2, unchanged); a match against a soft-deleted supplier instead reverses that row's `is_deleted` flag and applies the submitted fields to it as an update, reusing the existing `supplier_id` rather than inserting a new row. This resolves the previously flagged uniqueness-constraint/soft-delete conflict without needing a partial or filtered `UNIQUE` index. Narrowed the remaining open item to one the team's answer didn't cover: whether photos submitted on the reactivating request should replace or append to the reactivated supplier's existing photo rows.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Photo handling on the reactivation path (replace vs. append existing photo rows) remains open — the team's answer addressed the field-update/reactivation behavior but not photos specifically.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-28 — Supplier Service: Reactivation Photo Handling Resolved

**Tool:** Claude Code (claude-sonnet-5)
**Mode:** generate | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied resolution for the last open item (reactivation-path photo handling), given directly in chat.

**Prompts (exact):**

> replace existing photos on reactivation

**Key responses:**
Updated `supplier-service/SupplierServiceArchitecture.md` (§6.2, §9 item 18) and `supplier-service/SupplierServiceSpec.md` (Phase 2, closing "Summary of open questions") to record that when `POST /api/v1/admin/suppliers` reactivates a soft-deleted supplier (per the prior session's resolution), any newly submitted photos replace that supplier's existing photo rows entirely rather than being appended alongside them. This was the last open item raised across the completeness review, architecture, and spec sessions; the closing summary in the spec now states no open questions remain from this line of clarification.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-28 — Supplier Service: Tech Stack Recorded in AGENTS.md

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied tech stack (TypeScript, Node.js, Express.js, MySQL, Redis), given directly in chat.

**Prompts (exact):**

> Fold into the folder level agents.md the tech stack for this service.: TypeScript, Node.js, express.js, MySQL, Redis etc and make necessary changes to the spec or plans

**Key responses:**
Created `supplier-service/AGENTS.md` (previously an empty placeholder file) recording the team-supplied tech stack — TypeScript, Node.js, Express.js, MySQL, Redis — as a service-specific addendum to the root `AGENTS.md`, consistent with the existing four-tier design in `SupplierServiceArchitecture.md` (§2, §6.1). Updated `docs/superpowers/plans/2026-09-28-supplier-service-phase-0.md`'s header "Tech Stack" line, its "Library choices requiring team confirmation" section, its self-review notes, and Task 11's log-entry template to cite `supplier-service/AGENTS.md` as the now-confirmed source for the top-level stack, narrowing the still-open deviation to just the specific MySQL/Redis client packages (`mysql2`, `ioredis`), which the user did not name. No requirements, architecture, schema, or API decisions were made by the AI tool beyond transcribing what the user supplied.

**Files:**

- `supplier-service/AGENTS.md` (created/modified)
- `docs/superpowers/plans/2026-09-28-supplier-service-phase-0.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None — the user supplied the stack directly; the agent only recorded and cross-referenced it.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-28 — Supplier Service: `super admin` Role Literal Reconciled After Merging main

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** debug | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied resolution ("follow super admin with space"), given directly in chat, of a cross-service naming mismatch the agent surfaced after merging `main` into `supplier-service`.

**Prompts (exact):**

> does the additions in user-service change anything I have planned and speced?

> follow super admin with space

**Key responses:**
While reviewing what `main`'s user-service additions changed for the Supplier Service, found that `SupplierServiceArchitecture.md` and `SupplierServiceSpec.md` (and the Phase 0 plan built from them) assumed the literal role string `super_admin`, but the merged user-service code actually defines `role_enum AS ENUM ('user', 'admin', 'super admin')` (with a space) and returns that same string verbatim from `GET /auth/verify`. Flagged this as a blocking cross-service mismatch rather than deciding it, since fixing it either way is a naming decision for the team. The user chose to adopt the User Service's existing `super admin` string. Replaced `super_admin` with `super admin` throughout the body text of both documents (26 + 2 occurrences), left prior dated disclosure-header entries untouched, added a new §9 traceability item (19) in the architecture doc recording the correction and its cause, and updated the Phase 0 plan's Task 9 test/comment and self-review notes to match. Task 8's tests were unaffected (they only use `'admin'`).

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `docs/superpowers/plans/2026-09-28-supplier-service-phase-0.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None remaining — the mismatch was surfaced as a stop-and-ask item and the team resolved it directly.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-28 — Supplier Service: Phase 1 Supplier Read APIs Implementation Plan

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate | docs
**Scope:** Implementation code | Refactor/Docs
**Governing decision:** `supplier-service/SupplierServiceSpec.md` ("Phase 1 — Supplier Read APIs"), `supplier-service/SupplierServiceArchitecture.md` (§4, §5, §6.2, §6.3, §7 endpoint table, §7.2, §7.3), `supplier-service/AGENTS.md` ("Tech stack").

**Prompts (exact):**

> Based on @SupplierServiceSpec, plan phase 1

**Key responses:**
Used the writing-plans skill to write `docs/superpowers/plans/2026-09-28-supplier-service-phase-1.md`: nine TDD tasks implementing only the four requester-mode read endpoints (list, detail, location reference, category reference) as controller → business service → `SupplierRepository` interface → MySQL implementation, plus the `is_open` calculation and request validation. Noted that only Phase 0 Tasks 1–2 exist on disk, so Phase 0 must finish first. Did not decide points the documents leave open; listed eight under "Points to confirm with the team" (notably: F7.1.2's open-status filter has no query parameter in §7.2, so none was added; `limit` handling; defaults/edge cases; `photoLocation` signing; Facility/close-time `isOpen` boundaries). No code was written or run in this session.

**Files:**

- `docs/superpowers/plans/2026-09-28-supplier-service-phase-1.md` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Eight open points, listed in the plan's "Points to confirm with the team" section; the F7.1.2 open-status filter gap and the `limit` behaviour need a team decision before Task 3.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Phase 0 Tasks 6–11 Implementation

**Tool:** Claude Code (model: claude-sonnet-5), with subagents (claude-sonnet-5)
**Mode:** generate | debug | docs
**Scope:** Implementation code | Boilerplate | Debugging | Refactor/Docs
**Governing decision:** `docs/superpowers/plans/2026-09-28-supplier-service-phase-0.md` (Tasks 6–11), `supplier-service/SupplierServiceArchitecture.md` (§3, §7 intro, §7.1, §7.5), `supplier-service/SupplierServiceSpec.md` ("Phase 0 — Foundations").

**Prompts (exact):**

> Continue to implement @docs/superpowers/plans/2026-09-28-supplier-service-phase-0.md with subagents.
> State:
> Tasks 1–5: implemented; Task 5 timestamp test passes.
> Task 6: implemented and its 4 tests passed, but cannot commit due .git/index.lock permission denial.
> Tasks 7–11: not started.
> MySQL/Redis smoke checks were unavailable earlier; code-level reviews passed where completed.

**Key responses:**
Committed Task 6 (errorHandler; 4 tests re-run and passing; no index.lock present this session). Dispatched subagents for Task 7 (rate limiter), Task 8 (auth middleware), Tasks 9–10 (role guard, app wiring), each test-first. Departures from the plan snippets: `app.set('trust proxy', true)` in the rate-limit test so the X-Forwarded-For case is meaningful; authenticate.ts types the fetch result as `Awaited<ReturnType<typeof fetch>>` and uses bare `catch {` (plan version had a type error and an unused variable); added `vitest.config.ts` supplying test env values from `.env.example` (config.ts exits on missing env) — a test-tooling addition not in the plan; changed the `ioredis` import in `src/redis/client.ts` to the named `Redis` export to fix TS2351. Wrote `supplier-service/README.md`. Full suite: 8 files / 26 tests passed; `tsc --noEmit` clean after the ioredis fix; eslint clean on src. No per-task spec/quality reviewer subagents were run for Tasks 7–10; the controller reviewed the reports only. MySQL migration (Task 3 Step 4) and Redis PING (Task 4 Step 2) were not run this session. Task 1 plan says `vitest ^1.6.0` but the working-tree package.json (uncommitted) has `^5.0.2` and a reformatted layout — left uncommitted for the team.

**Files:**

- `supplier-service/src/middleware/errorHandler.ts`, `errorHandler.test.ts` (created, committed)
- `supplier-service/src/middleware/rateLimit.ts`, `rateLimit.test.ts` (created)
- `supplier-service/src/middleware/authenticate.ts`, `authenticate.test.ts` (created)
- `supplier-service/src/types/express.d.ts` (created)
- `supplier-service/vitest.config.ts` (created)
- `supplier-service/src/middleware/requireRole.ts`, `requireRole.test.ts` (created)
- `supplier-service/src/app.ts`, `app.integration.test.ts` (created)
- `supplier-service/src/redis/client.ts` (modified)
- `supplier-service/README.md` (modified)
- `ai/usage-log.md`, `README.md` (modified)

**Deviations / questions raised for the team:**
Confirm the `vitest.config.ts` test-env addition and the `vitest ^5.0.2` / package.json reformat in the working tree. Confirm smoke checks against real MySQL/Redis before relying on Tasks 3–4.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Phase 1 Team Decisions Recorded and Plan Amended

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs | refactor
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** The team's answers given directly in chat (quoted below) to the eight points raised in the Phase 1 plan; recorded in `supplier-service/SupplierServiceArchitecture.md` §9 item 20.

**Prompts (exact):**

> phase 0 has completed.
> Record all decision changes in the architecture document. Amend the plan if needed:
>
> 1. add isOpen as a possible parameter for the filter.
> 2. the limit of 50 is always applied. there is no entrypoint for anyone to modify this. as such if it is modified, throwing in error is warranted
> 3. accept sortorder default A-Z, page past last page returns 200 with no content
> 4. accept 404 return for unknown supplier by id
> 5. a timing of 0000-2359 is meant to represent 24h facilities/stores. Include an a dedicated if check that returns isOpen = True for any time
> 6. do not even allow any shope to start and end at the same time. If the intention is 24h, provide error message that states to input 0000-2359
> 7. Acknowledge 24h TTL for signed URLs are not available / comfirmed yet
> 8. yes. category text refers to the category value

**Key responses:**
Transcribed the eight team decisions into `SupplierServiceArchitecture.md` (§6.2, §6.3, §7 table, §7.1, §7.1.1, §7.2, §7.3, §9 item 20) and the Phase 1 scope in `SupplierServiceSpec.md`, without adding rationale. Amended `docs/superpowers/plans/2026-09-28-supplier-service-phase-1.md`: added the `isOpen` filter (validation, repository `findAllVisible`, in-memory filter-then-page in the service), removed the Facility special case in favour of the dedicated `00:00`–`23:59` check, and aligned the plan with the merged Phase 0 code (`pool` named export, block-comment headers, `vitest.config.ts` env). Two wording choices were not stated by the team and are flagged in the plan for confirmation: `isOpen` takes `true`/`false`, and the `isOpen` filter is paged in memory. No application code was written or run.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `docs/superpowers/plans/2026-09-28-supplier-service-phase-1.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Four remaining points listed in the plan's "Team decisions" section: `isOpen` value format, how the `isOpen` filter paginates, a Facility with no hours rows, and defensive handling of zero-length rows.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Phase 1 Plan's Four Remaining Points Confirmed

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs
**Scope:** Refactor/Docs
**Governing decision:** The team's confirmation given directly in chat of the four implementation-level points listed in `docs/superpowers/plans/2026-09-28-supplier-service-phase-1.md`'s "Team decisions" section.

**Prompts (exact):**

> confirm all 4 points

**Key responses:**
Updated the plan's "Team decisions" section to record all four points as confirmed as originally drafted: `isOpen=true|false` format; the `isOpen` filter loads all matching rows and pages in memory rather than in SQL; a Facility with no `supplier_hours` rows reports closed (not forced open); and an `open == close` row is defensively treated as closed. No code was written or changed; these were plan-level notes, not new architecture/schema/API decisions, so `SupplierServiceArchitecture.md` was not further modified.

**Files:**

- `docs/superpowers/plans/2026-09-28-supplier-service-phase-1.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Phase 1 Supplier Read APIs Implementation

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `docs/superpowers/plans/2026-09-28-supplier-service-phase-1.md` (Tasks 1–7), transcribing `SupplierServiceSpec.md` ("Phase 1 — Supplier Read APIs") and `SupplierServiceArchitecture.md` (§4, §5, §6.2, §6.3, §7 endpoint table, §7.1, §7.2, §7.3); team decisions in §9 item 20.

**Prompts (exact):**

> in a new branch "supplier-phase-1", execute the plan subagent-driven. Forgo reviewer agents for small contained edits

**Key responses:**
Executed Tasks 1–7 of the Phase 1 plan on a new branch `supplier-phase-1` (branched from `supplier-service-phase-0`), using superpowers:subagent-driven-development: a fresh implementer subagent per task, each given the plan's exact task text (via targeted line ranges of the plan file) and told to follow it verbatim, TDD-style, and self-review before committing. Per the user's instruction, dedicated spec-compliance/code-quality reviewer subagents were skipped for every task — each is a small, fully-specified, contained edit with the code already written out in the plan — and the controller (this session) instead verified the full test suite and typecheck/lint after Task 7. Result: `src/types/supplier.ts`, `src/persistence/supplierRepository.ts` (Task 1); `src/business/isOpen.ts` (Task 2, SGT/overnight/dedicated 00:00–23:59 check); `src/validation/supplierQuery.ts` (Task 3, incl. the `isOpen` filter and fixed-`limit` validation); `src/persistence/mysqlSupplierRepository.ts` (Task 4); `src/business/supplierService.ts` (Task 5, incl. the confirmed in-memory `isOpen` pagination path); `src/controllers/supplier.controller.ts`, `src/routes/supplier.routes.ts` (Task 6); `src/app.ts`/`src/app.integration.test.ts` wiring (Task 7). Final verification: `npx vitest run` — 13 test files, 101 tests, all passing; `npx tsc --noEmit` clean; `npm run lint` clean. Task 8 (manual verification against a real MySQL instance with seed data and live HTTP calls) was **not run** in this session — it needs a running MySQL instance and a running User Service to mint a token, neither of which this session provisioned; it remains an open manual step for the team before the branch is considered fully verified end-to-end.

**Files:**

- `supplier-service/src/types/supplier.ts` (created)
- `supplier-service/src/persistence/supplierRepository.ts` (created)
- `supplier-service/src/business/isOpen.ts` (created)
- `supplier-service/src/business/isOpen.test.ts` (created)
- `supplier-service/src/validation/supplierQuery.ts` (created)
- `supplier-service/src/validation/supplierQuery.test.ts` (created)
- `supplier-service/src/persistence/mysqlSupplierRepository.ts` (created)
- `supplier-service/src/persistence/mysqlSupplierRepository.test.ts` (created)
- `supplier-service/src/business/supplierService.ts` (created)
- `supplier-service/src/business/supplierService.test.ts` (created)
- `supplier-service/src/controllers/supplier.controller.ts` (created)
- `supplier-service/src/routes/supplier.routes.ts` (created)
- `supplier-service/src/routes/supplier.routes.test.ts` (created)
- `supplier-service/src/app.ts` (modified)
- `supplier-service/src/app.integration.test.ts` (modified)
- `supplier-service/README.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Task 8 (manual verification against a real MySQL instance) was not run — see above. No code deviations from the plan were made by any implementer subagent; none reported being blocked.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Phase 2 Team Decisions Recorded

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs
**Scope:** Requirements formatting
**Governing decision:** Team answers given in chat this session (recorded in `SupplierServiceArchitecture.md` §9 item 21); `SupplierServiceSpec.md` Phase 2.

**Prompts (exact):**

> Based on @SupplierServiceSpec, plan phase 2

> The clarifications, update architecture and spec where appropriate:
>
> 1. The cloud provider is not decided yet, and as specified I want an interface to handle the interactions (upload, update, delete, view) so the provider can be swapped out easily. For local dev and testing, will use that same interface but on a local port + in-memory fake
> 2. Yes use multer as that's the industry standard
> 3. successful deletion returns 200 OK, FK violation and duplicate UNIQUE returns 422 as they are validation issues. Lookups deletes are soft
> 4. Only photoId and photoLocation. Actual photo binary is only sent during photo uploads/edits.
> 5. Reactivation leads to 200 OK. What do you mean by keeping is_active as it was? If its is just changing a supplier to active again, updated_on will change to track that , but the version will not change as no updates to the stored details are made. similarly, the details should not be replaced but they can be for a simpler logic [as no actual will occur]. Explain the rationale behind this confirmation
> 6. idempotency-key header is mandatory. missing leads to 400. in-flight marker TTL is 60s, cached response TTL is 24h. Cache keyed per user and per key for maximum security
> 7. facility hours filled by server. frontend will contain some text informing facilities are 24h
> 8. Display order will be based on how the user arranges them on the ui after uploading and before submission

**Key responses:**
Read the spec, architecture and Phase 1 code, then asked eight questions about unrecorded Phase 2 decisions instead of writing a plan (root `AGENTS.md` §2.1). After the team answered, recorded their decisions in the architecture (§6.2, §7, §7.1.1, §7.5, §8.2, new §9 item 21) and the spec's Phase 2 section. Items the answers left undecided (lookup soft-delete column/behavior versus the FK `422`, replace-or-keep of categories/hours on reactivation, `display_order` base, Facility hours days, meaning of "local port") were listed as "still to be specified" and not filled in. Declined to write the rationale for the reactivation decision (decision rationale, prohibited by §2 of `AGENTS.md`). The Phase 2 implementation plan has not been written yet. No code or tests were changed; nothing was run.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Four open points listed above (architecture §9 item 21 (i)–(iv)); the reactivation rationale was requested and declined.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Phase 1 Task 8 Manual Verification

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** debug
**Scope:** Debugging
**Governing decision:** `docs/superpowers/plans/2026-09-28-supplier-service-phase-1.md` ("Task 8: Verify against a real MySQL").

**Prompts (exact):**

> yes
> (Docker Desktop question) "i have started the user-service and supplier-service myself. continue"

**Key responses:**
Committed the `compose.yaml`/`.env.example` changes from the prior turn, then ran Phase 1's Task 8 manual verification against the running `supplier-db`/`supplier-redis`/`supplier-service`/`user-db`/`user-service` containers. `user-service` was crashing on start for two reasons unrelated to Supplier Service: a blank `SUPER_ADMIN_PASSWORD` in its local `.env`, and a missing RS256 keypair in its (empty, gitignored) `user-service/keys/` directory. Set a throwaway local dev value for `SUPER_ADMIN_PASSWORD` in `user-service/.env` (git-ignored, not committed, not printed in chat) and generated a local RS256 keypair with `openssl genrsa`/`openssl rsa` into `user-service/keys/` (git-ignored) — both are local-dev-only fixes to an already-running local container on `localhost`, not production credentials, per the "Testing the user's own application" exception. Recreated `foc-user-service` so it picked up the new `.env`; it started cleanly and bootstrapped a `super admin` user. Loaded the plan's throwaway seed rows into `supplier-db` (plus the `Night Kiosk` row the plan's Task 8 SQL block already included from the earlier `isOpen` amendment) via `docker exec ... mysql`, logged in via `POST /auth/login` (`identifier`/`password`, not `email`) to get a real `super admin` bearer token, then called every Task 8 URL against `http://127.0.0.1:3004` (the compose-mapped port). All responses matched the plan's expectations exactly: list with `search`/`sortOrder`, detail with `desc`/7 `openingHours` rows, `404` for the inactive supplier, both reference endpoints, `isOpen=true` (Campus Store + Gym), `isOpen=false` (Night Kiosk), `page=9` (`200`, empty `data`), `limit=20` (`422`, `details[0].field="limit"`), search hitting name/location/category but never `supplier_desc`, and `401` with no token.

**Files:**

- `ai/usage-log.md` (modified)
- `README.md` (modified)
- `user-service/.env` (modified, git-ignored, not committed — local dev value only)
- `user-service/keys/private.pem`, `user-service/keys/public.pem` (created, git-ignored, not committed — local dev keypair only)

**Deviations / questions raised for the team:**
None for Supplier Service. Flagging for the team: `user-service/.env`'s `SUPER_ADMIN_PASSWORD` was blank and `user-service/keys/` was empty on this machine before this session — every developer's local checkout needs both set up (a password and a generated RS256 keypair) before `user-service` will start; this is pre-existing user-service setup, not something this session's plan covers.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Phase 2 Team Decisions Recorded (architecture and spec)

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs
**Scope:** Requirements formatting
**Governing decision:** Team answers supplied in chat, recorded in `supplier-service/SupplierServiceArchitecture.md` §9 item 21 and `supplier-service/SupplierServiceSpec.md` (Phase 2).

**Prompts (exact):**

> Based on @SupplierServiceSpec, plan phase 2

> The clarifications, update architecture and spec where appropriate:
>
> 1. The cloud provider is not decided yet, and as specified I want an interface to handle the interactions (upload, update, delete, view) so the provider can be swapped out easily. For local dev and testing, will use that same interface but on a local port + in-memory fake
> 2. Yes use multer as that's the industry standard
> 3. successful deletion returns 200 OK, FK violation and duplicate UNIQUE returns 422 as they are validation issues. Lookups deletes are soft
> 4. Only photoId and photoLocation. Actual photo binary is only sent during photo uploads/edits.
> 5. Reactivation leads to 200 OK. What do you mean by keeping is_active as it was? If its is just changing a supplier to active again, updated_on will change to track that , but the version will not change as no updates to the stored details are made. similarly, the details should not be replaced but they can be for a simpler logic [as no actual will occur]. Explain the rationale behind this confirmation
> 6. idempotency-key header is mandatory. missing leads to 400. in-flight marker TTL is 60s, cached response TTL is 24h. Cache keyed per user and per key for maximum security
> 7. facility hours filled by server. frontend will contain some text informing facilities are 24h
> 8. Display order will be based on how the user arranges them on the ui after uploading and before submission

> when is the reactivation path ran again?
>
> Still open questions:
>
> - Add a similar is_deleted col to the faculties, supplier_locations and supplier_categories tables
> - display_order starts at 0. Update day_of_week to start from 1 (mon) to 7 (sun). Add a is_24h col to the supplier_hours table so facilities will only get 1 entry
> - for local testing, we will spin up another mysql instance for storing the photos

**Key responses:**
Asked eight stop-and-ask questions (root `AGENTS.md` §2.1) before writing a Phase 2 plan, because Phase 2 needed unrecorded API, schema and library decisions. No plan file was written. Recorded the team's answers in the architecture (§6.2, §6.4 DDL, §7, §7.1.1, §7.5, §8.2, §9 item 21) and in the spec's Phase 2 section, including the team-supplied schema changes (`is_deleted` on the three lookup tables, `is_24h` on `supplier_hours`, `day_of_week` 1–7). New columns were written with the same definition as `supplier.is_deleted` by analogy, and this is flagged in item 21 for the team to confirm. Declined to write the requested rationale for the reactivation `updated_on`/`version` decision: it is a decision rationale, which root `AGENTS.md` §2 prohibits. Items the team has not settled (lookup soft-delete read/`UNIQUE`/FK behavior, `is_24h` row contents, reactivation categories/hours, the local photo MySQL layout, and the Phase 1 code follow-up for `day_of_week`) are listed as open and were not filled in. No tests or builds were run; only Markdown files changed.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Open items are listed in `SupplierServiceArchitecture.md` §9 item 21 ("Still to be specified by the team"). The requested rationale for the reactivation decision was not written (root `AGENTS.md` §2).

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Soft Delete Reversed, Facility Hours Entry and Photo Store Recorded

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs, refactor
**Scope:** Requirements formatting, Implementation code
**Governing decision:** Team decisions supplied in chat, recorded in `supplier-service/SupplierServiceArchitecture.md` §9 items 21–22 and `supplier-service/SupplierServiceSpec.md` (Phase 2, Phase 4).

**Prompts (exact):**

> - Revert decision to soft-delete suppliers. Update backlog and all related components. Record decision rationale: given the rare circumstances of a supplier deletion to be restored, (usually permanent closure) there is little purpose in retaining the data (which is uniquely keyed too). Likewise for faculties, supplier locations and supplier categories, these are usually set once and no longer updated. There is little value in maintaining soft deletes. This also simplifies things.
> - for 24h facility entries, day_of_week will take a reserved inter 8. 8 is server populated for facilities only, and a combination of 8 and is_24h constitutes a valid facility opening hour record. This is to make the table consistent for stores.
> - the local mock mysql for photo storage will only contain an autogenerated ID, the photo_id and a blob photo_binary. These will be the firlds for the cloud bucket as well. Unit tests use this fake
>   fake

**Key responses:**
Recorded the team's reversal of soft deletion: suppliers and the lookup tables are hard-deleted, `is_deleted` is removed from the schema text and DDL, the reactivation-on-`POST` path and its rules are removed (a duplicate is a plain `422`), and the soft-delete wording is removed from the architecture (§6.2, §6.4, §7, §7.1.1, §8.1, §9), the spec (Phases 2–4), and the backlog (F8.1.1, F8.4, F8.4.1–F8.4.3). The rationale in §9 item 22 is the team's own, as given in the prompt. Recorded the reserved `day_of_week` value 8 (with `is_24h`) for Facility 24-hour entries, widening the `CHECK` to 1–8, and the photo-store fields (`photo_id`, `photo_binary`) with unit tests using that fake. Code: removed the `is_deleted` condition from the visibility query and interface comment, updated the three repository tests to assert it is absent, and dropped `is_deleted` from `src/db/init.sql` (and reduced `idx_supplier_visibility` to `(is_active)` as a consequence, flagged for confirmation). Not done: the Phase 1 read code still uses `day_of_week` 0–6 and was not changed for 1–8/`is_24h`, because the `is_24h` row's stored times are still unspecified. Historical log entries, README index rows, and the Phase 0/1 plan files still mention soft deletion and were left as records. Verification: `npx vitest run` — 101 tests passed; `npx tsc --noEmit` clean; `npm run lint` clean. The Phase 2 implementation plan has still not been written.

**Files:**

- `docs/FoC-ProductBacklog.md` (modified)
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `supplier-service/src/db/init.sql` (modified)
- `supplier-service/src/persistence/mysqlSupplierRepository.ts` (modified)
- `supplier-service/src/persistence/supplierRepository.ts` (modified)
- `supplier-service/src/persistence/mysqlSupplierRepository.test.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Open items are listed in `SupplierServiceArchitecture.md` §9 item 22: the `is_24h` row's stored times, what hard deletion does to rows referencing a supplier and to its cloud photos, what `photo_location` holds, the `idx_supplier_visibility` definition, and the Phase 1 `day_of_week` follow-up. Backlog F8.2.2 still says "active supplier" and GitHub issue #46 is still titled "Soft-delete campus suppliers"; left for the team.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Phase 2 Revised Team Decisions Recorded and Photo-Store Compose File

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs, generate
**Scope:** Requirements formatting, Boilerplate
**Governing decision:** Team answers supplied in chat, recorded in `supplier-service/SupplierServiceArchitecture.md` §9 item 21 and `supplier-service/SupplierServiceSpec.md` (Phase 2). Supersedes the lookup `is_deleted`, reactivation `version` and in-memory-fake decisions in the entry above.

**Prompts (exact):**

> - Revert decision to soft-delete the lookup rows. faculties, supplier locations and supplier categories will be hard deleted, BUT ONLY if there are no references to them. This means that fields only associated with soft-deleted suppliers cannot be deleted as well.
> - if a supplier is reactivated, default the is_active back to true - if its added back, it should be activated. Old is_active state overriden
> - for 24h facility entries, day_of_week will take a reserved inter 8. 8 is server populated for facilities only, and a combination of 8 and is_24h constitutes a valid facility opening hour record. Stores can use is_24h as well, and the 0000:23-59 convention still applies. This is to make the table consistent for stores.
> - the local mock mysql for photo storage will only contain an autogenerated ID, the photo_id and a blob photo_binary. These will be the fields for the cloud bucket as well. Unit tests use this fake
>
> Clarify with me any other decisions before writing changes

> 1. yes. Can use ON DELETE RESTRICT
> 2. confirm a delete of an unknown id returns 404
> 3. Yes. is_deleted is no longer needed for the 3 lookup tables
> 4. now let's update version as well
> 5. existing fields of a reactivated supplier will be replaced by the submitted ones
> 6. if a store is set as 24/7, it will also record a single entry with day_of_week 8 and a time of 0000-2359 (same flow as facilities). All rows that have day_of_week as 8 but a timing not 0000-2359 returns 422. If a facility has day_of_week that is not 8 also returns 422
> 7. yes. This allow for some stores to open 24h only on some days of the week (hours for those days set as 0000-2359)
> 8. Yes. Frontend will process that as open 24/7 and display as such. isOpen also returns true of day=8. Responses do not need is24h field since it can be derived from day=8. This ensures consistency in response shape. However, a supplier creation request will include a is24h field. (the fe can have an input for 24h operation which bypasses the daily opening hours field, and the API package will contain just "day: 8, open: "00:00", close: "23:59" in the opening hours parameter)
> 9. yes. update the is_open computation to check for day=8 first as a guaranteed true
> 10. The photo_id is the same value as supplier_photos.photo_id. Rename it to supplier_photo_id for clarity.
> 11. for better adherance to cloud bucket storage, the local table stores autoincrement ID, a supplier_photo_id, and a photo_location (an actual local file path) instead of a blob binary
> 12. Unit tests use this mysql backed, in-memory service. Add a second mysql service config, but only within the supplier-service folder with clear instructions for running it up for development. I do not want it in the main compose.yaml as this is not used in deployment

**Key responses:**
Asked twelve clarifying questions first (as requested), then recorded the answers in the architecture (§6.2 text and status fields, §6.4 DDL with `ON DELETE RESTRICT` on the lookup foreign keys and `day_of_week` 1–8, §7, §8.2, §9 item 21) and in the spec's Phase 2 section. Removed the lookup `is_deleted` columns added earlier. Added `supplier-service/compose.photo-store.yaml` (second MySQL service, only in the supplier-service folder, not in the root `compose.yaml`) and a README section with run instructions. The service name, container name, host port 5437, database name `supplier_photo_store` and the dev-only default password were chosen by the AI tool as implementation values and are flagged in the file header. The photo table itself is not created. `docker compose -f compose.photo-store.yaml config` reported the file valid; the instance was not started. Raised for the team in §9 item 21: `supplier_photos.photo_id` is only generated inside the MySQL transaction, but §8.2 uploads photos before it, so the local store's `supplier_photo_id` and the `photo_location` link are not yet specified; the coexistence of day-8 and per-day `is_24h` rows (this entry assumes a 24/7 Store has only the day-8 entry); the `is_24h` column definition was written by analogy with `supplier.is_deleted`. The Phase 1 read code and tests still use `day_of_week` 0–6 and were not changed.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `supplier-service/compose.photo-store.yaml` (created)
- `supplier-service/README.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
See "Points that need the team's attention" in `SupplierServiceArchitecture.md` §9 item 21. The Phase 2 implementation plan has still not been written.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Phase 2 Corrections (soft delete kept, 24/7 hours, photo store ids)

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs
**Scope:** Requirements formatting
**Governing decision:** Team answers supplied in chat, recorded in `supplier-service/SupplierServiceArchitecture.md` §9 item 21 and `supplier-service/SupplierServiceSpec.md` (Phase 2). The team stated that this session is the source of truth; it supersedes the entry "Soft Delete Reversed, Facility Hours Entry and Photo Store Recorded" above.

**Prompts (exact):**

> This session is the source of truth. soft deletion and reactivation is kept for suppliers.
> On a store having individual adys marked as 24h - this is implied by selecting certain days as 0000-2359. This is distinct from the is_24h boolean which records a 24h/7 days supplier.
> on photo_id: since the photo has to be stored to cloud first, remove the supplier_photo_id from the cloud (mock mysql db). It will only store a auto-generated id, and that ID will be returned to be stored in the supplier mySQL db.
> A 24h store has only a single day-8 entry like facilities

**Key responses:**
Corrected the architecture (§6.2, §8.2, §9 item 21) and spec (Phase 2): suppliers keep soft deletion and reactivation; `is_24h` and `day_of_week` 8 record only a 24/7 supplier (a Store that is 24-hour on some days simply has `00:00`–`23:59` entries with `is_24h` false); a 24/7 Store has a single day-8 entry like a Facility; the photo store holds only an autogenerated id and a local-file-path `photo_location` (no `supplier_photo_id`), and the returned id is stored in the supplier database. The parallel session had made uncommitted code and backlog changes reversing supplier soft delete (`docs/FoC-ProductBacklog.md`, `supplier-service/src/db/init.sql`, `supplier-service/src/persistence/mysqlSupplierRepository.ts`, `mysqlSupplierRepository.test.ts`, `supplierRepository.ts`). An attempt to discard them with `git checkout` was blocked by the environment's permission check, so those five files are **still in the reverted-schema state and contradict the docs**; they need to be restored by the team. The other session's architecture and spec text was already absent from those documents. Earlier log entries were not edited. No tests or builds were run.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Restoring the five files listed above to the committed state is outstanding. Open point in §9 item 21: which `supplier_photos` column stores the id returned by the photo store, and how `photoLocation` is produced from it.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Local Photo Store Switched from MySQL to MinIO

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs, generate
**Scope:** Requirements formatting, Boilerplate
**Governing decision:** Team answer supplied in chat, recorded in `supplier-service/SupplierServiceArchitecture.md` §8.2 and §9 item 21 and `supplier-service/SupplierServiceSpec.md` (Phase 2). Supersedes the local MySQL photo store in the entries above.

**Prompts (exact):**

> I ran the file restore code.
> open point:
>
> - sorry. the swap out mysql for minIO to simulate the cloud storage. No longer mysql. This would allow perfect simulation. minIO will return the location directly which will be stored by the supplier_photos table

**Key responses:**
Confirmed the five files from the parallel session's soft-delete reversal were restored (git status showed only the docs, README and compose file modified). Replaced the local MySQL photo store with MinIO in the architecture (§8.2, §9 item 21) and spec (Phase 2): MinIO returns the photo location directly and it is stored in `supplier_photos.photo_location`; the previous open point about which column holds the id is closed. Rewrote `supplier-service/compose.photo-store.yaml` as a MinIO service plus a one-shot bucket-creation job, and rewrote the README section. The service names, ports 9000/9001, bucket `supplier-photos` and dev-only credentials were chosen by the AI tool and are flagged in the file header. `docker compose config` reported the file valid; the containers were not started, so the `mc ready local` healthcheck and the bucket job are untested. No tests or builds were run.

**Files:**

- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `supplier-service/compose.photo-store.yaml` (modified)
- `supplier-service/README.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The MinIO client library for the local adapter is not chosen yet; it will be surfaced in the Phase 2 plan. The Phase 2 implementation plan is still not written.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Phase 1 Hours Update (days 1–7 plus reserved 8) and S3 Client Choice

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate, refactor, docs
**Scope:** Implementation code
**Governing decision:** `supplier-service/SupplierServiceArchitecture.md` §6.2, §6.4 and §9 item 21 (`day_of_week` 1–7 plus reserved 8, `is_24h`, `is_open` day-8 check first).

**Prompts (exact):**

> for the MinIO client library, use the AWS S3 client one
> what do you mean "the is_24h column definition is written by analogy with supplier.is_deleted"
> Update phase 1 code

**Key responses:**
Recorded the team's choice of the AWS S3 client (`@aws-sdk/client-s3`) for the local MinIO adapter in the spec. Explained that the team had specified the new `is_24h` column but not its SQL definition, so the architecture DDL gives it `BOOLEAN NOT NULL DEFAULT FALSE`, copied from `supplier.is_deleted`; the team is to confirm or change that. Updated the Phase 1 code: `isOpen.ts` now maps Singapore time to 1 = Monday .. 7 = Sunday, treats a day-8 entry as always open (checked first), and wraps an overnight Sunday interval into Monday; `init.sql` `supplier_hours` gained `is_24h` and the 1–8 check; comments in `supplierRepository.ts` were updated; `isOpen.test.ts` gained three tests (day 7 as Sunday and day 0 rejected, overnight Sunday, day 8 always open). The reads do not select `is_24h` because responses do not expose it. Verification: `npx vitest run` — 13 files, 104 tests passing; `npx tsc --noEmit` clean; `npm run lint` clean. Not done: the lookup `ON DELETE RESTRICT` change is left for the Phase 2 migration, and a database already created from the old `init.sql` (`CREATE TABLE IF NOT EXISTS`) and any existing hours rows are not migrated (Sunday 0 becomes 7). Not run against a real MySQL instance.

**Files:**

- `supplier-service/src/business/isOpen.ts` (modified)
- `supplier-service/src/business/isOpen.test.ts` (modified)
- `supplier-service/src/persistence/supplierRepository.ts` (modified)
- `supplier-service/src/db/init.sql` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Confirm the `is_24h` definition. Existing dev databases need `supplier_hours` recreated or migrated.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-29 — Supplier Service: Phase 2 Schema Migration and Implementation Plan

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate, docs
**Scope:** Implementation code, Boilerplate, Requirements formatting
**Governing decision:** `supplier-service/SupplierServiceArchitecture.md` §6.4 and §9 item 21; `supplier-service/SupplierServiceSpec.md` (Phase 2).

**Prompts (exact):**

> confirm is_24h is a boolean not null default false.
> Continue with migration and phase 2 plan

**Key responses:**
Recorded the team's confirmation that `supplier_hours.is_24h` is `BOOLEAN NOT NULL DEFAULT FALSE` and removed the related flags from the architecture and spec. Wrote an idempotent upgrade for existing databases (`src/db/phase2Schema.ts`, runner `src/db/migratePhase2.ts`, `npm run migrate:phase2`): adds `is_24h`, drops the old 0–6 check, converts Sunday 0 to 7, adds the 1–8 check; already-upgraded databases are left unchanged. Added `ON DELETE RESTRICT` explicitly to the three lookup foreign keys in `init.sql` (MySQL's default already behaves this way; a real MySQL reports the rule as `NO ACTION`). Verification: `npx vitest run` — 14 files, 107 tests passing; `npx tsc --noEmit` and `npm run lint` clean; the upgrade was run twice against a scratch database on the dev MySQL server created from the pre-Phase 2 schema (days 0 and 1 became 7 and 1, `is_24h` added, check 1–8), then the scratch database was dropped. The real `supplier_service` database was **not** upgraded; run `npm run migrate:phase2` against it. Wrote the Phase 2 implementation plan `docs/superpowers/plans/2026-09-29-supplier-service-phase-2.md` (10 tasks: dependencies/config, photo storage port and S3-client adapter, admin reads, lookup management, create-request validation, idempotency, create/reactivate workflow, HTTP layer, manual verification, docs). The plan's code was not compiled or run. The plan lists 12 choices it makes that are not in the architecture (for example the lookup delete body, `201` for lookup creates, UUID-only idempotency keys, timestamps written as Singapore time by the app, no cloud cleanup of photos replaced on reactivation until Phase 4, and business-layer tests using an in-memory storage double rather than MinIO) for the team to confirm.

**Files:**

- `supplier-service/src/db/phase2Schema.ts` (created)
- `supplier-service/src/db/phase2Schema.test.ts` (created)
- `supplier-service/src/db/migratePhase2.ts` (created)
- `supplier-service/src/db/init.sql` (modified)
- `supplier-service/package.json` (modified; no header possible — added the `migrate:phase2` script)
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `docs/superpowers/plans/2026-09-29-supplier-service-phase-2.md` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Confirm or change the 12 choices in the plan's "Choices this plan makes" section. Run `npm run migrate:phase2` against the real dev database.

**What I kept/changed/rejected:**

**Author review:**

## 2026-09-29 — Supplier Service: Phase 2 Plan Choices Accepted, MinIO Test Scope

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs
**Scope:** Requirements formatting
**Governing decision:** Team answer supplied in chat; recorded in `docs/superpowers/plans/2026-09-29-supplier-service-phase-2.md` ("Choices this plan makes", item 8).

**Prompts (exact):**

> accept the 12 choices except for 8 - minio should be used when testing actual cloud connection logic

**Key responses:**
Recorded acceptance of choices 1–7 and 9–12 in the Phase 2 plan. Rewrote choice 8: pure business logic keeps an in-memory storage double, while anything testing real cloud-connection logic uses the local MinIO. In the plan this became `*.minio.test.ts` files excluded from `npm test` and run with a new `npm run test:minio` (second Vitest config, so a missing MinIO fails loudly rather than being skipped): Task 2 gained six S3-adapter tests against MinIO (upload and serve, unique locations, update, delete, deleting a missing object, unreachable store) and Task 7 gained two creation-workflow tests (photos stored and kept; uploaded objects removed when the transaction fails). The plan's code was not compiled or run, and no MinIO test was executed.

**Files:**

- `docs/superpowers/plans/2026-09-29-supplier-service-phase-2.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**

**Author review:**

## 2026-09-29 — Supplier Service: Phase 2 Implementation (admin reads, lookups, supplier create)

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate, refactor, docs
**Scope:** Implementation code, Boilerplate
**Governing decision:** `docs/superpowers/plans/2026-09-29-supplier-service-phase-2.md` (Tasks 1–10), transcribing `supplier-service/SupplierServiceSpec.md` ("Phase 2") and `SupplierServiceArchitecture.md` (§6.2, §6.4, §7, §7.1.1, §7.5, §8.2, §9 item 21).

**Prompts (exact):**

> execute, subagent driven, skip reviewer agent for simple implementation tasks

**Key responses:**
Executed Tasks 1–8 of the Phase 2 plan on branch `supplier-phase-2` with superpowers:subagent-driven-development: a fresh implementer subagent per task, each given the plan's line ranges, and the controller re-ran typecheck, the full test suite and lint after every task. Per the instruction, dedicated reviewer agents were skipped for the simple tasks; one reviewer agent was used on the create/reactivate transaction workflow (Task 7). It found no high or medium defects and one low one (the reactivation `UPDATE` did not replace `supplier_name`, so a differently-cased resubmission kept the old spelling); this was fixed in a follow-up commit. Built: `PhotoStorage` port with an S3-client adapter (MinIO locally) and an in-memory test double; admin list/detail reads; faculty/location/category management with hard delete of unreferenced rows; create-request parsing and the hours rules (days 1–7, reserved day 8, `is24h`); the Redis idempotency store and header check; the create and reactivate workflow (upload, transaction, cleanup); the multipart `multer` layer, `POST /api/v1/admin/suppliers` and app wiring. Task 9 (manual verification) was run by the controller: the service ran on the host against a scratch MySQL database (`phase2_verify`) on the dev MySQL server, a temporary Redis container, the local MinIO, and a **stub** of the User Service's `/auth/verify` (not the real User Service). Confirmed live: admin list `200`; user role `403` and no token `401` on admin routes; lookup create `201`, duplicate `422`, delete of a referenced faculty `422`, delete of an unreferenced one `200`, repeat delete `404`, category update `200`; create Facility with two photos `201` (photos fetchable from MinIO, `display_order` 0 and 1, single day-8 hours entry); replay with the same `Idempotency-Key` returned the cached `201` with no new row; duplicate with a new key `422`; missing key `400`; 24/7 Store `201`; equal open/close `422`; GIF photo `422`; after soft-deleting the supplier, user detail `404`, admin detail `isDeleted: true`, and re-creating it (different name case, one photo) returned `200` with `isActive` true, `version` 1, the new description and exactly one photo row. The old photo object stayed in MinIO, as planned (Phase 4). The scratch database, temporary Redis, stub and service were removed afterwards. Final verification: `npx vitest run` — 26 files, 210 tests passing; `npm run test:minio` — 2 files, 8 tests passing against the running MinIO; `npx tsc --noEmit` and `npm run lint` clean. Not run: the flow against the real User Service and real dev database `supplier_service` (`npm run migrate:phase2` has not been run on it), the rate limiter under load, and any test of `PUT`/`DELETE` supplier (later phases).

**Files:**

- `supplier-service/.env.example` (modified)
- `supplier-service/compose.photo-store.yaml` (modified)
- `supplier-service/package-lock.json` (modified)
- `supplier-service/package.json` (modified)
- `supplier-service/src/app.integration.test.ts` (modified)
- `supplier-service/src/app.ts` (modified)
- `supplier-service/src/business/lookupService.test.ts` (created)
- `supplier-service/src/business/lookupService.ts` (created)
- `supplier-service/src/business/supplierCreation.minio.test.ts` (created)
- `supplier-service/src/business/supplierCreationService.test.ts` (created)
- `supplier-service/src/business/supplierCreationService.ts` (created)
- `supplier-service/src/business/supplierService.test.ts` (modified)
- `supplier-service/src/business/supplierService.ts` (modified)
- `supplier-service/src/config.ts` (modified)
- `supplier-service/src/controllers/adminSupplier.controller.ts` (created)
- `supplier-service/src/controllers/lookup.controller.ts` (created)
- `supplier-service/src/idempotency/idempotencyStore.test.ts` (created)
- `supplier-service/src/idempotency/idempotencyStore.ts` (created)
- `supplier-service/src/middleware/requireIdempotencyKey.test.ts` (created)
- `supplier-service/src/middleware/requireIdempotencyKey.ts` (created)
- `supplier-service/src/middleware/uploadPhotos.test.ts` (created)
- `supplier-service/src/middleware/uploadPhotos.ts` (created)
- `supplier-service/src/persistence/lookupRepository.ts` (created)
- `supplier-service/src/persistence/mysqlLookupRepository.test.ts` (created)
- `supplier-service/src/persistence/mysqlLookupRepository.ts` (created)
- `supplier-service/src/persistence/mysqlSupplierRepository.test.ts` (modified)
- `supplier-service/src/persistence/mysqlSupplierRepository.ts` (modified)
- `supplier-service/src/persistence/mysqlSupplierWriteRepository.test.ts` (created)
- `supplier-service/src/persistence/mysqlSupplierWriteRepository.ts` (created)
- `supplier-service/src/persistence/supplierRepository.ts` (modified)
- `supplier-service/src/persistence/supplierWriteRepository.ts` (created)
- `supplier-service/src/redis/client.ts` (modified)
- `supplier-service/src/routes/adminSupplier.routes.test.ts` (created)
- `supplier-service/src/routes/adminSupplier.routes.ts` (created)
- `supplier-service/src/routes/lookup.routes.test.ts` (created)
- `supplier-service/src/routes/lookup.routes.ts` (created)
- `supplier-service/src/routes/supplier.routes.test.ts` (modified)
- `supplier-service/src/storage/inMemoryPhotoStorage.ts` (created)
- `supplier-service/src/storage/minioTestStorage.ts` (created)
- `supplier-service/src/storage/photoStorage.ts` (created)
- `supplier-service/src/storage/s3PhotoStorage.minio.test.ts` (created)
- `supplier-service/src/storage/s3PhotoStorage.test.ts` (created)
- `supplier-service/src/storage/s3PhotoStorage.ts` (created)
- `supplier-service/src/types/supplier.ts` (modified)
- `supplier-service/src/utils/time.test.ts` (modified)
- `supplier-service/src/utils/time.ts` (modified)
- `supplier-service/src/validation/lookupInput.test.ts` (created)
- `supplier-service/src/validation/lookupInput.ts` (created)
- `supplier-service/src/validation/supplierInput.test.ts` (created)
- `supplier-service/src/validation/supplierInput.ts` (created)
- `supplier-service/src/validation/supplierQuery.ts` (modified)
- `supplier-service/vitest.config.ts` (modified)
- `supplier-service/vitest.minio.config.ts` (created)
- `supplier-service/README.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**

- `npm install` fails with `ERESOLVE` (a peer conflict between `vitest@5.0.2` and `@types/node@20` that was already in the repo), so the new packages were installed with `--force`; `npm ci` fails for the same reason. `--legacy-peer-deps` was tried and broke `vite`, so it was not used.
- `compose.photo-store.yaml` now pulls `quay.io/minio/minio` and `quay.io/minio/mc` because the Docker Hub images failed to pull in this environment; the images are not version-pinned.
- Task 5 changed `invalid()` so single-field failures carry the specific message (for example the 24/7 hint) in `message`, with the generic text kept for multi-issue errors.
- Task 3 added the two new methods to the `fakeService` in the Phase 1 route test so it still type-checks.
- The transaction helper swallows a failed `rollback()` so it cannot mask the original error.
- Two of the plan's test helpers had bugs (a reused `Response` body; a `fetch` stub outside its `describe`) and were fixed in the tests only.
- The plan's 12 choices (accepted by the team, with choice 8 revised) are implemented as written; the lookup create `201` and delete body `{ "deleted": true, "id": … }` are among them.
- Still open: the cloud objects of photos replaced on reactivation are not deleted (Phase 4), and MinIO test objects created during manual checks were left in the dev bucket.

**What I kept/changed/rejected:**

**Author review:**

## 2026-09-30 — Supplier Service: Move Tests into a test/ Folder

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** refactor
**Scope:** Refactor/Docs
**Governing decision:** Team instruction in chat (no design decision involved).

**Prompts (exact):**

> make a new "test" folder within supplier service and add subfolders mirroring that in the src folder, and move all test cases from src into test

**Key responses:**
Moved all 26 `*.test.ts` files from `supplier-service/src/` to `supplier-service/test/`, keeping the same subfolders (`business`, `db`, `idempotency`, `middleware`, `persistence`, `routes`, `storage`, `utils`, `validation`, plus `app.integration.test.ts` at the top), using `git mv` and rewriting each file's relative imports; no test logic was changed. Also moved two test-only helpers that lived in `src/storage/` (`minioTestStorage.ts` and `inMemoryPhotoStorage.ts`) into `test/storage/` so no test code remains under `src/`. Config changes: `tsconfig.json` now includes `test/` (and no longer sets `rootDir`); a new `tsconfig.build.json` builds `src/` only and `npm run build` uses it; `vitest.config.ts` and `vitest.minio.config.ts` now look under `test/`. Verification: `npx tsc --noEmit` and `npx tsc -p tsconfig.build.json --noEmit` clean; `npx vitest run` — 24 files, 204 tests passing; `npm run test:minio` — 2 files, 8 tests passing; `npm run lint` clean. The default run count dropped from 26 files / 210 tests to 24 / 204 because the old pattern also ran two stale compiled copies of tests in `dist/` (`dist/middleware/errorHandler.test.js`, `dist/utils/time.test.js`); the new `test/**` include no longer picks them up. The Phase 2 and Phase 3 plan documents still refer to the old `src/...test.ts` paths and were not edited.

**Files:**

- `supplier-service/test/**` (26 test files and 2 helpers moved from `supplier-service/src/**`, imports updated; listed by `git log --follow`)
- `supplier-service/tsconfig.json` (modified)
- `supplier-service/tsconfig.build.json` (created)
- `supplier-service/package.json` (modified; no header possible — `build` script)
- `supplier-service/vitest.config.ts` (modified)
- `supplier-service/vitest.minio.config.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The two helpers were moved as well, which goes slightly beyond "test cases". A `git stash -u` used during a comparison briefly stashed the untracked `docs/superpowers/plans/2026-09-29-supplier-service-phase-3.md`; it was restored immediately with `git stash pop` and is unchanged.

**What I kept/changed/rejected:**

**Author review:**

## 2026-10-06 — Order-service pickup endpoint review

**Tool:** GitHub Copilot (model: GPT-5.6 Luna)
**Mode:** debug, explain
**Scope:** Debugging, Refactor/Docs
**Governing decision:** Existing order-service transition rules in `order-service/src/domain/order-status.ts` and service result contract in `order-service/src/services/orders.service.ts`.

**Prompts (exact):**

> i just implemented this. help me check for code quality or any bugs. also update ai usage log

**Key responses:**
Reviewed the pickup controller, route, transition service, error definitions, and existing tests. Found that the controller returns HTTP 500 for all transition failures, including `ORDER_NOT_FOUND`, `FORBIDDEN`, `INVALID_TRANSITION`, and `ORDER_CONFLICT`; these should be mapped to the team-approved client/error statuses before release. Found no controller-level tests for `POST /orders/:id/pickup`. TypeScript typecheck, lint, and the full order-service test suite passed: 5 test files and 263 tests.

**Files:**

- `order-service/src/controllers/orders.controller.ts` (reviewed)
- `order-service/src/routes/orders.routes.ts` (reviewed)
- `order-service/src/services/orders.service.ts` (reviewed)
- `order-service/src/domain/order-status.ts` (reviewed)
- `order-service/src/constants/errors.ts` (reviewed)
- `order-service/src/controllers/orders.controller.spec.ts` (reviewed; no pickup coverage found)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
The correct HTTP mapping for pickup transition errors is an API decision not recorded in the reviewed files; the team should decide and document it before implementation.

**What I kept/changed/rejected:**
No production code changes; findings were reported for team decision.

**Author review:**
tng wen xi

## 2026-10-08 — order-service: F17 cancellation test coverage

**Tool:** GitHub Copilot (model: GPT-5.6 Luna)
**Mode:** generate, debug
**Scope:** Implementation code, Debugging
**Governing decision:** F17 cancellation requirements supplied by the team in chat and the existing order transition implementation.

**Prompts (exact):**

> F17 Support the cancellation of requests.
> F17.1 The system shall allow requesters to cancel their open requests High 9
> The system shall update the request status from “open”
> to “cancelled” when the user cancels it. High 9
> F17.2 The system shall allow the requester to cancel a non-“open”
> request when its complete-by deadline is reached.
> The system shall provide an option for requesters to cancel
> a request that is ongoing when the complete-by deadline
> has passed.
> The system shall update the request status to “cancelled” when the user cancels it.

**Key responses:**
Added service and HTTP tests covering requester cancellation of open orders, requester cancellation after a passed complete-by deadline, rejection before the deadline, and rejection of courier cancellation. Verification: `npx vitest run src/services/orders.service.spec.ts src/controllers/orders.controller.spec.ts` passed with 56 tests across 2 files.

**Files:**

- `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.spec.ts` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I kept all changes.

**Author review:**
tng wen xi

## 2026-09-30 — Phase 3: Admin update (PUT /api/v1/admin/suppliers/:id)

**Tool:** Claude Code (model: claude-sonnet-5-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `SupplierServiceSpec.md` "Phase 3 — Admin Update"; `SupplierServiceArchitecture.md` §6.2, §7, §7.1.1, §7.3, §7.5, §8.1, §8.2; the team's answers in chat on 2026-09-29/30; plan `docs/superpowers/plans/2026-09-29-supplier-service-phase-3.md` (commit `7a44642`).

**Prompts (exact):**

> Based on @SupplierServiceSpec, plan phase 3

> "PUT body fields…"="Same as create + isActive"; "Identity collisions on PUT…"="422 duplicate; deleted = 404"; "Photo wire format on PUT…"="JSON arrays, files by index"; "Phase 3 must enqueue the excluded-photo deletion job … what should Phase 3 do about the Redis job producer?"="Producer only, you supply names"

> Redis list key: "queue:image:cleanup", task name="image_cleanup".
> Readings to confirm:
>
> 1. yes one redis job per photo to exclude
> 2. explain what this case is
> 3. yes
> 4. what do you mean by PUT with no editable fields
> 5. yes
> 6. yes
> 7. Yes, but actually now i do not need placeholders, since the cloud save will have to run first and return the actual photo_id to be saved
> 8. what is this
> 9. yes

> new photos = "Keep placeholders"; files while not dirty = "422 reject"; version-only PUT = "422 reject"; enqueue failure = "is this purely with enqueuing the redis tasks, not the tasks failing? if yes, api returns 500, failinf the edit. If it is after a redis task has exhausted, that would be recorded in a log"

> open reading:
> follow original plan.
> Any other blockers? if not, we are now in a new branch "supplier-phase-3" , execute with subagent-driven developement

**Key responses:**
Asked the four design questions above (PUT body fields, identity collisions, photo wire format, Redis job producer) instead of choosing, then wrote the Phase 3 plan (`docs/superpowers/plans/2026-09-29-supplier-service-phase-3.md`, written by the agent and committed by the team as `7a44642`). Implemented it on branch `supplier-phase-3` through subagent-driven development: one implementer subagent per task and one reviewer subagent per task (spec and quality passes combined in one reviewer), all approved. Built: a Redis job producer (`jobQueue.ts`, `photoDeletionJob.ts`); `resolveHours` and exported validation helpers in `supplierInput.ts`; the PUT field parser (`supplierUpdateInput.ts`); a pure photo plan (`photoPlan.ts`); `findCurrent` and `updateSupplier` in the write repository (version-matched `UPDATE`, `display_order` reorder via a `+1000000` offset); the `SupplierUpdateService` saga; and the controller, route and app wiring.
Verification actually run by the controller at the end: `npx vitest run` — 28 files, 256 tests passed; `npm run build` and `npm run lint` clean; `npx tsc --noEmit` clean. Not run: the live curl/end-to-end check against MySQL, Redis and MinIO (no MySQL container was running; only Redis and MinIO). The real MySQL reorder (`+1000000` offset against `UNIQUE(supplier_id, display_order)`) is covered only by mock-based unit tests.

**Files:**

- `supplier-service/src/app.ts` (modified)
- `supplier-service/src/business/photoPlan.ts` (created)
- `supplier-service/src/business/supplierUpdateService.ts` (created)
- `supplier-service/src/controllers/adminSupplier.controller.ts` (modified)
- `supplier-service/src/persistence/mysqlSupplierWriteRepository.ts` (modified)
- `supplier-service/src/persistence/supplierWriteRepository.ts` (modified)
- `supplier-service/src/queue/jobQueue.ts` (created)
- `supplier-service/src/queue/photoDeletionJob.ts` (created)
- `supplier-service/src/routes/adminSupplier.routes.ts` (modified)
- `supplier-service/src/validation/supplierInput.ts` (modified)
- `supplier-service/src/validation/supplierUpdateInput.ts` (created)
- `supplier-service/test/business/photoPlan.test.ts` (created)
- `supplier-service/test/business/supplierCreation.minio.test.ts` (modified)
- `supplier-service/test/business/supplierCreationService.test.ts` (modified)
- `supplier-service/test/business/supplierUpdateService.test.ts` (created)
- `supplier-service/test/persistence/mysqlSupplierWriteRepository.test.ts` (modified)
- `supplier-service/test/queue/jobQueue.test.ts` (created)
- `supplier-service/test/routes/adminSupplier.routes.test.ts` (modified)
- `supplier-service/test/validation/supplierInput.test.ts` (modified)
- `supplier-service/test/validation/supplierUpdateInput.test.ts` (created)
- `supplier-service/README.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)
- No file in this change lacks a header for want of comment syntax (`package.json` was not changed).

**Deviations / questions raised for the team:**

- The repo layout changed mid-plan, so tests live in `supplier-service/test/` mirroring `src/`; the plan's paths were adapted.
- `test/business/supplierCreation.minio.test.ts` was also edited to add the two new repository fake methods so `tsc` passes.
- The four design questions above were asked rather than decided by the agent.
- Reading 8 caveat: the enqueue happens after commit (Architecture §8.2), so if enqueuing fails the API returns 500 while the edit stays committed and is not rolled back. The team said to follow the original plan; worker retries and dead-letter logging are Phase 4.
- Points flagged by reviewers for the team: `{version, photo_ids}` with `isPhotoDirty` false passes the parser as "not empty" and would only bump `version`; a partial enqueue failure leaves the remaining excluded photos' cloud objects without a cleanup job; the repository tests are mock-only.
- One unexplained failure occurred on a single first full-suite run by an implementer subagent; it was not reproduced in 11 further full runs.
- The plan document itself was written by the agent and committed by the team as `7a44642`.

**What I kept/changed/rejected:**

**Author review:**

## 2026-09-30 — Phase 4: Admin soft-delete, transactional outbox and downstream worker

**Tool:** Claude Code (model: claude-sonnet-5-5; the Task 1 implementer subagent was claude-haiku-4-5-20251001)
**Mode:** generate, debug (review-driven fixes), docs
**Scope:** Implementation code, Boilerplate, Refactor/Docs
**Governing decision:** `SupplierServiceSpec.md` "Phase 4 — Admin Soft-Delete and Downstream Workflow"; `SupplierServiceArchitecture.md` §7, §7.5, §8.1, §8.2; the team's answers in chat on 2026-09-30 (quoted below); plan `docs/superpowers/plans/2026-09-30-supplier-service-phase-4.md`.

**Prompts (exact):**

> Based on @SupplierServiceSpec, plan phase 4

> Q: Arch §7 only says "Soft-deletion response". What should DELETE /api/v1/admin/suppliers/:id return on success? (Unknown or already-deleted supplier → 404 per §7.5.) A: 200 + small JSON body
> Q: What queue key, task_name and payload should the suspension workflow job use (Phase 3 fixed queue:image:cleanup / image_cleanup for photos)? And should one job do both the Order delete and the Message notify? A: One job: queue:supplier:suspension
> Q: Where does the worker run, and what are the exponential-backoff timings (max 5 attempts is already decided)? A: separate entrypoint. backoff timngs set at 5s, 25s, 125s, 625s
> Q: Order/Message contracts are deferred and mocked (§9 item 17). What should the mocks be, given no request contract is recorded? A: Ports + logging mocks

> Readings to confirm:
>
> 1. just standardise to id in all api responses
> 2. deletion will bump updated_on and version too
> 3. explain again
> 4. retries should not happen within the worker itself. a queue will be maintained with timestamps to signal when the task should be tried again, freeing the worker for other tasks. Use the BullMQ library for this
> 5. bad jobs are logged to the dead letter directly
> 6. yes. standard shutdown signals apply. allow last job to finish
> 7. yes. confirm idempotency with current API configurations as well
>
> Open items:
>
> - reactivation logic specified: the record is first returned to a is_deleted = false and is_active = true state. Then changes, if any, to the details and images will be handled with the typical edit supplier cycle
> - Add in the dedicated container config that runs the workers , even for development

> For reading 3, change the logic to commit only after redis enqueue is attempted. this allows for redis enqueue issues to be captured and prevent the deletion from happening so the user can retry
> Similarly for reactivation failures, the edit is attempted before the flag is commited.
> photo store endpoint: using docker's host.docker.internal:9000 for internal development should mitigate this issue

> commit/enqueue issue update:
>
> - apply the transactional outbox pattern: when the commit is made, also commit to a dedicated outbox table with a version number and the whole api package. A scheduled cron job will run every second to check for items in the outbox table. If there is anything, the package will be retreived and used to enqueue a task into the bullmq queue. When the task is successfully enqueued, the entry will be deleted from the outbox table

> Q: What should the outbox table look like? ... A: autoincrement id (for worker to know order, and for deletion), task type (the redis task name, so it can be added easily), payload (original content) and version (version 1 processed before 2)
> Q: What does the outbox row's "version number" mean? A: the supplier version. So that multiple tasks for the same supplier will be guaranteed to be executed in the intended order
> Q: Which enqueues go through the outbox? A: All of them (Recommended)
> Q: What runs the every-second relay, and where? A: BullMQ job scheduler in the worker (Recommended)

> bullMQ can be made to run jobs in the order of the version right
> col types confirm
> queue key confirm

> we are now in new branch supplier-phase 4.
> stick with enqueue order only. subagent driven development.

The plan and the implementation were then executed by subagents (one implementer subagent per plan task, followed by a spec-compliance reviewer and a code-quality reviewer subagent), driven by a controller session, on branch `supplier-phase-4`.

**Key responses:**
Asked the team the design questions above (delete response, suspension job identity, worker placement and retry timings, mocks, outbox table, version meaning, outbox scope, scheduler) and did not decide them. Raised readings to confirm (the version stored per outbox row, relay ordering, job id and duplicates, unroutable rows, relay queue key, the effect of the outbox on Redis outages, reactivation behaviour, queue key mapping, retention, compose settings, existing databases); the team answered them (including "stick with enqueue order only", and the column types and queue key confirmations). The plan `docs/superpowers/plans/2026-09-30-supplier-service-phase-4.md` was written by the agent and committed by the team as `194854b`.

Built: `DELETE /api/v1/admin/suppliers/:id` (200 `{ id, isDeleted: true }`, 404 for an unknown or already deleted supplier), with the soft delete and its `supplier_suspension` outbox row in one transaction; the `outbox` table, repository and transactional writer; excluded-photo cleanup tasks from `PUT` and reactivation written to the outbox in the write transaction; the BullMQ producer adapter, retry policy (5 attempts, delays 5 s / 25 s / 125 s / 625 s) and queue key mapping; the outbox relay with its every-second BullMQ job scheduler; the worker process (`src/worker/main.ts`, `npm run worker`) with handlers, mock Order/Message clients (`MOCK_DOWNSTREAM_FAILURE`), job processor with dead-lettering, and graceful shutdown; the reworked reactivation through the edit cycle in one transaction; and the `supplier-worker` compose service with `PHOTO_STORE_ENDPOINT` set to `http://host.docker.internal:9000`. Docs (`README.md`, `SupplierServiceSpec.md`, `SupplierServiceArchitecture.md`) were updated to record the team's decisions and the behaviour.

Review process: each task had a spec-compliance review and a code-quality review by separate subagents; findings were fixed in follow-up commits, including (`0a575a2`, `b024769`, `f3097c2`, `b5c4a2e`, `b5e8511`, `c1500b0`, `b427dfe`). The Task 1 implementer was Claude Haiku 4.5; its headers were corrected in `0a575a2`. All other subagents and the controller were Claude Sonnet 5.5.

Verification actually run: `npx vitest run` 38 files / 343 tests passed; `npx tsc --noEmit` clean; `npm run lint` clean; `npm run build` succeeded; `npm run test:minio` 2 files / 9 tests passed (MinIO running); `docker compose config --quiet` clean; `docker compose build supplier-worker` succeeded. Manual live check (plan Task 16, 2026-09-30) against real MySQL 8, Redis, MinIO and the API/worker containers, with a local stub standing in for the User Service `GET /auth/verify` (no real credentials used). Steps 1-8 passed: delete path (200 `{id,isDeleted:true}`, outbox drained in about 0.3 s, the worker logged the two mock lines, repeat DELETE 404 with no outbox row, `user` role 403); Redis outage (DELETE still 200, one outbox row with the supplier's new version, drained after Redis restarted, connection errors logged, no crash); worker down (rows drained ordered by version then id, MinIO objects removed); delayed retry (attempt gaps 5 s, 25 s, 125 s, 625 s, worker not blocked, exactly one `dead_letter_jobs` row with job id `outbox-<id>` and status `UNRESOLVED`); bad rows (unknown `task_name` dead-lettered by the relay and removed; invalid payload dead-lettered once without retry); reactivation (200, flags restored, version +1, old photo objects removed; no-photos case leaves photos untouched; with MinIO stopped the POST returned 500 and the supplier stayed soft-deleted and unchanged, and a retry with the same `Idempotency-Key` then returned 200). Step 9 (shutdown), worker idle: `docker stop` completed in about 3 s with the log lines "Received SIGINT; taking no new jobs..." and "supplier-service worker stopped", exit code 143. Not tested: stopping the worker during an in-flight job (the mock handlers finish in about a millisecond).

**Files:**

- `compose.yaml` (modified)
- `supplier-service/.env.example` (modified)
- `supplier-service/package.json` (modified; cannot carry a header)
- `supplier-service/package-lock.json` (modified; cannot carry a header)
- `supplier-service/src/app.ts` (modified)
- `supplier-service/src/business/supplierCreationService.ts` (modified)
- `supplier-service/src/business/supplierDeletionService.ts` (created)
- `supplier-service/src/business/supplierUpdateService.ts` (modified)
- `supplier-service/src/config.ts` (modified)
- `supplier-service/src/controllers/adminSupplier.controller.ts` (modified)
- `supplier-service/src/db/init.sql` (modified)
- `supplier-service/src/persistence/deadLetterRepository.ts` (created)
- `supplier-service/src/persistence/mysqlDeadLetterRepository.ts` (created)
- `supplier-service/src/persistence/mysqlOutboxRepository.ts` (created)
- `supplier-service/src/persistence/mysqlSupplierWriteRepository.ts` (modified)
- `supplier-service/src/persistence/outboxRepository.ts` (created)
- `supplier-service/src/persistence/outboxWriter.ts` (created)
- `supplier-service/src/persistence/supplierWriteRepository.ts` (modified)
- `supplier-service/src/queue/bullQueue.ts` (created)
- `supplier-service/src/queue/jobQueue.ts` (modified)
- `supplier-service/src/queue/photoDeletionJob.ts` (modified)
- `supplier-service/src/queue/tasks.ts` (created)
- `supplier-service/src/routes/adminSupplier.routes.ts` (modified)
- `supplier-service/src/worker/downstream.ts` (created)
- `supplier-service/src/worker/handlers.ts` (created)
- `supplier-service/src/worker/jobProcessor.ts` (created)
- `supplier-service/src/worker/main.ts` (created)
- `supplier-service/src/worker/outboxRelay.ts` (created)
- `supplier-service/src/worker/startRelay.ts` (created)
- `supplier-service/src/worker/startWorkers.ts` (created)
- `supplier-service/test/business/supplierCreation.minio.test.ts` (modified)
- `supplier-service/test/business/supplierCreationService.test.ts` (modified)
- `supplier-service/test/business/supplierDeletionService.test.ts` (created)
- `supplier-service/test/business/supplierUpdateService.test.ts` (modified)
- `supplier-service/test/persistence/mysqlDeadLetterRepository.test.ts` (created)
- `supplier-service/test/persistence/mysqlOutboxRepository.test.ts` (created)
- `supplier-service/test/persistence/mysqlSupplierWriteRepository.test.ts` (modified)
- `supplier-service/test/persistence/outboxWriter.test.ts` (created)
- `supplier-service/test/queue/bullQueue.test.ts` (created)
- `supplier-service/test/queue/jobQueue.test.ts` (deleted)
- `supplier-service/test/queue/tasks.test.ts` (created)
- `supplier-service/test/routes/adminSupplier.routes.test.ts` (modified)
- `supplier-service/test/storage/s3PhotoStorage.minio.test.ts` (modified)
- `supplier-service/test/worker/downstream.test.ts` (created)
- `supplier-service/test/worker/handlers.test.ts` (created)
- `supplier-service/test/worker/jobProcessor.test.ts` (created)
- `supplier-service/test/worker/outboxRelay.test.ts` (created)
- `supplier-service/test/worker/startRelay.test.ts` (created)
- `supplier-service/README.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**

- Questions asked and answered by the team rather than decided by the agent: delete response, suspension job identity, worker placement and retry timings, mock shape, outbox table shape, meaning of the outbox `version`, which enqueues use the outbox, relay scheduler, column types, queue key.
- `bullmq` 6.3.10 was installed with `npm install --force`: a pre-existing peer-dependency conflict between vitest 5.0.2 and `@types/node ^20` makes a plain `npm install` or `npm ci` fail on the branch. The Docker build of `supplier-worker` nevertheless succeeded.
- A development database created before Phase 2 also needed `npm run migrate:phase2` (in addition to `npm run migrate`) before supplier creation worked.
- Shutdown: under `docker stop` the worker log showed SIGINT, not SIGTERM, although the `--signal SIGTERM` nodemon flag was added; the graceful path ran. Stopping during an in-flight job was not tested.
- Execution order: the relay guarantees enqueue order only (decided by the team, 2026-09-30); a job waiting for a delayed retry lets later jobs run first, and the two task queues run independently.
- The mock Order and Message clients only log; their idempotency limits are not those of real services, which have no contract yet.
- Development data stored with a `http://localhost:9000` photo location prefix cannot be deleted by the worker (it is dead-lettered).
- Two existing behaviours were observed and not changed: the create endpoint answers 500 "Supplier could not be saved." and logs nothing when the schema is out of date; the API logs ioredis "Unhandled error event" lines while Redis is down.
- MinIO and Redis containers were restarted during the manual tests and left healthy.
- The plan file itself was committed by the team as `194854b`.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-10-12 — order-service: F15.1.4 + F16.1: Automatic request maintenance

**Tool:** GitHub Copilot SDK in VS Code (model: GPT-5.6 Luna)
**Mode:** generate | refactor
**Scope:** Implementation code | Boilerplate
**Governing decision:** Team decision confirmed in chat on 2026-10-12 to use a separate BullMQ worker backed by Redis for order-service.

**Prompts (exact):**

> we need to implement these:
> F15.1.4
> The system shall automatically mark “completed” a
> request 24 hours after the state is set to “delivered”, in
> case the requester forgot to mark as completed.
>
> and
>
> F16.1 The system shall automatically expire an open request when its acceptance deadline is reached.
>
> our team is thinking of using BullMQ's cron job for this. how can this be implemented?

**Key responses:**
Implemented a recurring BullMQ maintenance job that runs every minute. It conditionally marks delivered requests completed when `deliveredAt` is at least 24 hours old, and marks open requests expired when `completeBy` is reached. Added version increments, worker shutdown handling, Compose Redis/worker services, environment configuration, and unit coverage. Verification was run with the order-service typecheck and targeted tests.

**Files:**

- `order-service/src/services/orders.service.ts` (modified)
- `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/config/env.ts` (modified)
- `order-service/src/worker.ts` (created)
- `order-service/package.json` (modified)
- `order-service/package-lock.json` (modified)
- `.env.example` (modified)
- `compose.yaml` (modified)
- `compose.dev.yaml` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The team confirmed the separate BullMQ worker and Redis deployment boundary before implementation. None otherwise.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
tng wen xi

## 2026-09-30 — Supplier Service: Supplier responses carry location_id, faculty_id and category ids

**Tool:** Claude Code (model: claude-sonnet-5-5)
**Mode:** generate | refactor | docs
**Scope:** Implementation code
**Governing decision:** Team decision given in chat on 2026-09-30 (prompt below), recorded in `supplier-service/SupplierServiceArchitecture.md` §7.3 and §9 item 23.

**Prompts (exact):**

> edit-form ids: where is this at

> 2. Update the API responses so that the name and ids are sent together. new location_id and faculty_id. for categories, since there can be multiple categories for a given supplier, the categories will be sent as a list of json, with the structure being "categories": [{"category": "Food", "category_id": 1 }, {"category": "Drinks", "category_id":2}] for example

**Key responses:**

- Stopped and asked before changing the contract (API response shape is a team decision); implemented once the team chose option 2.
- Every supplier response (user and admin, list and detail) now includes `location_id` and `faculty_id` next to `location` and `faculty`, and `categories` is a list of `{category, category_id}` objects. The reference endpoints are unchanged apart from key order.
- Persistence: the supplier query selects `s.location_id` and `f.faculty_id`; the category-link query selects `cm.category_id`.
- Updated the affected unit tests and the architecture document's §7.3 examples; added §9 item 23.
- Verification: `npx tsc --noEmit` clean; `npx vitest run` 38 files / 343 tests passed. These use mocked database pools; nothing was run against a real MySQL, and the MinIO tests were not run. Dependencies were installed with `npm ci --legacy-peer-deps` because a plain `npm ci` fails on the existing vitest / `@types/node` peer conflict (no tracked file changed).

**Files:**

- `supplier-service/src/types/supplier.ts` (modified)
- `supplier-service/src/persistence/supplierRepository.ts` (modified)
- `supplier-service/src/persistence/mysqlSupplierRepository.ts` (modified)
- `supplier-service/src/business/supplierService.ts` (modified)
- `supplier-service/test/business/supplierService.test.ts` (modified)
- `supplier-service/test/persistence/mysqlSupplierRepository.test.ts` (modified)
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**

- The prompt said "API responses" without naming endpoints; the agent applied it to all supplier list and detail responses, user and admin, because they share one summary type. Confirm this is the intent.
- Location uniqueness in the schema is `(location, faculty_id, level)`, so a location name alone is not unique; the ids remove any need to match by name.
- Existing behaviour not changed: the `level` field remains in the summary as before.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-30 — Supplier Service: OpenAPI description and local seed test

**Tool:** Claude Code (model: claude-sonnet-5-5)
**Mode:** generate | docs
**Scope:** Implementation code | Boilerplate
**Governing decision:** Team direction in chat (below): record endpoints as OpenAPI starting with the supplier service; seed the compose `supplier-db` through the creation process as a test. Contracts come from `supplier-service/SupplierServiceArchitecture.md` §6–§8 and the service README.

**Prompts (exact):**

> i have commited them myself. Currently, supplier data is all mocked and stored in memory. To build the actual deployment fe, i have copied the foc-mockup folder as "frontend". This is what will be modified into the real fe. The first major change within frontend will be to make the fe talk to various services using their respective exposed API calls. For the first stage, i want my local mySQL to host the supplier data that the fe is referencing To facilitate this, lets also utilise the OpenAPI yaml file format to record all my endpoints, starting with just the supplier service

Answers to the agent's questions (chat): frontend auth = real login with the token in memory; seeding = "a TS seed script that replicates the supplier creation process that saves the details to mysql, and photos to minio (which points to the local positions), minio returns the local positions and mysql captures them. In fact, this should be a test in itself"; database = the compose supplier-db container.

**Key responses:**

- Asked before choosing the frontend auth storage, the seeding method and which MySQL (all unrecorded); implemented after the team answered.
- `supplier-service/openapi.yaml`: OpenAPI 3.0.3 description of every supplier endpoint (user reads, reference, admin CRUD, admin reference), with the error envelope, rate limit, multipart bodies and the `Idempotency-Key`. It restates existing contracts; where the docs and code differ it follows the code (category management uses `category_type`). Validated with `@redocly/cli lint` (valid, one missing-`license` warning).
- `npm run seed` runs `test/seed/seedSuppliers.seed.test.ts` under `vitest.seed.config.ts`: it creates faculties, locations and categories, then each of the 14 mock suppliers through the real `createSupplierCreationService` (MySQL plus MinIO); it asserts every supplier is readable and each stored photo location serves an image. Re-runnable.
- Verification: default `npm test` still 38 files / 343 tests and `tsc --noEmit` clean. The seed passed, twice (second run skipped existing rows), against a throwaway database `seed_check` with `PHOTO_STORE_ENDPOINT=http://localhost:9000`: 14 suppliers, 10 photos, 98 hour rows; that database and its 10 MinIO objects were then removed. The seed was NOT completed against the real `supplier_service` database: with the default `http://host.docker.internal:9000` the upload hangs because the Windows hosts entry for `host.docker.internal` points at a stale LAN address (192.168.10.102; the Wi-Fi address is 10.249.219.35). Only reference data and one supplier (Roasted Delights, no photo) were written there before it timed out.

**Files:**

- `supplier-service/openapi.yaml` (created)
- `supplier-service/vitest.seed.config.ts` (created)
- `supplier-service/test/seed/seedSuppliers.seed.test.ts` (created)
- `supplier-service/test/seed/supplierSeedData.ts` (created)
- `supplier-service/vitest.config.ts` (modified)
- `supplier-service/package.json` (modified: `seed` script; cannot carry a header)
- `supplier-service/README.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**

- Placeholder seed values, not team data: supplier `type` ('Store'), location `level` (1), identical opening hours every day.
- `.webp` images are skipped because the API accepts only JPEG/PNG; three referenced images (`techno-edge.jpg`, `cool-spot.jpg`, `spinelli.jpg`) do not exist in the mock's folder, so those suppliers have no photo.
- `view()` in the photo storage returns the stored location unchanged; the architecture says `photoLocation` is a signed URL valid for 24 hours. Images load in the browser only because the bucket allows anonymous download.
- The `frontend/` folder was incomplete when checked (no `src/`, `public/` or `package.json`), so no frontend change was made in this task.
- The local `supplier_service` database already held earlier development rows (for example Campus Store, Gym, Night Kiosk, Hidden Inactive/Deleted); they will appear in the frontend alongside the seeded suppliers.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-30 — Frontend: real login and supplier screens on the Supplier Service

**Tool:** Claude Code (model: claude-sonnet-5-5)
**Mode:** generate | refactor
**Scope:** Implementation code
**Governing decision:** Team decisions in chat (prompts and answers below); contracts from `supplier-service/openapi.yaml`, `SupplierServiceArchitecture.md` §7 and the User Service routes; same-origin/gateway decision (Arch §3, §9 item 18).

**Prompts (exact):**

> docker restarted. frontend folder fully loaded

Earlier prompt of this stage (quoted in the entry "Supplier Service: OpenAPI description and local seed test"): make the fe talk to the services through their exposed APIs, starting with supplier data from the local MySQL. Answers given in chat: real login with the access token held in memory; the refresh cookie is the session carrier.

**Key responses:**

- `frontend/` (the copy of `foc-mockup/`) was missing its build configs and lockfile: `vite.config.js`, `tailwind.config.js`, `postcss.config.js` and `package-lock.json` were copied unchanged from `foc-mockup/`, and `npm ci` was run in `frontend/` because the copied `node_modules` was broken.
- `vite.config.js`: dev proxy `/api/v1` to `localhost:3004` (supplier service), `/auth` and `/users` to `localhost:3001` (user service), so the browser only uses one origin and no CORS is involved. The user-service paths are a development choice; the gateway's routing for that service is not recorded.
- `src/api/`: `http.js` (fetch wrapper; in-memory access token; one shared `POST /auth/refresh` then retry on 401), `auth.js` (login, logout, session restore via refresh + `GET /users/me`), `suppliers.js` (every user and admin supplier call, multipart create with `Idempotency-Key`, update with `version` and photo placeholders), `useApi.js` (loading hook and reference-data hook).
- `DemoContext` now holds a real session (`session`, `login`, `logout`, `systemRole`, `isAdmin`) and restores it on page load; the demo Auth toggle and the demo Admin role were removed. `role` (requester/courier), credits and every order/request screen are still mock data.
- Landing, Suppliers, SupplierDetail and the request form's supplier picker read the Supplier Service. The list sends search, one `location_id`, one `category_id`, `isOpen`, A-Z/Z-A and page to the service (the service accepts one location and one category, so those filters are single-choice). Logged out, these screens show a "Log in to see suppliers" notice because every supplier route needs a token.
- Admin list and form call the admin endpoints (list, get, create, update, delete); field errors, 404 and 409 are shown; the in-memory admin store (`AdminSuppliersContext.jsx`) was deleted. The admin screens are available only to `admin` and `super admin` sessions.
- Verification: `vite build` passes; `oxlint` shows only fast-refresh / set-state-in-effect / unused-variable warnings of the existing kind. In the browser (Vite on port 5174): logged out, the landing page shows the login notice; the login modal posts through the proxy to the real User Service and shows "Wrong username/email or password." for wrong credentials. NOT verified: a successful login, the supplier list/detail, the request form picker, and every admin create/edit/delete flow, because the login needs the real super-admin password, which lives in the private `user-service/.env` and was not read or used. The seed into the real database is also still blocked (see the previous entry): the Windows hosts entry for `host.docker.internal` still pointed at 192.168.10.102 after the Docker restart.

**Files:**

- `frontend/vite.config.js` (created by copy, then modified)
- `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/package-lock.json` (copied unchanged; cannot carry a header where JSON)
- `frontend/src/api/http.js`, `auth.js`, `suppliers.js`, `useApi.js` (created)
- `frontend/src/components/ApiNotice.jsx` (created)
- `frontend/src/components/LoginModal.jsx`, `TopNav.jsx`, `DemoControls.jsx` (modified)
- `frontend/src/context/DemoContext.jsx` (modified)
- `frontend/src/main.jsx` (modified)
- `frontend/src/pages/Landing.jsx`, `Suppliers.jsx`, `SupplierDetail.jsx`, `CreateRequest.jsx`, `AdminSuppliers.jsx`, `AdminSupplierForm.jsx` (modified)
- `frontend/src/context/AdminSuppliersContext.jsx` (deleted from `frontend/`; it came with the copy of `foc-mockup/`)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**

- The mock supplier helpers in `frontend/src/data/suppliers.js` remain because the mocked request screens (RequestCard, Activity, Chat, RequestBoard) look suppliers up by the mock ids 1-14; those ids do not match the database ids. Connecting the Order Service should remove that.
- `frontend/AI-NOTES.md` is a copy of the mockup's notes; under the root AGENTS.md only `foc-mockup/` keeps a separate log, so work in `frontend/` is logged here.
- Photos: `photoLocation` is used as an image URL as returned; it only loads in the browser if `host.docker.internal` resolves on the machine (or the stored prefix is otherwise reachable).
- `package.json` of `frontend/` still has the name `foc-mockup`.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-09-30 — Frontend: fix request flood and lost admin role after reload

**Tool:** Claude Code (model: claude-sonnet-5-5)
**Mode:** debug
**Scope:** Debugging
**Governing decision:** None needed; bug fixes within the behaviour already described in `frontend/` and `supplier-service/openapi.yaml`. The 30 requests/minute/IP limit is a recorded team decision (SupplierServiceArchitecture.md §7.5) and was not changed.

**Prompts (exact):**

> hold off. i ran the npm run seed myself - was successful. I verified a successful login with superadmin account, but the main supplier page shows unable to load immediately. Navigating to manage suppliers also show rate limit exceeded. Refreshing the page suddenly identify me as being not an admin or superadmin. Is the 30requests/min rate limiting too strict?

**Key responses:**

- Cause of "unable to load" and the rate-limit error: on the landing page the category list used in the request's dependency list was a new empty array on every render until the reference data arrived, so the list request re-ran in a loop. With the network stubbed in the browser, the landing page sent 216 list requests in 3 seconds.
- Cause of the lost admin role after reload: `GET /users/me` returns only `{ username, email }`, so a restored session had no role. Session restore now also calls `GET /auth/verify` (`{ user_id, role }`).
- Fixes: `useReferenceData` returns constant empty arrays; the landing query depends on the category id; identical in-flight GETs share one network call; `restoreSession` merges `/users/me` and `/auth/verify`.
- Verification (network stubbed in the browser, since the real super-admin password was not used): landing page 3 requests (list plus the two reference calls), Suppliers page 1, after the fix; `vite build` passes. The role restore after a real reload was NOT run; it follows from the `/auth/verify` response shape in `user-service/src/controllers/auth.controller.ts`.
- Question answered in chat, not acted on: whether 30/min is too strict. A normal page view now uses 1-3 requests; a rate change is a team decision.

**Files:**

- `frontend/src/api/auth.js`, `frontend/src/api/http.js`, `frontend/src/api/useApi.js`, `frontend/src/pages/Landing.jsx` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**

- The limiter is per client IP (`req.ip`, with `trust proxy` on). Users behind one shared address would share the 30-per-minute budget; whether that matters is for the team.
- The limit counts every request, including the frontend's reference-data and detail lookups.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-10-01 — Frontend: README with local run guide and photo troubleshooting

**Tool:** Claude Code (model: claude-sonnet-5-5)
**Mode:** docs
**Scope:** Refactor/Docs
**Governing decision:** None needed; describes the compose files, service READMEs and Vite proxy as they are today.

**Prompts (exact):**

> details the steps to run the fe locally, based on which services I want to be mocked and which i want to use actual services

> the local dev fe was working, but now the images are missing. why?

> combine this with the guide to run fe locally into the frontend readme

**Key responses:**

- Diagnosis of the missing images (answered in chat, no code changed): the photo-store container was not running, and the hosts entry for `host.docker.internal` had gone stale again after the Wi-Fi address changed. The photo store was restarted; the hosts file was not edited (it needs administrator rights).
- Created `frontend/README.md`: which areas are real or mocked, the three run modes (fully mocked via `foc-mockup/`, real user and supplier services, real user with mocked supplier marked unsupported), setup, start commands, seeding, the Vite proxy, and the `host.docker.internal` fix and troubleshooting table.
- Verification: no code was run for this task; the commands and ports were taken from `compose.yaml`, `supplier-service/compose.photo-store.yaml`, `frontend/vite.config.js` and the READMEs, and the photo-store check was run (`localhost:9000` returned 200 and a stored photo served through it).

**Files:**

- `frontend/README.md` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**

- The README tells the reader to pin `host.docker.internal` to `127.0.0.1` in the hosts file. This is operational advice for a development machine; changing the recorded development photo-store address instead would be a team decision and was not made.

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-10-02 — Frontend: README section for checking MySQL and MinIO by hand

**Tool:** Claude Code (model: claude-sonnet-5-5)
**Mode:** docs
**Scope:** Refactor/Docs
**Governing decision:** None needed; describes the existing schema (`supplier-service/src/db/init.sql`, `user-service/src/db/init.sql`) and compose services.

**Prompts (exact):**

> 1. add instructions for checking the data in mysql and minio manually to verify everything is working

**Key responses:**

- Added "Verifying the data by hand" to `frontend/README.md`: `docker exec` MySQL queries (counts, suppliers with location and faculty, categories, hours, photos, `outbox` and `dead_letter_jobs`, an interactive prompt), a PostgreSQL query for accounts, MinIO console access, health check, object count and fetching one photo, and a short checklist of what a working setup looks like.
- Verification: the schema column names were read from the two `init.sql` files. The Docker engine was not running when this was written, so none of the new commands were executed in this task. The same `docker exec ... mysql` pattern and a photo fetch through `localhost:9000` were run earlier in the session. The MinIO object count command (`ls /data/supplier-photos`) assumes MinIO's single-drive folder layout and is unverified; the README says to use the console if it differs.

**Files:**

- `frontend/README.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:** None

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-10-02 — Frontend: README manual MySQL testing in the supplier-db container

**Tool:** Claude Code (model: claude-sonnet-5-5)
**Mode:** docs
**Scope:** Refactor/Docs
**Governing decision:** None needed; describes the existing `supplier-db` container and the schema in `supplier-service/src/db/init.sql`.

**Prompts (exact):**

> update the readme to show manual testing using docker's supplier-db container exec terminal

**Key responses:**

- Replaced the one-line interactive-prompt note in `frontend/README.md` with a "Manual testing in the container terminal" subsection: opening a shell (`docker exec -it foc-supplier-db bash` or Docker Desktop's Exec tab), starting the `mysql` client with the container's own root password variable, example statements (`SHOW TABLES`, `DESCRIBE`, `\G`), how to exit, and a table that pairs each admin action in the app (add, add photos, edit, reorder/remove, deactivate, delete, worker) with the query to run and the result to expect. It warns against hand-written `UPDATE`/`DELETE`.
- Verification: no command was run in this task and the Docker engine was not running. Column and table names come from `init.sql`; the expectations in the table (version bump on edit, `is_deleted` on delete, `outbox` emptying) follow the behaviour recorded in the supplier-service README and architecture document and were not re-tested here.

**Files:**

- `frontend/README.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:** None

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

## 2026-10-02 — User Service: optional seeded normal test user

**Tool:** Claude Code (model: claude-sonnet-5-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** Superadmin env-var bootstrap pattern in `instructions.md` (Stage 4e); mechanism (optional `TEST_USER_*` env vars, run at startup) chosen by the user in chat.

**Prompts (exact):**

> current user service only provides a superadmin test account. Add a normal user account as well

**Key responses:**

- Asked which provisioning mechanism to use (AGENTS.md §2.1); the user chose optional env vars like the superadmin.
- Added optional `TEST_USER_USERNAME` / `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` to `config.ts`, and `bootstrapTestUser()` in `bootstrap.service.ts`, called from `server.ts` after the superadmin bootstrap. It does nothing unless all three are set, applies the existing password-complexity rule, skips if the username or email already exists, and otherwise creates an active user with the default role. No default password is in code.
- Added four tests to `bootstrap.service.test.ts`.
- Verification: NOT run. `node_modules` is not installed in `user-service`, so neither typecheck nor tests were executed.

**Files:**

- `user-service/src/config.ts` (modified)
- `user-service/src/services/bootstrap.service.ts` (modified)
- `user-service/src/server.ts` (modified)
- `user-service/.env.example` (modified)
- `user-service/tests/services/bootstrap.service.test.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:** Asked the mechanism question above; answered by the user.

**What I kept/changed/rejected: Kept**

**Author review: Congchen**

## 2026-10-02 — Frontend: desktop Log out button

**Tool:** Claude Code (model: claude-sonnet-5-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** Existing `logout` in `frontend/src/context/DemoContext.jsx` and `POST /auth/logout` in the User Service; the request only asked for a way to sign out.

**Prompts (exact):**

> add an option to sign out of the current account so i can switch around

**Key responses:**

- Found that a Log out control already existed but only in the mobile drawer of `TopNav.jsx`; the desktop nav had none. Added a Log out button to the desktop nav that calls the existing `logout`. No API or context changes.
- Verification: NOT run (no build, lint or browser check in this task).

**Files:**

- `frontend/src/components/TopNav.jsx` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:** None

**What I kept/changed/rejected: Kept all**

**Author review: Congchen**

---

## 2026-10-16 — Week 7/8 catch-up: transfer, release, balance read and append-only enforcement

**Tool:** Claude Code (model: claude-opus-5)
**Mode:** generate | debug | docs
**Scope:** Implementation code | Debugging | Refactor/Docs
**Governing decision:** `credit-service/credit-service-context.md` §5 (write-path table, append-only), §6 (F19.3, F19.4, F19.5), §7 (NFR8.1.2, NFR8.2.3), §8 (API surface); six team decisions given in chat on 2026-10-16 and quoted below.

**Prompts (exact):**

> Implement the week-7/8 catch-up iteration for credit-service.
> Read credit-service/CONTEXT.md first. Do not change requirements.
>
> TEAM DECISIONS MADE SINCE THE AUDIT — implement these as given
>
> 1. Order Service will send requestId on every credit call. Our existing request_id-keyed design stands; do not add a reservationId handle.
> 2. Transfer takes courierId in the request body. Credit Service does not look couriers up and stores no courier reference of its own.
> 3. Transfer error semantics: no reservation for that requestId → 404 RESERVATION_NOT_FOUND; already transferred → 409 ALREADY_TRANSFERRED; courier has no balance row → 404 COURIER_NOT_FOUND. Do NOT create a balance row here — credits may only enter the economy via F19.1.1.
> 4. Release works for both cancellation and expiry. It takes only a requestId. No scheduler, no clock, no expiry detection in this service.
> 5. GET /credits/balance/:userId: a user may read only their own balance unless they hold an elevated role. Mirror user-service's ROLE_RANK comparison rather than checking role === 'admin', so super admin is not denied. Auth is BLOCKED on the user-service public key, which is gitignored and absent — so write the authorization layer behind a clear seam and leave it disabled, with a TODO naming the blocker. Do not invent a key or a fallback that skips verification.
> 6. The chosen async workflow is transfer-on-completion. Do NOT implement it this iteration — the outbox-vs-broker decision is still with the team. Design transfer so it can be driven by a retry later: keep it idempotent on requestId.
>
> BUILD
> a. F19.3.1 / F19.3.2 — POST /credits/transfer […]
> b. NFR8.1.2 — prove rollback on transfer specifically. Inject a failure mid-transaction and assert both balances and the log are unchanged.
> c. F19.4.1 — POST /credits/release. Decrease reserved only; total is untouched. Log row. Idempotent on requestId.
> d. F19.5.1 — GET /credits/balance/:userId returning total, reserved and unreserved.
> e. NFR8.2.3 — create a named least-privilege role […] Then prove it: a DELETE against transaction_log as the app role must fail.
> ALSO
> f. Publish the API contract as credit-service/API.md […]
> g. Point the test suite at a dedicated test database, as user-service does.
>
> VERIFY docker compose up, full suite green, and mutation-check the new work the way FOR UPDATE was checked: break it, confirm the test fails, restore. Report what you could not verify.
>
> Nothing outside credit-service/ without showing me the diff first.

**Key responses:**

Implemented all six decisions as given. Transfer reads the amount and the requester back from the reservation row rather than taking them from the caller, so it can only ever move exactly what was held; the courier comes from the body and no courier reference is stored. Release takes only a requestId and has no clock. Both are idempotent on requestId, each backed by a partial unique index — a new `transaction_log_one_release_per_request` was added to match the existing transfer and reservation indexes, implementing the team's idempotency instruction with the mechanism already decided in context §4.

Two orderings no requirement covers were hit and are flagged rather than resolved: transfer-after-release and release-after-transfer. Both return 409 (`ALREADY_RELEASED` / `ALREADY_TRANSFERRED`); both are listed as INVENTED in API.md.

The F19.5.1 authorization rule is implemented as a pure function mirroring user-service's `ROLE_RANK` (so `super admin` is not denied) and unit-tested. The middleware applying it is written but **not mounted**: verifying a User Service token needs its RS256 public key, which is git-ignored and absent. No key was fabricated and no verification-skipping path was written. The endpoint is therefore unauthenticated, stated in API.md, README.md and in the route file.

NFR8.2.3 is now genuinely enforced. `grants.sql` holds the privilege matrix (`SELECT, INSERT, UPDATE` on balances; `SELECT, INSERT` only on transaction_log) and is applied both by the container bootstrap and by the test harness, so the two cannot drift. The service connects as `credit_app`, confirmed non-superuser.

Verification actually run. `docker compose up` for credit-db and credit-service, both healthy. `npx tsc --noEmit` and `npm run build` exit 0. Full suite **48 tests in 7 files, all passing**. End-to-end over HTTP against the container: allocate → reserve → balance → transfer → duplicate transfer (409) → release-after-transfer (409) → courier balance, all correct, with the service confirmed connected as `credit_app`. Against the live `credit_db`, `DELETE FROM transaction_log` as `credit_app` fails with `permission denied for table transaction_log`; `pg_roles` shows `credit_app` with `rolsuper = false`.

Mutation checks, each applied then restored:

- `ROLLBACK` → `COMMIT` in the transaction helper: both NFR8.1.2 tests fail, and the partial commit drives `reserved_balance` to −8, tripping `balances_reserved_non_negative`.
- Release also debiting total: 4 tests fail.
- Granting DELETE/UPDATE on transaction_log: 2 append-only tests fail.
- Removing the F19.3.2 unique index: **initially passed**, which exposed a weak test. The service-level guard and the CHECK constraint were masking the index. A direct database-level test (`tests/db/constraints.test.ts`) was added; the mutation is now detected. The concurrency test was also strengthened to assert _why_ the losers lose, not just how many.

A footgun was found and fixed during the work: the first version of globalSetup reset the password of the cluster-wide `credit_app` role, which would have broken a running container. The suite now uses a separate `credit_app_test` role with identical grants, and refuses to run as `credit_app`.

**Could not verify:** the async transfer-on-completion workflow (not built this iteration, by instruction); any real inter-service call, since Order Service still wires `createStubCreditsClient()` and its `CreditsClient` contract does not match this API; the JWT verification path, which has no key; NFR8.2.1 and NFR8.2.2, which remain unmeasured and unimplemented.

**Files:**

- `credit-service/src/db/init.sql` (modified: release uniqueness index; append-only note)
- `credit-service/src/db/grants.sql` (created)
- `credit-service/src/db/grant-app-role.sh` (created)
- `credit-service/src/db/queries/credits.queries.ts` (modified)
- `credit-service/src/services/credits.service.ts` (modified)
- `credit-service/src/controllers/credits.controller.ts` (modified)
- `credit-service/src/routes/credits.routes.ts` (modified)
- `credit-service/src/auth/roleRank.ts` (created)
- `credit-service/src/middleware/requireBalanceAccess.ts` (created)
- `credit-service/tests/services/transfer.test.ts` (created)
- `credit-service/tests/services/balance.test.ts` (created)
- `credit-service/tests/concurrency/transfer-rollback.test.ts` (created)
- `credit-service/tests/db/append-only.test.ts` (created)
- `credit-service/tests/db/constraints.test.ts` (created)
- `credit-service/tests/setup/globalSetup.ts` (created)
- `credit-service/tests/setup/env.ts` (modified)
- `credit-service/tests/helpers/db.ts` (modified)
- `credit-service/tests/services/credits.service.test.ts` (modified)
- `credit-service/tests/concurrency/reserve.concurrency.test.ts` (modified)
- `credit-service/vitest.config.ts` (modified)
- `credit-service/.env.test` (created; no header constraint, values are throwaway)
- `credit-service/.gitignore` (modified: un-ignore .env.test)
- `credit-service/API.md` (created)
- `credit-service/README.md` (modified)
- `compose.yaml` (modified: app-role env, init mounts, service connects as credit_app)
- `.env.example` (modified: CREDIT_APP_USER / CREDIT_APP_PASSWORD)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

- **Invented, listed in full in API.md §"What was invented":** all request/response bodies and status codes; the `{ error: { code, message } }` envelope; `ALREADY_RELEASED` on transfer and `ALREADY_TRANSFERRED` on release; `GET /health`; the role name `credit_app`; `ELEVATED_ROLE = 'admin'` as the rank threshold. Self-transfer is deliberately not rejected.
- **Order Service's client is incompatible with this API** — `reserve({ requesterId, amount }) → { reservationId }`, no requestId, no transfer method, wired to a stub. It must be rewritten against API.md.
- **F19.5.1 ships unauthenticated.** Blocked on the public key reaching this service, and on context §3 open question 1 (local RS256 verification vs calling `GET /auth/verify`).
- Applying the compose change required recreating the credit-db volume, since init scripts only run on an empty volume.

**What I kept/changed/rejected:**

**Author review:**

## 2026-10-17 — Stage 13: Auth Distribution Plan — JWKS Recorded in instructions.md

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs
**Scope:** Requirements formatting
**Governing decision:** The decisions themselves were made by the user in chat (quoted below); this task only formatted them into `instructions.md` as a new stage. Nothing in `instructions.md` Stage 13 was originated by the AI tool.

**Prompts (exact):**

> first read agents.md to find out what you can and can't do. keep that in mind.
>
> if i told you to convert my authentication method from making an API call to giving each individual service a public PKC key, what other info do you need for you to do that, while complying with the rules in agents.md? list them out so i can help you out.

> 1. Is it alright to put a new stage 13 in instructions.md detailing the changes that should happen, and telling it what to ignore from previous parts?
> 2. Currently using RS256. Basically when user service issues a JWT (using refresh / login), it will sign it (it has access to the private key). All other services will hold the public key.
> 3. I would think you would have the answer to this…?
> 4. Let's go with JWKS, since we want to rotate our keys.
> 5. All 3 services (order, supplier and credit). But don't implement their part for them. Help me come up with a guide for the implementors of those parts on how to access the JWKS endpoint and how to verify using the resulting public key.
> 6. On top of what is already in the token payload, add kid and aud.
> 7. Is the token lifetime not already set in the code?
> 8. Key rotation - let's do rotation once every 3 months. Link it to JWKT to allow for smooth transfer of keys.
> 9. Let's instantly switch to the new local verification.
> 10. Wouldn't you know better?
>
> do let me know if youre still missing information!

> 1: Let's do this
> 3: Let's continue with what we have.
> 7: Let's stick with what we have.
> 10: For documentation, remind me later after we're done implementing.
>
> New
>
> 1. Yes, put in the header I mean.
> 2. Scratch that. We don't need aud.
> 3. Let's do with auth.
> 4. Let's do env vars per key.
> 5. Let's remove the endpoint, and update hte docs accordingly.

> put the plan into stage 13 in instructions.md

**Key responses:**
Before answering, read `AGENTS.md` and classified the request: converting the auth scheme from an inter-service API call to JWKS-distributed public keys is an authentication-scheme/security-tradeoff decision under AGENTS.md §2.1, so declined to pick the scheme and instead listed the open decisions needed (algorithm, key distribution mechanism, scope, claims, token lifetime, rotation, migration plan, existing code to replace). Where the user deferred a decision back to the AI ("I would think you would have the answer to this", "Wouldn't you know better?"), did not choose for them — instead looked up the relevant facts in the existing codebase and reported them: the existing key pair at `user-service/keys/{private,public}.pem` is RSA-2048 (confirmed with `openssl rsa -noout -text`), `ACCESS_TOKEN_TTL_MINUTES=15` is already set in `user-service/.env`/`config.ts`, and the only existing inter-service-API-call auth consumer is `supplier-service/src/middleware/authenticate.ts` calling `GET /auth/verify` (`order-service` and `credit-service` have no auth middleware yet). Once every open item had an explicit team decision, wrote `instructions.md` Stage 13 (13a–13d) in the same design-decisions-table-plus-sub-stage format as Stages 8–12, encoding only what was decided — including a clarification that `kid` means the standard JWT header field, not a payload claim (per the user's follow-up), and that Stage 13d is a guide for the order/supplier/credit implementers, not code written on their behalf.

**Files:**

- `instructions.md` (modified: added Stage 13, sub-stages 13a–13d)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None — every open design/security point (§2.1) was referred back to the user and resolved by them before being written down; see the quoted prompts above for exactly which.

**What I kept/changed/rejected:**

**Author review:**

## 2026-10-17 — Stage 13a: Per-Key Config + Sign/Verify by `kid`

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md` "Stage 13: Auth Distribution — JWKS Instead of `GET /auth/verify`" design-decisions table (key/kid configuration, token claims, signing algorithm, key pair for this stage rows) and "Stage 13a: Per-Key Config + Sign/Verify by `kid`" section.

**Prompts (exact):**

> do you know the proper git workflow (branching etc)? can access the history for the previous stages i did for more information

> yes correct. go ahead

**Key responses:**
Confirmed the git workflow against actual history (`git log --merges`, branch list) rather than only memory, then branched `feat/stage-13a-jwt-key-config` from an up-to-date `main`. Implemented exactly the 13a spec:

- `config.ts`: added required `JWT_KEY_ID` and optional `JWT_PREVIOUS_KEY_ID` / `JWT_PREVIOUS_PUBLIC_KEY_PATH` to the env schema, exposed under `config.jwt`.
- `jwt.ts`: loads the current signing key as `{ kid, privateKey, publicKey }` and, if both previous-key env vars are set, a previous verification-only key. `signAccessToken` now sets the JWT header `kid` via `jsonwebtoken`'s `keyid` option (claims unchanged — no `aud`, per the user's revised decision). `verifyAccessToken` decodes the header first, looks the key up by `kid` among known keys, and verifies against the match; an unknown/missing `kid` fails the same way a bad signature already did. Added `getJwks()`, exporting each known public key via `crypto.createPublicKey(pem).export({format:'jwk'})` (no new dependency) plus `kid`/`use`/`alg`.
- `.env` / `.env.example` / `.env.test`: added `JWT_KEY_ID` (`.env`/`.env.example`: `2026-10`, local/gitignored for `.env`; `.env.test`: `test-key`), and documented the optional `JWT_PREVIOUS_*` pair as comments in `.env.example`.
- `tests/helpers/keys.ts`: `signToken`/`signExpiredToken` now default to `keyid: process.env.JWT_KEY_ID`, since hand-crafted test tokens need a `kid` the new `verifyAccessToken` can look up too.

Verification actually run: `tsc --noEmit` and `eslint .` both clean. `npx vitest run` (the `npm test` script runs Vitest in watch mode, which never exits, so used `vitest run` directly): 543 passed, 1 failed (`email.service.test.ts`, an unrelated OTP-template test). Confirmed that failure pre-exists on the unmodified branch by `git stash`-ing this stage's changes and rerunning just that file (same failure, same assertion), then `git stash pop` to restore. Running the real test DB required `docker compose up -d user-db`, which initially failed on an unrelated missing `CREDIT_APP_PASSWORD` in the repo-root `.env` (gitignored, local-only); filled it and four other already-stale vars from the already-published `.env.example` defaults, not a Stage 13a decision.

**Files:**

- `user-service/src/config.ts` (modified)
- `user-service/src/utils/jwt.ts` (modified)
- `user-service/.env.example` (modified; no header constraint beyond what's already there, listed for completeness)
- `user-service/.env.test` (modified)
- `user-service/.env` (modified; gitignored, local-only, not committed)
- `user-service/tests/helpers/keys.ts` (modified)
- `.env` (root; modified: added `CREDIT_APP_USER`/`CREDIT_APP_PASSWORD`/`SUPPLIER_*` from `.env.example`'s existing defaults so `docker compose` would run at all; gitignored, local-only, not committed, unrelated to Stage 13a's own change)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None against the 13a spec. The pre-existing `email.service.test.ts` failure and the stale root `.env` are environment gaps unrelated to this stage, not spec deviations (see Key responses).

**What I kept/changed/rejected:**
Accepted all changes

**Author review:** gabriel yap

## 2026-10-17 — Stage 13b/13c: JWKS Endpoint, Remove `GET /auth/verify`, Test Cleanup

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** `instructions.md` "Stage 13b: JWKS Endpoint" and "Stage 13c: Remove `GET /auth/verify` — Tests and Docs" sections (user-service tests subsection only — see Deviations below for the Docs subsection).

**Prompts (exact):**

> let's start the next stage

> do not touch anything that isn't user service. i will update the owner of the supplier service for changes that he needs to make.

**Key responses:**
Did 13b and 13c together in one branch/PR rather than shipping 13b alone with a known-red test suite, since 13c is the direct, non-optional fallout of 13b's removal (not an independently useful change) — flagged this packaging choice to the user rather than treating it as a design decision. Implemented:

- `auth.controller.ts`: removed the `verify` handler (and its now-unused `verifyAccessToken` import); added `jwks`, calling `getJwks()` from Stage 13a.
- `auth.routes.ts`: removed `router.get('/verify', ...)`; added `router.get('/.well-known/jwks.json', authController.jwks)`.
- `tests/controllers/auth.controller.test.ts`: replaced the `describe('GET /auth/verify', ...)` block with `describe('GET /auth/.well-known/jwks.json', ...)` (no-auth-required, JWK shape, `kid` round-trips with a freshly signed token) and a one-line `describe('GET /auth/verify', ...)` confirming it now `404`s. The two unrelated tests that reused `GET /auth/verify` purely as an "is this token still valid" check (under `POST /auth/logout` and under password reset) now check `GET /users/me` instead. Dropped `tamperSignature`/`signWithOtherKey` from this file's imports (no longer used here) and `app` from `authenticate.test.ts`'s imports (same reason).
- `tests/middleware/authenticate.test.ts`: removed the `describe('authenticate and GET /auth/verify agree on the same token', ...)` block; the `authenticate middleware` describe block above it is untouched.

When asked to start this stage, mid-implementation the user said not to touch anything outside `user-service` — they're notifying the supplier-service owner directly instead. This cuts the "Docs" part of Stage 13c's own spec (updating `supplier-service/SupplierServiceArchitecture.md §7` and `SupplierServiceSpec.md`), so that was skipped entirely; `instructions.md` was updated in place to record the scope correction (see Deviations). Checked root `README.md` for the auth-contract prose Stage 13c's spec also named — it has none (only two historical Log-index rows mentioning the old endpoint, left as-is since they describe what was true at the time).

Verification actually run: `tsc --noEmit` (both `src` and `tests/tsconfig.json`) and `eslint .`, all clean. `npx vitest run`: 533 passed, 1 failed — the same pre-existing, unrelated `email.service.test.ts` failure already confirmed in the Stage 13a entry above (re-confirmed here since the test count changed: was 543/1 before this stage's test removals, now 533/1, consistent with removing 9 `GET /auth/verify`-era tests and adding 3 new ones net).

**Files:**

- `user-service/src/controllers/auth.controller.ts` (modified)
- `user-service/src/routes/auth.routes.ts` (modified)
- `user-service/tests/controllers/auth.controller.test.ts` (modified)
- `user-service/tests/middleware/authenticate.test.ts` (modified)
- `instructions.md` (modified: recorded the Stage 13c scope correction — supplier-service docs are out of scope here)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
Per the user's instruction above, the "Docs" subsection of Stage 13c's written spec (updating `supplier-service/SupplierServiceArchitecture.md §7` and `SupplierServiceSpec.md`) was **not done** — the user is handling that by notifying the supplier-service owner directly. `instructions.md` Stage 13's scope note and Stage 13c's "Docs" subsection were both edited in place to record this correction, rather than silently diverging from the written plan.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-17 — Stage 13d: JWKS Verification Guide for Order/Supplier/Credit Implementers

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs
**Scope:** Refactor/Docs
**Governing decision:** `instructions.md` "Stage 13d: Guide for `order-service` / `supplier-service` / `credit-service` Implementers" section.

**Prompts (exact):**

> wait, i still want you to write instructions for the owners of the other services for me, just don't put it in the code / docs that they have.

> can you add "verify with RS256 only, never trust the token's alg header."

**Key responses:**
Per the user's "user-service only" scope rule from the previous task, placed the guide under
`user-service/docs/` (user-service is what publishes the JWKS contract this guide documents)
rather than inside `order-service/`, `supplier-service/`, or `credit-service/` — none of those
services' files were touched. The guide covers: the `GET /auth/.well-known/jwks.json` contract
and response shape; that the JWKS may list more than one key during a rotation overlap and
callers must not assume exactly one; the verify steps (cache by `kid`, refetch once on an
unknown `kid`, verify RS256, read `sub`/`role`); that `supplier-service`'s existing
`authenticate.ts` now calls a `404`ing endpoint and must be rewritten; and, per Stage 13d's own
instruction not to pick an implementation for them, named two common library shapes
(`jsonwebtoken`+`jwks-rsa`, or `jose`) without choosing one — each service's implementer makes
that call themselves. Added the user's verbatim algorithm-pinning instruction to the signature-
verification step (never trust the token's own `alg` header — pin `RS256` via the library's own
allow-list option, e.g. `jsonwebtoken`'s `algorithms: ['RS256']`), guarding against algorithm-
confusion attacks.

**Files:**

- `user-service/docs/jwks-verification-guide.md` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-19 — Credit Service D3 iteration 2: JWKS auth, transaction history, frontend wiring, public user lookup

**Tool:** Claude Code (model: claude-opus-5)
**Mode:** generate | debug
**Scope:** Implementation code | Debugging
**Governing decision:** `credit-service/credit-service-context.md` §3 (open question 1, now resolved), §6 (F19.5.1, F19.5.2), §7 (NFR8.2.1), §8 (API surface), §10 items 7–9; `user-service/docs/jwks-verification-guide.md` (the JWKS contract this service now consumes); ten team decisions given in chat on 2026-10-19 and quoted below.

**Prompts (exact):**

> Implement JWKS auth, transaction history, and frontend wiring for credit-service. Read credit-service/CONTEXT.md first.
>
> TEAM DECISIONS — implement these as given, do not revisit
>
> 1. Credit Service verifies access tokens itself against user-service's JWKS at GET /auth/.well-known/jwks.json. No calls to a verify endpoint; that endpoint is gone.
> 2. Use jose. Pin RS256 — never trust the token's alg header. Cache by kid, refetch once on an unknown kid.
> 3. A transport failure reaching the JWKS is 503 IDENTITY_PROVIDER_UNAVAILABLE. Every other failure — bad signature, expired, wrong alg, malformed, unknown kid after a refetch — is 401.
> 4. Do not invent a key or a fallback that skips verification.
> 5. F19.5.2: GET /credits/transactions returns the caller's own history. Keyset pagination, 20 a page, newest first.
> 6. F20.2: GET /credits/transactions/all is the administrator view. Elevated role only, same field set.
> 7. Administrator means rank >= admin, by the same ROLE_RANK comparison user-service uses, so super admin is not denied.
> 8. The frontend resolves counterparty names. Credit Service returns UUIDs only and stores no user display data. Do not add names to the API response.
> 9. Work in frontend/ only. foc-mockup/ is the frozen D1 artefact — do not touch it.
> 10. Do not containerise the frontend. Out of scope; another owner.

> Three changes, then the PR. Read credit-service/CONTEXT.md first.
>
> ## 1. Public user lookup — user-service (NOT my service)
>
> ## 2. Errand ID on transaction rows — frontend Wallet page
>
> ## 3. Switch counterparty resolution to the new endpoint
>
> Touch only what this endpoint needs; do not refactor anything else in user-service, and follow its existing conventions for routes, controllers and validation rather than importing credit-service's patterns.
>
> Leave `Author review:` blank in the file headers; I sign those. Show me the diff for anything outside credit-service/ before applying — user-service/ and frontend/ both count.

**Key responses:**

_Auth (decisions 1–4, 7)._ `src/auth/verifyAccessToken.ts` builds one process-level `createRemoteJWKSet` over `USER_SERVICE_URL` + `/auth/.well-known/jwks.json`; jose does the `kid` cache and the refetch-on-miss, and `algorithms: ['RS256']` pins the algorithm at the verify call rather than trusting the token header. The 503-vs-401 split in decision 3 is an explicit allowlist (`isKeySetUnreachable`): `JWKSTimeout`, the connect-level errno codes, and `TypeError: fetch failed`. Anything not on that list — an unknown `kid` that survives the refetch included — falls through to 401, so a cryptographic failure can never be reported as an availability problem. `src/middleware/auth.ts` splits `requireAuth` / `requireElevated` / `requireSelfOrElevated`; the seam left disabled last iteration in `requireBalanceAccess.ts` is now a composed handler pair rather than a TODO.

_History (decisions 5–6, 8)._ Keyset pagination on `(created_at DESC, transaction_id DESC)` behind an opaque base64url cursor, because OFFSET skips or repeats rows as new transactions land at the head. The administrator view reuses the same row shape, so the two endpoints cannot drift. No display names anywhere in the response, per decision 8.

_Frontend (decisions 9–10)._ `restoreSession()` was already broken before this change and had to be repaired first: it read `sub` and `role` from `/users/me` and from `/auth/refresh`, and neither response carries them, so every reload silently dropped the session. It now decodes those two claims from the access token itself. The Wallet page then reads the real balance and a lazily paged history.

_Public lookup (second prompt)._ `GET /users` and `GET /users/:id` are both `authorize('admin')`, so decision 8 was only half-implementable: an ordinary user could never resolve a counterparty's name. Added `GET /users/public?ids=` and `GET /users/public/:id`, `authenticate` only — id and username, nothing else. Route order is load-bearing and carries a comment saying so: `/public` must precede `/:id`, or the literal "public" is captured as an id. The batch is capped at 50. Followed user-service's own conventions throughout (zod in the controller, `asyncHandler`, `AppError`, a thin service over a query function) rather than importing credit-service's patterns, per the instruction above.

_Errand reference._ Every row with a `request_id` now shows it, transfers included. Before, a transfer showed only its counterparty, so a reservation and the transfer that settles it read as two unrelated movements of the same credits.

**Verification actually run:**

- credit-service `npx vitest run`: 9 files, **75 passed**.
- user-service `npx vitest run`: **533 passed, 16 failed**, and the new `tests/controllers/users.public.controller.test.ts` passes in full (15 tests). Every other suite passes. The 16 failures are in two files this task did not touch: one is the pre-existing `email.service.test.ts` failure already recorded in the Stage 13a and 13b/13c entries above, and the other 15 are the whole of `config.test.ts`, which `spawnSync`s `node_modules/.bin/tsx` directly. On Windows that path is an extensionless shell shim, so the spawn fails with `ENOENT` and every case in the file reports `status null`. Reproduced outside vitest; it is a host-platform issue, not a regression.
- End-to-end over HTTP against the running containers, 12 checks all passing: a non-admin resolves a counterparty name while `GET /users/:id` still refuses that same caller with 403; an admin still resolves; 51 ids rejected with 400 and exactly 50 accepted; an unknown id omitted rather than raising; no token refused with 401; the body carries `id` and `username` only; a non-UUID rejected; the single-id form resolves, and 404s on an unknown id.
- In a browser as a non-admin: one page of 20 rows carrying two distinct counterparty ids produced **exactly one** `GET /users/public` request with both ids, not twenty. Transfer rows render as `To superadmin · Errand 9dd8f3ea` directly above `Reservation · Errand 9dd8f3ea`.
- Outage: with `foc-user-service` stopped, the wallet still rendered 20 rows, the balance and every errand reference; names degraded to shortened ids (`To e1944b04`); the only failed request was the swallowed 502 on the lookup, and there were no page errors.

**Files:**

- `credit-service/src/auth/verifyAccessToken.ts` (created)
- `credit-service/src/middleware/auth.ts` (created)
- `credit-service/src/types/express.d.ts` (created)
- `credit-service/tests/helpers/jwks.ts`, `tests/http/auth.test.ts`, `tests/http/transactions.test.ts` (created)
- `credit-service/src/config.ts`, `src/controllers/credits.controller.ts`, `src/db/queries/credits.queries.ts`, `src/middleware/requireBalanceAccess.ts`, `src/routes/credits.routes.ts`, `src/services/credits.service.ts` (modified)
- `credit-service/API.md`, `credit-service/credit-service-context.md`, `.env.example`, `.env.test`, `package.json`, `package-lock.json` (modified)
- `compose.yaml` (modified: `USER_SERVICE_URL` for credit-service)
- `frontend/src/api/credits.js` (created)
- `frontend/src/api/auth.js`, `frontend/src/pages/Wallet.jsx`, `frontend/vite.config.js` (modified)
- `user-service/src/routes/users.routes.ts`, `src/controllers/users.controller.ts`, `src/services/users.service.ts`, `src/db/queries/users.queries.ts` (modified)
- `user-service/tests/controllers/users.public.controller.test.ts` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

1. **A new user-service endpoint was needed before decision 8 could work at all.** Decision 8 puts counterparty-name resolution in the frontend, but every existing lookup route is admin-only, so for an ordinary user the decision was unimplementable. `GET /users/public` closes that gap; its shape (id + username, a batch of up to 50, unknown ids omitted) was specified by the user in the second prompt above, not chosen by the AI tool.
2. **The top-nav credit pill is still mock data.** `DemoContext` feeds it from `src/data`, not from Credit Service, so it can disagree with the Wallet page on the same screen. Out of scope here — flagged for whoever owns the shell.
3. **`order-service/src/clients/credits.client.ts` does not match `API.md`.** It is a stub with an incompatible contract (`reserve({ requesterId, amount }) → { reservationId }`, no `requestId`, no transfer method). Not touched — another owner.
4. **`config.test.ts` cannot pass on Windows.** All 15 of its cases spawn `node_modules/.bin/tsx`, which has no executable extension, so `spawnSync` returns `ENOENT` and `status null` on a Windows host. Unrelated to this task and left alone, but worth a fix (`shell: true`, or spawning `tsx.cmd` on win32) by whoever owns that file.
5. **No `Author review:` signatures.** Left blank in every header per the instruction above, and per AGENTS.md §4.1.

**What I kept/changed/rejected:**
Accepted all changes. `frontend/package-lock.json` was additionally reverted: its only diff was seven incidental `"peer": true` annotations from a local `npm ci`, with no dependency change.

## 2026-10-19 — Frontend: Restore Docker Vite proxy targets

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** debug | refactor
**Scope:** Debugging | Refactor/Docs
**Governing decision:** Existing Compose development workflow and frontend Vite proxy configuration.

**Prompts (exact):**

> frontend-1 | 12:24:57 PM [vite] http proxy error: /auth/refresh
> frontend-1 | Error: connect ECONNREFUSED 127.0.0.1:3001
> frontend-1 | at TCPConnectWrap.afterConnect [as oncomplete] (node:net:2083:16)
> frontend-1 | 12:24:58 PM [vite] http proxy error: /auth/refresh
> frontend-1 | Error: connect ECONNREFUSED 127.0.0.1:3001
> frontend-1 | 12:25:05 PM [vite] http proxy error: /auth/login
> frontend-1 | Error: connect ECONNREFUSED 127.0.0.1:3001

**Key responses:**
The frontend container had the correct `VITE_USER_SERVICE_URL` environment variable, but `vite.config.js` hardcoded `localhost` targets. Restored environment-configured targets with localhost fallbacks for host-run Vite and added the Compose credit-service target. Verification was run by inspecting the resolved Compose environment and service status; frontend rebuild and proxy smoke testing remain to be run after the configuration change.

**Files:**

- `frontend/vite.config.js` (modified)
- `compose.dev.yaml` (modified)
- `README.md` (modified)
- `ai/usage-log.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I kept all changes.

**Author review:**
tng wen xi

## 2026-10-20 — Frontend: Post errand through Order Service

**Tool:** Copilot SDK (model: unspecified by runtime)
**Mode:** refactor
**Scope:** Implementation code
**Governing decision:** Existing `POST /orders` route and `CreateOrderPayload` contract in `order-service/src/routes/orders.routes.ts` and `order-service/src/types/orders.ts`

**Prompts (exact):**

> help me call the backend POST /orders when the button is clicked

**Key responses:**
Added a frontend `createOrder` API client and connected the Create Request button to submit the existing form fields to `POST /orders`. The page now shows a loading state, displays API errors, and navigates to `/activity` only after a successful response. No tests were run; frontend lint/build verification remains to be completed.

**Files:**

- `frontend/src/api/orders.js` (modified)
- `frontend/src/pages/CreateRequest.jsx` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
I kept all changes.

**Author review:**
tng wen xi

## 2026-10-20 — Order Service #4: Credit reservation saga (pending orders, outbox, worker reserve/release)

**Tool:** Claude Code (model: claude-opus-5-5)
**Mode:** generate | refactor
**Scope:** Implementation code
**Governing decision:** George Yeo's design decisions for issue #4, given in chat on 2026-10-19 and 2026-10-20 (quoted below; kept in his personal notes, not yet written into the repo). Credit contract: `credit-service/API.md`. Outbox/relay/dead-letter mirrored from `supplier-service/SupplierServiceArchitecture.md` §8.1 and its `src/queue`, `src/worker`, `src/persistence` code, per the decision "do what congchen does".

**Prompts (exact):**

> #4 - when an order request created, i will produce the order object first, then use the id as idmpkey to pass into credit service to reserve, if fails perform compensation and send notification by event bus (redis) and socket, by the saga pattern

> #4 order status is set to pending (new state) at creation, while the reserving from credit service, if it fails once, we notify user failure and to retry, if success pending -> open, this happens async, so on frontend the button will have loading spinner while reply is not received yet

> #4 go to cancelled, retries make a new order, pending is hidden yes

> #4 what do you mean release? if the reservation fails that means no credits is reserved so no further action needs to be done other than cancelling the order, yes drop adjust

> #4 if reserve keeps failing then we will release, there is no recovering orders in pending, they will automaticalyl retry with bullmq and on mega failure it is cancelled + released credits back

> 1. only transient
> 2. 5 attempts at powers of 2
> 3. how can we resolve this properly?
> 4. yes success
> 5. yes final outcome only
> 6. separate worker container

> ok lets do the same dead_letter_jobs solution, what else is pending

> 1. outbox too
> 2. do what congchen does
> 3. yes
> 4. by redis
> 5. make events in redis
> 6. make events and pass failure
> 7. just follow convention this isnt part of design decisions
> 8. what do you mean
>    9.same
> 9. defer
> 10. resolved by client
> 11. 2s
> 12. yes
> 13. what refresh flow, the 15min is for the socket not the JWT
> 14. can we make a foreign table to map the bigint to uuid
> 15. no it will not thats supplier service job on client
> 16. no keep it personal md for nkw

> ok we dont have to literally plan every single little detail now, you can just do it based on convention

> lets begin coding, keep me in the loop, and if any gaps appear inform me immediately and wait for my decision

> 1. drop the reservationId column first, then do a
> 2. return 202
> 3. what are the options
> 4. is it better to keep some sort of adapter to access credit api? or should we connect directly to credit api? i lean toward adapter if thats convention
> 5. success

> 3. no timeout
> 4. a
>
> verification a

> 1. use a string code that makes sense
> 2. admin will handle
> 3. ok use the same queue same as reserve for release, if not credits would never be released if credit is down>

> 6. ok then drop the results we dont need it for now
> 7. ok lets just make credits non-editable for now
>
> make the contract now for weejean and make it succinct and simple, no sources from who

> ok lets start coding

**Key responses:**

- **Schema / migration** (`20261020100000_credit_reservation_saga`, hand-written): `pending` added to `RequestStatus`; `requests.reservationId` dropped; `outbox` and `dead_letter_jobs` tables with supplier-service's column set in order-service's naming style. Applied cleanly to a fresh Postgres 17 together with the two earlier migrations.
- **Create:** `createOrder` writes the order as `pending` and a `credit_reserve` outbox row (`{ requestId: order.id, userId, amount }`) in one Prisma interactive transaction; no credit call in the request path. `POST /orders` answers **202**.
- **State machine:** `pending → open` and `pending → cancelled` are system-only; the F17.2 deadline rule no longer applies to `pending`.
- **Release:** cancelling or expiring a funded order (`open`/`accepted`/`picked_up`) writes a `credit_release` outbox row in the same transaction as the status change, replacing Wen Xi's inline `credits.release(order.reservationId)` in `transitionOrder` and `runRequestMaintenance` (edit approved by George). A lost optimistic-lock race writes nothing.
- **Credit client:** real HTTP client for `POST /credits/reserve` and `/credits/release` per `API.md`, no timeout. Reserve `409 RESERVATION_ALREADY_EXISTS` = success; release `404 RESERVATION_NOT_FOUND` / `409 ALREADY_RELEASED` = success; 5xx and connection errors = transient; other 4xx = permanent. The stub remains for unit tests only; the API process no longer holds a credit client.
- **Worker (order-worker container):** outbox relay on a 1 s BullMQ job scheduler (enqueue as `outbox-<id>`, delete only after a successful enqueue, dead-letter unroutable rows, stop the tick if Redis refuses), plus a worker on `queue:order:credit`:
  - reserve ok → `pending → open` + notify;
  - permanent → `pending → cancelled`, no release, notify with credit-service's code;
  - transient → retry (5 attempts, BullMQ exponential backoff);
  - last attempt → cancel + queued release + notify, then the job fails and is written to `dead_letter_jobs`;
  - release ok → stamp `creditReleasedAt`; transient → retry; permanent → dead-letter without retries.
- **Notifications:** `Notifier.notify(userId, event, payload)` port, log-only until issue #6.
- **Edit:** `credits` removed from the editable fields, so it now returns `INVALID_FIELD`.
- **Config:** `CREDIT_SERVICE_URL` in `env.ts`, both `.env.example` files and the `order-worker` block of `compose.yaml`.
- **Verification run in the AI workspace:**
  - `tsc --noEmit` clean;
  - `oxlint --type-aware` clean (0 warnings);
  - `vitest run` 328/328;
  - `test:e2e` 8/8 against a local Postgres 17 (new `test/credit-saga.e2e-spec.ts` runs the saga with real transactions; credit-service and Redis are faked);
  - `npm run build` OK;
  - `prisma/seed.ts` ran against the migrated DB.
  - The Prisma client was generated with `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true`, because the schema-engine download is blocked there.
- **Not verified:**
  - `src/worker.ts` against a real Redis/BullMQ (no Redis available);
  - `prisma migrate dev` / drift check (engine unavailable);
  - calls against a running credit-service.

**Files:**

- `order-service/prisma/schema.prisma` (modified)
- `order-service/prisma/migrations/20261020100000_credit_reservation_saga/migration.sql` (created)
- `order-service/prisma/seed.ts` (modified)
- `order-service/src/clients/credits.client.ts` (modified)
- `order-service/src/clients/credits.client.spec.ts` (created)
- `order-service/src/config/env.ts` (modified)
- `order-service/src/domain/order-status.ts` (modified)
- `order-service/src/services/orders.service.ts` (modified)
- `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/services/orders.transition.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.ts` (modified)
- `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `order-service/src/routes/orders.routes.ts` (modified)
- `order-service/src/app.ts`, `order-service/src/app.spec.ts`, `order-service/src/server.ts` (modified)
- `order-service/src/worker.ts` (modified)
- `order-service/src/db/outbox.repository.ts`, `order-service/src/db/dead-letter.repository.ts` (created)
- `order-service/src/queue/tasks.ts`, `order-service/src/queue/bull-queue.ts` (created)
- `order-service/src/worker/credit-jobs.ts`, `order-service/src/worker/credit-jobs.spec.ts` (created)
- `order-service/src/worker/outbox-relay.ts`, `order-service/src/worker/outbox-relay.spec.ts` (created)
- `order-service/src/notifications/notifier.ts` (created)
- `order-service/test/health.e2e-spec.ts` (modified)
- `order-service/test/credit-saga.e2e-spec.ts` (created)
- `order-service/.env.example`, `.env.example`, `compose.yaml` (modified)
- `ai/usage-log.md`, `README.md` (modified: this entry and its Log index row)

**Deviations / questions raised for the team:**

1. **Picked by convention and flagged for George's review, not decided:**
   - new tables use order-service's camelCase column names;
   - queue key `queue:order:credit`, with task names `credit_reserve` / `credit_release` following supplier-service's convention;
   - 1 s base for the powers-of-2 backoff (1/2/4/8 s);
   - events `order:created` (reservation succeeded) and `order:cancelled` with a `reason` (reservation failed), following the `order:<pastTenseVerb>` convention;
   - failure reason `RESERVE_RETRIES_EXHAUSTED`;
   - `CREDIT_SERVICE_URL` default `http://localhost:3003`.
2. **`pending` orders are still returned by `GET /orders` when no status filter is given.** Hiding them is part of issue #11 (default filter `open`).
3. **Not touched, raised to George:**
   - `editOrder` does not check that the order is `open` (F18.1.1);
   - `createOrder` validates `supplierId` as a UUID while supplier-service ids are BIGINT;
   - nothing calls `POST /credits/allocate` (user-service TODO);
   - transfer on completion is not implemented (the queue contract is pending Wee Jean).
4. **Wen Xi's code changed with George's approval:** the cancel/expire release paths, the seed, and `credits` editability.
5. **Decisions are not yet written in the repo.** The governing decision above is chat-only.

**What I kept/changed/rejected:**
I set the design: create as `pending`, reserve asynchronously, return 202 with a frontend spinner, use outbox and dead letters the same way as Congchen’s supplier-service, and run the worker in its own container. I also changed failure handling from “a failed reserve has nothing to release, just cancel” to “if reserve keeps failing then we will release,” limited retries to transient errors at 5 attempts with powers-of-2 backoff, rejected a timeout, made credits non-editable rather than adjusting the reservation, dropped the transfer result queue, and told Claude not to push at all after its one push attempt was refused with a 403.

**Author review:** george-yeo

## 2026-10-20 — Order Service #4: Automatic re-drive of transient credit-release dead letters

**Tool:** Claude Code (model: claude-opus-5-5)
**Mode:** generate | refactor
**Scope:** Implementation code
**Governing decision:** George Yeo's decisions in chat, 2026-10-20 (quoted below), following a local test in which a release dead-lettered during a credit-service outage.

**Prompts (exact):**

> lets do b

> 1. only transient ones
> 2. restart the retries for each dead letter release every minute
> 3. no limit, go indefinitely
> 4. yes, only credit_release

**Key responses:**

- `src/worker/release-redrive.ts` runs every minute on a BullMQ job scheduler (`queue:order:release-redrive`) in the order-worker container. It selects `dead_letter_jobs` rows where the task is `credit_release`, the status is `UNRESOLVED`, and the trace contains the transient-release failure message.
- For each row it runs one transaction:
  - claims the row (`UNRESOLVED` → `REDRIVEN`, guarded so two passes cannot re-drive it twice);
  - inserts a fresh `credit_release` outbox row.
- The relay then enqueues the new row as a new job with a full set of retries. If that job also runs out, it is dead-lettered again and re-driven on a later pass, with no limit.
- Permanent release rejections and `credit_reserve` dead letters are never re-driven.
- `startRelay`'s scheduler code was factored into `src/queue/scheduled-task.ts` and reused.
- The `REDRIVEN` status value and the queue key were named by convention.
- **Verification in the AI workspace:**
  - `tsc --noEmit` clean;
  - `oxlint` clean;
  - `vitest run` 328/328;
  - `test:e2e` 11/11 against a local Postgres 17, including 3 new re-drive cases (re-drive + no double re-drive, permanent and reserve rows left alone, re-driven release completing end to end);
  - build OK.
- **Not verified:** the scheduler against a real Redis.

**Files:**

- `order-service/src/worker/release-redrive.ts` (created)
- `order-service/src/queue/scheduled-task.ts` (created)
- `order-service/src/worker/outbox-relay.ts` (modified)
- `order-service/src/worker/credit-jobs.ts` (modified)
- `order-service/src/worker.ts` (modified)
- `order-service/test/credit-saga.e2e-spec.ts` (modified)
- `ai/usage-log.md`, `README.md` (modified)

**Deviations / questions raised for the team:**

- During a long credit-service outage, each stuck release adds a new dead-letter row per cycle (about one per minute plus the job's own retry time). The old rows are kept as `REDRIVEN`, so the table grows until the outage ends.

**What I kept/changed/rejected:**
Claude set out the options for release dead letters, and I picked automatic re-drive of transient failures only, every minute, with no limit.

**Author review:** george-yeo

## 2026-10-20 — Order Service #5: Accept request + validation

**Tool:** Claude Code (model: claude-opus-5-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** Issue #5's scope (GitHub, AY2627S1-CS3219-P18/FoC #5) and George Yeo's decisions in chat, 2026-10-19 (quoted below). The route follows the existing `POST /orders/:id/<action>` transition routes from PR #110.

**Prompts (exact):**

> #5 - when order is accepted, perform validation as stated, then do optimistic locking, if fail return fail error code, so user can retry or perform new action, no automatic retries

> #5 expired means past completeBy (if not null), the status codes just use the usual codes 5xx 4xx, on accept, open -> accepted -> picked_up -> delivered, and past completeBy, requester can transition accepted and picked_up but not delivered to cancelled

> #5 self-accept is 403, rest 409

> build a new branch on top of this one

**Key responses:**

- **Route:** `POST /orders/:id/accept`, using the existing generic transition controller and `transitionOrder`. The optimistic lock is the existing version-conditional `updateMany`; there are no automatic retries. On success, `courierId` = actor and `acceptedAt` = server time.
- **Expiry (F11.2.2):** `checkTransition` now rejects accepting an order at or past its `completeBy` with a new `ORDER_EXPIRED` error, even before the minute-by-minute expiry sweep has marked it `expired`. It uses the same `lte now` boundary as the sweep. The role check runs first, so a requester accepting their own expired order still gets 403.
- **Status codes:**
  - self-accept → 403 `FORBIDDEN` (existing `open→accepted: ['other']` rule);
  - past complete-by → 409 `ORDER_EXPIRED` (new mapping);
  - expired, cancelled, pending or already-assigned order → 409 `INVALID_TRANSITION` (existing);
  - lost race → 409 `ORDER_CONFLICT` (existing).
- **Domain spec:** the exhaustive matrix now covers `pending` (system-only exits from issue #4).
- **Verification in the AI workspace:**
  - `tsc --noEmit` clean;
  - `oxlint` clean;
  - `vitest run` 392/392;
  - `test:e2e` 12/12 against a local Postgres 17, including 8 concurrent accepts on one order producing exactly one winner;
  - build OK.

**Files:**

- `order-service/src/routes/orders.routes.ts` (modified)
- `order-service/src/domain/order-status.ts` (modified)
- `order-service/src/domain/order-status.spec.ts` (modified)
- `order-service/src/constants/errors.ts` (modified)
- `order-service/src/controllers/orders.controller.ts` (modified)
- `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `order-service/test/credit-saga.e2e-spec.ts` (modified)
- `ai/usage-log.md`, `README.md` (modified)

**Deviations / questions raised for the team:**

- `ORDER_EXPIRED` (code name and the message "This request has expired.") was named by convention.
- Running the role check before the expiry check is an ordering choice; it was made so the requester's 403 is stable.
- Notifying the accepting user and propagating the change to viewers (F12.1.2, F12.1.5) is issue #6 and is not done here.
- Auth still uses the `x-user-id` header, as in all existing routes.

**What I kept/changed/rejected:**
I set the rules (403 for self-accept, 409 for everything else, no automatic retry), and Claude only implemented them.

**Author review:** george-yeo

## 2026-10-20 — Order Service #11: Listing filters, keyset pagination, location ids

**Tool:** Claude Code (model: claude-opus-5-5)
**Mode:** generate | refactor
**Scope:** Implementation code
**Governing decision:** Issue #11's scope (GitHub, AY2627S1-CS3219-P18/FoC #11) and George Yeo's decisions in chat, 2026-10-19/20 (quoted below).

**Prompts (exact):**

> #11 - this is simple registry of filters mapped to the prisma function to filter

> #11 add indexes to credits, completeBy, and deliveryLocation too

> #11 we can do exact, since delivery location is supplied by supplier service so its not freeform input, listing paginate at 50, default status filter? what is that mean, 400 status

> also i am changing order service to take ids from supplier service instead

> #11 default is open

> do both sequentially, 11 then 6, make each its own branch built on top of order-accept-request then on each other

> 1. oh right, lets update the column now, do a
> 2. do b, rest api
> 3. soonest expiring first, the user can configure the sorting operation too
> 4. match expiresAfter, so if no completeBy it would match expiresAfter=Never
> 5. invalid status

> 1. a
> 2. match supplier, convert it
> 3. ok we will update the frontend later

**Key responses:**

- **Schema / migration** (`20261020120000_listing_filters`, hand-written):
  - deletes existing order rows (dev data; free-text locations cannot be mapped to ids);
  - replaces `deliveryLocation` TEXT with `deliveryLocationId` INTEGER (the supplier-service location id; INTEGER to match `supplierId`, George 2026-10-20 — originally BIGINT);
  - adds single-column indexes on `credits`, `completeBy` and `deliveryLocationId`.
  - The migration applied cleanly to a fresh Postgres 17 together with all earlier migrations.
- **API:**
  - Create and edit take `deliveryLocationId` (a positive integer within INTEGER range).
  - The column is INTEGER, so it serialises as a JSON number. (An earlier version of this commit used BIGINT and an Express `json replacer`; both were dropped when George matched it to `supplierId`.)
  - The seed uses location ids 1–9.
- **Listing** (`GET /orders`, new `services/order-listing.service.ts`):
  - **Filter registry:** each query parameter maps to a parse step and a Prisma `where` builder, and the conditions are AND-ed: `status`, `location` (exact id), `minCredits`, `maxCredits`, `expiresBefore` and `expiresAfter`. `expiresAfter` also matches orders with no `completeBy`.
  - **Defaults:** `status=open`; `pending` is rejected as an invalid status.
  - **400s:** unknown or repeated parameters, invalid values, `minCredits` > `maxCredits`, and invalid or mismatched cursors. An invalid status previously returned 500.
  - **Pagination:** keyset cursor, 50 per page (51 rows fetched to detect a next page). The response is `{ ok, orders, nextCursor }`.
  - **Sorting:** `sort` ∈ `completeBy | credits | createdAt` and `order` ∈ `asc | desc`, defaulting to `completeBy asc`. Orders with no complete-by come last ascending and first descending, with id as the tie-breaker.
- **Verification in the AI workspace:**
  - `tsc --noEmit` clean;
  - `oxlint` clean;
  - `vitest run` 418/418;
  - `test:e2e` 20/20 against a local Postgres 17, including 130 seeded orders walked page by page for all 6 sort/order combinations (no gaps, no duplicates, ordering matches an independent JS sort), combined filters, and pending orders hidden;
  - build OK;
  - seed ran.

**Files:**

- `order-service/prisma/schema.prisma`, `order-service/prisma/seed.ts` (modified)
- `order-service/prisma/migrations/20261020120000_listing_filters/migration.sql` (created)
- `order-service/src/services/order-listing.service.ts`, `order-service/src/services/order-listing.service.spec.ts` (created)
- `order-service/src/services/orders.service.ts`, `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.ts`, `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `order-service/src/constants/errors.ts`, `order-service/src/types/orders.ts`, `order-service/src/utils/validation.ts` (modified)
- `order-service/test/credit-saga.e2e-spec.ts` (modified)
- `ai/usage-log.md`, `README.md` (modified)

**Deviations / questions raised for the team:**

1. **Picked by convention and flagged for George's review:**
   - the query parameter names;
   - the sortable fields;
   - id as the tie-breaker and the null placement;
   - the opaque base64url cursor;
   - the error codes `UNKNOWN_QUERY_PARAMETER`, `INVALID_QUERY_PARAMETER` and `INVALID_CURSOR`;
   - the 400 for `minCredits` > `maxCredits`;
   - inclusive credit bounds and exclusive expiry bounds;
   - the `{ message }` error body.
2. **Frontend now out of date** (George: "we will update the frontend later"). It still sends and displays free-text `deliveryLocation`, and `frontend/src/api/orders.js` ignores `nextCursor`.
3. **`supplierId` still validated as a UUID,** while supplier ids are BIGINT. This was left as is pending George's decision on the mapping.

**What I kept/changed/rejected:**
I added the indexes on credits, completeBy and deliveryLocation, set default `open`, exact location match, `expiresAfter` including orders with no deadline, and 400 for an invalid status, moved `deliveryLocation` from free text to supplier-service ids, and today changed BIGINT to INTEGER.

**Author review:** george-yeo

## 2026-10-20 — Order Service #6/#59: Socket.IO order events, JWT auth, active deliveries

**Tool:** Claude Code (model: claude-opus-5-5)
**Mode:** generate | refactor
**Scope:** Implementation code
**Governing decision:** Issues #6 and #59 (GitHub, AY2627S1-CS3219-P18/FoC) and George Yeo's decisions in chat, 2026-10-19/20 (quoted below).

**Prompts (exact):**

> #6 - this will use redis + socket, with a central notifying controller

> #59 - this is same socket system, and frontend work

> #6 lets use socket.IO

> we will auth like credit-service does since its not service/admin critical like supplier service
> for socket, we will auth handshake payload by socket.io, and disconnect at exp and set callback to auth and reconnect after 15mins

> #6 we are sharing redis, using pub/sub for notifications since they are not critical, if client reconnects they will receive their backlog of notifications anyway (currently no backlog system yet so ignore that)

> 1. Event names and payloads
>    Events are named order:<pastTenseVerb>: order:created, order:accepted, order:cancelled, order:expired, order:completed.
>    Payloads are thin: { orderId, status, version, occurredAt }. order:created also carries the fields the listing card displays.
>    Clients discard events whose version is ≤ the version they already hold.
>    Event names and payload types live in a shared types file used by both frontend and backend.
> 2. Rooms
>    Room Joined by Purpose
>    user:{id} Server, automatically at connect (from the JWT) Personal updates, e.g. your order was accepted
>    order:{id} Server, from the DB (active orders where the user is requester or courier) Status changes for that order
>    listing Client emits listing:subscribe / listing:unsubscribe Open-request feed for couriers on the browse screen
>
> Clients never join a room by name directly. All order: joins are authorized server-side.
>
> 3. Where the notifying controller lives
>    The Order Service emits directly via io.to(room).emit(...). There is no separate gateway.
>    Emits happen only after the DB transaction commits, never inside it.
> 4. Multi-instance fan-out
>    Cross-replica emits go through @socket.io/redis-adapter (Redis pub/sub), reusing our existing Redis.
>    Clients use transports: ["websocket"], so no sticky sessions are needed.
>    Pub/sub is at-most-once, so pushes are hints. The REST API remains the source of truth.
> 5. 15-minute socket lifetime and reconnection
>    Auth: the JWT goes in the Socket.IO handshake auth payload and is verified in io.use(). On failure the server returns unauthorized and the client goes to login.
>    Expiry: the server schedules socket.disconnect(true) at the token's exp (15 min).
>    Reconnect: a server-initiated disconnect doesn't auto-reconnect, so the client calls socket.connect() on io server disconnect. auth is a callback that fetches a fresh access token on every attempt.
>    After reconnect: the server rebuilds the user: and order: rooms. The client re-subscribes to listing if it's on that screen, and re-fetches whatever it's displaying to cover events missed during the gap.
>    Dependency: the User Service must provide a refresh-token flow. ⚠️ To confirm.
> 6. 2-second latency requirement
>    Definition: from DB commit to event received by the client, for connected clients.
>    Target: p95 < 2s under a stated load (e.g. N concurrent sockets; N TBD).
>    Measurement: a load test with Artillery's Socket.IO engine, run with clients and server on the same host to avoid clock skew. Alternatively, the server timestamps the commit and measures the round trip via a Socket.IO ack; this RTT is an upper bound on one-way latency.

> 1. outbox too
> 2. do what congchen does
> 3. yes
> 4. by redis
> 5. make events in redis
> 6. make events and pass failure
> 7. just follow convention this isnt part of design decisions
> 8. what do you mean
>    9.same
> 9. defer
> 10. resolved by client
> 11. 2s
> 12. yes
> 13. what refresh flow, the 15min is for the socket not the JWT
> 14. can we make a foreign table to map the bigint to uuid
> 15. no it will not thats supplier service job on client
> 16. no keep it personal md for nkw

> do both sequentially, 11 then 6, make each its own branch built on top of order-accept-request then on each other

> 1. b, no need for dependency
> 2. can you explain more? what happens if we dont change to JWT
> 3. as NFR
> 4. skip for now
> 5. later

> ok switch to JWT too

**Key responses:**

- **Auth** (rebased 2026-10-20 onto Wen Xi's `src/middleware/authenticate.ts`, merged in PR #115; George: "keep hers"):
  - REST uses her JWKS middleware on all of `/orders` (the listing included). Any token problem, including an unreachable JWKS, returns 401.
  - Her token check was moved into an exported `createTokenVerifier` (same checks), which also returns `exp`. The Socket.IO handshake uses it.
  - `GET /orders/active` uses the same `req.user.user_id` check as her handlers.
  - The original version of this commit used `jose`, a per-route `requireAuth`, a public listing and a 503 for an unreachable JWKS. That was dropped in the rebase.
- **Socket.IO** (`src/realtime/socket-server.ts`), in the order-service process on the same HTTP server, websocket transport only:
  - The handshake `auth.token` is verified in `io.use()` with Wen Xi's verifier. Any failure → `connect_error` "unauthorized".
  - The socket is disconnected at the token's `exp`.
  - On connect the server joins `user:{id}` and the `order:{id}` rooms of the user's active orders (open/accepted/picked_up/delivered) from the DB, then emits `ready`.
  - `listing:subscribe` / `listing:unsubscribe` join or leave `listing`.
  - The Redis adapter runs over order-redis.
- **Events** (`src/realtime/order-events.ts`, `socket-sink.ts`):
  - Every committed transition and edit produces `order:created | accepted | pickedUp | delivered | completed | cancelled | expired | edited`.
  - Payloads are thin. `order:created` adds the listing-card fields; reservation failures add `reason`.
  - The courier joins `order:{id}` on accept, and order rooms are emptied at terminal states.
  - Each event is a single emit to the union of its rooms, so a socket in several of those rooms receives it once.
  - API writes emit directly through the adapter after commit.
  - The worker (reservation outcomes, expiry, auto-complete) publishes to a plain Redis pub/sub channel with ioredis. Each API replica subscribes and emits locally.
  - Publishing is best-effort.
  - The log-only `Notifier` from #4 was removed.
- **Active deliveries:** `GET /orders/active` (F12.1.3) returns the caller's accepted/picked_up/delivered orders as courier.
- **Config:**
  - `USER_SERVICE_URL` already came with Wen Xi's middleware.
  - order-service in compose got `REDIS_HOST/PORT`.
  - The e2e config now runs files sequentially (shared DB).
- **Dependencies added:**
  - `socket.io` and `@socket.io/redis-adapter` (decided);
  - `ioredis` (already present via BullMQ, now declared);
  - dev: `socket.io-client` (tests).
- **Verification in the AI workspace:**
  - `tsc --noEmit` clean;
  - `oxlint` clean;
  - `vitest run` 440/440;
  - `test:e2e` 27/27 against a local Postgres 17, run 3× in parallel mode and once sequentially. This includes 7 Socket.IO tests with a real server and real RS256 tokens: handshake rejection, disconnect at expiry, join on accept, room closed after completion, rooms rebuilt on reconnect, listing unsubscribe, one delivery per socket, and NFR5.1.1 (client request sent → server broadcast) asserted under 2 s;
  - build OK;
  - the compiled `dist/server.js` booted and answered `/health`, the public listing, 401 with no or bad token, and 503 with the JWKS unreachable.
- **Not verified:** the Redis adapter and the worker → API pub/sub path against a real Redis (unit-tested with fakes only), and calls against a live user-service.

- **After the rebase onto Wen Xi's auth (2026-10-20):** tsc, oxlint and prettier are clean, and the unit and e2e suites pass at this commit. The test helper now publishes a local JWKS so that the e2e suite exercises her verifier. The verification list above is from the original commit.

**Files:**

- `order-service/src/middleware/authenticate.ts` (modified: verifier extracted, Wen Xi's file)
- `order-service/src/realtime/order-events.ts`, `order-service/src/realtime/order-events.spec.ts` (created)
- `order-service/src/realtime/socket-server.ts`, `order-service/src/realtime/socket-sink.ts`, `order-service/src/realtime/socket-sink.spec.ts` (created)
- `order-service/src/notifications/notifier.ts` (deleted)
- `order-service/src/app.ts`, `order-service/src/app.spec.ts`, `order-service/src/server.ts`, `order-service/src/worker.ts` (modified)
- `order-service/src/routes/orders.routes.ts`, `order-service/src/controllers/orders.controller.ts`, `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `order-service/src/services/orders.service.ts`, `order-service/src/services/order-listing.service.ts` (modified)
- `order-service/src/worker/credit-jobs.ts`, `order-service/src/worker/credit-jobs.spec.ts` (modified)
- `order-service/src/config/env.ts`, `order-service/.env.example` (modified)
- `order-service/test/helpers/tokens.ts`, `order-service/test/realtime.e2e-spec.ts` (created)
- `order-service/test/health.e2e-spec.ts`, `order-service/test/credit-saga.e2e-spec.ts`, `order-service/vitest.config.e2e.ts` (modified)
- `order-service/package.json`, `order-service/package-lock.json` (modified; no header possible)
- `compose.yaml`, `ai/usage-log.md`, `README.md` (modified)

**Deviations / questions raised for the team:**

1. **Picked by convention and flagged for George's review:**
   - the per-event room mapping;
   - the camelCase `order:pickedUp` name;
   - joining the courier to the order room on accept and emptying order rooms at terminal states;
   - the `ready` event after room setup;
   - the `order-events` channel name;
   - the active-status set;
   - the `GET /orders/active` path;
   - `order:edited` (George asked for edit events);
   - `GET /orders` now requiring a token: this comes from Wen Xi's middleware, which George chose to keep.
2. **NFR5.1.1 measured as written** (client request sent → server broadcasts), per George. His earlier DB-commit → client-received definition is not used.
3. **Deferred by George:** the load test (N), the shared types file, and the frontend socket client. The frontend still has no Socket.IO client, and its Vite proxy has no `/socket.io` websocket route.
4. **Curl testing now needs a real user-service access token** (`Authorization: Bearer …`).

**What I kept/changed/rejected:**
I chose Socket.IO and designed the rooms and events, chose JWT after Claude flagged the `x-user-id` identity problem, and in the rebase rejected Claude’s `jose` verifier, public listing and 503 behaviour in favour of Wen Xi’s middleware, while Claude flagged the room mapping and event names as conventions for me to review.

**Author review:** george-yeo

## 2026-10-20 — Frontend: Order Service integration (create, live board, activity, Socket.IO client)

**Tool:** Claude Code (model: claude-opus-5-5)
**Mode:** generate | refactor
**Scope:** Implementation code
**Governing decision:** Issues #4, #5, #6, #11 and #59 (GitHub, AY2627S1-CS3219-P18/FoC), the Socket.IO design George Yeo gave in chat (quoted in the #6/#59 entry above), and George's answers below.

**Prompts (exact):**

> ok make a new branch now and connect up the frontend

> 1. what do you mean uuid, i thought we already changed it to bigint

> 1. ok change to bigint too, A
> 2. yes add it A
> 3. hide them first
> 4. ok

**Key responses:**

- **Rebased onto PR #115 (Wen Xi), 2026-10-20.** George kept her INTEGER `supplierId` (her migration `20261020211000_supplier_id_integer`), so the BIGINT change originally made here was dropped. He also kept this frontend, with her edit page carried over (see below).
- **Backend, commit 1 (order-service):**
  - New `GET /orders/mine?as=requester|courier` returns the caller's own orders, newest first, in every status (George: "yes add it A"). The path and the `as` parameter were picked by convention.
- **Frontend, commit 2:**
  - **Socket.IO client** (`src/realtime/orderSocket.js`, new dependency `socket.io-client`):
    - one connection per signed-in session, opened and closed from `DemoContext`;
    - websocket transport; `auth` is a callback that sends the in-memory access token, refreshing it first when it is missing or within 30 s of expiry;
    - reconnects on `io server disconnect` (token expiry); one forced refresh and retry on an `unauthorized` connect error; retries after 5 s on `identity_provider_unavailable`;
    - reference-counted `listing:subscribe`, re-sent after every `ready`;
    - hooks `useOrderEvents` and `useSocketReady`, and `watchOrderEvents` for a reply that may arrive before the HTTP response.
  - **API clients** (`src/api/orders.js`):
    - create, filtered and cursor-paged listing, `mine`, `active`, and accept/pickup/deliver/complete/cancel;
    - user-facing wording for the error codes and for the reserve-failure reasons.
  - `http.js` exposes `getAccessToken()`, and `ApiError` keeps the response body, because transition errors carry their code as `error`.
  - **Lookups** (`src/api/lookups.js`), each fetched once per id per page load:
    - supplier via `GET /api/v1/suppliers/:id`;
    - display name via user-service `GET /users/public/:id`;
    - location name from supplier-service's location reference list.
  - **Post an errand** (`CreateRequest.jsx`):
    - the delivery location picker uses the supplier-service location ids;
    - `POST /orders` (202), then a spinner until `order:created`, which goes to My activity, or `order:cancelled`, which shows the reason and keeps the form;
    - fallback: `/orders/mine` is re-checked every 5 s if no event arrives;
    - the stay-open and schedule fields stay hidden (George: "hide them first"; they were already commented out), and their unused state was removed;
    - empty additional details are sent as `null`, because the service rejects a missing field (see deviations).
  - **Find errands** (`RequestBoard.jsx`, `RequestCard.jsx`):
    - queries `status=open` with the service's filters and sorts: "3+ credits" → `minCredits=3`, "Expiring soon" → `expiresBefore=now+45 min`, a drop-off point picker → `location` (replaces the name-based "Near me" chip), and a sort picker for deliver-by, most credits, or newest;
    - "Load more" pages through `nextCursor`;
    - live updates from the `listing` feed: created → inserted in sort order if it matches the filters; accepted → "Taken"; cancelled/expired → removed; edited → refetch. A version guard ignores stale events, and the board refetches after every reconnect;
    - Accept calls the real route and shows 403 own-errand or 409 taken/expired/conflict text;
    - text search filters the loaded page in the browser only (the service has no text search).
  - **My activity** (`Activity.jsx`):
    - errands come from `/orders/mine` with `pending` hidden;
    - deliveries come from `/orders/active` plus the closed orders from `/orders/mine?as=courier`;
    - pick up, deliver, complete and cancel call their routes and show the rejection;
    - cancel on an accepted or picked-up errand appears only once deliver-by has passed (F17.2);
    - the lists refetch on order events and after a reconnect;
    - timeline stamps come from `createdAt`/`acceptedAt`/`deliveredAt`.
  - **Vite proxy:** `/socket.io` (ws) → order service.
  - **Edit page (Wen Xi's, carried over after the rebase):**
    - `/requests/:id/edit` loads the errand from `/orders/mine` and mounts the same form with the errand's fields, hiding the offer.
    - Saving sends `PATCH /orders/:id/edit` with the location id, `completeBy` (or `null`) and details (or `null`).
    - The Activity Edit button opens the page.
- **Verification in the AI workspace:**
  - order-service: tsc clean, oxlint clean, 447 unit and 27 e2e tests passing, build OK.
  - frontend: `vite build` OK, and oxlint reports no warnings in the changed files.
  - **Browser end-to-end** (Playwright/Chromium against Vite). Backends:
    - the real order-service app and Socket.IO server on Postgres 17, with the in-memory adapter (no Redis available);
    - a simulated credit worker;
    - stub user and supplier services.

    Each check below passed:
    - post → spinner → My activity (≈0.3–0.45 s);
    - another user's board receives the card live;
    - own errand not acceptable;
    - accept → requester's activity updates live;
    - pickup and deliver → requester sees Delivered live;
    - complete → both sides move it to History;
    - a reservation failure shows its reason;
    - 55 orders page as 50 + "Load more";
    - credit and location filters, and credit sort;
    - cancel removes the card live;
    - with WebSocket blocked, a post settles through the re-check (~5.1 s);
    - with 35 s tokens, the board is still live after the server's expiry disconnect.

- **Not verified:** a live user-service or supplier-service, and the Redis adapter or worker pub/sub path.

**Files:**

- `order-service/src/services/order-listing.service.ts` (modified)
- `order-service/src/controllers/orders.controller.ts`, `order-service/src/controllers/orders.controller.spec.ts`, `order-service/src/routes/orders.routes.ts` (modified)
- `frontend/src/realtime/orderSocket.js`, `frontend/src/api/lookups.js` (created)
- `frontend/src/api/orders.js`, `frontend/src/api/http.js`, `frontend/src/context/DemoContext.jsx` (modified)
- `frontend/src/pages/CreateRequest.jsx`, `frontend/src/pages/RequestBoard.jsx`, `frontend/src/components/RequestCard.jsx`, `frontend/src/pages/Activity.jsx` (modified)
- `frontend/vite.config.js` (modified)
- `frontend/package.json`, `frontend/package-lock.json` (modified; no header possible)
- `ai/usage-log.md`, `README.md` (modified)

**Deviations / questions raised for the team:**

1. **Picked by convention and flagged for George's review:**
   - the `/orders/mine?as=` path, parameter and ordering;
   - the 5 s re-check fallback while posting;
   - the token-refresh threshold (30 s);
   - one forced refresh on `unauthorized`;
   - the 5 s retry on `identity_provider_unavailable`;
   - "Near me" replaced by a drop-off point picker;
   - the sort labels;
   - browser-only text search;
   - the requester and courier names from `/users/public/:id`;
   - the user-facing error and reason wording;
   - a duplicate "Deliver by" cell in the expanded card changed to "Posted".
2. **Backend inconsistency (Wen Xi's validation):** `createOrder` treats a missing `additionalDetails` as invalid even though the code marks it optional. The frontend sends `null` instead; the service was not changed.
3. **Not wired, left as they were:**
   - the Edit button on an open errand (F18 editing UI);
   - Chat and the demo controls (still demo data);
   - the credit pill and Wallet (George: leave alone). The post form's "insufficient credits" check still uses the demo balance, and the real check is the reservation outcome.
4. **Pre-existing, not changed:** pages that require login open the login prompt before the session has been restored on a hard reload.
5. **Migrations delete order rows:** `20261020120000_listing_filters` deletes existing orders, so local data is lost.

**What I kept/changed/rejected:**
I corrected Claude on `supplierId` (I thought it was already BIGINT), asked for `/orders/mine` and for the stay-open and schedule fields to be hidden, and in the rebase kept Claude’s frontend over Wen Xi’s but kept her edit page, while replacing “Near me” and the search behaviour were Claude’s calls, flagged for me.

**Author review:** george-yeo

## 2026-10-20 — Order Service: `failed` status for failed reservations; login prompt on reload

**Tool:** Claude Code (model: claude-opus-5-5)
**Mode:** generate | refactor | debug
**Scope:** Implementation code | Debugging
**Governing decision:** George Yeo's decisions in chat, 2026-10-20 (quoted below). The previous decision that a failed reservation goes to `cancelled` (issue #4 entry above) is replaced by `failed`.

**Prompts (exact):**

> can we create a new status for orders? called failed
> the transition is only pending -> failed
> i dont want to see failed orders in my activity, because i see the cancelled orders from the BALANCE_NOT_FOUND ones early
>
> is that a good idea?

> add the new event
> filter out from /mine
> yes reject, invalid status
> new branch

> when i reload the page on the create errand page, why does it prompt me to log in again? even though im logged in

**Key responses:**

- **Declined:** "is that a good idea?" asks for a design judgement and trade-off analysis (schema change), which the policy prohibits. I gave the facts and the implementation impact instead, and asked four questions. George answered them.
- **`failed` status, commit 1:**
  - **Schema and transitions:**
    - `failed` added to `RequestStatus`, with the hand-written migration `20261020160000_failed_status` (`ALTER TYPE ... ADD VALUE`);
    - transition `pending → failed` (system only), and `failed` is terminal;
    - `pending → cancelled` was removed, because its only producers (the reservation failures) now go to `failed`. Flagged below.
  - **Worker:** both failure paths in `credit-jobs.ts` settle to `failed`: credit-service rejecting the reserve, and retries exhausted. The retries-exhausted path still queues a credit release, so `failed` joins `cancelled`/`expired` in the release check.
  - **Event:** a new `order:failed` event, with `reason`, sent to `user:{requester}` only. It replaces `order:cancelled` from `pending`.
  - **Listing:** `GET /orders?status=failed` returns 400 `INVALID_STATUS`, the same as `pending`.
  - **`/orders/mine`:** `GET /orders/mine` leaves out `failed` orders for both `as` values.
  - **Frontend:**
    - the post form waits for `order:created` or `order:failed`;
    - its `/orders/mine` re-check treats a just-created order that is missing from the list as failed, since that list now leaves failed orders out;
    - the socket client listens for `order:failed`.
- **Login prompt on reload, commit 2:**
  - Post an errand, My activity and Chat opened the login prompt before the session had been restored from the refresh cookie on a hard reload, and nothing closed it.
  - The prompt now waits for `sessionReady`, the same pattern `Wallet.jsx` already uses.
- **Verification in the AI workspace:**
  - order-service: tsc clean, oxlint 0 warnings, prettier clean, 514/514 unit tests, 27/27 e2e against a local Postgres 17 (all 6 migrations applied), build OK.
  - frontend: `vite build` OK, and oxlint reports no warnings in the changed files.
  - **Browser end-to-end** (Playwright/Chromium against Vite, with the real order-service app and Socket.IO, a simulated credit worker that now settles failures to `failed`, and stub user and supplier services). Each check below passed:
    - the full post → accept → pickup → deliver → complete flow;
    - a rejected reservation shows its reason;
    - the failed order is absent from My activity;
    - with WebSocket blocked, the re-check reports the failure after about 5.4 s;
    - reloading Post an errand while signed in no longer opens the login prompt.
  - API checks: `GET /orders?status=failed` → 400; `/orders/mine` omitted the failed order.
- **Not verified:** the logged-out case (the prompt still opens once the restore finds no session) was not run in a browser. The Redis path is unchanged and untested.

**Files:**

- `order-service/prisma/schema.prisma` (modified)
- `order-service/prisma/migrations/20261020160000_failed_status/migration.sql` (created)
- `order-service/src/domain/order-status.ts`, `order-service/src/domain/order-status.spec.ts` (modified)
- `order-service/src/worker/credit-jobs.ts`, `order-service/src/worker/credit-jobs.spec.ts` (modified)
- `order-service/src/services/orders.service.ts`, `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/services/order-listing.service.ts`, `order-service/src/services/order-listing.service.spec.ts` (modified)
- `order-service/src/realtime/order-events.ts`, `order-service/src/realtime/order-events.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.spec.ts`, `order-service/test/credit-saga.e2e-spec.ts` (modified)
- `frontend/src/pages/CreateRequest.jsx`, `frontend/src/realtime/orderSocket.js`, `frontend/src/api/orders.js` (modified)
- `frontend/src/pages/Activity.jsx`, `frontend/src/pages/Chat.jsx` (modified)
- `ai/usage-log.md`, `README.md` (modified)

**Deviations / questions raised for the team:**

1. **Picked by convention, flagged for George's review:**
   - removing `pending → cancelled`;
   - `order:failed` going to the requester's user room only;
   - the `/orders/mine` filter applying to `as=courier` too (a failed order never has a courier);
   - treating "missing from /orders/mine" as failed in the frontend re-check (that path has no reason, so it shows the generic message).
2. Existing `cancelled` rows that came from failed reservations are not migrated to `failed`. They stay in History until the local data is reset.

**What I kept/changed/rejected:**
I asked whether `failed` was a good idea, and after Claude declined to judge the policy and only listed the impact, I decided on a new `order:failed` event, filtered out of `/mine`, with `INVALID_STATUS` on the listing, while removing `pending → cancelled` was Claude’s convention call.

**Author review:** george-yeo

## 2026-10-20 — Order Service: F18.1.1 edit only when open; F9.1.1 optional additional details

**Tool:** Claude Code (model: claude-opus-5-5)
**Mode:** debug | refactor
**Scope:** Implementation code | Debugging
**Governing decision:** `docs/FoC-ProductBacklog.md` F18.1.1 ("requesters are only able to edit requests that are 'open'") and F9.1.1 ("Additional details [optional]"); George Yeo's instruction in chat, 2026-10-20 (quoted below). George had earlier confirmed that Wen Xi's order code may be edited.

**Prompts (exact):**

> [attached excerpt of my previous reply: "Wen Xi’s code: editOrder doesn’t check that the order is open, and create rejects a missing additionalDetails. The frontend sends null to work around it."]
> wait quickly fix that violation of the FR

**Key responses:**

- **F18.1.1:**
  - `editOrder` returns `ORDER_NOT_EDITABLE` (HTTP 409, "Only open requests can be edited.") unless the request is `open`.
  - The versioned `updateMany` also requires `status: 'open'`, so an accept that lands between the read and the write shows up as a version conflict instead of editing an accepted order.
  - The code name and the 409 follow the existing state-conflict codes; flagged below.
- **F9.1.1:** `createOrder` no longer rejects a missing `additionalDetails`; it is stored as `null`. A non-text value is still `INVALID_ADDITIONAL_DETAILS`. The frontend keeps sending `null` for empty details, and the stale workaround comment was removed.
- **Tests:**
  - unit: edit is refused for each non-open status; there is a 409 controller case; create succeeds without `additionalDetails`;
  - the edit fixtures now carry `status: 'open'`;
  - the missing-fields case no longer expects `INVALID_ADDITIONAL_DETAILS`.
- **Verification in the AI workspace:**
  - order-service: tsc clean, oxlint 0 warnings, prettier clean, unit tests 524/524, build OK. The order-service e2e suite (27 tests) ran 7 times against a local Postgres 17. Five runs passed in full; two runs each had one failure, in different tests both times:
    - `realtime.e2e-spec.ts` › token-expiry disconnect;
    - `credit-saga.e2e-spec.ts` › last transient failure.
      Neither failure reproduced in 4 further consecutive runs.
  - frontend: `vite build` OK.
- **Not verified:** the edit route from the browser (the Edit button is not wired).

**Files:**

- `order-service/src/services/orders.service.ts`, `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.ts`, `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `order-service/src/constants/errors.ts` (modified)
- `frontend/src/pages/CreateRequest.jsx` (modified)
- `ai/usage-log.md`, `README.md` (modified)

**Deviations / questions raised for the team:**

1. **Flagged for George's review:** the `ORDER_NOT_EDITABLE` name, its message, and the 409 status, picked by convention after `ORDER_EXPIRED`/`INVALID_TRANSITION`.
2. **Two intermittent e2e failures** were seen once each and have not been diagnosed. The token-expiry test uses a 1-second `exp` and may be timing-sensitive.

**What I kept/changed/rejected:**
I told Claude to fix the F18.1.1 and F9.1.1 violations it had found in Wen Xi’s code, and returning `ORDER_NOT_EDITABLE` with a 409 was Claude’s convention call.

**Author review:** george-yeo

## 2026-10-20 — Order Service + Frontend: rebase onto PR #115 (Wen Xi's auth, supplier ids, edit page)

**Tool:** Claude Code (model: claude-opus-5-5)
**Mode:** refactor
**Scope:** Implementation code | Refactor/Docs
**Governing decision:** George Yeo's choices in chat, 2026-10-20 (quoted below), after Wen Xi's PR #115 was merged into `main` (commits `10af4a5`, `de8fe1a`, `10dc6d2`, `b1bb1cd`, `4dc1344`).

**Prompts (exact):**

> hold on wenxi has made changes now, ive updated main, we need to undo anything she has already fixed/done

> 1. ok throw away ours
> 2. keep hers
> 3. ok lets use int instead
> 4. do a
>
> yes make it clean

**Key responses:**

- **Branches:** the six stacked branches were rebased onto `main` (`62c5d67`) commit by commit, with order-service and frontend checks at each branch tip. The pre-rebase heads are kept locally as `backup/<branch>`.
- **1. Supplier-service auth:** the local throwaway branch `tmp/supplier-jwks-local` was deleted. Wen Xi's `10af4a5` replaces it.
- **2. Order-service auth (hers kept):**
  - Removed from #6: `jose`, `src/auth/verify-access-token.ts` and its spec, `src/middleware/auth.ts`, the per-route `requireAuth`, and our `express.d.ts`.
  - Her middleware now covers all of `/orders`, the listing included.
  - Her token check was moved, unchanged, into an exported `createTokenVerifier`, which also returns `exp`. The Socket.IO handshake uses it. The `identity_provider_unavailable` connect error is gone; any failure is "unauthorized".
  - `getActiveDeliveries` and `getMyOrders` use her `req.user.user_id` + `isUuid` check.
  - The test helper now publishes a local JWKS and signs tokens with node:crypto, so the e2e suite runs through her verifier.
  - The token-expiry e2e test now uses a 2 s `exp` instead of 1 s, which fixes the intermittent failure noted in the F18.1.1 entry.
- **3. supplierId:** her INTEGER column (`20261020211000_supplier_id_integer`) and her create validation were kept. The BIGINT migration `20261020140000_supplier_id_bigint`, the BIGINT conversions and the edit-time supplier validation were dropped. That frontend-branch commit is now only "GET /orders/mine". `deliveryLocationId` was later matched to INTEGER as well (see the next entry).
- **4. Frontend (option a):**
  - Kept our create, board, card and activity implementations.
  - Carried over her edit page onto our form: `/requests/:id/edit` loads the errand from `/orders/mine` and saves with `PATCH /orders/:id/edit`. Her route in `App.jsx` is unchanged, and our Activity Edit button now opens it.
  - Her disclosure entries were kept in the headers of the four replaced files, with a note that their implementation was replaced.
- **Docs:** the #6 and frontend-integration entries above were corrected to describe what their rebased commits now contain. README log-index rows for our entries were renumbered after Wen Xi's (112 onwards).
- **Verification in the AI workspace, at the final branch tip:**
  - order-service: tsc clean, oxlint 0, prettier clean, 516/516 unit tests, 27/27 e2e, build OK.
  - frontend: `vite build` OK; oxlint shows only warnings that were already there in files we did not change.
  - **Browser end-to-end** (Playwright/Chromium against Vite, with the real order-service app and Socket.IO behind Wen Xi's JWKS auth, a fake user-service publishing a JWKS, a simulated credit worker and a stub supplier-service). Each check below passed:
    - `/orders` without a token → 401, with a token → 200;
    - post → My activity;
    - the board receives the card live;
    - edit page prefilled → save → My activity and the courier's board both show the change;
    - accept → pickup → deliver → complete;
    - a failed reservation shows its reason and stays out of My activity.
- **Not verified:** a live user-service or supplier-service, and the Redis paths.

**Files:**

- `order-service/src/middleware/authenticate.ts`, `order-service/src/app.ts`, `order-service/src/server.ts`, `order-service/src/routes/orders.routes.ts` (modified)
- `order-service/src/controllers/orders.controller.ts`, `order-service/src/controllers/orders.controller.spec.ts` (modified)
- `order-service/src/realtime/socket-server.ts`, `order-service/src/realtime/order-events.ts`, `order-service/src/realtime/order-events.spec.ts`, `order-service/src/worker/credit-jobs.spec.ts` (modified)
- `order-service/test/helpers/tokens.ts`, `order-service/test/realtime.e2e-spec.ts`, `order-service/test/credit-saga.e2e-spec.ts` (modified)
- `order-service/src/auth/verify-access-token.ts`, `order-service/src/auth/verify-access-token.spec.ts`, `order-service/src/middleware/auth.ts`, `order-service/prisma/migrations/20261020140000_supplier_id_bigint/migration.sql` (removed from the rebased stack)
- `order-service/package.json`, `order-service/package-lock.json` (`jose` removed; no header possible)
- `frontend/src/pages/CreateRequest.jsx`, `frontend/src/pages/Activity.jsx`, `frontend/src/components/RequestCard.jsx`, `frontend/src/api/orders.js` (modified)
- `ai/usage-log.md`, `README.md` (modified)

**Deviations / questions raised for the team:**

1. **`GET /orders` now needs a token** (her middleware). The board is only shown to signed-in users, so the frontend is unaffected.
2. **Edit didn't validate `supplierId`** (her code as merged). This is fixed in the next entry.
3. **Migration order on an existing local database:** her `20261020211000` may already be applied, and ours (`20261020100000`, `120000`, `160000`) have earlier timestamps. `prisma migrate deploy` applies them anyway; `migrate dev` may report the ordering. `20261020120000_listing_filters` deletes order rows.
4. **She edited the already-applied `20260927111937_create_requests` migration.** Databases that ran the original may show a checksum or drift warning.
5. Picked by convention: the shape of the extracted `createTokenVerifier`, and the 2 s test token.

**What I kept/changed/rejected:**
I threw away our throwaway supplier JWKS, kept her auth, switched to INTEGER and chose option a for the frontend, and Claude flagged her edit to an already-applied migration and the missing edit validation.

**Author review:** george-yeo

## 2026-10-20 — Order Service: deliveryLocationId as INTEGER; full edit validation

**Tool:** Claude Code (model: claude-opus-5-5)
**Mode:** refactor
**Scope:** Implementation code
**Governing decision:** George Yeo in chat, 2026-10-20 (quoted below), following his choice of INTEGER for `supplierId`. F18.1.2 ("edit 'open' requests' fields in accordance to F9.1.1"), `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**

> ok lets match deliveryLocationId to int to match, and also validate the edit

**Key responses:**

- **`deliveryLocationId` INTEGER** (folded into the #11 commit, so that PR shows the final shape):
  - the migration `20261020120000_listing_filters` adds the column as `INTEGER`, and the schema is `Int`;
  - the BigInt conversions in create and edit, the BigInt `location` filter parser and the Express `json replacer` were removed;
  - fixtures and seeds now use plain numbers;
  - `isPositiveSafeInteger` became `isPositiveInt` (1 to 2,147,483,647, the INTEGER range).
  - The later commits were rebased onto it: the #6 listing card no longer converts the id, and fixtures were updated.
- **Edit validation** (new commit at the top of the stack): `PATCH /orders/:id/edit` now validates every editable field with create's rules, before any database query:
  - `supplierId` (`isPositiveInt`) → `INVALID_SUPPLIER`;
  - `description` (non-empty text) → `INVALID_DESCRIPTION`;
  - `additionalDetails` (text or null) → `INVALID_ADDITIONAL_DETAILS`;
  - `deliveryLocationId` and `completeBy`, as before.
  - Create's `supplierId` check also uses `isPositiveInt`, so an id beyond the INTEGER range is a 400 rather than a database error.
- **Verification in the AI workspace:**
  - at the #11 tip: tsc clean, unit 418/418, e2e 20/20;
  - at #6: unit 433/433, e2e 27/27;
  - at the final tip: tsc clean, oxlint 0, prettier clean, unit 524/524 (new edit-validation cases), e2e 27/27, build OK.

**Files:**

- `order-service/prisma/migrations/20261020120000_listing_filters/migration.sql`, `order-service/prisma/schema.prisma`, `order-service/prisma/seed.ts` (modified, in the #11 commit)
- `order-service/src/utils/validation.ts`, `order-service/src/services/order-listing.service.ts`, `order-service/src/services/order-listing.service.spec.ts`, `order-service/src/app.ts` (modified, in the #11 commit)
- `order-service/src/services/orders.service.ts`, `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/controllers/orders.controller.spec.ts`, `order-service/test/credit-saga.e2e-spec.ts` (modified, in the #11 commit)
- `order-service/src/realtime/order-events.ts`, `order-service/src/realtime/order-events.spec.ts`, `order-service/src/worker/credit-jobs.spec.ts`, `order-service/test/realtime.e2e-spec.ts` (modified, in the #6 commit)
- `ai/usage-log.md`, `README.md` (modified)

**Deviations / questions raised for the team:**

1. **Applying the migration change to a local database:** the #11 migration was edited in place (the stack is unmerged). A database that already ran it as BIGINT needs `npx prisma migrate reset`.
2. **Picked by convention:** the INTEGER upper bound in `isPositiveInt`, and applying it to create's `supplierId` too.

**What I kept/changed/rejected:**
I asked for `deliveryLocationId` to match the INTEGER location and for edits to be validated, while the INTEGER upper bound and applying it to create were Claude’s calls.

**Author review:** george-yeo

## 2026-10-21 — Stage 14a: Schema + Config

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** instructions.md Stage 14 ("Design decisions (already made, do not change)" table) and Stage 14a ("Schema + Config")

**Prompts (exact):**

> look thru agents.md for AI instructions. look through stage 14 in instructinos.md. let me know if there's any other info you need in order for you to implement stage 14. do not start first.

> do you know the git workflow?

> let's go for stage 14a

**Key responses:**

- Added `outbox_status_enum` (`pending`/`sent`/`dead`) and the `credit_allocation_outbox` table to `init.sql`, using the exact DDL given in Stage 14a and the same safe-creation (`DO $$ ... EXCEPTION WHEN duplicate_object`) pattern as the existing enums.
- Added `CREDIT_SERVICE_URL` to `.env.example` and `.env` (`http://credit-service:3003`, matching the Docker service name convention already used for `DB_HOST`) and to `.env.test` (`http://localhost:3003`, per the stage's instruction since no test calls it yet).
- Added `CREDIT_SERVICE_URL` to the Zod schema in `config.ts` as `z.string().url()` (required), and exposed it as `config.creditService.url` with a trailing slash stripped (`.replace(/\/$/, "")`).
- Verified: `npm run build` (tsc) clean, `npm run lint` (eslint) clean, existing `tests/config.test.ts` unaffected (the new var is required-but-satisfied in `.env.test`, so none of its missing-var or SMTP cases needed changes).
- Did not run the Docker-based verification steps from the stage (`docker compose down -v && docker compose up --build`, `\d credit_allocation_outbox`, removing `CREDIT_SERVICE_URL` to check the exit-with-named-error path) — Docker was not running in this environment. These still need to be run by hand.

**Files:**

- `user-service/src/db/init.sql` (modified)
- `user-service/.env.example` (modified)
- `user-service/.env` (modified)
- `user-service/.env.test` (modified)
- `user-service/src/config.ts` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-21 — Stage 14b: Outbox Queries

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** instructions.md Stage 14b ("Outbox Queries")

**Prompts (exact):**

> done, let's move on

**Key responses:**

- Created `src/db/queries/creditOutbox.queries.ts` with the six functions specified in Stage 14b: `insertCreditAllocation` (transaction-only, no `db` default, `RETURNING id`), `findDueCreditAllocations` (pending rows due now, ordered by `next_attempt_at, created_at`, `LIMIT $1`), `markCreditAllocationSent`, `markCreditAllocationDead`, `recordCreditAllocationFailure` (single conditional `UPDATE` computing the exponential-backoff-with-jitter `next_attempt_at` in SQL via `clock_timestamp()`/`random()`/`power()`, with `maxAttempts`/`baseDelaySeconds`/`maxDelaySeconds` passed as query parameters, not hard-coded), and `replayDeadCreditAllocations` (`ids: string[] | null`, `null` means all `dead` rows).
- Every state-changing query is a conditional `UPDATE ... WHERE status = '<expected>'` (per the stage's "convention 3" note) and returns whether a row was actually updated, following the existing `(result.rowCount ?? 0) > 0` pattern used elsewhere in the queries layer (e.g. `activateUser`, `consumeOtp`).
- Followed the existing `Queryable`/`db = pool` convention from `tokens.queries.ts` / `otp.queries.ts` / `users.queries.ts`.
- Verification: `npm run build` (tsc) clean, `npm run lint` (eslint) clean. Per the stage, functional verification of these queries is deferred to Stage 14c–14e, where the relay and replay script exercise them.

**Files:**

- `user-service/src/db/queries/creditOutbox.queries.ts` (created)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-21 — Stage 14c: The Relay

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** instructions.md Stage 14c ("The Relay")

**Prompts (exact):**

> let's go

**Key responses:**

- Created `src/services/creditOutbox.relay.ts`:
  - `classifyResponseStatus(status)` — pure function implementing the Outcome → action table exactly (2xx and 409 → `sent`; 400/401/403/404/500 → `dead`; 408/425/429 and every other 5xx → `retry`; every other 3xx/4xx → `dead`). Sanity-checked by hand against every row of the table in a throwaway script (not committed — the stage defers tests).
  - `deliverCreditAllocation(userId)` — POSTs to `${config.creditService.url}/credits/allocate` with a 3 s `AbortSignal.timeout`; maps a timeout to `{ action: 'retry', error: 'TIMEOUT' }` and any other thrown error to `{ action: 'retry', error: 'NETWORK <cause.code ?? UNKNOWN>' }`; on a response, classifies the status and, for `dead`/`retry`, reads the body only to pull a `code` field (ignored if not JSON), formatting `last_error` as `HTTP <status>` or `HTTP <status> <code>`, never storing the body.
  - `runOutboxPass()` — loops `findDueCreditAllocations(BATCH_SIZE)` groups with no wait between groups, delivers each group concurrently via `Promise.allSettled`, and routes each outcome to `markCreditAllocationSent` / `markCreditAllocationDead` / `recordCreditAllocationFailure` (passing `MAX_ATTEMPTS`/`BASE_DELAY_SECONDS`/`MAX_DELAY_SECONDS`); a `false` return from those is left unhandled (ignored), per the stage.
  - `startCreditOutboxRelay()` — runs a pass immediately, then chains the next pass `POLL_INTERVAL_MS` after the previous one finishes via `setTimeout` (not `setInterval`); a pass that throws is caught and logged with a single `console.error` line (message only, no response bodies) and the relay continues; `stop()` cancels the pending timer and awaits any in-flight pass.
- Updated `src/server.ts` to call `startCreditOutboxRelay()` after the existing bootstrap calls. `app.ts` is untouched, so the relay never starts under the test harness.
- `server.ts` has no shutdown-signal handling today, so per the stage's own instruction ("If it doesn't, do not add signal handling in this stage") `stop()` is not wired to any signal — flagged to the user previously, no change made.
- Verification: `npm run build` (tsc) clean, `npm run lint` (eslint) clean, confirmed `app.ts` does not reference the relay. Docker was not running in this environment, so the stage's live-relay checks (pending → sent against a running credit-service, backoff/dead-letter behavior, batch-of-5 grouping, `user-db` outage logging) were not run — still need to be exercised by hand.

**Files:**

- `user-service/src/services/creditOutbox.relay.ts` (created)
- `user-service/src/server.ts` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-21 — Stage 14d: Wire Into Activation and Bootstrap

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** instructions.md Stage 14d ("Wire Into Activation and Bootstrap")

**Prompts (exact):**

> go

**Key responses:**

- `src/services/auth.service.ts` (`verifyRegistrationOtp`): immediately after `activateUser(user.id, client)` returns `true`, added `await creditOutboxQueries.insertCreditAllocation(user.id, client)`, replacing the `// TODO(credit-service): emit user-registered event here` comment. Nothing else in the function changed — the response still does not wait for credit-service.
- `src/services/bootstrap.service.ts` (`bootstrapSuperAdmin`): wrapped `createSuperAdmin` and the outbox insert in one `withTransaction`, passing `client` to both; the outbox insert only runs `if (created)` (i.e. `createSuperAdmin` actually returned a row, not skipped by `ON CONFLICT DO NOTHING`). The existing "insert was skipped → re-check whether a super admin exists" logic after the transaction is unchanged, so an already-existing super admin still gets no outbox row.
- Verification: `npm run build` (tsc) clean, `npm run lint` (eslint) clean, confirmed the TODO comment is gone. Docker was not running in this environment, so the stage's live checks (register → verify → one outbox row → `sent` with a 20-credit balance; two concurrent verify-otp requests → exactly one outbox row; fresh-volume bootstrap → exactly one super-admin outbox row; restart without `-v` → no new row; credit-service down → registration still returns `200`) were not run — still need to be exercised by hand.

**Files:**

- `user-service/src/services/auth.service.ts` (modified)
- `user-service/src/services/bootstrap.service.ts` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-21 — Stage 14e: Replay Script

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** instructions.md Stage 14e ("Replay Script")

**Prompts (exact):**

> let's go

**Key responses:**

- Created `src/scripts/replayCreditOutbox.ts`:
  - No arguments, or any argument that isn't `--all-dead` and isn't a UUID → prints usage to stderr and exits `1` (checked via a UUID regex, case-insensitive).
  - `--all-dead` as the sole argument → `replayDeadCreditAllocations(null)`; otherwise, every argument is validated as a UUID and passed as the explicit id list.
  - Prints the ids that were reset; for the explicit-id form, also prints the ids that were not reset (not found, or not `dead`), computed by diffing the input ids against the ids `replayDeadCreditAllocations` returned via `RETURNING id`.
  - Ends the pool in a `finally` after `main()`, regardless of success or failure; errors are caught, logged, and set `process.exitCode = 1`.
- Added `"outbox:replay": "tsx src/scripts/replayCreditOutbox.ts"` to `package.json`.
- Verification: `npm run build` (tsc) clean, `npm run lint` (eslint) clean. Manually ran the script with `.env` sourced for no-args, an invalid id, and `--all-dead` plus a stray extra argument — all three correctly printed usage and exited `1` (these paths return before touching the database, so they didn't need Docker). Docker was not running in this environment, so the DB-backed paths (replaying a real `dead` row by id, `--all-dead` resetting every dead row and nothing else, replaying a `sent`/`pending` row reported as not reset) were not run — still need to be exercised by hand, e.g. via `docker exec -it foc-user-service npm run outbox:replay -- --all-dead`.

**Files:**

- `user-service/src/scripts/replayCreditOutbox.ts` (created)
- `user-service/package.json` (modified — cannot carry a header comment)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-21 — Order Service: credit transfer job on completion (queue:credit:transfer)

**Tool:** Claude Code (model: claude-opus-5-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** The order-redis transfer queue contract George Yeo agreed with Wee Jean (2026-10-20): queue `queue:credit:transfer`, task `credit_transfer`, job id `outbox-<outbox id>`, payload `{ requestId, courierId }`, produced by the order-worker outbox relay; 5 attempts with exponential backoff at powers of 5, then credit-service's `dead_letter_jobs`; non-retryable errors dead-letter at once; no result queue. George's follow-up prompts are quoted below.

**Prompts (exact):**

> did you not make the redis queue?

> so you already built the queue right? and weejean can see it?

> wait so what queue is done and what isnt

> make a new branch ill make a new PR and doesnt the contract set tge attenpts and backoff?

**Key responses:**

- **What was missing:** order-service had no producer for `queue:credit:transfer`, so completing an order did not move any credits. I should have flagged this as an open item when George asked whether the PR was ready; that answer omitted it.
- **Producer:**
  - `transitionOrder` → `completed`, whether the requester confirms or the system auto-completes, now writes a `credit_transfer` outbox row with `{ requestId, courierId }` in the same transaction as the status change.
  - The existing relay sends it to `queue:credit:transfer` with job id `outbox-<id>`.
  - order-service has no consumer for this queue.
- **Retry split:** this answers George's question. The contract fixes the numbers. In BullMQ, the producer sets `attempts` and the backoff type when it adds the job, and the worker supplies a custom backoff's delays. So this queue gets `{ attempts: 5, backoff: { type: 'custom' }, removeOnComplete: true }`, and credit-service's worker supplies the 5/25/125/625 s delays and the dead letter. This is the same split as supplier-service (`supplier-service/src/queue/bullQueue.ts`). Order-service's own credit queue keeps its exponential defaults.
- **Not in this change:**
  - the credit-service consumer, its Redis connection to `order-redis`, and its dead-letter table (Wee Jean's side);
  - any compose change for credit-service.
- **Verification in the AI workspace:**
  - tsc clean, oxlint 0, prettier clean, unit tests 531/531 (new: completion queues the transfer for both the requester and the system; other transitions do not; relay routing; per-queue job options and job ids), build OK;
  - e2e 28/28 against Postgres 17. The new test runs a full lifecycle to `completed` and checks that the relay enqueues exactly one `credit_transfer` job, with `{ requestId, courierId }`, on `queue:credit:transfer`, with no dead letter.
  - Not run against a real Redis.

**Files:**

- `order-service/src/queue/tasks.ts`, `order-service/src/queue/bull-queue.ts` (modified)
- `order-service/src/queue/bull-queue.spec.ts` (created)
- `order-service/src/services/orders.service.ts`, `order-service/src/services/orders.service.spec.ts` (modified)
- `order-service/src/worker/outbox-relay.spec.ts`, `order-service/test/credit-saga.e2e-spec.ts` (modified)
- `ai/usage-log.md`, `README.md` (modified)

**Deviations / questions raised for the team:**

1. **Picked by convention, following supplier-service:**
   - which side sets which BullMQ option;
   - `removeOnComplete: true`.
2. **Wee Jean's consumer must:**
   - register a `backoffStrategy` returning 5 s × 5^(attemptsMade−1);
   - read `{ requestId, courierId }`;
   - treat `409 ALREADY_TRANSFERRED` as done;
   - dead-letter immediately on `404 COURIER_NOT_FOUND`, `404 RESERVATION_NOT_FOUND` and `409 ALREADY_RELEASED`.
     If his worker has no custom strategy, BullMQ fails retries of `custom`-backoff jobs.
3. **No outcome reaches order-service** (deferred). A completed order whose transfer dead-letters still reads `completed`.

**What I kept/changed/rejected:**

**Author review:**

## 2026-10-22 — Credit Service: BullMQ credit-transfer queue consumer

**Tool:** Claude Code (model: claude-opus-5)
**Mode:** generate | debug
**Scope:** Implementation code | Debugging
**Governing decision:** `credit-service/credit-service-context.md` §4 (stack, BullMQ approved 2026-10-22), §5 (append-only), §6 (F19.3.1, F19.3.2), §9 (the presented edge case this implements the retry half of); the transfer queue contract agreed with order-service on 2026-10-20, verified against its producer (order-service commit `cb7ed49`); twelve implementation decisions given in chat on 2026-10-22 and quoted below.

**Prompts (exact):**

> Implement the credit-transfer queue consumer in credit-service.
> Read credit-service/CONTEXT.md first.
>
> The producer is verified and matches the contract field for field (order-service commit cb7ed49). Do not re-analyse it.
>
> ## What the producer does — confirmed, build against this
>
> Queue key: queue:credit:transfer (prefix queue:credit, name transfer)
> Job name: credit_transfer
> jobId: outbox-<outboxId>
> Payload: { requestId, courierId } — exactly two keys
> Published: on completion, in the same prisma transaction as the status change, version-guarded
> Broker: order-redis:6379
> attempts: 5 (1 initial + 4 retries)
> backoff: { type: 'custom' } — delays are MY responsibility
> removeOnComplete: true
> removeOnFail: unset, so failed jobs stay in Redis
> Relay cadence: ~1s from completion to the job landing
> No reply is sent back to order-service.
>
> ## Decisions — implement as given, do not revisit
>
> 1. **Separate worker container**, mirroring supplier-worker […]
> 2. **BullMQ pinned to an exact version, no caret.** order-service's lockfile resolves 6.3.13. Record the dependency in CONTEXT.md §4 as an approved team decision.
> 3. **Register the backoff strategy. This is load-bearing.** […] `5000 * 5 ** (attemptsMade - 1)` → 5s / 25s / 125s / 625s. Verify the _observed_ delays in testing rather than trusting the config took.
> 4. **Error classification — one explicit table in code**, not scattered catch blocks […]
> 5. **dead_letter_jobs in credit-db, snake_case** […] Use `GENERATED ALWAYS AS IDENTITY`, not `BIGSERIAL`.
> 6. **Grants — surgical, per table.** […] Never `GRANT ... ON ALL TABLES IN SCHEMA public`.
> 7. **A dead-letter write failure must leave a trace.** […]
> 8. **Redis unavailable at startup, or disappearing mid-run, must not kill the container.** […] Propose something explicit and tell me what you chose and why.
> 9. **Concurrency and stall safety.** […] choose deliberately and say why.
> 10. **compose.yaml and .env.example**: a credit-worker service […] Show me both diffs before applying.
> 11. **Logging sufficient to narrate the workflow live** […]
> 12. `init.sql` only runs on an empty volume, so the new table needs `docker compose down -v` on credit-db. Say so before doing it […]

> Approved — apply both diffs, run docker compose down -v on credit-db, and proceed with the verification exactly as you proposed.
>
> Two things from the build prompt that your report didn't cover:
>
> - Item 9: what concurrency did you choose and why, and what did you check about BullMQ's 30s lockDuration against our transfer transaction?
> - Item 2: confirm package.json pins 6.3.13 exactly, no caret.
>
> Report the measured retry gaps as real numbers, not the configured values.

**Key responses:**

_One implementation, two entry points (decision 1)._ `src/worker/main.ts` is a second entry point into the existing `src/` tree; it calls the same `transferCredits` the HTTP route calls, so F19.3.1's logic, its guards and its single transaction exist once. `credit-worker` is a separate container built from the same context and image at `target: dev`, with an overridden command and the same bind-mounted `src`, mirroring supplier-worker.

_The contract in one file._ `src/queue/transferQueue.ts` holds the queue key, prefix, name, job name, attempts, payload guard and backoff. Everything there is fixed by order-service's producer rather than chosen here, and a change to any of it makes the worker subscribe successfully and receive nothing, so it is deliberately not configurable.

_Classification (decision 4)._ `src/worker/classifyTransferError.ts` is one `DISPOSITION_BY_CODE` map plus a two-line fallback, keyed on credit-service's own error `code`. Because the worker calls the service function directly it receives the `AppError` object, so the code is a typed field and nothing is inferred from an HTTP status. Unknown 4xx is permanent, 5xx and non-`AppError` throws retry.

_Backoff (decision 3)._ Registered as `settings: { backoffStrategy }` on the Worker. The producer publishes `backoff: { type: 'custom' }`, so BullMQ asks the worker for the delay and an unregistered strategy would silently drop the agreed schedule.

_Concurrency and stall safety (decision 9)._ `concurrency: 1`, chosen rather than copied: `transferCredits` takes `FOR UPDATE` on two balance rows in one transaction, so parallel jobs touching the same users would queue inside Postgres anyway, and one job at a time keeps a demo's log readable. `lockDuration` is left at BullMQ's 30 s default. The question was whether a transfer can exceed it: measured at **43.98 ms** from "job received" to "transferred credits" on the real end-to-end job, and 43.7 ms independently on another, roughly 680x of headroom, with no external call inside the transaction.

_Redis resilience (decision 8)._ Three options the siblings do not set, in `src/queue/redisConnection.ts`: `maxRetriesPerRequest: null` (required by BullMQ for a Worker — with a finite limit the worker stops consuming after an outage while still looking alive), an unbounded `retryStrategy` capped at 10 s (ioredis's default stops reconnecting in some modes), and `enableOfflineQueue: true`. The client is constructed explicitly rather than passed as options because BullMQ 6 treats ioredis as an optional peer and cannot load it under native ESM — see Deviations.

_Dead-letter write failure (decision 7)._ The insert has its own try/catch. On failure the whole job — payload, original error and the write error — goes to stderr with `DEAD-LETTER WRITE FAILED`, and the original error is still thrown so the job stays in BullMQ's failed set (`removeOnFail` is unset on the producer's side).

**Verification actually run:**

- `npx tsc --noEmit` clean. Full suite **123 tests in 13 files, all passing** (was 75 in 9).
- **Real end-to-end through order-service's REST API**, not a synthetic job: created an order (202 Accepted, `pending`), its reserve job moved the requester to 20/7 reserved, then accept → pickup → deliver → complete. The transfer landed **~1.0 s** after completion: requester 20 → 13, courier 20 → 27, and a `transfer` log row naming both parties for amount 7.
- Redelivery of an already-transferred request completed as **success**, logged `already applied (ALREADY_TRANSFERRED) … treating as success`, wrote no dead letter and moved no balance.
- Unknown courier dead-lettered on **attempt 1 of 5**, not the fifth: `UNRESOLVED` row carrying the full payload and an `error_trace` naming `COURIER_NOT_FOUND`, and the job remained in BullMQ's failed set.
- **Measured retry gaps**, from the worker's own log timestamps rather than the configured values: **5.098 s**, **25.008 s**, **125.003 s**, **625.034 s** (configured 5/25/125/625). Gaps 1-2 came from one run and 3-4 from a second, because an unrelated check restarted a container mid-run; the split is recorded rather than spliced. Corroborated independently by decoding Redis's own delayed-set score, which had attempt 5 scheduled exactly 625.000 s after attempt 4's failure. Attempt 5 then succeeded, credit-db having returned, so the run also shows the full ladder recovering rather than merely expiring.
- Duplicate jobId: publishing `dup-1` twice moved credits **once** (requester -4, courier +4, one `transfer` row). Note that BullMQ did _not_ dedupe the second publish - `removeOnComplete: true` had already freed the id - so the processor genuinely ran twice and the second was stopped by this service's own idempotency (the `ALREADY_TRANSFERRED` guard and the unique index), which is a stronger result than broker-level dedupe.
- Transient recovery: with credit-db stopped, attempts 1 and 2 failed with `getaddrinfo ENOTFOUND credit-db` classified `NON_APP_ERROR` → retry; when the database returned, attempt 3 transferred the credits and completed.
- Broker outage: stopped `order-redis`, restarted `credit-worker` so it started with no broker. The container stayed **Up**, logged `reconnecting in 2000ms` then `2500ms` (the `times * 500` strategy), and on Redis returning resumed consuming immediately — it processed the in-flight job's next attempt without a restart.
- NFR8.2.3 against the live database as `credit_app`: `DELETE FROM transaction_log` and `UPDATE transaction_log` both `permission denied`, while `UPDATE dead_letter_jobs SET status='RESOLVED'` succeeded. The surgical grant holds.
- Mutation checks, each applied then restored: flipping `COURIER_NOT_FOUND` to `'retry'` failed 2 tests at both levels; deleting `settings: { backoffStrategy }` failed **nothing**, which exposed a missing test — see Deviations.

**Files:**

- `credit-service/src/queue/transferQueue.ts` (created)
- `credit-service/src/queue/redisConnection.ts` (created)
- `credit-service/src/worker/classifyTransferError.ts` (created)
- `credit-service/src/worker/transferJobProcessor.ts` (created)
- `credit-service/src/worker/main.ts` (created)
- `credit-service/src/db/queries/deadLetter.queries.ts` (created)
- `credit-service/tests/worker/transferQueue.test.ts` (created)
- `credit-service/tests/worker/classifyTransferError.test.ts` (created)
- `credit-service/tests/worker/transferJobProcessor.test.ts` (created)
- `credit-service/tests/worker/workerWiring.test.ts` (created)
- `credit-service/src/db/init.sql` (modified: dead_letter_jobs)
- `credit-service/src/db/grants.sql` (modified: dead_letter_jobs privileges)
- `credit-service/src/config.ts` (modified: REDIS_HOST, REDIS_PORT)
- `credit-service/tests/db/append-only.test.ts` (modified: UPDATE case strengthened; dead_letter_jobs privilege block added)
- `credit-service/credit-service-context.md` (modified: §4 records BullMQ 6.3.13 and ioredis as the approved dependency)
- `credit-service/package.json`, `package-lock.json` (modified: bullmq 6.3.13 and ioredis 5.11.1 pinned exactly; worker scripts)
- `credit-service/.env.example`, `.env.test` (modified: REDIS_HOST, REDIS_PORT)
- `compose.yaml` (modified: REDIS\_\* on credit-service; new credit-worker service)
- `.env.example` (modified: comment recording credit-worker's broker)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

1. **ioredis had to be added as a second dependency.** BullMQ 6 declares ioredis an optional peer and loads it lazily; under native ESM, which this service is, that load fails with _"BullMQ could not load the optional 'ioredis' package … pass an already-constructed client instance instead"_. The worker logged that error in a loop and consumed nothing. Fixed by installing `ioredis` pinned to `5.11.1` — the version order-service's lockfile resolves — and constructing the client explicitly. It is BullMQ's own transport rather than a separate design choice, and is recorded in §4 alongside BullMQ, but it is a dependency beyond the stack as originally approved and the team should ratify it.
2. **A mutation check exposed a missing test, and the test was added because of it.** Deleting `settings: { backoffStrategy }` from the Worker left `tsc` and all 122 tests green: the suite covered the strategy _function_ but never its _registration_, which is the part that matters. `tests/worker/workerWiring.test.ts` now mocks `bullmq` and `ioredis`, imports `main.ts`, and asserts the constructed Worker's queue name, prefix, concurrency, connection options and registered strategy. With the mutation re-applied it fails.
3. **A test caught a real gap in what the dead letter records.** For a transient exhaustion the row's `error_trace` held only `"Error: Internal server error."` with no error code, while permanent failures carried theirs in the wrapped message. `errorTrace` now prefixes `[CODE]` for any `AppError`, so every row names the code an operator triages on.
4. **`order-redis` has no persistence configured.** Observed directly: a delayed retry _did_ survive `docker stop` / `docker start` of the Redis container, because the container filesystem and its default RDB snapshot survive that. It would not survive `docker compose down`, which removes the container. A transfer awaiting its 625 s retry is therefore lost on a full teardown, and the outbox row that produced it is already deleted, so nothing re-drives it. This is on order-service's side of the boundary and was raised with its owner.
5. **"A job exhausting all attempts lands in dead_letter_jobs" is proven at the unit level against the real database, not end to end.** The two conditions are coupled: at the integration level the only way to force a _transient_ failure is to make credit-db unreachable, and then the dead-letter write necessarily fails too. That path was exercised and is what decision 7's stderr trace exists for. The DB-up exhaustion path is covered by `transferJobProcessor.test.ts`, which asserts the row, its `UNRESOLVED` status and its `error_trace` against a real Postgres.
6. **Two things outside credit-service that were already broken.** `user-service` would not start: the team's stage-14 work made `CREDIT_SERVICE_URL` required, and nothing supplies it — fixed locally in the gitignored `user-service/.env`, so the repo still needs a real fix. And `user-service` logs `relation "credit_allocation_outbox" does not exist` on every relay pass, the same empty-volume problem `init.sql` has here. Neither was touched beyond the local env file.
7. **The four write endpoints remain unauthenticated**, unchanged by this work and still listed as invented in `API.md`. The worker does not go through HTTP, so the queue path is not affected, but the gap stands.

**What I kept/changed/rejected:**

**Author review:**

## 2026-10-22 — User Service: local dev setup guide for CREDIT_SERVICE_URL / SUPER_ADMIN_PASSWORD / JWT keypair

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** explain, docs
**Scope:** Debugging | Refactor/Docs
**Governing decision:** instructions.md Stage 3b/3c (user-service loads all config via `env_file: ./user-service/.env`, created by copying `.env.example`); instructions.md Stage 14a / `user-service/src/config.ts` (CREDIT_SERVICE_URL required, already in `.env.example`); `user-service/src/services/bootstrap.service.ts` (SUPER_ADMIN_PASSWORD complexity rule, already implemented)

**Prompts (exact):**

> Hey! Just a heads-up, the User Service is currently crashing on a fresh checkout because it requires CREDIT_SERVICE_URL, but that isn't defined in the compose.yaml. Could you add CREDIT_SERVICE_URL: http://credit-service:3003 to your environment block in the compose file so the stack boots up cleanly for the D3 demo?
>
> can you find the issue?

> wait so what does my teammate need to do to get it working?

> does this change if i'm using docker - should the env variables be my responsiblity since i'm doing user service?

> so should the line be in .env or in compose.yaml?

> so what exactly does my teammate need to do to fix the issue?

> but if it's gitignored, will they have a copy of it?

> and why did i choose to put my env variabels in .env instead of compose.yaml?

> what did the other services do? the same?

> is it a hassle to move everything to compose.yaml now?

> wait, so the super_admin_password in .env is actually used for the actual app when i boot it up? then how are my teammates supposed to get the password, if i shouldn't put it in .env.example

> so basically every teammate just needs to copy .env.example into user/.env, and fill in the missing values

> can give me a full list of instructions, and put it somewhere (maybe where the previous instructions on how to access the public key using jwks is)?

**Key responses:**
Investigated the reported "crashing on fresh checkout" claim by reading `compose.yaml`, `user-service/.env.example`, `user-service/src/config.ts`, and instructions.md Stages 3b/3c/14a. Found the requested fix (adding `CREDIT_SERVICE_URL` to an inline `environment:` block in `compose.yaml`) was not correct: `user-service` has no inline `environment:` block by design — it loads everything via `env_file: ./user-service/.env`, a gitignored, per-developer file, and `CREDIT_SERVICE_URL` was already correctly recorded in `.env.example` per Stage 14a. Declined to make the requested compose.yaml edit, since it would have introduced an inline environment block deviating from the recorded Stage 3b decision without the team authorizing that change (AGENTS.md §2.1). Explained the real cause (a stale local `.env` predating Stage 14a) and the actual fix (edit the local `.env` file, not compose.yaml). Also explained, from existing code/docs, that `user-service` differs from `order-service`/`credit-service`/`supplier-service` (which do use inline `environment:` blocks), why moving user-service's vars into compose.yaml would mean committing secrets (DB*PASSWORD, SMTP*_, SUPER*ADMIN_PASSWORD) to version control, and how `SUPER_ADMIN_PASSWORD` and the RS256 keypair work (confirmed against `bootstrap.service.ts` and `config.ts`'s Zod schema, and cross-checked against the existing gap flagged in a 2026-10-20-ish entry of this same log). Declined to invent a "why we chose env_file" rationale, since no such rationale is recorded anywhere in the docs and manufacturing one would be drafting a decision rationale (AGENTS.md §2, prohibited). Wrote `user-service/docs/local-dev-setup.md`, consolidating the already-decided setup steps (copy `.env.example`, set `SUPER_ADMIN_PASSWORD` to satisfy the existing complexity check, generate an RS256 keypair with `openssl genrsa`/`openssl rsa` into `user-service/keys/`, leave SMTP/TEST_USER*_ blank in development) into one guide, placed alongside the existing `jwks-verification-guide.md` in the same `user-service/docs/` folder per the user's request. No new requirements, architecture, schema, or API decisions were made; the guide restates decisions already recorded in instructions.md and already-implemented validation in `config.ts`/`bootstrap.service.ts`. No build/test run — this was a documentation-only change to a new Markdown file with no code touched.

**Files:**

- `user-service/docs/local-dev-setup.md` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

1. Declined the originally requested edit (adding `CREDIT_SERVICE_URL` to `compose.yaml`'s environment block for `user-service`) as inconsistent with the recorded Stage 3b `env_file` design; see rationale above.
2. Flagged again (previously flagged in an earlier log entry) that every fresh checkout needs a locally-set `SUPER_ADMIN_PASSWORD` and a generated RS256 keypair before `user-service` will boot — this is now documented in the new guide, but the underlying "first-run setup is manual and easy to miss" gap is unchanged. Not acted on beyond writing the guide, since adding e.g. an automated setup script would be a new tooling choice for the team to decide, not implied by the request.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-22 — User Service: merge jwks-verification-guide.md into local-dev-setup.md

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** refactor, docs
**Scope:** Refactor/Docs
**Governing decision:** instructions.md Stage 13d (original jwks-verification-guide.md content, restated verbatim); this is a documentation consolidation, not a new decision

**Prompts (exact):**

> can you merge jwks verificataion into this

**Key responses:**
Merged `user-service/docs/jwks-verification-guide.md` into `user-service/docs/local-dev-setup.md` as "Part 2", at the user's request (the file was open in their editor). Content was carried over verbatim (heading levels adjusted, one internal cross-reference updated), with a new disclosure header entry recording the merge and its original 2026-10-17 authorship (Stage 13d). Deleted the old file, then updated the three live documentation pointers to it that exist elsewhere in the repo — `credit-service/API.md:31`, `credit-service/credit-service-context.md:64`, `credit-service/src/config.ts:60` — to the new path. Left two other references untouched: `credit-service/src/auth/verifyAccessToken.ts` and `supplier-service/src/middleware/authenticate.ts` each mention the old filename only inside their own historical AI-disclosure header (describing what was true as of a past edit on 2026-10-19/2026-10-20); rewriting those would restate history rather than document current state, so they were left as-is. Also left every mention of the old filename inside `ai/usage-log.md` itself untouched, since that log is append-only and earlier entries are not to be edited. No code behavior changed; no build/test run (documentation-only change).

**Files:**

- `user-service/docs/local-dev-setup.md` (modified: merged in Part 2)
- `user-service/docs/jwks-verification-guide.md` (deleted)
- `credit-service/API.md` (modified: path reference)
- `credit-service/credit-service-context.md` (modified: path reference)
- `credit-service/src/config.ts` (modified: comment path reference)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
Accepted all changes.
**Author review:** gabriel yap

## 2026-10-22 — User Service: Docker-dependent verification of Stage 14 (outbox/relay/replay)

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** debug
**Scope:** Debugging | Implementation code
**Governing decision:** instructions.md Stage 14a-14e "Verification" sections (already-written checklists this entry executes); the one code change (`user-service/src/db/pool.ts`) applies node-postgres's own documented requirement to attach a `pool.on('error', ...)` listener, not a new design decision.

**Prompts (exact):**

> you know the git workflow?

> let's do the docker-dependent verification first then

**Key responses:**
Ran the full Docker-dependent verification matrix from instructions.md Stages 14a-14e end to end: `docker compose down -v && docker compose up --build` (approved by the user after the sandbox's auto-classifier flagged the volume deletion); confirmed `credit_allocation_outbox` table and `outbox_status_enum` schema; confirmed missing `CREDIT_SERVICE_URL` fails startup with a named error; exercised the relay against a live registration (OTP verify → 200 REGISTER_SUCCESS, one outbox row in the same transaction, delivered within ~1s, 20-credit balance on credit-service); confirmed a failed OTP verify creates no row; confirmed two concurrent correct verify-otp requests produce exactly one row; confirmed the super-admin bootstrap produces exactly one outbox row that gets delivered, and that restarting without `-v` does not duplicate it; stopped credit-service and confirmed the row stays `pending` with growing `attempts`/backoff and a `NETWORK ENOTFOUND`-style `last_error`, then confirmed delivery resumes once credit-service is back; backdated `next_attempt_at` repeatedly to drive a row to exactly 10 attempts and confirmed `dead`, and that the relay never picks a `dead` row back up; pointed `CREDIT_SERVICE_URL` at a nonexistent path to confirm a `404` goes straight to `dead` with `attempts = 1` and `last_error` starting `HTTP 404` (reverted after); reset a `sent` row to `pending` and confirmed redelivery gets `409` from credit-service, goes back to `sent`, and leaves the balance unchanged; inserted 12 due rows at once across 6 users and confirmed they all settled within ~1.1s (consistent with groups of 5 processed back-to-back, no inter-group wait); exercised `outbox:replay` for all documented cases - explicit dead ID, `--all-dead` against a mix of dead/pending/sent rows (only the dead ones reset, `attempts` zeroed, `last_error` left unchanged), replaying an already-`sent` or already-`pending` row reported as not reset, and no-args/invalid-UUID both printing usage and exiting `1`.

Two findings came out of this:

1. **Fixed - real bug, not a Stage 14 regression.** Stopping `user-db` while `user-service` was running crashed the process (`[nodemon] app crashed`), not just logged an error as Stage 14c's verification requires. Root cause: `user-service/src/db/pool.ts` (written in Stage 2c, long before Stage 14) never attached a `pool.on('error', ...)` listener, so an idle client's connection-reset surfaced as an unhandled EventEmitter `error` event. This is documented node-postgres behavior, unrelated to anything Stage 14 decided, and the first time this path got exercised was this verification run. Added the listener (one `console.error` line, same style the relay already uses); re-ran the test and the process now survives with one `console.error` line per failed pass.
2. **Investigated, no action needed.** First pass at this check (immediately after the crash fix) seemed to show the relay stuck forever after a `user-db` restart (`getaddrinfo ENOTFOUND user-db` on every pass for 60s+), so the entry originally logged this as a suspected Node/Alpine DNS-caching bug needing a team decision. Re-tested twice more with a patient, timestamped watch (`docker logs -t`) instead of giving up after 60s, including one clean run that was timed end-to-end: `user-db` stopped at 14:11:17, restarted at 14:11:26, one `ECONNREFUSED` logged at 14:11:26 (the DB was still coming up), then silence, and a row inserted afterward was `sent` within 3s - full recovery in well under 20s with zero manual intervention. Another run took closer to 90s before failures stopped. So the relay does resume on its own, as Stage 14c's verification requires; recovery time is just inconsistent (seconds to ~1-2 minutes) under Docker Desktop, most likely transient embedded-DNS/connection-retry timing rather than a permanent stuck state. The original "never recovers" conclusion was an artifact of not waiting long enough on the very first run, not a reproducible bug. No code change; nothing further needed.

Also hit an unrelated environment-only snag while bringing credit-service up fresh: `credit-service/src/db/grant-app-role.sh` failed inside `docker-entrypoint-initdb.d` with "bad interpreter: Permission denied" - the script's executable bit was not propagating through the Docker Desktop (macOS) bind mount, so `credit_app` was never created and `credit-service` couldn't authenticate. Worked around it for this session only by running `docker exec foc-credit-db bash /docker-entrypoint-initdb.d/02-grant-app-role.sh` by hand (no file changed, nothing committed); did not touch `grant-app-role.sh`'s permissions or `compose.yaml`, since this is a local macOS Docker Desktop quirk, not a code or schema issue, and may not reproduce on another machine or in CI.

Verification run: `npm run build`/`npm run lint` not re-run (no TypeScript changed beyond the one-line `pool.ts` fix, verified instead by exercising the actual running containers end to end, matching Stage 14's own "Verification" sections above).

**Files:**

- `user-service/src/db/pool.ts` (modified: added `pool.on('error', ...)`)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

1. `credit-service/src/db/grant-app-role.sh` not being executable through the Docker Desktop bind mount on this machine - worth the team checking whether this reproduces for others or only here, since it would otherwise silently leave `credit-service` unable to authenticate on a fresh `docker compose up --build`.

**What I kept/changed/rejected:**
Accepted all changes, KIVing the remaining deviation/question for now.

**Author review:** gabriel yap

## 2026-10-22 — Stage 15a: `activeView` on `GET /users/me`

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** instructions.md Stage 15a

**Prompts (exact):**

> let's start with the next stage

**Key responses:**
Read the current `getOwnProfile` (`user-service/src/services/me.service.ts`) and its controller (`getProfile` in `me.controller.ts`) first, confirmed neither existing test (`tests/controllers/auth.controller.test.ts`'s two `GET /users/me` calls) asserts the response's exact shape, so no test updates were needed for this sub-stage (per the "Changes to already-implemented code" table, that's Stage 15c's job). Changed `getOwnProfile` to also read `user.active_view` and return it as `activeView`, alongside the existing `username`/`email`. No other behavior changed. Verified against the running Docker stack (not just build/lint): logged in, confirmed `GET /users/me` returns exactly `{ username, email, activeView }`; called `PUT /users/me/active-view` to `courier`, confirmed the next `GET /users/me` reflects `activeView: "courier"`. `npm run build` and `npm run lint` both clean. `npm test`: 548 passed, 1 failed (549 total) - the one failure, `tests/services/email.service.test.ts > sendOtpEmail (SMTP path) > throws for a purpose that has no template, without sending`, is pre-existing and unrelated to this change (this branch never touches `email.service.ts` or its test): `email.service.ts`'s `PURPOSE_COPY` map already has a `"Change Email"` entry (added in Stage 12c per its own file header), so `sendOtpEmail` no longer throws for that purpose, but the test's expectation was never updated to match. Not fixed here, per Stage 15c's own instruction to stop and report rather than change a test failing for a reason other than key naming or the response shape - flagged below instead.

**Files:**

- `user-service/src/services/me.service.ts` (modified)

**Deviations / questions raised for the team:**

1. Pre-existing, unrelated test failure found while running the full suite: `tests/services/email.service.test.ts > sendOtpEmail (SMTP path) > throws for a purpose that has no template, without sending` expects `sendOtpEmail` to throw for purpose `'Change Email'`, but `email.service.ts` has had a `'Change Email'` template since Stage 12c, so it no longer throws. The test's expectation is stale, not the implementation. Left unfixed here per Stage 15c's instruction to stop and report rather than change it.

**What I kept/changed/rejected:**
KIVed the error for now, accepted all other changes.

**Author review:** gabriel yap

## 2026-10-22 — Fix: `bootstrapTestUser` missing credit-allocation outbox row

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** debug, generate
**Scope:** Debugging | Implementation code
**Governing decision:** instructions.md ("one `credit_allocation_outbox` row for that user, created in the same transaction; it becomes `sent` and credit-service shows a 20-credit balance"); same pattern already implemented in `bootstrapSuperAdmin` (Stage 14d) and the registration flow (`auth.service.ts`)

**Prompts (exact):**

> btw the bootstrap doesnt create the 20 credit balance yet so the test user breaks
>
> is there a bootstrap for regular user?

> wait can you remember the changes you did, and undo it first, i want to git commit my other cahnges first

> okay redo the changes, then do the git workflow

**Key responses:**
Found `bootstrapTestUser` (`user-service/src/services/bootstrap.service.ts`), the opt-in seeded-normal-user bootstrap (`TEST_USER_*` env vars). Confirmed it created the user row but never inserted a `credit_allocation_outbox` row, unlike `bootstrapSuperAdmin` right above it and the real registration flow in `auth.service.ts`, both of which insert the outbox row in the same transaction as user creation per the governing decision already recorded in instructions.md. This is implementing the existing decision consistently, not a new schema/architecture choice. Wrapped `bootstrapTestUser`'s `createUser` call in `withTransaction` and added `creditOutboxQueries.insertCreditAllocation(created.id, client)` in the same transaction, mirroring `bootstrapSuperAdmin`. Verified: `tsc --noEmit` clean; `vitest run tests/services/bootstrap.service.test.ts` - all 17 existing tests pass unchanged (no test currently asserts the outbox row for this path - flagged below).

**Files:**

- `user-service/src/services/bootstrap.service.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

1. No test asserts the test-user bootstrap now creates its outbox row (mirroring however/whether the super-admin path is tested for this). Flagged, not added, since adding test coverage wasn't asked for.

**What I kept/changed/rejected:**
Asked to add test cases.

**Author review:** gabriel yap

## 2026-10-22 — Fix: test coverage for the credit-allocation outbox row on `bootstrapTestUser`

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** same as the entry above (instructions.md credit-allocation outbox decision)

**Prompts (exact):**

> let's add one

**Key responses:**
Added `getCreditAllocationOutboxRows(userId)` to `tests/helpers/db.ts` - no existing test helper queried `credit_allocation_outbox`; confirmed `truncateAll('users CASCADE')` already clears it via the table's `ON DELETE CASCADE` on `user_id`, so no change to `truncateAll` was needed. Added a test in `bootstrap.service.test.ts` asserting `bootstrapTestUser` leaves exactly one `pending` outbox row for the new user. Verified: `tsc --noEmit` clean; `npm run lint` clean; `vitest run tests/services/bootstrap.service.test.ts` - 18 tests pass (the 17 from the prior entry plus this new one).

**Files:**

- `user-service/tests/services/bootstrap.service.test.ts` (modified)
- `user-service/tests/helpers/db.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-22 — Stage 15b: Paginated `GET /users`

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** instructions.md Stage 15b (Design decisions table and the Stage 15b section)

**Prompts (exact):**

> read through instruction.md. im gonna implement stage 15b onwards. dont do anything first

> follow the git workflow. before you start, do a pull to check whether there's anything i havent pulled

> let's do 15b

**Key responses:**
Read `instructions.md` Stage 15 in full (15a-16g) first, per the first prompt, without making changes. Confirmed `main` had nothing unpulled, then branched `feat/stage-15b-paginated-users` off `main`. Replaced `listAllUsers` in `users.queries.ts` with `listUsersPage({ usernameContains, email, status, role, sortBy, sortDir, limit, offset })`, returning `{ rows, total }`: dynamic `WHERE` built only from provided filters, all values bound; `usernameContains` goes through a `LIKE '%'||$n||'%' ESCAPE '\'` with `\`, `%`, `_` escaped first; `sortBy`/`sortDir` are mapped through a fixed whitelist (`SORT_COLUMNS`/`SORT_DIRECTIONS`), never interpolated; ties broken by `id` in the same direction; total via `COUNT(*) OVER()`, falling back to a separate `COUNT(*)` query when the page comes back empty (past the last page) since the window function then returns no rows to read the count from. Updated `users.service.ts`'s `listUsers` to take `{ page, username, email, status, role, sortBy, sortDir }`, added the `PAGE_SIZE = 50` constant and offset math, and return `{ users, page, pageSize, total, totalPages }`. Updated `users.controller.ts`'s `list` to validate `req.query` with a `.strict()` Zod schema: `page` defaults to 1 and must be a positive integer; `username`/`email` are optional, lowercased (email also trimmed), with empty string treated as absent; `status`/`role`/`sortBy`/`sortDir` are closed enums; each field raises exactly one fixed error message regardless of which rule failed (wrong type, a repeated query param Express turns into an array, or not in the allowed set), via a small `enumFilterField` helper and matching `page`/`username`/`email` transforms. `sortDir`'s default (`desc` when absent and `sortBy` is absent or `createdAt`, `asc` otherwise) is applied in the controller after parsing, since it depends on `sortBy`. Verified: `tsc --noEmit` clean, `npm run lint` clean. `vitest run` against the exposed dev DB port (tests/ isn't mounted into the dev container, so ran outside Docker with `DB_HOST=localhost DB_PORT=5434`): 544 passed, 6 failed, matching exactly the expected fallout below plus the one pre-existing unrelated failure already flagged in the Stage 15a entry; reran the full suite once more to confirm two other failures seen on one pass (a concurrency test and a logout test) were pre-existing flakiness outside Docker, not caused by this change - they did not reproduce on the repeat run.

**Files:**

- `user-service/src/db/queries/users.queries.ts` (modified)
- `user-service/src/services/users.service.ts` (modified)
- `user-service/src/controllers/users.controller.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

1. `listUsers` maps rows with the existing `toPublicUser` (password_hash stripped, snake_case fields) rather than the Stage 15c `toUserResponse` mapper the Stage 15b text names, because that mapper doesn't exist until Stage 15c is implemented. This matches the file's own "Changes to already-implemented code" table, which lists the mapper swap as Stage 15c's change (row 4), separate from Stage 15b's pagination change (row 3) - not treated as an open question.
2. Left 5 existing tests failing, unmodified: both `listAllUsers` tests in `users.queries.test.ts` (function removed), `users.service.test.ts`'s old no-argument `listUsers` call, and two `GET /users` tests in `users.controller.test.ts` expecting the old bare `{ users: [...] }` shape. Per the same table (row 5) and Stage 15c's own "Update existing tests" section, updating these is explicitly Stage 15c's job, not Stage 15b's.
3. The pre-existing, unrelated `email.service.test.ts` failure already flagged in the Stage 15a log entry is still present; unrelated to this change, not touched.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-22 — Stage 15c: camelCase Responses

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code | Refactor/Docs
**Governing decision:** instructions.md Stage 15c

**Prompts (exact):**

> after this, finish up this stage. but can the error raised in 15a be fixed easily?

> finish up the git workflow first. then answer the question

> just fold into 15c

**Key responses:**
First answered the 15a question: confirmed the stale `email.service.test.ts` failure (flagged in the Stage 15a entry) is an easy fixture fix, but found while checking it that the obvious fix - swapping the test's "no template" purpose to `'Change Password'` - would have hidden a real, pre-existing gap: `'Change Password'` IS wired up (Stage 12e's `initiatePasswordChange`/`confirmPasswordChange`, via `requestOtp` → `sendOtpEmail`), but `email.service.ts`'s `PURPOSE_COPY` map has no entry for it, so a real password-change OTP email would throw whenever SMTP is actually configured (not the dev console-log fallback). Used `'Admin Action'` instead - the one `purpose_enum` value with no implemented flow yet. Flagged the `'Change Password'` gap as a separate, unrelated finding; the user confirmed it wasn't currently live (`.env` has `SMTP_HOST` blank and `NODE_ENV=development`, so the dev fallback is active) but asked to fix it anyway before it surfaces during a real SMTP run or grading. Added a `'Change Password'` entry to `PURPOSE_COPY` (subject "Confirm your FoC password change"), same shape as the other three.

Before implementing, ran a research subagent (read-only) to inventory every response body across `src/controllers/*.ts` and `src/services/*.ts`, confirming the complete set of snake_case-affected endpoints and every test asserting on `active_view`/`created_at`/`updated_at`/the old `GET /users` shape, versus tests asserting on raw DB rows (out of scope - DB columns stay snake_case).

Created `src/services/userResponse.ts` with `toUserResponse(row)` → `{id, username, email, status, role, activeView, createdAt, updatedAt}`. Replaced every use of the old `toPublicUser`/`PublicUser` (both removed) with `toUserResponse`/`UserResponse` in `users.service.ts` (`listUsers`, `getUserById`, `changeUserStatus`, `changeUserRole`, including their no-op return paths) and `me.service.ts` (`changeActiveView`). Confirmed via the inventory that no other response body anywhere in the three controllers uses snake_case - `auth.controller.ts`'s login response and everything in `me.controller.ts` besides `updateActiveView` were already camelCase, and JWKS/JWT claims/error bodies are correctly left alone.

Updated existing test assertions for the casing change (`tests/controllers/users.controller.test.ts`, `tests/controllers/me.controller.test.ts`, `tests/services/users.service.test.ts`, `tests/services/me.service.test.ts`), carefully leaving every assertion that reads a raw DB row via `getUserByEmail(...)` in snake_case (DB columns are unaffected). Also fixed the two Stage-15b-caused breaks explicitly deferred to this stage: `users.controller.test.ts`'s `GET /users` test now checks the full paginated key set instead of `['users']`, and `users.service.test.ts`'s `listUsers` call now passes the required `{page, sortBy, sortDir}`. Additionally adapted `tests/db/queries/users.queries.test.ts`'s `listAllUsers` tests to call `listUsersPage` (the function `listAllUsers` was replaced by in Stage 15b but whose tests were left for this stage, per the same table) - signature/fixture update, not new coverage.

Verified: `tsc --noEmit` and `npm run lint` both clean throughout, including after the `PURPOSE_COPY` addition. `vitest run` (outside Docker, `DB_HOST=localhost DB_PORT=5434`): 550/550 passed both before and after the `PURPOSE_COPY` fix, including the previously-flagged `email.service.test.ts` failure, now fixed; `email.service.ts` is globally mocked in every other test file, so the added template entry doesn't affect them (confirmed via `tests/setup/setupFiles.ts`). Two different, unrelated concurrency tests (`races.concurrency.test.ts`, then on a separate run `lock-recheck.concurrency.test.ts`) each failed once and passed on an immediate re-run - pre-existing timing flakiness from running outside Docker, not caused by this change. Also verified against the running Docker stack (not just the test DB): logged in as the super admin, confirmed `GET /users`, `GET /users/:id`, and `PUT /users/:id/status` (both the write and no-op paths) all return exactly `{id, username, email, status, role, activeView, createdAt, updatedAt}` with no `password_hash`/snake_case keys. Could not live-verify the `PURPOSE_COPY` addition itself against the real Docker stack: `SMTP_HOST` is blank there, so the dev console-log fallback bypasses `PURPOSE_COPY` entirely regardless of its contents - confirmed correct by code inspection and the project's own `tests/services/email.service.test.ts` instead.

**Files:**

- `user-service/src/services/userResponse.ts` (created)
- `user-service/src/services/users.service.ts` (modified)
- `user-service/src/services/me.service.ts` (modified)
- `user-service/tests/controllers/users.controller.test.ts` (modified)
- `user-service/tests/controllers/me.controller.test.ts` (modified)
- `user-service/tests/services/users.service.test.ts` (modified)
- `user-service/tests/services/me.service.test.ts` (modified)
- `user-service/tests/db/queries/users.queries.test.ts` (modified)
- `user-service/tests/services/email.service.test.ts` (modified)
- `user-service/src/services/email.service.ts` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

1. **Real gap found and fixed, outside Stage 15c's own scope**: `email.service.ts`'s `PURPOSE_COPY` map had no entry for `'Change Password'`, but that purpose has sent real OTP emails since Stage 12e. Whenever SMTP is actually configured (`NODE_ENV` isn't `development`, or `SMTP_HOST` is set in dev), `sendOtpEmail` threw for every password-change OTP request instead of sending one - invisible locally only because the dev console-log fallback was active. Not currently live in this repo's `.env` (confirmed with the user), but flagged as something that would break silently the moment SMTP is configured for a real run or grading. Fixed on the user's go-ahead: added a `'Change Password'` entry (subject "Confirm your FoC password change"), same shape as the other three. The exact subject/intro wording wasn't specified anywhere in instructions.md; chose copy consistent with the existing three entries' style rather than stopping to ask, same discretion already used when the Registration/Forgot Password/Change Email copy was originally written.

**What I kept/changed/rejected:**
Accepted all changes. Fix the error.

**Author review:** gabriel yap

## 2026-10-23 — Stage 16b: Shared Auth Plumbing

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** instructions.md Stage 16b (decisions table and the Stage 16b section); the user's answers to Stage 16a items 1 ("Manage users" as a second top-level nav link) and 2 (full split of DemoContext's auth state into AuthContext now)

**Prompts (exact):**

> go for 16b

**Key responses:**
Read every consumer of `DemoContext`'s auth fields (the 16 files from the 16a report) in full before changing any of them, to keep each page's own business logic untouched while only swapping how it reads session state.

Created `src/context/AuthContext.jsx`: holds `user` (`{id, role, username, email, activeView}`) and `status` (`loading`/`authenticated`/`anonymous`), restores the session on mount, exposes `login`, `logout`, `setActiveView` (optimistic, reverts and rethrows on failure so a caller can toast), `updateUser` (for 16e to merge in a changed username/email), and `requireAuth(reason, onAllowed)` — the new call sites' replacement for the deleted `LoginModal`'s `requireLogin`: already logged in runs the callback immediately, otherwise navigates to `/login` remembering the current location. Also carries `credits`/`refreshCredits` and the order-socket connect/disconnect effect, moved here from `DemoContext` per the user's "full split" answer. Kept `isLoggedIn`/`sessionReady` as derived aliases of `status` to minimise the diff across 16 consumer files.

Updated `src/api/http.js`: proactive refresh now schedules itself 60s before the current token's `exp` (decoded via the JWT-claim helper, moved here from `api/auth.js` as `decodeAccessTokenClaims` so both files can use it without a circular import) every time a new token is set — on login and on every successful refresh — reusing the existing shared in-flight refresh; the timer is cancelled whenever the token is cleared. `ApiError` now also carries `retryAfterSeconds`, parsed from the service's `Retry-After` response header (not previously captured at all), which `ResendButton` needs for its cooldown. Kept the existing in-flight GET de-duplication and 401-retry unchanged.

Created `src/api/profile.js` (`getProfile`, `setActiveView`) per the decision table's module boundary (`/users/me/*` calls belong here, not in `auth.js`); `auth.js`'s `restoreSession` now calls it and also reads `activeView` from the response, which it was missing (it predates Stage 15a adding that field to `GET /users/me`).

Created the route guards (`src/components/RouteGuards.jsx`): `RequireAuth` and `RequireRole` (rank order copied from `user-service/src/middleware/authorize.ts`'s `ROLE_RANK`: user < admin < super admin); both render nothing while the session is still restoring, per the decisions table. `Forbidden.jsx` is the in-place "Not authorised" view.

Created the shared components the decisions table lists: `Toast.jsx` (+ `ToastProvider`/`useToast`, positioned top-right so it never collides with `ChatBubble`, bottom-right, or `DemoControls`, bottom-left — 16a found no existing toast to reuse), `FormBanner.jsx`, `FieldError.jsx`, `OtpInput.jsx` (6 boxes, auto-advance, backspace back, paste-fills-and-submits, exposes `reset()` via a ref for the parent to clear and refocus after a wrong code), `ResendButton.jsx` (cooldown countdown from `retryAfterSeconds`, limit state with no countdown), `src/utils/validation.js` (regexes and messages copied verbatim from `user-service/src/services/auth.service.ts`: `USERNAME_REGEX`, `EMAIL_REGEX`, `PASSWORD_REGEX`, `OTP_REGEX` and their messages), and `src/api/errorMessages.js`.

`errorMessages.js` enumerates every code found by grepping user-service for `new AppError(` plus `UNAUTHORIZED`/`FORBIDDEN` (middleware) and `VALIDATION_ERROR`/`INTERNAL_ERROR` (the global handler) — the full map, with each code's default display type, is below for review:

| Code                              | Frontend text                                            | Display |
| --------------------------------- | -------------------------------------------------------- | ------- |
| VALIDATION_ERROR                  | Please check the highlighted fields.                     | field   |
| USERNAME_TAKEN                    | That username is already taken.                          | field   |
| EMAIL_TAKEN                       | That email is already registered.                        | field   |
| INVALID_CREDENTIALS               | Wrong username/email or password.                        | banner  |
| ACCOUNT_SUSPENDED                 | This account has been suspended.                         | banner  |
| ACCOUNT_NOT_VERIFIED              | This account still needs email verification.             | banner  |
| INVALID_REFRESH_TOKEN             | Your session has expired. Please log in again.           | toast   |
| UNAUTHORIZED                      | Please log in to continue.                               | toast   |
| FORBIDDEN                         | You don't have access to do that.                        | toast   |
| INVALID_OTP                       | That code is incorrect.                                  | field   |
| OTP_EXPIRED                       | That code has expired. Request a new one.                | field   |
| OTP_ATTEMPTS_EXCEEDED             | Too many incorrect attempts. Request a new code.         | field   |
| OTP_RESEND_COOLDOWN               | Please wait before requesting another code.              | field   |
| OTP_RESEND_LIMIT                  | You've reached the resend limit. Please try again later. | field   |
| NO_PENDING_REGISTRATION           | No pending registration was found for this email.        | banner  |
| EMAIL_NOT_FOUND                   | No account uses that email.                              | field   |
| NO_PENDING_EMAIL_CHANGE           | No pending email change was found.                       | banner  |
| NO_PENDING_PASSWORD_CHANGE        | No pending password change was found.                    | banner  |
| EMAIL_SEND_FAILED                 | Could not send the email right now. Please try again.    | banner  |
| USERNAME_UNCHANGED                | That is already your username.                           | field   |
| EMAIL_UNCHANGED                   | That is already your email.                              | field   |
| PASSWORD_UNCHANGED                | That is already your password.                           | field   |
| INVALID_PASSWORD                  | Your current password is incorrect.                      | field   |
| USER_NOT_FOUND                    | That user could not be found.                            | toast   |
| SUPER_ADMIN_IMMUTABLE             | A super administrator cannot be modified.                | toast   |
| SELF_ROLE_CHANGE                  | You cannot change your own role.                         | toast   |
| CANNOT_CHANGE_STATUS_PENDING_USER | A pending user's status cannot be changed yet.           | toast   |
| CANNOT_CHANGE_ROLE_PENDING_USER   | A pending user's role cannot be changed yet.             | toast   |
| CANNOT_CHANGE_ROLE_SUSPENDED_USER | A suspended user's role cannot be changed.               | toast   |
| INTERNAL_ERROR (fallback)         | Something went wrong. Please try again.                  | banner  |

Created `src/pages/Login.jsx`: identifier/password, links to `/register` and `/forgot-password` (not built until 16c/16d — the app's catch-all route sends them home until then), success lands on `state.from` or home, `INVALID_CREDENTIALS`/`ACCOUNT_SUSPENDED` show a banner, `ACCOUNT_NOT_VERIFIED` redirects to `/register`'s OTP step per the spec's exact snippet.

Wired it together: `main.jsx` mounts `AuthProvider` (inside `BrowserRouter`, needs `useNavigate`/`useLocation`) and `ToastProvider`; `App.jsx` adds `/login` and wraps `/requests/new`, `/requests/:id/edit`, `/activity`, `/chat/:id` and `/wallet` in `RequireAuth` (these are exactly the pages that used to gate themselves on mount via `requireLogin`, now redundant once the route itself guards them - their internal gating effects, which called the now-deleted function, were removed); `LoginModal.jsx` deleted once nothing imported it. `DemoContext.jsx` shrank to `role`/`requests`/`setRequestStatus`/`acceptRequest`/`currentUser` (the mocked, non-auth pieces) - `loginPrompt`/`setLoginPrompt` were dropped entirely rather than kept as the user's literal answer listed them, since nothing opens a modal to read them anymore (flagged below). Updated all 16 consumer files to read from the new `useAuth()` instead of `useDemo()` for anything auth-related, touching only that one line per file wherever possible: `TopNav.jsx` (also added "Manage users" as a second admin link, removed the now-redundant `gated` nav-link mechanism since `/activity` is route-guarded), `ApiNotice.jsx`, `useApi.js`, `ChatBubble.jsx`, `SupplierCard.jsx`, `SupplierDetail.jsx`, `RequestCard.jsx`, `RequestBoard.jsx` (soft-gated, not wrapped in `RequireAuth` - unchanged behaviour, just a different context), `AdminSuppliers.jsx` (its existing `AdminOnly` in-page gate kept as-is, just repointed - not replaced by the new generic `RequireRole`, which Stage 16g reserves for `/admin/users`), `AdminSupplierForm.jsx`, and `Activity.jsx`/`Wallet.jsx`/`Chat.jsx`/`CreateRequest.jsx` (gating effects/inline checks removed, now dead once route-guarded).

Verified: `npm run build` (`vite build`) succeeds. `npm run lint` (`oxlint`): only pre-existing warning categories (`only-export-components`, `set-state-in-effect`) at the same rate as a lint run on the pre-16b branch (checked with `git stash`) - none of these are new error-level findings. Ran a full Playwright smoke test (headless Chromium, installed for this) against the real Docker stack (all services already running) as the super admin: clicking "Log in" navigates to `/login` (no modal); wrong password shows the banner; correct login redirects home; `localStorage`/`sessionStorage` are empty both logged in and after logout (access token confirmed in-memory only); the nav shows the username, both admin links and the credit pill; a reload stays logged in; `/wallet` loads real Credit Service data (20 credits, one allocation row) with the Bearer token attached; logging out clears storage and lands on `/login`; visiting `/wallet` logged out redirects to `/login` remembering the page, and logging back in from there lands back on `/wallet`; visiting the not-yet-built `/admin/users` falls through the catch-all to home, as expected before Stage 16g. No unexpected console errors - the three 401s logged are the normal pre-login/401-retry noise, already handled by `http.js` before this change.

**Files:**

- `frontend/src/context/AuthContext.jsx` (created)
- `frontend/src/components/RouteGuards.jsx` (created)
- `frontend/src/components/Forbidden.jsx` (created)
- `frontend/src/components/Toast.jsx` (created)
- `frontend/src/components/FormBanner.jsx` (created)
- `frontend/src/components/FieldError.jsx` (created)
- `frontend/src/components/OtpInput.jsx` (created)
- `frontend/src/components/ResendButton.jsx` (created)
- `frontend/src/utils/validation.js` (created)
- `frontend/src/api/profile.js` (created)
- `frontend/src/api/errorMessages.js` (created)
- `frontend/src/pages/Login.jsx` (created)
- `frontend/src/components/LoginModal.jsx` (deleted)
- `frontend/src/api/auth.js` (modified)
- `frontend/src/api/http.js` (modified)
- `frontend/src/api/useApi.js` (modified)
- `frontend/src/main.jsx` (modified)
- `frontend/src/App.jsx` (modified)
- `frontend/src/context/DemoContext.jsx` (modified)
- `frontend/src/components/TopNav.jsx` (modified)
- `frontend/src/components/ApiNotice.jsx` (modified)
- `frontend/src/components/ChatBubble.jsx` (modified)
- `frontend/src/components/SupplierCard.jsx` (modified)
- `frontend/src/components/RequestCard.jsx` (modified)
- `frontend/src/pages/SupplierDetail.jsx` (modified)
- `frontend/src/pages/Activity.jsx` (modified)
- `frontend/src/pages/Wallet.jsx` (modified)
- `frontend/src/pages/Chat.jsx` (modified)
- `frontend/src/pages/CreateRequest.jsx` (modified)
- `frontend/src/pages/RequestBoard.jsx` (modified)
- `frontend/src/pages/AdminSuppliers.jsx` (modified)
- `frontend/src/pages/AdminSupplierForm.jsx` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**

1. Added `requireAuth(reason, onAllowed)` to `AuthContext`, not explicitly named in the decisions table's "Exposes" list, because 13 existing call sites across 8 files depended on the deleted `LoginModal`'s `requireLogin` with exactly that shape (run immediately if already logged in, otherwise prompt). Implementing "replace every place that opened LoginModal with navigation to /login" required an equivalent.
2. `Login.jsx` shows an optional informational banner for the `reason` string `requireAuth` passes along (the old modal showed this text too), in addition to the spec's required success/`from` handling. Not required by the spec, which only mentions `from` and a success banner - dropping the reason text felt like a UX regression, and nothing forbids showing it.
3. `DemoContext` dropped `loginPrompt`/`setLoginPrompt` entirely rather than keeping them as the user's 16a answer listed ("role/requests/loginPrompt"), since `LoginModal` (the only thing that ever read them) is deleted in this same stage - keeping them would be dead state.
4. File headers use this codebase's established `/* ... */` block-comment style throughout, not the Stage 16 ground rules' literal "JSX/JS files use `//` comments" - every existing frontend file already uses block comments, so the code was followed over the instruction text, per the ground rules' own "where it disagrees with this file, follow the code and tell me."
5. `AdminSuppliers.jsx`'s existing `AdminOnly` in-page admin gate was left as its own component (only repointed to `AuthContext`), not replaced by the new `RequireRole`/`Forbidden`. Stage 16g is where the file's own stage split puts `/admin/users` behind `RequireRole`; generalising `/admin/suppliers` to match wasn't asked for here.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-23 — Stage 16c: Registration (`/register`)

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** instructions.md Stage 16c (the registration form/OTP spec) and its Stage 16 decisions table (OTP input behaviour, resend cooldown/limit, error display rules, `ACCOUNT_NOT_VERIFIED` redirect snippet, `USERNAME_TAKEN`/`EMAIL_TAKEN` hint text)

**Prompts (exact):**

> let's start 16c, dont forget ot pull main first, and the git workflow too

**Key responses:**
Pulled `main` first (fast-forwarded past the already-merged Stage 16b PR #129) and branched `feat/stage-16c-registration` from it, per the team's standing git workflow.

Created `src/pages/Register.jsx`: one page, two steps (`form`, `otp`), starting at `location.state.step` (default `form`) exactly as Stage 16b's `Login.jsx` already sends it for `ACCOUNT_NOT_VERIFIED`. Form step: username/email/password with the Stage 16b client validators (blur + submit), `POST /auth/register`, success moves to the OTP step; `USERNAME_TAKEN`/`EMAIL_TAKEN` show inline on that field plus the "Already signed up? Log in to finish verifying" hint linking to `/login`; anything else falls back to a form banner via `errorMessages.describeError`. OTP step: `OtpInput` → `POST /auth/verify-otp` (`purpose: 'registration'`) — `INVALID_OTP` clears the boxes and refocuses via the component's exposed `reset()`, `OTP_EXPIRED`/`OTP_ATTEMPTS_EXCEEDED` show an inline error pointing at resend, success navigates to `/login` with a success banner. Resend uses `POST /auth/resend-otp` (`purpose: 'registration'`); `NO_PENDING_REGISTRATION` and anything else `ResendButton` doesn't itself handle (cooldown/limit) surface as a banner.

When arriving from `Login.jsx`'s `ACCOUNT_NOT_VERIFIED` redirect (`location.state.step === 'otp'`, captured once at mount so it stays stable across the page's own step transitions), the OTP step instead shows a "Send a new code" button at the top (does not send automatically) and, if no email was carried in (the user logged in by username), an email field above the boxes with the boxes/resend/verify disabled until it's filled. This reuses the same `ResendButton` instance repositioned to the top rather than a second independent one, so there is one cooldown/limit state, not two that could disagree — `ResendButton` gained an optional `label` prop (default unchanged: "Resend code") to support this.

`src/api/auth.js` gained `register`, `verifyOtp`, `resendOtp` — thin wrappers over the existing `request()` helper, bodies matching `user-service/src/controllers/auth.controller.ts`'s `registerSchema`/`verifyOtpSchema`/`resendOtpSchema` exactly (`{username,email,password}`, `{email,otp,purpose}`, `{email,purpose}`). `App.jsx` added the `/register` route.

Verified: `npm run build` (`vite build`) succeeds; `npm run lint` (`oxlint`) shows no new findings in the touched files (same pre-existing warning set as the 16b branch). Ran Playwright (headless Chromium, against the real Docker stack already running) through three scenarios, reading each OTP from the user-service container's dev-console email log:

1. Fresh registration happy path: form → `201` → OTP step (no stray email field, no "Send a new code" banner) → wrong code clears the boxes and shows "That code is incorrect." → correct code → `/login` with "Account verified. You can now log in." shown.
2. Abandon-and-retry via username: registered, abandoned at OTP, logged in again with the username (not email) → redirected to `/register`'s OTP step with the "Send a new code" button and an email field, both gated until the email is filled; clicking it while still inside the registration OTP's cooldown surfaced "Resend in 60s" (cooldown working as intended, not a bug); verified with the original still-valid code → `/login` success banner again.
3. Caught and fixed one of my own bugs before considering this done: the OTP step's "email field for a missing email" was gated only on `!initial.email`, so it also appeared (pre-filled, harmless but wrong per spec) on the ordinary post-registration flow, where the email is always known. Fixed to `arrivedFromLogin && !initial.email`; confirmed fixed by scenario 1 above.

**Files:**

- `frontend/src/pages/Register.jsx` (created)
- `frontend/src/api/auth.js` (modified)
- `frontend/src/components/ResendButton.jsx` (modified)
- `frontend/src/App.jsx` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-23 — Stage 16d: Forgot Password (`/forgot-password`)

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate
**Scope:** Implementation code
**Governing decision:** instructions.md Stage 16d (the forgot-password spec) and its Stage 16 decisions table (OTP input behaviour, resend cooldown/limit wording, error display rules)

**Prompts (exact):**

> let's start 16d, dont forget ot pull main first, and the git workflow too

> done. go for 16d

**Key responses:**
Pulled `main` first (fast-forwarded past the already-merged Stage 16c PR #130) and branched `feat/stage-16d-forgot-password` from it, per the team's standing git workflow.

Created `src/pages/ForgotPassword.jsx`: one page, three steps (`email`, `otp`, `password`) kept purely in component `useState` with no router state at all, so a reload always restarts at step 1 as specified. Step 1: email → `POST /auth/forgot-password` — `EMAIL_NOT_FOUND` inline, `ACCOUNT_NOT_VERIFIED` banner, `OTP_RESEND_COOLDOWN`/`OTP_RESEND_LIMIT` banner (the cooldown message appends the actual `Retry-After` seconds from `ApiError.retryAfterSeconds`). Step 2: `OtpInput` → `POST /auth/verify-otp` (`purpose: 'forgot_password'`, which `user-service/src/services/auth.service.ts`'s `verifyForgotPasswordOtp` checks without consuming the code) — `INVALID_OTP` clears/refocuses the boxes, `OTP_EXPIRED`/`OTP_ATTEMPTS_EXCEEDED` show inline pointing at resend, success stores the verified code in state and moves to step 3; `ResendButton` → `POST /auth/resend-otp` (`purpose: 'forgot_password'`). Step 3: new password (client complexity check) → `POST /auth/reset-password` with the email/OTP/new-password all held in state — `INVALID_OTP`/`OTP_EXPIRED`/`OTP_ATTEMPTS_EXCEEDED` here (the code expiring between steps 2 and 3) route back to step 2 reusing the same `otpBannerError` state rather than a separate channel, success navigates to `/login` with a success banner.

While reading `auth.service.ts` to confirm the exact error codes each endpoint can throw (`forgotPassword`, `verifyForgotPasswordOtp`, `resetPassword`, and `otp.service.ts`'s `checkOtp` for where `OTP_EXPIRED`/`OTP_ATTEMPTS_EXCEEDED` actually originate), checked `user-service/.env.example` for the Stage 16d spec's note that the resend-limit text should say "about an hour": `OTP_RESEND_WINDOW_MINUTES=60` is one config shared by every OTP purpose, not forgot-password-specific, so corrected `errorMessages.js`'s central `OTP_RESEND_LIMIT` text to name the real wait rather than add a per-page override — this also improves the existing registration flow's wording, which was accurate in effect but vague before.

`src/api/auth.js` gained `forgotPassword` and `resetPassword` (thin wrappers over `request()`, bodies matching `auth.controller.ts`'s `forgotPasswordSchema`/`resetPasswordSchema`). `App.jsx` added the `/forgot-password` route (already linked from `Login.jsx` since Stage 16b).

Verified: `npm run build` and `npm run lint` clean, no new findings. Ran Playwright (headless Chromium, real Docker stack) end to end, reading OTPs from the user-service container's dev-console email log and manipulating `users_otps.expires_at` directly in the Postgres container for the expiry case (a 60s resend cooldown shared across all OTP purposes made a literal `/auth/resend-otp` round trip impractical to chain immediately after the account's own registration email, so the expiry-recovery step reuses the already-known code after un-expiring the row, rather than requesting a fresh one): reload mid-flow restarts at step 1 (confirmed on a dedicated account to avoid a same-account double-send hitting that same cooldown); a wrong code at step 2 never reaches step 3 and shows "That code is incorrect."; the correct code reaches step 3; expiring the OTP in the DB while on step 3 and submitting sends the user back to step 2 with "That code has expired."; completing the reset lands on `/login` with "Password reset. Please log in with your new password."; the old password then fails login (`INVALID_CREDENTIALS`) and the new one succeeds.

**Files:**

- `frontend/src/pages/ForgotPassword.jsx` (created)
- `frontend/src/api/auth.js` (modified)
- `frontend/src/api/errorMessages.js` (modified)
- `frontend/src/App.jsx` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-23 — Stage 16e: Account Page (`/account`)

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate, debug
**Scope:** Implementation code, Debugging
**Governing decision:** instructions.md Stage 16e (the account-page spec) and its Stage 16 decisions table; user-service's `me.controller.ts`/`me.service.ts` for the exact request/response shapes and error codes of each `/users/me/*` endpoint

**Prompts (exact):**

> done, go for hte next part

**Key responses:**
Pulled `main` first (fast-forwarded past the already-merged Stage 16d PR #131) and branched `feat/stage-16e-account-page` from it, per the team's standing git workflow.

Read `user-service/src/controllers/me.controller.ts` and `me.service.ts` to pin down each endpoint exactly: `PUT /users/me/username` returns `{username, email}` and can throw `USERNAME_UNCHANGED`/`USERNAME_TAKEN`; `PUT /users/me/email` only sends an OTP (`EMAIL_UNCHANGED`/`EMAIL_TAKEN`/`INVALID_PASSWORD`), confirmed via `POST /users/me/verify-otp` (`purpose: 'change_email'` — the only purpose that route accepts); `PUT /users/me/password` similarly only sends an OTP (`PASSWORD_UNCHANGED`/`INVALID_PASSWORD`), confirmed via `POST /users/me/confirm-password-change`, which also re-validates `PASSWORD_UNCHANGED` and can still throw `INVALID_OTP`/`OTP_EXPIRED`/`OTP_ATTEMPTS_EXCEEDED` (traced into `otp.service.ts`'s `checkOtp`, the single place all three of those actually originate); the one `POST /users/me/resend-otp` route takes either purpose.

Created `src/pages/Account.jsx`: a profile section plus three independent change sections (username, email, password), each its own local sub-component with its own form/OTP state. Username is a single-step form. Email and password are two-step within their own section (form, then an inline OTP step), matching the spec's "OTP shown inline in the same section." Password's new value is kept in the section's own state from the first step through to `confirm-password-change`, per the spec, so the user isn't asked to retype it.

Extended `src/api/profile.js` with `changeUsername`, `changeEmail`, `verifyEmailChangeOtp`, `resendMeOtp`, `changePassword`, `confirmPasswordChange` — thin wrappers over `request()`. Added `src/context/AuthContext.jsx`'s `forceReauth(message)` for the spec's forced-relogin decision (clears client state the same way `logout()` does, without the `POST /auth/logout` call, since the backend has already revoked every refresh token for this user). Wired `/account` into `App.jsx` behind `RequireAuth`, and linked it from the nav by turning `TopNav.jsx`'s existing username/initials block (desktop and mobile) into a link to `/account`, since that was the only place already identifying the signed-in user — kept `TopNav.jsx` changes to just that.

**A real bug, found only by actually running the password-change flow, not by reasoning about the code:** the spec's forced-relogin banner never appeared. Root-caused with Playwright plus console tracing (see `AuthContext.jsx`'s comment on `forceReauth` for the full trail): flipping auth state to anonymous from `/account` (a `RequireAuth`-protected route) makes `RequireAuth` re-render and fire its _own_ redirect to `/login`, racing `forceReauth`'s intended navigation for who gets to set the router state `/login` reads the banner text from. React Router v7 schedules a plain `navigate()`'s location update inside `React.startTransition` by default, so `RequireAuth`'s synchronous re-render (triggered by the plain `setUser`/`setStatus` calls) consistently won before this call's location update had landed — confirmed by tracing actual render order with temporary logging, not just reading the types. Tried three fixes in order before one worked: reordering the calls (no effect), wrapping the call in React DOM's own `flushSync` (no effect — react-router's internal `startTransition` isn't overridden by an outer `flushSync` boundary), and react-router v7's own `navigate(..., { flushSync: true })` option (still no effect, empirically — plausibly because this project uses the plain `<BrowserRouter>` API, not the data-router `RouterProvider` that option targets). Settled on sidestepping the race entirely: the message now travels through a small module-level variable in `AuthContext.jsx` (`pendingAuthMessage`/`consumePendingAuthMessage`/`clearPendingAuthMessage`) instead of router state, so it no longer matters which navigate call's state wins — `Login.jsx` reads it once via a pure lazy `useState` initializer (safe under StrictMode's double-invoked renders, since a plain read has no side effect) and clears it in a separate effect (idempotent, so a StrictMode double-invoked effect is harmless too).

Verified: `npm run build` and `npm run lint` clean (the two new `only-export-components` warnings for the module-level pending-message functions are the same pre-existing category already present elsewhere in this codebase — `Toast.jsx`, `ApiNotice.jsx`, `DemoContext.jsx` — not a new kind of finding). Ran Playwright (headless Chromium, real Docker stack) end to end: the nav link reaches `/account`; profile shows the signed-in user's username/email; changing to the current username shows `USERNAME_UNCHANGED` inline; changing it for real updates the section, a success banner, and the nav's displayed name with no reload; the email section's wrong-password case shows `INVALID_PASSWORD` inline on the password field; the happy path sends an OTP (read from the user-service dev-console log), a wrong code shows "That code is incorrect.", and the right code updates the profile's email with no reload; the password section's happy path sends an OTP, and entering the right code immediately redirects to `/login` with "Password changed. Please sign in again with your new password." — not left on `/account`; the old password then fails login and the new one succeeds.

**Files:**

- `frontend/src/pages/Account.jsx` (created)
- `frontend/src/api/profile.js` (modified)
- `frontend/src/context/AuthContext.jsx` (modified)
- `frontend/src/components/TopNav.jsx` (modified)
- `frontend/src/pages/Login.jsx` (modified)
- `frontend/src/App.jsx` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap

## 2026-10-23 — Stage 16f: Requester/Courier Toggle

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** generate, debug
**Scope:** Implementation code, Debugging
**Governing decision:** instructions.md Stage 16f and its Stage 16 decisions table ("Active-view toggle" row: optimistic update, `PUT /users/me/active-view`, revert and toast on failure)

**Prompts (exact):**

> read through instrusction.md. let's start with 16f. don't forget to pull from main and branch first, and follow the git workflow.

**Key responses:**
Confirmed the current branch (`feat/stage-16f-requester-courier-toggle`) was already created from an up-to-date `main` (fast-forwarded past the merged Stage 16e PR #132), so no further pull/branch step was needed before writing code.

Read `src/context/AuthContext.jsx` and found `setActiveView` already implemented in Stage 16b, in anticipation of this sub-stage: it optimistically updates `user.activeView`, calls `profileApi.setActiveView`, and reverts plus rethrows on failure. So 16f's own work is the UI: a new `src/components/ActiveViewToggle.jsx` (a two-segment "Requester"/"Courier" control reading `user.activeView`, calling `setActiveView` on click, and on a rethrown error showing a toast via `useToast()`/`describeError()`). Wired it into `TopNav.jsx` next to the credits pill on desktop and above the username row in the mobile drawer, shown only when logged in, per the spec's "keep TopNav changes minimal and list them."

Grepped for every consumer of `DemoContext`'s mocked `role` (the "local `role` useState('requester')" the Stage 16 decisions table calls out) and found two: `src/components/DemoControls.jsx` (its own demo-only Role toggle, on the ground-rules do-not-modify list, left untouched) and `src/pages/Activity.jsx` (picks the default tab). Switched `Activity.jsx` to read `activeView` from `useAuth()` instead of `useDemo()`'s `role`.

Verified: `npm run build` and `npm run lint` (`oxlint`) both clean, no new warnings from the changed files. Ran the app against the already-running Docker stack (user-service on :3001, user-db on :5434) with the frontend dev server, driving it with a headless Playwright/Chromium script (registered a test user via the API, read its OTP from the user-service dev-console log, verified and logged in): confirmed the toggle renders once logged in, clicking it flips `aria-pressed` instantly and the `users.active_view` column in Postgres matches, a reload keeps the same view, and stopping `foc-user-service` mid-click reverts the toggle and shows a toast reading "Something went wrong. Please try again." (the generic fallback in `errorMessages.js`, since a connection failure carries no backend `code`). Restarted the container and deleted the test user afterward.

**Files:**

- `frontend/src/components/ActiveViewToggle.jsx` (created)
- `frontend/src/components/TopNav.jsx` (modified)
- `frontend/src/pages/Activity.jsx` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified: Log index row)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**
Accepted all changes.

**Author review:** gabriel yap
