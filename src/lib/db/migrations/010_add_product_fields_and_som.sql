-- Migration 010: Add new product fields + SOM approval workflow columns

-- 1. New product fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS vwr_part_number TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS som_approval_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(10,2);

-- 2. SOM approval workflow columns on product_requests
ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS som_approval_status TEXT;
ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS sciops_director_approved_at TIMESTAMPTZ;
ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS sciops_director_approved_by UUID;

-- 3. Extend request_status enum to include 'Pending SciOps Approval'
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'Pending SciOps Approval';
