-- ============================================================
-- Migration: Add per-project Pro support
-- ============================================================
-- Adds a `pro_enabled` boolean column to projects table.
-- When true, all Pro tools are unlocked on that specific project
-- even if the project owner doesn't have a global Pro subscription.
-- ============================================================

-- Add pro_enabled column (default false for existing projects)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pro_enabled boolean DEFAULT false;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_projects_pro_enabled ON projects (pro_enabled) WHERE pro_enabled = true;

-- RLS: project members can see the pro_enabled field (inherited from existing project RLS)
-- No additional policies needed since it's a regular column on the projects table.
