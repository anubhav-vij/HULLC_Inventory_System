-- Migration 018: Add is_system flag to protect the default super admin

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark the seeded System Administrator as the protected system user
UPDATE users SET is_system = TRUE WHERE LOWER(email) = 'admin@hullc.nih.gov'
