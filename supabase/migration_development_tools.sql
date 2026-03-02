-- Migration: Development Tools — Notes Rounds, Scene Status, Script Lock & Revision Colours
-- Run this in your Supabase SQL editor.

-- ────────────────────────────────────────────────────────────
-- 1. scene_status column on script_elements
-- ────────────────────────────────────────────────────────────
ALTER TABLE script_elements
  ADD COLUMN IF NOT EXISTS scene_status text
  CHECK (scene_status IN ('first_draft', 'revised', 'locked', 'cut'))
  DEFAULT 'first_draft';

-- ────────────────────────────────────────────────────────────
-- 2. Script-level lock + revision colour
--    (revision_color already exists as a column in some installs;
--     use ADD COLUMN IF NOT EXISTS to be safe)
-- ────────────────────────────────────────────────────────────
ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS locked_at  timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 3. Notes Rounds table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS script_notes_rounds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  script_id   uuid REFERENCES scripts(id) ON DELETE SET NULL,
  title       text NOT NULL DEFAULT 'Notes Round',
  status      text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'closed')),
  round_number int NOT NULL DEFAULT 1,
  notes_from  text,            -- e.g. 'Studio', 'Producer', 'Director'
  due_date    date,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS script_notes_rounds_project_id_idx ON script_notes_rounds(project_id);
CREATE INDEX IF NOT EXISTS script_notes_rounds_script_id_idx  ON script_notes_rounds(script_id);

-- ────────────────────────────────────────────────────────────
-- 4. Script Notes (individual notes within a round)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS script_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id      uuid NOT NULL REFERENCES script_notes_rounds(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category      text NOT NULL DEFAULT 'general'
    CHECK (category IN ('story', 'character', 'dialogue', 'structure', 'format', 'general')),
  content       text NOT NULL DEFAULT '',
  scene_ref     text,    -- e.g. "Sc 14" or "INT. KITCHEN"
  page_ref      text,    -- e.g. "p. 23"
  status        text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'addressed', 'deferred', 'rejected')),
  assigned_to   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS script_notes_round_id_idx    ON script_notes(round_id);
CREATE INDEX IF NOT EXISTS script_notes_project_id_idx  ON script_notes(project_id);
CREATE INDEX IF NOT EXISTS script_notes_status_idx      ON script_notes(status);

-- ────────────────────────────────────────────────────────────
-- 5. updated_at triggers
-- ────────────────────────────────────────────────────────────
-- Reuse existing trigger function if it exists, otherwise create it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS update_script_notes_rounds_updated_at ON script_notes_rounds;
CREATE TRIGGER update_script_notes_rounds_updated_at
  BEFORE UPDATE ON script_notes_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_script_notes_updated_at ON script_notes;
CREATE TRIGGER update_script_notes_updated_at
  BEFORE UPDATE ON script_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────
-- 6. Row Level Security
-- ────────────────────────────────────────────────────────────
ALTER TABLE script_notes_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_notes        ENABLE ROW LEVEL SECURITY;

-- Notes rounds: accessible to project members
CREATE POLICY "Project members can view notes rounds"
  ON script_notes_rounds FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Project members can insert notes rounds"
  ON script_notes_rounds FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Project members can update notes rounds"
  ON script_notes_rounds FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Project members can delete notes rounds"
  ON script_notes_rounds FOR DELETE
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

-- Notes: accessible to project members
CREATE POLICY "Project members can view notes"
  ON script_notes FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Project members can insert notes"
  ON script_notes FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Project members can update notes"
  ON script_notes FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Project members can delete notes"
  ON script_notes FOR DELETE
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );
