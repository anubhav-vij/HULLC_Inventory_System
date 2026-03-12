-- Migration 013: Add case-insensitive unique index on users.email
-- Prevents duplicate accounts with different casing (e.g. Admin@NIH.gov vs admin@nih.gov)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
