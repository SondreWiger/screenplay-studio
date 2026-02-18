-- ============================================================
-- SCREENPLAY STUDIO - Complete Supabase Database Schema
-- Film Production Management Platform
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUM TYPES
-- ============================================================

-- Cleanup enum types for rerunnable schema
DROP TYPE IF EXISTS public.comment_type CASCADE;
DROP TYPE IF EXISTS public.budget_category CASCADE;
DROP TYPE IF EXISTS public.shot_movement CASCADE;
DROP TYPE IF EXISTS public.shot_type CASCADE;
DROP TYPE IF EXISTS public.schedule_event_type CASCADE;
DROP TYPE IF EXISTS public.idea_category CASCADE;
DROP TYPE IF EXISTS public.idea_status CASCADE;
DROP TYPE IF EXISTS public.revision_color CASCADE;
DROP TYPE IF EXISTS public.scene_location_type CASCADE;
DROP TYPE IF EXISTS public.scene_time CASCADE;
DROP TYPE IF EXISTS public.script_element_type CASCADE;
DROP TYPE IF EXISTS public.project_status CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
  ) THEN
    CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'writer', 'editor', 'viewer');
  END IF;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.project_status AS ENUM ('development', 'pre_production', 'production', 'post_production', 'completed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.script_element_type AS ENUM (
    'scene_heading', 'action', 'character', 'dialogue', 'parenthetical',
    'transition', 'shot', 'note', 'page_break', 'title_page',
    'centered', 'lyrics', 'synopsis', 'section'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.scene_time AS ENUM ('DAY', 'NIGHT', 'DAWN', 'DUSK', 'MORNING', 'AFTERNOON', 'EVENING', 'CONTINUOUS', 'LATER', 'MOMENTS_LATER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.scene_location_type AS ENUM ('INT', 'EXT', 'INT_EXT', 'EXT_INT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.revision_color AS ENUM ('white', 'blue', 'pink', 'yellow', 'green', 'goldenrod', 'buff', 'salmon', 'cherry', 'tan');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.idea_status AS ENUM ('spark', 'developing', 'ready', 'used', 'discarded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.idea_category AS ENUM ('plot', 'character', 'dialogue', 'visual', 'sound', 'location', 'prop', 'costume', 'effect', 'theme', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.schedule_event_type AS ENUM ('shooting', 'rehearsal', 'location_scout', 'meeting', 'setup', 'wrap', 'travel', 'break', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.shot_type AS ENUM (
    'wide', 'full', 'medium_wide', 'medium', 'medium_close', 'close_up',
    'extreme_close', 'over_shoulder', 'two_shot', 'pov', 'aerial',
    'insert', 'cutaway', 'establishing', 'tracking', 'dolly',
    'crane', 'steadicam', 'handheld', 'static', 'dutch_angle'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.shot_movement AS ENUM (
    'static', 'pan_left', 'pan_right', 'tilt_up', 'tilt_down',
    'dolly_in', 'dolly_out', 'truck_left', 'truck_right',
    'crane_up', 'crane_down', 'zoom_in', 'zoom_out',
    'follow', 'orbit', 'whip_pan', 'rack_focus'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.budget_category AS ENUM (
    'above_the_line', 'below_the_line', 'production', 'post_production',
    'talent', 'locations', 'equipment', 'props_costumes', 'catering',
    'transportation', 'insurance', 'marketing', 'contingency', 'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.comment_type AS ENUM ('note', 'suggestion', 'issue', 'resolved');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

-- Cleanup for rerunnable schema (avoids "relation already exists" errors)
DROP TABLE IF EXISTS user_presence CASCADE;
DROP TABLE IF EXISTS revisions CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS budget_items CASCADE;
DROP TABLE IF EXISTS ideas CASCADE;
DROP TABLE IF EXISTS production_schedule CASCADE;
DROP TABLE IF EXISTS shots CASCADE;
DROP TABLE IF EXISTS scenes CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS characters CASCADE;
DROP TABLE IF EXISTS script_elements CASCADE;
DROP TABLE IF EXISTS scripts CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'writer',
  is_pro BOOLEAN DEFAULT false,
  pro_since TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  logline TEXT,
  synopsis TEXT,
  genre TEXT[] DEFAULT '{}',
  format TEXT DEFAULT 'feature', -- feature, short, series, pilot, webseries
  target_length_minutes INTEGER,
  status project_status DEFAULT 'development',
  poster_url TEXT,
  cover_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROJECT MEMBERS
-- ============================================================

CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role DEFAULT 'viewer',
  department TEXT,
  job_title TEXT,
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Project policies
CREATE POLICY "Project members can view projects"
  ON projects FOR SELECT USING (
    created_by = auth.uid() OR
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project owners and admins can update projects"
  ON projects FOR UPDATE USING (
    created_by = auth.uid() OR
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Project owners can delete projects"
  ON projects FOR DELETE USING (created_by = auth.uid());

-- Project members policies
CREATE POLICY "Project members can view other members"
  ON project_members FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Project owners and admins can manage members"
  ON project_members FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Project owners and admins can update members"
  ON project_members FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Project owners and admins can remove members"
  ON project_members FOR DELETE USING (
    user_id = auth.uid() OR
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- SCRIPTS (a project can have multiple script versions)
-- ============================================================

CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Script',
  version INTEGER DEFAULT 1,
  revision_color revision_color DEFAULT 'white',
  is_active BOOLEAN DEFAULT true,
  locked BOOLEAN DEFAULT false,
  locked_by UUID REFERENCES profiles(id),
  title_page_data JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Script access follows project access"
  ON scripts FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Writers can create scripts"
  ON scripts FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'writer')
    )
  );

CREATE POLICY "Writers can update scripts"
  ON scripts FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')
    )
  );

CREATE POLICY "Owners can delete scripts"
  ON scripts FOR DELETE USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- SCRIPT ELEMENTS (the actual screenplay content)
-- ============================================================

CREATE TABLE script_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  element_type script_element_type NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  scene_number TEXT,
  revision_color revision_color DEFAULT 'white',
  is_revised BOOLEAN DEFAULT false,
  is_omitted BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  last_edited_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_script_elements_script ON script_elements(script_id);
CREATE INDEX idx_script_elements_order ON script_elements(script_id, sort_order);
CREATE INDEX idx_script_elements_type ON script_elements(element_type);

ALTER TABLE script_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Script elements follow script access"
  ON script_elements FOR SELECT USING (
    script_id IN (
      SELECT s.id FROM scripts s
      JOIN projects p ON s.project_id = p.id
      WHERE p.created_by = auth.uid()
      UNION
      SELECT s.id FROM scripts s
      JOIN project_members pm ON s.project_id = pm.project_id
      WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Writers can insert elements"
  ON script_elements FOR INSERT WITH CHECK (
    script_id IN (
      SELECT s.id FROM scripts s
      JOIN projects p ON s.project_id = p.id
      WHERE p.created_by = auth.uid()
      UNION
      SELECT s.id FROM scripts s
      JOIN project_members pm ON s.project_id = pm.project_id
      WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin', 'writer', 'editor')
    )
  );

CREATE POLICY "Writers can update elements"
  ON script_elements FOR UPDATE USING (
    script_id IN (
      SELECT s.id FROM scripts s
      JOIN projects p ON s.project_id = p.id
      WHERE p.created_by = auth.uid()
      UNION
      SELECT s.id FROM scripts s
      JOIN project_members pm ON s.project_id = pm.project_id
      WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin', 'writer', 'editor')
    )
  );

CREATE POLICY "Writers can delete elements"
  ON script_elements FOR DELETE USING (
    script_id IN (
      SELECT s.id FROM scripts s
      JOIN projects p ON s.project_id = p.id
      WHERE p.created_by = auth.uid()
      UNION
      SELECT s.id FROM scripts s
      JOIN project_members pm ON s.project_id = pm.project_id
      WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin', 'writer', 'editor')
    )
  );

-- ============================================================
-- CHARACTERS
-- ============================================================

CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  full_name TEXT,
  age TEXT,
  gender TEXT,
  description TEXT,
  backstory TEXT,
  motivation TEXT,
  arc TEXT,
  relationships JSONB DEFAULT '[]',
  appearance TEXT,
  personality_traits TEXT[] DEFAULT '{}',
  quirks TEXT,
  voice_notes TEXT,
  avatar_url TEXT,
  color TEXT DEFAULT '#6366f1',
  is_main BOOLEAN DEFAULT false,
  first_appearance TEXT,
  cast_actor TEXT,
  cast_notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Characters follow project access"
  ON characters FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- LOCATIONS
-- ============================================================

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  gps_coordinates POINT,
  location_type scene_location_type DEFAULT 'INT',
  photos TEXT[] DEFAULT '{}',
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  availability_notes TEXT,
  permits_required BOOLEAN DEFAULT false,
  permit_notes TEXT,
  parking_info TEXT,
  power_available BOOLEAN DEFAULT true,
  sound_notes TEXT,
  lighting_notes TEXT,
  cost_per_day DECIMAL(10,2),
  is_confirmed BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locations follow project access"
  ON locations FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- SCENES (Scene Breakdown)
-- ============================================================

CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  script_id UUID REFERENCES scripts(id) ON DELETE SET NULL,
  script_element_id UUID REFERENCES script_elements(id) ON DELETE SET NULL,
  scene_number TEXT,
  scene_heading TEXT,
  location_type scene_location_type DEFAULT 'INT',
  location_name TEXT,
  time_of_day scene_time DEFAULT 'DAY',
  synopsis TEXT,
  page_count DECIMAL(5,1) DEFAULT 0,
  estimated_duration_minutes INTEGER,
  shooting_duration_minutes INTEGER,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  cast_ids UUID[] DEFAULT '{}',
  extras_count INTEGER DEFAULT 0,
  props TEXT[] DEFAULT '{}',
  costumes TEXT[] DEFAULT '{}',
  makeup_notes TEXT,
  special_effects TEXT[] DEFAULT '{}',
  stunts TEXT,
  vehicles TEXT[] DEFAULT '{}',
  animals TEXT[] DEFAULT '{}',
  sound_notes TEXT,
  music_cues TEXT[] DEFAULT '{}',
  vfx_notes TEXT,
  mood TEXT,
  weather_required TEXT,
  special_equipment TEXT[] DEFAULT '{}',
  notes TEXT,
  is_completed BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scenes follow project access"
  ON scenes FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- SHOT LIST
-- ============================================================

CREATE TABLE shots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
  shot_number TEXT,
  shot_type shot_type DEFAULT 'medium',
  shot_movement shot_movement DEFAULT 'static',
  lens TEXT,
  description TEXT,
  dialogue_ref TEXT,
  duration_seconds INTEGER,
  camera_notes TEXT,
  lighting_notes TEXT,
  sound_notes TEXT,
  vfx_required BOOLEAN DEFAULT false,
  vfx_notes TEXT,
  storyboard_url TEXT,
  reference_urls TEXT[] DEFAULT '{}',
  is_completed BOOLEAN DEFAULT false,
  takes_needed INTEGER DEFAULT 1,
  takes_completed INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shots follow project access"
  ON shots FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- PRODUCTION SCHEDULE
-- ============================================================

CREATE TABLE production_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type schedule_event_type DEFAULT 'shooting',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,
  scene_ids UUID[] DEFAULT '{}',
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  assigned_to UUID[] DEFAULT '{}',
  call_time TIMESTAMPTZ,
  wrap_time TIMESTAMPTZ,
  notes TEXT,
  color TEXT DEFAULT '#6366f1',
  is_confirmed BOOLEAN DEFAULT false,
  weather_backup_plan TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE production_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedule follows project access"
  ON production_schedule FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- IDEAS BOARD
-- ============================================================

CREATE TABLE ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category idea_category DEFAULT 'other',
  status idea_status DEFAULT 'spark',
  priority INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  references_urls TEXT[] DEFAULT '{}',
  attachments TEXT[] DEFAULT '{}',
  color TEXT DEFAULT '#6366f1',
  column_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ideas follow project access"
  ON ideas FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- BUDGET
-- ============================================================

,.

ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Budget follows project access"
  ON budget_items FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- COMMENTS (on any entity)
-- ============================================================

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'script_element', 'scene', 'shot', 'character', etc.
  entity_id UUID NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  comment_type comment_type DEFAULT 'note',
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES profiles(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments follow project access"
  ON comments FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- REVISION HISTORY
-- ============================================================

CREATE TABLE revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  revision_color revision_color DEFAULT 'white',
  notes TEXT,
  snapshot JSONB, -- full snapshot of script elements at this revision
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Revisions follow script access"
  ON revisions FOR ALL USING (
    script_id IN (
      SELECT s.id FROM scripts s
      JOIN projects p ON s.project_id = p.id
      WHERE p.created_by = auth.uid()
      UNION
      SELECT s.id FROM scripts s
      JOIN project_members pm ON s.project_id = pm.project_id
      WHERE pm.user_id = auth.uid()
    )
  );

-- ============================================================
-- PRESENCE (for real-time collaboration tracking)
-- ============================================================

CREATE TABLE user_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  current_page TEXT,
  current_element_id UUID,
  cursor_position INTEGER,
  is_online BOOLEAN DEFAULT true,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Presence follows project access"
  ON user_presence FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON scripts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_script_elements_updated_at BEFORE UPDATE ON script_elements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scenes_updated_at BEFORE UPDATE ON scenes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shots_updated_at BEFORE UPDATE ON shots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_schedule_updated_at BEFORE UPDATE ON production_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ideas_updated_at BEFORE UPDATE ON ideas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budget_items_updated_at BEFORE UPDATE ON budget_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-add project creator as owner member
CREATE OR REPLACE FUNCTION handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION handle_new_project();

-- Auto-create initial script when project is created
CREATE OR REPLACE FUNCTION handle_new_project_script()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.scripts (project_id, title, created_by)
  VALUES (NEW.id, NEW.title || ' - Draft 1', NEW.created_by);
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_project_created_script
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION handle_new_project_script();

-- ============================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE script_elements;
ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE ideas;
ALTER PUBLICATION supabase_realtime ADD TABLE scenes;
ALTER PUBLICATION supabase_realtime ADD TABLE shots;
ALTER PUBLICATION supabase_realtime ADD TABLE production_schedule;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_scripts_project ON scripts(project_id);
CREATE INDEX idx_characters_project ON characters(project_id);
CREATE INDEX idx_locations_project ON locations(project_id);
CREATE INDEX idx_scenes_project ON scenes(project_id);
CREATE INDEX idx_shots_scene ON shots(scene_id);
CREATE INDEX idx_shots_project ON shots(project_id);
CREATE INDEX idx_schedule_project ON production_schedule(project_id);
CREATE INDEX idx_schedule_dates ON production_schedule(start_time, end_time);
CREATE INDEX idx_ideas_project ON ideas(project_id);
CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_budget_project ON budget_items(project_id);
CREATE INDEX idx_budget_category ON budget_items(category);
CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX idx_comments_project ON comments(project_id);
CREATE INDEX idx_revisions_script ON revisions(script_id);
CREATE INDEX idx_presence_project ON user_presence(project_id);

-- Full text search on script content
CREATE INDEX idx_script_elements_content_search ON script_elements USING gin(to_tsvector('english', content));
CREATE INDEX idx_characters_name_search ON characters USING gin(name gin_trgm_ops);
