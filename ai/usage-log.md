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

## 2026-09-25 — Supplier Service: Architecture Document

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied Supplier Service architecture and database plans in the task prompt; supplier requirements in `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**
> Requirement Context:
> ```markdown
> Part 2: Supplier Service
> Your task is to implement the Supplier Service backend, together with a responsive UI. The
> UI should consume the Supplier Service’s APIs to perform CRUD operations.
> Points 1-5 are the expectations for a near-complete supplier service.
> Points 1-4 are the expectations for significant progress on the supplier service.
> 1. Database Choice and Schema Design
> • Which database technology have you selected?
> • Justify your choice with reasoning specific to FoC's design. Consider the
> nature of the data—for example, whether it is structured or contains flexible
> content—as well as the expected query patterns and scalability requirements.
> • Present a concrete schema. Specify the tables, collections or documents; the
> fields they contain; and the relationships among them.
> • Identify the metadata required for each supplier, such as its name, type and
> location, and explain how this metadata is stored and queried.
> 2. Query Patterns & API Design
> • Identify the key ways in which the Supplier Service will be queried, such as
> retrieving a supplier by ID or finding suppliers by location.
> • Define the API endpoints that expose these operations. Demonstrate the key
> query patterns using working API calls.
> • Explain how Supplier Service API endpoints use identity and role information
> from the User Service to enforce access control and respond to denied
> requests.
> 3. CRUD operations in the Backend
> • Demonstrate a running Supplier Service connected to a database, with
> working APIs that support CRUD operations on supplier data.
> • The Supplier Service is an independent backend service. Its functionality must
> be exposed through its APIs and should not depend on the UI.
> • Demonstrate that the Supplier Service can be used and tested through its APIs
> without the UI being present or running.
> 4. End-to-End Integration
> • Demonstrate the complete flow from an authenticated user, through the
> Supplier Service API, to the database.
> • Show that users with different roles receive the appropriate API access.
> • Focus the demonstration on the complete supplier-management experience
> for all relevant users, including administrators where applicable.
> 5. Responsive Supplier Management UI
> • Demonstrate the complete supplier management UI.
> • Show the UI adapting appropriately across desktop- and mobile-sized
> viewports.
> • Include workflows such as:
> • Creating, editing, and deleting suppliers
> • Viewing supplier records
> • Searching for suppliers
> • Filtering and sorting results
> • Paginating through supplier data
> • Viewing supplier details
> • Demonstrate integration with the Supplier Service by retrieving and modifying
> supplier data through its APIs. The UI must use live data from the service and
> must not rely on mock or hard-coded supplier data.
> • Note: The demonstration should not be limited to administrator-only
> screens.
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
> fields should contain supplier\_name, supplier\_type ["Store" vs "Facility"], supplier\_category [can contain multiple of "Food", "Drinks", "Snacks", "Printing", etc.], supplier\_location, supplier\_faculty [subcategory of location], supplier\_hours [always 24h for "Facility", and customisable for "Store"] and supplier\_desc. This means separate tables for supplier, supplier\_locations, supplier\_categories, a junction table mapping supplier to supplier categories, supplier\_hours, and supplier\_photos [links to dedicated storage location]
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

## 2026-09-26 — Supplier Service: Photo Management and Concrete Schema

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Implementation code | Refactor/Docs
**Governing decision:** User-supplied photo-management, authentication, service-entrypoint, normalized location/faculty/level, and server-managed-field decisions in the follow-up prompt; `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**
> Photo amangement:
>
> - uploaded photos are part of the form data payload, sent alongside the request parameters in the create and edit flow for admins
> - a dedicated junction table will be used to map supplier\_id to one or multiple photoids
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
> - location maps to location table and unique location\_ids. new faculty table with faculty\_ids. level is just a numerical field
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
> 12. is\_open will be calculated from the current time and cross-comparing with the opening hours
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
>    1. user dashboard: /api/suppliers. request:GET, params=page, limit, search, location\_id, category\_id, sortBy, sortOrder. Response: metadata=totalRecords, currPage, limit, totalPages, data=id, name, type, location, faculty, level, categories, isopen
>    2. admin dashboard: /api/admin/suppliers. same as 1, with more data in response: isActive, isDeleted, isOpen
>    3. user detailed view: /api/suppliers/:id. same as 1, but now with more data in response: desc, openingHours
>    4. admin detailed view: api/admin/suppliers/:id, same as 3, but also contain createdOn and createdBy in the response
>    5. admin create: /api/admin/suppliers. request:POST, params=all in 4
>    6. admin edit: /api/admin/suppliers/:id. request: PUT, params=whatever updated field from the whole list in 5
>    7. admin delete: /api/admin/suppliers/:id. request: DELETE
> 2. Update the document to show that API requests for querying data takes in filter, sort and search parameters which will be used to query for 50 entries at a time
> 3. clarify supplifier deletion is a soft delete from updating a new is\_deleted field in supplier
> 4. add these fields into the supplier data model: is\_active (whether the result is shown), is\_deleted (from 3.), is\_open, creation\_date and creator
> 5. update to include that in case of soft deletion, past records and requests already picked up will be kept the same. For requests not yet collected, the supplier service will interact with the order service's delete API to delete the request. It will also interact with the message service's messaging API to send a msg to the request poster
> 6. The UI interface is locked behind authentication, and a JWT will be used to verify the identity and authenticate users. There will be 3 user roles - super admin, admin and user. The roles accepted by each operation is as specified in the API operation inventory section
> 7. For location table, it will consisit of an autoincrement location\_id, (text) location, (text) faculty, (text) level. For hours table, it will include some autoincrement UUID, supplier\_id, day\_of\_week (represented by int 0-6), open\_time (time), close\_time (time). For category table, it will consist of an autoincrement category\_id and (text) category\_type. The junction table contains the supplier\_id and category\_id, with both forming a composite key. The photo table contains an autoincremend photo\_id, (text) photo\_lcoation.
> 8. is considered in 7
> 9. for 24h availability, the open\_time and close\_time are just both set to 00:00 (or time field equivalent)
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
> 2. All error response envelops will follow a fixed format with the status\_code, error, message, timestamp and details (the exact fields, locations of the error). The status codes are listed in 7.1
> 3. for limit, 50 is fixed; for sort values are only order by A-Z/Z-A, these are not user-modifiable. For filtering, the options will be loaded from the options retrieved via the api lookup for location and categories. There is no risk of invalid fields
> 4. no. I was just giving example as a store may only only on some days of the week. The database day\_of\_week still maps days to 0-6, with 0 being sunday
> 5. time-zone will be fixed to singapore's UTC+8 timezone. this will be clearly recorded. overnight opening hours are just when the opening time is later (e.g., 2100) than the closing time (e.g., 0300). server calculated isOpen must accomodate this
> 6. in the photo deletion flow, cloud object deletion will be last after ensuring mysql updates (edits, deletions) are complete to reduce operational
> 7. placeholder\_ids are generated randomly for each uploaded photo (binary file). the backend will process the ordering of images sent over by resolving their index positions. The association does not matter as long it is one-to-one. the backend will replace the placeholder\_ids. its only purpose is to keep a reference to the new images

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
> * concurrent edits: add an additional version col for supplier tables. All updates will include an incremented version number, so in the case of concurrent edits, the first to execute will update the records, and the later ones will not be able to find the record to update with the old version number, allowing a Concurrent Edit error to be raised (409 Conflict)
> * for supplier hours, day of week should be unique for a supplier (no multiple hours in a single day), and display_order for supplier_photos should be unique as well (photos of the same supplier cannot share the same order)
> * Exclusion of supplier_desc from search is intentional as desc will not be displayed
> * All timezones are in SGT (UTC +8)
>
>
> API/auth
>
> * currently super_admin and admin do not defer in capabilities. super_admin comes with additional admin management which is not part of this service.
> * following the exact same format as the read endpoints, add management endpoints for faculties, supplier_categories and supplier_locations to allow admin UI CRUD
> * PUT and DELETE are idempotent by design. There will be no issue with multiple calls. Multiple PUT leads to the same addition, and multiple DELETEs just lead to 404s after a successful execution. For POST, apply the idempotency key pattern where the client generates a UUID "idempotency key" and attach it to the request header. This key and response will be cached in redis so that subsequent retries will be flagged with 409 Conflict, or to directly return the completed response if avialbale.
> * photo_location urls will be short-lived signed URLs provided by the cloud storage
>
>
> Others
>
> * Introduce rate limit of 30requests/min/ip
> * Same origin will be used
> * Apply versioning /v1 to all API endpoints
> * defer health-check endpoints for now
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
> * client gets immediate response as soon as the job is enqueued
> * redis job contract: payload is generic with an id, a task name, payload with the information to be sent (for photo delete, it will contain the photo_id, for instance). This can be derived directly from the database schema already decided upon. retries will be on exponential backoff with maximum 5 retries. if the job still fails after retries are used up, a record will be added to a new table in the database for dead-letter-jobs. It will include: autoincrement id, job_id (of the failed redis task), task_name, payload (used by the redis worker), error_trace (error message from last retry), failed_at (time of last retry failure), status (defaulted as "UNRESOLVED"). This table offers visibility too
> * just use "Idempotency-Key" as the header name, unless there are conventions. signed photoURL duration is 24h for now
> * continue deferring the downstream contracts till they are built

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
Updated both `supplier-service/SupplierServiceArchitecture.md` and `supplier-service/SupplierServiceSpec.md`. In the architecture doc: explained the same-origin/no-CORS deployment as a consequence of a single API gateway fronting all FoC services (§3, §9 item 15); added a `UNIQUE` constraint on `supplier(supplier_name, supplier_type, location_id)` to the data model (§6.2) and DDL (§6.4), enforced by both an application-level pre-check and the database constraint; clarified that `is_active` and `is_deleted` are independent flags — `is_active` is a separate admin-editable visibility toggle already settable via the generic `PUT` edit endpoint, and soft-delete (`DELETE`) only sets `is_deleted` since either flag alone hides a supplier (§6.2); and added §9 item 18 recording all of this, including a flagged edge case the team's answer didn't address: the `UNIQUE` constraint as given applies even to soft-deleted rows, which would block recreating a supplier with the same name/type/location as a previously soft-deleted one, contradicting F8.2.2's "if an *active* supplier ... exists" wording. In the spec: updated Phase 0 (API gateway), resolved Phase 2/3/4's flagged open questions accordingly, and updated the closing "Summary of open questions" section to mark three items resolved and add the new soft-deleted-row uniqueness question in their place.

**Files:**
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Whether the new `UNIQUE` constraint on `supplier(supplier_name, supplier_type, location_id)` should exclude soft-deleted rows (so a supplier can be recreated after a prior soft-delete), or whether such a recreation should instead reactivate the existing soft-deleted row, was not addressed by the team's answer and remains open (architecture §9 item 18, spec closing section item 4).

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
> Based on  @SupplierServiceSpec, plan phase 1

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
> Based on  @SupplierServiceSpec, plan phase 2

> The clarifications, update architecture and spec where appropriate:
>
> 1. The cloud provider is not decided yet, and as specified I want an interface to handle the interactions (upload, update, delete, view) so the provider can be swapped out easily. For local dev and testing, will use that same interface but on a local port + in-memory fake
> 2. Yes use multer as that's the industry standard
> 3. successful deletion returns 200 OK,  FK violation and duplicate UNIQUE returns 422 as they are validation issues. Lookups deletes are soft
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
> Based on  @SupplierServiceSpec, plan phase 2

> The clarifications, update architecture and spec where appropriate:
>
> 1. The cloud provider is not decided yet, and as specified I want an interface to handle the interactions (upload, update, delete, view) so the provider can be swapped out easily. For local dev and testing, will use that same interface but on a local port + in-memory fake
> 2. Yes use multer as that's the industry standard
> 3. successful deletion returns 200 OK,  FK violation and duplicate UNIQUE returns 422 as they are validation issues. Lookups deletes are soft
> 4. Only photoId and photoLocation. Actual photo binary is only sent during photo uploads/edits.
> 5. Reactivation leads to 200 OK. What do you mean by keeping is_active as it was? If its is just changing a supplier to active again, updated_on will change to track that , but the version will not change as no updates to the stored details are made. similarly, the details should not be replaced but they can be for a simpler logic [as no actual will occur]. Explain the rationale behind this confirmation
> 6. idempotency-key header is mandatory. missing leads to 400. in-flight marker TTL is 60s, cached response TTL is 24h. Cache keyed per user and per key for maximum security
> 7. facility hours filled by server. frontend will contain some text informing facilities are 24h
> 8. Display order will be based on how the user arranges them on the ui after uploading and before submission

> when is the reactivation path ran again?
>
> Still open questions:
>
> * Add a similar is_deleted col to the faculties, supplier_locations and supplier_categories tables
> * display_order starts at 0. Update day_of_week to start from 1 (mon) to 7 (sun). Add a is_24h col to the supplier_hours table so facilities will only get 1 entry
> * for local testing, we will spin up another mysql instance for storing the photos

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
> fake

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
> -  if a supplier is reactivated, default the is_active back to true - if its added back, it should be activated. Old is_active state overriden
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
> * sorry. the swap out mysql for minIO to simulate the cloud storage. No longer mysql. This would allow perfect simulation. minIO will return the location directly which will be stored by the supplier_photos table

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
