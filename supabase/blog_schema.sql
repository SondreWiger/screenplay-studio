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
