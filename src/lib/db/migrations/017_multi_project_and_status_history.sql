-- Migration 017: Multi-project support on requests + request status history table

-- Step 1: Convert project column from TEXT to TEXT[] array
-- Existing single values become single-element arrays
ALTER TABLE product_requests ALTER COLUMN project TYPE TEXT[] USING CASE WHEN project IS NOT NULL THEN ARRAY[project] ELSE NULL END;

-- Step 2: Create request_status_history table for workflow audit trail
CREATE TABLE request_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES product_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Indexes for request_status_history
CREATE INDEX idx_rsh_request_id ON request_status_history (request_id);

CREATE INDEX idx_rsh_created_at ON request_status_history (created_at DESC)
