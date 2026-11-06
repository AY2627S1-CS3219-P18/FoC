<!--
AI Assistance Disclosure:
Tool: Codex (model: GPT-6), date: 2026-11-07
Scope: Documented the implemented creation endpoint and local setup.
No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review:
Tool: Codex (model: GPT-6), date: 2026-11-07
Scope: Added Docker and Compose setup instructions.
No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review: tng wen xi
-->

# Chat service

Text MVP, first endpoint only. Express 5, TypeScript ESM, Prisma 7 and MySQL through `@prisma/adapter-mariadb`. File structure follows order-service.

## Run locally

Run a MySQL database, create the chat database, and configure `.env` using `.env.example`. Use a UTC database session/server timezone for direct SQL inserts; the endpoint explicitly supplies UTC creation timestamps with millisecond precision.

```sh
npm ci
npm run db:generate
npm run db:deploy
npm run dev
```

`DATABASE_URL` supplies the MySQL host, port, user, password and database. `CHAT_SERVICE_API_KEY` is required and must match the order worker's configured secret. Never commit real credentials.

## POST /chat/conversations

Requires `X-Service-Name: order-service` and `X-Service-Key`. No student bearer token is needed or stored.

```json
{
  "orderId": "0192f0c4-0000-7000-8000-000000000001",
  "requesterId": "0192f0c4-0000-7000-8000-00000000000a",
  "orderDescription": "Coffee from Deck"
}
```

Creates an ACTIVE conversation and REQUESTER participant atomically. The initial title is the description; the request has no status field. Participant read position and revokedAt start null. No messages are created yet.

```json
{
  "success": true,
  "data": {
    "conversationId": "0192f0c4-0000-7000-8000-000000000002",
    "orderId": "0192f0c4-0000-7000-8000-000000000001",
    "title": "Coffee from Deck",
    "status": "ACTIVE",
    "createdAt": "2026-11-07T00:00:00.000Z"
  }
}
```

- 201: created.
- 200: same order, requester and description already exist; returns the existing record.
- 400 VALIDATION_ERROR: missing fields, invalid UUIDs or whitespace-only/empty description, with field-level details.
- 401 UNAUTHORIZED: missing/invalid service key.
- 403 FORBIDDEN: valid configured key but service name is not order-service.
- 409 ORDER_ID_CONFLICT: same order ID with different requester or description.

Unique orderId also handles concurrent duplicate creation. Duplicate comparison uses the stored title and requester; later title-editing work must revisit this if titles become mutable. Messages, sockets, other endpoints, order-worker delivery, Compose and deployment wiring are not implemented in this stage.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

HTTP tests use injected Prisma doubles; no live database is required for them. The Docker setup stage applied the checked-in migration against a temporary MySQL 8 container and verified production/development startup, creation, duplicate/conflict handling and authentication.

## Docker

Set `CHAT_DB_PASSWORD` and `CHAT_SERVICE_API_KEY` in the repository-root `.env` using `.env.example`. Use a URL-encoded database password in DATABASE_URL if it contains URL-reserved characters. The chat API is available on host port 3005 (`CHAT_SERVICE_PORT` overrides it); containers reach it at `http://chat-service:3000`. MySQL data persists in `chat-db-data` and the database runs in UTC.

```sh
docker compose up --build chat-service
```

Development with Compose Watch:

```sh
docker compose -f compose.yaml -f compose.dev.yaml up --build --watch chat-service
```

Both image targets apply pending migrations before starting. The development target also regenerates Prisma before startup. The production image runs as the node user. No new health endpoint or order-worker integration is introduced.
