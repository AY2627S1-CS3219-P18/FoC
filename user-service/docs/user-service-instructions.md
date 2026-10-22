<!--
AI Assistance Disclosure:
Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-22
Scope: Generated this guide documenting the existing, already-decided local setup steps for
       user-service (env_file pattern from instructions.md Stage 3b/3c, SUPER_ADMIN_PASSWORD/
       CREDIT_SERVICE_URL requirements from src/config.ts, RS256 keypair requirement from
       Stage 2). No requirements, architecture, schema, or API decisions were made by the AI
       tool — this restates decisions already recorded in instructions.md and src/config.ts.
Author review:
Scope (2026-10-22): Merged in the former jwks-verification-guide.md (originally authored
       2026-10-17 per instructions.md Stage 13d) as Part 2, at the user's request, so both
       user-service docs live in one file. Content unchanged beyond heading levels and
       cross-references; no requirements, architecture, schema, or API decisions were made.
Author review:
-->

# `user-service` Developer Guide

Two unrelated things, kept in one file: **Part 1** is what you need to get `user-service`
running on a fresh checkout. **Part 2** is the published contract other services (order,
supplier, credit) implement against to verify `user-service`'s access tokens — read that part
only if you're implementing auth in one of those services.

## Part 1: Local setup

This is what a fresh checkout needs before `user-service` will start, whether you run it via
`docker compose up --build` or directly on the host. None of this is loaded from
`compose.yaml` — `user-service` loads all its config from `user-service/.env`
(`env_file: ./user-service/.env`, per instructions.md Stage 3b), and that file is gitignored,
so every developer sets up their own copy.

### 1. Copy the example env file

```bash
cp user-service/.env.example user-service/.env
```

`.env.example` already has working values for most vars (DB credentials matching
`user-db`'s compose defaults, `CREDIT_SERVICE_URL=http://credit-service:3003`, OTP/token
settings, etc.). A few are intentionally left blank and need to be filled in locally — see
below.

### 2. Set `SUPER_ADMIN_PASSWORD`

Required, non-blank, and must pass the complexity check in
[`bootstrap.service.ts`](../src/services/bootstrap.service.ts): at least 8 characters, with an
uppercase letter, a lowercase letter, a digit, and a special character.

This isn't a shared team secret — on startup, `user-service` checks if a super admin already
exists in *your* `user-db`, and if not, creates one using whatever
`SUPER_ADMIN_USERNAME`/`EMAIL`/`PASSWORD` is in your local `.env`. Since every developer's
`user-db` is a separate container/volume, there's nothing to keep in sync across teammates —
pick any value locally that meets the complexity rule.

### 3. Generate an RS256 keypair

`user-service/keys/` is empty and gitignored. `JWT_PRIVATE_KEY_PATH`/`JWT_PUBLIC_KEY_PATH` in
`.env.example` point to `./keys/private.pem` / `./keys/public.pem`, so you need to generate
both locally:

```bash
openssl genrsa -out user-service/keys/private.pem 2048
openssl rsa -in user-service/keys/private.pem -pubout -out user-service/keys/public.pem
```

(2048-bit RSA matches the existing keypair's size.) This is the key `user-service` signs
access tokens with and publishes the public half of via the JWKS endpoint — see Part 2 below
if you're implementing token verification in another service.

### 4. Everything else

- **SMTP vars** (`SMTP_HOST`/`USER`/`PASS`/`FROM`): can stay blank — `src/config.ts` only
  requires them when `NODE_ENV` isn't `development`. Emails are logged instead of sent.
- **`TEST_USER_*`**: optional; only seeds a test user if all three (`USERNAME`/`EMAIL`/`PASSWORD`)
  are set.

### 5. Start the stack

```bash
docker compose up --build
```

If `user-service` still crashes on startup with a Zod validation error naming a specific env
var, your local `.env` is most likely missing that var or out of date — diff it against
`.env.example` and copy over what's missing.

## Part 2: Verifying `user-service` access tokens via JWKS

This is for whoever implements token verification in **order-service**, **supplier-service**,
and **credit-service**. It describes what `user-service` publishes and how to check a token
against it. It is not code for your service — you write and own that yourself.

### What changed

`user-service` no longer answers a per-request `GET /auth/verify` call. It now publishes its
public signing key(s) at a JWKS endpoint; your service fetches them and verifies tokens itself,
locally, without calling `user-service` on every request.

If your service currently calls `GET /auth/verify` (today, only `supplier-service` does, in
`supplier-service/src/middleware/authenticate.ts`), that endpoint is gone — it now returns
`404`. That middleware has to be rewritten using this guide. `order-service` and
`credit-service` have no auth middleware yet; this is where you add it.

### The endpoint

```
GET {USER_SERVICE_BASE_URL}/auth/.well-known/jwks.json
```

- No `Authorization` header needed — it's public, by design (you need it before you can verify
  anything).
- Returns `200` with a standard JWKS body (RFC 7517):

```json
{
  "keys": [{ "kty": "RSA", "use": "sig", "alg": "RS256", "kid": "2026-10", "n": "...", "e": "..." }]
}
```

- **Don't assume exactly one key.** `user-service` rotates its signing key roughly every 3
  months, and during a rotation overlap window the JWKS lists both the current and the
  previous key, each under its own `kid`. A token signed before the rotation is still valid
  and still verifiable — just against the other entry.

### Verifying a token

1. Read the `Authorization: Bearer <token>` header. Missing or non-`Bearer` → reject.
2. Decode the token's **header** (not the payload yet) to read its `kid`. Every token
   `user-service` issues carries one.
3. Look up that `kid` in your cached JWKS keys.
   - **Cache the JWKS response** — don't fetch it on every request.
   - If the `kid` isn't in your cache, refetch the JWKS once (it may have just rotated) before
     rejecting. If it's still not there after a refetch, the token is invalid.
4. Verify the token's signature with `RS256` **only** — pin the algorithm yourself; never trust
   the token's own `alg` header to decide how to verify it.
5. On a valid signature, the claims you need are the same two `GET /auth/verify` used to
   return: `sub` (the user id) and `role`.
6. Anything that fails — missing header, unknown `kid` after a refetch, bad signature, expired
   token — gets rejected the same way (your service's own `401` shape; `user-service`'s own
   `authenticate` middleware uses `{ message: 'Unauthorized', code: 'UNAUTHORIZED' }`, if you
   want to match it, but that's your call).

### Library choice

This isn't prescribed — it's your service's own implementation detail to decide, same as any
other dependency choice. None of the three services currently depend on a JWT/JWKS library.
Two common shapes for this, for reference:

- `jsonwebtoken` (verify) + `jwks-rsa` (fetch/cache JWKS by `kid`) — widely used together.
- `jose` — handles both JWKS fetching/caching and verification in one library, works the same
  way in and outside Node.

Either way, the steps above (cache, look up by `kid`, refetch once on a miss, verify, read
`sub`/`role`) are what matters — the library is just how you do it.
