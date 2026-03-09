# Session Log — HULLC Inventory System Migration

---

## Session 1 — 2026-03-05

### What was accomplished

1. **Migration audit report** — Full codebase analysis: every localStorage key, all TypeScript/Zod schemas, React hooks, component summaries, and a prioritised list of API endpoints needed to replace localStorage with PostgreSQL.

2. **PostgreSQL schema** — Created src/lib/db/schema.sql with 7 tables (users, products, lots, lot_files, product_requests, fulfillments, transactions, transaction_items), 4 enums (user_role, department, request_status, project_name), a reusable set_updated_at() trigger applied to every table, FK constraints with CASCADE and RESTRICT rules, and indexes on all common query patterns.

3. **Schema documentation** — Created src/lib/db/schema.md: plain-English walkthrough of every table, cascade vs restrict deletes, why denormalized snapshot columns exist (audit trail), and the object storage workflow for lot file binaries.

4. **Application rename: StockPilot to HULLC** — Replaced every occurrence across the codebase:
   - src/components/icons.tsx: StockPilotLogo renamed to HullcLogo
   - src/components/inventory-page.tsx: logo import, localStorage keys, JSX, card title
   - src/components/departmental-page.tsx: logo import, localStorage keys, JSX
   - src/app/layout.tsx: page title and description metadata
   - src/lib/db/schema.sql: localStorage key references in comments
   - Markdown docs (blueprint.md, PROCESS_DIAGRAM.md, e2e-tests.md, PRODUCT_REQUIREMENTS_DOCUMENT.md): all prose references updated

5. **Database connection utility** — Created src/lib/db/index.ts:
   - pg Pool with DATABASE_URL env guard, SSL in production only, max 10 connections
   - Hot-reload singleton via globalThis._hullcPgPool in dev, fresh Pool in production
   - query<T>() helper with slow-query logging (over 200ms in dev)
   - getClient() for manual transaction control
   - withTransaction<T>() wrapper: handles BEGIN/COMMIT/ROLLBACK and guaranteed client.release()

6. **Health check route** — Created src/app/api/health/route.ts: runs SELECT NOW(), returns status/database/timestamp JSON or 500 on error.

7. **Products REST API** — Full CRUD across three files:
   - src/app/api/products/route.ts: GET all products with lots via json_agg; POST with atomic lot inserts and sequential P001/P002 ID generation via SELECT FOR UPDATE
   - src/app/api/products/[id]/route.ts: GET single, PUT with lot diff/sync atomically, DELETE with cascade and 409 on FK violation
   - src/lib/db/product-queries.ts: shared SQL, rowToProduct mapper, coerceLotDates preprocessor (ISO string to Date for Zod), generateNextProductId, syncLotFile

8. **Integration test script** — Created and ran src/lib/db/test-products-api.ts via npx tsx. Five steps: POST, GET all, GET one, PUT, DELETE. All 10 assertions passed against the live dev server.

---

### Current state of the codebase

    src/app/api/health/route.ts              GET /api/health
    src/app/api/products/route.ts            GET /api/products, POST /api/products
    src/app/api/products/[id]/route.ts       GET, PUT, DELETE /api/products/:id
    src/app/layout.tsx                       updated title
    src/components/inventory-page.tsx        main admin UI (still uses localStorage)
    src/components/departmental-page.tsx     staff UI (still uses localStorage)
    src/components/icons.tsx                 HullcLogo component
    src/lib/db/index.ts                      pg Pool and query helpers
    src/lib/db/schema.sql                    full PostgreSQL schema (7 tables)
    src/lib/db/schema.md                     plain-English schema guide
    src/lib/db/product-queries.ts            shared SQL, mappers, helpers
    src/lib/db/test-products-api.ts          integration test script
    src/lib/types.ts                         Zod schemas and types (unchanged)
    src/hooks/                               all hooks still wired to localStorage
    src/ai/                                  Genkit AI flows (unchanged)
    docs/blueprint.md                        original app brief
    docs/SESSION_LOG.md                      this file

The UI components and all React hooks still use localStorage. The database layer is fully built and tested in isolation. UI wiring is the next phase.

---

## Session 4 — 2026-03-09

### What was accomplished

**Phase 1 — User Management fully implemented.**

#### Database
- Applied `001_add_functional_groups.sql` — creates `functional_groups` table (id UUID, name TEXT UNIQUE, is_active, timestamps + trigger)
- Applied `002_update_users.sql` — adds `Director`, `ProjectManager`, `Chief` to `user_role` enum; adds `full_name`, `email TEXT UNIQUE`, `password_hash`, `functional_group_id` (FK → functional_groups), `is_active` columns to `users`
- Created `src/lib/db/migrate.ts` — migration runner that reads all `.sql` files from `src/lib/db/migrations/` in order, runs each statement in autocommit mode (required for `ALTER TYPE ADD VALUE`), and records applied files in `schema_migrations`
- Created `src/lib/db/seed.ts` — seeds 7 HULLC functional groups and an initial Admin user (`admin@hullc.nih.gov` / `Admin1234!`) idempotently

#### API Routes
| Route | Purpose |
|-------|---------|
| `GET /api/functional-groups` | List groups (`?active=false` includes inactive) |
| `POST /api/functional-groups` | Create group (Admin only) |
| `PUT /api/functional-groups/[id]` | Rename or activate/deactivate group (Admin only) |
| `GET /api/users` | List all users with functional group name (Admin only) |
| `POST /api/users` | Create user with bcrypt-hashed password (Admin only) |
| `PUT /api/users/[id]` | Edit name, email, role, functional group (Admin only) |
| `PUT /api/users/[id]/status` | Activate or deactivate user (Admin only) |
| `POST /api/auth/login` | Verify email + password, return full user profile |

- Admin-only routes use a `x-user-role: Admin` request header (placeholder; full auth in Phase 15)
- One Director per functional group enforced at API level (POST and PUT /api/users check existing active directors for the group; returns 409 on violation)
- Password hashing uses `bcryptjs` (cost factor 12)
- Login uses generic error message to prevent email enumeration

#### Frontend
- Replaced role-dropdown login with email + password form — posts to `/api/auth/login`, stores full user profile in localStorage
- localStorage restore now requires `id` field — old placeholder sessions are cleared automatically on first load
- Header updated to show user's full name and role
- Added **User Management** tab (Admin only):
  - User table: name, email, role, functional group, active/inactive badge, edit and toggle-status buttons
  - Functional Groups table: name, active/inactive badge, rename and toggle-status buttons
  - Add/Edit User dialog: full name, email, temporary password (create only), role select (all 5 roles), functional group select (active groups only), Director warning label
  - Add/Edit Group dialog: group name field
- `src/lib/types.ts` updated: `UserRole` expanded to 5 values, `USER_ROLES` constant added, `FunctionalGroup` and `SystemUser` types added, `User` type extended with optional profile fields

#### Packages installed
- `bcryptjs@3.0.3` + `@types/bcryptjs`

### First-time setup instructions (after pulling this session's changes)
```bash
npx tsx --env-file=.env.local src/lib/db/migrate.ts   # apply DB migrations
npx tsx --env-file=.env.local src/lib/db/seed.ts       # seed groups + admin user
npm run dev                                              # start dev server on port 9002
```
Login: `admin@hullc.nih.gov` / `Admin1234!`

### Current state of the codebase

    src/lib/db/migrations/001_add_functional_groups.sql   ✅ applied
    src/lib/db/migrations/002_update_users.sql             ✅ applied
    src/lib/db/migrate.ts                                  migration runner
    src/lib/db/seed.ts                                     seed script (functional groups + admin)
    src/app/api/functional-groups/route.ts                 GET, POST
    src/app/api/functional-groups/[id]/route.ts            PUT
    src/app/api/users/route.ts                             GET, POST
    src/app/api/users/[id]/route.ts                        PUT
    src/app/api/users/[id]/status/route.ts                 PUT
    src/app/api/auth/login/route.ts                        POST
    src/components/inventory-page.tsx                      ✅ email+password login, User Management tab
    src/lib/types.ts                                       ✅ UserRole (5 values), SystemUser, FunctionalGroup

---

## Session 3 — 2026-03-07

### What was accomplished

**inventory-page.tsx fully migrated from localStorage to real API calls.**

All 14 mutating handlers and the data-loading effect now use `fetch()` against the REST API:

| Handler | API call |
|---------|----------|
| Data load on login | `Promise.all([GET /api/products, GET /api/transactions, GET /api/requests, GET /api/fulfillments])` |
| handleSaveProduct (add) | `POST /api/products` |
| handleSaveProduct (edit) | `PUT /api/products/:id` |
| handleConfirmDeleteProduct | `DELETE /api/products/:id` |
| handleSaveTransaction (standalone) | `POST /api/transactions` |
| handleSaveTransaction (fulfillment) | `PUT /api/fulfillments/:id` |
| handleConfirmDeleteTransaction | `DELETE /api/transactions/:id` |
| handleSaveRequest | `POST /api/requests` |
| handleFulfillRequest | `POST /api/fulfillments` |
| handleConfirmRejectRequest | `PUT /api/requests/:id` |
| handleConfirmCancelFulfillment | `DELETE /api/fulfillments/:id` |
| handleFileImport (CSV) | PUT for existing IDs, POST for new products |

**Removed:**
- `initialProducts` seed data (server returns real DB rows now)
- Auto-save `useEffect` (API mutations replace it)
- `nextProductId` useMemo (server generates sequential P-IDs)
- Per-department localStorage key variables

**Intentionally kept:**
- User session in `localStorage` — auth migration is deferred
- `addFulfilledItemsToDepartmentInventory` localStorage — departmental system is excluded from migration (still used by departmental-page.tsx)

**Bug fixed:**
- Pre-existing TypeScript error in `handleDepartmentSelect`: `User.department` was typed as a strict union but `department: string` parameter was passed directly; fixed with `as User['department']` cast.

**Behavioral change from localStorage version:**
- Fulfillment dispense via `PUT /api/fulfillments/:id` always marks the request `Completed` immediately. The old UI had partial-fulfillment logic (accumulate multiple dispenses until totalFulfilled ≥ totalQuantityRequested). The API is single-shot by design — one call completes the fulfillment.

### Current state of the codebase

    src/app/api/health/route.ts                     GET /api/health
    src/app/api/products/route.ts                   GET /api/products, POST /api/products
    src/app/api/products/[id]/route.ts              GET, PUT, DELETE /api/products/:id
    src/app/api/transactions/route.ts               GET /api/transactions, POST /api/transactions
    src/app/api/transactions/[id]/route.ts          DELETE /api/transactions/:id
    src/app/api/requests/route.ts                   GET /api/requests, POST /api/requests
    src/app/api/requests/[id]/route.ts              GET, PUT, DELETE /api/requests/:id
    src/app/api/fulfillments/route.ts               GET /api/fulfillments, POST /api/fulfillments
    src/app/api/fulfillments/[id]/route.ts          PUT, DELETE /api/fulfillments/:id
    src/components/inventory-page.tsx               ✅ fully migrated to API (no product/tx/request/fulfillment localStorage)
    src/components/departmental-page.tsx            still uses localStorage (excluded from migration)

### Next steps in order

1. **End-to-end smoke test** — start the dev server (`npm run dev`), log in as Admin → Core, verify products load from DB, add/edit/delete a product, dispense a transaction, submit and fulfill a request
2. **departmental-page.tsx** — decide if/when to migrate (currently excluded per project scope)
3. **useUser hook / auth** — replace pick-a-role login with NIH SSO (SAML/OIDC via login.nih.gov); wire users table
4. **Object storage** — S3 on personal AWS for lot file binaries; upload/download/delete API routes
5. **Seed script** — migrate any existing localStorage data to PostgreSQL
6. **Staging deploy** — personal AWS with DATABASE_URL and DATABASE_SSL env vars

---

### Database state

- **Provider**: PostgreSQL via DATABASE_URL environment variable
- **Schema**: Applied from src/lib/db/schema.sql
- **Tables**: users, products, lots, lot_files, product_requests, fulfillments, transactions, transaction_items
- **Enums**: user_role, department, request_status, project_name
- **Connection pool**: max 10 connections, 30s idle timeout, 5s connection timeout
- **SSL**: Enabled automatically in NODE_ENV=production; disabled in dev
- **File storage**: lot_files stores metadata only. Binaries go to object storage (S3/GCS) using the lot_files.id UUID as the object key — mirrors the previous IndexedDB pattern

---

### What was intentionally removed / changed

| What | Why |
|----|-----|
| Departmental product tables dropped | The departmental system was excluded from the schema. departmental-page.tsx exists but will not be migrated. Focus is the core HULLC inventory only. |
| StockPilot brand removed entirely | Application renamed to HULLC throughout. No trace of the old name remains in source files. |
| localStorage as primary store | All five hullc-* localStorage keys are being replaced by PostgreSQL. Keys still exist in UI components pending hook migration. |
| IndexedDB file storage | The lot_files table replaces idb-keyval for file metadata. UUID key pattern preserved. Binary migration to object storage is deferred. |

---

### Next steps in order

1.  **Lots API** — endpoints for adding, editing, and deleting individual lots (with transaction-history guard on delete)
2.  **Transactions API** — GET list and POST new dispense: atomic decrement of lot quantities + insert transaction + transaction_items in one withTransaction call
3.  **Product requests API** — GET list, POST submit request, PATCH status (Pending to Rejected or In Progress)
4.  **Fulfillments API** — POST create from request, GET single, POST dispense event, DELETE cancel
5.  **Replace useProducts hook** — rewrite to fetch from /api/products instead of localStorage; keep same return shape so components need no changes
6.  **Replace useTransactions hook** — rewrite to fetch from /api/transactions
7.  **Replace useProductRequests hook** — rewrite to fetch from /api/requests
8.  **Replace useFulfillments hook** — rewrite to fetch from /api/fulfillments
9.  **Replace useUser hook** — POST to /api/users on login, persist user ID in a cookie/session
10. **Authentication** — add NIH SSO (login.nih.gov, SAML/OIDC) and wire the users table to real identities via an external_id column. Deferred to near the end of the migration.
11. **Object storage** — wire up S3 on personal AWS account for staging; implement file upload/download/delete endpoints for lot files
12. **Seed script** — one-time migration of any existing localStorage data to PostgreSQL
13. **Remove localStorage code** — once all hooks are migrated, delete all localStorage.getItem/setItem calls
14. **Deploy to staging** — personal AWS account with DATABASE_URL and DATABASE_SSL environment variables configured

---

### Key decisions made

| Decision | Rationale |
|----------|-----------|
| PostgreSQL over DynamoDB | Relational data with foreign keys, transactions, and complex joins (fulfillment to transactions to lots) maps naturally to SQL. DynamoDB would require significant denormalization and application-side join logic. |
| NIH SSO authentication deferred to the end | Auth is a dependency blocker for nothing else in the migration. All API routes will be built and tested without auth first. The users table has the right shape for an external_id column when SSO is added. |
| Personal AWS account for staging | Keeps the staging environment independent of NIH infrastructure during development. Production deployment to NIH-managed infrastructure is a separate future step. |
| Auth placeholder approach | The current pick-a-role login screen is preserved as-is during migration. The users table is ready for real auth but no credentials are stored yet. |
| Product IDs stay as P001/P002 TEXT | The sequential format is established in data and UI. Switching to UUIDs for products would break display logic and user familiarity. All other primary keys use UUIDs. |
| One fulfillment per request enforced at DB level | UNIQUE(request_id) on fulfillments prevents accidental duplicate fulfillments, which would double-dispense stock. |
| Denormalized snapshot columns | product_name in transactions/requests, lot_number in transaction_items. Intentional: renaming a product later must not corrupt the historical audit trail. |
| withTransaction as the standard write pattern | All multi-step writes use withTransaction() to guarantee atomicity and prevent leaked connections. getClient() is reserved for fine-grained control only. |
