-- Create historical_records table for legacy data import (metrics only).
-- Flat table with denormalized text fields, no FKs to products/lots.
-- Used by metrics UNION ALL queries for received/disbursed reports.

CREATE TABLE IF NOT EXISTS historical_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL CHECK (type IN ('In', 'Out')),
  event_date      DATE,
  product_name    TEXT NOT NULL,
  manufacturer    TEXT,
  manufacturer_part_number TEXT,
  uom             TEXT,
  quantity        INTEGER NOT NULL DEFAULT 0,
  department      TEXT,
  project         TEXT,
  lot_number      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID
);

CREATE INDEX idx_historical_records_type ON historical_records (type);
CREATE INDEX idx_historical_records_event_date ON historical_records (event_date);
