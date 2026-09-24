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
    "start": "node src/app.ts",
    "dev": "nodemon -L src/app.ts",
    "test": "vitest",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "dependencies": {
    "bcrypt": "^5.x",
    "express": "^4.18.x",
    "jsonwebtoken": "^9.x",
    "nodemailer": "^6.x",
    "pg": "^8.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "eslint": "^9.x",
    "nodemon": "^3.x",
    "prettier": "^3.x",
    "vitest": "^1.x",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0"
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

Use .strict() to reject requests containing fields not defined in the schema above. The resulting unrecognized_keys error is handled by the global error handler set up in Stage 4a (message: "Request contains unexpected fields") — no additional handling needed in this controller.

- Call `authService.register()`
- Return `201` with `{ message: 'User registered successfully', code: 'REGISTER_SUCCESS' }`

#### Wire up route

Add to `auth.routes.ts`:

```ts
router.post("/register", authController.register);
```

#### Verification

- `POST /auth/register` with valid body → 201, user appears in DB with hashed password
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

- `createRefreshToken({ userId, tokenHash, expiresAt, userAgent, ipAddress })` — inserts into `refresh_tokens` table
- `findRefreshToken(tokenHash)` — returns token row or null
- `revokeRefreshToken(tokenHash)` — sets `is_revoked = true`, `revoked_at = now`

#### Update `src/services/auth.service.ts`

Implement `login({ identifier, password }, userAgent, ipAddress)`:

- Look up user by username or email using `identifier`
- Reject if not found → throw `401` with `{ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }`
- Reject if password doesn't match bcrypt hash → throw `401` with same error
- Reject if `status = 'suspended'` → throw `403` with `{ message: 'Account suspended', code: 'ACCOUNT_SUSPENDED' }`
- Issue RS256 access token (15 min TTL) with claims `{ sub: user.id, role: user.role }` using private key from `config.ts`
- Generate refresh token: 32 cryptographically random bytes (hex string) using Node's built-in `crypto`
- Store SHA-256 hash of refresh token in `refresh_tokens` table with `expires_at = now + 7 days`
- Return `{ accessToken, refreshToken, user: { id, username, email, role } }`

#### Update `src/controllers/auth.controller.ts`

Implement `login` handler - accepts both username / email AND password

Validate request body with Zod (use custom messages instead of Zod's own defaults) — check only presence, type, and extra fields; all format/complexity rules stay in the service layer:

- identifier: required error "Username/Email is required", type error "Username/Email must be a string"
- password: required error "Password is required", type error "Password must be a string"

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
- Look up in `refresh_tokens` table
- If not found or already revoked → throw `401` with `{ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' }`
- Set `is_revoked = true`, `revoked_at = now`

Implement `refresh(refreshToken)`:

- Hash refresh token with SHA-256
- Look up in `refresh_tokens` table
- Reject if not found, revoked, or expired → throw `401` with `{ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' }`
- After finding a valid (non-revoked, non-expired) refresh token row, look up the associated user via userQueries.findById(userId) . If the user's status is 'suspended', throw AppError(403, 'Account suspended', 'ACCOUNT_SUSPENDED') instead of issuing a new token. Otherwise, issue the new access token using the freshly-loaded role (not any role cached elsewhere), so a role change (e.g. promotion) takes effect on the next refresh rather than only after re-login.
  Issue new RS256 access token (15 min TTL).
- Return `{ accessToken }`

#### Update `src/controllers/auth.controller.ts`

Implement `logout` handler (protected — requires `authenticate` middleware):

- Extract refresh token from `req.cookies.refreshToken`
- Call `authService.logout()`
- Clear the `refreshToken` cookie (with settings from `src/utils/cookies.ts`)
- Return `200` with `{ message: 'Logged out successfully', code: 'LOGOUT_SUCCESS' }`

Implement `refresh` handler:

- Extract refresh token from `req.cookies.refreshToken`
- Call `authService.refresh()`
- Return `200` with `{ accessToken }`

#### Wire up routes

Add to `auth.routes.ts`:

```ts
router.post("/logout", authenticate, authController.logout);
router.post("/refresh", authController.refresh);
```

#### Verification

- `POST /auth/logout` with valid access token → `200`, cookie cleared, token revoked in DB
- `POST /auth/logout` without access token → `401`
- `POST /auth/refresh` with valid cookie → `200`, new access token returned
- `POST /auth/refresh` after logout → `401`
- `POST /auth/refresh` with expired refresh token → `401`
- `POST /auth/logout` with a valid access token but a missing/garbage `refreshToken` cookie → `401 INVALID_REFRESH_TOKEN`
- `POST /auth/logout` with a valid access token but an already-revoked `refreshToken` cookie → `401 INVALID_REFRESH_TOKEN`
- Suspend the user in the DB directly (`UPDATE users SET status = 'suspended' WHERE ...`), then `POST /auth/refresh` with their still-valid, non-expired, non-revoked cookie → `403 ACCOUNT_SUSPENDED`, no new access token issued
- Promote the user in the DB directly (`UPDATE users SET role = 'admin' WHERE ...`), then `POST /auth/refresh` with a valid cookie → `200`, decode the new access token and confirm its `role` claim reflects `'admin'`, not the stale role from the original login
- `POST /auth/refresh` with a `refreshToken` cookie that never existed (random hex string, never issued) → `401 INVALID_REFRESH_TOKEN`

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
- `GET /auth/verify` with no `Authorization` header at all → `401 INVALID_TOKEN`
- `GET /auth/verify` with a well-formed but wrong-signature token (e.g. signed with a different key pair) → `401 INVALID_TOKEN`
- Take one valid access token, confirm it's accepted by both an `authenticate`-protected route (e.g. `/auth/logout`) and by `GET /auth/verify` — confirms both call sites agree, since they share `verifyAccessToken`

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
```

#### Update `src/config.ts`

- Add the three OTP vars to the Zod schema (coerce to numbers, positive integers) and expose them as `config.otp = { ttlMinutes, resendCooldownSeconds, maxResends }`
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
WHERE status = 'pending'
  AND (username = $1 OR email = $2)
  AND NOT EXISTS (
    SELECT 1 FROM users_otps o
    WHERE o.user_id = users.id AND o.expires_at > NOW()
  );
```

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

- `createOtp({ userId, otpHash, purpose, newEmail, expiresAt }, db)` — inserts into `users_otps`
- `invalidateActiveOtps(userId, purpose, db)` — `UPDATE users_otps SET consumed_at = NOW() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`
- `findLatestOtp(userId, purpose, db)` — most recent row by `created_at` (any state), or null
- `countOtps(userId, purpose, db)` — number of rows for that user and purpose (used for the resend limit)
- `incrementAttempts(otpId, db)` — `attempts_count = attempts_count + 1`, returns the new count
- `consumeOtp(otpId, db)` — `SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL`, returns whether a row was updated

#### Create `src/services/otp.service.ts`

This layer is purpose-agnostic and knows nothing about HTTP.

- `issueOtp({ userId, email, purpose, newEmail? }, db)`:
  1. `invalidateActiveOtps`
  2. `generateOtp()`, then `sha256` it
  3. `createOtp` with `expiresAt = now + config.otp.ttlMinutes`
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

If step 5 fails, the transaction rolls back and no pending user remains.

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

- email: required "Email is required", type "Email must be a string"
- otp: required "OTP is required", type "OTP must be a string"
- purpose: required "Purpose is required", type "Purpose must be a string", not in the allowed list → "Invalid purpose"

`POST /auth/resend-otp`:

- email and purpose as above (no `otp`)

Format rule stays in the service layer: `otp` must match `^\d{6}$`, else `AppError(400, 'OTP must be a 6-digit code', 'VALIDATION_ERROR')`.

#### `authService.verifyRegistrationOtp({ email, otp })`

Inside `withTransaction`:

1. Look up the user by email. If none, or `status !== 'pending'` → `INVALID_OTP` (same generic error, do not reveal which case)
2. `lockUserById(user.id)` (serialises concurrent verify/resend for this user)
3. `checkOtp(...)`
4. If `{ ok: true }` → `activateUser(user.id)`; if it returns false, treat as `INVALID_OTP`
5. Commit, then: if `{ ok: false }` → throw `AppError(400, 'Invalid or expired OTP', 'INVALID_OTP')`
6. On success return nothing sensitive

> Leave a `// TODO(credit-service): emit user-registered event here` comment at the activation point. Do not implement it (F19.1.1 is a later stage).

#### `authService.resendRegistrationOtp({ email })`

Inside `withTransaction`:

1. Look up the user by email. If none or not `pending` → `AppError(400, 'No pending registration found', 'NO_PENDING_REGISTRATION')`
2. `lockUserById(user.id)`
3. `countOtps(user.id, 'Registration')`. If `count - 1 >= config.otp.maxResends` → `AppError(429, 'Maximum OTP resends reached. Please register again later.', 'OTP_RESEND_LIMIT')`
4. `findLatestOtp`. If `created_at + cooldown > now` → `AppError(429, 'Please wait before requesting another OTP', 'OTP_RESEND_COOLDOWN')`, and set a `Retry-After` header (seconds remaining). To set the header, attach an optional `retryAfterSeconds` field to `AppError` and have the global error handler emit the header when present. The JSON body stays `{ message, code }`.
5. `issueOtp(...)` (this invalidates the previous OTP and sends the email)

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
- Resend-limit counting for those purposes will need a per-flow window (Stage 5 counts all `Registration` OTP rows because a user only ever has one registration flow)
- NFR2 (email retry ×3 + delivery-failure logging) and NFR1 (lockout after repeated failed OTP attempts) are Week 10 items
- A periodic cleanup of expired pending users is optional; `deleteStalePendingUsers` already reclaims them lazily on re-registration
- Frontend: the register response changed (`201 OTP_SENT`, no active session) and two new endpoints exist; the OTP entry screen is a separate frontend task
