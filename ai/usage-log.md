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
- `.env.example` (modified: CREDIT_* variables)
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

---

## 2026-09-26 — Recess iteration: Credit Service verification run

**Tool:** Claude Code (model: claude-opus-5)
**Mode:** debug | docs
**Scope:** Implementation code | Debugging | Requirements formatting
**Governing decision:** `credit-service/credit-service-context.md` §6 (F19, F20), §7 (NFR8.1.1); team answers given in chat on 2026-09-26.

**Prompts (exact):**

> 1) this can be put on hold
> 2) move f20.1 to recess week
> 3) It's right to have left it unenforced.
> 4) remind me later
>
> Both user_id and request_id are confirmed by the team to be UUIDs.
>
> Please write the `credit-db` service for `compose.yaml` and `.env.example`.
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
