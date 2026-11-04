<!--
AI Assistance Disclosure:
Tool: Codex (model: GPT-6), date: 2026-11-05
Scope: Documented the team-specified admin user order history endpoint.
No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review: tng wen xi
-->

# order-service

FoC order microservice. **Node.js · Express 5 · TypeScript (ESM, strict) · Prisma 7 · PostgreSQL 17**

Owns its own database (`order-db`). No other service reads or writes it directly.

## Quick start

From the **repo root**:

```bash
cp .env.example .env                                   # once
docker compose -f compose.yaml -f compose.dev.yaml up --build --watch
```

- API: http://localhost:3002 (`ORDER_SERVICE_PORT`)
- Health: http://localhost:3002/health → `{"status":"ok","database":"up"}`
- DB from host: `localhost:5433` (`ORDER_DB_PORT`)

Edits under `src/` are synced into the container and `tsx watch` restarts the server.
Changing `package.json` rebuilds the image. Changing `prisma/` restarts the container,
which re-runs `prisma generate` and `prisma migrate deploy`.

Production-like image (compiled JS, non-root): `docker compose up --build order-service`

## Running on the host instead of in Docker

```bash
docker compose up -d order-db           # just the database (from repo root)
cd order-service
cp .env.example .env
npm ci
npm run db:generate
npm run dev
```

## Database workflow (Prisma)

1. Edit `prisma/schema.prisma`.
2. From `order-service/` with `.env` set and `order-db` running:
   `npm run db:migrate -- --name <what_changed>`
   This creates a SQL migration under `prisma/migrations/`, applies it, and regenerates the client.
3. **Commit the migration folder.** Containers apply committed migrations on start (`migrate deploy`).

| Script        | What it does                                                            |
| ------------- | ----------------------------------------------------------------------- |
| `db:generate` | Regenerate the typed client into `src/generated/prisma` (git-ignored)   |
| `db:migrate`  | `prisma migrate dev`: create + apply a migration (dev only)             |
| `db:deploy`   | `prisma migrate deploy`: apply pending migrations (what containers run) |
| `db:reset`    | Drop, recreate, re-apply all migrations (destroys data)                 |
| `db:studio`   | Prisma Studio GUI                                                       |

## Other scripts

| Script                             |                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `dev`                              | `tsx watch src/server.ts`: run TS directly with restart on change             |
| `build` / `start`                  | `tsc` to `dist/`, run compiled output                                         |
| `typecheck`                        | `tsc --noEmit` (tsx does **not** type-check; run this or rely on your editor) |
| `test` / `test:watch` / `test:cov` | Unit tests (Vitest, `src/**/*.spec.ts`)                                       |
| `test:e2e`                         | E2E tests (`test/*.e2e-spec.ts`), **need a running DB**                       |
| `lint` / `format`                  | oxlint (type-aware) / Prettier                                                |

## Layout

```text
order-service/
├── prisma/
│   ├── schema.prisma          # models go here
│   └── migrations/            # created by db:migrate (commit these)
├── prisma.config.ts           # Prisma 7 config (datasource URL from env)
├── src/
│   ├── server.ts              # entrypoint: env → prisma → app.listen, graceful shutdown
│   ├── app.ts                 # createApp({ prisma }): middleware + routers (no listen)
│   ├── config/env.ts          # zod-validated env: every var the service reads
│   ├── db/prisma.ts           # createPrismaClient() (pg driver adapter)
│   ├── routes/                # one router factory per resource
│   ├── middleware/            # 404 + error handler
│   └── generated/             # Prisma client (generated, git-ignored)
└── test/                      # e2e specs
```

## Conventions / gotchas

- **ESM.** Relative imports need the `.js` extension (`import { x } from './x.js'`).
  `verbatimModuleSyntax` is on, so type-only imports must use `import type`.
- **Dependency injection by factory.** Routers take their deps as arguments
  (`healthRouter(prisma)`), and `createApp` wires them. Tests pass fakes. See `src/app.spec.ts`.
- **Async errors.** Express 5 forwards rejected promises from async handlers to the
  error handler, so no `asyncHandler` wrapper is needed.
- New env var → `src/config/env.ts`, `order-service/.env.example`, root `.env.example`,
  and the `order-service` block in `../compose.yaml`.
- Node: Docker uses Node 24 LTS; Node ≥ 22 works on the host.

<!-- AI-generated -->

## Admin user order history

`GET /orders/admin/users/:userId?page=1`

Requires the admin's bearer token. Only `admin` and `super admin` roles may access it.
`userId` must be a UUID. The endpoint forwards the bearer token to User Service's
`GET /users/:id` to check existence before querying orders.

The optional `page` query parameter defaults to 1 and must be a positive integer.
Page size is 10, configured by `ADMIN_USER_ORDERS_PAGE_SIZE` in
`src/services/order-listing.service.ts`. Search, filters and configurable sorting
are not supported; unknown query parameters return 400.

```json
{
  "totalCount": 23,
  "currentPage": 1,
  "pageSize": 10,
  "totalPages": 3,
  "orders": [
    {
      "order": { "id": "…", "requesterId": "…", "courierId": "…" },
      "role": "requester"
    }
  ]
}
```

The example abbreviates `order`: every persisted order field is returned, including
status and timestamps. Each entry's `role` is `requester` or `courier` relative to
`:userId`. Orders include every status and are sorted by `createdAt` descending,
then ID ascending for equal timestamps. There is no persisted completion timestamp.
No credit-service transactions are fetched by this endpoint.

`totalCount` counts all matching orders, not just the page. An existing user with
no orders receives `orders: []`, `totalCount: 0` and `totalPages: 0`. A page beyond
the last page returns an empty array with the actual count and requested page.

Errors use the existing `{ "message": "..." }` envelope:

| HTTP | Internal ErrorCode         | Condition                                                                               |
| ---- | -------------------------- | --------------------------------------------------------------------------------------- |
| 400  | `MALFORMED_USER_ID`        | User ID is not a UUID                                                                   |
| 400  | `INVALID_QUERY_PARAMETER`  | Invalid page                                                                            |
| 400  | `UNKNOWN_QUERY_PARAMETER`  | Unsupported query parameter                                                             |
| 401  | `UNAUTHENTICATED`          | Missing/invalid authentication, including User Service rejection                        |
| 403  | `FORBIDDEN`                | Actor is not admin/super admin, or User Service rejects access                          |
| 404  | `INVALID_USER_ID`          | User Service reports that the user does not exist                                       |
| 503  | `USER_SERVICE_UNAVAILABLE` | User lookup connection failure or unsuccessful upstream response other than 401/403/404 |

The enum names above are internal; response bodies contain the message, following
existing order-controller conventions.
