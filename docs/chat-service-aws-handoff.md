<!--
AI Assistance Disclosure:
Tool: Claude Code (model: claude-opus-5), date: 2026-11-10
Scope: Wrote the console handoff for deploying chat-service, deriving names, sizes, parameter
       paths and Service Connect settings from docs/ecs-fargate-session-prompt.md, the existing
       docs/ecs-fargate-run-checklist.md and compose.yaml. No task definition was read: none is
       committed to this repo, so every value below is derived from those files rather than from
       live AWS, and is marked where it needs confirming. The two open team decisions are left
       open. No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review:
-->

# Deploying `chat-service` — console handoff

For George. Region `ap-southeast-1`, cluster `foc`, as everywhere else.

The repo side is done: the image builds and pushes to ECR on every merge to `main`, and
`ecs-deploy.sh` reports "not deployed" until the ECS service exists. Nothing below is in the
repo, because none of it can be.

**One caveat on names.** No task definition is committed to this repo, so none was read.
Everything here is derived from `ecs-fargate-session-prompt.md` (Phase 2 steps 10–19 and its
"Found while carrying this out" notes), `ecs-fargate-run-checklist.md`, and `compose.yaml`.

### Derived names — reconcile these against a real task definition before merging

Every value below is a **new** name extended from an existing pattern, not one read from AWS.
The pattern it follows is given so you can check each against the real thing.

| Derived value | Pattern it follows | Confirmed? |
|---|---|---|
| `foc/chat-service` (ECR) | `foc/<service>`, recorded in the plan | ☐ |
| `foc-chat-db` (RDS) | `foc-user-db`, named in the plan's notes | ☐ |
| `chat_service` (initial DB name) | `order_db`, `user_service`, `credit_db`, `supplier_service` | ☐ |
| `/foc/chat/database-url` | `/foc/order/database-url` | ☐ |
| `/foc/chat/service-api-key` | `/foc/user/db-password` style kebab-case | ☐ |
| `/ecs/foc/chat-service` (log group) | `/ecs/foc/<service>`, Phase 2 step 14 | ☐ |
| `foc-chat` (target group) | `foc-user`, `foc-credit`, `foc-order`, `foc-supplier`, `foc-frontend` | ☐ |
| `chat-service:3000` (Service Connect) | `credit-service:3003`, `user-service:3001` | ☐ |
| 0.5 vCPU / 1 GB (task size) | `credit-service` and `order-service`, Phase 2 step 15 | ☐ |

Existing resources this reuses, and does not create: `foc-rds` (subnet group and security
group), `foc-mysql` (parameter group), `foc-tasks`, `foc-ecs-task-execution`, `foc-alb`,
`foc-order-redis`, and the `foc` cluster and Cloud Map namespace.

---

## Two decisions first — the rest depends on them

Neither is mine or the agent's to make, and the steps below are written so you can take either
road.

### Decision 1 — chat's database

| Option | What it means |
|---|---|
| **A: its own RDS MySQL instance** | A 5th instance, `foc-chat-db`. Clean separation, matches every other service. Adds roughly a fifth to the RDS share of the ~$10/day, and one more instance to stop and start every cycle |
| **B: share `foc-supplier-db`** | No new instance and no new cost. But chat's Prisma migrations and supplier's `init.sql` then live in one instance, one failure domain, one parameter group and one credential. Chat would need its own database *inside* it (`chat_service`) and ideally its own login |

Step 2 assumes **A** because it is what the other four services do; if you pick **B**, skip to
step 2b.

### Decision 2 — chat's Redis

chat-service uses Redis only for its Socket.IO adapter — to fan out messages to sockets held by
another task. It does not use BullMQ.

| Option | What it means |
|---|---|
| **A: share `foc-order-redis`** | What `compose.yaml` already does. Safe from collisions: chat passes `key: "chat-socket.io"` to the adapter while order-service uses the default, so their channels do not overlap (`chat-service/src/server.ts`, `order-service/src/server.ts`). A chat message storm would share capacity with order's BullMQ queues |
| **B: a third cluster** | Isolation, at about another cluster's cost, plus one more thing to recreate every start |

Step 3 assumes **A**, which needs no new infrastructure at all.

---

## 1. ECR repository — **before the PR merges, not after**

> This is the one step that cannot wait. The `build` job has `fail-fast: false`, so a failed
> chat leg does not cancel the other four images — but the job still concludes as **failed**,
> and `deploy-web` has `needs: build`. One missing repository therefore **skips every deploy,
> for all nine services**, on every merge to `main` until it exists. The other eight would
> quietly stop receiving updates.
>
> Everything else here can lag safely: `ecs-deploy.sh` skips with a notice when an ECS service
> is missing, so chat reports "not deployed" while the rest deploy as normal.

- Name: **`foc/chat-service`** — matching `foc/<service>`, the pattern recorded in the plan and
  used by the other six repositories.
- Lifecycle rule: same as the others, keep the 3 newest images. The workflow sets
  `provenance: false` and `sbom: false`, so one manifest per build and the count means builds.

Once it exists, re-run **Deploy → Run workflow** with `mode: build-only` to get an image in
place before ECS needs one, exactly as Phase 2 step 6 did for the others.

## 2. Database — option A, its own instance

**RDS → Create database**, mirroring the other four (Phase 2 step 10):

| Setting | Value |
|---|---|
| Engine | **MySQL 8.4** — not 8.0, which left standard support on 2026-07-31 (the same reason `foc-supplier-db` is on 8.4) |
| Identifier | `foc-chat-db` *(extending the `foc-<service>-db` pattern)* |
| Class / storage | `db.t4g.micro`, single-AZ, gp3 at minimum storage |
| Admin login | `foc_admin`, its own password. Avoid URL-unsafe characters — it goes inside `DATABASE_URL`, as order's does |
| Initial database name | **`chat_service`** — set it here. `foc-user-db` was created without one and needed a one-off task to `CREATE DATABASE`; chat's Prisma migrations will not create the database either |
| Public access | No |
| Subnet group | `foc-rds` (the existing private-subnet group) |
| Security group | `foc-rds` — already allows 3306 from `foc-tasks` only, so no new rule is needed |
| Parameter group | **`foc-mysql`**, the existing one, which sets `require_secure_transport=1` |
| Backups | Off, to save cost |

No schema bootstrap task is needed. Unlike user, credit and supplier, chat applies its own
migrations: the image's command is `npm run db:deploy && npm start`, like order-service.

> `require_secure_transport=1` is why `DB_SSL=true` in step 5 is not optional. Without it the
> server refuses the connection outright.

### 2b. Database — option B, sharing `foc-supplier-db`

If you share instead: create a `chat_service` database inside `foc-supplier-db`, ideally with its
own login rather than reusing `foc_admin`, and point `DATABASE_URL` at it. Nothing else below
changes — the parameter group already requires TLS, and the security group already allows
`foc-tasks`. Note it in the run checklist so the stop/start cycle does not assume a 5th instance.

## 3. Redis — option A, sharing `foc-order-redis`

Nothing to create. Use the address the other task definitions already use:

```
master.foc-order-redis.ssesaz.apse1.cache.amazonaws.com
```

Add `chat-service` to the list in the run checklist's **Start** step 3, so a changed endpoint
gets picked up here too. Its failure is quiet — chat keeps serving HTTP and only cross-task
realtime delivery stops.

## 4. SSM parameters

**Systems Manager → Parameter Store**, SecureString, Standard tier, following the recorded
`/foc/<service>/<thing>` pattern:

| Parameter | Holds |
|---|---|
| `/foc/chat/database-url` | the full `mysql://foc_admin:<password>@foc-chat-db...:3306/chat_service` — same shape as the existing `/foc/order/database-url` |
| `/foc/chat/service-api-key` | the shared service key *(derived name — confirm it does not clash with whatever `SUPPLIER_ORDER_SERVICE_API_KEY` was given, which postdates the plan's recorded list)* |

Chat adds two parameters. The plan's recorded list predates `SUPPLIER_ORDER_SERVICE_API_KEY`,
so treat the console as the source of truth for the total rather than any number in these docs.

Generate the key with the command chat's own `.env.example` suggests:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`foc-ecs-task-execution` already has `ssm:GetParameters` on `/foc/*`, so no IAM change is needed.

## 5. Task definition

New task definition family `chat-service`. Sizing matches `credit-service` and `order-service`
from the Phase 2 step 15 table — and chat is a Service Connect **server**, which the plan notes
wants the extra headroom for the proxy.

| Setting | Value |
|---|---|
| Launch type | Fargate, X86_64 |
| Task size | **0.5 vCPU / 1 GB** |
| Container port | **3000** |
| Image | `<account>.dkr.ecr.ap-southeast-1.amazonaws.com/foc/chat-service:<sha>` — the workflow swaps only this field |
| Execution role | `foc-ecs-task-execution` |
| Task role | none. Chat touches no S3; only supplier needs `foc-supplier-task` |
| Log group | **`/ecs/foc/chat-service`**, 3-day retention, matching `/ecs/foc/<service>` |
| `initProcessEnabled` | on, as everywhere |
| Service Connect | **client and server**, registering **`chat-service:3000`** — server because `order-worker` and the ALB reach it, client because it fetches user-service's JWKS |

### Environment variables

| Variable | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | Only `user-service` runs `development` |
| `PORT` | `3000` | Schema requires it |
| `DB_SSL` | **`true`** | See the block below |
| `NODE_EXTRA_CA_CERTS` | **`/etc/ssl/rds-ap-southeast-1-bundle.pem`** | See the block below |
| `REDIS_HOST` | `master.foc-order-redis.ssesaz.apse1.cache.amazonaws.com` | Socket.IO adapter |
| `REDIS_PORT` | `6379` | |
| `REDIS_TLS` | **`true`** | See the block below |
| `USER_SERVICE_URL` | `http://user-service:3001` | Optional — the schema defaults to exactly this, and Service Connect reuses the Compose names. Set it explicitly anyway, as the others do |

### Secrets (from SSM, not environment)

| Secret | From |
|---|---|
| `DATABASE_URL` | `/foc/chat/database-url` |
| `CHAT_SERVICE_API_KEY` | `/foc/chat/service-api-key` |

---

> ## ⚠️ Three variables that each break chat silently
>
> None of these produces an error that names the missing variable. All three are defaulted-off
> in code precisely so Compose and CI stay unchanged, which means production must set them.
>
> | Variable | Value | What happens if you miss it |
> |---|---|---|
> | **`DB_SSL`** | `true` | The config schema defaults it to `false`, so chat connects in plaintext to an RDS whose parameter group sets `require_secure_transport=1`. The server rejects the connection and the task crash-loops on a handshake error that looks like a network or credential problem |
> | **`NODE_EXTRA_CA_CERTS`** | `/etc/ssl/rds-ap-southeast-1-bundle.pem` | The image carries the bundle, but **nothing trusts it without this variable.** Measured in the built image: `tls.getCACertificates('extra')` returns **0** without it and **3** with it. The failure is an unknown-CA error during the TLS handshake, which does not point at a missing environment variable |
> | **`REDIS_TLS`** | `true` | Also defaults to `false`, while ElastiCache is created with in-transit encryption **Required**. Chat still serves HTTP, so this one does not crash — only cross-task realtime delivery fails, which looks like a chat bug rather than a config one |
>
> The first two go together: `DB_SSL=true` without the CA path fails to verify, and the CA path
> without `DB_SSL=true` is never consulted.

---

## 6. Target group

**EC2 → Target groups → Create**, matching the five existing ones (`foc-user`, `foc-credit`,
`foc-supplier`, `foc-order`, `foc-frontend`):

| Setting | Value |
|---|---|
| Name | **`foc-chat`** |
| Target type | **IP** |
| Protocol / port | HTTP, `3000` |
| VPC | `foc-vpc` |
| Health check path | **`/health`** |
| Deregistration delay | `30s` |

`/health` is a real endpoint: it runs `SELECT 1` and returns `503 {"status":"error","database":"down"}`
when the database is unreachable, so the target group reflects database health, not just liveness.

## 7. ALB rule — priority 6

On `foc-alb`'s HTTP:80 listener:

| Priority | Paths | Forward to |
|---|---|---|
| **6** | `/chat`, `/chat/*`, `/chat-socket.io`, `/chat-socket.io/*` | `foc-chat` |

Four paths, so it fits the 5-path-per-rule limit in one rule — no need to split it the way
user's six paths were.

**This is the step most likely to be skipped, and chat does not work at all without it.** The
frontend image's nginx does contain `/chat/conversations` and `/chat-socket.io` locations, but
they are dead on Fargate: `resolver 127.0.0.11` is Docker's embedded DNS, which does not exist
there. That is why every other API path has an explicit ALB rule, and chat needs one too.

No listener or CloudFront change is needed for the WebSocket: the ALB handles the upgrade on an
HTTP listener, and CloudFront's `AllViewer` origin request policy with `CachingDisabled` already
carries `wss://` for order-service's `/socket.io`. Chat uses a pure-WebSocket transport with no
polling fallback, so if the upgrade is ever blocked it fails outright rather than degrading.

## 8. ECS service

**ECS → `foc` → Create service**, with the web-service settings from the decisions table:

| Setting | Value |
|---|---|
| Task definition | `chat-service`, latest revision |
| Desired tasks | `1` |
| Subnets / IP | public subnets, public IP **on** |
| Security group | `foc-tasks` |
| Load balancer | `foc-chat` target group |
| Deployment | min healthy **100%**, max **200%**, circuit breaker with rollback |
| Health check grace period | at least `60s` |
| Service Connect | on, as in step 5 |
| **Use log collection** | **off** — leaving it on is the recorded cause of Service Connect tasks failing to start |

Two tasks overlap briefly during a rolling deploy at 200%. That is safe here: the Socket.IO Redis
adapter means a message published by one task reaches sockets held by the other. Note that the
image runs `prisma migrate deploy` on every start, so both tasks may attempt migrations at once —
Prisma takes an advisory lock, so this is safe, but it is worth knowing.

## 9. `order-worker` — do this last

`order-worker` calls chat to create conversations, add participants and send system
notifications (`order-service/src/clients/chat.client.ts`). It needs a new task definition
revision with:

| Variable | Value |
|---|---|
| `CHAT_SERVICE_URL` | `http://chat-service:3000` |
| `CHAT_SERVICE_API_KEY` | from `/foc/chat/service-api-key` — **the same parameter chat-service reads** |

and `chat-service` added as a **Service Connect client** endpoint.

> **`CHAT_SERVICE_API_KEY` must be byte-identical in both services.** Chat compares it with
> `timingSafeEqual` over a SHA-256 digest and also requires the header `x-service-name:
> order-service`. Both variables are `.optional()` in order-service's config schema, so a
> mismatch — or omitting them — **fails silently**: nothing crashes, nothing fails validation,
> system notifications simply never arrive. Point both services at the one SSM parameter rather
> than pasting the value twice.

> **Then force-redeploy `order-worker`** with **Update service → Force new deployment**, *after*
> `chat-service` is running. A Service Connect client only learns the endpoints that existed when
> its task started — the same trap that needed `user-service` restarted so it could find
> `credit-service` (Phase 2 step 19).

## 10. Check

- `foc-chat` target group healthy.
- `chat-service` logs show "All migrations have been successfully applied." then
  `chat-service listening on :3000`.
- Through `https://d2wshq3pru0fir.cloudfront.net`: open a chat, send a message, and confirm it
  arrives in a second browser — that exercises `/chat/conversations` and the `wss://` upgrade on
  `/chat-socket.io`.
- Complete an order and confirm the system notification appears in its chat. That is the
  `order-worker` path from step 9, and the only thing that proves the shared key matches.
- Confirm TLS is genuinely on, the way Phase 4 step 9 does for the others: `SHOW STATUS LIKE
  'Ssl_cipher'` on chat's connection.

## Known gaps, carried over deliberately

- **The `DB_SSL=true` path has never run against a real server.** It could not be tested before
  this instance exists: a self-signed certificate takes a different branch in the driver
  (`ER_SELF_SIGNED`) from the CA-issued one that matters, so a local test would have exercised
  the wrong code. Step 10's `Ssl_cipher` check is the first real proof.
- **The CA bundle is downloaded at build time, unpinned**, with no checksum — matching the other
  four images rather than diverging. A change to AWS's published file changes the image contents.
- `chat-service` has no Compose healthcheck, like `user-service`, `supplier-service` and the
  three workers. Irrelevant to ECS, which uses the target group instead.
