<!--
AI Assistance Disclosure:
Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
Scope: Documented the Phase 0 scaffold's setup/run instructions (SupplierServiceSpec.md, "Phase 0 —
       Foundations"). No requirements, architecture, schema, or API decisions were made by the AI
       tool.
Author review: Congchen
Scope: 2026-09-29 update — added the Phase 1 requester-mode API section (SupplierServiceSpec.md,
       "Phase 1 — Supplier Read APIs"), listing the four read endpoints, their accepted roles, and
       the §7.2 query parameters. No requirements, architecture, schema, or API decisions were made
       by the AI tool.
Author review:
-->

# Supplier Service

See [SupplierServiceArchitecture.md](./SupplierServiceArchitecture.md) for the decided architecture
and [SupplierServiceSpec.md](./SupplierServiceSpec.md) for the phased implementation plan.

## Setup

```bash
npm install
cp .env.example .env   # fill in DB/Redis/User Service values for your environment
npm run migrate        # applies src/db/init.sql (§6.4 schema)
npm run dev
```

## Environment variables

See `.env.example` for the full list: server port, MySQL connection, Redis connection, and
`USER_SERVICE_URL` (used by the auth middleware to call the User Service's `GET /auth/verify`).

## API (Phase 1 — requester mode)

All routes below are versioned under `/api/v1` and require a valid User Service bearer token.
Accepted roles: `user`, `admin`, `super admin` (§7).

| Method & path | Query parameters |
| --- | --- |
| `GET /api/v1/suppliers` | `page`, `limit` (fixed at 50), `search`, `location_id`, `category_id`, `isOpen` (`true`/`false`), `sortOrder` (`A-Z`/`Z-A`, default `A-Z`) |
| `GET /api/v1/suppliers/:id` | — |
| `GET /api/v1/suppliers/reference/location` | — |
| `GET /api/v1/suppliers/reference/categories` | — |

See `SupplierServiceArchitecture.md` §7.2–§7.3 for the full request/response contract.

## Tests

```bash
npm test
```
