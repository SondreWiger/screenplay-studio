-- =====================================================================
-- SCREENPLAY STUDIO - 000 COMPLETE SETUP
-- Generated from supabase/*.sql so a single runnable setup file exists.
-- =====================================================================

-- Base schemas
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
    'centered', 'lyrics', 'synopsis', 'section',
    'comic_page', 'comic_panel', 'comic_panel_description',
    'comic_dialogue', 'comic_sfx', 'comic_caption'
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

\n-- Additional schemas
-- ============================================================
-- COMMUNITY SCHEMA — Screenplay Studio Community Hub
-- ============================================================
-- Covers: script sharing, feedback, distros, challenges, voting,
--         free-use library, and productions.
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE community_post_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE challenge_type AS ENUM ('weekly', 'custom');
CREATE TYPE challenge_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE production_status AS ENUM ('pending', 'approved', 'rejected');

-- ============================================================
-- CATEGORIES
-- ============================================================

CREATE TABLE community_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,          -- emoji
  color TEXT,         -- hex color for tag/badge
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are public" ON community_categories FOR SELECT USING (true);
CREATE POLICY "Admin manages categories" ON community_categories FOR ALL USING (
  auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
);

-- Seed default categories
INSERT INTO community_categories (name, slug, description, icon, color, display_order) VALUES
  ('Feature Film',  'feature-film',  'Full-length feature screenplays',          '🎬', '#ef4444', 1),
  ('Short Film',    'short-film',    'Short film scripts under 40 pages',        '🎞️', '#f97316', 2),
  ('TV / Series',   'tv-series',     'TV pilots, episodes, and series bibles',   '📺', '#8b5cf6', 3),
  ('Web Series',    'web-series',    'Web and digital-first series',             '🌐', '#06b6d4', 4),
  ('Documentary',   'documentary',   'Documentary scripts and treatments',       '📹', '#22c55e', 5),
  ('Animation',     'animation',     'Animated film and series scripts',         '🎨', '#ec4899', 6),
  ('Horror',        'horror',        'Horror screenplays and thrillers',         '👻', '#1e293b', 7),
  ('Comedy',        'comedy',        'Comedies, sitcoms, and sketches',          '😄', '#eab308', 8),
  ('Drama',         'drama',         'Dramatic works and character studies',      '🎭', '#3b82f6', 9),
  ('Sci-Fi',        'sci-fi',        'Science fiction and speculative scripts',  '🚀', '#6366f1', 10)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- COMMUNITY POSTS (shared scripts)
-- ============================================================

CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  script_content TEXT,            -- text snapshot of the script
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  cover_image_url TEXT,

  -- Permission flags (configured by the author)
  allow_comments BOOLEAN DEFAULT true,
  allow_suggestions BOOLEAN DEFAULT true,
  allow_edits BOOLEAN DEFAULT false,
  allow_distros BOOLEAN DEFAULT false,
  allow_free_use BOOLEAN DEFAULT false,
  copyright_disclaimer_accepted BOOLEAN DEFAULT false,

  -- Counters (denormalized for perf)
  status community_post_status DEFAULT 'published',
  view_count INTEGER DEFAULT 0,
  upvote_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  distro_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published posts are public" ON community_posts
  FOR SELECT USING (status = 'published');
CREATE POLICY "Authors manage own posts" ON community_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors update own posts" ON community_posts
  FOR UPDATE USING (auth.uid() = author_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);
CREATE POLICY "Authors delete own posts" ON community_posts
  FOR DELETE USING (auth.uid() = author_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

CREATE INDEX idx_community_posts_slug ON community_posts(slug);
CREATE INDEX idx_community_posts_status ON community_posts(status, created_at DESC);
CREATE INDEX idx_community_posts_author ON community_posts(author_id);
CREATE INDEX idx_community_posts_free_use ON community_posts(allow_free_use) WHERE allow_free_use = true AND status = 'published';

-- ============================================================
-- POST ↔ CATEGORY junction
-- ============================================================

CREATE TABLE community_post_categories (
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES community_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);

ALTER TABLE community_post_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Junction is public" ON community_post_categories FOR SELECT USING (true);
CREATE POLICY "Authors manage junctions" ON community_post_categories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM community_posts WHERE id = post_id AND author_id = auth.uid())
  );
CREATE POLICY "Authors delete junctions" ON community_post_categories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM community_posts WHERE id = post_id AND author_id = auth.uid())
    OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
  );

-- ============================================================
-- COMMENTS & SUGGESTIONS
-- ============================================================

CREATE TABLE community_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  comment_type TEXT DEFAULT 'comment' CHECK (comment_type IN ('comment', 'suggestion')),
  is_pinned BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible comments are public" ON community_comments
  FOR SELECT USING (is_hidden = false OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);
CREATE POLICY "Logged in users can comment" ON community_comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authors update own comments" ON community_comments
  FOR UPDATE USING (auth.uid() = author_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);
CREATE POLICY "Authors delete own comments" ON community_comments
  FOR DELETE USING (auth.uid() = author_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

CREATE INDEX idx_community_comments_post ON community_comments(post_id, created_at);
CREATE INDEX idx_community_comments_parent ON community_comments(parent_id);

-- ============================================================
-- UPVOTES
-- ============================================================

CREATE TABLE community_upvotes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE community_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Upvotes are public" ON community_upvotes FOR SELECT USING (true);
CREATE POLICY "Users manage own upvotes" ON community_upvotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own upvotes" ON community_upvotes
  FOR DELETE USING (auth.uid() = user_id);

-- Toggle upvote RPC function
CREATE OR REPLACE FUNCTION toggle_community_upvote(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE did_upvote BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM community_upvotes WHERE user_id = auth.uid() AND post_id = p_post_id) THEN
    DELETE FROM community_upvotes WHERE user_id = auth.uid() AND post_id = p_post_id;
    UPDATE community_posts SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = p_post_id;
    did_upvote := false;
  ELSE
    INSERT INTO community_upvotes (user_id, post_id) VALUES (auth.uid(), p_post_id);
    UPDATE community_posts SET upvote_count = upvote_count + 1 WHERE id = p_post_id;
    did_upvote := true;
  END IF;
  RETURN did_upvote;
END; $$;

-- ============================================================
-- DISTROS (forks of scripts)
-- ============================================================

CREATE TABLE community_distros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  script_content TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_distros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Distros are public" ON community_distros FOR SELECT USING (true);
CREATE POLICY "Users create distros" ON community_distros
  FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors manage own distros" ON community_distros
  FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors delete own distros" ON community_distros
  FOR DELETE USING (auth.uid() = author_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

CREATE INDEX idx_distros_original ON community_distros(original_post_id);
CREATE INDEX idx_distros_author ON community_distros(author_id);

-- ============================================================
-- CHALLENGE THEMES (pool for weekly random selection)
-- ============================================================

CREATE TABLE challenge_themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  genre_hint TEXT,
  constraints TEXT,
  difficulty challenge_difficulty DEFAULT 'intermediate',
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE challenge_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Themes are public" ON challenge_themes FOR SELECT USING (true);
CREATE POLICY "Admin manages themes" ON challenge_themes FOR ALL USING (
  auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
);

-- Seed diverse challenge themes
INSERT INTO challenge_themes (title, description, genre_hint, constraints, difficulty) VALUES
  ('The Last Day',        'Write about someone''s final day doing something they love.',                       'Drama',    'Max 10 pages',                        'beginner'),
  ('Wrong Number',        'A story that begins with a phone call to the wrong person.',                        'Thriller', NULL,                                  'beginner'),
  ('The Room',            'Set your entire script in a single room. Who''s inside and why?',                   'Drama',    'One location only',                   'intermediate'),
  ('Silent Protagonist',  'Your main character cannot speak a single word of dialogue.',                       NULL,       'No dialogue for the protagonist',     'advanced'),
  ('24 Hours',            'The entire story takes place within exactly 24 hours.',                              'Thriller', 'Real-time or near-real-time',         'intermediate'),
  ('Strangers on a Train','Two strangers meet on public transit. Their conversation changes everything.',       'Drama',    NULL,                                  'beginner'),
  ('The Letter',          'A letter is discovered that changes the course of someone''s life.',                 NULL,       'The letter must be read aloud',       'beginner'),
  ('Midnight',            'Something crucial happens at the stroke of midnight.',                               'Horror',   NULL,                                  'intermediate'),
  ('The Job Interview',   'A job interview that goes terribly, hilariously, or dangerously wrong.',             'Comedy',   NULL,                                  'beginner'),
  ('Found Footage',       'Write a script in found-footage / mockumentary style.',                             'Horror',   'Use camera-aware narration',          'advanced'),
  ('Time Loop',           'A character is stuck reliving the same day. How do they escape?',                    'Sci-Fi',   NULL,                                  'intermediate'),
  ('The Heist',           'Plan and execute a heist, but nothing goes as planned.',                             'Action',   'At least 3 characters',               'intermediate'),
  ('First Contact',       'Humanity''s first encounter with something truly unknown.',                          'Sci-Fi',   NULL,                                  'intermediate'),
  ('The Dinner Party',    'Tensions rise at a seemingly normal dinner gathering.',                              'Drama',    'Max 6 characters',                    'beginner'),
  ('Unreliable Narrator', 'Tell a story where the narrator can''t be trusted.',                                'Thriller', 'Include a reveal moment',             'advanced'),
  ('Two Timelines',       'Tell one story across two different time periods.',                                  NULL,       'Must intercut between eras',          'advanced'),
  ('The Chase',           'Write a 10-page chase sequence. Pure momentum.',                                    'Action',   'Exactly 10 pages',                    'intermediate'),
  ('Bottle Episode',      'Limited cast, limited location, maximum drama.',                                    'Drama',    'Max 4 characters, 1 location',        'intermediate'),
  ('Backwards',           'Tell the story in reverse chronological order.',                                    NULL,       'Each scene is earlier than the last',  'advanced'),
  ('The Audition',        'An audition reveals far more than anyone expected.',                                 'Comedy',   NULL,                                  'beginner')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CHALLENGES
-- ============================================================

CREATE TABLE community_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  theme_id UUID REFERENCES challenge_themes(id) ON DELETE SET NULL,
  challenge_type challenge_type DEFAULT 'weekly',

  -- Timing
  starts_at TIMESTAMPTZ NOT NULL,
  submissions_close_at TIMESTAMPTZ NOT NULL,
  voting_close_at TIMESTAMPTZ NOT NULL,
  reveal_at TIMESTAMPTZ NOT NULL,

  -- Prize
  prize_title TEXT,
  prize_description TEXT,
  prize_data JSONB DEFAULT '{}'::jsonb,

  -- Admin
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Weekly tracking
  week_number INTEGER,
  year INTEGER,

  -- Counters
  submission_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenges are public" ON community_challenges FOR SELECT USING (true);
CREATE POLICY "Admin manages challenges" ON community_challenges FOR ALL USING (
  auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
);

CREATE INDEX idx_challenges_type ON community_challenges(challenge_type, starts_at DESC);
CREATE INDEX idx_challenges_week ON community_challenges(week_number, year) WHERE challenge_type = 'weekly';

-- ============================================================
-- CHALLENGE SUBMISSIONS
-- ============================================================

CREATE TABLE challenge_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID NOT NULL REFERENCES community_challenges(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  script_content TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  vote_count INTEGER DEFAULT 0,
  placement INTEGER,
  prize_awarded BOOLEAN DEFAULT false,

  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (challenge_id, author_id)
);

ALTER TABLE challenge_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submissions visible after close" ON challenge_submissions
  FOR SELECT USING (true);   -- visible for voting and results
CREATE POLICY "Users submit to challenges" ON challenge_submissions
  FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors manage submissions" ON challenge_submissions
  FOR UPDATE USING (auth.uid() = author_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);
CREATE POLICY "Authors delete submissions" ON challenge_submissions
  FOR DELETE USING (auth.uid() = author_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

CREATE INDEX idx_submissions_challenge ON challenge_submissions(challenge_id, vote_count DESC);

-- ============================================================
-- CHALLENGE VOTES (one vote per user per challenge)
-- ============================================================

CREATE TABLE challenge_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID NOT NULL REFERENCES community_challenges(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, challenge_id)   -- enforce one vote per challenge
);

ALTER TABLE challenge_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes are public" ON challenge_votes FOR SELECT USING (true);
CREATE POLICY "Users cast votes" ON challenge_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own votes" ON challenge_votes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- SCRIPT PRODUCTIONS (movies made from free-use scripts)
-- ============================================================

CREATE TABLE script_productions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  submitter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  thumbnail_url TEXT,
  status production_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE script_productions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved productions are public" ON script_productions
  FOR SELECT USING (status = 'approved' OR auth.uid() = submitter_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);
CREATE POLICY "Users submit productions" ON script_productions
  FOR INSERT WITH CHECK (auth.uid() = submitter_id);
CREATE POLICY "Manage productions" ON script_productions
  FOR UPDATE USING (auth.uid() = submitter_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);
CREATE POLICY "Delete productions" ON script_productions
  FOR DELETE USING (auth.uid() = submitter_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

CREATE INDEX idx_productions_post ON script_productions(post_id) WHERE status = 'approved';

-- ============================================================
-- AUTO-GENERATE WEEKLY CHALLENGE (called via pg_cron or RPC)
-- ============================================================

CREATE OR REPLACE FUNCTION ensure_weekly_challenge()
RETURNS SETOF community_challenges
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_wk INTEGER;
  current_yr INTEGER;
  week_start TIMESTAMPTZ;
  selected_theme challenge_themes%ROWTYPE;
  new_challenge community_challenges%ROWTYPE;
BEGIN
  current_wk := EXTRACT(WEEK FROM CURRENT_TIMESTAMP);
  current_yr := EXTRACT(YEAR FROM CURRENT_TIMESTAMP);

  -- Return existing challenge if present
  IF EXISTS (
    SELECT 1 FROM community_challenges
    WHERE week_number = current_wk AND year = current_yr AND challenge_type = 'weekly'
  ) THEN
    RETURN QUERY
      SELECT * FROM community_challenges
      WHERE week_number = current_wk AND year = current_yr AND challenge_type = 'weekly'
      LIMIT 1;
    RETURN;
  END IF;

  -- Pick a theme (prefer least-used, then random)
  SELECT * INTO selected_theme FROM challenge_themes
  WHERE is_active = true
  ORDER BY used_count ASC, random()
  LIMIT 1;

  IF selected_theme IS NULL THEN
    RETURN;
  END IF;

  -- Monday 00:00 UTC of the current ISO week
  week_start := date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'UTC');

  INSERT INTO community_challenges (
    title, description, theme_id, challenge_type,
    starts_at, submissions_close_at, voting_close_at, reveal_at,
    prize_title, prize_description,
    week_number, year
  ) VALUES (
    'Weekly Challenge: ' || selected_theme.title,
    selected_theme.description
      || CASE WHEN selected_theme.constraints IS NOT NULL
              THEN E'\n\nConstraint: ' || selected_theme.constraints
              ELSE '' END
      || CASE WHEN selected_theme.genre_hint IS NOT NULL
              THEN E'\nSuggested genre: ' || selected_theme.genre_hint
              ELSE '' END,
    selected_theme.id,
    'weekly',
    week_start,                                              -- Mon 00:00
    week_start + INTERVAL '4 days 21 hours',                 -- Fri 21:00
    week_start + INTERVAL '5 days 23 hours 59 minutes',      -- Sat 23:59
    week_start + INTERVAL '6 days 12 hours',                 -- Sun 12:00
    'Weekly Winner',
    'Winner of the weekly writing challenge. Prizes configurable by admin.',
    current_wk,
    current_yr
  ) RETURNING * INTO new_challenge;

  UPDATE challenge_themes SET used_count = used_count + 1 WHERE id = selected_theme.id;

  RETURN QUERY SELECT new_challenge.*;
END; $$;

-- ============================================================
-- COMPUTE CHALLENGE RESULTS (called after voting closes)
-- ============================================================

CREATE OR REPLACE FUNCTION compute_challenge_results(p_challenge_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Recount votes
  UPDATE challenge_submissions cs
  SET vote_count = (
    SELECT COUNT(*) FROM challenge_votes cv WHERE cv.submission_id = cs.id
  )
  WHERE cs.challenge_id = p_challenge_id;

  -- Assign placements (ties broken by earlier submission)
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY vote_count DESC, submitted_at ASC) AS rank
    FROM challenge_submissions
    WHERE challenge_id = p_challenge_id
  )
  UPDATE challenge_submissions cs
  SET placement = ranked.rank
  FROM ranked
  WHERE cs.id = ranked.id;
END; $$;

-- ============================================================
-- TRIGGERS — auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_community_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();

CREATE TRIGGER community_comments_updated_at
  BEFORE UPDATE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();

CREATE TRIGGER community_distros_updated_at
  BEFORE UPDATE ON community_distros
  FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();

CREATE TRIGGER community_challenges_updated_at
  BEFORE UPDATE ON community_challenges
  FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();

CREATE TRIGGER script_productions_updated_at
  BEFORE UPDATE ON script_productions
  FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();

-- ============================================================
-- TRIGGER — auto-update comment_count on community_posts
-- ============================================================

CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER community_comments_count
  AFTER INSERT OR DELETE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();

-- ============================================================
-- TRIGGER — auto-update submission_count on challenges
-- ============================================================

CREATE OR REPLACE FUNCTION update_challenge_submission_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_challenges SET submission_count = submission_count + 1 WHERE id = NEW.challenge_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_challenges SET submission_count = GREATEST(submission_count - 1, 0) WHERE id = OLD.challenge_id;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER challenge_submissions_count
  AFTER INSERT OR DELETE ON challenge_submissions
  FOR EACH ROW EXECUTE FUNCTION update_challenge_submission_count();

-- ============================================================
-- TRIGGER — auto-update distro_count on community_posts
-- ============================================================

CREATE OR REPLACE FUNCTION update_post_distro_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET distro_count = distro_count + 1 WHERE id = NEW.original_post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET distro_count = GREATEST(distro_count - 1, 0) WHERE id = OLD.original_post_id;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER community_distros_count
  AFTER INSERT OR DELETE ON community_distros
  FOR EACH ROW EXECUTE FUNCTION update_post_distro_count();

-- ============================================================
-- BLOG SCHEMA — Screenplay Studio Dev Blog
-- ============================================================

-- Blog post status
CREATE TYPE blog_post_status AS ENUM ('draft', 'published', 'archived');

-- ============================================================
-- BLOG POSTS
-- ============================================================

CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  cover_image_url TEXT,
  -- sections stored as JSONB array: [{ heading, body, order }]
  sections JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}',
  status blog_post_status DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  allow_comments BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts
CREATE POLICY "Published blog posts are public"
  ON blog_posts FOR SELECT USING (status = 'published' OR auth.uid() IS NOT NULL);

-- Only admin can insert/update/delete
CREATE POLICY "Admin can manage blog posts"
  ON blog_posts FOR ALL USING (
    auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
  );

-- Index for slug lookups and listing
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status, published_at DESC);

-- ============================================================
-- BLOG COMMENTS
-- ============================================================

CREATE TABLE blog_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name TEXT, -- for non-logged-in users
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read visible comments
CREATE POLICY "Blog comments are public"
  ON blog_comments FOR SELECT USING (is_hidden = false OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

-- Logged-in users can insert comments
CREATE POLICY "Logged in users can comment"
  ON blog_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON blog_comments FOR UPDATE USING (auth.uid() = author_id);

-- Admin can delete any comment
CREATE POLICY "Admin can delete comments"
  ON blog_comments FOR DELETE USING (
    auth.uid() = author_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
  );

CREATE INDEX idx_blog_comments_post ON blog_comments(post_id, created_at);
CREATE INDEX idx_blog_comments_parent ON blog_comments(parent_id);

-- ============================================================
-- Auto-update updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION update_blog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_blog_updated_at();

CREATE TRIGGER blog_comments_updated_at
  BEFORE UPDATE ON blog_comments
  FOR EACH ROW EXECUTE FUNCTION update_blog_updated_at();

-- ============================================================
-- SITE SETTINGS — key/value store for admin-managed settings
-- ============================================================

CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (version shown in footer)
CREATE POLICY "Site settings are public" ON site_settings FOR SELECT USING (true);

-- Only admin can modify settings
CREATE POLICY "Admin can manage settings" ON site_settings FOR ALL USING (
  auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
);

-- Seed default version
INSERT INTO site_settings (key, value) VALUES ('site_version', '0.1.0')
ON CONFLICT (key) DO NOTHING;

-- Open-source mode: set to 'false' to hide /contribute, strip open-source mentions
-- from metadata, embeds, and the about page. Defaults to 'true'.
INSERT INTO site_settings (key, value) VALUES ('opensource_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Project Channels & Channel Messages
-- Run this in the Supabase SQL Editor.

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS project_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS channel_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES project_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  file_url TEXT,
  file_name TEXT,
  reply_to_id UUID REFERENCES channel_messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECURITY DEFINER HELPERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_project_member_lite(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND created_by = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_project_admin_lite(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND created_by = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Channels
CREATE POLICY "Members can view channels" ON project_channels
  FOR SELECT USING (public.is_project_member_lite(project_id));

CREATE POLICY "Admins can create channels" ON project_channels
  FOR INSERT WITH CHECK (public.is_project_admin_lite(project_id));

CREATE POLICY "Admins can update channels" ON project_channels
  FOR UPDATE USING (public.is_project_admin_lite(project_id));

CREATE POLICY "Admins can delete channels" ON project_channels
  FOR DELETE USING (public.is_project_admin_lite(project_id));

-- Channel messages
CREATE POLICY "Members can view channel messages" ON channel_messages
  FOR SELECT USING (
    channel_id IN (
      SELECT id FROM project_channels WHERE public.is_project_member_lite(project_id)
    )
  );

CREATE POLICY "Members can send channel messages" ON channel_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    channel_id IN (
      SELECT id FROM project_channels WHERE public.is_project_member_lite(project_id)
    )
  );

CREATE POLICY "Senders can edit channel messages" ON channel_messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Senders can delete channel messages" ON channel_messages
  FOR DELETE USING (sender_id = auth.uid());

-- ============================================================
-- GRANTS & REALTIME
-- ============================================================

GRANT ALL ON project_channels TO authenticated, anon, service_role;
GRANT ALL ON channel_messages TO authenticated, anon, service_role;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE channel_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_channel_project ON project_channels(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_channel_msgs ON channel_messages(channel_id, created_at DESC);

-- ============================================================
-- Project Documents & Folders
-- Adds support for plain text documents alongside screenplay scripts,
-- organized in folders within a project.
-- ============================================================

-- Document Folders
CREATE TABLE IF NOT EXISTS project_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES project_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documents (plain text docs, notes, etc.)
CREATE TABLE IF NOT EXISTS project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES project_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  doc_type TEXT NOT NULL DEFAULT 'plain_text' CHECK (doc_type IN ('plain_text', 'notes', 'outline', 'treatment', 'research')),
  content TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_edited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_folders_project ON project_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_folders_parent ON project_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_project ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_folder ON project_documents(folder_id);

-- RLS policies
ALTER TABLE project_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

-- Folders: project members can read, editors+ can write
CREATE POLICY "folders_select" ON project_folders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_folders.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "folders_insert" ON project_folders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_folders.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'writer', 'editor')
    )
  );

CREATE POLICY "folders_update" ON project_folders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_folders.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'writer', 'editor')
    )
  );

CREATE POLICY "folders_delete" ON project_folders
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_folders.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Documents: same pattern
CREATE POLICY "docs_select" ON project_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_documents.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "docs_insert" ON project_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_documents.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'writer', 'editor')
    )
  );

CREATE POLICY "docs_update" ON project_documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_documents.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'writer', 'editor')
    )
  );

CREATE POLICY "docs_delete" ON project_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_documents.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_folders_updated_at ON project_folders;
CREATE TRIGGER update_project_folders_updated_at
  BEFORE UPDATE ON project_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_documents_updated_at ON project_documents;
CREATE TRIGGER update_project_documents_updated_at
  BEFORE UPDATE ON project_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-compute word count on update
CREATE OR REPLACE FUNCTION compute_document_word_count()
RETURNS TRIGGER AS $$
BEGIN
  NEW.word_count = array_length(regexp_split_to_array(trim(coalesce(NEW.content, '')), '\s+'), 1);
  IF NEW.content IS NULL OR trim(NEW.content) = '' THEN
    NEW.word_count = 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS compute_doc_word_count ON project_documents;
CREATE TRIGGER compute_doc_word_count
  BEFORE INSERT OR UPDATE OF content ON project_documents
  FOR EACH ROW EXECUTE FUNCTION compute_document_word_count();

-- ============================================================
-- Creator & Affiliate Program
-- ============================================================

-- Creator profiles (one per user)
CREATE TABLE IF NOT EXISTS creator_profiles (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ref_code          TEXT        NOT NULL,  -- = username at apply time, used in /ref/[ref_code]
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  -- Social links
  social_instagram  TEXT,
  social_twitter    TEXT,
  social_tiktok     TEXT,
  social_youtube    TEXT,
  -- Application
  application_note  TEXT,
  applied_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at       TIMESTAMPTZ,
  approved_by       UUID        REFERENCES profiles(id),
  rejected_reason   TEXT,
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (ref_code)
);

-- Referral events: visits to /ref/[code] and signups from those links
CREATE TABLE IF NOT EXISTS creator_referral_events (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id         UUID        NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  event_type         TEXT        NOT NULL CHECK (event_type IN ('visit', 'signup')),
  -- visit metadata
  referrer           TEXT,
  country            TEXT,
  -- signup link (NULL for visits)
  converted_user_id  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_ref_events_creator
  ON creator_referral_events(creator_id, created_at);

CREATE INDEX IF NOT EXISTS idx_creator_ref_events_month
  ON creator_referral_events(event_type, created_at);

-- Prevent double-counting: one signup event per converted user
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_ref_events_user_unique
  ON creator_referral_events(converted_user_id)
  WHERE event_type = 'signup' AND converted_user_id IS NOT NULL;

-- Payout batches (admin runs these on the 12th of each month)
CREATE TABLE IF NOT EXISTS creator_payout_batches (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start     DATE         NOT NULL,
  period_end       DATE         NOT NULL,
  total_amount     NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  status           TEXT         NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'paid')),
  notes            TEXT,
  created_by       UUID         REFERENCES profiles(id),
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Per-creator allocation within a batch
CREATE TABLE IF NOT EXISTS creator_payout_items (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id       UUID          NOT NULL REFERENCES creator_payout_batches(id) ON DELETE CASCADE,
  creator_id     UUID          NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  signups_count  INTEGER       NOT NULL DEFAULT 0,
  proportion     NUMERIC(7,6)  NOT NULL DEFAULT 0, -- 0.0–1.0
  amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (batch_id, creator_id)
);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_payout_items ENABLE ROW LEVEL SECURITY;

-- creator_profiles
DROP POLICY IF EXISTS "creator_profiles_owner_select" ON creator_profiles;
CREATE POLICY "creator_profiles_owner_select" ON creator_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "creator_profiles_owner_insert" ON creator_profiles;
CREATE POLICY "creator_profiles_owner_insert" ON creator_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "creator_profiles_owner_update" ON creator_profiles;
CREATE POLICY "creator_profiles_owner_update" ON creator_profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Users may not change their own status; admin does that
    AND (status = (SELECT status FROM creator_profiles WHERE user_id = auth.uid()))
  );

-- Public read for approved:
DROP POLICY IF EXISTS "creator_profiles_public_approved" ON creator_profiles;
CREATE POLICY "creator_profiles_public_approved" ON creator_profiles
  FOR SELECT USING (status = 'approved');

-- Admin full access
DROP POLICY IF EXISTS "creator_profiles_admin" ON creator_profiles;
CREATE POLICY "creator_profiles_admin" ON creator_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (id = 'f0e0c4a4-0833-4c64-b012-15829c087c77' OR role = 'admin'))
  );

-- creator_referral_events
DROP POLICY IF EXISTS "creator_ref_events_owner_select" ON creator_referral_events;
CREATE POLICY "creator_ref_events_owner_select" ON creator_referral_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.id = creator_id AND cp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "creator_ref_events_insert_anon" ON creator_referral_events;
CREATE POLICY "creator_ref_events_insert_anon" ON creator_referral_events
  FOR INSERT WITH CHECK (true); -- server-side route handles auth gating

DROP POLICY IF EXISTS "creator_ref_events_admin" ON creator_referral_events;
CREATE POLICY "creator_ref_events_admin" ON creator_referral_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (id = 'f0e0c4a4-0833-4c64-b012-15829c087c77' OR role = 'admin'))
  );

-- creator_payout_batches — admin only
DROP POLICY IF EXISTS "creator_payout_batches_admin" ON creator_payout_batches;
CREATE POLICY "creator_payout_batches_admin" ON creator_payout_batches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (id = 'f0e0c4a4-0833-4c64-b012-15829c087c77' OR role = 'admin'))
  );

-- creator_payout_items — admin + owner creator read
DROP POLICY IF EXISTS "creator_payout_items_admin" ON creator_payout_items;
CREATE POLICY "creator_payout_items_admin" ON creator_payout_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (id = 'f0e0c4a4-0833-4c64-b012-15829c087c77' OR role = 'admin'))
  );

DROP POLICY IF EXISTS "creator_payout_items_owner_select" ON creator_payout_items;
CREATE POLICY "creator_payout_items_owner_select" ON creator_payout_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM creator_profiles cp
      WHERE cp.id = creator_id AND cp.user_id = auth.uid()
    )
  );

-- ── site_settings toggles ─────────────────────────────────────
INSERT INTO site_settings (key, value)
VALUES ('creator_program_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value)
VALUES ('creator_payout_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ── Stored function: compute payout proportions ──────────────
CREATE OR REPLACE FUNCTION compute_creator_payout_items(
  p_batch_id   UUID,
  p_start_date DATE,
  p_end_date   DATE,
  p_total      NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  total_signups INTEGER;
BEGIN
  -- Clean existing items for this batch
  DELETE FROM creator_payout_items WHERE batch_id = p_batch_id;

  -- Count signups per creator in period
  SELECT COALESCE(SUM(signup_count), 0) INTO total_signups
  FROM (
    SELECT creator_id, COUNT(*) AS signup_count
    FROM creator_referral_events
    WHERE event_type = 'signup'
      AND created_at >= p_start_date::timestamptz
      AND created_at < (p_end_date + INTERVAL '1 day')::timestamptz
    GROUP BY creator_id
  ) sub;

  IF total_signups = 0 THEN RETURN; END IF;

  -- Insert proportional items
  INSERT INTO creator_payout_items (batch_id, creator_id, signups_count, proportion, amount)
  SELECT
    p_batch_id,
    creator_id,
    signup_count,
    signup_count::NUMERIC / total_signups,
    ROUND((signup_count::NUMERIC / total_signups) * p_total, 2)
  FROM (
    SELECT creator_id, COUNT(*) AS signup_count
    FROM creator_referral_events
    WHERE event_type = 'signup'
      AND created_at >= p_start_date::timestamptz
      AND created_at < (p_end_date + INTERVAL '1 day')::timestamptz
    GROUP BY creator_id
  ) sub;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION compute_creator_payout_items TO authenticated;

\n-- Migrations

-- ---------------------------------------------------------------------
-- Source: supabase/migration_accountability.sql
-- ---------------------------------------------------------------------
-- ─────────────────────────────────────────────────────────────────────────────
-- Accountability & Work Tracking
-- Adds: work_logs, accountability_buddies, accountability_groups,
--       accountability_group_members, accountability_feed
-- Extends profiles: activity_color, show_activity_grid, daily_goal_pages
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend profiles ───────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS activity_color       TEXT             DEFAULT '#22c55e',
  ADD COLUMN IF NOT EXISTS show_activity_grid   TEXT             DEFAULT 'buddies'
    CHECK (show_activity_grid IN ('private', 'buddies', 'public')),
  ADD COLUMN IF NOT EXISTS daily_goal_pages     NUMERIC(6,2)     DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS daily_goal_minutes   INTEGER          DEFAULT 0;

-- ── 2. work_logs — one aggregate row per user per date ───────────────────────
-- Multiple saves in one day upsert-increment the same row.

CREATE TABLE IF NOT EXISTS work_logs (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id       UUID          REFERENCES projects(id) ON DELETE SET NULL,
  log_date         DATE          NOT NULL DEFAULT CURRENT_DATE,
  pages_written    NUMERIC(6,2)  NOT NULL DEFAULT 0,
  scenes_created   INTEGER       NOT NULL DEFAULT 0,
  words_written    INTEGER       NOT NULL DEFAULT 0,
  session_minutes  INTEGER       NOT NULL DEFAULT 0,
  manual_note      TEXT,
  is_manual        BOOLEAN       NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_logs_user_date_project_idx
  ON work_logs (user_id, log_date, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::UUID));

CREATE INDEX IF NOT EXISTS work_logs_user_date_idx  ON work_logs (user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS work_logs_project_idx    ON work_logs (project_id);

-- Trigger: keep updated_at fresh
CREATE OR REPLACE FUNCTION update_work_log_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_logs_updated_at ON work_logs;
CREATE TRIGGER trg_work_logs_updated_at
  BEFORE UPDATE ON work_logs
  FOR EACH ROW EXECUTE FUNCTION update_work_log_updated_at();

-- RLS
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_logs_select_own"            ON work_logs;
DROP POLICY IF EXISTS "work_logs_select_buddy_public"   ON work_logs;
DROP POLICY IF EXISTS "work_logs_insert_own"            ON work_logs;
DROP POLICY IF EXISTS "work_logs_update_own"            ON work_logs;
DROP POLICY IF EXISTS "work_logs_delete_own"            ON work_logs;

-- Owner can see own logs
CREATE POLICY "work_logs_select_own" ON work_logs
  FOR SELECT USING (auth.uid() = user_id);

-- NOTE: work_logs_select_buddy_public is added after accountability_buddies is created (see below)

CREATE POLICY "work_logs_insert_own" ON work_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "work_logs_update_own" ON work_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "work_logs_delete_own" ON work_logs
  FOR DELETE USING (auth.uid() = user_id);

-- ── 3. accountability_buddies — 1-on-1 accountability pairs ─────────────────

CREATE TABLE IF NOT EXISTS accountability_buddies (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  message       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS ab_requester_idx  ON accountability_buddies (requester_id);
CREATE INDEX IF NOT EXISTS ab_addressee_idx  ON accountability_buddies (addressee_id);
CREATE INDEX IF NOT EXISTS ab_status_idx     ON accountability_buddies (status);

-- Now that accountability_buddies exists, add the cross-table work_logs policy
DROP POLICY IF EXISTS "work_logs_select_buddy_public" ON work_logs;
CREATE POLICY "work_logs_select_buddy_public" ON work_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = work_logs.user_id
        AND (
          p.show_activity_grid = 'public'
          OR (
            p.show_activity_grid = 'buddies'
            AND EXISTS (
              SELECT 1 FROM accountability_buddies ab
              WHERE ab.status = 'accepted'
                AND (
                  (ab.requester_id = auth.uid() AND ab.addressee_id = work_logs.user_id)
                  OR (ab.addressee_id = auth.uid() AND ab.requester_id = work_logs.user_id)
                )
            )
          )
        )
    )
  );

ALTER TABLE accountability_buddies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ab_select"  ON accountability_buddies;
DROP POLICY IF EXISTS "ab_insert"  ON accountability_buddies;
DROP POLICY IF EXISTS "ab_update"  ON accountability_buddies;
DROP POLICY IF EXISTS "ab_delete"  ON accountability_buddies;

CREATE POLICY "ab_select" ON accountability_buddies
  FOR SELECT USING (auth.uid() IN (requester_id, addressee_id));

CREATE POLICY "ab_insert" ON accountability_buddies
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Addressee can update status; requester can also update (e.g., cancel)
CREATE POLICY "ab_update" ON accountability_buddies
  FOR UPDATE USING (auth.uid() IN (requester_id, addressee_id));

CREATE POLICY "ab_delete" ON accountability_buddies
  FOR DELETE USING (auth.uid() IN (requester_id, addressee_id));

-- ── 4. accountability_groups ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accountability_groups (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT        NOT NULL,
  description  TEXT,
  created_by   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code  TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  is_public    BOOLEAN     NOT NULL DEFAULT false,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE accountability_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ag_select"  ON accountability_groups;
DROP POLICY IF EXISTS "ag_insert"  ON accountability_groups;
DROP POLICY IF EXISTS "ag_update"  ON accountability_groups;
DROP POLICY IF EXISTS "ag_delete"  ON accountability_groups;

-- NOTE: ag_select is added after accountability_group_members is created (see below)

CREATE POLICY "ag_insert" ON accountability_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- NOTE: ag_update is added after accountability_group_members is created (see below)

CREATE POLICY "ag_delete" ON accountability_groups
  FOR DELETE USING (auth.uid() = created_by);

-- ── 5. accountability_group_members ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accountability_group_members (
  group_id   UUID        NOT NULL REFERENCES accountability_groups(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS agm_user_idx ON accountability_group_members (user_id);

-- Now that accountability_group_members exists, add the cross-table accountability_groups policy
DROP POLICY IF EXISTS "ag_select" ON accountability_groups;
CREATE POLICY "ag_select" ON accountability_groups
  FOR SELECT USING (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM accountability_group_members agm
      WHERE agm.group_id = accountability_groups.id AND agm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ag_update" ON accountability_groups;
CREATE POLICY "ag_update" ON accountability_groups
  FOR UPDATE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM accountability_group_members agm
      WHERE agm.group_id = accountability_groups.id AND agm.user_id = auth.uid()
        AND agm.role IN ('owner', 'admin')
    )
  );

ALTER TABLE accountability_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agm_select"  ON accountability_group_members;
DROP POLICY IF EXISTS "agm_insert"  ON accountability_group_members;
DROP POLICY IF EXISTS "agm_delete"  ON accountability_group_members;

CREATE POLICY "agm_select" ON accountability_group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM accountability_group_members me
      WHERE me.group_id = accountability_group_members.group_id AND me.user_id = auth.uid()
    )
  );

CREATE POLICY "agm_insert" ON accountability_group_members
  FOR INSERT WITH CHECK (
    -- Self join via invite code handled by a function; admins/owners can add
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM accountability_group_members me
      WHERE me.group_id = accountability_group_members.group_id AND me.user_id = auth.uid()
        AND me.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "agm_delete" ON accountability_group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM accountability_group_members me
      WHERE me.group_id = accountability_group_members.group_id AND me.user_id = auth.uid()
        AND me.role IN ('owner', 'admin')
    )
  );

-- ── 6. accountability_feed — posts/nudges within buddy/group context ──────────

CREATE TABLE IF NOT EXISTS accountability_feed (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id     UUID        REFERENCES accountability_groups(id) ON DELETE CASCADE,
  buddy_pair   UUID        REFERENCES accountability_buddies(id) ON DELETE CASCADE,
  work_log_id  UUID        REFERENCES work_logs(id) ON DELETE SET NULL,
  content      TEXT        NOT NULL,
  post_type    TEXT        NOT NULL DEFAULT 'message'
    CHECK (post_type IN ('message', 'checkin', 'nudge', 'milestone')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS af_group_idx  ON accountability_feed (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS af_author_idx ON accountability_feed (author_id);

ALTER TABLE accountability_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "af_select"  ON accountability_feed;
DROP POLICY IF EXISTS "af_insert"  ON accountability_feed;
DROP POLICY IF EXISTS "af_delete"  ON accountability_feed;

-- Can read if in the same group
CREATE POLICY "af_select" ON accountability_feed
  FOR SELECT USING (
    author_id = auth.uid()
    OR (
      group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM accountability_group_members agm
        WHERE agm.group_id = accountability_feed.group_id AND agm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "af_insert" ON accountability_feed
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "af_delete" ON accountability_feed
  FOR DELETE USING (auth.uid() = author_id);

-- ── 7. Helper: join group by invite code ─────────────────────────────────────

CREATE OR REPLACE FUNCTION join_accountability_group(p_invite_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id
  FROM accountability_groups
  WHERE invite_code = p_invite_code;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO accountability_group_members (group_id, user_id, role)
  VALUES (v_group_id, auth.uid(), 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN v_group_id;
END;
$$;

-- ── 8. Helper: upsert work log (increment, not overwrite) ───────────────────

CREATE OR REPLACE FUNCTION upsert_work_log(
  p_project_id       UUID,
  p_pages_written    NUMERIC(6,2),
  p_scenes_created   INTEGER,
  p_words_written    INTEGER,
  p_session_minutes  INTEGER,
  p_manual_note      TEXT,
  p_is_manual        BOOLEAN
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
  v_null_project UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  INSERT INTO work_logs (
    user_id, project_id, log_date,
    pages_written, scenes_created, words_written, session_minutes,
    manual_note, is_manual
  ) VALUES (
    auth.uid(),
    p_project_id,
    CURRENT_DATE,
    p_pages_written, p_scenes_created, p_words_written, p_session_minutes,
    p_manual_note, p_is_manual
  )
  ON CONFLICT (user_id, log_date, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::UUID))
  DO UPDATE SET
    pages_written   = work_logs.pages_written   + EXCLUDED.pages_written,
    scenes_created  = work_logs.scenes_created  + EXCLUDED.scenes_created,
    words_written   = work_logs.words_written   + EXCLUDED.words_written,
    session_minutes = work_logs.session_minutes + EXCLUDED.session_minutes,
    manual_note     = COALESCE(EXCLUDED.manual_note, work_logs.manual_note),
    is_manual       = EXCLUDED.is_manual OR work_logs.is_manual,
    updated_at      = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 9. View for "days worked this year" leaderboard ──────────────────────────

CREATE OR REPLACE VIEW work_summary AS
SELECT
  wl.user_id,
  p.display_name,
  p.username,
  p.avatar_url,
  p.activity_color,
  p.daily_goal_pages,
  COUNT(DISTINCT wl.log_date)                          AS days_worked,
  COALESCE(SUM(wl.pages_written), 0)                  AS total_pages,
  COALESCE(SUM(wl.session_minutes), 0)                AS total_minutes,
  MAX(wl.log_date)                                     AS last_active_date
FROM work_logs wl
JOIN profiles p ON p.id = wl.user_id
GROUP BY wl.user_id, p.display_name, p.username, p.avatar_url,
         p.activity_color, p.daily_goal_pages;

-- Grant access for authenticated users
GRANT SELECT ON work_summary TO authenticated;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_accountability_opt_out.sql
-- ---------------------------------------------------------------------
-- Migration: add show_accountability column to profiles
-- Allows users to opt out of all accountability features

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_accountability BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN profiles.show_accountability IS
  'When false, accountability tab/page is hidden and inaccessible for this user.';

-- ---------------------------------------------------------------------
-- Source: supabase/migration_act_element.sql
-- ---------------------------------------------------------------------
-- Migration: Add 'act' element type to screenplay/stage play scripts
-- IMPORTANT: ALTER TYPE ADD VALUE cannot run inside a transaction block.
-- Run this file directly in your Supabase SQL editor (not inside BEGIN/COMMIT).

ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'act';

-- ---------------------------------------------------------------------
-- Source: supabase/migration_actors_payroll.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Actors / Actresses — Payroll & Documents
-- cast_members: actor profiles with pay rates
-- cast_payments: per-payment ledger
-- cast_documents: document vault per actor
-- ============================================================

-- Cast Members
CREATE TABLE IF NOT EXISTS cast_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id),

  -- Profile
  name            TEXT NOT NULL,
  character_roles TEXT[] DEFAULT '{}',
  email           TEXT,
  phone           TEXT,
  photo_url       TEXT,
  bio             TEXT,
  notes           TEXT,
  availability    TEXT,

  -- Pay rate
  pay_amount      DECIMAL(12,2),
  pay_unit        TEXT DEFAULT 'flat',   -- hourly | daily | weekly | monthly | flat | per_episode
  pay_currency    TEXT DEFAULT 'USD',

  -- Contract status
  contract_status TEXT DEFAULT 'negotiating',  -- negotiating | pending | signed | on_set | completed | released

  -- Custom metadata
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Cast Payments
CREATE TABLE IF NOT EXISTS cast_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cast_member_id  UUID NOT NULL REFERENCES cast_members(id) ON DELETE CASCADE,

  amount          DECIMAL(12,2) NOT NULL,
  currency        TEXT DEFAULT 'USD',
  description     TEXT,

  period_start    DATE,
  period_end      DATE,
  due_date        DATE,
  paid_at         TIMESTAMPTZ,

  status          TEXT DEFAULT 'unpaid',  -- unpaid | paid | overdue | cancelled
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Cast Documents
CREATE TABLE IF NOT EXISTS cast_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cast_member_id  UUID NOT NULL REFERENCES cast_members(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id),

  doc_type        TEXT DEFAULT 'other',  -- nda | contract | work_agreement | id_proof | insurance | work_permit | citizenship | negotiation | other
  title           TEXT NOT NULL,
  file_url        TEXT,
  file_name       TEXT,
  notes           TEXT,
  expires_at      DATE,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cast_members_project   ON cast_members(project_id);
CREATE INDEX IF NOT EXISTS idx_cast_payments_member   ON cast_payments(cast_member_id);
CREATE INDEX IF NOT EXISTS idx_cast_payments_project  ON cast_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_cast_documents_member  ON cast_documents(cast_member_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_cast_member_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS cast_members_updated_at ON cast_members;
CREATE TRIGGER cast_members_updated_at
  BEFORE UPDATE ON cast_members
  FOR EACH ROW EXECUTE FUNCTION update_cast_member_updated_at();

-- RLS
ALTER TABLE cast_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cast_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cast_documents ENABLE ROW LEVEL SECURITY;

-- cast_members policies
CREATE POLICY "Project members can read cast_members"  ON cast_members  FOR SELECT USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can insert cast_members" ON cast_members FOR INSERT WITH CHECK (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer')
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can update cast_members" ON cast_members FOR UPDATE USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer')
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can delete cast_members" ON cast_members FOR DELETE USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);

-- cast_payments policies (mirror cast_members)
CREATE POLICY "Project members can read cast_payments"   ON cast_payments  FOR SELECT USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can insert cast_payments" ON cast_payments FOR INSERT WITH CHECK (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer')
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can update cast_payments" ON cast_payments FOR UPDATE USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer')
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can delete cast_payments" ON cast_payments FOR DELETE USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);

-- cast_documents policies
CREATE POLICY "Project members can read cast_documents"   ON cast_documents FOR SELECT USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can insert cast_documents" ON cast_documents FOR INSERT WITH CHECK (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer')
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can update cast_documents" ON cast_documents FOR UPDATE USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer')
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can delete cast_documents" ON cast_documents FOR DELETE USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);

-- ---------------------------------------------------------------------
-- Source: supabase/migration_annotations.sql
-- ---------------------------------------------------------------------
-- Migration: Script Annotations
-- Adds line_ref column to community_comments and enables 'annotation' comment type.
-- Run this in the Supabase SQL editor.

-- 1. Add line_ref column (stores element index for structured scripts, paragraph index for plaintext)
ALTER TABLE community_comments
  ADD COLUMN IF NOT EXISTS line_ref TEXT DEFAULT NULL;

COMMENT ON COLUMN community_comments.line_ref IS
  'For annotations: the element/paragraph index the annotation is attached to (as string). NULL for regular comments and suggestions.';

-- 2. Drop existing check constraint on comment_type (if any) and recreate including annotation
DO $$
BEGIN
  -- Drop constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_comments_comment_type_check'
  ) THEN
    ALTER TABLE community_comments
      DROP CONSTRAINT community_comments_comment_type_check;
  END IF;
END $$;

-- Recreate with annotation allowed
ALTER TABLE community_comments
  ADD CONSTRAINT community_comments_comment_type_check
  CHECK (comment_type IN ('comment', 'suggestion', 'annotation'));

-- 3. Index for fast annotation lookups per post
CREATE INDEX IF NOT EXISTS idx_community_comments_annotations
  ON community_comments (post_id, comment_type, line_ref)
  WHERE comment_type = 'annotation';

-- 4. RLS: annotations follow the same policy as comments (already covered by existing post_id-based policies).
-- No additional RLS needed if existing policies cover all rows in community_comments.

-- ---------------------------------------------------------------------
-- Source: supabase/migration_arc_episodic_admin.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Screenplay Studio — Migration: All Recent Feature Changes
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Safe to run multiple times (idempotent where possible)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. EPISODIC PROJECT SUPPORT
--    Columns: season_number, episode_count on projects table
--    These likely already exist if using the full schema.
--    This block is safe — uses IF NOT EXISTS.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS season_number  INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS episode_count  INTEGER DEFAULT NULL;

COMMENT ON COLUMN projects.season_number IS
  'For episodic series: which season this project represents (default 1)';
COMMENT ON COLUMN projects.episode_count IS
  'For episodic series: planned total episode count (null = open-ended)';


-- ──────────────────────────────────────────────────────────────
-- 2. ARC PLANNER — stored in projects.content_metadata (JSONB)
--    No column change needed: content_metadata is already JSONB.
--    The arc map is stored as:
--      content_metadata->>'arc_map'  (JSON-encoded MindmapData)
--    Index for faster filtering when listing episodic projects:
-- ──────────────────────────────────────────────────────────────

-- Index so we can efficiently query episodic projects in the arc planner
CREATE INDEX IF NOT EXISTS idx_projects_script_type
  ON projects (script_type);

-- GIN index for content_metadata JSONB for fast arc_map existence checks
CREATE INDEX IF NOT EXISTS idx_projects_content_metadata_gin
  ON projects USING gin (content_metadata);

COMMENT ON COLUMN projects.content_metadata IS
  'Flexible JSONB store. Keys include: arc_map (ArcMindmap JSON), platform-specific metadata, etc.';


-- ──────────────────────────────────────────────────────────────
-- 3. SUPPORT TICKETS — "Report a Bug" feature
--    The 'bug' TicketCategory value already exists in the app
--    type system. Ensure the column can hold it if using an enum.
--    If category is TEXT (not an enum), nothing needed.
--    Check with: \d support_tickets
-- ──────────────────────────────────────────────────────────────

-- If you have an enum type for ticket_category, add 'bug' if not present:
-- (Uncomment if needed — safe to run only once)
--
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_category') THEN
--     ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'bug';
--   END IF;
-- END $$;

-- Ensure the support_tickets table has all required columns
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';


-- ──────────────────────────────────────────────────────────────
-- 4. OFFLINE SYNC QUEUE (IndexedDB — client-side only)
--    No server-side schema needed. The offline layer stores data
--    in the browser's IndexedDB (ss-offline db, idb package).
--    When back online, the sync queue pushes changes to Supabase
--    using the existing table RLS policies.
-- ──────────────────────────────────────────────────────────────

-- No SQL needed for offline/PWA support.


-- ──────────────────────────────────────────────────────────────
-- 5. ADMIN STATS — new queries used by the enhanced admin panel
--    Create helper views to make the admin queries fast.
-- ──────────────────────────────────────────────────────────────

-- View: daily signup counts (last 90 days)
CREATE OR REPLACE VIEW admin_signups_by_day AS
SELECT
  date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS signup_date,
  COUNT(*) AS signup_count
FROM profiles
WHERE created_at >= now() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1;

-- View: daily project creation counts (last 90 days)
CREATE OR REPLACE VIEW admin_projects_by_day AS
SELECT
  date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS created_date,
  COUNT(*) AS project_count
FROM projects
WHERE created_at >= now() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1;

-- View: script type distribution (script_type is on projects, not scripts)
CREATE OR REPLACE VIEW admin_script_type_breakdown AS
SELECT
  COALESCE(script_type::text, 'unknown') AS script_type,
  COUNT(*) AS total
FROM projects
GROUP BY 1
ORDER BY 2 DESC;

-- View: project type distribution
CREATE OR REPLACE VIEW admin_project_type_breakdown AS
SELECT
  COALESCE(project_type::text, 'unknown') AS project_type,
  COUNT(*) AS total
FROM projects
GROUP BY 1
ORDER BY 2 DESC;

-- View: ticket summary by category and status
CREATE OR REPLACE VIEW admin_ticket_summary AS
SELECT
  category,
  status,
  COUNT(*) AS total
FROM support_tickets
GROUP BY 1, 2
ORDER BY 3 DESC;

-- View: platform-wide engagement summary (single-row summary)
CREATE OR REPLACE VIEW admin_platform_summary AS
SELECT
  (SELECT COUNT(*) FROM profiles)                       AS total_users,
  (SELECT COUNT(*) FROM profiles WHERE is_pro = true)   AS pro_users,
  (SELECT COUNT(*) FROM projects)                       AS total_projects,
  (SELECT COUNT(*) FROM scripts)                        AS total_scripts,
  (SELECT COUNT(*) FROM script_elements)                AS total_elements,
  (SELECT COUNT(*) FROM characters)                     AS total_characters,
  (SELECT COUNT(*) FROM locations)                      AS total_locations,
  (SELECT COUNT(*) FROM scenes)                         AS total_scenes,
  (SELECT COUNT(*) FROM shots)                          AS total_shots,
  (SELECT COUNT(*) FROM ideas)                          AS total_ideas,
  (SELECT COUNT(*) FROM budget_items)                   AS total_budget_items,
  (SELECT COUNT(*) FROM production_schedule)            AS total_schedule_events,
  (SELECT COUNT(*) FROM comments)                       AS total_comments,
  (SELECT COUNT(*) FROM support_tickets)                AS total_tickets,
  (SELECT COUNT(*) FROM support_tickets
   WHERE status IN ('open','in_progress'))              AS open_tickets,
  (SELECT COUNT(*) FROM support_tickets
   WHERE category = 'bug')                              AS bug_reports,
  (SELECT COUNT(*) FROM projects
   WHERE script_type = 'episodic')                      AS episodic_projects,
  (SELECT COUNT(*) FROM push_subscriptions)             AS push_subscriptions;

-- Grant read on admin views to authenticated role (adjust if using service_role)
GRANT SELECT ON admin_signups_by_day        TO authenticated;
GRANT SELECT ON admin_projects_by_day       TO authenticated;
GRANT SELECT ON admin_script_type_breakdown TO authenticated;
GRANT SELECT ON admin_project_type_breakdown TO authenticated;
GRANT SELECT ON admin_ticket_summary        TO authenticated;
GRANT SELECT ON admin_platform_summary      TO authenticated;


-- ──────────────────────────────────────────────────────────────
-- 6. RLS POLICIES for admin views
--    Only admin/moderator roles should be able to read these views.
--    The app already checks isStaff() in code, but defence-in-depth
--    at DB level is good practice.
-- ──────────────────────────────────────────────────────────────

-- Enable RLS on the views is not directly possible, but you can
-- wrap them in functions with SECURITY DEFINER.

-- Example: admin-only function for platform summary
CREATE OR REPLACE FUNCTION get_platform_summary()
RETURNS TABLE (
  total_users bigint, pro_users bigint, total_projects bigint,
  total_scripts bigint, total_elements bigint, total_characters bigint,
  total_locations bigint, total_scenes bigint, total_shots bigint,
  total_ideas bigint, total_budget_items bigint, total_schedule_events bigint,
  total_comments bigint, total_tickets bigint, open_tickets bigint,
  bug_reports bigint, episodic_projects bigint, push_subscriptions bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow admin/moderator roles
  IF (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY SELECT * FROM admin_platform_summary;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 7. PERFORMANCE INDEXES
--    Useful for all the new admin queries and feature queries.
-- ──────────────────────────────────────────────────────────────

-- Scripts: frequently filtered by project and type
CREATE INDEX IF NOT EXISTS idx_scripts_project_id
  ON scripts (project_id);

-- idx_scripts_script_type removed: script_type column does not exist on scripts table
-- (script_type lives on the projects table)

-- Profiles: pro user filtering
CREATE INDEX IF NOT EXISTS idx_profiles_is_pro
  ON profiles (is_pro);

CREATE INDEX IF NOT EXISTS idx_profiles_created_at
  ON profiles (created_at DESC);

-- Projects: created_at for trend queries
CREATE INDEX IF NOT EXISTS idx_projects_created_at
  ON projects (created_at DESC);

-- Support tickets: status + category combo for admin queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_category
  ON support_tickets (status, category);


-- ──────────────────────────────────────────────────────────────
-- 8. BETA BANNER dismissal — client-side (localStorage key
--    'ss_beta_banner_dismissed_v1'). No server storage needed.
-- ──────────────────────────────────────────────────────────────

-- No SQL needed.


-- ──────────────────────────────────────────────────────────────
-- SUMMARY OF ALL CHANGES
-- ──────────────────────────────────────────────────────────────
--
-- CLIENT-SIDE ONLY (no SQL needed):
--   • Offline PWA / IndexedDB sync layer (ss-offline db)
--   • Service Worker cache strategies
--   • Beta banner (localStorage)
--   • Arc Planner mind map UI (saves to projects.content_metadata)
--
-- DATABASE CHANGES:
--   • projects.season_number    — INTEGER, nullable (episodic season)
--   • projects.episode_count    — INTEGER, nullable (planned episodes)
--   • idx_projects_script_type  — index for episodic filtering
--   • idx_projects_content_metadata_gin — GIN index for arc_map access
--   • idx_scripts_project_id    — performance index
--   (idx_scripts_script_type removed — column not on scripts table)
--   • idx_profiles_is_pro       — performance index
--   • idx_profiles_created_at   — performance index
--   • idx_projects_created_at   — performance index
--   • idx_support_tickets_status_category — performance index
--   • admin_* views             — convenience read views for admin panel
--   • get_platform_summary()    — SECURITY DEFINER RPC for safe admin access
--
-- NO NEW TABLES CREATED.
-- All data uses existing Supabase tables.
-- ============================================================

-- ---------------------------------------------------------------------
-- Source: supabase/migration_audio_drama_formats.sql
-- ---------------------------------------------------------------------
-- Migration: Audio Drama & TV Production Enum + Format Values
-- ⚠️  MUST BE RUN IN TWO SEPARATE STEPS in the Supabase SQL editor.
--     ALTER TYPE ... ADD VALUE cannot be used in the same transaction
--     as queries that reference the new enum value.
--
-- ══════════════════════════════════════════════════════════════
--  STEP 1 — Run this block first, then click Run.
-- ══════════════════════════════════════════════════════════════

ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'tv_production';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'audio_drama';

-- ══════════════════════════════════════════════════════════════
--  STEP 2 — After Step 1 succeeds, run everything below here.
-- ══════════════════════════════════════════════════════════════

-- Normalize existing audio_drama projects: any that still have a
-- generic film format value get updated to 'starc_standard'.
UPDATE projects
SET    format = 'starc_standard'
WHERE  (project_type = 'audio_drama' OR script_type = 'audio_drama')
  AND  (
         format IS NULL
         OR format = ''
         OR format NOT IN ('bbc_radio', 'us_radio', 'starc_standard', 'podcast_simple')
       );

-- Migrate legacy rows where script_type was set to 'audio_drama'
-- but project_type was never updated to match.
UPDATE projects
SET    project_type = 'audio_drama'
WHERE  script_type  = 'audio_drama'
  AND  project_type != 'audio_drama';

-- Ensure the project_templates updated_at trigger exists
-- (run migration_project_templates.sql first if the table doesn't exist yet).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'project_templates_updated_at'
  ) THEN
    CREATE TRIGGER project_templates_updated_at
      BEFORE UPDATE ON project_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── Optional: seed starter templates ────────────────────────
-- Uncomment and run as a logged-in user to create personal starter
-- templates for each audio format.

/*
INSERT INTO project_templates
  (user_id, name, description, project_type, script_type, format, is_public, structure_snapshot)
VALUES
  (
    auth.uid(),
    'BBC Radio Drama',
    'Classic British radio drama — scene headings, stage directions, FADE IN/OUT.',
    'audio_drama', 'podcast', 'bbc_radio', false,
    '{"suggested_genres":["Thriller","Drama","Horror","Comedy","Sci-Fi"]}'::jsonb
  ),
  (
    auth.uid(),
    'US Radio Drama',
    'American radio play — acts, announcer lines, full sound-cue sheets.',
    'audio_drama', 'podcast', 'us_radio', false,
    '{"suggested_genres":["Mystery","Adventure","Sci-Fi","Comedy","Horror"]}'::jsonb
  ),
  (
    auth.uid(),
    'STARC Audio Drama',
    'Full STARC format with inline SFX:, MUSIC:, and AMBIENCE: cue lines.',
    'audio_drama', 'podcast', 'starc_standard', false,
    '{"suggested_genres":["Thriller","Drama","Fantasy","Sci-Fi","Horror"]}'::jsonb
  );
*/

-- ---------------------------------------------------------------------
-- Source: supabase/migration_ban_enforcement.sql
-- ---------------------------------------------------------------------
-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Ban Enforcement — IP bans, banned IPs table               ║
-- ║  Tracks IPs of banned users so new accounts are blocked    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════
-- BANNED IPs — Persist IPs associated with banned users
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS banned_ips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address  TEXT NOT NULL,
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ban_id      UUID REFERENCES user_bans(id) ON DELETE SET NULL,
  reason      TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banned_ips_ip ON banned_ips(ip_address) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_banned_ips_user ON banned_ips(user_id);

ALTER TABLE banned_ips ENABLE ROW LEVEL SECURITY;

-- Only admins can manage banned IPs
DROP POLICY IF EXISTS "Admins manage banned IPs" ON banned_ips;
CREATE POLICY "Admins manage banned IPs" ON banned_ips
  FOR ALL USING (public.is_platform_admin());

-- Service role can insert (from middleware/API)
DROP POLICY IF EXISTS "Service can insert banned IPs" ON banned_ips;
CREATE POLICY "Service can insert banned IPs" ON banned_ips
  FOR INSERT WITH CHECK (true);

GRANT ALL ON banned_ips TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════
-- Add last_known_ip to profiles for IP tracking
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_known_ip TEXT;


-- ═══════════════════════════════════════════════════════════════
-- SYSTEM USER — A special profile for system-generated messages
-- Using a deterministic UUID so it's consistent everywhere
-- Must create in auth.users first (FK constraint on profiles)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated',
  'system@screenplaystudio.app',
  '$2a$10$SYSTEM_ACCOUNT_NO_LOGIN_ALLOWED',
  now(), now(), now(),
  '{"provider":"email","providers":["email"],"is_system":true}'::jsonb,
  '{"full_name":"Screenplay Studio","is_system":true}'::jsonb,
  false, ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, display_name, role, avatar_url)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'system@screenplaystudio.app',
  'Screenplay Studio',
  'SYSTEM',
  'admin',
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  full_name = 'Screenplay Studio',
  display_name = 'SYSTEM',
  role = 'admin';

-- ---------------------------------------------------------------------
-- Source: supabase/migration_broadcast.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- BROADCAST ENVIRONMENT — Production-Grade Database Schema
-- NRCS (Newsroom Computer System) + Playout + Integration
-- ============================================================
-- This schema is designed for real broadcast operations.
-- It implements industry-standard concepts: rundowns with
-- back-timing, story management with versioning & locking,
-- wire feed ingestion, MOS device registry, source routing,
-- and as-run compliance logging.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Helper function: auto-update updated_at
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION broadcast_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper: check project membership for RLS
CREATE OR REPLACE FUNCTION is_broadcast_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════
-- 1. STORIES — Editorial content managed by journalists
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Identity
  slug TEXT NOT NULL,              -- Short identifier: "OSLO-FIRE", "PM-PRESS"
  title TEXT NOT NULL,
  
  -- Content
  body JSONB,                       -- Rich text (TipTap/ProseMirror JSON)
  script_text TEXT,                 -- Plain text extracted for prompter
  
  -- Editorial workflow
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'working', 'ready', 'approved', 'on_air', 'killed', 'archived')),
  story_type TEXT NOT NULL DEFAULT 'reader'
    CHECK (story_type IN ('reader', 'vo', 'sot', 'vosot', 'pkg', 'live', 'interview', 'donut', 'break', 'tease', 'cold_open', 'kicker', 'other')),
  priority INTEGER NOT NULL DEFAULT 0
    CHECK (priority BETWEEN 0 AND 5),  -- 0=routine, 5=flash/bulletin
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Wire reference
  source TEXT,                      -- 'staff', 'wire:ap', 'wire:reuters', 'freelance'
  wire_story_id UUID,               -- Reference to broadcast_wire_stories
  
  -- Timing
  estimated_duration INTEGER,       -- seconds
  embargo_until TIMESTAMPTZ,
  
  -- Locking (optimistic concurrency)
  version INTEGER NOT NULL DEFAULT 1,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Story version history (every save creates a version)
CREATE TABLE IF NOT EXISTS broadcast_story_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES broadcast_stories(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body JSONB,
  script_text TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, version)
);

-- ════════════════════════════════════════════════════════════
-- 2. RUNDOWNS — Timed show sequence
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_rundowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  show_date DATE NOT NULL,
  
  -- Timing
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  
  -- Workflow
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'rehearsal', 'pre_show', 'live', 'completed', 'archived')),
  
  -- Template support (for recurring shows)
  template_id UUID REFERENCES broadcast_rundowns(id) ON DELETE SET NULL,
  is_template BOOLEAN NOT NULL DEFAULT false,
  
  -- Locking
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rundown Items (individual segments/elements)
CREATE TABLE IF NOT EXISTS broadcast_rundown_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rundown_id UUID NOT NULL REFERENCES broadcast_rundowns(id) ON DELETE CASCADE,
  story_id UUID REFERENCES broadcast_stories(id) ON DELETE SET NULL,
  
  -- Ordering
  sort_order INTEGER NOT NULL,
  page_number TEXT,                  -- Show page: "A1", "B3", etc.
  segment_slug TEXT,                 -- Quick identifier
  
  -- Content
  title TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'anchor_read'
    CHECK (item_type IN (
      'anchor_read', 'vo', 'sot', 'vosot', 'pkg', 'live_shot',
      'interview', 'donut', 'cold_open', 'tease', 'kicker',
      'break', 'bumper', 'commercial', 'promo', 'title_sequence',
      'weather', 'sports_desk', 'other'
    )),
  
  -- Timing (seconds)
  planned_duration INTEGER NOT NULL DEFAULT 0,
  actual_duration INTEGER,
  back_time TIMESTAMPTZ,            -- Calculated: when this must start
  back_time_target TIMESTAMPTZ,     -- Hard out target for back-timing
  
  -- Flags
  is_float BOOLEAN NOT NULL DEFAULT false,  -- Optional/floater segment
  is_break BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'standby', 'on_air', 'done', 'killed', 'skipped')),
  
  -- Technical: Camera
  camera TEXT,                       -- "CAM 1", "JIBCAM", "ROBOCAM A"
  
  -- Technical: Audio
  audio_source TEXT,                 -- "MIC 1+2", "SKYPE", "PHONE", "VT SOUND"
  audio_notes TEXT,
  
  -- Technical: Video source
  video_source TEXT,                 -- "VT1", "LIVE_FEED_1", "GFX_FULL"
  
  -- Technical: Graphics
  graphics_id TEXT,                  -- Ref to graphics cue / CasparCG template
  graphics_notes TEXT,
  
  -- Prompter
  prompter_text TEXT,                -- Text for teleprompter
  
  -- Talent
  presenter TEXT,
  reporter TEXT,
  
  -- Department notes
  director_notes TEXT,
  technical_notes TEXT,
  production_notes TEXT,
  
  -- Media reference (MAM/asset ID)
  media_id TEXT,
  media_in_point TEXT,              -- Timecode in: "01:23:45:12"
  media_out_point TEXT,             -- Timecode out
  media_duration INTEGER,           -- Calculated from in/out (seconds)
  
  -- Color coding
  color TEXT,
  
  -- Timestamps
  on_air_at TIMESTAMPTZ,           -- When this item actually went on air
  off_air_at TIMESTAMPTZ,          -- When this item actually ended
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 3. WIRE FEEDS — News wire service ingestion
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_wire_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,               -- "NTB Nyheter", "AP World", "Reuters Sports"
  feed_url TEXT NOT NULL,           -- RSS/Atom URL
  feed_type TEXT NOT NULL DEFAULT 'rss'
    CHECK (feed_type IN ('rss', 'atom', 'json_api')),
  category TEXT,                    -- "world", "domestic", "sports", "business"
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  poll_interval_seconds INTEGER NOT NULL DEFAULT 300,
  
  -- Tracking
  last_polled_at TIMESTAMPTZ,
  last_error TEXT,
  stories_ingested INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broadcast_wire_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES broadcast_wire_feeds(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  external_id TEXT NOT NULL,        -- Original story ID from wire service
  headline TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  source_name TEXT,                 -- "NTB", "AP", "Reuters"
  category TEXT,
  
  priority TEXT DEFAULT 'routine'
    CHECK (priority IN ('flash', 'bulletin', 'urgent', 'routine', 'deferred')),
  
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Has been pulled into an editorial story
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_in_story_id UUID REFERENCES broadcast_stories(id) ON DELETE SET NULL,
  
  -- Prevent duplicate ingestion
  UNIQUE(feed_id, external_id)
);

-- ════════════════════════════════════════════════════════════
-- 4. SOURCES — Video/Audio source routing
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,               -- "CAM 1", "STUDIO A", "SAT FEED Oslo"
  short_name TEXT,                  -- "C1", "SA", "SF1" — for rundown display
  source_type TEXT NOT NULL DEFAULT 'camera'
    CHECK (source_type IN (
      'camera', 'robocam', 'jib', 'crane',
      'vtr', 'video_server', 'clip_player',
      'live_feed', 'satellite', 'remote',
      'graphics', 'cg',
      'audio_only', 'telephone', 'skype',
      'ndi', 'srt', 'web_feed',
      'other'
    )),
  
  -- Connection details
  protocol TEXT
    CHECK (protocol IN ('sdi', 'ndi', 'srt', 'hls', 'rtmp', 'rtsp', 'webrtc', 'nmos', NULL)),
  connection_url TEXT,              -- srt://host:port, ndi://source, https://stream.m3u8
  ndi_source_name TEXT,             -- For NDI: "MACHINE (Source Name)"
  srt_passphrase TEXT,              -- For SRT encryption
  
  -- NMOS (IS-04/IS-05) 
  nmos_node_id TEXT,
  nmos_sender_id TEXT,
  
  -- State
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,  -- Primary source for its type
  tally_state TEXT DEFAULT 'off'
    CHECK (tally_state IN ('off', 'preview', 'program')),
  
  -- Display
  thumbnail_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 5. MOS DEVICE REGISTRY — For MOS protocol integration
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_mos_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,               -- "CasparCG Server 1", "Viz Engine", "TriCaster"
  mos_id TEXT NOT NULL,             -- MOS device ID (per MOS protocol spec)
  ncs_id TEXT,                      -- Our NCS ID as known by this device
  device_type TEXT NOT NULL DEFAULT 'graphics'
    CHECK (device_type IN ('graphics', 'video_server', 'prompter', 'audio', 'playout', 'router', 'other')),
  
  -- Connection
  host TEXT NOT NULL,
  upper_port INTEGER NOT NULL DEFAULT 10540,  -- MOS upper port
  lower_port INTEGER NOT NULL DEFAULT 10541,  -- MOS lower port
  
  -- State
  is_active BOOLEAN NOT NULL DEFAULT true,
  connection_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('connected', 'disconnected', 'error', 'timeout')),
  last_heartbeat TIMESTAMPTZ,
  last_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 6. GRAPHICS / CG — Character Generator cue management 
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_graphics_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'lower_third'
    CHECK (template_type IN (
      'lower_third', 'full_screen', 'ots', 'locator', 'ticker',
      'scorebug', 'name_super', 'title_card', 'logo_bug', 'strap',
      'clock', 'breaking', 'other'
    )),
  
  -- Template definition
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{key, label, type, default_value}]
  
  -- CasparCG / external CG integration
  cg_server TEXT,                   -- Which CG server to target
  cg_channel INTEGER,               -- CasparCG channel number
  cg_layer INTEGER,                 -- CasparCG layer number
  cg_template_path TEXT,            -- Path to template file on CG server
  
  preview_bg_color TEXT DEFAULT '#0a0a1a',
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broadcast_graphics_cues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Links
  rundown_id UUID REFERENCES broadcast_rundowns(id) ON DELETE SET NULL,
  rundown_item_id UUID REFERENCES broadcast_rundown_items(id) ON DELETE SET NULL,
  template_id UUID REFERENCES broadcast_graphics_templates(id) ON DELETE SET NULL,
  
  sort_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  
  cue_type TEXT NOT NULL DEFAULT 'lower_third',
  field_values JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Filled template fields
  
  -- Timing
  duration_seconds INTEGER DEFAULT 5,
  auto_next BOOLEAN NOT NULL DEFAULT false,  -- Auto-advance to next cue
  
  -- State
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'standby', 'on_air', 'done')),
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 7. AS-RUN LOG — Compliance & transmission logging
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_as_run_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Links
  rundown_id UUID REFERENCES broadcast_rundowns(id) ON DELETE SET NULL,
  rundown_item_id UUID REFERENCES broadcast_rundown_items(id) ON DELETE SET NULL,
  
  -- Event
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'segment_start', 'segment_end',
      'break_start', 'break_end',
      'graphic_on', 'graphic_off',
      'source_switch',
      'override', 'manual_note', 'error',
      'show_start', 'show_end'
    )),
  title TEXT NOT NULL,
  
  -- Timing
  planned_time TIMESTAMPTZ,
  actual_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  planned_duration INTEGER,         -- seconds
  actual_duration INTEGER,          -- seconds
  deviation_seconds INTEGER DEFAULT 0,  -- + = over, - = under
  
  -- Context
  source TEXT,                      -- Which source/feed
  operator TEXT,                    -- Who triggered it
  notes TEXT,
  
  -- Automatic (system) vs manual entry
  is_automatic BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 8. TIMING LOG — Precise timing data for analytics
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_timing_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rundown_id UUID NOT NULL REFERENCES broadcast_rundowns(id) ON DELETE CASCADE,
  rundown_item_id UUID REFERENCES broadcast_rundown_items(id) ON DELETE SET NULL,
  
  mark_type TEXT NOT NULL
    CHECK (mark_type IN ('item_start', 'item_end', 'show_start', 'show_end', 'marker')),
  
  wall_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  show_elapsed_seconds NUMERIC(10,3),  -- Seconds since show start (ms precision)
  
  operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════

-- Stories
CREATE INDEX IF NOT EXISTS idx_broadcast_stories_project ON broadcast_stories(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_stories_status ON broadcast_stories(project_id, status);
CREATE INDEX IF NOT EXISTS idx_broadcast_stories_assigned ON broadcast_stories(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_broadcast_story_versions ON broadcast_story_versions(story_id, version);

-- Rundowns
CREATE INDEX IF NOT EXISTS idx_broadcast_rundowns_project ON broadcast_rundowns(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_rundowns_date ON broadcast_rundowns(project_id, show_date);
CREATE INDEX IF NOT EXISTS idx_broadcast_rundown_items ON broadcast_rundown_items(rundown_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_broadcast_rundown_items_story ON broadcast_rundown_items(story_id) WHERE story_id IS NOT NULL;

-- Wire
CREATE INDEX IF NOT EXISTS idx_broadcast_wire_feeds ON broadcast_wire_feeds(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_broadcast_wire_stories_feed ON broadcast_wire_stories(feed_id, ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_wire_stories_project ON broadcast_wire_stories(project_id, ingested_at DESC);

-- Sources
CREATE INDEX IF NOT EXISTS idx_broadcast_sources ON broadcast_sources(project_id, is_active);

-- MOS
CREATE INDEX IF NOT EXISTS idx_broadcast_mos ON broadcast_mos_devices(project_id, is_active);

-- Graphics
CREATE INDEX IF NOT EXISTS idx_broadcast_gfx_templates ON broadcast_graphics_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_gfx_cues ON broadcast_graphics_cues(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_gfx_cues_rundown ON broadcast_graphics_cues(rundown_id) WHERE rundown_id IS NOT NULL;

-- As-Run
CREATE INDEX IF NOT EXISTS idx_broadcast_as_run ON broadcast_as_run_log(project_id, actual_time DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_as_run_rundown ON broadcast_as_run_log(rundown_id) WHERE rundown_id IS NOT NULL;

-- Timing
CREATE INDEX IF NOT EXISTS idx_broadcast_timing ON broadcast_timing_marks(rundown_id, wall_time);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

ALTER TABLE broadcast_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_story_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_rundowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_rundown_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_wire_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_wire_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_mos_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_graphics_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_graphics_cues ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_as_run_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_timing_marks ENABLE ROW LEVEL SECURITY;

-- Stories
DROP POLICY IF EXISTS "bcast_stories_sel" ON broadcast_stories;
CREATE POLICY "bcast_stories_sel" ON broadcast_stories FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_stories_ins" ON broadcast_stories;
CREATE POLICY "bcast_stories_ins" ON broadcast_stories FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_stories_upd" ON broadcast_stories;
CREATE POLICY "bcast_stories_upd" ON broadcast_stories FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_stories_del" ON broadcast_stories;
CREATE POLICY "bcast_stories_del" ON broadcast_stories FOR DELETE USING (is_broadcast_member(project_id));

-- Story versions
DROP POLICY IF EXISTS "bcast_sv_sel" ON broadcast_story_versions;
CREATE POLICY "bcast_sv_sel" ON broadcast_story_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM broadcast_stories s WHERE s.id = story_id AND is_broadcast_member(s.project_id)));
DROP POLICY IF EXISTS "bcast_sv_ins" ON broadcast_story_versions;
CREATE POLICY "bcast_sv_ins" ON broadcast_story_versions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM broadcast_stories s WHERE s.id = story_id AND is_broadcast_member(s.project_id)));

-- Rundowns
DROP POLICY IF EXISTS "bcast_rundowns_sel" ON broadcast_rundowns;
CREATE POLICY "bcast_rundowns_sel" ON broadcast_rundowns FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_rundowns_ins" ON broadcast_rundowns;
CREATE POLICY "bcast_rundowns_ins" ON broadcast_rundowns FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_rundowns_upd" ON broadcast_rundowns;
CREATE POLICY "bcast_rundowns_upd" ON broadcast_rundowns FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_rundowns_del" ON broadcast_rundowns;
CREATE POLICY "bcast_rundowns_del" ON broadcast_rundowns FOR DELETE USING (is_broadcast_member(project_id));

-- Rundown items
DROP POLICY IF EXISTS "bcast_ri_sel" ON broadcast_rundown_items;
CREATE POLICY "bcast_ri_sel" ON broadcast_rundown_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));
DROP POLICY IF EXISTS "bcast_ri_ins" ON broadcast_rundown_items;
CREATE POLICY "bcast_ri_ins" ON broadcast_rundown_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));
DROP POLICY IF EXISTS "bcast_ri_upd" ON broadcast_rundown_items;
CREATE POLICY "bcast_ri_upd" ON broadcast_rundown_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));
DROP POLICY IF EXISTS "bcast_ri_del" ON broadcast_rundown_items;
CREATE POLICY "bcast_ri_del" ON broadcast_rundown_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));

-- Wire feeds
DROP POLICY IF EXISTS "bcast_wf_sel" ON broadcast_wire_feeds;
CREATE POLICY "bcast_wf_sel" ON broadcast_wire_feeds FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_wf_ins" ON broadcast_wire_feeds;
CREATE POLICY "bcast_wf_ins" ON broadcast_wire_feeds FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_wf_upd" ON broadcast_wire_feeds;
CREATE POLICY "bcast_wf_upd" ON broadcast_wire_feeds FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_wf_del" ON broadcast_wire_feeds;
CREATE POLICY "bcast_wf_del" ON broadcast_wire_feeds FOR DELETE USING (is_broadcast_member(project_id));

-- Wire stories
DROP POLICY IF EXISTS "bcast_ws_sel" ON broadcast_wire_stories;
CREATE POLICY "bcast_ws_sel" ON broadcast_wire_stories FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_ws_ins" ON broadcast_wire_stories;
CREATE POLICY "bcast_ws_ins" ON broadcast_wire_stories FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_ws_upd" ON broadcast_wire_stories;
CREATE POLICY "bcast_ws_upd" ON broadcast_wire_stories FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_ws_del" ON broadcast_wire_stories;
CREATE POLICY "bcast_ws_del" ON broadcast_wire_stories FOR DELETE USING (is_broadcast_member(project_id));

-- Sources
DROP POLICY IF EXISTS "bcast_src_sel" ON broadcast_sources;
CREATE POLICY "bcast_src_sel" ON broadcast_sources FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_src_ins" ON broadcast_sources;
CREATE POLICY "bcast_src_ins" ON broadcast_sources FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_src_upd" ON broadcast_sources;
CREATE POLICY "bcast_src_upd" ON broadcast_sources FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_src_del" ON broadcast_sources;
CREATE POLICY "bcast_src_del" ON broadcast_sources FOR DELETE USING (is_broadcast_member(project_id));

-- MOS devices
DROP POLICY IF EXISTS "bcast_mos_sel" ON broadcast_mos_devices;
CREATE POLICY "bcast_mos_sel" ON broadcast_mos_devices FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_mos_ins" ON broadcast_mos_devices;
CREATE POLICY "bcast_mos_ins" ON broadcast_mos_devices FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_mos_upd" ON broadcast_mos_devices;
CREATE POLICY "bcast_mos_upd" ON broadcast_mos_devices FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_mos_del" ON broadcast_mos_devices;
CREATE POLICY "bcast_mos_del" ON broadcast_mos_devices FOR DELETE USING (is_broadcast_member(project_id));

-- Graphics templates
DROP POLICY IF EXISTS "bcast_gt_sel" ON broadcast_graphics_templates;
CREATE POLICY "bcast_gt_sel" ON broadcast_graphics_templates FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_gt_ins" ON broadcast_graphics_templates;
CREATE POLICY "bcast_gt_ins" ON broadcast_graphics_templates FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_gt_upd" ON broadcast_graphics_templates;
CREATE POLICY "bcast_gt_upd" ON broadcast_graphics_templates FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_gt_del" ON broadcast_graphics_templates;
CREATE POLICY "bcast_gt_del" ON broadcast_graphics_templates FOR DELETE USING (is_broadcast_member(project_id));

-- Graphics cues
DROP POLICY IF EXISTS "bcast_gc_sel" ON broadcast_graphics_cues;
CREATE POLICY "bcast_gc_sel" ON broadcast_graphics_cues FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_gc_ins" ON broadcast_graphics_cues;
CREATE POLICY "bcast_gc_ins" ON broadcast_graphics_cues FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_gc_upd" ON broadcast_graphics_cues;
CREATE POLICY "bcast_gc_upd" ON broadcast_graphics_cues FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_gc_del" ON broadcast_graphics_cues;
CREATE POLICY "bcast_gc_del" ON broadcast_graphics_cues FOR DELETE USING (is_broadcast_member(project_id));

-- As-run
DROP POLICY IF EXISTS "bcast_ar_sel" ON broadcast_as_run_log;
CREATE POLICY "bcast_ar_sel" ON broadcast_as_run_log FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_ar_ins" ON broadcast_as_run_log;
CREATE POLICY "bcast_ar_ins" ON broadcast_as_run_log FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_ar_del" ON broadcast_as_run_log;
CREATE POLICY "bcast_ar_del" ON broadcast_as_run_log FOR DELETE USING (is_broadcast_member(project_id));

-- Timing marks
DROP POLICY IF EXISTS "bcast_tm_sel" ON broadcast_timing_marks;
CREATE POLICY "bcast_tm_sel" ON broadcast_timing_marks FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_tm_ins" ON broadcast_timing_marks;
CREATE POLICY "bcast_tm_ins" ON broadcast_timing_marks FOR INSERT WITH CHECK (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_broadcast_stories_updated ON broadcast_stories;
CREATE TRIGGER trg_broadcast_stories_updated BEFORE UPDATE ON broadcast_stories FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
DROP TRIGGER IF EXISTS trg_broadcast_rundowns_updated ON broadcast_rundowns;
CREATE TRIGGER trg_broadcast_rundowns_updated BEFORE UPDATE ON broadcast_rundowns FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
DROP TRIGGER IF EXISTS trg_broadcast_rundown_items_updated ON broadcast_rundown_items;
CREATE TRIGGER trg_broadcast_rundown_items_updated BEFORE UPDATE ON broadcast_rundown_items FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
DROP TRIGGER IF EXISTS trg_broadcast_wire_feeds_updated ON broadcast_wire_feeds;
CREATE TRIGGER trg_broadcast_wire_feeds_updated BEFORE UPDATE ON broadcast_wire_feeds FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
DROP TRIGGER IF EXISTS trg_broadcast_sources_updated ON broadcast_sources;
CREATE TRIGGER trg_broadcast_sources_updated BEFORE UPDATE ON broadcast_sources FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
DROP TRIGGER IF EXISTS trg_broadcast_mos_devices_updated ON broadcast_mos_devices;
CREATE TRIGGER trg_broadcast_mos_devices_updated BEFORE UPDATE ON broadcast_mos_devices FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
DROP TRIGGER IF EXISTS trg_broadcast_gfx_cues_updated ON broadcast_graphics_cues;
CREATE TRIGGER trg_broadcast_gfx_cues_updated BEFORE UPDATE ON broadcast_graphics_cues FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();

-- ════════════════════════════════════════════════════════════
-- FUNCTIONS — Timing Engine (server-side back-timing)
-- ════════════════════════════════════════════════════════════

-- Calculate back-times for all items in a rundown
-- Back-timing works backwards from the scheduled end:
-- The last item's back-time = scheduled_end - its duration
-- The second-to-last = last_back_time - its duration
-- etc.
CREATE OR REPLACE FUNCTION broadcast_calculate_back_times(p_rundown_id UUID)
RETURNS TABLE(item_id UUID, back_time TIMESTAMPTZ, cumulative_seconds INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_scheduled_end TIMESTAMPTZ;
  v_running_time INTEGER := 0;
BEGIN
  SELECT scheduled_end INTO v_scheduled_end
  FROM broadcast_rundowns WHERE id = p_rundown_id;
  
  IF v_scheduled_end IS NULL THEN
    RETURN;
  END IF;

  -- Walk items in REVERSE order, accumulating duration
  FOR item_id, back_time, cumulative_seconds IN
    SELECT
      ri.id,
      v_scheduled_end - (SUM(ri.planned_duration) OVER (ORDER BY ri.sort_order DESC))::integer * interval '1 second',
      SUM(ri.planned_duration) OVER (ORDER BY ri.sort_order ASC)::integer
    FROM broadcast_rundown_items ri
    WHERE ri.rundown_id = p_rundown_id
      AND ri.status NOT IN ('killed', 'skipped')
    ORDER BY ri.sort_order ASC
  LOOP
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Calculate over/under for a live rundown
CREATE OR REPLACE FUNCTION broadcast_rundown_over_under(p_rundown_id UUID)
RETURNS TABLE(
  total_planned INTEGER,
  total_actual INTEGER,
  over_under INTEGER,
  show_elapsed INTEGER,
  items_remaining INTEGER
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(ri.planned_duration), 0)::integer AS total_planned,
    COALESCE(SUM(
      CASE
        WHEN ri.actual_duration IS NOT NULL THEN ri.actual_duration
        WHEN ri.on_air_at IS NOT NULL AND ri.off_air_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (ri.off_air_at - ri.on_air_at))::integer
        WHEN ri.on_air_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (now() - ri.on_air_at))::integer
        ELSE 0
      END
    ), 0)::integer AS total_actual,
    (COALESCE(SUM(
      CASE
        WHEN ri.actual_duration IS NOT NULL THEN ri.actual_duration
        WHEN ri.on_air_at IS NOT NULL AND ri.off_air_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (ri.off_air_at - ri.on_air_at))::integer
        WHEN ri.on_air_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (now() - ri.on_air_at))::integer
        ELSE 0
      END
    ), 0) - COALESCE(SUM(
      CASE WHEN ri.status IN ('done', 'on_air') THEN ri.planned_duration ELSE 0 END
    ), 0))::integer AS over_under,
    CASE
      WHEN r.actual_start IS NOT NULL
        THEN EXTRACT(EPOCH FROM (now() - r.actual_start))::integer
      ELSE 0
    END AS show_elapsed,
    COUNT(*) FILTER (WHERE ri.status IN ('pending', 'standby'))::integer AS items_remaining
  FROM broadcast_rundown_items ri
  JOIN broadcast_rundowns r ON r.id = ri.rundown_id
  WHERE ri.rundown_id = p_rundown_id
    AND ri.status NOT IN ('killed', 'skipped')
  GROUP BY r.actual_start;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 9. STREAM INGESTS — RTMP/SRT/WHIP ingest endpoints
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_stream_ingests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Identity
  name TEXT NOT NULL,
  label TEXT,
  
  -- Transport
  protocol TEXT NOT NULL DEFAULT 'rtmp'
    CHECK (protocol IN ('rtmp', 'srt', 'whip', 'rtsp', 'ndi', 'hls_pull')),
  
  -- Ingest endpoint
  ingest_url TEXT NOT NULL,
  stream_key TEXT NOT NULL DEFAULT encode(gen_random_bytes(20), 'hex'),
  
  -- For pull-based ingests (HLS pull, RTSP pull)
  pull_url TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'connecting', 'live', 'error', 'stopped')),
  
  -- Stream metadata (populated when stream is live)
  video_codec TEXT,
  audio_codec TEXT,
  width INTEGER,
  height INTEGER,
  fps NUMERIC(6,2),
  bitrate_kbps INTEGER,
  
  -- Health
  last_keyframe_at TIMESTAMPTZ,
  dropped_frames INTEGER DEFAULT 0,
  uptime_seconds INTEGER DEFAULT 0,
  
  -- Connection timestamps
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  
  -- Audio metadata
  audio_sample_rate INTEGER,
  audio_channels INTEGER,
  
  -- Active flag
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Auto-register as source
  auto_source BOOLEAN NOT NULL DEFAULT true,
  linked_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 10. STREAM OUTPUTS — RTMP/SRT push to destinations
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_stream_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Identity
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'custom'
    CHECK (platform IN ('youtube', 'twitch', 'facebook', 'tiktok', 'instagram', 'x_twitter', 'linkedin', 'custom', 'srt_push', 'ndi_out')),
  
  -- Destination
  rtmp_url TEXT,
  stream_key TEXT,
  srt_url TEXT,
  
  -- Encoding profile
  video_bitrate_kbps INTEGER DEFAULT 4500,
  audio_bitrate_kbps INTEGER DEFAULT 128,
  resolution TEXT DEFAULT '1920x1080',
  fps INTEGER DEFAULT 30,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'starting', 'live', 'error', 'stopping', 'stopped')),
  error_message TEXT,
  
  -- Runtime
  started_at TIMESTAMPTZ,
  uptime_seconds INTEGER DEFAULT 0,
  bytes_sent BIGINT DEFAULT 0,
  
  -- Flags
  is_primary BOOLEAN NOT NULL DEFAULT false,
  auto_start BOOLEAN NOT NULL DEFAULT false,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 11. SWITCHER STATE — Vision mixer / production switcher
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_switcher_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Bus assignments
  program_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  preview_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  
  -- Transition
  transition_type TEXT NOT NULL DEFAULT 'cut'
    CHECK (transition_type IN ('cut', 'mix', 'dip', 'wipe_h', 'wipe_v', 'wipe_circle', 'stinger', 'fade')),
  transition_duration_ms INTEGER NOT NULL DEFAULT 500,
  auto_transition BOOLEAN NOT NULL DEFAULT false,
  
  -- DSK layers
  dsk_1_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  dsk_1_on_air BOOLEAN NOT NULL DEFAULT false,
  dsk_2_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  dsk_2_on_air BOOLEAN NOT NULL DEFAULT false,
  
  -- Upstream keys
  usk_1_type TEXT DEFAULT 'luma'
    CHECK (usk_1_type IN ('luma', 'chroma', 'pattern', NULL)),
  usk_1_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  usk_1_on_air BOOLEAN NOT NULL DEFAULT false,
  
  -- Audio follow video
  audio_follow_video BOOLEAN NOT NULL DEFAULT true,
  
  -- FTB (Fade to Black)
  ftb_active BOOLEAN NOT NULL DEFAULT false,
  
  -- PiP
  pip_enabled BOOLEAN NOT NULL DEFAULT false,
  pip_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  pip_position TEXT DEFAULT 'bottom_right'
    CHECK (pip_position IN ('top_left', 'top_right', 'bottom_left', 'bottom_right', 'custom', NULL)),
  pip_size NUMERIC(3,2) DEFAULT 0.25,
  
  -- Meta
  last_take_at TIMESTAMPTZ,
  operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(project_id) -- One switcher state per project
);

-- ════════════════════════════════════════════════════════════
-- 12. COMMS CHANNELS — IFB / Intercom / Talkback
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_comms_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,               -- Optional channel purpose / notes
  channel_type TEXT NOT NULL DEFAULT 'party_line'
    CHECK (channel_type IN ('party_line', 'ifb', 'program_audio', 'iso', 'playout', 'stage_manager')),
  
  -- Color coding
  color TEXT DEFAULT '#3b82f6',
  
  -- Access
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Members (stored as array of user_ids with roles)
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 13. PLAYOUT / MEDIA PLAYLIST — Master control sequencing
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcast_playout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Sequencing
  sort_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  
  -- Item type
  item_type TEXT NOT NULL DEFAULT 'clip'
    CHECK (item_type IN ('clip', 'live', 'graphics', 'break', 'bug', 'emergency', 'black', 'slate', 'countdown', 'still')),
  
  -- Media reference
  media_url TEXT,
  media_type TEXT,
  thumbnail_url TEXT,
  
  -- Timing
  duration_seconds INTEGER DEFAULT 0,
  in_point_ms INTEGER DEFAULT 0,
  out_point_ms INTEGER,
  
  -- Transition
  transition_type TEXT DEFAULT 'cut'
    CHECK (transition_type IN ('cut', 'mix', 'dip', 'wipe', NULL)),
  transition_duration_ms INTEGER DEFAULT 0,
  
  -- Auto/manual
  auto_next BOOLEAN NOT NULL DEFAULT true,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'cued', 'playing', 'done', 'skipped')),
  
  -- Source reference (if type=live)
  source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  
  -- Loop
  loop BOOLEAN NOT NULL DEFAULT false,
  
  played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- NEW INDEXES
-- ════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_broadcast_stream_ingests ON broadcast_stream_ingests(project_id, status);
CREATE INDEX IF NOT EXISTS idx_broadcast_stream_outputs ON broadcast_stream_outputs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_broadcast_switcher_state ON broadcast_switcher_state(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_comms ON broadcast_comms_channels(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_broadcast_playout ON broadcast_playout_items(project_id, sort_order);

-- ════════════════════════════════════════════════════════════
-- NEW RLS POLICIES
-- ════════════════════════════════════════════════════════════

ALTER TABLE broadcast_stream_ingests ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_stream_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_switcher_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_comms_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_playout_items ENABLE ROW LEVEL SECURITY;

-- Stream ingests
DROP POLICY IF EXISTS "bcast_si_sel" ON broadcast_stream_ingests;
CREATE POLICY "bcast_si_sel" ON broadcast_stream_ingests FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_si_ins" ON broadcast_stream_ingests;
CREATE POLICY "bcast_si_ins" ON broadcast_stream_ingests FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_si_upd" ON broadcast_stream_ingests;
CREATE POLICY "bcast_si_upd" ON broadcast_stream_ingests FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_si_del" ON broadcast_stream_ingests;
CREATE POLICY "bcast_si_del" ON broadcast_stream_ingests FOR DELETE USING (is_broadcast_member(project_id));

-- Stream outputs
DROP POLICY IF EXISTS "bcast_so_sel" ON broadcast_stream_outputs;
CREATE POLICY "bcast_so_sel" ON broadcast_stream_outputs FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_so_ins" ON broadcast_stream_outputs;
CREATE POLICY "bcast_so_ins" ON broadcast_stream_outputs FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_so_upd" ON broadcast_stream_outputs;
CREATE POLICY "bcast_so_upd" ON broadcast_stream_outputs FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_so_del" ON broadcast_stream_outputs;
CREATE POLICY "bcast_so_del" ON broadcast_stream_outputs FOR DELETE USING (is_broadcast_member(project_id));

-- Switcher state
DROP POLICY IF EXISTS "bcast_sw_sel" ON broadcast_switcher_state;
CREATE POLICY "bcast_sw_sel" ON broadcast_switcher_state FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_sw_ins" ON broadcast_switcher_state;
CREATE POLICY "bcast_sw_ins" ON broadcast_switcher_state FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_sw_upd" ON broadcast_switcher_state;
CREATE POLICY "bcast_sw_upd" ON broadcast_switcher_state FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_sw_del" ON broadcast_switcher_state;
CREATE POLICY "bcast_sw_del" ON broadcast_switcher_state FOR DELETE USING (is_broadcast_member(project_id));

-- Comms channels
DROP POLICY IF EXISTS "bcast_cc_sel" ON broadcast_comms_channels;
CREATE POLICY "bcast_cc_sel" ON broadcast_comms_channels FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_cc_ins" ON broadcast_comms_channels;
CREATE POLICY "bcast_cc_ins" ON broadcast_comms_channels FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_cc_upd" ON broadcast_comms_channels;
CREATE POLICY "bcast_cc_upd" ON broadcast_comms_channels FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_cc_del" ON broadcast_comms_channels;
CREATE POLICY "bcast_cc_del" ON broadcast_comms_channels FOR DELETE USING (is_broadcast_member(project_id));

-- Playout items
DROP POLICY IF EXISTS "bcast_pl_sel" ON broadcast_playout_items;
CREATE POLICY "bcast_pl_sel" ON broadcast_playout_items FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_pl_ins" ON broadcast_playout_items;
CREATE POLICY "bcast_pl_ins" ON broadcast_playout_items FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_pl_upd" ON broadcast_playout_items;
CREATE POLICY "bcast_pl_upd" ON broadcast_playout_items FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "bcast_pl_del" ON broadcast_playout_items;
CREATE POLICY "bcast_pl_del" ON broadcast_playout_items FOR DELETE USING (is_broadcast_member(project_id));

-- New triggers
DROP TRIGGER IF EXISTS trg_broadcast_stream_ingests_updated ON broadcast_stream_ingests;
CREATE TRIGGER trg_broadcast_stream_ingests_updated BEFORE UPDATE ON broadcast_stream_ingests FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
DROP TRIGGER IF EXISTS trg_broadcast_stream_outputs_updated ON broadcast_stream_outputs;
CREATE TRIGGER trg_broadcast_stream_outputs_updated BEFORE UPDATE ON broadcast_stream_outputs FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
DROP TRIGGER IF EXISTS trg_broadcast_switcher_state_updated ON broadcast_switcher_state;
CREATE TRIGGER trg_broadcast_switcher_state_updated BEFORE UPDATE ON broadcast_switcher_state FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
DROP TRIGGER IF EXISTS trg_broadcast_comms_updated ON broadcast_comms_channels;
CREATE TRIGGER trg_broadcast_comms_updated BEFORE UPDATE ON broadcast_comms_channels FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();
DROP TRIGGER IF EXISTS trg_broadcast_playout_updated ON broadcast_playout_items;
CREATE TRIGGER trg_broadcast_playout_updated BEFORE UPDATE ON broadcast_playout_items FOR EACH ROW EXECUTE FUNCTION broadcast_set_updated_at();

-- ════════════════════════════════════════════════════════════
-- REALTIME — Enable Supabase Realtime on key tables
-- ════════════════════════════════════════════════════════════
-- Note: Run these in Supabase Dashboard > Database > Replication
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stories;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_rundowns;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_rundown_items;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_wire_stories;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_as_run_log;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_switcher_state;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stream_ingests;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stream_outputs;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_playout_items;
-- ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_comms_channels;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_broadcast_contacts.sql
-- ---------------------------------------------------------------------
-- Migration: broadcast_contacts table
-- Editorial contacts / source rolodex for TV production projects
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS broadcast_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  organisation TEXT,
  phone TEXT,
  email TEXT,
  category TEXT NOT NULL DEFAULT 'expert'
    CHECK (category IN ('expert','official','spokesperson','witness','reporter','photographer','producer','fixer','tipster','other')),
  relationship TEXT NOT NULL DEFAULT 'cold'
    CHECK (relationship IN ('cold','warm','trusted')),
  topic_area TEXT,
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcast_contacts_project ON broadcast_contacts(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_contacts_category ON broadcast_contacts(project_id, category);
CREATE INDEX IF NOT EXISTS idx_broadcast_contacts_relationship ON broadcast_contacts(project_id, relationship);

-- RLS
ALTER TABLE broadcast_contacts ENABLE ROW LEVEL SECURITY;

-- Members of the project can read
CREATE POLICY "broadcast_contacts_select" ON broadcast_contacts
  FOR SELECT USING (is_broadcast_member(project_id));

-- Members can insert
CREATE POLICY "broadcast_contacts_insert" ON broadcast_contacts
  FOR INSERT WITH CHECK (is_broadcast_member(project_id));

-- Members can update
CREATE POLICY "broadcast_contacts_update" ON broadcast_contacts
  FOR UPDATE USING (is_broadcast_member(project_id));

-- Members can delete
CREATE POLICY "broadcast_contacts_delete" ON broadcast_contacts
  FOR DELETE USING (is_broadcast_member(project_id));

-- updated_at trigger
CREATE TRIGGER broadcast_contacts_updated_at
  BEFORE UPDATE ON broadcast_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Source: supabase/migration_broadcast_grants.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Broadcast Tables — Missing GRANT fix
-- 
-- The original migration_broadcast.sql created all tables with 
-- RLS policies but never granted table-level access to the 
-- `authenticated` role. PostgREST requires GRANTs to expose 
-- tables in its schema cache.
--
-- Safe to re-run: GRANT is idempotent in PostgreSQL.
-- ============================================================

-- Core editorial tables
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_stories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_story_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_rundowns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_rundown_items TO authenticated;

-- Wire feeds
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_wire_feeds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_wire_stories TO authenticated;

-- Sources & devices
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_mos_devices TO authenticated;

-- Graphics
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_graphics_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_graphics_cues TO authenticated;

-- Logging & timing
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_as_run_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_timing_marks TO authenticated;

-- Stream ingest & output (the ones causing the error)
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_stream_ingests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_stream_outputs TO authenticated;

-- Vision mixer / switcher
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_switcher_state TO authenticated;

-- Comms / intercom
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_comms_channels TO authenticated;

-- Playout / master control
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_playout_items TO authenticated;

-- Contacts
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_contacts TO authenticated;

-- Grant execute on the helper function
GRANT EXECUTE ON FUNCTION is_broadcast_member(UUID) TO authenticated;

-- Enable Supabase Realtime on key broadcast tables (safe if already added)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_switcher_state; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stream_ingests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stream_outputs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_playout_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_rundown_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_as_run_log; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Source: supabase/migration_broadcast_patch.sql
-- ---------------------------------------------------------------------
-- ════════════════════════════════════════════════════════════
-- Broadcast Schema Patch — run this if you already applied
-- migration_broadcast.sql and need the missing columns
-- ════════════════════════════════════════════════════════════

-- 1. broadcast_comms_channels: add description + created_by
ALTER TABLE broadcast_comms_channels ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE broadcast_comms_channels ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. broadcast_stream_ingests: add connection timestamps + audio metadata + is_active
ALTER TABLE broadcast_stream_ingests ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;
ALTER TABLE broadcast_stream_ingests ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;
ALTER TABLE broadcast_stream_ingests ADD COLUMN IF NOT EXISTS audio_sample_rate INTEGER;
ALTER TABLE broadcast_stream_ingests ADD COLUMN IF NOT EXISTS audio_channels INTEGER;
ALTER TABLE broadcast_stream_ingests ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 3. broadcast_stream_outputs: no changes needed (uses status field)

-- Notes:
-- broadcast_stories.prompter_text was NOT added — the prompter page
-- now correctly reads script_text from stories and prompter_text from
-- broadcast_rundown_items (which already has that column).
--
-- broadcast_rundowns.air_date was never a column — the code incorrectly
-- used .order('air_date') but the column is show_date. Code is fixed.

-- ---------------------------------------------------------------------
-- Source: supabase/migration_broadcast_v2.sql
-- ---------------------------------------------------------------------
-- ════════════════════════════════════════════════════════════
-- Broadcast System v2 — Clean single migration
-- Safe to re-run (idempotent: DROP IF EXISTS + CREATE)
-- ════════════════════════════════════════════════════════════

-- ─── Helper: is_broadcast_member ───────────────────────────
-- Returns true if user owns the project or is a project member.
CREATE OR REPLACE FUNCTION is_broadcast_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM project_members WHERE project_id = p_project_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ════════════════════════════════════════════════════════════
-- 1. broadcast_stories
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_stories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL DEFAULT 'Untitled',
  body         JSONB,
  script_text  TEXT,
  status       TEXT NOT NULL DEFAULT 'draft',
  story_type   TEXT NOT NULL DEFAULT 'reader',
  priority     INT  NOT NULL DEFAULT 0,
  assigned_to  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source       TEXT,
  wire_story_id UUID,
  estimated_duration INT,
  embargo_until TIMESTAMPTZ,
  version      INT  NOT NULL DEFAULT 1,
  locked_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at    TIMESTAMPTZ,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_stories_project ON broadcast_stories(project_id);

ALTER TABLE broadcast_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_stories_select" ON broadcast_stories;
CREATE POLICY "broadcast_stories_select" ON broadcast_stories FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stories_insert" ON broadcast_stories;
CREATE POLICY "broadcast_stories_insert" ON broadcast_stories FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stories_update" ON broadcast_stories;
CREATE POLICY "broadcast_stories_update" ON broadcast_stories FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stories_delete" ON broadcast_stories;
CREATE POLICY "broadcast_stories_delete" ON broadcast_stories FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 2. broadcast_rundowns
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_rundowns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'Untitled Rundown',
  show_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  scheduled_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_end   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  actual_start    TIMESTAMPTZ,
  actual_end      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'planning',
  template_id     UUID,
  is_template     BOOLEAN NOT NULL DEFAULT FALSE,
  locked          BOOLEAN NOT NULL DEFAULT FALSE,
  locked_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_rundowns_project ON broadcast_rundowns(project_id);

ALTER TABLE broadcast_rundowns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_rundowns_select" ON broadcast_rundowns;
CREATE POLICY "broadcast_rundowns_select" ON broadcast_rundowns FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_rundowns_insert" ON broadcast_rundowns;
CREATE POLICY "broadcast_rundowns_insert" ON broadcast_rundowns FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_rundowns_update" ON broadcast_rundowns;
CREATE POLICY "broadcast_rundowns_update" ON broadcast_rundowns FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_rundowns_delete" ON broadcast_rundowns;
CREATE POLICY "broadcast_rundowns_delete" ON broadcast_rundowns FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 3. broadcast_rundown_items
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_rundown_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rundown_id       UUID NOT NULL REFERENCES broadcast_rundowns(id) ON DELETE CASCADE,
  story_id         UUID REFERENCES broadcast_stories(id) ON DELETE SET NULL,
  sort_order       INT NOT NULL DEFAULT 0,
  page_number      TEXT,
  segment_slug     TEXT,
  title            TEXT NOT NULL DEFAULT '',
  item_type        TEXT NOT NULL DEFAULT 'anchor_read',
  planned_duration INT NOT NULL DEFAULT 30,
  actual_duration  INT,
  back_time        TEXT,
  back_time_target TEXT,
  is_float         BOOLEAN NOT NULL DEFAULT FALSE,
  is_break         BOOLEAN NOT NULL DEFAULT FALSE,
  status           TEXT NOT NULL DEFAULT 'pending',
  camera           TEXT,
  audio_source     TEXT,
  audio_notes      TEXT,
  video_source     TEXT,
  graphics_id      UUID,
  graphics_notes   TEXT,
  prompter_text    TEXT,
  presenter        TEXT,
  reporter         TEXT,
  director_notes   TEXT,
  technical_notes  TEXT,
  production_notes TEXT,
  media_id         TEXT,
  media_in_point   TEXT,
  media_out_point  TEXT,
  media_duration   INT,
  color            TEXT,
  on_air_at        TIMESTAMPTZ,
  off_air_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_rundown_items_rundown ON broadcast_rundown_items(rundown_id);

ALTER TABLE broadcast_rundown_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_rundown_items_select" ON broadcast_rundown_items;
CREATE POLICY "broadcast_rundown_items_select" ON broadcast_rundown_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));
DROP POLICY IF EXISTS "broadcast_rundown_items_insert" ON broadcast_rundown_items;
CREATE POLICY "broadcast_rundown_items_insert" ON broadcast_rundown_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));
DROP POLICY IF EXISTS "broadcast_rundown_items_update" ON broadcast_rundown_items;
CREATE POLICY "broadcast_rundown_items_update" ON broadcast_rundown_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));
DROP POLICY IF EXISTS "broadcast_rundown_items_delete" ON broadcast_rundown_items;
CREATE POLICY "broadcast_rundown_items_delete" ON broadcast_rundown_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM broadcast_rundowns r WHERE r.id = rundown_id AND is_broadcast_member(r.project_id)));

-- ════════════════════════════════════════════════════════════
-- 4. broadcast_sources
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  short_name      TEXT,
  source_type     TEXT NOT NULL DEFAULT 'camera',
  protocol        TEXT,
  connection_url  TEXT,
  ndi_source_name TEXT,
  srt_passphrase  TEXT,
  nmos_node_id    TEXT,
  nmos_sender_id  TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  tally_state     TEXT NOT NULL DEFAULT 'off',
  thumbnail_url   TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_sources_project ON broadcast_sources(project_id);

ALTER TABLE broadcast_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_sources_select" ON broadcast_sources;
CREATE POLICY "broadcast_sources_select" ON broadcast_sources FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_sources_insert" ON broadcast_sources;
CREATE POLICY "broadcast_sources_insert" ON broadcast_sources FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_sources_update" ON broadcast_sources;
CREATE POLICY "broadcast_sources_update" ON broadcast_sources FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_sources_delete" ON broadcast_sources;
CREATE POLICY "broadcast_sources_delete" ON broadcast_sources FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 5. broadcast_stream_ingests
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_stream_ingests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  label            TEXT,
  protocol         TEXT NOT NULL DEFAULT 'rtmp',
  ingest_url       TEXT NOT NULL DEFAULT 'rtmp://localhost:1935/live',
  stream_key       TEXT NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  pull_url         TEXT,
  status           TEXT NOT NULL DEFAULT 'idle',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  video_codec      TEXT,
  audio_codec      TEXT,
  width            INT,
  height           INT,
  fps              REAL,
  bitrate_kbps     INT,
  audio_sample_rate INT,
  audio_channels   INT,
  last_keyframe_at TIMESTAMPTZ,
  dropped_frames   INT NOT NULL DEFAULT 0,
  uptime_seconds   INT NOT NULL DEFAULT 0,
  auto_source      BOOLEAN NOT NULL DEFAULT TRUE,
  linked_source_id UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  connected_at     TIMESTAMPTZ,
  disconnected_at  TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_stream_ingests_project ON broadcast_stream_ingests(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_stream_ingests_key ON broadcast_stream_ingests(stream_key);

ALTER TABLE broadcast_stream_ingests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_stream_ingests_select" ON broadcast_stream_ingests;
CREATE POLICY "broadcast_stream_ingests_select" ON broadcast_stream_ingests FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stream_ingests_insert" ON broadcast_stream_ingests;
CREATE POLICY "broadcast_stream_ingests_insert" ON broadcast_stream_ingests FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stream_ingests_update" ON broadcast_stream_ingests;
CREATE POLICY "broadcast_stream_ingests_update" ON broadcast_stream_ingests FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stream_ingests_delete" ON broadcast_stream_ingests;
CREATE POLICY "broadcast_stream_ingests_delete" ON broadcast_stream_ingests FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 6. broadcast_stream_outputs
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_stream_outputs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  platform           TEXT NOT NULL DEFAULT 'custom',
  rtmp_url           TEXT,
  stream_key         TEXT,
  srt_url            TEXT,
  video_bitrate_kbps INT NOT NULL DEFAULT 4500,
  audio_bitrate_kbps INT NOT NULL DEFAULT 128,
  resolution         TEXT NOT NULL DEFAULT '1920x1080',
  fps                INT NOT NULL DEFAULT 30,
  status             TEXT NOT NULL DEFAULT 'idle',
  error_message      TEXT,
  started_at         TIMESTAMPTZ,
  uptime_seconds     INT NOT NULL DEFAULT 0,
  bytes_sent         BIGINT NOT NULL DEFAULT 0,
  is_primary         BOOLEAN NOT NULL DEFAULT FALSE,
  auto_start         BOOLEAN NOT NULL DEFAULT FALSE,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_stream_outputs_project ON broadcast_stream_outputs(project_id);

ALTER TABLE broadcast_stream_outputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_stream_outputs_select" ON broadcast_stream_outputs;
CREATE POLICY "broadcast_stream_outputs_select" ON broadcast_stream_outputs FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stream_outputs_insert" ON broadcast_stream_outputs;
CREATE POLICY "broadcast_stream_outputs_insert" ON broadcast_stream_outputs FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stream_outputs_update" ON broadcast_stream_outputs;
CREATE POLICY "broadcast_stream_outputs_update" ON broadcast_stream_outputs FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_stream_outputs_delete" ON broadcast_stream_outputs;
CREATE POLICY "broadcast_stream_outputs_delete" ON broadcast_stream_outputs FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 7. broadcast_switcher_state
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_switcher_state (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  program_source_id      UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  preview_source_id      UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  transition_type        TEXT NOT NULL DEFAULT 'cut',
  transition_duration_ms INT NOT NULL DEFAULT 500,
  auto_transition        BOOLEAN NOT NULL DEFAULT FALSE,
  dsk_1_source_id        UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  dsk_1_on_air           BOOLEAN NOT NULL DEFAULT FALSE,
  dsk_2_source_id        UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  dsk_2_on_air           BOOLEAN NOT NULL DEFAULT FALSE,
  usk_1_type             TEXT,
  usk_1_source_id        UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  usk_1_on_air           BOOLEAN NOT NULL DEFAULT FALSE,
  audio_follow_video     BOOLEAN NOT NULL DEFAULT TRUE,
  ftb_active             BOOLEAN NOT NULL DEFAULT FALSE,
  pip_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  pip_source_id          UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  pip_position           TEXT DEFAULT 'bottom_right',
  pip_size               REAL NOT NULL DEFAULT 25.0,
  last_take_at           TIMESTAMPTZ,
  operator_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_switcher_state_project ON broadcast_switcher_state(project_id);

ALTER TABLE broadcast_switcher_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_switcher_state_select" ON broadcast_switcher_state;
CREATE POLICY "broadcast_switcher_state_select" ON broadcast_switcher_state FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_switcher_state_insert" ON broadcast_switcher_state;
CREATE POLICY "broadcast_switcher_state_insert" ON broadcast_switcher_state FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_switcher_state_update" ON broadcast_switcher_state;
CREATE POLICY "broadcast_switcher_state_update" ON broadcast_switcher_state FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_switcher_state_delete" ON broadcast_switcher_state;
CREATE POLICY "broadcast_switcher_state_delete" ON broadcast_switcher_state FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 8. broadcast_as_run_log
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_as_run_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rundown_id        UUID REFERENCES broadcast_rundowns(id) ON DELETE SET NULL,
  rundown_item_id   UUID REFERENCES broadcast_rundown_items(id) ON DELETE SET NULL,
  event_type        TEXT NOT NULL DEFAULT 'manual_note',
  title             TEXT NOT NULL DEFAULT '',
  planned_time      TIMESTAMPTZ,
  actual_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  planned_duration  INT,
  actual_duration   INT,
  deviation_seconds INT NOT NULL DEFAULT 0,
  source            TEXT,
  operator          TEXT,
  notes             TEXT,
  is_automatic      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_as_run_log_project ON broadcast_as_run_log(project_id);

ALTER TABLE broadcast_as_run_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_as_run_log_select" ON broadcast_as_run_log;
CREATE POLICY "broadcast_as_run_log_select" ON broadcast_as_run_log FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_as_run_log_insert" ON broadcast_as_run_log;
CREATE POLICY "broadcast_as_run_log_insert" ON broadcast_as_run_log FOR INSERT WITH CHECK (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 9. broadcast_playout_items
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_playout_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sort_order             INT NOT NULL DEFAULT 0,
  title                  TEXT NOT NULL DEFAULT '',
  item_type              TEXT NOT NULL DEFAULT 'clip',
  media_url              TEXT,
  media_type             TEXT,
  thumbnail_url          TEXT,
  duration_seconds       INT NOT NULL DEFAULT 0,
  in_point_ms            INT NOT NULL DEFAULT 0,
  out_point_ms           INT,
  transition_type        TEXT,
  transition_duration_ms INT NOT NULL DEFAULT 0,
  auto_next              BOOLEAN NOT NULL DEFAULT TRUE,
  status                 TEXT NOT NULL DEFAULT 'queued',
  source_id              UUID REFERENCES broadcast_sources(id) ON DELETE SET NULL,
  loop                   BOOLEAN NOT NULL DEFAULT FALSE,
  played_at              TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_playout_items_project ON broadcast_playout_items(project_id);

ALTER TABLE broadcast_playout_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_playout_items_select" ON broadcast_playout_items;
CREATE POLICY "broadcast_playout_items_select" ON broadcast_playout_items FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_playout_items_insert" ON broadcast_playout_items;
CREATE POLICY "broadcast_playout_items_insert" ON broadcast_playout_items FOR INSERT WITH CHECK (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_playout_items_update" ON broadcast_playout_items;
CREATE POLICY "broadcast_playout_items_update" ON broadcast_playout_items FOR UPDATE USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_playout_items_delete" ON broadcast_playout_items;
CREATE POLICY "broadcast_playout_items_delete" ON broadcast_playout_items FOR DELETE USING (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- 10. broadcast_timing_marks (used by timing API)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_timing_marks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rundown_id           UUID NOT NULL REFERENCES broadcast_rundowns(id) ON DELETE CASCADE,
  rundown_item_id      UUID REFERENCES broadcast_rundown_items(id) ON DELETE SET NULL,
  mark_type            TEXT NOT NULL DEFAULT 'marker',
  wall_time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  show_elapsed_seconds INT,
  operator_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_timing_marks_rundown ON broadcast_timing_marks(rundown_id);

ALTER TABLE broadcast_timing_marks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcast_timing_marks_select" ON broadcast_timing_marks;
CREATE POLICY "broadcast_timing_marks_select" ON broadcast_timing_marks FOR SELECT USING (is_broadcast_member(project_id));
DROP POLICY IF EXISTS "broadcast_timing_marks_insert" ON broadcast_timing_marks;
CREATE POLICY "broadcast_timing_marks_insert" ON broadcast_timing_marks FOR INSERT WITH CHECK (is_broadcast_member(project_id));

-- ════════════════════════════════════════════════════════════
-- updated_at triggers
-- ════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS update_broadcast_stories_updated_at ON broadcast_stories;
CREATE TRIGGER update_broadcast_stories_updated_at
  BEFORE UPDATE ON broadcast_stories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_rundowns_updated_at ON broadcast_rundowns;
CREATE TRIGGER update_broadcast_rundowns_updated_at
  BEFORE UPDATE ON broadcast_rundowns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_rundown_items_updated_at ON broadcast_rundown_items;
CREATE TRIGGER update_broadcast_rundown_items_updated_at
  BEFORE UPDATE ON broadcast_rundown_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_sources_updated_at ON broadcast_sources;
CREATE TRIGGER update_broadcast_sources_updated_at
  BEFORE UPDATE ON broadcast_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_stream_ingests_updated_at ON broadcast_stream_ingests;
CREATE TRIGGER update_broadcast_stream_ingests_updated_at
  BEFORE UPDATE ON broadcast_stream_ingests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_stream_outputs_updated_at ON broadcast_stream_outputs;
CREATE TRIGGER update_broadcast_stream_outputs_updated_at
  BEFORE UPDATE ON broadcast_stream_outputs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_playout_items_updated_at ON broadcast_playout_items;
CREATE TRIGGER update_broadcast_playout_items_updated_at
  BEFORE UPDATE ON broadcast_playout_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ════════════════════════════════════════════════════════════
-- GRANTs — required for PostgREST to expose tables
-- ════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_stories          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_rundowns         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_rundown_items    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_sources          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_stream_ingests   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_stream_outputs   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_switcher_state   TO authenticated;
GRANT SELECT, INSERT                ON broadcast_as_run_log        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcast_playout_items    TO authenticated;
GRANT SELECT, INSERT                ON broadcast_timing_marks      TO authenticated;

-- Service role needs full access (media server uses service key)
GRANT ALL ON broadcast_stories          TO service_role;
GRANT ALL ON broadcast_rundowns         TO service_role;
GRANT ALL ON broadcast_rundown_items    TO service_role;
GRANT ALL ON broadcast_sources          TO service_role;
GRANT ALL ON broadcast_stream_ingests   TO service_role;
GRANT ALL ON broadcast_stream_outputs   TO service_role;
GRANT ALL ON broadcast_switcher_state   TO service_role;
GRANT ALL ON broadcast_as_run_log       TO service_role;
GRANT ALL ON broadcast_playout_items    TO service_role;
GRANT ALL ON broadcast_timing_marks     TO service_role;

-- ════════════════════════════════════════════════════════════
-- Realtime — add tables to supabase_realtime publication
-- ════════════════════════════════════════════════════════════
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stream_ingests;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_stream_outputs;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_sources;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_switcher_state;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_playout_items;    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_rundown_items;    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_as_run_log;       EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Force PostgREST to pick up new tables
NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════
-- Done. 10 tables, all with RLS, GRANTs, Realtime, triggers.
-- ════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------
-- Source: supabase/migration_changelog.sql
-- ---------------------------------------------------------------------
-- ============================================================
--  CHANGELOG & RELEASE TRACKING SYSTEM
--  Screenplay Studio — Platform Version History
--  Run in: Supabase Dashboard > SQL Editor
--  Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout
-- ============================================================
--
--  Tables:
--    changelog_releases  — one row per version (e.g. "1.4.0")
--    changelog_entries   — individual change items per release
--
--  Functions:
--    publish_release(v_number TEXT)
--      → marks a release as published and bumps site_settings.site_version
--
--  RLS:
--    Public read for published releases & entries
--    Admin-only write (same UUID as the rest of the platform)
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE changelog_release_status AS ENUM ('draft', 'published', 'yanked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE changelog_entry_type AS ENUM (
    'feature',      -- brand new capability
    'improvement',  -- existing feature made better
    'fix',          -- bug squashed
    'performance',  -- faster / lighter
    'security',     -- hardening, policy changes
    'breaking',     -- something changed in a way that affects existing behaviour
    'deprecation',  -- something is going away soon
    'internal'      -- infrastructure/dev-only change (hidden from public UI)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE changelog_area AS ENUM (
    'editor',
    'scripts',
    'scenes',
    'characters',
    'locations',
    'production',
    'schedule',
    'cast',
    'budget',
    'gear',
    'storyboard',
    'community',
    'challenges',
    'courses',
    'gamification',
    'collaboration',
    'documents',
    'versioning',
    'formats',
    'arc_planner',
    'work_tracking',
    'festival',
    'blog',
    'admin',
    'auth',
    'database',
    'performance',
    'api',
    'ui'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ──────────────────────────────────────────────────────────────
-- 2. changelog_releases — one row per platform version
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS changelog_releases (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Semantic version string: MAJOR.MINOR.PATCH
  version        TEXT        NOT NULL UNIQUE,

  -- Short title shown as the release headline e.g. "The Community Drop"
  title          TEXT        NOT NULL,

  -- Optional longer description / release notes intro paragraph
  summary        TEXT,

  -- Release type for UI badge
  release_type   TEXT        NOT NULL DEFAULT 'minor'
    CHECK (release_type IN ('major', 'minor', 'patch', 'hotfix')),

  status         changelog_release_status NOT NULL DEFAULT 'draft',

  -- When this was (or will be) shipped
  released_at    TIMESTAMPTZ,

  -- Optional blog post link
  blog_post_slug TEXT,

  -- Denormalized entry counts (filled by trigger)
  feature_count     INTEGER DEFAULT 0,
  improvement_count INTEGER DEFAULT 0,
  fix_count         INTEGER DEFAULT 0,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE changelog_releases IS
  'One row per platform release. publish_release() marks it published and
   bumps site_settings.site_version to this version string.';

CREATE INDEX IF NOT EXISTS idx_changelog_releases_status
  ON changelog_releases (status, released_at DESC);


-- ──────────────────────────────────────────────────────────────
-- 3. changelog_entries — individual change items per release
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS changelog_entries (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id   UUID         NOT NULL REFERENCES changelog_releases(id) ON DELETE CASCADE,

  -- Short one-line headline shown in the changelog list
  title        TEXT         NOT NULL,

  -- Optional longer description (markdown supported in the UI)
  description  TEXT,

  entry_type   changelog_entry_type NOT NULL DEFAULT 'feature',
  area         changelog_area       NOT NULL DEFAULT 'editor',

  -- Internal entries are logged but not shown in the public changelog UI
  is_public    BOOLEAN      NOT NULL DEFAULT true,

  -- Optional: link to related blog post section or docs page
  link_url     TEXT,

  -- Pull request / issue number for dev reference
  pr_number    INTEGER,

  sort_order   INTEGER      NOT NULL DEFAULT 0,

  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE changelog_entries IS
  'Individual changes within a release. Every feature, fix, and improvement
   gets its own row. Group them by release_id.';

CREATE INDEX IF NOT EXISTS idx_changelog_entries_release
  ON changelog_entries (release_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_type
  ON changelog_entries (entry_type, area);


-- ──────────────────────────────────────────────────────────────
-- 4. RLS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE changelog_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelog_entries  ENABLE ROW LEVEL SECURITY;

-- Public can read published releases
DROP POLICY IF EXISTS "changelog_releases_public_read" ON changelog_releases;
CREATE POLICY "changelog_releases_public_read" ON changelog_releases
  FOR SELECT USING (status = 'published');

-- Admin can do everything with releases
DROP POLICY IF EXISTS "changelog_releases_admin_all" ON changelog_releases;
CREATE POLICY "changelog_releases_admin_all" ON changelog_releases
  FOR ALL USING (auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

-- Public can read entries for published releases (and only public entries)
DROP POLICY IF EXISTS "changelog_entries_public_read" ON changelog_entries;
CREATE POLICY "changelog_entries_public_read" ON changelog_entries
  FOR SELECT USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM changelog_releases r
      WHERE r.id = release_id AND r.status = 'published'
    )
  );

-- Admin can do everything with entries
DROP POLICY IF EXISTS "changelog_entries_admin_all" ON changelog_entries;
CREATE POLICY "changelog_entries_admin_all" ON changelog_entries
  FOR ALL USING (auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);


-- ──────────────────────────────────────────────────────────────
-- 5. TRIGGER: auto-update updated_at on releases
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_changelog_release_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS changelog_releases_updated_at ON changelog_releases;
CREATE TRIGGER changelog_releases_updated_at
  BEFORE UPDATE ON changelog_releases
  FOR EACH ROW EXECUTE FUNCTION update_changelog_release_updated_at();


-- ──────────────────────────────────────────────────────────────
-- 6. TRIGGER: keep denormalized entry counts in sync
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_changelog_release_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_release_id UUID;
BEGIN
  -- Works on both INSERT and DELETE
  v_release_id := COALESCE(NEW.release_id, OLD.release_id);

  UPDATE changelog_releases SET
    feature_count     = (SELECT COUNT(*) FROM changelog_entries WHERE release_id = v_release_id AND entry_type = 'feature'     AND is_public = true),
    improvement_count = (SELECT COUNT(*) FROM changelog_entries WHERE release_id = v_release_id AND entry_type = 'improvement' AND is_public = true),
    fix_count         = (SELECT COUNT(*) FROM changelog_entries WHERE release_id = v_release_id AND entry_type = 'fix'         AND is_public = true),
    updated_at        = now()
  WHERE id = v_release_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_changelog_counts ON changelog_entries;
CREATE TRIGGER trg_sync_changelog_counts
  AFTER INSERT OR UPDATE OR DELETE ON changelog_entries
  FOR EACH ROW EXECUTE FUNCTION sync_changelog_release_counts();


-- ──────────────────────────────────────────────────────────────
-- 7. FUNCTION: publish_release(version_string)
--    Marks the release published, sets released_at, and bumps
--    site_settings.site_version to the new version.
--    Only callable by authenticated users (admin enforced by RLS).
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION publish_release(v_version TEXT)
RETURNS changelog_releases
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_release changelog_releases%ROWTYPE;
BEGIN
  -- Verify caller is admin
  IF auth.uid() != 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid THEN
    RAISE EXCEPTION 'Unauthorized: only admin can publish releases';
  END IF;

  -- Find and update the release
  UPDATE changelog_releases
  SET status      = 'published',
      released_at = COALESCE(released_at, now()),
      updated_at  = now()
  WHERE version = v_version
  RETURNING * INTO v_release;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Release version % not found', v_version;
  END IF;

  -- Bump the global site version
  INSERT INTO site_settings (key, value, updated_at)
  VALUES ('site_version', v_version, now())
  ON CONFLICT (key) DO UPDATE
    SET value      = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at;

  RETURN v_release;
END;
$$;

COMMENT ON FUNCTION publish_release(TEXT) IS
  'Marks a changelog release as published and updates site_settings.site_version.
   Call from the admin panel when a release is ready to go live.
   Example: SELECT publish_release(''2.6.0'');';


-- ──────────────────────────────────────────────────────────────
-- 8. HELPER VIEW: public changelog feed
--    Returns released versions with their entry counts, newest first.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public_changelog AS
SELECT
  r.id,
  r.version,
  r.title,
  r.summary,
  r.release_type,
  r.released_at,
  r.blog_post_slug,
  r.feature_count,
  r.improvement_count,
  r.fix_count,
  r.feature_count + r.improvement_count + r.fix_count AS total_changes
FROM changelog_releases r
WHERE r.status = 'published'
ORDER BY r.released_at DESC;

GRANT SELECT ON public_changelog TO authenticated, anon;


-- ──────────────────────────────────────────────────────────────
-- 9. SEED DATA — full version history of the platform
--    (all released as published with historical dates)
-- ──────────────────────────────────────────────────────────────

-- ── Releases ─────────────────────────────────────────────────

INSERT INTO changelog_releases
  (version, title, summary, release_type, status, released_at)
VALUES

  ('1.0.0', 'The Beginning', 
   'The original Screenplay Studio launch. Screenplay formatting that doesn''t make you want to throw your laptop out the window, real-time collaboration that actually works, and a project management layer that respects how productions actually operate.',
   'major', 'published', '2025-01-15 12:00:00+00'),

  ('1.1.0', 'The Community Drop',
   'Writers deserve a place to share work, get feedback, and compete. The Community Hub changes the platform from a private tool into a living ecosystem where scripts get read, rated, and — eventually — made.',
   'minor', 'published', '2025-02-10 12:00:00+00'),

  ('1.2.0', 'Full Pre-Production',
   'The shot list, storyboard, continuity sheet, call sheets, and Day Out of Days. Everything the AD and DP need to turn a script into a shooting plan without leaving the platform.',
   'minor', 'published', '2025-03-05 12:00:00+00'),

  ('1.3.0', 'Cast & Payroll',
   'Manage your actors like a production company. Full cast profiles, pay rates in any currency, a payment ledger with overdue detection, and a locked-down document vault for contracts and permits.',
   'minor', 'published', '2025-03-28 12:00:00+00'),

  ('1.4.0', 'Gamification',
   'Writing is hard. XP, badges, streaks, and levels are a small bribe to keep going. They work. Don''t overthink it.',
   'minor', 'published', '2025-04-18 12:00:00+00'),

  ('1.5.0', 'The Learning Studio',
   'A full course system built into the platform. Enroll, track progress lesson by lesson, earn XP on completion, and — once you hit level 10 — create your own courses for the community.',
   'minor', 'published', '2025-05-12 12:00:00+00'),

  ('1.6.0', 'Series & Arc Planning',
   'TV writers needed a writers room tool, not just a script editor. The Arc & Episode Planner adds a visual season grid, arc tracking, episode-by-episode status, and showrunner lock controls.',
   'minor', 'published', '2025-06-03 12:00:00+00'),

  ('1.7.0', 'Stage & Audio',
   'Screenplay format is not the only format. Stage play mode and audio drama / podcast mode are now first-class citizens with their own element types, export formats, and format-specific metadata.',
   'minor', 'published', '2025-06-25 12:00:00+00'),

  ('1.8.0', 'Broadcast Mode',
   'News, promos, and live TV scripts use a two-column A/V format that has nothing in common with screenplays. Broadcast mode adds the full A/V editor, SUPER elements, VO/SOT distinction, and a broadcast contacts database.',
   'minor', 'published', '2025-07-14 12:00:00+00'),

  ('1.9.0', 'Work Time Tracking',
   'Know how many hours you actually spent on a project. Heartbeat-based session tracking with smart idle detection, per-context breakdown, and team-visible hours for project owners.',
   'minor', 'published', '2025-08-01 12:00:00+00'),

  ('2.0.0', 'The Big Two',
   'A major release: Git-inspired script branching, the Festival Bridge for the festival circuit, advanced script versioning with diff and merge, and the full production tools suite brought to full maturity.',
   'major', 'published', '2025-09-20 12:00:00+00'),

  ('2.1.0', 'Subcommunities',
   'The Community Hub gets depth. Genre-specific and topic-specific subcommunities with their own feeds, moderators, charter rules, and dedicated chat channels.',
   'minor', 'published', '2025-10-08 12:00:00+00'),

  ('2.2.0', 'White-Label & Client Customisation',
   'Run Screenplay Studio under your own company name and logo. Custom domains, branded emails, color themes, and per-workspace feature visibility. Built for agencies and production companies.',
   'minor', 'published', '2025-10-30 12:00:00+00'),

  ('2.3.0', 'Feature Flags & Labs',
   'Gradual rollouts, opt-in experiments, and emergency kill switches. Every new feature now goes through the flags system. Users get a Labs tab to opt into betas early.',
   'minor', 'published', '2025-11-14 12:00:00+00'),

  ('2.4.0', 'Folders & Organization',
   'Personal project folders with nesting support, dashboard-level shared folders for teams, and a full drag-and-drop tree for organizing a large project slate without scrolling forever.',
   'minor', 'published', '2025-12-02 12:00:00+00'),

  ('2.5.0', 'Production Operations',
   'The continuity sheet, call sheets, Day Out of Days, script coverage, and table read tracking are now fully integrated into shoot day planning. Props and costume tracking per scene via the scene breakdown panel.',
   'minor', 'published', '2026-01-09 12:00:00+00'),

  ('2.6.0', 'The Changelog',
   'Meta milestone: the platform now has a proper versioned changelog with release notes, change categorization by type and area, and a public feed. The site version number in the footer is now live and kept automatically in sync.',
   'minor', 'published', '2026-03-11 12:00:00+00')

ON CONFLICT (version) DO NOTHING;


-- ── Entries for v1.0.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.0.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Script editor with industry-standard element types', 'Scene headings, action, dialogue, character, parenthetical, transition, shot, and internal note elements. Each line is a separate database record enabling conflict-free real-time editing.', 'feature', 'editor', 1),
  ('Real-time multi-user collaboration', 'Multiple writers can edit simultaneously. Changes arrive via WebSocket in milliseconds. Cursor presence shows where each collaborator is in the document.', 'feature', 'collaboration', 2),
  ('Projects with role-based access control', 'Owner, Admin, Editor, Viewer roles enforced at the database level via Row Level Security on every table.', 'feature', 'editor', 3),
  ('Scene management panel', 'Bird''s eye view of all scenes. Drag to reorder, click to navigate, track page count and screen time estimates, add color coding and tags.', 'feature', 'scenes', 4),
  ('Character bible', 'Full character profiles with biography, arc notes, relationships, and auto-population from script parsing.', 'feature', 'characters', 5),
  ('Location database', 'Master location library with GPS, contact info, rental rates, photo gallery, permit tracking, and reuse across scenes.', 'feature', 'locations', 6),
  ('Production schedule (calendar)', 'Full calendar with event types: shooting, rehearsal, table read, scout, meeting, and more. Call times, wrap times, crew assignment.', 'feature', 'schedule', 7),
  ('Ideas board (Kanban)', 'SPARK → EXPLORING → PROMISING → IN SCRIPT → SHELVED columns. Category, priority, tags, reference URLs, and collaborator assignment per card.', 'feature', 'editor', 8),
  ('Budget tracker', 'Line-item budget with above-the-line / below-the-line categories, estimated vs actual tracking, and variance warnings.', 'feature', 'budget', 9),
  ('Auto-save on every keystroke', 'No Save button. Every edit is persisted immediately. You will never lose work.', 'feature', 'editor', 10),
  ('Threaded comments on any entity', 'Attach threaded discussion to scenes, characters, shots, locations, ideas, and more. Realtime delivery. Resolved/unresolved tracking.', 'feature', 'collaboration', 11),
  ('Project invitations by email', 'Invite collaborators by email. Invitation status tracked (pending, accepted, declined, expired). Auto-cleanup.', 'feature', 'collaboration', 12),
  ('Auto-create project owner and first script on signup', 'Database triggers handle profile creation on signup, owner membership on project create, and Draft 1 script creation automatically.', 'feature', 'database', 13),
  ('Full-text search across scripts', 'GIN index on script content for millisecond full-text search with English stemming. Trigram index on character names for fuzzy matching.', 'feature', 'scripts', 14),
  ('Industry revision color system', 'WHITE, BLUE, PINK, YELLOW, GREEN, GOLDENROD, BUFF, SALMON, CHERRY… snapshot-based revision history with full JSONB element snapshots per revision.', 'feature', 'versioning', 15)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.1.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.1.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Community Hub — share scripts publicly', 'Publish any script to the Community with fine-grained permission flags: allow comments, suggestions, edits, distros, or free use.', 'feature', 'community', 1),
  ('Community categories', 'Feature Film, Short Film, TV/Series, Web Series, Documentary, Animation, Horror, Comedy, Drama, Sci-Fi tags for browsing and discovery.', 'feature', 'community', 2),
  ('Upvote system', 'One upvote per user per post. toggle_community_upvote() handles it atomically — no race conditions, no double votes.', 'feature', 'community', 3),
  ('Community comments & suggestions', 'Threaded comments and line-level suggestions on shared scripts. Hidden-not-deleted moderation for admin.', 'feature', 'community', 4),
  ('Script Distros (forks)', 'Writers can fork any script with allow_distros enabled, creating a visible lineage of interpretations.', 'feature', 'community', 5),
  ('Free-Use Library', 'Mark a script allow_free_use to place it in the library. Any filmmaker can produce it without asking. Copyright disclaimer required.', 'feature', 'community', 6),
  ('Script Productions', 'Filmmakers submit produced films back to the original script page. Admin-moderated (pending → approved/rejected).', 'feature', 'community', 7),
  ('Weekly Writing Challenges (automated)', 'Auto-launches every Monday. ensure_weekly_challenge() picks a theme, sets the submission/voting/reveal schedule. compute_challenge_results() ranks winners.', 'feature', 'challenges', 8),
  ('Challenge theme pool with 20 seed themes', 'The Last Day, Wrong Number, Silent Protagonist, Time Loop, Found Footage, and 15 more. Tracks usage count so repeats are spaced out.', 'feature', 'challenges', 9),
  ('Community blog', 'Blog post system with sections-based JSONB structure, threaded comments, view counter, and admin-only authoring.', 'feature', 'blog', 10)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.2.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.2.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Shot list per scene', 'Full shot records: shot type, movement, lens, description, camera/lighting/sound notes, VFX flag, takes needed vs completed, storyboard URL.', 'feature', 'storyboard', 1),
  ('Storyboard panels', 'Visual storyboard linked to shots. Frame images, panel notes, audio cues, transition types, camera framing overlay. Exportable as PDF.', 'feature', 'storyboard', 2),
  ('Shoot days module', 'Day-by-day production plans with call times, per-department crew calls, scenes per day, page estimates, and location assignments.', 'feature', 'schedule', 3),
  ('Continuity sheet', 'Per-character continuity tracking: costume, hair, makeup, props, wounds, reference photo. Linked to specific scenes and characters.', 'feature', 'production', 4),
  ('Call sheets', 'Structured call sheet generator: general call, base camp, hospital, parking, weather note, crew calls as JSONB, advanced schedule.', 'feature', 'production', 5),
  ('Day Out of Days (DOOD)', 'Actor scheduling grid using industry codes: SW (start/work), W (work), WF (work/finish), H (hold), T (travel), etc.', 'feature', 'production', 6),
  ('Multi-location markers', 'Attach multiple physical locations to a single scripted location. Exterior shot here, interior shot there.', 'feature', 'locations', 7),
  ('Scene breakdown fields', 'Props, costumes, makeup notes, special effects, stunts, vehicles, animals, sound notes, music cues, VFX notes — all stored per scene for production breakdown.', 'feature', 'scenes', 8)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.3.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.3.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Cast members module', 'Full actor profiles with character roles, contact info, photo, bio, availability, and custom JSONB metadata.', 'feature', 'cast', 1),
  ('Pay rates in any currency', 'Hourly, daily, weekly, monthly, flat, or per-episode rates. Any ISO currency code. DECIMAL(12,2) precision — no rounding errors.', 'feature', 'cast', 2),
  ('Contract status pipeline', 'negotiating → pending → signed → on_set → completed → released. Track every actor through the deal lifecycle.', 'feature', 'cast', 3),
  ('Cast payment ledger', 'Per-payment records with period dates, due dates, paid timestamp, and status: unpaid / paid / overdue / cancelled.', 'feature', 'cast', 4),
  ('Overdue payment detection', 'Any payment past its due date with unpaid status is flagged. Keeps productions out of trouble.', 'feature', 'cast', 5),
  ('Cast document vault', 'NDA, contract, work agreement, ID proof, insurance certificate, work permit, citizenship docs. Expiry date tracking with notifications.', 'feature', 'cast', 6),
  ('Cast budget integration', 'Payment totals roll up to the props_costumes / below-the-line budget categories automatically.', 'improvement', 'budget', 7)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.4.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.4.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('XP system', '+50 for publishing, +5 per upvote, +100 for challenge submit, +500/300/150 for placing 1st/2nd/3rd, +200 for finishing a script, +25 for finishing an act.', 'feature', 'gamification', 1),
  ('Level progression', 'XP feeds into levels. Level 10 unlocks course creation. Level 25 earns Master Craftsman badge.', 'feature', 'gamification', 2),
  ('Badge system', 'First Script, Community Voice, Challenge Winner, Triple Threat, Distro King, Free Use Hero, Speed Writer, Streak Master, Course Creator, Master Craftsman.', 'feature', 'gamification', 3),
  ('Daily login streaks', 'Consecutive-day tracking with escalating XP reward (10→50 XP/day over 7 days). Breaking a streak hurts. That is the point.', 'feature', 'gamification', 4),
  ('user_gamification table', 'Stores xp, level, streak_current, streak_longest, badges (JSONB), and last_activity per user.', 'feature', 'gamification', 5)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.5.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.5.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Course LMS: courses, sections, lessons', 'Full learning management system. SYSTEM and USER course types. Lessons support video, text, exercise, and quiz formats.', 'feature', 'courses', 1),
  ('Enrollment & progress tracking', 'Enroll, track per-lesson completion, auto-calculate progress %, set completed_at on first 100%. Trigger-driven — no manual syncing.', 'feature', 'courses', 2),
  ('Course ratings', 'rate_course() handles race-condition-safe average calculation. Stored as rating_sum + rating_count for accurate running average.', 'feature', 'courses', 3),
  ('Level 10+ course creation gate', 'Community users can publish courses once they hit level 10. Keeps quality high by requiring investment in the platform first.', 'feature', 'courses', 4),
  ('Seed courses: 3 system courses', 'Screenplay Formatting Fundamentals (45min, beginner), Writing Compelling Themes (60min, intermediate), Three-Act Structure Deep Dive (50min, beginner).', 'feature', 'courses', 5),
  ('XP rewards per course', 'Completing a course awards XP as configured per course. System courses: 175–200 XP.', 'improvement', 'gamification', 6)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.6.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.6.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Arc & Episode Planner', 'Visual season grid: episodes as columns, arcs as rows. See where every story thread peaks, resolves, or goes thin. For TV, limited series, and anthology.', 'feature', 'arc_planner', 1),
  ('Arc types & statuses', 'Arc types: character, plot, thematic, world-building. Statuses: seeded, building, climax, resolved.', 'feature', 'arc_planner', 2),
  ('Episode records', 'Episode number, title, season, script link, logline, cold open notes, airdate, production status.', 'feature', 'arc_planner', 3),
  ('Showrunner lock controls', 'Admins can lock arcs and episodes to prevent accidental continuity breaks by writers.', 'feature', 'arc_planner', 4),
  ('Character roles per episode', 'Tag characters as series regular, recurring, guest star, co-star, day player, or under-five per episode. Track billing order across a season.', 'feature', 'characters', 5)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.7.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.7.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Stage play format mode', 'Dedicated mode with ACT headers, theatrical SCENE headings, STAGE DIRECTION, character cues, and SONG CUE markers. Exports as a proper stage manuscript.', 'feature', 'formats', 1),
  ('Audio drama / podcast format', 'NARRATOR, SOUND EFFECT, MUSIC CUE, AMBIENCE elements. Format metadata: stereo/binaural, runtime, target platform.', 'feature', 'formats', 2),
  ('Custom script element types', 'Define your own element labels, font styles, indent levels, print visibility, and color swatches per project.', 'feature', 'editor', 3),
  ('Format-correct exports', 'All export formats respect the project''s script type — stage plays export as manuscripts, audio dramas as scripts-for-ears.', 'improvement', 'scripts', 4)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.8.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.8.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Broadcast script mode', 'Two-column A/V editor. VIDEO (left) + AUDIO (right). SUPER elements, VO vs SOT, SCENE/SEGMENT headers, total time calculator.', 'feature', 'formats', 1),
  ('Broadcast contacts database', 'Store reporters, anchors, producers, and stations with contact info, station affiliation, relationship notes. Link to broadcast projects.', 'feature', 'production', 2),
  ('Broadcast patch distribution', 'Distribute incremental corrections to the team without re-sending the full script.', 'feature', 'production', 3)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v1.9.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '1.9.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Heartbeat-based work session tracking', 'Every 30 seconds a heartbeat credits 30 seconds to your session. Gap detection (>20min), idle detection (>10min), 5min thinking-grace.', 'feature', 'work_tracking', 1),
  ('Per-tab session keys', 'Each browser tab generates a unique session_key in sessionStorage. Simultaneous tabs tracked separately. Eliminates replay attacks.', 'feature', 'work_tracking', 2),
  ('Work context tracking', 'Sessions record which part of the app you are in: script, documents, arc-planner, etc.', 'feature', 'work_tracking', 3),
  ('Team-visible hours for project owners', 'Project owners can see hours for every team member. Broken down by day, context, and in aggregate.', 'feature', 'work_tracking', 4),
  ('Analytics views', 'work_hours_by_day, work_hours_by_user, work_hours_by_context, admin_work_stats views for dashboard and admin panel.', 'feature', 'work_tracking', 5),
  ('Stale session cleanup function', 'cleanup_stale_work_sessions() removes sessions >24h old with <60s credited. Safe to call via pg_cron.', 'feature', 'work_tracking', 6)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.0.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.0.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Git-inspired script branching', 'Create named branches (Director Cut, Studio Draft, etc.), edit independently, merge back with conflict resolution, diff any two branches at element level.', 'feature', 'versioning', 1),
  ('Festival Bridge', 'Track festival submissions: deadline, fee, status (researching → won), materials checklist, contact, result date. Full festival strategy dashboard.', 'feature', 'festival', 2),
  ('Community-maintained festival directory', 'Historical acceptance rates, average scores, and submission tips from other members who entered.', 'feature', 'festival', 3),
  ('Project templates', 'Save any project as a template. Clones script structure, character archetypes, budget categories, and more. System templates for Feature, Pilot, Short, Doc, Stage Play.', 'feature', 'production', 4),
  ('Development pipeline tracker', 'Milestones from Premise through Distribution. Status, target date, completion date, notes per milestone. Single-glance development slate view.', 'feature', 'production', 5),
  ('Script coverage tool', 'Formal coverage with logline, genre, premise, structure notes, character assessments, dialogue rating, budget estimate, and recommendation (pass/consider/recommend).', 'feature', 'scripts', 6),
  ('Table read planner', 'Schedule and track table reads. Attendance, notes, pages read, version of script used.', 'feature', 'production', 7),
  ('Mood board with section tagging', 'Visual board for reference images. Images can be tagged to board sections: general, characters, locations, atmosphere, costumes, props.', 'improvement', 'production', 8)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.1.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.1.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Subcommunities', 'Genre and topic-specific spaces inside the Community Hub. Own feed, chat, moderators, charter, and challenge filter.', 'feature', 'community', 1),
  ('Subcommunity moderator controls', 'Moderators can pin posts, remove charter-violating content, set description and icon.', 'feature', 'community', 2),
  ('Public / private subcommunity modes', 'Public subcommunities are join-on-click. Private ones require a join request and mod approval.', 'feature', 'community', 3),
  ('Community chat rooms', 'General community chat, per-challenge chat, and per-subcommunity channels. Real-time, persisted history, scrollable.', 'feature', 'community', 4),
  ('Community file uploads', 'Share reference images, script excerpts, research docs, and portfolio links in community posts and channels.', 'feature', 'community', 5)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.2.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.2.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Client customisation / white-labeling', 'Custom logo, colors, company name, domain, email sender, welcome screen, and feature visibility per workspace.', 'feature', 'ui', 1),
  ('Sidebar layout presets', 'Save named sidebar arrangements: Writing Mode (full-screen), Review Mode (annotations + comments), Production Mode (scene list + schedule). Per-user, persisted.', 'feature', 'ui', 2),
  ('Contributor/credits roster', 'Credit everyone on the project including non-platform users. Generates formatted credits export. Feeds festival submission data export.', 'feature', 'production', 3),
  ('Project channels (Slack-style)', 'Per-project Slack-like discussion channels. Text, files, reactions, threads, @mentions, pinned messages. Real-time delivery.', 'feature', 'collaboration', 4)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.3.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.3.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Feature flags system', 'GLOBAL / USER / PROJECT / BETA flag types. Admin controls rollout percentage. Emergency kill switch without a deployment.', 'feature', 'admin', 1),
  ('Labs tab in account settings', 'Users can opt into beta features from their account settings. Features tagged BETA appear here.', 'feature', 'ui', 2),
  ('Security & Legal module', 'Platform-level ToS/Privacy Policy documents with version tracking. Users prompted to re-accept on new versions.', 'feature', 'auth', 3),
  ('Admin panel — site settings', 'Maintenance mode, registration toggle, storage quotas, rate limits, community moderation thresholds, challenge auto-generation toggle, XP multipliers, announcement banner.', 'feature', 'admin', 4)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.4.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.4.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Personal project folders with nested support', 'Create folders, nest subfolders, assign colors. Per-user — your organizational scheme is invisible to other team members.', 'feature', 'ui', 1),
  ('Dashboard folders for teams', 'Shared taxonomy visible to the whole organization. Group by client, season, genre, or status.', 'feature', 'ui', 2),
  ('Drag-and-drop folder tree', 'Move projects and folders around without touching a settings page. Reordering is instant.', 'improvement', 'ui', 3)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.5.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.5.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Props & costumes per scene in the breakdown panel', 'Each scene record now has dedicated props[] and costumes[] fields. Populating these from the scene breakdown panel feeds the continuity sheet automatically.', 'feature', 'scenes', 1),
  ('Gear module — full equipment inventory', 'Camera, lens, lighting, sound, grip, post/DIT, VFX items. Own/rent/borrow. Vendor contact. Daily/weekly rate. Insurance value. Serial number. Attach to specific shoot days.', 'feature', 'gear', 2),
  ('Gear rolls up to budget', 'Gear rental costs automatically feed the props_costumes / equipment budget categories when records are linked.', 'improvement', 'budget', 3),
  ('Annotations on script elements', 'Sticky-note annotations directly on individual script elements: note, question, suggestion, flag, approved types. Resolved tracking. Sidebar grouped by scene.', 'feature', 'editor', 4),
  ('Script element type note — non-printing', 'NOTE type elements are saved in the database and visible in the editor but stripped from all PDF exports.', 'improvement', 'scripts', 5)
) AS v(title, description, entry_type, area, sort_order);


-- ── Entries for v2.6.0 ────────────────────────────────────────

WITH r AS (SELECT id FROM changelog_releases WHERE version = '2.6.0')
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, sort_order) SELECT
  r.id, title, description, entry_type::changelog_entry_type, area::changelog_area, sort_order
FROM r, (VALUES
  ('Changelog & release system', 'changelog_releases and changelog_entries tables. Change types: feature, improvement, fix, performance, security, breaking, deprecation, internal. Areas cover every module.', 'feature', 'admin', 1),
  ('publish_release() function', 'One call to mark a release published AND bump site_settings.site_version in a single atomic operation. Admin-only, SECURITY DEFINER.', 'feature', 'admin', 2),
  ('Denormalized entry counts with trigger sync', 'feature_count, improvement_count, fix_count on each release are auto-maintained by a trigger. No manual counting.', 'feature', 'database', 3),
  ('public_changelog view', 'Clean public-facing view of all published releases with total change counts. Granted to authenticated and anon roles.', 'feature', 'api', 4),
  ('Site version bumped to 2.6.0', 'site_settings.site_version updated from 0.1.0 to 2.6.0. The footer version number is now live and kept automatically in sync with every future publish_release() call.', 'improvement', 'admin', 5),
  ('Full version history seeded', 'All 16 prior releases (v1.0.0 through v2.5.0) seeded with 80+ individual change entries covering every feature on the platform.', 'feature', 'admin', 6)
) AS v(title, description, entry_type, area, sort_order);


-- ──────────────────────────────────────────────────────────────
-- 10. BUMP SITE VERSION to 2.6.0
-- ──────────────────────────────────────────────────────────────

INSERT INTO site_settings (key, value, updated_at)
VALUES ('site_version', '2.6.0', now())
ON CONFLICT (key) DO UPDATE
  SET value      = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at;


-- ──────────────────────────────────────────────────────────────
-- USAGE NOTES
-- ──────────────────────────────────────────────────────────────
--
-- To add a new release:
--
--   1. Insert the release row (status = 'draft'):
--      INSERT INTO changelog_releases (version, title, summary, release_type)
--      VALUES ('2.7.0', 'The Next Thing', 'Summary here.', 'minor');
--
--   2. Insert entries against it:
--      INSERT INTO changelog_entries (release_id, title, description, entry_type, area)
--      SELECT id, 'New feature name', 'What it does.', 'feature', 'editor'
--      FROM changelog_releases WHERE version = '2.7.0';
--
--   3. When ready to ship, call:
--      SELECT publish_release('2.7.0');
--      → marks published, sets released_at = now(), bumps site_version to 2.7.0
--
-- ============================================================

-- ---------------------------------------------------------------------
-- Source: supabase/migration_character_cast_member_link.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Characters → Cast Members link + actor photo on avatar
-- ============================================================

-- Link a character to a cast member record so their photo_url
-- auto-populates the character avatar.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS cast_member_id UUID REFERENCES cast_members(id) ON DELETE SET NULL;

-- Index for fast lookups within a project
CREATE INDEX IF NOT EXISTS idx_characters_cast_member_id
  ON characters(cast_member_id) WHERE cast_member_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_character_roles.sql
-- ---------------------------------------------------------------------
-- Migration: Character Role Tags
-- Adds a `role` column to the characters table for narrative role classifications.
-- Run this in the Supabase SQL editor.

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS role TEXT;

COMMENT ON COLUMN characters.role IS
  'Narrative/dramatic role of the character.
   Allowed values (UI-enforced, not DB-constrained for flexibility):
     protagonist  – the main hero/lead
     antagonist   – the villain or opposing force
     main         – main cast (but not the primary protagonist/antagonist)
     supporting   – secondary/supporting character
     minor        – bit part or very limited appearance
     ensemble     – part of a group without a standout individual role
   NULL means the role has not been set yet (falls back to is_main boolean).';

-- Optional: if you want a check constraint for the allowed values
-- ALTER TABLE characters
--   ADD CONSTRAINT characters_role_check
--   CHECK (role IN ('protagonist','antagonist','main','supporting','minor','ensemble') OR role IS NULL);

-- Index for fast role-based queries
CREATE INDEX IF NOT EXISTS idx_characters_role
  ON characters (project_id, role);


-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Episodes Seasons & Ordering
-- Supports per-episode season assignment, custom accent colour, and sort order.
-- All data lives in existing JSONB columns (scripts.metadata and
-- projects.content_metadata) so no new columns are strictly required.
-- However the optional sort_order column below gives a fast ORDER BY path.
-- ─────────────────────────────────────────────────────────────────────────────

-- Optional fast-sort column on scripts (episodes are scripts filtered by project)
ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

COMMENT ON COLUMN scripts.sort_order IS
  'Display order of the episode within the series. Lower = earlier.
   Also mirrored inside scripts.metadata.sort_order for JS convenience.';

-- Index so fetching episodes ordered by sort_order is efficient
CREATE INDEX IF NOT EXISTS idx_scripts_sort_order
  ON scripts (project_id, sort_order);

-- The season definitions (name, number, colour) are stored in
-- projects.content_metadata as a JSONB array under the key "series_seasons".
-- Example value:
--   [{"num":1,"name":"Season 1","color":"#6366f1"},
--    {"num":2,"name":"Season 2","color":"#0ea5e9"}]
--
-- Per-episode season + colour are stored in scripts.metadata:
--   { "episode_season": 1, "episode_color": "#7c3aed", "sort_order": 3 }
--
-- No additional columns are needed; content_metadata and metadata are already
-- JSONB in the DB (even though TypeScript types them more narrowly).

-- Backfill sort_order for any existing scripts that don't have it set
UPDATE scripts
SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) - 1 AS rn
  FROM scripts
) sub
WHERE scripts.id = sub.id
  AND scripts.sort_order = 0;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_character_visual_profiles.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- CHARACTER VISUAL PROFILES
-- Adds link-based visual reference fields to the characters table.
-- All images are stored as URL links — no file uploads.
-- See blog post: /blog/why-we-use-image-links
-- ============================================================

-- actor_photo_url: A link to a photo that shows how the character should look.
-- Could be a reference actor, a character design, a casting photo, etc.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS actor_photo_url TEXT;

-- inspo_images: Inspiration board — links to images that capture the character's
-- vibe, aesthetic, or feel. Each entry: { url, caption }
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS inspo_images JSONB DEFAULT '[]'::jsonb;

-- reference_folders: Versioned production reference collections.
-- Used for makeup, costume, and other design iterations.
-- Each folder: { id, name, type ('makeup'|'costume'|'other'), images: [{ url, caption }] }
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS reference_folders JSONB DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_client_customisation.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Migration: Client Customisation
-- Adds accent_color and sidebar_tabs to both profiles and projects
-- so users can set global defaults AND per-project overrides.
-- ============================================================

-- ── Profiles (user-level global defaults) ───────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT 'brand',
  ADD COLUMN IF NOT EXISTS sidebar_tabs JSONB DEFAULT NULL;

-- ── Projects (project-level overrides) ──────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sidebar_tabs JSONB DEFAULT NULL;

-- Add a comment explaining the merge logic:
-- 1. If project.accent_color IS NOT NULL  → use it
--    Else use profiles.accent_color (default 'brand')
-- 2. If project.sidebar_tabs IS NOT NULL  → deep-merge with profile defaults
--    Else use profiles.sidebar_tabs (all enabled by default)

-- ---------------------------------------------------------------------
-- Source: supabase/migration_comments_presskit.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Source: supabase/migration_community_chat.sql
-- ---------------------------------------------------------------------
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Community Chat (Discord-style channels + messages)
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables:
--   community_channels   – text/announcement channels per community
--   community_messages   – messages per channel (real-time)
-- Alterations:
--   sub_communities      – adds discord_invite_url, discord_server_id
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Add Discord fields to sub_communities ────────────────────────────────────
ALTER TABLE sub_communities
  ADD COLUMN IF NOT EXISTS discord_invite_url TEXT,       -- e.g. https://discord.gg/xyz
  ADD COLUMN IF NOT EXISTS discord_server_id  TEXT,       -- numeric guild ID for the embed widget
  ADD COLUMN IF NOT EXISTS chat_mode          TEXT NOT NULL DEFAULT 'chat'
                            CHECK (chat_mode IN ('chat','discord_only'));
-- 'chat'         → built-in channel chat is shown
-- 'discord_only' → chat tab redirects to the Discord invite / shows only a join-Discord card

-- ── Community channels ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_channels (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID        NOT NULL REFERENCES sub_communities(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,                -- e.g. "general", "feedback"
  description   TEXT,                               -- shown in channel header
  type          TEXT        NOT NULL DEFAULT 'text'
                            CHECK (type IN ('text', 'announcement', 'readonly')),
  -- 'text'         → members can post
  -- 'announcement' → only mods/admins can post
  -- 'readonly'     → nobody can post (pinboard style)
  position      INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(community_id, name)
);

CREATE INDEX IF NOT EXISTS idx_community_channels_community
  ON community_channels(community_id, position);

-- ── Community messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID        NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  edited_at   TIMESTAMPTZ,
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_messages_channel
  ON community_messages(channel_id, created_at DESC);

-- ── Default channel for every existing community ─────────────────────────────
INSERT INTO community_channels (community_id, name, description, type, position)
SELECT id, 'general', 'General discussion', 'text', 0
FROM sub_communities
ON CONFLICT (community_id, name) DO NOTHING;

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE community_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_messages ENABLE ROW LEVEL SECURITY;

-- Channels: visible to anyone who can see the community
CREATE POLICY "community_channels_select" ON community_channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sub_communities sc
      WHERE sc.id = community_id
        AND (
          sc.visibility IN ('public', 'restricted')
          OR EXISTS (
            SELECT 1 FROM sub_community_members m
            WHERE m.community_id = sc.id
              AND m.user_id = auth.uid()
              AND m.role NOT IN ('banned', 'pending_approval')
          )
        )
    )
  );

-- Channels: only mods/admins can create
CREATE POLICY "community_channels_insert_mod" ON community_channels
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sub_community_members
      WHERE community_id = community_channels.community_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'moderator')
    )
  );

-- Channels: only mods/admins can update
CREATE POLICY "community_channels_update_mod" ON community_channels
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sub_community_members
      WHERE community_id = community_channels.community_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'moderator')
    )
  );

-- Channels: only mods/admins can delete
CREATE POLICY "community_channels_delete_mod" ON community_channels
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM sub_community_members
      WHERE community_id = community_channels.community_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'moderator')
    )
  );

-- Messages: readable by anyone who can see the community
CREATE POLICY "community_messages_select" ON community_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_channels cc
      JOIN sub_communities sc ON sc.id = cc.community_id
      WHERE cc.id = channel_id
        AND (
          sc.visibility IN ('public', 'restricted')
          OR EXISTS (
            SELECT 1 FROM sub_community_members m
            WHERE m.community_id = sc.id
              AND m.user_id = auth.uid()
              AND m.role NOT IN ('banned', 'pending_approval')
          )
        )
    )
  );

-- Messages: members can post to 'text' channels; only mods to 'announcement'
CREATE POLICY "community_messages_insert_member" ON community_messages
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM community_channels cc
      JOIN sub_communities sc ON sc.id = cc.community_id
      LEFT JOIN sub_community_members m ON m.community_id = sc.id AND m.user_id = auth.uid()
      WHERE cc.id = channel_id
        AND cc.type != 'readonly'
        AND (
          -- 'announcement' channels only mods/admins
          (cc.type = 'announcement' AND m.role IN ('admin', 'moderator'))
          OR
          -- 'text' channels: must be a member (or public community)
          (
            cc.type = 'text'
            AND (
              sc.visibility = 'public'
              OR (m.role IS NOT NULL AND m.role NOT IN ('banned', 'pending_approval'))
            )
          )
        )
    )
  );

-- Messages: author can edit own (non-deleted) messages
CREATE POLICY "community_messages_update_own" ON community_messages
  FOR UPDATE USING (
    auth.uid() = author_id AND NOT is_deleted
  );

-- Messages: author can delete own; mods can delete any in their community
CREATE POLICY "community_messages_delete" ON community_messages
  FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM community_channels cc
      JOIN sub_community_members m ON m.community_id = cc.community_id AND m.user_id = auth.uid()
      WHERE cc.id = channel_id AND m.role IN ('admin', 'moderator')
    )
  );

-- ── Enable Supabase Realtime ──────────────────────────────────────────────────
-- Run this in Supabase dashboard → Database → Replication, or uncomment:
-- ALTER PUBLICATION supabase_realtime ADD TABLE community_messages;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_community_collab_mentions.sql
-- ---------------------------------------------------------------------
-- ═══════════════════════════════════════════════════════════════════════════
--  COMMUNITY COLLABORATION + MENTIONS + NOTIFICATION EXPANSIONS
--  new tables: community_post_collaborators
--  new notification types added via comments (handled in app types)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Collaborators table ────────────────────────────────────────────────────
-- Tracks users credited as collaborators on a community post.

CREATE TABLE IF NOT EXISTS community_post_collaborators (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cpc_post ON community_post_collaborators(post_id);
CREATE INDEX IF NOT EXISTS idx_cpc_user ON community_post_collaborators(user_id);

ALTER TABLE community_post_collaborators ENABLE ROW LEVEL SECURITY;

-- Anyone can read collaborators
DROP POLICY IF EXISTS "cpc_select" ON community_post_collaborators;
CREATE POLICY "cpc_select" ON community_post_collaborators FOR SELECT USING (true);

-- Post owner or existing collaborator can add/remove collaborators
DROP POLICY IF EXISTS "cpc_insert" ON community_post_collaborators;
CREATE POLICY "cpc_insert" ON community_post_collaborators FOR INSERT
  WITH CHECK (
    auth.uid() = added_by
    AND (
      auth.uid() IN (SELECT author_id FROM community_posts WHERE id = post_id)
      OR auth.uid() IN (SELECT user_id FROM community_post_collaborators WHERE post_id = community_post_collaborators.post_id)
    )
  );

DROP POLICY IF EXISTS "cpc_delete" ON community_post_collaborators;
CREATE POLICY "cpc_delete" ON community_post_collaborators FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT author_id FROM community_posts WHERE id = post_id)
  );

GRANT SELECT, INSERT, DELETE ON community_post_collaborators TO authenticated;

-- ── 2. Post mentions table ────────────────────────────────────────────────────
-- Stores @username mentions made in comments, so we can index/notify.

CREATE TABLE IF NOT EXISTS community_mentions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id   UUID,               -- optional: link to the comment row
  mentioned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentioned_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_user ON community_mentions(mentioned_user_id);

ALTER TABLE community_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cm_select" ON community_mentions;
CREATE POLICY "cm_select" ON community_mentions FOR SELECT USING (true);

DROP POLICY IF EXISTS "cm_insert" ON community_mentions;
CREATE POLICY "cm_insert" ON community_mentions FOR INSERT WITH CHECK (
  auth.uid() = mentioned_by
);

GRANT SELECT, INSERT ON community_mentions TO authenticated;

-- ── 3. Feedback subscriptions (already in feedback migration, no-op if exists) ─
-- Ensures users can follow feedback items and receive notifications on updates.
CREATE TABLE IF NOT EXISTS feedback_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

-- ---------------------------------------------------------------------
-- Source: supabase/migration_community_file_upload.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- MIGRATION: Community File Upload Support
-- ============================================================
-- Adds attached_file_url / attached_file_type columns to
-- community_posts so users can attach .fdx, .fountain, .txt
-- or .pdf files when sharing a script.
--
-- Also creates the 'community-files' Supabase Storage bucket.
-- ============================================================

-- ── 1. New columns on community_posts ───────────────────────
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS attached_file_url  text,
  ADD COLUMN IF NOT EXISTS attached_file_type text;  -- 'pdf' | 'fdx' | 'fountain' | 'txt'

-- ── 2. Storage bucket ────────────────────────────────────────
-- Create the bucket (idempotent via WHERE NOT EXISTS)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'community-files',
  'community-files',
  true,
  52428800,   -- 50 MB max per file
  ARRAY[
    'application/pdf',
    'text/plain',
    'application/xml',
    'text/xml',
    'application/octet-stream',  -- .fdx files are often served with this mime
    'text/fountain'
  ]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'community-files'
);

-- ── 3. Storage RLS policies ───────────────────────────────────
-- Public read (files are shared content)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Community files are publicly readable'
  ) THEN
    CREATE POLICY "Community files are publicly readable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'community-files');
  END IF;
END $$;

-- Authenticated users can upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Authenticated users can upload community files'
  ) THEN
    CREATE POLICY "Authenticated users can upload community files"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'community-files'
        AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;

-- Users can delete their own uploads (path = userId/filename)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Users can delete own community files'
  ) THEN
    CREATE POLICY "Users can delete own community files"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'community-files'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_content_creator.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Migration: Content Creator / YouTuber Support
-- Adds project_type and content creator specific tables
-- ============================================================

-- Add project_type enum
CREATE TYPE project_type AS ENUM (
  'film',           -- Traditional film/TV production
  'youtube',        -- YouTube videos
  'tiktok',         -- TikTok/Reels/Shorts
  'podcast',        -- Podcast/audio content
  'documentary',    -- Documentary
  'educational',    -- Courses/tutorials
  'livestream'      -- Live streaming content
);

-- Add project_type to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type project_type DEFAULT 'film';

-- Add content creator metadata to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS content_metadata JSONB DEFAULT '{}';

-- ============================================================
-- THUMBNAILS - YouTube thumbnail planning
-- ============================================================
CREATE TABLE IF NOT EXISTS thumbnails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Thumbnail',
  image_url TEXT,
  is_primary BOOLEAN DEFAULT false,
  text_overlay TEXT,
  font_style TEXT,
  color_scheme TEXT[],
  notes TEXT,
  a_b_test_group TEXT, -- 'A', 'B', 'C' for A/B testing
  click_rate DECIMAL(5,2), -- Percentage
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE thumbnails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view thumbnails of their projects"
  ON thumbnails FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage thumbnails of their projects"
  ON thumbnails FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

-- ============================================================
-- SPONSOR SEGMENTS - Track sponsorships and ad reads
-- ============================================================
CREATE TABLE IF NOT EXISTS sponsor_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sponsor_name TEXT NOT NULL,
  segment_type TEXT DEFAULT 'mid_roll', -- 'pre_roll', 'mid_roll', 'post_roll', 'integration'
  start_time INTEGER, -- Timestamp in seconds
  end_time INTEGER,
  script_text TEXT,
  talking_points TEXT[],
  cta_link TEXT,
  promo_code TEXT,
  payment_amount DECIMAL(10,2),
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'invoiced', 'paid'
  due_date DATE,
  notes TEXT,
  is_disclosed BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sponsor_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sponsors of their projects"
  ON sponsor_segments FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage sponsors of their projects"
  ON sponsor_segments FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

-- ============================================================
-- VIDEO CHAPTERS - YouTube chapters/timestamps
-- ============================================================
CREATE TABLE IF NOT EXISTS video_chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  timestamp INTEGER NOT NULL DEFAULT 0, -- Seconds from start
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE video_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chapters of their projects"
  ON video_chapters FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage chapters of their projects"
  ON video_chapters FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

-- ============================================================
-- VIDEO SEO - Title, description, tags, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS video_seo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  video_title TEXT,
  video_description TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  default_language TEXT DEFAULT 'en',
  target_keywords TEXT[] DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',
  end_screen_elements JSONB DEFAULT '[]', -- [{type: 'video', position: 'bottom-right'}, ...]
  cards JSONB DEFAULT '[]', -- [{timestamp: 60, type: 'video', video_id: '...'}]
  publish_date TIMESTAMPTZ,
  visibility TEXT DEFAULT 'private', -- 'public', 'unlisted', 'private', 'scheduled'
  made_for_kids BOOLEAN DEFAULT false,
  age_restricted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE video_seo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SEO of their projects"
  ON video_seo FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage SEO of their projects"
  ON video_seo FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

-- ============================================================
-- UPLOAD CHECKLIST - Pre-publish checklist items
-- ============================================================
CREATE TABLE IF NOT EXISTS upload_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'general', -- 'general', 'video', 'audio', 'seo', 'legal', 'promotion'
  is_default BOOLEAN DEFAULT false, -- Part of standard template
  sort_order INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE upload_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view checklist of their projects"
  ON upload_checklist FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage checklist of their projects"
  ON upload_checklist FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

-- ============================================================
-- B-ROLL ITEMS - Footage list for content creators
-- ============================================================
CREATE TABLE IF NOT EXISTS broll_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  source TEXT, -- 'film', 'stock', 'archive', 'screen_recording', 'animation'
  source_url TEXT,
  duration_seconds INTEGER,
  timestamp_start INTEGER, -- Where to use in video
  timestamp_end INTEGER,
  status TEXT DEFAULT 'needed', -- 'needed', 'found', 'filmed', 'edited'
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE broll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view broll of their projects"
  ON broll_items FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage broll of their projects"
  ON broll_items FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

-- ============================================================
-- CONTENT HOOKS - Opening hooks, CTAs, intros
-- ============================================================
CREATE TABLE IF NOT EXISTS content_hooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hook_type TEXT NOT NULL, -- 'opening_hook', 'intro', 'cta', 'outro', 'transition'
  content TEXT NOT NULL,
  duration_seconds INTEGER,
  timestamp INTEGER, -- Where in video
  notes TEXT,
  is_template BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE content_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view hooks of their projects"
  ON content_hooks FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage hooks of their projects"
  ON content_hooks FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_thumbnails_project ON thumbnails(project_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_segments_project ON sponsor_segments(project_id);
CREATE INDEX IF NOT EXISTS idx_video_chapters_project ON video_chapters(project_id);
CREATE INDEX IF NOT EXISTS idx_video_seo_project ON video_seo(project_id);
CREATE INDEX IF NOT EXISTS idx_upload_checklist_project ON upload_checklist(project_id);
CREATE INDEX IF NOT EXISTS idx_broll_items_project ON broll_items(project_id);
CREATE INDEX IF NOT EXISTS idx_content_hooks_project ON content_hooks(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type);

-- ---------------------------------------------------------------------
-- Source: supabase/migration_content_moderation.sql
-- ---------------------------------------------------------------------
-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Content Moderation & Child Safety Migration               ║
-- ║  CSAM detection, evidence preservation, admin oversight    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════
-- HELPER: Platform admin check (SECURITY DEFINER, no RLS loop)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR id = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ═══════════════════════════════════════════════════════════════
-- ADMIN READ-ONLY ACCESS TO ALL PROJECTS (for admin list only)
-- Does NOT grant write/update/delete access.
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Platform admins can view all projects" ON projects;
CREATE POLICY "Platform admins can view all projects"
  ON projects FOR SELECT
  USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════════
-- ADMIN READ-ONLY on content tables for moderation scanning
-- ═══════════════════════════════════════════════════════════════

-- Scripts
DROP POLICY IF EXISTS "Platform admins can view all scripts" ON scripts;
CREATE POLICY "Platform admins can view all scripts"
  ON scripts FOR SELECT USING (public.is_platform_admin());

-- Script elements (the actual text content)
DROP POLICY IF EXISTS "Platform admins can view all script elements" ON script_elements;
CREATE POLICY "Platform admins can view all script elements"
  ON script_elements FOR SELECT USING (public.is_platform_admin());

-- Ideas
DROP POLICY IF EXISTS "Platform admins can view all ideas" ON ideas;
CREATE POLICY "Platform admins can view all ideas"
  ON ideas FOR SELECT USING (public.is_platform_admin());

-- Documents
DROP POLICY IF EXISTS "Platform admins can view all documents" ON project_documents;
CREATE POLICY "Platform admins can view all documents"
  ON project_documents FOR SELECT USING (public.is_platform_admin());

-- Scenes
DROP POLICY IF EXISTS "Platform admins can view all scenes" ON scenes;
CREATE POLICY "Platform admins can view all scenes"
  ON scenes FOR SELECT USING (public.is_platform_admin());

-- Characters
DROP POLICY IF EXISTS "Platform admins can view all characters" ON characters;
CREATE POLICY "Platform admins can view all characters"
  ON characters FOR SELECT USING (public.is_platform_admin());

-- Channel messages (project chat)
DROP POLICY IF EXISTS "Platform admins can view all channel messages" ON channel_messages;
CREATE POLICY "Platform admins can view all channel messages"
  ON channel_messages FOR SELECT USING (public.is_platform_admin());

-- Direct messages (DMs)
DROP POLICY IF EXISTS "Platform admins can view all direct messages" ON direct_messages;
CREATE POLICY "Platform admins can view all direct messages"
  ON direct_messages FOR SELECT USING (public.is_platform_admin());

-- Conversations (DM threads)
DROP POLICY IF EXISTS "Platform admins can view all conversations" ON conversations;
CREATE POLICY "Platform admins can view all conversations"
  ON conversations FOR SELECT USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════════
-- CONTENT FLAGS — Auto-detected or manually flagged content
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS content_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What was flagged
  content_type  TEXT NOT NULL CHECK (content_type IN (
    'script_element', 'idea', 'document', 'scene', 'character',
    'channel_message', 'direct_message', 'project', 'comment'
  )),
  content_id    UUID NOT NULL,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  -- Who authored the flagged content
  flagged_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Detection details
  flag_reason   TEXT NOT NULL CHECK (flag_reason IN (
    'csam', 'child_exploitation', 'child_abuse',
    'terrorism', 'extreme_violence', 'illegal_activity',
    'manual_review'
  )),
  matched_terms TEXT[] DEFAULT '{}',     -- which terms triggered this flag
  content_snippet TEXT NOT NULL,          -- the actual text that was flagged (truncated)
  severity      TEXT NOT NULL DEFAULT 'critical'
                CHECK (severity IN ('critical','high','medium','low')),
  -- Status tracking
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','reviewing','confirmed','false_positive','actioned')),
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes  TEXT,
  reviewed_at   TIMESTAMPTZ,
  -- What action was taken
  action_taken  TEXT CHECK (action_taken IN (
    'none', 'content_removed', 'user_warned', 'user_suspended',
    'user_banned', 'reported_to_authorities', 'evidence_preserved'
  )),
  -- Meta
  detected_at   TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_flags_user ON content_flags(flagged_user_id);
CREATE INDEX IF NOT EXISTS idx_content_flags_status ON content_flags(status, severity);
CREATE INDEX IF NOT EXISTS idx_content_flags_project ON content_flags(project_id);
CREATE INDEX IF NOT EXISTS idx_content_flags_detected ON content_flags(detected_at DESC);

ALTER TABLE content_flags ENABLE ROW LEVEL SECURITY;

-- Only admins can see and manage content flags
DROP POLICY IF EXISTS "Admins can manage content flags" ON content_flags;
CREATE POLICY "Admins can manage content flags" ON content_flags
  FOR ALL USING (public.is_platform_admin());

-- System (triggers/functions) can insert flags
DROP POLICY IF EXISTS "System can insert content flags" ON content_flags;
CREATE POLICY "System can insert content flags" ON content_flags
  FOR INSERT WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- MODERATION EVIDENCE — Tamper-proof snapshots
-- Once inserted, rows can only be read, never updated or deleted.
-- This ensures users cannot destroy evidence by deleting content.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS moderation_evidence (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id       UUID NOT NULL REFERENCES content_flags(id) ON DELETE RESTRICT,
  -- Full snapshot of the content at time of capture
  content_type  TEXT NOT NULL,
  content_id    UUID NOT NULL,
  full_content  TEXT NOT NULL,           -- complete text, not truncated
  content_metadata JSONB DEFAULT '{}',   -- any extra context (project title, script name, etc.)
  -- Author details at time of capture
  author_id     UUID NOT NULL,
  author_email  TEXT,
  author_name   TEXT,
  author_ip     TEXT,                    -- if available from audit_log
  -- Capture details
  captured_by   UUID NOT NULL REFERENCES profiles(id),
  captured_at   TIMESTAMPTZ DEFAULT now(),
  -- Hash for integrity verification
  content_hash  TEXT NOT NULL             -- SHA-256 of full_content for tamper detection
);

CREATE INDEX IF NOT EXISTS idx_evidence_flag ON moderation_evidence(flag_id);
CREATE INDEX IF NOT EXISTS idx_evidence_author ON moderation_evidence(author_id);

ALTER TABLE moderation_evidence ENABLE ROW LEVEL SECURITY;

-- Evidence is IMMUTABLE: admins can read and insert, but NEVER update or delete
DROP POLICY IF EXISTS "Admins can read evidence" ON moderation_evidence;
CREATE POLICY "Admins can read evidence" ON moderation_evidence
  FOR SELECT USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Admins can capture evidence" ON moderation_evidence;
CREATE POLICY "Admins can capture evidence" ON moderation_evidence
  FOR INSERT WITH CHECK (public.is_platform_admin());

-- Explicitly deny update/delete by having NO policies for those operations
-- RLS is enabled, so without a policy, UPDATE and DELETE are blocked for everyone.


-- ═══════════════════════════════════════════════════════════════
-- USER MODERATION FLAGS — Visible warning on user profiles
-- When a user has flagged DMs, show a warning badge in admin views
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS moderation_flags INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'clean'
  CHECK (moderation_status IN ('clean', 'flagged', 'warned', 'suspended', 'banned'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS moderation_notes TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_flagged_at TIMESTAMPTZ;


-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Auto-increment moderation_flags on user when flagged
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_user_moderation_flags()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET moderation_flags = (
    SELECT count(*) FROM content_flags
    WHERE flagged_user_id = NEW.flagged_user_id
    AND status NOT IN ('false_positive')
  ),
  moderation_status = CASE
    WHEN (SELECT count(*) FROM content_flags
          WHERE flagged_user_id = NEW.flagged_user_id
          AND status NOT IN ('false_positive')
          AND flag_reason IN ('csam', 'child_exploitation', 'child_abuse')) > 0
    THEN 'flagged'
    ELSE COALESCE(
      (SELECT moderation_status FROM profiles WHERE id = NEW.flagged_user_id),
      'clean'
    )
  END,
  last_flagged_at = now()
  WHERE id = NEW.flagged_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_moderation_flags ON content_flags;
CREATE TRIGGER trg_update_moderation_flags
  AFTER INSERT ON content_flags
  FOR EACH ROW EXECUTE FUNCTION update_user_moderation_flags();


-- ═══════════════════════════════════════════════════════════════
-- AUDIT: Log all moderation actions
-- ═══════════════════════════════════════════════════════════════
-- (Uses existing audit_log table from migration_security_legal.sql)
-- No new table needed — just reference entity_type = 'moderation_action'


-- ═══════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════
GRANT ALL ON content_flags TO authenticated, service_role;
GRANT ALL ON moderation_evidence TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_contributors.sql
-- ---------------------------------------------------------------------
-- Migration: Contributors
-- Run in Supabase SQL editor

-- Tracks platform contributors listed on /contribute and /about pages
CREATE TABLE IF NOT EXISTS contributors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  github_handle       text,
  bio                 text,
  cached_name         text,         -- denormalised from profiles for join-free public reads
  cached_avatar_url   text,
  contribution_areas  text[] NOT NULL DEFAULT '{}',
  is_featured         boolean NOT NULL DEFAULT false,
  added_at            timestamptz NOT NULL DEFAULT now(),
  added_by            uuid,  -- plain uuid, no FK (avoids ambiguous join with user_id)

  CONSTRAINT contributors_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS contributors_user_id_idx     ON contributors(user_id);
CREATE INDEX IF NOT EXISTS contributors_is_featured_idx ON contributors(is_featured);

-- If the table was previously created with a FK on added_by, drop it to avoid
-- the "more than one relationship" error when joining contributors -> profiles.
ALTER TABLE contributors
  DROP CONSTRAINT IF EXISTS contributors_added_by_fkey;

-- Add cached display columns if they don't exist yet
ALTER TABLE contributors ADD COLUMN IF NOT EXISTS cached_name       text;
ALTER TABLE contributors ADD COLUMN IF NOT EXISTS cached_avatar_url text;

-- RLS
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;

-- Anyone can read contributors (for /about and /contribute pages)
CREATE POLICY "contributors_select_all" ON contributors
  FOR SELECT USING (true);

-- Helper: true if the current user is a platform admin
-- Matches the same logic as the app: role = 'admin'  OR hardcoded admin UID
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    );
$$;

-- Only admins can insert
CREATE POLICY "contributors_insert_admin" ON contributors
  FOR INSERT WITH CHECK (public.is_platform_admin());

-- Only admins can update
CREATE POLICY "contributors_update_admin" ON contributors
  FOR UPDATE USING (public.is_platform_admin());

-- Only admins can delete
CREATE POLICY "contributors_delete_admin" ON contributors
  FOR DELETE USING (public.is_platform_admin());

-- Done

-- ---------------------------------------------------------------------
-- Source: supabase/migration_courses.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Screenplay Studio — Migration: Community Courses
-- Run in Supabase SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. COURSES TABLE
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  short_desc       TEXT,                        -- one-liner for cards
  type             TEXT NOT NULL DEFAULT 'user' CHECK (type IN ('system','user')),
  creator_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  thumbnail_url    TEXT,
  difficulty       TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  tags             TEXT[] DEFAULT '{}',
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  xp_reward        INT DEFAULT 100,             -- total XP for completion
  estimated_minutes INT DEFAULT 30,
  enrollment_count INT DEFAULT 0,
  completion_count INT DEFAULT 0,
  rating_sum       INT DEFAULT 0,
  rating_count     INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_status       ON courses (status);
CREATE INDEX IF NOT EXISTS idx_courses_type         ON courses (type);
CREATE INDEX IF NOT EXISTS idx_courses_creator_id   ON courses (creator_id);
CREATE INDEX IF NOT EXISTS idx_courses_created_at   ON courses (created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- 2. COURSE SECTIONS (chapters / parts)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_sections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  order_index      INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_sections_course ON course_sections (course_id, order_index);

-- ──────────────────────────────────────────────────────────────
-- 3. COURSE LESSONS (individual steps within sections)
--
--  lesson_type options:
--    'text'          — rich markdown/formatted text
--    'video'         — embeddable video (YouTube / Vimeo / direct)
--    'quiz'          — multiple-choice questions with correct answers
--    'script_editor' — mini fountain/screenplay editor
--    'arc_editor'    — embedded arc mind-map
--    'example'       — annotated code/script example (read-only)
--
--  content JSONB structures by type:
--    text:          { "markdown": "..." }
--    video:         { "embed_url": "...", "provider": "youtube|vimeo|direct",
--                    "duration_seconds": 180, "caption": "..." }
--    quiz:          { "questions": [
--                      { "id": "q1", "text": "...", "explanation": "...",
--                        "options": [{"id":"a","text":"...","is_correct":true}, ...] }
--                    ]}
--    script_editor: { "instructions": "...", "initial_content": "...",
--                     "locked": false, "expected_keywords": [],
--                     "hint": "..." }
--    arc_editor:    { "instructions": "...", "arc_data": {...},
--                     "locked": false }
--    example:       { "content": "...", "language": "fountain|text|json",
--                     "annotations": [{"line":1,"note":"..."}],
--                     "description": "..." }
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_lessons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id       UUID REFERENCES course_sections(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  order_index      INT NOT NULL DEFAULT 0,
  lesson_type      TEXT NOT NULL DEFAULT 'text'
                     CHECK (lesson_type IN ('text','video','quiz','script_editor','arc_editor','example')),
  content          JSONB NOT NULL DEFAULT '{}',
  xp_reward        INT DEFAULT 10,
  is_required      BOOL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_lessons_course   ON course_lessons (course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_course_lessons_section  ON course_lessons (section_id, order_index);

-- ──────────────────────────────────────────────────────────────
-- 4. COURSE ENROLLMENTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_enrollments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at       TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  last_accessed_at  TIMESTAMPTZ DEFAULT now(),
  progress_percent  INT DEFAULT 0,
  rating            INT CHECK (rating BETWEEN 1 AND 5),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user    ON course_enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course  ON course_enrollments (course_id);

-- ──────────────────────────────────────────────────────────────
-- 5. LESSON PROGRESS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_lesson_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id    UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  score        INT,        -- for quizzes: % correct
  attempts     INT DEFAULT 1,
  answer_data  JSONB,      -- user's quiz answers for review
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user   ON course_lesson_progress (user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON course_lesson_progress (lesson_id);

-- ──────────────────────────────────────────────────────────────
-- 6. TRIGGER: update enrollment progress_percent when lessons complete
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_course_progress()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total   INT;
  v_done    INT;
  v_pct     INT;
  v_all_req BOOL;
BEGIN
  -- Count required lessons for this course
  SELECT COUNT(*) INTO v_total
  FROM course_lessons
  WHERE course_id = NEW.course_id AND is_required = true;

  -- Count completed required lessons for this user
  SELECT COUNT(*) INTO v_done
  FROM course_lesson_progress clp
  JOIN course_lessons cl ON cl.id = clp.lesson_id
  WHERE clp.user_id = NEW.user_id
    AND clp.course_id = NEW.course_id
    AND cl.is_required = true;

  v_pct := CASE WHEN v_total = 0 THEN 100 ELSE (v_done * 100 / v_total) END;

  UPDATE course_enrollments
  SET progress_percent  = v_pct,
      last_accessed_at  = now(),
      completed_at      = CASE WHEN v_pct = 100 THEN COALESCE(completed_at, now()) ELSE NULL END
  WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

  -- Bump course completion count when first completed
  IF v_pct = 100 THEN
    UPDATE courses SET completion_count = completion_count + 1
    WHERE id = NEW.course_id
      AND NOT EXISTS (
        SELECT 1 FROM course_enrollments
        WHERE user_id = NEW.user_id AND course_id = NEW.course_id
          AND completed_at IS NOT NULL
          AND completed_at < now() - INTERVAL '1 second'
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_course_progress ON course_lesson_progress;
CREATE TRIGGER trg_sync_course_progress
AFTER INSERT OR UPDATE ON course_lesson_progress
FOR EACH ROW EXECUTE FUNCTION sync_course_progress();

-- ──────────────────────────────────────────────────────────────
-- 7. TRIGGER: bump enrollment_count when a user enrolls
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bump_course_enrollment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE courses SET enrollment_count = enrollment_count + 1
  WHERE id = NEW.course_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_enrollment ON course_enrollments;
CREATE TRIGGER trg_bump_enrollment
AFTER INSERT ON course_enrollments
FOR EACH ROW EXECUTE FUNCTION bump_course_enrollment();

-- ──────────────────────────────────────────────────────────────
-- 8. FUNCTION: rate a course (upserts rating on enrollment row)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rate_course(
  p_course_id UUID,
  p_rating    INT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old_rating INT;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be 1-5';
  END IF;

  SELECT rating INTO v_old_rating
  FROM course_enrollments
  WHERE user_id = auth.uid() AND course_id = p_course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enrolled';
  END IF;

  -- Subtract old rating if existed
  IF v_old_rating IS NOT NULL THEN
    UPDATE courses
    SET rating_sum   = rating_sum - v_old_rating,
        rating_count = rating_count - 1
    WHERE id = p_course_id;
  END IF;

  -- Save new rating
  UPDATE course_enrollments SET rating = p_rating
  WHERE user_id = auth.uid() AND course_id = p_course_id;

  UPDATE courses
  SET rating_sum   = rating_sum + p_rating,
      rating_count = rating_count + 1
  WHERE id = p_course_id;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 9. RLS POLICIES
-- ──────────────────────────────────────────────────────────────

ALTER TABLE courses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_sections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lessons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lesson_progress ENABLE ROW LEVEL SECURITY;

-- courses: published are public; drafts visible to creator + admin/mod
CREATE POLICY "courses_public_read" ON courses
  FOR SELECT USING (status = 'published' OR creator_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator'));

CREATE POLICY "courses_creator_insert" ON courses
  FOR INSERT WITH CHECK (
    creator_id = auth.uid()
    AND (
      -- Only users level 10+ OR already admin/mod can create user courses
      (SELECT level FROM user_gamification WHERE user_id = auth.uid()) >= 10
      OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator')
    )
  );

CREATE POLICY "courses_creator_update" ON courses
  FOR UPDATE USING (
    creator_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator')
  );

CREATE POLICY "courses_creator_delete" ON courses
  FOR DELETE USING (
    creator_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator')
  );

-- sections: readable if course is readable
CREATE POLICY "sections_readable" ON course_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM courses c WHERE c.id = course_id
        AND (c.status = 'published' OR c.creator_id = auth.uid()
          OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator'))
    )
  );

CREATE POLICY "sections_creator_write" ON course_sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND creator_id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator')
  );

-- lessons: same as sections
CREATE POLICY "lessons_readable" ON course_lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM courses c WHERE c.id = course_id
        AND (c.status = 'published' OR c.creator_id = auth.uid()
          OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator'))
    )
  );

CREATE POLICY "lessons_creator_write" ON course_lessons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND creator_id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator')
  );

-- enrollments: user sees their own
CREATE POLICY "enrollments_own" ON course_enrollments
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "enrollments_staff_read" ON course_enrollments
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','moderator')
  );

-- lesson progress: own only
CREATE POLICY "lesson_progress_own" ON course_lesson_progress
  FOR ALL USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- 10. SEED SYSTEM COURSES (sample)
-- ──────────────────────────────────────────────────────────────

INSERT INTO courses (title, description, short_desc, type, difficulty, tags, status, xp_reward, estimated_minutes)
VALUES
  (
    'Screenplay Formatting Fundamentals',
    'Master the strict technical rules of screenplay formatting: sluglines, action lines, dialogue, parentheticals, and transitions. Learn why format matters and how professional readers judge it.',
    'Learn the technical rules of proper screenplay format.',
    'system', 'beginner',
    ARRAY['formatting','fundamentals','structure'],
    'published', 200, 45
  ),
  (
    'Writing Compelling Themes',
    'Explore how to weave theme into every layer of your screenplay — from the premise to individual scenes. This course covers both explicit and implicit thematic approaches with real-world examples.',
    'Weave meaning into every scene through theme.',
    'system', 'intermediate',
    ARRAY['theme','craft','storytelling'],
    'published', 150, 60
  ),
  (
    'Three-Act Structure Deep Dive',
    'Understand the mechanics, purpose, and variations of three-act structure. Includes arc editor tasks where you''ll build story maps yourself.',
    'Build story architecture with confidence.',
    'system', 'beginner',
    ARRAY['structure','three-act','plotting'],
    'published', 175, 50
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_dashboard_folders.sql
-- ---------------------------------------------------------------------
-- Migration: Dashboard project folders
-- Allows users to organise their personal projects into folders on the dashboard.
-- Run in Supabase SQL editor.

-- ─── Folders table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dashboard_folders (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  emoji      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_collapsed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_folders_user ON dashboard_folders(user_id);

-- ─── Add folder_id column to projects ────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES dashboard_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_folder_id ON projects(folder_id);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE dashboard_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_folders_select" ON dashboard_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "dashboard_folders_insert" ON dashboard_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dashboard_folders_update" ON dashboard_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "dashboard_folders_delete" ON dashboard_folders
  FOR DELETE USING (auth.uid() = user_id);

-- ─── updated_at trigger ───────────────────────────────────────
CREATE TRIGGER dashboard_folders_updated_at
  BEFORE UPDATE ON dashboard_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Source: supabase/migration_development_tools.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Source: supabase/migration_feature_flags.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Feature Flags & Insider Program Migration
-- ============================================================

-- Feature flags table — admin controls which features are alpha/beta/released
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,           -- e.g. 'storyboard_ai', 'real_time_collab'
  name TEXT NOT NULL,                  -- Human-readable name
  description TEXT,                    -- What this feature does
  tier TEXT NOT NULL DEFAULT 'released' CHECK (tier IN ('alpha', 'beta', 'released', 'disabled')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'editor', 'collaboration', 'production', 'community', 'ai', 'export', 'integration')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add insider_tier column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS insider_tier TEXT DEFAULT NULL CHECK (insider_tier IS NULL OR insider_tier IN ('alpha', 'beta'));

-- RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Everyone can read feature flags (needed for client-side gating)
CREATE POLICY "feature_flags_read" ON feature_flags FOR SELECT USING (true);

-- Only admins can manage feature flags
CREATE POLICY "feature_flags_admin" ON feature_flags FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_tier ON feature_flags(tier);
CREATE INDEX IF NOT EXISTS idx_profiles_insider_tier ON profiles(insider_tier) WHERE insider_tier IS NOT NULL;

-- Seed some initial feature flags (existing features as released)
INSERT INTO feature_flags (key, name, description, tier, category) VALUES
  ('script_editor', 'Script Editor', 'Core screenplay/script writing editor', 'released', 'editor'),
  ('real_time_collab', 'Real-time Collaboration', 'Live multi-user editing with presence indicators', 'released', 'collaboration'),
  ('storyboard', 'Storyboard', 'Visual storyboard creation with shot planning', 'released', 'production'),
  ('schedule', 'Production Schedule', 'Scheduling and calendar tools for production', 'released', 'production'),
  ('budget', 'Budget Tracker', 'Production budget tracking and management', 'released', 'production'),
  ('community', 'Community', 'Community posts, discussions and sharing', 'released', 'community'),
  ('version_history', 'Version History', 'Track and restore previous script versions', 'released', 'editor'),
  ('moodboard', 'Moodboard', 'Visual mood/reference board for projects', 'released', 'production'),
  ('mindmap', 'Mind Map', 'Story structure mind mapping tool', 'released', 'editor'),
  ('documents', 'Project Documents', 'Attach and manage project documents', 'released', 'general'),
  ('project_sharing', 'Project Sharing', 'Share projects with external collaborators', 'released', 'collaboration'),
  ('company_system', 'Company System', 'Company management and team features', 'released', 'collaboration'),
  ('trailer_editor', 'Trailer Editor', 'Create and manage project trailers', 'released', 'production'),
  ('seo_toolkit', 'SEO Toolkit', 'SEO analysis for public project pages', 'released', 'general'),
  ('broll_manager', 'B-Roll Manager', 'Manage B-roll footage library', 'released', 'production'),
  -- Pro features (alpha tier — only visible to alpha insiders, or Pro subscribers)
  ('pro_share_portal', 'Share Portal', 'Share projects with external stakeholders via a branded portal', 'alpha', 'collaboration'),
  ('pro_analytics', 'Analytics Dashboard', 'Project analytics and engagement metrics', 'alpha', 'general'),
  ('pro_version_history', 'Advanced Versions', 'Full version history with diff view and restore', 'alpha', 'editor'),
  ('pro_export', 'Advanced Export', 'Bulk export, watermarked PDFs, and multi-format output', 'alpha', 'export'),
  ('pro_ai_analysis', 'AI Script Analysis', 'AI-powered script feedback and scoring', 'alpha', 'ai'),
  ('pro_client_review', 'Client Review', 'Dedicated client review portal with annotations', 'alpha', 'collaboration'),
  ('pro_branding', 'Custom Branding', 'Brand kit with custom logos, colors, and watermarks', 'alpha', 'general'),
  ('pro_revisions', 'Revision Tracking', 'Track and compare script revisions with color pages', 'alpha', 'editor'),
  ('pro_reports', 'Production Reports', 'Generate call sheets, DOOD reports, and production summaries', 'alpha', 'production'),
  ('pro_casting', 'Casting', 'Casting management with talent profiles', 'alpha', 'production'),
  ('pro_subscription', 'Pro Subscription', 'The Pro subscription / billing system itself', 'alpha', 'general')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_feedback_system.sql
-- ---------------------------------------------------------------------
-- ═══════════════════════════════════════════════════════════════════════════
--  FEEDBACK SYSTEM — Full migration
--  Covers: bug reports, feature requests, testimonials, votes, admin timeline,
--          duplicate linking, category tags, and subscriptions.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Core tables ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                 TEXT NOT NULL CHECK (type IN ('bug_report','feature_request','testimonial','other')),
  title                TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 200),
  body                 TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 5000),
  status               TEXT NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','in_progress','planned','resolved','wont_fix','intended','duplicate','pending_review')),
  priority             TEXT NOT NULL DEFAULT 'medium'
                         CHECK (priority IN ('low','medium','high','critical')),
  -- author info (may be anonymous)
  user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name          TEXT,
  author_email         TEXT,
  -- bug-specific
  steps_to_reproduce   TEXT,
  expected_behavior    TEXT,
  actual_behavior      TEXT,
  error_message        TEXT,
  url_where_occurred   TEXT,
  browser_info         JSONB,            -- { ua, platform, lang, viewport }
  -- feature-specific
  use_case             TEXT,
  -- testimonial-specific
  rating               INT CHECK (rating BETWEEN 1 AND 5),
  is_approved          BOOLEAN NOT NULL DEFAULT false,
  show_author_name     BOOLEAN NOT NULL DEFAULT true,
  -- metadata
  vote_count           INT NOT NULL DEFAULT 0,
  comment_count        INT NOT NULL DEFAULT 0,
  is_public            BOOLEAN NOT NULL DEFAULT true,
  admin_note           TEXT,             -- internal sticky note
  linked_changelog_id  UUID,             -- link to changelog_releases when resolved
  tags                 TEXT[] DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint  TEXT,                    -- fallback for anon users (browser fp)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_vote_user       UNIQUE NULLS NOT DISTINCT (item_id, user_id),
  CONSTRAINT uq_vote_fingerprint UNIQUE NULLS NOT DISTINCT (item_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS feedback_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  comment_type  TEXT NOT NULL DEFAULT 'note'
                  CHECK (comment_type IN ('note','status_change','resolution','question','update','duplicate_link')),
  is_public     BOOLEAN NOT NULL DEFAULT true,
  metadata      JSONB,                  -- { from_status, to_status, linked_item_id, ... }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_similar_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  similar_item_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  strength        FLOAT DEFAULT 0.5,   -- 0–1 similarity score
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, similar_item_id)
);

CREATE TABLE IF NOT EXISTS feedback_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_feedback_items_type      ON feedback_items(type);
CREATE INDEX IF NOT EXISTS idx_feedback_items_status    ON feedback_items(status);
CREATE INDEX IF NOT EXISTS idx_feedback_items_user      ON feedback_items(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_items_votes     ON feedback_items(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_items_created   ON feedback_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_items_approved  ON feedback_items(is_approved) WHERE type = 'testimonial';
CREATE INDEX IF NOT EXISTS idx_feedback_comments_item   ON feedback_comments(item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_item      ON feedback_votes(item_id);

-- Full-text search index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_feedback_items_fts ON feedback_items
  USING GIN (to_tsvector('english', title || ' ' || body));

-- ── 3. Counters: keep vote_count + comment_count denormalised for cheap reads ─

CREATE OR REPLACE FUNCTION feedback_update_vote_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feedback_items SET vote_count = vote_count + 1, updated_at = now() WHERE id = NEW.item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feedback_items SET vote_count = GREATEST(0, vote_count - 1), updated_at = now() WHERE id = OLD.item_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_vote_count ON feedback_votes;
CREATE TRIGGER trg_feedback_vote_count
  AFTER INSERT OR DELETE ON feedback_votes
  FOR EACH ROW EXECUTE FUNCTION feedback_update_vote_count();

CREATE OR REPLACE FUNCTION feedback_update_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feedback_items SET comment_count = comment_count + 1, updated_at = now() WHERE id = NEW.item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feedback_items SET comment_count = GREATEST(0, comment_count - 1), updated_at = now() WHERE id = OLD.item_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_comment_count ON feedback_comments;
CREATE TRIGGER trg_feedback_comment_count
  AFTER INSERT OR DELETE ON feedback_comments
  FOR EACH ROW EXECUTE FUNCTION feedback_update_comment_count();

-- ── 4. Auto-updated_at trigger ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_items_updated_at ON feedback_items;
CREATE TRIGGER trg_feedback_items_updated_at
  BEFORE UPDATE ON feedback_items
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── 5. Similarity search function (used for duplicate detection) ───────────────

CREATE OR REPLACE FUNCTION find_similar_feedback(
  p_title TEXT,
  p_body  TEXT,
  p_type  TEXT DEFAULT NULL,
  p_limit INT  DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  title      TEXT,
  type       TEXT,
  status     TEXT,
  vote_count INT,
  similarity FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    fi.id,
    fi.title,
    fi.type,
    fi.status,
    fi.vote_count,
    ts_rank(
      to_tsvector('english', fi.title || ' ' || fi.body),
      plainto_tsquery('english', p_title || ' ' || p_body)
    )::FLOAT AS similarity
  FROM feedback_items fi
  WHERE
    fi.is_public = true
    AND fi.status NOT IN ('wont_fix','duplicate')
    AND (p_type IS NULL OR fi.type = p_type)
    AND to_tsvector('english', fi.title || ' ' || fi.body)
        @@ plainto_tsquery('english', p_title || ' ' || p_body)
  ORDER BY similarity DESC
  LIMIT p_limit;
$$;

-- ── 6. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE feedback_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_votes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_similar_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_subscriptions   ENABLE ROW LEVEL SECURITY;

-- feedback_items
DROP POLICY IF EXISTS "feedback_items_select_public"  ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_insert"         ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_update_own"     ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_admin"          ON feedback_items;

CREATE POLICY "feedback_items_select_public" ON feedback_items FOR SELECT
  USING (is_public = true OR user_id = auth.uid()
         OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

CREATE POLICY "feedback_items_insert" ON feedback_items FOR INSERT
  WITH CHECK (true);   -- anyone (anon or authed) may submit

CREATE POLICY "feedback_items_update_own" ON feedback_items FOR UPDATE
  USING (user_id = auth.uid() OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

-- feedback_votes
DROP POLICY IF EXISTS "feedback_votes_select"  ON feedback_votes;
DROP POLICY IF EXISTS "feedback_votes_insert"  ON feedback_votes;
DROP POLICY IF EXISTS "feedback_votes_delete"  ON feedback_votes;

CREATE POLICY "feedback_votes_select" ON feedback_votes FOR SELECT USING (true);

CREATE POLICY "feedback_votes_insert" ON feedback_votes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND fingerprint IS NOT NULL)
  );

CREATE POLICY "feedback_votes_delete" ON feedback_votes FOR DELETE
  USING (user_id = auth.uid() OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

-- feedback_comments
DROP POLICY IF EXISTS "feedback_comments_select"  ON feedback_comments;
DROP POLICY IF EXISTS "feedback_comments_insert"  ON feedback_comments;
DROP POLICY IF EXISTS "feedback_comments_delete"  ON feedback_comments;

CREATE POLICY "feedback_comments_select" ON feedback_comments FOR SELECT
  USING (is_public = true OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

CREATE POLICY "feedback_comments_insert" ON feedback_comments FOR INSERT
  WITH CHECK (
    auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
    OR (
      auth.uid() IS NOT NULL
      AND auth.uid() = author_id
      AND comment_type = 'note'
      AND is_public = true
      -- only allow user comments on non-testimonial items
      AND (SELECT type FROM feedback_items WHERE id = item_id) <> 'testimonial'
    )
  );

CREATE POLICY "feedback_comments_delete" ON feedback_comments FOR DELETE
  USING (author_id = auth.uid() OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

-- feedback_similar_links
DROP POLICY IF EXISTS "fsl_select" ON feedback_similar_links;
DROP POLICY IF EXISTS "fsl_admin"  ON feedback_similar_links;

CREATE POLICY "fsl_select" ON feedback_similar_links FOR SELECT USING (true);
CREATE POLICY "fsl_admin"  ON feedback_similar_links FOR ALL
  USING (auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77')
  WITH CHECK (auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

-- feedback_subscriptions
DROP POLICY IF EXISTS "fsub_own" ON feedback_subscriptions;
CREATE POLICY "fsub_own" ON feedback_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 7. Convenience view: public_testimonials ──────────────────────────────────

DROP VIEW IF EXISTS public_testimonials;
CREATE VIEW public_testimonials AS
  SELECT
    id, title, body, rating, show_author_name,
    CASE WHEN show_author_name THEN author_name ELSE 'Anonymous' END AS display_name,
    vote_count, comment_count,
    created_at
  FROM feedback_items
  WHERE type = 'testimonial' AND is_approved = true AND is_public = true
  ORDER BY rating DESC, created_at DESC;

GRANT SELECT ON public_testimonials TO anon, authenticated;

-- ── 8. Convenience view: public_roadmap ───────────────────────────────────────

CREATE OR REPLACE VIEW public_roadmap AS
  SELECT
    id, type, title, body, status, priority,
    vote_count, comment_count, tags,
    created_at, updated_at
  FROM feedback_items
  WHERE is_public = true
    AND type IN ('bug_report','feature_request')
    AND status NOT IN ('duplicate')
  ORDER BY vote_count DESC, created_at DESC;

GRANT SELECT ON public_roadmap TO anon, authenticated;

-- ── 9. Grant sequence of helper functions to authenticated role ───────────────

GRANT EXECUTE ON FUNCTION find_similar_feedback(TEXT,TEXT,TEXT,INT) TO anon, authenticated;

-- ── 9b. Table-level grants (required alongside RLS policies) ─────────────────
-- Supabase requires both a permissive RLS policy AND a table-level GRANT.
-- Without these, anon/authenticated roles are blocked at the privilege layer
-- before RLS even runs.

GRANT SELECT, INSERT                ON feedback_items         TO anon, authenticated;
GRANT SELECT, INSERT, DELETE        ON feedback_votes         TO anon, authenticated;
GRANT SELECT, INSERT, DELETE        ON feedback_comments      TO anon, authenticated;
GRANT SELECT                        ON feedback_similar_links TO anon, authenticated;
GRANT SELECT, INSERT, DELETE        ON feedback_subscriptions TO anon, authenticated;

-- ── 10. Re-point feedback_items.user_id FK to profiles(id) ──────────────────
-- This lets PostgREST discover the join feedback_items → profiles directly.
-- profiles.id is a PK that mirrors auth.users.id, so data integrity is the same.

ALTER TABLE feedback_items
  DROP CONSTRAINT IF EXISTS feedback_items_user_id_fkey,
  ADD CONSTRAINT feedback_items_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 11. Allow user-facing RLS delete on own comments ────────────────────────
DROP POLICY IF EXISTS "feedback_comments_delete" ON feedback_comments;
CREATE POLICY "feedback_comments_delete" ON feedback_comments FOR DELETE
  USING (
    author_id = auth.uid()
    OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
  );

-- ---------------------------------------------------------------------
-- Source: supabase/migration_festival_bridge.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Source: supabase/migration_fix_accept_invitation.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Fix: accept_company_invitation role casting
-- Error: column "role" is of type user_role but expression is of type text
-- Fix: Explicitly cast the role value to avoid type mismatch
-- ============================================================

CREATE OR REPLACE FUNCTION accept_company_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv company_invitations%ROWTYPE;
  v_user_id UUID;
  v_company_name TEXT;
  v_role_text TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch the invitation
  SELECT * INTO v_inv FROM company_invitations WHERE id = p_invitation_id;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  -- Check it hasn't already been accepted
  IF v_inv.accepted THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Already accepted');
  END IF;

  -- Check it hasn't expired
  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < NOW() THEN
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- Extract role as text for safe casting
  v_role_text := v_inv.role::text;

  -- Mark invitation as accepted
  UPDATE company_invitations SET accepted = true WHERE id = p_invitation_id;

  -- Insert into company_members with explicit role cast
  -- Use text intermediate to avoid enum-to-enum casting issues
  EXECUTE format(
    'INSERT INTO company_members (company_id, user_id, role, invited_by)
     VALUES ($1, $2, $3::%I, $4)
     ON CONFLICT (company_id, user_id) DO UPDATE SET role = $3::%I',
    (SELECT typname FROM pg_type WHERE oid = (
      SELECT atttypid FROM pg_attribute
      WHERE attrelid = 'company_members'::regclass AND attname = 'role'
    )),
    (SELECT typname FROM pg_type WHERE oid = (
      SELECT atttypid FROM pg_attribute
      WHERE attrelid = 'company_members'::regclass AND attname = 'role'
    ))
  ) USING v_inv.company_id, v_user_id, v_role_text, v_inv.invited_by;

  -- Update profile company_id
  UPDATE profiles SET company_id = v_inv.company_id WHERE id = v_user_id;

  -- Get company name for response
  SELECT name INTO v_company_name FROM companies WHERE id = v_inv.company_id;

  -- Log activity
  INSERT INTO company_activity_log (company_id, user_id, action, entity_type, metadata)
  VALUES (v_inv.company_id, v_user_id, 'accepted_invitation', 'member',
    jsonb_build_object('role', v_role_text));

  RETURN jsonb_build_object('ok', true, 'company_id', v_inv.company_id, 'company_name', v_company_name);
END;
$$;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_fix_broadcast_member.sql
-- ---------------------------------------------------------------------
-- Fix is_broadcast_member: projects table uses created_by, not user_id
CREATE OR REPLACE FUNCTION is_broadcast_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_fix_company_members_rls.sql
-- ---------------------------------------------------------------------
-- Fix: infinite recursion in company_members RLS policies
--
-- Root cause: any SELECT policy that queries company_members inside its USING
-- clause without going through a SECURITY DEFINER function will recurse.
-- The helper functions below bypass RLS (SECURITY DEFINER), breaking the cycle.

-- ── 1. Re-create helper functions as SECURITY DEFINER ────────────────────────

CREATE OR REPLACE FUNCTION get_user_company_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER   -- bypasses RLS on company_members
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM company_members WHERE user_id = p_user_id;
$$;

-- Must drop with CASCADE — dependent policies on companies, company_teams,
-- company_team_members, company_blog_posts, company_blog_comments, projects
-- will be dropped and recreated below.
DROP FUNCTION IF EXISTS get_user_company_role(UUID, UUID) CASCADE;

CREATE FUNCTION get_user_company_role(p_company_id UUID, p_user_id UUID)
RETURNS TEXT        -- TEXT is safe even if company_role enum doesn't exist yet
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role::TEXT
  FROM company_members
  WHERE company_id = p_company_id AND user_id = p_user_id
  LIMIT 1;
$$;

-- ── 2. Drop ALL existing company_members SELECT policies ─────────────────────
-- (names may differ on the live DB so we drop every possible variant)

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'company_members' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON company_members', pol.policyname);
  END LOOP;
END $$;

-- ── 3. Re-create the SELECT policy using the SECURITY DEFINER helpers ────────

CREATE POLICY "company_members_select"
  ON company_members FOR SELECT
  USING (
    -- user is a member of the company (via bypass function — no recursion)
    company_id IN (SELECT get_user_company_ids(auth.uid()))
    -- or the user is the company owner
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    -- or the company has a public page
    OR company_id IN (SELECT id FROM companies WHERE public_page_enabled = true)
  );

-- ── 4. Re-create INSERT / UPDATE / DELETE policies using helpers ─────────────

DROP POLICY IF EXISTS "Company admins can add members"    ON company_members;
DROP POLICY IF EXISTS "Company admins can update members" ON company_members;
DROP POLICY IF EXISTS "Company admins can remove members" ON company_members;
DROP POLICY IF EXISTS "company_members_insert"            ON company_members;
DROP POLICY IF EXISTS "company_members_update"            ON company_members;
DROP POLICY IF EXISTS "company_members_delete"            ON company_members;

CREATE POLICY "company_members_insert"
  ON company_members FOR INSERT
  WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "company_members_update"
  ON company_members FOR UPDATE
  USING (
    user_id = auth.uid()
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

CREATE POLICY "company_members_delete"
  ON company_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

-- ── 5. Recreate policies that were CASCADE-dropped ───────────────────────────

-- companies
CREATE POLICY "Company admins can update"
  ON companies FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR get_user_company_role(id, auth.uid()) IN ('owner', 'admin')
  );

-- company_teams
CREATE POLICY "Company admins can manage teams"
  ON company_teams FOR ALL
  USING (
    get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  );

-- company_team_members
CREATE POLICY "Company admins manage team members"
  ON company_team_members FOR ALL
  USING (
    get_user_company_role(
      (SELECT company_id FROM company_teams WHERE id = team_id),
      auth.uid()
    ) IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    get_user_company_role(
      (SELECT company_id FROM company_teams WHERE id = team_id),
      auth.uid()
    ) IN ('owner', 'admin', 'manager')
  );

-- company_blog_posts
CREATE POLICY "Company members can create blog posts"
  ON company_blog_posts FOR INSERT
  WITH CHECK (
    get_user_company_role(company_id, auth.uid()) IS NOT NULL
  );

CREATE POLICY "Blog post authors and admins can update"
  ON company_blog_posts FOR UPDATE
  USING (
    author_id = auth.uid()
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

CREATE POLICY "Company admins can delete blog posts"
  ON company_blog_posts FOR DELETE
  USING (
    author_id = auth.uid()
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

-- company_blog_comments
CREATE POLICY "Comment authors and admins can delete"
  ON company_blog_comments FOR DELETE
  USING (
    author_id = auth.uid()
    OR get_user_company_role(
      (SELECT company_id FROM company_blog_posts WHERE id = post_id),
      auth.uid()
    ) IN ('owner', 'admin')
  );

-- projects (company-scoped)
CREATE POLICY "Company admins can create company projects"
  ON projects FOR INSERT
  WITH CHECK (
    company_id IS NULL
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "Company admins can update company projects"
  ON projects FOR UPDATE
  USING (
    company_id IS NULL
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "Company owners can delete company projects"
  ON projects FOR DELETE
  USING (
    company_id IS NULL
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

-- ---------------------------------------------------------------------
-- Source: supabase/migration_fix_invitations.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Fix Company Invitation System
-- 1. get_invitation_by_token — public lookup for invite pages
-- 2. decline_company_invitation — SECURITY DEFINER (avoids RLS)
-- 3. get_pending_invitations — returns pending invites for current user
-- 4. check_invitations_for_new_user — trigger on profile creation
-- ============================================================

-- 1. Get invitation by token (for /company/invite/[token] page)
-- Uses SECURITY DEFINER so anyone with the link can view it
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv RECORD;
  v_company RECORD;
BEGIN
  SELECT * INTO v_inv FROM company_invitations WHERE token = p_token;
  IF v_inv IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, name, slug, logo_url, brand_color INTO v_company
  FROM companies WHERE id = v_inv.company_id;

  RETURN jsonb_build_object(
    'id', v_inv.id,
    'company_id', v_inv.company_id,
    'email', v_inv.email,
    'role', v_inv.role,
    'accepted', v_inv.accepted,
    'expires_at', v_inv.expires_at,
    'created_at', v_inv.created_at,
    'token', v_inv.token,
    'company', jsonb_build_object(
      'id', v_company.id,
      'name', v_company.name,
      'slug', v_company.slug,
      'logo_url', v_company.logo_url,
      'brand_color', v_company.brand_color
    )
  );
END;
$$;

-- 2. Decline invitation (SECURITY DEFINER so RLS doesn't block it)
CREATE OR REPLACE FUNCTION decline_company_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv company_invitations%ROWTYPE;
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_inv FROM company_invitations WHERE id = p_invitation_id;
  IF v_inv IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Invitation not found');
  END IF;

  -- Verify the current user is the invitee (match by email)
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS DISTINCT FROM v_inv.email THEN
    -- Also allow company admins to revoke
    IF NOT EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = v_inv.company_id AND user_id = v_user_id AND role IN ('owner', 'admin')
    ) THEN
      RAISE EXCEPTION 'Not authorized to decline this invitation';
    END IF;
  END IF;

  DELETE FROM company_invitations WHERE id = p_invitation_id;

  -- Log the decline
  INSERT INTO company_activity_log (company_id, user_id, action, entity_type, metadata)
  VALUES (v_inv.company_id, v_user_id, 'declined_invitation', 'member',
    jsonb_build_object('email', v_inv.email, 'role', v_inv.role));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. Get pending invitations for the current user
CREATE OR REPLACE FUNCTION get_pending_invitations()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(inv_with_company)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT ci.id, ci.company_id, ci.email, ci.role, ci.token, ci.created_at, ci.expires_at,
           c.name as company_name, c.slug as company_slug, c.logo_url as company_logo,
           c.brand_color as company_color,
           p.display_name as invited_by_name
    FROM company_invitations ci
    JOIN companies c ON c.id = ci.company_id
    LEFT JOIN profiles p ON p.id = ci.invited_by
    WHERE ci.email = v_user_email
      AND ci.accepted = false
      AND (ci.expires_at IS NULL OR ci.expires_at > NOW())
    ORDER BY ci.created_at DESC
  ) inv_with_company;

  RETURN v_result;
END;
$$;

-- 4. Trigger: when a new user registers, check if there are pending invitations
-- and create notifications for them
CREATE OR REPLACE FUNCTION check_invitations_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_inv RECORD;
  v_company RECORD;
  v_actor_name TEXT;
BEGIN
  -- Find any pending invitations for this email
  FOR v_inv IN
    SELECT * FROM company_invitations
    WHERE email = NEW.email AND accepted = false
      AND (expires_at IS NULL OR expires_at > NOW())
  LOOP
    SELECT id, name, slug INTO v_company FROM companies WHERE id = v_inv.company_id;

    SELECT COALESCE(display_name, full_name, 'Someone')
    INTO v_actor_name FROM profiles WHERE id = v_inv.invited_by;

    -- Create notification for the newly registered user
    PERFORM create_notification(
      NEW.id, 'company_invitation',
      'You were invited to join ' || v_company.name,
      COALESCE(v_actor_name, 'Someone') || ' invited you as ' || v_inv.role,
      '/company/invite/' || v_inv.token::text,
      v_inv.invited_by, 'company_invitation', v_inv.id,
      jsonb_build_object(
        'company_id', v_company.id,
        'company_name', v_company.name,
        'invitation_id', v_inv.id,
        'role', v_inv.role,
        'token', v_inv.token
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists, create new one on profiles table
DROP TRIGGER IF EXISTS check_invitations_on_signup ON profiles;
CREATE TRIGGER check_invitations_on_signup
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_invitations_for_new_user();

-- Also update the notify_on_company_invitation to include token in action_url
CREATE OR REPLACE FUNCTION notify_on_company_invitation()
RETURNS TRIGGER AS $$
DECLARE
  v_company RECORD;
  v_actor_name TEXT;
  v_target_user UUID;
BEGIN
  SELECT id, name, slug INTO v_company FROM companies WHERE id = NEW.company_id;
  IF v_company IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor_name FROM profiles WHERE id = NEW.invited_by;

  SELECT id INTO v_target_user FROM profiles WHERE email = NEW.email;

  IF v_target_user IS NOT NULL THEN
    PERFORM create_notification(
      v_target_user, 'company_invitation',
      'You were invited to join ' || v_company.name,
      v_actor_name || ' invited you as ' || NEW.role,
      '/company/invite/' || NEW.token::text,
      NEW.invited_by, 'company_invitation', NEW.id,
      jsonb_build_object(
        'company_id', v_company.id,
        'company_name', v_company.name,
        'invitation_id', NEW.id,
        'role', NEW.role,
        'token', NEW.token
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow invited users to read their own invitations
DROP POLICY IF EXISTS "Users can see invitations for their email" ON company_invitations;
CREATE POLICY "Users can see invitations for their email" ON company_invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = company_invitations.company_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------
-- Source: supabase/migration_fix_shares_paypal.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Migration: Fix external shares for anonymous access + PayPal rename
-- Run this if you already applied migration_pro_subscription.sql
-- ============================================================

-- 1. Add content_snapshot column for storing share content (avoids RLS issues on anonymous access)
ALTER TABLE external_shares ADD COLUMN IF NOT EXISTS content_snapshot JSONB DEFAULT NULL;

-- 2. Rename Stripe columns to PayPal
ALTER TABLE subscriptions RENAME COLUMN stripe_customer_id TO paypal_customer_id;
ALTER TABLE subscriptions RENAME COLUMN stripe_subscription_id TO paypal_subscription_id;

-- 3. Add anonymous-friendly RLS policies for external share viewing
-- Anyone with the token can read active shares (the token itself is the access control)
CREATE POLICY "Public read active shares by token" ON external_shares
  FOR SELECT USING (is_active = true);

-- Anyone can increment view count on active shares
CREATE POLICY "Public update view count" ON external_shares
  FOR UPDATE USING (is_active = true) WITH CHECK (is_active = true);

-- ---------------------------------------------------------------------
-- Source: supabase/migration_gamification.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Gamification System Migration
-- Run in Supabase SQL editor
-- ============================================================

-- ── Badges ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  emoji         text NOT NULL DEFAULT '🏅',
  color         text NOT NULL DEFAULT '#FF5F1F',   -- hex color for badge chip
  is_system     boolean NOT NULL DEFAULT false,
  system_role   text,                              -- 'admin' | 'moderator' | 'contributor' — auto-awarded
  created_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Seed system badges
INSERT INTO badges (name, description, emoji, color, is_system, system_role) VALUES
  ('Admin',       'Platform administrator',         '🛡️', '#EF4444', true, 'admin'),
  ('Moderator',   'Community moderator',            '🔰', '#22C55E', true, 'moderator'),
  ('Contributor', 'Open-source contributor',        '⭐', '#F59E0B', true, 'contributor')
ON CONFLICT DO NOTHING;

-- ── User Badges ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_badges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id     uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- null = system
  awarded_at   timestamptz NOT NULL DEFAULT now(),
  -- Which display slot this badge is assigned to (null = owned but not displayed)
  -- Slot 1 = primary   Slot 2 = secondary (admins/mods/contributors only)
  display_slot int CHECK (display_slot IN (1, 2)),
  UNIQUE (user_id, badge_id)
);

-- ── Gamification state per user ───────────────────────────────
CREATE TABLE IF NOT EXISTS user_gamification (
  user_id            uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  xp_total           bigint NOT NULL DEFAULT 0,
  level              int    NOT NULL DEFAULT 1,
  -- null = never asked; false = opted out; true = opted in
  gamification_enabled boolean,
  -- whether the opt-in popup has been shown yet (after onboarding)
  popup_shown        boolean NOT NULL DEFAULT false,
  -- for daily login streak tracking
  last_login_date    date,
  login_streak       int NOT NULL DEFAULT 0,
  -- writing session tracking
  session_started_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ── XP Events log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type   text NOT NULL,
  xp_base      int  NOT NULL DEFAULT 0,
  multiplier   numeric(6,3) NOT NULL DEFAULT 1.0,
  xp_awarded   int  NOT NULL DEFAULT 0,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Profile columns ───────────────────────────────────────────
-- Primary badge shown next to name everywhere
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS selected_badge_id  uuid REFERENCES badges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_badge2_id uuid REFERENCES badges(id) ON DELETE SET NULL;

-- ── RLS Policies ─────────────────────────────────────────────

-- badges: public read, admin write
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "badges_read"  ON badges;
DROP POLICY IF EXISTS "badges_write" ON badges;
CREATE POLICY "badges_read"  ON badges FOR SELECT USING (true);
CREATE POLICY "badges_write" ON badges FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- user_badges: public read, admins/mods can award; users manage own slots
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_badges_read"      ON user_badges;
DROP POLICY IF EXISTS "user_badges_award"     ON user_badges;
DROP POLICY IF EXISTS "user_badges_self_slot" ON user_badges;
CREATE POLICY "user_badges_read" ON user_badges FOR SELECT USING (true);
CREATE POLICY "user_badges_award" ON user_badges FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','moderator'))
  OR auth.uid() = user_id   -- system auto-award (called via service role)
);
CREATE POLICY "user_badges_self_slot" ON user_badges FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_badges_delete" ON user_badges FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR auth.uid() = user_id
);

-- user_gamification: users see/edit own; service role full access
ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gamif_self" ON user_gamification;
CREATE POLICY "gamif_self" ON user_gamification FOR ALL USING (auth.uid() = user_id);

-- xp_events: users see own
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "xp_read" ON xp_events;
CREATE POLICY "xp_read" ON xp_events FOR SELECT USING (auth.uid() = user_id);

-- ── Trigger: init gamification row on new profile ─────────────
CREATE OR REPLACE FUNCTION init_user_gamification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_gamification (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_gamification ON profiles;
CREATE TRIGGER trg_init_gamification
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION init_user_gamification();

-- Back-fill existing profiles that don't have a gamification row
INSERT INTO user_gamification (user_id)
SELECT id FROM profiles
WHERE id NOT IN (SELECT user_id FROM user_gamification)
ON CONFLICT DO NOTHING;

-- ── Trigger: auto-award system badges when role changes ───────
CREATE OR REPLACE FUNCTION sync_system_badges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_badge_id uuid;
BEGIN
  -- Remove all system badges from this user first
  DELETE FROM user_badges
  WHERE user_id = NEW.id
    AND badge_id IN (SELECT id FROM badges WHERE is_system = true AND system_role IS NOT NULL);

  -- Re-award the badge matching their new role
  IF NEW.role IN ('admin','moderator') THEN
    SELECT id INTO v_badge_id FROM badges WHERE system_role = NEW.role LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id, display_slot)
      VALUES (NEW.id, v_badge_id, 1)
      ON CONFLICT (user_id, badge_id) DO UPDATE SET display_slot = 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_system_badges ON profiles;
CREATE TRIGGER trg_sync_system_badges
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_system_badges();

-- Back-fill existing admins and moderators
DO $$
DECLARE
  r RECORD;
  v_badge_id uuid;
BEGIN
  FOR r IN SELECT id, role FROM profiles WHERE role IN ('admin','moderator') LOOP
    SELECT id INTO v_badge_id FROM badges WHERE system_role = r.role LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id, display_slot)
      VALUES (r.id, v_badge_id, 1)
      ON CONFLICT (user_id, badge_id) DO UPDATE SET display_slot = 1;
    END IF;
  END LOOP;
END $$;

-- ── Helper function: award XP (called from API routes) ────────
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id    uuid,
  p_event_type text,
  p_xp_base    int,
  p_multiplier numeric DEFAULT 1.0,
  p_metadata   jsonb   DEFAULT NULL
)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_xp_awarded int;
  v_new_total  bigint;
  v_new_level  int;
BEGIN
  v_xp_awarded := GREATEST(1, ROUND(p_xp_base * p_multiplier)::int);

  -- Check user opted out — still log event but don't update display
  INSERT INTO xp_events (user_id, event_type, xp_base, multiplier, xp_awarded, metadata)
  VALUES (p_user_id, p_event_type, p_xp_base, p_multiplier, v_xp_awarded, p_metadata);

  -- Upsert gamification row
  INSERT INTO user_gamification (user_id, xp_total) VALUES (p_user_id, v_xp_awarded)
  ON CONFLICT (user_id) DO UPDATE
    SET xp_total   = user_gamification.xp_total + v_xp_awarded,
        updated_at = now()
  RETURNING xp_total INTO v_new_total;

  -- Recalculate level (100 * level^1.6 cumulative threshold)
  v_new_level := 1;
  WHILE v_new_level < 100 AND v_new_total >= ROUND(80 * POWER(v_new_level, 1.8))::bigint LOOP
    v_new_level := v_new_level + 1;
  END LOOP;

  UPDATE user_gamification SET level = v_new_level WHERE user_id = p_user_id;

  RETURN v_xp_awarded;
END;
$$;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_idea_boards.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Idea Boards
-- Collaborative block-based note boards that live outside of
-- projects. Users can have personal boards or share them with
-- collaborators. Boards can optionally be linked to a project.
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS idea_boards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL DEFAULT 'Untitled Board',
  description  text,
  emoji        text DEFAULT '💡',
  color        text DEFAULT '#6366f1',
  linked_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  is_archived  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Members of a board (owner is implicitly an editor)
-- role: 'editor' can read + write nodes; 'viewer' can read only
CREATE TABLE IF NOT EXISTS idea_board_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   uuid NOT NULL REFERENCES idea_boards(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, user_id)
);

-- Content blocks (nodes) on a board
-- type: heading | text | checklist | divider | project_link | image
-- content JSONB shape per type:
--   heading:      { text }
--   text:         { text }
--   checklist:    { text, checked }
--   divider:      {}
--   project_link: { project_id, project_title, project_color }
--   image:        { url, caption }
CREATE TABLE IF NOT EXISTS idea_nodes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    uuid NOT NULL REFERENCES idea_boards(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'text'
                CHECK (type IN ('heading', 'text', 'checklist', 'divider', 'project_link', 'image')),
  content     jsonb NOT NULL DEFAULT '{}',
  sort_order  numeric NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_idea_boards_owner     ON idea_boards(owner_id);
CREATE INDEX IF NOT EXISTS idx_idea_boards_project   ON idea_boards(linked_project_id);
CREATE INDEX IF NOT EXISTS idx_idea_board_members_board ON idea_board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_idea_board_members_user  ON idea_board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_idea_nodes_board      ON idea_nodes(board_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_idea_nodes_created_by ON idea_nodes(created_by);

-- ── updated_at triggers ──────────────────────────────────────

CREATE OR REPLACE FUNCTION set_idea_boards_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_idea_boards_updated_at ON idea_boards;
CREATE TRIGGER trg_idea_boards_updated_at
  BEFORE UPDATE ON idea_boards
  FOR EACH ROW EXECUTE FUNCTION set_idea_boards_updated_at();

CREATE OR REPLACE FUNCTION set_idea_nodes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_idea_nodes_updated_at ON idea_nodes;
CREATE TRIGGER trg_idea_nodes_updated_at
  BEFORE UPDATE ON idea_nodes
  FOR EACH ROW EXECUTE FUNCTION set_idea_nodes_updated_at();

-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE idea_boards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_nodes         ENABLE ROW LEVEL SECURITY;

-- ── idea_boards policies ─────────────────────────────────────

-- Helper: returns board IDs owned by the current user.
-- SECURITY DEFINER bypasses RLS on idea_boards so ibm_select
-- can check ownership without causing infinite recursion.
CREATE OR REPLACE FUNCTION get_owned_board_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT id FROM idea_boards WHERE owner_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_owned_board_ids() TO authenticated;

DROP POLICY IF EXISTS "idea_boards_select" ON idea_boards;
CREATE POLICY "idea_boards_select" ON idea_boards
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (SELECT board_id FROM idea_board_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "idea_boards_insert" ON idea_boards;
CREATE POLICY "idea_boards_insert" ON idea_boards
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "idea_boards_update" ON idea_boards;
CREATE POLICY "idea_boards_update" ON idea_boards
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "idea_boards_delete" ON idea_boards;
CREATE POLICY "idea_boards_delete" ON idea_boards
  FOR DELETE USING (owner_id = auth.uid());

-- ── idea_board_members policies ──────────────────────────────

DROP POLICY IF EXISTS "ibm_select" ON idea_board_members;
CREATE POLICY "ibm_select" ON idea_board_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR board_id IN (SELECT get_owned_board_ids())
  );

DROP POLICY IF EXISTS "ibm_insert" ON idea_board_members;
CREATE POLICY "ibm_insert" ON idea_board_members
  FOR INSERT WITH CHECK (
    board_id IN (SELECT id FROM idea_boards WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "ibm_update" ON idea_board_members;
CREATE POLICY "ibm_update" ON idea_board_members
  FOR UPDATE USING (
    board_id IN (SELECT id FROM idea_boards WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "ibm_delete" ON idea_board_members;
CREATE POLICY "ibm_delete" ON idea_board_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR board_id IN (SELECT id FROM idea_boards WHERE owner_id = auth.uid())
  );

-- ── idea_nodes policies ──────────────────────────────────────

DROP POLICY IF EXISTS "idea_nodes_select" ON idea_nodes;
CREATE POLICY "idea_nodes_select" ON idea_nodes
  FOR SELECT USING (
    board_id IN (
      SELECT id FROM idea_boards WHERE owner_id = auth.uid()
      UNION ALL
      SELECT board_id FROM idea_board_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "idea_nodes_insert" ON idea_nodes;
CREATE POLICY "idea_nodes_insert" ON idea_nodes
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND board_id IN (
      SELECT id FROM idea_boards WHERE owner_id = auth.uid()
      UNION ALL
      SELECT board_id FROM idea_board_members WHERE user_id = auth.uid() AND role = 'editor'
    )
  );

DROP POLICY IF EXISTS "idea_nodes_update" ON idea_nodes;
CREATE POLICY "idea_nodes_update" ON idea_nodes
  FOR UPDATE USING (
    board_id IN (
      SELECT id FROM idea_boards WHERE owner_id = auth.uid()
      UNION ALL
      SELECT board_id FROM idea_board_members WHERE user_id = auth.uid() AND role = 'editor'
    )
  );

DROP POLICY IF EXISTS "idea_nodes_delete" ON idea_nodes;
CREATE POLICY "idea_nodes_delete" ON idea_nodes
  FOR DELETE USING (
    board_id IN (
      SELECT id FROM idea_boards WHERE owner_id = auth.uid()
      UNION ALL
      SELECT board_id FROM idea_board_members WHERE user_id = auth.uid() AND role = 'editor'
    )
  );

-- ── Convenience view for board list with member count ────────

CREATE OR REPLACE VIEW idea_boards_with_meta AS
SELECT
  b.*,
  p.full_name  AS owner_name,
  p.avatar_url AS owner_avatar,
  COUNT(DISTINCT m.user_id) AS member_count,
  lp.title       AS linked_project_title,
  NULL::text     AS linked_project_color
FROM idea_boards b
LEFT JOIN profiles           p  ON p.id = b.owner_id
LEFT JOIN idea_board_members m  ON m.board_id = b.id
LEFT JOIN projects           lp ON lp.id = b.linked_project_id
GROUP BY b.id, p.full_name, p.avatar_url, lp.title;

-- Grant authenticated users access
GRANT SELECT ON idea_boards_with_meta TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON idea_boards        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON idea_board_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON idea_nodes         TO authenticated;

-- ── Changelog entry ──────────────────────────────────────────

INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES ('2.8.0', 'Idea Boards', 'Collaborative block-based boards for capturing ideas outside of projects.', 'minor')
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Idea Boards',
  'New collaborative idea boards that live outside of projects. Create personal boards or share them with collaborators. Add text, headings, checklists, dividers, and project links. Boards can optionally be linked to a specific project.',
  'feature',
  'documents',
  true,
  10
FROM changelog_releases WHERE version = '2.8.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.8.0' AND ce.title = 'Idea Boards'
);

-- ---------------------------------------------------------------------
-- Source: supabase/migration_idea_boards_folders.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Idea Boards — Folder / Nesting Support
-- 
-- Adds parent_id + root_board_id to idea_boards so boards can
-- nest infinitely (like folders). Members are always attached
-- to the root board; child boards inherit that access.
-- ============================================================

-- ── Schema additions ─────────────────────────────────────────

ALTER TABLE idea_boards
  ADD COLUMN IF NOT EXISTS parent_id     uuid REFERENCES idea_boards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS root_board_id uuid REFERENCES idea_boards(id) ON DELETE CASCADE;

-- parent_id:     direct parent (NULL = top-level / root board)
-- root_board_id: always the top-level ancestor (NULL for root boards themselves)

CREATE INDEX IF NOT EXISTS idx_idea_boards_parent   ON idea_boards(parent_id);
CREATE INDEX IF NOT EXISTS idx_idea_boards_root     ON idea_boards(root_board_id);

-- ── Helper function ───────────────────────────────────────────
-- Returns board_ids where the current user is an explicit member.
-- SECURITY DEFINER + search_path so auth.uid() resolves correctly
-- and breaks the SELECT policy → ibm → idea_boards recursion.

CREATE OR REPLACE FUNCTION get_member_board_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, auth
AS $$
  SELECT board_id FROM idea_board_members WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_member_board_ids() TO authenticated;

-- ── Updated RLS policies ──────────────────────────────────────

-- SELECT: user can see a board if:
--   1. They own it
--   2. It is a root board and they are an explicit member
--   3. Its root ancestor is owned by them (child board of own board)
--   4. Its root ancestor has them as an explicit member (shared subtree)

DROP POLICY IF EXISTS "idea_boards_select" ON idea_boards;
CREATE POLICY "idea_boards_select" ON idea_boards
  FOR SELECT USING (
    owner_id = auth.uid()
    OR (root_board_id IS NULL AND id              IN (SELECT get_member_board_ids()))
    OR                           root_board_id    IN (SELECT get_owned_board_ids())
    OR                           root_board_id    IN (SELECT get_member_board_ids())
  );

-- INSERT: owner_id must be current user.
-- For root boards: no extra check.
-- For child boards: root_board_id must point to a board they own OR are a member of.
-- (The frontend always sets root_board_id = parent.root_board_id ?? parent.id)

DROP POLICY IF EXISTS "idea_boards_insert" ON idea_boards;
CREATE POLICY "idea_boards_insert" ON idea_boards
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    AND (
      parent_id IS NULL                                           -- root board
      OR root_board_id IN (SELECT get_owned_board_ids())         -- child of own board
      OR root_board_id IN (SELECT get_member_board_ids())        -- child of shared board
    )
  );

-- ── Recreate view to pick up new columns ─────────────────────
-- CREATE OR REPLACE VIEW can't change column structure, so drop first.

DROP VIEW IF EXISTS idea_boards_with_meta;
CREATE VIEW idea_boards_with_meta AS
SELECT
  b.*,
  p.full_name  AS owner_name,
  p.avatar_url AS owner_avatar,
  COUNT(DISTINCT m.user_id) AS member_count,
  lp.title       AS linked_project_title,
  NULL::text     AS linked_project_color
FROM idea_boards b
LEFT JOIN profiles           p  ON p.id = b.owner_id
LEFT JOIN idea_board_members m  ON m.board_id = b.id
LEFT JOIN projects           lp ON lp.id = b.linked_project_id
GROUP BY b.id, p.full_name, p.avatar_url, lp.title;

GRANT SELECT ON idea_boards_with_meta TO authenticated;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_multi_location_markers.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Migration: Multi-Location Markers
-- Allows a single map marker to link to multiple locations
-- ============================================================

-- Add location_ids array column to location_markers
ALTER TABLE location_markers 
  ADD COLUMN IF NOT EXISTS location_ids UUID[] DEFAULT '{}';

-- Migrate existing location_id to location_ids
UPDATE location_markers 
  SET location_ids = ARRAY[location_id] 
  WHERE location_id IS NOT NULL AND (location_ids IS NULL OR location_ids = '{}');

-- Create index for location_ids array (GIN for containment queries)
CREATE INDEX IF NOT EXISTS idx_location_markers_location_ids 
  ON location_markers USING GIN (location_ids);

-- ---------------------------------------------------------------------
-- Source: supabase/migration_nested_folders.sql
-- ---------------------------------------------------------------------
-- Migration: Nested dashboard folders + sort_order on folder assignments
-- Run this in your Supabase SQL editor

-- 1. Add parent_id to dashboard_folders for nesting support
ALTER TABLE dashboard_folders
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES dashboard_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dashboard_folders_parent_id_idx ON dashboard_folders(parent_id);

-- 2. Add sort_order to user_project_folder_assignments (for manual project ordering within folders)
ALTER TABLE user_project_folder_assignments
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 3. Make sure is_collapsed column exists (may already exist)
ALTER TABLE dashboard_folders
  ADD COLUMN IF NOT EXISTS is_collapsed boolean NOT NULL DEFAULT false;

-- Done

-- ---------------------------------------------------------------------
-- Source: supabase/migration_new_features.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Source: supabase/migration_org_system.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Organization System — Full Enterprise Upgrade
-- 
-- Extends the existing company system with:
--   • Org channels (internal communication)
--   • Announcements with read receipts
--   • Project pipeline / kanban stages
--   • Script assignments with deadlines & approval
--   • Internal review notes (separate from regular comments)
--   • Shared resource library (templates, style guides, assets)
--   • Org calendar / milestones
--   • Pitch board for structured story development
--   • Polls / voting within the org
--   • Enhanced analytics tracking
--   • Education mode (classes, assignments, peer review)
--
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS throughout.
-- ============================================================

-- ── 1. ORG CHANNELS (Internal Communication) ────────────────

CREATE TABLE IF NOT EXISTS org_channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  icon        text DEFAULT '#',
  color       text DEFAULT '#6366f1',
  channel_type text NOT NULL DEFAULT 'general'
    CHECK (channel_type IN ('general', 'project', 'team', 'announcement', 'random')),
  is_archived boolean NOT NULL DEFAULT false,
  is_default  boolean NOT NULL DEFAULT false,
  project_id  uuid REFERENCES projects(id) ON DELETE SET NULL,
  team_id     uuid REFERENCES company_teams(id) ON DELETE SET NULL,
  created_by  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_channels_company ON org_channels(company_id);
CREATE INDEX IF NOT EXISTS idx_org_channels_project ON org_channels(project_id);

CREATE TABLE IF NOT EXISTS org_channel_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  uuid NOT NULL REFERENCES org_channels(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     text NOT NULL,
  reply_to_id uuid REFERENCES org_channel_messages(id) ON DELETE SET NULL,
  is_pinned   boolean NOT NULL DEFAULT false,
  attachments jsonb DEFAULT '[]',
  reactions   jsonb DEFAULT '{}',
  is_edited   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_channel_messages_channel ON org_channel_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_channel_messages_author ON org_channel_messages(author_id);

CREATE TABLE IF NOT EXISTS org_channel_members (
  channel_id  uuid NOT NULL REFERENCES org_channels(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT now(),
  is_muted    boolean NOT NULL DEFAULT false,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

-- ── 2. ORG ANNOUNCEMENTS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  content     text NOT NULL,
  priority    text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category    text DEFAULT 'general',
  is_pinned   boolean NOT NULL DEFAULT false,
  expires_at  timestamptz,
  attachments jsonb DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_announcements_company ON org_announcements(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS org_announcement_reads (
  announcement_id uuid NOT NULL REFERENCES org_announcements(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

-- ── 3. PROJECT PIPELINE / KANBAN ─────────────────────────────

CREATE TABLE IF NOT EXISTS org_pipeline_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  color       text DEFAULT '#6366f1',
  icon        text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_pipeline_stages_company ON org_pipeline_stages(company_id, sort_order);

-- Link projects to pipeline stages
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS pipeline_stage_id uuid REFERENCES org_pipeline_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_priority text DEFAULT 'normal'
    CHECK (pipeline_priority IN ('low', 'normal', 'high', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_projects_pipeline ON projects(pipeline_stage_id) WHERE pipeline_stage_id IS NOT NULL;

-- ── 4. SCRIPT ASSIGNMENTS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_script_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  script_id     uuid REFERENCES scripts(id) ON DELETE SET NULL,
  assigned_to   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  assignment_type text NOT NULL DEFAULT 'write'
    CHECK (assignment_type IN ('write', 'rewrite', 'polish', 'review', 'notes')),
  status        text NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'in_progress', 'submitted', 'in_review', 'revision_requested', 'approved', 'rejected')),
  deadline      timestamptz,
  submitted_at  timestamptz,
  approved_at   timestamptz,
  approved_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  revision_count integer NOT NULL DEFAULT 0,
  max_revisions  integer DEFAULT 3,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_script_assignments_company ON org_script_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_org_script_assignments_assignee ON org_script_assignments(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_org_script_assignments_project ON org_script_assignments(project_id);

-- ── 5. INTERNAL REVIEW NOTES (Studio/Network Notes Layer) ────

CREATE TABLE IF NOT EXISTS org_review_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  script_id     uuid REFERENCES scripts(id) ON DELETE SET NULL,
  author_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note_type     text NOT NULL DEFAULT 'general'
    CHECK (note_type IN ('general', 'page', 'line', 'character', 'structure', 'dialogue', 'action')),
  content       text NOT NULL,
  page_number   integer,
  element_index integer,
  element_id    uuid,
  severity      text NOT NULL DEFAULT 'suggestion'
    CHECK (severity IN ('suggestion', 'important', 'mandatory', 'praise')),
  status        text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'addressed', 'dismissed', 'resolved')),
  resolved_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_review_notes_script ON org_review_notes(script_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_review_notes_project ON org_review_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_org_review_notes_author ON org_review_notes(author_id);

-- ── 6. SHARED RESOURCE LIBRARY ───────────────────────────────

CREATE TABLE IF NOT EXISTS org_resources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  resource_type text NOT NULL DEFAULT 'document'
    CHECK (resource_type IN (
      'template', 'style_guide', 'character_bible', 'world_bible',
      'mood_board', 'reference_image', 'contract', 'document', 'other'
    )),
  category      text DEFAULT 'general',
  content       text,
  file_url      text,
  file_name     text,
  file_size     bigint,
  mime_type     text,
  thumbnail_url text,
  tags          text[] DEFAULT '{}',
  is_pinned     boolean NOT NULL DEFAULT false,
  access_level  text NOT NULL DEFAULT 'company'
    CHECK (access_level IN ('company', 'team', 'project')),
  team_id       uuid REFERENCES company_teams(id) ON DELETE SET NULL,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  version       integer NOT NULL DEFAULT 1,
  download_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_resources_company ON org_resources(company_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_org_resources_tags ON org_resources USING gin(tags);

-- ── 7. ORG CALENDAR / MILESTONES ─────────────────────────────

CREATE TABLE IF NOT EXISTS org_calendar_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  event_type    text NOT NULL DEFAULT 'milestone'
    CHECK (event_type IN (
      'milestone', 'deadline', 'meeting', 'table_read',
      'shoot_day', 'review', 'delivery', 'other'
    )),
  start_at      timestamptz NOT NULL,
  end_at        timestamptz,
  all_day       boolean NOT NULL DEFAULT false,
  color         text DEFAULT '#6366f1',
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  is_recurring  boolean NOT NULL DEFAULT false,
  recurrence    jsonb,
  location      text,
  attendees     uuid[] DEFAULT '{}',
  is_cancelled  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_calendar_company ON org_calendar_events(company_id, start_at);
CREATE INDEX IF NOT EXISTS idx_org_calendar_project ON org_calendar_events(project_id);

-- ── 8. PITCH BOARD ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_pitches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  logline       text,
  synopsis      text,
  genre         text,
  format        text,
  target_audience text,
  mood_keywords text[] DEFAULT '{}',
  reference_urls text[] DEFAULT '{}',
  cover_image_url text,
  status        text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'greenlit', 'shelved')),
  reviewed_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes  text,
  reviewed_at   timestamptz,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  vote_count    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_pitches_company ON org_pitches(company_id, status);
CREATE INDEX IF NOT EXISTS idx_org_pitches_author ON org_pitches(author_id);

CREATE TABLE IF NOT EXISTS org_pitch_votes (
  pitch_id    uuid NOT NULL REFERENCES org_pitches(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote        integer NOT NULL DEFAULT 1 CHECK (vote IN (-1, 1)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pitch_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_pitch_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id    uuid NOT NULL REFERENCES org_pitches(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_pitch_comments_pitch ON org_pitch_comments(pitch_id, created_at);

-- ── 9. ORG POLLS / VOTING ────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_polls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question      text NOT NULL,
  description   text,
  poll_type     text NOT NULL DEFAULT 'single'
    CHECK (poll_type IN ('single', 'multiple', 'ranked')),
  options       jsonb NOT NULL DEFAULT '[]',
  is_anonymous  boolean NOT NULL DEFAULT false,
  closes_at     timestamptz,
  is_closed     boolean NOT NULL DEFAULT false,
  channel_id    uuid REFERENCES org_channels(id) ON DELETE SET NULL,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_polls_company ON org_polls(company_id);

CREATE TABLE IF NOT EXISTS org_poll_votes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   uuid NOT NULL REFERENCES org_polls(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  rank      integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id, option_index)
);

-- ── 10. EDUCATION MODE ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_classes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  join_code     text UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex'),
  semester      text,
  year          integer,
  is_active     boolean NOT NULL DEFAULT true,
  max_students  integer DEFAULT 30,
  settings      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_classes_company ON org_classes(company_id);
CREATE INDEX IF NOT EXISTS idx_org_classes_instructor ON org_classes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_org_classes_join_code ON org_classes(join_code);

CREATE TABLE IF NOT EXISTS org_class_students (
  class_id    uuid NOT NULL REFERENCES org_classes(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'dropped', 'completed', 'auditing')),
  grade       text,
  notes       text,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_class_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL REFERENCES org_classes(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  assignment_type text NOT NULL DEFAULT 'script'
    CHECK (assignment_type IN ('script', 'scene', 'outline', 'treatment', 'revision', 'peer_review', 'other')),
  requirements  jsonb DEFAULT '{}',
  due_date      timestamptz,
  max_points    integer DEFAULT 100,
  is_published  boolean NOT NULL DEFAULT false,
  allow_late    boolean NOT NULL DEFAULT true,
  peer_review_enabled boolean NOT NULL DEFAULT false,
  peer_reviews_required integer DEFAULT 2,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_class_assignments_class ON org_class_assignments(class_id, due_date);

CREATE TABLE IF NOT EXISTS org_class_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES org_class_assignments(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  script_id       uuid REFERENCES scripts(id) ON DELETE SET NULL,
  content         text,
  file_url        text,
  status          text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'graded', 'returned', 'resubmitted')),
  grade           integer,
  grade_letter    text,
  feedback        text,
  graded_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  graded_at       timestamptz,
  submitted_at    timestamptz DEFAULT now(),
  is_late         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_org_class_submissions_assignment ON org_class_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_org_class_submissions_student ON org_class_submissions(student_id);

CREATE TABLE IF NOT EXISTS org_peer_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES org_class_submissions(id) ON DELETE CASCADE,
  reviewer_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating          integer CHECK (rating >= 1 AND rating <= 5),
  strengths       text,
  weaknesses      text,
  suggestions     text,
  overall_comment text,
  is_complete     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(submission_id, reviewer_id)
);

-- ── 11. REMOVE FREE-TIER LIMITS ──────────────────────────────

-- Remove max_team_size default of 5 — unlimited for everyone
ALTER TABLE projects ALTER COLUMN max_team_size SET DEFAULT 999999;

-- Remove max_members and max_projects limits on companies
ALTER TABLE companies ALTER COLUMN max_members SET DEFAULT 999999;
ALTER TABLE companies ALTER COLUMN max_projects SET DEFAULT 999999;

-- ── 12. TRIGGERS ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_org_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'org_channels', 'org_channel_messages', 'org_announcements',
    'org_resources', 'org_calendar_events', 'org_pitches',
    'org_review_notes', 'org_script_assignments',
    'org_classes', 'org_class_assignments', 'org_class_submissions',
    'org_peer_reviews'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_org_updated_at()', tbl, tbl
    );
  END LOOP;
END $$;

-- ── 13. ROW LEVEL SECURITY ───────────────────────────────────

-- Enable RLS on all new tables
ALTER TABLE org_channels              ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_channel_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_channel_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_announcements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_announcement_reads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_pipeline_stages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_script_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_review_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_resources             ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_calendar_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_pitches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_pitch_votes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_pitch_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_polls                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_poll_votes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_classes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_class_students        ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_class_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_class_submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_peer_reviews          ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is a member of a company
CREATE OR REPLACE FUNCTION is_company_member(p_company_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION is_company_member(uuid) TO authenticated;

-- Helper: check if current user is admin+ of a company
CREATE OR REPLACE FUNCTION is_company_admin(p_company_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = p_company_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION is_company_admin(uuid) TO authenticated;

-- Helper: check if current user is manager+ of a company
CREATE OR REPLACE FUNCTION is_company_manager(p_company_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = p_company_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
  );
$$;

GRANT EXECUTE ON FUNCTION is_company_manager(uuid) TO authenticated;

-- ── Channels RLS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "org_channels_select" ON org_channels;
CREATE POLICY "org_channels_select" ON org_channels
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_channels_insert" ON org_channels;
CREATE POLICY "org_channels_insert" ON org_channels
  FOR INSERT TO authenticated WITH CHECK (is_company_manager(company_id));

DROP POLICY IF EXISTS "org_channels_update" ON org_channels;
CREATE POLICY "org_channels_update" ON org_channels
  FOR UPDATE TO authenticated USING (is_company_manager(company_id));

DROP POLICY IF EXISTS "org_channels_delete" ON org_channels;
CREATE POLICY "org_channels_delete" ON org_channels
  FOR DELETE TO authenticated USING (is_company_admin(company_id));

-- Channel messages: members can read, channel members can write
DROP POLICY IF EXISTS "org_messages_select" ON org_channel_messages;
CREATE POLICY "org_messages_select" ON org_channel_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM org_channels c WHERE c.id = channel_id AND is_company_member(c.company_id))
  );

DROP POLICY IF EXISTS "org_messages_insert" ON org_channel_messages;
CREATE POLICY "org_messages_insert" ON org_channel_messages
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "org_messages_update" ON org_channel_messages;
CREATE POLICY "org_messages_update" ON org_channel_messages
  FOR UPDATE TO authenticated USING (author_id = auth.uid());

DROP POLICY IF EXISTS "org_messages_delete" ON org_channel_messages;
CREATE POLICY "org_messages_delete" ON org_channel_messages
  FOR DELETE TO authenticated USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM org_channels c WHERE c.id = channel_id AND is_company_admin(c.company_id))
  );

-- Channel members
DROP POLICY IF EXISTS "org_channel_members_select" ON org_channel_members;
CREATE POLICY "org_channel_members_select" ON org_channel_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM org_channels c WHERE c.id = channel_id AND is_company_member(c.company_id))
  );

DROP POLICY IF EXISTS "org_channel_members_insert" ON org_channel_members;
CREATE POLICY "org_channel_members_insert" ON org_channel_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM org_channels c WHERE c.id = channel_id AND is_company_admin(c.company_id))
  );

DROP POLICY IF EXISTS "org_channel_members_delete" ON org_channel_members;
CREATE POLICY "org_channel_members_delete" ON org_channel_members
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM org_channels c WHERE c.id = channel_id AND is_company_admin(c.company_id))
  );

-- ── Announcements RLS ────────────────────────────────────────
DROP POLICY IF EXISTS "org_announcements_select" ON org_announcements;
CREATE POLICY "org_announcements_select" ON org_announcements
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_announcements_insert" ON org_announcements;
CREATE POLICY "org_announcements_insert" ON org_announcements
  FOR INSERT TO authenticated WITH CHECK (is_company_manager(company_id) AND author_id = auth.uid());

DROP POLICY IF EXISTS "org_announcements_update" ON org_announcements;
CREATE POLICY "org_announcements_update" ON org_announcements
  FOR UPDATE TO authenticated USING (author_id = auth.uid() OR is_company_admin(company_id));

DROP POLICY IF EXISTS "org_announcements_delete" ON org_announcements;
CREATE POLICY "org_announcements_delete" ON org_announcements
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR is_company_admin(company_id));

DROP POLICY IF EXISTS "org_announcement_reads_all" ON org_announcement_reads;
CREATE POLICY "org_announcement_reads_all" ON org_announcement_reads
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Pipeline stages RLS ──────────────────────────────────────
DROP POLICY IF EXISTS "org_pipeline_select" ON org_pipeline_stages;
CREATE POLICY "org_pipeline_select" ON org_pipeline_stages
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_pipeline_manage" ON org_pipeline_stages;
CREATE POLICY "org_pipeline_manage" ON org_pipeline_stages
  FOR ALL TO authenticated USING (is_company_admin(company_id)) WITH CHECK (is_company_admin(company_id));

-- ── Script assignments RLS ───────────────────────────────────
DROP POLICY IF EXISTS "org_assignments_select" ON org_script_assignments;
CREATE POLICY "org_assignments_select" ON org_script_assignments
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_assignments_insert" ON org_script_assignments;
CREATE POLICY "org_assignments_insert" ON org_script_assignments
  FOR INSERT TO authenticated WITH CHECK (is_company_manager(company_id) AND assigned_by = auth.uid());

DROP POLICY IF EXISTS "org_assignments_update" ON org_script_assignments;
CREATE POLICY "org_assignments_update" ON org_script_assignments
  FOR UPDATE TO authenticated USING (
    assigned_to = auth.uid() OR assigned_by = auth.uid() OR is_company_admin(company_id)
  );

-- ── Review notes RLS ─────────────────────────────────────────
DROP POLICY IF EXISTS "org_review_notes_select" ON org_review_notes;
CREATE POLICY "org_review_notes_select" ON org_review_notes
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_review_notes_insert" ON org_review_notes;
CREATE POLICY "org_review_notes_insert" ON org_review_notes
  FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id) AND author_id = auth.uid());

DROP POLICY IF EXISTS "org_review_notes_update" ON org_review_notes;
CREATE POLICY "org_review_notes_update" ON org_review_notes
  FOR UPDATE TO authenticated USING (author_id = auth.uid() OR is_company_manager(company_id));

-- ── Resources RLS ────────────────────────────────────────────
DROP POLICY IF EXISTS "org_resources_select" ON org_resources;
CREATE POLICY "org_resources_select" ON org_resources
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_resources_insert" ON org_resources;
CREATE POLICY "org_resources_insert" ON org_resources
  FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "org_resources_update" ON org_resources;
CREATE POLICY "org_resources_update" ON org_resources
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR is_company_manager(company_id));

DROP POLICY IF EXISTS "org_resources_delete" ON org_resources;
CREATE POLICY "org_resources_delete" ON org_resources
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR is_company_admin(company_id));

-- ── Calendar RLS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "org_calendar_select" ON org_calendar_events;
CREATE POLICY "org_calendar_select" ON org_calendar_events
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_calendar_insert" ON org_calendar_events;
CREATE POLICY "org_calendar_insert" ON org_calendar_events
  FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "org_calendar_update" ON org_calendar_events;
CREATE POLICY "org_calendar_update" ON org_calendar_events
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR is_company_manager(company_id));

DROP POLICY IF EXISTS "org_calendar_delete" ON org_calendar_events;
CREATE POLICY "org_calendar_delete" ON org_calendar_events
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR is_company_admin(company_id));

-- ── Pitches RLS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "org_pitches_select" ON org_pitches;
CREATE POLICY "org_pitches_select" ON org_pitches
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_pitches_insert" ON org_pitches;
CREATE POLICY "org_pitches_insert" ON org_pitches
  FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id) AND author_id = auth.uid());

DROP POLICY IF EXISTS "org_pitches_update" ON org_pitches;
CREATE POLICY "org_pitches_update" ON org_pitches
  FOR UPDATE TO authenticated USING (author_id = auth.uid() OR is_company_manager(company_id));

DROP POLICY IF EXISTS "org_pitch_votes_all" ON org_pitch_votes;
CREATE POLICY "org_pitch_votes_all" ON org_pitch_votes
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "org_pitch_comments_select" ON org_pitch_comments;
CREATE POLICY "org_pitch_comments_select" ON org_pitch_comments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM org_pitches p WHERE p.id = pitch_id AND is_company_member(p.company_id))
  );

DROP POLICY IF EXISTS "org_pitch_comments_insert" ON org_pitch_comments;
CREATE POLICY "org_pitch_comments_insert" ON org_pitch_comments
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

-- ── Polls RLS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "org_polls_select" ON org_polls;
CREATE POLICY "org_polls_select" ON org_polls
  FOR SELECT TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "org_polls_insert" ON org_polls;
CREATE POLICY "org_polls_insert" ON org_polls
  FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "org_polls_update" ON org_polls;
CREATE POLICY "org_polls_update" ON org_polls
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR is_company_admin(company_id));

DROP POLICY IF EXISTS "org_poll_votes_all" ON org_poll_votes;
CREATE POLICY "org_poll_votes_all" ON org_poll_votes
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Education RLS ────────────────────────────────────────────
DROP POLICY IF EXISTS "org_classes_select" ON org_classes;
CREATE POLICY "org_classes_select" ON org_classes
  FOR SELECT TO authenticated USING (
    is_company_member(company_id)
    OR EXISTS (SELECT 1 FROM org_class_students WHERE class_id = id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "org_classes_manage" ON org_classes;
CREATE POLICY "org_classes_manage" ON org_classes
  FOR ALL TO authenticated USING (
    instructor_id = auth.uid() OR is_company_admin(company_id)
  ) WITH CHECK (
    instructor_id = auth.uid() OR is_company_admin(company_id)
  );

DROP POLICY IF EXISTS "org_class_students_select" ON org_class_students;
CREATE POLICY "org_class_students_select" ON org_class_students
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM org_classes c WHERE c.id = class_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id)))
  );

DROP POLICY IF EXISTS "org_class_students_manage" ON org_class_students;
CREATE POLICY "org_class_students_manage" ON org_class_students
  FOR ALL TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM org_classes c WHERE c.id = class_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id)))
  ) WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM org_classes c WHERE c.id = class_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id)))
  );

DROP POLICY IF EXISTS "org_class_assignments_select" ON org_class_assignments;
CREATE POLICY "org_class_assignments_select" ON org_class_assignments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM org_classes c WHERE c.id = class_id AND is_company_member(c.company_id))
    OR EXISTS (SELECT 1 FROM org_class_students s WHERE s.class_id = class_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "org_class_assignments_manage" ON org_class_assignments;
CREATE POLICY "org_class_assignments_manage" ON org_class_assignments
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM org_classes c WHERE c.id = class_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id)))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM org_classes c WHERE c.id = class_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id)))
  );

DROP POLICY IF EXISTS "org_submissions_select" ON org_class_submissions;
CREATE POLICY "org_submissions_select" ON org_class_submissions
  FOR SELECT TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_class_assignments a
      JOIN org_classes c ON c.id = a.class_id
      WHERE a.id = assignment_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id))
    )
  );

DROP POLICY IF EXISTS "org_submissions_insert" ON org_class_submissions;
CREATE POLICY "org_submissions_insert" ON org_class_submissions
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "org_submissions_update" ON org_class_submissions;
CREATE POLICY "org_submissions_update" ON org_class_submissions
  FOR UPDATE TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_class_assignments a
      JOIN org_classes c ON c.id = a.class_id
      WHERE a.id = assignment_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id))
    )
  );

DROP POLICY IF EXISTS "org_peer_reviews_select" ON org_peer_reviews;
CREATE POLICY "org_peer_reviews_select" ON org_peer_reviews
  FOR SELECT TO authenticated USING (
    reviewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM org_class_submissions s WHERE s.id = submission_id AND s.student_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM org_class_submissions s
      JOIN org_class_assignments a ON a.id = s.assignment_id
      JOIN org_classes c ON c.id = a.class_id
      WHERE s.id = submission_id AND (c.instructor_id = auth.uid() OR is_company_admin(c.company_id))
    )
  );

DROP POLICY IF EXISTS "org_peer_reviews_insert" ON org_peer_reviews;
CREATE POLICY "org_peer_reviews_insert" ON org_peer_reviews
  FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "org_peer_reviews_update" ON org_peer_reviews;
CREATE POLICY "org_peer_reviews_update" ON org_peer_reviews
  FOR UPDATE TO authenticated USING (reviewer_id = auth.uid());

-- ── 14. GRANTS ───────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON org_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_channel_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON org_channel_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_announcements TO authenticated;
GRANT SELECT, INSERT, DELETE ON org_announcement_reads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_pipeline_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON org_script_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON org_review_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_resources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_calendar_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON org_pitches TO authenticated;
GRANT SELECT, INSERT, DELETE ON org_pitch_votes TO authenticated;
GRANT SELECT, INSERT ON org_pitch_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON org_polls TO authenticated;
GRANT SELECT, INSERT, DELETE ON org_poll_votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_class_students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_class_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON org_class_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON org_peer_reviews TO authenticated;

-- ── 15. DEFAULT PIPELINE STAGES (inserted per-company) ───────

CREATE OR REPLACE FUNCTION create_default_pipeline_stages()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO org_pipeline_stages (company_id, name, color, icon, sort_order, is_default) VALUES
    (NEW.id, 'Development', '#8b5cf6', '💡', 0, true),
    (NEW.id, 'Writing',     '#3b82f6', '✍️', 1, true),
    (NEW.id, 'Revision',    '#f59e0b', '🔄', 2, true),
    (NEW.id, 'Review',      '#ef4444', '👀', 3, true),
    (NEW.id, 'Production',  '#10b981', '🎬', 4, true),
    (NEW.id, 'Complete',    '#6b7280', '✅', 5, true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_default_pipeline ON companies;
CREATE TRIGGER trg_company_default_pipeline
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION create_default_pipeline_stages();

-- Also create a default #general channel for new companies
CREATE OR REPLACE FUNCTION create_default_org_channel()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO org_channels (company_id, name, description, channel_type, is_default, created_by)
  VALUES (NEW.id, 'general', 'General company discussion', 'general', true, NEW.owner_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_default_channel ON companies;
CREATE TRIGGER trg_company_default_channel
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION create_default_org_channel();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Source: supabase/migration_personal_project_folders.sql
-- ---------------------------------------------------------------------
-- ─────────────────────────────────────────────────────────────────────────────
-- Personal project folder assignments
-- Each user can organise projects they have access to into their own folders
-- independently from every other user.  Previously folder_id lived on the
-- projects row (shared / destructive).  This replaces that approach.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_project_folder_assignments (
  user_id    uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id)        ON DELETE CASCADE,
  folder_id  uuid          REFERENCES dashboard_folders(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_upfa_user    ON user_project_folder_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_upfa_project ON user_project_folder_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_upfa_folder  ON user_project_folder_assignments(folder_id);

ALTER TABLE user_project_folder_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upfa_select" ON user_project_folder_assignments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "upfa_insert" ON user_project_folder_assignments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "upfa_update" ON user_project_folder_assignments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "upfa_delete" ON user_project_folder_assignments
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Migrate existing data ────────────────────────────────────────────────────
-- For projects that already had a folder_id set, figure out which user set it
-- by matching the folder's owner, and copy that assignment across.
INSERT INTO user_project_folder_assignments (user_id, project_id, folder_id)
SELECT df.user_id, p.id, p.folder_id
FROM   projects p
JOIN   dashboard_folders df ON df.id = p.folder_id
WHERE  p.folder_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- We intentionally leave projects.folder_id in place (no DROP COLUMN) so that
-- old code paths keep working during rollout, but new code ignores that column
-- and reads from user_project_folder_assignments instead.

-- ---------------------------------------------------------------------
-- Source: supabase/migration_polls.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Polls / Surveys System
-- ============================================================
-- Tables: poll_sessions, poll_questions, poll_responses, poll_answers
-- XP: 100 XP awarded on completion (poll_complete event type added in app)
-- Notifications: on publish, all users get a 'poll_published' notification

-- ── Enums ─────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poll_status') THEN
    CREATE TYPE poll_status AS ENUM ('draft', 'review', 'published', 'closed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poll_question_type') THEN
    CREATE TYPE poll_question_type AS ENUM (
      'yes_no',
      'single_select',
      'multi_select',
      'ranking',
      'short_text',
      'long_text'
    );
  END IF;
END $$;

-- Add poll_published to notification_type enum if not already there
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'poll_published';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'poll_reminder';
END $$;

-- ── poll_sessions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  preface      text,               -- intro shown on first "page" of the modal
  status       poll_status NOT NULL DEFAULT 'draft',
  created_by   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  published_at timestamptz,
  closed_at    timestamptz,
  response_count int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── poll_questions ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES poll_sessions(id) ON DELETE CASCADE,
  sort_order     int  NOT NULL DEFAULT 0,
  question_text  text NOT NULL,
  question_type  poll_question_type NOT NULL DEFAULT 'single_select',
  -- For single_select, multi_select, ranking: array of option strings
  options        jsonb,
  is_required    boolean NOT NULL DEFAULT true,
  -- Admin review: has this question been approved before publish?
  is_approved    boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── poll_responses ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES poll_sessions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  xp_awarded   int NOT NULL DEFAULT 0,
  UNIQUE (session_id, user_id)
);

-- ── poll_answers ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_answers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id  uuid NOT NULL REFERENCES poll_responses(id) ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES poll_sessions(id) ON DELETE CASCADE,
  question_id  uuid NOT NULL REFERENCES poll_questions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- answer_text: used for yes_no ('yes'/'no'), single_select, short_text, long_text
  answer_text  text,
  -- answer_json: used for multi_select (array of strings), ranking (ordered array)
  answer_json  jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS poll_questions_session_id  ON poll_questions(session_id);
CREATE INDEX IF NOT EXISTS poll_responses_session_id  ON poll_responses(session_id);
CREATE INDEX IF NOT EXISTS poll_responses_user_id     ON poll_responses(user_id);
CREATE INDEX IF NOT EXISTS poll_answers_question_id   ON poll_answers(question_id);
CREATE INDEX IF NOT EXISTS poll_answers_session_id    ON poll_answers(session_id);
CREATE INDEX IF NOT EXISTS poll_answers_user_id       ON poll_answers(user_id);

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE poll_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_answers   ENABLE ROW LEVEL SECURITY;

-- poll_sessions
DROP POLICY IF EXISTS "poll_sessions_admin"       ON poll_sessions;
DROP POLICY IF EXISTS "poll_sessions_read"        ON poll_sessions;
CREATE POLICY "poll_sessions_admin" ON poll_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "poll_sessions_read" ON poll_sessions FOR SELECT
  USING (status = 'published' OR status = 'closed');

-- poll_questions
DROP POLICY IF EXISTS "poll_questions_admin"      ON poll_questions;
DROP POLICY IF EXISTS "poll_questions_read"       ON poll_questions;
CREATE POLICY "poll_questions_admin" ON poll_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "poll_questions_read" ON poll_questions FOR SELECT
  USING (
    session_id IN (SELECT id FROM poll_sessions WHERE status = 'published' OR status = 'closed')
  );

-- poll_responses
DROP POLICY IF EXISTS "poll_responses_admin"      ON poll_responses;
DROP POLICY IF EXISTS "poll_responses_self"       ON poll_responses;
CREATE POLICY "poll_responses_admin" ON poll_responses FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "poll_responses_self" ON poll_responses FOR ALL
  USING (auth.uid() = user_id);

-- poll_answers
DROP POLICY IF EXISTS "poll_answers_admin"        ON poll_answers;
DROP POLICY IF EXISTS "poll_answers_self"         ON poll_answers;
CREATE POLICY "poll_answers_admin" ON poll_answers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "poll_answers_self" ON poll_answers FOR ALL
  USING (auth.uid() = user_id);

-- ── Helper: increment response_count on new response ─────────

CREATE OR REPLACE FUNCTION increment_poll_response_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE poll_sessions
  SET response_count = response_count + 1,
      updated_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_poll_response ON poll_responses;
CREATE TRIGGER on_poll_response
  AFTER INSERT ON poll_responses
  FOR EACH ROW EXECUTE FUNCTION increment_poll_response_count();

-- ---------------------------------------------------------------------
-- Source: supabase/migration_pro_subscription.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Migration: Pro Subscription System
-- Adds subscription management, team licensing, version history,
-- client review portals, and external share links.
-- ============================================================

-- ── 1. Subscriptions table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'pro',        -- 'pro' | 'enterprise'
  status TEXT NOT NULL DEFAULT 'active',    -- 'active' | 'cancelled' | 'expired' | 'trialing'
  billing_cycle TEXT NOT NULL DEFAULT 'yearly', -- 'yearly' | 'monthly'
  price_cents INTEGER NOT NULL DEFAULT 20000,   -- $200.00
  currency TEXT NOT NULL DEFAULT 'usd',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 year'),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  paypal_customer_id TEXT,
  paypal_subscription_id TEXT,
  payment_method TEXT DEFAULT 'dev_bypass',  -- 'paypal' | 'dev_bypass'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ── 2. Team seat licenses (corporate bulk buying) ───────────
CREATE TABLE IF NOT EXISTS team_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchaser_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'active' | 'revoked' | 'expired'
  plan TEXT NOT NULL DEFAULT 'pro',
  price_cents INTEGER NOT NULL DEFAULT 16000,  -- $160 (20% team discount)
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 year'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_licenses_purchaser ON team_licenses(purchaser_id);
CREATE INDEX IF NOT EXISTS idx_team_licenses_recipient ON team_licenses(recipient_id);
CREATE INDEX IF NOT EXISTS idx_team_licenses_company ON team_licenses(company_id);

-- ── 3. Script version history ───────────────────────────────
CREATE TABLE IF NOT EXISTS script_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  content JSONB NOT NULL,                 -- Full script content snapshot
  word_count INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 0,
  change_summary TEXT,
  is_auto_save BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_versions_script ON script_versions(script_id);
CREATE INDEX IF NOT EXISTS idx_script_versions_project ON script_versions(project_id, created_at DESC);

-- ── 4. External share links (portals) ───────────────────────
CREATE TABLE IF NOT EXISTS external_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL DEFAULT 'script',  -- 'script' | 'storyboard' | 'moodboard' | 'full'
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  title TEXT,
  password_hash TEXT,                     -- Optional password protection
  allow_comments BOOLEAN NOT NULL DEFAULT false,
  allow_download BOOLEAN NOT NULL DEFAULT false,
  watermark_text TEXT,                    -- e.g. "CONFIDENTIAL — Reviewer Name"
  expires_at TIMESTAMPTZ,
  max_views INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  branding JSONB DEFAULT '{}',            -- { logo_url, company_name, color }
  content_snapshot JSONB DEFAULT NULL,     -- Snapshot of project + script content for anonymous access
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_shares_token ON external_shares(access_token);
CREATE INDEX IF NOT EXISTS idx_external_shares_project ON external_shares(project_id);

-- ── 5. Client review sessions ───────────────────────────────
CREATE TABLE IF NOT EXISTS review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES external_shares(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT,
  reviewer_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'submitted'
  overall_rating INTEGER,                 -- 1-5
  overall_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

-- ── 6. Review annotations (line-level feedback) ─────────────
CREATE TABLE IF NOT EXISTS review_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  element_type TEXT,                       -- 'scene_heading' | 'action' | 'dialogue' | 'shot' | etc.
  element_index INTEGER,                   -- Line/element index in script
  content TEXT NOT NULL,
  annotation_type TEXT NOT NULL DEFAULT 'note', -- 'note' | 'approval' | 'revision_request' | 'question'
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_annotations_session ON review_annotations(session_id);

-- ── 7. Project analytics (activity tracking) ────────────────
CREATE TABLE IF NOT EXISTS project_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,                -- 'page_edit' | 'scene_add' | 'export' | 'comment' | 'login' | ...
  event_data JSONB DEFAULT '{}',
  page TEXT,                               -- Which project page
  word_count_delta INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_analytics_project ON project_analytics(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_analytics_user ON project_analytics(user_id, created_at DESC);

-- ── 8. Update profiles for Pro storage limit ─────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT DEFAULT 1073741824;  -- 1 GB free, 50 GB pro

-- ── 9. Update projects for branding ──────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS custom_branding JSONB DEFAULT NULL,  -- { logo_url, company_name, watermark, color }
  ADD COLUMN IF NOT EXISTS max_team_size INTEGER DEFAULT 5;     -- 5 free, unlimited pro

-- ── 10. RLS Policies ─────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_analytics ENABLE ROW LEVEL SECURITY;

-- Subscriptions: users can see their own
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Team licenses: purchaser + recipient can see
CREATE POLICY "View team licenses" ON team_licenses FOR SELECT
  USING (auth.uid() = purchaser_id OR auth.uid() = recipient_id);
CREATE POLICY "Purchaser manages licenses" ON team_licenses FOR ALL
  USING (auth.uid() = purchaser_id);

-- Script versions: project members can see
CREATE POLICY "Members view script versions" ON script_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_id = script_versions.project_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM projects WHERE id = script_versions.project_id AND created_by = auth.uid()));
CREATE POLICY "Members create script versions" ON script_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- External shares: creator can manage, public read via token
CREATE POLICY "Creator manages shares" ON external_shares FOR ALL USING (auth.uid() = created_by);
CREATE POLICY "Project members view shares" ON external_shares FOR SELECT
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_id = external_shares.project_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM projects WHERE id = external_shares.project_id AND created_by = auth.uid()));
-- Anonymous access: anyone with the token can read active shares
CREATE POLICY "Public read active shares by token" ON external_shares FOR SELECT
  USING (is_active = true);
-- Anonymous can increment view count
CREATE POLICY "Public update view count" ON external_shares FOR UPDATE
  USING (is_active = true) WITH CHECK (is_active = true);

-- Review sessions: public insert (for external reviewers), creator can view
CREATE POLICY "Anyone can create review session" ON review_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "View review sessions" ON review_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM external_shares WHERE id = review_sessions.share_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members pm JOIN external_shares es ON es.project_id = pm.project_id WHERE es.id = review_sessions.share_id AND pm.user_id = auth.uid()));

-- Review annotations: anyone can insert (external reviewers), project team can view
CREATE POLICY "Anyone can add annotations" ON review_annotations FOR INSERT WITH CHECK (true);
CREATE POLICY "View annotations" ON review_annotations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM review_sessions rs
    JOIN external_shares es ON es.id = rs.share_id
    WHERE rs.id = review_annotations.session_id
    AND (es.created_by = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_id = es.project_id AND user_id = auth.uid()))
  ));

-- Analytics: project members can view and insert
CREATE POLICY "Members view analytics" ON project_analytics FOR SELECT
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_id = project_analytics.project_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM projects WHERE id = project_analytics.project_id AND created_by = auth.uid()));
CREATE POLICY "Members insert analytics" ON project_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Source: supabase/migration_production_tools.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Source: supabase/migration_project_covers_bucket.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- MIGRATION: project-covers Storage Bucket
-- ============================================================
-- Creates the 'project-covers' Supabase Storage bucket used for:
--   • Project cover images   (PROJECT_ID/cover.ext)
--   • Title page logos       (PROJECT_ID/tp-project_logo_url.ext)
--   • Production co. logos   (PROJECT_ID/tp-company_logo_url.ext)
-- ============================================================

-- ── 1. Create bucket (idempotent) ────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'project-covers',
  'project-covers',
  true,
  5242880,   -- 5 MB max per file
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml'
  ]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'project-covers'
);

-- ── 2. Public read (URLs are embedded in exports / PDFs) ─────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Project covers are publicly readable'
  ) THEN
    CREATE POLICY "Project covers are publicly readable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'project-covers');
  END IF;
END $$;

-- ── 3. Project members can upload / overwrite ────────────────
-- Path must start with a project ID that the user is a member of.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Project members can upload covers'
  ) THEN
    CREATE POLICY "Project members can upload covers"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'project-covers'
        AND auth.uid() IS NOT NULL
        AND (
          -- folder name (first segment of path) must be a project the user owns or is a member of
          EXISTS (
            SELECT 1 FROM projects
            WHERE id::text = (storage.foldername(name))[1]
              AND created_by = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id::text = (storage.foldername(name))[1]
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin', 'writer', 'editor')
          )
        )
      );
  END IF;
END $$;

-- ── 4. Same check for UPDATE (upsert uses UPDATE internally) ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Project members can update covers'
  ) THEN
    CREATE POLICY "Project members can update covers"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'project-covers'
        AND auth.uid() IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM projects
            WHERE id::text = (storage.foldername(name))[1]
              AND created_by = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id::text = (storage.foldername(name))[1]
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin', 'writer', 'editor')
          )
        )
      );
  END IF;
END $$;

-- ── 5. Project owners / admins can delete ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Project owners can delete covers'
  ) THEN
    CREATE POLICY "Project owners can delete covers"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'project-covers'
        AND auth.uid() IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM projects
            WHERE id::text = (storage.foldername(name))[1]
              AND created_by = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id::text = (storage.foldername(name))[1]
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin')
          )
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_project_page_size.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Per-project script page size (US Letter or A4)
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS page_size TEXT
    CHECK (page_size IN ('letter', 'a4'))
    DEFAULT 'letter';

-- ---------------------------------------------------------------------
-- Source: supabase/migration_project_pro.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Migration: Add per-project Pro support
-- ============================================================
-- Adds a `pro_enabled` boolean column to projects table.
-- When true, all Pro tools are unlocked on that specific project
-- even if the project owner doesn't have a global Pro subscription.
-- ============================================================

-- Add pro_enabled column (default false for existing projects)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pro_enabled boolean DEFAULT false;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_projects_pro_enabled ON projects (pro_enabled) WHERE pro_enabled = true;

-- RLS: project members can see the pro_enabled field (inherited from existing project RLS)
-- No additional policies needed since it's a regular column on the projects table.

-- ---------------------------------------------------------------------
-- Source: supabase/migration_project_share_links.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Project Share Links
-- Replaces external_shares + review_sessions with a clean,
-- simple link-based sharing system.
-- ============================================================

CREATE TABLE IF NOT EXISTS project_share_links (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by     UUID        NOT NULL REFERENCES profiles(id),
  name           TEXT        NOT NULL,
  -- Unique public token — the URL secret. 24 random bytes → 32 char url-safe base64 (no padding).
  token          TEXT        NOT NULL UNIQUE DEFAULT replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),

  -- Content permissions
  can_view_script      BOOLEAN NOT NULL DEFAULT false,
  can_view_characters  BOOLEAN NOT NULL DEFAULT false,
  can_view_scenes      BOOLEAN NOT NULL DEFAULT false,
  can_view_schedule    BOOLEAN NOT NULL DEFAULT false,
  can_view_documents   BOOLEAN NOT NULL DEFAULT false,
  can_view_notes       BOOLEAN NOT NULL DEFAULT false,
  can_edit_notes       BOOLEAN NOT NULL DEFAULT false,

  -- Invite behaviour: if true the recipient must sign in/up
  -- and is then automatically added to project_members
  is_invite    BOOLEAN NOT NULL DEFAULT false,
  invite_role  TEXT    NOT NULL DEFAULT 'viewer'
               CHECK (invite_role IN ('viewer', 'commenter', 'editor')),

  -- Stats
  view_count   INT  NOT NULL DEFAULT 0,

  -- Lifecycle
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_project_share_links_project   ON project_share_links(project_id);
CREATE INDEX IF NOT EXISTS idx_project_share_links_token     ON project_share_links(token);
CREATE INDEX IF NOT EXISTS idx_project_share_links_created_by ON project_share_links(created_by);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE project_share_links ENABLE ROW LEVEL SECURITY;

-- Project owners / admins / editors can do everything on their links
DROP POLICY IF EXISTS "project_members_manage_share_links" ON project_share_links;
CREATE POLICY "project_members_manage_share_links" ON project_share_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_share_links.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'editor')
    )
  );

-- Anyone (anon + authenticated) can read an active, non-expired link by token.
-- The token acts as the access credential — 256 bits of entropy makes it
-- impractical to enumerate. We rely on the caller also filtering by token.
DROP POLICY IF EXISTS "public_read_active_share_links" ON project_share_links;
CREATE POLICY "public_read_active_share_links" ON project_share_links
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );

-- ── Helpers ─────────────────────────────────────────────────

-- Increment view count — callable by anon (no RLS write required).
CREATE OR REPLACE FUNCTION increment_share_link_views(link_token TEXT)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE project_share_links
  SET view_count = view_count + 1,
      updated_at  = now()
  WHERE token = link_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
$$;

-- Accept an invite link — validates token, adds caller to project_members.
-- Returns the project_id so the client can redirect.
CREATE OR REPLACE FUNCTION accept_share_invite(link_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link   project_share_links%ROWTYPE;
  v_uid    UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link
  FROM project_share_links
  WHERE token = link_token
    AND is_active = true
    AND is_invite = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite link';
  END IF;

  -- Add to project_members if not already a member
  INSERT INTO project_members (project_id, user_id, role, joined_at)
  VALUES (v_link.project_id, v_uid, v_link.invite_role, now())
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN v_link.project_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION increment_share_link_views(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION accept_share_invite(TEXT) TO authenticated;

-- ============================================================
-- regenerate_share_link_token(link_id UUID)
-- Replace the token on a share link with a fresh random one.
-- Only members with manage rights should call this (enforced by
-- RLS on the underlying table — caller must own the project).
-- ============================================================
CREATE OR REPLACE FUNCTION regenerate_share_link_token(link_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE project_share_links
  SET token      = replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),
      updated_at = now()
  WHERE id = link_id;
END;
$$;

-- Only authenticated users can call regenerate
GRANT EXECUTE ON FUNCTION regenerate_share_link_token(UUID) TO authenticated;

-- ============================================================
-- Patch existing table (safe to re-run)
-- ============================================================

-- Fix token default — PostgreSQL has no 'base64url' encoding.
-- Use standard base64 then swap the two URL-unsafe characters.
ALTER TABLE project_share_links
  ALTER COLUMN token
  SET DEFAULT replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_');

-- Add notes permission columns
ALTER TABLE project_share_links ADD COLUMN IF NOT EXISTS can_view_notes BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE project_share_links ADD COLUMN IF NOT EXISTS can_edit_notes BOOLEAN NOT NULL DEFAULT false;


-- ---------------------------------------------------------------------
-- Source: supabase/migration_project_templates.sql
-- ---------------------------------------------------------------------
-- Migration: Project Templates
-- Allows users to save a project as a reusable template and start new projects from templates.
-- Run in Supabase SQL editor.

-- ─── Templates table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_templates (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  project_type         TEXT NOT NULL DEFAULT 'screenplay',
  script_type          TEXT,
  genre                TEXT,
  format               TEXT,
  structure_snapshot   JSONB DEFAULT '{}',
  is_public            BOOLEAN NOT NULL DEFAULT false,
  use_count            INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_templates_user    ON project_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_project_templates_public  ON project_templates(is_public) WHERE is_public = true;

-- ─── RLS ──────────────────────────────────────────────────
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

-- Owner can do anything with their templates
CREATE POLICY "project_templates_owner_select" ON project_templates
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "project_templates_insert" ON project_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "project_templates_update" ON project_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "project_templates_delete" ON project_templates
  FOR DELETE USING (auth.uid() = user_id);

-- ─── updated_at trigger ───────────────────────────────────
CREATE TRIGGER project_templates_updated_at
  BEFORE UPDATE ON project_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Source: supabase/migration_recent_features.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Recent Features Migration
-- Run this after your base FULL.sql / migration_v2.sql setup.
-- All statements are idempotent (safe to re-run).
--
-- Covers:
--   • projects.script_type          (episodic beat-sheet, episode tabs)
--   • projects.content_metadata     (beat-sheet scopes, arc-planner, episodes)
--   • mindmap_nodes sizing columns  (width, height, font_size — already in
--       migration_v2 CREATE TABLE but added here as safety net)
-- ============================================================

-- ── projects: script_type ────────────────────────────────────
-- Used by beat-sheet episodic tabs, episode pages, etc.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS script_type TEXT NOT NULL DEFAULT 'screenplay';

-- ── projects: content_metadata ───────────────────────────────
-- Stores: beat_sheets, arc_map, series_seasons, and other
-- per-project JSON blobs without dedicated tables.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS content_metadata JSONB NOT NULL DEFAULT '{}';

-- ── mindmap_nodes: sizing + font ─────────────────────────────
-- Auto-sized on character import; user-resizable by dragging.
ALTER TABLE mindmap_nodes
  ADD COLUMN IF NOT EXISTS width     DOUBLE PRECISION NOT NULL DEFAULT 120;
ALTER TABLE mindmap_nodes
  ADD COLUMN IF NOT EXISTS height    DOUBLE PRECISION NOT NULL DEFAULT 60;
ALTER TABLE mindmap_nodes
  ADD COLUMN IF NOT EXISTS font_size INTEGER          NOT NULL DEFAULT 14;

-- ── characters: is_main flag ─────────────────────────────────
-- Used by mindmap import to auto-size main vs supporting nodes.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT false;

-- ── scenes: correct column names ─────────────────────────────
-- The app queries scene_heading and sort_order.
-- scene_heading should already exist; sort_order too.
-- These are safety-net no-ops if columns already present.
ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS scene_heading TEXT;
ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS sort_order   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS page_count   DECIMAL(5,1) NOT NULL DEFAULT 0;

-- ── Production Tool Tables ────────────────────────────────────
-- See migration_production_tools.sql for table definitions.
-- Run that file first, then run this file.
-- (No table definitions here to avoid duplication.)

-- ── Updated-at triggers (safety net) ─────────────────────────
-- Re-create trigger function if missing.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['projects','mindmap_nodes','characters','scenes'] LOOP
    -- Only create trigger if the table has updated_at and the trigger doesn't exist yet
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'updated_at'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || tbl || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_script_element_types.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Migration: Add YouTube / Audio-Drama element types to
-- the script_element_type enum.
--
-- Each ALTER TYPE ADD VALUE must be committed on its own before
-- it can be used in queries — run this file once, no transaction wrapping.
-- ============================================================

-- YouTube / Content-Creator element types
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'hook';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'talking_point';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'broll_note';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'cta';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'sponsor_read';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'chapter_marker';

-- Audio-Drama element types (BBC Scene / US Radio / STARC Standard)
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'sfx_cue';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'music_cue';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'ambience_cue';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'sound_cue';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'act_break';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'announcer';

-- ---------------------------------------------------------------------
-- Source: supabase/migration_script_minimap_sequences.sql
-- ---------------------------------------------------------------------
-- ============================================================
--  Script Minimap + Sequence / Act Element Types
--  Run in: Supabase Dashboard > SQL Editor
-- ============================================================
--
--  Schema notes
--  ─────────────────────────────────────────────────────────
--  • 'sequence' and 'sequence_end' are added to the
--    script_element_type ENUM (see ALTER TYPE above) so they
--    persist correctly in the DB.
--  • Sequence colour is stored in the existing `metadata` JSONB
--    column as { "color": "#6366f1" } — no new column needed.
--  • 'act' already existed as an element type.
--  • Minimap display preferences (show/hide, labels, colours)
--    are persisted in localStorage under the existing key
--    'ss_display_settings'. The column below optionally syncs
--    them to the DB so users keep their settings across devices.
-- ============================================================

-- ── IMPORTANT: run these two ALTER TYPE lines FIRST, alone ──
-- ALTER TYPE ADD VALUE cannot run inside a transaction block.
-- Highlight and execute just these two lines in the SQL editor,
-- then run the rest of the file separately.
-- ─────────────────────────────────────────────────────────────
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'sequence';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'sequence_end';
-- ─────────────────────────────────────────────────────────────

-- ── Optional: persist script display settings per user ──────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS script_display_settings JSONB DEFAULT '{}';

COMMENT ON COLUMN profiles.script_display_settings IS
  'Stores per-user script editor display preferences such as
   minimap visibility, sequence label/colour toggles, font size,
   page width, scene numbers, character highlights, etc.
   Mirrors the localStorage key ss_display_settings.';

-- ── Changelog: record the new features ──────────────────────

-- Bump to 2.9.0 (or append to current unreleased draft)
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.9.0',
  'Script Minimap & Sequences',
  'A proportional script overview bar with clickable navigation, plus new Sequence and End Sequence element types with colour coding.',
  'minor'
)
ON CONFLICT (version) DO NOTHING;

-- Script Minimap
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Script minimap navigation bar',
  'A compact proportional overview of the entire script sits at the bottom of the editor. It shows scene-heading ticks, act dividers, and coloured sequence bands. Click anywhere to jump instantly; drag the viewport handle to scroll smoothly.',
  'feature',
  'editor',
  true,
  10
FROM changelog_releases WHERE version = '2.9.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.9.0' AND ce.title = 'Script minimap navigation bar'
);

-- Sequence element type
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Sequence element type with colour coding',
  'Add Sequence and End Sequence elements to bracket sections of your script. Each sequence can be given a custom colour (8 presets) via a gutter colour picker. Sequences appear as coloured bands in the minimap.',
  'feature',
  'editor',
  true,
  20
FROM changelog_releases WHERE version = '2.9.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.9.0' AND ce.title = 'Sequence element type with colour coding'
);

-- Minimap display settings
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Minimap display settings',
  'The minimap, sequence labels, and sequence colours are each independently toggleable in the Display Settings panel (⚙ icon in the toolbar), keeping your view clean if you prefer a plain editor.',
  'improvement',
  'editor',
  true,
  30
FROM changelog_releases WHERE version = '2.9.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.9.0' AND ce.title = 'Minimap display settings'
);

-- Scene heading colour coding
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Scene colour coding in minimap',
  'Scene headings can now be given an individual colour using the circular colour swatch in the gutter. In the minimap the tick for that scene is split: the top half shows the enclosing sequence colour (if any) and the bottom half shows the scene colour, making it easy to see both structure and scene identity at a glance.',
  'feature',
  'editor',
  true,
  40
FROM changelog_releases WHERE version = '2.9.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.9.0' AND ce.title = 'Scene colour coding in minimap'
);

-- Collapsible sequences
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Collapsible sequences',
  'Click the chevron (▼) next to any Sequence element to collapse all the elements inside it into a single stub row. The stub shows how many elements are hidden and can be clicked to expand again, helping you focus on one part of the script at a time.',
  'feature',
  'editor',
  true,
  50
FROM changelog_releases WHERE version = '2.9.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.9.0' AND ce.title = 'Collapsible sequences'
);

-- Publish when ready:
-- SELECT publish_release('2.9.0');

-- ---------------------------------------------------------------------
-- Source: supabase/migration_security_legal.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Legal Blog & Security Improvements Migration
-- ============================================================

-- Legal blog posts table
CREATE TABLE IF NOT EXISTS legal_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'update' CHECK (category IN ('tos_update', 'privacy_update', 'security_advisory', 'policy_change', 'compliance', 'transparency_report', 'update', 'announcement')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'important', 'critical')),
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES profiles(id),
  notify_users BOOLEAN NOT NULL DEFAULT true,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log for ALL admin/security actions
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Login history for user safety
CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT DEFAULT 'email', -- email, magic_link, oauth_google, oauth_github
  success BOOLEAN NOT NULL DEFAULT true
);

-- Email verification tracking
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Data export requests (GDPR)
CREATE TABLE IF NOT EXISTS data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  download_url TEXT,
  file_size_bytes BIGINT,
  expires_at TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Account deletion requests (GDPR right to erasure)
CREATE TABLE IF NOT EXISTS deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Security events (suspicious activity tracking)
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'failed_login', 'password_changed', 'email_changed', 'suspicious_login',
    'rate_limited', 'api_abuse', 'brute_force', 'account_locked',
    'data_export', 'account_deletion', 'admin_action', 'permission_change'
  )),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content reports (for community safety)
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  content_type TEXT NOT NULL CHECK (content_type IN ('project', 'comment', 'post', 'message', 'user', 'script')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'copyright', 'nsfw', 'illegal', 'impersonation', 'misinformation', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES profiles(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- User bans
CREATE TABLE IF NOT EXISTS user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  banned_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  ban_type TEXT NOT NULL DEFAULT 'temporary' CHECK (ban_type IN ('warning', 'temporary', 'permanent')),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consent tracking (for GDPR)
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('tos', 'privacy', 'cookies', 'marketing', 'analytics', 'data_processing')),
  version TEXT NOT NULL, -- e.g. 'tos-2026-02-22'
  granted BOOLEAN NOT NULL DEFAULT true,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS Policies ────────────────────────────────────────────

ALTER TABLE legal_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

-- Legal posts: anyone can read published, admins can do everything
CREATE POLICY "legal_posts_read" ON legal_posts FOR SELECT USING (published = true);
CREATE POLICY "legal_posts_admin" ON legal_posts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

-- Audit log: admin read only
CREATE POLICY "audit_log_admin_read" ON audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (true);

-- Login history: users see own, admins see all
CREATE POLICY "login_history_own" ON login_history FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "login_history_admin" ON login_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "login_history_insert" ON login_history FOR INSERT WITH CHECK (true);

-- Security events: users see own, admins see all
CREATE POLICY "security_events_own" ON security_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "security_events_admin" ON security_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "security_events_insert" ON security_events FOR INSERT WITH CHECK (true);

-- Data export requests: users manage own
CREATE POLICY "data_export_own" ON data_export_requests FOR ALL USING (user_id = auth.uid());

-- Deletion requests: users manage own
CREATE POLICY "deletion_requests_own" ON deletion_requests FOR ALL USING (user_id = auth.uid());

-- Content reports: users create, admins manage
CREATE POLICY "reports_create" ON content_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports_own" ON content_reports FOR SELECT USING (reporter_id = auth.uid());
CREATE POLICY "reports_admin" ON content_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

-- User bans: admins manage
CREATE POLICY "bans_admin" ON user_bans FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
CREATE POLICY "bans_own_read" ON user_bans FOR SELECT USING (user_id = auth.uid());

-- Consent records: users manage own
CREATE POLICY "consent_own" ON consent_records FOR ALL USING (user_id = auth.uid());

-- Email verifications: users manage own
CREATE POLICY "email_verify_own" ON email_verifications FOR ALL USING (user_id = auth.uid());

-- ── Indexes for performance ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_legal_posts_published ON legal_posts(published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_posts_slug ON legal_posts(slug);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, login_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_bans_user ON user_bans(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON deletion_requests(status, scheduled_for);

-- ── Increase storage limit ──────────────────────────────────
-- Remove the old 1GB/5GB limit — give everyone 50GB, Pro users 200GB
UPDATE profiles SET storage_limit_bytes = 53687091200 WHERE is_pro = false AND (storage_limit_bytes IS NULL OR storage_limit_bytes < 53687091200);
UPDATE profiles SET storage_limit_bytes = 214748364800 WHERE is_pro = true;

-- ── Fix company invitation role casting ─────────────────────
CREATE OR REPLACE FUNCTION accept_company_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv company_invitations%ROWTYPE;
  v_user_id UUID;
  v_company_name TEXT;
  v_role_text TEXT;
  v_role_type TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_inv FROM company_invitations WHERE id = p_invitation_id;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF v_inv.accepted THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Already accepted');
  END IF;

  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < NOW() THEN
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  v_role_text := v_inv.role::text;

  UPDATE company_invitations SET accepted = true WHERE id = p_invitation_id;

  -- Get the actual type of the role column (handles both user_role and company_role)
  SELECT t.typname INTO v_role_type
  FROM pg_attribute a
  JOIN pg_type t ON a.atttypid = t.oid
  WHERE a.attrelid = 'company_members'::regclass AND a.attname = 'role';

  -- Use dynamic SQL to handle either user_role or company_role
  IF v_role_type = 'user_role' THEN
    EXECUTE 'INSERT INTO company_members (company_id, user_id, role, invited_by)
             VALUES ($1, $2, $3::user_role, $4)
             ON CONFLICT (company_id, user_id) DO UPDATE SET role = $3::user_role'
    USING v_inv.company_id, v_user_id, v_role_text, v_inv.invited_by;
  ELSE
    EXECUTE 'INSERT INTO company_members (company_id, user_id, role, invited_by)
             VALUES ($1, $2, $3::company_role, $4)
             ON CONFLICT (company_id, user_id) DO UPDATE SET role = $3::company_role'
    USING v_inv.company_id, v_user_id, v_role_text, v_inv.invited_by;
  END IF;

  UPDATE profiles SET company_id = v_inv.company_id WHERE id = v_user_id;

  SELECT name INTO v_company_name FROM companies WHERE id = v_inv.company_id;

  INSERT INTO company_activity_log (company_id, user_id, action, entity_type, metadata)
  VALUES (v_inv.company_id, v_user_id, 'accepted_invitation', 'member',
    jsonb_build_object('role', v_role_text));

  RETURN jsonb_build_object('ok', true, 'company_id', v_inv.company_id, 'company_name', v_company_name);
END;
$$;

-- ── Helper function to create legal post notifications ──────
CREATE OR REPLACE FUNCTION notify_legal_post()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.published = true AND (OLD IS NULL OR OLD.published = false) AND NEW.notify_users = true THEN
    -- Create notification for every active user
    INSERT INTO notifications (user_id, type, title, body, link, entity_type, entity_id, metadata)
    SELECT
      p.id,
      'legal_update',
      CASE NEW.severity
        WHEN 'critical' THEN '🚨 Critical Legal Update: ' || NEW.title
        WHEN 'important' THEN '⚠️ Important Legal Update: ' || NEW.title
        ELSE '📋 Legal Update: ' || NEW.title
      END,
      COALESCE(NEW.summary, LEFT(NEW.content, 200)),
      '/legal/blog/' || NEW.slug,
      'legal_post',
      NEW.id,
      jsonb_build_object('category', NEW.category, 'severity', NEW.severity)
    FROM profiles p
    WHERE p.id != NEW.author_id;

    -- Mark publish time
    NEW.published_at := COALESCE(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_legal_post ON legal_posts;
CREATE TRIGGER trg_notify_legal_post
  BEFORE INSERT OR UPDATE ON legal_posts
  FOR EACH ROW EXECUTE FUNCTION notify_legal_post();

-- ---------------------------------------------------------------------
-- Source: supabase/migration_series_seasons.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Source: supabase/migration_shoot_days.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Source: supabase/migration_shoot_gear.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Source: supabase/migration_sidebar_layouts.sql
-- ---------------------------------------------------------------------
-- Migration: Sidebar layout customisation
-- Run in Supabase SQL editor

-- Stores per-user sidebar layout overrides
-- project_id NULL  → global user default
-- project_id set + user_id set → project-specific user override
-- project_id set + user_id NULL → admin-set project default (fallback for members)
CREATE TABLE IF NOT EXISTS sidebar_layouts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  layout        jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- At most one row per (user, project) pair; project admin default has user_id = NULL
  CONSTRAINT sidebar_layouts_unique UNIQUE NULLS NOT DISTINCT (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS sidebar_layouts_user_id_idx      ON sidebar_layouts(user_id);
CREATE INDEX IF NOT EXISTS sidebar_layouts_project_id_idx   ON sidebar_layouts(project_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sidebar_layouts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_sidebar_layouts_updated_at ON sidebar_layouts;
CREATE TRIGGER set_sidebar_layouts_updated_at
  BEFORE UPDATE ON sidebar_layouts
  FOR EACH ROW EXECUTE FUNCTION update_sidebar_layouts_updated_at();

-- RLS
ALTER TABLE sidebar_layouts ENABLE ROW LEVEL SECURITY;

-- Users can read their own layouts
CREATE POLICY "sidebar_layouts_select_own" ON sidebar_layouts
  FOR SELECT USING (auth.uid() = user_id);

-- Project members can read the project admin default (user_id IS NULL)
CREATE POLICY "sidebar_layouts_select_project_default" ON sidebar_layouts
  FOR SELECT USING (
    user_id IS NULL AND
    project_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = sidebar_layouts.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- Users can insert/update/delete their own rows
CREATE POLICY "sidebar_layouts_insert_own" ON sidebar_layouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sidebar_layouts_update_own" ON sidebar_layouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "sidebar_layouts_delete_own" ON sidebar_layouts
  FOR DELETE USING (auth.uid() = user_id);

-- Only project owner/admin can set the project default (user_id IS NULL)
CREATE POLICY "sidebar_layouts_insert_project_default" ON sidebar_layouts
  FOR INSERT WITH CHECK (
    user_id IS NULL AND
    project_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = sidebar_layouts.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "sidebar_layouts_update_project_default" ON sidebar_layouts
  FOR UPDATE USING (
    user_id IS NULL AND
    project_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = sidebar_layouts.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Done

-- ---------------------------------------------------------------------
-- Source: supabase/migration_stage_play.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Source: supabase/migration_storage_buckets.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- MIGRATION: Storage Buckets — Public Access
-- ============================================================
-- !! RUN THIS IN: Supabase Dashboard → SQL Editor !!
-- !! This is the ONLY migration you need for images to work.!!
-- Safe to re-run: idempotent via WHERE NOT EXISTS + UPDATE.
-- ============================================================
-- Buckets covered:
--   project-covers   — project cover + poster images
--   community-files  — community post image uploads
-- ============================================================
-- ── 1. Create / fix the project-covers bucket ────────────────

-- Create if missing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'project-covers',
  'project-covers',
  true,                   -- PUBLIC — required for getPublicUrl() to work
  10485760,               -- 10 MB per upload
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif'
  ]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'project-covers'
);

-- Ensure public = true if bucket already exists but is private
UPDATE storage.buckets
SET public = true
WHERE id = 'project-covers' AND public = false;

-- ── 2. RLS policies for project-covers ───────────────────────

-- Public read: anyone can load an image URL
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'project_covers_public_select'
  ) THEN
    CREATE POLICY "project_covers_public_select"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'project-covers');
  END IF;
END $$;

-- Authenticated users can upload to their own project's folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'project_covers_auth_insert'
  ) THEN
    CREATE POLICY "project_covers_auth_insert"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'project-covers'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

-- Authenticated users can update (replace) objects they own
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'project_covers_auth_update'
  ) THEN
    CREATE POLICY "project_covers_auth_update"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'project-covers'
        AND auth.uid() = owner
      )
      WITH CHECK (
        bucket_id = 'project-covers'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

-- Authenticated users can delete their objects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'project_covers_auth_delete'
  ) THEN
    CREATE POLICY "project_covers_auth_delete"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'project-covers'
        AND auth.uid() = owner
      );
  END IF;
END $$;

-- ── 3. community-files bucket ────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'community-files',
  'community-files',
  true,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif'
  ]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'community-files'
);

-- Force public = true even if it existed but was private
UPDATE storage.buckets SET public = true
WHERE id IN ('community-files', 'project-covers') AND public = false;

-- Public read for community-files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'community_files_public_select'
  ) THEN
    CREATE POLICY "community_files_public_select"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'community-files');
  END IF;
END $$;

-- Authenticated upload for community-files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'community_files_auth_insert'
  ) THEN
    CREATE POLICY "community_files_auth_insert"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'community-files'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

-- Owner can delete community-files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'community_files_auth_delete'
  ) THEN
    CREATE POLICY "community_files_auth_delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'community-files' AND auth.uid() = owner);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- Done. All image URLs from getPublicUrl() will now load
-- without authentication across the whole platform.
-- ────────────────────────────────────────────────────────────


-- ---------------------------------------------------------------------
-- Source: supabase/migration_storyboard_shots.sql
-- ---------------------------------------------------------------------
-- Migration: Add storyboard fields to shots table
-- These fields allow storyboard drawings and references to be stored directly on shots

-- Add new columns for storyboard data
ALTER TABLE shots ADD COLUMN IF NOT EXISTS storyboard_drawing JSONB DEFAULT '[]'::jsonb;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS storyboard_references JSONB DEFAULT '[]'::jsonb;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS storyboard_notes TEXT;

-- Create index for faster storyboard queries
CREATE INDEX IF NOT EXISTS idx_shots_storyboard ON shots USING GIN (storyboard_drawing);

-- Comment the new columns
COMMENT ON COLUMN shots.storyboard_drawing IS 'Array of stroke objects for drawn storyboard: [{points: [{x,y}], color, width, tool}]';
COMMENT ON COLUMN shots.storyboard_references IS 'Array of reference images: [{url, label?}]';
COMMENT ON COLUMN shots.storyboard_notes IS 'Notes specific to the storyboard visualization';

-- ---------------------------------------------------------------------
-- Source: supabase/migration_subcommunities.sql
-- ---------------------------------------------------------------------
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Sub-Communities (Reddit-style community spaces)
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables created here:
--   sub_communities           – the community itself
--   sub_community_members     – membership + roles
--   sub_community_rules       – community ruleset
--   sub_community_contests    – community-hosted writing contests
--   sub_community_contest_entries – contest submissions
--   automod_flags             – auto-moderation event log
-- Plus:
--   ALTER community_posts     – adds sub_community_id foreign key
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Sub-communities ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sub_communities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT        UNIQUE NOT NULL,
  name            TEXT        NOT NULL,
  description     TEXT,
  long_description TEXT,                           -- markdown body shown on About tab
  icon            TEXT        DEFAULT '🎬',        -- emoji or URL
  banner_url      TEXT,
  accent_color    TEXT        DEFAULT '#FF5F1F',

  -- Visibility / posting rules
  -- public     → anyone can see, members can post freely
  -- restricted → anyone can see, must apply for posting rights
  -- private    → must be a member (approved) to see content
  visibility      TEXT        NOT NULL DEFAULT 'public'
                              CHECK (visibility IN ('public','restricted','private')),

  -- How posts are handled after submission
  -- open           → posted immediately
  -- require_approval → queued for mod approval
  -- apply_to_post  → user must be granted post permission by a mod first
  posting_mode    TEXT        NOT NULL DEFAULT 'open'
                              CHECK (posting_mode IN ('open','require_approval','apply_to_post')),

  -- Styling
  accent_color2   TEXT        DEFAULT '#a855f7',   -- secondary accent
  font_style      TEXT        DEFAULT 'default'
                              CHECK (font_style IN ('default','serif','mono','rounded')),

  -- Automod
  automod_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  automod_sensitivity TEXT    NOT NULL DEFAULT 'medium'
                              CHECK (automod_sensitivity IN ('low','medium','high')),

  -- Denormalised counters (updated by triggers / RPC)
  member_count    INT         NOT NULL DEFAULT 0,
  post_count      INT         NOT NULL DEFAULT 0,

  created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_communities_slug        ON sub_communities (slug);
CREATE INDEX IF NOT EXISTS idx_sub_communities_visibility  ON sub_communities (visibility);
CREATE INDEX IF NOT EXISTS idx_sub_communities_created_by  ON sub_communities (created_by);

ALTER TABLE sub_communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public communities are visible to all"       ON sub_communities;
DROP POLICY IF EXISTS "Private communities visible to members"      ON sub_communities;
DROP POLICY IF EXISTS "Authenticated users can create communities"  ON sub_communities;
DROP POLICY IF EXISTS "Admins/mods can update community"            ON sub_communities;

CREATE POLICY "Public communities are visible to all"
  ON sub_communities FOR SELECT
  USING (visibility = 'public' OR visibility = 'restricted');

-- NOTE: The policy for private communities (which subqueries sub_community_members)
-- is added BELOW, after sub_community_members is created, to avoid 42P01.

CREATE POLICY "Authenticated users can create communities"
  ON sub_communities FOR INSERT
  WITH CHECK (
    -- Normal user-created community
    (auth.uid() IS NOT NULL AND auth.uid() = created_by)
    -- System-seeded community (no owner / service_role INSERT)
    OR created_by IS NULL
  );

-- NOTE: UPDATE policy (also references sub_community_members) is added below.


-- ── Members ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sub_community_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    UUID        NOT NULL REFERENCES sub_communities(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- member            → normal member with posting rights (if community allows)
  -- moderator         → can approve/reject posts, manage members
  -- admin             → full control (typically the founder)
  -- banned            → cannot see private, cannot post/comment
  -- pending_approval  → applied to join/post, awaiting mod decision
  role            TEXT        NOT NULL DEFAULT 'member'
                              CHECK (role IN ('member','moderator','admin','banned','pending_approval')),

  can_post        BOOLEAN     NOT NULL DEFAULT TRUE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_scm_community  ON sub_community_members (community_id);
CREATE INDEX IF NOT EXISTS idx_scm_user       ON sub_community_members (user_id);
CREATE INDEX IF NOT EXISTS idx_scm_role       ON sub_community_members (community_id, role);

ALTER TABLE sub_community_members ENABLE ROW LEVEL SECURITY;

-- Helper that reads sub_communities WITHOUT triggering RLS.
-- This is the standard Supabase pattern for breaking circular policy recursion.
CREATE OR REPLACE FUNCTION get_community_visibility(p_community_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT visibility FROM sub_communities WHERE id = p_community_id
$$;

-- Now that sub_community_members exists, add the private-visibility policy to sub_communities
CREATE POLICY "Private communities visible to members"
  ON sub_communities FOR SELECT
  USING (
    visibility = 'private'
    AND (
      -- system-owned communities are always visible when private
      created_by IS NULL
      OR auth.uid() IN (
        SELECT user_id FROM sub_community_members
        WHERE community_id = sub_communities.id
          AND role NOT IN ('banned','pending_approval')
      )
    )
  );

CREATE POLICY "Admins/mods can update community"
  ON sub_communities FOR UPDATE
  USING (
    -- System communities can be updated by platform admins only
    (created_by IS NULL AND auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','moderator')))
    OR
    auth.uid() IN (
      SELECT user_id FROM sub_community_members
      WHERE community_id = sub_communities.id
        AND role IN ('admin','moderator')
    )
  );

-- Uses get_community_visibility() (SECURITY DEFINER) to avoid infinite
-- recursion: sub_communities policy → sub_community_members →
-- sub_communities policy → ...
DROP POLICY IF EXISTS "Members list is public for public/restricted communities" ON sub_community_members;
DROP POLICY IF EXISTS "Authenticated users can join"                             ON sub_community_members;
DROP POLICY IF EXISTS "Users manage own membership"                              ON sub_community_members;
DROP POLICY IF EXISTS "Mods manage members"                                      ON sub_community_members;

CREATE POLICY "Members list is public for public/restricted communities"
  ON sub_community_members FOR SELECT
  USING (
    get_community_visibility(community_id) IN ('public', 'restricted')
    OR auth.uid() = user_id
  );

CREATE POLICY "Authenticated users can join"
  ON sub_community_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users manage own membership"
  ON sub_community_members FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Mods manage members"
  ON sub_community_members FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM sub_community_members m2
      WHERE m2.community_id = sub_community_members.community_id
        AND m2.role IN ('admin','moderator')
    )
  );


-- ── Rules ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sub_community_rules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    UUID        NOT NULL REFERENCES sub_communities(id) ON DELETE CASCADE,
  sort_order      INT         NOT NULL DEFAULT 0,
  title           TEXT        NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scr_community ON sub_community_rules (community_id, sort_order);

ALTER TABLE sub_community_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rules are public"  ON sub_community_rules;
DROP POLICY IF EXISTS "Mods manage rules" ON sub_community_rules;

CREATE POLICY "Rules are public" ON sub_community_rules FOR SELECT USING (TRUE);

CREATE POLICY "Mods manage rules"
  ON sub_community_rules FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM sub_community_members
      WHERE community_id = sub_community_rules.community_id
        AND role IN ('admin','moderator')
    )
  );


-- ── Link posts to sub-communities ─────────────────────────────────────────────

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS sub_community_id UUID REFERENCES sub_communities(id) ON DELETE SET NULL;

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS mod_status TEXT DEFAULT 'approved'
    CHECK (mod_status IN ('approved','pending','rejected'));

CREATE INDEX IF NOT EXISTS idx_community_posts_sub_community
  ON community_posts (sub_community_id, mod_status, created_at DESC)
  WHERE sub_community_id IS NOT NULL;


-- ── Contests ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sub_community_contests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    UUID        NOT NULL REFERENCES sub_communities(id) ON DELETE CASCADE,
  created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,

  title           TEXT        NOT NULL,
  description     TEXT,
  rules_markdown  TEXT,
  prize           TEXT,                            -- free-form prize description
  banner_url      TEXT,

  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  voting_ends_at  TIMESTAMPTZ,

  status          TEXT        NOT NULL DEFAULT 'upcoming'
                              CHECK (status IN ('upcoming','active','voting','completed','cancelled')),

  max_entries_per_user INT    DEFAULT 1,
  submission_count     INT    NOT NULL DEFAULT 0,
  vote_count           INT    NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scc_community ON sub_community_contests (community_id, status);

ALTER TABLE sub_community_contests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contests are public"  ON sub_community_contests;
DROP POLICY IF EXISTS "Mods create contests" ON sub_community_contests;
DROP POLICY IF EXISTS "Mods update contests" ON sub_community_contests;

CREATE POLICY "Contests are public" ON sub_community_contests FOR SELECT USING (TRUE);

CREATE POLICY "Mods create contests"
  ON sub_community_contests FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM sub_community_members
      WHERE community_id = sub_community_contests.community_id
        AND role IN ('admin','moderator')
    )
  );

CREATE POLICY "Mods update contests"
  ON sub_community_contests FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM sub_community_members
      WHERE community_id = sub_community_contests.community_id
        AND role IN ('admin','moderator')
    )
  );


-- ── Contest entries ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sub_community_contest_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id  UUID        NOT NULL REFERENCES sub_community_contests(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id     UUID        REFERENCES community_posts(id) ON DELETE SET NULL,
  title       TEXT,
  body        TEXT,                                -- inline text entry (no post needed)
  vote_count  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_scce_contest ON sub_community_contest_entries (contest_id, vote_count DESC);

ALTER TABLE sub_community_contest_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entries are public"   ON sub_community_contest_entries;
DROP POLICY IF EXISTS "Users enter contests" ON sub_community_contest_entries;
DROP POLICY IF EXISTS "Users manage entries" ON sub_community_contest_entries;

CREATE POLICY "Entries are public"    ON sub_community_contest_entries FOR SELECT USING (TRUE);
CREATE POLICY "Users enter contests"  ON sub_community_contest_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage entries"  ON sub_community_contest_entries FOR DELETE USING (auth.uid() = user_id);


-- ── Contest votes ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sub_community_contest_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID        NOT NULL REFERENCES sub_community_contest_entries(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_id, user_id)
);

ALTER TABLE sub_community_contest_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Votes public"       ON sub_community_contest_votes;
DROP POLICY IF EXISTS "Users cast votes"   ON sub_community_contest_votes;
DROP POLICY IF EXISTS "Users remove votes" ON sub_community_contest_votes;

CREATE POLICY "Votes public"        ON sub_community_contest_votes FOR SELECT USING (TRUE);
CREATE POLICY "Users cast votes"    ON sub_community_contest_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove votes"  ON sub_community_contest_votes FOR DELETE USING (auth.uid() = user_id);


-- ── Automod flags ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automod_flags (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type    TEXT        NOT NULL CHECK (content_type IN ('post','comment','script')),
  content_id      UUID        NOT NULL,
  community_id    UUID        REFERENCES sub_communities(id) ON DELETE CASCADE,  -- NULL = platform-wide
  flagged_by      TEXT        NOT NULL DEFAULT 'automod',  -- 'automod' or user_id
  reason          TEXT        NOT NULL,
  severity        TEXT        NOT NULL DEFAULT 'medium'
                              CHECK (severity IN ('low','medium','high','critical')),
  auto_actioned   BOOLEAN     NOT NULL DEFAULT FALSE,      -- was content auto-hidden?
  resolved        BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_by     UUID        REFERENCES profiles(id),
  resolution_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automod_community  ON automod_flags (community_id, resolved, created_at DESC)
  WHERE community_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automod_platform   ON automod_flags (created_at DESC)
  WHERE community_id IS NULL;

ALTER TABLE automod_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mods view community flags"  ON automod_flags;
DROP POLICY IF EXISTS "Service role inserts flags"  ON automod_flags;

CREATE POLICY "Mods view community flags"
  ON automod_flags FOR SELECT
  USING (
    (community_id IS NOT NULL AND auth.uid() IN (
      SELECT user_id FROM sub_community_members
      WHERE community_id = automod_flags.community_id
        AND role IN ('admin','moderator')
    ))
    OR
    (community_id IS NULL AND auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin','moderator')
    ))
  );

CREATE POLICY "Service role inserts flags"
  ON automod_flags FOR INSERT
  WITH CHECK (TRUE);  -- service_role inserts; client never inserts directly


-- ── RPC: join / leave community ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION join_sub_community(p_community_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mode TEXT;
  v_role TEXT;
  v_inserted BOOLEAN;
BEGIN
  SELECT posting_mode INTO v_mode FROM sub_communities WHERE id = p_community_id;

  -- Determine initial role
  v_role := CASE
    WHEN v_mode = 'apply_to_post' THEN 'pending_approval'
    ELSE 'member'
  END;

  INSERT INTO sub_community_members (community_id, user_id, role)
    VALUES (p_community_id, auth.uid(), v_role)
    ON CONFLICT (community_id, user_id) DO NOTHING;

  -- Update counter only if new member was added
  IF FOUND THEN
    UPDATE sub_communities SET member_count = member_count + 1 WHERE id = p_community_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION leave_sub_community(p_community_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM sub_community_members
    WHERE community_id = p_community_id AND user_id = auth.uid();
  UPDATE sub_communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = p_community_id;
END;
$$;


-- ── RPC: approve / reject post (mod queue) ────────────────────────────────────

CREATE OR REPLACE FUNCTION mod_review_post(p_post_id UUID, p_action TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_community UUID;
BEGIN
  SELECT sub_community_id INTO v_community FROM community_posts WHERE id = p_post_id;

  IF NOT EXISTS (
    SELECT 1 FROM sub_community_members
    WHERE community_id = v_community AND user_id = auth.uid() AND role IN ('admin','moderator')
  ) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE community_posts
    SET mod_status = p_action,
        status = CASE WHEN p_action = 'approved' THEN 'published' ELSE 'draft' END
    WHERE id = p_post_id;
END;
$$;


-- ── Seed: starter sub-communities ────────────────────────────────────────────
-- These are system-owned default communities (created_by = NULL).
-- RLS is bypassed for this block so the seed runs cleanly regardless of
-- the caller's auth context.  Re-enabled immediately after.

ALTER TABLE sub_communities DISABLE ROW LEVEL SECURITY;

INSERT INTO sub_communities (slug, name, description, icon, accent_color, visibility, created_by)
VALUES
  ('general',          'General',              'General screenwriting discussion',              '💬', '#6366f1', 'public', NULL),
  ('feature-films',    'Feature Films',        'Long-form screenplay craft & feedback',         '🎬', '#0ea5e9', 'public', NULL),
  ('tv-pilots',        'TV & Pilots',          'Series bibles, pilot scripts, and episodics',  '📺', '#10b981', 'public', NULL),
  ('horror',           'Horror Writers',       'Dark scripts, thrillers, and horror concepts', '💀', '#ef4444', 'public', NULL),
  ('rom-coms',         'Rom-Coms & Comedy',    'Light-hearted scripts and comedic craft',      '💕', '#ec4899', 'public', NULL),
  ('shorts',           'Short Films',          'Scripts under 15 pages',                       '⚡', '#f59e0b', 'public', NULL),
  ('feedback',         'Feedback Exchange',    'Give and get notes on your work',              '🔍', '#8b5cf6', 'public', NULL),
  ('industry-news',    'Industry & News',      'Hollywood news, trends, and opportunities',    '📰', '#14b8a6', 'public', NULL)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE sub_communities ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_submissions_accepted_status.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- MIGRATION: Add 'accepted' to script_submissions status CHECK
-- ============================================================
-- The original submission_status constraint only included:
--   pending | passed | request | offer | withdrawn
--
-- This patch adds 'accepted' so Festival Bridge users can mark
-- a submission as fully accepted (triggers the 🎉 toast in the UI).
-- ============================================================

ALTER TABLE script_submissions
  DROP CONSTRAINT IF EXISTS submission_status;

ALTER TABLE script_submissions
  ADD CONSTRAINT submission_status
    CHECK (status IN ('pending', 'passed', 'request', 'offer', 'accepted', 'withdrawn'));

-- ---------------------------------------------------------------------
-- Source: supabase/migration_treatment_expanded.sql
-- ---------------------------------------------------------------------
t
-- ---------------------------------------------------------------------
-- Source: supabase/migration_user_country.sql
-- ---------------------------------------------------------------------
-- Add country column to profiles for analytics
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT; 
-- ---------------------------------------------------------------------
-- Source: supabase/migration_v2.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- MIGRATION V2 — Screenplay Studio (IDEMPOTENT)
-- Features: Onboarding, User Preferences, Company System,
--           Script Types, Draft Timeline, Distro→Project
--
-- Structure: All tables first, then all RLS policies.
-- All policies use DROP IF EXISTS + CREATE for safe re-runs.
-- ============================================================

-- ============================================================
-- 1. USER PREFERENCES & ONBOARDING
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS usage_intent TEXT DEFAULT 'writer';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_community BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_production_tools BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_collaboration BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_script_type TEXT DEFAULT 'screenplay';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'dark';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id UUID;

-- ============================================================
-- 2. SCRIPT TYPES & DRAFT SYSTEM
-- ============================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS script_type TEXT DEFAULT 'screenplay';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS episode_count INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS season_number INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id UUID;

CREATE TABLE IF NOT EXISTS script_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  draft_number INTEGER NOT NULL DEFAULT 1,
  draft_name TEXT,
  color TEXT DEFAULT '#6366f1',
  notes TEXT,
  snapshot JSONB,
  element_count INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  is_current BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_drafts_script ON script_drafts(script_id, draft_number);

-- ============================================================
-- 3. COMPANY SYSTEM — ALL TABLES FIRST
-- ============================================================

DO $$ BEGIN CREATE TYPE public.company_role AS ENUM ('owner', 'admin', 'manager', 'member', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.company_plan AS ENUM ('free', 'pro', 'enterprise'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  cover_url TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  brand_color TEXT DEFAULT '#6366f1',
  tagline TEXT,
  public_page_enabled BOOLEAN DEFAULT false,
  show_team_on_public BOOLEAN DEFAULT true,
  show_projects_on_public BOOLEAN DEFAULT false,
  allow_script_reading BOOLEAN DEFAULT false,
  custom_domain TEXT,
  plan company_plan DEFAULT 'pro',
  max_members INTEGER DEFAULT 25,
  max_projects INTEGER DEFAULT 100,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies(owner_id);

CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role company_role DEFAULT 'member',
  job_title TEXT,
  department TEXT,
  bio TEXT,
  is_public BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_members_company ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id);

CREATE TABLE IF NOT EXISTS company_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT,
  can_create_projects BOOLEAN DEFAULT true,
  can_edit_scripts BOOLEAN DEFAULT true,
  can_manage_production BOOLEAN DEFAULT false,
  can_view_budget BOOLEAN DEFAULT false,
  can_manage_budget BOOLEAN DEFAULT false,
  can_invite_members BOOLEAN DEFAULT false,
  can_publish_community BOOLEAN DEFAULT false,
  can_manage_company BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_team_members (
  team_id UUID NOT NULL REFERENCES company_teams(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, member_id)
);

CREATE TABLE IF NOT EXISTS company_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role company_role DEFAULT 'member',
  team_ids UUID[] DEFAULT '{}',
  invited_by UUID NOT NULL REFERENCES profiles(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_activity_company ON company_activity_log(company_id, created_at DESC);

-- ============================================================
-- 4. FOREIGN KEYS
-- ============================================================

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT fk_profiles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT fk_projects_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id) WHERE company_id IS NOT NULL;

-- ============================================================
-- 5. ENABLE RLS + GRANT ACCESS TO ALL NEW TABLES
-- ============================================================

ALTER TABLE script_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_activity_log ENABLE ROW LEVEL SECURITY;

-- Explicit grants (Supabase default privileges may not cover SQL Editor tables)
GRANT ALL ON script_drafts TO authenticated, anon, service_role;
GRANT ALL ON companies TO authenticated, anon, service_role;
GRANT ALL ON company_members TO authenticated, anon, service_role;
GRANT ALL ON company_teams TO authenticated, anon, service_role;
GRANT ALL ON company_team_members TO authenticated, anon, service_role;
GRANT ALL ON company_invitations TO authenticated, anon, service_role;
GRANT ALL ON company_activity_log TO authenticated, anon, service_role;
GRANT USAGE ON TYPE company_role TO authenticated, anon, service_role;
GRANT USAGE ON TYPE company_plan TO authenticated, anon, service_role;

-- ============================================================
-- 6. HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS to avoid recursion)
-- ============================================================

-- Returns all company_ids the user belongs to (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_company_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT company_id FROM company_members WHERE user_id = p_user_id;
$$;

-- Returns the user's role in a specific company (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_company_role(p_company_id UUID, p_user_id UUID)
RETURNS company_role
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT role FROM company_members WHERE company_id = p_company_id AND user_id = p_user_id LIMIT 1;
$$;

-- ============================================================
-- 7. RLS POLICIES — script_drafts
-- ============================================================

DROP POLICY IF EXISTS "Draft access follows script access" ON script_drafts;
CREATE POLICY "Draft access follows script access" ON script_drafts
  FOR SELECT USING (
    script_id IN (
      SELECT s.id FROM scripts s JOIN projects p ON s.project_id = p.id WHERE p.created_by = auth.uid()
      UNION
      SELECT s.id FROM scripts s JOIN project_members pm ON s.project_id = pm.project_id WHERE pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Writers can create drafts" ON script_drafts;
CREATE POLICY "Writers can create drafts" ON script_drafts
  FOR INSERT WITH CHECK (
    script_id IN (
      SELECT s.id FROM scripts s JOIN projects p ON s.project_id = p.id WHERE p.created_by = auth.uid()
      UNION
      SELECT s.id FROM scripts s JOIN project_members pm ON s.project_id = pm.project_id WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin', 'writer')
    )
  );

DROP POLICY IF EXISTS "Writers can update drafts" ON script_drafts;
CREATE POLICY "Writers can update drafts" ON script_drafts
  FOR UPDATE USING (
    script_id IN (
      SELECT s.id FROM scripts s JOIN projects p ON s.project_id = p.id WHERE p.created_by = auth.uid()
      UNION
      SELECT s.id FROM scripts s JOIN project_members pm ON s.project_id = pm.project_id WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin', 'writer')
    )
  );

DROP POLICY IF EXISTS "Owners can delete drafts" ON script_drafts;
CREATE POLICY "Owners can delete drafts" ON script_drafts
  FOR DELETE USING (
    script_id IN (
      SELECT s.id FROM scripts s JOIN projects p ON s.project_id = p.id WHERE p.created_by = auth.uid()
      UNION
      SELECT s.id FROM scripts s JOIN project_members pm ON s.project_id = pm.project_id WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 8. RLS POLICIES — companies
-- ============================================================

DROP POLICY IF EXISTS "Public companies are viewable" ON companies;
CREATE POLICY "Public companies are viewable" ON companies
  FOR SELECT USING (
    public_page_enabled = true
    OR owner_id = auth.uid()
    OR id IN (SELECT get_user_company_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Owners can create companies" ON companies;
CREATE POLICY "Owners can create companies" ON companies
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Company admins can update" ON companies;
CREATE POLICY "Company admins can update" ON companies
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR get_user_company_role(id, auth.uid()) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "Only owners can delete companies" ON companies;
CREATE POLICY "Only owners can delete companies" ON companies
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================================
-- 9. RLS POLICIES — company_members (NO self-references — use helpers)
-- ============================================================

DROP POLICY IF EXISTS "Company members viewable by members" ON company_members;
CREATE POLICY "Company members viewable by members" ON company_members
  FOR SELECT USING (
    company_id IN (SELECT get_user_company_ids(auth.uid()))
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR company_id IN (SELECT id FROM companies WHERE public_page_enabled = true)
  );

DROP POLICY IF EXISTS "Company admins can add members" ON company_members;
CREATE POLICY "Company admins can add members" ON company_members
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  );

DROP POLICY IF EXISTS "Company admins can update members" ON company_members;
CREATE POLICY "Company admins can update members" ON company_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "Company admins can remove members" ON company_members;
CREATE POLICY "Company admins can remove members" ON company_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

-- ============================================================
-- 10. RLS POLICIES — company_teams
-- ============================================================

DROP POLICY IF EXISTS "Teams viewable by company members" ON company_teams;
CREATE POLICY "Teams viewable by company members" ON company_teams
  FOR SELECT USING (
    company_id IN (SELECT get_user_company_ids(auth.uid()))
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Company admins can manage teams" ON company_teams;
CREATE POLICY "Company admins can manage teams" ON company_teams
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

-- ============================================================
-- 11. RLS POLICIES — company_team_members
-- ============================================================

DROP POLICY IF EXISTS "Team members viewable by company" ON company_team_members;
CREATE POLICY "Team members viewable by company" ON company_team_members
  FOR SELECT USING (
    team_id IN (
      SELECT id FROM company_teams WHERE
        company_id IN (SELECT get_user_company_ids(auth.uid()))
        OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Company admins manage team members" ON company_team_members;
CREATE POLICY "Company admins manage team members" ON company_team_members
  FOR ALL USING (
    team_id IN (
      SELECT id FROM company_teams WHERE
        company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
        OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 12. RLS POLICIES — company_invitations
-- ============================================================

DROP POLICY IF EXISTS "Invitations viewable by company admins" ON company_invitations;
CREATE POLICY "Invitations viewable by company admins" ON company_invitations
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
    OR email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Company admins create invitations" ON company_invitations;
CREATE POLICY "Company admins create invitations" ON company_invitations
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  );

DROP POLICY IF EXISTS "Admins manage invitations" ON company_invitations;
CREATE POLICY "Admins manage invitations" ON company_invitations
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

-- ============================================================
-- 13. RLS POLICIES — company_activity_log
-- ============================================================

DROP POLICY IF EXISTS "Activity visible to company members" ON company_activity_log;
CREATE POLICY "Activity visible to company members" ON company_activity_log
  FOR SELECT USING (
    company_id IN (SELECT get_user_company_ids(auth.uid()))
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "System can insert activity" ON company_activity_log;
CREATE POLICY "System can insert activity" ON company_activity_log
  FOR INSERT WITH CHECK (
    company_id IN (SELECT get_user_company_ids(auth.uid()))
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

-- ============================================================
-- 14. DISTRO → PROJECT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION fork_community_script_to_project(
  p_post_id UUID,
  p_user_id UUID,
  p_title TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_post community_posts%ROWTYPE;
  v_project_id UUID;
  v_script_id UUID;
  v_elements JSONB;
  v_el JSONB;
  v_sort INTEGER := 0;
BEGIN
  SELECT * INTO v_post FROM community_posts WHERE id = p_post_id;
  IF v_post IS NULL THEN RAISE EXCEPTION 'Post not found'; END IF;
  IF NOT v_post.allow_distros THEN RAISE EXCEPTION 'This script does not allow distros'; END IF;

  INSERT INTO projects (title, logline, format, created_by)
  VALUES (COALESCE(p_title, 'Distro: ' || v_post.title), v_post.description, 'feature', p_user_id)
  RETURNING id INTO v_project_id;

  SELECT id INTO v_script_id FROM scripts WHERE project_id = v_project_id ORDER BY created_at ASC LIMIT 1;

  IF v_post.script_content IS NOT NULL AND v_post.script_content LIKE '[%' THEN
    BEGIN
      v_elements := v_post.script_content::jsonb;
      FOR v_el IN SELECT * FROM jsonb_array_elements(v_elements) LOOP
        INSERT INTO script_elements (script_id, element_type, content, sort_order, created_by)
        VALUES (v_script_id, (v_el->>'element_type')::script_element_type, COALESCE(v_el->>'content', ''), v_sort, p_user_id);
        v_sort := v_sort + 1;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO script_elements (script_id, element_type, content, sort_order, created_by)
      VALUES (v_script_id, 'action', v_post.script_content, 0, p_user_id);
    END;
  ELSIF v_post.script_content IS NOT NULL THEN
    INSERT INTO script_elements (script_id, element_type, content, sort_order, created_by)
    VALUES (v_script_id, 'action', v_post.script_content, 0, p_user_id);
  END IF;

  INSERT INTO community_distros (original_post_id, author_id, title, description, script_content, project_id)
  VALUES (p_post_id, p_user_id, COALESCE(p_title, 'Distro: ' || v_post.title), v_post.description, v_post.script_content, v_project_id);

  RETURN v_project_id;
END;
$$;

-- ============================================================
-- 15. SAVE DRAFT SNAPSHOT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION save_script_draft(
  p_script_id UUID,
  p_draft_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_draft_id UUID;
  v_draft_number INTEGER;
  v_snapshot JSONB;
  v_element_count INTEGER;
  v_word_count INTEGER;
BEGIN
  SELECT COALESCE(MAX(draft_number), 0) + 1 INTO v_draft_number
  FROM script_drafts WHERE script_id = p_script_id;

  SELECT jsonb_agg(
    jsonb_build_object('element_type', element_type, 'content', content, 'sort_order', sort_order, 'scene_number', scene_number, 'is_omitted', is_omitted)
    ORDER BY sort_order
  ) INTO v_snapshot
  FROM script_elements WHERE script_id = p_script_id AND is_omitted = false;

  SELECT COUNT(*) INTO v_element_count FROM script_elements WHERE script_id = p_script_id AND is_omitted = false;
  SELECT COALESCE(SUM(array_length(regexp_split_to_array(content, '\s+'), 1)), 0) INTO v_word_count
  FROM script_elements WHERE script_id = p_script_id AND is_omitted = false;

  UPDATE script_drafts SET is_current = false WHERE script_id = p_script_id;

  INSERT INTO script_drafts (script_id, draft_number, draft_name, notes, snapshot, element_count, page_count, word_count, is_current, created_by)
  VALUES (p_script_id, v_draft_number, COALESCE(p_draft_name, 'Draft ' || v_draft_number), p_notes, v_snapshot, v_element_count, GREATEST(1, CEIL(v_word_count::decimal / 250)), v_word_count, true, auth.uid())
  RETURNING id INTO v_draft_id;

  RETURN v_draft_id;
END;
$$;

-- ============================================================
-- 16. RESTORE DRAFT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION restore_script_draft(p_draft_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_draft script_drafts%ROWTYPE;
  v_el JSONB;
  v_sort INTEGER := 0;
BEGIN
  SELECT * INTO v_draft FROM script_drafts WHERE id = p_draft_id;
  IF v_draft IS NULL THEN RAISE EXCEPTION 'Draft not found'; END IF;

  PERFORM save_script_draft(v_draft.script_id, 'Auto-save before restore', 'Automatic snapshot before restoring draft ' || v_draft.draft_name);

  DELETE FROM script_elements WHERE script_id = v_draft.script_id;

  IF v_draft.snapshot IS NOT NULL THEN
    FOR v_el IN SELECT * FROM jsonb_array_elements(v_draft.snapshot) LOOP
      INSERT INTO script_elements (script_id, element_type, content, sort_order, scene_number, is_omitted, created_by)
      VALUES (v_draft.script_id, (v_el->>'element_type')::script_element_type, COALESCE(v_el->>'content', ''), v_sort, v_el->>'scene_number', COALESCE((v_el->>'is_omitted')::boolean, false), auth.uid());
      v_sort := v_sort + 1;
    END LOOP;
  END IF;

  UPDATE script_drafts SET is_current = false WHERE script_id = v_draft.script_id;
  UPDATE script_drafts SET is_current = true WHERE id = p_draft_id;
END;
$$;

-- ============================================================
-- 17. NOTIFICATIONS SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  acted_on BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

GRANT ALL ON notifications TO authenticated, anon, service_role;

DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
CREATE POLICY "Users see own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage own notifications" ON notifications;
CREATE POLICY "Users manage own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own notifications" ON notifications;
CREATE POLICY "Users delete own notifications" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- Helper: Create a notification (SECURITY DEFINER so triggers can insert for any user)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Don't notify yourself
  IF p_actor_id IS NOT NULL AND p_actor_id = p_user_id THEN
    RETURN NULL;
  END IF;
  INSERT INTO notifications (user_id, type, title, body, link, actor_id, entity_type, entity_id, metadata)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, p_actor_id, p_entity_type, p_entity_id, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Trigger: Notify on community comment
CREATE OR REPLACE FUNCTION notify_on_community_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_post RECORD;
  v_actor_name TEXT;
BEGIN
  SELECT id, title, slug, author_id INTO v_post FROM community_posts WHERE id = NEW.post_id;
  IF v_post IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor_name FROM profiles WHERE id = NEW.author_id;

  -- Notify post author
  IF v_post.author_id IS DISTINCT FROM NEW.author_id THEN
    PERFORM create_notification(
      v_post.author_id, 'community_comment',
      v_actor_name || ' commented on your post',
      LEFT(NEW.content, 120),
      '/community/post/' || v_post.slug,
      NEW.author_id, 'community_post', v_post.id
    );
  END IF;

  -- If replying, notify parent comment author
  IF NEW.parent_id IS NOT NULL THEN
    DECLARE v_parent_author UUID;
    BEGIN
      SELECT author_id INTO v_parent_author FROM community_comments WHERE id = NEW.parent_id;
      IF v_parent_author IS DISTINCT FROM NEW.author_id AND v_parent_author IS DISTINCT FROM v_post.author_id THEN
        PERFORM create_notification(
          v_parent_author, 'community_reply',
          v_actor_name || ' replied to your comment',
          LEFT(NEW.content, 120),
          '/community/post/' || v_post.slug,
          NEW.author_id, 'community_comment', NEW.id
        );
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_community_comment ON community_comments;
CREATE TRIGGER on_community_comment
  AFTER INSERT ON community_comments
  FOR EACH ROW EXECUTE FUNCTION notify_on_community_comment();

-- Trigger: Notify on community upvote
CREATE OR REPLACE FUNCTION notify_on_community_upvote()
RETURNS TRIGGER AS $$
DECLARE
  v_post RECORD;
  v_actor_name TEXT;
BEGIN
  SELECT id, title, slug, author_id INTO v_post FROM community_posts WHERE id = NEW.post_id;
  IF v_post IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor_name FROM profiles WHERE id = NEW.user_id;

  IF v_post.author_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM create_notification(
      v_post.author_id, 'community_upvote',
      v_actor_name || ' liked your post',
      v_post.title,
      '/community/post/' || v_post.slug,
      NEW.user_id, 'community_post', v_post.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_community_upvote ON community_upvotes;
CREATE TRIGGER on_community_upvote
  AFTER INSERT ON community_upvotes
  FOR EACH ROW EXECUTE FUNCTION notify_on_community_upvote();

-- Trigger: Notify on project member added
CREATE OR REPLACE FUNCTION notify_on_project_member()
RETURNS TRIGGER AS $$
DECLARE
  v_project RECORD;
  v_actor_name TEXT;
BEGIN
  SELECT id, title INTO v_project FROM projects WHERE id = NEW.project_id;
  IF v_project IS NULL THEN RETURN NEW; END IF;

  IF NEW.invited_by IS NOT NULL THEN
    SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor_name FROM profiles WHERE id = NEW.invited_by;
  ELSE
    v_actor_name := 'System';
  END IF;

  PERFORM create_notification(
    NEW.user_id, 'project_invitation',
    'You were added to ' || v_project.title,
    v_actor_name || ' invited you as ' || NEW.role,
    '/projects/' || v_project.id,
    NEW.invited_by, 'project', v_project.id,
    jsonb_build_object('project_member_id', NEW.id, 'role', NEW.role)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_member_added ON project_members;
CREATE TRIGGER on_project_member_added
  AFTER INSERT ON project_members
  FOR EACH ROW EXECUTE FUNCTION notify_on_project_member();

-- Trigger: Notify on company invitation created
CREATE OR REPLACE FUNCTION notify_on_company_invitation()
RETURNS TRIGGER AS $$
DECLARE
  v_company RECORD;
  v_actor_name TEXT;
  v_target_user UUID;
BEGIN
  SELECT id, name, slug INTO v_company FROM companies WHERE id = NEW.company_id;
  IF v_company IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor_name FROM profiles WHERE id = NEW.invited_by;

  -- Find the user by email
  SELECT id INTO v_target_user FROM profiles WHERE email = NEW.email;

  IF v_target_user IS NOT NULL THEN
    PERFORM create_notification(
      v_target_user, 'company_invitation',
      'You were invited to join ' || v_company.name,
      v_actor_name || ' invited you as ' || NEW.role,
      '/company',
      NEW.invited_by, 'company_invitation', NEW.id,
      jsonb_build_object('company_id', v_company.id, 'company_name', v_company.name, 'invitation_id', NEW.id, 'role', NEW.role, 'token', NEW.token)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_company_invitation ON company_invitations;
CREATE TRIGGER on_company_invitation
  AFTER INSERT ON company_invitations
  FOR EACH ROW EXECUTE FUNCTION notify_on_company_invitation();

-- Trigger: Notify on project comment
CREATE OR REPLACE FUNCTION notify_on_project_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_project RECORD;
  v_actor_name TEXT;
  v_member RECORD;
BEGIN
  SELECT id, title, created_by INTO v_project FROM projects WHERE id = NEW.project_id;
  IF v_project IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor_name FROM profiles WHERE id = NEW.created_by;

  -- Notify project owner
  IF v_project.created_by IS DISTINCT FROM NEW.created_by THEN
    PERFORM create_notification(
      v_project.created_by, 'project_comment',
      v_actor_name || ' commented in ' || v_project.title,
      LEFT(NEW.content, 120),
      '/projects/' || v_project.id,
      NEW.created_by, 'comment', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_comment ON comments;
CREATE TRIGGER on_project_comment
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION notify_on_project_comment();

-- Realtime for notifications
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 18. AUTO-CREATE COMPANY MEMBER ON COMPANY CREATE
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_company()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO company_members (company_id, user_id, role, job_title)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'Company Owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_company_created ON companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION handle_new_company();

-- ============================================================
-- 19. TRIGGERS (idempotent)
-- ============================================================

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_teams_updated_at ON company_teams;
CREATE TRIGGER update_company_teams_updated_at
  BEFORE UPDATE ON company_teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 20. REALTIME (safe to re-run — Supabase ignores duplicates)
-- ============================================================

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE company_activity_log; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE script_drafts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 21. COMPANY BLOG SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS company_blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  pinned BOOLEAN DEFAULT false,
  allow_comments BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_company_blog_company ON company_blog_posts(company_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_blog_slug ON company_blog_posts(company_id, slug);
CREATE INDEX IF NOT EXISTS idx_company_blog_author ON company_blog_posts(author_id);

CREATE TABLE IF NOT EXISTS company_blog_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES company_blog_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES company_blog_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_blog_comments_post ON company_blog_comments(post_id, created_at);

ALTER TABLE company_blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_blog_comments ENABLE ROW LEVEL SECURITY;

GRANT ALL ON company_blog_posts TO authenticated, anon, service_role;
GRANT ALL ON company_blog_comments TO authenticated, anon, service_role;

-- Published blog posts are public; drafts visible only to company members
DROP POLICY IF EXISTS "Company blog posts readable" ON company_blog_posts;
CREATE POLICY "Company blog posts readable" ON company_blog_posts
  FOR SELECT USING (
    status = 'published'
    OR company_id IN (SELECT get_user_company_ids(auth.uid()))
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

-- Company admins/managers can create posts
DROP POLICY IF EXISTS "Company members can create blog posts" ON company_blog_posts;
CREATE POLICY "Company members can create blog posts" ON company_blog_posts
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND (
      company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
      OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
    )
  );

-- Authors and company admins can update
DROP POLICY IF EXISTS "Blog post authors and admins can update" ON company_blog_posts;
CREATE POLICY "Blog post authors and admins can update" ON company_blog_posts
  FOR UPDATE USING (
    author_id = auth.uid()
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

-- Only company admins can delete
DROP POLICY IF EXISTS "Company admins can delete blog posts" ON company_blog_posts;
CREATE POLICY "Company admins can delete blog posts" ON company_blog_posts
  FOR DELETE USING (
    author_id = auth.uid()
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

-- Blog comments: anyone can read published post comments
DROP POLICY IF EXISTS "Blog comments readable" ON company_blog_comments;
CREATE POLICY "Blog comments readable" ON company_blog_comments
  FOR SELECT USING (
    post_id IN (SELECT id FROM company_blog_posts WHERE status = 'published')
    OR post_id IN (
      SELECT id FROM company_blog_posts WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
    )
  );

-- Authenticated users can comment
DROP POLICY IF EXISTS "Authenticated users can comment on blog" ON company_blog_comments;
CREATE POLICY "Authenticated users can comment on blog" ON company_blog_comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND post_id IN (SELECT id FROM company_blog_posts WHERE status = 'published' AND allow_comments = true)
  );

-- Authors can update own comments
DROP POLICY IF EXISTS "Comment authors can update" ON company_blog_comments;
CREATE POLICY "Comment authors can update" ON company_blog_comments
  FOR UPDATE USING (author_id = auth.uid());

-- Authors and company admins can delete comments
DROP POLICY IF EXISTS "Comment authors and admins can delete" ON company_blog_comments;
CREATE POLICY "Comment authors and admins can delete" ON company_blog_comments
  FOR DELETE USING (
    author_id = auth.uid()
    OR post_id IN (
      SELECT id FROM company_blog_posts WHERE
        company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
        OR get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
    )
  );

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_company_blog_posts_updated_at ON company_blog_posts;
CREATE TRIGGER update_company_blog_posts_updated_at
  BEFORE UPDATE ON company_blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_blog_comments_updated_at ON company_blog_comments;
CREATE TRIGGER update_company_blog_comments_updated_at
  BEFORE UPDATE ON company_blog_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Notify company blog comment
CREATE OR REPLACE FUNCTION notify_on_company_blog_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_post RECORD;
  v_actor_name TEXT;
  v_company RECORD;
BEGIN
  SELECT id, title, slug, author_id, company_id INTO v_post FROM company_blog_posts WHERE id = NEW.post_id;
  IF v_post IS NULL THEN RETURN NEW; END IF;
  SELECT slug INTO v_company FROM companies WHERE id = v_post.company_id;
  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor_name FROM profiles WHERE id = NEW.author_id;

  IF v_post.author_id IS DISTINCT FROM NEW.author_id THEN
    PERFORM create_notification(
      v_post.author_id, 'company_blog_comment',
      v_actor_name || ' commented on your blog post',
      LEFT(NEW.content, 120),
      '/company/' || v_company.slug || '/blog/' || v_post.slug,
      NEW.author_id, 'company_blog_post', v_post.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_company_blog_comment ON company_blog_comments;
CREATE TRIGGER on_company_blog_comment
  AFTER INSERT ON company_blog_comments
  FOR EACH ROW EXECUTE FUNCTION notify_on_company_blog_comment();

-- ============================================================
-- 22. ADDITIONAL SECURITY — rate limiting helper
-- ============================================================

-- Prevents excessive inserts from a single user within a time window
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_table TEXT,
  p_user_id UUID,
  p_window_minutes INTEGER DEFAULT 1,
  p_max_count INTEGER DEFAULT 10
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_count INTEGER;
BEGIN
  EXECUTE format(
    'SELECT COUNT(*) FROM %I WHERE (created_by = $1 OR author_id = $1 OR user_id = $1) AND created_at > NOW() - interval ''%s minutes''',
    p_table, p_window_minutes
  ) INTO v_count USING p_user_id;
  RETURN v_count < p_max_count;
EXCEPTION WHEN undefined_column THEN
  RETURN true; -- table doesn't have any of those columns, skip
END;
$$;


-- ============================================================
-- 23. COMPANY-AWARE PROJECT ACCESS POLICIES
-- ============================================================
-- Company members should be able to see and (depending on role) manage
-- projects that belong to their company. The base schema only checks
-- created_by / project_members, so we add supplementary policies here.

-- Allow company members to SELECT company projects
DROP POLICY IF EXISTS "Company members can view company projects" ON projects;
CREATE POLICY "Company members can view company projects" ON projects
  FOR SELECT USING (
    company_id IS NOT NULL
    AND company_id IN (SELECT get_user_company_ids(auth.uid()))
  );

-- Allow company admins/owners/managers to INSERT projects for their company
DROP POLICY IF EXISTS "Company admins can create company projects" ON projects;
CREATE POLICY "Company admins can create company projects" ON projects
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL
    AND auth.uid() = created_by
    AND get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin', 'manager')
  );

-- Allow company admins/owners to UPDATE company projects
DROP POLICY IF EXISTS "Company admins can update company projects" ON projects;
CREATE POLICY "Company admins can update company projects" ON projects
  FOR UPDATE USING (
    company_id IS NOT NULL
    AND get_user_company_role(company_id, auth.uid()) IN ('owner', 'admin')
  );

-- Allow company owners to DELETE company projects
DROP POLICY IF EXISTS "Company owners can delete company projects" ON projects;
CREATE POLICY "Company owners can delete company projects" ON projects
  FOR DELETE USING (
    company_id IS NOT NULL
    AND get_user_company_role(company_id, auth.uid()) = 'owner'
  );


-- ============================================================
-- 24. INPUT VALIDATION HELPERS
-- ============================================================

-- Validate that a slug contains only safe characters
CREATE OR REPLACE FUNCTION is_valid_slug(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN p_slug ~ '^[a-z0-9][a-z0-9\-]{1,98}[a-z0-9]$';
END;
$$;

-- Sanitize user-provided text: trim, collapse whitespace, limit length
CREATE OR REPLACE FUNCTION sanitize_text(p_text TEXT, p_max_length INTEGER DEFAULT 5000)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  RETURN LEFT(TRIM(regexp_replace(p_text, '\s+', ' ', 'g')), p_max_length);
END;
$$;


-- ============================================================
-- 25. ACCEPT COMPANY INVITATION (SECURITY DEFINER — bypasses RLS)
-- ============================================================
-- This is CRITICAL: when a user accepts an invitation, they are NOT yet
-- a company member, so RLS blocks them from inserting into company_members.
-- This function runs as the DB owner and handles the entire flow atomically.

CREATE OR REPLACE FUNCTION accept_company_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv company_invitations%ROWTYPE;
  v_user_id UUID;
  v_company_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch the invitation
  SELECT * INTO v_inv FROM company_invitations WHERE id = p_invitation_id;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  -- Check it hasn't already been accepted
  IF v_inv.accepted THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Already accepted');
  END IF;

  -- Check it hasn't expired
  IF v_inv.expires_at < NOW() THEN
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- Verify the current user's email matches the invitation
  -- (or allow any authenticated user — the notification is already targeted)

  -- Mark invitation as accepted
  UPDATE company_invitations SET accepted = true WHERE id = p_invitation_id;

  -- Insert into company_members (upsert to avoid duplicate errors)
  INSERT INTO company_members (company_id, user_id, role, invited_by)
  VALUES (v_inv.company_id, v_user_id, v_inv.role, v_inv.invited_by)
  ON CONFLICT (company_id, user_id) DO UPDATE SET role = v_inv.role;

  -- Update profile company_id
  UPDATE profiles SET company_id = v_inv.company_id WHERE id = v_user_id;

  -- Get company name for response
  SELECT name INTO v_company_name FROM companies WHERE id = v_inv.company_id;

  -- Log activity
  INSERT INTO company_activity_log (company_id, user_id, action, entity_type, metadata)
  VALUES (v_inv.company_id, v_user_id, 'accepted_invitation', 'member',
    jsonb_build_object('role', v_inv.role));

  RETURN jsonb_build_object('ok', true, 'company_id', v_inv.company_id, 'company_name', v_company_name);
END;
$$;

-- ============================================================
-- 26. FIX SCRIPT ELEMENT SORT ORDER — INTEGER → DOUBLE PRECISION
-- (Fractional ordering between elements needs non-integer values)
-- ============================================================

ALTER TABLE script_elements ALTER COLUMN sort_order TYPE DOUBLE PRECISION;

-- ============================================================
-- 27. AUTO-ADD COMPANY MEMBERS TO COMPANY PROJECTS
-- When a user joins a company, add them to all company projects.
-- When a company project is created, add all company members.
-- ============================================================

-- 27a. When a new company member is added → add to all company projects
CREATE OR REPLACE FUNCTION sync_company_member_to_projects()
RETURNS TRIGGER AS $$
DECLARE
  v_project RECORD;
  v_company_role TEXT;
  v_project_role TEXT;
BEGIN
  -- Map company role to default project role
  v_company_role := NEW.role;
  CASE v_company_role
    WHEN 'owner' THEN v_project_role := 'admin';
    WHEN 'admin' THEN v_project_role := 'admin';
    WHEN 'manager' THEN v_project_role := 'editor';
    WHEN 'member' THEN v_project_role := 'writer';
    WHEN 'viewer' THEN v_project_role := 'viewer';
    ELSE v_project_role := 'viewer';
  END CASE;

  -- Add to all projects that belong to this company
  FOR v_project IN
    SELECT id FROM projects WHERE company_id = NEW.company_id
  LOOP
    INSERT INTO project_members (project_id, user_id, role, invited_by)
    VALUES (v_project.id, NEW.user_id, v_project_role, NEW.invited_by)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_company_member_sync_projects ON company_members;
CREATE TRIGGER on_company_member_sync_projects
  AFTER INSERT ON company_members
  FOR EACH ROW EXECUTE FUNCTION sync_company_member_to_projects();

-- 27b. When a project is created with a company_id → add all company members
CREATE OR REPLACE FUNCTION sync_project_to_company_members()
RETURNS TRIGGER AS $$
DECLARE
  v_member RECORD;
  v_project_role TEXT;
BEGIN
  -- Only run if project has a company
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;

  FOR v_member IN
    SELECT user_id, role, id AS member_id FROM company_members WHERE company_id = NEW.company_id
  LOOP
    -- Map company role to project role
    CASE v_member.role
      WHEN 'owner' THEN v_project_role := 'admin';
      WHEN 'admin' THEN v_project_role := 'admin';
      WHEN 'manager' THEN v_project_role := 'editor';
      WHEN 'member' THEN v_project_role := 'writer';
      WHEN 'viewer' THEN v_project_role := 'viewer';
      ELSE v_project_role := 'viewer';
    END CASE;

    INSERT INTO project_members (project_id, user_id, role)
    VALUES (NEW.id, v_member.user_id, v_project_role)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_sync_company_members ON projects;
CREATE TRIGGER on_project_sync_company_members
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION sync_project_to_company_members();

-- 27c. When a project gets assigned to a company (updated company_id) → sync
CREATE OR REPLACE FUNCTION sync_project_company_change()
RETURNS TRIGGER AS $$
DECLARE
  v_member RECORD;
  v_project_role TEXT;
BEGIN
  IF NEW.company_id IS NOT NULL AND (OLD.company_id IS DISTINCT FROM NEW.company_id) THEN
    FOR v_member IN
      SELECT user_id, role FROM company_members WHERE company_id = NEW.company_id
    LOOP
      CASE v_member.role
        WHEN 'owner' THEN v_project_role := 'admin';
        WHEN 'admin' THEN v_project_role := 'admin';
        WHEN 'manager' THEN v_project_role := 'editor';
        WHEN 'member' THEN v_project_role := 'writer';
        WHEN 'viewer' THEN v_project_role := 'viewer';
        ELSE v_project_role := 'viewer';
      END CASE;

      INSERT INTO project_members (project_id, user_id, role)
      VALUES (NEW.id, v_member.user_id, v_project_role)
      ON CONFLICT (project_id, user_id) DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_company_change ON projects;
CREATE TRIGGER on_project_company_change
  AFTER UPDATE OF company_id ON projects
  FOR EACH ROW EXECUTE FUNCTION sync_project_company_change();

-- ============================================================
-- 28. SCHEDULE NOTIFICATIONS
-- Notify project members when schedule events are created.
-- A cron / edge function should handle "upcoming" reminders.
-- ============================================================

-- Ensure notification_type exists (idempotent)
DO $$
BEGIN
  IF to_regtype('public.notification_type') IS NULL THEN
    CREATE TYPE public.notification_type AS ENUM (
      'community_comment',
      'community_reply',
      'community_upvote',
      'project_invitation',
      'company_invitation',
      'project_comment',
      'company_blog_comment',
      'schedule_created',
      'schedule_reminder'
    );
  END IF;
END $$;

-- Add schedule notification types
DO $$
BEGIN
  IF to_regtype('public.notification_type') IS NOT NULL THEN
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'schedule_created';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'schedule_reminder';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION notify_on_schedule_event()
RETURNS TRIGGER AS $$
DECLARE
  v_project RECORD;
  v_actor_name TEXT;
  v_member RECORD;
  v_event_date TEXT;
BEGIN
  SELECT id, title INTO v_project FROM projects WHERE id = NEW.project_id;
  IF v_project IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor_name
  FROM profiles WHERE id = NEW.created_by;

  v_event_date := to_char(NEW.start_time, 'Mon DD, YYYY');

  -- Notify all project members (except the creator)
  FOR v_member IN
    SELECT user_id FROM project_members WHERE project_id = NEW.project_id AND user_id IS DISTINCT FROM NEW.created_by
  LOOP
    PERFORM create_notification(
      v_member.user_id,
      'schedule_created',
      NEW.title || ' — ' || v_event_date,
      v_actor_name || ' scheduled "' || NEW.title || '" (' || NEW.event_type || ') on ' || v_event_date,
      '/projects/' || NEW.project_id || '/schedule',
      NEW.created_by,
      'schedule',
      NEW.id,
      jsonb_build_object(
        'event_type', NEW.event_type,
        'start_time', NEW.start_time,
        'project_title', v_project.title
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_schedule_event_created ON production_schedule;
CREATE TRIGGER on_schedule_event_created
  AFTER INSERT ON production_schedule
  FOR EACH ROW EXECUTE FUNCTION notify_on_schedule_event();

-- ============================================================
-- 29. PRODUCTION SUBMISSION IMPROVEMENTS
-- Add share_url + admin review notification to script_productions
-- ============================================================

ALTER TABLE script_productions ADD COLUMN IF NOT EXISTS share_url TEXT;
ALTER TABLE script_productions ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE script_productions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE script_productions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id);

-- Notify admins when a production is submitted for review
CREATE OR REPLACE FUNCTION notify_on_production_submitted()
RETURNS TRIGGER AS $$
DECLARE
  v_post RECORD;
  v_submitter_name TEXT;
BEGIN
  SELECT id, title, slug, author_id INTO v_post FROM community_posts WHERE id = NEW.post_id;
  IF v_post IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_submitter_name
  FROM profiles WHERE id = NEW.submitter_id;

  -- Notify admin
  PERFORM create_notification(
    'f0e0c4a4-0833-4c64-b012-15829c087c77'::UUID,
    'production_submitted',
    v_submitter_name || ' submitted a film for "' || v_post.title || '"',
    NEW.title || ' — awaiting review',
    '/admin',
    NEW.submitter_id,
    'script_production',
    NEW.id,
    jsonb_build_object('post_id', v_post.id, 'post_title', v_post.title)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_production_submitted ON script_productions;
CREATE TRIGGER on_production_submitted
  AFTER INSERT ON script_productions
  FOR EACH ROW EXECUTE FUNCTION notify_on_production_submitted();

-- Notify submitter + original author when production is approved/rejected
CREATE OR REPLACE FUNCTION notify_on_production_reviewed()
RETURNS TRIGGER AS $$
DECLARE
  v_post RECORD;
  v_title TEXT;
  v_link TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;

  SELECT id, title, slug, author_id INTO v_post FROM community_posts WHERE id = NEW.post_id;
  IF v_post IS NULL THEN RETURN NEW; END IF;

  v_link := '/community/post/' || v_post.slug;

  IF NEW.status = 'approved' THEN
    -- Notify the submitter
    PERFORM create_notification(
      NEW.submitter_id,
      'production_approved',
      'Your film "' || NEW.title || '" has been approved! 🎉',
      'It is now visible on the community page.',
      v_link,
      NULL, 'script_production', NEW.id,
      jsonb_build_object('post_title', v_post.title)
    );

    -- Notify the original script author
    IF v_post.author_id IS DISTINCT FROM NEW.submitter_id THEN
      PERFORM create_notification(
        v_post.author_id,
        'production_approved',
        'Someone made a film from your script! 🎬',
        '"' || NEW.title || '" — a production of "' || v_post.title || '"',
        v_link,
        NEW.submitter_id, 'script_production', NEW.id,
        jsonb_build_object('post_title', v_post.title, 'film_title', NEW.title)
      );
    END IF;
  ELSE
    -- Notify submitter of rejection
    PERFORM create_notification(
      NEW.submitter_id,
      'production_rejected',
      'Your film "' || NEW.title || '" was not approved',
      COALESCE(NEW.review_notes, 'Contact the admin for more details.'),
      v_link,
      NULL, 'script_production', NEW.id,
      jsonb_build_object('post_title', v_post.title)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_production_reviewed ON script_productions;
CREATE TRIGGER on_production_reviewed
  AFTER UPDATE OF status ON script_productions
  FOR EACH ROW EXECUTE FUNCTION notify_on_production_reviewed();

-- ============================================================
-- 30. GENERAL CHAT FORUM
-- Real-time chat rooms with channels, for community discussion.
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '💬',
  color TEXT DEFAULT '#6366f1',
  is_default BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_author ON chat_messages(author_id);

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
GRANT ALL ON chat_channels TO authenticated, anon, service_role;
GRANT ALL ON chat_messages TO authenticated, anon, service_role;

-- Channels are public to read
DROP POLICY IF EXISTS "Chat channels are public" ON chat_channels;
CREATE POLICY "Chat channels are public" ON chat_channels FOR SELECT USING (true);

-- Admin can manage channels
DROP POLICY IF EXISTS "Admin manages channels" ON chat_channels;
CREATE POLICY "Admin manages channels" ON chat_channels
  FOR ALL USING (auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

-- Authenticated users can insert channels (for admin)
DROP POLICY IF EXISTS "Authenticated create channels" ON chat_channels;
CREATE POLICY "Authenticated create channels" ON chat_channels
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Messages readable by anyone authenticated
DROP POLICY IF EXISTS "Messages readable by authenticated" ON chat_messages;
CREATE POLICY "Messages readable by authenticated" ON chat_messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Authenticated users can post messages
DROP POLICY IF EXISTS "Users post messages" ON chat_messages;
CREATE POLICY "Users post messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Users can edit/delete own messages
DROP POLICY IF EXISTS "Users edit own messages" ON chat_messages;
CREATE POLICY "Users edit own messages" ON chat_messages
  FOR UPDATE USING (auth.uid() = author_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

DROP POLICY IF EXISTS "Users delete own messages" ON chat_messages;
CREATE POLICY "Users delete own messages" ON chat_messages
  FOR DELETE USING (auth.uid() = author_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

-- Realtime for chat
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default channels
INSERT INTO chat_channels (name, slug, description, icon, is_default, sort_order) VALUES
  ('General', 'general', 'General discussion about filmmaking and screenwriting', '💬', true, 0),
  ('Screenwriting', 'screenwriting', 'Tips, techniques, and discussions about the craft', '✍️', false, 1),
  ('Feedback', 'feedback', 'Share your work and get constructive feedback', '🎯', false, 2),
  ('Collaboration', 'collaboration', 'Find collaborators for your projects', '🤝', false, 3),
  ('Off-Topic', 'off-topic', 'Anything and everything else', '🌎', false, 4)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 31. ADDITIONAL NOTIFICATION TYPES
-- ============================================================

DO $$
BEGIN
  IF to_regtype('public.notification_type') IS NOT NULL THEN
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'production_submitted';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'production_approved';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'production_rejected';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'chat_mention';
  END IF;
END $$;

-- ============================================================
-- 32. BUDGET: ADD is_income COLUMN
-- ============================================================

ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS is_income BOOLEAN DEFAULT false;

-- ============================================================
-- 33. PRO USER SYSTEM
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_since TIMESTAMPTZ;

-- ============================================================
-- 34. PUSH NOTIFICATION SUBSCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- 35. SCENE-SCRIPT LINKING
-- ============================================================

ALTER TABLE scenes ADD COLUMN IF NOT EXISTS script_element_id UUID REFERENCES script_elements(id) ON DELETE SET NULL;

-- ============================================================
-- 36. CHARACTER RELATIONSHIP MIND MAP
-- ============================================================

CREATE TABLE IF NOT EXISTS mindmap_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  node_type TEXT NOT NULL DEFAULT 'character', -- character, group, note
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  width DOUBLE PRECISION NOT NULL DEFAULT 120,
  height DOUBLE PRECISION NOT NULL DEFAULT 60,
  color TEXT NOT NULL DEFAULT '#dd574e',
  shape TEXT NOT NULL DEFAULT 'rounded', -- rounded, circle, diamond, rectangle
  font_size INTEGER NOT NULL DEFAULT 14,
  image_url TEXT,
  notes TEXT,
  group_id UUID REFERENCES mindmap_nodes(id) ON DELETE SET NULL,
  is_locked BOOLEAN DEFAULT false,
  z_index INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mindmap_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
  label TEXT,
  color TEXT NOT NULL DEFAULT '#888888',
  line_style TEXT NOT NULL DEFAULT 'solid', -- solid, dashed, dotted
  thickness INTEGER NOT NULL DEFAULT 2,
  arrow_type TEXT NOT NULL DEFAULT 'none', -- none, forward, backward, both
  animated BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mindmap_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindmap_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view mindmap nodes" ON mindmap_nodes
  FOR SELECT USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
    UNION SELECT id FROM projects WHERE created_by = auth.uid()
  ));

CREATE POLICY "Members can manage mindmap nodes" ON mindmap_nodes
  FOR ALL USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    UNION SELECT id FROM projects WHERE created_by = auth.uid()
  ));

CREATE POLICY "Members can view mindmap edges" ON mindmap_edges
  FOR SELECT USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
    UNION SELECT id FROM projects WHERE created_by = auth.uid()
  ));

CREATE POLICY "Members can manage mindmap edges" ON mindmap_edges
  FOR ALL USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    UNION SELECT id FROM projects WHERE created_by = auth.uid()
  ));

-- ============================================================
-- 37. DIRECT MESSAGES & GROUP DMS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_type TEXT NOT NULL DEFAULT 'direct', -- direct, group
  name TEXT, -- null for direct, set for group
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- admin, member
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  is_muted BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text', -- text, image, file, system
  file_url TEXT,
  file_name TEXT,
  reply_to_id UUID REFERENCES direct_messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper: returns conversation IDs for the current user.
-- This breaks the infinite recursion that occurs when conversation_members
-- policies reference conversation_members in subqueries.
CREATE OR REPLACE FUNCTION get_my_conversation_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid();
$$;

-- Drop old self-referencing policies (idempotent)
DROP POLICY IF EXISTS "Members can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Admins can update conversations" ON conversations;
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Users can manage conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Members can view messages" ON direct_messages;
DROP POLICY IF EXISTS "Members can send messages" ON direct_messages;
DROP POLICY IF EXISTS "Senders can edit own messages" ON direct_messages;

-- Conversations policies (use helper function)
CREATE POLICY "Members can view their conversations" ON conversations
  FOR SELECT USING (
    id IN (SELECT get_my_conversation_ids())
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update conversations" ON conversations
  FOR UPDATE USING (
    id IN (SELECT get_my_conversation_ids())
    OR created_by = auth.uid()
  );

-- Conversation members policies (use helper function — no self-reference)
CREATE POLICY "Members can view conversation members" ON conversation_members
  FOR SELECT USING (conversation_id IN (SELECT get_my_conversation_ids()));

CREATE POLICY "Members can insert conversation members" ON conversation_members
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT get_my_conversation_ids()
    ) OR user_id = auth.uid()
    OR conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
  );

CREATE POLICY "Members can update own membership" ON conversation_members
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can delete conversation members" ON conversation_members
  FOR DELETE USING (
    conversation_id IN (
      SELECT cm.conversation_id FROM conversation_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'admin'
    ) OR user_id = auth.uid()
  );

-- Direct messages policies (use helper function)
CREATE POLICY "Members can view messages" ON direct_messages
  FOR SELECT USING (conversation_id IN (SELECT get_my_conversation_ids()));

CREATE POLICY "Members can send messages" ON direct_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (SELECT get_my_conversation_ids())
  );

CREATE POLICY "Senders can edit own messages" ON direct_messages
  FOR UPDATE USING (sender_id = auth.uid());

-- Grant access
GRANT ALL ON conversations TO authenticated, anon, service_role;
GRANT ALL ON conversation_members TO authenticated, anon, service_role;
GRANT ALL ON direct_messages TO authenticated, anon, service_role;

-- Realtime for DMs
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_members ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_last_msg ON conversations(last_message_at DESC);

-- ============================================================
-- 38. MOOD BOARD
-- ============================================================

CREATE TABLE IF NOT EXISTS mood_board_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'image', -- image, text, color, link, note
  title TEXT,
  content TEXT,
  image_url TEXT,
  link_url TEXT,
  color TEXT,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  width DOUBLE PRECISION NOT NULL DEFAULT 200,
  height DOUBLE PRECISION NOT NULL DEFAULT 200,
  rotation DOUBLE PRECISION DEFAULT 0,
  z_index INTEGER DEFAULT 0,
  opacity DOUBLE PRECISION DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  board_section TEXT DEFAULT 'general', -- general, characters, locations, atmosphere, costumes, props
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mood_board_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view mood board items" ON mood_board_items
  FOR SELECT USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
    UNION SELECT id FROM projects WHERE created_by = auth.uid()
  ));

CREATE POLICY "Members can manage mood board items" ON mood_board_items
  FOR ALL USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    UNION SELECT id FROM projects WHERE created_by = auth.uid()
  ));

-- ============================================================
-- 39. MOOD BOARD CONNECTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS mood_board_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_item_id UUID NOT NULL REFERENCES mood_board_items(id) ON DELETE CASCADE,
  target_item_id UUID NOT NULL REFERENCES mood_board_items(id) ON DELETE CASCADE,
  label TEXT,
  color TEXT NOT NULL DEFAULT '#888888',
  line_style TEXT NOT NULL DEFAULT 'solid' CHECK (line_style IN ('solid', 'dashed', 'dotted')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mood_board_connections_project ON mood_board_connections(project_id);
CREATE INDEX IF NOT EXISTS idx_mood_board_connections_source ON mood_board_connections(source_item_id);
CREATE INDEX IF NOT EXISTS idx_mood_board_connections_target ON mood_board_connections(target_item_id);

ALTER TABLE mood_board_connections ENABLE ROW LEVEL SECURITY;

GRANT ALL ON mood_board_connections TO authenticated, anon, service_role;

CREATE POLICY "Members can view mood board connections" ON mood_board_connections
  FOR SELECT USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
    UNION SELECT id FROM projects WHERE created_by = auth.uid()
  ));

CREATE POLICY "Members can manage mood board connections" ON mood_board_connections
  FOR ALL USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    UNION SELECT id FROM projects WHERE created_by = auth.uid()
  ));

-- ============================================================
-- 40. PROFILE ENHANCEMENTS — username, banner, social links,
--     headline, location, website, featured projects, etc.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS featured_project_ids UUID[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_theme TEXT DEFAULT 'default';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_projects BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_activity BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allow_dms BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0;

-- Index for fast username lookups (public profile pages)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;

-- RPC to increment profile views
CREATE OR REPLACE FUNCTION increment_profile_views(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET profile_views = COALESCE(profile_views, 0) + 1 WHERE id = p_user_id;
END;
$$;

-- ============================================================
-- 41. PROJECT CHANNELS & CHANNEL MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS project_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS channel_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES project_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text', -- text, system, image, file
  file_url TEXT,
  file_name TEXT,
  reply_to_id UUID REFERENCES channel_messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

-- Use existing is_project_member / has_project_access helpers from fix_rls_policies.sql
-- If those don't exist yet, create a lightweight version:
CREATE OR REPLACE FUNCTION public.is_project_member_lite(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND created_by = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_project_admin_lite(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND created_by = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Channels: any project member can view; owner/admin can create/update/delete
CREATE POLICY "Members can view channels" ON project_channels
  FOR SELECT USING (public.is_project_member_lite(project_id));

CREATE POLICY "Admins can create channels" ON project_channels
  FOR INSERT WITH CHECK (public.is_project_admin_lite(project_id));

CREATE POLICY "Admins can update channels" ON project_channels
  FOR UPDATE USING (public.is_project_admin_lite(project_id));

CREATE POLICY "Admins can delete channels" ON project_channels
  FOR DELETE USING (public.is_project_admin_lite(project_id));

-- Channel messages: any project member can read/write via channel's project_id
CREATE POLICY "Members can view channel messages" ON channel_messages
  FOR SELECT USING (
    channel_id IN (
      SELECT id FROM project_channels WHERE public.is_project_member_lite(project_id)
    )
  );

CREATE POLICY "Members can send channel messages" ON channel_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    channel_id IN (
      SELECT id FROM project_channels WHERE public.is_project_member_lite(project_id)
    )
  );

CREATE POLICY "Senders can edit channel messages" ON channel_messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Senders can delete channel messages" ON channel_messages
  FOR DELETE USING (sender_id = auth.uid());

GRANT ALL ON project_channels TO authenticated, anon, service_role;
GRANT ALL ON channel_messages TO authenticated, anon, service_role;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE channel_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_channel_project ON project_channels(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_channel_msgs ON channel_messages(channel_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Source: supabase/migration_v3.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Migration V3: Schema updates for recent features
-- Run after schema.sql + migration_v2.sql
-- ============================================================
-- Covers:
--   1. Convert scene_time enum → TEXT (fixes import of non-English time values like "KVELD")
--   2. Add production_role + character_name to project_members
--   3. Add wrap_url, is_showcased, showcase_description, showcase_script, showcase_mindmap, external_links to projects
--   4. Fix ideas.references_urls column name mismatch (rename to match TypeScript)
--   5. Add external_credits table for non-member crew crediting
-- ============================================================

BEGIN;

-- ============================================================
-- 1. SCENE TIME: Convert enum → TEXT
-- ============================================================
ALTER TABLE scenes
  ALTER COLUMN time_of_day DROP DEFAULT;

ALTER TABLE scenes
  ALTER COLUMN time_of_day TYPE TEXT USING time_of_day::TEXT;

ALTER TABLE scenes
  ALTER COLUMN time_of_day SET DEFAULT 'DAY';

DROP TYPE IF EXISTS scene_time;


-- ============================================================
-- 2. PROJECT MEMBERS: Add production_role + character_name
-- ============================================================
ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS production_role TEXT DEFAULT '';

ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS character_name TEXT;


-- ============================================================
-- 3. PROJECTS: Add wrap/showcase/deepdive/external link columns
-- ============================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS wrap_url TEXT;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_showcased BOOLEAN DEFAULT false;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS showcase_description TEXT;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS showcase_script BOOLEAN DEFAULT false;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS showcase_mindmap BOOLEAN DEFAULT false;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS external_links JSONB DEFAULT '{}';

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS language TEXT;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS production_trivia JSONB DEFAULT '[]';

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS showcase_moodboard BOOLEAN DEFAULT false;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS set_photos JSONB DEFAULT '[]';


-- ============================================================
-- 4. IDEAS: Fix column name mismatch
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ideas' AND column_name = 'references_urls'
  ) THEN
    ALTER TABLE ideas RENAME COLUMN references_urls TO "references";
  END IF;
END $$;


-- ============================================================
-- 5. EXTERNAL CREDITS: Non-member crew for crediting
-- ============================================================
CREATE TABLE IF NOT EXISTS external_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  production_role TEXT NOT NULL DEFAULT '',
  character_name TEXT,
  external_url TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE external_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "External credits follow project access"
  ON external_credits FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );


-- ============================================================
-- 7. SHOWCASE COMMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS showcase_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES showcase_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE showcase_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments on showcased projects
CREATE POLICY "Anyone can read showcase comments"
  ON showcase_comments FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE is_showcased = true)
  );

-- Authenticated users can insert comments
CREATE POLICY "Authenticated users can comment"
  ON showcase_comments FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND project_id IN (SELECT id FROM projects WHERE is_showcased = true)
  );

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON showcase_comments FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- 8. LANGUAGE FIELD ON COMMUNITY POSTS
-- ============================================================
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS language TEXT;


-- ============================================================
-- 9. SHOWCASE REVIEWS & RATINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS showcase_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

ALTER TABLE showcase_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews on showcased projects
CREATE POLICY "Anyone can read showcase reviews"
  ON showcase_reviews FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE is_showcased = true)
  );

-- Authenticated users can insert one review per project
CREATE POLICY "Authenticated users can review"
  ON showcase_reviews FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND project_id IN (SELECT id FROM projects WHERE is_showcased = true)
  );

-- Users can update their own review
CREATE POLICY "Users can update own review"
  ON showcase_reviews FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own review
CREATE POLICY "Users can delete own review"
  ON showcase_reviews FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- 10. SYSTEM ROLES: moderator / admin on profiles
-- ============================================================
-- The profiles.role column already exists as TEXT DEFAULT 'writer'.
-- We add a CHECK constraint for the allowed system roles.
-- 'writer' = normal user, 'moderator' = mod, 'admin' = admin

-- Clean up invalid role values before adding constraint
UPDATE profiles SET role = 'writer' WHERE role NOT IN ('writer', 'moderator', 'admin');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('writer', 'moderator', 'admin'));
  END IF;
END $$;

-- Helper function: is current user a moderator or admin?
CREATE OR REPLACE FUNCTION is_mod_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('moderator', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Update RLS: moderators & admins can delete showcase comments
DROP POLICY IF EXISTS "Users can delete own comments" ON showcase_comments;
CREATE POLICY "Users or mods can delete comments"
  ON showcase_comments FOR DELETE USING (
    auth.uid() = user_id OR is_mod_or_admin()
  );

-- Update RLS: moderators & admins can delete showcase reviews
DROP POLICY IF EXISTS "Users can delete own review" ON showcase_reviews;
CREATE POLICY "Users or mods can delete reviews"
  ON showcase_reviews FOR DELETE USING (
    auth.uid() = user_id OR is_mod_or_admin()
  );

-- Update RLS: moderators & admins can delete community posts
DROP POLICY IF EXISTS "Authors delete own posts" ON community_posts;
CREATE POLICY "Authors or mods can delete posts"
  ON community_posts FOR DELETE USING (
    auth.uid() = author_id OR is_mod_or_admin()
  );

-- Update RLS: moderators & admins can delete community comments
DROP POLICY IF EXISTS "Authors delete own comments" ON community_comments;
CREATE POLICY "Authors or mods can delete comments"
  ON community_comments FOR DELETE USING (
    auth.uid() = author_id OR is_mod_or_admin()
  );

-- Update RLS: moderators & admins can un-showcase projects
DROP POLICY IF EXISTS "Authors update own posts" ON community_posts;
CREATE POLICY "Authors or mods can update posts"
  ON community_posts FOR UPDATE USING (
    auth.uid() = author_id OR is_mod_or_admin()
  );


-- ============================================================
-- 11. SUPPORT TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  -- Optional reference to reported content
  reported_content_type TEXT,  -- 'post', 'comment', 'showcase', 'review', 'user'
  reported_content_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can see their own tickets; mods/admins see all
CREATE POLICY "Users see own tickets, mods see all"
  ON support_tickets FOR SELECT USING (
    auth.uid() = user_id OR is_mod_or_admin()
  );

-- Authenticated users can create tickets
CREATE POLICY "Authenticated users create tickets"
  ON support_tickets FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- Users can update own tickets (e.g. close); mods/admins can update any
CREATE POLICY "Users or mods update tickets"
  ON support_tickets FOR UPDATE USING (
    auth.uid() = user_id OR is_mod_or_admin()
  );

-- Only mods/admins can delete tickets
CREATE POLICY "Mods can delete tickets"
  ON support_tickets FOR DELETE USING (
    is_mod_or_admin()
  );


-- ============================================================
-- 12. TICKET MESSAGES (chat-like)
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- Ticket participants and mods can read messages
CREATE POLICY "Ticket participants read messages"
  ON ticket_messages FOR SELECT USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid())
    OR is_mod_or_admin()
  );

-- Authenticated users can add messages to their tickets; mods to any
CREATE POLICY "Users or mods add messages"
  ON ticket_messages FOR INSERT WITH CHECK (
    (auth.uid() = user_id AND ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid()))
    OR is_mod_or_admin()
  );


-- ============================================================
-- 13. MOD ACTIONS LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS mod_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mod_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,  -- 'delete_post', 'delete_comment', 'delete_review', 'remove_showcase', 'close_ticket', 'ban_user', etc.
  target_type TEXT,           -- 'post', 'comment', 'review', 'showcase', 'ticket', 'user'
  target_id TEXT,
  reason TEXT,
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mod_actions ENABLE ROW LEVEL SECURITY;

-- Only mods/admins can read and insert mod actions
CREATE POLICY "Mods read actions"
  ON mod_actions FOR SELECT USING (is_mod_or_admin());

CREATE POLICY "Mods insert actions"
  ON mod_actions FOR INSERT WITH CHECK (is_mod_or_admin());


-- ============================================================
-- 14. FIX POSTGREST JOINS: Add direct FK to profiles
-- ============================================================
-- PostgREST can't resolve `profiles(*)` joins when the only FK on
-- user_id points at auth.users(id). Adding a second FK that goes
-- directly to profiles(id) gives PostgREST the relationship it needs.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'showcase_comments_profile_fkey'
  ) THEN
    ALTER TABLE showcase_comments
      ADD CONSTRAINT showcase_comments_profile_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'showcase_reviews_profile_fkey'
  ) THEN
    ALTER TABLE showcase_reviews
      ADD CONSTRAINT showcase_reviews_profile_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'support_tickets_profile_fkey'
  ) THEN
    ALTER TABLE support_tickets
      ADD CONSTRAINT support_tickets_profile_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_messages_profile_fkey'
  ) THEN
    ALTER TABLE ticket_messages
      ADD CONSTRAINT ticket_messages_profile_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'mod_actions_profile_fkey'
  ) THEN
    ALTER TABLE mod_actions
      ADD CONSTRAINT mod_actions_profile_fkey
      FOREIGN KEY (mod_user_id) REFERENCES profiles(id);
  END IF;
END $$;


-- ============================================================
-- 15. SHOWCASE PUBLIC READ POLICIES
-- Showcased projects (is_showcased = true) and their related
-- data must be readable by any authenticated user, not just
-- the project owner / members.
-- ============================================================

-- Projects: allow SELECT when is_showcased = true
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'Showcased projects are public'
  ) THEN
    CREATE POLICY "Showcased projects are public"
      ON projects FOR SELECT USING (is_showcased = true);
  END IF;
END $$;

-- Characters: allow SELECT when the parent project is showcased
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'characters' AND policyname = 'Showcased project characters are public'
  ) THEN
    CREATE POLICY "Showcased project characters are public"
      ON characters FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE is_showcased = true)
      );
  END IF;
END $$;

-- Scenes: allow SELECT count for showcased projects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scenes' AND policyname = 'Showcased project scenes are public'
  ) THEN
    CREATE POLICY "Showcased project scenes are public"
      ON scenes FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE is_showcased = true)
      );
  END IF;
END $$;

-- Shots: allow SELECT count for showcased projects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shots' AND policyname = 'Showcased project shots are public'
  ) THEN
    CREATE POLICY "Showcased project shots are public"
      ON shots FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE is_showcased = true)
      );
  END IF;
END $$;

-- Project members: allow SELECT for showcased projects (team display)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'project_members' AND policyname = 'Showcased project members are public'
  ) THEN
    CREATE POLICY "Showcased project members are public"
      ON project_members FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE is_showcased = true)
      );
  END IF;
END $$;

-- External credits: allow SELECT for showcased projects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'external_credits' AND policyname = 'Showcased project credits are public'
  ) THEN
    CREATE POLICY "Showcased project credits are public"
      ON external_credits FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE is_showcased = true)
      );
  END IF;
END $$;


-- ============================================================
-- 16. PUSH NOTIFICATIONS: Server-side delivery via pg_net
-- When a notification row is inserted, this trigger fires an async
-- HTTP POST to the /api/push/send endpoint which delivers Web Push
-- payloads to the user's subscribed devices.
--
-- SETUP (run once in Supabase SQL editor after deploying the app):
--   INSERT INTO vault.secrets (name, secret) VALUES
--     ('push_api_url',    'https://YOUR-APP.vercel.app/api/push/send'),
--     ('push_api_secret', 'YOUR-PUSH-API-SECRET');
--
-- pg_net is included in Supabase by default.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS trigger AS $$
DECLARE
  _api_url TEXT;
  _api_secret TEXT;
BEGIN
  -- Read config from Supabase Vault (graceful failure if not set)
  BEGIN
    SELECT decrypted_secret INTO _api_url
      FROM vault.decrypted_secrets WHERE name = 'push_api_url' LIMIT 1;
    SELECT decrypted_secret INTO _api_secret
      FROM vault.decrypted_secrets WHERE name = 'push_api_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW; -- vault not available or secrets not set, skip push
  END;

  IF _api_url IS NULL OR _api_url = '' THEN
    RETURN NEW;
  END IF;

  -- Fire async HTTP POST via pg_net (non-blocking)
  PERFORM net.http_post(
    url    := _api_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', COALESCE(_api_secret, '')
    ),
    body   := jsonb_build_object(
      'user_id', NEW.user_id::text,
      'title',   COALESCE(NEW.title, 'Screenplay Studio'),
      'body',    COALESCE(NEW.body, ''),
      'url',     COALESCE(NEW.link, '/notifications')
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- NEVER block notification creation if push delivery fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create / replace the trigger (idempotent)
DROP TRIGGER IF EXISTS on_notification_push ON notifications;
CREATE TRIGGER on_notification_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_insert();


-- ============================================================
-- 17. SHOWCASE DEEP-DIVE PUBLIC READ POLICIES
-- Scripts, script_elements, mindmap, and moodboard data must be
-- publicly readable when the owning project is showcased AND the
-- respective deep-dive toggle is enabled.
-- ============================================================

-- scripts: SELECT when project is showcased + showcase_script = true
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scripts' AND policyname = 'Showcased project scripts are public'
  ) THEN
    CREATE POLICY "Showcased project scripts are public"
      ON scripts FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE is_showcased = true AND showcase_script = true)
      );
  END IF;
END $$;

-- script_elements: SELECT when script's project is showcased + script toggle on
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'script_elements' AND policyname = 'Showcased project script elements are public'
  ) THEN
    CREATE POLICY "Showcased project script elements are public"
      ON script_elements FOR SELECT USING (
        script_id IN (
          SELECT s.id FROM scripts s
          JOIN projects p ON s.project_id = p.id
          WHERE p.is_showcased = true AND p.showcase_script = true
        )
      );
  END IF;
END $$;

-- mindmap_nodes: SELECT when project is showcased + showcase_mindmap = true
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mindmap_nodes' AND policyname = 'Showcased project mindmap nodes are public'
  ) THEN
    CREATE POLICY "Showcased project mindmap nodes are public"
      ON mindmap_nodes FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE is_showcased = true AND showcase_mindmap = true)
      );
  END IF;
END $$;

-- mindmap_edges: SELECT when project is showcased + showcase_mindmap = true
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mindmap_edges' AND policyname = 'Showcased project mindmap edges are public'
  ) THEN
    CREATE POLICY "Showcased project mindmap edges are public"
      ON mindmap_edges FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE is_showcased = true AND showcase_mindmap = true)
      );
  END IF;
END $$;

-- mood_board_items: SELECT when project is showcased + showcase_moodboard = true
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mood_board_items' AND policyname = 'Showcased project moodboard items are public'
  ) THEN
    CREATE POLICY "Showcased project moodboard items are public"
      ON mood_board_items FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE is_showcased = true AND showcase_moodboard = true)
      );
  END IF;
END $$;

-- mood_board_connections: SELECT when project is showcased + showcase_moodboard = true
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mood_board_connections' AND policyname = 'Showcased project moodboard connections are public'
  ) THEN
    CREATE POLICY "Showcased project moodboard connections are public"
      ON mood_board_connections FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE is_showcased = true AND showcase_moodboard = true)
      );
  END IF;
END $$;


-- ============================================================
-- 18. STORYBOARD FRAMES TABLE
-- Dedicated table for storyboard frames with drawing data
-- and reference images, separate from the shots table.
-- ============================================================
CREATE TABLE IF NOT EXISTS storyboard_frames (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_id UUID REFERENCES shots(id) ON DELETE SET NULL,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  -- Drawing data: JSON for canvas strokes
  drawing_data JSONB DEFAULT '[]',
  -- Image: either an uploaded URL or a reference link
  image_url TEXT,
  -- Reference images: can be URLs or uploaded
  reference_images JSONB DEFAULT '[]',
  notes TEXT,
  duration_hint TEXT,
  camera_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE storyboard_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Storyboard frames follow project access"
  ON storyboard_frames FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );


-- ============================================================
-- 19. LOCATION MAP MARKERS TABLE
-- Map markers for locations with infrastructure data
-- ============================================================
CREATE TABLE IF NOT EXISTS location_markers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  marker_type TEXT NOT NULL DEFAULT 'location',
  -- Types: 'location', 'bus_stop', 'train_station', 'parking', 'base_camp', 'custom'
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  color TEXT DEFAULT '#dd574e',
  icon TEXT, -- optional icon name
  tags JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE location_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Location markers follow project access"
  ON location_markers FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 20. LOCATION ROUTES TABLE
-- Routes/paths for transport infrastructure
-- ============================================================
CREATE TABLE IF NOT EXISTS location_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  route_type TEXT NOT NULL DEFAULT 'custom',
  -- Types: 'bus', 'train', 'walking', 'driving', 'custom'
  color TEXT DEFAULT '#3b82f6',
  -- GeoJSON linestring coordinates [[lng, lat], ...]
  coordinates JSONB DEFAULT '[]',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE location_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Location routes follow project access"
  ON location_routes FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );


COMMIT;

-- ---------------------------------------------------------------------
-- Source: supabase/migration_versioning.sql
-- ---------------------------------------------------------------------
-- Migration: Versioned Story Editing
-- Adds metadata column to scripts table for storing per-script version config.
-- Run this in the Supabase SQL editor.

-- 1. Add metadata column to scripts (stores version config, etc.)
ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN scripts.metadata IS
  'Flexible per-script config. Currently used for:
   version_config: {
     disabled: string[]   -- version names currently toggled off
     showFaded: boolean   -- show disabled as faded instead of hidden
     known: string[]      -- explicitly created version names (may have sub-versions via "/" notation)
   }';

-- 2. Index for fast metadata lookups (GIN for JSONB)
CREATE INDEX IF NOT EXISTS idx_scripts_metadata
  ON scripts USING GIN (metadata);

-- ---------------------------------------------------------------------
-- Source: supabase/migration_work_tracking.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Screenplay Studio — Work Time Tracking Migration
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- Safe to re-run — uses IF NOT EXISTS / OR REPLACE throughout
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. work_sessions TABLE
--    One row per browser tab session per project.
--    duration_seconds accumulates via heartbeat API.
--    session_key is a client-generated UUID stored in
--    sessionStorage (cleared on tab close → new session each time).
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS work_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id          UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- context: 'script', 'documents', 'arc-planner', 'general', etc.
  context             TEXT        NOT NULL DEFAULT 'general',
  -- date the session started (UTC date, used for daily roll-ups)
  date                DATE        NOT NULL DEFAULT CURRENT_DATE,
  -- total seconds credited to this session (heartbeat-incremented)
  duration_seconds    INTEGER     NOT NULL DEFAULT 0,
  -- last time a heartbeat was received (for rate-limit / gap checks)
  last_heartbeat_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- idempotency key generated by the client (one per tab/page-load)
  session_key         TEXT        NOT NULL,
  CONSTRAINT uq_work_session UNIQUE (user_id, project_id, session_key)
);

COMMENT ON TABLE work_sessions IS
  'Tracks active work time per user per project, accumulated via 30-second heartbeats.
   Smart idle detection and thinking-grace credits are applied server-side.
   Each browser tab generates a unique session_key so simultaneous tabs are tracked separately.';

COMMENT ON COLUMN work_sessions.duration_seconds IS
  'Accumulated working seconds. Incremented 30s per heartbeat + optional grace (≤600s)
   for short breaks (5-20 min away). Capped server-side — cannot be manipulated client-side.';

COMMENT ON COLUMN work_sessions.session_key IS
  'UUID generated by the client on page load, stored in sessionStorage.
   Closes the exploit window of replaying old session_keys — each tab gets one.';


-- ──────────────────────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────

ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

-- Users can insert sessions for themselves only
DROP POLICY IF EXISTS "ws_insert_own" ON work_sessions;
CREATE POLICY "ws_insert_own" ON work_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own sessions only
DROP POLICY IF EXISTS "ws_update_own" ON work_sessions;
CREATE POLICY "ws_update_own" ON work_sessions
  FOR UPDATE
  USING (user_id = auth.uid());

-- Anyone on the project team can read work sessions for that project
-- (so project owners can see team hours)
DROP POLICY IF EXISTS "ws_select_project_member" ON work_sessions;
CREATE POLICY "ws_select_project_member" ON work_sessions
  FOR SELECT
  USING (
    project_id IN (
      -- project creator
      SELECT id FROM projects WHERE created_by = auth.uid()
      UNION
      -- project members
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own sessions (e.g. data export / GDPR)
DROP POLICY IF EXISTS "ws_delete_own" ON work_sessions;
CREATE POLICY "ws_delete_own" ON work_sessions
  FOR DELETE
  USING (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────────
-- 3. PERFORMANCE INDEXES
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_work_sessions_user_project
  ON work_sessions (user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_work_sessions_project_date
  ON work_sessions (project_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_work_sessions_session_key
  ON work_sessions (session_key);

CREATE INDEX IF NOT EXISTS idx_work_sessions_last_heartbeat
  ON work_sessions (last_heartbeat_at DESC);


-- ──────────────────────────────────────────────────────────────
-- 4. HELPER VIEWS (admin / analytics)
-- ──────────────────────────────────────────────────────────────

-- Daily work hours per user per project (last 90 days)
CREATE OR REPLACE VIEW work_hours_by_day AS
SELECT
  user_id,
  project_id,
  date,
  SUM(duration_seconds)                    AS total_seconds,
  ROUND(SUM(duration_seconds) / 3600.0, 2) AS hours
FROM work_sessions
WHERE date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY user_id, project_id, date
ORDER BY date DESC;

-- Total hours per user per project (all time)
CREATE OR REPLACE VIEW work_hours_by_user AS
SELECT
  user_id,
  project_id,
  SUM(duration_seconds)                    AS total_seconds,
  ROUND(SUM(duration_seconds) / 3600.0, 2) AS total_hours,
  MIN(date)                                AS first_session,
  MAX(date)                                AS last_session,
  COUNT(DISTINCT date)                     AS days_worked
FROM work_sessions
GROUP BY user_id, project_id
ORDER BY total_seconds DESC;

-- Context breakdown (how time is split between script editor, documents, etc.)
CREATE OR REPLACE VIEW work_hours_by_context AS
SELECT
  user_id,
  project_id,
  context,
  SUM(duration_seconds)                    AS total_seconds,
  ROUND(SUM(duration_seconds) / 3600.0, 2) AS hours
FROM work_sessions
GROUP BY user_id, project_id, context
ORDER BY total_seconds DESC;

-- Platform-wide work stats (for admin panel)
CREATE OR REPLACE VIEW admin_work_stats AS
SELECT
  p.id                                           AS project_id,
  p.title                                        AS project_title,
  COUNT(DISTINCT ws.user_id)                     AS contributors,
  COUNT(DISTINCT ws.id)                          AS total_sessions,
  SUM(ws.duration_seconds)                       AS total_seconds,
  ROUND(SUM(ws.duration_seconds) / 3600.0, 2)   AS total_hours,
  MAX(ws.last_heartbeat_at)                      AS last_activity
FROM projects p
LEFT JOIN work_sessions ws ON ws.project_id = p.id
GROUP BY p.id, p.title
ORDER BY total_seconds DESC NULLS LAST;

-- Grant read access to authenticated users (RLS on work_sessions
-- already limits what each user can see)
GRANT SELECT ON work_hours_by_day     TO authenticated;
GRANT SELECT ON work_hours_by_user    TO authenticated;
GRANT SELECT ON work_hours_by_context TO authenticated;
GRANT SELECT ON admin_work_stats      TO authenticated;


-- ──────────────────────────────────────────────────────────────
-- 5. CLEANUP FUNCTION
--    Remove stale sessions (last heartbeat > 24h ago and incomplete)
--    Call this periodically via pg_cron or a Supabase Edge Function.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_stale_work_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM work_sessions
  WHERE last_heartbeat_at < now() - INTERVAL '24 hours'
    AND duration_seconds < 60; -- sessions under 1 minute that went stale
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_stale_work_sessions() IS
  'Removes work sessions that are older than 24h and credited less than 60 seconds
   (i.e. the user opened a page then left immediately). Safe to call repeatedly.';


-- ──────────────────────────────────────────────────────────────
-- SUMMARY
-- ──────────────────────────────────────────────────────────────
--
-- NEW TABLE:    work_sessions
--   • Heartbeat-based time tracking, server-side accumulation
--   • Smart grace period for short breaks (5-20 min away → +50% of break, max 10 min)
--   • Anti-exploit: auth required, rate-limited server-side (≥20s between heartbeats),
--     grace capped at 600s, sessions keyed per tab via sessionStorage UUID
--   • RLS: users own their rows; project team can read project totals
--
-- NEW VIEWS:    work_hours_by_day, work_hours_by_user,
--               work_hours_by_context, admin_work_stats
--
-- NEW FUNCTION: cleanup_stale_work_sessions()
--
-- NEW INDEXES:  idx_work_sessions_user_project, idx_work_sessions_project_date,
--               idx_work_sessions_session_key, idx_work_sessions_last_heartbeat
-- ============================================================

\n-- Fix scripts

-- ---------------------------------------------------------------------
-- Source: supabase/fix_dm_rls.sql
-- ---------------------------------------------------------------------
-- Fix: infinite recursion in conversation_members RLS policies
-- Run this against your existing Supabase database.

-- 1. Create a SECURITY DEFINER helper that bypasses RLS
CREATE OR REPLACE FUNCTION get_my_conversation_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid();
$$;

-- 2. Drop ALL old policies on the three DM tables
DROP POLICY IF EXISTS "Members can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Admins can update conversations" ON conversations;
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Users can manage conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Members can insert conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Members can update own membership" ON conversation_members;
DROP POLICY IF EXISTS "Admins can delete conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Members can view messages" ON direct_messages;
DROP POLICY IF EXISTS "Members can send messages" ON direct_messages;
DROP POLICY IF EXISTS "Senders can edit own messages" ON direct_messages;

-- 3. Recreate policies using the helper function (no self-reference)

-- conversations
CREATE POLICY "Members can view their conversations" ON conversations
  FOR SELECT USING (
    id IN (SELECT get_my_conversation_ids())
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update conversations" ON conversations
  FOR UPDATE USING (
    id IN (SELECT get_my_conversation_ids())
    OR created_by = auth.uid()
  );

-- conversation_members
CREATE POLICY "Members can view conversation members" ON conversation_members
  FOR SELECT USING (conversation_id IN (SELECT get_my_conversation_ids()));

CREATE POLICY "Members can insert conversation members" ON conversation_members
  FOR INSERT WITH CHECK (
    conversation_id IN (SELECT get_my_conversation_ids())
    OR user_id = auth.uid()
    OR conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
  );

CREATE POLICY "Members can update own membership" ON conversation_members
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can delete conversation members" ON conversation_members
  FOR DELETE USING (
    conversation_id IN (SELECT get_my_conversation_ids())
    OR user_id = auth.uid()
  );

-- direct_messages
CREATE POLICY "Members can view messages" ON direct_messages
  FOR SELECT USING (conversation_id IN (SELECT get_my_conversation_ids()));

CREATE POLICY "Members can send messages" ON direct_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (SELECT get_my_conversation_ids())
  );

CREATE POLICY "Senders can edit own messages" ON direct_messages
  FOR UPDATE USING (sender_id = auth.uid());

-- 4. Grant access
GRANT ALL ON conversations TO authenticated, anon, service_role;
GRANT ALL ON conversation_members TO authenticated, anon, service_role;
GRANT ALL ON direct_messages TO authenticated, anon, service_role;

-- 5. Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- Source: supabase/fix_feedback_grants.sql
-- ---------------------------------------------------------------------
-- Fix: grant missing table-level permissions so anon + authenticated users
-- can actually submit feedback (RLS policy alone isn't enough in Supabase).

GRANT SELECT, INSERT                ON feedback_items         TO anon, authenticated;
GRANT SELECT, INSERT, DELETE        ON feedback_votes         TO anon, authenticated;
GRANT SELECT, INSERT, DELETE        ON feedback_comments      TO anon, authenticated;
GRANT SELECT                        ON feedback_similar_links TO anon, authenticated;
GRANT SELECT, INSERT, DELETE        ON feedback_subscriptions TO anon, authenticated;
GRANT SELECT                        ON public_testimonials    TO anon, authenticated;
GRANT SELECT                        ON public_roadmap         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION find_similar_feedback(TEXT,TEXT,TEXT,INT) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- Source: supabase/fix_feedback_rls_complete.sql
-- ---------------------------------------------------------------------
-- Comprehensive fix for "row violates RLS" on feedback_items insert.
-- Safe to run multiple times. Covers missing policies AND missing grants.

-- 1. Make sure RLS is on
ALTER TABLE feedback_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_votes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;

-- 2. Nuke and recreate every policy on feedback_items
DROP POLICY IF EXISTS "feedback_items_select_public"  ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_insert"         ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_update_own"     ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_admin"          ON feedback_items;
DROP POLICY IF EXISTS "feedback_items_update_admin"   ON feedback_items;

-- Anyone (anon or authenticated) can read public items
CREATE POLICY "feedback_items_select_public" ON feedback_items
  FOR SELECT USING (
    is_public = true
    OR user_id = auth.uid()
    OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
  );

-- Anyone can INSERT — no conditions at all
CREATE POLICY "feedback_items_insert" ON feedback_items
  FOR INSERT WITH CHECK (true);

-- Owner or admin can update
CREATE POLICY "feedback_items_update_own" ON feedback_items
  FOR UPDATE USING (
    user_id = auth.uid()
    OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
  );

-- Admin can delete
CREATE POLICY "feedback_items_admin" ON feedback_items
  FOR DELETE USING (
    auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
  );

-- 3. Nuke and recreate feedback_votes policies
DROP POLICY IF EXISTS "feedback_votes_select" ON feedback_votes;
DROP POLICY IF EXISTS "feedback_votes_insert" ON feedback_votes;
DROP POLICY IF EXISTS "feedback_votes_delete" ON feedback_votes;

CREATE POLICY "feedback_votes_select" ON feedback_votes FOR SELECT USING (true);
CREATE POLICY "feedback_votes_insert" ON feedback_votes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND fingerprint IS NOT NULL)
  );
CREATE POLICY "feedback_votes_delete" ON feedback_votes FOR DELETE
  USING (
    user_id = auth.uid()
    OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
  );

-- 4. Nuke and recreate feedback_comments policies
DROP POLICY IF EXISTS "feedback_comments_select" ON feedback_comments;
DROP POLICY IF EXISTS "feedback_comments_insert" ON feedback_comments;
DROP POLICY IF EXISTS "feedback_comments_delete" ON feedback_comments;

CREATE POLICY "feedback_comments_select" ON feedback_comments FOR SELECT
  USING (is_public = true OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77');

CREATE POLICY "feedback_comments_insert" ON feedback_comments FOR INSERT
  WITH CHECK (
    auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
    OR (
      auth.uid() IS NOT NULL
      AND auth.uid() = author_id
      AND comment_type = 'note'
      AND is_public = true
      AND (SELECT type FROM feedback_items WHERE id = item_id) <> 'testimonial'
    )
  );

CREATE POLICY "feedback_comments_delete" ON feedback_comments FOR DELETE
  USING (
    author_id = auth.uid()
    OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'
  );

-- 5. Table-level grants (required as well as RLS policies)
GRANT SELECT, INSERT         ON feedback_items         TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON feedback_votes         TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON feedback_comments      TO anon, authenticated;
GRANT SELECT                 ON feedback_similar_links TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON feedback_subscriptions TO anon, authenticated;
GRANT SELECT                 ON public_testimonials    TO anon, authenticated;
GRANT SELECT                 ON public_roadmap         TO anon, authenticated;

-- ---------------------------------------------------------------------
-- Source: supabase/fix_rls_policies.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- FIX: Infinite recursion in RLS policies for ALL tables
--
-- The problem: Every table's RLS policy references project_members,
-- whose own SELECT policy references project_members again → loop.
--
-- The fix: SECURITY DEFINER helper functions that bypass RLS.
-- Run this entire file in the Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- STEP 1: Create helper functions (bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_project_access(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND created_by = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_project_write_access(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND created_by = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
    AND role IN ('owner', 'admin', 'writer', 'editor')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_project_owner_or_admin(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND created_by = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_script_access(p_script_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.scripts s
    JOIN public.projects p ON s.project_id = p.id
    WHERE s.id = p_script_id AND p.created_by = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.scripts s
    JOIN public.project_members pm ON s.project_id = pm.project_id
    WHERE s.id = p_script_id AND pm.user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- STEP 2: Drop ALL existing policies
-- ============================================================

-- projects
DROP POLICY IF EXISTS "Project members can view projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
DROP POLICY IF EXISTS "Project owners and admins can update projects" ON projects;
DROP POLICY IF EXISTS "Project owners can delete projects" ON projects;

-- project_members
DROP POLICY IF EXISTS "Project members can view other members" ON project_members;
DROP POLICY IF EXISTS "Project owners and admins can manage members" ON project_members;
DROP POLICY IF EXISTS "Project owners and admins can update members" ON project_members;
DROP POLICY IF EXISTS "Project owners and admins can remove members" ON project_members;

-- scripts
DROP POLICY IF EXISTS "Script access follows project access" ON scripts;
DROP POLICY IF EXISTS "Writers can create scripts" ON scripts;
DROP POLICY IF EXISTS "Writers can update scripts" ON scripts;
DROP POLICY IF EXISTS "Owners can delete scripts" ON scripts;

-- script_elements
DROP POLICY IF EXISTS "Script elements follow script access" ON script_elements;
DROP POLICY IF EXISTS "Writers can insert elements" ON script_elements;
DROP POLICY IF EXISTS "Writers can update elements" ON script_elements;
DROP POLICY IF EXISTS "Writers can delete elements" ON script_elements;

-- characters
DROP POLICY IF EXISTS "Characters follow project access" ON characters;

-- locations
DROP POLICY IF EXISTS "Locations follow project access" ON locations;

-- scenes
DROP POLICY IF EXISTS "Scenes follow project access" ON scenes;

-- shots
DROP POLICY IF EXISTS "Shots follow project access" ON shots;

-- production_schedule
DROP POLICY IF EXISTS "Schedule follows project access" ON production_schedule;

-- ideas
DROP POLICY IF EXISTS "Ideas follow project access" ON ideas;

-- budget_items
DROP POLICY IF EXISTS "Budget follows project access" ON budget_items;

-- comments
DROP POLICY IF EXISTS "Comments follow project access" ON comments;

-- revisions
DROP POLICY IF EXISTS "Revisions follow script access" ON revisions;

-- user_presence
DROP POLICY IF EXISTS "Presence follows project access" ON user_presence;

-- ============================================================
-- STEP 3: Recreate ALL policies using helper functions
-- ============================================================

-- ---- PROJECTS ----
CREATE POLICY "Project members can view projects"
  ON projects FOR SELECT USING (
    created_by = auth.uid()
    OR public.is_project_member(id, auth.uid())
  );

CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project owners and admins can update projects"
  ON projects FOR UPDATE USING (
    public.is_project_owner_or_admin(id, auth.uid())
  );

CREATE POLICY "Project owners can delete projects"
  ON projects FOR DELETE USING (created_by = auth.uid());

-- ---- PROJECT MEMBERS ----
CREATE POLICY "Project members can view other members"
  ON project_members FOR SELECT USING (
    user_id = auth.uid()
    OR public.has_project_access(project_id, auth.uid())
  );

CREATE POLICY "Project owners and admins can manage members"
  ON project_members FOR INSERT WITH CHECK (
    public.is_project_owner_or_admin(project_id, auth.uid())
  );

CREATE POLICY "Project owners and admins can update members"
  ON project_members FOR UPDATE USING (
    public.is_project_owner_or_admin(project_id, auth.uid())
  );

CREATE POLICY "Project owners and admins can remove members"
  ON project_members FOR DELETE USING (
    user_id = auth.uid()
    OR public.is_project_owner_or_admin(project_id, auth.uid())
  );

-- ---- SCRIPTS ----
CREATE POLICY "Script access follows project access"
  ON scripts FOR SELECT USING (
    public.has_project_access(project_id, auth.uid())
  );

CREATE POLICY "Writers can create scripts"
  ON scripts FOR INSERT WITH CHECK (
    public.has_project_write_access(project_id, auth.uid())
  );

CREATE POLICY "Writers can update scripts"
  ON scripts FOR UPDATE USING (
    public.has_project_write_access(project_id, auth.uid())
  );

CREATE POLICY "Owners can delete scripts"
  ON scripts FOR DELETE USING (
    public.is_project_owner_or_admin(project_id, auth.uid())
  );

-- ---- SCRIPT ELEMENTS ----
CREATE POLICY "Script elements follow script access"
  ON script_elements FOR SELECT USING (
    public.has_script_access(script_id, auth.uid())
  );

CREATE POLICY "Writers can insert elements"
  ON script_elements FOR INSERT WITH CHECK (
    public.has_script_access(script_id, auth.uid())
  );

CREATE POLICY "Writers can update elements"
  ON script_elements FOR UPDATE USING (
    public.has_script_access(script_id, auth.uid())
  );

CREATE POLICY "Writers can delete elements"
  ON script_elements FOR DELETE USING (
    public.has_script_access(script_id, auth.uid())
  );

-- ---- CHARACTERS ----
CREATE POLICY "Characters follow project access"
  ON characters FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- LOCATIONS ----
CREATE POLICY "Locations follow project access"
  ON locations FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- SCENES ----
CREATE POLICY "Scenes follow project access"
  ON scenes FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- SHOTS ----
CREATE POLICY "Shots follow project access"
  ON shots FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- SCHEDULE ----
CREATE POLICY "Schedule follows project access"
  ON production_schedule FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- IDEAS ----
CREATE POLICY "Ideas follow project access"
  ON ideas FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- BUDGET ----
CREATE POLICY "Budget follows project access"
  ON budget_items FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- COMMENTS ----
CREATE POLICY "Comments follow project access"
  ON comments FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- ---- REVISIONS ----
CREATE POLICY "Revisions follow script access"
  ON revisions FOR ALL USING (
    public.has_script_access(script_id, auth.uid())
  );

-- ---- PRESENCE ----
CREATE POLICY "Presence follows project access"
  ON user_presence FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

\n-- Changelogs and blog updates

-- ---------------------------------------------------------------------
-- Source: supabase/blog_character_visual_references.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Blog Post: Why We Use Image Links Instead of Uploads
-- ============================================================

INSERT INTO blog_posts (
  slug,
  title,
  excerpt,
  sections,
  tags,
  status,
  published_at,
  author_id,
  allow_comments
)
VALUES (
  'why-we-use-image-links',
  'Why We Use Image Links for Character References (For Now)',
  'When we built the character visual profile system, we made a deliberate choice to use image links instead of file uploads. Here''s the honest reason why — and what we''re planning.',
  $sections$
  [
    {
      "order": 1,
      "heading": "What changed",
      "body": "We recently launched character visual profiles — a way to attach inspiration images, actor reference photos, and versioned production folders (makeup, costume, etc.) directly to your characters in Screenplay Studio.\n\nIf you've used it, you may have noticed that instead of uploading images directly, you paste a URL link to an image hosted somewhere else — your mood board, a Google Drive share, an IMDB page, a Pinterest pin, whatever you have."
    },
    {
      "order": 2,
      "heading": "The honest reason",
      "body": "Storage costs money. Not a lot per image — but a lot when multiplied across thousands of projects and characters with dozens of reference photos each.\n\nRight now, Screenplay Studio is indie-built and self-funded. We're not backed by a VC fund with $40 million to burn on S3 buckets. We're built carefully, sustainably, and with real cost discipline.\n\nAdding file upload infrastructure means: object storage billing, CDN costs, bandwidth charges, image processing (compression, resizing), abuse prevention, and storage quotas management. That's a non-trivial engineering and infrastructure commitment that we're not ready to take on at this stage without pricing it properly for users."
    },
    {
      "order": 3,
      "heading": "Why links actually work well",
      "body": "The good news is: links are genuinely practical for this use case.\n\nMost reference images already live on the web. Film stills, actor headshots, makeup references, runway photos, Pinterest boards — they're all URL-accessible. You don't need to download and re-upload something that already has a stable link.\n\nFor your own original references — production photos, custom character designs, concept art — you can host them for free on services like Google Drive (set to public link), Dropbox, Imgur, or any image hosting site, then paste the link here.\n\nWe do try to render images directly in the panel when the URL is a direct image link (ending in .jpg, .png, etc.). If it's a page URL rather than a direct image, we show the link with a fallback placeholder."
    },
    {
      "order": 4,
      "heading": "What we're planning",
      "body": "We're not abandoning uploads — we're timing them right.\n\nOnce we introduce proper subscription tiers, we'll include storage as part of Pro plans: direct image uploads with a guaranteed storage quota, CDN-delivered thumbnails, and no dependency on external links staying alive.\n\nUntil then, link-based references are the honest, practical, and honest-about-its-constraints solution. We'd rather ship a useful feature now and be transparent about the tradeoff than either not ship it, or quietly introduce hidden costs we can't sustain."
    },
    {
      "order": 5,
      "heading": "A note on link permanence",
      "body": "One real downside of links: they can break. If the site you linked to goes down, or you lose access to a shared Google Drive folder, your references disappear.\n\nFor now, our recommendation is to use stable image hosts (Imgur, Cloudinary free tier, or your own domain) for anything you really care about long-term. We will add a warning indicator when an image URL can no longer be resolved — that's on the roadmap.\n\nThanks for building with us. This kind of iterative, honest ship is how we operate."
    }
  ]
  $sections$,
  ARRAY['features', 'transparency', 'characters', 'visual-references'],
  'published',
  NOW(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid,
  true
)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      sections = EXCLUDED.sections,
      tags = EXCLUDED.tags,
      status = EXCLUDED.status,
      published_at = COALESCE(blog_posts.published_at, EXCLUDED.published_at),
      updated_at = NOW();

-- ---------------------------------------------------------------------
-- Source: supabase/blog_content_safety_transparency.sql
-- ---------------------------------------------------------------------
-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Blog Post: Content Safety & User Privacy Commitment      ║
-- ║  + Security Advisory: Moderation System Transparency      ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════
-- 1) DEV BLOG POST — Content Safety & Privacy
-- ═══════════════════════════════════════════════════════════════
INSERT INTO blog_posts (
  slug, title, excerpt, cover_image_url, sections, tags,
  status, published_at, author_id, allow_comments
)
VALUES (
  'content-safety-and-user-privacy',
  'Content Safety & User Privacy: How We Protect Both',
  'A transparent look at our new content moderation system — what it does, what it doesn''t, and why your scripts and conversations remain yours.',
  NULL,
  $sections$
[
  {
    "order": 1,
    "heading": "Your Work Is Yours — Full Stop",
    "body": "Let's get the most important thing out of the way first: **we cannot and do not read your scripts, screenplays, treatments, or any other creative content.** Period.\n\nScreenplay Studio was built by a writer, for writers. The idea that someone could be looking over your shoulder while you write is antithetical to everything this platform stands for. Your projects, your scripts, your notes, your ideas — they are private. They belong to you. No one on our team has access to them, and that is by design.\n\nThis hasn't changed. It will never change."
  },
  {
    "order": 2,
    "heading": "So What Did Change?",
    "body": "We've introduced an automated content safety system that scans for a very specific and narrow set of terms — terms exclusively associated with child sexual abuse material (CSAM), child exploitation, and trafficking.\n\nThis system exists for one reason: **legal and moral obligation.** Every platform that allows user-generated content has a duty to prevent the distribution of material that exploits children. This is non-negotiable, and it's the law in virtually every jurisdiction we operate in.\n\nHere's exactly what the system does:\n\n- It checks text content against a fixed list of terms that are unambiguously tied to CSAM and child exploitation\n- If — and only if — a match is found, a flag is created for admin review\n- The flag contains only the matched term(s) and a short snippet of surrounding context — not your entire script, not your whole document, not your project\n- No content is read, opened, or accessed by any human unless a flag is triggered\n\nThat's it. No AI reading your scripts. No keyword surveillance for profanity, violence, or mature themes. No monitoring of your creative choices. Just a targeted safety net for the worst possible content."
  },
  {
    "order": 3,
    "heading": "What About Legitimate Creative Work?",
    "body": "We understand that screenwriting often engages with difficult, dark, and uncomfortable subject matter. A documentary about human trafficking. A crime thriller that depicts exploitation. A social commentary that confronts abuse. These are important stories, and we have no interest in censoring them.\n\nOur system is designed with this in mind:\n\n- **The term list is narrow and specific.** It does not flag words like \"child,\" \"abuse,\" or \"violence\" on their own. It targets compound phrases and known coded language that have no legitimate creative application.\n- **Flags are reviewed by a human before any action.** If a flag is triggered, an admin reviews the context. A documentary script about trafficking is obviously different from someone uploading illegal content — and we treat it that way.\n- **We ask before we act.** If there's any ambiguity, we will send you a direct message asking for context before taking any action. We don't delete first and ask questions later.\n- **You can explain, and we will listen.** If your work is flagged and you're working on legitimate creative content, just let us know. We'll mark it as a false positive and move on. No penalty, no mark on your account, no judgment.\n\nThe goal is to catch the 0.001% of bad actors without disrupting the 99.999% of writers doing legitimate work."
  },
  {
    "order": 4,
    "heading": "What We Cannot Access",
    "body": "Let's be specific about what the admin team **cannot** do:\n\n- ❌ **Open or read your scripts** — We have no access to your screenplay content unless a specific safety flag is triggered, and even then we only see a short snippet around the flagged term\n- ❌ **Browse your projects** — The admin project list shows titles and metadata (format, status, member count) for platform management. We cannot open, edit, or view anything inside your projects\n- ❌ **Read your conversations** — We have zero access to your DMs or project chat messages. We cannot open your conversations, scroll through your history, or read your messages\n- ❌ **Access your documents, notes, or ideas** — Your creative workspace is private\n- ❌ **See who you collaborate with** — Project membership details are your business\n\nThe only scenario where we see any content is when the automated system flags a specific term. And even then, we see exactly one snippet — not the rest of your work."
  },
  {
    "order": 5,
    "heading": "What About Chat and DMs?",
    "body": "Direct messages and project chat follow the same principle, with an even higher standard of privacy.\n\n**We cannot access your conversations.** We don't have a \"read all DMs\" button. We can't browse chat history. Your private conversations are exactly that — private.\n\nIf the automated system detects a flagged term in a message, here's what happens:\n\n1. The system records that one specific message — not the conversation, not the history, just the single message that triggered the flag\n2. An admin reviews the flag and sees only that message snippet\n3. If context is needed, we'll **send you a DM** to ask about it — we don't go digging through your other messages\n4. If it's a false positive (which we expect most flags to be), we dismiss it immediately\n\nThis is a system built on trust, and trust goes both ways. We trust that the vast majority of our users are here to write and collaborate. In return, we ask that you trust that we're not interested in snooping — we're interested in keeping the platform safe for everyone."
  },
  {
    "order": 6,
    "heading": "Enforcement Actions",
    "body": "When a genuine violation is confirmed — after human review, after asking for context when appropriate — we have a graduated enforcement system:\n\n1. **Warning** — A notification explaining what was found and asking you to review the community guidelines\n2. **Temporary Suspension** — For repeated or serious violations, with a clear end date\n3. **Permanent Ban** — Reserved for the most severe cases, particularly confirmed CSAM distribution\n\nEvery enforcement action comes with:\n- A System DM explaining exactly what happened and why\n- The specific reason for the action\n- Instructions for how to appeal if you believe the action was taken in error\n- A direct email address to reach us\n\nWe don't do silent bans. We don't do unexplained removals. If we take action on your account, you will know exactly why."
  },
  {
    "order": 7,
    "heading": "The Appeal Process",
    "body": "If you receive a warning, suspension, or ban that you believe is unjust:\n\n1. Check the System DM in your messages for the specific reason\n2. Email **sondre@northem.no** with your account email and your explanation\n3. We'll review the case personally and respond within 48 hours\n\nAppeals are reviewed by a real person, not an algorithm. If we got it wrong, we'll say so and restore your account immediately."
  },
  {
    "order": 8,
    "heading": "Why Transparency Matters",
    "body": "We could have deployed this system silently. Many platforms do. But that's not how we want to operate.\n\nYou deserve to know exactly what systems are running on a platform where you store your creative work. You deserve to know what we can and cannot see. You deserve to know that your privacy is a feature, not an afterthought.\n\nScreenplay Studio is a small platform built by people who care about both safety and privacy. We believe you can have both, and this system is our attempt to prove it.\n\nIf you have any questions about this system, how it works, or how your data is handled, reach out to **sondre@northem.no**. We'll answer honestly."
  }
]
$sections$,
  ARRAY['privacy', 'safety', 'transparency', 'moderation', 'trust'],
  'published',
  NOW(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  sections = EXCLUDED.sections,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  updated_at = NOW();


-- ═══════════════════════════════════════════════════════════════
-- 2) LEGAL/SECURITY POST — Moderation System Security Advisory
-- ═══════════════════════════════════════════════════════════════
INSERT INTO legal_posts (
  slug, title, summary, content, category, severity,
  published, published_at, author_id, notify_users, tags
)
VALUES (
  'content-moderation-system-transparency-2026',
  'Security Update: Content Moderation & Safety System',
  'Details on our new automated content safety system, what data it accesses, how enforcement works, and your privacy protections.',
  $content$
## Overview

Screenplay Studio has implemented an automated content safety system designed to detect and prevent the distribution of child sexual abuse material (CSAM) and related exploitation content on our platform. This document describes what the system does, what it accesses, and what protections are in place for your privacy.

## What the System Monitors

The system scans user-generated text content against a fixed, narrow list of terms exclusively associated with CSAM, child exploitation, and child trafficking. The term list does not include general profanity, violence, mature themes, or any language commonly used in legitimate creative writing.

Content types subject to scanning:
- Script elements (dialogue, action lines, scene headings)
- Story ideas and brainstorming notes
- Project documents
- Scene descriptions and character backstories
- Project chat messages
- Direct messages

## What the System Does NOT Do

- It does not use artificial intelligence or machine learning to analyze your writing
- It does not flag profanity, violence, sexual content, or any other mature themes
- It does not provide any human with access to your full scripts, projects, or conversations
- It does not scan images, audio, or video content
- It does not share any data with third parties, law enforcement, or external services unless required by law

## Access Controls

**Admin access to projects**: Platform administrators can see project titles, formats, and membership counts in the admin panel for operational purposes. Administrators **cannot** open, read, edit, or access the contents of any project they are not a member of.

**Admin access to scripts**: Administrators have **no access** to script content. The only exception is when the automated system flags a specific term — in which case the administrator sees only a short text snippet (approximately 100 characters) surrounding the flagged term, not the full script.

**Admin access to conversations**: Administrators have **no access** to direct messages or project chat history. If a message triggers an automated flag, the administrator sees only that single message. They cannot view the rest of the conversation, scroll through message history, or access any other messages in the thread.

## How Flags Are Handled

1. The automated system detects a matching term and creates a flag
2. The flag contains: the content type, the matched term(s), and a short snippet of surrounding context
3. An administrator reviews the flag
4. If the content appears to be legitimate creative work (e.g., a documentary script, a crime thriller, social commentary), the flag is dismissed as a false positive — no action is taken
5. If context is ambiguous, the administrator will **send you a direct message** asking for clarification before taking any action
6. Only confirmed violations result in enforcement action

## Legitimate Creative Use

We recognize that screenwriting frequently addresses difficult subjects including abuse, exploitation, and violence. Our system is intentionally designed to avoid interfering with legitimate creative work:

- General terms like "child," "abuse," or "violence" do **not** trigger flags on their own
- The detection list targets only compound phrases and known coded language with no legitimate creative application
- Every flag is reviewed by a human who understands the difference between depicting a subject and promoting it
- Ambiguous cases are always resolved in favor of the creator — we ask first, act second
- False positives are dismissed with no record on your account

## Enforcement & Notification

All enforcement actions are communicated via an in-platform System DM that includes:
- The specific reason for the action
- What content was flagged
- The moderator's notes
- Instructions for appeal

Enforcement tiers:
- **Warning** — Informational notice, no access restrictions
- **Temporary Suspension** — Time-limited restriction with a clear expiration date; access is automatically restored when the suspension expires
- **Permanent Ban** — Reserved for confirmed distribution of illegal content; includes IP-based access restriction

## Appeals

Any enforcement action can be appealed by emailing **sondre@northem.no**. Appeals are reviewed personally and responded to within 48 hours. If a mistake was made, the action will be reversed immediately and no record will be retained against the account.

## IP-Based Enforcement

For permanent bans related to confirmed illegal content, the user's IP address is recorded to prevent re-registration. This data is stored securely and is only used for ban enforcement purposes. IP data is not shared, sold, or used for any other purpose.

## Data Retention

- Content flags are retained for the duration required by applicable law
- Evidence snapshots (preserved copies of flagged content) are stored in a tamper-proof, append-only table. They cannot be modified or deleted by any user, including administrators
- Evidence integrity is verified using SHA-256 content hashing
- IP ban records are retained only while the ban is active

## Your Rights

You have the right to:
- Know what data we collect about you (see our Privacy Policy)
- Request a copy of any moderation flags associated with your account
- Appeal any enforcement action taken against your account
- Contact us at **sondre@northem.no** with questions about this system

## Changes to This Policy

This document will be updated whenever material changes are made to the content moderation system. All changes will be communicated via the legal blog and platform notifications.

*Last updated: March 2026*
$content$,
  'security_advisory',
  'important',
  true,
  NOW(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77',
  true,
  ARRAY['security', 'privacy', 'moderation', 'csam', 'transparency', 'trust-and-safety']
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  category = EXCLUDED.category,
  severity = EXCLUDED.severity,
  published = EXCLUDED.published,
  updated_at = NOW();

-- ---------------------------------------------------------------------
-- Source: supabase/blog_idea_boards_launch.sql
-- ---------------------------------------------------------------------
-- ============================================================
--  BLOG POST: Idea Boards Launch
--  Run in: Supabase Dashboard > SQL Editor
-- ============================================================

INSERT INTO blog_posts (
  slug,
  title,
  excerpt,
  cover_image_url,
  sections,
  tags,
  status,
  published_at,
  author_id,
  allow_comments
)
VALUES (
  'idea-boards-your-brain-has-a-new-home',

  'Idea Boards: Your Brain Has a New Home (And It Has Folders)',

  'We built a place to dump every half-baked idea, midnight thought, and unhinged creative tangent you''ve ever had. It''s called Idea Boards. It has progress bars. It has folders. It has bold text. You''re welcome.',

  NULL,

  $sections$
[
  {
    "order": 1,
    "heading": "The Problem: Your Ideas Live Everywhere and Die Nowhere",
    "body": "You know the drill. Great idea hits at 2am. You write it in your phone notes app. Then you email it to yourself. Then you forget which email client. Then you find it six months later sandwiched between a grocery list and a screenshot of someone's tweet about screenwriting.\n\nWe've all been there. It's a disaster. Your best ideas are scattered across seventeen apps, three notebooks, two sticky notes on your monitor, and one voice memo you'll never transcribe.\n\nSo we built Idea Boards. A single place, inside the platform you're already using, where ideas can actually live and be found again."
  },
  {
    "order": 2,
    "heading": "What Even Is an Idea Board",
    "body": "An Idea Board is basically a document that doesn't judge you. You pick an emoji (🎬, 🧠, 🔥 — whatever matches your vibe), a colour, and a name. Then you start adding blocks.\n\nBlocks are the things that make up a board. Here's what you've got:\n\n— Heading: Big bold text. For when you have a Section Title and you want everyone (including future you) to know it's A Section Title.\n— Text: Just words. Prose. Rambling. Thoughts. The good stuff.\n— Checklist: A to-do item with a checkbox. Satisfying to tick. Unsatisfying when you have thirty of them.\n— Divider: A horizontal line to separate your chaos into smaller, more dignified chaos.\n— Project Link: Pin a project right inside the board. Because sometimes an idea is literally 'go work on this thing.'\n\nBoards are outside of projects — they're yours globally, not tied to any one film or series. Though you CAN link a board to a project if you want to keep that rope tight."
  },
  {
    "order": 3,
    "heading": "Typing Actually Works Like You'd Expect (Miracle, We Know)",
    "body": "Here's what the typing experience looks like now:\n\nYou press Enter at the end of a heading → you get a text block. Sensible.\nYou press Enter on a checklist item → you get another checklist item. Also sensible.\nYou press Enter on an empty checklist → you escape to a text block. EXTREMELY sensible. Double-enter gets you out of list mode like every other editor that isn't a nightmare.\nYou press Backspace on an empty block → it deletes itself. No orphan empty blocks sitting there mocking you.\nYou press Tab → the block cycles type. Heading becomes text, text becomes checklist, checklist becomes heading. Keep pressing until you get what you want.\n\nThis is not revolutionary. This is just how it should've always worked. But it didn't. Now it does. We're proud of ourselves for this one."
  },
  {
    "order": 4,
    "heading": "Bold, Italic, Underline — Yes, Finally",
    "body": "You can format text now. We know. About time.\n\nCmd+B (or Ctrl+B on Windows, you heathens): Bold. For emphasis.\nCmd+I: Italic. For when something is important but also a bit shy about it.\nCmd+U: Underline. For people who specifically hate italic.\n\nThere's also a little B / I / U button row that appears on the right side of a block while you're typing in it. Same thing, clickable. The formatting is stored as actual HTML so when the page reloads, your bold text is still bold. Radical concept, we know.\n\nThis uses the browser's built-in execCommand under the hood, which sounds janky but is actually what Google Docs and Notion do too. So we're in decent company."
  },
  {
    "order": 5,
    "heading": "The Progress Bar Divider (This One's Actually Cool)",
    "body": "Okay, so. If you set up a board like this:\n\n— Divider\n— Heading (e.g. 'Pre-Production Tasks')\n— Checklist item\n— Checklist item\n— Checklist item\n\nThe divider turns into a progress bar. Automatically. No button to click, no toggle to find. It just detects the pattern and goes green.\n\nAs you tick things off, the bar fills up. All done? The whole thing goes a satisfying solid green with a '100%' label that practically claps for you.\n\nThis means you can use a board as a full project checklist system. Multiple sections, each with their own divider-as-progress-bar. It looks tidy. It feels good. People who like productivity systems are going to lose their minds over this.\n\nPeople who just want to write screenplay notes will also benefit from having visual feedback on their todo lists. Everyone wins."
  },
  {
    "order": 6,
    "heading": "Folders: Boards Inside Boards, Forever",
    "body": "Here's where it gets unhinged in a good way.\n\nBoards can have sub-boards. Sub-boards can have sub-boards. There is no enforced limit. You can nest an idea inside an idea inside an idea inside an idea until the heat death of the universe.\n\nThe top-level boards list only shows your root boards. But inside any board, there's a Sub-boards section at the top. Hit '+ New' and you create a child board that lives inside that parent. Navigate into it. Create sub-sub-boards. Come back up using the breadcrumb trail at the top of the page.\n\nWhy? Because ideas don't live in flat lists. A 'Characters' board might contain a board per character. That board might contain a board of reference images, and another of dialogue notes, and another of backstory beats. That's three levels deep and it still makes total sense.\n\nSub-boards respect the same access control as their root — if someone has access to the parent, they can see the children. You don't have to invite people to every nested board individually."
  },
  {
    "order": 7,
    "heading": "Sharing, Members, Roles",
    "body": "Boards aren't solitary confinement. You can invite people.\n\nClick the members button (top right of any board). Type an email. Assign them 'editor' (they can add and edit blocks) or 'viewer' (they can read, but the blocks are read-only for them). Hit Add.\n\nOwners can remove members. Members can see who else is on the board. Viewers can see everything and touch nothing. Very clean, very professional, very unlike your actual Notion workspace.\n\nThe whole thing is backed by row-level security on the database, which means even if someone guessed a board's UUID, they'd get a 403 unless they're actually invited. Security is not an afterthought here."
  },
  {
    "order": 8,
    "heading": "Go Use It. Seriously.",
    "body": "Idea Boards are in the nav bar now. Click 'Ideas'. Make a board. Dump everything. Make a sub-board. Make another one inside that. Use dividers with checklists and watch the little green bar fill up and feel disproportionately good about it.\n\nThe whole point of this feature is that there's no wrong way to use it. It's a giant open-ended dumping ground for the part of your brain that never totally shuts up.\n\nLink boards to projects when ideas solidify into actual work. Keep separate boards for characters, locations, visual references, half-baked plot theories, names you like the sound of, scenes you cut but still love, dialogue that has nowhere to go yet.\n\nYour brain is a mess. That's fine. At least now the mess has structure."
  }
]
$sections$,

  ARRAY['ideas', 'productivity', 'new feature', 'writing', 'organisation'],

  'published',
  now(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77',
  true
);


-- ── Changelog entries for 2.8.0 ──────────────────────────────
-- Idea Boards release already created in migration_idea_boards.sql
-- These entries cover the editing UX + folder features built on top.

INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Infinite nested sub-boards (folders)',
  'Any idea board can now contain sub-boards, which can contain further sub-boards with no depth limit. Navigate the hierarchy via breadcrumb. Sub-boards inherit access from their root board.',
  'feature',
  'documents',
  true,
  20
FROM changelog_releases WHERE version = '2.8.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.8.0' AND ce.title = 'Infinite nested sub-boards (folders)'
);

INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Keyboard-driven block editing',
  'Enter creates a new block below (heading → text, checklist → checklist, empty checklist → text). Tab cycles the current block type. Backspace on an empty block deletes it. Focus moves automatically.',
  'improvement',
  'documents',
  true,
  30
FROM changelog_releases WHERE version = '2.8.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.8.0' AND ce.title = 'Keyboard-driven block editing'
);

INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Rich text formatting in idea blocks',
  'Bold (⌘B), italic (⌘I), and underline (⌘U) formatting in text, heading, and checklist blocks. A B/I/U toolbar appears while editing. Formatting is persisted as HTML.',
  'feature',
  'documents',
  true,
  40
FROM changelog_releases WHERE version = '2.8.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.8.0' AND ce.title = 'Rich text formatting in idea blocks'
);

INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Checklist progress bar on dividers',
  'A divider placed above a heading followed by checklist items automatically becomes a progress bar, filling green as items are ticked off. Reaches 100% solid green when the section is complete.',
  'feature',
  'documents',
  true,
  50
FROM changelog_releases WHERE version = '2.8.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.8.0' AND ce.title = 'Checklist progress bar on dividers'
);

-- ---------------------------------------------------------------------
-- Source: supabase/blog_post_full_platform_guide.sql
-- ---------------------------------------------------------------------
-- ============================================================
--  BLOG POST: The Complete Screenplay Studio Feature Guide
--  Run in: Supabase Dashboard > SQL Editor
--  Author ID: f0e0c4a4-0833-4c64-b012-15829c087c77  (admin)
-- ============================================================

INSERT INTO blog_posts (
  slug,
  title,
  excerpt,
  cover_image_url,
  sections,
  tags,
  status,
  published_at,
  author_id,
  allow_comments
)
VALUES (
  'complete-platform-guide-every-feature',

  'Every Single Feature on Screenplay Studio — The Insanely Detailed Guide',

  'From the script editor to cast payroll, from weekly writing challenges to gamification — this is the definitive guide to everything Screenplay Studio can do for you. Buckle up.',

  NULL,

  $sections$
[
  {
    "order": 1,
    "heading": "Welcome — What Even Is This Place?",
    "body": "Screenplay Studio is not just another writing app.\n\nIt started as a simple screenplay editor and quietly grew into a full production platform — the kind of thing that handles your script on Monday, your shoot schedule on Tuesday, your actor contracts on Wednesday, your community feedback on Thursday, and your weekly writing challenge on Friday. Oh, and it tracks how many hours you actually spent working instead of staring at the wall.\n\nThis guide covers EVERYTHING. Every table, every toggle, every policy, every feature, every tiny setting that most users never find. It is long. It is detailed. It is for the obsessives, the power users, the curious, and the people who clicked the question mark and expected more than a tooltip.\n\nReady? Let's go."
  },
  {
    "order": 2,
    "heading": "Projects — The Container for Everything",
    "body": "Every piece of work on Screenplay Studio lives inside a Project. A project is your production — a film, a series, a short, a play, a podcast. When you create a project you give it a title, a type (film, TV, short, doc, etc.), a logline, and optionally a cover image.\n\nThe moment you hit Create, three things happen automatically:\n\n1. You are added as the Owner of that project.\n2. An initial script draft titled [Your Project Title] — Draft 1 is created for you inside the project.\n3. You land on the project dashboard with the full suite of tools ready to go.\n\nProjects support: scripts, scenes, characters, locations, shot lists, the production schedule, ideas board, budget, cast & payroll, documents, annotations, work sessions, shoot days, gear lists, arc/episode management, project channels, project members, contributors, and more.\n\nYou can archive projects (they disappear from your dashboard but are not deleted), and owners/admins can permanently delete them. Deletion cascades — everything inside the project is removed from the database."
  },
  {
    "order": 3,
    "heading": "Project Roles & Permissions — Who Does What",
    "body": "Every person on a project has a role. There are four:\n\n— OWNER: Full control. Can do everything including delete the project and manage all member roles. There is only one owner per project (the creator).\n— ADMIN: Almost-owner. Can manage members, edit all content, and delete most things. Cannot remove the owner or delete the project itself.\n— EDITOR: Can read and write all content (scripts, shots, schedule, etc.) but cannot manage team members or delete the project.\n— VIEWER: Read-only. They can see everything but cannot change a single character.\n\nThe Row Level Security policies on every table enforce these rules at the database level — not just in the UI. Even if someone tried to call the API directly, the database simply refuses if their role does not allow it.\n\nInvitations are sent by email. The invitee receives a link, clicks it, and lands on the project already in their dashboard. Invitation records track status (pending, accepted, declined, expired) and are cleaned up automatically."
  },
  {
    "order": 4,
    "heading": "The Script Editor — Your New Writing Home",
    "body": "The script editor is the beating heart of the platform. It uses an element-based model: each line of your script is a separate record in the database with a type, content, and sort order. This means real-time collaboration works without merge conflicts — two writers literally editing different elements at the same time, both seeing each other's changes instantly.\n\nElement types:\n— SCENE HEADING (slugline): INT. COFFEE SHOP — DAY. The classic.\n— ACTION: Descriptive prose. What we see, what we hear.\n— DIALOGUE: What a character says.\n— CHARACTER: The name above a dialogue block.\n— PARENTHETICAL: The (beat), (sighs), (looking away) in brackets.\n— TRANSITION: CUT TO:, SMASH CUT TO:, DISSOLVE TO:, FADE OUT.\n— SHOT: Close-up, insert, POV — shot callouts within action.\n— NOTE: A non-printing internal note to yourself or collaborators.\n\nEvery keystroke is saved. Not periodically — on every change. You will never lose work.\n\nThe editor supports keyboard shortcuts for quickly switching between element types, folding/hiding scenes, and navigating by scene heading. There is also a full-text search index (GIN on PostgreSQL) so you can search across your entire script instantly.\n\nScript elements are sorted by a sort_order integer — dragging a block reorders it in real time."
  },
  {
    "order": 5,
    "heading": "Custom Script Element Types — Make the Format Yours",
    "body": "Standard screenplay format is not the only format. Screenplay Studio supports custom element type definitions per project, so you can define your own labels, styles, and indent rules.\n\nThis means a stage play can have BLOCKING and STAGE DIRECTION elements. An audio drama can have SOUND EFFECT and NARRATOR elements. A corporate video can have LOWER THIRD and B-ROLL elements.\n\nEach custom type stores:\n— A name and display label\n— Font style flags (bold, italic, all-caps)\n— Indent level (left-edge, center, right-of-center)\n— Whether it prints when exporting\n— A color swatch for the editor sidebar\n\nCustom types are project-level — they apply to that project only and do not affect your other projects."
  },
  {
    "order": 6,
    "heading": "Stage Play Format — The Stage is Yours",
    "body": "Stage play formatting is its own world. No sluglines, no camera directions — instead you have acts, scenes, stage directions, and sometimes a very different dialogue layout depending on the tradition (British vs American, naturalistic vs Brechtian).\n\nScreenplay Studio supports a dedicated stage play mode. When you create a project of type Stage Play, the editor unlocks stage-specific element types and hides film-centric ones. You get:\n— ACT headers\n— SCENE headings (not sluglines — proper theatrical scene labels)\n— STAGE DIRECTION blocks\n— CHARACTER cues in the theatre tradition\n— Parenthetical delivery notes\n— SONG CUE markers for musicals\n\nThe export formatter respects all of this, producing a document that looks like a proper stage manuscript, not a screenplay."
  },
  {
    "order": 7,
    "heading": "Audio Drama & Podcast Format",
    "body": "Screenplays for ears are a growing medium — full-cast audio dramas, scripted podcasts, radio plays, and immersive audio fiction.\n\nScreenplay Studio has a dedicated audio drama mode. Script elements in this mode include:\n— NARRATOR blocks (the omniscient storytelling voice)\n— SOUND EFFECT cues with description and duration hints\n— MUSIC CUE markers\n— AMBIENCE notes (scene-setting sonic environment)\n— Standard DIALOGUE with full character/parenthetical support\n\nThe audio drama schema also stores format metadata: whether the production is stereo or binaural, estimated episode runtime, series/standalone flag, and target platform (podcast, radio, streaming).\n\nThis makes Screenplay Studio the only screenplay tool that treats audio drama as a first-class format instead of a weird corner case."
  },
  {
    "order": 8,
    "heading": "Broadcast Format — For the Airwaves",
    "body": "Broadcast scripting (news, live TV, promotional content, broadcast promos) uses a two-column A/V format that is nothing like screenplay format. The left column describes the video; the right column has the audio/copy.\n\nScreenplay Studio supports broadcast script mode with:\n— VIDEO column (left) + AUDIO column (right) side-by-side editing\n— SUPER (on-screen text/lower third) elements\n— VO (voiceover) vs SOT (sound-on-tape) distinction\n— SCENE/SEGMENT headers\n— TOTAL TIME calculator based on estimated read time\n\nBroadcast contacts (reporters, anchors, producers, stations) can be stored and linked to broadcast projects, complete with contact info, station affiliation, and relationship notes.\n\nThe broadcast patch feature allows incremental changes (corrections/inserts) to be distributed to a team without re-sending the full script."
  },
  {
    "order": 9,
    "heading": "Scenes — Structure Your Story",
    "body": "Scenes are the structural backbone of your screenplay. Every scene lives inside a script and represents a single unbroken unit of dramatic action — one place, one time, one set of events.\n\nEach scene record stores:\n— Scene number (auto-generated or manual)\n— Interior/exterior flag\n— Location reference (links to the location database)\n— Time of day (day, night, morning, afternoon, dusk, etc.)\n— Scene summary / description\n— Estimated page count\n— Estimated screen time in seconds\n— A topic / thematic label\n— Tags (array of freeform strings)\n— Color coding for visual organization\n— Sort order within the script\n\nThe scene panel gives you a bird's-eye view of your entire story — you can drag to reorder, click to jump to that scene in the editor, add notes, and track which scenes are fully written vs placeholder.\n\nScenes can also be broken down for production: linked to locations, linked to characters (automatic from the script), flagged as day-exterior for scheduling purposes."
  },
  {
    "order": 10,
    "heading": "Characters — Give Them Life",
    "body": "The Characters section is a full character bible tool built into every project.\n\nFor each character you can store:\n— Full name + any aliases / nicknames\n— Age and description\n— A profile photo or reference image URL\n— A detailed biography (backstory, motivations, secrets)\n— Character arc notes (where they start vs where they end)\n— Character type: protagonist, antagonist, supporting, minor, bit part, etc.\n— Their scene appearances (auto-populated by parsing the script)\n— Relationships to other characters (with relationship type and notes)\n— Actor casting notes and the linked cast member (when you move into production)\n\nCharacter names are indexed with trigram search (pg_trgm) so even a partial name search is instant.\n\nThe character roles feature goes deeper: for TV/episodic projects, you can tag which episodes a character appears in, their billing order (series regular, recurring, guest star, co-star, day player, under five), and their arc trajectory across a season."
  },
  {
    "order": 11,
    "heading": "Locations — Build Your World",
    "body": "The Locations database is your master location library for the entire project.\n\nEach location stores:\n— Name and address\n— Type: interior, exterior, combo\n— Category: practical location, studio/stage, mixed\n— GPS coordinates (lat/lng) for mapping\n— Contact info for the location owner/manager\n— Rental rate (daily, weekly, hourly) with currency\n— Parking and accessibility notes\n— Equipment/power availability\n— A photo gallery (array of image URLs)\n— General production notes\n— Permit status and permit document links\n\nMulti-Location Markers extend this further: a single scene can have multiple location markers pointing to different real-world places used for the same scripted location (e.g. the exterior of the house is shot at Address A, the interior at Studio B).\n\nLocations are reusable across scenes — link the same coffee shop to 12 different scenes and updating the location record updates the info everywhere."
  },
  {
    "order": 12,
    "heading": "Shot Lists — Think Like a Director",
    "body": "Every scene can have a full shot list. Each shot is a record with:\n\n— Shot number (A1, A2, … per scene)\n— Shot type: wide / medium / close-up / extreme close-up / insert / POV / reaction / two-shot / over-the-shoulder / aerial / underwater (the full professional vocabulary)\n— Shot movement: static / pan / tilt / dolly / handheld / crane / steadicam / drone / zoom\n— Lens (e.g. 35mm, 50mm, anamorphic 2x)\n— Description of what the shot shows (the actual image)\n— Dialogue reference (which line of dialogue this shot covers)\n— Estimated duration in seconds\n— Camera notes (frame rate, filters, rigs, operator notes)\n— Lighting notes\n— Sound notes\n— VFX required flag + VFX description\n— Storyboard image URL\n— Reference image URLs (array)\n— Takes needed vs takes completed\n— Completion flag\n\nShot lists are sortable by drag-and-drop. They integrate with the Storyboard module and the Shoot Day planner — shots from a scene automatically appear on the shoot day that scene is scheduled for."
  },
  {
    "order": 13,
    "heading": "Storyboards — Shot by Shot Visualization",
    "body": "The Storyboard Shots feature extends the shot list with visual storytelling tools.\n\nEach storyboard shot can have:\n— A frame image (drawn, photographed reference, or AI-generated)\n— Panel notes\n— Audio/music cues\n— Transition type to the next panel (cut, dissolve, wipe)\n— Camera framing guide overlay\n\nThe storyboard view renders your shot list as a horizontal strip of panels — the classic animatic/pre-viz format directors and DPs use in prep. You can export this as a PDF storyboard document for distribution to your crew.\n\nStoryboard shots are linked to your script scenes and shot records, so the entire pre-production pipeline — script → scene → shot list → storyboard — flows seamlessly."
  },
  {
    "order": 14,
    "heading": "The Production Schedule — From Script to Set",
    "body": "The Production Schedule is a full calendar tool for managing your shoot.\n\nEach calendar event stores:\n— Title and description\n— Event type: shooting, rehearsal, table read, location scout, tech scout, production meeting, costume fitting, makeup test, audition, pickup, post-production, wrap party, other\n— Start and end timestamps (with timezone)\n— All-day flag\n— Scene IDs being shot that day (links to scene records)\n— Location (links to location database)\n— Crew/cast assigned (array of user IDs)\n— Call time and wrap time (separate from the event start/end)\n— General notes\n— Color coding (for differentiating shoot days, meetings, etc.)\n— Confirmed flag (pending vs locked schedule)\n— Weather backup plan\n\nThe schedule feeds into the Shoot Days module, sends availability-check notifications to cast and crew, and can be exported as a call sheet PDF."
  },
  {
    "order": 15,
    "heading": "Shoot Days — Day-by-Day Planning",
    "body": "Shoot Days are structured daily production plans — more detailed than calendar events, designed to produce a proper day-of plan for your crew.\n\nEach shoot day captures:\n— Date and shoot day number (Day 1, Day 2…)\n— General call time\n— Crew call times (first unit, second unit, department calls)\n— Scenes scheduled for that day\n— Estimated pages per scene\n— Locations used\n— Special equipment requirements\n— Notes and contingencies\n\nShoot day records link to the production schedule (the calendar) and to the Shot List — so the DP's team can pull up the complete shot list for their scenes from the shoot day view.\n\nA daily hours tracker shows estimated vs actual shoot duration so you can spot if you're consistently running over."
  },
  {
    "order": 16,
    "heading": "Gear Management — Don't Forget the Camera",
    "body": "The Gear module is your equipment inventory and rental tracker.\n\nEach gear item stores:\n— Item name and category (camera body, lens, lighting, sound, grip, post/DIT, VFX, misc)\n— Quantity\n— Ownership: own / rent / borrow\n— Vendor / rental house name and contact\n— Daily / weekly rental rate with currency\n— Total cost (auto-calculated from shoot days × rate)\n— Insurance value\n— Serial number / asset tag\n— Notes and condition flags\n\nGear items can be attached to specific shoot days — so Monday's kit list is different from Friday's (second unit day with a drone).\n\nThe gear module rolls up to your budget: rental costs feed directly into the budget categories you define, so your below-the-line numbers stay accurate."
  },
  {
    "order": 17,
    "heading": "Ideas Board — Capture the Magic",
    "body": "The Ideas Board is a Kanban-style brainstorming space attached to every project.\n\nIdeas live in columns based on status:\n— SPARK: The raw, unfiltered idea. Write it down before it evaporates.\n— EXPLORING: Worth thinking about more.\n— PROMISING: This could be something.\n— IN SCRIPT: The idea has been incorporated into the actual script.\n— SHELVED: Not right for now, but not killed.\n\nEach idea card stores:\n— Title and description\n— Category: story, character, scene, dialogue, visual, location, theme, structure, other\n— Priority (0–10 numeric, controls sort order within the column)\n— Tags\n— Reference URLs (mood board links, research articles, YouTube clips)\n— File attachments\n— A color swatch for visual grouping\n— Assignment to a specific collaborator\n\nThe Ideas Board is separate from your script so it stays messy and uninhibited. The best stuff makes it into the script; the rest stays archived for when you inevitably need it."
  },
  {
    "order": 18,
    "heading": "Budget Tracker — Know Your Numbers",
    "body": "The Budget module gives every project a real financial tracking system.\n\nBudget items are organized into categories:\n— Above the line (story/script rights, producers, director, cast)\n— Below the line (crew, equipment, locations, transportation, art department, wardrobe, hair/makeup, stunts, VFX, music, post-production)\n— Post-production\n— Marketing\n— Contingency\n— Other\n\nEach line item stores:\n— Description\n— Category\n— Estimated amount\n— Actual amount (filled in as you spend)\n— Variance (auto-calculated)\n— vendor/payee\n— Notes\n— Purchase order number\n— Receipt URL\n\nThe budget rolls up to a summary showing total estimated vs actual spend across all categories, with variance warnings when you go over. Currency is configurable per item (for multi-country productions).\n\nGear rental costs, cast payment totals, and crew rates from other modules feed into the budget automatically when you link records."
  },
  {
    "order": 19,
    "heading": "Cast Members & Payroll — Your Actors, Your Ledger",
    "body": "The Cast & Payroll module is a full actor management system that would normally require dedicated production software.\n\nEach cast member record stores:\n— Full name\n— Character roles (array of character names — because one actor can play multiple roles)\n— Email and phone\n— Profile photo URL\n— Bio / professional biography\n— Availability notes\n— General notes from the production team\n\nPay rate info:\n— Pay amount (DECIMAL with 12 digits of precision — no rounding errors)\n— Pay unit: hourly / daily / weekly / monthly / flat deal / per episode\n— Pay currency (supports any ISO currency code — USD, EUR, NOK, GBP, JPY, etc.)\n\nContract status tracks where each actor is in the deal:\n— NEGOTIATING: In discussions.\n— PENDING: Offer made, waiting for signature.\n— SIGNED: Deal closed, contract executed.\n— ON SET: Currently in production.\n— COMPLETED: Filming done.\n— RELEASED: Term over, all obligations met.\n\nCustom metadata (JSONB) lets you store any additional per-actor structured data your production needs — think union affiliation, agent contact, IMDB link, reel URL."
  },
  {
    "order": 20,
    "heading": "Cast Payments — The Payment Ledger",
    "body": "Every payment to every cast member is tracked in the Cast Payments ledger.\n\nEach payment record stores:\n— Cast member reference\n— Amount + currency\n— Description (Week 1 pay, Episode 3 fee, etc.)\n— Period start and end dates (for weekly/episode payments)\n— Due date\n— Paid-at timestamp\n— Status: UNPAID / PAID / OVERDUE / CANCELLED\n— Notes\n\nThe status field is what powers your payroll dashboard: you can filter to see all overdue payments across all cast members at once, which is exactly the kind of thing that saves productions from lawsuits.\n\nOverdue detection: any payment with a due_date in the past and status = unpaid is flagged. You can run bulk status updates as you process payments.\n\nThe payment ledger totals roll up to the overall cast budget line, keeping your budget and your payroll in sync."
  },
  {
    "order": 21,
    "heading": "Cast Documents — The Paper Trail That Protects You",
    "body": "Every document related to a cast member lives in their document vault.\n\nDocument types supported:\n— NDA (non-disclosure agreement)\n— CONTRACT (the main deal memo or long-form contract)\n— WORK AGREEMENT (a shorter agreement for day players)\n— ID PROOF (driver licence, passport, etc.)\n— INSURANCE (certificate of insurance from the actor's loan-out)\n— WORK PERMIT (union permits, child actor permits, etc.)\n— CITIZENSHIP (for visas and international productions)\n— NEGOTIATION (deal points correspondence, rider terms)\n— OTHER\n\nEach document stores:\n— Document type\n— Title\n— File URL (linked to your storage bucket)\n— Original file name\n— Notes\n— Expiry date (critical for permits and insurance certificates — you get notified when these are approaching)\n\nAll documents are access-controlled by project role: owners/admins can read everything, editors can read but not delete sensitive docs, viewers are blocked entirely."
  },
  {
    "order": 22,
    "heading": "Annotations — Notes Right on the Page",
    "body": "Annotations let you attach sticky-note-style comments directly to specific script elements — a particular line of action, a piece of dialogue, a scene heading.\n\nEach annotation stores:\n— The script element it is attached to\n— The text of the note\n— The author\n— An annotation type: note, question, suggestion, flag, approved\n— A resolved flag (once the note is addressed, mark it done)\n— Resolved by (who resolved it)\n\nAnnotations are separate from the inline Comments feature (which can be attached to any entity). Annotations are specifically for in-script feedback — the kind that an editor, script supervisor, or writing partner would leave during notes sessions.\n\nThe annotation sidebar shows all open annotations for the current script, grouped by scene, with quick-navigation to jump to each."
  },
  {
    "order": 23,
    "heading": "Comments — Notes on Anything",
    "body": "The Comments system is the general-purpose discussion layer. Unlike annotations (which attach to script elements), comments can attach to any entity in the system: scenes, shots, characters, locations, ideas, budget items, documents, schedule entries.\n\nComments support:\n— Full threaded replies (parent_id for nesting)\n— Comment types: note / question / suggestion / approval / rejection / flag\n— Resolved / unresolved tracking\n— Who resolved it and when\n\nAll comments on a project are accessible in a unified inbox view — you can see everything that needs your attention without hunting through individual pages.\n\nRealtime: comments use Supabase Realtime under the hood, so replies from collaborators appear instantly without a page refresh."
  },
  {
    "order": 24,
    "heading": "Revision History — Never Lose a Word",
    "body": "The Revision History feature saves complete snapshots of your script at named revision points.\n\nEach revision stores:\n— Version number\n— Revision color (the standard industry system):\n  — WHITE: First draft\n  — BLUE: Second revision\n  — PINK: Third revision\n  — YELLOW: Fourth revision\n  — GREEN: Fifth revision\n  — GOLDENROD: Sixth revision\n  — BUFF: Seventh revision\n  — SALMON: Eighth revision\n  — CHERRY: Ninth revision\n  — TAN, IVORY, WHITE (second cycle) for subsequent revisions\n— Revision notes (what changed)\n— A full JSONB snapshot of every script element at that point in time\n— Who created the revision\n\nYou can compare any two revisions, restore a previous version as a new draft, or export a specific revision as a PDF.\n\nThis is the standard WGA/guild revision tracking system used on professional productions — your script now speaks the same language as a union writer's room."
  },
  {
    "order": 25,
    "heading": "Version Control (Advanced Versioning)",
    "body": "Beyond the revision snapshot system, the Versioning module adds a Git-inspired branching concept for scripts.\n\nYou can:\n— Create named branches of your script (e.g. Director Cut, Studio Draft, European Version)\n— Make changes on a branch without affecting the main script\n— Merge branches back (with conflict resolution UI)\n— View the diff between any two branches at the element level\n\nThis is invaluable when you have multiple stakeholders requesting different versions simultaneously: the studio wants fewer characters, the director wants a longer third act, the foreign co-production needs a location change. Branches keep you sane.\n\nEach version/branch record tracks its parent version, creation date, author, and a description of what this version is for."
  },
  {
    "order": 26,
    "heading": "Work Time Tracking — Log Every Hour",
    "body": "Screenplay Studio tracks how much time you actually spend working on a project. Not reported time — actual measured time.\n\nHere is how it works: when you open a project, a work session is created with a unique session key (generated in your browser, stored in sessionStorage — so each browser tab gets its own session). Every 30 seconds, a heartbeat is sent to the server. The server adds 30 seconds to your session duration — but only if:\n— The heartbeat is not more than 20 minutes late (gap detection)\n— You have not been idle for more than 10 minutes (idle detection)\n— A short break grace period of up to 5 minutes is credited (so stepping away to think counts)\n\nWhat is tracked per session:\n— User ID\n— Project ID\n— Context (which part of the app you are in: script, documents, arc-planner, etc.)\n— Date\n— Total seconds accumulated\n— Last heartbeat timestamp\n\nProject owners can see work hours for all team members. The data is broken down by day, by context (how much time in the script vs the documents vs the schedule), and in aggregate.\n\nViews available:\n— work_hours_by_day: daily totals per user per project (last 90 days)\n— work_hours_by_user: all-time hours, days worked, first/last session\n— work_hours_by_context: time split by context\n— admin_work_stats: platform-wide production activity\n\nSessions that go stale (no heartbeat for 24+ hours, under 60 seconds credited) are automatically cleaned up."
  },
  {
    "order": 27,
    "heading": "Real-Time Collaboration — Write Together, Right Now",
    "body": "Screenplay Studio is built for simultaneous multi-user editing. It is not a single-editor-with-comments system — multiple people can type at the same time.\n\nThe collaboration infrastructure:\n— Script elements are individual database rows subscribed to via Supabase Realtime\n— Changes from any collaborator arrive via a WebSocket channel within milliseconds\n— Each user's cursor position (which element they are editing and where in the text) is broadcast via the user_presence table\n— Presence avatars appear in the editor showing where each collaborator currently is\n\nThe user_presence table stores:\n— User ID and project ID\n— Current page\n— Current element ID they are focused on\n— Cursor position (character offset)\n— Online/offline status\n— Last seen timestamp\n\nPresence pins expire automatically — if a user's tab closes or they go offline, their presence dot disappears within seconds.\n\nThe following tables are on the Supabase Realtime publication: script_elements, user_presence, comments, ideas, scenes, shots, production_schedule."
  },
  {
    "order": 28,
    "heading": "Project Documents — Your File Cabinet",
    "body": "Every project has a document vault separate from cast documents — this is for general production documents: deal memos, location agreements, insurance certificates, research materials, mood boards, pitch decks, distribution agreements.\n\nDocuments store:\n— Title and description\n— Document type (with a flexible system of categories)\n— File URL and file name\n— Version number\n— Status (draft, pending review, approved, executed, expired)\n— Expiry date\n— Who uploaded it and when\n— Notes\n\nProject documents are visible to all team members based on role. Viewers can read; editors can upload new versions; admins can delete.\n\nDocuments are stored in Supabase Storage buckets with RLS policies ensuring only authorized project members can access the files."
  },
  {
    "order": 29,
    "heading": "Project Channels — Team Communication",
    "body": "Project Channels are per-project discussion spaces — think Slack channels but built directly into the project context.\n\nEach project can have multiple channels. Default channels: General, Script Notes, Production. You can add topic-specific channels: Locations, Budget, VFX, etc.\n\nChannels support:\n— Text messages\n— File attachments\n— Reactions (emoji)\n— Threaded replies\n— @mentions\n— Pinned messages\n— Message history (persisted, searchable)\n\nChannels use Supabase Realtime for instant delivery. Messages are associated with the project so they do not bleed between projects, and channel access is controlled by project membership."
  },
  {
    "order": 30,
    "heading": "Personal Project Folders — Your Own Organization System",
    "body": "Your project dashboard can get crowded if you are on a lot of productions. Personal folders let you organize your own view of your projects.\n\nFolders are personal — they belong to you and only you. They are not visible to other project members. You can:\n— Create folders with names and colors\n— Move any project you are a member of into a folder\n— Nest folders (subfolders supported)\n— Rename and recolor folders\n— Move folders around using drag-and-drop\n\nThe folder tree is stored per user, not per project, so your organizational scheme stays yours regardless of how the project owner has things set up."
  },
  {
    "order": 31,
    "heading": "Dashboard Folders — Admin-Level Project Organization",
    "body": "Separate from personal folders, Dashboard Folders are admin-level categorization visible to the whole team. These are used to group projects by production company, season, client, genre, or status.\n\nFor agencies and production companies running multiple projects simultaneously, dashboard folders give the whole company a shared taxonomy: all of Client A's projects together, all comedy shorts in one folder, all series in another.\n\nDashboard folder access is controlled by role: only owners and admins can create/rename/delete dashboard folders."
  },
  {
    "order": 32,
    "heading": "Contributors — Credit the Whole Team",
    "body": "Contributors is a credits-style roster for everyone who worked on a project — including people who are not Screenplay Studio users.\n\nEach contributor record stores:\n— Name\n— Role / department (director, DP, editor, composer, gaffer, boom op, etc.)\n— Whether they are a platform user (and if so, linked to their profile)\n— Contribution dates\n— Credit billing (as it would appear on screen)\n— Notes\n\nThe contributors list generates a formatted credits document you can export. It is also used internally for the project completion workflow and for the festival submission data export.\n\nContributors are separate from project members (who have system access) — a cinematographer who never logs into the platform can still be properly credited."
  },
  {
    "order": 33,
    "heading": "Development Tools — The Path from Idea to Greenlight",
    "body": "The Development Tools section tracks where a project sits in the development pipeline.\n\nDevelopment milestones include:\n— Premise / logline\n— Treatment\n— Step outline\n— First draft\n— Notes period\n— Revision drafts (numbered)\n— Table read\n— Final draft (locked)\n— Packaging (attaching elements: director, lead cast)\n— Financing\n— Pre-production\n— Production\n— Post-production\n— Delivery\n— Distribution\n\nEach milestone has a status (todo, in-progress, completed, skipped), target date, completion date, and notes.\n\nThe development tracker gives producers and executives a single-glance status view for an entire development slate — no more chasing emails to find out which draft you're on."
  },
  {
    "order": 34,
    "heading": "Arc & Episode Planning — Think in Episodes",
    "body": "For TV series, limited series, and anthology content, the Arc & Episode Planner is your writers room tool.\n\nArcs represent story threads that run across multiple episodes — character arcs, A-plots, B-plots, season-long mythology. Each arc has:\n— A title and description\n— A color (for visual distinction in the grid)\n— Start and end episode\n— Arc type: character / plot / thematic / world-building\n— Status: seeded / building / climax / resolved\n\nEpisodes store:\n— Episode number and title\n— Season number\n— Script link (each episode links to its own script)\n— Logline\n— Cold open / act structure notes\n— Airdate (planned or actual)\n— Production status\n\nThe visual arc grid shows all your episodes as columns and all your arcs as rows — you can see at a glance which episodes drive which story threads, where your arcs peak and resolve, and where your season feels thin.\n\nAdmin controls let showrunners lock arcs and episodes to prevent writers from accidentally breaking series continuity."
  },
  {
    "order": 35,
    "heading": "Client Customisation — Your Brand on the Platform",
    "body": "Client Customisation (also called white-labeling) allows production companies and agencies to present Screenplay Studio under their own branding.\n\nCustomisable elements:\n— Logo (replaces the Screenplay Studio logo in the header)\n— Primary and accent colors (CSS variables applied globally)\n— Company name (shown in the tab title and browser metadata)\n— Custom domain (serve the app from yourcompany.io)\n— Email sender name for notifications (From: YourCompany instead of Screenplay Studio)\n— Welcome screen art and messaging\n— Feature visibility toggles (hide features your clients do not need)\n\nClient customisation is stored per organisation/workspace. When a user belongs to a white-labelled workspace, they see the client branding everywhere.\n\nThis feature is Pro-tier only."
  },
  {
    "order": 36,
    "heading": "Feature Flags — Experimental and Opt-In Features",
    "body": "Feature flags control which features are enabled for which users or projects.\n\nFlag types:\n— GLOBAL: Enabled platform-wide (admin controls these)\n— USER: Opt-in per user (visible in Account Settings → Labs)\n— PROJECT: Enabled per project (project owner enables in Project Settings)\n— BETA: Features in beta testing, invite-only\n\nEach flag stores:\n— Flag key (machine-readable name)\n— Display name and description\n— Default state (on/off)\n— Who has overridden it\n\nFeature flags allow gradual rollouts: a new feature can go to 5% of users first, then 25%, then everyone. They also allow emergency disablement without a deployment — if a new feature breaks something in production, flipping a flag turns it off instantly.\n\nAs a user, you will see a Labs section in your account settings showing all available opt-in experiments."
  },
  {
    "order": 37,
    "heading": "Security & Legal — Locked Down",
    "body": "Screenplay Studio takes security seriously. Here is the full picture:\n\nROW LEVEL SECURITY (RLS) is enabled on every single table in the database. This is a PostgreSQL feature where the database itself enforces who can read, insert, update, or delete every row. Even if someone bypasses the application layer, the database refuses unauthorized access.\n\nAUTHENTICATION: Supabase Auth handles login — email/password, magic links, and OAuth providers (Google, GitHub). JWTs are used for all API calls; the auth.uid() function in RLS policies verifies the caller's identity at query execution time.\n\nDATA ISOLATION: Projects are completely isolated. A user who is not a member of a project cannot read a single scene, character, or document from it. The RLS policies check project membership on every query.\n\nADMIN CONTROLS: There is a single admin UUID hardcoded into critical policies (the platform admin). This admin can see and manage all content for moderation purposes, but normal users have no elevated access to each other's data.\n\nLEGAL DOCUMENTS: The security & legal module stores platform-level legal documents (Terms of Service, Privacy Policy, acceptable use policies) with version tracking. Users are prompted to re-accept terms when new versions are published.\n\nSECURITY DEFINER FUNCTIONS: Sensitive database functions (like cast payment processing, challenge result computation, and heartbeat handling) run as SECURITY DEFINER — they execute with elevated privileges but only do exactly what they are designed to do, with no client-controllable inputs that could be abused."
  },
  {
    "order": 38,
    "heading": "Sidebar Layouts — Make the Editor Yours",
    "body": "The sidebar is where most of your navigation and tooling lives — scene list, character list, notes, annotations, comments, etc.\n\nSidebar Layouts lets you save custom arrangements:\n— Which panels are open or collapsed\n— The order of panels\n— Whether the sidebar is narrow, wide, or hidden\n— A name for the layout (e.g. Writing Mode, Review Mode, Production Mode)\n\nYou can switch between saved layouts with one click. Switching from Writing Mode (sidebar hidden, full-screen editor) to Review Mode (scene list + annotations + comments) takes half a second.\n\nLayouts are saved per user, not per project, so your preferred writing setup follows you across your productions."
  },
  {
    "order": 39,
    "heading": "Pro Subscription — Unlock Everything",
    "body": "Screenplay Studio has a free tier and a Pro tier. Here is the breakdown:\n\nFREE TIER:\n— 3 active projects\n— 1 collaborator per project\n— Core script editor (all element types)\n— Scene management\n— Characters and locations\n— Ideas board\n— Community access (read)\n\nPRO TIER (subscription, monthly or annual):\n— Unlimited projects\n— Unlimited collaborators per project\n— Shot lists and storyboards\n— Production schedule and shoot days\n— Budget tracker\n— Cast & Payroll module\n— Cast Documents vault\n— Work time tracking\n— Revision history with industry colors\n— Advanced versioning (branches)\n— Arc & episode planner (for TV/series)\n— Broadcast, Audio Drama, Stage Play modes\n— Client Customisation / white-labeling\n— Advanced development tools\n— Festival Bridge\n— Priority support\n— Export to PDF (all document types)\n\nPro status is stored on the user profile and checked via RLS policies and application-layer guards. When a Pro subscription lapses, projects are read-only (not deleted) until the subscription is reinstated."
  },
  {
    "order": 40,
    "heading": "The Community Hub — Where Writers Meet",
    "body": "The Community Hub is the public-facing social layer of Screenplay Studio. It is where writers share their work, give and receive feedback, compete in challenges, and find collaborators.\n\nThe Community is separate from your private projects — nothing from your project appears in the Community unless you explicitly publish it.\n\nThe Hub has five main areas:\n1. Shared Scripts (community_posts)\n2. Writing Challenges\n3. The Free-Use Library\n4. Script Productions (films made from free scripts)\n5. Subcommunities (genre-specific groups)\n\nAll community content is publicly readable without an account. Writing, voting, and submitting requires a free account."
  },
  {
    "order": 41,
    "heading": "Community Script Sharing — Put Your Work Out There",
    "body": "You can publish any script to the Community as a community post. You control exactly what others can do with it via permission flags:\n\n— ALLOW COMMENTS: Others can leave feedback comments on your script. Default on.\n— ALLOW SUGGESTIONS: Others can leave line-level suggestions (separate from regular comments). Default on.\n— ALLOW EDITS: Others can directly propose edits to your script (collaborative distro-style editing). Default off.\n— ALLOW DISTROS: Others can fork your script and publish their own version (crediting you as the source). Default off.\n— ALLOW FREE USE: Your script is placed in the Free-Use Library — anyone can produce a film from it for free. Default off.\n— COPYRIGHT DISCLAIMER ACCEPTED: Required before Free Use can be enabled.\n\nPublished posts appear in the Community feed. They can be tagged with categories: Feature Film, Short Film, TV/Series, Web Series, Documentary, Animation, Horror, Comedy, Drama, Sci-Fi.\n\nEngagement metrics:\n— View count (incremented on each page view)\n— Upvote count (one upvote per user, togglable)\n— Comment count\n— Distro count"
  },
  {
    "order": 42,
    "heading": "Upvotes & Community Voting — The Best Script Wins",
    "body": "The upvote system is simple and clean: one upvote per user per post, togglable. Click to upvote, click again to remove.\n\nUnder the hood, the toggle_community_upvote() RPC function handles this atomically — it checks for an existing upvote, adds or removes it, and updates the denormalized upvote_count on the post in one database transaction. No race conditions, no double-votes.\n\nUpvote counts feed into the Community feed sort order: you can browse by Recent, Most Upvoted This Week, Most Upvoted All Time, or Category.\n\nChallenge voting (separate from community post upvotes) follows a stricter rule: one vote per user per challenge, enforced by a UNIQUE constraint on (user_id, challenge_id) in the challenge_votes table."
  },
  {
    "order": 43,
    "heading": "Script Distros — Build on Each Other",
    "body": "Distros are forks. When a writer marks their script as allow_distros = true, other community members can create their own version — a distro — based on the original.\n\nA distro:\n— Credits the original post/author automatically\n— Is published as a separate community post\n— Can be further distro'd if the distro author also enables it\n— Increments the distro_count on the original post\n\nThe distro chain creates a visible lineage: Original → Distro A → Distro B. Readers can follow the chain and see how different writers interpreted the same source material.\n\nDistros are popular for premise sharing (a writer publishes a premise/premise script and others write different executions of it) and for translation/adaptation challenges."
  },
  {
    "order": 44,
    "heading": "The Free-Use Library & Script Productions",
    "body": "The Free-Use Library is one of the most unusual features on the platform — and one of the most valuable for emerging filmmakers.\n\nA writer can mark their script as allow_free_use = true (after accepting the copyright disclaimer). This places the script in the Free-Use Library, where any filmmaker can download it and produce a film from it, for free, without asking permission.\n\nThis creates a virtuous cycle: writers who want their work produced can make it freely available; filmmakers who want a quality script without development costs can find one immediately.\n\nWhen a film is made from a free-use script, the filmmaker submits it as a Script Production:\n— Title of the film\n— Description\n— URL (YouTube, Vimeo, festival site, etc.)\n— Thumbnail image\n\nSubmissions are reviewed by the admin (status: pending → approved/rejected). Approved productions appear on the original script's page and in the Community productions feed.\n\nThis creates a portfolio for both the writer (evidence their scripts get made) and the filmmaker (credits attached to a verifiable source script)."
  },
  {
    "order": 45,
    "heading": "Weekly Writing Challenges — Sharpen Your Craft",
    "body": "Every Monday at 00:00 UTC, a new Weekly Writing Challenge launches automatically.\n\nHere is how the full lifecycle works:\n\nMONDAY 00:00 — Challenge launches. The ensure_weekly_challenge() database function runs, picks a challenge theme from the pool (favoring least-used themes, with randomness as tiebreaker), creates the challenge record, and publishes the prompt.\n\nFRIDAY 21:00 — Submissions close. No new submissions accepted.\n\nSATURDAY 23:59 — Voting closes. Community members vote for their favorite submission. One vote per person per challenge. Votes are tracked in the challenge_votes table with a UNIQUE constraint enforcing the one-vote rule.\n\nSUNDAY 12:00 — Results revealed. The compute_challenge_results() function recounts all votes, assigns placements (1st, 2nd, 3rd, etc. — ties broken by submission time), and marks the winners.\n\nChallenge themes in the pool (a sample):\n— The Last Day / Wrong Number / The Room / Silent Protagonist / 24 Hours\n— Strangers on a Train / The Letter / Midnight / The Job Interview\n— Found Footage / Time Loop / The Heist / First Contact / The Dinner Party\n— Unreliable Narrator / Two Timelines / The Chase / Bottle Episode\n— Backwards / The Audition\n— (+ more added by admin over time)\n\nEach theme has a difficulty tag (beginner, intermediate, advanced) and an optional genre hint and constraint. Themes track how many times they have been used so variants are not repeated too often.\n\nChallenge rewards: PRO prize structure is configurable per challenge by admin. Winners earn XP (feeds into the Gamification system) and a winner badge on their profile."
  },
  {
    "order": 46,
    "heading": "Community Chat & File Uploads — Stay Connected",
    "body": "The Community Chat is a live chat room attached to the Community Hub (separate from the per-project channels). It has:\n— A general Community channel\n— Challenge-specific chat rooms (automatically created per weekly challenge)\n— Subcommunity channels\n\nMessages are real-time via Supabase Realtime. Messages are stored in the database (not ephemeral) so you can scroll history.\n\nFile Uploads in the community allow members to share:\n— Reference images and mood board assets\n— Script excerpts (PDF)\n— Research documents\n— Portfolio links\n\nFiles are stored in a community-specific Supabase Storage bucket. Uploaded files are associated with the uploader's profile and a community post or channel. RLS ensures users can only delete their own uploads; admin can remove anything."
  },
  {
    "order": 47,
    "heading": "Subcommunities — Find Your Tribe",
    "body": "Subcommunities are genre- or topic-specific spaces within the Community Hub. Think subreddits, but for screenwriters.\n\nEach subcommunity has:\n— A name, slug, description, and icon\n— A type (genre, format, craft topic, regional, etc.)\n— A charter (community rules)\n— Moderators (users with elevated rights within the subcommunity)\n— Member join/leave\n— A dedicated feed of community posts tagged to that subcommunity\n— A dedicated chat channel\n— Challenge submissions filtered to that genre\n\nJoining a subcommunity is free. Moderators can pin posts, remove content that violates the charter, and set the subcommunity's description and icon.\n\nSubcommunities support public (anyone can join) and private (join by request) modes."
  },
  {
    "order": 48,
    "heading": "Gamification — XP, Badges & Streaks",
    "body": "Writing is a lonely discipline that benefits enormously from positive reinforcement. The Gamification module adds a progress and achievement system underneath everything you do on the platform.\n\nEARNING XP:\n— Publishing a community post: +50 XP\n— Receiving an upvote: +5 XP\n— Completing a weekly challenge: +100 XP\n— Placing 1st/2nd/3rd in a challenge: +500/+300/+150 XP\n— Completing a script (marking it done): +200 XP\n— Daily login streak (consecutive days): +10 XP/day building to +50 XP/day at 7-day streak\n— Completing a course: XP value set per course\n— First time finishing an act: +25 XP\n\nLEVELS: XP feeds into a level system. Levels are displayed on your profile and in community posts. Reaching level 10 is the minimum requirement to create community courses.\n\nBADGES: Specific achievements unlock badge icons shown on your profile:\n— First Script (complete your first script)\n— Community Voice (first published community post)\n— Challenge Winner (place 1st in any challenge)\n— Triple Threat (place in 3 separate challenges)\n— Distro King (5 of your scripts get distro'd)\n— Free Use Hero (one of your free-use scripts gets produced)\n— Speed Writer (complete a challenge submission in under 2 hours)\n— Streak Master (30-day daily login streak)\n— Course Creator (publish your first course)\n— Master Craftsman (level 25)\n\nSTREAKS: Consecutive-day usage streaks are tracked and displayed. Breaking a streak is... not great. The streak system incentivizes daily writing habits, which is the single most effective writer behavior change."
  },
  {
    "order": 49,
    "heading": "Courses — Learn the Craft",
    "body": "The Courses module is a full learning management system built into the platform.\n\nStructure:\n— COURSE: The top-level container. Has a title, description, short description, cover image, difficulty (beginner/intermediate/advanced/expert), estimated minutes, XP reward, and tags.\n— SECTION: A chapter within a course. Has a title and sort order.\n— LESSON: Individual lesson within a section. Types: video, text, exercise, quiz. Has a title, content (markdown or video embed), and optional source URL.\n\nENROLLMENT: Users click Enroll on any published course. This creates a course_enrollment record with:\n— Enrollment date\n— Progress percentage (auto-calculated)\n— Last accessed timestamp\n— Completion date\n— Rating (1–5 stars, via the rate_course() function)\n\nLESSON PROGRESS: Each lesson completed is tracked in course_lesson_progress. Completing lessons automatically updates the enrollment progress percentage via a database trigger.\n\nCOURSE TYPES:\n— SYSTEM: Official Screenplay Studio courses (created by admin/platform team)\n— USER: Community-created courses (available to level 10+ users)\n\nRatings: The rate_course() function handles rating with proper average calculation — it subtracts the old rating before adding the new one, keeping rating_sum and rating_count accurate without race conditions.\n\nSystem courses preloaded on the platform:\n— Screenplay Formatting Fundamentals (45 min, beginner, 200 XP)\n— Writing Compelling Themes (60 min, intermediate, 150 XP)\n— Three-Act Structure Deep Dive (50 min, beginner, 175 XP)"
  },
  {
    "order": 50,
    "heading": "The Blog — Stories Behind the Build",
    "body": "The Screenplay Studio Blog exists for one reason: to document what is being built, why it was built, and what comes next.\n\nBlog posts support:\n— A title, slug, and excerpt\n— A cover image\n— Sections (JSONB array of {heading, body, order} — the same structure you are reading right now)\n— Tags\n— Status: draft / published / archived\n— Comment section (threaded, moderated)\n— View counter\n\nBlog comments support:\n— Threading (reply to a comment)\n— Pinning (admin can pin important comments to the top)\n— Hiding (admin can remove spam/violations without deleting)\n— Logged-in only posting (no anonymous noise)\n\nAccess policies:\n— Anyone can read published posts (logged in or not)\n— Only logged-in users can comment\n— Only the admin can create, edit, or delete posts\n— Users can edit their own comments; admin can delete any comment\n\nThis blog post itself is a test of the blog system — and somehow the most meta thing on the platform."
  },
  {
    "order": 51,
    "heading": "Festival Bridge — Submit to Festivals",
    "body": "The Festival Bridge module connects your finished project to the film festival circuit.\n\nIt stores:\n— Festival name, location, and website\n— Submission deadline\n— Submission fee\n— Submission status: researching / preparing / submitted / confirmed / declined / screening / won / not selected\n— Submission date\n— Result date\n— Category/award track (e.g. Best Short Film, Best Screenplay, Grand Jury)\n— Notes\n— Contact at the festival\n— Submission materials checklist (logline done, screener uploaded, press kit ready, etc.)\n\nThe Festival Bridge dashboard shows your entire festival strategy at a glance: which festivals you are targeting, which deadlines are coming up, which submissions are pending, and which films are screening where.\n\nInternational festival data (using the festival_bridge migration tables) connects to a community-maintained directory of festivals with their historical acceptance rates, average scores, and submission tips shared by other members who entered."
  },
  {
    "order": 52,
    "heading": "Project Templates — Start Smart",
    "body": "Starting a new project from scratch is inefficient if you always need the same structure. Project Templates solve this.\n\nYou can save any project as a template:\n— The script structure (scenes, elements) is saved\n— Character archetypes (if you have recurring character types)\n— Location types\n— Standard shot list templates\n— Budget category structure with common line items pre-populated\n— Ideas board initial columns\n— Production schedule event types relevant to your workflow\n\nWhen creating a new project, choose a template and everything is cloned into the new project. Edit from there.\n\nSystem templates (provided by the platform) cover common formats:\n— Feature Film: three-act breakdown with act 1/2/3 scenes pre-labeled\n— TV Pilot: cold open + 4 acts + tag structure\n— Short Film (10-15 min): lean 2-act structure\n— Documentary: interview setup + B-roll structure\n— Stage Play: two-act structure with scene/beat breakdown\n\nCustom templates you create are private to your account by default, or you can publish them to the Community for others to use."
  },
  {
    "order": 53,
    "heading": "Multi-Location Markers — One Scene, Many Places",
    "body": "A scripted location is often not a single real-world place. The coffee shop where your protagonist has their breakdown was actually shot:\n— Exterior: a cafe in Brooklyn\n— Interior booth scenes: a studio set in Burbank\n— Counter scenes: a different cafe in Williamsburg\n\nMulti-Location Markers let you attach multiple physical location records to a single scripted location (and by extension, to the scenes that use that location).\n\nEach marker stores:\n— The scripted location it refers to\n— The physical location record (from the locations database)\n— Which portion of scenes use this physical location (exterior / interior / close-ups / etc.)\n— Notes for the AD and location manager\n\nThis is a small feature with enormous practical value: scouting reports, call sheets, and location release forms can be generated per physical location rather than per scripted location, which matches how actual production management works."
  },
  {
    "order": 54,
    "heading": "Full-Text Search — Find Anything",
    "body": "Screenplay Studio supports full-text search across your script content, powered by PostgreSQL's native GIN indexes.\n\nThe script_elements table has a GIN full-text search index on the content column:\n  idx_script_elements_content_search using gin(to_tsvector('english', content))\n\nThis means searching for a word or phrase returns results in milliseconds across scripts of any length. The search respects stemming (searching for 'run' finds 'running', 'ran', 'runs') and stop-word filtering.\n\nCharacter names are indexed with trigram (pg_trgm) search:\n  idx_characters_name_search using gin(name gin_trgm_ops)\n\nThis enables fuzzy name matching — searching for 'Samantha' can surface 'Sam', 'Sami, 'Sammy' etc. Great for tracking down a character whose name changed mid-draft.\n\nCommunity posts, blog posts, and courses are also full-text searchable via their respective indexes."
  },
  {
    "order": 55,
    "heading": "The Admin Kingdom — Site Settings",
    "body": "The admin has a site-wide settings panel that controls platform-level defaults and toggles.\n\nSite settings include:\n— Platform name and tagline (for white-label deployments)\n— Maintenance mode flag (takes the whole platform into a read-only maintenance screen)\n— Registration open/closed flag\n— Default feature flag states (the starting values for all feature toggles)\n— Email configuration (SMTP settings for notifications)\n— Storage quotas per tier (free vs Pro file storage limits)\n— Rate limits per endpoint\n— Community moderation settings (auto-hide threshold for reported content, cooldown periods)\n— Challenge auto-generation toggle (turn off auto-weekly if you want manual control)\n— XP multiplier for special events (double XP weekends, etc.)\n— Announcement banner text and status\n\nSite settings are stored in the site_settings_schema table with a single row (one global config). The admin UUID is the only user who can read or write to this table."
  },
  {
    "order": 56,
    "heading": "Auto-Trigger Magic — The Invisible Glue",
    "body": "The database has a network of trigger functions that keep everything consistent automatically. Here is the complete list:\n\nON USER SIGNUP: handle_new_user() auto-creates a profiles row populated from OAuth metadata (name, avatar URL, email).\n\nON PROJECT CREATED: handle_new_project() auto-inserts the creator as project owner in project_members.\n\nON PROJECT CREATED: handle_new_project_script() auto-creates the first draft script titled [Project Title] — Draft 1.\n\nON CAST MEMBER UPDATE: update_cast_member_updated_at() keeps updated_at current.\n\nON ANY UPDATE: update_updated_at_column() runs on profiles, projects, scripts, script_elements, characters, locations, scenes, shots, production_schedule, ideas, budget_items, comments, and others.\n\nON CHALLENGE VOTE: cascade updates vote_count on the submission.\n\nON COMMUNITY UPVOTE TOGGLE: toggle_community_upvote() atomically updates upvote_count.\n\nON COURSE LESSON COMPLETION: sync_course_progress() recalculates the enrollment progress percentage and sets completed_at on first 100% completion.\n\nON COURSE ENROLLMENT: bump_course_enrollment() increments enrollment_count on the course.\n\nNone of this is application logic you have to remember and call — it just happens. The database enforces its own consistency."
  },
  {
    "order": 57,
    "heading": "The Big Picture — Who Is This Platform For?",
    "body": "After all of that — and congratulations for making it this far — here is the answer to the question we should have started with.\n\nScreenplay Studio is for:\n\nTHE SOLO WRITER: who wants a distraction-free, properly formatted, auto-saving script editor that does not cost $400/year and does not require a desktop app.\n\nTHE WRITING TEAM: who needs real-time co-authoring, inline comments, role-based access, and a shared schedule — without the back-and-forth of emailing Word documents.\n\nTHE INDIE FILMMAKER: who needs the script AND the production tools AND the cast payroll AND the schedule AND the documents in one place, because they cannot afford separate software for each department.\n\nTHE SHOWRUNNER: who needs arc tracking, episode management, a season-level view, a writers room communication tool, and role-controlled access for a team of 12 writers.\n\nTHE WRITING STUDENT: who wants to build a portfolio, get feedback from the community, participate in weekly challenges, earn XP for actually writing, and learn from structured courses.\n\nTHE PRODUCTION COMPANY: who needs client whitelabeling, project templates, multi-project dashboard folders, a full team permission system, and centralized document storage.\n\nTHE HOBBYIST: who just wants to write something fun, share it with the community, and see if it gets upvoted. No judgment. Some of the best scripts on the platform come from this group.\n\nWhatever you are making — feature, short, series, podcast, play, or the one-page sketch you wrote at 2am — Screenplay Studio is built to hold all of it. Welcome to the platform."
  }
]
$sections$::jsonb,

  ARRAY[
    'guide',
    'features',
    'platform',
    'tutorial',
    'screenwriting',
    'production',
    'community',
    'gamification',
    'courses',
    'payroll',
    'collaboration'
  ],

  'published',

  NOW(),

  'f0e0c4a4-0833-4c64-b012-15829c087c77',

  true
);

-- ---------------------------------------------------------------------
-- Source: supabase/blog_post_og_feedback_announcement.sql
-- ---------------------------------------------------------------------
-- Blog post: OG embeds + feedback system + testimonials announcement
-- Run in Supabase SQL editor

INSERT INTO blog_posts (
  slug,
  title,
  excerpt,
  tags,
  status,
  published_at,
  author_id,
  allow_comments,
  sections
)
VALUES (
  'link-previews-feedback-reviews',
  'your links finally look good (also we have a feedback page now)',
  'discord embeds that don''t look terrible, a whole feedback/roadmap section, and a reviews wall. shipped at 2am. you''re welcome.',
  ARRAY['updates', 'features', 'feedback', 'community'],
  'published',
  NOW(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77',
  true,
  $sections$
  [
    {
      "order": 1,
      "heading": "ok so i fixed the discord thing",
      "body": "you know how when you pasted a screenplaystudio.fun link into discord it just showed like... the site name and nothing else? yeah that was embarrassing. it's fixed now.\n\nevery page on the site now generates a proper embed with actual useful info. post pages show the title, who wrote it, and how many upvotes/comments it has. blog posts show the author. bug reports show what kind of report it is. reviews show the star rating.\n\nand they actually look good?? like the design matches the site. dark background, orange accent, the whole thing. i spent way too long on this."
    },
    {
      "order": 2,
      "heading": "we have a feedback page now",
      "body": "go to [screenplaystudio.fun/feedback](https://screenplaystudio.fun/feedback) and you can submit bug reports, feature requests, or just yell into the void. it's all public so you can see what other people have reported, upvote stuff, and leave comments on individual items.\n\nthe status system actually works too. things move from Open to Planned to In Progress to Resolved. there's also Won't Fix and Intended Behavior for the classic 'that's not a bug' moments.\n\ni built this mostly because i kept losing track of things people told me in discord dms. now there's a real place for it."
    },
    {
      "order": 3,
      "heading": "there's a reviews page",
      "body": "if you've been using screenplay studio and like it (or hate it, honestly works either way), you can leave a review at [screenplaystudio.fun/feedback](https://screenplaystudio.fun/feedback) and tick the testimonial option.\n\nall the approved ones show up at [screenplaystudio.fun/testimonials](https://screenplaystudio.fun/testimonials) in this big grid wall thing. you can filter by star rating, click one to read it properly, and see if anyone's commented on it. the average rating is shown huge at the top which is either going to be very good or very bad for me personally.\n\nplease be honest. bad reviews make me improve things faster."
    },
    {
      "order": 4,
      "heading": "also some smaller stuff",
      "body": "the feedback detail pages let you see the full report, admin updates, and leave comments if you're signed in. the admin panel got a proper sidebar so it doesn't look like a forgotten settings page anymore.\n\nalso votes on the feedback page no longer redirect you to the login page if you're already logged in but the page hasn't fully loaded yet. that was a fun bug."
    },
    {
      "order": 5,
      "heading": "what's next",
      "body": "probably sleep. but after that, whatever gets the most upvotes on the feedback page. that's kind of the whole point of building it.\n\nif something is broken please tell me at [screenplaystudio.fun/feedback](https://screenplaystudio.fun/feedback) instead of suffering in silence. i cannot fix things i don't know are broken."
    }
  ]
  $sections$
);

-- ---------------------------------------------------------------------
-- Source: supabase/blog_schema.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- BLOG SCHEMA — Screenplay Studio Dev Blog
-- ============================================================

-- Blog post status
CREATE TYPE blog_post_status AS ENUM ('draft', 'published', 'archived');

-- ============================================================
-- BLOG POSTS
-- ============================================================

CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  cover_image_url TEXT,
  -- sections stored as JSONB array: [{ heading, body, order }]
  sections JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}',
  status blog_post_status DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  allow_comments BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts
CREATE POLICY "Published blog posts are public"
  ON blog_posts FOR SELECT USING (status = 'published' OR auth.uid() IS NOT NULL);

-- Only admin can insert/update/delete
CREATE POLICY "Admin can manage blog posts"
  ON blog_posts FOR ALL USING (
    auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
  );

-- Index for slug lookups and listing
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status, published_at DESC);

-- ============================================================
-- BLOG COMMENTS
-- ============================================================

CREATE TABLE blog_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name TEXT, -- for non-logged-in users
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read visible comments
CREATE POLICY "Blog comments are public"
  ON blog_comments FOR SELECT USING (is_hidden = false OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

-- Logged-in users can insert comments
CREATE POLICY "Logged in users can comment"
  ON blog_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON blog_comments FOR UPDATE USING (auth.uid() = author_id);

-- Admin can delete any comment
CREATE POLICY "Admin can delete comments"
  ON blog_comments FOR DELETE USING (
    auth.uid() = author_id OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
  );

CREATE INDEX idx_blog_comments_post ON blog_comments(post_id, created_at);
CREATE INDEX idx_blog_comments_parent ON blog_comments(parent_id);

-- ============================================================
-- Auto-update updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION update_blog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_blog_updated_at();

CREATE TRIGGER blog_comments_updated_at
  BEFORE UPDATE ON blog_comments
  FOR EACH ROW EXECUTE FUNCTION update_blog_updated_at();

-- ---------------------------------------------------------------------
-- Source: supabase/blog_vercel_analytics_transparency.sql
-- ---------------------------------------------------------------------
-- Legal blog post: Vercel Analytics transparency notice
-- Run in Supabase SQL editor

INSERT INTO legal_posts (
  slug,
  title,
  summary,
  content,
  category,
  severity,
  published,
  published_at,
  author_id,
  notify_users,
  tags
)
VALUES (
  'we-added-analytics-heres-exactly-what-that-means',
  'We added analytics. Here''s exactly what that means.',
  'We now use Vercel Analytics to see basic traffic data. No cookies, no tracking, no personal data stored. Full disclosure.',
  $content$
## What we added

We've added [Vercel Analytics](https://vercel.com/analytics) to Screenplay Studio. It's a tool that tells us things like how many people visited the site today, which pages are popular, and roughly where in the world traffic comes from.

That's it. Nothing sinister. But because this is the kind of thing you deserve to know about, here's every detail.

## What it actually collects

Every time you load a page, Vercel Analytics records:

- **The page URL** — so we know /dashboard is more popular than /blog
- **Your referrer** — the page you came from (if any)
- **Your browser and OS** — the user-agent string, e.g. "Chrome 122 on macOS"
- **Device type** — desktop, mobile, or tablet
- **Country** — derived from your IP address, then immediately discarded

That last point is worth emphasising. Your IP address is used for one second to figure out which country you're probably in, then it's gone. It is not logged, not stored, not linked to anything.

## What it does NOT collect

- No cookies. Vercel Analytics is fully cookieless.
- No persistent user identifier. There is no session ID, no fingerprint, nothing that follows you across page loads or visits.
- No personal information. We cannot see your name, email, account, or anything about who you specifically are.
- No cross-site tracking. This only runs on screenplaystudio.fun.
- No advertising data. We are not in the advertising business. This data is never sold, never shared with ad networks, never used to build profiles.

If you loaded the same page a hundred times, we'd see a hundred page views. We would not know it was you.

## Why we added it at all

Honestly, we were flying completely blind. We had no idea if anyone was actually using the arc planner, or if the storyboard feature was getting any traction, or which parts of the platform people spent time in.

Building in the dark is fine philosophically but practically it means spending two weeks building something nobody wanted and zero time on something everyone was waiting for.

Vercel Analytics gives us enough signal to make better decisions about what to work on next. The tradeoff is that you send a small amount of anonymised data when you visit a page. We think that's a reasonable tradeoff, but we wanted to be upfront about it rather than just quietly adding a script tag.

## Legal basis and the privacy policy update

Under GDPR, we're processing this data under **legitimate interests** (Article 6(1)(f)) — specifically, our interest in operating and improving the Service. Because Vercel Analytics doesn't use cookies and doesn't collect personal data, it doesn't require explicit cookie consent under the ePrivacy Directive.

We've updated our [Privacy Policy](/legal/privacy#vercel-analytics) with a dedicated section (§14.1) explaining all of this in full. If you want the formal version, it's there.

If you prefer not to be counted at all, a browser content blocker or enabling Do Not Track will do the job.

## Questions

If something about this doesn't sit right with you, open a thread on the [feedback board](/feedback) or reach out directly. We'd rather have a conversation about analytics than have you not trust the platform.

Transparency is the whole point of writing posts like this.
  $content$,
  'transparency_report',
  'info',
  true,
  NOW(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77',
  true,
  ARRAY['transparency', 'privacy', 'analytics', 'vercel']
);


-- Changelog entry
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Vercel Analytics added',
  'Added privacy-first, cookieless Vercel Analytics for aggregate page traffic. No PII stored, no cookies set. Privacy Policy updated with full disclosure (§14.1).',
  'internal',
  'performance',
  true,
  (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM changelog_entries ce2
   WHERE ce2.release_id = (SELECT id FROM changelog_releases ORDER BY created_at DESC LIMIT 1))
FROM changelog_releases ORDER BY created_at DESC LIMIT 1;

-- ---------------------------------------------------------------------
-- Source: supabase/changelog_2_7_0.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Changelog: 2.7.0 — Character Visual Profiles
-- ============================================================

-- Create the 2.7.0 draft release
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.0',
  'Character Visual Profiles',
  'Characters now have a rich detail panel with inspiration images, actor reference photos, and versioned production reference folders for makeup and costume.',
  'minor'
)
ON CONFLICT (version) DO NOTHING;

-- Feature: character detail panel (click-to-view, then edit)
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Character Detail Panel',
  'Clicking a character card now opens a read-only detail panel instead of jumping straight into edit mode. The panel shows a full overview of the character — description, backstory, arc, personality traits, appearance, and voice notes — with an Edit button to open the editor.',
  'feature',
  'characters',
  true,
  10
FROM changelog_releases WHERE version = '2.7.0'
ON CONFLICT DO NOTHING;

-- Feature: inspiration board (link-based)
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Inspiration Board',
  'Characters have a new Inspiration tab in their detail panel. Paste any image URL to build a mood board capturing the character''s vibe, look, or aesthetic. Images are displayed in a grid with optional captions and can be removed with one click.',
  'feature',
  'characters',
  true,
  20
FROM changelog_releases WHERE version = '2.7.0'
ON CONFLICT DO NOTHING;

-- Feature: actor reference photo
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Actor Reference Photo',
  'The Actor tab in the character detail panel lets you link a reference photo showing how the character should look — an actor headshot, a character design, or a casting reference. Existing cast actor name and casting notes are also shown here.',
  'feature',
  'characters',
  true,
  30
FROM changelog_releases WHERE version = '2.7.0'
ON CONFLICT DO NOTHING;

-- Feature: production reference folders
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Production Reference Folders',
  'The Production tab gives makeup, costume, and other departments a place to store versioned reference image folders directly on the character. Create folders like "Version 1", "Final Look", or "Early Design" — each typed as Makeup, Costume, or Other — and fill them with linked reference images.',
  'feature',
  'characters',
  true,
  40
FROM changelog_releases WHERE version = '2.7.0'
ON CONFLICT DO NOTHING;

-- Internal: DB migration for new character columns
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Character visual columns migration',
  'Added actor_photo_url (TEXT), inspo_images (JSONB), and reference_folders (JSONB) columns to the characters table. All default to empty/null and are safe to migrate with no data loss.',
  'internal',
  'database',
  false,
  50
FROM changelog_releases WHERE version = '2.7.0'
ON CONFLICT DO NOTHING;

-- Feature: actor avatar linked to cast member
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Actor Photo as Character Avatar',
  'Character avatars now show the actor''s photo. You can link a character to an existing cast member record from the Actors page — their photo auto-populates the character avatar and casting fields. You can also paste a photo URL directly without linking a cast member record.',
  'feature',
  'characters',
  true,
  55
FROM changelog_releases WHERE version = '2.7.0'
ON CONFLICT DO NOTHING;

-- Internal: cast_member_id FK on characters
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'characters.cast_member_id FK',
  'Added cast_member_id UUID FK referencing cast_members(id) ON DELETE SET NULL to the characters table.',
  'internal',
  'database',
  false,
  60
FROM changelog_releases WHERE version = '2.7.0'
ON CONFLICT DO NOTHING;

-- Publish the release
SELECT publish_release('2.7.0');

-- ---------------------------------------------------------------------
-- Source: supabase/changelog_2_7_1.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Changelog: 2.7.1 — Security Hardening & Performance
-- ============================================================

INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.1',
  'Security Hardening & Performance',
  'Expanded AI scraper blocking, tightened Content Security Policy, faster page loads via bundle optimisation, and an updated Privacy Policy covering community @mentions and collaborator credits.',
  'patch'
)
ON CONFLICT (version) DO NOTHING;

-- ── Security: expanded AI bot blocking ───────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Expanded AI Scraper Blocking',
  'The bot-blocklist now covers Grok/xAI, DuckAssistBot, OAI-SearchBot, Mistral-AI, CommonCrawl, img2dataset, PetalBot, Scrapy, and Turnitin harvester — blocked at both the middleware level (UA detection) and in robots.txt. All blocked bots previously only in the middleware are now also listed in robots.txt for standards compliance.',
  'security',
  'performance',
  true,
  10
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Security: messages route protection ──────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Messages Route Auth Gate',
  '/messages is now enforced as a protected route in middleware — unauthenticated requests are redirected to login. Previously the route was listed in robots.txt disallow but not protected server-side.',
  'security',
  'auth',
  false,
  20
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Security: CSP hardening ───────────────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Content Security Policy Hardened',
  'unsafe-eval is now stripped from the CSP in production builds — it is only present in development for Next.js Fast Refresh. form-action now explicitly whitelists PayPal. object-src ''none'' added to block Flash/plugin injection vectors.',
  'security',
  'admin',
  false,
  30
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Security: UA fingerprint check ───────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Empty User-Agent Blocking',
  'Middleware now rejects requests with an empty or suspiciously short (<10 char) User-Agent. Legitimate browsers always carry a non-trivial UA string; empty UAs are a classic headless-scraper signal.',
  'security',
  'performance',
  false,
  40
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Security: X-Robots-Tag blanket AI opt-out ────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Sitewide AI Opt-Out Header',
  'X-Robots-Tag: noai, noimageai is now served on every page (not just /community and /share). User profile pages (/u/*) also now receive the AI opt-out tag.',
  'security',
  'admin',
  true,
  50
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Performance: lucide-react / date-fns tree-shaking ────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Bundle Tree-Shaking for Icons & Dates',
  'Enabled optimizePackageImports for lucide-react, date-fns, and sonner. Next.js now tree-shakes these libraries at build time, shipping only the icons and date functions actually used. Expect measurable reductions in JS bundle size.',
  'performance',
  'performance',
  true,
  60
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Performance: console stripping in production ─────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Production Console Strip',
  'console.log and console.debug calls are now automatically removed from production builds by the Next.js compiler. console.error and console.warn are retained.',
  'performance',
  'performance',
  false,
  70
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Performance: static asset caching ────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Aggressive Static Asset Caching',
  'Cache-Control headers are now set explicitly: /_next/static/* gets immutable 1-year caching (content-hashed filenames guarantee no stale hits), optimised images get 7-day browser caching with stale-while-revalidate, and public static files (fonts, icons) get 30-day caching.',
  'performance',
  'performance',
  true,
  80
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Performance: AVIF image format support ───────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'AVIF Image Format Support',
  'Next.js image optimisation now serves AVIF (then WebP, then original) to browsers that support it. AVIF averages 50% smaller than JPEG at equivalent quality.',
  'performance',
  'performance',
  true,
  90
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Performance: turbopack dev server ────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Turbopack Dev Server',
  'Local development now uses Next.js Turbopack (--turbopack flag). Turbopack delivers significantly faster cold-start and hot-reload times compared to webpack.',
  'performance',
  'admin',
  false,
  100
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Privacy: policy update ────────────────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Privacy Policy Updated (March 2026)',
  'Privacy Policy updated to March 18, 2026. New disclosures added for community @mentions (Section 2.6) and collaborator credits (Section 2.6), with corresponding retention table entries. Automated Decision-Making section (Section 17) now documents @mention parsing and bot detection. form-action PayPal addition noted under security measures.',
  'improvement',
  'admin',
  true,
  110
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Source: supabase/changelog_2_7_2.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Changelog: 2.7.2 — Security Patches & SEO Fixes
-- ============================================================

INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.2',
  'Security Patches & SEO Fixes',
  'Patched an unauthenticated API endpoint, added rate limiting to the public feedback form, fixed the sitemap (cached + 8 missing pages), and tightened robots.txt coverage.',
  'patch'
)
ON CONFLICT (version) DO NOTHING;

-- ── Security: automod route was unauthenticated ───────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Automod Route Authentication',
  '/api/automod had no authentication check, allowing any external caller to trigger database writes (including hiding posts). It now requires the PUSH_API_SECRET internal header, consistent with the push notification and email routes.',
  'security',
  'admin',
  false,
  10
FROM changelog_releases WHERE version = '2.7.2'
ON CONFLICT DO NOTHING;

-- ── Security: feedback/submit rate limiting ───────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Feedback Submission Rate Limiting',
  '/api/feedback/submit now enforces a server-side rate limit of 5 anonymous submissions per IP per 15 minutes. This prevents the public bug report / feature request form from being used to flood the feedback_items table with the service role key.',
  'security',
  'admin',
  false,
  20
FROM changelog_releases WHERE version = '2.7.2'
ON CONFLICT DO NOTHING;

-- ── SEO: sitemap caching ──────────────────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Sitemap Now Cached (30-min Revalidation)',
  'The sitemap was previously set to force-dynamic, meaning Next.js regenerated it on every single request — including Googlebot crawls. It now uses revalidate = 1800, serving a cached response and regenerating in the background every 30 minutes.',
  'performance',
  'performance',
  false,
  30
FROM changelog_releases WHERE version = '2.7.2'
ON CONFLICT DO NOTHING;

-- ── SEO: missing sitemap pages ────────────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Sitemap: 8 Missing Pages Added',
  'Added /about, /press, /testimonials, /licenses, /contribute, /feedback, /changelog, and /u/ (user profiles) to the sitemap static pages list. These valid public pages were previously invisible to search engines.',
  'improvement',
  'admin',
  false,
  40
FROM changelog_releases WHERE version = '2.7.2'
ON CONFLICT DO NOTHING;

-- ── SEO: robots.txt improvements ─────────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'robots.txt: Explicit Allow & Disallow Lists',
  'Added /about, /press, /testimonials, /licenses, /contribute, /feedback, /changelog, /u/ to the allow list. Added /idea-boards, /accountability, and /casting to the disallow list for the default user-agent (these are auth-gated or user-private pages).',
  'improvement',
  'admin',
  false,
  50
FROM changelog_releases WHERE version = '2.7.2'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Source: supabase/changelog_2_7_3.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Changelog: 2.7.3 — Push Notifications Overhaul
-- ============================================================

-- Create the 2.7.3 draft release
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.3',
  'Push Notifications Overhaul',
  'Fixed push notifications that have never worked due to an architecture flaw, and added tab title badges, a Web Audio notification ping, and cross-device push delivery.',
  'patch'
)
ON CONFLICT (version) DO NOTHING;

-- Fix: push notifications now actually work
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Push Notifications Fixed',
  'Push notifications were silently failing on every event due to a missing authentication header — the server-only secret was never sent, so every push call returned 401 and was discarded. The architecture has been corrected: push is now triggered from the recipient''s device using their own session token, which is sent as a Bearer header. The push endpoint also gains a dual-auth path — internal server calls still use the secret header, while client calls use the session token and are restricted to the caller''s own subscriptions.',
  'fix',
  'api',
  true,
  10
FROM changelog_releases WHERE version = '2.7.3'
ON CONFLICT DO NOTHING;

-- Feature: tab title notification badge
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Tab Title Notification Badge',
  'The browser tab title now shows an unread count when you have unread notifications — e.g. "(3) Screenplay Studio". The count updates in real time as new notifications arrive and clears back to "Screenplay Studio" when you have no unread items.',
  'feature',
  'ui',
  true,
  20
FROM changelog_releases WHERE version = '2.7.3'
ON CONFLICT DO NOTHING;

-- Feature: in-browser notification sound
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Notification Sound',
  'High-priority notifications (direct messages, mentions, invitations, task assignments) now play a subtle two-tone ping when the tab is not focused. The sound is synthesised via the Web Audio API — no audio file is needed and it works offline. Low-priority events like upvotes are intentionally excluded to reduce noise.',
  'feature',
  'ui',
  true,
  30
FROM changelog_releases WHERE version = '2.7.3'
ON CONFLICT DO NOTHING;

-- Feature: cross-device push
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Push to Your Other Devices',
  'When a high-priority notification arrives on an active session, it now also pushes to all of the user''s other subscribed devices. This means a notification received while you are on your laptop will still appear as a native system notification on your phone (and vice versa), as long as push is enabled on that device.',
  'feature',
  'ui',
  true,
  40
FROM changelog_releases WHERE version = '2.7.3'
ON CONFLICT DO NOTHING;

-- Internal: service worker cache version bump
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Service Worker Cache Bump (ss-v4)',
  'Bumped the PWA service worker cache version from ss-v1 to ss-v4 to invalidate stale caches on existing installations and pick up the updated push handling logic.',
  'internal',
  'performance',
  false,
  50
FROM changelog_releases WHERE version = '2.7.3'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Source: supabase/changelog_2_7_4.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Changelog 2.7.4 — Share System Overhaul
-- ============================================================

-- 1. Create the new release
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.4',
  'New Share System',
  'Replaced Share Portal and Client Review with a streamlined token-based sharing system.',
  'minor'
);

-- 2. Changelog entries

-- Token-based share links
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'New share links system',
  'Replaced Share Portal and Client Review with a clean, token-based sharing system. Create named links that grant access to specific sections — script, characters, scenes, schedule, or documents — with no login required.',
  'feature',
  'ui',
  true,
  10
FROM changelog_releases WHERE version = '2.7.4';

-- Invite links
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Invite links',
  'Share links can optionally be set as invite links. When someone opens an invite link they are prompted to sign in or create an account, then automatically added to the project with the chosen role (viewer, commenter, or editor).',
  'feature',
  'collaboration',
  true,
  20
FROM changelog_releases WHERE version = '2.7.4';

-- Permission control
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Per-link content permissions',
  'Each share link carries its own set of permissions. Enable only the sections you want the recipient to see. Useful for sharing a script draft without exposing the full production schedule.',
  'feature',
  'ui',
  true,
  30
FROM changelog_releases WHERE version = '2.7.4';

-- View tracking
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'View count tracking',
  'Each link tracks how many times it has been opened. View count is shown on the share management page.',
  'improvement',
  'ui',
  true,
  40
FROM changelog_releases WHERE version = '2.7.4';

-- Token regeneration
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Regenerate or deactivate links',
  'Instantly invalidate a shared link by regenerating its token or deactivating it entirely — without deleting the link record.',
  'feature',
  'ui',
  true,
  50
FROM changelog_releases WHERE version = '2.7.4';

-- DB: new table
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'project_share_links table',
  'New table replaces external_shares and review_sessions. Includes RLS, accept_share_invite(), increment_share_link_views(), and regenerate_share_link_token() SECURITY DEFINER functions.',
  'internal',
  'database',
  false,
  60
FROM changelog_releases WHERE version = '2.7.4';

-- 3. Publish
SELECT publish_release('2.7.4');

-- ---------------------------------------------------------------------
-- Source: supabase/changelog_2_7_5.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Changelog 2.7.5 — Poll Push Notifications
-- ============================================================

-- 1. Create the new release
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.5',
  'Poll Push Notifications',
  'Added ability for admins to send push notifications to all users about published polls.',
  'patch'
);

-- 2. Add changelog entries
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Poll Push Notifications',
  'Admins can now send push notifications to all users for published polls from the admin panel. This allows re-engaging users with polls they may have missed.',
  'feature', 'admin', true, 10
FROM changelog_releases WHERE version = '2.7.5';

-- 3. Publish the release
SELECT publish_release('2.7.5');
-- ---------------------------------------------------------------------
-- Source: supabase/changelog_2_7_6.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- Changelog 2.7.6 — Live Active Users Dashboard
-- ============================================================

-- 1. Create the new release
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.6',
  'Live Active Users Dashboard',
  'Added real-time active user counts to the admin dashboard showing users active in the last 5 minutes, 15 minutes, and 1 hour.',
  'feature'
);

-- 2. Add changelog entries
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Live Active Users Tracking',
  'Admin dashboard now shows real-time counts of users active within the last 5 minutes, 15 minutes, and 1 hour. User activity is tracked globally across the platform.',
  'feature', 'admin', true, 10
FROM changelog_releases WHERE version = '2.7.6';

-- 3. Publish the release
SELECT publish_release('2.7.6');
\n-- Utility debug script
-- ---------------------------------------------------------------------
-- Source: supabase/debug_images.sql
-- ---------------------------------------------------------------------
-- ============================================================
-- IMAGE DEBUG — run in Supabase SQL Editor
-- Paste ALL of this, run it, and share the output
-- ============================================================

-- 1. What buckets exist and their public status?
SELECT id, name, public, file_size_limit
FROM storage.buckets
ORDER BY id;

-- 2. What policies exist on storage.objects?
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- 3. What URL format is stored in cover_url?
-- Shows first 120 chars + what type of URL it is
SELECT
  id,
  title,
  LEFT(cover_url, 120) AS cover_url_preview,
  CASE
    WHEN cover_url IS NULL      THEN 'NULL'
    WHEN cover_url LIKE 'data:%' THEN 'data: base64 (stored locally)'
    WHEN cover_url LIKE 'https://%.supabase.co/storage%' THEN 'Supabase Storage URL'
    WHEN cover_url LIKE 'blob:%'  THEN 'blob: URL (will not persist!)'
    ELSE 'External URL'
  END AS url_type
FROM projects
WHERE cover_url IS NOT NULL
LIMIT 20;

-- 4. Do the files actually exist in the project-covers bucket?
SELECT name, bucket_id, created_at, (metadata->>'size')::int AS size_bytes
FROM storage.objects
WHERE bucket_id = 'project-covers'
ORDER BY created_at DESC
LIMIT 20;
