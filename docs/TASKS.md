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

---

## Phase 1 — User Management

> First priority. Establishes real user accounts, roles, and functional groups that all later phases depend on. Replaces the current role-select dropdown with proper email + password login.

- [ ] Create DB migration: add `functional_groups` table (id, name, is_active, created_at, updated_at)
- [ ] Create DB migration: update `users` table with full_name, email, password_hash, functional_group_id, is_active, created_at, updated_at
- [ ] Seed `functional_groups`: Cell Line Development, Cell Culture Development, Scientific Operations, Downstream Process Development, Formulation Development, Analytical Development, Program Management
- [ ] Add API: `GET /api/functional-groups` — list all active groups
- [ ] Add API: `POST /api/functional-groups` — create group (Admin only)
- [ ] Add API: `PUT /api/functional-groups/[id]` — rename or deactivate group (Admin only)
- [ ] Add API: `GET /api/users` — list all users (Admin only)
- [ ] Add API: `POST /api/users` — create user with hashed password (Admin only)
- [ ] Add API: `PUT /api/users/[id]` — edit user details, role, functional group (Admin only)
- [ ] Add API: `PUT /api/users/[id]/status` — activate or deactivate user (Admin only)
- [ ] Add User Management tab to UI (Admin only)
- [ ] User table: shows name, email, role, functional group, active status
- [ ] Add user form: full name, email, temporary password, role (Staff / Director / ProjectManager / Chief / Admin), functional group
- [ ] Edit user form: same fields, all editable
- [ ] Activate/deactivate toggle per user row (no hard deletes)
- [ ] Functional Groups management section inside User Management tab (Admin only)
- [ ] Admins can add, rename, and deactivate functional groups from the UI
- [ ] Deactivating a group does not affect existing users already assigned to it
- [ ] Enforce one Director per functional group — UI warning + API validation
- [ ] Replace login screen role dropdown with email + password fields
- [ ] On login, load full user profile (name, email, role, functional group) into session
- [ ] Add audit fields to all tables: created_by, updated_by (reference users.id) where applicable

---

## Phase 2 — Product Request Redesign

> Replaces the popup request form with a full-page experience. Adds multi-date scheduling (each date/quantity line item is fulfilled independently) and auto-populates user info from session.

- [ ] Create DB migration: add `request_line_items` table (id, request_id, requested_date, quantity, status, fulfilled_quantity, fulfillment_id, created_at)
- [ ] Create DB migration: update `product_requests` — remove quantity, add project, director_id, director_approved_at, director_rejection_note, rejected_by, rejection_stage
- [ ] Create DB migration: update `fulfillments` — link to request_line_item_id instead of request_id
- [ ] Update request status enum: Pending Approval → Approved → In Progress → Completed → Rejected
- [ ] Add API: `POST /api/requests` — creates request with multiple line items, status = Pending Approval
- [ ] Add API: `GET /api/requests` — role-aware: Admin sees Approved/In Progress/Completed/Rejected; Director sees own group's Pending Approval requests; Staff sees own requests only
- [ ] Add API: `PUT /api/requests/[id]/approve` — Director only, advances status to Approved
- [ ] Add API: `PUT /api/requests/[id]/reject` — Director or Admin, sets Rejected with note and rejection_stage
- [ ] Add API: `PUT /api/requests/[id]/line-items/[lineItemId]` — Admin fulfills a single line item
- [ ] Replace request popup with full page at `/requests/new?productId=`
- [ ] Request page: auto-populate product name and ID from URL param
- [ ] Request page: auto-populate requestor name, email, functional group from session
- [ ] Request page: dynamic line items table — user adds multiple (requested_date, quantity) rows
- [ ] Request page: minimum 1 line item required, no maximum
- [ ] Request page: justification field and SOP checkbox remain at bottom
- [ ] Director view: dedicated Approvals tab showing own group's Pending Approval requests with Approve/Reject buttons
- [ ] Admin fulfillment view: shows only Approved/In Progress requests; each line item has its own Fulfill button
- [ ] Request overall status = In Progress when at least one line item is fulfilled
- [ ] Request overall status = Completed when all line items are fulfilled

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

- [ ] Add Dashboard as default tab on login (replaces Inventory as landing tab)
- [ ] Summary card: total products currently in inventory
- [ ] Summary card: products added in the last 7 days (clickable — filters Inventory tab)
- [ ] Summary card: transactions recorded today (clickable — filters Transactions tab)
- [ ] Summary card: pending items count — role-aware (Directors see pending approvals count; Admins see approved-but-unfulfilled count; Staff sees their own pending requests count)
- [ ] Summary card: products at or below reorder threshold (clickable — filters Inventory tab)
- [ ] All cards update in real time when data changes

---

## Phase 6 — Search & Filtering

> Makes the application usable at scale when hundreds of products and transactions exist.

- [ ] Add search bar to Inventory tab — search by product name, vendor, lot number (client-side filter)
- [ ] Add functional group filter dropdown to Inventory tab
- [ ] Add date range filter (from/to + Clear button) to Transactions tab
- [ ] Add functional group filter to Transactions tab
- [ ] Add status filter to Product Requests tab
- [ ] Add date range filter to Product Requests tab
- [ ] Ensure all filters are additive (search + filter + date range all combine)

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

- [ ] Project Manager and Chief see the full Admin view
- [ ] All add, edit, delete, and action buttons hidden for Project Manager and Chief roles
- [ ] Director sees only their own functional group's requests in the Approvals tab
- [ ] Update all API routes to permit read access for ProjectManager and Chief roles
- [ ] Add role label badge to page header showing current user's role

---

## Phase 9 — Storage Location Management

> Replaces free-text storage location fields with a managed, consistent list.

- [ ] Create DB migration: add `storage_locations` table (id, name, room_number, temperature_conditions, is_active, created_at)
- [ ] Add API: `GET/POST/PUT/DELETE /api/storage-locations`
- [ ] Add Storage Locations tab (Admin only)
- [ ] Admins can add, edit, and deactivate storage locations from the UI
- [ ] Lot storage location field becomes a dropdown populated from `storage_locations` table
- [ ] Prevent deleting a location that is referenced by active lots (return 409)

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

- [ ] Install SheetJS (`xlsx`) library
- [ ] Replace CSV import with Excel (.xlsx) import
- [ ] Add sheet selector when uploaded file contains multiple sheets
- [ ] Map Excel columns to Product and Lot model fields
- [ ] Replace CSV export with Excel export for Inventory tab
- [ ] Replace CSV export with Excel export for Transactions tab
- [ ] Exported files include formatted headers and auto-sized column widths

---

## Phase 12 — Printable Audit Reports

> Generates a formatted, printable audit trail per product for compliance and documentation.

- [ ] Add Print Audit Report button to each product row (Admin, ProjectManager, Chief)
- [ ] Report includes: product details, all lots with current quantities, full transaction history (newest first)
- [ ] Render as isolated print view via React `createPortal` (same pattern as Lab Inventory Tracker)
- [ ] Include HULLC header, generation date, generated-by user name, and page numbers
-
