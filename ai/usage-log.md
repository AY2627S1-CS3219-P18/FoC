## 2026-09-24 — Stage 1: Project Scaffold

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Set up the user-service scaffold: package.json, .env.example, RS256 keys, .gitignore, tsconfig.json, barebones app.ts, and the src/ directory structure. Then verify with npm install and confirm key files exist. Agreed fixes: run scripts via tsx, add missing @types packages and ESLint flat config, gitignore both keys/ and .env, no dotenv, keep DB_HOST=user-db.

**What it produced:**

- user-service/package.json
- user-service/tsconfig.json
- user-service/eslint.config.js
- user-service/.env.example
- user-service/.gitignore
- user-service/src/app.ts
- user-service/keys/private.pem, user-service/keys/public.pem (generated via openssl)
- user-service/src/{routes,controllers,middleware,services,db/queries,utils}/.gitkeep

**What I kept/changed/rejected:**
I accepted all changes.

## 2026-09-24 — Stage 2: Database Setup

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Write the Postgres schema (enums + users/users_otps/refresh_tokens tables) in init.sql, a Zod-validated config.ts that exits clearly on missing env vars, and a pool.ts exporting a single pg.Pool sourced from config. Updated app.ts to read port from config instead of process.env.

**What it produced:**

- user-service/src/db/init.sql
- user-service/src/config.ts
- user-service/src/db/pool.ts
- user-service/src/app.ts (modified)

**What I kept/changed/rejected:**
I accepted all changes.

## 2026-09-24 — Stage 3: Docker Setup

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Build a multi-stage Dockerfile (dev/prod) for user-service, wire up user-db + user-service in the root compose.yaml (healthcheck, init.sql mount, env_file, volume mounts), and create .env from .env.example with a reminder to fill in SMTP. Verified end-to-end with docker compose up --build.

**What it produced:**

- user-service/Dockerfile
- user-service/.dockerignore
- compose.yaml (added user-db, user-service services + user-db-data volume)
- user-service/.env

**What I kept/changed/rejected:**
I accepted all changes.

## 2026-09-25 — Stage 4a: App Setup + Middleware

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Wire up cookie-parser/cors middleware, mount the auth router, and add the shared auth building blocks: sha256 hashing, RS256 JWT verification, Bearer-token authenticate middleware, AppError, asyncHandler, REFRESH_COOKIE_OPTIONS, and the global error handler (AppError/ZodError/malformed-JSON/500 cases). Verified against a temporary protected route + generated test JWTs (valid/expired/wrong-signature) inside Docker, then removed the scaffolding.

**What it produced:**

- user-service/src/utils/hash.ts
- user-service/src/utils/jwt.ts
- user-service/src/utils/AppError.ts
- user-service/src/utils/asyncHandler.ts
- user-service/src/utils/cookies.ts
- user-service/src/middleware/authenticate.ts
- user-service/src/types/express.d.ts
- user-service/src/routes/auth.routes.ts
- user-service/src/app.ts (modified)
- user-service/package.json (modified)
- user-service/eslint.config.js (modified)

**What I kept/changed/rejected:**
I accepted all changes.

## 2026-09-25 — Stage 4b: Registration

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement user registration: users.queries.ts (CRUD reads + insert), auth.service.ts register() with format/complexity validation and duplicate-username/email handling (both a pre-check and a race-safe unique-constraint catch), and the register controller with a strict Zod schema for presence/type checks. Verified all 12 checklist cases inside Docker, including a concurrent duplicate-registration race test.

**What it produced:**

- user-service/src/db/queries/users.queries.ts
- user-service/src/services/auth.service.ts
- user-service/src/controllers/auth.controller.ts
- user-service/src/routes/auth.routes.ts (modified)

**What I kept/changed/rejected:**
I accepted all changes.

## 2026-09-25 — Stage 4c: Login + Tokens

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement login: tokens.queries.ts for refresh token CRUD, a signAccessToken() addition to jwt.ts, auth.service.ts login() (identifier lookup by username/email, bcrypt compare, suspended check, RS256 access token + random refresh token stored as its SHA-256 hash), and the login controller (strict Zod schema, sets the refresh cookie via REFRESH_COOKIE_OPTIONS). Verified all 11 checklist cases inside Docker, including decoding the issued token to confirm claims/algorithm/expiry.

**What it produced:**

- user-service/src/db/queries/tokens.queries.ts
- user-service/src/utils/jwt.ts (modified)
- user-service/src/services/auth.service.ts (modified)
- user-service/src/controllers/auth.controller.ts (modified)
- user-service/src/routes/auth.routes.ts (modified)

**What I kept/changed/rejected:**
I accepted all changes.

## 2026-09-25 — Stage 4d: Logout + Refresh

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement logout() (revoke by token hash) and refresh() (validate not-found/revoked/expired, re-check current user status so suspension takes effect immediately and role changes propagate on next refresh rather than requiring re-login) in auth.service.ts, plus their controllers and routes (logout behind authenticate). Verified all 10 checklist cases inside Docker, including a live suspend/promote-then-refresh test confirming the new token reflects fresh DB state.

**What it produced:**

- user-service/src/services/auth.service.ts (modified)
- user-service/src/controllers/auth.controller.ts (modified)
- user-service/src/routes/auth.routes.ts (modified)

**What I kept/changed/rejected:**
I accepted all changes.

## 2026-09-25 — Stage 4e: Inter-Service Verify + Super Admin Bootstrap

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Add GET /auth/verify (reusing verifyAccessToken so it agrees with the authenticate middleware), and a super admin bootstrap that runs on startup: checks for an existing 'super admin' role, creates one from SUPER*ADMIN*_ config (reusing the registration password-complexity regex) if none exists, and is awaited before app.listen(). Added SUPER*ADMIN*_ to config.ts's Zod schema and .env/.env.example. Verified all checklist cases inside Docker, including a container restart to confirm no duplicate bootstrap.

**What it produced:**

- user-service/src/services/bootstrap.service.ts
- user-service/src/config.ts (modified)
- user-service/.env.example (modified)
- user-service/.env (modified)
- user-service/src/services/auth.service.ts (modified)
- user-service/src/db/queries/users.queries.ts (modified)
- user-service/src/controllers/auth.controller.ts (modified)
- user-service/src/routes/auth.routes.ts (modified)
- user-service/src/app.ts (modified)

**What I kept/changed/rejected:**
I accepted all changes.

## 2026-09-25 — Stage 5a: Schema, Config, Utilities

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5a: add 'pending' to status_enum, OTP env vars/config, SMTP optional in development, hashesMatch, generateOtp, withTransaction/Queryable, and user query updates (db param, status param, lockUserById, activateUser, deleteStalePendingUsers).

**What it produced:**
Modified: user-service/src/db/init.sql, src/config.ts, src/utils/hash.ts, src/db/queries/users.queries.ts, src/services/auth.service.ts, .env.example
Created: src/utils/otp.ts, src/utils/otp.test.ts, src/db/transaction.ts

**What I kept/changed/rejected:**
I accepted all changes.

## 2026-09-25 — Stage 5b: Email Service

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5b: Nodemailer-based sendOtpEmail with purpose map, text+html bodies, throw on failure, and a development-only console fallback when SMTP_HOST is empty.

**What it produced:**
Created: user-service/src/services/email.service.ts

**What I kept/changed/rejected:**
I kept all changes.

## 2026-09-25 — Stage 5c: OTP Queries + Service

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5c: otp.queries.ts (create/invalidate/findLatest/count/increment/consume), otp.service.ts (issueOtp, checkOtp returning {ok:false} instead of throwing on mismatch), plus Vitest tests for checkOtp branching.

**What it produced:**
Created: user-service/src/db/queries/otp.queries.ts, src/services/otp.service.ts, src/services/otp.service.test.ts

**What I kept/changed/rejected:**
I kept all changes.

## 2026-09-25 — Stage 5d: Registration Now Creates a Pending Account

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5d: transactional register (delete stale pending users, duplicate checks, create pending user, issue OTP), register returns 201 OTP_SENT, login rejects pending accounts with 403 ACCOUNT_NOT_VERIFIED after the credential check.

**What it produced:**
Modified: user-service/src/services/auth.service.ts, src/controllers/auth.controller.ts

**What I kept/changed/rejected:**
I kept all changes.

## 2026-09-25 — Stage 5e: Verify OTP + Resend OTP Endpoints

**Tool:** Claude Code (claude-sonnet-5)
**Scope:** Implementation code

**What I prompted:**
Implement Stage 5e: public POST /auth/verify-otp and /auth/resend-otp with strict Zod validation, verifyRegistrationOtp/resendRegistrationOtp in the service layer (row lock, attempt persistence, resend limit and cooldown), and Retry-After support via AppError.retryAfterSeconds.

**What it produced:**
Modified: user-service/src/utils/AppError.ts, src/app.ts, src/routes/auth.routes.ts, src/services/auth.service.ts, src/controllers/auth.controller.ts

**What I kept/changed/rejected:**

## 2026-09-25 — Supplier Service: Architecture Document

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied Supplier Service architecture and database plans in the task prompt; supplier requirements in `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**
> Requirement Context:
> ```markdown
> Part 2: Supplier Service
> Your task is to implement the Supplier Service backend, together with a responsive UI. The
> UI should consume the Supplier Service’s APIs to perform CRUD operations.
> Points 1-5 are the expectations for a near-complete supplier service.
> Points 1-4 are the expectations for significant progress on the supplier service.
> 1. Database Choice and Schema Design
> • Which database technology have you selected?
> • Justify your choice with reasoning specific to FoC's design. Consider the
> nature of the data—for example, whether it is structured or contains flexible
> content—as well as the expected query patterns and scalability requirements.
> • Present a concrete schema. Specify the tables, collections or documents; the
> fields they contain; and the relationships among them.
> • Identify the metadata required for each supplier, such as its name, type and
> location, and explain how this metadata is stored and queried.
> 2. Query Patterns & API Design
> • Identify the key ways in which the Supplier Service will be queried, such as
> retrieving a supplier by ID or finding suppliers by location.
> • Define the API endpoints that expose these operations. Demonstrate the key
> query patterns using working API calls.
> • Explain how Supplier Service API endpoints use identity and role information
> from the User Service to enforce access control and respond to denied
> requests.
> 3. CRUD operations in the Backend
> • Demonstrate a running Supplier Service connected to a database, with
> working APIs that support CRUD operations on supplier data.
> • The Supplier Service is an independent backend service. Its functionality must
> be exposed through its APIs and should not depend on the UI.
> • Demonstrate that the Supplier Service can be used and tested through its APIs
> without the UI being present or running.
> 4. End-to-End Integration
> • Demonstrate the complete flow from an authenticated user, through the
> Supplier Service API, to the database.
> • Show that users with different roles receive the appropriate API access.
> • Focus the demonstration on the complete supplier-management experience
> for all relevant users, including administrators where applicable.
> 5. Responsive Supplier Management UI
> • Demonstrate the complete supplier management UI.
> • Show the UI adapting appropriately across desktop- and mobile-sized
> viewports.
> • Include workflows such as:
> • Creating, editing, and deleting suppliers
> • Viewing supplier records
> • Searching for suppliers
> • Filtering and sorting results
> • Paginating through supplier data
> • Viewing supplier details
> • Demonstrate integration with the Supplier Service by retrieving and modifying
> supplier data through its APIs. The UI must use live data from the service and
> must not rely on mock or hard-coded supplier data.
> • Note: The demonstration should not be limited to administrator-only
> screens.
> ```
>
> Craft an ServiceArchitecture.md document according to my specified plans. Use mermaid for any diagrams, and record my design considerations at appropriate sections:
>
> - Tiered architecture for presentation, business, persistence and database layers: such a breakdown allows for good separation of concerns across the different layers, each with their own set of responsibilities. This allows for reduced coupling and flexibility in switching out the layers/scaling, better maintainability [as a result of the concern separation], enhanced database security [due to strict interface access via the persistence layer], and the potential ability for the different tiers to be developed in parallel [although in this case I am developing this entire service myself]
> - The presentation layer in particular utilise an MVC model: this is again applying the principles of concern separation, with the frontend being solely reliant on the View, which communicates with the controller and the model. To acoomdate an SPA approach, implementation will be in the form of a WebMVC, where the View is handled client-side, usint HTTP calls to communicate with the controller which bridges the connection between server's model and the View.
> - The business layer will handle the core logic, functions, workflows
> - The persistence layer acts the abstraction between the database and the business layer
> - The database layer will utilise a relational database as the fields as defined in our project is fixed and highly structured so there is little benefit to employing a NoSQL solution. In particular, given that data related to suppliers are rarely changed and mostly read, a very lightweight solution [MySQL] will be preferred over a more robust solution that can handle complex query support [PostgreSQL]
>
> Database Schema:
>
> fields should contain supplier\_name, supplier\_type ["Store" vs "Facility"], supplier\_category [can contain multiple of "Food", "Drinks", "Snacks", "Printing", etc.], supplier\_location, supplier\_faculty [subcategory of location], supplier\_hours [always 24h for "Facility", and customisable for "Store"] and supplier\_desc. This means separate tables for supplier, supplier\_locations, supplier\_categories, a junction table mapping supplier to supplier categories, supplier\_hours, and supplier\_photos [links to dedicated storage location]
>
> The main API interfaces for accessing supplier data, based on the backlog, will contain:
>
> - Querying truncated supplier information for display on user-facing dashboard [all fields except for desc and full opening hours. filter and search will be client-side]
> - Querying detailed information for a specific supplier [including opening hours and desc for the expanded detail page]
> - Creation of a supplier
> - Editing a supplier
> - Deleting a supplier
> - Querying truncated supplier information for display on admin dashboard [all fields except for desc and full opening hours, with additional fields like creation\_date, created\_by etc]
> - Querying full supplier information for display on admin dashboard
>
> Critique and comment on any gaps based on the requirement context and design feasibility. Due to course policy, you need not offer details on what to change to. Just the critique, gaps, and comments so so i can do further researchmyself

**Key responses:**
Created `supplier-service/ServiceArchitecture.md` containing the supplied tiered architecture, WebMVC presentation model, MySQL rationale, supplier entity/table plan, logical API operation inventory, Mermaid diagrams, and factual traceability notes. Concrete route names and unspecified schema/API choices were intentionally not invented. The architecture/design critique was limited to factual gaps because the repository policy prohibits the agent from making architecture/design decisions or drafting trade-off analyses.

**Files:**
- `supplier-service/ServiceArchitecture.md` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The plan does not specify concrete endpoint contracts, full SQL field definitions, authorization details, deletion semantics, or the service interactions associated with soft deletion; these are recorded as unresolved observations in the document.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
Additions were all based on content I provided. Reviewed.

## 2026-09-26 — Supplier Service: Photo Management and Concrete Schema

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Implementation code | Refactor/Docs
**Governing decision:** User-supplied photo-management, authentication, service-entrypoint, normalized location/faculty/level, and server-managed-field decisions in the follow-up prompt; `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**
> Photo amangement:
>
> - uploaded photos are part of the form data payload, sent alongside the request parameters in the create and edit flow for admins
> - a dedicated junction table will be used to map supplier\_id to one or multiple photoids
> - images are rendered directly on the websites, sent alongside the dashboard and detail API calls
> - general accepted formats are jpeg and png, at 5mb per image and max of 10 images
> - utilise saga pattern: if file upload fails, backend save aborts and do not commit any changes the database, reporting 500 Error. if storage succeeds but if db fails, execute a cleanup of the uploaded picture(s) before returning a 500
> - photo storage will be gated behind its own authentication, and updates are only made by the admins through their authenticated sessions
> - deletion behavior and availability are up to the storage provider. Out of the service architecture
>
> other blockers:
>
> - we are operating with the assumptions that each service will provide the necessary entrypoints. This entire project is a microservices architecture mocked thought different subfolders afterall. likewise message-service is just for the future. We can asssume that order-service can take in a order-delete call, and message service can take in some sendMsg call
> - the authentication will be offloaded to google oauth following their conventions
> - location maps to location table and unique location\_ids. new faculty table with faculty\_ids. level is just a numerical field
> - server-managed fields are not included in the create/update bodies
>
> Based on what i have provided, generate the database schema for the various tables as well

**Key responses:**
Updated `supplier-service/SupplierServiceArchitecture.md` with multipart photo uploads, photo junction mapping, photo response references, JPEG/PNG and size/count constraints, Google OAuth ownership, assumed Order/Message Service entrypoints, normalized faculties and locations, server-managed write fields, a compensating photo-upload saga, and concrete MySQL `CREATE TABLE` definitions for supplier, locations, faculties, categories, junction tables, hours, photos, and photo mappings.

**Files:**
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The photo provider remains intentionally undecided. Provider-specific deletion and availability behavior remains outside the Supplier Service architecture, while the service-level upload, authentication, mapping, and compensation behavior is documented.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
Additions were all based on content I provided. Reviewed.

## 2026-09-26 — Supplier Service: Traceability Gap Resolution

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied answers to the Supplier Service traceability notes in the follow-up prompt; `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**
> Fill in the gaps raised in the "Requirement traceability notes and unresolved items" section. Some of my answers:
>
> 1. I already provided all the fields and structure for the request and response envelops. Generate the structure and fill in
> 2. 50 is a fixed value for this project, based on project backlog
> 3. search just takes in text and do a simple case-insensitive string matching with supplier name/location/icategory. Remove sortBy for now as we only allow alphbet. sortOrder is just A-Z/Z-A for now.
> 4. offloaded to auth provider
> 5. use createdOn and createdBy instead
> 6. ignore the extra isOpen
> 7. users will not see suppliers that are soft-deleted or non-active. admins will still be able to see everything
> 8. elaborate
> 9. i already lited them clearly. make necessary inferences. This is unrelated to architecture design decision
> 10. what hours UUID?
> 11. 24h represented as 00:00 opening with 23:59 as closing
> 12. is\_open will be calculated from the current time and cross-comparing with the opening hours
> 13. will populate in mock database
> 14. suggest
> 15. suggest
> 16. suggest

**Key responses:**
Updated `supplier-service/ServiceArchitecture.md` to fill the supplied traceability answers: fixed 50-entry pagination, case-insensitive search across name/location/category, alphabetical `A-Z`/`Z-A` sorting without `sortBy`, authentication-provider ownership, `createdOn`/`createdBy`, visibility rules, derived `is_open`, 24-hour hours representation, mock-data reference values, request/response envelopes, and route-level API examples. Remaining photo-storage and detailed UI-state choices are still identified as team-owned decisions rather than selected by the agent.

**Files:**
- `supplier-service/ServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The document does not recommend a photo-storage system or prescribe detailed responsive UI states, authentication-expiry behavior, or downstream failure semantics; these remain explicitly recorded for team decision.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
Additions were all based on content I provided. Reviewed.

## 2026-09-25 — Supplier Service: Contract and Schema Clarifications

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied Supplier Service endpoint, status-code, pagination, authentication, role, soft-delete, and table-field decisions in the follow-up prompt; `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**
> On the factual observations. Update the document based on these, and point out any other gaps:
>
> 1. API status codes: 200 OK, 201 Created, 400 Bad Request, 403 Forbidden, 422 Unprocessable Entity, 404 Not Found. Enpoints:
>    1. user dashboard: /api/suppliers. request:GET, params=page, limit, search, location\_id, category\_id, sortBy, sortOrder. Response: metadata=totalRecords, currPage, limit, totalPages, data=id, name, type, location, faculty, level, categories, isopen
>    2. admin dashboard: /api/admin/suppliers. same as 1, with more data in response: isActive, isDeleted, isOpen
>    3. user detailed view: /api/suppliers/:id. same as 1, but now with more data in response: desc, openingHours
>    4. admin detailed view: api/admin/suppliers/:id, same as 3, but also contain createdOn and createdBy in the response
>    5. admin create: /api/admin/suppliers. request:POST, params=all in 4
>    6. admin edit: /api/admin/suppliers/:id. request: PUT, params=whatever updated field from the whole list in 5
>    7. admin delete: /api/admin/suppliers/:id. request: DELETE
> 2. Update the document to show that API requests for querying data takes in filter, sort and search parameters which will be used to query for 50 entries at a time
> 3. clarify supplifier deletion is a soft delete from updating a new is\_deleted field in supplier
> 4. add these fields into the supplier data model: is\_active (whether the result is shown), is\_deleted (from 3.), is\_open, creation\_date and creator
> 5. update to include that in case of soft deletion, past records and requests already picked up will be kept the same. For requests not yet collected, the supplier service will interact with the order service's delete API to delete the request. It will also interact with the message service's messaging API to send a msg to the request poster
> 6. The UI interface is locked behind authentication, and a JWT will be used to verify the identity and authenticate users. There will be 3 user roles - super admin, admin and user. The roles accepted by each operation is as specified in the API operation inventory section
> 7. For location table, it will consisit of an autoincrement location\_id, (text) location, (text) faculty, (text) level. For hours table, it will include some autoincrement UUID, supplier\_id, day\_of\_week (represented by int 0-6), open\_time (time), close\_time (time). For category table, it will consist of an autoincrement category\_id and (text) category\_type. The junction table contains the supplier\_id and category\_id, with both forming a composite key. The photo table contains an autoincremend photo\_id, (text) photo\_lcoation.
> 8. is considered in 7
> 9. for 24h availability, the open\_time and close\_time are just both set to 00:00 (or time field equivalent)
> 10. all components will be dynamic to cater to different viewports.

**Key responses:**
Updated `supplier-service/ServiceArchitecture.md` with the supplied endpoint paths, HTTP methods, query parameters, response fields, status-code set, 50-entry query behavior, authenticated JWT role model, soft-delete field and workflow, downstream Order/Message Service interactions, concrete table fields, and dynamic viewport behavior. Added further factual gap notes for unresolved contract, identifier, query, authorization, integration, and UI details.

**Files:**
- `supplier-service/ServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The prompt did not fully specify JWT claims, the meaning of `limit` relative to 50 entries, exact response/error envelopes, or downstream failure semantics. These remain recorded as factual gaps rather than being selected by the agent.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
Additions were all based on content I provided. Reviewed.

## 2026-09-27 — Supplier Service: Provider-Agnostic Photos and Auth Contract

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied Supplier Service photo-provider, photo-edit, authentication, downstream-mock, lookup-payload, and schema decisions in the follow-up prompt; repository User Service authentication contract.

**Prompts (exact):**
> - photo provide selection is still pending team selection of cloud deployement provider. It is either AWS with S3, or Google Developer Cloud with Google Cloud storage to reduce latency and configuration. The supplier service should expose a provider-agnositic interface to allow for easy swapping instead of coupling to a specific one we choose
> - photo edit semantics:
>   - for edits to the photo (add/replace/delete/reorder), a dedicated boolean variable "isPhotoDirty" will be added to supplier edit payload so the backend knows the need to process them. Alongside that, an ordered array of photo_ids will be sent to inform the backend of the new ordering/remaining photos. if new photos are uploaded too, the multipart form data will contain the binary and placeholder_ids if the new photos. The backend logic will check through the ordering, and 1. delete photos associated with excluded ids from cloud storage and mysql backend, 2. upload new photos(if any) to cloud storage, append to mysql database, 3. reorder mysql's stored display order
>   - to accomodate this, supplier table will get additioal datetime "updatedOn" field. As the relation between supplier and photos is 1:n, we can forgo the supplier_photo_map junction table and have the supplier_photos table store additional "supplier_id" and int "display_order"
> - OAuth will just be a type of authentication. Read the project main's user-service for details on the authentication and role configurations
> - downstream call contracts will be mocked until the actual API request structure are confirmed
> - what do you mean by fixing the encoding? opening hours will just be a list like [{"day": 1, "open": "09:00", "close": "17:00"}, {"day": 2, "open": "09:00", "close": "17:00"}...], category_id will just be a list [1,2,3], populated based on the user selection's mapped IDs (this means the a new API entrypoint for adding suppliers, where the text descriptions and ids of supplier_locations and supplier_categories will be sent to the FE to provide selection options. Photos will be standard form-data type photo, sent as binary data

**Key responses:**
Updated `supplier-service/SupplierServiceArchitecture.md` to align authentication with the repository User Service's RS256 JWT and `/auth/verify` contract; document the provider-agnostic AWS S3/Google Cloud Storage boundary; replace the photo junction table with direct one-to-many photo rows; record `updatedOn`, `isPhotoDirty`, ordered `photo_ids`, `placeholder_ids`, binary multipart examples, lookup metadata, and the remaining photo and API-contract gaps.

**Files:**
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The concrete photo-storage provider and lookup endpoint path remain team decisions. The document also records unresolved external-day numbering and recovery semantics for edits that delete existing photos before a later persistence failure.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
Additions were all based on content I provided. Reviewed.

## 2026-09-27 — Supplier Service: Reference APIs and Photo Consistency Rules

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied Supplier Service reference-endpoint, error-envelope, query, opening-hours, and photo-consistency decisions in the follow-up prompt.

**Prompts (exact):**
> 1. endpoint for lookup options: a GET /api/suppliers/reference/location with the payload for locations:[{location\_id:.., location:..., faculty\_id:..., faculty:...},{}...], and a GET /api/suppliers/reference/categories categories:[{category\_id:..., category:...},{}...]. Category and location are separated on purpose as there may be a lot more locations than categories, so this would allow us to request for them separately. While the add supplier interface will always call both, but the user-oriented filtering might only require access to either of them, so respecting the concept of lazt loading, these api calls will be kept apart
> 2. All error response envelops will follow a fixed format with the status\_code, error, message, timestamp and details (the exact fields, locations of the error). The status codes are listed in 7.1
> 3. for limit, 50 is fixed; for sort values are only order by A-Z/Z-A, these are not user-modifiable. For filtering, the options will be loaded from the options retrieved via the api lookup for location and categories. There is no risk of invalid fields
> 4. no. I was just giving example as a store may only only on some days of the week. The database day\_of\_week still maps days to 0-6, with 0 being sunday
> 5. time-zone will be fixed to singapore's UTC+8 timezone. this will be clearly recorded. overnight opening hours are just when the opening time is later (e.g., 2100) than the closing time (e.g., 0300). server calculated isOpen must accomodate this
> 6. in the photo deletion flow, cloud object deletion will be last after ensuring mysql updates (edits, deletions) are complete to reduce operational
> 7. placeholder\_ids are generated randomly for each uploaded photo (binary file). the backend will process the ordering of images sent over by resolving their index positions. The association does not matter as long it is one-to-one. the backend will replace the placeholder\_ids. its only purpose is to keep a reference to the new images

**Key responses:**
Updated `supplier-service/SupplierServiceArchitecture.md` with separate lazy-loaded location and category reference endpoints, the fixed error envelope, fixed 50-entry pagination and sort/filter semantics, Singapore time and overnight-hour rules, placeholder-ID resolution, and MySQL-first photo edits followed by cloud-object deletion. Remaining gaps are limited to endpoint-specific status-code mapping, post-commit cloud-deletion failure handling, downstream contract confirmation, provider selection, and live API evidence.

**Files:**
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The prompt ended mid-sentence for the operational rationale in item 6; the documented behavior records the explicit ordering decision without adding a rationale.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
Additions were all based on content I provided. Reviewed.

## 2026-09-27 — Supplier Service: Redis Worker and Status Mapping Template

**Tool:** Codex (model: GPT-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied reference-endpoint role, status-code template, Redis job-queue, retry, and downstream workflow decisions in the follow-up prompt.

**Prompts (exact):**
> 1. the 2 new reference endpoints will be open to all roles
> 2. generate the appropriate template with the various conditions and literal status-code-meaning mappings for me to fill in the gaps
> 3. ill introduce a background worker with a job queue stored in redis, not just to ensure failed cloud deletions are retried, but also to support other features like the supplier suspension -> cancelling orders -> informing users flow, and in general allow for more robust handling of failures

**Key responses:**
Updated `supplier-service/SupplierServiceArchitecture.md` to make both reference endpoints available to `user`, `admin`, and `super admin`; added a fill-in status-code mapping template; and documented the Redis-backed background worker for post-commit photo deletion retries and queued supplier-suspension workflows involving Order and Message Services. Remaining queue failure, job contract, and downstream mapping details remain explicitly open.

**Files:**
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The status-code template leaves project-specific endpoint mappings and queue failure behavior for the team to complete; no new mapping or retry policy was selected by the agent.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
Additions were all based on content I provided. Reviewed.

## 2026-09-27 — Supplier Service: Completeness Review and Team-Supplied Clarifications

**Tool:** Claude Code (claude-sonnet-5)
**Mode:** generate | refactor | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied concurrency, uniqueness, timezone, role, API-management, idempotency, rate-limit, versioning, and deployment decisions given directly in chat; `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**
> Review the architecture design in SupplierServiceArchitecture.md for issues

> I fixed the consistency issues 1-5. I want a review on the entire design's completeness before moving to spec

> fold into the document at appropriate locations:
> data model
>
> * concurrent edits: add an additional version col for supplier tables. All updates will include an incremented version number, so in the case of concurrent edits, the first to execute will update the records, and the later ones will not be able to find the record to update with the old version number, allowing a Concurrent Edit error to be raised (409 Conflict)
> * for supplier hours, day of week should be unique for a supplier (no multiple hours in a single day), and display_order for supplier_photos should be unique as well (photos of the same supplier cannot share the same order)
> * Exclusion of supplier_desc from search is intentional as desc will not be displayed
> * All timezones are in SGT (UTC +8)
>
>
> API/auth
>
> * currently super_admin and admin do not defer in capabilities. super_admin comes with additional admin management which is not part of this service.
> * following the exact same format as the read endpoints, add management endpoints for faculties, supplier_categories and supplier_locations to allow admin UI CRUD
> * PUT and DELETE are idempotent by design. There will be no issue with multiple calls. Multiple PUT leads to the same addition, and multiple DELETEs just lead to 404s after a successful execution. For POST, apply the idempotency key pattern where the client generates a UUID "idempotency key" and attach it to the request header. This key and response will be cached in redis so that subsequent retries will be flagged with 409 Conflict, or to directly return the completed response if avialbale.
> * photo_location urls will be short-lived signed URLs provided by the cloud storage
>
>
> Others
>
> * Introduce rate limit of 30requests/min/ip
> * Same origin will be used
> * Apply versioning /v1 to all API endpoints
> * defer health-check endpoints for now
>
> Are these clarifications sufficient to spec the supplier service

**Key responses:**
First reviewed `supplier-service/SupplierServiceArchitecture.md` for internal consistency and found five factual bugs: a duplicate blank `401 Unauthorized` row, an ER-diagram cardinality mismatch between `SUPPLIER` and `SUPPLIER_LOCATIONS`, `super admin` vs `super_admin` spelling inconsistency, a `level` field typed as numeric in the schema but stringified in JSON examples, and mixed snake_case/camelCase audit-timestamp naming — reported these without editing (the user then fixed them independently). After the user's fixes were confirmed, ran a completeness review surfacing gaps not yet covered by the document (optimistic concurrency, hours/photo uniqueness, role differentiation, lookup-table CRUD, idempotency, signed photo URLs, rate limiting, CORS/versioning/health-check policy) and reported them as open questions rather than deciding them. The user then supplied concrete answers/decisions for each; folded these verbatim decisions into the document: added `supplier.version` (optimistic concurrency, `409 Conflict` on stale edit) to the schema, table description, ERD, and DDL; added `UNIQUE` constraints on `supplier_hours(supplier_id, day_of_week)` and `supplier_photos(supplier_id, display_order)`; recorded the SGT-only timestamp policy and the intentional `supplier_desc` search exclusion; noted `admin`/`super_admin` capability parity; added CRUD management endpoints for `faculties`, `supplier_locations`, and `supplier_categories` mirroring the existing reference-endpoint format; added a new §7.5 documenting `PUT`/`DELETE` idempotency, the `POST` idempotency-key/Redis-cache pattern, and the 30 req/min/IP rate limit; recorded signed-URL photo references; added the same-origin/no-CORS note; applied `/api/v1` versioning across every endpoint path in the document; and noted the deferred health-check scope. Added new `409`/`429` rows to the status-code table and mapping template, and appended items 11–16 to the traceability section summarizing what is now resolved. Answered the final question in chat (not logged here) rather than in the document, since it was a question about the document, not new document content.

**Files:**
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
The `POST` idempotency-key header's exact name (`Idempotency-Key` was used as a placeholder pending team confirmation) and the signed photo URL's expiry duration were not specified in the prompt and remain open. No other decisions were made by the agent beyond what was explicitly supplied.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
Additions were all based on content I provided. Reviewed.

## 2026-09-27 — Supplier Service: Async Response Timing, Redis Job Contract, and Dead-Letter Table

**Tool:** Claude Code (claude-sonnet-5)
**Mode:** generate | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied response-timing, Redis job payload/retry, dead-letter-table, idempotency-header, signed-URL-duration, and downstream-deferral decisions given directly in chat.

**Prompts (exact):**
> remaining open questions:
>
> * client gets immediate response as soon as the job is enqueued
> * redis job contract: payload is generic with an id, a task name, payload with the information to be sent (for photo delete, it will contain the photo_id, for instance). This can be derived directly from the database schema already decided upon. retries will be on exponential backoff with maximum 5 retries. if the job still fails after retries are used up, a record will be added to a new table in the database for dead-letter-jobs. It will include: autoincrement id, job_id (of the failed redis task), task_name, payload (used by the redis worker), error_trace (error message from last retry), failed_at (time of last retry failure), status (defaulted as "UNRESOLVED"). This table offers visibility too
> * just use "Idempotency-Key" as the header name, unless there are conventions. signed photoURL duration is 24h for now
> * continue deferring the downstream contracts till they are built

**Key responses:**
Folded the supplied answers into `supplier-service/SupplierServiceArchitecture.md`: recorded that the API returns its response immediately once the relevant database write and Redis enqueue succeed, without waiting for the background worker, in both the soft-delete workflow (§8.1) and the photo-deletion workflow (§8.2), updating both sequence diagrams accordingly; added the `dead_letter_jobs` table (autoincrement `id`, `job_id`, `task_name`, `payload`, `error_trace`, `failed_at`, `status` defaulted to `UNRESOLVED`) to the data model table (§6.2) and MySQL DDL (§6.4); documented the generic `{id, task_name, payload}` Redis job shape and the exponential-backoff/5-attempt retry policy with dead-letter fallback in §8.1/§8.2; finalized the `Idempotency-Key` header name (removed the earlier "to be confirmed" hedge) in §7.5; set the signed photo URL duration to 24 hours in §6.3/§8.2; and updated §9 items 5, 8, 14, and 16, and added a new item 17, to reflect that these are resolved while the Order/Message Service request contracts remain an explicit, continued deferral.

**Files:**
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None — all previously open items from this line of questioning are now resolved or explicitly marked as an intentional, continued deferral (Order/Message Service contracts) rather than a gap.

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
Additions were all based on content I provided. Reviewed.

## 2026-09-27 — Supplier Service: Phased Implementation Spec

**Tool:** Claude Code (claude-sonnet-5)
**Mode:** generate | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** `supplier-service/SupplierServiceArchitecture.md` (already team-reviewed and committed) and the existing Supplier Service GitHub issues (#40–#46, #60, #61) in `AY2627S1-CS3219-P18/FoC`, tracing back to `docs/FoC-ProductBacklog.md`.

**Prompts (exact):**
> i've commited the docs. Start specing out the supplier service. Given this is a large service, the specs may be broken up into different phases. The product backlog's supplier service features are associated with open issues within github, so they should be used to guide the sectioning of tasks where appropriate (especially after the foundations are laid out)

**Key responses:**
Read `docs/FoC-ProductBacklog.md`'s Supplier Service section and fetched the corresponding GitHub issues (`gh issue view` for #40–#46, #60, #61) to confirm their exact scope/requirement text. Created `supplier-service/SupplierServiceSpec.md`, organizing the already-decided architecture into six phases: Phase 0 (foundations — schema migrations, auth/role middleware, error envelope, rate limiting; no dedicated issue, prerequisite for all others), Phase 1 (supplier read APIs — #40/#41/#42), Phase 2 (admin visibility, lookup-table management, and creation — #43/#44), Phase 3 (admin update — #45), Phase 4 (soft-delete and downstream Redis workflow — #46), and Phase 5 (cross-cutting hardening/verification — #60/#61). Each phase cites the exact architecture section(s) it implements and quotes the backlog requirement IDs it satisfies; no new architecture, schema, or API decisions were introduced. Phase ordering is stated explicitly as technical build-dependency order, not a sprint-priority decision, since reordering the backlog is outside what the agent may do. Flagged three open questions the spec surfaced but did not resolve: (1) whether F8.2.2's duplicate-supplier check needs a schema-level `UNIQUE` constraint or an application-level check, (2) whether the Order Service's historical-record preservation (F8.3.2) needs confirmation from that service's owner, and (3) an apparent mismatch between the backlog's F8.4.1 wording ("toggling active status") and the architecture's actual soft-delete implementation (`is_deleted`, a separate flag from `is_active`).

**Files:**
- `supplier-service/SupplierServiceSpec.md` (created)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
See the three open questions above (also recorded in the spec's closing section). No architecture, schema, or prioritization decisions were made by the agent; phase order reflects only technical dependency, and the team's existing backlog priorities/issue numbers were used as-is.

**What I kept/changed/rejected:**

**Author review:**

## 2026-09-28 — Supplier Service: API Gateway, Uniqueness Constraint, and Open-Question Resolutions

**Tool:** Claude Code (claude-sonnet-5)
**Mode:** generate | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied API-gateway/CORS explanation and answers to the spec's three open questions, given directly in chat.

**Prompts (exact):**
> fold into the spec on CORS that a single API gateway will be used to access all the services, hence the single-origin. For the open questions:
>
> 1. an application-level pre check with be done first, but backend will also verify that the supplier name, type and location fields together form a unique set
> 2. yes, confirm supplier_id as stable foreign reference
> 3. toggling active status is meant to purely updates the is_active field that controls visibility and is unrelated to is_deleted. (but if an item is soft deleted, it is also no longer visible and theres no need for the is_active state to be uppdated)

**Key responses:**
Updated both `supplier-service/SupplierServiceArchitecture.md` and `supplier-service/SupplierServiceSpec.md`. In the architecture doc: explained the same-origin/no-CORS deployment as a consequence of a single API gateway fronting all FoC services (§3, §9 item 15); added a `UNIQUE` constraint on `supplier(supplier_name, supplier_type, location_id)` to the data model (§6.2) and DDL (§6.4), enforced by both an application-level pre-check and the database constraint; clarified that `is_active` and `is_deleted` are independent flags — `is_active` is a separate admin-editable visibility toggle already settable via the generic `PUT` edit endpoint, and soft-delete (`DELETE`) only sets `is_deleted` since either flag alone hides a supplier (§6.2); and added §9 item 18 recording all of this, including a flagged edge case the team's answer didn't address: the `UNIQUE` constraint as given applies even to soft-deleted rows, which would block recreating a supplier with the same name/type/location as a previously soft-deleted one, contradicting F8.2.2's "if an *active* supplier ... exists" wording. In the spec: updated Phase 0 (API gateway), resolved Phase 2/3/4's flagged open questions accordingly, and updated the closing "Summary of open questions" section to mark three items resolved and add the new soft-deleted-row uniqueness question in their place.

**Files:**
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Whether the new `UNIQUE` constraint on `supplier(supplier_name, supplier_type, location_id)` should exclude soft-deleted rows (so a supplier can be recreated after a prior soft-delete), or whether such a recreation should instead reactivate the existing soft-deleted row, was not addressed by the team's answer and remains open (architecture §9 item 18, spec closing section item 4).

**What I kept/changed/rejected:**
I kept all changes

**Author review:**
Additions were all based on content I provided. Reviewed.

## 2026-09-28 — Supplier Service: Soft-Delete Recreation Resolved as Reactivation

**Tool:** Claude Code (claude-sonnet-5)
**Mode:** generate | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied resolution for the soft-deleted-row uniqueness question, given directly in chat.

**Prompts (exact):**
> in the unlikely scenario that the exact same supplier that was deleted is re-added, the soft-delete is reversed and the addition serves as an update of fields instead. This preserves the uniqueness

**Key responses:**
Updated `supplier-service/SupplierServiceArchitecture.md` (§6.2, the admin-create row in §7's endpoint table, §9 item 18) and `supplier-service/SupplierServiceSpec.md` (Phase 2, closing "Summary of open questions") to record that `POST /api/v1/admin/suppliers` now branches on the pre-check result: no match inserts normally; a match against a non-deleted supplier is rejected (F8.2.2, unchanged); a match against a soft-deleted supplier instead reverses that row's `is_deleted` flag and applies the submitted fields to it as an update, reusing the existing `supplier_id` rather than inserting a new row. This resolves the previously flagged uniqueness-constraint/soft-delete conflict without needing a partial or filtered `UNIQUE` index. Narrowed the remaining open item to one the team's answer didn't cover: whether photos submitted on the reactivating request should replace or append to the reactivated supplier's existing photo rows.

**Files:**
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
Photo handling on the reactivation path (replace vs. append existing photo rows) remains open — the team's answer addressed the field-update/reactivation behavior but not photos specifically.

**What I kept/changed/rejected:**

**Author review:**

## 2026-09-28 — Supplier Service: Reactivation Photo Handling Resolved

**Tool:** Claude Code (claude-sonnet-5)
**Mode:** generate | docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied resolution for the last open item (reactivation-path photo handling), given directly in chat.

**Prompts (exact):**
> replace existing photos on reactivation

**Key responses:**
Updated `supplier-service/SupplierServiceArchitecture.md` (§6.2, §9 item 18) and `supplier-service/SupplierServiceSpec.md` (Phase 2, closing "Summary of open questions") to record that when `POST /api/v1/admin/suppliers` reactivates a soft-deleted supplier (per the prior session's resolution), any newly submitted photos replace that supplier's existing photo rows entirely rather than being appended alongside them. This was the last open item raised across the completeness review, architecture, and spec sessions; the closing summary in the spec now states no open questions remain from this line of clarification.

**Files:**
- `supplier-service/SupplierServiceArchitecture.md` (modified)
- `supplier-service/SupplierServiceSpec.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None.

**What I kept/changed/rejected:**

**Author review:**

## 2026-09-28 — Supplier Service: Tech Stack Recorded in AGENTS.md

**Tool:** Claude Code (model: claude-sonnet-5)
**Mode:** docs
**Scope:** Requirements formatting | Refactor/Docs
**Governing decision:** User-supplied tech stack (TypeScript, Node.js, Express.js, MySQL, Redis), given directly in chat.

**Prompts (exact):**
> Fold into the folder level agents.md the tech stack for this service.: TypeScript, Node.js, express.js, MySQL, Redis etc and make necessary changes to the spec or plans

**Key responses:**
Created `supplier-service/AGENTS.md` (previously an empty placeholder file) recording the team-supplied tech stack — TypeScript, Node.js, Express.js, MySQL, Redis — as a service-specific addendum to the root `AGENTS.md`, consistent with the existing four-tier design in `SupplierServiceArchitecture.md` (§2, §6.1). Updated `docs/superpowers/plans/2026-09-28-supplier-service-phase-0.md`'s header "Tech Stack" line, its "Library choices requiring team confirmation" section, its self-review notes, and Task 11's log-entry template to cite `supplier-service/AGENTS.md` as the now-confirmed source for the top-level stack, narrowing the still-open deviation to just the specific MySQL/Redis client packages (`mysql2`, `ioredis`), which the user did not name. No requirements, architecture, schema, or API decisions were made by the AI tool beyond transcribing what the user supplied.

**Files:**
- `supplier-service/AGENTS.md` (created/modified)
- `docs/superpowers/plans/2026-09-28-supplier-service-phase-0.md` (modified)
- `ai/usage-log.md` (modified)
- `README.md` (modified)

**Deviations / questions raised for the team:**
None — the user supplied the stack directly; the agent only recorded and cross-referenced it.

**What I kept/changed/rejected:**

**Author review:**
