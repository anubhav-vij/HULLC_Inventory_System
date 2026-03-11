# HULLC Inventory Management System — Task History & Roadmap

A complete record of every feature built, every phase completed, and every task remaining.
Built for NIH/NIAID laboratory inventory management at HULLC.
This file serves as the single source of truth for project progress and is used by Claude Code
to resume work automatically across sessions — start from the first `[ ]` task and work through
each phase sequentially, marking `[~]` while in progress and `[x]` when complete.

---

## Status Key

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete

---

## Completed Work

### Session 1 — Local Infrastructure & Products API
- [x] Audit entire codebase — catalogued all localStorage keys, data models, hooks, components
- [x] Renamed application from StockPilot to HULLC Inventory Management System throughout codebase
- [x] Created `production` branch — master branch left untouched as original demo
- [x] Installed PostgreSQL 18 locally and created `hullc_dev` database
- [x] Designed and applied full 8-table PostgreSQL schema: users, products, lots, lot_files, product_requests, fulfillments, transactions, transaction_items
- [x] Built database connection layer at `src/lib/db/index.ts` with `query`, `getClient`, `withTransaction` helpers
- [x] Built health check API at `GET /api/health`
- [x] Built Products API: `GET/POST /api/products`, `GET/PUT/DELETE /api/products/[id]`
- [x] Verified Products API with 10/10 integration tests passing

### Session 2 — Transactions, Requests & Fulfillments APIs
- [x] Built Transactions API: `GET/POST /api/transactions`, `DELETE /api/transactions/[id]`
- [x] Atomic lot quantity decrement on dispense; full reversal on delete
- [x] Verified Transactions API with 11/11 integration tests passing
- [x] Built Requests API: `GET/POST /api/requests`, `GET/PUT/DELETE /api/requests/[id]`
- [x] Enforced status transition table: Pending → In Progress → Completed, Pending → Rejected
- [x] Built Fulfillments API: `GET/POST /api/fulfillments`, `PUT/DELETE /api/fulfillments/[id]`
- [x] Verified Requests + Fulfillments API with 15/15 integration tests passing

### Session 3 — Frontend Migration
- [x] Migrated all localStorage reads/writes in `inventory-page.tsx` to real API calls
- [x] Replaced auto-save useEffect with API mutations as source of truth
- [x] CSV import upgraded to Option C: PUT for existing IDs, POST for new ones
- [x] Full smoke test passed: login → add product → request → fulfill → transaction → delete
- [x] Rewrote `README.md` with full setup guide, API reference, session log, and deployment notes

### Session 6 — Fixes & Improvements (2026-03-10)
- [x] Created `projects` table with migration 004; seeded 4 default projects (Project Alpha, Project Beta, Clinical Trial Gamma, Pre-clinical Study Delta)
- [x] Added API: `GET /api/projects`, `POST /api/projects` (Admin only), `PUT /api/projects/[id]` (Admin only)
- [x] Request form: project field is now a required Select dropdown populated from active projects in DB
- [x] Request form: added future-date validation — past dates blocked with error toast
- [x] Director approve dialog: now opens an AlertDialog with optional comments textarea; stored as `director_comments` in DB
- [x] Director reject API: validated — returns 422 with Zod error when rejectionNote is missing or empty
- [x] Fixed fulfillment refresh: after approve/reject, requests are re-fetched with full role headers so Admin's tab updates immediately
- [x] Renamed "User Management" tab to "Configuration" (tab value `user-management` → `configuration`)
- [x] Added Projects management section inside Configuration tab (same UI pattern as Functional Groups)
- [x] Add Product navigates to `/products/new` full page (popup dialog removed)
- [x] Edit Product navigates to `/products/[id]/edit` full page (popup dialog removed)
- [x] Created `src/app/products/new/page.tsx` — standalone Add Product page, Admin-only guard
- [x] Created `src/app/products/[id]/edit/page.tsx` — standalone Edit Product page with lot file cleanup

### Session 8 — Role-Aware Nav, Vendor/Location Management, UoM, Fulfill Fix (2026-03-11)
- [x] Dashboard sidebar item restricted to Admin role; default landing pages set per role on login/restore
- [x] Request ID HULLC-YYYY-XXXX generation verified correct; pre-migration requests show UUID fallback
- [x] Fulfill bug fixed: inline fulfillment form on `/requests/[id]` — stays on page after fulfillment
- [x] Product form `id="product-form"` fix — top-bar Save button now triggers form submission
- [x] Migration 006: `vendors` table (UUID PK, unique name, is_active); seeds from existing product vendors
- [x] Vendors API: `GET/POST /api/vendors`, `PUT /api/vendors/[id]`; product form uses vendor dropdown
- [x] Migration 007: `uom TEXT` column on products
- [x] UoM field added to product form, product API POST/PUT, inventory table, types/queries
- [x] Sidebar Configuration now expandable sub-menu: Users, Functional Groups, Projects, Vendors, Storage Locations
- [x] Each config sub-item renders its own management table (split from monolithic configuration view)
- [x] Migration 008: `storage_locations` table (UUID PK, unique name, is_active); seeds from existing lot locations
- [x] Storage Locations API: `GET/POST /api/storage-locations`, `PUT /api/storage-locations/[id]`
- [x] Deactivation returns 409 if referenced by active lots (quantity > 0)
- [x] Product form lot rows use storage location dropdown (falls back to text input if none exist)

### Session 9 — Manufacturer Rename, SOM Workflow, Form Contrast (2026-03-11)
- [x] Migration 009: renamed `vendors` → `manufacturers` (table + all product columns), added `alternate_names`
- [x] Manufacturers API: `GET/POST /api/manufacturers`, `PUT /api/manufacturers/[id]` with alternate names
- [x] All vendor references renamed to manufacturer throughout codebase (types, queries, API, UI, sidebar)
- [x] Migration 010: added `vwr_part_number`, `som_approval_required`, `cost_per_unit` to products; SOM columns to requests; extended request_status enum
- [x] ProductForm redesigned: manufacturer dropdown, VWR Part #, SOM approval toggle, cost per unit (Admin only), lots as 2-column card grid
- [x] SOM two-stage approval: Director approve → Pending SciOps Approval (if SOM product) → Sci-Ops Director approve → Approved
- [x] API: `PUT /api/requests/[id]/sciops-approve` and `sciops-reject` — validates Scientific Operations group membership
- [x] Director Approvals tab shows both Pending Approval and Pending SciOps Approval with status column
- [x] Approve/Reject handlers route to correct endpoint (regular or sciops) based on request status
- [x] Inline validation errors on `/requests/new` replace toast-based validation (project, justification, SOP, dates, quantities)
- [x] Date validation fix: `toLocaleDateString('en-CA')` for local timezone instead of UTC
- [x] Request display: manufacturer part # replaces internal product ID in all request tables
- [x] Request detail page: shows UoM, manufacturer part #, SOM badge, rejection stage in rejection note
- [x] Form contrast applied: `/requests/new`, `/requests/[id]`, `/products/new`, `/products/[id]/edit` — #f8fafc cards, #f1f5f9 headers, white inputs, #475569 labels

### Sessions 10-12 — Audit Fields, Roles UI, Metrics, Excel Import (2026-03-11)
- [x] Migration 011: added `created_by`/`updated_by` audit fields to all 13 tables
- [x] All 19 mutation API endpoints populate audit fields from `x-user-id` header
- [x] Phase 8: PM/Chief see full Admin view with mutations hidden (`canEdit` vs `hasFullView` pattern)
- [x] Phase 5b: Metrics pages — `/metrics/received` and `/metrics/disbursed` (Admin only, standalone pages)
- [x] Metrics API routes: `GET /api/metrics/received`, `GET /api/metrics/disbursed` with date range filtering
- [x] Sidebar: Metrics expandable group added; generalized expandable menu state (`openMenus` Set)
- [x] Phase 11: Excel sheet selector dialog for multi-sheet .xlsx files; single-sheet files import directly
- [x] Excel import/export fully replaces CSV (SheetJS `xlsx` library)

### Session 13 — CSS Overhaul, Dark Mode, Request ID Backfill (2026-03-11)
- [x] CSS palette switch: main content area from teal to navy/indigo (Lab Inventory Tracker style)
- [x] Sidebar retains dark teal identity (#0d3d3d, #80d4d4, #155e5e)
- [x] Updated hardcoded colors across 8 component files (#1a7070→#1e40af, #0f2a2a→#0f172a, #f0f4f4→#eef2f7)
- [x] Added dark mode CSS variables (.dark class in globals.css)
- [x] Added print styles for future audit reports (Phase 12 ready)
- [x] Focus ring updated to navy (#1e40af)
- [x] Migration 012: backfilled all existing requests with HULLC-YYYY-XXXX IDs
- [x] Request ID sequence table populated (year 2026, last_number 10)

### Session 14 — Phases 12, 13, 14 (2026-03-11)
- [x] Fixed form page styling: yellow required-field banners → blue/indigo, low-contrast card headers → dark navy with white text (6 files)
- [x] Phase 12: Printable Audit Reports — `MaterialAuditReport` component using `createPortal` into `#material-audit-print-root`
- [x] Print button in Admin dropdown menu and as standalone button for ProjectManager/Chief
- [x] Report: HULLC header, product details table, lots table, transaction history, confidential footer
- [x] Phase 13: Metrics Charts Dashboard at `/metrics/dashboard` (Admin & Chief only)
- [x] API: `GET /api/metrics/dashboard` with optional date range filtering (5 queries in parallel)
- [x] 5 recharts: transactions/day (line), transactions/week (bar), requests by group (horizontal bar), requests by status (donut), products cumulative (line)
- [x] Global date range picker, Excel export of all chart data
- [x] Added "Charts Dashboard" to Metrics sidebar group
- [x] Phase 14: Mobile responsiveness — sidebar slides in/out with hamburger toggle + overlay
- [x] Mobile card view for inventory (below md breakpoint), desktop table preserved
- [x] Responsive padding (p-4 md:p-8), responsive text sizes, collapsible labels on buttons
- [x] CSS: sidebar-open class, sidebar-overlay, tablet sidebar width adjustment

---

## Phase 1 — User Management

> First priority. Establishes real user accounts, roles, and functional groups that all later phases depend on. Replaces the current role-select dropdown with proper email + password login.

- [x] Create DB migration: add `functional_groups` table (id, name, is_active, created_at, updated_at)
- [x] Create DB migration: update `users` table with full_name, email, password_hash, functional_group_id, is_active, created_at, updated_at
- [x] Seed `functional_groups`: Cell Line Development, Cell Culture Development, Scientific Operations, Downstream Process Development, Formulation Development, Analytical Development, Program Management
- [x] Add API: `GET /api/functional-groups` — list all active groups
- [x] Add API: `POST /api/functional-groups` — create group (Admin only)
- [x] Add API: `PUT /api/functional-groups/[id]` — rename or deactivate group (Admin only)
- [x] Add API: `GET /api/users` — list all users (Admin only)
- [x] Add API: `POST /api/users` — create user with hashed password (Admin only)
- [x] Add API: `PUT /api/users/[id]` — edit user details, role, functional group (Admin only)
- [x] Add API: `PUT /api/users/[id]/status` — activate or deactivate user (Admin only)
- [x] Add User Management tab to UI (Admin only)
- [x] User table: shows name, email, role, functional group, active status
- [x] Add user form: full name, email, temporary password, role (Staff / Director / ProjectManager / Chief / Admin), functional group
- [x] Edit user form: same fields, all editable
- [x] Activate/deactivate toggle per user row (no hard deletes)
- [x] Functional Groups management section inside User Management tab (Admin only)
- [x] Admins can add, rename, and deactivate functional groups from the UI
- [x] Deactivating a group does not affect existing users already assigned to it
- [x] Enforce one Director per functional group — UI warning + API validation
- [x] Replace login screen role dropdown with email + password fields
- [x] On login, load full user profile (name, email, role, functional group) into session
- [x] Add audit fields to all tables: created_by, updated_by (reference users.id) where applicable

---

## Phase 2 — Product Request Redesign

> Replaces the popup request form with a full-page experience. Adds multi-date scheduling (each date/quantity line item is fulfilled independently) and auto-populates user info from session.

- [x] Create DB migration: add `request_line_items` table (id, request_id, requested_date, quantity, status, fulfilled_quantity, fulfillment_id, created_at)
- [x] Create DB migration: update `product_requests` — remove quantity, add project, director_id, director_approved_at, director_rejection_note, rejected_by, rejection_stage
- [x] Create DB migration: update `fulfillments` — link to request_line_item_id instead of request_id
- [x] Update request status enum: Pending Approval → Approved → In Progress → Completed → Rejected
- [x] Add API: `POST /api/requests` — creates request with multiple line items, status = Pending Approval
- [x] Add API: `GET /api/requests` — role-aware: Admin sees Approved/In Progress/Completed/Rejected; Director sees own group's Pending Approval requests; Staff sees own requests only
- [x] Add API: `PUT /api/requests/[id]/approve` — Director only, advances status to Approved
- [x] Add API: `PUT /api/requests/[id]/reject` — Director or Admin, sets Rejected with note and rejection_stage
- [x] Add API: `PUT /api/requests/[id]/line-items/[lineItemId]` — Admin fulfills a single line item
- [x] Replace request popup with full page at `/requests/new?productId=`
- [x] Request page: auto-populate product name and ID from URL param
- [x] Request page: auto-populate requestor name, email, functional group from session
- [x] Request page: dynamic line items table — user adds multiple (requested_date, quantity) rows
- [x] Request page: minimum 1 line item required, no maximum
- [x] Request page: justification field and SOP checkbox remain at bottom
- [x] Director view: dedicated Approvals tab showing own group's Pending Approval requests with Approve/Reject buttons
- [x] Admin fulfillment view: shows only Approved/In Progress requests; each line item has its own Fulfill button
- [x] Request overall status = In Progress when at least one line item is fulfilled
- [x] Request overall status = Completed when all line items are fulfilled

---

## Phase 3 — Email Notifications

> Depends on Phase 1 (user emails) and Phase 2 (approval workflow). Uses AWS SES — native to AWS and compatible with NIH/NIAID infrastructure.

- [ ] Set up AWS SES in personal AWS account — verify sender domain or email address
- [ ] Add SES credentials to `.env.local` and document in README
- [ ] Create email utility at `src/lib/email/index.ts` using AWS SDK v3 SES client
- [ ] Create HTML + plain text email templates for each notification type
- [ ] Trigger: Staff submits request → email to Director of that functional group
- [ ] Trigger: Director approves request → email to Admin + confirmation email to Staff
- [ ] Trigger: Director rejects request → email to Staff with rejection note
- [ ] Trigger: Admin fulfills a line item → email to Staff
- [ ] Trigger: All line items fulfilled → email to Staff confirming request completed
- [ ] All emails include: product name, request details, line item dates/quantities, link to app
- [ ] Failed emails log to console but do not block the API response (fire-and-forget)

---

## Phase 4 — AWS Deployment

> Deploy the application to personal AWS for staging and testing before NIH handoff.

- [ ] Replace IndexedDB with AWS S3 for lot file attachments
- [ ] Create S3 bucket for file storage with appropriate CORS and access policies
- [ ] Update `src/lib/file-store.ts` to use S3 presigned URLs instead of IndexedDB
- [ ] Set up AWS RDS PostgreSQL 18 instance (personal AWS account)
- [ ] Run `src/lib/db/schema.sql` against RDS instance to create all tables
- [ ] Add RDS connection string to Amplify environment variables
- [ ] Connect GitHub `production` branch to AWS Amplify hosting
- [ ] Configure Amplify build settings for Next.js 15
- [ ] Verify full application works end-to-end on Amplify URL
- [ ] Set AWS billing alert to avoid unexpected charges

---

## Phase 5 — Dashboard

> Default landing page after login. Role-aware summary cards give each user an immediate view of what needs their attention.

- [x] Add Dashboard as default tab on login (replaces Inventory as landing tab)
- [x] Summary card: total products currently in inventory
- [x] Summary card: products added in the last 7 days (clickable — filters Inventory tab)
- [x] Summary card: transactions recorded today (clickable — filters Transactions tab)
- [x] Summary card: pending items count — role-aware (Directors see pending approvals count; Admins see approved-but-unfulfilled count; Staff sees their own pending requests count)
- [x] Summary card: products at or below reorder threshold (clickable — filters Inventory tab)
- [x] All cards update in real time when data changes

---

## Phase 5b — Metrics Reports (Admin Only)

> Standalone full-page reports for Admin to view inventory received and disbursed within a date range.

- [x] Add Metrics expandable group to sidebar (Admin only) with "Inventory Received" and "Inventory Disbursed" children
- [x] Generalize sidebar expandable menu state from single `configOpen` to `openMenus` Set
- [x] API: `GET /api/metrics/received?from=&to=` — joins lots→products, filters by receipt_date range
- [x] API: `GET /api/metrics/disbursed?from=&to=` — joins transaction_items→transactions→products, filters by date range
- [x] Page: `/metrics/received` — date range filter, sortable table, summary row, Excel export
- [x] Page: `/metrics/disbursed` — date range filter, sortable table (10 columns), summary row, Excel export
- [x] Both pages: Admin-only guard, sidebar navigation, back button, role badge, consistent design tokens

---

## Phase 6 — Search & Filtering

> Makes the application usable at scale when hundreds of products and transactions exist.

- [x] Add search bar to Inventory tab — search by product name, vendor, lot number (client-side filter)
- [x] Add functional group filter dropdown to Inventory tab
- [x] Add date range filter (from/to + Clear button) to Transactions tab
- [x] Add functional group filter to Transactions tab
- [x] Add status filter to Product Requests tab
- [x] Add date range filter to Product Requests tab
- [x] Ensure all filters are additive (search + filter + date range all combine)

---

## Phase 7 — Stock Reservation

> Prevents double-allocation when multiple requests are in flight for the same product.

- [ ] Create DB migration: add `reserved_quantity` column to `products` table
- [ ] When Admin starts fulfilling a line item, reserve that quantity atomically
- [ ] Show reserved quantity as separate column in Inventory table (Admin view only)
- [ ] Prevent dispensing more than (total_quantity - reserved_quantity)
- [ ] Release reservation automatically when line item is Completed or Rejected
- [ ] Show reservation indicator on product row when reserved_quantity > 0

---

## Phase 8 — Additional Roles UI

> Project Manager and Chief get full visibility without edit access.

- [x] Project Manager and Chief see the full Admin view
- [x] All add, edit, delete, and action buttons hidden for Project Manager and Chief roles
- [x] Director sees only their own functional group's requests in the Approvals tab
- [x] Update all API routes to permit read access for ProjectManager and Chief roles
- [x] Add role label badge to page header showing current user's role

---

## Phase 9 — Storage Location Management

> Replaces free-text storage location fields with a managed, consistent list.

- [x] Create DB migration: add `storage_locations` table (id, name, room_number, temperature_conditions, is_active, created_at)
- [x] Add API: `GET/POST/PUT/DELETE /api/storage-locations`
- [x] Add Storage Locations tab (Admin only)
- [x] Admins can add, edit, and deactivate storage locations from the UI
- [x] Lot storage location field becomes a dropdown populated from `storage_locations` table
- [x] Prevent deleting a location that is referenced by active lots (return 409)

---

## Phase 10 — Document Storage

> Replaces single-file-per-lot IndexedDB attachment with multi-document S3 storage. Depends on Phase 4.

- [ ] Create DB migration: update `lot_files` to support multiple documents per lot
- [ ] Documents can be uploaded when adding or editing a product/lot
- [ ] All documents stored in AWS S3 (depends on Phase 4 S3 setup)
- [ ] Document list shown in lot detail view with filename, upload date, and download link
- [ ] Support file types: PDF, JPEG, TIFF, DOCX, XLSX
- [ ] Deleting a document removes it from both the database and S3

---

## Phase 11 — Excel Import/Export

> Upgrades the existing CSV import/export to Excel for better usability and compatibility.

- [x] Install SheetJS (`xlsx`) library
- [x] Replace CSV import with Excel (.xlsx) import
- [x] Add sheet selector when uploaded file contains multiple sheets
- [x] Map Excel columns to Product and Lot model fields
- [x] Replace CSV export with Excel export for Inventory tab
- [x] Replace CSV export with Excel export for Transactions tab
- [x] Exported files include formatted headers and auto-sized column widths

---

## Phase 12 — Printable Audit Reports

> Generates a formatted, printable audit trail per product for compliance and documentation.

- [x] Add Print Audit Report button to each product row (Admin, ProjectManager, Chief)
- [x] Report includes: product details, all lots with current quantities, full transaction history (newest first)
- [x] Render as isolated print view via React `createPortal` (same pattern as Lab Inventory Tracker)
- [x] Include HULLC header, generation date, generated-by user name, and page numbers
- [x] Print CSS: collapse app layout, show only report content
- [x] Add confidential footer on every page

---

## Phase 13 — Metrics Dashboard

> Gives Admins statistical insight into inventory activity over time.

- [x] Add Metrics tab (Admin and Chief only)
- [x] Global date range picker — all charts filter to selected range; show all-time when no range set
- [x] Chart: transactions per day for last 30 days (line chart)
- [x] Chart: transactions per week for last 12 weeks (bar chart)
- [x] Chart: requests by functional group (bar chart)
- [x] Chart: requests by status — Pending Approval / Approved / In Progress / Completed / Rejected (donut chart)
- [x] Chart: products added over time — cumulative (line chart)
- [x] Export metrics summary to Excel

---

## Phase 14 — Mobile Responsiveness

> Ensures the application is usable on tablets and mobile devices for lab staff away from their desks.

- [x] Build mobile card list view for Inventory table (shown on small screens, full table on desktop)
- [x] Make product detail/lot view responsive (stack fields vertically on mobile)
- [x] Add horizontal overflow scroll to main tab bar on small screens
- [x] Test request submission flow on mobile screen size
- [x] Verify all forms are usable on touch screens (input sizes, spacing)

---

## Phase 15 — NIH SSO Authentication

> Final phase before NIH/NIAID handoff. Replaces placeholder login with NIH SSO via AWS Cognito.
> Do not start until NIH AWS team meeting has taken place.

### Confirmed Decisions
- NIH SSO is the required authentication method (no other option)
- Roles stay in the PostgreSQL users table — Admin assigns roles through the app
- If authenticated email is not in users table: show "Access denied — contact your admin"
- Only `@nih.gov` email addresses permitted
- Sessions expire when browser is closed
- Force re-authentication after 4 hours of inactivity
- No MFA required (unless NIH IT mandates it)
- Admin creates user records manually; NIH IT manages actual NIH account creation

### Pending NIH AWS Team Answers
- [ ] NIH SSO protocol: SAML or OIDC?
- [ ] Who to contact to register the app with NIH SSO
- [ ] Which AWS account owns the Cognito User Pool (personal vs NIAID-managed)
- [ ] Does NIAID already have a Cognito User Pool connected to NIH SSO that we can reuse?
- [ ] Who sets up the Cognito-to-NIH-SSO federation — us or NIH IT?
- [ ] What attribute in the NIH SSO token contains the user's email
- [ ] DNS setup for the application URL — what do we provide to NIH IT?
- [ ] NIH/NIAID security and compliance requirements (FISMA level, session rules, audit logging)

### After NIH AWS Team Meeting
- [ ] Confirm NIH SSO protocol and document it
- [ ] Submit application registration request to NIH SSO team
- [ ] Confirm which AWS account Cognito will live in
- [ ] Confirm DNS setup process with NIH IT

### Cognito Setup
- [ ] Configure Cognito User Pool: `@nih.gov` domain restriction, session expiry on browser close, 4-hour inactivity timeout
- [ ] Configure NIH SSO as federated identity provider in Cognito (SAML or OIDC)
- [ ] Register application callback URL with NIH SSO team
- [ ] Map NIH SSO email attribute to Cognito user pool attribute

### Code Changes
- [ ] Replace placeholder login with Cognito-managed session
- [ ] Add Sign Out button — calls Cognito sign out and redirects to NIH login page
- [ ] Add unauthenticated route guard — redirect to Cognito login if no active session
- [ ] Add "Access Denied" screen for authenticated NIH users with no users table record
- [ ] Verify all audit fields (created_by, updated_by) populate correctly from Cognito user
- [ ] Remove placeholder login screen entirely

### Bootstrap & Testing
- [ ] Manually insert first Admin user record into users table
- [ ] Test full login flow: visit URL → redirect to NIH login → authenticate → land in app with correct role
- [ ] Test access denied flow: authenticated NIH user with no users record sees contact message
- [ ] Test role enforcement: Staff cannot add/edit/delete; Admin can
- [ ] Test session expiry: browser close clears session; 4-hour inactivity forces re-login

---

## Phase 16 — NIH/NIAID AWS Infrastructure Migration

> Migrate all AWS resources from personal AWS account to NIAID-managed AWS infrastructure.
> Coordinate with NIH AWS team. Execute after Phase 15 authentication is confirmed.

### Pre-Migration Planning
- [ ] Obtain NIAID AWS account ID and confirm access credentials
- [ ] Inventory all current AWS resources in personal account (RDS, S3, Amplify)
- [ ] Confirm with NIH AWS team: will Amplify be re-initialized or transferred?
- [ ] Confirm S3 bucket naming conventions required by NIAID
- [ ] Confirm RDS instance type and PostgreSQL version required by NIAID
- [ ] Confirm AWS region (currently `us-east-1` — verify this is acceptable)
- [ ] Request DNS setup from NIH IT for application URL
- [ ] Schedule maintenance window for cutover — notify all users in advance

### Resources to Migrate
- [ ] Export all data from RDS PostgreSQL (pg_dump of hullc production database)
- [ ] Re-create RDS instance in NIAID AWS account and restore from dump
- [ ] Verify record counts match between old and new database
- [ ] Copy all S3 objects to new NIAID S3 bucket (`aws s3 sync`)
- [ ] Verify all file download links work after bucket migration
- [ ] Re-initialize Amplify in NIAID AWS account and reconnect GitHub repository
- [ ] Configure custom domain in new Amplify app
- [ ] Verify SSL certificate is issued for the new domain
- [ ] Update all environment variables with new NIAID resource identifiers

### Post-Migration Verification
- [ ] Open application URL and confirm it loads
- [ ] Log in and confirm full functionality end-to-end
- [ ] Spot-check 10–20 product records to confirm data migrated correctly
- [ ] Spot-check transactions and requests to confirm history is intact
- [ ] Create a test product, transaction, and request — confirm writes work
- [ ] Verify file downloads work from new S3 bucket
- [ ] Verify Metrics tab shows correct totals matching old system

### Cutover & Decommission
- [ ] Send communication to all users with new URL before cutover
- [ ] Set old Amplify app to display "system has moved" message
- [ ] Monitor new environment for 2 weeks before decommissioning old resources
- [ ] After confirmation: delete old Amplify app, RDS instance, S3 bucket from personal account
- [ ] Set zero-spend budget alert in NIAID AWS account

---

## Backlog — Future Improvements

- [ ] Low-quantity alert threshold per product — flag when quantity falls below a user-set minimum (separate from reorder threshold)
- [ ] Bulk-edit capability for products (update vendor or storage location across multiple records at once)
- [ ] Add export button on Metrics tab (export charts summary to Excel or PDF)
- [ ] Role-based visibility for Metrics tab — confirm if ProjectManager should see metrics
- [ ] Real-time inventory updates via server-sent events if multiple users edit simultaneously
- [ ] Email notification digest — daily summary email to Admin of pending requests
- [ ] Confirm NIH Blue hex in print reports (`#002F87` vs `#003087`) — verify with NIH branding guidelines

---

*Built for laboratory inventory management at NIH/NIAID — HULLC.*
````"*
