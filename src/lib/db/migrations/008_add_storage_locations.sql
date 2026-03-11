-- Migration 008: Add storage_locations table
CREATE TABLE IF NOT EXISTS storage_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed existing location names from lots
INSERT INTO storage_locations (name)
SELECT DISTINCT location FROM lots WHERE location IS NOT NULL AND location != ''
ON CONFLICT (name) DO NOTHING;
