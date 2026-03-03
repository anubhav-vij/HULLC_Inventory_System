# CLAUDE.md — StockPilot Inventory Management System

This file provides guidance for AI assistants working in this repository.

---

## Project Overview

**StockPilot** is a browser-based inventory management system built for HULLC and affiliated departments (Cardiology, Neurology, Oncology, Pediatrics, R&D). It tracks products, lots, transactions, and departmental product requests with a role-based access model.

- **Stack**: Next.js 15 (App Router) + React 18 + TypeScript 5 + Tailwind CSS + ShadCN UI
- **AI layer**: Google Genkit 1.13 with Gemini 2.0 Flash (expiration date prediction)
- **Persistence**: Browser `localStorage` (primary) + IndexedDB via `idb-keyval` (file attachments)
- **Deployment**: Firebase App Hosting (`apphosting.yaml`)

There is no backend database. All data lives in the user's browser.

---

## Repository Structure

```
/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Root page — renders <InventoryPage />
│   │   ├── layout.tsx        # Root layout (metadata, Toaster)
│   │   └── globals.css       # Global Tailwind styles
│   ├── components/
│   │   ├── inventory-page.tsx    # PRIMARY component (~2,600 lines): auth, inventory CRUD,
│   │   │                         #   requests, transactions, CSV import/export
│   │   ├── departmental-page.tsx # Departmental staff/admin view
│   │   ├── product-form.tsx      # Add/edit products and lots (with file upload)
│   │   ├── transaction-form.tsx  # Create transactions from requests
│   │   ├── request-form.tsx      # Staff product-request submission form
│   │   ├── icons.tsx             # StockPilotLogo SVG component
│   │   └── ui/                   # 50+ ShadCN/Radix UI primitives
│   ├── lib/
│   │   ├── types.ts          # All Zod schemas and derived TypeScript types
│   │   ├── actions.ts        # Next.js Server Actions ("use server")
│   │   ├── file-store.ts     # IndexedDB helpers (save/get/delete files)
│   │   └── utils.ts          # cn() utility (clsx + tailwind-merge)
│   ├── hooks/
│   │   ├── use-toast.ts      # Toast notification hook
│   │   └── use-mobile.tsx    # Viewport width → isMobile boolean
│   └── ai/
│       ├── genkit.ts         # Genkit AI client (Gemini 2.0 Flash)
│       ├── dev.ts            # dotenv + Genkit dev startup
│       └── flows/
│           └── predict-expiration-dates.ts  # AI flow (not yet wired to UI)
├── docs/
│   └── blueprint.md          # Design guidelines (colours, fonts, app name)
├── e2e-tests.md              # 79 manual E2E test cases (primary QA reference)
├── PROCESS_DIAGRAM.md        # PlantUML admin/staff workflow diagrams
├── PRODUCT_REQUIREMENTS_DOCUMENT.md  # Full PRD (v1.0 Live)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json           # ShadCN config
└── apphosting.yaml           # Firebase App Hosting (maxInstances: 1)
```

---

## Development Commands

```bash
# Start development server (Turbopack, port 9002)
npm run dev

# Type-check (no emit)
npm run typecheck

# Lint
npm run lint

# Production build
npm run build

# Start production server
npm run start

# Genkit AI dev server
npm run genkit:dev

# Genkit watch mode
npm run genkit:watch
```

The dev server runs on **port 9002** (not 3000).

---

## Key Conventions

### TypeScript

- All schemas live in `src/lib/types.ts` using **Zod**. Types are derived via `z.infer<typeof Schema>` — do not write manual interfaces that duplicate Zod schemas.
- Path alias `@/*` → `./src/*` (configured in `tsconfig.json` and `components.json`).
- `tsconfig.json` has strict mode enabled; `next.config.ts` intentionally ignores TypeScript and ESLint errors during builds (do not rely on the build to catch type errors — run `npm run typecheck` explicitly).

### React & Next.js

- All UI components use `"use client"` — this is a client-rendered app.
- Server Actions (`"use server"`) are isolated to `src/lib/actions.ts`.
- No global state library (Redux, Zustand, etc.) — state lives in `useState` within `inventory-page.tsx` and is synced to `localStorage` on every change.
- Custom hooks are in `src/hooks/`.

### Forms

- Use **React Hook Form** with `zodResolver` for all forms.
- Dynamic fields (lots) use `useFieldArray`.
- Validation errors surface automatically from Zod schemas.

### UI Components

- Use **ShadCN UI** components from `src/components/ui/` for all UI primitives.
- Icons come from **Lucide React** (`lucide-react`).
- Styling is **Tailwind CSS** utilities only — no inline styles, no CSS modules.
- Use the `cn()` utility from `src/lib/utils.ts` for conditional class merging.
- Dark mode is class-based (`dark:` variants). CSS variables define the color palette.

### Data Layer

- Data is stored in `localStorage` under namespaced keys defined in `src/lib/types.ts` (pattern: `stockpilot-{entity}-data-{department}`).
- File attachments (PDFs, images per lot) are stored in **IndexedDB** via `src/lib/file-store.ts`.
- There is intentionally no backend API — do not add server-side data fetching.

### Notifications

- User feedback is via the `useToast` hook (`src/hooks/use-toast.ts`) — call `toast({ title, description, variant })`.
- `variant: "destructive"` for errors.

### Naming

| Entity | Convention |
|---|---|
| React components | PascalCase (`ProductForm`) |
| Functions / variables | camelCase (`handleFileChange`) |
| Constants | UPPER_SNAKE_CASE (`DEPARTMENTS`, `STORAGE_KEYS`) |
| Files | kebab-case (`product-form.tsx`) |

---

## Data Model Summary

All schemas are defined in `src/lib/types.ts`. Key entities:

| Schema | Key Fields |
|---|---|
| `LotSchema` | `id`, `lotNumber`, `quantity`, `receiptDate`, `expirationDate`, `location`, `file`, `notes` |
| `ProductSchema` | `id`, `name`, `vendor`, `vendorPartNumber`, `reorderThreshold`, `lots[]` |
| `TransactionSchema` | `id`, `productId`, `productName`, `date`, `notes`, `items[]`, `totalQuantity`, `requestorName`, `department`, `fulfillmentId` |
| `ProductRequestSchema` | `id`, `productId`, `productName`, `requestorName`, `requestorEmail`, `department`, `project`, `quantity`, `justification`, `date`, `status`, `sopRead`, `rejectionNote` |
| `UserSchema` | `role: 'Admin' \| 'Staff'`, `department` |

**Departments**: `HULLC`, `Cardiology`, `Neurology`, `Oncology`, `Pediatrics`, `R&D`

**Request statuses**: `Pending` → `In Progress` → `Completed` / `Rejected`

**Visual stock indicators**:
- Red badge: zero quantity
- Orange badge: expired lot(s)
- Yellow triangle warning: quantity below `reorderThreshold`

---

## User Roles

| Role | Capabilities |
|---|---|
| **Admin** | Full CRUD on products/lots, manage all requests (approve/reject/fulfill), view/delete transactions, CSV import/export, adjust departmental stock |
| **Staff** | View simplified product list, submit product requests, view own transactions |

Role and department are selected at login and stored in `localStorage` under `stockpilot-user-data`.

---

## AI Integration (Genkit)

- Located in `src/ai/`.
- Uses **Google Gemini 2.0 Flash** via `@genkit-ai/googleai`.
- The expiration date prediction flow (`predict-expiration-dates.ts`) is defined but **not yet wired to the UI** — it's a backend-only capability.
- Requires a Google AI API key (set in `.env` — not committed).
- Start the Genkit dev inspector with `npm run genkit:dev`.

---

## Testing

There is no automated test framework. QA is done manually using the 79 test cases in `e2e-tests.md`.

Test case IDs follow the pattern `{AREA}-{SEQ}` (e.g., `AUTH-001`, `CORE-INV-007`, `DEPT-ADM-003`).

Before submitting changes, verify affected test cases by running `npm run dev` and exercising the relevant flows manually.

For type safety, always run:
```bash
npm run typecheck && npm run lint
```

---

## Environment Variables

`.env*` files are gitignored and never committed. Required variables (injected via Firebase App Hosting or local `.env`):

| Variable | Purpose |
|---|---|
| `GOOGLE_API_KEY` or equivalent | Gemini API access for Genkit flows |

---

## Important Files to Know

| File | Why it matters |
|---|---|
| `src/components/inventory-page.tsx` | Core of the app — all main state and business logic |
| `src/lib/types.ts` | Single source of truth for all data schemas and TypeScript types |
| `src/lib/file-store.ts` | IndexedDB abstraction for lot file attachments |
| `e2e-tests.md` | The QA reference — consult before and after changes |
| `PRODUCT_REQUIREMENTS_DOCUMENT.md` | Feature specifications and acceptance criteria |
| `docs/blueprint.md` | Visual design guidelines (colors, fonts) |

---

## Git Workflow

- All commits are GPG-signed with an SSH key.
- Commit messages are imperative, descriptive, and in plain English.
- Feature branches follow the pattern `claude/<description>-<session-id>`.
- Push with: `git push -u origin <branch-name>`

---

## What Not to Do

- Do not add a backend database or API routes — persistence is intentionally client-side.
- Do not install a global state management library — use `useState` + `localStorage`.
- Do not duplicate Zod schemas as manual TypeScript interfaces.
- Do not write inline styles — use Tailwind classes and `cn()`.
- Do not bypass TypeScript with `any` unless absolutely necessary and documented.
- Do not commit `.env` files.
- Do not change `next.config.ts` to enforce TypeScript/ESLint errors during build — this is intentional.
