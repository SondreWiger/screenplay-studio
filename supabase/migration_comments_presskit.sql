-- ─────────────────────────────────────────────────────────────────────────────
-- Document Comments + Press Kit
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Document inline comments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_comments (
  id            uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id   uuid    NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
  project_id    uuid    NOT NULL REFERENCES projects(id)           ON DELETE CASCADE,
  author_id     uuid    NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  content       text    NOT NULL,
  -- Approximate position data (best-effort; textarea doesn't give precise anchors)
  char_offset   integer,            -- character offset at start of selection
  line_index    integer,            -- 0-based line number at time of comment
  selected_text text,               -- snapshot of the text that was selected
  is_resolved   boolean DEFAULT false,
  mentions      uuid[]  DEFAULT '{}',   -- user IDs @mentioned in content
  parent_id     uuid    REFERENCES document_comments(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_comments_document ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_comments_project  ON document_comments(project_id);

ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_comments_select" ON document_comments FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "doc_comments_insert" ON document_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "doc_comments_update" ON document_comments FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "doc_comments_delete" ON document_comments FOR DELETE
  USING (
    author_id = auth.uid()
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('admin','owner')
    )
  );

CREATE TRIGGER document_comments_updated_at
  BEFORE UPDATE ON document_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Press kit fields on projects ────────────────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS press_kit_enabled  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS press_kit_password text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS press_kit_tagline  text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS press_kit_contact  text    DEFAULT NULL;

-- Allow public (unauthenticated) read of press-kit-enabled projects
-- (Supabase anon key can read rows where press_kit_enabled = true)
CREATE POLICY "public_press_kit_select" ON projects FOR SELECT
  TO anon
  USING (press_kit_enabled = true);
