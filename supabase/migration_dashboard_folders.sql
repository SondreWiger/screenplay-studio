-- Migration: Dashboard project folders
-- Allows users to organise their personal projects into folders on the dashboard.
-- Run in Supabase SQL editor.

-- ─── Folders table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dashboard_folders (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  emoji      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_collapsed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_folders_user ON dashboard_folders(user_id);

-- ─── Add folder_id column to projects ────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES dashboard_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_folder_id ON projects(folder_id);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE dashboard_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_folders_select" ON dashboard_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "dashboard_folders_insert" ON dashboard_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dashboard_folders_update" ON dashboard_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "dashboard_folders_delete" ON dashboard_folders
  FOR DELETE USING (auth.uid() = user_id);

-- ─── updated_at trigger ───────────────────────────────────────
CREATE TRIGGER dashboard_folders_updated_at
  BEFORE UPDATE ON dashboard_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
