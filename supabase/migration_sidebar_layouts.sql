-- Migration: Sidebar layout customisation
-- Run in Supabase SQL editor

-- Stores per-user sidebar layout overrides
-- project_id NULL  → global user default
-- project_id set + user_id set → project-specific user override
-- project_id set + user_id NULL → admin-set project default (fallback for members)
CREATE TABLE IF NOT EXISTS sidebar_layouts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  layout        jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- At most one row per (user, project) pair; project admin default has user_id = NULL
  CONSTRAINT sidebar_layouts_unique UNIQUE NULLS NOT DISTINCT (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS sidebar_layouts_user_id_idx      ON sidebar_layouts(user_id);
CREATE INDEX IF NOT EXISTS sidebar_layouts_project_id_idx   ON sidebar_layouts(project_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sidebar_layouts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_sidebar_layouts_updated_at ON sidebar_layouts;
CREATE TRIGGER set_sidebar_layouts_updated_at
  BEFORE UPDATE ON sidebar_layouts
  FOR EACH ROW EXECUTE FUNCTION update_sidebar_layouts_updated_at();

-- RLS
ALTER TABLE sidebar_layouts ENABLE ROW LEVEL SECURITY;

-- Users can read their own layouts
CREATE POLICY "sidebar_layouts_select_own" ON sidebar_layouts
  FOR SELECT USING (auth.uid() = user_id);

-- Project members can read the project admin default (user_id IS NULL)
CREATE POLICY "sidebar_layouts_select_project_default" ON sidebar_layouts
  FOR SELECT USING (
    user_id IS NULL AND
    project_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = sidebar_layouts.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- Users can insert/update/delete their own rows
CREATE POLICY "sidebar_layouts_insert_own" ON sidebar_layouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sidebar_layouts_update_own" ON sidebar_layouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "sidebar_layouts_delete_own" ON sidebar_layouts
  FOR DELETE USING (auth.uid() = user_id);

-- Only project owner/admin can set the project default (user_id IS NULL)
CREATE POLICY "sidebar_layouts_insert_project_default" ON sidebar_layouts
  FOR INSERT WITH CHECK (
    user_id IS NULL AND
    project_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = sidebar_layouts.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "sidebar_layouts_update_project_default" ON sidebar_layouts
  FOR UPDATE USING (
    user_id IS NULL AND
    project_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = sidebar_layouts.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Done
