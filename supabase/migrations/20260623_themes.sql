-- ── Theme Store System ─────────────────────────────────────────
-- Enables users to publish, browse, and share custom themes.
-- Works offline via IndexedDB sync; server stores for web + sharing.

-- Theme categories
CREATE TABLE IF NOT EXISTS theme_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO theme_categories (id, label, icon, sort_order) VALUES
  ('dark', 'Dark', '🌙', 1),
  ('light', 'Light', '☀️', 2),
  ('neon', 'Neon', '⚡', 3),
  ('pastel', 'Pastel', '🌸', 4),
  ('warm', 'Warm', '🔥', 5),
  ('cool', 'Cool', '❄️', 6),
  ('minimal', 'Minimal', '◻️', 7),
  ('retro', 'Retro', '📼', 8)
ON CONFLICT (id) DO NOTHING;

-- Published themes
CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,               -- short hash or UUID
  sha TEXT UNIQUE NOT NULL,          -- SHA-256 of theme JSON
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'dark',
  colors JSONB NOT NULL,             -- ThemeColors object
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name TEXT,
  is_public BOOLEAN DEFAULT true,
  is_staff_pick BOOLEAN DEFAULT false,
  staff_pick_week TEXT,              -- ISO week string e.g. '2026-W25'
  use_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_themes_category ON themes(category);
CREATE INDEX IF NOT EXISTS idx_themes_author ON themes(author_id);
CREATE INDEX IF NOT EXISTS idx_themes_staff_pick ON themes(is_staff_pick, staff_pick_week);
CREATE INDEX IF NOT EXISTS idx_themes_use_count ON themes(use_count DESC);
CREATE INDEX IF NOT EXISTS idx_themes_sha ON themes(sha);

-- Theme comments
CREATE TABLE IF NOT EXISTS theme_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id TEXT REFERENCES themes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theme_comments_theme ON theme_comments(theme_id);

-- Theme moderation queue
CREATE TABLE IF NOT EXISTS theme_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id TEXT REFERENCES themes(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',     -- pending, resolved, dismissed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Short URLs for theme sharing
CREATE TABLE IF NOT EXISTS theme_short_urls (
  code TEXT PRIMARY KEY,             -- short code e.g. 'a1b2c3'
  theme_id TEXT REFERENCES themes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theme_short_urls_theme ON theme_short_urls(theme_id);

-- RLS policies
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_short_urls ENABLE ROW LEVEL SECURITY;

-- Themes: public read, authenticated write
CREATE POLICY "Themes are viewable by everyone" ON themes FOR SELECT USING (is_public = true OR author_id = auth.uid());
CREATE POLICY "Users can insert themes" ON themes FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update own themes" ON themes FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete own themes" ON themes FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "Admins can do anything with themes" ON themes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Comments: public read, authenticated write
CREATE POLICY "Comments are viewable by everyone" ON theme_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON theme_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON theme_comments FOR DELETE USING (auth.uid() = user_id);

-- Short URLs: public read, authenticated write
CREATE POLICY "Short URLs are viewable by everyone" ON theme_short_urls FOR SELECT USING (true);
CREATE POLICY "Users can create short URLs" ON theme_short_urls FOR INSERT WITH CHECK (true);

-- Function to increment use count
CREATE OR REPLACE FUNCTION increment_theme_use_count(p_theme_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE themes SET use_count = use_count + 1 WHERE id = p_theme_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create a short URL
CREATE OR REPLACE FUNCTION create_theme_short_url(p_theme_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  i INT;
BEGIN
  -- Generate 6-char random code
  v_code := '';
  FOR i IN 1..6 LOOP
    v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
  END LOOP;

  INSERT INTO theme_short_urls (code, theme_id) VALUES (v_code, p_theme_id)
  ON CONFLICT (code) DO NOTHING;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;
