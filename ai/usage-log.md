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

## 2026-09-25 — Stage 5b: Email Service

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5b: Nodemailer-based sendOtpEmail with purpose map, text+html bodies, throw on failure, and a development-only console fallback when SMTP_HOST is empty.

**What it produced:**
Created: user-service/src/services/email.service.ts

**What I kept/changed/rejected:**
I kept all changes.

## 2026-09-25 — Stage 5c: OTP Queries + Service

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5c: otp.queries.ts (create/invalidate/findLatest/count/increment/consume), otp.service.ts (issueOtp, checkOtp returning {ok:false} instead of throwing on mismatch), plus Vitest tests for checkOtp branching.

**What it produced:**
Created: user-service/src/db/queries/otp.queries.ts, src/services/otp.service.ts, src/services/otp.service.test.ts

**What I kept/changed/rejected:**
I kept all changes.

## 2026-09-25 — Stage 5d: Registration Now Creates a Pending Account

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5d: transactional register (delete stale pending users, duplicate checks, create pending user, issue OTP), register returns 201 OTP_SENT, login rejects pending accounts with 403 ACCOUNT_NOT_VERIFIED after the credential check.

**What it produced:**
Modified: user-service/src/services/auth.service.ts, src/controllers/auth.controller.ts

**What I kept/changed/rejected:**
I kept all changes.

## 2026-09-25 — Stage 5e: Verify OTP + Resend OTP Endpoints

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5e: public POST /auth/verify-otp and /auth/resend-otp with strict Zod validation, verifyRegistrationOtp/resendRegistrationOtp in the service layer (row lock, attempt persistence, resend limit and cooldown), and Retry-After support via AppError.retryAfterSeconds.

**What it produced:**
Modified: user-service/src/utils/AppError.ts, src/app.ts, src/routes/auth.routes.ts, src/services/auth.service.ts, src/controllers/auth.controller.ts

**What I kept/changed/rejected:**

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
