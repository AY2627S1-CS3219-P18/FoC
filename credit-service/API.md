<!--
  AI Assistance Disclosure:
  Tool: Claude Code (model: claude-opus-5), date: 2026-10-16
   2026-10-16: Week 7/8 catch-up - published API contract for Order Service to build
     against. Methods and paths are the team's (credit-service-context.md §8); items
     marked INVENTED were not covered by any requirement or team decision.
     Author review:
-->

# Credit Service API

Base URL in compose: `http://credit-service:3003`. Published on the host at
`${CREDIT_SERVICE_PORT:-3003}`.

All ids are **UUID**. `requestId` is sent on every credit call, and Credit Service keys
everything on it — there is no reservation handle (team decision 2026-10-16).

> ### ⚠️ No authentication
> No endpoint authenticates its caller. The F19.5.1 authorization rule is implemented in
> `src/middleware/requireBalanceAccess.ts` but **is not mounted**, because verifying a
> User Service token needs its RS256 public key and that key is git-ignored and absent
> from the repository. **Any caller can currently read any balance and move any
> credits.** Do not deploy outside the compose network.

## Conventions

Success responses carry a `balance` envelope, and the write endpoints also return the
log row that was written in the same transaction:

```jsonc
{
  "balance": {
    "userId": "<uuid>",
    "totalBalance": 20,
    "reservedBalance": 4,
    "unreservedBalance": 16
  },
  "transaction": {
    "transaction_id": "<uuid>",
    "transaction_type": "reservation",
    "originating_user_id": "<uuid>|null",
    "destination_user_id": "<uuid>|null",
    "amount": 4,
    "created_at": "2026-10-16T14:00:00.000Z",
    "request_id": "<uuid>|null"
  }
}
```

Errors are always:

```jsonc
{ "error": { "code": "MACHINE_READABLE_CODE", "message": "Human sentence." } }
```

Every endpoint can return `400 INVALID_REQUEST_BODY` (validation), `500
BALANCE_INVARIANT_VIOLATION` (a balance CHECK constraint fired and the write rolled
back) and `500 INTERNAL_ERROR`. These are omitted from the per-endpoint tables below.

---

## `POST /credits/allocate` — F19.1.1

Grants a new user their starting 20 credits. The amount is fixed by F19.1.1.

```jsonc
// request
{ "userId": "<uuid>" }
```

**`201`** — balance envelope, `transaction_type: "allocation"`, `request_id: null`.

| Status | Code | When |
|---|---|---|
| 409 | `ALREADY_ALLOCATED` | This user already has a balance. No credits granted, no log row written |

---

## `POST /credits/reserve` — F19.2.1, F19.2.3

Holds the offered credits against a request. Total is unchanged; reserved rises.

```jsonc
// request
{ "userId": "<uuid>", "requestId": "<uuid>", "amount": 4 }
```

`amount` must be a positive integer.

**`201`** — balance envelope, `transaction_type: "reservation"`.

| Status | Code | When |
|---|---|---|
| 404 | `BALANCE_NOT_FOUND` | The user has no balance row |
| 409 | `RESERVATION_ALREADY_EXISTS` | This `requestId` is already reserved. Idempotent: no second hold is taken |
| 422 | `INSUFFICIENT_UNRESERVED_CREDITS` | F19.2.3 — the offer exceeds `totalBalance − reservedBalance` |

---

## `POST /credits/transfer` — F19.3.1, F19.3.2

Moves the reserved credits to the courier on completion. Requester's total **and**
reserved both fall; courier's total rises (context §5).

```jsonc
// request
{ "requestId": "<uuid>", "courierId": "<uuid>" }
```

**The amount and the requester are not sent.** They are read back from the reservation
row for that `requestId`, so a transfer can only ever move exactly what was held.

Credit Service does not look couriers up and stores no courier reference of its own
(team decision 2026-10-16).

**`201`** — balance envelope showing **the requester's** balance after the debit, and
`transaction_type: "transfer"` with both party ids set.

| Status | Code | When |
|---|---|---|
| 404 | `RESERVATION_NOT_FOUND` | No reservation exists for this `requestId` |
| 404 | `COURIER_NOT_FOUND` | The courier has no balance row. **A balance is not created here** — credits may only enter the economy via F19.1.1 |
| 404 | `BALANCE_NOT_FOUND` | The requester's balance row is missing (should not occur if a reservation exists) |
| 409 | `ALREADY_TRANSFERRED` | F19.3.2 — already transferred. Idempotent, safe to retry |
| 409 | `ALREADY_RELEASED` | **INVENTED** — the credits were already returned to the requester, so there is nothing to transfer. No requirement covers this ordering |

**Retry safety.** A failure before commit leaves no trace, so the same call can simply be
sent again. This is what makes transfer drivable from the async workflow the team has
yet to design.

---

## `POST /credits/release` — F19.4.1

Returns reserved credits to the requester on cancellation **or** expiry. Reserved falls;
total is untouched (context §5).

```jsonc
// request
{ "requestId": "<uuid>" }
```

Takes only a `requestId`. Credit Service has no clock and performs no expiry detection —
the caller decides why the credits are coming back, and both reasons arrive identically
(team decision 2026-10-16).

**`201`** — balance envelope, `transaction_type: "release"`, `destination_user_id: null`.

| Status | Code | When |
|---|---|---|
| 404 | `RESERVATION_NOT_FOUND` | No reservation exists for this `requestId` |
| 404 | `BALANCE_NOT_FOUND` | The requester's balance row is missing |
| 409 | `ALREADY_RELEASED` | Already released. Idempotent, safe to retry |
| 409 | `ALREADY_TRANSFERRED` | **INVENTED** — the credits are the courier's now and are not the requester's to reclaim. No requirement covers this ordering |

---

## `GET /credits/balance/:userId` — F19.5.1

```jsonc
// 200
{ "balance": { "userId": "<uuid>", "totalBalance": 20, "reservedBalance": 4, "unreservedBalance": 16 } }
```

`unreservedBalance` is always `totalBalance − reservedBalance`, computed on read and
never stored.

| Status | Code | When |
|---|---|---|
| 404 | `BALANCE_NOT_FOUND` | No balance row for this user |

**Authorization is specified but not enforced.** The rule — a user may read only their
own balance unless they hold a role ranked at or above `admin` — lives in
`src/auth/roleRank.ts` and is unit-tested. The middleware that would apply it is written
and unmounted. Until then this endpoint is open; see the warning at the top.

When it is enforced it will add `401 UNAUTHORIZED` and `403 FORBIDDEN`.

---

## `GET /health`

`200 { "status": "ok" }`. Used by the compose healthcheck. **INVENTED** — not in §8, but
required by the healthcheck pattern the sibling services use.

---

## Not implemented

| Endpoint | Requirement | Blocked on |
|---|---|---|
| `GET /credits/transactions` | F19.5.2 | Authentication (public key); and §10.5 — the field set is unspecified |
| `GET /credits/transactions/all` | F20.2, F20.2.1 | Authentication and the admin role check; same field-set gap |

---

## What was invented, and what the team still owes

Everything below was written to make the service usable and is **not** backed by a
requirement or a recorded team decision. Listed so it can be ratified or replaced.

1. **All request and response body shapes.** §8 fixes only method and path.
2. **All HTTP status codes**, and the `{ error: { code, message } }` envelope.
3. **`ALREADY_RELEASED` on transfer and `ALREADY_TRANSFERRED` on release.** No
   requirement states what happens when the two orderings collide.
4. **`GET /health`.**
5. **Self-transfer is not rejected.** If `courierId` equals the requester, the arithmetic
   nets out to a release. No requirement forbids it, and Order Service's F3.2.1 prevents
   it upstream, so Credit Service does not second-guess the caller.
6. **The role name `credit_app`** for the least-privilege database role (NFR8.2.3). The
   team specified "a named least-privilege role" without naming it.
7. **`ELEVATED_ROLE = 'admin'`** as the rank threshold for reading another user's
   balance. The team said to mirror user-service's rank comparison; the threshold itself
   was not stated.

### Known mismatch with Order Service

`order-service/src/clients/credits.client.ts` currently declares a different contract:
`reserve({ requesterId, amount }) → { reservationId }` and `release(reservationId)`, with
no `requestId` and no `transfer` method, wired to `createStubCreditsClient()`. It must be
rewritten against this document before the two services can talk.
