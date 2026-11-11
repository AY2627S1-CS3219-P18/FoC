<!--
AI Assistance Disclosure:

Tool: Codex (model: GPT-6), date: 2026-10-13
Scope: Resolved the README log-index merge conflict and added sequential index numbers.
No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review: Reviewed and verified by Koh Wee Jean, 2026-11-10.

Scope (2026-11-04, Codex, model: GPT-6): Resolved PR 144 merge conflicts and updated the log
       index. No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review: Reviewed and verified by Koh Wee Jean, 2026-11-10.

Scope (2026-11-08, Codex, model: GPT-6): Resolved merge conflicts in the AI log index.
No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review: Congchen

Scope (2026-11-09, Codex, model: GPT-6): Resolved merge conflicts and added the merge log index
       row. No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review: Reviewed and verified by Koh Wee Jean, 2026-11-10.

Tool: Codex (model: GPT-6), date: 2026-11-10
Scope: Resolved usage-log merge conflict and added the required Log index row.
No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review: tng wen xi

Scope (2026-11-10, Codex, model: GPT-6): Resolved README and usage-log merge conflicts while
       retaining both branches. No requirements, architecture, schema, or API decisions were
       made by the AI tool.
Author review: tng wen xi

Scope (2026-11-10, Codex, model: GPT-6): Resolved merge conflicts and added the merge log index
       row. No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review: Reviewed and verified by Koh Wee Jean, 2026-11-10.

Scope (2026-11-10, Codex, model: GPT-6): Resolved merge conflicts and updated the log index.
No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review: Reviewed and verified by Koh Wee Jean, 2026-11-10.

Scope (2026-11-11, Claude Code, model: claude-sonnet-5): Added a "Services" section
       summarizing each of the 6 service READMEs (user-service, supplier-service,
       order-service, credit-service, chat-service, frontend) with a link to the full
       README. Restates existing content; no requirements, architecture, schema, or API
       decisions were made by the AI tool.
Author review: gabriel yap

Scope (2026-11-11, Claude Code, model: claude-sonnet-5): Removed disclosure entries that
       described work done in individual service READMEs/features (user-service,
       supplier-service, order-service, chat-service, frontend) rather than edits to this
       file; kept only entries that are actually about this file (merge-conflict resolutions
       and the Services section above). That history remains in each service's own README
       header and in /ai/usage-log.md. No requirements, architecture, schema, or API
       decisions were made by the AI tool.
Author review: gabriel yap
-->

# CS3219 — Software Design and Architecture (AY2627 Sem 1)

## Friend on Campus (FoC)

**Friend on Campus (FoC)** is a peer-to-peer campus errand platform where
students can request items to be collected from stores or facilities on
campus, and other students can fulfil (and deliver) those requests. The
platform runs on a closed credit economy — credits cannot be bought,
withdrawn, or exchanged for money, and only circulate within the platform.

---

## Team Members

| Name        | Role                                                        |
| ----------- | ----------------------------------------------------------- |
| Gabriel Yap | User Service, Recurring and Scheduled Errands               |
| Congchen    | Supplier Service, Supplier Bookmarking, Translation in Chat |
| George      | Order Service, Cloud Deployment                             |
| Wen Xi      | Order Service, Live Chat                                    |
| Wee Jean    | Credit Service, CI/CD                                       |

---

## Repository Structure

This repository follows a **one-service-per-folder** structure: each
microservice (`user-service/`, `supplier-service/`, `order-service/`,
`credit-service/`, `chat-service/`) lives in its own top-level folder, each
with its own README, `.env.example`, tests and Dockerfile. `frontend/` is the
client app that talks to them; `foc-mockup/` is the original everything-mocked
prototype and is kept standalone (see [Services](#services) above).

```text
.
├── user-service/      # accounts, auth, JWKS (see Services)
├── supplier-service/  # supplier listings, admin CRUD, photos
├── order-service/     # errands: create/accept/deliver/complete
├── credit-service/    # closed credit economy: balances, transaction log
├── chat-service/      # per-order and system conversations
├── frontend/          # React/Vite/Tailwind client
├── foc-mockup/        # standalone, everything-mocked prototype; own README and AI-NOTES.md
├── ai/                # usage-log.md — the shared AI disclosure log (AGENTS.md §5)
├── docs/               # cross-service docs: deployment checklists, planning notes
├── data/               # seed/reference data shared across services
├── postman/            # Postman collections for manual API testing
├── compose.yaml        # production-target services
├── compose.dev.yaml    # dev-target override (hot reload, Compose Watch)
├── .env.example        # root env vars, one block per service
├── AGENTS.md           # AI usage policy for this repo
└── README.md
```

- Any **nice-to-have (N2H)** feature that warrants its own service should
  be added as an **additional folder** at the same level, following the
  same per-service structure.
- Files for agentic coding tools (e.g. agent configs, prompts, skills)
  may be added as needed, but must still **respect the
  one-service-per-folder skeleton** for core implementation.

---

## Running the stack

```bash
cp .env.example .env          # then fill in any blanks
docker compose up --build     # production targets, frontend on http://localhost:5173
```

For hot reload, add the dev override, which swaps the frontend and order-service to
their `dev` targets and enables Compose Watch:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build --watch
```

> The dev override uses `ports: !override`, which needs **Docker Compose 2.24.4 or
> newer**. On older versions the tag is _silently ignored_ and the merged config
> publishes the same host port twice, so `up` fails with "port is already allocated".
> Check with `docker compose version`.

### ⚠️ After pulling a schema change, recreate that service's database volume

`user-service`, `credit-service` and `supplier-service` load their schema from
`src/db/init.sql`, mounted into the Postgres/MySQL image's
`docker-entrypoint-initdb.d`. **Those scripts run only on an empty volume.** Pulling a
change to an `init.sql` therefore does nothing to a database you already have, and the
service fails at runtime on the missing table or column rather than at startup — this
has caught the team out four times now (`credit_allocation_outbox`, `dead_letter_jobs`,
`users.login_failed_attempts`, and balances keyed to a recreated `user-db`).

```bash
docker compose down -v user-db        # or credit-db / supplier-db
docker compose up -d
```

This destroys that database's contents. Recreate `user-db` and `credit-db` **together**:
credit balances are keyed to user UUIDs, so recreating one and not the other leaves
orphaned rows.

`order-service` is the exception — it uses Prisma migrations (`npx prisma migrate
deploy`, run by `order-worker` at startup), so it upgrades in place and needs none of
this.

---

### ⚠️ Known gap: no TLS

The `frontend` container serves the built app and proxies every API path
(`/api/v1`, `/auth`, `/users`, `/credits`, `/orders`, `/socket.io`) through nginx, so
the browser talks to one origin. **That nginx listens on plain HTTP, port 80 — there is
no TLS anywhere in this stack.**

Fine for local development. Not fine once it is deployed: the planned single-EC2
deployment makes this nginx the production edge, and every access token, refresh cookie
and password would cross the network in clear text. Before any public deployment,
certificates need terminating either in this container (certbot) or in front of it (an
ALB). Nobody owns this yet.

---

## Services

One-paragraph orientation per service; each links to its own README for the full API
reference, environment variables, data model and deployment details.

### [user-service](./user-service/README.md)

Owns accounts, authentication and admin user-management. Issues RS256 JWTs and publishes a
JWKS endpoint (`GET /auth/.well-known/jwks.json`) that every other service verifies access
tokens against locally. Also handles OTP-gated registration/login/password flows, an
escalating login-lockout system, role/status administration with an audit log, and a
transactional outbox that allocates each new user's starting credits through credit-service.

- **Stack:** Node.js/TypeScript, Express 4, PostgreSQL (`pg`, no ORM; Prisma for migrations only).
- **Run:** `docker compose up --build user-service` → API on http://localhost:3001.

### [supplier-service](./supplier-service/README.md)

Owns supplier (store/facility) listings: requester-facing browsing/search and admin
create/edit/delete, with photo uploads to an S3-compatible object store (MinIO locally). A
separate worker process relays outbox rows to BullMQ for supplier suspension and image
cleanup jobs. See its own [architecture](./supplier-service/SupplierServiceArchitecture.md)
and [spec](./supplier-service/SupplierServiceSpec.md) documents for the full design.

- **Stack:** Node.js/TypeScript, Express, MySQL, Redis/BullMQ.
- **Run:** `npm install && npm run migrate && npm run dev` (see its README for the local photo store).

### [order-service](./order-service/README.md)

Owns every errand ("order request") from creation to completion: requesters post orders,
couriers accept/pick up/deliver them, and the requester (or the system, after a delay) marks
them complete, triggering a credit transfer. Runs as two processes — an API with a Socket.IO
server for live order updates, and a worker handling expiry sweeps, the outbox relay, and a
recurring-order scheduler. Full endpoint reference in [order-service/API.md](./order-service/API.md).

- **Stack:** Node.js/TypeScript (ESM), Express 5, Prisma 7, PostgreSQL 17, Redis/BullMQ.
- **Run:** `docker compose -f compose.yaml -f compose.dev.yaml up --build --watch` → API on http://localhost:3002.

### [credit-service](./credit-service/README.md)

Owns the closed credit economy: balances and an append-only transaction log. Credits enter
only through allocation (20 per new user), move only between existing balances via reserve/
transfer/release, and leave no other way. A separate worker processes credit transfers from a
BullMQ queue. Full endpoint and queue reference in [credit-service/API.md](./credit-service/API.md).

- **Stack:** Node.js/TypeScript, Express 4, PostgreSQL (`pg`, no ORM), Redis/BullMQ.
- **Run:** `docker compose up --build credit-service credit-worker` → API on http://localhost:3003.

### [chat-service](./chat-service/README.md)

Owns per-order (and per-user "system") conversations: creation, listing, message history,
sending, read receipts, participant management, archiving, and optional message translation.
Order-service drives conversation lifecycle (creation, status notifications, participant
adds, archiving) through a service-key API; the frontend talks to it directly over REST and a
dedicated Socket.IO namespace for real-time delivery.

- **Stack:** Node.js/TypeScript (ESM), Express 5, Prisma 7, MySQL, Redis (Socket.IO adapter).
- **Run:** `docker compose up --build chat-service` → API on http://localhost:3005.

### [frontend](./frontend/README.md)

React 18 + Vite + Tailwind SPA. Talks to user-service (login/session) and supplier-service
(suppliers, admin supplier management, photos) for real data; requests, activity, chat and
credits are still mock data inside the app. Proxies all API paths through nginx/Vite so the
browser only ever talks to one origin.

- **Stack:** React 18, Vite, Tailwind.
- **Run:** `docker compose -f compose.yaml -f compose.dev.yaml up --build --watch` → http://localhost:5173.

---

## AI Use Summary

**Tools:** Claude Code (claude-sonnet-5; claude-opus-5 / claude-opus-5-5 for the mockup and order-service scaffolding)
**Prohibited phases avoided:** requirements elicitation; architecture/design decisions.
**Used for:** implementation code, boilerplate/scaffolding, and verification against team-written specifications.
**Verification:** All AI outputs are reviewed, edited, and tested by the authors.
**Prompts / key exchanges:** see [/ai/usage-log.md](ai/usage-log.md) for all services except `foc-mockup/`,
which keeps its own standalone log in [foc-mockup/AI-NOTES.md](foc-mockup/AI-NOTES.md).
