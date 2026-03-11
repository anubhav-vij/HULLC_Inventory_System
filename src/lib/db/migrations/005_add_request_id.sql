CREATE TABLE IF NOT EXISTS request_id_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE product_requests
  ADD COLUMN IF NOT EXISTS request_number INTEGER,
  ADD COLUMN IF NOT EXISTS request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_requests_request_id
  ON product_requests(request_id) WHERE request_id IS NOT NULL;
