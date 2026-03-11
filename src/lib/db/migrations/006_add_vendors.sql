-- Migration 006: Add vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed existing vendor names from products into the vendors table
INSERT INTO vendors (name)
SELECT DISTINCT vendor FROM products WHERE vendor IS NOT NULL AND vendor != ''
ON CONFLICT (name) DO NOTHING;

-- Add vendor_id column to products (nullable for now)
ALTER TABLE products ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);

-- Populate vendor_id from existing vendor text
UPDATE products p
SET vendor_id = v.id
FROM vendors v
WHERE p.vendor = v.name AND p.vendor_id IS NULL;
