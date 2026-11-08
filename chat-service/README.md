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
Tool: Codex (model: GPT-6), date: 2026-11-08
Scope: Documented the team-specified listing contract and verification.
No requirements, architecture, schema, or API decisions were made by the AI tool.
Author review: tng wen xi
Scope (2026-11-08, Codex, model: GPT-6): Documented host access to Compose MySQL for Studio.
Author review: tng wen xi
Scope (2026-11-08, Codex, model: GPT-6): Documented the requested table renames.
Author review: tng wen xi
Scope (2026-11-08, Codex, model: GPT-6): Documented conversation details implementation and disclosure.
Author review: tng wen xi
Scope (2026-11-08, Codex, model: GPT-6): Documented the team-specified message listing endpoint.
Author review: tng wen xi
Scope (2026-11-08, Codex, model: GPT-6): Documented the team-specified send endpoint and realtime implementation.
Author review: tng wen xi
Scope (2026-11-08, Codex, model: GPT-6): Documented the team-specified read receipt endpoint.
Author review: tng wen xi
Scope (2026-11-08, Codex, model: GPT-6): Documented the team-specified participant addition endpoint.
Author review: tng wen xi
Scope (2026-11-08, Codex, model: GPT-6): Documented the supplied participant limits.
Author review: tng wen xi
Scope (2026-11-08, Codex, model: GPT-6): Documented the confirmed system notification endpoint.
Author review: tng wen xi
-->

# Chat service

Conversation creation and authenticated conversation listing. Express 5, TypeScript ESM, Prisma 7 and MySQL through `@prisma/adapter-mariadb`. File structure follows order-service.

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

Unique orderId also handles concurrent duplicate creation. Duplicate comparison uses the stored title and requester; later title-editing work must revisit this if titles become mutable. Message sending and sockets are described below; order-worker delivery is not implemented.

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

## GET /chat/conversations

Team-specified contract supplied in the 2026-11-08 implementation conversation:

- Authenticate the Bearer token using the same RS256 User Service JWKS validation as order-service. The verified token subject supplies the user ID.
- `limit`: integer 1–50, default 20.
- `cursor`: standard base64 encoding of UTF-8 JSON `{ "updatedAt": "<ISO timestamp>", "id": "<conversation UUID>" }`. URL-encode the base64 value when constructing a query string.
- Optional `status=active|archived` and `role=courier|requester`. Role filters the user's chat participation, independently of their token role.
- Without filters, return every conversation the user participates in, including revoked memberships. Revocation does not hide conversation history.
- Order by `updatedAt DESC, conversationId DESC`, with an exclusive cursor boundary on those fields.
- Return the object below directly, without the creation endpoint's `success/data` wrapper. `nextCursor` is an object to encode for the next request, or null on the final page.
- Latest message and read-position ordering use `created_at`, then message `id`, both descending for latest-message selection. SYSTEM messages can be the latest message; content may be null. Empty conversations have `lastMessage: null`.
- Unread counts exclude the user's own messages, include system messages, and count messages strictly after the stored read position. A null `lastReadMessageId` means all eligible messages are unread.
- 401 `{ "message": "Unauthorized", "code": "UNAUTHORIZED" }` for absent/invalid authentication.
- 400 `{ "message": "Invalid conversation query parameters", "code": "VALIDATION_ERROR" }` for invalid query parameters.

```json
{
  "conversations": [
    {
      "id": "0192f0c4-0000-7000-8000-000000000002",
      "orderId": "0192f0c4-0000-7000-8000-000000000001",
      "lastMessage": {
        "content": null,
        "type": "SYSTEM",
        "createdAt": "2026-11-08T00:00:00.000Z"
      },
      "unreadCount": 1,
      "updatedAt": "2026-11-08T00:00:00.000Z"
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```

The supplied `messages` table has UUID `id`, `chat_id` referencing conversations, nullable UUID `sender_id` (null for system), type TEXT/IMAGE/VIDEO/SYSTEM, nullable text `content`, nullable JSON `metadata` (system eventType/orderId), and `created_at`. Apply its checked-in migration with `npm run db:deploy` before using the endpoint.

`USER_SERVICE_URL` selects the JWKS host (default `http://user-service:3001` for Compose); set it to `http://localhost:3001` for local host execution. No additional package is required: the verifier is copied from order-service with its existing attribution preserved.

Listing verification: 46 tests passed across listing, authentication and creation; typecheck, build and Prisma schema validation passed. Tests use injected Prisma doubles and stubbed JWKS responses with generated test RSA keys. The new migration and listing queries have not been exercised against live MySQL or a live User Service in this task.

## Prisma Studio with Docker Compose

The Compose `chat-db` service publishes MySQL at `127.0.0.1:3306` for Studio running on the host. Recreate the database container after changing the port mapping (the named database volume is retained):

```sh
docker compose up -d --no-deps chat-db
```

In `chat-service/.env`, set `DATABASE_URL` to `mysql://root:<URL-encoded CHAT_DB_PASSWORD>@127.0.0.1:3306/chat_service`, using the database password configured in the repository-root `.env`. The Compose service creates a root account; the `chat:password` placeholder in the local example is not that account. Existing database volumes retain their original password.

```sh
cd chat-service
npx prisma studio
```

The database tables are `conversations` and `conversation_participants`. The rename migration preserves existing rows and foreign-key references. Prisma model names and existing column names remain unchanged.

## GET /chat/conversations/:conversationID

Team-specified contract supplied in the 2026-11-08 implementation conversation:

- Reuse Bearer authentication from listing; unauthenticated requests return 401.
- Require a UUID conversation ID; malformed IDs return 400.
- Missing conversations return 404; existing conversations requested by a non-participant return 403.
- Participants can access details even after their membership is revoked.
- Return the following object directly. Participants expose only userId, role and joinedAt; dates are ISO timestamps. Titles and status are returned as stored.

```json
{
  "conversationId": "0192f0c4-0000-7000-8000-000000000001",
  "orderId": "0192f0c4-0000-7000-8000-000000000002",
  "status": "ACTIVE",
  "title": "Alice · Coffee from Deck",
  "participants": [
    {
      "userId": "0192f0c4-0000-7000-8000-00000000000a",
      "role": "REQUESTER",
      "joinedAt": "2026-11-06T10:00:00.000Z"
    }
  ],
  "createdAt": "2026-11-06T10:00:00.000Z",
  "updatedAt": "2026-11-06T10:15:00.000Z"
}
```

Verification: all 56 tests passed, including 10 details tests; typecheck and build passed. HTTP tests use injected Prisma doubles and the existing token-verifier injection. No live database or User Service was exercised.

## GET /chat/conversations/:conversationID/messages

Team-specified contract supplied in the 2026-11-08 implementation conversation:

- Bearer authentication and UUID validation; 401 unauthenticated, 400 invalid ID/query, 404 missing conversation, 403 non-participant. Revoked participants retain access.
- `limit`: integer 1–50, default 20. `cursor`: standard base64 UTF-8 JSON `{ "createdAt": "<ISO timestamp>", "id": "<message UUID>" }`; URL-encode it in query strings.
- Order by `createdAt DESC, id DESC`, with an exclusive cursor boundary.
- Pagination follows conversation listing: `nextCursor` is an object to encode for the next request, or null on the final page. It uses the last returned message. `hasMore` indicates additional older messages.
- Each message exposes messageId, conversationId, senderId, type, content, metadata and createdAt. Nullable values are preserved; attachments are omitted for MVP. No schema changes.

```json
{
  "data": [],
  "pagination": { "nextCursor": null, "hasMore": false }
}
```

Verification: 68 tests passed, including 12 message endpoint tests; typecheck and build passed. HTTP tests use Prisma doubles and injected authentication; no live MySQL or User Service was exercised.

## POST /chat/conversations/:conversationID/messages

Team decisions supplied in the 2026-11-08 implementation conversation:

- Body: `{ "type": "TEXT", "content": "Hello" }`. Only TEXT is currently supported; missing/invalid fields, empty strings, whitespace-only strings and unsupported types return 400. Valid content is stored unchanged. User attempts to send type SYSTEM return 422.
- Bearer authentication uses the verified subject as senderId. Body sender fields are ignored.
- Alternatively, `X-Service-Key` must match CHAT_SERVICE_API_KEY. Any service name (or no service-name header) is allowed on this endpoint. These messages use type TEXT and senderId null. A supplied service key is checked before Bearer authentication; an incorrect key returns 401.
- Missing conversation: 404. Non-participant user: 403. Archived conversation or revoked user: 409. Service-key senders bypass membership/revocation checks but still require an existing ACTIVE conversation.
- The message insert and conversation updatedAt write use one Prisma transaction and the same timestamp. No schema changes.
- Return 201 with one message object directly: messageId, conversationId, senderId, type, content, metadata and createdAt, matching the GET messages item shape.
- After commit, broadcast `message:sent` with that same object to the union of `chat:<conversationId>` and non-revoked participants' `user:<userId>` rooms. A socket in multiple target rooms receives one event. Broadcast errors are logged; the persisted message still returns 201.

### Socket.IO

Connection and authentication follow order-service: same HTTP server as REST, default `/socket.io` path, WebSocket transport only, JWT in `auth.token`, existing JWKS verifier, `connect_error` with message `unauthorized` on failure, disconnect at token expiry. Authenticated sockets automatically join `user:<verifiedUserId>` and then receive `ready`.

Conversation subscription/unsubscription handlers are deferred by the team until frontend work. The recorded future rule is participant verification before joining `chat:<conversationId>`, excluding revoked participants. No client-controlled room joins are implemented now.

The Redis adapter follows order-service's publisher/subscriber setup. Configure REDIS_HOST, REDIS_PORT (default 6379) and REDIS_TLS (`true`/`false`, default false). Local execution defaults to localhost. Compose connects chat to the existing order-redis service. The adapter uses the `chat-socket.io` Redis key prefix. No worker pub/sub relay is needed for this REST endpoint.

Verification: 95 tests passed, including message validation/access, service-key sends, post-commit broadcasting, real local WebSocket authentication, user rooms, union delivery and expiry. Typecheck and build passed. HTTP persistence tests use injected Prisma doubles; no live MySQL, JWKS server or Redis cross-replica delivery was exercised.

## POST /chat/conversations/:conversationID/read

Team decisions supplied in the 2026-11-08 implementation conversation:

- Bearer authentication supplies the reader identity. Body: `{ "lastReadMessageId": "<message UUID>" }`.
- Require UUID conversation/message IDs (400 for invalid input); 401 unauthenticated, 404 missing conversation, 403 non-participant, 409 revoked participant, 404 missing message, 400 message belonging to another conversation.
- Advance the participant's existing lastReadMessageId using the established `createdAt`, then `id` ordering. Older or identical positions return 200 with the retained position. Concurrent writes retry against the latest stored position.
- Return `{ "conversationId": "<UUID>", "userId": "<authenticated UUID>", "lastReadMessageId": "<retained UUID>" }` directly. No readAt field or schema change.
- After persistence, emit **`messsage:read`** (three s characters, as specified) with that same object to `chat:<conversationId>`, excluding the reader's `user:<userId>` room. Emit even when the position stays unchanged. Socket broadcast failures are logged and do not change the successful HTTP response.
- This targets other sockets already in the chat room. Conversation subscription handlers remain deferred as documented above; automatically joined user rooms alone do not receive this event.

Verification: all 109 tests passed, including 13 read endpoint cases and a real local WebSocket receipt-delivery check. Typecheck and build passed. HTTP tests use Prisma doubles; live MySQL concurrency and Redis cross-replica delivery were not exercised.

## POST /chat/conversations/:conversationId/participants

Team decisions supplied in the 2026-11-08 implementation conversation:

- Require `X-Service-Key` matching CHAT_SERVICE_API_KEY; no `X-Service-Name` is required. Reuse message authentication: a supplied key takes precedence; invalid/missing credentials return 401, and a valid Bearer-only user returns 403.
- Body: `{ "userId": "<User Service UUID>", "role": "COURIER" }`. Both COURIER and REQUESTER are allowed. Invalid conversation/user UUIDs or roles return 400. The caller supplies the user ID; this endpoint does not call User Service.
- Missing conversation returns 404. Archived conversation or any existing membership for that user, including revoked membership, returns 409. Existing memberships are not changed.
- Return 200 with the object below directly. Insert the participant using existing schema defaults. The transaction locks the active conversation before checking membership and inserting; no schema changes or realtime event were added.

```json
{
  "conversationParticipantId": "0192f0c4-0000-7000-8000-000000000003",
  "conversationId": "0192f0c4-0000-7000-8000-000000000001",
  "userId": "0192f0c4-0000-7000-8000-00000000000a",
  "joinedAt": "2026-11-08T00:00:00.000Z",
  "role": "COURIER"
}
```

Verification: 126 tests passed, including 17 participant cases; typecheck and build passed. HTTP tests use injected Prisma doubles. Live MySQL transaction/concurrency behavior was not exercised.

Participant limits: each conversation permits at most one REQUESTER (including revoked requester memberships) and one non-revoked COURIER. Adding another participant of an occupied role returns 409. A revoked courier does not block a different courier; the existing same-user conflict still applies. These checks run inside the existing conversation-locked transaction; existing rows are not modified.

## POST /chat/send-system-notification

Team decisions supplied and confirmed in the 2026-11-08 implementation conversation:

- Body: `{ "orderId": "<UUID>", "message": "Order ready" }`. Invalid UUIDs, missing fields, non-string messages, empty or whitespace-only messages return 400. Valid text is stored unchanged.
- Same service-key authentication as participant addition: valid X-Service-Key, no service-name restriction, supplied-key precedence, 401 missing/invalid credentials and 403 valid Bearer-only users.
- Look up the conversation by orderId; return 404 if missing and 409 if archived.
- Reuse normal sending to insert a SYSTEM message with senderId null, text in content and metadata null, updating conversation updatedAt in the same transaction.
- Return 201 with the normal message object. After commit, reuse `message:sent` delivery to the union of chat and active participant user rooms. Broadcast failures are logged while retaining the successful response.

Verification: all 151 tests passed, including 19 system-notification cases; typecheck and build passed. HTTP persistence tests use injected Prisma doubles; live MySQL and Redis cross-replica delivery were not exercised.
