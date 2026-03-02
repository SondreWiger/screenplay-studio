-- Migration: Project Templates
-- Allows users to save a project as a reusable template and start new projects from templates.
-- Run in Supabase SQL editor.

-- ─── Templates table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_templates (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  project_type         TEXT NOT NULL DEFAULT 'screenplay',
  script_type          TEXT,
  genre                TEXT,
  format               TEXT,
  structure_snapshot   JSONB DEFAULT '{}',
  is_public            BOOLEAN NOT NULL DEFAULT false,
  use_count            INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_templates_user    ON project_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_project_templates_public  ON project_templates(is_public) WHERE is_public = true;

-- ─── RLS ──────────────────────────────────────────────────
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

-- Owner can do anything with their templates
CREATE POLICY "project_templates_owner_select" ON project_templates
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "project_templates_insert" ON project_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "project_templates_update" ON project_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "project_templates_delete" ON project_templates
  FOR DELETE USING (auth.uid() = user_id);

-- ─── updated_at trigger ───────────────────────────────────
CREATE TRIGGER project_templates_updated_at
  BEFORE UPDATE ON project_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
