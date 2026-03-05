-- ============================================================
-- Production Tools Migration
-- Adds tables for: Continuity Sheet, Call Sheets, DOOD,
-- Script Coverage, Table Read, Camera/Sound Reports,
-- Safety Plan, Treatment Writer
-- ============================================================

-- ── Continuity Sheet ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS continuity_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id      UUID REFERENCES scenes(id) ON DELETE SET NULL,
  character_id  UUID REFERENCES characters(id) ON DELETE SET NULL,
  character_name TEXT,          -- fallback if character_id is null
  scene_label   TEXT,           -- fallback scene identifier
  costume       TEXT,
  hair          TEXT,
  makeup        TEXT,
  props         TEXT,
  wounds        TEXT,
  notes         TEXT,
  image_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_continuity_project ON continuity_entries(project_id);

-- ── Call Sheets ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_sheets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shoot_date      DATE NOT NULL,
  title           TEXT,
  general_call    TIME,
  base_camp       TEXT,
  nearest_hospital TEXT,
  parking         TEXT,
  weather_note    TEXT,
  scenes_today    TEXT[],       -- scene numbers/headings for the day
  crew_calls      JSONB,        -- [{name, dept, call_time, notes}]
  advanced_schedule JSONB,      -- [{scene, location, cast, pages, est_time}]
  general_notes   TEXT,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_call_sheets_project ON call_sheets(project_id);

-- ── Day Out Of Days ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dood_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_id  UUID REFERENCES characters(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  shoot_date    DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'W'
    CHECK (status IN ('SW','W','WF','SWF','H','T','F','')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, character_id, shoot_date)
);
CREATE INDEX IF NOT EXISTS idx_dood_project ON dood_entries(project_id);

-- ── Script Coverage ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS script_coverage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reader_name     TEXT,
  script_title    TEXT,
  draft_date      DATE,
  logline         TEXT,
  short_synopsis  TEXT,
  full_synopsis   TEXT,
  -- Grades: 'excellent'|'good'|'fair'|'poor'
  grade_premise   TEXT,
  grade_structure TEXT,
  grade_dialogue  TEXT,
  grade_characters TEXT,
  grade_theme     TEXT,
  grade_pacing    TEXT,
  grade_originality TEXT,
  recommendation  TEXT CHECK (recommendation IN ('pass','consider','recommend')),
  comments        TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coverage_project ON script_coverage(project_id);

-- ── Table Read Sessions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS table_read_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_name  TEXT NOT NULL DEFAULT 'Table Read',
  session_date  DATE,
  total_seconds INTEGER NOT NULL DEFAULT 0,
  scene_timings JSONB,  -- [{scene_id, scene_label, seconds}]
  notes         TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_table_read_project ON table_read_sessions(project_id);

-- ── Camera / Sound Reports ───────────────────────────────────
CREATE TABLE IF NOT EXISTS camera_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_type   TEXT NOT NULL DEFAULT 'camera' CHECK (report_type IN ('camera','sound')),
  report_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  roll_number   TEXT,
  magazine      TEXT,
  stock         TEXT,
  camera_id     TEXT,          -- camera body identifier
  takes         JSONB,         -- [{scene, setup, take, lens, stop, filter, focus_dist, int_ext, day_night, type, circle, notes}]
  sound_takes   JSONB,         -- [{scene, take, tracks: [{ch, source, notes}], wild_track, notes}]
  operator      TEXT,
  loader        TEXT,
  general_notes TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_camera_reports_project ON camera_reports(project_id);

-- ── Safety Plan ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_plan_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id        UUID REFERENCES scenes(id) ON DELETE SET NULL,
  scene_label     TEXT,
  category        TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('stunt','pyrotechnics','heights','vehicles','water','animals','hazmat','electrical','weather','crowd','general')),
  risk_level      TEXT NOT NULL DEFAULT 'medium'
    CHECK (risk_level IN ('low','medium','high','critical')),
  description     TEXT NOT NULL,
  mitigation      TEXT,
  responsible_dept TEXT,
  responsible_person TEXT,
  signed_off_by   TEXT,
  signed_off_at   TIMESTAMPTZ,
  is_cleared      BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_safety_plan_project ON safety_plan_items(project_id);

-- ── Treatment / Series Bible ─────────────────────────────────
CREATE TABLE IF NOT EXISTS treatment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  logline         TEXT,
  premise         TEXT,
  theme           TEXT,
  tone            TEXT,
  format          TEXT,         -- e.g. "60-min drama series, 8 episodes"
  budget_level    TEXT,         -- low/medium/high/tentpole
  world           TEXT,
  synopsis        TEXT,
  episode_breakdown JSONB,      -- [{episode, title, logline, synopsis}]
  character_arcs  JSONB,        -- [{name, role, arc}]
  market_context  TEXT,
  comparable_titles TEXT,
  writer_bio      TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id)           -- one treatment per project
);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE continuity_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sheets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dood_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_coverage      ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_read_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_plan_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment            ENABLE ROW LEVEL SECURITY;

-- Helper: is caller a member or owner of this project?
CREATE OR REPLACE FUNCTION _is_project_member(proj_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members WHERE project_id = proj_id AND user_id = auth.uid()
    UNION
    SELECT 1 FROM projects WHERE id = proj_id AND created_by = auth.uid()
  );
$$;

-- Policies — drop first so this migration is safe to re-run
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'continuity_entries','call_sheets','dood_entries','script_coverage',
    'table_read_sessions','camera_reports','safety_plan_items','treatment'
  ] LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "Project members can view %1$s"   ON %1$s;
      DROP POLICY IF EXISTS "Project members can insert %1$s" ON %1$s;
      DROP POLICY IF EXISTS "Project members can update %1$s" ON %1$s;
      DROP POLICY IF EXISTS "Project members can delete %1$s" ON %1$s;

      CREATE POLICY "Project members can view %1$s"
        ON %1$s FOR SELECT USING (_is_project_member(project_id));
      CREATE POLICY "Project members can insert %1$s"
        ON %1$s FOR INSERT WITH CHECK (_is_project_member(project_id));
      CREATE POLICY "Project members can update %1$s"
        ON %1$s FOR UPDATE USING (_is_project_member(project_id));
      CREATE POLICY "Project members can delete %1$s"
        ON %1$s FOR DELETE USING (_is_project_member(project_id));
    ', tbl);
  END LOOP;
END $$;
