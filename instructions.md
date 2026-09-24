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
