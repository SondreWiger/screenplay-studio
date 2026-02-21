-- ============================================================
-- Migration: Client Customisation
-- Adds accent_color and sidebar_tabs to both profiles and projects
-- so users can set global defaults AND per-project overrides.
-- ============================================================

-- ── Profiles (user-level global defaults) ───────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT 'brand',
  ADD COLUMN IF NOT EXISTS sidebar_tabs JSONB DEFAULT NULL;

-- ── Projects (project-level overrides) ──────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sidebar_tabs JSONB DEFAULT NULL;

-- Add a comment explaining the merge logic:
-- 1. If project.accent_color IS NOT NULL  → use it
--    Else use profiles.accent_color (default 'brand')
-- 2. If project.sidebar_tabs IS NOT NULL  → deep-merge with profile defaults
--    Else use profiles.sidebar_tabs (all enabled by default)
