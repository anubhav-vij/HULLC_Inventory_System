-- =============================================================================
-- Migration 002: Extend users table with full user profile fields.
-- Adds Director, ProjectManager, Chief to the user_role enum.
-- Adds full_name, email, password_hash, functional_group_id, is_active.
-- =============================================================================

-- New enum values (IF NOT EXISTS requires PostgreSQL 9.3+)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Director';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ProjectManager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Chief';

-- New columns on users (each ALTER ... ADD COLUMN is idempotent with IF NOT EXISTS)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_name            TEXT    NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS email                TEXT    UNIQUE,
    ADD COLUMN IF NOT EXISTS password_hash        TEXT,
    ADD COLUMN IF NOT EXISTS functional_group_id  UUID    REFERENCES functional_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_active            BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_users_functional_group_id ON users (functional_group_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);
