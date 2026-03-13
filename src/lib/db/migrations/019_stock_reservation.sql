-- Migration 019: Add stock reservation tracking to products
-- Phase 7: Prevents double-allocation when multiple requests target the same product.

ALTER TABLE products ADD COLUMN reserved_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE products ADD CONSTRAINT chk_reserved_non_negative CHECK (reserved_quantity >= 0);
