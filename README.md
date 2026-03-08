# HULLC Inventory Management System

A full-stack inventory management system built for the **Hu Lab at NIAID/NIH**. The system tracks reagent and consumable stock across multiple lots, manages dispensing transactions, and handles supply requests from departmental staff — all backed by a PostgreSQL database with a Next.js REST API.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Local Development Setup](#4-local-development-setup)
5. [Session Log](#5-session-log)
6. [API Reference](#6-api-reference)
7. [Deployment](#7-deployment)
8. [Branch Strategy](#8-branch-strategy)

---

## 1. Project Overview

### What it does

The HULLC Inventory System gives lab administrators a single interface to:

- **Manage products** — add, edit, and delete reagents and consumables, each with one or more tracked lot records (quantity, receipt date, expiration date, storage location, attached SDS/CoA files)
- **Dispense stock** — record dispensing transactions against specific lots; lot quantities are decremented atomically in the database
- **Handle requests** — departmental staff submit supply requests that admins can approve (start fulfillment), reject with a reason, or cancel
- **Fulfillments** — approved requests become fulfillment records; the admin dispenses items against the fulfillment, which creates a linked transaction and marks the request completed
- **Export data** — download full inventory or transaction history as CSV for reporting
- **CSV import** — bulk-load or update products from a spreadsheet

### Who it's for

| User | Access |
|------|--------|
| **Admin (Core)** | Full inventory management: add/edit/delete products, record transactions, manage requests and fulfillments, import/export |
| **Staff** | Submit supply requests only; cannot view or modify the core inventory |

Authentication is currently a placeholder role-selector screen. NIH SSO (SAML/OIDC via `login.nih.gov`) is planned for the production handoff.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI components | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| Styling | Tailwind CSS |
| Validation | [Zod](https://zod.dev/) (shared between API routes and client forms) |
| Database | PostgreSQL 18 |
| DB client | [node-postgres (`pg`)](https://node-postgres.com/) with connection pooling |
| Runtime | Node.js 20+ |
| Dev server port | **9002** |

---

## 3. Architecture

```
src/
├── app/
│   ├── api/                     # Next.js Route Handlers (REST API)
│   │   ├── health/              # GET  /api/health
│   │   ├── products/            # GET, POST /api/products
│   │   │   └── [id]/            # GET, PUT, DELETE /api/products/:id
│   │   ├── transactions/        # GET, POST /api/transactions
│   │   │   └── [id]/            # DELETE /api/transactions/:id
│   │   ├── requests/            # GET, POST /api/requests
│   │   │   └── [id]/            # GET, PUT, DELETE /api/requests/:id
│   │   └── fulfillments/        # GET, POST /api/fulfillments
│   │       └── [id]/            # PUT, DELETE /api/fulfillments/:id
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── inventory-page.tsx       # Main admin UI (all API-backed)
│   ├── departmental-page.tsx    # Departmental staff UI (localStorage, out of scope)
│   ├── product-form.tsx
│   ├── transaction-form.tsx
│   └── request-form.tsx
└── lib/
    ├── db/
    │   ├── index.ts             # pg Pool singleton, query(), withTransaction()
    │   ├── schema.sql           # Full PostgreSQL schema (7 tables, 4 enums)
    │   ├── schema.md            # Plain-English schema documentation
    │   └── product-queries.ts   # Shared SQL helpers and row mappers
    └── types.ts                 # Zod schemas and TypeScript types
```

### Database schema (7 tables)

```
users               — placeholder for NIH SSO identities
products            — reagents/consumables (P001, P002, … TEXT primary keys)
lots                — individual lot records per product (UUID PKs)
lot_files           — file metadata for SDS/CoA attachments; binaries in object storage
product_requests    — supply requests submitted by staff (status machine)
fulfillments        — one-to-one with a request; tracks dispensing progress
transactions        — dispensing events; quantities decremented atomically
transaction_items   — lot-level line items for each transaction
```

All multi-step writes use `withTransaction()` to guarantee atomicity. Sequential `P001/P002` product IDs are generated inside a `SELECT … FOR UPDATE` to prevent races.

---

## 4. Local Development Setup

### Prerequisites

- **Node.js** 20 or later
- **PostgreSQL 18** installed locally (default port 5432)

### Step 1 — Clone and switch to the migration branch

```bash
git clone <repo-url>
cd HULLC_Inventory_System
git checkout production
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Create the development database

Open **psql** (or pgAdmin) and run:

```sql
CREATE DATABASE hullc_dev;
```

### Step 4 — Configure environment variables

Create `.env.local` in the project root:

```env
DATABASE_URL=postgresql://postgres:<your-password>@localhost:5432/hullc_dev
```

Replace `<your-password>` with your local PostgreSQL `postgres` user password.

### Step 5 — Add PostgreSQL to PATH (Windows)

In each new PowerShell / terminal session, run:

```powershell
$env:PATH += ";C:\Program Files\PostgreSQL\18\bin"
```

To make this permanent, add the path through **System Properties → Environment Variables**.

### Step 6 — Apply the database schema

```bash
psql -U postgres -d hullc_dev -f src/lib/db/schema.sql
```

You will be prompted for the `postgres` password. This creates all 7 tables, 4 enums, indexes, and triggers.

### Step 7 — Start the dev server

```bash
npm run dev
```

The app starts on **http://localhost:9002** (Turbopack).

### Step 8 — Verify the database connection

```bash
curl http://localhost:9002/api/health
```

Expected response:

```json
{ "status": "ok", "database": "connected", "timestamp": "..." }
```

---

## 5. Session Log

### Session 1 — 2026-03-05

**Goal:** Establish the database foundation and Products API.

- Full codebase audit — mapped every localStorage key, all TypeScript/Zod schemas, React hooks, and components
- Designed and created `src/lib/db/schema.sql` (7 tables, 4 enums, triggers, FK constraints, indexes)
- Written `src/lib/db/schema.md` — plain-English documentation of every table and relationship
- Application rename: StockPilot → HULLC throughout all source files
- Built `src/lib/db/index.ts` — pg Pool singleton with `query()`, `getClient()`, `withTransaction()` helpers
- Built `GET /api/health`, `GET/POST /api/products`, `GET/PUT/DELETE /api/products/:id`
- Integration test (`src/lib/db/test-products-api.ts`): 10 assertions, all passed

### Session 2 — 2026-03-06

**Goal:** Complete the remaining API surface.

- Built `GET/POST /api/transactions` and `DELETE /api/transactions/:id`
  - POST atomically validates lot stock, decrements quantities, and inserts transaction + line items in one `withTransaction` call
  - DELETE atomically restores lot quantities and removes the transaction
- Built `GET/POST /api/requests` and `GET/PUT/DELETE /api/requests/:id`
  - PUT enforces valid status transitions (`Pending → In Progress/Rejected`, `In Progress → Completed`)
  - Rejection requires a `rejectionNote` field (enforced at the Zod schema level)
- Built `GET/POST /api/fulfillments` and `PUT/DELETE /api/fulfillments/:id`
  - POST atomically creates the fulfillment and advances the request to `In Progress`
  - PUT atomically creates a dispense transaction, decrements lot quantities, and marks the request `Completed`
  - DELETE resets the request to `Pending` (only allowed if no transactions have been dispensed yet)

### Session 3 — 2026-03-07

**Goal:** Migrate `inventory-page.tsx` from localStorage to the real API. Smoke test passed.

- Replaced all localStorage data loading with a parallel `Promise.all` fetch of all four collections on user login
- Removed the auto-save `useEffect` (API mutations are now the source of truth)
- Removed `initialProducts` seed data and the `nextProductId` client-side ID generator
- Migrated all 14 handler functions to use `fetch()`:

| Handler | API call |
|---------|----------|
| Load on login | `GET /api/products`, `/api/transactions`, `/api/requests`, `/api/fulfillments` |
| Add product | `POST /api/products` |
| Edit product | `PUT /api/products/:id` |
| Delete product | `DELETE /api/products/:id` |
| Dispense (standalone) | `POST /api/transactions` |
| Dispense (fulfillment) | `PUT /api/fulfillments/:id` |
| Delete transaction | `DELETE /api/transactions/:id` |
| Submit request | `POST /api/requests` |
| Reject request | `PUT /api/requests/:id` |
| Start fulfillment | `POST /api/fulfillments` |
| Cancel fulfillment | `DELETE /api/fulfillments/:id` |
| CSV import | `PUT` for existing IDs, `POST` for new products |

---

## 6. API Reference

All routes return JSON. Error responses include an `error` string field. Validation errors (422) additionally include an `issues` field from Zod's `flatten()`.

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Returns database connectivity status and server timestamp |

### Products

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/products` | List all products with their lots |
| `POST` | `/api/products` | Create a product and its initial lots atomically. Server generates the `P001`-format product ID. |
| `GET` | `/api/products/:id` | Get a single product with lots |
| `PUT` | `/api/products/:id` | Update product fields and sync lots (add/update/delete by diffing incoming vs existing lot IDs) |
| `DELETE` | `/api/products/:id` | Delete product. Returns `409` if transactions, requests, or fulfillments reference it. |

### Transactions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/transactions` | List all transactions with line items. Accepts optional `?productId=` filter. |
| `POST` | `/api/transactions` | Create a dispense transaction. Atomically validates stock, decrements lot quantities, inserts transaction and line items. Returns `409` on insufficient stock. |
| `DELETE` | `/api/transactions/:id` | Reverse a transaction. Atomically restores all lot quantities. |

### Product Requests

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/requests` | List all product requests |
| `POST` | `/api/requests` | Submit a new request (status starts as `Pending`) |
| `GET` | `/api/requests/:id` | Get a single request |
| `PUT` | `/api/requests/:id` | Update request status. Enforces valid transitions: `Pending → In Progress \| Rejected`, `In Progress → Completed`. Rejections require `rejectionNote`. |
| `DELETE` | `/api/requests/:id` | Delete a request. Only allowed for `Pending` or `Rejected` status. |

### Fulfillments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/fulfillments` | List all fulfillments with dispensed transactions |
| `POST` | `/api/fulfillments` | Start a fulfillment for a request. Atomically creates the fulfillment and advances the request to `In Progress`. Returns `409` if a fulfillment already exists for the request. |
| `PUT` | `/api/fulfillments/:id` | Dispense items against a fulfillment. Atomically creates a transaction, decrements lot quantities, and marks the linked request `Completed`. |
| `DELETE` | `/api/fulfillments/:id` | Cancel a fulfillment. Only allowed if no transactions have been dispensed. Resets the linked request to `Pending`. |

---

## 7. Deployment

### Target environment

Production deployment targets **NIH/NIAID-managed AWS infrastructure**. The database will be hosted on Amazon RDS (PostgreSQL). The Next.js application will run behind an Application Load Balancer on ECS or Elastic Beanstalk.

### Environment variables (production)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Full PostgreSQL connection string, e.g. `postgresql://user:pass@rds-host:5432/hullc` |
| `DATABASE_SSL` | Set to `true` to enforce SSL on the database connection (required in production) |
| `NODE_ENV` | Set to `production` — enables SSL and disables slow-query logging |

### Authentication

NIH SSO (SAML 2.0 or OIDC via `login.nih.gov`) will be wired up at production handoff. The `users` table already has the correct shape for an `external_id` column to store NIH identity provider subject identifiers. The current role-selector login screen is a placeholder that will be replaced by the SSO redirect flow.

### Schema migrations

Apply the schema to the production database before first deploy:

```bash
psql "$DATABASE_URL" -f src/lib/db/schema.sql
```

For subsequent schema changes, a migration tool (e.g. Flyway or plain numbered SQL files) will be introduced before handoff.

### File storage

Lot attachment files (SDS sheets, Certificates of Analysis) are stored as metadata in the `lot_files` table. Binary file storage will use **Amazon S3** with the `lot_files.id` UUID as the object key. Upload/download/delete API routes are pending implementation.

---

## 8. Branch Strategy

| Branch | Purpose |
|--------|---------|
| `master` | Original localStorage-only demo. No database dependency. Safe to run anywhere without a PostgreSQL instance. |
| `production` | Full-stack migration branch. All inventory data persists in PostgreSQL. This is the branch being actively developed and will become the production release. |

All active development happens on `production`. `master` is kept as a working reference of the original client-side-only implementation and is not updated.
