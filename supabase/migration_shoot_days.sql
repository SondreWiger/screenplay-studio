-- Migration: Shoot days (production schedule days)
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS shoot_days (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  day_number      integer NOT NULL,           -- 1, 2, 3…
  shoot_date      date,                       -- actual calendar date (nullable = TBD)
  title           text,                       -- optional override eg "Day 1 – Studio A"
  call_time       time,                       -- crew general call
  wrap_time       time,                       -- estimated wrap
  location        text,                       -- primary location description
  notes           text,
  status          text NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned','confirmed','completed','cancelled')),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Scene assignments per shoot day
CREATE TABLE IF NOT EXISTS shoot_day_scenes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_day_id    uuid NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_element_id uuid REFERENCES script_elements(id) ON DELETE SET NULL,
  scene_heading   text NOT NULL,              -- denormalized for display even if element deleted
  scene_number    text,
  script_id       uuid REFERENCES scripts(id) ON DELETE SET NULL,
  estimated_pages numeric(4,2),              -- page count / shooting time estimate
  sort_order      integer NOT NULL DEFAULT 0,
  notes           text
);

-- Cast called per shoot day (actor name + character + call time)
CREATE TABLE IF NOT EXISTS shoot_day_cast (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_day_id    uuid NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_name  text NOT NULL,
  actor_name      text,
  call_time       time,
  on_set_time     time,
  makeup_call     time,
  notes           text,
  sort_order      integer NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS shoot_days_project_id_idx       ON shoot_days(project_id);
CREATE INDEX IF NOT EXISTS shoot_days_shoot_date_idx       ON shoot_days(shoot_date);
CREATE INDEX IF NOT EXISTS shoot_day_scenes_shoot_day_idx  ON shoot_day_scenes(shoot_day_id);
CREATE INDEX IF NOT EXISTS shoot_day_scenes_project_idx    ON shoot_day_scenes(project_id);
CREATE INDEX IF NOT EXISTS shoot_day_cast_shoot_day_idx    ON shoot_day_cast(shoot_day_id);

-- Auto-update triggers
CREATE OR REPLACE FUNCTION update_shoot_days_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_shoot_days_updated_at ON shoot_days;
CREATE TRIGGER set_shoot_days_updated_at
  BEFORE UPDATE ON shoot_days
  FOR EACH ROW EXECUTE FUNCTION update_shoot_days_updated_at();

-- RLS
ALTER TABLE shoot_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoot_day_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoot_day_cast ENABLE ROW LEVEL SECURITY;

-- shoot_days: project members can read; owner/admin/editor can write
CREATE POLICY "shoot_days_select" ON shoot_days FOR SELECT
  USING (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = shoot_days.project_id AND pm.user_id = auth.uid()));
CREATE POLICY "shoot_days_insert" ON shoot_days FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = shoot_days.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner','admin','editor')));
CREATE POLICY "shoot_days_update" ON shoot_days FOR UPDATE
  USING (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = shoot_days.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner','admin','editor')));
CREATE POLICY "shoot_days_delete" ON shoot_days FOR DELETE
  USING (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = shoot_days.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner','admin')));

CREATE POLICY "shoot_day_scenes_select" ON shoot_day_scenes FOR SELECT
  USING (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = shoot_day_scenes.project_id AND pm.user_id = auth.uid()));
CREATE POLICY "shoot_day_scenes_write" ON shoot_day_scenes FOR ALL
  USING (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = shoot_day_scenes.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner','admin','editor')));

CREATE POLICY "shoot_day_cast_select" ON shoot_day_cast FOR SELECT
  USING (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = shoot_day_cast.project_id AND pm.user_id = auth.uid()));
CREATE POLICY "shoot_day_cast_write" ON shoot_day_cast FOR ALL
  USING (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = shoot_day_cast.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner','admin','editor')));

-- Done
