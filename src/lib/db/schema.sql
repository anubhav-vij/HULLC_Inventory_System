-- =============================================================================
-- HULLC Inventory System — PostgreSQL Database Schema
-- =============================================================================
-- Replaces all localStorage and IndexedDB usage with a relational database.
-- Product IDs retain the existing P001/P002 TEXT format from the codebase.
-- All other primary keys are UUIDs, matching the uuid-v4 pattern already used.
-- File binaries are NOT stored here — only metadata. Store blobs in S3/GCS
-- using the lot_files.id UUID as the object key (mirrors the IndexedDB pattern).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- pgcrypto provides gen_random_uuid() for UUID generation.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ---------------------------------------------------------------------------
-- Enum Types
-- ---------------------------------------------------------------------------

-- Mirrors UserRole in src/lib/types.ts
CREATE TYPE user_role AS ENUM (
    'Admin',
    'Staff'
);

-- Mirrors DEPARTMENTS constant + the internal 'core' system namespace.
CREATE TYPE department AS ENUM (
    'core',
    'HULLC',
    'Cardiology',
    'Neurology',
    'Oncology',
    'Pediatrics',
    'Research & Development'
);

-- Mirrors ProductRequestStatus in src/lib/types.ts
CREATE TYPE request_status AS ENUM (
    'Pending',
    'In Progress',
    'Completed',
    'Rejected'
);

-- Mirrors PROJECTS constant in src/lib/types.ts
CREATE TYPE project_name AS ENUM (
    'Project Alpha',
    'Project Beta',
    'Clinical Trial Gamma',
    'Pre-clinical Study Delta'
);


-- ---------------------------------------------------------------------------
-- Trigger helper: automatically refresh updated_at on any UPDATE
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- TABLE: users
-- =============================================================================
-- Represents authenticated users of the system.
-- Currently the app has no real auth (role/department is self-selected at
-- login). This table is the foundation for adding real authentication later
-- (e.g., linking to an auth provider via an external_id column).
-- Replaces: the 'hullc-user-data' localStorage key.
-- =============================================================================

CREATE TABLE users (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    role        user_role   NOT NULL,
    department  department  NOT NULL,

    -- Timestamps
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: most queries filter by role (admins vs. staff)
CREATE INDEX idx_users_role ON users (role);

-- Index: departmental views filter by department
CREATE INDEX idx_users_department ON users (department);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  users                IS 'Authenticated system users. Supports Admin and Staff roles across departments.';
COMMENT ON COLUMN users.id             IS 'UUID primary key.';
COMMENT ON COLUMN users.role           IS 'Admin: full CRUD. Staff: read-only + request submission.';
COMMENT ON COLUMN users.department     IS 'The department this user belongs to, or ''core'' for central inventory admins.';


-- =============================================================================
-- TABLE: products
-- =============================================================================
-- The central inventory item catalogue managed by core admins.
-- Product IDs use the P001/P002 TEXT format already established in the
-- codebase (see nextProductId logic in inventory-page.tsx).
-- Replaces: 'hullc-products-data-core' localStorage key.
-- =============================================================================

CREATE TABLE products (
    -- Retains the existing P001/P002 sequential format from the codebase.
    id                  TEXT        PRIMARY KEY,
    name                TEXT        NOT NULL,
    vendor              TEXT        NOT NULL,
    vendor_part_number  TEXT        NOT NULL,

    -- NULL means no reorder alert is configured for this product.
    reorder_threshold   INTEGER     CHECK (reorder_threshold >= 0),

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: searching/filtering by name is the most common product query
CREATE INDEX idx_products_name ON products (name);

-- Index: vendor part number is displayed and searched in tables
CREATE INDEX idx_products_vendor_part_number ON products (vendor_part_number);

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  products                   IS 'Core inventory product catalogue. Each product has one or more lots.';
COMMENT ON COLUMN products.id                IS 'Sequential text ID in P001/P002 format, matching the existing codebase convention.';
COMMENT ON COLUMN products.vendor_part_number IS 'The vendor''s own catalog number for this product.';
COMMENT ON COLUMN products.reorder_threshold IS 'Alert admins when total lot quantity falls below this number. NULL = no alert.';


-- =============================================================================
-- TABLE: lots
-- =============================================================================
-- A product can be received in multiple shipments (lots), each with its own
-- quantity, expiration date, and storage location. This mirrors LotSchema.
-- Cascading delete: removing a product removes all its lots.
-- Replaces: the nested 'lots' array inside each product in localStorage.
-- =============================================================================

CREATE TABLE lots (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      TEXT        NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    lot_number      TEXT        NOT NULL,
    quantity        INTEGER     NOT NULL CHECK (quantity >= 0),
    receipt_date    DATE        NOT NULL,

    -- NULL means the expiration date is unknown or not applicable.
    expiration_date DATE,
    location        TEXT        NOT NULL,

    -- Optional freeform notes (e.g. "QC passed on 2025-01-10").
    notes           TEXT,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: the most common query is fetching all lots for a given product
CREATE INDEX idx_lots_product_id ON lots (product_id);

-- Index: expiration date is used for sorting and expiry alerts
CREATE INDEX idx_lots_expiration_date ON lots (expiration_date);

CREATE TRIGGER trg_lots_updated_at
    BEFORE UPDATE ON lots
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  lots                  IS 'Individual shipment lots for a product. Quantity is decremented by dispense transactions.';
COMMENT ON COLUMN lots.product_id       IS 'The product this lot belongs to. Cascades on product deletion.';
COMMENT ON COLUMN lots.lot_number       IS 'Manufacturer-assigned lot/batch number (e.g. ''LOT-2025-A'').';
COMMENT ON COLUMN lots.quantity         IS 'Current available quantity. Updated atomically when a transaction is recorded.';
COMMENT ON COLUMN lots.expiration_date  IS 'NULL if no expiration date is known or applicable.';
COMMENT ON COLUMN lots.location         IS 'Physical storage location (e.g. ''Room 101, Shelf A'').';


-- =============================================================================
-- TABLE: lot_files
-- =============================================================================
-- Stores metadata for files attached to a lot (e.g. a COA PDF or label image).
-- Replaces IndexedDB (idb-keyval) file storage in src/lib/file-store.ts.
-- The actual binary is stored externally (S3/GCS); use lot_files.id as the
-- object key — this mirrors the UUID key used in IndexedDB exactly.
-- Mirrors: LotFileSchema { id, name, type } in src/lib/types.ts.
-- =============================================================================

CREATE TABLE lot_files (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id      UUID        NOT NULL REFERENCES lots(id) ON DELETE CASCADE,

    -- Original filename as uploaded by the user (e.g. 'certificate-of-analysis.pdf')
    name        TEXT        NOT NULL,

    -- MIME type: 'application/pdf', 'image/jpeg', or 'image/tiff'
    type        TEXT        NOT NULL CHECK (type IN ('application/pdf', 'image/jpeg', 'image/tiff')),

    -- Timestamps
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Enforces the one-file-per-lot constraint from the UI
    CONSTRAINT lot_files_lot_id_unique UNIQUE (lot_id)
);

CREATE TRIGGER trg_lot_files_updated_at
    BEFORE UPDATE ON lot_files
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  lot_files         IS 'File metadata for documents attached to a lot (COAs, labels, etc). Binary stored externally in object storage using id as the key.';
COMMENT ON COLUMN lot_files.id      IS 'UUID used as the object storage key. Mirrors the IndexedDB key pattern from file-store.ts.';
COMMENT ON COLUMN lot_files.lot_id  IS 'The lot this file is attached to. Unique — one file per lot. Cascades on lot deletion.';
COMMENT ON COLUMN lot_files.name    IS 'Original filename shown in the UI.';
COMMENT ON COLUMN lot_files.type    IS 'MIME type. Constrained to the three types accepted by the product form.';


-- =============================================================================
-- TABLE: product_requests
-- =============================================================================
-- Requests submitted by staff (or departmental users) asking the core admin
-- to dispense a quantity of a product. Mirrors ProductRequestSchema.
-- Replaces: 'hullc-requests-data-core' localStorage key.
-- =============================================================================

CREATE TABLE product_requests (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ON DELETE RESTRICT: do not allow a product to be deleted while open
    -- requests for it exist. Admin must reject/close requests first.
    product_id      TEXT            NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

    -- Denormalized snapshot of the product name at time of request.
    -- Preserved even if the product name changes later.
    product_name    TEXT            NOT NULL,

    requestor_name  TEXT            NOT NULL,
    requestor_email TEXT            NOT NULL,
    department      department      NOT NULL,
    quantity        INTEGER         NOT NULL CHECK (quantity >= 1),
    project         project_name    NOT NULL,
    justification   TEXT            NOT NULL,

    -- Confirms the requestor acknowledged SOP-30037.01 before submitting.
    sop_read        BOOLEAN         NOT NULL DEFAULT FALSE,

    status          request_status  NOT NULL DEFAULT 'Pending',

    -- Only populated when status = 'Rejected'
    rejection_note  TEXT,

    -- The date the request was submitted (set at insert, not updated_at)
    date            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Timestamps
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Index: admin dashboard filters requests by status constantly
CREATE INDEX idx_product_requests_status ON product_requests (status);

-- Index: admins view requests per product
CREATE INDEX idx_product_requests_product_id ON product_requests (product_id);

-- Index: departmental view filters by department
CREATE INDEX idx_product_requests_department ON product_requests (department);

-- Index: requests sorted by submission date descending
CREATE INDEX idx_product_requests_date ON product_requests (date DESC);

CREATE TRIGGER trg_product_requests_updated_at
    BEFORE UPDATE ON product_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  product_requests                 IS 'Requests from staff for the core admin to dispense a product. Drives the fulfillment workflow.';
COMMENT ON COLUMN product_requests.product_name    IS 'Snapshot of product name at request time. Stable even if product is renamed.';
COMMENT ON COLUMN product_requests.sop_read        IS 'Must be TRUE before a request can be submitted. Confirms SOP-30037.01 was acknowledged.';
COMMENT ON COLUMN product_requests.status          IS 'Pending → In Progress → Completed, or Pending → Rejected.';
COMMENT ON COLUMN product_requests.rejection_note  IS 'Admin''s reason for rejection. Required when status = Rejected.';
COMMENT ON COLUMN product_requests.date            IS 'Submission timestamp. Separate from created_at — never changes after insert.';


-- =============================================================================
-- TABLE: fulfillments
-- =============================================================================
-- Represents an admin's active work to satisfy a product request. One
-- fulfillment per request. The actual dispensing is tracked via the
-- transactions table (transactions.fulfillment_id FK below).
-- Mirrors: FulfillmentSchema in src/lib/types.ts.
-- Replaces: 'hullc-fulfillments-data-core' localStorage key.
-- =============================================================================

CREATE TABLE fulfillments (
    id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ON DELETE RESTRICT: the originating request must not be deleted while
    -- a fulfillment is open.
    request_id                UUID        NOT NULL REFERENCES product_requests(id) ON DELETE RESTRICT,

    product_id                TEXT        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

    -- Denormalized snapshots for display without joins
    product_name              TEXT        NOT NULL,
    department                department  NOT NULL,
    total_quantity_requested  INTEGER     NOT NULL CHECK (total_quantity_requested > 0),

    -- Timestamps
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One fulfillment per request enforced at the DB level
    CONSTRAINT fulfillments_request_id_unique UNIQUE (request_id)
);

-- Index: look up fulfillments by product
CREATE INDEX idx_fulfillments_product_id ON fulfillments (product_id);

-- Index: look up fulfillments by department for departmental admin views
CREATE INDEX idx_fulfillments_department ON fulfillments (department);

CREATE TRIGGER trg_fulfillments_updated_at
    BEFORE UPDATE ON fulfillments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  fulfillments                         IS 'Admin''s active fulfillment record for a product request. Completed by recording one or more dispense transactions.';
COMMENT ON COLUMN fulfillments.request_id              IS 'The product request being fulfilled. Unique — one fulfillment per request.';
COMMENT ON COLUMN fulfillments.total_quantity_requested IS 'Copied from the request at fulfillment creation. Does not change if the request quantity is edited.';


-- =============================================================================
-- TABLE: transactions
-- =============================================================================
-- Records each dispense event from the core inventory. A transaction reduces
-- lot quantities and can optionally be linked to a fulfillment.
-- Mirrors: TransactionSchema in src/lib/types.ts.
-- Replaces: 'hullc-transactions-data-core' localStorage key.
-- =============================================================================

CREATE TABLE transactions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ON DELETE RESTRICT: protect history — don't allow deleting a product
    -- that has transaction history (admin must manually delete transactions first).
    product_id      TEXT        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

    -- Denormalized snapshot — stable even if the product is later renamed
    product_name    TEXT        NOT NULL,

    date            TIMESTAMPTZ NOT NULL,
    notes           TEXT        NOT NULL,
    total_quantity  INTEGER     NOT NULL CHECK (total_quantity > 0),

    -- Optional: who requested this dispense (from the linked product request)
    requestor_name  TEXT,
    department      department,

    -- NULL for manual (ad-hoc) dispenses. Set when the transaction is part
    -- of a fulfillment workflow.
    -- ON DELETE SET NULL: if a fulfillment is cancelled, preserve the
    -- transaction history but unlink it.
    fulfillment_id  UUID        REFERENCES fulfillments(id) ON DELETE SET NULL,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: list all transactions for a product (transaction history tab)
CREATE INDEX idx_transactions_product_id ON transactions (product_id);

-- Index: filter transactions by department
CREATE INDEX idx_transactions_department ON transactions (department);

-- Index: fulfillment → its dispensed transactions
CREATE INDEX idx_transactions_fulfillment_id ON transactions (fulfillment_id);

-- Index: date-based sorting and range filtering
CREATE INDEX idx_transactions_date ON transactions (date DESC);

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  transactions                IS 'Records every dispense event from the core inventory. Each transaction reduces lot quantities atomically.';
COMMENT ON COLUMN transactions.product_name   IS 'Snapshot at dispense time. Stable if the product is later renamed.';
COMMENT ON COLUMN transactions.total_quantity IS 'Sum of all transaction_items.quantity for this transaction.';
COMMENT ON COLUMN transactions.fulfillment_id IS 'Set when this dispense was done in response to a product request fulfillment. NULL for ad-hoc dispenses.';


-- =============================================================================
-- TABLE: transaction_items
-- =============================================================================
-- The per-lot line items within a transaction. One transaction can draw from
-- multiple lots. Mirrors the TransactionSchema.items array.
-- Cascading delete: deleting a transaction removes its line items.
-- NOTE: lot quantities are NOT restored on transaction delete — that logic
-- lives in the application layer (see handleConfirmDeleteTransaction).
-- =============================================================================

CREATE TABLE transaction_items (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),

    transaction_id  UUID    NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,

    -- ON DELETE RESTRICT: protect lot history. A lot cannot be deleted if it
    -- has transaction history (would lose audit trail).
    lot_id          UUID    NOT NULL REFERENCES lots(id) ON DELETE RESTRICT,

    -- Denormalized snapshot of the lot number at time of dispense
    lot_number      TEXT    NOT NULL,

    -- How many units were taken from this specific lot
    quantity        INTEGER NOT NULL CHECK (quantity > 0),

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: fetch all line items for a transaction in one query
CREATE INDEX idx_transaction_items_transaction_id ON transaction_items (transaction_id);

-- Index: find all transactions that touched a specific lot
CREATE INDEX idx_transaction_items_lot_id ON transaction_items (lot_id);

CREATE TRIGGER trg_transaction_items_updated_at
    BEFORE UPDATE ON transaction_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  transaction_items                IS 'Per-lot line items for a dispense transaction. One row per lot drawn from.';
COMMENT ON COLUMN transaction_items.transaction_id IS 'Parent transaction. Cascades on delete.';
COMMENT ON COLUMN transaction_items.lot_id         IS 'The lot that was drawn from. RESTRICT prevents deleting lots with history.';
COMMENT ON COLUMN transaction_items.lot_number     IS 'Snapshot of lot number at dispense time. Stable if lot number is corrected later.';
COMMENT ON COLUMN transaction_items.quantity       IS 'Units taken from this lot. Always > 0 (zero-quantity items are excluded at the app layer).';
