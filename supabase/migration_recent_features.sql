-- ============================================================
-- Recent Features Migration
-- Run this after your base FULL.sql / migration_v2.sql setup.
-- All statements are idempotent (safe to re-run).
--
-- Covers:
--   • projects.script_type          (episodic beat-sheet, episode tabs)
--   • projects.content_metadata     (beat-sheet scopes, arc-planner, episodes)
--   • mindmap_nodes sizing columns  (width, height, font_size — already in
--       migration_v2 CREATE TABLE but added here as safety net)
-- ============================================================

-- ── projects: script_type ────────────────────────────────────
-- Used by beat-sheet episodic tabs, episode pages, etc.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS script_type TEXT NOT NULL DEFAULT 'screenplay';

-- ── projects: content_metadata ───────────────────────────────
-- Stores: beat_sheets, arc_map, series_seasons, and other
-- per-project JSON blobs without dedicated tables.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS content_metadata JSONB NOT NULL DEFAULT '{}';

-- ── mindmap_nodes: sizing + font ─────────────────────────────
-- Auto-sized on character import; user-resizable by dragging.
ALTER TABLE mindmap_nodes
  ADD COLUMN IF NOT EXISTS width     DOUBLE PRECISION NOT NULL DEFAULT 120;
ALTER TABLE mindmap_nodes
  ADD COLUMN IF NOT EXISTS height    DOUBLE PRECISION NOT NULL DEFAULT 60;
ALTER TABLE mindmap_nodes
  ADD COLUMN IF NOT EXISTS font_size INTEGER          NOT NULL DEFAULT 14;

-- ── characters: is_main flag ─────────────────────────────────
-- Used by mindmap import to auto-size main vs supporting nodes.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT false;

-- ── scenes: correct column names ─────────────────────────────
-- The app queries scene_heading and sort_order.
-- scene_heading should already exist; sort_order too.
-- These are safety-net no-ops if columns already present.
ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS scene_heading TEXT;
ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS sort_order   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS page_count   DECIMAL(5,1) NOT NULL DEFAULT 0;

-- ── Production Tool Tables ────────────────────────────────────
-- See migration_production_tools.sql for table definitions.
-- Run that file first, then run this file.
-- (No table definitions here to avoid duplication.)

-- ── Updated-at triggers (safety net) ─────────────────────────
-- Re-create trigger function if missing.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['projects','mindmap_nodes','characters','scenes'] LOOP
    -- Only create trigger if the table has updated_at and the trigger doesn't exist yet
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'updated_at'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || tbl || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        tbl
      );
    END IF;
  END LOOP;
END $$;
