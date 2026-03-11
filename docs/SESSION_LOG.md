# Session Log — HULLC Inventory System Migration

---

## Session 11 — 2026-03-11

### What was accomplished

Added `created_by` and `updated_by` audit fields to all database tables, wired through all API routes and client-side fetch calls.

1. **Migration 011** — `011_add_audit_fields.sql`:
   - Added `created_by UUID REFERENCES users(id) ON DELETE SET NULL` and `updated_by UUID REFERENCES users(id) ON DELETE SET NULL` to: products, lots, lot_files, product_requests, request_line_items, fulfillments, transactions, transaction_items, users, functional_groups, projects, manufacturers, storage_locations
   - Fixed missing `updated_at` column + trigger on manufacturers, storage_locations, and request_line_items

2. **API Route Updates** — All 19 mutation endpoints now populate audit fields:
   - Products POST/PUT: `created_by`/`updated_by` from `x-user-id` header
   - Transactions POST: `created_by`/`updated_by` on transactions + `created_by` on transaction_items
   - Requests POST: `created_by`/`updated_by` on product_requests + `created_by` on request_line_items
   - Requests PUT (general): `updated_by`
   - Requests approve/reject/sciops-approve/sciops-reject: `updated_by`
   - Requests line-items fulfill: `created_by`/`updated_by` on fulfillments, transactions, transaction_items; `updated_by` on line items and request
   - Fulfillments POST: `created_by`/`updated_by`
   - Users POST/PUT: `created_by`/`updated_by` from acting admin's ID
   - Functional Groups POST/PUT: `created_by`/`updated_by`
   - Projects POST/PUT: `created_by`/`updated_by`
   - Manufacturers POST/PUT: `created_by`/`updated_by`
   - Storage Locations POST/PUT: `created_by`/`updated_by`

3. **Client-Side Updates** — All mutation fetch calls now include `x-user-id` header:
   - `adminHeaders()` helper in inventory-page.tsx now includes `x-user-id`
   - Product new/edit pages send `x-user-id`
   - Request new page sends `x-user-id`
   - Transaction creation, line-item fulfillment, legacy fulfillment, CSV import all send `x-user-id`

### Files created
- `src/lib/db/migrations/011_add_audit_fields.sql`

### Files modified
- `src/app/api/products/route.ts` — created_by in POST
- `src/app/api/products/[id]/route.ts` — updated_by in PUT
- `src/app/api/transactions/route.ts` — created_by on transactions + transaction_items
- `src/app/api/requests/route.ts` — created_by on requests + line items
- `src/app/api/requests/[id]/route.ts` — updated_by in PUT
- `src/app/api/requests/[id]/approve/route.ts` — updated_by
- `src/app/api/requests/[id]/reject/route.ts` — updated_by
- `src/app/api/requests/[id]/sciops-approve/route.ts` — updated_by
- `src/app/api/requests/[id]/sciops-reject/route.ts` — updated_by
- `src/app/api/requests/[id]/line-items/[lineItemId]/route.ts` — created_by/updated_by throughout
- `src/app/api/fulfillments/route.ts` — created_by in POST
- `src/app/api/users/route.ts` — created_by in POST
- `src/app/api/users/[id]/route.ts` — updated_by in PUT
- `src/app/api/functional-groups/route.ts` — created_by in POST
- `src/app/api/functional-groups/[id]/route.ts` — updated_by in PUT
- `src/app/api/projects/route.ts` — created_by in POST
- `src/app/api/projects/[id]/route.ts` — updated_by in PUT
- `src/app/api/manufacturers/route.ts` — created_by in POST
- `src/app/api/manufacturers/[id]/route.ts` — updated_by in PUT
- `src/app/api/storage-locations/route.ts` — created_by in POST
- `src/app/api/storage-locations/[id]/route.ts` — updated_by in PUT
- `src/components/inventory-page.tsx` — x-user-id in all mutation headers
- `src/app/products/new/page.tsx` — x-user-id header
- `src/app/products/[id]/edit/page.tsx` — x-user-id header
- `src/app/requests/new/page.tsx` — x-user-id header

4. **Phase 5 — Dashboard** — Enhanced the dashboard as the default landing page for all roles:
   - Dashboard now visible to all roles (removed Admin-only restriction from sidebar)
   - Default landing page set to 'dashboard' for all roles on login
   - 5 summary cards: Total Products (with stock count), Added This Week, Transactions Today, Pending Items (role-aware), Low Stock Alert
   - Pending Items card: Directors see pending approvals count, Admins see unfulfilled requests, Staff sees own pending requests
   - Low Stock card: products at or below reorder threshold, highlighted in red
   - All clickable cards navigate to the relevant view
   - Low stock detail table below cards when products are below threshold
   - All cards update in real time from React state (no separate API needed)

### TypeScript status
Clean — only pre-existing test file redeclaration errors.

---

## Session 10 — 2026-03-11

### What was accomplished

Fixed the app's CSS color scheme — replaced outdated `:root` CSS variables in `globals.css` with the correct teal design system, removed unused `.dark` theme block, and audited all form pages for consistency.

1. **CSS Variables Overhaul** — Replaced the entire `:root` block in `src/app/globals.css` with the canonical teal color scheme:
   - `--background: 174 25% 95%` (#f0f4f4 teal-tinted page bg)
   - `--foreground: 174 71% 10%` (#0f2a2a near-black teal text)
   - `--primary: 174 62% 27%` (#1a7070 teal)
   - `--secondary: 174 25% 91%` (#e6f7f7 teal light)
   - `--border/--input: 214 32% 89%` (#e2e8f0)
   - `--destructive: 0 72% 51%`
   - Chart colors updated to teal-based palette
   - Sidebar variables updated: `--sidebar-background: 174 75% 15%` (#0d3d3d)
   - Removed `.dark` theme block (app is light-only)

2. **Audit Results** — All pages confirmed consistent:
   - `layout.tsx`: body uses `bg-background` class (correctly maps to teal page bg)
   - `sidebar.tsx`: hardcoded `#0d3d3d` background (intentional dark sidebar, not a CSS variable)
   - Form section cards: `#f1f5f9` headers, `#f8fafc` bodies, white inputs with `#cbd5e1` border
   - Primary buttons: either `style={{ backgroundColor: '#1a7070' }}` or default variant (`bg-primary` now maps to #1a7070)
   - Semantic buttons (Approve=#16a34a green, Reject=#dc2626 red) left intentionally different

### Files modified
- `src/app/globals.css` — replaced `:root` variables with teal scheme, removed `.dark` block

### TypeScript status
Clean — only pre-existing test file redeclaration errors.

---

## Session 9 — 2026-03-11

### What was accomplished

Vendor→Manufacturer rename, new product fields (VWR Part #, SOM Approval, Cost Per Unit), SOM two-stage approval workflow, form contrast redesign, inline errors, request display improvements.

1. **Vendor → Manufacturer Rename** — Migration 009 renames `vendors` table → `manufacturers`, adds `alternate_names TEXT` column, renames all product columns (`vendor_id`→`manufacturer_id`, `vendor`→`manufacturer`, `vendor_part_number`→`manufacturer_part_number`). All API routes, types, UI components, and sidebar nav updated. Old `/api/vendors` routes replaced by `/api/manufacturers`.

2. **New Product Fields** — Migration 010 adds `vwr_part_number TEXT`, `som_approval_required BOOLEAN DEFAULT false`, `cost_per_unit NUMERIC(10,2)` to products. Also adds `som_approval_status TEXT`, `sciops_director_approved_at TIMESTAMPTZ`, `sciops_director_approved_by UUID` to product_requests. Extended `request_status` enum with `Pending SciOps Approval`. All fields wired through types, product-queries, API POST/PUT, and ProductForm.

3. **SOM Two-Stage Approval Workflow** — Products with `som_approval_required=true` follow: Staff → Director (Pending Approval → Pending SciOps Approval) → Sci-Ops Director (Pending SciOps Approval → Approved) → Admin fulfills. Director approve checks product's SOM flag and routes accordingly. New API endpoints: `PUT /api/requests/[id]/sciops-approve` and `PUT /api/requests/[id]/sciops-reject` — both validate the approving Director belongs to "Scientific Operations" functional group. Rejection route records `rejection_stage='sciops'`. Backward compatible: non-SOM products follow existing Director → Admin flow unchanged.

4. **Inline Validation Errors** — Replaced toast-based validation on `/requests/new` with inline field errors using `formErrors` state. Project select, justification textarea, and SOP checkbox all show red error text below the field. Errors clear on interaction. Line item date and quantity errors also display inline.

5. **Date Validation Fix** — Changed `todayStr` from `new Date().toISOString().split('T')[0]` (UTC) to `new Date().toLocaleDateString('en-CA')` (local timezone YYYY-MM-DD) on request form.

6. **Request Display Improvements** — All request list tables (Product Requests, Approvals, Fulfillments) now show manufacturer part # instead of internal product ID below product name. Request detail page shows: HULLC Request ID as title, product name, manufacturer part #, UoM, requestor, department, project, justification. SOM badge shown when applicable. Rejection note shows rejection stage (Director/Sci-Ops/Admin).

7. **Approvals Tab Enhanced** — Director Approvals tab now shows both "Pending Approval" and "Pending SciOps Approval" requests (for Sci-Ops Directors). Added Status column to distinguish between the two. Approve/Reject handlers route to correct endpoint based on request status.

8. **Form Contrast Styling** — Applied across: `/requests/new` (all 4 cards), `/requests/[id]` (details card, line items card, action card), `/products/new`, `/products/[id]/edit`. Design tokens: `#f8fafc` card background, `#f1f5f9` card headers with bottom border, white inputs with `#cbd5e1` border, `#475569` uppercase 11px labels with `0.05em` letter-spacing.

10. **Unified Form Visual Overhaul** — Applied consistent visual design system across all forms:
    - **Section cards**: White outer bg, `#f1f5f9` header band (16px h-padding, 14px v-padding), 15px/700 header text `#0f2a2a`, `#f8fafc` card body with 20px padding, 12px border-radius
    - **Required field asterisks**: Red `*` added to all mandatory fields — Product Name, Manufacturer, SOM Approval Required on product form; Project, Requested Date, Justification, SOP, line item quantities on request form; Name fields on all 5 config dialogs (Users, Groups, Projects, Manufacturers, Storage Locations)
    - **Field contrast**: Input bg white, border `1px solid #cbd5e1`, border-radius 8px, labels `#475569` 11px uppercase 600 weight
    - **Focus ring**: Global CSS `box-shadow: 0 0 0 2px #1a7070` on input/select/textarea focus
    - **Top banner**: `#fefce8` bg with `#fde68a` border, red asterisk, `#92400e` text on product new/edit and request new pages
    - **Config dialogs**: All 5 entity dialogs updated with label styling, input borders, and required-field asterisks

9. **ProductForm Updated** — Added `isAdmin` prop for cost-per-unit visibility. Manufacturer dropdown with alternate names. VWR Part #, SOM Approval (Yes/No Select), Cost Per Unit fields. Lots section redesigned as 2-column card grid with teal "Lot N" pill badges and dashed "+ Add Lot" card.

### Files created
- `src/lib/db/migrations/009_rename_vendor_to_manufacturer.sql`
- `src/lib/db/migrations/010_add_product_fields_and_som.sql`
- `src/app/api/manufacturers/route.ts`
- `src/app/api/manufacturers/[id]/route.ts`
- `src/app/api/requests/[id]/sciops-approve/route.ts`
- `src/app/api/requests/[id]/sciops-reject/route.ts`

### Files modified
- `src/lib/types.ts` — vendor→manufacturer fields, SOM fields, Pending SciOps Approval status
- `src/lib/db/product-queries.ts` — vendor→manufacturer column names, new fields in SQL/mapper
- `src/app/api/products/route.ts` — manufacturer fields in POST
- `src/app/api/products/[id]/route.ts` — manufacturer fields in PUT
- `src/app/api/requests/route.ts` — joins products for manufacturer_part_number/uom/som, SciOps Director visibility
- `src/app/api/requests/[id]/route.ts` — joins products for new fields, SOM transitions
- `src/app/api/requests/[id]/approve/route.ts` — SOM-aware: routes to Pending SciOps Approval when needed
- `src/app/api/requests/[id]/reject/route.ts` — detects sciops rejection stage
- `src/components/sidebar.tsx` — config-vendors → config-manufacturers
- `src/components/inventory-page.tsx` — vendor→manufacturer throughout, SOM badge, SciOps approval routing, request display
- `src/components/product-form.tsx` — complete redesign with manufacturer, VWR, SOM, cost, lot grid
- `src/components/departmental-page.tsx` — vendorPartNumber → manufacturerPartNumber
- `src/components/request-form.tsx` — vendor → manufacturer
- `src/app/requests/new/page.tsx` — form contrast, inline errors, date fix, SOM badge
- `src/app/requests/[id]/page.tsx` — form contrast, SOM workflow UI, manufacturer part #, UoM, rejection stage
- `src/app/products/new/page.tsx` — form contrast styling, isAdmin prop
- `src/app/products/[id]/edit/page.tsx` — form contrast styling, isAdmin prop
- `src/app/globals.css` — focus ring CSS for form inputs (2px solid #1a7070)

### TypeScript status
Clean — only pre-existing test file redeclaration errors.

---

## Session 8 — 2026-03-11

### What was accomplished

Role-aware navigation, configuration sub-menus, vendor/location management, UoM field, fulfillment inline form, and multiple bug fixes.

1. **Dashboard Visibility** — Dashboard sidebar item now restricted to Admin role. Default landing pages set per role: Admin→Dashboard, Director→Approvals, Staff/ProjectManager/Chief→HULLC Inventory.

2. **Request ID Format** — Verified HULLC-YYYY-XXXX generation is correct (atomic sequence via `request_id_sequences` table). Existing pre-migration requests display UUID fallback — this is expected.

3. **Fulfill Bug Fix** — Request detail page (`/requests/[id]`) no longer redirects to dashboard when clicking Fulfill. An inline fulfillment form now opens below the line items table, showing available lots with quantity inputs. After fulfilling, the page refreshes data in place. Director approve/reject also stays on page.

4. **Add/Edit Product Page Bug** — Fixed `ProductForm` missing `id="product-form"` on its `<form>` element, which prevented the top-bar Save button (`form="product-form"`) from triggering submission.

5. **Vendor Management** — Migration 006 creates `vendors` table (UUID PK, unique name, is_active, created_at). Seeds existing vendor names from products. API: `GET/POST /api/vendors`, `PUT /api/vendors/[id]`. Product form vendor field now uses dropdown (falls back to text input if no vendors exist).

6. **UoM Field** — Migration 007 adds `uom TEXT` column to products. Updated: ProductFormSchema (types.ts), ProductRow and PRODUCT_SELECT_SQL (product-queries.ts), Products API POST/PUT, ProductForm component, inventory table (new UoM column).

7. **Configuration Sub-Menu** — Sidebar Configuration item now expandable with chevron, containing sub-items: Users, Functional Groups, Projects, Vendors, Storage Locations. Each renders its own management table. Old monolithic `configuration` view split into `config-users`, `config-groups`, `config-projects`, `config-vendors`, `config-locations`.

8. **Storage Locations** — Migration 008 creates `storage_locations` table (UUID PK, unique name, is_active). Seeds from existing lot locations. API: `GET/POST /api/storage-locations`, `PUT /api/storage-locations/[id]`. Deactivation returns 409 if referenced by active lots (quantity > 0). Product form lot rows now use dropdown for storage location.

### Files created
- `src/lib/db/migrations/006_add_vendors.sql`
- `src/lib/db/migrations/007_add_uom.sql`
- `src/lib/db/migrations/008_add_storage_locations.sql`
- `src/app/api/vendors/route.ts`
- `src/app/api/vendors/[id]/route.ts`
- `src/app/api/storage-locations/route.ts`
- `src/app/api/storage-locations/[id]/route.ts`

### Files modified
- `src/components/sidebar.tsx` — expandable config sub-menu, Dashboard Admin-only
- `src/components/inventory-page.tsx` — role-aware default view, vendor/location state+handlers, split config views
- `src/components/product-form.tsx` — vendor dropdown, location dropdown, UoM field, form id fix
- `src/app/requests/[id]/page.tsx` — inline fulfillment form, stay on page after actions
- `src/app/api/products/route.ts` — UoM in POST
- `src/app/api/products/[id]/route.ts` — UoM in PUT
- `src/lib/db/product-queries.ts` — UoM in ProductRow, SQL, mapper
- `src/lib/types.ts` — UoM in ProductFormSchema

### TypeScript status
Clean — only pre-existing test file redeclaration errors.

---

## Session 7 — 2026-03-10

### What was accomplished

Major UI overhaul — complete visual redesign of the application with sidebar navigation, new design system, and multiple feature additions.

1. **Complete Visual Redesign** — Applied across the entire application:
   - Dark teal sidebar (#0d3d3d) replaces tab navigation; nav items: Dashboard, HULLC Inventory, Product Requests, Approvals, Transactions, Fulfillments, Configuration
   - Light content area (#f0f4f4 background, white cards with 1px solid #e2e8f0 borders, 12px border radius)
   - Top bar per page (white, 60px tall, page title + subtitle)
   - Consistent table styles: #f8fafc header background, uppercase 11.5px column headers, #64748b secondary text
   - Status badges: colored pill badges throughout
   - HULLC logo icon removed from header — text only
   - "Core Inventory" renamed to "HULLC Inventory" with subtext "High Use Long Lead Consumables"
   - Login screen redesigned with teal accent
   - User name and role shown at bottom of sidebar

2. **Request ID Auto-generation** — Migration 005 (already applied):
   - `request_id_sequences` table tracks per-year counters
   - `product_requests` gains `request_number` (integer) and `request_id` (text, e.g. HULLC-2026-0042)
   - POST /api/requests atomically generates next HULLC-YYYY-XXXX using FOR UPDATE on sequence row
   - request_id displayed as primary identifier in all request tables
   - request_id is a clickable link navigating to the full request detail page

3. **Request Detail Page** — Created `src/app/requests/[id]/page.tsx`:
   - Breadcrumb navigation at top
   - Request details card with 2-column grid (product, requestor, department, project, justification, status)
   - Line items table with status badges and fulfilled quantities
   - Director action card: comments textarea + Approve/Reject buttons (inline error if reject without comment)
   - Admin view: fulfillment action per line item
   - Staff view: read-only status display
   - All roles can access — content adapts based on role

4. **Date Validation** on `/requests/new/page.tsx`:
   - `min={today}` attribute on all requested_date inputs blocks past dates at browser level
   - Server-side validation in POST /api/requests rejects past dates with 422
   - Inline error message below any date field that has a past date
   - Today's date is selectable

5. **Fulfillment View** — Dedicated fulfillments sidebar view:
   - Shows Approved and In Progress requests with expandable line items
   - Each pending line item has a Fulfill button
   - Legacy fulfillments section preserved below

6. **Add/Edit Product Pages** — Redesigned with sidebar-offset layout:
   - Top bar with breadcrumb navigation and Save/Cancel buttons
   - Product information card with consistent styling
   - Content area matches overall design system

7. **Request Form Page** — Redesigned `/requests/new`:
   - Sidebar-offset layout with breadcrumb top bar
   - All cards use new design tokens (white cards, teal accent, consistent borders)

### Files created
- `src/app/requests/[id]/page.tsx` — Request detail page

### Files modified
- `src/app/globals.css` — Updated CSS custom properties for new design tokens
- `src/components/sidebar.tsx` — Updated sidebar colors (#80d4d4 text, #155e5e active state)
- `src/components/inventory-page.tsx` — Major rewrite: sidebar layout, removed tabs, applied new visual styles
- `src/lib/types.ts` — Added `requestId` and `requestNumber` to `ProductRequestSchema`
- `src/app/api/requests/route.ts` — Added server-side date validation in POST
- `src/app/requests/new/page.tsx` — New design, min date validation, inline errors
- `src/app/products/new/page.tsx` — Redesigned with sidebar-offset layout
- `src/app/products/[id]/edit/page.tsx` — Redesigned with sidebar-offset layout
- `docs/SESSION_LOG.md` — This entry

### Design reference values used
- Sidebar background: #0d3d3d
- Sidebar active item: #155e5e
- Sidebar text: #80d4d4
- Accent/button: #1a7070
- Accent hover: #155e5e
- Page background: #f0f4f4
- Card background: white
- Border: #e2e8f0
- Primary text: #0f2a2a
- Secondary text: #64748b
- Table header background: #f8fafc

---

## Session 6 — 2026-03-10

### What was accomplished

Fixes and improvements across the request workflow, UI, and project management.

1. **DB migration 004_add_projects.sql** — Applied to `hullc_dev`:
   - Created `projects` table (id UUID PK, name TEXT UNIQUE NOT NULL, is_active BOOLEAN, created_at, updated_at)
   - Indexes on `name` and `is_active`; `set_updated_at()` trigger attached
   - Added `director_comments TEXT` column to `product_requests`

2. **Updated `src/lib/db/seed.ts`** — Added idempotent seeding of 4 default projects: Project Alpha, Project Beta, Clinical Trial Gamma, Pre-clinical Study Delta

3. **New API: `GET /api/projects`** — Returns all projects ordered by name; no auth required (used by request form)

4. **New API: `POST /api/projects`** — Admin only; creates a project; returns 409 on duplicate name

5. **New API: `PUT /api/projects/[id]`** — Admin only; renames project or toggles `is_active`; returns 409 on duplicate name, 404 if not found

6. **Updated `src/app/requests/new/page.tsx`**:
   - Added `AppProject` interface and `projects` state
   - Fetches `/api/projects` in `useEffect`, filters to active projects only
   - Replaced free-text Project input with a required `<Select>` dropdown from DB
   - Added project presence validation before submit (toast on empty)
   - Added future-date validation: all line item dates must be today or later

7. **Updated `src/app/api/requests/[id]/approve/route.ts`**:
   - Now parses optional JSON body `{ comments?: string }`
   - UPDATE query sets `director_comments = $2` alongside existing approve fields
   - `director_comments` added to `RequestRow` interface and `rowToRequest` mapper

8. **Updated `src/components/inventory-page.tsx`**:
   - Added `requestToApprove` and `approveComments` state
   - `handleApproveRequest` now opens an AlertDialog instead of directly calling the API
   - Added `handleConfirmApproveRequest` which sends comments in the request body
   - Both `handleConfirmApproveRequest` and `handleConfirmRejectRequest` re-fetch requests after state update to ensure Admin's tab reflects latest data
   - Renamed "User Management" tab trigger and content to `value="configuration"`, label "Configuration"
   - Added `appProjects`, `isProjectFormOpen`, `projectToEdit`, `projectFormName` state
   - Projects are loaded in `loadData` for Admin alongside users/groups
   - `setAppProjects([])` added to `handleLogout`
   - Added `handleOpenProjectForm`, `handleSaveProject`, `handleToggleProjectStatus` handlers
   - Added Projects Card inside Configuration tab (table with rename/toggle buttons)
   - Added Project Form Dialog (same pattern as Functional Group dialog)
   - Added Approve AlertDialog with optional comments textarea
   - `handleAddNew` now calls `router.push('/products/new')` instead of opening popup
   - `handleEdit` now calls `router.push('/products/${product.id}/edit')` instead of opening popup
   - Removed the Product Form `<Dialog>` block from the JSX

9. **New page: `src/app/products/new/page.tsx`** — Standalone Add Product page:
   - Admin-only guard (reads localStorage, redirects to `/` if not Admin)
   - Renders `<ProductForm>` with POST to `/api/products`
   - On success, redirects to `/`

10. **New page: `src/app/products/[id]/edit/page.tsx`** — Standalone Edit Product page:
    - Admin-only guard; reads `id` from `useParams()`
    - Fetches product from `GET /api/products/:id`, coerces dates
    - Cleans up lot files (calls `deleteFile`) for any lots removed during edit
    - On success, redirects to `/`

### Files created
- `src/lib/db/migrations/004_add_projects.sql`
- `src/app/api/projects/route.ts`
- `src/app/api/projects/[id]/route.ts`
- `src/app/products/new/page.tsx`
- `src/app/products/[id]/edit/page.tsx`

### Files modified
- `src/lib/db/seed.ts`
- `src/app/requests/new/page.tsx`
- `src/app/api/requests/[id]/approve/route.ts`
- `src/components/inventory-page.tsx`
- `docs/TASKS.md`
- `docs/SESSION_LOG.md`

---

## Session 5 — 2026-03-10

### What was accomplished

Phase 2 — Product Request Redesign — implemented end to end.

1. **DB migration 003_redesign_requests.sql** — Applied to `hullc_dev`:
   - Added `Pending Approval` and `Approved` to `request_status` enum
   - Migrated existing `Pending` rows to `Pending Approval`
   - Changed `department` and `project` columns in `product_requests`, `fulfillments`, and `transactions` from enums to `TEXT` (removes hard-coded enum constraint, allows any functional group name)
   - Dropped `quantity` from `product_requests`; added `director_id`, `director_approved_at`, `director_rejection_note`, `rejected_by`, `rejection_stage`
   - Created `request_line_items` table: `(id, request_id, requested_date, quantity, status, fulfilled_quantity, fulfillment_id, created_at)`
   - Updated `fulfillments`: dropped unique constraint on `request_id`, made `request_id` nullable, added `request_line_item_id` FK
   - Cross-FK between `request_line_items.fulfillment_id` and `fulfillments.request_line_item_id`

2. **Updated src/lib/types.ts**:
   - Added `LineItemFormSchema`, `RequestLineItemSchema`, `ProductRequestSchema` (rebuilt as standalone, not extended from form schema)
   - `ProductRequestStatusSchema` now includes `Pending Approval` and `Approved`
   - `ProductRequestFormSchema` now has `lineItems: [{requestedDate, quantity}]` instead of `quantity`
   - `FulfillmentSchema`: `requestId` is now nullable; added optional `requestLineItemId`
   - Added `LineItemFormData` and `RequestLineItem` type exports

3. **Rewrote src/app/api/requests/route.ts**:
   - GET is now role-aware (Admin: Approved/In Progress/Completed/Rejected; Director: Pending Approval for their group; Staff: own requests by email)
   - POST creates request + line items in a single transaction (status = `Pending Approval`)
   - Both responses include `lineItems` via `json_agg` subquery

4. **Rewrote src/app/api/requests/[id]/route.ts**:
   - GET now includes lineItems join
   - PUT: updated transition table (Pending Approval → Approved/Rejected; Approved → In Progress/Rejected; etc.)
   - DELETE: only allows Pending Approval or Rejected (not Approved/In Progress/Completed)

5. **New API: PUT /api/requests/[id]/approve** — Director only; validates functional group match; sets `status = Approved`, `director_id`, `director_approved_at`

6. **New API: PUT /api/requests/[id]/reject** — Director or Admin; sets rejection fields including `rejection_stage` (director vs admin)

7. **New API: PUT /api/requests/[id]/line-items/[lineItemId]** — Admin only; atomically fulfills a single line item: creates fulfillment + transaction + transaction_items, decrements lot quantities, marks line item Fulfilled, sets request to In Progress or Completed depending on whether all line items are done

8. **Updated src/app/api/fulfillments/route.ts and [id]/route.ts** — Handle nullable `request_id` throughout; POST legacy flow updated to work without `quantity` column

9. **New page: src/app/requests/new/page.tsx** — Full-page request form replacing the popup dialog:
   - Reads `productId` from URL search params
   - Auto-populates requestor name, email, functional group from localStorage session
   - Dynamic line items table (date + quantity per row), minimum 1 row
   - Justification + SOP checkbox
   - Redirects to `/` on success or cancel

10. **Updated src/components/inventory-page.tsx**:
    - Added `useRouter` import; `router.push()` replaces the old request popup
    - `handleRequestProduct` now navigates to `/requests/new?productId=`
    - `productDemand` useMemo updated to sum `lineItems` quantities for `Pending Approval`, `Approved`, `In Progress` statuses
    - Requests fetch includes `x-user-id`, `x-user-email`, `x-user-functional-group` headers
    - Tab bar: requests tab now shows for Admin and Director; Director also gets separate Approvals tab
    - `getStatusBadge` extended with `Pending Approval` (orange) and `Approved` (purple) colors
    - Admin Product Requests tab: replaced old fulfill/reject buttons with expandable line items table; each line item has its own Fulfill button (calls line-items endpoint)
    - New Director Approvals tab: shows Pending Approval requests with Approve/Reject buttons
    - Added `handleApproveRequest`, `handleFulfillLineItem` handlers
    - Updated `handleConfirmRejectRequest` to call new `/reject` endpoint
    - Updated `handleSaveTransaction` to support line-item fulfillment mode (`fulfillmentToUpdate.id` starts with `line:`)

11. **Updated src/components/request-form.tsx** — Updated to compile with new schema (legacy form, now replaced by the full-page route)

### Files created
- `src/lib/db/migrations/003_redesign_requests.sql`
- `src/app/api/requests/[id]/approve/route.ts`
- `src/app/api/requests/[id]/reject/route.ts`
- `src/app/api/requests/[id]/line-items/[lineItemId]/route.ts`
- `src/app/requests/new/page.tsx`

### Files modified
- `src/lib/types.ts`
- `src/app/api/requests/route.ts` (rewritten)
- `src/app/api/requests/[id]/route.ts` (rewritten)
- `src/app/api/fulfillments/route.ts`
- `src/app/api/fulfillments/[id]/route.ts`
- `src/components/inventory-page.tsx`
- `src/components/request-form.tsx`
- `docs/TASKS.md`

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
