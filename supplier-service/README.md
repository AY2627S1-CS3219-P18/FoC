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
Scope: 2026-09-29 update — added the local photo store section (development/unit-test MinIO
       instance, `compose.photo-store.yaml`) per SupplierServiceArchitecture.md §8.2 and §9 item 21.
       No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review:
Scope: 2026-09-29 update — added the Phase 2 admin API section, `npm run migrate:phase2`,
       `npm run test:minio` and the `PHOTO_STORE_*` variables (SupplierServiceSpec.md, "Phase 2").
       No requirements, architecture, schema, or API decisions were made by the AI tool.
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
The optional `PHOTO_STORE_ENDPOINT`, `PHOTO_STORE_BUCKET`, `PHOTO_STORE_ACCESS_KEY` and
`PHOTO_STORE_SECRET_KEY` point the photo storage interface at an S3-compatible store (the local
MinIO below); without them, photo operations fail with `500`.

## Upgrading an existing database

`npm run migrate:phase2` upgrades a database created from the pre-Phase 2 `init.sql`: it adds
`supplier_hours.is_24h`, moves `day_of_week` from 0–6 to 1–7 (Sunday 0 becomes 7) and widens the
check to 1–8. It is safe to run more than once. New databases get this schema from `init.sql`.

## Local photo store (development and unit tests only)

Supplier photos go through a provider-agnostic storage interface
(`SupplierServiceArchitecture.md` §8.2). Locally, and in unit tests, that interface is backed by a
MinIO instance that simulates the cloud object storage. It is defined in `compose.photo-store.yaml`
in this folder and is not part of the root `compose.yaml`, because it is not used in deployment.

```bash
docker compose -f compose.photo-store.yaml up -d     # start it (run from supplier-service/)
docker compose -f compose.photo-store.yaml ps        # wait until photo-store reports healthy
docker compose -f compose.photo-store.yaml down      # stop it (add -v to also delete its data)
```

The S3 API listens on host port `9000` and the web console on `9001` (override with
`PHOTO_STORE_API_PORT` / `PHOTO_STORE_CONSOLE_PORT`). The one-shot `photo-store-init` service creates
the `supplier-photos` bucket. The development-only credentials are `photostoredev` /
`photostoredev-secret` (override with `PHOTO_STORE_ACCESS_KEY` / `PHOTO_STORE_SECRET_KEY`). The
instance must be running before `npm run test:minio` (see Tests) is run.

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

## API (Phase 2 — admin mode)

All routes require a valid bearer token with role `admin` or `super admin` (§7).

| Method & path | Notes |
| --- | --- |
| `GET /api/v1/admin/suppliers` | Same query parameters as the user list; includes inactive and soft-deleted suppliers and adds `isActive`, `isDeleted` |
| `GET /api/v1/admin/suppliers/:id` | Adds `isActive`, `isDeleted`, `createdOn`, `createdBy`, `updatedOn`, `version` |
| `POST /api/v1/admin/suppliers` | `multipart/form-data`: `name`, `type`, `location_id`, `category_id` (JSON array), `desc`, `openingHours` (JSON array), `is24h`, and 0–10 JPEG/PNG `photos` (≤ 5 MB each). Requires an `Idempotency-Key` UUID header. `201` on create, `200` when it reactivates a soft-deleted supplier |
| `POST` / `PUT /:id` / `DELETE /:id` on `/api/v1/admin/reference/faculties`, `/locations`, `/categories` | JSON bodies as in §7; `DELETE` succeeds only for an unreferenced row |

See `SupplierServiceArchitecture.md` §6.2, §7 and §8.2 for the full contract.

## Tests

```bash
npm test               # everything except the MinIO tests; needs no Docker
npm run test:minio     # tests of the real photo-store connection; needs the photo store running
```
