-- Migration 009: Rename vendors → manufacturers, vendor_part_number → manufacturer_part_number

-- 1. Rename the vendors table to manufacturers
ALTER TABLE vendors RENAME TO manufacturers;

-- 2. Add alternate_names column to manufacturers
ALTER TABLE manufacturers ADD COLUMN IF NOT EXISTS alternate_names TEXT;

-- 3. Rename vendor_id FK on products to manufacturer_id
ALTER TABLE products RENAME COLUMN vendor_id TO manufacturer_id;

-- 4. Rename vendor column on products to manufacturer
ALTER TABLE products RENAME COLUMN vendor TO manufacturer;

-- 5. Rename vendor_part_number column on products to manufacturer_part_number
ALTER TABLE products RENAME COLUMN vendor_part_number TO manufacturer_part_number;
