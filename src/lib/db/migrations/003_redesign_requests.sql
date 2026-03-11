-- 003_redesign_requests.sql
-- Phase 2: Product Request Redesign

-- Step 1: Add new status values
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'Pending Approval';
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'Approved';

-- Step 2: Migrate existing Pending rows to Pending Approval
UPDATE product_requests SET status = 'Pending Approval' WHERE status = 'Pending';

-- Step 3: Change department and project columns to TEXT in product_requests
ALTER TABLE product_requests ALTER COLUMN department TYPE TEXT USING department::TEXT;
ALTER TABLE product_requests ALTER COLUMN project TYPE TEXT USING project::TEXT;
ALTER TABLE product_requests ALTER COLUMN project DROP NOT NULL;

-- Step 4: Change department column to TEXT in fulfillments
ALTER TABLE fulfillments ALTER COLUMN department TYPE TEXT USING department::TEXT;

-- Step 5: Change department column to TEXT in transactions
ALTER TABLE transactions ALTER COLUMN department TYPE TEXT USING department::TEXT;

-- Step 6: Remove quantity, add director and rejection fields to product_requests
ALTER TABLE product_requests
  DROP COLUMN quantity,
  ADD COLUMN director_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN director_approved_at TIMESTAMPTZ,
  ADD COLUMN director_rejection_note TEXT,
  ADD COLUMN rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN rejection_stage TEXT;

-- Step 7: Create request_line_items table
CREATE TABLE request_line_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        UUID        NOT NULL REFERENCES product_requests(id) ON DELETE CASCADE,
  requested_date    DATE        NOT NULL,
  quantity          INTEGER     NOT NULL CHECK (quantity >= 1),
  status            TEXT        NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Fulfilled')),
  fulfilled_quantity INTEGER    NOT NULL DEFAULT 0 CHECK (fulfilled_quantity >= 0),
  fulfillment_id    UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rli_request_id ON request_line_items (request_id);
CREATE INDEX idx_rli_status ON request_line_items (status);

-- Step 8: Alter fulfillments
ALTER TABLE fulfillments DROP CONSTRAINT IF EXISTS fulfillments_request_id_unique;
ALTER TABLE fulfillments ALTER COLUMN request_id DROP NOT NULL;
ALTER TABLE fulfillments ADD COLUMN request_line_item_id UUID;

-- Step 9: Add FKs after both tables exist
ALTER TABLE fulfillments
  ADD CONSTRAINT fk_fulfillments_rli
  FOREIGN KEY (request_line_item_id) REFERENCES request_line_items(id) ON DELETE SET NULL;

ALTER TABLE request_line_items
  ADD CONSTRAINT fk_rli_fulfillment
  FOREIGN KEY (fulfillment_id) REFERENCES fulfillments(id) ON DELETE SET NULL;

-- Step 10: Additional indexes
CREATE INDEX idx_product_requests_director_id ON product_requests (director_id);
CREATE INDEX idx_fulfillments_rli_id ON fulfillments (request_line_item_id);
