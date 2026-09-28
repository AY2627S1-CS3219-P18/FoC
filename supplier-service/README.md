<!--
AI Assistance Disclosure:
Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
Scope: Documented the Phase 0 scaffold's setup/run instructions (SupplierServiceSpec.md, "Phase 0 —
       Foundations"). No requirements, architecture, schema, or API decisions were made by the AI
       tool.
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

## Tests

```bash
npm test
```
