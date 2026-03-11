-- ============================================================
-- Migration: New Features — Submission Tracker + Scene Color
-- ============================================================

-- 1. Add color column to scenes (used by Corkboard feature)
ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS color TEXT;

-- 2. Script Submissions table (Submission Tracker feature)
CREATE TABLE IF NOT EXISTS script_submissions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  script_id        UUID        REFERENCES scripts(id) ON DELETE SET NULL,
  recipient_name   TEXT        NOT NULL,
  recipient_type   TEXT        NOT NULL DEFAULT 'producer',
    CONSTRAINT submission_recipient_type CHECK (recipient_type IN ('agent','manager','producer','festival','network','studio','other')),
  date_sent        DATE,
  status           TEXT        NOT NULL DEFAULT 'pending',
    CONSTRAINT submission_status CHECK (status IN ('pending','passed','request','offer','accepted','withdrawn')),
  notes            TEXT,
  response_date    DATE,
  next_follow_up   DATE,
  created_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_script_submissions_project  ON script_submissions (project_id);
CREATE INDEX IF NOT EXISTS idx_script_submissions_status   ON script_submissions (project_id, status);
CREATE INDEX IF NOT EXISTS idx_script_submissions_date     ON script_submissions (project_id, date_sent DESC);

-- Updated_at auto-update trigger
CREATE OR REPLACE FUNCTION set_script_submissions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_script_submissions_updated_at ON script_submissions;
CREATE TRIGGER trg_script_submissions_updated_at
  BEFORE UPDATE ON script_submissions
  FOR EACH ROW EXECUTE FUNCTION set_script_submissions_updated_at();

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE script_submissions ENABLE ROW LEVEL SECURITY;

-- Project members can view submissions
CREATE POLICY "Members can view submissions"
  ON script_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = script_submissions.project_id
        AND pm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = script_submissions.project_id
        AND p.created_by = auth.uid()
    )
  );

-- Non-viewers can insert submissions
CREATE POLICY "Non-viewers can insert submissions"
  ON script_submissions FOR INSERT
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = script_submissions.project_id
          AND pm.user_id = auth.uid()
          AND pm.role != 'viewer'
      )
      OR EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = script_submissions.project_id
          AND p.created_by = auth.uid()
      )
    )
    AND created_by = auth.uid()
  );

-- Non-viewers can update their own submissions (owners can update any)
CREATE POLICY "Non-viewers can update submissions"
  ON script_submissions FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = script_submissions.project_id
        AND p.created_by = auth.uid()
    )
  );

-- Non-viewers (writer+) or owners can delete
CREATE POLICY "Non-viewers can delete submissions"
  ON script_submissions FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = script_submissions.project_id
        AND p.created_by = auth.uid()
    )
  );
