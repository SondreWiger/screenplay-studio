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
