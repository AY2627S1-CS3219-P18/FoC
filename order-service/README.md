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

| Script | What it does |
|---|---|
| `db:generate` | Regenerate the typed client into `src/generated/prisma` (git-ignored) |
| `db:migrate` | `prisma migrate dev`: create + apply a migration (dev only) |
| `db:deploy` | `prisma migrate deploy`: apply pending migrations (what containers run) |
| `db:reset` | Drop, recreate, re-apply all migrations (destroys data) |
| `db:studio` | Prisma Studio GUI |

## Other scripts

| Script | |
|---|---|
| `dev` | `tsx watch src/server.ts`: run TS directly with restart on change |
| `build` / `start` | `tsc` to `dist/`, run compiled output |
| `typecheck` | `tsc --noEmit` (tsx does **not** type-check; run this or rely on your editor) |
| `test` / `test:watch` / `test:cov` | Unit tests (Vitest, `src/**/*.spec.ts`) |
| `test:e2e` | E2E tests (`test/*.e2e-spec.ts`), **need a running DB** |
| `lint` / `format` | oxlint (type-aware) / Prettier |

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
