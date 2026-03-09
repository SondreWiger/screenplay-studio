-- ============================================================
-- FESTIVAL BRIDGE MIGRATION — Screenplay Studio
-- Adds festival award/laurel tracking to projects
-- Run this on the shared Supabase project
-- ============================================================

-- Safe re-run
DROP TABLE IF EXISTS project_awards CASCADE;
DROP TYPE  IF EXISTS award_type     CASCADE;

CREATE TYPE award_type AS ENUM (
  'winner', 'runner_up', 'honorable_mention', 'official_selection',
  'shortlisted', 'nominee', 'special_jury'
);

-- ============================================================
-- project_awards
-- Links a studio project to a festival result
-- ============================================================
CREATE TABLE project_awards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  submission_id     UUID,          -- references festival_submissions.id (cross-schema, no FK)
  festival_id       UUID,          -- references festivals.id (cross-schema, no FK)
  category_id       UUID,          -- references festival_categories.id

  award_type        award_type NOT NULL DEFAULT 'official_selection',
  award_name        TEXT,          -- e.g. "Best Screenplay"
  festival_name     TEXT NOT NULL, -- denormalised for display without join
  festival_year     INT,
  laurel_url        TEXT,          -- custom laurel image uploaded by user
  is_public         BOOLEAN NOT NULL DEFAULT TRUE,
  awarded_at        TIMESTAMPTZ,
  _dirty            BOOLEAN DEFAULT FALSE,
  _new              JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_awards_project  ON project_awards(studio_project_id);
CREATE INDEX idx_project_awards_festival ON project_awards(festival_id);

CREATE TRIGGER trg_project_awards_updated_at
  BEFORE UPDATE ON project_awards FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE project_awards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication
    WHERE pubname = 'supabase_realtime' AND puballtables = TRUE
  ) THEN
    DROP PUBLICATION supabase_realtime;
    CREATE PUBLICATION supabase_realtime;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Project owner can manage their own awards
DROP POLICY IF EXISTS "awards_owner_all" ON project_awards;
CREATE POLICY "awards_owner_all" ON project_awards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_awards.studio_project_id
        AND p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_awards.studio_project_id
        AND p.created_by = auth.uid()
    )
  );

-- Public can read public awards
DROP POLICY IF EXISTS "awards_public_read" ON project_awards;
CREATE POLICY "awards_public_read" ON project_awards FOR SELECT
  USING (is_public = TRUE);

-- Admins can read all
DROP POLICY IF EXISTS "awards_admin_read" ON project_awards;
CREATE POLICY "awards_admin_read" ON project_awards FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','moderator'))
  );
