-- Migration: Shoot gear / equipment tracking
-- Run in Supabase SQL editor

DROP TYPE IF EXISTS gear_ownership CASCADE;
DROP TYPE IF EXISTS gear_status CASCADE;

CREATE TYPE gear_ownership AS ENUM ('owned','rented','provided','tbc');
CREATE TYPE gear_status AS ENUM ('confirmed','pending','cancelled');

CREATE TABLE IF NOT EXISTS shoot_gear (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                text NOT NULL,
  category            text NOT NULL DEFAULT 'Other'
                      CHECK (category IN ('Camera','Lenses','Lighting','Grip','Sound','Art Dept','Costume','Hair & Makeup','Locations','Transport','Post / DIT','Other')),
  quantity            integer NOT NULL DEFAULT 1,
  unit                text NOT NULL DEFAULT 'unit',         -- 'unit','set','kit','day','week'
  ownership           gear_ownership NOT NULL DEFAULT 'tbc',
  vendor              text,
  daily_rate          numeric(10,2),                        -- per-day cost (rented items)
  total_cost          numeric(10,2),                        -- override / flat cost
  shoot_day_id        uuid REFERENCES shoot_days(id) ON DELETE SET NULL,  -- null = whole project
  notes               text,
  status              gear_status NOT NULL DEFAULT 'pending',
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shoot_gear_project_id_idx   ON shoot_gear(project_id);
CREATE INDEX IF NOT EXISTS shoot_gear_shoot_day_id_idx ON shoot_gear(shoot_day_id);
CREATE INDEX IF NOT EXISTS shoot_gear_category_idx     ON shoot_gear(category);

CREATE OR REPLACE FUNCTION update_shoot_gear_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_shoot_gear_updated_at ON shoot_gear;
CREATE TRIGGER set_shoot_gear_updated_at
  BEFORE UPDATE ON shoot_gear
  FOR EACH ROW EXECUTE FUNCTION update_shoot_gear_updated_at();

-- RLS
ALTER TABLE shoot_gear ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shoot_gear_select" ON shoot_gear FOR SELECT
  USING (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = shoot_gear.project_id AND pm.user_id = auth.uid()));
CREATE POLICY "shoot_gear_insert" ON shoot_gear FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = shoot_gear.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner','admin','editor')));
CREATE POLICY "shoot_gear_update" ON shoot_gear FOR UPDATE
  USING (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = shoot_gear.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner','admin','editor')));
CREATE POLICY "shoot_gear_delete" ON shoot_gear FOR DELETE
  USING (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = shoot_gear.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner','admin')));

-- Done
