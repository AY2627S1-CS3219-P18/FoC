# User Service — Claude Code Implementation Instructions

> **How to use this file**: Read and implement ONE stage at a time. After completing each stage, stop, verify the checklist, and wait for confirmation from me before proceeding to the next stage. Do not implement future stages speculatively.

## AI Usage Logging

After completing each stage, generate the following for me to copy into `/ai/usage-log.md`:

\```

## <date> — Stage <n>: <stage name>

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
<brief summary of the stage instructions given>

**What it produced:**
<list of files created/modified>

**What I kept/changed/rejected:**
<leave blank for me to fill in after review>
\```

Also add this header comment to every file you create:

\```
// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: <date>
// <DD/MM/YYYY>: <scope> <n>
// Author review: <leave blank for me to fill in>
// <DD/MM/YYYY>: <scope> <n>
// Author review: <leave blank for me to fill in>
\```

---

## Context

You are implementing the **User Service** for a campus errand platform (FoC) built on a microservices architecture. This service handles everything user-related: registration, login, OTP verification, JWT auth, RBAC, and profile management.

CLAUDE NOTE
Before implementing this stage, read the current code, not just instructions.md. Several
fixes were made after the instructions were written, and the file has not been updated.
Where the two disagree, follow the codebase and tell me about the difference.

Conventions established in the code (keep them):

1. Emails and usernames are lowercased at the Zod boundary. Emails are also trimmed.
   Use the shared emailField and usernameField in auth.controller.ts for every new schema.
   A login identifier is lowercased whole.
2. Locking: use withTransaction plus SELECT ... FOR UPDATE, and pass `client` to EVERY query
   inside it. Never use the pool inside a transaction, because it deadlocks. AFTER the lock
   is granted, re-check the row that lockUserById returns (null, or status changed). The
   pre-lock read can be stale.
3. A single-row state change (logout, consume OTP, activate user) should be a conditional
   UPDATE ... WHERE <expected state>, checking rowCount. Do not read, check, then write.
4. Wrong OTP guesses must persist: return { ok: false } from checkOtp and throw only after
   the transaction commits, or the rollback undoes the increment.
5. Time comes from the database clock. Write expiries as NOW() + make_interval(...) in SQL.
   Compare against clock_timestamp() AS db_now. Do not use Date.now() for OTPs or refresh
   tokens (JWT iat/exp is the only exception).
6. deleteStalePendingUsers uses FOR UPDATE SKIP LOCKED, so rows in use are not deleted.
7. Queries take db: Queryable = pool. Queries used only inside transactions may make it required.
8. The super admin bootstrap uses ON CONFLICT DO NOTHING plus a re-check.

Watch for these when implementing:

- forgot-password must go through the same lock, cooldown and resend limit as resend-otp.
  Otherwise it is an unlimited email spammer, and each call kills the victim's live OTP.
- Resend/cooldown counts need a per-flow window (for example the last hour, or since the last
  successful use). An all-time count permanently locks users out of password reset.
- Anything that changes a password, suspends a user or resets a password must revoke ALL that
  user's refresh tokens in the SAME transaction as the change (revokeAllRefreshTokensForUser
  with a db param).
- A login racing a reset or suspend can issue a refresh token after the revoke. Handle it.
- Do not add new test cases unless I ask. Existing tests may need fixtures updated.
- Rate limiting and account lockout (NFR1, NFR2) are deferred to week 10. Do not add them now,
  but do not build anything that assumes they never exist.

When done, list any place where you deviated from instructions.md and why.

Also, don't implement test cases first.

## Product Backlog — User Service (F1–F5, NFR1–NFR4)

### F1 — User Registration

- **F1.1.1** (High, Recess) Reject usernames that are already in use.
- **F1.1.2** (High, Recess) Reject emails that are not in a valid format (must contain @ and domain).
- **F1.1.3** (High, Recess) Reject emails that are already registered to another account.
- **F1.1.4** (High, Recess) Reject passwords that don't contain at least 8 characters, one uppercase, one lowercase, one digit, and one special character.
- **F1.1.5** (High, Week 7) Send an OTP to the provided email and only complete registration after the OTP is verified.
- **F1.1.6** (High, Week 7) Allow requesting a new OTP email 60 seconds after the previous one, up to 5 times.
- **F1.1.7** (High, Week 7) Invalidate the OTP after one use OR after 10 minutes OR after a new OTP is generated, whichever comes first.
- **F1.1.8** (High, Week 7) Reserve the username and email during the OTP period to prevent duplicates.
- **F1.2.1** (High, Recess) Store passwords as salted hashes.

### F2 — Login / Logout

- **F2.1.1** (High, Recess) Accept login attempts where username/email and password match a registered account.
- **F2.1.2** (High, Recess) Reject login attempts where they don't match.
- **F2.1.3** (High, Recess) Authenticate subsequent requests from a logged-in user without re-entering credentials for the session duration.
- **F2.2.1** (High, Week 7) Users who have logged out must log in again to access the app.
- **F2.3.1** (High, Week 7) Allow other services to verify a user's identity and role from their active session.

### F3 — Password Reset ("Forgot Password")

- **F3.1.1** (High, Week 7) If the email matches a registered email, send an OTP before permitting password change.
- **F3.1.2** (High, Week 7) If the email does not match, do not send an OTP.
- **F3.1.3** (High, Week 7) Reject the new password if it doesn't meet F1.1.4 complexity rules.
- **F3.1.4** (High, Week 7) Invalidate the OTP after one use or 10 minutes or a new OTP generated, whichever comes first.

### F4 — Viewing and Updating Profile Information

- **F4.1.1** (Med, Week 10) Allow users to view their username and registered email.
- **F4.2.1** (Med, Week 10) Reject a new email if already in use, same as old email, or fails F1.1.2 complexity rules.
- **F4.2.2** (Med, Week 10) Require password re-entry; reject the email change if it doesn't match the current password.
- **F4.2.3** (Med, Week 10) Send an OTP to the new email and require entry before allowing the change.
- **F4.2.4** (Med, Week 10) Allow requesting a new OTP email 60 seconds after the previous one, up to 5 times.
- **F4.2.5** (Med, Week 10) Invalidate the OTP after one use or 10 minutes or a new OTP generated, whichever comes first.
- **F4.2.6** (Med, Week 10) Use the existing email for all communications/authentication until OTP verification completes.
- **F4.3.1** (Med, Week 10) Require password re-entry; reject the password change if it doesn't match the current password.
- **F4.3.2** (Med, Week 10) Send an OTP to the registered email and require entry before allowing the password change.
- **F4.3.3** (Med, Week 10) Reject the new password if it fails F1.1.4 complexity rules, or is identical to the old password.
- **F4.3.4** (Low, Week 10) Invalidate any active sessions on other devices after a successful password change.
- **F4.4.1** (Med, Week 10) Reject a new username if already in use by another user or identical to the old username.

### F5 — Role Management

- **F5.1.1** (High, Week 7) Enforce administrative privilege separation across user/administrator/super administrator.
- **F5.1.2** (High, Week 7) On startup, if no super administrator exists, bootstrap one using pre-configured system credentials.
- **F5.1.3** (High, Week 7) Prevent registration of an administrator account via public registration endpoints.
- **F5.1.4** (High, Week 7) Prevent a standard user from modifying the role of any user (including themself).
- **F5.1.5** (High, Week 7) Prevent an administrator from modifying the role of any user (including themself).
- **F5.1.6** (High, Week 7) Allow a super administrator to modify the role of any other user (excluding themself) to administrator or standard user.
- **F5.2.1** (High, Week 7) All users can post and fulfill errands without restriction.
- **F5.2.2** (High, Week 7) Persist the user's last active view (requestor/courier) across sessions.
- **F5.3.1** (High, Week 7) Allow administrators to view all users.
- **F5.3.2** (High, Week 7) Allow administrators to view transaction details of individual users.
- **F5.3.3** (High, Week 7) Allow administrators to suspend/unsuspend individual users.

### NFR1 — Brute-Force Protection

- **NFR1.1** Automatically lock an account for 1 hour after 5 consecutive failed login or OTP attempts within a 15-minute window.
- **NFR1.1.1** (Med, Week 10) Upon lock, dispatch a security notification email with an unlock link within 60 seconds.

### NFR2 — Timely OTP Delivery

- **NFR2.1** Dispatch the OTP email within 1 minute of the triggering event.
- **NFR2.1.1** (Med, Week 10) Retry failed OTP email attempts up to 3 times.
- **NFR2.1.2** (Med, Week 10) Log any OTP email delivery failures for monitoring.

### NFR3 — Additional Auth & Data Masking for Sensitive Info

- **NFR3.1.1** (Med, Week 10) Mask sensitive user fields (e.g. email addresses) by default across all standard admin views.
- **NFR3.1.2** (Med, Week 10) Require secondary OTP verification before unmasking sensitive user fields.
- **NFR3.1.3** (Med, Week 10) Unmasked info remains visible for max 15 minutes before automatically re-masking.
- **NFR3.2.1** (Med, Week 10) Require secondary OTP verification prior to high-risk admin actions (e.g. manual suspension, direct credit adjustments).
- **NFR3.2.2** (Med, Week 10) Record all secondary OTP verification attempts and high-risk admin actions in an audit log.

### NFR4 — Session Support

- **NFR4.1.1** (High, Week 8) Automatically invalidate a session after 30 minutes of inactivity, requiring re-authentication.
- **NFR4.1.2** (High, Week 8) Automatically invalidate a session after 7 days since last login, requiring re-authentication. _(labeled "NFR4.1." in the source — likely a typo for NFR4.1.2)_
- **NFR4.2.1** (High, Week 8) Notify the user 1 minute before session expiry due to inactivity, with an option to extend.

## Stage 1: Project Scaffold

Set up the below files and directory structure.

### Stack:

- Runtime: Node.js (Express) - TypeScript
- Database: PostgreSQL + pg (raw pg, no ORM or query builder)
- Containerisation: Docker + Docker Compose
- Frontend: React Vite (already partially implemented — do not touch it unless instructed)
- Auth: RS256 JWT (access token 15 min, refresh token 7 days stored as SHA-256 hash in DB)
- Password hashing: bcrypt (work factor 10)
- OTP/token hashing: SHA-256
- Email handing: Nodemailer
- Crypto handling: Node's build in crypto
- Request body validation: Zod
- Test runner: Vitest
- Linter: ESLint
- Formatter: Prettier

### Given repo structure (single-repo, one folder per microservice):

```
/
├── foc-mockup/    ← this is my frontend, already exists, do not modify
├── user-service/  ← you are building this
├── compose.yaml    ← top-level, to be created/extended
├── data           ← supplier seed data
└── ...            ← other services are here
```

### User service structure

user-service/
├── src/
├── keys/
├── Dockerfile ← already there
├── package.json
├── tsconfig.json
├── .env.example
├── .env ← gitignored
└── .gitignore

src/
├── routes/
├── controllers/
├── middleware/
├── services/
├── db/
│ ├── pool.ts
│ ├── init.sql
│ └── queries/
├── utils/
├── config.ts
└── app.ts

````

### Set up `package.json`

Create `user-service/package.json`:

```json
{
  "name": "user-service",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx src/app.ts",
    "dev": "nodemon -L --watch src --ext ts,json --exec tsx src/app.ts",
    "build": "tsc",
    "test": "vitest",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "dependencies": {
    "bcrypt": "^6.0.0",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^10.0.10",
    "pg": "^8.13.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@types/bcrypt": "^5.0.2",
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.11.0",
    "@types/nodemailer": "^6.4.17",
    "@types/pg": "^8.11.10",
    "eslint": "^9.17.0",
    "nodemon": "^3.1.9",
    "prettier": "^3.4.2",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "typescript-eslint": "^8.19.0",
    "vitest": "^1.6.0"
  }
}
````

### Set up `.env.example`

Create `user-service/.env.example`:

```env
# Server
PORT=3001
NODE_ENV=development

# PostgreSQL
DB_HOST=user-db
DB_PORT=5432
DB_NAME=user_service
DB_USER=postgres
DB_PASSWORD=postgres

# JWT (RS256)
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7

# Email (Nodemailer)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

### Set up `keys`

- Create `user-service/keys/`
- Generate an RS256 key pair and place them here

### Set up `.gitignore`

- Create `user-service/.gitignore` and add `keys/` in

### Set up app.ts

- Create a barebones app.ts stub in `/src/`

### Set up tsconfig.json

- Create a tsconfig.json in `/user-service/`

```
{
  "compilerOptions": {
    "target": "es2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    "rootDir": "./src",
    "outDir": "./dist",
    "sourceMap": true,


    "allowJs": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  },
  "include": ["src/**/*"]
}
```

### Verification

- Run `npm install` inside `user-service/` and confirm it completes without errors
- Confirm `keys/private.pem` and `keys/public.pem` exist

## Stage 2: Databaset setup

### Stage 2a: Write the schema

Create the SQL schema file `user-service/src/db/init.sql` with the following requirements:

- Create enums safely using DO $$ BEGIN ... EXCEPTION WHEN duplicate_object blocks:
  - `status_enum`: 'active', 'suspended'
  - `role_enum`: 'user', 'admin', 'super admin'
  - `purpose_enum`: 'Registration', 'Forgot Password', 'Change Email', 'Change Password', 'Admin Action'
- Create table using IF NOT EXISTS:

  ```
  CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status status_enum NOT NULL DEFAULT 'active',
  role role_enum NOT NULL DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS users_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  otp_hash CHAR(64) NOT NULL,
  new_email VARCHAR(255),
  purpose purpose_enum NOT NULL,
  attempts_count SMALLINT NOT NULL DEFAULT 0,
  max_attempts SMALLINT NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

### Stage 2b: Set up `config.ts`

Create `user-service/src/config.ts`:

- Load and validate all environment variables using Zod at startup
- If any required variable is missing, log a clear error and exit immediately
- Export a single structured `config` object grouped by concern (db, jwt, email, etc.)
- All other files in the project must import env vars from here, never from `process.env` directly

### Stage 2c: Set up connection pool

Create `user-service/src/db/pool.ts`:

- Export a single `pg.Pool` instance
- All connection config must come from `config.ts`, never from `process.env` directly

### Verification

- Remove a required env var from `.env` and confirm it crashes with a clear error message

## Stage 3: Docker Setup

### Stage 3a: Dockerfile

Modify the existing `user-service/Dockerfile`:

- Let's have a multi-stage Dockerfile - one stage for dev (FROM image AS dev) and one stage for prod (FROM image AS prod)
  - Dev stage: runs nodemon -L src/app.ts via tsx
  - Prod stage: compiles TypeScript first (tsc), then runs node dist/app.js

- Base image: `node:24-alpine`
- Working directory: `/app`
- Install dependencies from `package.json`
- Copy source files
- Expose port 3001

### Stage 3b: Docker Compose

Populate the existing `compose.yaml` at the repo root:

- A `user-db` service:
  - Image: `postgres:16-alpine`
  - Container name: `foc-user-db`
  - Healthcheck using `pg_isready`
  - Mount `./user-service/src/db/init.sql` into `/docker-entrypoint-initdb.d/` so the schema is applied on first run
  - Named volume for data persistence
- A `user-service` service:
  - Built from `./user-service/Dockerfile`, specify `target: dev`
  - Container name: `foc-user-service`
  - Depends on `user-db` being healthy before starting
  - Load all env vars using `env_file: ./user-service/.env`
  - Mount `./user-service/src:/app/src` for live code reloading
  - Mount `./user-service/keys:/app/keys` for JWT key access

### Stage 3c: .env files

- Create `user-service/.env` by copying `.env.example` as-is, remind user (with a comment) to fill in the SMTP details.
- Add `user-service/.env` to `.gitignore`

### Verification

- Run `docker compose up --build` and confirm both containers start cleanly
- Connect to the DB and verify all tables and enums exist:

```bash
  docker exec -it foc-user-db psql -U postgres -d user_service -c "\dt"
  docker exec -it foc-user-db psql -U postgres -d user_service -c "\dT"
```

## Stage 4: Core Auth

> Users are immediately active upon registration. OTP verification is added in Stage 5 — at that point, registration will require OTP before the account is activated. For now, registration creates an active account directly.

---

### Stage 4a: App Setup + Middleware

#### Dependencies

Add `cookie-parser` and its types to `package.json`:

```json
"cookie-parser": "^1.x"
"@types/cookie-parser": "^1.x"
```

#### Update `app.ts`

- Register `cookie-parser` middleware
- Register `express.json()` middleware if not already present
- Mount auth router at `/auth`

#### Create `src/utils/hash.ts`

- Export a `sha256(input: string): string` function using Node's built-in `crypto`

#### Create `src/utils/jwt.ts`

- jwt.ts has a single exported function, e.g. verifyAccessToken(token: string): { user_id: string, role: string }.
- It should call jwt.verify(token, publicKey, { algorithms: ['RS256'] }) and return { user_id, role }.

#### Create `src/middleware/authenticate.ts`

- Extract Bearer token from `Authorization` header
- Call verifyAccessToken(token) from jwt.ts
- If it succeeds, attach `{ user_id, role }` to `req.user`
- Reject with `401` and `{ message: 'Unauthorized', code: 'UNAUTHORIZED' }` if invalid or missing
- Also, add `src/types/express.d.ts` declaring `Express.Request.user?: { user_id: string; role: string }` via global declaration merging

#### Create `src/routes/auth.routes.ts`

- Set up an Express router
- Export it — handlers will be added in later sub-stages

#### Create `src/utils/AppError.ts`

A custom error class for known application errors:

- Constructor takes `status: number`, `message: string`, `code: string`
- Extends the built-in `Error` class

#### Create `src/utils/asyncHandler.ts`

A wrapper that automatically catches errors from async controller functions and passes them to Express's error handler via `next(err)` — eliminates the need for try/catch in every controller.

#### Update `app.ts`

Add a global error handler as the **last** middleware registered:

- If the error is an `AppError`, return `{ message, code }` with the appropriate status code
  If the error is a ZodError: return 400. If any issue has code unrecognized_keys, set message to "Request contains unexpected fields"; otherwise use the first issue's message. code: 'VALIDATION_ERROR'.
- If the error is a SyntaxError with err.type === 'entity.parse.failed' (malformed JSON body from express.json()): return 400 with { message: 'Malformed JSON body', code: 'VALIDATION_ERROR' }.
- Otherwise: log the error and return 500 with { message: 'Internal server error', code: 'INTERNAL_ERROR' }.

#### Create `src/utils/cookies.ts`

- Export a `REFRESH_COOKIE_OPTIONS` constant: `{ httpOnly: true, secure: ..., sameSite: 'lax' }`
- Both `login` (sets the cookie, with `maxAge`) and `logout` (clears it) must import and reuse this constant — never duplicate the options literally in two places

#### Cors

- Add the `cors` package (`^2.x`) to `user-service/package.json`. In `app.ts`, register `cors({ origin: '<frontend dev URL, e.g. http://localhost:5173>', credentials: true })`.

#### General requirements (add to existing list)

- All Zod schemas must use `.strict()` to reject requests containing fields not defined in the schema
- All controllers must be wrapped with `asyncHandler` — no try/catch in controllers
- All known errors (duplicate username, invalid credentials etc.) must be thrown as `AppError` from the service layer
- The global error handler in `app.ts` is the single place that converts errors to HTTP responses
- Since `tsconfig.json` uses `"module": "NodeNext"`, all relative imports throughout the project must include the explicit `.js` extension (e.g. `import { sha256 } from '../utils/hash.js'`), even though the source files are `.ts`
- Query functions returning a user row (findByUsername, findByEmail, findById) return the full row, including password_hash. Callers must never return, log, or spread the full user object directly — always destructure only the needed fields. password_hash must never leave the service layer.

#### Verification

- `app.ts` compiles and starts without errors inside Docker
- A request with no token → `401`
- A request with an expired or tampered-signature token → `401`
- A request with a malformed JSON body → `400`
- A request with an extra / unrecognised field in an otherwise valid body → `400`: `"Request contains unexpected fields"`

---

### Stage 4b: Registration

#### Create `src/db/queries/users.queries.ts`

Implement the following query functions:

- `createUser({ username, email, passwordHash })` — inserts into `users` table
  - In authService.register(), wrap the userQueries.createUser() call in a try/catch. If the caught error has code === '23505' (Postgres unique violation), inspect err.constraint: if it includes username, throw AppError(409, 'Username already in use', 'USERNAME_TAKEN'); if it includes email, throw AppError(409, 'Email already in use', 'EMAIL_TAKEN'). Re-throw any other error unchanged.
- `findByUsername(username)` — returns user or null
- `findByEmail(email)` — returns user or null
- `findById(userId)` - returns user or null

#### Create `src/services/auth.service.ts`

Implement `register({ username, email, password })`:

- Validate username format: min 3 chars, max 255 chars, no spaces, no special characters
- Validate email format: must contain @ and valid domain
- Validate password complexity: min 8 chars, at least one uppercase, one lowercase, one digit, one special character
- If any format validation fails → throw `AppError(400, '...', 'VALIDATION_ERROR')`
  - Username: "Username must contain between 3 and 255 chars and have no spaces or special characters."
  - Email: "Please enter a valid email"
  - Password: "Password must contain at least 8 characters, with at least one uppercase, one lowercase, one digit and one special character. "
- Check username not already in use → call `userQueries.findByUsername()`, throw `AppError(409, 'Username already in use', 'USERNAME_TAKEN')`
- Check email not already in use → call `userQueries.findByEmail()`, throw `AppError(409, 'Email already in use', 'EMAIL_TAKEN')`
- Hash password with bcrypt (work factor 10)
- Call `userQueries.createUser()` to insert into `users` table with `status = 'active'`, `role = 'user'`

#### Create `src/controllers/auth.controller.ts`

- Wrap controller with asyncHandler
  Implement `register` handler:

Validate request body with Zod (use custom messages instead of Zod's own defaults) — check only presence, type, and extra fields; all format/complexity rules stay in the service layer:

- username: required error "Username is required", type error "Username must be a string"
- email: required error "Email is required", type error "Email must be a string"
- password: required error "Password is required", type error "Password must be a string"

**Normalisation (applied in the Zod schema, so the service and DB only ever see normalised values):**

- `email`: trim, then lowercase. Define it once as a shared `emailField` in `auth.controller.ts` and reuse it in every schema that takes an email (register, verify-otp, resend-otp, and any later stage).
- `username`: lowercase only. Do **not** trim, so a leading or trailing space still fails the "no spaces" rule in the service layer.
- Usernames and emails are stored lowercase, so lookups are effectively case-insensitive.

Use .strict() to reject requests containing fields not defined in the schema above. The resulting unrecognized_keys error is handled by the global error handler set up in Stage 4a (message: "Request contains unexpected fields") — no additional handling needed in this controller.

- Call `authService.register()`
- Return `201` with `{ message: 'User registered successfully', code: 'REGISTER_SUCCESS' }`

#### Wire up route

Add to `auth.routes.ts`:

```ts
router.post("/register", authController.register);
```

#### Verification

- `POST /auth/register` with valid body → 201, user appears in DB with hashed password (superseded by stage 5d: reponse is `201_OTP_SENT`, account starts `pending`)
- `POST /auth/register` with duplicate username → 409 USERNAME_TAKEN
- `POST /auth/register` with duplicate email → 409 EMAIL_TAKEN
- `POST /auth/register` with weak password → 400 VALIDATION_ERROR
- `POST /auth/register` with invalid email format → 400 VALIDATION_ERROR
- `POST /auth/register` with username less than 3 chars → 400 VALIDATION_ERROR
- `POST /auth/register` with username containing spaces → 400 VALIDATION_ERROR
- `POST /auth/register` with a field missing entirely (e.g. no password key) → 400 VALIDATION_ERROR, message "Password is required"
- `POST /auth/register` with a field of the wrong type (e.g. password: 12345) → 400 VALIDATION_ERROR, message "Password must be a string"
- `POST /auth/register` with an extra/unrecognized field (e.g. role: 'admin' included in the body) → 400 VALIDATION_ERROR, message "Request contains unexpected fields"
- `POST /auth/register` with malformed JSON body (not valid JSON at all) → 400 VALIDATION_ERROR, message "Malformed JSON body"
- Fire two `POST /auth/register` requests with the same username near-simultaneously → confirm one succeeds 201 and the other returns 409 USERNAME_TAKEN (not 500)

---

### Stage 4c: Login + Tokens

#### Create `src/db/queries/tokens.queries.ts`

Implement the following query functions:

- `createRefreshToken({ userId, tokenHash, ttlDays, userAgent, ipAddress })` — inserts into `refresh_tokens` table, with `expires_at = NOW() + make_interval(days => $ttl)` computed in SQL (see the clock rule in Stage 5c)
- `findRefreshToken(tokenHash)` — returns token row (plus `clock_timestamp() AS db_now`) or null
- `lockRefreshToken(tokenHash, db)` — `SELECT *, clock_timestamp() AS db_now ... FOR UPDATE`, returns the token row (plus `db_now`) or null
- `revokeRefreshToken(tokenHash, db)` — sets `is_revoked = true`, `revoked_at = now`

All token queries take an optional last parameter `db: Queryable = pool`, like the user queries, so they can run inside a transaction.

#### Update `src/services/auth.service.ts`

Implement `login({ identifier, password }, userAgent, ipAddress)`:

- Look up user by username or email using `identifier`
- Reject if not found → throw `401` with `{ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }`
- Reject if password doesn't match bcrypt hash → throw `401` with same error
- Reject if `status = 'suspended'` → throw `403` with `{ message: 'Account suspended', code: 'ACCOUNT_SUSPENDED' }`
- Issue RS256 access token (15 min TTL) with claims `{ sub: user.id, role: user.role }` using private key from `config.ts`
- Generate refresh token: 32 cryptographically random bytes (hex string) using Node's built-in `crypto`
- Store SHA-256 hash of refresh token in `refresh_tokens` table with `expires_at = now + 7 days`
- **Race-safety:** verify the password before locking (bcrypt is slow), then create the refresh token inside `withTransaction`: `locked = lockUserById(user.id, client)`; if `locked` is null or `locked.password_hash !== user.password_hash` → `401 INVALID_CREDENTIALS` (the password changed while logging in); if `locked.status` is `'suspended'` → `403 ACCOUNT_SUSPENDED`; otherwise `createRefreshToken(..., client)`. Take the role for the access token from `locked`. Without this, a login that verified the old password can create a refresh token _after_ a password reset has revoked all of them. (Added in Stage 6, see "Changes to already-implemented code".)
- Return `{ accessToken, refreshToken, user: { id, username, email, role } }`

#### Update `src/controllers/auth.controller.ts`

Implement `login` handler - accepts both username / email AND password

Validate request body with Zod (use custom messages instead of Zod's own defaults) — check only presence, type, and extra fields; all format/complexity rules stay in the service layer:

- identifier: required error "Username/Email is required", type error "Username/Email must be a string"
- password: required error "Password is required", type error "Password must be a string"
- `identifier` is trimmed and lowercased whole (usernames and emails are both stored lowercase).

Use .strict() to reject requests containing fields not defined in the schema above. The resulting unrecognized_keys error is handled by the global error handler set up in Stage 4a (message: "Request contains unexpected fields") — no additional handling needed in this controller.

- Call `authService.login()`
- Set refresh token as the settings specified in `src/utils/cookies.ts`.
- Return `200` with `{ accessToken, user: { id, username, email, role } }`

Error responses:

- `401`: `{ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }`
- `403`: `{ message: 'Account suspended', code: 'ACCOUNT_SUSPENDED' }`

#### Wire up route

Add to `auth.routes.ts`:

```ts
router.post("/login", authController.login);
```

#### Verification

- `POST /auth/login` with valid credentials → `200`, access token in body, refresh token cookie set
- `POST /auth/login` with wrong password → `401`
- `POST /auth/login` with unknown identifier → `401`
- `POST /auth/login` with suspended account → `403`
- Confirm refresh token hash appears in `refresh_tokens` table in DB
- `POST /auth/login` using the registered email as `identifier` → `200`, succeeds
- `POST /auth/login` using the registered username as `identifier` → `200`, succeeds
- `POST /auth/login` with a field missing entirely (e.g. no `identifier`) → `400` `VALIDATION_ERROR`, message `"Username/Email is required"`
- `POST /auth/login` with a field of the wrong type (e.g. `identifier: 12345`) → `400` `VALIDATION_ERROR`, message `"Username/Email must be a string"`
- `POST /auth/login` with an extra/unrecognized field → `400` `VALIDATION_ERROR`, message `"Request contains unexpected fields"`
- Decode the returned access token (e.g. jwt.io or a script) → confirm claims are `{ sub: <user id>, role: <user role> }`, algorithm `RS256`, `exp` ≈ 15 min out

---

### Stage 4d: Logout + Refresh

#### Update `src/services/auth.service.ts`

Implement `logout(refreshToken)`:

- Hash refresh token with SHA-256
- Run everything inside `withTransaction`, so two concurrent logouts with the same cookie cannot both succeed:
  - Look up the token with `lockRefreshToken(tokenHash, client)`, which is `SELECT ... FOR UPDATE` on `refresh_tokens`, so a second request waits and then sees the first one's committed result
  - If not found or already revoked → throw `401` with `{ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' }`
  - Set `is_revoked = true`, `revoked_at = now` using the same `client`

Implement `refresh(refreshToken)`:

- Hash refresh token with SHA-256
- `findRefreshToken(tokenHash)` as a plain, unlocked read. This is a cheap early exit and it gives the `user_id`: if not found, revoked, or expired (compare `expires_at` against the row's `db_now`, not `Date.now()`) → throw `401` with `{ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' }`
- Then, inside `withTransaction`, lock and re-check. **Lock order matters: user row first, then token row.**
  1. `lockedUser = lockUserById(tokenRow.user_id, client)`. If null → `401 INVALID_REFRESH_TOKEN`
  2. `lockedToken = lockRefreshToken(tokenHash, client)`. If null, revoked, or expired (compare against its `db_now`) → `401 INVALID_REFRESH_TOKEN`
  3. If `lockedUser.status` is `'suspended'` → `AppError(403, 'Account suspended', 'ACCOUNT_SUSPENDED')` instead of issuing a new token
  4. Issue the new RS256 access token (15 min TTL) from `lockedUser.id` and the freshly-locked `lockedUser.role` (not any cached role), so a role change (e.g. promotion) takes effect on the next refresh rather than only after re-login
- Return `{ accessToken }`

**Why the locks:** without them, a refresh already in flight can mint an access token after a logout, password reset, or suspension has committed. With them, a refresh either finishes before that action or waits and then sees the revoked token (`401`). An access token issued earlier still lives out its 15 minutes.

**Lock ordering rule (whole service):** whenever a transaction locks both a user row and refresh-token rows, lock the **user row first**. Reset-password (user, then its tokens), login and refresh all follow it. Locking a token first and the user second could deadlock against reset-password, and the caller would get a 500. Logout locks only the token row, so it cannot form a cycle.

#### Update `src/controllers/auth.controller.ts`

Implement `logout` handler. It does **not** use the `authenticate` middleware: the refresh cookie is the credential, so logout still works after the access token has expired (otherwise an expired access token blocks logout, the refresh token stays valid, and the browser's silent refresh logs the user straight back in):

- Extract refresh token from `req.cookies.refreshToken`. If the cookie is missing → `401 INVALID_REFRESH_TOKEN`
- Call `authService.logout()`
- Clear the `refreshToken` cookie (with settings from `src/utils/cookies.ts`)
- Return `200` with `{ message: 'Logged out successfully', code: 'LOGOUT_SUCCESS' }`

Logout revokes only the refresh token in the cookie (that device's session). The access token is stateless and stays valid until it expires.

Implement `refresh` handler:

- Extract refresh token from `req.cookies.refreshToken`
- Call `authService.refresh()`
- Return `200` with `{ accessToken }`

#### Wire up routes

Add to `auth.routes.ts`:

```ts
router.post("/logout", authController.logout);
router.post("/refresh", authController.refresh);
```

#### Verification

- `POST /auth/logout` with a valid refresh cookie → `200`, cookie cleared, token revoked in DB, whether or not an `Authorization` header is sent (including an expired access token)
- `POST /auth/logout` without a `refreshToken` cookie → `401 INVALID_REFRESH_TOKEN`
- `POST /auth/refresh` with valid cookie → `200`, new access token returned
- `POST /auth/refresh` after logout → `401`
- `POST /auth/refresh` with expired refresh token → `401`
- `POST /auth/logout` with a valid access token but a missing/garbage `refreshToken` cookie → `401 INVALID_REFRESH_TOKEN`
- `POST /auth/logout` with a valid access token but an already-revoked `refreshToken` cookie → `401 INVALID_REFRESH_TOKEN`
- Fire several `POST /auth/logout` requests at once with the same access token and cookie → exactly one `200`, the rest `401 INVALID_REFRESH_TOKEN`
- Suspend the user in the DB directly (`UPDATE users SET status = 'suspended' WHERE ...`), then `POST /auth/refresh` with their still-valid, non-expired, non-revoked cookie → `403 ACCOUNT_SUSPENDED`, no new access token issued
- Promote the user in the DB directly (`UPDATE users SET role = 'admin' WHERE ...`), then `POST /auth/refresh` with a valid cookie → `200`, decode the new access token and confirm its `role` claim reflects `'admin'`, not the stale role from the original login
- `POST /auth/refresh` with a `refreshToken` cookie that never existed (random hex string, never issued) → `401 INVALID_REFRESH_TOKEN`
- Run `POST /auth/refresh` in a loop while `POST /auth/logout` runs with the same cookie → once logout has returned `200`, every refresh that starts afterwards returns `401 INVALID_REFRESH_TOKEN`
- Run `POST /auth/refresh` and `POST /auth/reset-password` concurrently several times (Stage 6d) → no deadlock errors: no `500` responses and no `deadlock detected` in the service logs

---

### Stage 4e: Inter-Service Verify + Super Admin Bootstrap

#### GET /auth/verify

Add to `src/controllers/auth.controller.ts`:

Implement `verify` handler:

- Extract the Bearer token from the Authorization header
- Call the verifyAccessToken(token) util from src/utils/jwt.ts (created in Stage 4a)
- On success, return 200 with { user_id, role } from the verified claims
- Reject with `401` and `{ message: 'Invalid token', code: 'INVALID_TOKEN' }` if invalid or missing or expired

Add to `auth.routes.ts`:

```ts
router.get("/verify", authController.verify);
```

#### Super admin bootstrap

Add the following to `.env.example` and `.env`:

```env
# Super Admin Bootstrap
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_EMAIL=superadmin@foc.com
SUPER_ADMIN_PASSWORD=
```

On app startup in `app.ts`:

- Check if a user with `role = 'super admin'` exists in the `users` table
- If not, create one using `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` from `config.ts`
- Password must meet the same complexity rules as regular registration
- Log a clear message when bootstrap creates the super admin
- Skip silently if super admin already exists

**Race-safe creation:** the check-then-create must tolerate two instances starting at once, and a configured username or email that already belongs to a regular user.

- Insert with `INSERT ... ON CONFLICT DO NOTHING RETURNING *`. `createSuperAdmin` returns the new row, or nothing if the insert was skipped.
- Lowercase (and trim) the configured username and email before inserting, like every other username and email.
- If the insert was skipped, run the super admin check again:
  - A super admin now exists → another instance created it; continue silently.
  - Still none → the configured username or email belongs to a non-super-admin account; throw a clear error, for example `SUPER_ADMIN_USERNAME or SUPER_ADMIN_EMAIL is already used by a non-super-admin account.`

- In app.ts, ensure the super admin bootstrap check completes (await it) before calling app.listen().
- In config.ts's Zod schema, SUPER_ADMIN_PASSWORD must use .min(1) (or equivalent) rather than a bare .string().

Add super admin credentials to `config.ts` Zod schema.

#### Verification

- `GET /auth/verify` with valid access token → `200`, returns `{ user_id, role }`
- `GET /auth/verify` with invalid token → `401`
- `GET /auth/verify` with expired token → `401`
- Confirm super admin exists in DB on first startup:

```bash
  docker exec -it foc-user-db psql -U postgres -d user_service -c "SELECT username, role FROM users;"
```

- Restart containers and confirm super admin is not duplicated
- Configure `SUPER_ADMIN_USERNAME` to a username already held by a regular user (on a DB that has no super admin) → the app exits with the clear error message, not a raw Postgres unique-violation
- `GET /auth/verify` with no `Authorization` header at all → `401 INVALID_TOKEN`
- `GET /auth/verify` with a well-formed but wrong-signature token (e.g. signed with a different key pair) → `401 INVALID_TOKEN`
- Take one valid access token, confirm it's accepted by both an `authenticate`-protected route and by `GET /auth/verify` (logout no longer uses `authenticate`, so no route uses it until `GET /users/me` in a later stage; until then check this with a temporary protected test route, or defer it) — confirms both call sites agree, since they share `verifyAccessToken`

## Stage 5: OTP Flow (Send, Verify, Resend)

> **Scope**: This stage builds the generic OTP infrastructure (generation, hashing, email delivery, verification, resend) and wires it up for the **Registration** purpose only. Forgot Password, Change Email, Change Password and Admin Action are wired in later stages, so the service layer must take `purpose` as a parameter, but the public endpoints only accept `registration` for now.
>
> Registration changes from "instant active account" (Stage 4b) to "pending account, active only after OTP verification".
>
> Backlog refs: F1.1.5, F1.1.6, F1.1.7, F1.1.8.

### Design decisions (already made, do not change)

| Rule                       | Value                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| OTP format                 | 6 digits, numeric, cryptographically random (`crypto.randomInt`), zero-padded                                             |
| OTP storage                | SHA-256 hash in `users_otps.otp_hash`, never the plaintext                                                                |
| OTP lifetime               | 10 minutes from creation                                                                                                  |
| Single use                 | Consumed on successful verification (`consumed_at` set)                                                                   |
| New OTP invalidates old    | Generating a new OTP sets `consumed_at` on all of that user's still-active OTPs for the same purpose                      |
| Wrong-guess limit          | `max_attempts` = 5 per OTP (DB default). Once `attempts_count` reaches the max, that OTP is dead and the user must resend |
| Resend cooldown            | 60 seconds since the previous OTP was created                                                                             |
| Resend limit               | 5 resends per registration (i.e. at most 6 OTP rows per user for `Registration`)                                          |
| Username/email reservation | The pending user row itself holds the username and email until the latest OTP expires                                     |
| Registration `new_email`   | `NULL` (only used by Change Email later)                                                                                  |

---

### Stage 5a: Schema, Config, Utilities

#### Update `src/db/init.sql`

- Add `'pending'` to `status_enum`: `('pending', 'active', 'suspended')`
- Keep the `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object` wrapper
- Note: `init.sql` only runs on a fresh DB volume. After this change, reset the dev DB with `docker compose down -v` (dev data only) so the enum is recreated. Remind me of this in your summary.

#### Update `.env.example` and `.env`

```env
# OTP
OTP_TTL_MINUTES=10
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_MAX_RESENDS=5
OTP_RESEND_WINDOW_MINUTES=60
```

#### Update `src/config.ts`

- Add the four OTP vars to the Zod schema (coerce to numbers, positive integers) and expose them as `config.otp = { ttlMinutes, resendCooldownSeconds, maxResends, resendWindowMinutes }`. `resendWindowMinutes` is the rolling window used to count resends for purposes other than registration (see `countOtps` in Stage 5c).
- SMTP vars (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) may be empty **only when** `NODE_ENV=development`. In any other environment they are required and the app must exit with a clear error, as before.

#### Update `src/utils/hash.ts`

- Add `hashesMatch(a: string, b: string): boolean` using `crypto.timingSafeEqual` on the two hex digests (return `false` if lengths differ, never throw)

#### Create `src/utils/otp.ts`

- `generateOtp(): string` — `crypto.randomInt(0, 1_000_000)` padded to 6 digits with leading zeros. Do not use `Math.random`.

#### Create `src/db/transaction.ts`

Some operations in this stage involve several database steps that must succeed or fail together (e.g. creating a pending user _and_ its OTP). This file provides a helper for that.

**`withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T>`**

A transaction has to run on a single connection, so this helper:

1. Borrows one connection from the pool.
2. Runs `BEGIN`, then calls `fn(client)`. All queries inside `fn` must use this `client`, not the pool.
3. If `fn` finishes normally, runs `COMMIT` and returns its result.
4. If `fn` throws, runs `ROLLBACK` to undo everything, then rethrows the same error so the global error handler still sees it.
5. Always returns the connection to the pool in a `finally` block, whether it succeeded or failed. A leaked connection will eventually make the whole service hang.

**`Queryable` type: `pg.Pool | pg.PoolClient`**

Both the pool and a checked-out client have a `.query()` method. Exporting this type lets each query function accept either one, so it works on its own (using the pool) or inside a transaction (using the transaction's client).

#### Update `src/db/queries/users.queries.ts`

All query functions now accept an optional last parameter `db: Queryable = pool` so they can run inside a transaction. Existing callers keep working unchanged.

- `createUser({ username, email, passwordHash, status })` — `status` is now a parameter (`'pending' | 'active'`). Update the Stage 4b caller and the super admin bootstrap to pass it explicitly (bootstrap passes `'active'`).
- `lockUserById(userId, db)` — `SELECT ... FOR UPDATE`, returns the row or null
- `activateUser(userId, db)` — sets `status = 'active'`, `updated_at = NOW()` **only where `status = 'pending'`**; returns whether a row was updated
- `deleteStalePendingUsers({ username, email }, db)` — a single statement:

```sql
DELETE FROM users
WHERE id IN (
  SELECT id FROM users
  WHERE status = 'pending'
    AND (username = $1 OR email = $2)
    AND NOT EXISTS (
      SELECT 1 FROM users_otps o
      WHERE o.user_id = users.id AND o.expires_at > NOW()
    )
  FOR UPDATE SKIP LOCKED
);
```

`FOR UPDATE SKIP LOCKED` matters: a row that a verify or resend has locked is skipped instead of waited on. Without it, the delete waits for the lock and then deletes the row even though the resend just gave it a live OTP. The skipped row is then seen as taken, and the register request returns `USERNAME_TAKEN` or `EMAIL_TAKEN`.

Cascade deletes the stale OTP rows. This is how an expired reservation is released.

#### Verification

- `docker compose down -v && docker compose up --build` starts cleanly
- `\dT+ status_enum` shows `pending`, `active`, `suspended`
- App still boots with SMTP vars empty in development
- Temporarily set `NODE_ENV=production` with empty SMTP vars → app exits with a clear error naming the missing variables (revert afterwards)
- `generateOtp()` never returns a string that isn't exactly 6 digits (quick Vitest unit test: 10,000 iterations, regex `^\d{6}$`)

---

### Stage 5b: Email Service

#### Create `src/services/email.service.ts`

- Create one Nodemailer transport from `config.email`
- Export `sendOtpEmail({ to, otp, purpose }: { to: string; otp: string; purpose: string }): Promise<void>`
- Subject and body wording come from a small `purpose → { subject, intro }` map. For now only `Registration` is needed: subject `"Your FoC verification code"`.
- Send both `text` and `html` bodies. Body contains the OTP and the expiry (`config.otp.ttlMinutes` minutes). No links.
- The function **throws** on send failure. Callers decide what to do (see 5d/5e).
- Development fallback: if `NODE_ENV=development` and `SMTP_HOST` is empty, do not attempt SMTP. Log `[DEV EMAIL] to=<to> purpose=<purpose> otp=<otp>` to the console instead. This branch must be unreachable in any other environment.
- Never log the OTP anywhere else.

#### Verification

- With SMTP empty in development, calling the function prints the dev log line
- With real SMTP credentials filled in, an email arrives at a real inbox with the correct code and expiry text

---

### Stage 5c: OTP Queries + Service

#### Create `src/db/queries/otp.queries.ts`

All functions take `db: Queryable` as the last parameter.

- `createOtp({ userId, otpHash, purpose, newEmail, ttlMinutes }, db)` — inserts into `users_otps`, with `expires_at = NOW() + make_interval(mins => $ttl)` computed in SQL
- `invalidateActiveOtps(userId, purpose, db)` — `UPDATE users_otps SET consumed_at = NOW() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`
- `findLatestOtp(userId, purpose, db)` — most recent row by `created_at` (any state), plus `clock_timestamp() AS db_now`, or null
- `countOtps(userId, purpose, db, sinceMinutes?)` — number of rows for that user and purpose (used for the resend limit).
  - Without `sinceMinutes` it counts **all** rows. Registration deliberately calls it this way (5 resends per registration, per F1.1.6), because the flow ends when the last OTP expires and the user can register again. Do not route the registration resend through `requestOtp` (Stage 6a) without keeping this behaviour.
  - With `sinceMinutes` it counts only rows with `created_at > clock_timestamp() - sinceMinutes`. Purposes that can be requested repeatedly over an account's lifetime (forgot password, change email, change password, admin action) pass `config.otp.resendWindowMinutes`, so the limit is per rolling window and a user is never locked out permanently.
- `incrementAttempts(otpId, db)` — `attempts_count = attempts_count + 1`, returns the new count
- `consumeOtp(otpId, db)` — `SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL`, returns whether a row was updated

**Clock rule (applies to the whole service):** the database owns time. Write expiries in SQL (`NOW() + make_interval(...)`). For "has it expired?" and cooldown checks, compare against the `db_now` returned by the query (`clock_timestamp()`), never `Date.now()`. Use `clock_timestamp()` rather than `NOW()` for these reads, because `NOW()` is frozen at the start of the transaction and would be stale after waiting on a row lock. JWT `iat`/`exp` are the only exception, since they are set by the JWT library.

#### Create `src/services/otp.service.ts`

This layer is purpose-agnostic and knows nothing about HTTP.

- `issueOtp({ userId, email, purpose, newEmail? }, db)`:
  1. `invalidateActiveOtps`
  2. `generateOtp()`, then `sha256` it
  3. `createOtp` with `ttlMinutes: config.otp.ttlMinutes` (the database computes the expiry)
  4. `sendOtpEmail` (sent to `newEmail ?? email`)
  5. If sending throws, log the error (without the OTP) and throw `AppError(503, 'Unable to send verification email. Please try again.', 'EMAIL_SEND_FAILED')`
  - Callers run this inside `withTransaction`, so a send failure rolls back the new OTP (and any invalidation of the previous one).

- `checkOtp({ userId, purpose, otp }, db)` — must be called inside a transaction that already holds the user row lock:
  1. `findLatestOtp`. If null, or `consumed_at` is set → `AppError(400, 'Invalid or expired OTP', 'INVALID_OTP')`
  2. If `expires_at` has passed → `AppError(400, 'OTP has expired. Please request a new one.', 'OTP_EXPIRED')`
  3. If `attempts_count >= max_attempts` → `AppError(429, 'Too many incorrect attempts. Please request a new OTP.', 'OTP_ATTEMPTS_EXCEEDED')`
  4. Compare `sha256(otp)` to `otp_hash` with `hashesMatch`
  5. On mismatch: `incrementAttempts`, then return `{ ok: false }` (do **not** throw inside the transaction, see the warning below)
  6. On match: `consumeOtp`. If it returns false, treat as `INVALID_OTP`. Return `{ ok: true }`.

> **Warning: the attempt increment must survive.** If the wrong-guess path throws inside `withTransaction`, the `ROLLBACK` will undo the `incrementAttempts` and the attempt limit becomes bypassable. `checkOtp` returns `{ ok: false }`, the transaction commits, and only then does the caller throw `AppError(400, 'Invalid or expired OTP', 'INVALID_OTP')`.

#### Verification

- Unit-test `checkOtp`'s branching with a stubbed `db` where practical (Vitest); at minimum verify manually via 5e

---

### Stage 5d: Registration Now Creates a Pending Account

#### Update `authService.register()` in `src/services/auth.service.ts`

Keep all existing format validation (username, email, password) and error messages unchanged. Replace the persistence part with a single `withTransaction`:

1. `deleteStalePendingUsers({ username, email })`
2. Existing duplicate checks: `findByUsername` then `findByEmail`, throwing `USERNAME_TAKEN` / `EMAIL_TAKEN` (409) as before. A live pending user (unexpired OTP) counts as taken, which is the F1.1.8 reservation.
3. Hash the password with bcrypt (work factor 10)
4. `createUser({ ..., status: 'pending' })`, keeping the existing `23505` catch → `USERNAME_TAKEN` / `EMAIL_TAKEN` mapping (this still covers the concurrent-register race)
5. `issueOtp({ userId, email, purpose: 'Registration' })`

If any of the 5 steps fails, the transaction rolls back and no pending user remains.

#### Update `register` in `src/controllers/auth.controller.ts`

- Request validation unchanged
- Return `201` with `{ message: 'Verification code sent to your email', code: 'OTP_SENT' }`

#### Update `authService.login()`

- After the password check succeeds, if `status = 'pending'` → `AppError(403, 'Account not verified', 'ACCOUNT_NOT_VERIFIED')`
- Keep the order: not found / wrong password (401) first, then pending (403), then suspended (403). This prevents revealing account state to someone who doesn't know the password.

#### Verification

- `POST /auth/register` valid body → `201 OTP_SENT`, user row exists with `status = 'pending'`, one `users_otps` row exists with `purpose = 'Registration'`, `otp_hash` is 64 hex chars, `expires_at` ≈ 10 min out, `new_email` is NULL
- Dev console shows the OTP (or a real email arrives if SMTP is configured)
- `POST /auth/login` with the pending account's correct credentials → `403 ACCOUNT_NOT_VERIFIED`
- `POST /auth/login` with the pending account and a wrong password → `401 INVALID_CREDENTIALS`
- `POST /auth/register` again with the same username/email while the OTP is still live → `409 USERNAME_TAKEN` / `EMAIL_TAKEN`
- Set the pending user's OTP `expires_at` to the past in the DB, then register again with the same username and email → `201`, and the old pending row is gone (only one row for that username)
- Force an email failure (e.g. temporarily break the transport) → `503 EMAIL_SEND_FAILED`, and no pending user or OTP row is left behind
- Concurrent duplicate registration test from Stage 4b still returns one `201` and one `409`, never `500`
- Existing super admin bootstrap still works (creates an `active` super admin)

---

### Stage 5e: Verify OTP + Resend OTP Endpoints

Both endpoints are **public** (no `authenticate`). The API-facing `purpose` value is lowercase (`'registration'`); map it to the DB enum value (`'Registration'`) in one place. Only `'registration'` is accepted for now; extend the Zod enum in later stages.

#### Request validation (Zod, `.strict()`, custom messages, presence/type/extra-fields only)

`POST /auth/verify-otp`:

- email: required "Email is required", type "Email must be a string" (use the shared `emailField`: trimmed and lowercased)
- otp: required "OTP is required", type "OTP must be a string"
- purpose: required "Purpose is required", type "Purpose must be a string", not in the allowed list → "Invalid purpose"

`POST /auth/resend-otp`:

- email and purpose as above (no `otp`)

Format rule stays in the service layer: `otp` must match `^\d{6}$`, else `AppError(400, 'OTP must be a 6-digit code', 'VALIDATION_ERROR')`.

#### `authService.verifyRegistrationOtp({ email, otp })`

Inside `withTransaction`:

1. Look up the user by email. If none, or `status !== 'pending'` → `INVALID_OTP` (same generic error, do not reveal which case)
2. `locked = lockUserById(user.id)` (serialises concurrent verify/resend for this user). **Re-check after the lock:** if `locked` is null or `locked.status !== 'pending'` → `INVALID_OTP`. The status read in step 1 can be stale, because another request may have changed the row while this one waited for the lock.
3. `checkOtp(...)`
4. If `{ ok: true }` → `activateUser(user.id)`; if it returns false, treat as `INVALID_OTP`
5. Commit, then: if `{ ok: false }` → throw `AppError(400, 'Invalid or expired OTP', 'INVALID_OTP')`
6. On success return nothing sensitive

> Leave a `// TODO(credit-service): emit user-registered event here` comment at the activation point. Do not implement it (F19.1.1 is a later stage).

#### `authService.resendRegistrationOtp({ email })`

Inside `withTransaction`:

1. Look up the user by email. If none or not `pending` → `AppError(400, 'No pending registration found', 'NO_PENDING_REGISTRATION')`
2. `locked = lockUserById(user.id)`. **Re-check after the lock:** if `locked` is null or `locked.status !== 'pending'` → `AppError(400, 'No pending registration found', 'NO_PENDING_REGISTRATION')`. The status read in step 1 can be stale, because another request may have changed the row while this one waited for the lock.
3. `countOtps(user.id, 'Registration')`. If `count - 1 >= config.otp.maxResends` → `AppError(429, 'Maximum OTP resends reached. Please try registering again in about 10 minutes.', 'OTP_RESEND_LIMIT')`. No `Retry-After` here. The 10 minutes is the OTP lifetime (`OTP_TTL_MINUTES`): the pending registration holds the username and email until its latest OTP expires, and registering again earlier returns `USERNAME_TAKEN` / `EMAIL_TAKEN`. If you change `OTP_TTL_MINUTES`, update this message.
4. `findLatestOtp`. If `created_at + cooldown > db_now` → `AppError(429, 'Please wait before requesting another OTP', 'OTP_RESEND_COOLDOWN')`, and set a `Retry-After` header (seconds remaining, about 60). To set the header, attach an optional `retryAfterSeconds` field to `AppError` and have the global error handler emit the header when present. The JSON body stays `{ message, code }`.
5. `issueOtp(...)` (this invalidates the previous OTP and sends the email)

> **Frontend behaviour for registration:** during the first 5 resends, disable the resend button and show a countdown from `Retry-After` ("try again in 60 seconds"). When `OTP_RESEND_LIMIT` is returned, disable resend and show the message ("try registering again in about 10 minutes"); there is no countdown.

#### Controllers in `src/controllers/auth.controller.ts`

- `verifyOtp` → `200` with `{ message: 'Registration complete. You can now log in.', code: 'REGISTER_SUCCESS' }`. No tokens are issued; the user logs in normally afterwards.
- `resendOtp` → `200` with `{ message: 'A new verification code has been sent to your email', code: 'OTP_SENT' }`
- Both wrapped in `asyncHandler`, no try/catch

#### Wire up routes in `auth.routes.ts`

```ts
router.post("/verify-otp", authController.verifyOtp);
router.post("/resend-otp", authController.resendOtp);
```

#### Verification

Happy path:

- Register → `POST /auth/verify-otp` with the correct OTP → `200 REGISTER_SUCCESS`, user `status = 'active'`, OTP row has `consumed_at` set
- Login with the now-active account → `200`

OTP rules:

- Re-submitting the same (already used) OTP → `400 INVALID_OTP`
- Wrong OTP → `400 INVALID_OTP`, `attempts_count` incremented **and persisted** (check the DB after the request)
- 5 wrong OTPs, then the correct OTP → `429 OTP_ATTEMPTS_EXCEEDED`; account stays `pending`
- Expired OTP (set `expires_at` to the past) with the correct code → `400 OTP_EXPIRED`
- Resend, then use the **old** OTP → `400 INVALID_OTP` (old one was invalidated); the **new** OTP works
- OTP `12345` (5 digits) or `abcdef` → `400 VALIDATION_ERROR`, message `"OTP must be a 6-digit code"`
- Unknown email → `400 INVALID_OTP`; already-active email → `400 INVALID_OTP`

Resend rules:

- Resend immediately after registering → `429 OTP_RESEND_COOLDOWN` with a `Retry-After` header
- Resend after 60 seconds (or after backdating `created_at` in the DB) → `200 OTP_SENT`, previous OTP row now has `consumed_at`
- After 5 successful resends (backdate `created_at` between each), the 6th resend → `429 OTP_RESEND_LIMIT`
- Resend for an unknown email or already-active account → `400 NO_PENDING_REGISTRATION`
- Resend when the SMTP send fails → `503 EMAIL_SEND_FAILED`, and the previous OTP is still valid (rolled back)

Validation:

- Missing `otp` → `400 VALIDATION_ERROR`, `"OTP is required"`
- `otp: 123456` (number) → `400 VALIDATION_ERROR`, `"OTP must be a string"`
- `purpose: "forgot password"` → `400 VALIDATION_ERROR`, `"Invalid purpose"`
- Extra field → `400 VALIDATION_ERROR`, `"Request contains unexpected fields"`

Concurrency:

- Fire two `POST /auth/verify-otp` with the correct OTP near-simultaneously → exactly one `200`, the other `400 INVALID_OTP`, user is active exactly once
- Fire two `POST /auth/resend-otp` near-simultaneously (cooldown backdated) → one `200` and one `429`, and only one active (unconsumed) OTP row exists afterwards

---

### Notes for Later Stages (do not implement now)

- `GET /users` (admin) must exclude `status = 'pending'` users
- Forgot Password, Change Email, Change Password and Admin Action reuse `issueOtp` / `checkOtp` and extend the `purpose` enum in the Zod schemas; authenticated purposes will need `authenticate` on their own routes
- Resend-limit counting for those purposes uses the rolling window (`config.otp.resendWindowMinutes`) via `requestOtp`. Only registration counts all rows, because a user only ever has one registration flow.
- NFR2 (email retry ×3 + delivery-failure logging) and NFR1 (lockout after repeated failed OTP attempts) are Week 10 items
- A periodic cleanup of expired pending users is optional; `deleteStalePendingUsers` already reclaims them lazily on re-registration
- Frontend: the register response changed (`201 OTP_SENT`, no active session) and two new endpoints exist; the OTP entry screen is a separate frontend task

> **Superseded by Stage 9:** the "GET /users must exclude pending users" note above no longer holds — Stage 9 shows all users regardless of status, including pending ones.

# Stage 6: Forgot Password Flow

> **Scope**: This stage adds the Forgot Password flow (F3.1), reusing the generic OTP
> infrastructure built in Stage 5 (`issueOtp`, `checkOtp`, `otp.queries.ts`,
> `email.service.ts`). It extends the `purpose` handling in the existing `verify-otp` and
> `resend-otp` endpoints rather than creating parallel ones, and adds one new endpoint:
> `POST /auth/reset-password`.
>
> Backlog refs: F3.1.1, F3.1.2, F3.1.3, F3.1.4.

### Design decisions (already made, do not change)

- **API-facing purpose string** — `forgot_password` maps to the DB enum value `'Forgot Password'`
- **Unknown email** — `forgot-password` and `resend-otp` (purpose `forgot_password`) return `404 EMAIL_NOT_FOUND` and send no OTP (F3.1.2). Hiding which emails are registered is deliberately not a goal for this flow, since registration already reveals it.
- **Throttling is reported, not hidden** — a throttled request gets a real `429`: `OTP_RESEND_COOLDOWN` for the first 5 resends (with a `Retry-After` header, about 60 seconds), and `OTP_RESEND_LIMIT` once the limit is reached, with the message "try again in about an hour" (no `Retry-After`; it matches the default `resendWindowMinutes` of 60)
- **OTP verification is two-step** — `verify-otp` checks the code without consuming it; `reset-password` does the real, consuming check
- **`checkOtp` change** — add an optional `consume` param, defaulting to `true`, so existing callers (registration) are unaffected
- **On successful reset** — set the new password hash, then revoke all of that user's refresh tokens (logs them out everywhere)
- **Account status** — reset works for active and suspended accounts; it doesn't change status. A **pending** (unverified) account gets `403 ACCOUNT_NOT_VERIFIED` from forgot-password, resend, verify and reset: it cannot log in anyway, so a reset would do nothing useful, and a forgot-password OTP on a pending row would keep its username and email reserved for longer (the stale-user cleanup treats any live OTP as a reason to keep the row).
- **New password validation** — reuses the same complexity rule and error message as registration
- **Resend/cooldown/attempt limits** — reuse the OTP infrastructure and config from Stage 5, except that the resend count uses the rolling window (`config.otp.resendWindowMinutes`) instead of counting all rows

---

## Changes to already-implemented code (do these first)

Stage 6 needs the following changes to code that earlier stages already built. Each is specified in detail in the stage named.

> Status (2026-09-26): all nine changes below are implemented. Row 5's controller half was completed in 6c (verify-otp) and 6e (resend-otp).

| #   | File                                                                                                | Change                                                                                                                                                                                                                                                                       | Where specified |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | `.env.example`, `.env`, `src/config.ts`                                                             | Add `OTP_RESEND_WINDOW_MINUTES=60` to the env files, the Zod schema, and `config.otp.resendWindowMinutes`                                                                                                                                                                    | Stage 5a        |
| 2   | `src/db/queries/otp.queries.ts`                                                                     | `countOtps(userId, purpose, db, sinceMinutes?)`: without `sinceMinutes` it counts all rows (registration, unchanged); with it, only rows created within that many minutes (compared against `clock_timestamp()`)                                                             | Stage 5c        |
| 3   | `src/services/otp.service.ts`                                                                       | `checkOtp` gets an optional `consume` parameter, default `true`; when `false`, skip `consumeOtp` but still increment attempts on a wrong guess                                                                                                                               | Stage 6a        |
| 4   | `src/services/email.service.ts`                                                                     | Add a `Forgot Password` entry to the purpose map (subject "Your FoC password reset code")                                                                                                                                                                                    | Stage 6a        |
| 5   | `src/controllers/auth.controller.ts`                                                                | Extend the purpose map (`PURPOSE_MAP`) and the Zod `purpose` enum for `verify-otp` and `resend-otp` with `forgot_password` → `'Forgot Password'`, and add the dispatch case in `verifyOtp` and `resendOtp`                                                                   | Stage 6c, 6e    |
| 6   | `src/services/auth.service.ts` (`login`)                                                            | Create the refresh token inside `withTransaction` after locking the user, and re-check the password hash and status on the locked row (see the race-safety bullet in Stage 4c)                                                                                               | Stage 4c        |
| 7   | `src/services/auth.service.ts` (`resendRegistrationOtp`)                                            | Change the limit message text to `'Maximum OTP resends reached. Please try registering again in about 10 minutes.'`. Nothing else about registration changes.                                                                                                                | Stage 5e        |
| 8   | `src/services/auth.service.ts` (`refresh`), `src/db/queries/tokens.queries.ts` (`lockRefreshToken`) | `refresh` runs in `withTransaction`: plain early-exit read, then lock the user row, then lock the token row (`lockRefreshToken`), re-check revoked/expired/suspended on the locked rows, and issue the token from the locked user. `lockRefreshToken` also returns `db_now`. | Stage 4d        |
| 9   | `src/routes/auth.routes.ts`                                                                         | Remove `authenticate` from `POST /auth/logout`: `router.post('/logout', authController.logout)`. The handler already reads the refresh cookie, so nothing else changes. `authenticate` then has no consumers until `GET /users/me` (Stage 7).                                | Stage 4d        |

New code (not changes to existing code): `requestOtp` in `otp.service.ts`, `revokeAllRefreshTokensForUser` in `tokens.queries.ts`, `updatePasswordHash` in `users.queries.ts`, and the new service functions and controllers in 6b–6e.

---

## Stage 6a: `checkOtp` Consume Flag + Email Template

### Update `src/services/otp.service.ts`

Change `checkOtp`'s signature to accept an optional `consume` parameter, default `true`:

```ts
checkOtp({ userId, purpose, otp }, db, consume: boolean = true)
```

- Steps 1–4 (find latest OTP, check expiry, check attempts, compare hash) are unchanged.
- Step 5 (wrong guess): unchanged — always `incrementAttempts`, return `{ ok: false }`, regardless of `consume`.
- Step 6 (correct guess):
  - If `consume` is `true` (the default): unchanged — call `consumeOtp`. If it returns `false`, treat as `INVALID_OTP`. Return `{ ok: true }`.
  - If `consume` is `false`: **do not** call `consumeOtp`. Just return `{ ok: true }`.

All existing callers (registration's `verifyRegistrationOtp`) keep working unchanged since they don't pass the third argument.

### Add `requestOtp` to `src/services/otp.service.ts`

`issueOtp` sends an email unconditionally, so calling it directly from an endpoint lets a caller spam an address and repeatedly invalidate a user's live OTP. **Any endpoint that sends an OTP must go through `requestOtp`, never `issueOtp` directly** (forgot-password, resend, and later change email, change password and admin action).

`requestOtp({ userId, email, purpose, newEmail? }, db)` — must be called inside `withTransaction`:

1. `locked = lockUserById(userId, db)`. If `locked` is null (deleted while waiting) → return `{ status: 'no-user' }`. If `locked.status === 'pending'` → return `{ status: 'not-verified' }` (a pending account never gets OTPs through `requestOtp`; registration has its own resend).
2. Resend limit: `countOtps(userId, purpose, db, config.otp.resendWindowMinutes)` (rolling window). If `count - 1 >= config.otp.maxResends` → return `{ status: 'throttled', reason: 'limit' }`.
3. Cooldown: `findLatestOtp(userId, purpose, db)`. If `created_at + config.otp.resendCooldownSeconds > db_now` → return `{ status: 'throttled', reason: 'cooldown', retryAfterSeconds }`, where `retryAfterSeconds` is the time until the next resend is allowed.
4. Otherwise `issueOtp(...)` and return `{ status: 'sent' }`. `EMAIL_SEND_FAILED` from `issueOtp` propagates unchanged.

When throttled, **nothing is sent and the existing OTP is not invalidated**. `requestOtp` only reports what happened; each caller decides how to react. Forgot-password and its resend turn `throttled` into a real `429` (`OTP_RESEND_COOLDOWN` with `Retry-After`, or `OTP_RESEND_LIMIT`).

### Update `src/services/email.service.ts`

Add an entry to the `purpose → { subject, intro }` map for `Forgot Password`:

- Subject: `"Your FoC password reset code"`
- Body: same shape as the registration email (OTP + expiry from `config.otp.ttlMinutes`), no links, dev-log fallback unchanged

### Verification

- No behavior change for the existing registration flow: re-run Stage 5e's happy-path and wrong-OTP tests, confirm they still pass unmodified
- The `consume: false` behaviour is verified through the endpoints in Stage 6c (the OTP row's `consumed_at` stays `NULL` after `verify-otp`, and wrong guesses still increment `attempts_count`). Vitest unit tests for Stage 6 are deferred.
- `requestOtp` when throttled (inside the cooldown, or at the resend limit) → returns `throttled`, no email is sent, and the previous OTP row's `consumed_at` is still `NULL`

---

## Stage 6b: `POST /auth/forgot-password`

### Update `src/services/auth.service.ts`

Implement `forgotPassword({ email })`, inside `withTransaction`:

- `findByEmail(email)`. If no user found → `AppError(404, 'Email not found', 'EMAIL_NOT_FOUND')` (no OTP sent). If the user is `pending` → `AppError(403, 'Account not verified. Please finish registration first.', 'ACCOUNT_NOT_VERIFIED')` (cheap early exit; `requestOtp` re-checks after the lock)
- If found → `requestOtp({ userId: user.id, email, purpose: 'Forgot Password' }, client)` (see Stage 6a) and map its result:
  - `sent` → return normally
  - `throttled` with `reason: 'cooldown'` → `AppError(429, 'Please wait before requesting another OTP', 'OTP_RESEND_COOLDOWN', retryAfterSeconds)` (about 60 seconds)
  - `throttled` with `reason: 'limit'` → `AppError(429, 'Maximum OTP resends reached. Please try again in about an hour.', 'OTP_RESEND_LIMIT')`
  - `no-user` → `AppError(404, 'Email not found', 'EMAIL_NOT_FOUND')`
  - `not-verified` → `AppError(403, 'Account not verified. Please finish registration first.', 'ACCOUNT_NOT_VERIFIED')`
- `EMAIL_SEND_FAILED` from `requestOtp` propagates as `503`

### Update `src/controllers/auth.controller.ts`

Implement `forgotPassword` handler:

Validate request body with Zod (`.strict()`, custom messages, presence/type/extra-fields only):

- `email`: required `"Email is required"`, type `"Email must be a string"` (use the shared `emailField`: trimmed and lowercased)

- Call `authService.forgotPassword()`
- Return `200` with `{ message: 'A reset code has been sent to your email', code: 'OTP_SENT' }`

### Wire up route

Add to `auth.routes.ts`:

```ts
router.post("/forgot-password", authController.forgotPassword);
```

### Verification

- `POST /auth/forgot-password` with a registered email → `200 OTP_SENT`, one `users_otps` row created with `purpose = 'Forgot Password'`, dev console shows the OTP
- `POST /auth/forgot-password` twice in a row for a registered email → the second returns `429 OTP_RESEND_COOLDOWN` with a `Retry-After` header; only one `users_otps` row exists and the first OTP is still valid
- Two concurrent `POST /auth/forgot-password` for the same email → exactly one `200`, the other `429`, and exactly one OTP row created
- `POST /auth/forgot-password` after the resend limit is reached (backdate `created_at` between requests) → `429 OTP_RESEND_LIMIT` with the message "try again in about an hour"; no new row, no email
- `POST /auth/forgot-password` with an unregistered email → `404 EMAIL_NOT_FOUND`, no `users_otps` row created
- `POST /auth/forgot-password` with the email of a still-pending (unverified) registration → `403 ACCOUNT_NOT_VERIFIED`, no `Forgot Password` OTP row created
- `POST /auth/forgot-password` with a missing/wrong-type `email` field → `400 VALIDATION_ERROR` as usual
- `POST /auth/forgot-password` with an extra field → `400 VALIDATION_ERROR`, `"Request contains unexpected fields"`
- Force an email-send failure for a registered email → `503 EMAIL_SEND_FAILED`

---

## Stage 6c: `verify-otp` — Forgot Password Purpose

This extends the existing `verify-otp` endpoint from Stage 5e rather than adding a new route.

### Update Zod schema in `src/controllers/auth.controller.ts`

Extend the `purpose` enum for `POST /auth/verify-otp` to accept `'registration'` (existing) and `'forgot_password'` (new). Same error message pattern: not in the allowed list → `"Invalid purpose"`.

### Update `src/services/auth.service.ts`

Implement `verifyForgotPasswordOtp({ email, otp })`:

Inside `withTransaction`:

1. `findByEmail(email)`. If none → `AppError(404, 'Email not found', 'EMAIL_NOT_FOUND')`. If the user is `pending` → `AppError(403, 'Account not verified. Please finish registration first.', 'ACCOUNT_NOT_VERIFIED')`.
2. `locked = lockUserById(user.id)`. If `locked` is null (the row was deleted while waiting) → `EMAIL_NOT_FOUND`. If `locked.status === 'pending'` → `ACCOUNT_NOT_VERIFIED`. Suspended accounts are allowed.
3. `checkOtp({ userId: user.id, purpose: 'Forgot Password', otp }, client, /* consume */ false)`
4. Commit, then: if `{ ok: false }` → throw `AppError(400, 'Invalid or expired OTP', 'INVALID_OTP')`
5. On success, return nothing sensitive — **no state change happens here**, this call only validates

> Note the same warning from Stage 5c applies: the wrong-guess path must not throw inside the transaction, or the attempt increment gets rolled back and the limit becomes bypassable.

### Update the `verifyOtp` controller

Dispatch on `purpose`:

- `'registration'` → existing `authService.verifyRegistrationOtp()` call, unchanged, returns `{ message: 'Registration complete. You can now log in.', code: 'REGISTER_SUCCESS' }`
- `'forgot_password'` → new `authService.verifyForgotPasswordOtp()` call, returns `200` with `{ message: 'Code verified. You can now set a new password.', code: 'OTP_VERIFIED' }`

### Verification

- `POST /auth/verify-otp` with the correct forgot-password OTP → `200 OTP_VERIFIED`, and the OTP row's `consumed_at` is still `NULL` afterward (confirm in DB)
- Re-submitting the same correct OTP again → still `200 OTP_VERIFIED` (not yet consumed, so it's still valid) — confirm this is the intended behavior, not a bug
- Wrong OTP → `400 INVALID_OTP`, `attempts_count` incremented and persisted
- 5 wrong OTPs → `429 OTP_ATTEMPTS_EXCEEDED`
- Expired OTP with the correct code → `400 OTP_EXPIRED`
- Unknown email → `404 EMAIL_NOT_FOUND`
- Email of a still-pending (unverified) registration → `403 ACCOUNT_NOT_VERIFIED`
- `purpose: "forgot password"` (with a space, wrong format) → `400 VALIDATION_ERROR`, `"Invalid purpose"`

---

## Stage 6d: `POST /auth/reset-password`

### Create query in `src/db/queries/tokens.queries.ts`

- `revokeAllRefreshTokensForUser(userId, db)` — `UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW() WHERE user_id = $1 AND is_revoked = false`

### Update `src/services/auth.service.ts`

Implement `resetPassword({ email, otp, newPassword })`:

- Validate `newPassword` complexity using the same rule and message as registration → `AppError(400, '...', 'VALIDATION_ERROR')` if it fails
- Validate `otp` matches `^\d{6}$` → `AppError(400, 'OTP must be a 6-digit code', 'VALIDATION_ERROR')` if not

Inside `withTransaction`:

1. `findByEmail(email)`. If none → `AppError(404, 'Email not found', 'EMAIL_NOT_FOUND')`. If the user is `pending` → `AppError(403, 'Account not verified. Please finish registration first.', 'ACCOUNT_NOT_VERIFIED')`.
2. `locked = lockUserById(user.id)`. If `locked` is null (the row was deleted while waiting) → `EMAIL_NOT_FOUND`. If `locked.status === 'pending'` → `ACCOUNT_NOT_VERIFIED`. Suspended accounts are allowed.
3. `checkOtp({ userId: user.id, purpose: 'Forgot Password', otp }, client)` — **default consuming check**, this is the real gate
4. If `{ ok: true }`:
   - Hash `newPassword` with bcrypt (work factor 10)
   - Update `users.password_hash` for this user
   - `revokeAllRefreshTokensForUser(user.id, client)`
5. Commit, then: if `{ ok: false }` → throw `AppError(400, 'Invalid or expired OTP', 'INVALID_OTP')`

You'll need a new query function for the password update — add `updatePasswordHash(userId, passwordHash, db)` to `users.queries.ts` if it doesn't already exist.

### Update `src/controllers/auth.controller.ts`

Implement `resetPassword` handler:

Validate request body with Zod (`.strict()`, custom messages, presence/type/extra-fields only — format/complexity rules stay in the service layer):

- `email`: required `"Email is required"`, type `"Email must be a string"` (use the shared `emailField`: trimmed and lowercased)
- `otp`: required `"OTP is required"`, type `"OTP must be a string"`
- `newPassword`: required `"New password is required"`, type `"New password must be a string"`

- Call `authService.resetPassword()`
- Return `200` with `{ message: 'Password reset successful. Please log in with your new password.', code: 'PASSWORD_RESET_SUCCESS' }`

### Wire up route

Add to `auth.routes.ts`:

```ts
router.post("/reset-password", authController.resetPassword);
```

### Verification

Happy path:

- `forgot-password` → `verify-otp {purpose: forgot_password}` (optional, doesn't consume) → `reset-password` with the correct OTP → `200 PASSWORD_RESET_SUCCESS`, password hash changed in DB, all that user's `refresh_tokens` rows now have `is_revoked = true`
- Login with the new password → `200`
- Login with the old password → `401 INVALID_CREDENTIALS`
- A previously-issued access token for this user is still valid until it naturally expires (only refresh tokens are revoked) — confirm this is the intended behavior

OTP rules (same shape as Stage 5e, now on `reset-password` instead of `verify-otp`):

- Wrong OTP → `400 INVALID_OTP`, attempt incremented and persisted
- 5 wrong OTPs, then the correct one → `429 OTP_ATTEMPTS_EXCEEDED`, password unchanged
- Expired OTP with the correct code → `400 OTP_EXPIRED`
- Re-using an already-consumed OTP (call `reset-password` twice with the same code) → second call → `400 INVALID_OTP`
- Calling `reset-password` directly, skipping `verify-otp` entirely, with a correct OTP → `200 PASSWORD_RESET_SUCCESS` (confirms `verify-otp` is optional UX, not a required gate)
- Unknown email → `404 EMAIL_NOT_FOUND`
- Email of a still-pending (unverified) registration → `403 ACCOUNT_NOT_VERIFIED`

Validation:

- Weak `newPassword` → `400 VALIDATION_ERROR` with the standard password-complexity message
- `otp` not 6 digits → `400 VALIDATION_ERROR`, `"OTP must be a 6-digit code"`
- Missing `newPassword` → `400 VALIDATION_ERROR`, `"New password is required"`
- Extra field → `400 VALIDATION_ERROR`, `"Request contains unexpected fields"`

Concurrency:

- Fire two `POST /auth/reset-password` with the correct OTP near-simultaneously → exactly one `200`, the other `400 INVALID_OTP`, password changed exactly once
- Run several `POST /auth/login` requests with the **old** password in a loop while calling `reset-password` → after the reset, no non-revoked refresh token exists for that user that was created by an old-password login

---

## Stage 6e: `resend-otp` — Forgot Password Purpose

This extends the existing `resend-otp` endpoint from Stage 5e.

### Update Zod schema in `src/controllers/auth.controller.ts`

Extend the `purpose` enum for `POST /auth/resend-otp` to accept `'forgot_password'` alongside `'registration'`.

### Update `src/services/auth.service.ts`

Implement `resendForgotPasswordOtp({ email })`. It is the same operation as `forgotPassword` (both request a fresh OTP through `requestOtp`), so implement it once and call it from both:

- `findByEmail(email)`, then `requestOtp(...)` inside `withTransaction`, with the same result mapping as Stage 6b: unknown email or `no-user` → `404 EMAIL_NOT_FOUND`; pending account or `not-verified` → `403 ACCOUNT_NOT_VERIFIED`; `throttled` → `429 OTP_RESEND_COOLDOWN` (with `Retry-After`) or `429 OTP_RESEND_LIMIT`; `sent` → return normally.

### Update the `resendOtp` controller

Dispatch on `purpose`, same pattern as `verifyOtp`:

- `'registration'` → existing `authService.resendRegistrationOtp()`, unchanged
- `'forgot_password'` → new `authService.resendForgotPasswordOtp()`

Both return `200` with `{ message: 'A new verification code has been sent to your email', code: 'OTP_SENT' }` on success. For `forgot_password`, an unknown email returns `404 EMAIL_NOT_FOUND`, and a throttled request returns a real `429`.

### Verification

- Resend for a registered email, immediately after `forgot-password` → `429 OTP_RESEND_COOLDOWN` with a `Retry-After` header (seconds until the next resend is allowed)
- Resend for a registered email, after the cooldown → `200 OTP_SENT`, previous OTP row now has `consumed_at` set
- After 5 successful resends inside the window, the 6th → `429 OTP_RESEND_LIMIT` (message: try again in about an hour)
- Once the oldest OTP is older than `resendWindowMinutes`, resend works again (the limit is not permanent)
- Resend for an unregistered email → `404 EMAIL_NOT_FOUND`, no DB row created
- Resend for a still-pending (unverified) registration → `403 ACCOUNT_NOT_VERIFIED`, no `Forgot Password` OTP row created

- Extra/wrong-type fields → same `400 VALIDATION_ERROR` pattern as before

---

### Notes for Later Stages (do not implement now)

- Every endpoint that sends an OTP (change email, change password, admin action, and any future one) must call `requestOtp`, never `issueOtp` directly. Without it, a logged-in user could use `PUT /users/me/email` to email any address without limit.
- Frontend for forgot-password: for the first 5 resends, disable the resend button with a countdown from `Retry-After` ("try again in 60 seconds"). On `OTP_RESEND_LIMIT`, disable resend and show "try again in about an hour" (no countdown).
- Change Email and Change Password reuse the same `issueOtp`/`checkOtp` pair, but don't need the `consume` flag — their `PUT /users/me/...` endpoints already know the new value (new email / new password) before the OTP is even sent, so it's natural for them to store it on the pending user/OTP state and let `verify-otp` finalize directly in one step, the same way registration does. Confirm this design when we get there rather than assuming it carries over unchanged.
- Admin Action's OTP purpose will need its own finalize shape (likely: the pending action's target and effect stored somewhere before the OTP is sent) — not yet designed.
- Lock ordering: any transaction that locks both a user row and refresh-token rows locks the user row first (see the lock ordering rule in Stage 4d). Suspend and change-password must follow it too.
- Suspending a user (admin) and changing a password (F4.3.4) must revoke all of the user's refresh tokens in the same locked transaction as the change; the login check added in Stage 4c (re-verify hash and status after locking) is what stops a concurrent login from issuing a token afterwards.
- NFR1 (account lockout after repeated failed attempts) is a Week 10 item and separate from the per-OTP `max_attempts` limit already built.

## Stage 7: Comprehensive Test Suite (For Stage 1-6)

> **How to use this stage**: This supersedes the earlier instruction "Do not add
> new test cases unless I ask" — this stage is that ask. It covers everything
> built in Stages 1–6 (scaffold through Forgot Password). Do not write
> implementation code changes as part of this stage — see the rules below.

### Ground rules

1. **Read the current codebase first**, not just this file. Where the code and
   this file disagree, follow the code and tell me about the difference (same
   rule as every other stage).
2. **Do not make any design decisions, choose behavior for unclear cases, or
   pick an interpretation when this file is ambiguous.** If you're about to
   write a test and the correct expected behavior isn't clearly specified
   anywhere (in this file, the product backlog, or the working docs), stop and
   ask me instead of guessing. A wrong guess here becomes a de facto spec that
   later work gets held to — that's worse than an unanswered question.
3. **Do not modify application code to make a test pass.** If a test reveals a
   real deviation from something this file specifies, report it as a separate
   finding — do not fix it, and do not write the test to assert the buggy
   behavior as correct.
4. **Do not test for the absence of deferred features.** NFR1 (lockout), NFR2
   (email retry/delivery logging), and rate limiting generally are Week 10
   items per this file's own notes. Don't write tests asserting they don't
   exist yet — that breaks the day they land — and don't write tests for their
   behavior since they aren't built.
5. Before writing any tests, produce a list of every point you found unclear
   or unspecified, as a separate deliverable — not buried in code comments.
   Wait for my answers on anything you're genuinely unsure about rather than
   picking a reasonable-sounding default.

### Test stack

- **Vitest** for the runner and assertions (already the project's choice).
- **Supertest** for HTTP-level tests against the Express app — add it and its
  types to `package.json` devDependencies.
- **A real Postgres instance for integration tests — do not mock `pg`.** Most
  of what this file cares about (`SELECT ... FOR UPDATE`, `FOR UPDATE SKIP
LOCKED`, transaction rollback on wrong OTP guesses, lock ordering to avoid
  deadlocks, `clock_timestamp()` vs `NOW()`) is database behavior that a
  mocked pool cannot validate. Set up a dedicated test database (or schema),
  apply `init.sql` fresh, and truncate the relevant tables in
  `beforeEach`/`afterEach`.
- Reserve mocked-`pg` unit tests for pure logic with no locking or
  transactions involved — `hash.ts`, `otp.ts`'s digit-format check, `jwt.ts`
  claim shape, and Zod schema validation in isolation.
- For tests that need to manipulate DB state directly (expire an OTP, backdate
  `created_at`, suspend a user, promote a role), write small SQL test helpers
  rather than going through the API — several of this file's own verification
  steps already describe doing this manually.
- Structure test files to mirror the source tree, not the build stages.
  Co-locate each test file next to the source it covers, with `describe`
  blocks per function/route and further nesting for edge cases where a
  function has several (happy path, expiry handling, attempt limiting, etc.):
  - `controllers/auth.controller.test.ts` — one `describe` per route handler
    (register, login, logout, refresh, forgotPassword, resetPassword)
  - `services/auth.service.test.ts` — one `describe` per exported function
  - `services/otp.service.test.ts` — verify, resend, generate (whichever
    exist as separate functions)
  - `services/email.service.test.ts`
  - `services/bootstrap.service.test.ts`
  - `middleware/authenticate.test.ts` — inter-service token verification
  - `db/queries/users.queries.test.ts`, `otp.queries.test.ts`,
    `tokens.queries.test.ts` — integration tests against the real test DB
  - `utils/hash.test.ts`, `jwt.test.ts`, `otp.test.ts` — pure-logic unit
    tests, mocked `pg` where relevant (per the mocking rule above)
    Keep a separate top-level `concurrency/` folder for the cross-cutting
    race-condition tests (these show up across login, register, verify-otp,
    resend-otp, logout, refresh, and reset-password, and are easiest to review
    together) — do not duplicate a concurrency case inside its
    controller/service test file just because it's _about_ that function.

### Infrastructure

- **App/server split**: split `app.ts` into a pure `app` export (Express app
  only, no `bootstrapSuperAdmin()` call, no `.listen()`) and a new
  `server.ts` that imports `app`, runs the bootstrap, then listens. Nothing that
  currently imports `app.ts` for its side effects should break; check for any such
  imports and update them to use `server.ts` instead.
- **Test database**: a second database on the existing `user-db` Postgres
  instance (e.g. `user_service_test`), not a new container. Add a one-time
  setup script that runs the existing `init.sql` against it, so the test
  schema can never drift from the real schema. Reuse `user-db`'s existing
  credentials; only `DB_NAME` differs.
- **Env vars**: a committed `.env.test` (no real secrets — dummy SMTP, dummy
  super-admin password, test DB name), loaded via a Vitest setup file
  (`dotenv.config({ path: '.env.test' })`), wired in through
  `vitest.config.ts`'s `setupFiles`.
- **JWT keys**: generate a throwaway RS256 key pair at test-setup time
  (`crypto.generateKeyPairSync`) rather than relying on the gitignored
  `keys/` folder, which won't exist on a fresh clone or in CI. Write to a
  temp path and point the key-path env vars at it.
- **Parallelism**: set `fileParallelism: false` in `vitest.config.ts`. Tests
  share one DB and truncate between runs, so sequential execution is the
  safe default.
- **Location**: tests live in `user-service/tests/`, sibling to `src/`, with
  `tests/concurrency/` for the cross-cutting race-condition suite. Since
  `tsconfig.json` only includes `src/**/*`, this keeps test files out of
  `tsc` and the prod Docker build with no tsconfig changes needed.
- Add `vitest.config.ts` at `user-service/` root, `supertest` and its
  `@types` to `package.json` devDependencies, and a `"test"` script already
  exists (`vitest`) — confirm it picks up the new config and test location.

### Mocking policy

- **Email**: mock `sendOtpEmail` (or the nodemailer transport) with `vi.mock`
  for both OTP capture and forced-failure (503/rollback) tests. This is
  exempt from the "no mocking `pg`" rule — that rule is specifically about
  locking/transaction correctness, which only real Postgres can validate.
  Prefer mocking the function directly over spying on the dev-fallback
  `console.log` — the console log is a logging implementation detail, not a
  stable test seam.
- **Config (bootstrap tests only)**: `vi.mock` the config module is
  permitted for the single test file covering "configured super-admin
  username/email already belongs to a regular user," since it needs
  different config values than the rest of the suite. Keep this mock scoped
  to that file.

### Manual-only verification bullets

- `npm install`, `docker compose up --build`, `\dT+ status_enum` inspection,
  and "keys exist" checks are infra/tooling, not application behavior — leave
  these manual. List them in the traceability table as "manual — not
  automated" rather than omitting them.
- The two config-validation exit cases (missing required env var; empty SMTP
  vars with `NODE_ENV=production`) are real application logic in `config.ts`
  and should be automated by spawning it as a child process with a modified
  env and asserting on exit code and stderr content.

### Temporary protected route

For Stage 4e's cross-check between `authenticate` middleware and
`GET /auth/verify` against the same token, mount a throwaway Express route
inside the test file itself. Do not add anything to `app.ts`/`server.ts` for
this.

### Concurrency test parameters

Define shared constants once (e.g. `CONCURRENT_REQUESTS`, in a test-helpers
file) and reuse them across the `concurrency/` suite rather than varying
per-test. Start with a small number sufficient to reliably trigger the race
(e.g. 5 concurrent requests) and a modest loop count for sustained-race tests
(e.g. 20 iterations); adjust only if a specific test proves flaky.

### Traceability table

- Items that are partially built (e.g. F5.1.1, F5.1.4–F5.1.6, F2.2.1,
  F2.3.1, NFR4) are listed as **partial**, with a one-line note of what's
  covered by tests so far and what isn't — not excluded from the table.
- Items not yet built at all (F4, F5.3) are listed as **not yet
  implemented** — not omitted.
- The table lives in `user-service/tests/TRACEABILITY.md`, not in chat, since
  it needs to be revisited as later stages land.

### Coverage

Treat every bullet under every stage's **Verification** section (Stages 1
through 6, including the "Changes to already-implemented code" table in
Stage 6) as a required test case, not a suggestion — that list already
enumerates the edge cases and alternative workflows this file cares about most:
duplicate username/email races, OTP wrong-guess persistence across rollback,
resend cooldown/limit boundaries (including the rolling-window vs all-time
distinction between registration and forgot-password), lock-ordering deadlock
checks between `refresh` and `reset-password`, stale-pending-user cleanup with
`SKIP LOCKED`, suspended/pending account interactions with login/refresh,
role-claim freshness after promotion, and the "confirm this is intended, not a
bug" notes (e.g. non-consuming `verify-otp` for forgot-password being
re-submittable, an old access token surviving a password reset).

### Stage 7 changes to reverse or review before deployment

Changes made for the test suite that affect how the service is run. The first two must be undone before any real deployment.

- **`compose.yaml`, `user-db` `ports: - "5434:5432"` (REVERSE):** publishes the database on the host so Vitest can reach it. Remove the `ports:` block (and its TEMPORARY comment) before deploying, so the database is only reachable inside the compose network.
- **`user_service_test` database on the `user-db` instance (REVIEW):** `tests/setup/globalSetup.ts` drops and recreates it on every test run. It refuses to touch any database whose name does not end in `_test`. Do not run the suite against a deployed database, and drop `user_service_test` if it exists there.
- **`.env.test` (no action):** committed, dummy values only. It must never hold real credentials.
- **`app.ts` / `server.ts` split (KEEP):** `app.ts` now only builds and exports the Express app. `src/server.ts` runs the super admin bootstrap and calls `listen()`. The `start` and `dev` scripts in `package.json` and the prod `CMD` in `Dockerfile` (`node dist/server.js`) were updated to match. This is not meant to be reversed.

### Deliverables

1. The test files

# Stage 8: RBAC Middleware

> **Scope**: This stage builds the authorization layer only — the `authorize` middleware
> itself. It has no consumers yet; Stages 9 and 10 are where it actually gets wired onto
> routes. No DB changes in this stage.
>
> Backlog refs: supports F5.1.1, F5.1.4, F5.1.5, F5.1.6 (enforcement mechanism only —
> the actual endpoints these protect are Stages 9–10).

### Design decisions (already made, do not change)

| Rule                     | Value                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role check style         | Minimum-role (`authorize('admin')` = "admin or higher"), not an explicit per-route list                                                                                                                                                                                                                 |
| Role ordering            | `user` (0) < `admin` (1) < `super admin` (2)                                                                                                                                                                                                                                                            |
| Stale role claims        | A role change (promotion or demotion) does **not** invalidate an already-issued access token. The token rides out its remaining life (up to 15 min) on the old role — identical to how a suspension is handled today. Enforcement catches up at the next `refresh` call, not immediately.               |
| Refresh-token revocation | A role change revokes **all** of the target user's refresh tokens in the same transaction as the change (same treatment `resetPassword` and suspend already give). This doesn't shrink the 15-minute window above — it only stops the old role from being extended indefinitely via repeated refreshes. |

### Create `src/middleware/authorize.ts`

- Export a rank table:

```ts
const ROLE_RANK: Record<string, number> = {
  user: 0,
  admin: 1,
  "super admin": 2,
};
```

- Export `authorize(minimumRole: string)` — a middleware **factory**. Calling
  `authorize('admin')` returns an Express middleware function; it does not itself take
  `(req, res, next)`.
- The returned middleware:
  1. Reads `req.user` (set by `authenticate`, which must run first in the chain).
  2. If `req.user` is missing (defensive — `authorize` used on a route without
     `authenticate` ahead of it), reject with `401` and
     `{ message: 'Unauthorized', code: 'UNAUTHORIZED' }`, matching `authenticate`'s own
     shape. Do not treat this as a `403` — the caller was never authenticated at all.
  3. Otherwise compare `ROLE_RANK[req.user.role] >= ROLE_RANK[minimumRole]`.
  4. If the check passes, call `next()`.
  5. If it fails, reject with `403` and
     `{ message: 'Forbidden', code: 'FORBIDDEN' }`.
- Usage pattern (for reference — not implemented until Stage 9/10):

```ts
router.get("/users", authenticate, authorize("admin"), usersController.list);
router.put(
  "/users/:id/role",
  authenticate,
  authorize("super admin"),
  usersController.changeRole,
);
```

### Verification

- Unit test (Vitest, no DB, no Express app needed): for each of the 6 (caller role ×
  required role) combinations that matter — `user`→`user`, `user`→`admin`,
  `admin`→`user`, `admin`→`admin`, `admin`→`super admin`, `super admin`→`admin` — confirm
  `next()` is called or not, as expected, by passing a fake `req`/`res`/`next`.
- `authorize('admin')` with no `req.user` set at all → `401 UNAUTHORIZED`, `next()` never
  called.
- Confirm `authorize` throws no errors of its own — it only ever calls `next()` or
  responds directly; it should not need `asyncHandler` (no async work, no DB call).

### Tests (Vitest)

Write the Vitest tests for this stage, following the Stage 7 ground rules and layout
(`tests/middleware/authorize.test.ts`). Every bullet under Verification above is a required test
case. Do not modify application code to make a test pass.

---

# Stage 9: Admin Endpoints — View Users, Suspend/Unsuspend

> **Scope**: `GET /users`, `GET /users/:id`, `PUT /users/:id/status`. All three require
> `authenticate` + `authorize('admin')`.
>
> Backlog refs: F5.3.1, F5.3.3.

### Design decisions (already made, do not change)

| Rule                               | Value                                                                                                                                                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /users` response shape        | `{ users: [...] }` (wrapped, not a bare array)                                                                                                                                                                                                                             |
| Fields returned per user           | Every column except `password_hash` — `id, username, email, status, role, created_at, updated_at`                                                                                                                                                                          |
| Pending users                      | `GET /users` and `GET /users/:id` both return users **regardless of status, including `pending`**. The `status` field in the response is how a caller tells a pending (unverified) registration apart from a real account — no separate flag needed.                       |
| `GET /users/:id` — not found       | `404` with `{ message: 'User not found', code: 'USER_NOT_FOUND' }`                                                                                                                                                                                                         |
| `GET /users/:id` — malformed `:id` | `400` with message `"Invalid user ID"`, code `VALIDATION_ERROR` — enforced via a Zod `.uuid()` check on `req.params.id` at the controller (same convention as every other validation in this codebase), before any DB call                                                 |
| `PUT /users/:id/status` body       | `{ status: 'active' \| 'suspended' }`                                                                                                                                                                                                                                      |
| Suspend side-effect                | Revokes **all** of the target user's refresh tokens in the same transaction (already required by the general rule from Stage 4: "anything that... suspends a user... must revoke ALL that user's refresh tokens in the SAME transaction as the change")                    |
| Unsuspend side-effect              | None beyond the status flip — no tokens to revoke, there's nothing live to reactivate                                                                                                                                                                                      |
| Locking                            | `withTransaction` + `lockUserById` + re-check-after-lock, same pattern as every other state-changing operation in this service                                                                                                                                             |
| Target role restriction            | An `admin` caller may only suspend/unsuspend a target with `role = 'user'`. A `super admin` caller may suspend/unsuspend a `user` or `admin` target, but not another `super admin`.                                                                                        |
| Error codes for role restrictions  | Any caller targeting a `super admin` (including a super admin targeting one) → `403 SUPER_ADMIN_IMMUTABLE`. An `admin` caller targeting an `admin` → `403 FORBIDDEN`.                                                                                                      |
| Pending target                     | The status of a `pending` user cannot be changed through this endpoint, to either `suspended` or `active`. A pending account only becomes active through OTP verification. Responds `422 CANNOT_SUSPEND_PENDING_USER`, message `'Cannot suspend pending user'`, for either target status.                                      |
| No-op requests                     | If the target is already in the requested status, this is a success, not an error: return `200` with the unchanged user, and skip both the DB write and the token revocation                                                                                               |
| Service file location              | `listUsers`, `getUserById`, `changeUserStatus` (and Stage 10's `changeUserRole`) live in a new `src/services/users.service.ts`, not `auth.service.ts` — matching how `otp.service.ts` and `email.service.ts` were already split out from `auth.service.ts`                 |
| Naming (query vs. service)         | The query function stays `updateUserStatus` (matches the SQL operation). The service function that calls it is `changeUserStatus`, to avoid two different-layer functions sharing one name (same split for Stage 10's `updateUserRole` query vs. `changeUserRole` service) |

### Add to `src/db/queries/users.queries.ts`

- `listAllUsers(db)` — `SELECT * FROM users ORDER BY created_at DESC`. (Named `listAllUsers`, not `listActiveUsers` — it returns every status, including `pending` and `suspended`, so a name implying an "active" filter would be misleading.)
- `updateUserStatus(userId, status, db)` — `UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`, run inside the transaction against the locked row

### Create `src/services/users.service.ts`

Implement `listUsers()`:

- Call `listAllUsers()`, strip `password_hash` from every row before returning

Implement `getUserById(id)`:

- `findById(id)`. If none → `AppError(404, 'User not found', 'USER_NOT_FOUND')`
- Strip `password_hash`, return the rest
- (UUID format is already validated at the controller before this function is called — no need to re-check here)

Implement `changeUserStatus(requestorRole, targetId, status)`:
Inside `withTransaction`:

1. `locked = lockUserById(targetId, client)`. If null → `AppError(404, 'User not found', 'USER_NOT_FOUND')`
2. Target-role restriction, checked before anything else:
   - If `locked.role === 'super admin'` → `AppError(403, 'Cannot modify a super administrator', 'SUPER_ADMIN_IMMUTABLE')` (whoever the caller is)
   - If `locked.role === 'admin' && requestorRole === 'admin'` → `AppError(403, 'Only a super admin may suspend an admin', 'FORBIDDEN')`
3. Pending target: if `locked.status === 'pending'` → reject; the status of a pending user cannot be changed → `AppError(422, 'Cannot suspend pending user', 'CANNOT_SUSPEND_PENDING_USER')`
4. No-op check: if `locked.status === status` → return `locked` (minus `password_hash`) as-is, no write, no revocation
5. `updateUserStatus(locked.id, status, client)`
6. If `status === 'suspended'` → `revokeAllRefreshTokensForUser(locked.id, client)` (already built in Stage 6d)
7. Return the updated row, `password_hash` stripped

### Controllers in a new `src/controllers/users.controller.ts`

- `list` → `asyncHandler`, calls `usersService.listUsers()`, returns `200` with `{ users: [...] }`
- `getById` → validate `req.params.id` with a Zod schema (`z.object({ id: z.string().uuid('Invalid user ID') })`), then calls `usersService.getUserById(id)`, returns `200` with the user object. A failed `.uuid()` check produces a `ZodError`, which the global error handler already turns into `400 VALIDATION_ERROR` with that message — no manual `400` handling needed here.
- `updateStatus` → validate `req.params.id` the same way as `getById`, validate the body with Zod (`.strict()`, `status` enum of `['active', 'suspended']`, custom messages matching your existing style: required → `"Status is required"`, type → `"Status must be a string"`, invalid enum value → `"Status must be 'active' or 'suspended'"`), then calls `usersService.changeUserStatus(req.user.role, req.params.id, status)`, returns `200` with the updated user object

### Create `src/routes/users.routes.ts`

```ts
router.get("/", authenticate, authorize("admin"), usersController.list);
router.get("/:id", authenticate, authorize("admin"), usersController.getById);
router.put(
  "/:id/status",
  authenticate,
  authorize("admin"),
  usersController.updateStatus,
);
```

Mount at `/users` in `app.ts`.

### Verification

- `GET /users` as a regular user → `403 FORBIDDEN`
- `GET /users` as an admin → `200`, `{ users: [...] }`, no `password_hash` field on any entry, includes a `pending` account (mid-registration, OTP not yet verified) alongside `active`/`suspended` ones, distinguishable via its `status` field
- `GET /users` with no `Authorization` header → `401 UNAUTHORIZED`
- `GET /users/:id` with a valid existing ID → `200`, full user minus `password_hash`
- `GET /users/:id` on a pending user's ID → `200`, returns the user with `status: 'pending'`
- `GET /users/:id` on a suspended user's ID → `200`, returns the user with `status: 'suspended'`
- `GET /users/:id` with a well-formed UUID that doesn't exist → `404 USER_NOT_FOUND`
- `GET /users/:id` with a non-UUID string (e.g. `abc123`) → `400 VALIDATION_ERROR`, `"Invalid user ID"`
- `PUT /users/:id/status {status: 'suspended'}` on an active user → `200`, user's status is `suspended` in DB, all their `refresh_tokens` rows now `is_revoked = true`
- `PUT /users/:id/status {status: 'active'}` on a suspended user → `200`, status flips back, no token rows touched by this call
- `PUT /users/:id/status {status: 'pending'}` → `400 VALIDATION_ERROR` (not a valid target)
- `PUT /users/:id/status` as a regular user → `403 FORBIDDEN`
- `PUT /users/:id/status` on a nonexistent ID → `404 USER_NOT_FOUND`
- Admin suspends a plain user → `200`
- Admin suspends an admin → `403 FORBIDDEN`
- Admin suspends the super admin → `403 SUPER_ADMIN_IMMUTABLE`
- Super admin suspends a plain user → `200`
- Super admin suspends an admin → `200`
- Super admin attempts to suspend the super admin account → `403 SUPER_ADMIN_IMMUTABLE`
- `PUT /users/:id/status {status: 'suspended'}` on a `pending` user → `422 CANNOT_SUSPEND_PENDING_USER`, user stays `pending`
- `PUT /users/:id/status {status: 'active'}` on a `pending` user → `422 CANNOT_SUSPEND_PENDING_USER`, user stays `pending`, not activated
- Suspend an already-suspended user → `200`, unchanged user returned, `updated_at` unchanged, no new revocation activity, none of the tokens' `revoked_at` timestamps change
- Unsuspend an already-active user → `200`, unchanged user returned, `updated_at` unchanged, no new revocation activity
- Suspend a user, then attempt `POST /auth/refresh` with their pre-suspension refresh cookie → `401` (revoked) — confirms this endpoint reuses the same revocation your reset-password flow already relies on
- Two concurrent `PUT /users/:id/status` calls on the same user (different target statuses) → no deadlock, no `500`, exactly one status wins, reflects normal lock-then-write serialization

### Tests (Vitest)

Write the Vitest tests for this stage, following the Stage 7 ground rules, real-Postgres
approach and layout (query tests, service tests, controller/HTTP tests, and the concurrent-status
case in `tests/concurrency/`). Every bullet under Verification above is a required test case.
Do not modify application code to make a test pass.

---

# Stage 10: Super Admin — Promote / Demote

> **Scope**: `PUT /users/:id/role`. Requires `authenticate` + `authorize('super admin')`.
> Backlog refs: F5.1.6.

### Design decisions (already made, do not change)

| Rule                     | Value                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Body                     | `{ role: 'admin' \| 'user' }` — `super admin` is never a valid value here (it's assigned only by bootstrap, never by this endpoint)                                      |
| Self-targeting           | Rejected — a super admin cannot change their own role via this endpoint                                                                                                  |
| Target is a super admin  | Rejected — a super admin account can never be modified through this endpoint (there is exactly one, created by bootstrap)                                                |
| Target is not active     | Rejected — the role of a `pending` or `suspended` user cannot be changed; only an `active` target is allowed. `pending` → `422 CANNOT_PROMOTE_PENDING_USER` (`'Cannot promote pending user'`); `suspended` → `422 CANNOT_PROMOTE_SUSPENDED_USER` (`'Cannot promote suspended user'`). |
| Refresh-token revocation | A successful role change revokes **all** of the target user's refresh tokens in the same transaction (same as suspend)                                                   |
| No-op requests           | If the target already has the requested role, this is a success, not an error: return `200` with the unchanged user, and skip both the DB write and the token revocation |
| Locking                  | `withTransaction` + `lockUserById` + re-check-after-lock                                                                                                                 |
| `:id` validation         | Same as Stage 9 — Zod `.uuid()` at the controller: `400 VALIDATION_ERROR` for a malformed UUID, `404 USER_NOT_FOUND` for a well-formed one that doesn't exist            |
| Service/query naming     | Query function `updateUserRole` (in `users.queries.ts`); service function `changeUserRole` (in `users.service.ts`) — same split as Stage 9's status functions            |

### Add to `src/db/queries/users.queries.ts`

- `updateUserRole(userId, role, db)` — `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1 RETURNING *`, run inside the transaction against the locked row

### Add to `src/services/users.service.ts`

Implement `changeUserRole(requesterId, targetId, newRole)`:

- If `targetId === requesterId` → `AppError(403, 'Cannot modify your own role', 'SELF_ROLE_CHANGE')`

Inside `withTransaction`:

1. `locked = lockUserById(targetId, client)`. If null → `AppError(404, 'User not found', 'USER_NOT_FOUND')`
2. If `locked.role === 'super admin'` → `AppError(403, 'Cannot modify a super administrator', 'SUPER_ADMIN_IMMUTABLE')`
3. Non-active target: the role of a non-active user cannot be changed.
   - If `locked.status === 'pending'` → `AppError(422, 'Cannot promote pending user', 'CANNOT_PROMOTE_PENDING_USER')`
   - If `locked.status === 'suspended'` → `AppError(422, 'Cannot promote suspended user', 'CANNOT_PROMOTE_SUSPENDED_USER')`
   This is checked before the no-op case, so a non-active user is rejected even if `newRole` equals their current role.
4. No-op check: if `locked.role === newRole` → return `locked` (minus `password_hash`) as-is, no write, no revocation
5. `updateUserRole(locked.id, newRole, client)`
6. `revokeAllRefreshTokensForUser(locked.id, client)`
7. Return the updated row, `password_hash` stripped

### Controller

`changeRole` in `users.controller.ts` → `asyncHandler`, validate `req.params.id` with the same Zod `.uuid()` schema as Stage 9 (`400 VALIDATION_ERROR`, `"Invalid user ID"` if not), validate body with Zod (`.strict()`, `role` enum of `['admin', 'user']`, custom messages: required → `"Role is required"`, type → `"Role must be a string"`, invalid enum → `"Role must be 'admin' or 'user'"`), read the requester's own ID off `req.user.user_id`, call `usersService.changeUserRole()`, return `200` with the updated user object.

### Wire up route

```ts
router.put(
  "/:id/role",
  authenticate,
  authorize("super admin"),
  usersController.changeRole,
);
```

### Verification

- `PUT /users/:id/role {role: 'admin'}` on a regular user, as super admin → `200`, role updated, all their refresh tokens revoked
- `PUT /users/:id/role {role: 'user'}` on an admin, as super admin → `200`, demoted, tokens revoked
- Same call as a regular admin (not super admin) → `403 FORBIDDEN` (blocked by `authorize`, never reaches the handler — confirms F5.1.5 is satisfied by the middleware alone)
- Same call as a regular user → `403 FORBIDDEN`
- Super admin targets their own ID → `403 SELF_ROLE_CHANGE`
- Super admin targets the bootstrap super-admin account's own ID (if somehow not caught by the self-check, e.g. a second super admin existed) → `403 SUPER_ADMIN_IMMUTABLE`
- `{role: 'super admin'}` in the body → `400 VALIDATION_ERROR`, `"Role must be 'admin' or 'user'"`
- Nonexistent target ID → `404 USER_NOT_FOUND`
- Non-UUID target ID → `400 VALIDATION_ERROR`, `"Invalid user ID"`
- Promote a user to admin, then that user's _pre-promotion_ access token (still `role: user`) hits an admin-only route within its remaining lifetime → still rejected with `403` (expected — a promotion also doesn't take effect until refresh, same as the stale-claim rule from Stage 8); after they `refresh`, the new token carries `role: admin` and the same route succeeds
- Demote an admin, then within the old token's remaining lifetime, hit an admin route → still succeeds (expected, matches Stage 8's documented tradeoff); attempt `POST /auth/refresh` with their old refresh cookie → `401` (revoked), forcing re-login rather than a quiet demotion
- `PUT /users/:id/role` on a `pending` user → `422 CANNOT_PROMOTE_PENDING_USER`, role unchanged
- `PUT /users/:id/role` on a `suspended` user → `422 CANNOT_PROMOTE_SUSPENDED_USER`, role unchanged, no token rows touched
- Two concurrent `PUT /users/:id/role` calls on the same target with different roles → no deadlock, no `500`, exactly one role wins
- Promote an admin to admin again → `200`, unchanged user, no refresh tokens revoked
- Demote a user to user again → `200`, unchanged user, no refresh tokens revoked

### Tests (Vitest)

Write the Vitest tests for this stage, following the Stage 7 ground rules, real-Postgres
approach and layout (with the concurrent-role case in `tests/concurrency/`). Every bullet under
Verification above is a required test case. Do not modify application code to make a test pass.
