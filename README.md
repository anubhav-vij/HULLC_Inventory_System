# HULLC Inventory Management System

A full-stack inventory management system built for the **Hu Lab at NIAID/NIH (HULLC)**. Tracks reagent and consumable stock across multiple lots, manages dispensing transactions, handles multi-stage supply request approvals, and provides metrics dashboards — all backed by PostgreSQL with a Next.js 15 REST API.

**Live demo:** [production.d2v9jxoej8ezlm.amplifyapp.com](https://production.d2v9jxoej8ezlm.amplifyapp.com)
**Default login:** `X`

---

## Table of Contents

1. [Features](#1-features)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Local Development Setup](#4-local-development-setup)
5. [Database Migrations](#5-database-migrations)
6. [API Reference](#6-api-reference)
7. [Deployment](#7-deployment)
8. [Branch Strategy](#8-branch-strategy)
9. [Session Log](#9-session-log)

---

## 1. Features

### Inventory Management
- Add, edit, and delete reagents/consumables with multiple tracked lots (quantity, receipt date, expiration, storage location, SDS/CoA files)
- Manufacturer management with alternate names
- VWR part numbers and cost-per-unit tracking
- SOM (Scientific Operations Manager) approval flag per product
- Storage location management (managed dropdown, prevents deletion of in-use locations)
- Excel import/export with multi-sheet selector for .xlsx files
- Bulk import with persistent placeholder counters for missing data (PRODUCT-#-Missing, LOT-#-Missing, etc.)
- Pagination (75 items per page) across all tables: inventory, transactions, requests, config tables, workflow history, historical records
- Product detail page (Admin only) with stat cards, two-column layout, Print Audit, Edit, and New Transaction actions
- Expanded lots sorted by receipt date (newest first), limited to 3 in inventory view
- Manufacturer alternate name displayed throughout system (inventory table, product detail, Excel export)

### Stock Reservation
- Automatic reservation when requests are approved — prevents double-allocation across concurrent requests
- Product-level `reserved_quantity` tracks stock committed to approved/in-progress requests
- Admin sees **Reserved** and **Available** columns in inventory table
- Reservation released automatically on fulfillment or rejection
- Dispense form shows amber reservation banner when product has active reservations
- Product detail page shows Reserved/Available stat cards when reservations exist

### Dispensing & Transactions
- Record dispensing transactions against specific lots with atomic quantity decrement
- Full transaction reversal (restores lot quantities)
- Transaction history with date range and functional group filtering
- Excel export respects active filters (exports filtered view, not full dataset)

### Request & Approval Workflow
- Multi-line-item requests (each date/quantity pair fulfilled independently)
- Auto-generated request IDs: `HULLC-YYYY-XXXX` (annual sequence)
- Multi-project selection per request (comma-separated display)
- Two-stage approval: Director → (SOM products) Sci-Ops Director → Admin fulfillment
- Director approve/reject with comments; Sci-Ops approve/reject for SOM products
- Admin can approve any pending request across all groups (OOO Director coverage), including SciOps approvals
- Request status machine: Pending Approval → Approved → In Progress → Completed (or Rejected at any stage)
- Workflow history audit trail: tracks all status changes with timestamps, actors, and comments
- Legacy fulfillments displayed as read-only history (phased out in favor of line-item fulfillment flow)

### User Management & Roles
- Email + password authentication (bcrypt)
- 5 roles: **Admin**, **ProjectManager**, **Chief**, **Director**, **Staff**
- Protected System Administrator account (`admin@hullc.nih.gov`) — cannot be deactivated, role/email cannot be changed
- Role-based access: `canEdit` (Admin only for mutations), `hasFullView` (Admin/PM/Chief for read-only visibility)
- Functional group management (7 default groups, one Director per group enforced)
- User activate/deactivate (soft delete)
- Admin override approval: Admins can approve requests on behalf of OOO Directors

### Historical Data Import
- Dedicated Admin page for importing legacy In/Out records from Excel
- Separate `historical_records` table (not mixed into live inventory)
- Type (In/Out) and date range filters
- Historical data automatically included in Received/Disbursed metrics via UNION ALL
- Separate placeholder counter namespace (LOT-#-Missing-Historical)

### Metrics & Reporting
- Inventory Received report with date range filtering and Excel export
- Inventory Disbursed report with date range filtering and Excel export
- Charts Dashboard: transactions/day (line), transactions/week (bar), requests by group (horizontal bar), requests by status (donut), cumulative products (line)
- Global date range picker across all charts
- Printable Material Audit Reports per product (HULLC header, lots, transaction history, confidential footer)

### UI & Responsiveness
- Navy/indigo color scheme with dark teal sidebar
- Dark mode support (CSS variables)
- Mobile responsive: hamburger sidebar, card view for inventory on small screens
- CSS-based sidebar hover/focus with ARIA attributes
- Storage location filter on Inventory tab

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI components | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| Styling | Tailwind CSS |
| Forms | React Hook Form |
| Validation | [Zod](https://zod.dev/) (shared API + client) |
| Charts | [Recharts](https://recharts.org/) |
| Excel | [SheetJS (xlsx)](https://sheetjs.com/) |
| Database | PostgreSQL (Neon free tier for demo, RDS planned) |
| DB client | [node-postgres (`pg`)](https://node-postgres.com/) with connection pooling |
| AI | [Genkit](https://firebase.google.com/docs/genkit) (Google AI) — expiration date prediction |
| Hosting | AWS Amplify |
| Runtime | Node.js 20+ |
| Dev server port | **9002** |

---

## 3. Architecture

```
src/
├── app/
│   ├── api/                          # Next.js Route Handlers (REST API)
│   │   ├── auth/login/               # POST — email+password login
│   │   ├── health/                   # GET — DB connectivity check
│   │   ├── products/                 # CRUD + lot management + bulk-import
│   │   ├── transactions/             # Dispense recording + reversal
│   │   ├── requests/                 # Multi-line-item requests + approval workflow
│   │   │   └── [id]/
│   │   │       ├── approve/          # Director approval
│   │   │       ├── reject/           # Director/Admin rejection
│   │   │       ├── sciops-approve/   # Sci-Ops Director approval (SOM products)
│   │   │       ├── sciops-reject/    # Sci-Ops Director rejection
│   │   │       └── line-items/[lineItemId]/  # Individual line item fulfillment
│   │   ├── fulfillments/             # Fulfillment lifecycle
│   │   ├── functional-groups/        # Group management (Admin)
│   │   ├── users/                    # User CRUD + status toggle (Admin)
│   │   ├── manufacturers/            # Manufacturer management
│   │   ├── storage-locations/        # Storage location management
│   │   ├── vendors/                  # (deprecated — renamed to manufacturers)
│   │   ├── projects/                 # Project management
│   │   ├── historical-records/        # Legacy data import (Admin)
│   │   └── metrics/                  # received, disbursed, dashboard APIs
│   ├── historical-import/
│   │   └── page.tsx                  # Historical data import (Admin)
│   ├── metrics/
│   │   ├── received/page.tsx         # Inventory Received report
│   │   ├── disbursed/page.tsx        # Inventory Disbursed report
│   │   └── dashboard/page.tsx        # Charts dashboard (recharts)
│   ├── products/
│   │   ├── new/page.tsx              # Add Product (full page)
│   │   ├── [id]/page.tsx             # Product detail (Admin only, stat cards + two-column layout)
│   │   └── [id]/edit/page.tsx        # Edit Product (full page)
│   ├── requests/
│   │   ├── new/page.tsx              # New Request (multi-line-item, multi-project)
│   │   └── [id]/page.tsx             # Request detail + fulfillment + status timeline
│   ├── workflow-history/
│   │   └── page.tsx                  # Workflow history audit log (Admin)
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── inventory-page.tsx            # Main SPA client component (~3100 lines)
│   ├── pagination-controls.tsx      # Shared pagination component (75 items/page)
│   ├── sidebar.tsx                   # Dark teal sidebar with role-aware nav
│   ├── material-audit-report.tsx     # Print audit report (createPortal)
│   ├── departmental-page.tsx         # (legacy, localStorage — out of scope)
│   └── ui/                           # shadcn/ui components
├── lib/
│   ├── db/
│   │   ├── index.ts                  # pg Pool singleton, query(), withTransaction()
│   │   ├── schema.sql                # Full PostgreSQL schema
│   │   ├── migrations/               # 19 numbered SQL migration files
│   │   ├── migrate.ts                # Migration runner
│   │   ├── seed.ts                   # Idempotent seed (groups, projects, admin user)
│   │   ├── product-queries.ts        # Shared SQL, row mappers, coerceLotDates
│   │   └── request-queries.ts        # Shared request SQL/mappers (DRY)
│   ├── api-error.ts                  # Typed error helpers (isUniqueViolation, etc.)
│   ├── types.ts                      # Zod schemas + TypeScript types (single source of truth)
│   └── file-store.ts                 # File storage abstraction (IndexedDB → S3 planned)
└── ai/                               # Genkit AI flows
```

### Key database facts
- **15 tables:** users, functional_groups, products, lots, lot_files, product_requests, request_line_items, fulfillments, transactions, transaction_items, projects, manufacturers, storage_locations, historical_records, request_status_history (+ supporting tables: request_id_sequences, schema_migrations)
- Product IDs: `TEXT` format `HULLC-XXXX` (e.g. `HULLC-0001`; legacy `P001` still supported). All other PKs: UUID via `gen_random_uuid()`
- All tables have `created_by`/`updated_by` audit fields referencing `users.id`
- All multi-step writes use `withTransaction()` for atomicity
- Cascade deletes: deleting a product deletes its lots and lot_files

---

## 4. Local Development Setup

### Prerequisites

- **Node.js** 20 or later
- **PostgreSQL 18** installed locally (default port 5432)

### Step 1 — Clone and install

```bash
git clone <repo-url>
cd HULLC_Inventory_System
git checkout production
npm install
```

### Step 2 — Create the database

```sql
CREATE DATABASE hullc_dev;
```

### Step 3 — Configure environment

Create `.env.local` in the project root:

```env
DATABASE_URL=postgresql://postgres:<your-password>@localhost:5432/hullc_dev
DATABASE_SSL=false
```

### Step 4 — Apply schema and migrations

```bash
# Apply base schema
psql -U postgres -d hullc_dev -f src/lib/db/schema.sql

# Run all migrations (001-019)
npx tsx --env-file=.env.local src/lib/db/migrate.ts

# Seed functional groups, projects, and admin user
npx tsx --env-file=.env.local src/lib/db/seed.ts
```

### Step 5 — Start the dev server

```bash
npm run dev
```

The app starts on **http://localhost:9002** (Turbopack).

### Step 6 — Verify

```bash
curl http://localhost:9002/api/health
# → { "status": "ok", "database": "connected", "timestamp": "..." }
```

Login with `admin@hullc.nih.gov` / `Admin1234!`

### Available commands

```bash
npm run dev          # Next.js dev server (port 9002, Turbopack)
npm run build        # Production build
npm run typecheck    # tsc --noEmit (no build artifacts)
npm run lint         # next lint
npm run genkit:dev   # Genkit AI dev server
```

---

## 5. Database Migrations

Migrations live in `src/lib/db/migrations/` as numbered `.sql` files. The runner (`migrate.ts`) tracks applied migrations in a `schema_migrations` table.

```bash
npx tsx --env-file=.env.local src/lib/db/migrate.ts
```

| # | Description |
|---|-------------|
| 001 | Request line items table |
| 002 | Request redesign (multi-line items, approval workflow) |
| 003 | Fulfillment link to line items |
| 004 | Projects table |
| 005 | Request ID sequences (HULLC-YYYY-XXXX format) |
| 006 | Manufacturers table (was vendors) |
| 007 | Unit of measure column on products |
| 008 | Storage locations table |
| 009 | Vendor → manufacturer rename |
| 010 | VWR part number, SOM approval, cost per unit, SOM request columns |
| 011 | Audit fields (created_by/updated_by) on all 13 tables |
| 012 | Backfill request IDs to HULLC-YYYY-XXXX format |
| 013 | Case-insensitive email unique index |
| 014 | Missing indexes (fulfillment_id, is_active columns) |
| 015 | Expanded lot_files MIME type CHECK (3→6 types) |
| 016 | Historical records table for legacy data import |
| 017 | Multi-project support (TEXT→TEXT[]) + request_status_history table |
| 018 | System user flag (`is_system` boolean) for protected super admin |
| 019 | Stock reservation (`reserved_quantity` on products table) |

**Important:** The migration runner splits SQL on `;` — do NOT use PL/pgSQL `DO $$` blocks (semicolons inside break the splitter). Use plain SQL with CTEs and window functions instead.

---

## 6. API Reference

All routes return JSON. Error responses include an `error` string field. Validation errors (422) include `issues` from Zod's `flatten()`. Mutation endpoints require `x-user-role: Admin` header (returns 403 otherwise). Audit fields populated from `x-user-id` header.

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Email + password login (bcrypt) |

### Products
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/products` | List all products with lots |
| `POST` | `/api/products` | Create product + initial lots (Admin) |
| `GET` | `/api/products/:id` | Single product with lots |
| `PUT` | `/api/products/:id` | Update product + sync lots (Admin) |
| `POST` | `/api/products/bulk-import` | Bulk import from Excel with placeholder counters (Admin) |
| `DELETE` | `/api/products/:id` | Delete product — 409 if referenced (Admin) |

### Transactions
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/transactions` | List all (optional `?productId=` filter) |
| `POST` | `/api/transactions` | Dispense — atomic stock decrement (Admin) |
| `DELETE` | `/api/transactions/:id` | Reverse — restores lot quantities (Admin) |

### Requests & Approvals
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/requests` | Role-aware list |
| `POST` | `/api/requests` | Submit with line items |
| `GET` | `/api/requests/:id` | Single request with line items |
| `PUT` | `/api/requests/:id` | Update request |
| `DELETE` | `/api/requests/:id` | Delete (Pending/Rejected only) |
| `PUT` | `/api/requests/:id/approve` | Director or Admin approval |
| `PUT` | `/api/requests/:id/reject` | Director/Admin rejection |
| `PUT` | `/api/requests/:id/sciops-approve` | Sci-Ops approval (SOM products) |
| `PUT` | `/api/requests/:id/sciops-reject` | Sci-Ops rejection |
| `PUT` | `/api/requests/:id/line-items/:lineItemId` | Fulfill individual line item (Admin) |

### Fulfillments
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/fulfillments` | List all |
| `POST` | `/api/fulfillments` | Start fulfillment for request (Admin) |
| `PUT` | `/api/fulfillments/:id` | Dispense against fulfillment (Admin) |
| `DELETE` | `/api/fulfillments/:id` | Cancel fulfillment (Admin) |

### Configuration (Admin only)
| Method | Path | Description |
|--------|------|-------------|
| `GET/POST` | `/api/functional-groups` | List / create groups |
| `PUT/DELETE` | `/api/functional-groups/:id` | Update / deactivate group |
| `GET/POST` | `/api/users` | List / create users |
| `GET/PUT/DELETE` | `/api/users/:id` | Get / update / delete user |
| `PUT` | `/api/users/:id/status` | Activate / deactivate user |
| `GET/POST` | `/api/manufacturers` | List / create manufacturers |
| `PUT` | `/api/manufacturers/:id` | Update manufacturer |
| `GET/POST` | `/api/storage-locations` | List / create locations |
| `PUT` | `/api/storage-locations/:id` | Update location (409 if in use) |
| `GET/POST` | `/api/projects` | List / create projects |
| `PUT` | `/api/projects/:id` | Update project |

### Workflow History
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/workflow-history` | Status change audit log (Admin, optional `?requestId=` filter) |

### Historical Records
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/historical-records` | List all (Admin) |
| `POST` | `/api/historical-records` | Bulk import legacy In/Out records (Admin) |
| `DELETE` | `/api/historical-records` | Clear all records (Admin) |

### Metrics
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/metrics/received` | Inventory received (date range filter) |
| `GET` | `/api/metrics/disbursed` | Inventory disbursed (date range filter) |
| `GET` | `/api/metrics/dashboard` | Dashboard aggregates (5 parallel queries) |

### System
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Database connectivity + timestamp |

---

## 7. Deployment

### Current: AWS Amplify + Neon PostgreSQL

The app is deployed on **AWS Amplify** connected to the `production` branch with auto-deploy on push. Database is **Neon PostgreSQL** (free tier) for demo purposes.

**Live URL:** `production.d2v9jxoej8ezlm.amplifyapp.com`

Build configuration is in `amplify.yml`. Amplify env vars don't reach the SSR runtime by default — the build step writes them to `.env.production`.

### Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_SSL` | `true` for production (enables SSL) |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` for Neon; `true` for RDS |
| `NODE_ENV` | `production` |

### Planned: NIH/NIAID AWS Infrastructure

Production deployment will migrate to NIAID-managed AWS:
- **Amazon RDS** PostgreSQL (replaces Neon free tier)
- **Amazon S3** for file storage (replaces IndexedDB)
- **AWS Cognito** + NIH SSO for authentication (replaces email/password)
- Custom domain via NIH IT DNS

See `docs/TASKS.md` for the full migration roadmap (Phases 15-16).

---

## 8. Branch Strategy

| Branch | Purpose |
|--------|---------|
| `master` | Original localStorage-only demo. No database dependency. |
| `production` | Full-stack PostgreSQL branch. Actively developed. Deployed to Amplify. |

All active development happens on `production`. `master` is kept as a reference of the original client-side implementation.

---

## 9. Session Log

| Session | Date | Summary |
|---------|------|---------|
| 1 | 2026-03-05 | Database schema (7 tables), Products API, pg Pool singleton |
| 2 | 2026-03-06 | Transactions, Requests, Fulfillments APIs with atomic operations |
| 3 | 2026-03-07 | Frontend migration from localStorage to API, full smoke test |
| 4 | 2026-03-08 | Phase 1: User management, functional groups, email+password login |
| 5 | 2026-03-09 | Phase 2: Request redesign, multi-line-items, Director approval workflow |
| 6 | 2026-03-10 | Projects table, config UI, Director approve dialog, full-page product forms |
| 7 | 2026-03-10 | (continued Session 6 work) |
| 8 | 2026-03-11 | Role-aware nav, vendors→manufacturers, UoM, storage locations, sidebar config |
| 9 | 2026-03-11 | Manufacturer rename, SOM 2-stage approval, form contrast, inline validation |
| 10-11 | 2026-03-11 | Audit fields on all 13 tables + 19 API endpoints |
| 12 | 2026-03-11 | PM/Chief roles UI, metrics pages, Excel sheet selector |
| 13 | 2026-03-11 | CSS overhaul (navy/indigo), dark mode, print styles, request ID backfill |
| 14 | 2026-03-11 | Audit reports, charts dashboard, mobile responsive, AWS Amplify deploy |
| 15 | 2026-03-12 | Codebase review & hardening: security guards, bug fixes, DRY refactors, frontend quality |
| 16 | 2026-03-12 | Role access overhaul: Dashboard Admin-only, PM/Chief restricted to Inventory+Transactions+Metrics, Admin override approvals for OOO Directors |
| 17 | 2026-03-12 | Planning session: import redesign, HULLC-XXXX product IDs, historical data approach (no code) |
| 18 | 2026-03-13 | Import redesign: HULLC-XXXX IDs, bulk import with persistent placeholders, historical data page, dashboard clickable cards, inventory pagination |
| 19 | 2026-03-13 | Post-demo fixes: metrics dashboard bug fix, product detail page, workflow history audit trail, multi-project requests, timezone fixes, lots sorting |
| 20 | 2026-03-13 | System-wide pagination (75/page), manufacturer alternate names, product detail redesign, legacy fulfillments read-only, export filters, view details Admin-only, protected system admin |
| 21 | 2026-03-13 | Phase 7: Stock reservation, system admin name edit fix, Admin SciOps approval override |

For detailed task-by-task history, see `docs/TASKS.md`.

---

*Built for laboratory inventory management at NIH/NIAID — HULLC.*
