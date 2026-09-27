# CS3219 — Software Design and Architecture (AY2627 Sem 1)

## Friend on Campus (FoC)

**Friend on Campus (FoC)** is a peer-to-peer campus errand platform where
students can request items to be collected from stores or facilities on
campus, and other students can fulfil (and deliver) those requests. The
platform runs on a closed credit economy — credits cannot be bought,
withdrawn, or exchanged for money, and only circulate within the platform.

---

## Team Members

| Name | Role |
| ----- | ----- |
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

| Date | Service | Entry | High-level summary |
| ---- | ------- | ----- | ------------------ |
| 2026-09-24 | user-service | Stage 1: Project Scaffold | Project scaffold: package.json, tsconfig, ESLint, .env.example, RS256 keys, src layout |
| 2026-09-24 | user-service | Stage 2: Database Setup | Postgres schema, Zod-validated config, pg pool |
| 2026-09-24 | user-service | Stage 3: Docker Setup | Multi-stage Dockerfile and compose wiring for user-service and user-db |
| 2026-09-25 | user-service | Stage 4a: App Setup + Middleware | Shared auth building blocks (hashing, JWT verify, authenticate, error handler) |
| 2026-09-25 | user-service | Stage 4b: Registration | Registration with validation and duplicate handling |
| 2026-09-25 | user-service | Stage 4c: Login + Tokens | Login, RS256 access token, hashed refresh token storage |
| 2026-09-25 | user-service | Stage 4d: Logout + Refresh | Logout and refresh with live status re-check |
| 2026-09-25 | user-service | Stage 4e: Inter-Service Verify + Super Admin Bootstrap | `GET /auth/verify` and startup super admin bootstrap |
| 2026-09-25 | user-service | Stage 5a: Schema, Config, Utilities | `pending` status, OTP config, hash/OTP utilities, transaction helper |
| 2026-09-25 | user-service | Stage 5b: Email Service | Nodemailer OTP email with dev console fallback |
| 2026-09-25 | user-service | Stage 5c: OTP Queries + Service | OTP queries, issue/check service, Vitest tests |
| 2026-09-25 | user-service | Stage 5d: Registration Creates a Pending Account | Transactional register creating pending user; login rejects pending |
| 2026-09-25 | user-service | Stage 5e: Verify OTP + Resend OTP Endpoints | Public verify-otp and resend-otp endpoints with limits and cooldown |
| 2026-09-25 | user-service | Stage 5d: Registration Creates a Pending Account | Transactional registration with pending accounts and OTP issuance |
| 2026-09-25 | user-service | Stage 5e: Verify OTP + Resend OTP Endpoints | Public OTP verification and resend endpoints with limits |
| 2026-09-25 | supplier-service | Supplier Service: Architecture Document | Documented supplied tiered architecture, schema plan, API inventory, and factual gaps |
| 2026-09-25 | supplier-service | Supplier Service: Contract and Schema Clarifications | Recorded supplied endpoints, roles, pagination, soft deletion, and table fields |
| 2026-09-26 | supplier-service | Supplier Service: Traceability Gap Resolution | Filled supplied query, envelope, visibility, authentication, hours, and API-example details |
| 2026-09-26 | supplier-service | Photo Management and Concrete Schema | Added multipart photo saga, OAuth assumptions, normalized lookups, and MySQL schema |
| 2026-09-27 | supplier-service | Supplier Service: Provider-Agnostic Photos and Auth Contract | Recorded provider-neutral photo edits, User Service JWT alignment, and remaining contract gaps |
| 2026-09-27 | supplier-service | Supplier Service: Reference APIs and Photo Consistency Rules | Added lazy-loaded reference APIs, fixed error envelopes, time rules, and photo consistency ordering |
| 2026-09-27 | supplier-service | Supplier Service: Redis Worker and Status Mapping Template | Added all-role reference access, status mapping template, and Redis worker flows |
| 2026-09-27 | supplier-service | Supplier Service: Completeness Review and Team-Supplied Clarifications | Fixed consistency bugs, ran a completeness review, and recorded concurrency, idempotency, rate-limit, and versioning decisions |
| 2026-09-27 | supplier-service | Supplier Service: Async Response Timing, Redis Job Contract, and Dead-Letter Table | Recorded immediate-response timing, the generic Redis job/retry contract, and the new dead-letter-jobs table |
