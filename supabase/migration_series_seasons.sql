-- Migration: series_seasons table
-- Replaces JSONB storage in projects.content_metadata.series_seasons
-- with a proper relational table supporting logline, synopsis, and characters.

CREATE TABLE IF NOT EXISTS series_seasons (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  season_number INTEGER     NOT NULL,
  title         TEXT        NOT NULL DEFAULT '',
  logline       TEXT,
  synopsis      TEXT,
  color         TEXT        NOT NULL DEFAULT '#6366f1',
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, season_number)
);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_series_seasons_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_series_seasons_updated_at ON series_seasons;
CREATE TRIGGER trg_series_seasons_updated_at
  BEFORE UPDATE ON series_seasons
  FOR EACH ROW EXECUTE FUNCTION update_series_seasons_updated_at();

-- RLS
ALTER TABLE series_seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Series seasons: project members can view" ON series_seasons;
CREATE POLICY "Series seasons: project members can view"
  ON series_seasons FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Series seasons: editors can insert" ON series_seasons;
CREATE POLICY "Series seasons: editors can insert"
  ON series_seasons FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Series seasons: editors can update" ON series_seasons;
CREATE POLICY "Series seasons: editors can update"
  ON series_seasons FOR UPDATE TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Series seasons: editors can delete" ON series_seasons;
CREATE POLICY "Series seasons: editors can delete"
  ON series_seasons FOR DELETE TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );
