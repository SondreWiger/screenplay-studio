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
DROP TYPE IF EXISTS public.user_role CASCADE;


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

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'writer', 'editor', 'viewer');
CREATE TYPE project_status AS ENUM ('development', 'pre_production', 'production', 'post_production', 'completed', 'archived');
CREATE TYPE script_element_type AS ENUM (
  'scene_heading', 'action', 'character', 'dialogue', 'parenthetical',
  'transition', 'shot', 'note', 'page_break', 'title_page',
  'centered', 'lyrics', 'synopsis', 'section'
);
CREATE TYPE scene_time AS ENUM ('DAY', 'NIGHT', 'DAWN', 'DUSK', 'MORNING', 'AFTERNOON', 'EVENING', 'CONTINUOUS', 'LATER', 'MOMENTS_LATER');
CREATE TYPE scene_location_type AS ENUM ('INT', 'EXT', 'INT_EXT', 'EXT_INT');
CREATE TYPE revision_color AS ENUM ('white', 'blue', 'pink', 'yellow', 'green', 'goldenrod', 'buff', 'salmon', 'cherry', 'tan');
CREATE TYPE idea_status AS ENUM ('spark', 'developing', 'ready', 'used', 'discarded');
CREATE TYPE idea_category AS ENUM ('plot', 'character', 'dialogue', 'visual', 'sound', 'location', 'prop', 'costume', 'effect', 'theme', 'other');
CREATE TYPE schedule_event_type AS ENUM ('shooting', 'rehearsal', 'location_scout', 'meeting', 'setup', 'wrap', 'travel', 'break', 'other');
CREATE TYPE shot_type AS ENUM (
  'wide', 'full', 'medium_wide', 'medium', 'medium_close', 'close_up',
  'extreme_close', 'over_shoulder', 'two_shot', 'pov', 'aerial',
  'insert', 'cutaway', 'establishing', 'tracking', 'dolly',
  'crane', 'steadicam', 'handheld', 'static', 'dutch_angle'
);
CREATE TYPE shot_movement AS ENUM (
  'static', 'pan_left', 'pan_right', 'tilt_up', 'tilt_down',
  'dolly_in', 'dolly_out', 'truck_left', 'truck_right',
  'crane_up', 'crane_down', 'zoom_in', 'zoom_out',
  'follow', 'orbit', 'whip_pan', 'rack_focus'
);
CREATE TYPE budget_category AS ENUM (
  'above_the_line', 'below_the_line', 'production', 'post_production',
  'talent', 'locations', 'equipment', 'props_costumes', 'catering',
  'transportation', 'insurance', 'marketing', 'contingency', 'other'
);
CREATE TYPE comment_type AS ENUM ('note', 'suggestion', 'issue', 'resolved');

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'writer',
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
  storyboard_drawing JSONB DEFAULT '[]'::jsonb,
  storyboard_references JSONB DEFAULT '[]'::jsonb,
  storyboard_notes TEXT,
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

CREATE TABLE budget_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category budget_category DEFAULT 'other',
  subcategory TEXT,
  description TEXT NOT NULL,
  estimated_amount DECIMAL(12,2) DEFAULT 0,
  actual_amount DECIMAL(12,2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  unit_cost DECIMAL(10,2),
  vendor TEXT,
  invoice_ref TEXT,
  is_income BOOLEAN DEFAULT false,
  is_paid BOOLEAN DEFAULT false,
  due_date DATE,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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


-- ============================================================
-- 1) SECURITY DEFINER helper functions (bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_project_access(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND created_by = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_project_write_access(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND created_by = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
    AND role IN ('owner', 'admin', 'writer', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner_or_admin(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND created_by = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
    AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_script_access(p_script_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM scripts s
    JOIN projects p ON s.project_id = p.id
    WHERE s.id = p_script_id AND p.created_by = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM scripts s
    JOIN project_members pm ON s.project_id = pm.project_id
    WHERE s.id = p_script_id AND pm.user_id = p_user_id
  );
$$;

-- ============================================================
-- 2) DROP every existing policy (safe with IF EXISTS)
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

-- content tables
DROP POLICY IF EXISTS "Characters follow project access" ON characters;
DROP POLICY IF EXISTS "Locations follow project access" ON locations;
DROP POLICY IF EXISTS "Scenes follow project access" ON scenes;
DROP POLICY IF EXISTS "Shots follow project access" ON shots;
DROP POLICY IF EXISTS "Schedule follows project access" ON production_schedule;
DROP POLICY IF EXISTS "Ideas follow project access" ON ideas;
DROP POLICY IF EXISTS "Budget follows project access" ON budget_items;
DROP POLICY IF EXISTS "Comments follow project access" ON comments;
DROP POLICY IF EXISTS "Revisions follow script access" ON revisions;
DROP POLICY IF EXISTS "Presence follows project access" ON user_presence;

-- ============================================================
-- 3) Recreate ALL policies using the safe helper functions
-- ============================================================

-- PROJECTS
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

-- PROJECT MEMBERS
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

-- SCRIPTS
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

-- SCRIPT ELEMENTS
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

-- CHARACTERS
CREATE POLICY "Characters follow project access"
  ON characters FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- LOCATIONS
CREATE POLICY "Locations follow project access"
  ON locations FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- SCENES
CREATE POLICY "Scenes follow project access"
  ON scenes FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- SHOTS
CREATE POLICY "Shots follow project access"
  ON shots FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- PRODUCTION SCHEDULE
CREATE POLICY "Schedule follows project access"
  ON production_schedule FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- IDEAS
CREATE POLICY "Ideas follow project access"
  ON ideas FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- BUDGET ITEMS
CREATE POLICY "Budget follows project access"
  ON budget_items FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- COMMENTS
CREATE POLICY "Comments follow project access"
  ON comments FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

-- REVISIONS
CREATE POLICY "Revisions follow script access"
  ON revisions FOR ALL USING (
    public.has_script_access(script_id, auth.uid())
  );

-- USER PRESENCE
CREATE POLICY "Presence follows project access"
  ON user_presence FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );

COMMIT;
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

CREATE POLICY "Members can view their conversations" ON conversations
  FOR SELECT USING (id IN (
    SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update conversations" ON conversations
  FOR UPDATE USING (id IN (
    SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Members can view conversation members" ON conversation_members
  FOR SELECT USING (conversation_id IN (
    SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage conversation members" ON conversation_members
  FOR ALL USING (conversation_id IN (
    SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid() AND role = 'admin'
  ) OR user_id = auth.uid());

CREATE POLICY "Members can view messages" ON direct_messages
  FOR SELECT USING (conversation_id IN (
    SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can send messages" ON direct_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Senders can edit own messages" ON direct_messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE INDEX idx_dm_conversation ON direct_messages(conversation_id, created_at DESC);
CREATE INDEX idx_conv_members ON conversation_members(user_id);
CREATE INDEX idx_conv_last_msg ON conversations(last_message_at DESC);

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


COMMIT;


ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS showcase_moodboard BOOLEAN DEFAULT false;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS set_photos JSONB DEFAULT '[]';



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


COMMIT;


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
