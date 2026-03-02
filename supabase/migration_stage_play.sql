-- ─────────────────────────────────────────────────────────────────────────────
-- Stage Play / Theatre Production Support
-- ─────────────────────────────────────────────────────────────────────────────

-- Add 'stage_play' to the project_type enum
-- (ALTER TYPE ADD VALUE cannot run inside a transaction)
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'stage_play';

-- ─── Musical-theatre script element types ─────────────────────────────────────
-- Run outside a transaction — ALTER TYPE ADD VALUE must be committed individually
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'song_title';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'lyric';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'dance_direction';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'musical_cue';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'lighting_cue';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'set_direction';

-- ─── Stage cue sheet ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stage_cues (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id     uuid    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cue_type       text    NOT NULL CHECK (cue_type IN (
                           'lighting','sound','music','follow_spot',
                           'special_effect','automation','video')),
  cue_number     text    NOT NULL,          -- e.g. "LX 1", "SQ 42", "Q 3.5"
  description    text,
  act_number     integer,
  scene_ref      text,                      -- scene heading / page ref
  script_element_id uuid REFERENCES script_elements(id) ON DELETE SET NULL,
  timing_note    text,
  duration_note  text,
  operator       text,
  notes          text,
  sort_order     integer DEFAULT 0,
  created_by     uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_cues_project ON stage_cues(project_id);
CREATE INDEX IF NOT EXISTS idx_stage_cues_type    ON stage_cues(project_id, cue_type);

ALTER TABLE stage_cues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_cues_select" ON stage_cues FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "stage_cues_write" ON stage_cues FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer'
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer'
    )
  );

CREATE TRIGGER stage_cues_updated_at
  BEFORE UPDATE ON stage_cues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Stage ensemble / cast ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stage_ensemble_members (
  id              uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      uuid    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_name      text    NOT NULL,
  actor_user_id   uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  character_name  text,               -- null = ensemble/chorus (no single character)
  ensemble_group  text    DEFAULT 'Ensemble'
                          CHECK (ensemble_group IN (
                            'Principal','Ensemble','Understudy',
                            'Dance Captain','Swing','Alternate','Other')),
  vocal_range     text,               -- Soprano / Mezzo / Alto / Tenor / Baritone / Bass / Narrator
  dance_skills    text[],             -- e.g. ['ballet','tap','jazz']
  availability    text,
  contact_email   text,
  notes           text,
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_ensemble_project ON stage_ensemble_members(project_id);

ALTER TABLE stage_ensemble_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_ensemble_select" ON stage_ensemble_members FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "stage_ensemble_write" ON stage_ensemble_members FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer'
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer'
    )
  );

CREATE TRIGGER stage_ensemble_updated_at
  BEFORE UPDATE ON stage_ensemble_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Stage production team ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stage_production_team (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id     uuid    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id        uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  name           text    NOT NULL,
  role           text    NOT NULL,   -- Director, Stage Manager, Lighting Designer …
  department     text    DEFAULT 'Other'
                         CHECK (department IN (
                           'Direction','Stage Management','Lighting',
                           'Sound','Musical Direction','Choreography',
                           'Design','Technical','Marketing','Other')),
  contact_email  text,
  phone          text,
  notes          text,
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_team_project ON stage_production_team(project_id);

ALTER TABLE stage_production_team ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_team_select" ON stage_production_team FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "stage_team_write" ON stage_production_team FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer'
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer'
    )
  );

CREATE TRIGGER stage_team_updated_at
  BEFORE UPDATE ON stage_production_team
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
