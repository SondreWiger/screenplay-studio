-- Migration: Versioned Story Editing
-- Adds metadata column to scripts table for storing per-script version config.
-- Run this in the Supabase SQL editor.

-- 1. Add metadata column to scripts (stores version config, etc.)
ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN scripts.metadata IS
  'Flexible per-script config. Currently used for:
   version_config: {
     disabled: string[]   -- version names currently toggled off
     showFaded: boolean   -- show disabled as faded instead of hidden
     known: string[]      -- explicitly created version names (may have sub-versions via "/" notation)
   }';

-- 2. Index for fast metadata lookups (GIN for JSONB)
CREATE INDEX IF NOT EXISTS idx_scripts_metadata
  ON scripts USING GIN (metadata);
