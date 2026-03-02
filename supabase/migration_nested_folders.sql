-- Migration: Nested dashboard folders + sort_order on folder assignments
-- Run this in your Supabase SQL editor

-- 1. Add parent_id to dashboard_folders for nesting support
ALTER TABLE dashboard_folders
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES dashboard_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dashboard_folders_parent_id_idx ON dashboard_folders(parent_id);

-- 2. Add sort_order to user_project_folder_assignments (for manual project ordering within folders)
ALTER TABLE user_project_folder_assignments
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 3. Make sure is_collapsed column exists (may already exist)
ALTER TABLE dashboard_folders
  ADD COLUMN IF NOT EXISTS is_collapsed boolean NOT NULL DEFAULT false;

-- Done
