# HULLC Inventory Management System — Task Board

## Status Key
- [ ] Not started
- [~] In progress
- [x] Complete

## Phase A — User Management (Priority: First)
- [ ] Add functional_groups table (id, name, is_active, created_at)
- [ ] Seed functional_groups: Cell Line Development, Cell Culture Development, Scientific Operations, Downstream Process Development, Formulation Development, Analytical Development, Program Management
- [ ] Add API: GET/POST/PUT/DELETE /api/functional-groups
- [ ] Update users table: add full_name, email, password_hash, functional_group_id, is_active columns via migration
- [ ] Add API: GET/POST/PUT/DELETE /api/users
- [ ] Add User Management tab (Admin only): table of all users with name, email, role, functional group, active status
- [ ] Add user form: full name, email, temporary password, role (Staff/Director/ProjectManager/Chief/Admin), functional group
- [ ] Edit user form: same fields, role and functional group editable
- [ ] Activate/deactivate toggle per user (no hard deletes)
- [ ] Add Functional Groups management section inside User Management tab (Admin only)
- [ ] Admins can add, rename, deactivate functional groups
- [ ] Deactivating a functional group does not affect existing users assigned to it
- [ ] Enforce one Director per functional group (UI warning + API validation)
- [ ] Update login screen: replace role dropdown with email + password fields
- [ ] On login, load full user profile (name, email, role, functional group) into session

## Phase B — Product Request Redesign (Priority: Second)
- [ ] Add request_line_items table: (id, request_id, requested_date, quantity, status, fulfilled_quantity, fulfillment_id, created_at)
- [ ] Update product_requests table: remove quantity, add project, director_id, director_approved_at, director_rejection_note, rejected_by (admin or director), rejection_stage
- [ ] Update request status enum: Pending Approval → Approved → In Progress → Completed → Rejected
- [ ] Update fulfillments table: link to request_line_item_id instead of request_id
- [ ] Add API: POST /api/requests — creates request with multiple line items, status = Pending Approval
- [ ] Add API: GET /api/requests — Admin sees Approved/In Progress/Completed/Rejected; Director sees own group's Pending Approval requests
- [ ] Add API: PUT /api/requests/[id]/approve — Director only, advances to Approved
- [ ] Add API: PUT /api/requests/[id]/reject — Director or Admin, sets Rejected with note and rejection_stage
- [ ] Add API: GET /api/requests/[id] — returns request with all line items and statuses
- [ ] Add API: PUT /api/requests/[id]/line-items/[lineItemId] — Admin fulfills a single line item
- [ ] Replace request popup with full page at /requests/new?productId=
- [ ] Request page: auto-populate product name, product ID from URL param
- [ ] Request page: auto-populate requestor name, email, functional group from session
- [ ] Request page: dynamic line items table — user adds multiple (date, quantity) rows
- [ ] Request page: minimum 1 line item, justification and SOP checkbox at bottom
- [ ] Director view: dedicated Approvals tab showing own group's Pending Approval requests with Approve/Reject buttons
- [ ] Admin fulfillment view: shows only Approved/In Progress requests; each line item has its own Fulfill button
- [ ] Request status = In Progress when at least one line item fulfilled
- [ ] Request status = Completed when all line items fulfilled

## Phase C — Email Notifications (Priority: Third, depends on Phase A+B)
- [ ] Set up AWS SES in personal AWS account (verify sender domain/email)
- [ ] Add SES credentials to .env.local and .env.production
- [ ] Create email utility at src/lib/email/index.ts using AWS SES SDK
- [ ] Create email templates for each notification type (HTML + plain text)
- [ ] Trigger: Staff submits request → email to Director of that functional group
- [ ] Trigger: Director approves request → email to Admin + email to Staff
- [ ] Trigger: Director rejects request → email to Staff with rejection note
- [ ] Trigger: Admin fulfills a line item → email to Staff
- [ ] Trigger: All line items fulfilled → email to Staff confirming request completed
- [ ] All emails include: request details, product name, line item dates/quantities, link to app
- [ ] Failed emails log to console but do not block the API response

## Phase 4 — AWS Deployment
- [ ] Replace IndexedDB with AWS S3 for lot file attachments
- [ ] Set up AWS RDS PostgreSQL instance
- [ ] Deploy frontend to AWS Amplify
- [ ] Connect Amplify to RDS via environment variables

## Phase 5 — Dashboard
- [ ] Add dashboard tab as default landing page after login
- [ ] Summary card: total products in inventory
- [ ] Summary card: products added in last 7 days
- [ ] Summary card: transactions recorded today
- [ ] Summary card: pending requests count (role-aware — Directors see their pending approvals, Admins see approved requests)
- [ ] Each card clickable — filters the relevant tab on click

## Phase 6 — Search & Filtering
- [ ] Add search bar to inventory tab (search by product name, vendor, lot number)
- [ ] Add functional group filter dropdown to inventory tab
- [ ] Add date range filter to transactions tab
- [ ] Add functional group filter to transactions tab
- [ ] Add status filter to product requests tab

## Phase 7 — Stock Reservation
- [ ] Add reserved_quantity column to products table via migration
- [ ] When Admin starts fulfilling a line item, reserve that quantity
- [ ] Show reserved quantity as separate column in inventory table (Admin view)
- [ ] Prevent dispensing more than (available - reserved) quantity
- [ ] Release reservation when line item is Completed or Rejected

## Phase 8 — Additional Roles UI
- [ ] Project Manager and Chief see full Admin view but all edit/delete/action buttons are hidden
- [ ] Update API routes to allow ProjectManager and Chief roles to read all endpoints

## Phase 9 — Storage Location Management
- [ ] Create storage_locations table (id, name, room_number, temperature_conditions, is_active)
- [ ] API: GET/POST/PUT/DELETE /api/storage-locations
- [ ] Add Storage Locations tab (Admin only)
- [ ] Lot storage location field becomes dropdown from storage_locations table
- [ ] Prevent deleting a location referenced by active lots

## Phase 10 — Document Storage
- [ ] Upgrade lot file attachment to support multiple documents per lot
- [ ] Documents uploaded when adding or editing a product/lot
- [ ] Documents stored in AWS S3 (depends on Phase 4)
- [ ] Document list shown in lot detail view with download links
- [ ] Support PDF, JPEG, TIFF, DOCX, XLSX file types

## Phase 11 — Excel Import/Export
- [ ] Replace CSV import with Excel (.xlsx) import using SheetJS
- [ ] Replace CSV export with Excel export for inventory and transactions
- [ ] Excel import supports sheet selection if file has multiple sheets
- [ ] Exported files include formatted headers and column widths

## Phase 12 — Printable Audit Reports
- [ ] Add Print Report button to each product row (Admin only)
- [ ] Report includes: product details, all lots with quantities, full transaction history
- [ ] Generate as printable HTML page (opens in new tab, browser print dialog)
- [ ] Include HULLC header, generation date, and page numbers

## Phase 13 — Metrics Dashboard
- [ ] Add Metrics tab (Admin only)
- [ ] Chart: transactions per day for last 30 days (line chart)
- [ ] Chart: transactions per week for last 12 weeks (bar chart)
- [ ] Chart: requests by functional group (bar chart)
- [ ] Chart: requests by status — Pending Approval/Approved/In Progress/Completed/Rejected (donut chart)
- [ ] Chart: products added over time (cumulative line chart)
- [ ] Date range filter applies to all charts

## Deferred
- [ ] NIH SSO integration (handled at NIH/NIAID handoff)
- [ ] Material Transfer Sheet workflow (not required)
