-- =============================================================================
-- Migration 001: Add functional_groups table
-- Seeds the 7 standard HULLC functional groups.
-- Depends on: set_updated_at() trigger function (defined in schema.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS functional_groups (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_functional_groups_updated_at
    BEFORE UPDATE ON functional_groups
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_functional_groups_name ON functional_groups (name);
CREATE INDEX IF NOT EXISTS idx_functional_groups_is_active ON functional_groups (is_active);
