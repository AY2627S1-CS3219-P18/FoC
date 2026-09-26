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

| Date       | Service      | Entry                                                                            | High-level summary                                                                        |
| ---------- | ------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 2026-09-24 | user-service | Stage 1: Project Scaffold                                                        | Project scaffold: package.json, tsconfig, ESLint, .env.example, RS256 keys, src layout    |
| 2026-09-24 | user-service | Stage 2: Database Setup                                                          | Postgres schema, Zod-validated config, pg pool                                            |
| 2026-09-24 | user-service | Stage 3: Docker Setup                                                            | Multi-stage Dockerfile and compose wiring for user-service and user-db                    |
| 2026-09-25 | user-service | Stage 4a: App Setup + Middleware                                                 | Shared auth building blocks (hashing, JWT verify, authenticate, error handler)            |
| 2026-09-25 | user-service | Stage 4b: Registration                                                           | Registration with validation and duplicate handling                                       |
| 2026-09-25 | user-service | Stage 4c: Login + Tokens                                                         | Login, RS256 access token, hashed refresh token storage                                   |
| 2026-09-25 | user-service | Stage 4d: Logout + Refresh                                                       | Logout and refresh with live status re-check                                              |
| 2026-09-25 | user-service | Stage 4e: Inter-Service Verify + Super Admin Bootstrap                           | `GET /auth/verify` and startup super admin bootstrap                                      |
| 2026-09-25 | user-service | Stage 5a: Schema, Config, Utilities                                              | `pending` status, OTP config, hash/OTP utilities, transaction helper                      |
| 2026-09-25 | user-service | Stage 5b: Email Service                                                          | Nodemailer OTP email with dev console fallback                                            |
| 2026-09-25 | user-service | Stage 5c: OTP Queries + Service                                                  | OTP queries, issue/check service, Vitest tests                                            |
| 2026-09-25 | user-service | Stage 5d: Registration Creates a Pending Account                                 | Transactional register creating pending user; login rejects pending                       |
| 2026-09-25 | user-service | Stage 5e: Verify OTP + Resend OTP Endpoints                                      | Public verify-otp and resend-otp endpoints with limits and cooldown                       |
| 2026-09-25 | user-service | Stage 6 pre-work #1: OTP resend window config                                    | Added OTP_RESEND_WINDOW_MINUTES to env files and config                                   |
| 2026-09-25 | user-service | Stage 6 pre-work #2: Windowed countOtps                                          | countOtps gains optional rolling-window parameter; registration unchanged                 |
| 2026-09-25 | user-service | Stage 6 pre-work #3: checkOtp consume flag                                       | checkOtp gains optional consume flag; registration unchanged                              |
| 2026-09-25 | user-service | Stage 6 pre-work #4: Forgot Password email template                              | Added Forgot Password subject and intro to the email template map                         |
| 2026-09-25 | user-service | Stage 6 pre-work #6: Login race-safety                                           | Login creates refresh token under user row lock with hash and status re-check             |
| 2026-09-25 | user-service | Stage 6 pre-work #7: Registration resend-limit message                           | Updated registration resend-limit message text                                            |
| 2026-09-25 | user-service | Stage 6 pre-work #8: Locked refresh                                              | Refresh locks user then token in a transaction; lockRefreshToken returns db_now           |
| 2026-09-25 | user-service | Stage 6 pre-work #9: Logout route without authenticate                           | Logout route no longer requires an access token                                           |
| 2026-09-25 | user-service | Stage 6a: requestOtp                                                             | Locked, rate-limited OTP request wrapper reporting sent, throttled, no-user, not-verified |
| 2026-09-25 | user-service | Stage 6b: POST /auth/forgot-password                                             | Forgot-password endpoint using requestOtp with 404, 403 and 429 mapping                   |
| 2026-09-25 | user-service | Stage 6c: verify-otp for forgot_password (includes pre-work #5, verify-otp half) | verify-otp accepts forgot_password with a non-consuming OTP check                         |
| 2026-09-25 | user-service | Stage 6d: POST /auth/reset-password                                              | Reset-password endpoint consuming the OTP and revoking all refresh tokens                 |
| 2026-09-26 | user-service | Stage 6e: resend-otp for forgot_password (includes pre-work #5, resend-otp half) | resend-otp accepts forgot_password by reusing forgot-password logic                       |
| 2026-09-26 | user-service | Docs: align instructions.md with the codebase                                    | Updated package.json block, removed stale note, added Stage 6 status note                 |
| 2026-09-26 | user-service | Stage 7: Comprehensive Test Suite (Stages 1-6)                                   | Vitest suite against a real test DB: unit, integration, HTTP and concurrency tests       |
| 2026-09-26 | credit-service | Recess iteration: Credit Service schema, allocation and reservation            | Postgres schema plus transactional allocate and reserve, each logged in the same commit   |
| 2026-09-26 | credit-service | Recess iteration: Credit Service verification run                              | Ran schema and suite against a real credit-db; 10 tests pass, concurrency mutation-checked |
| 2026-09-27 | user-service | Stage 8: RBAC Middleware                                                         | Minimum-role authorize middleware factory with unit tests; not yet wired to routes        |
| 2026-09-27 | user-service | Stage 9: Admin Endpoints — View Users, Suspend/Unsuspend                         | Admin list/get users and suspend/unsuspend endpoints with role rules and tests           |
| 2026-09-27 | user-service | Stage 10: Super Admin — Promote / Demote                                         | Super admin promote/demote endpoint with self, super admin and non-active guards and tests |
