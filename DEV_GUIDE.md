# Developer Guide

Reference for commands, architecture, and conventions used in this repository.

## Commands

```bash
# Development (port 9002)
npm run dev          # Next.js with Turbopack

# Build & validate
npm run build
npm run typecheck    # tsc --noEmit (no build artifacts)
npm run lint         # next lint

# Database scripts (require .env.local with DATABASE_URL)
npx tsx --env-file=.env.local src/lib/db/migrate.ts   # run pending migrations
npx tsx --env-file=.env.local src/lib/db/seed.ts      # seed functional groups + admin user

# AI (Genkit)
npm run genkit:dev   # start Genkit dev server
```

There is no test suite. Type-check with `npm run typecheck` to validate before committing.

## Architecture

### Stack
- **Next.js 15 App Router** — all routes are server components or API route handlers
- **PostgreSQL** via `pg` — no ORM; raw SQL with a pool singleton
- **Zod** — shared schema definitions in `src/lib/types.ts` that drive both form validation and API validation
- **React Hook Form** + Radix UI + Tailwind CSS (shadcn/ui components in `src/components/ui/`)
- **Genkit** (Google AI) — AI flow for predicting expiration dates (`src/ai/`)

### Request lifecycle
The single page (`src/app/page.tsx`) renders `<InventoryPage />` which is a large client component. All data mutations go through `fetch()` calls to Next.js API routes. API routes validate with Zod, then call the pg pool directly.

Auth state lives in React state inside `InventoryPage` — there is no session cookie or JWT yet. `POST /api/auth/login` verifies bcrypt password and returns a user profile; the client stores it in state.

### Database layer (`src/lib/db/`)
- `index.ts` — `pg` Pool singleton (stored on `globalThis` in dev to survive hot reloads); exports `query()`, `getClient()`, `withTransaction()`
- `schema.sql` — initial schema (7 tables: products, lots, lot_files, product_requests, fulfillments, transactions, transaction_items)
- `migrations/` — numbered `.sql` files applied by `migrate.ts`; tracked in `schema_migrations` table
- `product-queries.ts` — shared SQL (`PRODUCT_SELECT_SQL`), row mappers (`rowToProduct`), `coerceLotDates()`, `generateNextProductId()`, `syncLotFile()`
- `seed.ts` — idempotent seed: 7 functional groups + `admin@hullc.nih.gov / Admin1234!`

**Always use `withTransaction()` for multi-step writes.** Use `query()` for single queries.

### API routes (`src/app/api/`)
All routes follow the same pattern: parse body → Zod validate → query DB → return JSON.

| Route | Methods |
|-------|---------|
| `/api/products` | GET, POST |
| `/api/products/[id]` | GET, PUT, DELETE |
| `/api/transactions` | GET, POST |
| `/api/transactions/[id]` | DELETE |
| `/api/requests` | GET, POST |
| `/api/requests/[id]` | GET, PUT, DELETE |
| `/api/fulfillments` | GET, POST |
| `/api/fulfillments/[id]` | GET, PUT, DELETE |
| `/api/functional-groups` | GET, POST |
| `/api/functional-groups/[id]` | PUT, DELETE |
| `/api/users` | GET, POST |
| `/api/users/[id]` | GET, PUT, DELETE |
| `/api/users/[id]/status` | PUT |
| `/api/auth/login` | POST |
| `/api/health` | GET |

Authorization is role-checked via the `x-user-role` request header (set by the client from login state). Admin-only endpoints check this header.

### Types (`src/lib/types.ts`)
Single source of truth for all domain types. Key things:
- `z.string().optional()` does **not** accept `null` — use `undefined` or omit the field
- `z.date()` expects `Date` objects — use `coerceLotDates()` before `safeParse()` on request bodies
- Product IDs are `TEXT` in format `HULLC-0001`, `HULLC-0002` (legacy `P001` format also supported) — not UUIDs
- All other PKs are UUIDs via `gen_random_uuid()`

### Key data model facts
- A product's total stock = sum of all its lot quantities
- Cascade deletes: deleting a product deletes its lots and lot_files rows
- Lot files store only metadata in DB; binaries go to object storage (S3 — not yet implemented)
- `product_name` and `lot_number` are denormalized into transactions/requests as historical snapshots
- One fulfillment per product request (DB-enforced unique constraint)

### `departmental-page.tsx`
Still uses localStorage (not yet migrated to the API). This component is out of scope for the current migration.

## Environment
Requires `.env.local` with `DATABASE_URL` (PostgreSQL connection string). SSL is auto-enabled in production; set `DATABASE_SSL=false` to disable.
