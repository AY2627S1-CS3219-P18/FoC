<!--
AI Assistance Disclosure:
Tool: Claude Code (claude-sonnet-5), date: 2026-10-17
Scope: Generated this guide per instructions.md Stage 13d. It documents user-service's own
       published contract for other teams to implement against; it does not implement
       verification code for order-service, supplier-service, or credit-service, and none of
       their files were touched. No requirements, architecture, schema, or API decisions were
       made by the AI tool — this restates decisions already recorded in instructions.md Stage 13.
Author review:
-->

# Verifying `user-service` Access Tokens via JWKS

This is for whoever implements token verification in **order-service**, **supplier-service**,
and **credit-service**. It describes what `user-service` now publishes and how to check a
token against it. It is not code for your service — you write and own that yourself.

## What changed

`user-service` no longer answers a per-request `GET /auth/verify` call. It now publishes its
public signing key(s) at a JWKS endpoint; your service fetches them and verifies tokens itself,
locally, without calling `user-service` on every request.

If your service currently calls `GET /auth/verify` (today, only `supplier-service` does, in
`supplier-service/src/middleware/authenticate.ts`), that endpoint is gone — it now returns
`404`. That middleware has to be rewritten using this guide. `order-service` and
`credit-service` have no auth middleware yet; this is where you add it.

## The endpoint

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

## Verifying a token

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

## Library choice

This isn't prescribed — it's your service's own implementation detail to decide, same as any
other dependency choice. None of the three services currently depend on a JWT/JWKS library.
Two common shapes for this, for reference:

- `jsonwebtoken` (verify) + `jwks-rsa` (fetch/cache JWKS by `kid`) — widely used together.
- `jose` — handles both JWKS fetching/caching and verification in one library, works the same
  way in and outside Node.

Either way, the steps above (cache, look up by `kid`, refetch once on a miss, verify, read
`sub`/`role`) are what matters — the library is just how you do it.
