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

| Date       | Service          | Entry                                                                                  | High-level summary                                                                                                                              |
| ---------- | ---------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-24 | user-service     | Stage 1: Project Scaffold                                                              | Project scaffold: package.json, tsconfig, ESLint, .env.example, RS256 keys, src layout                                                          |
| 2026-09-24 | user-service     | Stage 2: Database Setup                                                                | Postgres schema, Zod-validated config, pg pool                                                                                                  |
| 2026-09-24 | user-service     | Stage 3: Docker Setup                                                                  | Multi-stage Dockerfile and compose wiring for user-service and user-db                                                                          |
| 2026-09-25 | user-service     | Stage 4a: App Setup + Middleware                                                       | Shared auth building blocks (hashing, JWT verify, authenticate, error handler)                                                                  |
| 2026-09-25 | user-service     | Stage 4b: Registration                                                                 | Registration with validation and duplicate handling                                                                                             |
| 2026-09-25 | user-service     | Stage 4c: Login + Tokens                                                               | Login, RS256 access token, hashed refresh token storage                                                                                         |
| 2026-09-25 | user-service     | Stage 4d: Logout + Refresh                                                             | Logout and refresh with live status re-check                                                                                                    |
| 2026-09-25 | user-service     | Stage 4e: Inter-Service Verify + Super Admin Bootstrap                                 | `GET /auth/verify` and startup super admin bootstrap                                                                                            |
| 2026-09-25 | user-service     | Stage 5a: Schema, Config, Utilities                                                    | `pending` status, OTP config, hash/OTP utilities, transaction helper                                                                            |
| 2026-09-25 | user-service     | Stage 5b: Email Service                                                                | Nodemailer OTP email with dev console fallback                                                                                                  |
| 2026-09-25 | user-service     | Stage 5c: OTP Queries + Service                                                        | OTP queries, issue/check service, Vitest tests                                                                                                  |
| 2026-09-25 | user-service     | Stage 5d: Registration Now Creates a Pending Account                                   | Transactional register creating pending user; login rejects pending                                                                             |
| 2026-09-25 | user-service     | Stage 5e: Verify OTP + Resend OTP Endpoints                                            | Public verify-otp and resend-otp endpoints with limits and cooldown                                                                             |
| 2026-09-25 | user-service     | Stage 6 pre-work #1: OTP resend window config                                          | Added OTP_RESEND_WINDOW_MINUTES to env files and config                                                                                         |
| 2026-09-25 | user-service     | Stage 6 pre-work #2: Windowed countOtps                                                | countOtps gains optional rolling-window parameter; registration unchanged                                                                       |
| 2026-09-25 | user-service     | Stage 6 pre-work #3: checkOtp consume flag                                             | checkOtp gains optional consume flag; registration unchanged                                                                                    |
| 2026-09-25 | user-service     | Stage 6 pre-work #4: Forgot Password email template                                    | Added Forgot Password subject and intro to the email template map                                                                               |
| 2026-09-25 | user-service     | Stage 6 pre-work #6: Login race-safety                                                 | Login creates refresh token under user row lock with hash and status re-check                                                                   |
| 2026-09-25 | user-service     | Stage 6 pre-work #7: Registration resend-limit message                                 | Updated registration resend-limit message text                                                                                                  |
| 2026-09-25 | user-service     | Stage 6 pre-work #8: Locked refresh                                                    | Refresh locks user then token in a transaction; lockRefreshToken returns db_now                                                                 |
| 2026-09-25 | user-service     | Stage 6 pre-work #9: Logout route without authenticate                                 | Logout route no longer requires an access token                                                                                                 |
| 2026-09-25 | user-service     | Stage 6a: requestOtp                                                                   | Locked, rate-limited OTP request wrapper reporting sent, throttled, no-user, not-verified                                                       |
| 2026-09-25 | user-service     | Stage 6b: POST /auth/forgot-password                                                   | Forgot-password endpoint using requestOtp with 404, 403 and 429 mapping                                                                         |
| 2026-09-25 | user-service     | Stage 6c: verify-otp for forgot_password (includes pre-work #5, verify-otp half)       | verify-otp accepts forgot_password with a non-consuming OTP check                                                                               |
| 2026-09-25 | user-service     | Stage 6d: POST /auth/reset-password                                                    | Reset-password endpoint consuming the OTP and revoking all refresh tokens                                                                       |
| 2026-09-25 | supplier-service | Supplier Service: Architecture Document                                                | Documented supplied tiered architecture, schema plan, API inventory, and factual gaps                                                           |
| 2026-09-25 | supplier-service | Supplier Service: Contract and Schema Clarifications                                   | Recorded supplied endpoints, roles, pagination, soft deletion, and table fields                                                                 |
| 2026-09-26 | user-service     | Stage 6e: resend-otp for forgot_password (includes pre-work #5, resend-otp half)       | resend-otp accepts forgot_password by reusing forgot-password logic                                                                             |
| 2026-09-26 | user-service     | Docs: align instructions.md with the codebase                                          | Updated package.json block, removed stale note, added Stage 6 status note                                                                       |
| 2026-09-26 | user-service     | Stage 7: Comprehensive Test Suite (Stages 1-6)                                         | Vitest suite against a real test DB: unit, integration, HTTP and concurrency tests                                                              |
| 2026-09-26 | credit-service   | Recess iteration: Credit Service schema, allocation and reservation                    | Postgres schema plus transactional allocate and reserve, each logged in the same commit                                                         |
| 2026-09-26 | credit-service   | Recess iteration: Credit Service verification run                                      | Ran schema and suite against a real credit-db; 10 tests pass, concurrency mutation-checked                                                      |
| 2026-09-26 | supplier-service | Supplier Service: Photo Management and Concrete Schema                                 | Added multipart photo saga, OAuth assumptions, normalized lookups, and MySQL schema                                                             |
| 2026-09-26 | supplier-service | Supplier Service: Traceability Gap Resolution                                          | Filled supplied query, envelope, visibility, authentication, hours, and API-example details                                                     |
| 2026-09-27 | user-service     | Stage 8: RBAC Middleware                                                               | Minimum-role authorize middleware factory with unit tests; not yet wired to routes                                                              |
| 2026-09-27 | user-service     | Stage 9: Admin Endpoints — View Users, Suspend/Unsuspend                               | Admin list/get users and suspend/unsuspend endpoints with role rules and tests                                                                  |
| 2026-09-27 | user-service     | Stage 10: Super Admin — Promote / Demote                                               | Super admin promote/demote endpoint with self, super admin and non-active guards and tests                                                      |
| 2026-09-27 | user-service     | Stage 11: Requester/Courier Toggle                                                     | PUT /users/me/active-view with active_view column; login now returns activeView                                                                 |
| 2026-09-27 | user-service     | Stage 11b: Test Suite — Requester/Courier Toggle                                       | Vitest tests for PUT /users/me/active-view, login's activeView, and concurrency                                                                 |
| 2026-09-27 | user-service     | Stage 12a: GET /users/me                                                               | View-own-profile endpoint returning username and email only                                                                                     |
| 2026-09-27 | user-service     | Stage 12b: Change Username                                                             | PUT /users/me/username with format, unchanged, taken, and race handling                                                                         |
| 2026-09-27 | user-service     | Stage 12c: Change Email — Initiate                                                     | PUT /users/me/email sends an OTP to the new email; old email stays authoritative                                                                |
| 2026-09-27 | user-service     | Stage 12d: /users/me/verify-otp and /users/me/resend-otp                               | Authenticated OTP routes finalizing email change and resending change_email/password OTPs                                                       |
| 2026-09-27 | user-service     | Stage 12e: Change Password — Initiate + Confirm                                        | Two-step password change with OTP, revoking all refresh tokens on success                                                                       |
| 2026-09-27 | supplier-service | Supplier Service: Provider-Agnostic Photos and Auth Contract                           | Recorded provider-neutral photo edits, User Service JWT alignment, and remaining contract gaps                                                  |
| 2026-09-27 | supplier-service | Supplier Service: Reference APIs and Photo Consistency Rules                           | Added lazy-loaded reference APIs, fixed error envelopes, time rules, and photo consistency ordering                                             |
| 2026-09-27 | supplier-service | Supplier Service: Redis Worker and Status Mapping Template                             | Added all-role reference access, status mapping template, and Redis worker flows                                                                |
| 2026-09-27 | supplier-service | Supplier Service: Completeness Review and Team-Supplied Clarifications                 | Fixed consistency bugs, ran a completeness review, and recorded concurrency, idempotency, rate-limit, and versioning decisions                  |
| 2026-09-27 | supplier-service | Supplier Service: Async Response Timing, Redis Job Contract, and Dead-Letter Table     | Recorded immediate-response timing, the generic Redis job/retry contract, and the new dead-letter-jobs table                                    |
| 2026-09-27 | supplier-service | Supplier Service: Phased Implementation Spec                                           | Organized the architecture into six build phases mapped to backlog IDs and GitHub issues #40–#46, #60, #61                                      |
| 2026-09-28 | supplier-service | Supplier Service: API Gateway, Uniqueness Constraint, and Open-Question Resolutions    | Recorded the API-gateway/CORS rationale, a name/type/location uniqueness constraint, and resolved the spec's three open questions               |
| 2026-09-28 | supplier-service | Supplier Service: Soft-Delete Recreation Resolved as Reactivation                      | Recreating a soft-deleted supplier's exact name/type/location now reactivates and updates that row instead of inserting a duplicate             |
| 2026-09-28 | supplier-service | Supplier Service: Reactivation Photo Handling Resolved                                 | Photos submitted on the reactivation path now replace the existing supplier's photo rows; no open questions remain                              |
| 2026-09-28 | supplier-service | Supplier Service: Tech Stack Recorded in AGENTS.md                                     | Recorded the team's TypeScript/Node.js/Express.js/MySQL/Redis stack in a new supplier-service AGENTS.md; cross-referenced from the Phase 0 plan |
| 2026-09-28 | supplier-service | Supplier Service: `super admin` Role Literal Reconciled After Merging main             | Fixed a role-string mismatch with user-service's actual `role_enum`; docs and plan now use `super admin` (space)                                |
| 2026-09-28 | supplier-service | Supplier Service: Phase 1 Supplier Read APIs Implementation Plan                       | Wrote the Phase 1 read-endpoint implementation plan; open points flagged for the team                                                           |
| 2026-09-29 | supplier-service | Supplier Service: Phase 0 Tasks 6–11 Implementation                                    | Implemented error/rate-limit/auth/role middleware, app wiring, and README for Phase 0                                                           |
| 2026-09-29 | supplier-service | Supplier Service: Phase 1 Team Decisions Recorded and Plan Amended                     | Recorded eight team decisions in the architecture and amended the Phase 1 plan                                                                  |
| 2026-09-29 | supplier-service | Supplier Service: Phase 1 Plan's Four Remaining Points Confirmed                       | Team confirmed isOpen format, in-memory paging, Facility default, and zero-length row handling                                                  |
| 2026-09-29 | supplier-service | Supplier Service: Phase 1 Supplier Read APIs Implementation                            | Implemented Tasks 1-7 (types through app wiring); 101/101 tests passing; Task 8 manual DB check still open                                      |
| 2026-09-29 | supplier-service | Supplier Service: Phase 2 Team Decisions Recorded                                      | Recorded team Phase 2 decisions in architecture and spec; four points still open                                                                |
| 2026-09-29 | supplier-service | Supplier Service: Phase 1 Task 8 Manual Verification                                   | Ran the live MySQL/user-service verification; all endpoint checks matched expectations                                                          |
| 2026-09-29 | supplier-service | Supplier Service: Phase 2 Team Decisions Recorded (architecture and spec)              | Recorded team Phase 2 answers and schema changes in architecture and spec; plan not written                                                     |
| 2026-09-29 | supplier-service | Supplier Service: Soft Delete Reversed, Facility Hours Entry and Photo Store Recorded  | Reverted soft delete to hard delete across docs, backlog and code; recorded day 8 and photo-store fields                                        |
| 2026-09-29 | supplier-service | Supplier Service: Phase 2 Revised Team Decisions Recorded and Photo-Store Compose File | Recorded revised Phase 2 decisions in docs; added standalone photo-store MySQL compose file                                                     |
| 2026-09-29 | supplier-service | Supplier Service: Phase 2 Corrections (soft delete kept, 24/7 hours, photo store ids)  | Kept supplier soft delete, refined 24/7 hours and photo-store ids in docs                                                                       |
| 2026-09-29 | supplier-service | Supplier Service: Local Photo Store Switched from MySQL to MinIO                       | Recorded MinIO as local photo store; replaced the compose file and README section                                                               |
| 2026-09-29 | supplier-service | Supplier Service: Phase 1 Hours Update (days 1–7 plus reserved 8) and S3 Client Choice | Updated is_open and hours schema to days 1-8; recorded AWS S3 client for MinIO                                                                  |
| 2026-09-29 | supplier-service | Supplier Service: Phase 2 Schema Migration and Implementation Plan                     | Added idempotent hours-schema upgrade script; wrote the Phase 2 implementation plan                                                             |
| 2026-09-29 | supplier-service | Supplier Service: Phase 2 Plan Choices Accepted, MinIO Test Scope                      | Accepted plan choices; MinIO now covers real cloud-connection tests in the plan                                                                 |
| 2026-09-29 | supplier-service | Supplier Service: Phase 2 Implementation (admin reads, lookups, supplier create)       | Implemented admin reads, lookup management and multipart supplier create; 210 tests and MinIO tests pass                                        |
| 2026-09-30 | supplier-service | Supplier Service: Move Tests into a test/ Folder                                       | Moved all tests and test helpers from src/ to a mirrored test/ folder; updated configs                                                          |
| 2026-09-28 | order-service    | order-service: Prisma Order Seed Fixtures                                              | Added deterministic fixtures covering statuses, locations, and credit amounts                                                                   |
| 2026-09-29 | order-service    | order-service: getOrders Service and Controller Tests                                  | Added service/controller coverage for results, filters, invalid status, and failures                                                            |
| 2026-09-30 | supplier-service | Phase 3: Admin update (PUT /api/v1/admin/suppliers/:id)                                | Optimistic-concurrency supplier edit with photo reorder and cleanup-job enqueue                                                                 |
| 2026-09-30 | supplier-service | Phase 4: Admin soft-delete, transactional outbox and downstream worker                 | Added soft-delete, transactional outbox, BullMQ worker and container; reworked reactivation                                                     |
| 2026-09-30 | supplier-service | Supplier Service: Supplier responses carry location_id, faculty_id and category ids    | Added ids beside names and category objects to supplier responses; tests and docs updated                                                       |
| 2026-09-30 | supplier-service | Supplier Service: OpenAPI description and local seed test                              | OpenAPI file for the supplier endpoints; npm run seed loads mock suppliers via the creation service                                             |
| 2026-09-30 | frontend         | Frontend: real login and supplier screens on the Supplier Service                      | Added dev proxy, API client, real login, and supplier and admin screens reading the service                                                     |
| 2026-09-30 | frontend         | Frontend: fix request flood and lost admin role after reload                           | Fixed a render loop flooding the list endpoint and restored the role from /auth/verify                                                          |
| 2026-10-01 | frontend         | Frontend: README with local run guide and photo troubleshooting                        | Documented mocked vs real run modes, setup, seed and the host.docker.internal fix                                                               |
| 2026-10-02 | frontend         | Frontend: README section for checking MySQL and MinIO by hand                          | Added manual MySQL and MinIO verification commands and a working-setup checklist                                                                |
| 2026-10-02 | frontend         | Frontend: README manual MySQL testing in the supplier-db container                     | Added an in-container mysql walkthrough pairing app actions with queries to check                                                               |
| 2026-10-04 | order-service    | Order-service controller test update                                                   | Updated GET /orders tests for the new service result contract and failure responses                                                             |
| 2026-10-04 | order-service    | Order-service service test update                                                      | Updated getOrders unit tests for result objects and failure handling                                                                            |
| 2026-10-06 | order-service    | Order-service pickup endpoint review                                                   | Reviewed pickup endpoint; found error-status mapping and controller test coverage gaps                                                          |
| 2026-10-07 | order-service    | order-service: transitionOrder test coverage                                           | Added service and HTTP tests for valid, invalid, and forbidden transitions                                                                      |
| 2026-10-08 | order-service    | order-service: F17 cancellation test coverage                                          | Added service and HTTP tests for open and deadline-based requester cancellation                                                                 |
