<!--
AI Assistance Disclosure:
Tool: Codex (model: GPT-6), date: 2026-10-13
Scope: Resolved the README log-index merge conflict and added sequential index numbers.
No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review:
Scope (2026-10-22, Claude Code, model: claude-sonnet-5): Added Log index rows #129-130 for
       the user-service docs work (local dev setup guide; merge of jwks-verification-guide.md
       into it). No requirements, architecture, schema, or API decisions were made by the AI
       tool.
Author review:
Scope (2026-10-23, Claude Code, model: claude-sonnet-5): Added Log index row #138 for
       frontend Stage 16c (registration page). No requirements, architecture, schema, or API
       decisions were made by the AI tool.
Author review:
Scope (2026-10-23, Claude Code, model: claude-sonnet-5): Added Log index row #139 for
       frontend Stage 16d (forgot-password page). No requirements, architecture, schema, or
       API decisions were made by the AI tool.
Author review:
Scope (2026-10-23, Claude Code, model: claude-sonnet-5): Added Log index row #140 for
       frontend Stage 16e (account page). No requirements, architecture, schema, or API
       decisions were made by the AI tool.
Author review:
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

| Name      | Role           |
| --------- | -------------- |
| Your Name | Your ownership |
| Your Name | Your ownership |
| Your Name | Your ownership |
| Your Name | Your ownership |
| Your Name | Your ownership |

---

## Repository Structure

This repository follows a **one-service-per-folder** structure: each
microservice (`user-service/`, `supplier-service/`, `order-service/`,
`credit-service/`) lives in its own top-level folder.

```text
.
├── user-service/
├── supplier-service/
├── order-service/
├── credit-service/
├── <n2h-service>/
└── README.md
```

- Any **nice-to-have (N2H)** feature that warrants its own service should
  be added as an **additional folder** at the same level, following the
  same per-service structure.
- Files for agentic coding tools (e.g. agent configs, prompts, skills)
  may be added as needed, but must still **respect the
  one-service-per-folder skeleton** for core implementation.

---

## AI Use Summary

**Tools:** Claude Code (claude-sonnet-5; claude-opus-5 / claude-opus-5-5 for the mockup and order-service scaffolding)
**Prohibited phases avoided:** requirements elicitation; architecture/design decisions.
**Used for:** implementation code, boilerplate/scaffolding, and verification against team-written specifications.
**Verification:** All AI outputs are reviewed, edited, and tested by the authors.
**Prompts / key exchanges:** see [/ai/usage-log.md](ai/usage-log.md) for all services except `foc-mockup/`,
which keeps its own standalone log in [foc-mockup/AI-NOTES.md](foc-mockup/AI-NOTES.md).

### Log index

One row per entry in [/ai/usage-log.md](ai/usage-log.md), newest at the bottom. Keep each summary to one line.

|   # | Date       | Service                | Entry                                                                                              | High-level summary                                                                                                                              |
| --: | ---------- | ---------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | 2026-09-24 | user-service           | Stage 1: Project Scaffold                                                                          | Project scaffold: package.json, tsconfig, ESLint, .env.example, RS256 keys, src layout                                                          |
|   2 | 2026-09-24 | user-service           | Stage 2: Database Setup                                                                            | Postgres schema, Zod-validated config, pg pool                                                                                                  |
|   3 | 2026-09-24 | user-service           | Stage 3: Docker Setup                                                                              | Multi-stage Dockerfile and compose wiring for user-service and user-db                                                                          |
|   4 | 2026-09-25 | user-service           | Stage 4a: App Setup + Middleware                                                                   | Shared auth building blocks (hashing, JWT verify, authenticate, error handler)                                                                  |
|   5 | 2026-09-25 | user-service           | Stage 4b: Registration                                                                             | Registration with validation and duplicate handling                                                                                             |
|   6 | 2026-09-25 | user-service           | Stage 4c: Login + Tokens                                                                           | Login, RS256 access token, hashed refresh token storage                                                                                         |
|   7 | 2026-09-25 | user-service           | Stage 4d: Logout + Refresh                                                                         | Logout and refresh with live status re-check                                                                                                    |
|   8 | 2026-09-25 | user-service           | Stage 4e: Inter-Service Verify + Super Admin Bootstrap                                             | `GET /auth/verify` and startup super admin bootstrap                                                                                            |
|   9 | 2026-09-25 | user-service           | Stage 5a: Schema, Config, Utilities                                                                | `pending` status, OTP config, hash/OTP utilities, transaction helper                                                                            |
|  10 | 2026-09-25 | user-service           | Stage 5b: Email Service                                                                            | Nodemailer OTP email with dev console fallback                                                                                                  |
|  11 | 2026-09-25 | user-service           | Stage 5c: OTP Queries + Service                                                                    | OTP queries, issue/check service, Vitest tests                                                                                                  |
|  12 | 2026-09-25 | user-service           | Stage 5d: Registration Now Creates a Pending Account                                               | Transactional register creating pending user; login rejects pending                                                                             |
|  13 | 2026-09-25 | user-service           | Stage 5e: Verify OTP + Resend OTP Endpoints                                                        | Public verify-otp and resend-otp endpoints with limits and cooldown                                                                             |
|  14 | 2026-09-25 | user-service           | Stage 6 pre-work #1: OTP resend window config                                                      | Added OTP_RESEND_WINDOW_MINUTES to env files and config                                                                                         |
|  15 | 2026-09-25 | user-service           | Stage 6 pre-work #2: Windowed countOtps                                                            | countOtps gains optional rolling-window parameter; registration unchanged                                                                       |
|  16 | 2026-09-25 | user-service           | Stage 6 pre-work #3: checkOtp consume flag                                                         | checkOtp gains optional consume flag; registration unchanged                                                                                    |
|  17 | 2026-09-25 | user-service           | Stage 6 pre-work #4: Forgot Password email template                                                | Added Forgot Password subject and intro to the email template map                                                                               |
|  18 | 2026-09-25 | user-service           | Stage 6 pre-work #6: Login race-safety                                                             | Login creates refresh token under user row lock with hash and status re-check                                                                   |
|  19 | 2026-09-25 | user-service           | Stage 6 pre-work #7: Registration resend-limit message                                             | Updated registration resend-limit message text                                                                                                  |
|  20 | 2026-09-25 | user-service           | Stage 6 pre-work #8: Locked refresh                                                                | Refresh locks user then token in a transaction; lockRefreshToken returns db_now                                                                 |
|  21 | 2026-09-25 | user-service           | Stage 6 pre-work #9: Logout route without authenticate                                             | Logout route no longer requires an access token                                                                                                 |
|  22 | 2026-09-25 | user-service           | Stage 6a: requestOtp                                                                               | Locked, rate-limited OTP request wrapper reporting sent, throttled, no-user, not-verified                                                       |
|  23 | 2026-09-25 | user-service           | Stage 6b: POST /auth/forgot-password                                                               | Forgot-password endpoint using requestOtp with 404, 403 and 429 mapping                                                                         |
|  24 | 2026-09-25 | user-service           | Stage 6c: verify-otp for forgot_password (includes pre-work #5, verify-otp half)                   | verify-otp accepts forgot_password with a non-consuming OTP check                                                                               |
|  25 | 2026-09-25 | user-service           | Stage 6d: POST /auth/reset-password                                                                | Reset-password endpoint consuming the OTP and revoking all refresh tokens                                                                       |
|  26 | 2026-09-25 | supplier-service       | Supplier Service: Architecture Document                                                            | Documented supplied tiered architecture, schema plan, API inventory, and factual gaps                                                           |
|  27 | 2026-09-25 | supplier-service       | Supplier Service: Contract and Schema Clarifications                                               | Recorded supplied endpoints, roles, pagination, soft deletion, and table fields                                                                 |
|  28 | 2026-09-26 | user-service           | Stage 6e: resend-otp for forgot_password (includes pre-work #5, resend-otp half)                   | resend-otp accepts forgot_password by reusing forgot-password logic                                                                             |
|  29 | 2026-09-26 | user-service           | Docs: align instructions.md with the codebase                                                      | Updated package.json block, removed stale note, added Stage 6 status note                                                                       |
|  30 | 2026-09-26 | user-service           | Stage 7: Comprehensive Test Suite (Stages 1-6)                                                     | Vitest suite against a real test DB: unit, integration, HTTP and concurrency tests                                                              |
|  31 | 2026-09-26 | credit-service         | Recess iteration: Credit Service schema, allocation and reservation                                | Postgres schema plus transactional allocate and reserve, each logged in the same commit                                                         |
|  32 | 2026-09-26 | credit-service         | Recess iteration: Credit Service verification run                                                  | Ran schema and suite against a real credit-db; 10 tests pass, concurrency mutation-checked                                                      |
|  33 | 2026-09-26 | supplier-service       | Supplier Service: Photo Management and Concrete Schema                                             | Added multipart photo saga, OAuth assumptions, normalized lookups, and MySQL schema                                                             |
|  34 | 2026-09-26 | supplier-service       | Supplier Service: Traceability Gap Resolution                                                      | Filled supplied query, envelope, visibility, authentication, hours, and API-example details                                                     |
|  35 | 2026-09-27 | user-service           | Stage 8: RBAC Middleware                                                                           | Minimum-role authorize middleware factory with unit tests; not yet wired to routes                                                              |
|  36 | 2026-09-27 | user-service           | Stage 9: Admin Endpoints — View Users, Suspend/Unsuspend                                           | Admin list/get users and suspend/unsuspend endpoints with role rules and tests                                                                  |
|  37 | 2026-09-27 | user-service           | Stage 10: Super Admin — Promote / Demote                                                           | Super admin promote/demote endpoint with self, super admin and non-active guards and tests                                                      |
|  38 | 2026-09-27 | user-service           | Stage 11: Requester/Courier Toggle                                                                 | PUT /users/me/active-view with active_view column; login now returns activeView                                                                 |
|  39 | 2026-09-27 | user-service           | Stage 11b: Test Suite — Requester/Courier Toggle                                                   | Vitest tests for PUT /users/me/active-view, login's activeView, and concurrency                                                                 |
|  40 | 2026-09-27 | user-service           | Stage 12a: GET /users/me                                                                           | View-own-profile endpoint returning username and email only                                                                                     |
|  41 | 2026-09-27 | user-service           | Stage 12b: Change Username                                                                         | PUT /users/me/username with format, unchanged, taken, and race handling                                                                         |
|  42 | 2026-09-27 | user-service           | Stage 12c: Change Email — Initiate                                                                 | PUT /users/me/email sends an OTP to the new email; old email stays authoritative                                                                |
|  43 | 2026-09-27 | user-service           | Stage 12d: /users/me/verify-otp and /users/me/resend-otp                                           | Authenticated OTP routes finalizing email change and resending change_email/password OTPs                                                       |
|  44 | 2026-09-27 | user-service           | Stage 12e: Change Password — Initiate + Confirm                                                    | Two-step password change with OTP, revoking all refresh tokens on success                                                                       |
|  45 | 2026-09-27 | supplier-service       | Supplier Service: Provider-Agnostic Photos and Auth Contract                                       | Recorded provider-neutral photo edits, User Service JWT alignment, and remaining contract gaps                                                  |
|  46 | 2026-09-27 | supplier-service       | Supplier Service: Reference APIs and Photo Consistency Rules                                       | Added lazy-loaded reference APIs, fixed error envelopes, time rules, and photo consistency ordering                                             |
|  47 | 2026-09-27 | supplier-service       | Supplier Service: Redis Worker and Status Mapping Template                                         | Added all-role reference access, status mapping template, and Redis worker flows                                                                |
|  48 | 2026-09-27 | supplier-service       | Supplier Service: Completeness Review and Team-Supplied Clarifications                             | Fixed consistency bugs, ran a completeness review, and recorded concurrency, idempotency, rate-limit, and versioning decisions                  |
|  49 | 2026-09-27 | supplier-service       | Supplier Service: Async Response Timing, Redis Job Contract, and Dead-Letter Table                 | Recorded immediate-response timing, the generic Redis job/retry contract, and the new dead-letter-jobs table                                    |
|  50 | 2026-09-27 | supplier-service       | Supplier Service: Phased Implementation Spec                                                       | Organized the architecture into six build phases mapped to backlog IDs and GitHub issues #40–#46, #60, #61                                      |
|  51 | 2026-09-28 | order-service          | order-service: Prisma Order Seed Fixtures                                                          | Added deterministic fixtures covering statuses, locations, and credit amounts                                                                   |
|  52 | 2026-09-28 | supplier-service       | Supplier Service: API Gateway, Uniqueness Constraint, and Open-Question Resolutions                | Recorded the API-gateway/CORS rationale, a name/type/location uniqueness constraint, and resolved the spec's three open questions               |
|  53 | 2026-09-28 | supplier-service       | Supplier Service: Soft-Delete Recreation Resolved as Reactivation                                  | Recreating a soft-deleted supplier's exact name/type/location now reactivates and updates that row instead of inserting a duplicate             |
|  54 | 2026-09-28 | supplier-service       | Supplier Service: Reactivation Photo Handling Resolved                                             | Photos submitted on the reactivation path now replace the existing supplier's photo rows; no open questions remain                              |
|  55 | 2026-09-28 | supplier-service       | Supplier Service: Tech Stack Recorded in AGENTS.md                                                 | Recorded the team's TypeScript/Node.js/Express.js/MySQL/Redis stack in a new supplier-service AGENTS.md; cross-referenced from the Phase 0 plan |
|  56 | 2026-09-28 | supplier-service       | Supplier Service: `super admin` Role Literal Reconciled After Merging main                         | Fixed a role-string mismatch with user-service's actual `role_enum`; docs and plan now use `super admin` (space)                                |
|  57 | 2026-09-28 | supplier-service       | Supplier Service: Phase 1 Supplier Read APIs Implementation Plan                                   | Wrote the Phase 1 read-endpoint implementation plan; open points flagged for the team                                                           |
|  58 | 2026-09-29 | order-service          | order-service: getOrders Service and Controller Tests                                              | Added service/controller coverage for results, filters, invalid status, and failures                                                            |
|  59 | 2026-09-29 | supplier-service       | Supplier Service: Phase 0 Tasks 6–11 Implementation                                                | Implemented error/rate-limit/auth/role middleware, app wiring, and README for Phase 0                                                           |
|  60 | 2026-09-29 | supplier-service       | Supplier Service: Phase 1 Team Decisions Recorded and Plan Amended                                 | Recorded eight team decisions in the architecture and amended the Phase 1 plan                                                                  |
|  61 | 2026-09-29 | supplier-service       | Supplier Service: Phase 1 Plan's Four Remaining Points Confirmed                                   | Team confirmed isOpen format, in-memory paging, Facility default, and zero-length row handling                                                  |
|  62 | 2026-09-29 | supplier-service       | Supplier Service: Phase 1 Supplier Read APIs Implementation                                        | Implemented Tasks 1-7 (types through app wiring); 101/101 tests passing; Task 8 manual DB check still open                                      |
|  63 | 2026-09-29 | supplier-service       | Supplier Service: Phase 2 Team Decisions Recorded                                                  | Recorded team Phase 2 decisions in architecture and spec; four points still open                                                                |
|  64 | 2026-09-29 | supplier-service       | Supplier Service: Phase 1 Task 8 Manual Verification                                               | Ran the live MySQL/user-service verification; all endpoint checks matched expectations                                                          |
|  65 | 2026-09-29 | supplier-service       | Supplier Service: Phase 2 Team Decisions Recorded (architecture and spec)                          | Recorded team Phase 2 answers and schema changes in architecture and spec; plan not written                                                     |
|  66 | 2026-09-29 | supplier-service       | Supplier Service: Soft Delete Reversed, Facility Hours Entry and Photo Store Recorded              | Reverted soft delete to hard delete across docs, backlog and code; recorded day 8 and photo-store fields                                        |
|  67 | 2026-09-29 | supplier-service       | Supplier Service: Phase 2 Revised Team Decisions Recorded and Photo-Store Compose File             | Recorded revised Phase 2 decisions in docs; added standalone photo-store MySQL compose file                                                     |
|  68 | 2026-09-29 | supplier-service       | Supplier Service: Phase 2 Corrections (soft delete kept, 24/7 hours, photo store ids)              | Kept supplier soft delete, refined 24/7 hours and photo-store ids in docs                                                                       |
|  69 | 2026-09-29 | supplier-service       | Supplier Service: Local Photo Store Switched from MySQL to MinIO                                   | Recorded MinIO as local photo store; replaced the compose file and README section                                                               |
|  70 | 2026-09-29 | supplier-service       | Supplier Service: Phase 1 Hours Update (days 1–7 plus reserved 8) and S3 Client Choice             | Updated is_open and hours schema to days 1-8; recorded AWS S3 client for MinIO                                                                  |
|  71 | 2026-09-29 | supplier-service       | Supplier Service: Phase 2 Schema Migration and Implementation Plan                                 | Added idempotent hours-schema upgrade script; wrote the Phase 2 implementation plan                                                             |
|  72 | 2026-09-29 | supplier-service       | Supplier Service: Phase 2 Plan Choices Accepted, MinIO Test Scope                                  | Accepted plan choices; MinIO now covers real cloud-connection tests in the plan                                                                 |
|  73 | 2026-09-29 | supplier-service       | Supplier Service: Phase 2 Implementation (admin reads, lookups, supplier create)                   | Implemented admin reads, lookup management and multipart supplier create; 210 tests and MinIO tests pass                                        |
|  74 | 2026-09-30 | supplier-service       | Supplier Service: Move Tests into a test/ Folder                                                   | Moved all tests and test helpers from src/ to a mirrored test/ folder; updated configs                                                          |
|  75 | 2026-09-30 | supplier-service       | Phase 3: Admin update (PUT /api/v1/admin/suppliers/:id)                                            | Optimistic-concurrency supplier edit with photo reorder and cleanup-job enqueue                                                                 |
|  76 | 2026-09-30 | supplier-service       | Phase 4: Admin soft-delete, transactional outbox and downstream worker                             | Added soft-delete, transactional outbox, BullMQ worker and container; reworked reactivation                                                     |
|  77 | 2026-09-30 | supplier-service       | Supplier Service: Supplier responses carry location_id, faculty_id and category ids                | Added ids beside names and category objects to supplier responses; tests and docs updated                                                       |
|  78 | 2026-09-30 | supplier-service       | Supplier Service: OpenAPI description and local seed test                                          | OpenAPI file for the supplier endpoints; npm run seed loads mock suppliers via the creation service                                             |
|  79 | 2026-09-30 | frontend               | Frontend: real login and supplier screens on the Supplier Service                                  | Added dev proxy, API client, real login, and supplier and admin screens reading the service                                                     |
|  80 | 2026-09-30 | frontend               | Frontend: fix request flood and lost admin role after reload                                       | Fixed a render loop flooding the list endpoint and restored the role from /auth/verify                                                          |
|  81 | 2026-10-01 | frontend               | Frontend: README with local run guide and photo troubleshooting                                    | Documented mocked vs real run modes, setup, seed and the host.docker.internal fix                                                               |
|  82 | 2026-10-02 | frontend               | Frontend: README section for checking MySQL and MinIO by hand                                      | Added manual MySQL and MinIO verification commands and a working-setup checklist                                                                |
|  83 | 2026-10-02 | frontend               | Frontend: README manual MySQL testing in the supplier-db container                                 | Added an in-container mysql walkthrough pairing app actions with queries to check                                                               |
|  84 | 2026-10-04 | order-service          | Order-service controller test update                                                               | Updated GET /orders tests for the new service result contract and failure responses                                                             |
|  85 | 2026-10-04 | order-service          | Order-service service test update                                                                  | Updated getOrders unit tests for result objects and failure handling                                                                            |
|  86 | 2026-09-25 | user-service           | Stage 5d: Registration Creates a Pending Account                                                   | Transactional register creating pending user; login rejects pending                                                                             |
|  87 | 2026-09-26 | supplier-service       | Photo Management and Concrete Schema                                                               | Added multipart photo saga, OAuth assumptions, normalized lookups, and MySQL schema                                                             |
|  88 | 2026-10-02 | user-service           | User Service: optional seeded normal test user                                                     | Added env-driven startup seeding of a normal user alongside the superadmin                                                                      |
|  89 | 2026-10-02 | frontend               | Frontend: desktop Log out button                                                                   | Added a Log out button to the desktop nav so accounts can be switched                                                                           |
|  90 | 2026-10-06 | order-service          | Order-service pickup endpoint review                                                               | Reviewed pickup endpoint; found error-status mapping and controller test coverage gaps                                                          |
|  91 | 2026-10-07 | order-service          | order-service: transitionOrder test coverage                                                       | Added service and HTTP tests for valid, invalid, and forbidden transitions                                                                      |
|  92 | 2026-10-08 | order-service          | order-service: F17 cancellation test coverage                                                      | Added service and HTTP tests for open and deadline-based requester cancellation                                                                 |
|  93 | 2026-10-12 | order-service          | order-service: edit payload error handling                                                         | Added invalid-field validation and Prisma error mapping for order edits                                                                         |
|  94 | 2026-10-12 | order-service          | Order edit optimistic locking: Version check and update                                            | Added atomic version check/increment and conflict tests for order edits                                                                         |
|  95 | 2026-10-12 | order-service          | order-service: edit-order test coverage                                                            | Updated fixtures and added service/HTTP coverage for order edits                                                                                |
|  96 | 2026-10-16 | frontend               | Frontend: Docker Compose development setup                                                         | Added a frontend dev container, Compose Watch rules, and container-aware Vite proxy targets                                                     |
|  97 | 2026-10-16 | credit-service         | Week 7/8 catch-up: transfer, release, balance read and append-only enforcement                     | Transfer, release and balance endpoints; append-only enforced by database privilege                                                             |
|  98 | 2026-10-17 | user-service           | Stage 13: Auth Distribution Plan — JWKS Recorded in instructions.md                                | Recorded the team's JWKS auth-distribution decisions as Stage 13 in instructions.md                                                             |
|  99 | 2026-10-17 | user-service           | Stage 13a: Per-Key Config + Sign/Verify by `kid`                                                   | Added JWT_KEY_ID config and kid-based sign/verify plus getJwks() in jwt.ts                                                                      |
| 100 | 2026-10-17 | user-service           | Stage 13b/13c: JWKS Endpoint, Remove GET /auth/verify, Test Cleanup                                | Added GET /auth/.well-known/jwks.json, removed GET /auth/verify, updated tests                                                                  |
| 101 | 2026-10-17 | user-service           | Stage 13d: JWKS Verification Guide for Order/Supplier/Credit Implementers                          | Wrote a JWKS-consumption guide under user-service/docs, no other services' files touched                                                        |
| 102 | 2026-10-19 | credit-service         | Credit Service D3 iteration 2: JWKS auth, transaction history, frontend wiring, public user lookup | JWKS token verification, paged transaction history, the Wallet page on the live API, and a public user lookup in user-service                   |
| 103 | 2026-10-16 | frontend               | Frontend: order-service request board                                                              | Replaced demo request data with live order-service GET /orders data                                                                             |
| 104 | 2026-10-19 | frontend               | Frontend: Docker proxy target restoration                                                          | Restored environment-configured Vite proxy targets for host and Compose development                                                             |
| 105 | 2026-10-20 | supplier-service       | Supplier Service: JWKS token verification                                                          | Replaced per-request auth verification with cached JWKS and local RS256 validation                                                              |
| 106 | 2026-10-20 | frontend               | Frontend: Post errand through Order Service                                                        | Connected the Create Request button to POST /orders with loading and error handling                                                             |
| 107 | 2026-10-20 | order-service          | Order Service: JWKS authentication middleware                                                      | Added cached JWKS Bearer authentication and switched controllers to verified request identities                                                 |
| 108 | 2026-10-20 | order-service          | Order Service: Integer supplier identifiers                                                        | Aligned supplier IDs with Supplier Service integer identifiers across schema, validation, fixtures, and frontend submission                     |
| 109 | 2026-10-20 | frontend               | Frontend: Live activity from microservices                                                         | Replaced demo Activity data with live orders, supplier details, and persisted status transitions                                                |
| 110 | 2026-10-20 | frontend               | Frontend: Edit open errand                                                                         | Added an edit route and reused the request form without changing credits                                                                        |
| 111 | 2026-10-20 | frontend/order-service | Frontend and Order Service: Accept errand                                                          | Connected RequestCard acceptance to POST /orders/:id/accept                                                                                     |
| 112 | 2026-10-20 | order-service          | Order Service #4: Credit reservation saga (pending orders, outbox, worker reserve/release)         | Pending orders with outbox-driven credit reserve/release in the worker, dead-letter on failure                                                  |
| 113 | 2026-10-20 | order-service          | Order Service #4: Automatic re-drive of transient credit-release dead letters                      | Minute-by-minute re-drive of transient credit_release dead letters back through the outbox                                                      |
| 114 | 2026-10-20 | order-service          | Order Service #5: Accept request + validation                                                      | POST /orders/:id/accept with 403 self-accept, 409 expired/assigned/conflict, optimistic lock                                                    |
| 115 | 2026-10-20 | order-service          | Order Service #11: Listing filters, keyset pagination, location ids                                | Filter registry, cursor pagination of 50, configurable sort, deliveryLocationId replaces free text                                              |
| 116 | 2026-10-20 | order-service          | Order Service #6/#59: Socket.IO order events, JWT auth, active deliveries                          | Socket.IO rooms and order events, handshake auth via Wen Xi's JWKS check, worker events via Redis                                               |
| 117 | 2026-10-20 | frontend               | Frontend: Order Service integration (create, live board, activity, Socket.IO client)               | GET /orders/mine; create/accept/lifecycle calls, live board and activity over Socket.IO, edit page kept                                         |
| 118 | 2026-10-20 | order-service          | Order Service: `failed` status for failed reservations; login prompt on reload                     | pending -> failed with order:failed, hidden from /orders/mine and listing; login prompt waits for session                                       |
| 119 | 2026-10-20 | order-service          | Order Service: F18.1.1 edit only when open; F9.1.1 optional additional details                     | Edit refused with 409 unless open; additionalDetails optional on create                                                                         |
| 120 | 2026-10-20 | order-service/frontend | Order Service + Frontend: rebase onto PR #115 (Wen Xi's auth, supplier ids, edit page)             | Kept Wen Xi's auth and INTEGER supplierId, carried her edit page onto our form, rebased the stack                                               |
| 121 | 2026-10-20 | order-service          | Order Service: deliveryLocationId as INTEGER; full edit validation                                 | deliveryLocationId INTEGER like supplierId; edit validates every field with create's rules                                                      |
| 122 | 2026-10-21 | user-service           | Stage 14a: Schema + Config                                                                         | Credit-allocation outbox table/enum and CREDIT_SERVICE_URL config, no behavior wired yet                                                        |
| 123 | 2026-10-21 | user-service           | Stage 14b: Outbox Queries                                                                          | Outbox query functions: insert, find-due, mark-sent/dead, record-failure with SQL backoff, replay                                               |
| 124 | 2026-10-21 | user-service           | Stage 14c: The Relay                                                                               | Outbox delivery relay (poll/batch/backoff/dead-letter) started from server.ts after bootstrap                                                   |
| 125 | 2026-10-21 | user-service           | Stage 14d: Wire Into Activation and Bootstrap                                                      | Outbox row inserted on registration activation and super-admin creation, same transaction                                                       |
| 126 | 2026-10-21 | user-service           | Stage 14e: Replay Script                                                                           | npm run outbox:replay resets dead outbox rows by id or --all-dead                                                                               |
| 127 | 2026-10-21 | order-service          | Order Service: credit transfer job on completion (queue:credit:transfer)                           | Completion queues credit_transfer { requestId, courierId } to credit-service's queue via the outbox                                             |
| 128 | 2026-10-22 | credit-service         | Credit Service: BullMQ credit-transfer queue consumer                                              | Separate worker container consuming queue:credit:transfer, with dead_letter_jobs and append-only grants intact                                  |
| 129 | 2026-10-22 | user-service           | User Service: local dev setup guide for CREDIT_SERVICE_URL / SUPER_ADMIN_PASSWORD / JWT keypair    | Wrote docs/local-dev-setup.md; declined a compose.yaml edit that deviated from the env_file design                                              |
| 130 | 2026-10-22 | user-service           | User Service: merge jwks-verification-guide.md into local-dev-setup.md                             | Combined the two docs into one file; updated three cross-service path references                                                                |
| 131 | 2026-10-22 | user-service           | User Service: Docker-dependent verification of Stage 14 (outbox/relay/replay)                      | Verified 14a-14e against real containers; fixed a pool.ts crash bug found during testing                                                        |
| 132 | 2026-10-22 | user-service           | Stage 15a: `activeView` on `GET /users/me`                                                         | getOwnProfile now also returns activeView; flagged an unrelated stale test in email.service                                                    |
| 133 | 2026-10-22 | user-service           | Fix: `bootstrapTestUser` missing credit-allocation outbox row                                      | Seeded test user now gets a credit_allocation_outbox row, same transaction as bootstrapSuperAdmin                                               |
| 134 | 2026-10-22 | user-service           | Fix: test coverage for the credit-allocation outbox row on `bootstrapTestUser`                     | Added a test and a db helper asserting the seeded test user gets one pending outbox row                                                        |
| 135 | 2026-10-22 | user-service           | Stage 15b: Paginated `GET /users`                                                                  | listUsers is now paginated/searchable/filterable/sortable; returns { users, page, pageSize, total, totalPages }                                 |
| 136 | 2026-10-22 | user-service           | Stage 15c: camelCase Responses                                                                     | All user-row responses now camelCase via toUserResponse; fixed an unrelated missing Change Password email template |
| 137 | 2026-10-23 | frontend               | Stage 16b: Shared Auth Plumbing                                                                    | New AuthContext/login page/route guards/toast/OTP input replace LoginModal; proactive token refresh |
| 138 | 2026-10-23 | frontend               | Stage 16c: Registration (`/register`)                                                              | New two-step register page (form + OTP) wired to /auth/register, verify-otp, resend-otp            |
| 139 | 2026-10-23 | frontend               | Stage 16d: Forgot Password (`/forgot-password`)                                                    | New three-step forgot-password page wired to /auth/forgot-password, verify-otp, reset-password      |
| 140 | 2026-10-23 | frontend               | Stage 16e: Account Page (`/account`)                                                                | New account page (username/email/password changes); fixed a forced-relogin banner race bug          |
