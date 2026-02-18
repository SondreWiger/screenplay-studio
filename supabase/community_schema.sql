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
