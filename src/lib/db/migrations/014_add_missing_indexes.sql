-- Migration 014: Add missing indexes for query performance
-- request_line_items.fulfillment_id — used in fulfillment lookups
CREATE INDEX IF NOT EXISTS idx_request_line_items_fulfillment_id ON request_line_items (fulfillment_id);

-- manufacturers.is_active — filtered in API list queries
CREATE INDEX IF NOT EXISTS idx_manufacturers_is_active ON manufacturers (is_active);

-- storage_locations.is_active — filtered in API list queries
CREATE INDEX IF NOT EXISTS idx_storage_locations_is_active ON storage_locations (is_active);
