-- Migration: Character Role Tags
-- Adds a `role` column to the characters table for narrative role classifications.
-- Run this in the Supabase SQL editor.

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS role TEXT;

COMMENT ON COLUMN characters.role IS
  'Narrative/dramatic role of the character.
   Allowed values (UI-enforced, not DB-constrained for flexibility):
     protagonist  – the main hero/lead
     antagonist   – the villain or opposing force
     main         – main cast (but not the primary protagonist/antagonist)
     supporting   – secondary/supporting character
     minor        – bit part or very limited appearance
     ensemble     – part of a group without a standout individual role
   NULL means the role has not been set yet (falls back to is_main boolean).';

-- Optional: if you want a check constraint for the allowed values
-- ALTER TABLE characters
--   ADD CONSTRAINT characters_role_check
--   CHECK (role IN ('protagonist','antagonist','main','supporting','minor','ensemble') OR role IS NULL);

-- Index for fast role-based queries
CREATE INDEX IF NOT EXISTS idx_characters_role
  ON characters (project_id, role);


-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Episodes Seasons & Ordering
-- Supports per-episode season assignment, custom accent colour, and sort order.
-- All data lives in existing JSONB columns (scripts.metadata and
-- projects.content_metadata) so no new columns are strictly required.
-- However the optional sort_order column below gives a fast ORDER BY path.
-- ─────────────────────────────────────────────────────────────────────────────

-- Optional fast-sort column on scripts (episodes are scripts filtered by project)
ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

COMMENT ON COLUMN scripts.sort_order IS
  'Display order of the episode within the series. Lower = earlier.
   Also mirrored inside scripts.metadata.sort_order for JS convenience.';

-- Index so fetching episodes ordered by sort_order is efficient
CREATE INDEX IF NOT EXISTS idx_scripts_sort_order
  ON scripts (project_id, sort_order);

-- The season definitions (name, number, colour) are stored in
-- projects.content_metadata as a JSONB array under the key "series_seasons".
-- Example value:
--   [{"num":1,"name":"Season 1","color":"#6366f1"},
--    {"num":2,"name":"Season 2","color":"#0ea5e9"}]
--
-- Per-episode season + colour are stored in scripts.metadata:
--   { "episode_season": 1, "episode_color": "#7c3aed", "sort_order": 3 }
--
-- No additional columns are needed; content_metadata and metadata are already
-- JSONB in the DB (even though TypeScript types them more narrowly).

-- Backfill sort_order for any existing scripts that don't have it set
UPDATE scripts
SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) - 1 AS rn
  FROM scripts
) sub
WHERE scripts.id = sub.id
  AND scripts.sort_order = 0;
