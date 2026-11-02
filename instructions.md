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

| Rule                               | Value                                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /users` response shape        | `{ users: [...] }` (wrapped, not a bare array)                                                                                                                                                                                                                                                                 |
| Fields returned per user           | Every column except `password_hash` — `id, username, email, status, role, created_at, updated_at`                                                                                                                                                                                                              |
| Pending users                      | `GET /users` and `GET /users/:id` both return users **regardless of status, including `pending`**. The `status` field in the response is how a caller tells a pending (unverified) registration apart from a real account — no separate flag needed.                                                           |
| `GET /users/:id` — not found       | `404` with `{ message: 'User not found', code: 'USER_NOT_FOUND' }`                                                                                                                                                                                                                                             |
| `GET /users/:id` — malformed `:id` | `400` with message `"Invalid user ID"`, code `VALIDATION_ERROR` — enforced via a Zod `.uuid()` check on `req.params.id` at the controller (same convention as every other validation in this codebase), before any DB call                                                                                     |
| `PUT /users/:id/status` body       | `{ status: 'active' \| 'suspended' }`                                                                                                                                                                                                                                                                          |
| Suspend side-effect                | Revokes **all** of the target user's refresh tokens in the same transaction (already required by the general rule from Stage 4: "anything that... suspends a user... must revoke ALL that user's refresh tokens in the SAME transaction as the change")                                                        |
| Unsuspend side-effect              | None beyond the status flip — no tokens to revoke, there's nothing live to reactivate                                                                                                                                                                                                                          |
| Locking                            | `withTransaction` + `lockUserById` + re-check-after-lock, same pattern as every other state-changing operation in this service                                                                                                                                                                                 |
| Target role restriction            | An `admin` caller may only suspend/unsuspend a target with `role = 'user'`. A `super admin` caller may suspend/unsuspend a `user` or `admin` target, but not another `super admin`.                                                                                                                            |
| Error codes for role restrictions  | Any caller targeting a `super admin` (including a super admin targeting one) → `403 SUPER_ADMIN_IMMUTABLE`. An `admin` caller targeting an `admin` → `403 FORBIDDEN`.                                                                                                                                          |
| Pending target                     | The status of a `pending` user cannot be changed through this endpoint, to either `suspended` or `active`. A pending account only becomes active through OTP verification. Responds `422 CANNOT_CHANGE_STATUS_PENDING_USER`, message `'Cannot change the status of a pending user'`, for either target status. |
| No-op requests                     | If the target is already in the requested status, this is a success, not an error: return `200` with the unchanged user, and skip both the DB write and the token revocation                                                                                                                                   |
| Service file location              | `listUsers`, `getUserById`, `changeUserStatus` (and Stage 10's `changeUserRole`) live in a new `src/services/users.service.ts`, not `auth.service.ts` — matching how `otp.service.ts` and `email.service.ts` were already split out from `auth.service.ts`                                                     |
| Naming (query vs. service)         | The query function stays `updateUserStatus` (matches the SQL operation). The service function that calls it is `changeUserStatus`, to avoid two different-layer functions sharing one name (same split for Stage 10's `updateUserRole` query vs. `changeUserRole` service)                                     |

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
3. Pending target: if `locked.status === 'pending'` → reject; the status of a pending user cannot be changed → `AppError(422, 'Cannot change the status of a pending user', 'CANNOT_CHANGE_STATUS_PENDING_USER')`
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
- `PUT /users/:id/status {status: 'suspended'}` on a `pending` user → `422 CANNOT_CHANGE_STATUS_PENDING_USER`, user stays `pending`
- `PUT /users/:id/status {status: 'active'}` on a `pending` user → `422 CANNOT_CHANGE_STATUS_PENDING_USER`, user stays `pending`, not activated
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

| Rule                     | Value                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body                     | `{ role: 'admin' \| 'user' }` — `super admin` is never a valid value here (it's assigned only by bootstrap, never by this endpoint)                                                                                                                                                                                     |
| Self-targeting           | Rejected — a super admin cannot change their own role via this endpoint                                                                                                                                                                                                                                                 |
| Target is a super admin  | Rejected — a super admin account can never be modified through this endpoint (there is exactly one, created by bootstrap)                                                                                                                                                                                               |
| Target is not active     | Rejected — the role of a `pending` or `suspended` user cannot be changed; only an `active` target is allowed. `pending` → `422 CANNOT_CHANGE_ROLE_PENDING_USER` (`'Cannot change the role of a pending user'`); `suspended` → `422 CANNOT_CHANGE_ROLE_SUSPENDED_USER` (`'Cannot change the role of a suspended user'`). |
| Refresh-token revocation | A successful role change revokes **all** of the target user's refresh tokens in the same transaction (same as suspend)                                                                                                                                                                                                  |
| No-op requests           | If the target already has the requested role, this is a success, not an error: return `200` with the unchanged user, and skip both the DB write and the token revocation                                                                                                                                                |
| Locking                  | `withTransaction` + `lockUserById` + re-check-after-lock                                                                                                                                                                                                                                                                |
| `:id` validation         | Same as Stage 9 — Zod `.uuid()` at the controller: `400 VALIDATION_ERROR` for a malformed UUID, `404 USER_NOT_FOUND` for a well-formed one that doesn't exist                                                                                                                                                           |
| Service/query naming     | Query function `updateUserRole` (in `users.queries.ts`); service function `changeUserRole` (in `users.service.ts`) — same split as Stage 9's status functions                                                                                                                                                           |

### Add to `src/db/queries/users.queries.ts`

- `updateUserRole(userId, role, db)` — `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1 RETURNING *`, run inside the transaction against the locked row

### Add to `src/services/users.service.ts`

Implement `changeUserRole(requesterId, targetId, newRole)`:

- If `targetId === requesterId` → `AppError(403, 'Cannot modify your own role', 'SELF_ROLE_CHANGE')`

Inside `withTransaction`:

1. `locked = lockUserById(targetId, client)`. If null → `AppError(404, 'User not found', 'USER_NOT_FOUND')`
2. If `locked.role === 'super admin'` → `AppError(403, 'Cannot modify a super administrator', 'SUPER_ADMIN_IMMUTABLE')`
3. Non-active target: the role of a non-active user cannot be changed.
   - If `locked.status === 'pending'` → `AppError(422, 'Cannot change the role of a pending user', 'CANNOT_CHANGE_ROLE_PENDING_USER')`
   - If `locked.status === 'suspended'` → `AppError(422, 'Cannot change the role of a suspended user', 'CANNOT_CHANGE_ROLE_SUSPENDED_USER')`
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
- `PUT /users/:id/role` on a `pending` user → `422 CANNOT_CHANGE_ROLE_PENDING_USER`, role unchanged
- `PUT /users/:id/role` on a `suspended` user → `422 CANNOT_CHANGE_ROLE_SUSPENDED_USER`, role unchanged, no token rows touched
- Two concurrent `PUT /users/:id/role` calls on the same target with different roles → no deadlock, no `500`, exactly one role wins
- Promote an admin to admin again → `200`, unchanged user, no refresh tokens revoked
- Demote a user to user again → `200`, unchanged user, no refresh tokens revoked

### Tests (Vitest)

Write the Vitest tests for this stage, following the Stage 7 ground rules, real-Postgres
approach and layout (with the concurrent-role case in `tests/concurrency/`). Every bullet under
Verification above is a required test case. Do not modify application code to make a test pass.

# Stage 11: Requester/Courier Toggle

> **Scope**: `PUT /users/me/active-view`. Requires `authenticate` only — any logged-in user can toggle their own view; no role restriction, since F5.2.1 already establishes every user can act as both requester and courier without restriction.
>
> Backlog refs: F5.2.2.

### Design decisions (already made, do not change)

| Rule                        | Value                                                                                                                                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enum values                 | `'requester'` \| `'courier'`                                                                                                                                                                                                                                          |
| Default                     | `'requester'` — for both new users (schema default) and existing rows (migration backfill)                                                                                                                                                                            |
| Column                      | `active_view` on the `users` table, new `active_view_enum` type                                                                                                                                                                                                       |
| Route location              | New `src/routes/me.routes.ts`, mounted at `/users/me`                                                                                                                                                                                                                 |
| Controller/service location | New `src/controllers/me.controller.ts` and `src/services/me.service.ts` — self-service concerns, kept separate from admin's `users.controller.ts` / `users.service.ts`. Stage 12's profile endpoints (view/change own username, email, password) will also live here. |
| Endpoint shape              | One endpoint only: `PUT /users/me/active-view`. No separate `GET` — the frontend gets the current value from the `user` object already returned by `login` (this stage adds `activeView` to that object)                                                              |
| Locking                     | None needed — this is a single-column update with no dependent side effects (no token revocation, no other rows affected), so a plain conditional `UPDATE` is enough; it doesn't need `withTransaction` + `lockUserById` the way suspend/role-change do               |
| Authorization scope         | No cross-service exposure — `activeView` doesn't gate what a user can do (F5.2.1 already allows all actions to all users), so it isn't added to the JWT claims or to `GET /auth/verify`. It's a display preference only the owning user's own frontend ever reads.    |

### Update `src/db/init.sql`

Add a new enum, using the same safe-creation pattern as the existing enums:

```sql
DO $$ BEGIN
  CREATE TYPE active_view_enum AS ENUM ('requester', 'courier');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

Add the column to the `users` table:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_view active_view_enum NOT NULL DEFAULT 'requester';
```

`init.sql` only applies to a fresh DB volume — if you're adding this to an existing dev database, either reset with `docker compose down -v` (dev data only, same as the Stage 5a pattern) or run the `ALTER TABLE` manually against the running container. Remind me which applies when you report back.

### Update `src/db/queries/users.queries.ts`

- `updateActiveView(userId, activeView, db)` — `UPDATE users SET active_view = $2, updated_at = NOW() WHERE id = $1 RETURNING *`

### Create `src/services/me.service.ts`

Implement `changeActiveView(userId, activeView)`:

- `updateActiveView(userId, activeView)` — no lock, no transaction, no existing-value check (unlike Stage 9/10's status/role changes, there's no "invalid transition" here — a user can always freely switch between the two values, and there's no side effect to make atomic with the write)
- If the query returns no row (user was deleted concurrently — unlikely but possible), throw `AppError(404, 'User not found', 'USER_NOT_FOUND')`
- Strip `password_hash`, return the rest

### Create `src/controllers/me.controller.ts`

Implement `updateActiveView`:

- `asyncHandler`-wrapped
- Validate body with Zod (`.strict()`, custom messages matching your existing style): `activeView` required → `"Active view is required"`, type → `"Active view must be a string"`, invalid enum value → `"Active view must be 'requester' or 'courier'"`
- Read the caller's own ID off `req.user.user_id` (never take an ID from the request body — this endpoint only ever modifies the caller's own row)
- Call `meService.changeActiveView(req.user.user_id, activeView)`
- Return `200` with the updated user object

### Create `src/routes/me.routes.ts`

```ts
router.put("/active-view", authenticate, meController.updateActiveView);
```

### Update `app.ts`

Mount `meRouter` at `/users/me` **before** `usersRouter` at `/users`:

```ts
app.use("/users/me", meRouter);
app.use("/users", usersRouter);
```

This order is required — if `usersRouter` (with its `GET /:id` route from Stage 9) is registered first, a request to `/users/me` would be matched by `/:id` with `id = 'me'`, fail the UUID validation, and never reach `meRouter` at all.

---

## Change to already-implemented code

| #   | File                                     | Change                                                                                                                           | Where specified         |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | `src/services/auth.service.ts` (`login`) | Add `activeView` to the returned `user` object: `{ id, username, email, role, activeView }`. No other change to `login`'s logic. | Stage 4c (return shape) |

### Verification

- `PUT /users/me/active-view {activeView: 'courier'}` while authenticated → `200`, updated user object returned with `active_view: 'courier'` (same DB-row shape as `GET /users/:id`, snake_case — not `activeView`, which is only `login`'s response shape), `active_view` column updated in DB
- `PUT /users/me/active-view {activeView: 'requester'}` on a user already set to `'requester'` → `200`, unchanged (this doesn't need a special no-op branch like Stage 9/10 — an unconditional `UPDATE` to the same value is harmless and still returns `200` correctly)
- `PUT /users/me/active-view` with no `Authorization` header → `401 UNAUTHORIZED`
- `PUT /users/me/active-view {activeView: 'admin'}` (not a valid enum value) → `400 VALIDATION_ERROR`, `"Active view must be 'requester' or 'courier'"`
- Missing `activeView` field → `400 VALIDATION_ERROR`, `"Active view is required"`
- `activeView: 123` (wrong type) → `400 VALIDATION_ERROR`, `"Active view must be a string"`
- Extra field in the body → `400 VALIDATION_ERROR`, `"Request contains unexpected fields"`
- A newly registered-and-verified user, before ever calling this endpoint → their `active_view` is `'requester'` by default (schema default, not a manual insert)
- `POST /auth/login` response now includes `activeView` in the `user` object, reflecting whatever was last set (or the default, if never changed)
- Request to `/users/me` (no further path segment) → `meRouter` has no `GET` route, so this falls through to `usersRouter`'s `GET /:id` with `id = 'me'`, which is expected and not a mount-order bug: no token → `401 UNAUTHORIZED`; regular user → `403 FORBIDDEN` (blocked by `authorize('admin')`); admin → `400 VALIDATION_ERROR`, `"Invalid user ID"` (the UUID check rejects `'me'`). `PUT /users/me/active-view` still reaches `meRouter`, because it is mounted first — that's what the mount order actually guards.
- Two concurrent `PUT /users/me/active-view` calls with different values from the same user → no deadlock (there's no lock to deadlock on), last write wins, no `500`

## Stage 11b: Test Suite — Requester/Courier Toggle

> **Scope**: Vitest tests for Stage 11 only (`PUT /users/me/active-view`, the `activeView`
> addition to `login`'s response, and the `active_view` column/enum).

Follow the same ground rules, test stack, and mocking policy established in Stage 7 (read the
current codebase first, not just this file; do not invent behavior for anything unclear — list
it and ask instead of guessing; do not modify application code to make a test pass; use the
real test Postgres instance for anything involving the DB, mocked `pg` only for pure logic with
no DB/transaction involved).

### What to test

Treat every bullet in Stage 11's own **Verification** section as a required test case:

- Successful toggle to `'courier'` and to `'requester'`, confirming both the response body and
  the `active_view` column in the DB
- The "set to the same value it already has" case — confirm this returns `200` normally, since
  Stage 11 deliberately has no no-op short-circuit (unlike Stage 9/10's status/role changes)
- Missing `Authorization` header → `401`
- Invalid enum value, missing field, wrong type, and unrecognized extra field → the four
  `400 VALIDATION_ERROR` cases, each with its exact message
- A newly registered-and-activated user defaults to `'requester'` without ever calling this
  endpoint
- `POST /auth/login`'s response now includes `activeView` in the `user` object
- Two concurrent `PUT /users/me/active-view` calls with different values from the same user →
  no deadlock, no `500` (there's no lock here, so this is really just confirming the endpoint
  doesn't blow up under concurrent writes, not testing any serialization guarantee)

### One thing NOT to test here

Do not write a test asserting what `GET /users/me` currently does (falling through to
`usersRouter`'s `GET /:id`, producing `403` for a regular user or `400` for an admin). That
behavior is a known, temporary gap that Stage 12 closes by giving `meRouter` its own route for
the bare path — a test asserting today's fallthrough would immediately become false, and
contradict Stage 12's own tests, the moment that stage lands. If you think this gap needs
documenting somewhere, note it in your unclear-points list rather than encoding it as a test.

### Deliverables

1. The test file(s) for Stage 11, placed to mirror the source tree per Stage 7's convention
   (e.g. `tests/controllers/me.controller.test.ts`, `tests/services/me.service.test.ts`)

## Stage 12: Profile Management (View, Change Username / Email / Password)

> **Scope**: `GET /users/me`, `PUT /users/me/username`, `PUT /users/me/email`, `PUT /users/me/password`, `POST /users/me/confirm-password-change`, plus two new authenticated OTP routes: `POST /users/me/verify-otp`, `POST /users/me/resend-otp`. `/auth/verify-otp` and `/auth/resend-otp` are untouched — still public, still only `registration` | `forgot_password`.
>
> Backlog refs: F4.1, F4.2, F4.3, F4.4.

### Design decisions (already made, do not change)

| Rule                                         | Value                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /users/me` response                     | `{ username, email }` only                                                                                                                                                                                                                                                           |
| Username change                              | `PUT /users/me/username` — no password re-entry, no OTP                                                                                                                                                                                                                              |
| Username validation                          | Same format rule as registration (min 3, max 255, no spaces/special chars). Same as current → `409 USERNAME_UNCHANGED`. Taken by another account → `409 USERNAME_TAKEN` (reuses registration's code)                                                                                 |
| Email change — API-facing purpose            | `change_email` → DB enum `'Change Email'`                                                                                                                                                                                                                                            |
| Email change flow                            | One-step, like registration: `PUT /users/me/email` (current password + newEmail) issues an OTP to the NEW email, stored as `users_otps.new_email`; `POST /users/me/verify-otp {purpose: change_email}` finalizes directly, writing `users.email`                                     |
| Email validation                             | Same format rule as registration. Same as current → `409 EMAIL_UNCHANGED`. Taken by another account → `409 EMAIL_TAKEN`                                                                                                                                                              |
| Old email stays authoritative until verified | F4.2.6 — `users.email` untouched until the OTP is verified                                                                                                                                                                                                                           |
| Password change — API-facing purpose         | `change_password` → DB enum `'Change Password'`                                                                                                                                                                                                                                      |
| Password change flow                         | Two calls, nothing pending stored server-side: `PUT /users/me/password` (current password + newPassword — validated, NOT persisted) issues an OTP to the CURRENT/registered email; `POST /users/me/confirm-password-change {otp, newPassword}` re-supplies and applies `newPassword` |
| New password validation                      | Same complexity rule as registration. Identical to current password → `400 PASSWORD_UNCHANGED`                                                                                                                                                                                       |
| Password re-entry check (both flows)         | `bcrypt.compare` against the current password hash — verified on an unlocked read first (bcrypt is slow), then re-verified against the locked row inside the transaction, same race-safety pattern as `login`                                                                        |
| Successful password change side-effect       | Revoke ALL of that user's refresh tokens in the same transaction (F4.3.4)                                                                                                                                                                                                            |
| Successful email/username change side-effect | None                                                                                                                                                                                                                                                                                 |
| Route split for OTP endpoints                | `/auth/verify-otp` / `/auth/resend-otp` stay PUBLIC, purposes `registration` \| `forgot_password` only. Two NEW, AUTHENTICATED routes: `POST /users/me/verify-otp` (purpose `change_email` only) and `POST /users/me/resend-otp` (purposes `change_email`, `change_password`)        |
| Why password-change has no verify-otp entry  | Its OTP is checked and consumed only inside `confirm-password-change` — `/users/me/verify-otp`'s purpose enum has just `change_email` for now                                                                                                                                        |
| Resending a change-email OTP                 | `/users/me/resend-otp {purpose: change_email}` resends to the SAME pending `new_email`, read off the latest OTP row — the client does not repeat it                                                                                                                                  |
| Locking                                      | `withTransaction` + `lockUserById`, same pattern as every other state-changing operation                                                                                                                                                                                             |
| Concurrent duplicate username/email          | Same `23505` → mapped-error pattern as registration                                                                                                                                                                                                                                  |
| Service file location                        | All new functions live in `src/services/me.service.ts` (created in Stage 11) — not `auth.service.ts` or `users.service.ts`                                                                                                                                                           |

No changes to already-implemented code are needed for this stage — everything below is additions only.

---

### Stage 12a: `GET /users/me`

#### Add to `src/services/me.service.ts`

`getOwnProfile(userId)`:

- `findById(userId)`. If none → `AppError(404, 'User not found', 'USER_NOT_FOUND')`
- Return `{ username: user.username, email: user.email }` — nothing else, not just `password_hash` stripped

#### Add to `src/controllers/me.controller.ts`

`getProfile` — `asyncHandler`, calls `meService.getOwnProfile(req.user.user_id)`, returns `200` with the object directly (not wrapped in `{ user: ... }`).

#### Add to `src/routes/me.routes.ts`

```ts
router.get("/", authenticate, meController.getProfile);
```

#### Verification

- `GET /users/me` while authenticated → `200`, `{ username, email }`, no other fields
- `GET /users/me` with no `Authorization` header → `401 UNAUTHORIZED`

---

### Stage 12b: Change Username

#### Add to `src/db/queries/users.queries.ts`

`updateUsername(userId, username, db)` — `UPDATE users SET username = $2, updated_at = NOW() WHERE id = $1 RETURNING *`

#### Add to `src/services/me.service.ts`

`changeUsername(userId, newUsername)`:

- Validate format (same rule/message as registration's username) → `400 VALIDATION_ERROR`

Inside `withTransaction`:

1. `locked = lockUserById(userId, client)`. If null → `404 USER_NOT_FOUND`
2. If `newUsername === locked.username` → `AppError(409, 'New username must be different from your current username', 'USERNAME_UNCHANGED')`
3. `existing = findByUsername(newUsername, client)`. If `existing && existing.id !== userId` → `AppError(409, 'Username already in use', 'USERNAME_TAKEN')`
4. `updateUsername(locked.id, newUsername, client)` — wrap in try/catch for `23505` → same `USERNAME_TAKEN` mapping as registration (covers the concurrent race)
5. Return `{ username: updated.username, email: updated.email }`

#### Add to `src/controllers/me.controller.ts`

`changeUsername` — Zod (`.strict()`): `newUsername` required "New username is required", type "New username must be a string", lowercased-only (not trimmed, same as registration's username field). Calls `meService.changeUsername()`, returns `200` with the returned profile object.

#### Add to `src/routes/me.routes.ts`

```ts
router.put("/username", authenticate, meController.changeUsername);
```

#### Verification

- Valid new username → `200`, `{ username: <new>, email }`, DB row updated
- Same as current username → `409 USERNAME_UNCHANGED`
- Username belonging to another account → `409 USERNAME_TAKEN`
- Invalid format (too short / spaces / special chars) → `400 VALIDATION_ERROR`
- Missing/extra/wrong-type fields → standard `400 VALIDATION_ERROR` pattern
- No `Authorization` header → `401 UNAUTHORIZED`
- Two concurrent `PUT /users/me/username` requests from two different accounts both targeting the same new username → exactly one `200`, the other `409 USERNAME_TAKEN`, never `500`

---

### Stage 12c: Change Email — Initiate

#### Update `src/services/email.service.ts`

Add a `Change Email` entry to the purpose map: subject `"Confirm your new FoC email address"`, same body shape as the others.

#### Add to `src/services/me.service.ts`

`initiateEmailChange(userId, { currentPassword, newEmail })`:

- Validate `newEmail` format (same rule as registration) → `400 VALIDATION_ERROR`
- Unlocked read: `user = findById(userId)`. `bcrypt.compare(currentPassword, user.password_hash)`; mismatch → `AppError(401, 'Current password is incorrect', 'INVALID_PASSWORD')`
- If `newEmail === user.email` → `AppError(409, 'New email must be different from your current email', 'EMAIL_UNCHANGED')`
- `existing = findByEmail(newEmail)`. If `existing && existing.id !== userId` → `AppError(409, 'Email already in use', 'EMAIL_TAKEN')`

Inside `withTransaction`:

1. `locked = lockUserById(userId, client)`. If null → `404 USER_NOT_FOUND`
2. Re-verify `currentPassword` against `locked.password_hash` (race-safety) → `401 INVALID_PASSWORD` on mismatch
3. Re-check `newEmail` against `locked.email` and re-query `findByEmail(newEmail, client)` for the same two conditions (closes the gap between the unlocked read and the lock)
4. `requestOtp({ userId, email: locked.email, purpose: 'Change Email', newEmail }, client)`
5. Map the result the same way `forgotPassword` does: `sent` → success; `throttled` (cooldown/limit) → `429 OTP_RESEND_COOLDOWN` / `429 OTP_RESEND_LIMIT`; `EMAIL_SEND_FAILED` propagates as `503`

#### Add to `src/controllers/me.controller.ts`

`changeEmail` (`PUT /users/me/email`) — Zod (`.strict()`): `currentPassword` required "Current password is required"/string; `newEmail` uses the shared `emailField`. Returns `200` with `{ message: 'Verification code sent to your new email', code: 'OTP_SENT' }`.

#### Add to `src/routes/me.routes.ts`

```ts
router.put("/email", authenticate, meController.changeEmail);
```

#### Verification

- Correct current password + valid new unused email → `200 OTP_SENT`, `users_otps` row with `purpose = 'Change Email'`, `new_email` set, dev console/inbox shows the OTP
- Wrong current password → `401 INVALID_PASSWORD`, no OTP row created
- `newEmail` same as current → `409 EMAIL_UNCHANGED`
- `newEmail` already registered to another account → `409 EMAIL_TAKEN`, no OTP row created
- Immediately repeating the request → `429 OTP_RESEND_COOLDOWN` with `Retry-After`
- After the resend limit (backdate `created_at`) → `429 OTP_RESEND_LIMIT`
- SMTP send forced to fail → `503 EMAIL_SEND_FAILED`, rolled back cleanly
- No `Authorization` header → `401 UNAUTHORIZED`

---

### Stage 12d: `/users/me/verify-otp` and `/users/me/resend-otp`

#### Add to `src/db/queries/users.queries.ts`

`updateEmail(userId, email, db)` — `UPDATE users SET email = $2, updated_at = NOW() WHERE id = $1 RETURNING *`

#### Add to `src/services/me.service.ts`

`verifyEmailChangeOtp(userId, otp)`:

Inside `withTransaction`:

1. `locked = lockUserById(userId, client)`. If null → `404 USER_NOT_FOUND`
2. `pending = findLatestOtp(userId, 'Change Email', client)`. If none → `AppError(400, 'Invalid or expired OTP', 'INVALID_OTP')`
3. `checkOtp({ userId, purpose: 'Change Email', otp }, client)` — default consuming
4. If `{ ok: true }`: `updateEmail(locked.id, pending.new_email, client)`, wrapped in try/catch for `23505` → `AppError(409, 'Email already in use', 'EMAIL_TAKEN')` (someone else took it in the meantime — the whole transaction, including the OTP consumption, rolls back, so the OTP is still usable if the user picks a different email)
5. Commit; if `{ ok: false }` → `400 INVALID_OTP`

`resendChangeEmailOtp(userId)`:

Inside `withTransaction`:

1. `locked = lockUserById(userId, client)`. If null → `404 USER_NOT_FOUND`
2. `pending = findLatestOtp(userId, 'Change Email', client)`. If none, or `consumed_at` is set → `AppError(400, 'No pending email change found', 'NO_PENDING_EMAIL_CHANGE')`
3. `requestOtp({ userId, email: locked.email, purpose: 'Change Email', newEmail: pending.new_email }, client)`
4. Map result same as Stage 12c (cooldown/limit/sent/email-fail)

`resendChangePasswordOtp(userId)`:

Inside `withTransaction`:

1. `locked = lockUserById(userId, client)`. If null → `404 USER_NOT_FOUND`
2. `pending = findLatestOtp(userId, 'Change Password', client)`. If none or `consumed_at` is set → `AppError(400, 'No pending password change found', 'NO_PENDING_PASSWORD_CHANGE')`
3. `requestOtp({ userId, email: locked.email, purpose: 'Change Password' }, client)`
4. Map result same as above

#### Add to `src/controllers/me.controller.ts`

- `verifyOtp` — Zod (`.strict()`): `otp` required/string; `purpose` enum `['change_email']` only, "Invalid purpose" for anything else. Dispatches (currently only one case) to `verifyEmailChangeOtp`. Returns `200` with `{ message: 'Email updated successfully', code: 'EMAIL_CHANGE_SUCCESS' }`.
- `resendOtp` — Zod (`.strict()`): `purpose` enum `['change_email', 'change_password']`. Dispatches to `resendChangeEmailOtp` or `resendChangePasswordOtp`. Both return `200` with `{ message: 'A new verification code has been sent to your email', code: 'OTP_SENT' }`.
- Both read the user id from `req.user.user_id` — neither accepts an `email` field.

#### Add to `src/routes/me.routes.ts`

```ts
router.post("/verify-otp", authenticate, meController.verifyOtp);
router.post("/resend-otp", authenticate, meController.resendOtp);
```

#### Verification

- Correct OTP for a pending email change → `200 EMAIL_CHANGE_SUCCESS`, `users.email` updated, OTP row `consumed_at` set
- Wrong OTP → `400 INVALID_OTP`, `attempts_count` incremented and persisted
- 5 wrong OTPs → `429 OTP_ATTEMPTS_EXCEEDED`, email unchanged
- Expired OTP with correct code → `400 OTP_EXPIRED`
- `purpose: 'change_password'` sent to `/users/me/verify-otp` → `400 VALIDATION_ERROR`, `"Invalid purpose"`
- Someone else registers the pending `new_email` first, then the original user submits the correct OTP → `409 EMAIL_TAKEN`, OTP still valid afterward (not consumed)
- Resend for change_email → `200 OTP_SENT`, same `new_email` reused, previous OTP row's `consumed_at` set
- Resend for change_email with no pending change → `400 NO_PENDING_EMAIL_CHANGE`
- Resend for change_password with no pending change → `400 NO_PENDING_PASSWORD_CHANGE`
- Both routes with no `Authorization` header → `401 UNAUTHORIZED`
- `POST /auth/verify-otp` and `POST /auth/resend-otp` (the original public ones) still reject `change_email`/`change_password` as an invalid purpose — confirms the two purpose sets stayed separate

---

### Stage 12e: Change Password — Initiate + Confirm

#### Add to `src/services/me.service.ts`

`initiatePasswordChange(userId, { currentPassword, newPassword })`:

- Validate `newPassword` complexity (registration rule) → `400 VALIDATION_ERROR`
- Unlocked read: `user = findById(userId)`. `bcrypt.compare(currentPassword, user.password_hash)`; mismatch → `401 INVALID_PASSWORD`
- `bcrypt.compare(newPassword, user.password_hash)` — if true → `AppError(400, 'New password must be different from your current password', 'PASSWORD_UNCHANGED')`

Inside `withTransaction`:

1. `locked = lockUserById(userId, client)`. If null → `404 USER_NOT_FOUND`
2. Re-verify `currentPassword` against `locked.password_hash` → `401 INVALID_PASSWORD` on mismatch
3. `requestOtp({ userId, email: locked.email, purpose: 'Change Password' }, client)`
4. Map result (cooldown/limit/sent/email-fail), same pattern as 12c

`newPassword` is validated here but never written anywhere — it's discarded once this call returns.

`confirmPasswordChange(userId, { otp, newPassword })`:

- Validate `newPassword` complexity → `400 VALIDATION_ERROR`
- Validate `otp` matches `^\d{6}$` → `400 VALIDATION_ERROR`, `"OTP must be a 6-digit code"`

Inside `withTransaction`:

1. `locked = lockUserById(userId, client)`. If null → `404 USER_NOT_FOUND`
2. `bcrypt.compare(newPassword, locked.password_hash)` — if true → `400 PASSWORD_UNCHANGED` (re-checked here in case the password changed between initiate and confirm)
3. `checkOtp({ userId, purpose: 'Change Password', otp }, client)` — default consuming
4. If `{ ok: true }`: hash `newPassword` (bcrypt, work factor 10), `updatePasswordHash(locked.id, hash, client)`, `revokeAllRefreshTokensForUser(locked.id, client)`
5. Commit; if `{ ok: false }` → `400 INVALID_OTP`

#### Add to `src/controllers/me.controller.ts`

- `changePassword` (`PUT /users/me/password`) — Zod (`.strict()`): `currentPassword`, `newPassword` required/string, same message style as `reset-password`. Returns `200` with `{ message: 'Verification code sent to your email', code: 'OTP_SENT' }`.
- `confirmPasswordChange` (`POST /users/me/confirm-password-change`) — Zod (`.strict()`): `otp`, `newPassword` required/string. Returns `200` with `{ message: 'Password changed successfully. Please log in again on other devices.', code: 'PASSWORD_CHANGE_SUCCESS' }`.

#### Add to `src/routes/me.routes.ts`

```ts
router.put("/password", authenticate, meController.changePassword);
router.post(
  "/confirm-password-change",
  authenticate,
  meController.confirmPasswordChange,
);
```

#### Verification

Happy path:

- Correct current password + valid new password → `200 OTP_SENT` → `confirm-password-change` with correct OTP → `200 PASSWORD_CHANGE_SUCCESS`, hash updated, all refresh tokens revoked
- Login with new password → `200`; login with old password → `401 INVALID_CREDENTIALS`
- A previously-issued access token stays valid until it naturally expires (only refresh tokens revoked)

Validation / errors:

- Wrong current password at initiate → `401 INVALID_PASSWORD`, no OTP sent
- `newPassword` same as current at initiate → `400 PASSWORD_UNCHANGED`
- Weak `newPassword` at either step → `400 VALIDATION_ERROR`
- Wrong OTP at confirm → `400 INVALID_OTP`, attempt persisted
- 5 wrong OTPs → `429 OTP_ATTEMPTS_EXCEEDED`, password unchanged
- Expired OTP → `400 OTP_EXPIRED`
- Re-submitting an already-consumed OTP → `400 INVALID_OTP`
- `confirm-password-change` with a different `newPassword` than what was validated at initiate → succeeds with whatever was sent to confirm (confirms initiate's validation was advisory/early-feedback only, not authoritative — note this is intended, not a bug)
- No `Authorization` header on either route → `401 UNAUTHORIZED`

Concurrency:

- Two concurrent `confirm-password-change` calls with the correct OTP → exactly one `200`, the other `400 INVALID_OTP`, password changed once

## Stage 13: Auth Distribution — JWKS Instead of `GET /auth/verify`

> **Scope**: Replace the current inter-service auth pattern — `supplier-service` (and, going
> forward, `order-service` and `credit-service`) calling `GET /auth/verify` on `user-service`
> for every request — with each consuming service verifying the access token itself, locally,
> against `user-service`'s public key. `user-service` publishes its public key(s) at a JWKS
> endpoint instead of answering a per-request verify call. This stage only covers `user-service`
> (signing/publishing side) and a guide for implementers; it does not implement verification
> inside `order-service`, `supplier-service`, or `credit-service` — see Stage 13d.
>
> This supersedes the auth pattern documented in `SupplierServiceArchitecture.md §7` and
> `SupplierServiceSpec.md`. **Scope correction (2026-10-17):** those two docs are _not_ updated
> as part of this stage — the user-service owner only touches `user-service` and this file;
> updating the supplier-service docs is left to that service's own owner.

### Design decisions (already made, do not change)

| Rule                                     | Value                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signing algorithm                        | RS256, unchanged. `user-service` keeps signing with its private key; nothing about `signAccessToken`'s claims changes.                                                                                                                                                                                                                               |
| Key pair for this stage                  | Reuse the existing `user-service/keys/private.pem` / `public.pem` (RSA-2048) as the first key published via JWKS. No new key pair is generated for this stage.                                                                                                                                                                                       |
| Distribution mechanism                   | JWKS. `user-service` exposes its public key(s) at a new, unauthenticated endpoint; consuming services fetch and cache them instead of calling an endpoint per request.                                                                                                                                                                               |
| JWKS endpoint                            | `GET /auth/.well-known/jwks.json` on `user-service`, mounted on the existing `/auth` router. Public, no `authenticate` middleware. Returns `{ keys: [...] }`, standard JWK format (RFC 7517).                                                                                                                                                        |
| Token claims                             | Unchanged (`sub` → `user_id`, `role`). No `aud` claim. The only addition is `kid` in the **JWT header** (not the payload), identifying which key signed the token.                                                                                                                                                                                   |
| Key rotation mechanism                   | Smooth transfer via JWKS: when rotating, the new key's public half is published under a new `kid` and signing cuts over to it; the just-retired key's public half stays published under its own `kid` (as the "previous" key) until its most recently issued tokens (max lifetime: `ACCESS_TOKEN_TTL_MINUTES`) have all expired, then it is dropped. |
| Key/kid configuration                    | One set of env vars per key, not a keystore file. Current signing key: `JWT_KEY_ID`, `JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH` (the last two already exist). Previous key, set only during a rotation overlap window: `JWT_PREVIOUS_KEY_ID`, `JWT_PREVIOUS_PUBLIC_KEY_PATH` (optional; no private key needed for a retired key).                 |
| Access token lifetime                    | Unchanged — `ACCESS_TOKEN_TTL_MINUTES` (currently 15). Not part of this stage.                                                                                                                                                                                                                                                                       |
| Cutover                                  | Instant/hard cutover. `GET /auth/verify` is removed in this stage, not deprecated alongside the new endpoint. There is no dual-support window at the API level (the key-rotation overlap above is a separate, narrower concept — it overlaps _keys_ in the JWKS, not _verification methods_).                                                        |
| Services in scope for consuming the JWKS | `order-service`, `supplier-service`, `credit-service` — all three.                                                                                                                                                                                                                                                                                   |
| Who implements the consuming side        | Not this stage. Stage 13d is a guide only; each service's own implementer writes and owns their verification code.                                                                                                                                                                                                                                   |

---

### Stage 13a: Per-Key Config + Signing/Verification by `kid`

#### Add to `user-service/src/config.ts`

- `JWT_KEY_ID` (required) — the `kid` for the current signing key.
- `JWT_PREVIOUS_KEY_ID` (optional) and `JWT_PREVIOUS_PUBLIC_KEY_PATH` (optional) — set together
  only during a rotation overlap window; both absent otherwise.
- Expose these under `config.jwt` alongside the existing `privateKeyPath` / `publicKeyPath`.

#### Change `user-service/src/utils/jwt.ts`

- Load the current key as `{ kid: config.jwt.keyId, privateKey, publicKey }` from the existing
  paths.
- If both `JWT_PREVIOUS_KEY_ID` and `JWT_PREVIOUS_PUBLIC_KEY_PATH` are set, also load a previous
  key as `{ kid, publicKey }` (no private key).
- `signAccessToken` — same claims as today; add the `keyid` sign option (`jsonwebtoken`'s
  built-in way of setting the JWT header's `kid`) set to the current key's `kid`.
- `verifyAccessToken` — decode the token's header first to read `kid`, look it up against the
  known keys (current, and previous if loaded), and verify with whichever key's public half
  matches. An unknown or missing `kid` is treated as an invalid token (same `401` behavior as
  any other verification failure today — no new error shape).
- Add `getJwks()` — returns `{ keys: [...] }`: for each known public key, export it as a JWK
  (Node's `crypto.createPublicKey(pem).export({ format: 'jwk' })` already yields `{ kty, n, e }`
  for an RSA key — no extra dependency needed) and add `kid`, `use: 'sig'`, `alg: 'RS256'`.

#### Verification

- A token signed by the current key verifies and its `kid` round-trips through `getJwks()`'s
  output.
- A token with no `kid` header, or a `kid` that matches neither known key, fails verification
  the same way a bad-signature token does today.
- With `JWT_PREVIOUS_KEY_ID` / `JWT_PREVIOUS_PUBLIC_KEY_PATH` unset (the normal case), `getJwks()`
  returns exactly one key.

---

### Stage 13b: JWKS Endpoint

#### Add to `user-service/src/controllers/auth.controller.ts`

- `jwks` — `asyncHandler`, no auth check, calls `getJwks()` and returns `200` with its result
  directly.

#### Add to `user-service/src/routes/auth.routes.ts`

```ts
router.get("/.well-known/jwks.json", authController.jwks);
```

#### Remove from `user-service/src/routes/auth.routes.ts` and `auth.controller.ts`

- `router.get('/verify', authController.verify)` and the `verify` controller itself (Stage 13c
  covers the knock-on test/doc updates this removal needs).

#### Verification

- `GET /auth/.well-known/jwks.json` requires no `Authorization` header and returns `200` with
  the current key in JWK format.
- `GET /auth/verify` no longer exists (`404`).

---

### Stage 13c: Remove `GET /auth/verify` — Tests and Docs

#### `user-service` tests

- `tests/controllers/auth.controller.test.ts` — remove the `describe('GET /auth/verify', ...)`
  block. The two unrelated tests that reuse `GET /auth/verify` purely as a "is this access token
  still valid" check (one under `POST /auth/logout`, one under password reset) need a different
  authenticated route to check against instead — `GET /users/me` already exists and is
  `authenticate`-protected.
- `tests/middleware/authenticate.test.ts` — remove the
  `describe('authenticate and GET /auth/verify agree on the same token', ...)` block (the thing
  it was cross-checking against no longer exists).
- Add coverage for the new behavior: the JWKS endpoint's shape and public-access, and
  `verifyAccessToken`/`signAccessToken` round-tripping by `kid` (Stage 13a's verification bullets
  above, as actual test cases).

#### Docs

**Scope correction (2026-10-17):** out of scope for this stage. `supplier-service/SupplierServiceArchitecture.md §7`
and `supplier-service/SupplierServiceSpec.md` still describe calling `GET /auth/verify`; the
user-service owner does not touch them — the user is notifying the supplier-service owner
directly to update them, pointing at the JWKS flow and the Stage 13d guide. (Root `README.md`
was checked and has no such contract-description prose to update — only historical Log-index
rows mentioning the old endpoint, which stay as-is.)

---

### Stage 13d: Guide for `order-service` / `supplier-service` / `credit-service` Implementers

This is documentation, not implementation — write a guide (not code) for whoever implements
token verification in each of the three consuming services. It must cover, at minimum:

- Fetching the JWKS from `GET {USER_SERVICE_URL}/auth/.well-known/jwks.json`.
- Caching keys by `kid` and a reasonable refetch strategy for a `kid` not currently in the
  cache (so key rotation doesn't require restarting every consuming service).
- Verifying the token's signature (RS256) against the matched key, and reading `sub` → `user_id`
  and `role` off the verified payload — the same two fields `GET /auth/verify` used to return.
- Rejecting with `401` on a missing/invalid/unverifiable token, consistent with how
  `user-service`'s own `authenticate` middleware already behaves.
- Noting that `supplier-service/src/middleware/authenticate.ts` currently calls the
  now-removed `GET /auth/verify` and must be rewritten by its implementer following this guide —
  this stage does not rewrite it.

Each service's own implementer writes and owns that service's verification code; this guide
only tells them how, per the decisions in this stage.

- Running `POST /auth/login` with the OLD password in a loop while the reset completes → no non-revoked refresh token survives from an old-password login after the change commits

# Stage 14: Initial Credit Allocation via Transactional Outbox

> **Scope**: When a user becomes active, user-service tells credit-service to allocate their
> initial credits. The request is recorded in an outbox table in `user-db` in the **same
> transaction** as the activation, and a relay running inside user-service delivers it to
> credit-service's `POST /credits/allocate` over HTTP, retrying on failure. Credit-service's side
> is already built and is not touched in this stage.
>
> Activation points covered: registration OTP verification (`verifyRegistrationOtp`) and the
> super admin bootstrap (when it actually creates the super admin).
>
> Backlog refs: F19.1.1 (allocation itself is credit-service's; this stage triggers it). D3 Parts 2–3.
>
> **Before starting:** if any `[DECIDE]` placeholder remains anywhere in this stage, stop and ask
> me. Do not pick a value yourself.

### Design decisions (already made, do not change)

| Rule                    | Value                                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport               | HTTP. `POST {CREDIT_SERVICE_URL}/credits/allocate`, JSON body `{ "userId": "<uuid>" }`. No message broker.                                                                                                       |
| Credit-service contract | `201` = allocated. `409 ALREADY_ALLOCATED` = already allocated, nothing granted. Credit dedupes on `userId` only. No service-to-service auth. No `Idempotency-Key` or other custom header is sent.               |
| Durability              | Transactional outbox: the outbox row is inserted with the same `client` and in the same `withTransaction` as the activation (or the super admin insert). Both commit or neither does.                            |
| Relay location          | Inside user-service. Started from `server.ts` after the super admin bootstrap. `app.ts` must not start it (tests import `app`).                                                                                  |
| Poll interval           | 1 second between passes                                                                                                                                                                                          |
| Batch size              | 5 rows per group; a pass repeats groups until no row is due (see "Delivery within a pass")                                                                                                                       |
| Request timeout         | 3 seconds per call                                                                                                                                                                                               |
| Claiming                | None. Two relays may deliver the same row; Credit's `409` makes that harmless. Do not add `FOR UPDATE SKIP LOCKED`, a claim column, or any other claiming mechanism.                                             |
| Max attempts            | 10 failed attempts, then the row is `dead`                                                                                                                                                                       |
| Backoff                 | Exponential with full jitter (see "Backoff" below)                                                                                                                                                               |
| Dead rows               | Kept. Recovered only by the replay script (Stage 14e).                                                                                                                                                           |
| Sent rows               | Kept with `status = 'sent'`, never deleted                                                                                                                                                                       |
| Observability           | The outbox row is the record: `status`, `attempts`, `last_error`, `updated_at`. No per-attempt log lines. The only console output is `console.error` when a whole relay pass fails (e.g. `user-db` unreachable). |
| Super admin             | Gets credits. Bootstrap inserts an outbox row only when it actually created the super admin.                                                                                                                     |
| Already-active users    | Ignored. No backfill.                                                                                                                                                                                            |
| Config                  | `CREDIT_SERVICE_URL` is an env var. Every other value in this table is a constant in code.                                                                                                                       |

### Outcome → action

| Outcome of a delivery attempt                                                                                            | Action                                                             |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Any `2xx` (including `201`)                                                                                              | `sent`                                                             |
| `409`                                                                                                                    | `sent`                                                             |
| `400`, `401`, `403`, `404`, `500`                                                                                        | `dead` immediately (`attempts` incremented, `last_error` recorded) |
| `429`, and any `5xx` other than `500` (e.g. `502`, `503`, `504`)                                                         | Retry with backoff; `dead` once `attempts` reaches 10              |
| Timeout (3 s) or network error (`ECONNREFUSED`, `ENOTFOUND`, `ECONNRESET`, etc.)                                         | Retry with backoff; `dead` once `attempts` reaches 10              |
| `408`, `425` (may resolve on their own)                                                                                  | Retry with backoff; `dead` once `attempts` reaches 10              |
| Any other status not listed above, including every other `3xx` and `4xx` (won't resolve without a code or config change) | `dead` immediately (`attempts` incremented, `last_error` recorded) |

`last_error` format:

- HTTP response: `HTTP <status>` followed by the response body's `code` if the body is JSON and has one, e.g. `HTTP 500 BALANCE_INVARIANT_VIOLATION`. Never store the full response body.
- Timeout: `TIMEOUT`
- Network error: `NETWORK <error code>`, e.g. `NETWORK ECONNREFUSED`

### Backoff

`attempts` counts failed attempts. After the n-th failed attempt (n = the new `attempts` value):

- If n ≥ 10 → `status = 'dead'`
- Otherwise → `next_attempt_at = clock_timestamp() + (random() × min(300, 1 × 2^(n−1))) seconds`

So the caps on the wait are 1, 2, 4, …, 256 seconds, and the actual wait is a random value between 0 and the cap. Compute this in SQL (clock rule: the database owns time), not with `Date.now()` or `Math.random()`. A row whose wait has passed is picked up by the next group, in the same pass or the next one.

### Delivery within a pass

A pass works through the backlog in groups of 5:

1. `findDueCreditAllocations(5)`
2. If it returns no rows, the pass ends.
3. Otherwise, send all of the returned rows concurrently, wait until every request has settled (`Promise.allSettled`, so one failure never stops the others' results from being recorded), and record each result.
4. Go back to step 1 immediately. There is no 1-second wait between groups.

A pass ends only when no row is due. Rows still waiting out their backoff are not due, so they don't keep the pass going; a row whose wait expires during the pass is picked up by a later group in the same pass. Each group takes at most 3 s (the request timeout).

Passes never overlap within one process: schedule the next pass 1 second after the current pass finishes (chained `setTimeout`), not with `setInterval`.

---

## Changes to already-implemented code (do these as part of the sub-stages below)

| #   | File                                                     | Change                                                                                                                                              | Where specified |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | `src/db/init.sql`                                        | New `outbox_status_enum` and `credit_allocation_outbox` table                                                                                       | Stage 14a       |
| 2   | `.env.example`, `.env`, `.env.test`, `src/config.ts`     | Add `CREDIT_SERVICE_URL`                                                                                                                            | Stage 14a       |
| 3   | `src/services/auth.service.ts` (`verifyRegistrationOtp`) | Insert the outbox row after `activateUser` succeeds, same `client`. Replace the `// TODO(credit-service): emit user-registered event here` comment. | Stage 14d       |
| 4   | Super admin bootstrap                                    | Run `createSuperAdmin` and the outbox insert in one `withTransaction`; insert the outbox row only if `createSuperAdmin` returned a row              | Stage 14d       |
| 5   | `src/server.ts`                                          | Start the relay after the bootstrap                                                                                                                 | Stage 14c       |
| 6   | `package.json`                                           | Add the `outbox:replay` script                                                                                                                      | Stage 14e       |

---

## Stage 14a: Schema + Config

### Update `src/db/init.sql`

Add, using the same safe-creation pattern as the existing enums:

```sql
DO $$ BEGIN
  CREATE TYPE outbox_status_enum AS ENUM ('pending', 'sent', 'dead');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS credit_allocation_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status outbox_status_enum NOT NULL DEFAULT 'pending',
  attempts SMALLINT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`init.sql` only runs on a fresh volume. Remind me in your summary to reset with `docker compose down -v` (dev data only), and that the test database is rebuilt from `init.sql` by `globalSetup.ts`.

### Update `.env.example`, `.env`, `.env.test`

```env
# Credit service
CREDIT_SERVICE_URL=http://credit-service:3003
```

In `.env.test` use `http://localhost:3003` (no test calls it yet).

### Update `src/config.ts`

- Add `CREDIT_SERVICE_URL` to the Zod schema as a required URL string.
- Expose it as `config.creditService.url`.
- Strip a trailing slash if present, so `${url}/credits/allocate` is always well-formed.

### Verification

- `docker compose down -v && docker compose up --build` starts cleanly
- `\d credit_allocation_outbox` shows the table; `\dT+ outbox_status_enum` shows `pending`, `sent`, `dead`
- Remove `CREDIT_SERVICE_URL` from `.env` → the app exits with a clear error naming it (revert afterwards)

---

## Stage 14b: Outbox Queries

### Create `src/db/queries/creditOutbox.queries.ts`

All functions take `db: Queryable` as the last parameter (default `pool` where the function is not transaction-only).

- `insertCreditAllocation(userId, db)` — `INSERT INTO credit_allocation_outbox (user_id) VALUES ($1) RETURNING id`. Transaction-only: `db` is required.
- `findDueCreditAllocations(limit, db = pool)` — rows with `status = 'pending' AND next_attempt_at <= clock_timestamp()`, ordered by `next_attempt_at, created_at`, `LIMIT $1`. Plain read, no locking (see Claiming).
- `markCreditAllocationSent(id, db = pool)` — `SET status = 'sent', updated_at = NOW() WHERE id = $1 AND status = 'pending'`. Returns whether a row was updated.
- `markCreditAllocationDead(id, lastError, db = pool)` — `SET status = 'dead', attempts = attempts + 1, last_error = $2, updated_at = NOW() WHERE id = $1 AND status = 'pending'`. Returns whether a row was updated.
- `recordCreditAllocationFailure(id, lastError, { maxAttempts, baseDelaySeconds, maxDelaySeconds }, db = pool)` — one conditional `UPDATE ... WHERE id = $1 AND status = 'pending'` that:
  - sets `attempts = attempts + 1`, `last_error = $2`, `updated_at = NOW()`
  - sets `status = 'dead'` if `attempts + 1 >= maxAttempts`, else leaves it `'pending'`
  - when still pending, sets `next_attempt_at = clock_timestamp() + make_interval(secs => random() * LEAST(maxDelaySeconds, baseDelaySeconds * power(2, attempts)))`. In an `UPDATE`, `attempts` on the right-hand side is the **old** value (n − 1), which gives the 2^(n−1) cap from the Backoff section.

  Returns whether a row was updated. `maxAttempts`, `baseDelaySeconds` and `maxDelaySeconds` are passed as query parameters from the relay's constants, not hard-coded in the SQL.

- `replayDeadCreditAllocations(ids: string[] | null, db = pool)` — `SET status = 'pending', attempts = 0, next_attempt_at = NOW(), updated_at = NOW() WHERE status = 'dead'` and, when `ids` is not null, `AND id = ANY($1)`. Leave `last_error` unchanged. `RETURNING id`.

Every state change is a conditional `UPDATE ... WHERE status = '<expected>'` (convention 3), so a relay can never move a row out of `sent` or `dead`.

### Verification

- Covered through 14c–14e.

---

## Stage 14c: The Relay

### Create `src/services/creditOutbox.relay.ts`

Constants at the top of the file:

```ts
const POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 5;
const REQUEST_TIMEOUT_MS = 3000;
const MAX_ATTEMPTS = 10;
const BASE_DELAY_SECONDS = 1;
const MAX_DELAY_SECONDS = 300;
```

**`classifyResponseStatus(status: number)`** — pure function, no I/O. Returns `'sent' | 'dead' | 'retry'` per the Outcome → action table. Keep it separate so it can be unit-tested later.

**`deliverCreditAllocation(userId)`**:

- Sends the request:

  ```ts
  fetch(`${config.creditService.url}/credits/allocate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  ```

- Returns `{ action: 'sent' | 'dead' | 'retry', error?: string }`, where `error` follows the `last_error` format
- A timeout → `retry`, `TIMEOUT`. Any other thrown network error → `retry`, `NETWORK <code>` (use the error's `cause.code` if present, else `UNKNOWN`)
- Read the response body only to extract `code` for `last_error`. If the body isn't JSON, ignore it. Never store or log the body.

**One pass**: follows "Delivery within a pass" (groups of `BATCH_SIZE`, sent concurrently, repeated until no row is due). For each result in a group:

- `sent` → `markCreditAllocationSent`; `dead` → `markCreditAllocationDead`; `retry` → `recordCreditAllocationFailure` (passing `MAX_ATTEMPTS`, `BASE_DELAY_SECONDS`, `MAX_DELAY_SECONDS`)
- A `false` return from any of these (row no longer pending, e.g. another relay already handled it) is not an error. Skip it.

**`startCreditOutboxRelay(): { stop(): Promise<void> }`**:

- Runs a pass, then schedules the next one `POLL_INTERVAL_MS` after the pass finishes
- If a pass throws (e.g. `user-db` unreachable), `console.error` a single line with the error message (no user data, no response bodies) and continue with the next scheduled pass. The relay must never crash the process.
- `stop()` cancels the next scheduled pass and resolves once any in-flight pass finishes

### Update `src/server.ts`

- After the super admin bootstrap completes, call `startCreditOutboxRelay()`.
- If `server.ts` already handles shutdown signals, call `stop()` there. If it doesn't, do not add signal handling in this stage; tell me instead.
- `app.ts` must not import or start the relay.

### Verification

- With credit-service running: a pending row becomes `sent` within about a second, and credit-service shows a balance for that user
- With credit-service stopped (`docker compose stop credit-service`): the row stays `pending`, `attempts` goes up over time, `last_error` shows a `NETWORK ...` error, and `next_attempt_at` moves further out roughly as described in Backoff. Start credit-service again → the row becomes `sent` at its next due attempt
- Backdate `next_attempt_at` between attempts to speed it up: after the 10th failed attempt the row is `dead`, and the relay stops picking it up
- Insert more than 5 due rows at once (e.g. several pending rows via SQL for existing users) → they are delivered in groups of at most 5 within a single pass, with no 1-second gap between groups
- Set `CREDIT_SERVICE_URL=http://credit-service:3003/nonexistent` → credit-service returns `404` → the row goes straight to `dead` with `attempts = 1` and `last_error` starting `HTTP 404` (revert afterwards)
- Manually set a `sent` row back to `pending` → the relay delivers it again, credit-service returns `409`, the row becomes `sent`, and the user's balance is unchanged
- While credit-service is down, the rest of user-service (login, register, etc.) responds normally
- Stop `user-db` while user-service is running → one `console.error` line per failed pass, no crash; restart `user-db` → the relay resumes on its own

---

## Stage 14d: Wire Into Activation and Bootstrap

### Update `verifyRegistrationOtp` in `src/services/auth.service.ts`

- In the existing `withTransaction`, immediately after `activateUser(user.id, client)` returns `true`, call `insertCreditAllocation(user.id, client)`.
- Remove the `// TODO(credit-service): emit user-registered event here` comment.
- Nothing else in the function changes. In particular, the response does not wait for credit-service: verification succeeds even if credit-service is down.

### Update the super admin bootstrap

- Wrap `createSuperAdmin` and the outbox insert in one `withTransaction`, passing `client` to both.
- Insert the outbox row only if `createSuperAdmin` returned a row (the insert was not skipped by `ON CONFLICT DO NOTHING`).
- The existing "insert was skipped → re-check whether a super admin exists" logic is unchanged.
- An already-existing super admin gets no outbox row (no backfill).

### Verification

- Register → verify OTP → `200 REGISTER_SUCCESS`; one `credit_allocation_outbox` row for that user, created in the same transaction; it becomes `sent` and credit-service shows a 20-credit balance
- A failing verify (wrong OTP, expired OTP, attempts exceeded) creates no outbox row
- Two concurrent correct `verify-otp` requests → exactly one outbox row (only one activation succeeds)
- `docker compose down -v && docker compose up --build` → exactly one outbox row for the super admin, which becomes `sent`
- Restart the containers without `-v` → no new outbox row for the super admin
- With credit-service stopped, registration verification still returns `200 REGISTER_SUCCESS`

---

## Stage 14e: Replay Script

### Create `src/scripts/replayCreditOutbox.ts`

Usage:

```bash
npm run outbox:replay -- <outbox-id> [<outbox-id> ...]
npm run outbox:replay -- --all-dead
```

- No arguments, or an argument that is neither `--all-dead` nor a UUID → print usage and exit `1`
- Calls `replayDeadCreditAllocations` (with the IDs, or `null` for `--all-dead`)
- Prints the IDs that were reset. For explicit IDs, also prints the ones that were not reset (not found, or not `dead`). Only `dead` rows are ever reset.
- Ends the pool before exiting; exit `0` on success

### Update `package.json`

```json
"outbox:replay": "tsx src/scripts/replayCreditOutbox.ts"
```

Run it in dev with `docker exec -it foc-user-service npm run outbox:replay -- --all-dead`.

### Verification

- A `dead` row replayed by ID → `status = 'pending'`, `attempts = 0`, `last_error` unchanged; the relay then delivers it
- `--all-dead` resets every `dead` row and nothing else
- Replaying the ID of a `sent` or `pending` row → reported as not reset, row unchanged
- No arguments or an invalid ID → usage message, exit code `1`

---

### Tests

Deferred to the end-of-project test stage. Do not write tests in this stage.

# Stage 15: User Service Changes for Frontend Integration

> **Scope**: Backend changes the frontend needs. They are made before any frontend work:
>
> - `GET /users/me` also returns `activeView`
> - `GET /users` becomes paginated, searchable, filterable and sortable
> - every user-service JSON response uses camelCase keys
>
> DB columns stay snake_case.
>
> Backlog refs: F4.1.1, F5.2.2, F5.3.1.
>
> **Before starting:** if any `[DECIDE]` placeholder remains anywhere in Stages 15–16, stop and ask me. Do not pick a value yourself.

### Design decisions (already made, do not change)

| Rule                        | Value                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Response key convention     | camelCase for every JSON response from user-service. DB columns stay snake_case. Mapping happens in the service layer, in one place.                   |
| Consumers of user responses | The frontend is the only consumer. No other service reads user-service response bodies, so this is not a breaking change for other services.           |
| `GET /users/me`             | Returns `{ username, email, activeView }`                                                                                                              |
| `GET /users` change         | Changed in place (no new endpoint). The old bare `{ users: [...] }` shape is replaced.                                                                 |
| Pagination                  | Offset-based, `page` is 1-based, page size fixed at 50 (a constant, not a query param). A page past the end returns `200` with an empty `users` array. |
| Total count                 | Returned, so the frontend can show the total number of pages                                                                                           |
| Search                      | Two separate params: `username` (substring match) and `email` (exact match). Combined with AND.                                                        |
| Filters                     | `status` and `role`, each optional, combined with search using AND                                                                                     |
| Sort                        | `sortBy` one of `username`, `email`, `createdAt`; `sortDir` one of `asc`, `desc`. Not sortable by status or role. Default: `createdAt` `desc`.         |
| Query param names           | `page`, `username`, `email`, `status`, `role`, `sortBy`, `sortDir`                                                                                     |
| Pending users               | Still included (Stage 9 rule unchanged); `status` filter can isolate them                                                                              |

---

## Changes to already-implemented code

| #   | File                                                                   | Change                                                                                                                                | Where specified |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | `src/services/me.service.ts` (`getOwnProfile`)                         | Also return `activeView`                                                                                                              | Stage 15a       |
| 2   | `src/db/queries/users.queries.ts` (`listAllUsers`)                     | Replaced by a paginated, filtered query plus a count                                                                                  | Stage 15b       |
| 3   | `src/services/users.service.ts`, `src/controllers/users.controller.ts` | `listUsers` takes the query params and returns the paginated shape                                                                    | Stage 15b       |
| 4   | Every service function that returns a user row                         | Return the camelCase response shape via one shared mapper instead of a `password_hash`-stripped DB row                                | Stage 15c       |
| 5   | Existing tests                                                         | Update assertions that expect snake_case keys or the old `GET /users` shape. These are fixture/assertion updates, not new test cases. | Stage 15c       |

---

## Stage 15a: `activeView` on `GET /users/me`

### Update `src/services/me.service.ts`

`getOwnProfile(userId)` returns `{ username, email, activeView }`, where `activeView` comes from `user.active_view`. Nothing else changes.

### Verification

- `GET /users/me` → `200`, `{ username, email, activeView }`, no other fields
- After `PUT /users/me/active-view {activeView: 'courier'}`, `GET /users/me` returns `activeView: 'courier'`

---

## Stage 15b: Paginated `GET /users`

### Update `src/db/queries/users.queries.ts`

Replace `listAllUsers` with `listUsersPage({ usernameContains, email, status, role, sortBy, sortDir, limit, offset }, db = pool)`:

- Returns `{ rows, total }`. `total` counts **every** row matching the filters, ignoring `limit`/`offset`. Use the same `WHERE` clause for the count as for the rows: either a separate `COUNT(*)` query or `COUNT(*) OVER()`. If you use the window form, an empty page (past the end) still needs a correct `total`, so run a separate count when no rows come back.
- `usernameContains`: `username LIKE '%' || $n || '%' ESCAPE '\'`, with `\`, `%` and `_` in the input escaped first, so user input is matched literally. Usernames are stored lowercase, and the controller lowercases the input.
- `email`: exact `email = $n`
- `status`, `role`: exact match
- All values are bound parameters. `sortBy` and `sortDir` are **never** interpolated from input: map them through a fixed whitelist (`username` → `username`, `email` → `email`, `createdAt` → `created_at`; `asc`/`desc` → `ASC`/`DESC`).
- Order by the chosen column, then `id` (same direction) as a tie-breaker
- `LIMIT $limit OFFSET $offset`

### Update `src/services/users.service.ts`

`listUsers({ page, username, email, status, role, sortBy, sortDir })`:

- `PAGE_SIZE = 50` constant at the top of the file
- `offset = (page - 1) * PAGE_SIZE`
- Calls `listUsersPage`, maps each row with the Stage 15c mapper
- Returns `{ users, page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) }`

### Update `src/controllers/users.controller.ts` (`list`)

Validate `req.query` with Zod (`.strict()`, so an unknown param → `"Request contains unexpected fields"` via the global handler), messages in the existing style:

- `page`: optional, default `1`, coerced to an integer ≥ 1 → `"Page must be a positive integer"`
- `username`: optional string, lowercased (not trimmed, consistent with `usernameField`); empty string treated as absent → type error `"Username must be a string"`
- `email`: optional string, trimmed and lowercased (same normalisation as `emailField`, but optional); empty string treated as absent → type error `"Email must be a string"`
- `status`: optional, one of `pending`, `active`, `suspended` → `"Status must be 'pending', 'active' or 'suspended'"`
- `role`: optional, one of `user`, `admin`, `super admin` → `"Role must be 'user', 'admin' or 'super admin'"`
- `sortBy`: optional, one of `username`, `email`, `createdAt` → `"sortBy must be 'username', 'email' or 'createdAt'"`
- `sortDir`: optional, one of `asc`, `desc` → `"sortDir must be 'asc' or 'desc'"`. When absent: `desc` if `sortBy` is absent or `createdAt`, otherwise `asc`.
- A repeated param (Express turns `?status=a&status=b` into an array) fails the string type check → `400 VALIDATION_ERROR`

Return `200` with the service result.

### Verification

- `GET /users` (no params) → `200`, `{ users, page: 1, pageSize: 50, total, totalPages }`, sorted by `createdAt` desc
- With more than 50 users: `page=2` returns the next rows with no overlap or gap versus `page=1`
- `page` past the last page → `200`, `users: []`, `total` still correct
- `page=0`, `page=-1`, `page=abc`, `page=1.5` → `400 VALIDATION_ERROR`, `"Page must be a positive integer"`
- `username=ali` matches `alice` and `malik`; `username=%` matches only usernames that literally contain `%` (none, given the username format rule)
- `email=Alice@Example.com` matches `alice@example.com` exactly; `email=alice` matches nothing
- `username` + `email` + `status` + `role` combined → only rows matching all of them
- `status=pending` returns pending users
- `role=super admin` (URL-encoded) returns the super admin
- `sortBy=username&sortDir=asc` → alphabetical; `sortBy=status` → `400 VALIDATION_ERROR`
- Unknown param (e.g. `?foo=1`) → `400 VALIDATION_ERROR`, `"Request contains unexpected fields"`
- Regular user → `403 FORBIDDEN`; no token → `401 UNAUTHORIZED` (unchanged)
- No `password_hash` (or `passwordHash`) on any entry

---

## Stage 15c: camelCase Responses

### Create `src/services/userResponse.ts`

`toUserResponse(row)` returns `{ id, username, email, status, role, activeView, createdAt, updatedAt }` from a DB user row. It must never include the password hash. Every service function that currently returns a user row with `password_hash` stripped uses this mapper instead (at least `listUsers`, `getUserById`, `changeUserStatus`, `changeUserRole`, `changeActiveView`, including their no-op return paths).

### Sweep the rest of the service

Search every controller and service for any other response body with a snake_case key and convert it. Leave these alone:

- the JWKS response (its keys are fixed by RFC 7517)
- JWT claims (`sub`, `role`)
- error bodies (already `{ message, code }`)

List every response you changed in your summary.

### Update existing tests

Update assertions that expect snake_case keys (e.g. `active_view`, `created_at`) or the old `GET /users` shape. Do not add new test cases. If an existing test now fails for a reason other than key naming or the response shape, stop and report it instead of changing it.

### Verification

- `GET /users/:id`, `PUT /users/:id/status`, `PUT /users/:id/role`, `PUT /users/me/active-view` all return `{ id, username, email, status, role, activeView, createdAt, updatedAt }`
- The no-op paths of status and role changes return the same shape
- `POST /auth/login`'s `user` object is unchanged (`{ id, username, email, role, activeView }`)
- The full existing test suite passes after the assertion updates

---

# Stage 16: Frontend — User Service Integration

> **Scope**: Wire `frontend/` to user-service:
>
> - shared auth plumbing
> - login, registration (with OTP) and forgot password as pages
> - the `/account` page
> - the requester/courier toggle
> - admin user management
>
> Backlog refs: F1, F2, F3, F4, F5.1, F5.2.2, F5.3.1, F5.3.3.
>
> **Ground rules for every sub-stage:**
>
> - Work in `frontend/` only. Never touch `foc-mockup/`.
> - Read the current code before changing it. Where it disagrees with this file, follow the code and tell me.
> - Do not modify `src/realtime/orderSocket.js`, `src/data/users.js`, `src/components/DemoControls.jsx` or `AI-NOTES.md`. If you think one of them needs a change, stop and tell me why.
> - Do not change other teammates' pages except where a sub-stage says to (e.g. reading auth state). List every file outside user-service screens you touched.
> - React 18, JSX (no TypeScript), react-router-dom, Context API, Tailwind, lucide-react, native `fetch` through `src/api/http.js`. Do not add React Query, Redux, axios or a form library.
> - No tests in this stage (see the end of this file).

### Design decisions (already made, do not change)

| Rule                              | Value                                                                                                                                                                                                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend access                    | Relative same-origin paths through the existing Vite dev proxy (`/auth`, `/users` → user-service). No `VITE_*` URL in the browser bundle.                                                                                                                                                    |
| Access token                      | In memory only (never `localStorage`/`sessionStorage`). Attached as `Bearer` to every backend call, including supplier, order and credit.                                                                                                                                                    |
| Refresh                           | Both: refresh-on-401-and-retry (exists in `http.js`) and proactive refresh before expiry. Concurrent callers share one in-flight refresh (exists in `http.js`).                                                                                                                              |
| Auth state                        | A new `src/context/AuthContext.jsx`, separate from `DemoContext`                                                                                                                                                                                                                             |
| API modules                       | `src/api/auth.js` (auth/OTP/reset), new `src/api/profile.js` (`/users/me/*`), new `src/api/users.js` (admin `/users*`)                                                                                                                                                                       |
| Session restore                   | On load: `POST /auth/refresh`, decode the JWT for `id` and `role`, `GET /users/me` for `username`, `email`, `activeView`                                                                                                                                                                     |
| Pages, not modals                 | Login, registration, forgot password are pages. `LoginModal` is replaced.                                                                                                                                                                                                                    |
| Paths                             | `/login`, `/register` (one page: form step → OTP step), `/forgot-password` (one page: email → OTP → new password), `/account`, `/admin/users`. No frontend path may start with `/auth`, `/users`, `/credits`, `/orders`, `/api/v1` or `/socket.io` (the dev proxy would catch it on reload). |
| Landing after login               | The page the user was sent away from, else home. Same for every role.                                                                                                                                                                                                                        |
| Not logged in on a protected page | Redirect to `/login`, remembering the page                                                                                                                                                                                                                                                   |
| Wrong role                        | Admin links hidden from non-admins. Opening an admin URL anyway shows a 403 "Not authorised" view **in place** (URL unchanged).                                                                                                                                                              |
| Logout                            | Clear all client auth state even if `POST /auth/logout` fails, then go to `/login`                                                                                                                                                                                                           |
| Refresh failure                   | Same as logout (clear, go to `/login`)                                                                                                                                                                                                                                                       |
| Client validation                 | Mirror backend format rules (username, email, password complexity, 6-digit OTP) for instant feedback; the backend still enforces them                                                                                                                                                        |
| Error display                     | Inline under the field for field-specific errors; banner at the top of the form for whole-form errors (e.g. invalid credentials, account suspended); toast for background errors (e.g. failed view toggle)                                                                                   |
| Error text                        | The frontend maps backend `code` → its own text from one central map, with consistent phrasing. Backend `message` is not shown verbatim.                                                                                                                                                     |
| OTP input                         | 6 boxes, digits only, auto-advance, backspace moves back, pasting a 6-digit code fills all boxes, auto-submits when all 6 are filled. On a wrong code: clear and refocus the first box.                                                                                                      |
| Resend                            | During cooldown: disable resend with a countdown from `Retry-After`. On `OTP_RESEND_LIMIT`: disable resend, show the limit text, no countdown.                                                                                                                                               |
| Unverified login                  | `ACCOUNT_NOT_VERIFIED` from login → go to `/register` at the OTP step (see 16c)                                                                                                                                                                                                              |
| Register `409`                    | Show the taken error plus a hint: "Already signed up? Log in to finish verifying" linking to `/login`                                                                                                                                                                                        |
| Forgot password OTP               | Checked with `verify-otp` (`forgot_password`) before the new-password step is shown                                                                                                                                                                                                          |
| `/account`                        | Sections for profile view, change username, change email, change password                                                                                                                                                                                                                    |
| Active-view toggle                | Optimistic: update UI immediately, call `PUT /users/me/active-view`, revert and toast on failure                                                                                                                                                                                             |
| Admin row actions                 | A three-dot menu on each row, shown on hover: promote/demote and suspend/unsuspend. Each action asks for confirmation first. Promote/demote hidden from plain admins.                                                                                                                        |

### AI logging

Same as earlier stages: header comment on every file created **or modified**, and a usage-log entry per sub-stage in the existing format. JSX/JS files use `//` comments at the top of the file.

---

## Stage 16a: Read and Report (no code changes)

Read `frontend/` before writing anything. Read `AI-NOTES.md` for context but do not edit it. Then report the following and **stop and wait for my answers**:

1. **Admin supplier pages**: their route paths in `App.jsx`, and how a user reaches them (nav link, landing-page link, typed URL only). I will tell you where the Admin link goes and how it reaches `/admin/users`.
2. **`DemoContext` session consumers**: every file that reads session or auth state (`session`, `role`, `isAdmin`, login/logout functions, the local `role` `useState('requester')`) from `DemoContext`, and what each one reads. I will tell you how those consumers move to `AuthContext`.
3. **`http.js`**: confirm how the in-memory token, shared in-flight refresh and 401-retry work today, and where a proactive refresh and a "refresh failed → logged out" hook would attach.
4. **`LoginModal.jsx`**: every place that opens it.
5. **Home**: which route is home.
6. **Routes**: any existing frontend route that starts with a proxied prefix (`/auth`, `/users`, `/credits`, `/orders`, `/api/v1`, `/socket.io`).
7. **Toasts/banners**: any existing toast, banner or notice component (e.g. `ApiNotice.jsx`) that should be reused instead of building a new one.

---

## Stage 16b: Shared Auth Plumbing

### `src/context/AuthContext.jsx`

- Holds `user` (`{ id, role, username, email, activeView }`) and a status (`loading` | `authenticated` | `anonymous`)
- On mount: session restore (see decisions table). While restoring, protected routes render nothing (or a spinner), not a redirect.
- Exposes `login(identifier, password)`, `logout()`, `setActiveView(...)`, and a way for other sub-stages to update `username`/`email` after a profile change
- Consumers move off `DemoContext` exactly as I specified in my answer to 16a item 2

### `src/api/http.js`

- **Proactive refresh**: after each new access token, schedule a refresh 60 seconds before its `exp` (read from the decoded token). Reuse the existing shared in-flight refresh. Cancel the timer on logout.
- **Refresh failure** (proactive or after a 401): notify `AuthContext`, which clears state and goes to `/login`, remembering the current page
- Keep the existing in-flight GET de-duplication and 401-retry unchanged

### Route guards (in or next to `App.jsx`)

- `RequireAuth`: anonymous → `<Navigate to="/login" state={{ from: location }} replace />`
- `RequireRole minimum="admin"`: same rank order as the backend (`user` < `admin` < `super admin`); below it → render `<Forbidden />` in place

### Components

- `src/components/Forbidden.jsx`: "Not authorised" view with a link home
- `src/components/Toast.jsx` + a small toast provider (or reuse what 16a item 7 found)
- `src/components/FormBanner.jsx`: whole-form error/success banner
- `src/components/FieldError.jsx`: inline field error
- `src/components/OtpInput.jsx`: the 6-box input from the decisions table. Props: `onComplete(code)`, `disabled`, and a way for the parent to clear and refocus it after a wrong code.
- `src/components/ResendButton.jsx`: handles the cooldown countdown (`Retry-After`) and the limit state
- `src/utils/validation.js`: client-side mirrors of the backend rules (same regexes/limits as `auth.service.ts`)
- `src/api/errorMessages.js`: one map from backend `code` → frontend text, plus which display type (field / banner / toast) each code uses by default. Cover every code user-service can return to the frontend. Put the full map in your summary so I can review the phrasing.

### `/login` page

- `src/pages/Login.jsx`: identifier + password, links to `/register` and `/forgot-password`
- Success → `state.from` or home
- `INVALID_CREDENTIALS`, `ACCOUNT_SUSPENDED` → banner
- `ACCOUNT_NOT_VERIFIED`:
  ```js
  if (err.code === "ACCOUNT_NOT_VERIFIED") {
    navigate("/register", {
      state: {
        step: "otp",
        email: identifier.includes("@") ? identifier : null,
      },
    });
    return;
  }
  ```
- Shows a success banner when arriving with one in router state (from 16c/16d)
- Replace every place that opened `LoginModal` with navigation to `/login`. Delete `LoginModal.jsx` once nothing uses it.

### Logout

The TopNav logout button calls `AuthContext.logout()`: call `POST /auth/logout`, then clear state and go to `/login` whether or not the call succeeded. Do not redirect to a "from" page after an explicit logout.

### Verification

- Reload while logged in → still logged in; `username`, `email`, `role`, `activeView` populated
- No access token in `localStorage`/`sessionStorage` (check DevTools)
- Wait (or shorten the TTL in dev) → a proactive refresh happens before expiry, no 401 seen by pages
- Revoke the refresh token in the DB → the next refresh fails → `/login`
- Open `/account` logged out → `/login` → log in → back on `/account`
- Regular user opens `/admin/users` → 403 view, URL unchanged, no Admin link in nav
- Logout with user-service stopped → still lands on `/login` with state cleared
- Login with a pending account via email → `/register` OTP step with email filled; via username → OTP step with an email field
- Supplier/order/credit calls still carry the `Bearer` token

---

## Stage 16c: Registration (`/register`)

`src/pages/Register.jsx`, one page with two steps. Starts at the step given in `location.state.step`, default `form`.

**Form step**:

- `username`, `email`, `password` with client validation → `POST /auth/register`
- On `201` → OTP step, carrying the email
- `USERNAME_TAKEN` / `EMAIL_TAKEN` → inline on that field, plus the "Already signed up? Log in to finish verifying" hint linking to `/login`

**OTP step**:

- If no email was carried in (arrived from login with a username), show an email field above the boxes. Resend and verify are disabled until it's filled.
- When arrived from login (`state.step === 'otp'`): show a clear **"Send a new code"** button at the top, since the original code has probably expired. Do not send automatically.
- `OtpInput` → `POST /auth/verify-otp` (`purpose: 'registration'`)
- `ResendButton` → `POST /auth/resend-otp` (`purpose: 'registration'`)
- Success → `/login` with a success banner
- `INVALID_OTP` → clear boxes, inline error
- `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED` → error pointing at resend
- `NO_PENDING_REGISTRATION` on resend → banner

### Verification

- Full happy path: register → OTP (dev console) → login works
- Wrong code → boxes clear, attempts persist (DB)
- Pasting a 6-digit code fills and submits
- Non-digits can't be typed
- Resend immediately → countdown from `Retry-After`; 6th resend → limit text, no countdown
- Register again with the same username within 10 minutes → `USERNAME_TAKEN` inline + hint
- Abandon at OTP, later log in with correct credentials → lands on the OTP step; "Send a new code" → new code works
- Same via username → email field shown, works once filled

---

## Stage 16d: Forgot Password (`/forgot-password`)

`src/pages/ForgotPassword.jsx`, one page, three steps. The email and verified OTP are kept in component state only; a reload restarts at the email step.

1. **Email** → `POST /auth/forgot-password`
   - `EMAIL_NOT_FOUND` → inline
   - `ACCOUNT_NOT_VERIFIED` → banner
   - Cooldown/limit → resend-style messaging
2. **OTP** → `OtpInput` → `POST /auth/verify-otp` (`purpose: 'forgot_password'`, non-consuming)
   - Success → step 3
   - Resend via `POST /auth/resend-otp` (`purpose: 'forgot_password'`). Limit text says "about an hour".
3. **New password** (client complexity check) → `POST /auth/reset-password` with email, OTP, new password
   - Success → `/login` with a success banner
   - `INVALID_OTP` / `OTP_EXPIRED` / `OTP_ATTEMPTS_EXCEEDED` here (e.g. the code expired between steps) → back to step 2 with the error

### Verification

- Happy path end to end; old password then fails at login
- Wrong code at step 2 never shows step 3
- Expire the OTP in the DB while on step 3 → submit → back at step 2 with the expiry error
- Reload mid-flow → back at step 1

---

## Stage 16e: Account Page (`/account`)

`src/pages/Account.jsx` behind `RequireAuth`, linked from the nav. Calls go through `src/api/profile.js`.

- **Profile**: `username`, `email` from `AuthContext` (`GET /users/me` already loaded)
- **Change username**: `PUT /users/me/username`
  - `USERNAME_UNCHANGED` / `USERNAME_TAKEN` → inline
  - Success → update `AuthContext`, success banner in the section
- **Change email**: current password + new email → `PUT /users/me/email` → OTP shown inline in the same section → `POST /users/me/verify-otp` (`change_email`)
  - Resend: `POST /users/me/resend-otp` (`change_email`)
  - `INVALID_PASSWORD` → inline on current password
  - `EMAIL_UNCHANGED` / `EMAIL_TAKEN` → inline on new email
  - Success → update `AuthContext`
- **Change password**: current + new password → `PUT /users/me/password` → OTP inline → `POST /users/me/confirm-password-change` with the OTP and the **same** new password, kept in component state from the first step so the user doesn't retype it
  - Resend: `POST /users/me/resend-otp` (`change_password`)
  - `PASSWORD_UNCHANGED` → inline
- **After a successful password change**: the backend revokes **all** of the user's refresh tokens, including this browser's. Decided: immediate forced re-login. Right after the success response, clear all client auth state (same as `AuthContext.logout()`'s state-clearing, but skip the `POST /auth/logout` call since the refresh token is already revoked) and redirect to `/login` with a banner telling the user to sign in again with their new password. Do not wait for the next proactive refresh to catch this.

### Verification

- Each section's happy path; the nav and profile show new values without a reload
- Each inline error above
- OTP cooldown and limit behave as in 16c
- Password change → immediately redirected to `/login` with the "sign in again" banner, not left on `/account` until the next refresh fails

---

## Stage 16f: Requester/Courier Toggle

- The toggle reads `AuthContext.user.activeView`
- On change: update immediately, call `PUT /users/me/active-view`. On failure, revert and show a toast.
- Anything that previously read the local `role` state in `DemoContext` reads `activeView` from `AuthContext`, as specified in my 16a answer
- Gabriel will adjust `TopNav.jsx` layout if needed; keep TopNav changes minimal and list them

### Verification

- Toggle → UI changes instantly; the DB column updates
- Reload → the same view persists
- Stop user-service, toggle → UI reverts, toast shown
- Log in on another browser → same view

---

## Stage 16g: Admin User Management (`/admin/users`)

`src/pages/AdminUsers.jsx` behind `RequireAuth` + `RequireRole minimum="admin"`. Reached as I specified in my 16a answer. Calls go through `src/api/users.js`.

- **Table columns**: username, email, status, role, created (date)
- **Search**: two boxes, username (substring) and email (exact), 300 ms debounce, AND-combined. Empty boxes are omitted from the query.
- **Filters**: status (pending/active/suspended/any), role (user/admin/super admin/any)
- **Sort**: click the username, email or created header to sort; click again to flip direction. Status and role headers are not sortable. Default: created, newest first.
- **Pagination**: 50 per page, prev/next plus "Page X of Y" from `totalPages`. Changing search, filter or sort resets to page 1.
- **Row actions**: a three-dot menu, visible on row hover; always visible on touch / small screens. It shows only the actions the backend would allow:

| Caller      | Target row                  | Suspend / Unsuspend    | Promote / Demote                 |
| ----------- | --------------------------- | ---------------------- | -------------------------------- |
| admin       | user (active/suspended)     | shown                  | hidden                           |
| admin       | admin, super admin, own row | hidden                 | hidden                           |
| super admin | user or admin (active)      | shown                  | Promote if user, Demote if admin |
| super admin | user or admin (suspended)   | shown                  | hidden (backend `422`)           |
| any         | pending row                 | hidden (backend `422`) | hidden (backend `422`)           |
| any         | super admin row, own row    | no menu                | no menu                          |

If a row has no allowed actions, show no menu.

- **Confirmation**: each action opens a confirmation dialog naming the user and the action
- **Action results**: success → update the row from the response, success toast. Error (including a stale-state `403`/`422` from a race) → toast, then refetch the current page.

### Verification

- Admin and super admin each see exactly the actions in the table above
- Plain user → 403 view
- Search, filters and sort each change the request params and results; combinations AND together
- Page past the end (e.g. after a filter shrinks results) shows an empty state, and "Page X of Y" stays correct
- Suspend → the row shows suspended; that user's next refresh fails (logged out)
- Promote → the row shows admin
- Menu works on a phone-width viewport with no hover

---

## After Stage 16

### Deviations

List every place where you deviated from this file and why.

### Reminder: tests still owed

Tests have not been written for:

- Stage 14 (outbox, relay, replay script)
- Stage 15 (paginated `GET /users`, camelCase responses, `activeView` on `/users/me`)
- Stage 16 (frontend)

Also check every other stage for gaps against its Verification list. Write these in the end-of-project test stage, following the Stage 7 ground rules.

### Kept in view (not in this stage)

- **NFR4** (session inactivity timeout, 7-day limit, expiry warning). Design notes so far:
  - server-side enforcement
  - activity = scroll, touch and API calls, shared across tabs via BroadcastChannel
  - 1-minute warning configured in the frontend, 30-minute timeout in the backend
  - user-service never sees other services' API calls, so the frontend must report activity to it (endpoint and reporting rate still undecided)
- **F5.3.2**: an admin user-detail page with a user's credit transactions and their orders. Needs a credit-service endpoint, and order data.
- **NFR3** masking: emails are shown unmasked in the admin list for now.
- **`orderSocket.js`**: may need to disconnect on logout and use refreshed tokens. Flag it to the order-service owner if so.
