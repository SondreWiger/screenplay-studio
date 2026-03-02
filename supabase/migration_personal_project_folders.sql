-- ─────────────────────────────────────────────────────────────────────────────
-- Personal project folder assignments
-- Each user can organise projects they have access to into their own folders
-- independently from every other user.  Previously folder_id lived on the
-- projects row (shared / destructive).  This replaces that approach.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_project_folder_assignments (
  user_id    uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id)        ON DELETE CASCADE,
  folder_id  uuid          REFERENCES dashboard_folders(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_upfa_user    ON user_project_folder_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_upfa_project ON user_project_folder_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_upfa_folder  ON user_project_folder_assignments(folder_id);

ALTER TABLE user_project_folder_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upfa_select" ON user_project_folder_assignments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "upfa_insert" ON user_project_folder_assignments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "upfa_update" ON user_project_folder_assignments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "upfa_delete" ON user_project_folder_assignments
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Migrate existing data ────────────────────────────────────────────────────
-- For projects that already had a folder_id set, figure out which user set it
-- by matching the folder's owner, and copy that assignment across.
INSERT INTO user_project_folder_assignments (user_id, project_id, folder_id)
SELECT df.user_id, p.id, p.folder_id
FROM   projects p
JOIN   dashboard_folders df ON df.id = p.folder_id
WHERE  p.folder_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- We intentionally leave projects.folder_id in place (no DROP COLUMN) so that
-- old code paths keep working during rollout, but new code ignores that column
-- and reads from user_project_folder_assignments instead.
