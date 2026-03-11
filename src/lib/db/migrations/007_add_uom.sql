-- Migration 007: Add unit of measure (UoM) column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS uom TEXT;
