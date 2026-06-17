-- ============================================================
-- Translator Hub — Community-driven UI translation system
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE translation_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE translation_vote_type AS ENUM ('up', 'down');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE language_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── translation_keys ──────────────────────────────────────────
-- Master list of all UI strings that need translation

CREATE TABLE IF NOT EXISTS translation_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text NOT NULL UNIQUE,
  source_text  text NOT NULL,
  context      text,
  section      text NOT NULL DEFAULT 'general',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_translation_keys_key ON translation_keys(key);
CREATE INDEX IF NOT EXISTS idx_translation_keys_section ON translation_keys(section);

-- ── translation_suggestions ───────────────────────────────────
-- User-submitted translations for each key+language

CREATE TABLE IF NOT EXISTS translation_suggestions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id          uuid NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
  language        text NOT NULL,
  translated_text text NOT NULL,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          translation_status NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key_id, language, user_id)
);

CREATE INDEX IF NOT EXISTS idx_translation_suggestions_key_id ON translation_suggestions(key_id);
CREATE INDEX IF NOT EXISTS idx_translation_suggestions_language ON translation_suggestions(language);
CREATE INDEX IF NOT EXISTS idx_translation_suggestions_user_id ON translation_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_translation_suggestions_status ON translation_suggestions(status);

-- ── translation_votes ─────────────────────────────────────────
-- Up/down votes on suggestions — most-liked wins

CREATE TABLE IF NOT EXISTS translation_votes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES translation_suggestions(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote          translation_vote_type NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_translation_votes_suggestion_id ON translation_votes(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_translation_votes_user_id ON translation_votes(user_id);

-- ── translation_agreements ────────────────────────────────────
-- Tracks who accepted the translation guidelines

CREATE TABLE IF NOT EXISTS translation_agreements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  agreed_at  timestamptz NOT NULL DEFAULT now()
);

-- ── translation_languages ─────────────────────────────────────
-- Languages added by users (via quiz verification)

CREATE TABLE IF NOT EXISTS translation_languages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  name         text NOT NULL,
  native_name  text NOT NULL,
  added_by     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       language_request_status NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── language_quizzes ──────────────────────────────────────────
-- Quiz questions per language to verify speaker fluency

CREATE TABLE IF NOT EXISTS language_quizzes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code text NOT NULL,
  questions     jsonb NOT NULL DEFAULT '[]',
  min_score     int NOT NULL DEFAULT 3,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_language_quizzes_language_code ON language_quizzes(language_code);

-- ── language_quiz_attempts ────────────────────────────────────
-- Tracks quiz attempts per user per language

CREATE TABLE IF NOT EXISTS language_quiz_attempts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  language_code  text NOT NULL,
  score          int NOT NULL,
  total          int NOT NULL,
  answers        jsonb NOT NULL DEFAULT '[]',
  passed         boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_language_quiz_attempts_user_id ON language_quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_language_quiz_attempts_language ON language_quiz_attempts(language_code);

-- ── View: translation_winners ─────────────────────────────────
-- For each key+language, the suggestion with the highest net votes

CREATE OR REPLACE VIEW translation_winners AS
WITH vote_counts AS (
  SELECT
    s.id AS suggestion_id,
    s.key_id,
    s.language,
    s.translated_text,
    s.user_id,
    s.status,
    s.created_at,
    COALESCE(SUM(CASE WHEN v.vote = 'up' THEN 1 ELSE 0 END), 0) AS upvotes,
    COALESCE(SUM(CASE WHEN v.vote = 'down' THEN 1 ELSE 0 END), 0) AS downvotes,
    COALESCE(SUM(CASE WHEN v.vote = 'up' THEN 1 ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN v.vote = 'down' THEN 1 ELSE 0 END), 0) AS net_votes
  FROM translation_suggestions s
  LEFT JOIN translation_votes v ON v.suggestion_id = s.id
  WHERE s.status IN ('pending', 'approved')
  GROUP BY s.id, s.key_id, s.language, s.translated_text, s.user_id, s.status, s.created_at
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY key_id, language
      ORDER BY net_votes DESC, created_at ASC
    ) AS rn
  FROM vote_counts
)
SELECT
  rk.*,
  tk.key,
  tk.source_text,
  tk.context,
  tk.section
FROM ranked rk
JOIN translation_keys tk ON tk.id = rk.key_id
WHERE rk.rn = 1;

-- ── Helper: increment translation_counts ──────────────────────

CREATE OR REPLACE FUNCTION update_translation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_translation_suggestion_updated ON translation_suggestions;
CREATE TRIGGER on_translation_suggestion_updated
  BEFORE UPDATE ON translation_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_translation_updated_at();

DROP TRIGGER IF EXISTS on_translation_language_updated ON translation_languages;
CREATE TRIGGER on_translation_language_updated
  BEFORE UPDATE ON translation_languages
  FOR EACH ROW EXECUTE FUNCTION update_translation_updated_at();

DROP TRIGGER IF EXISTS on_translation_key_updated ON translation_keys;
CREATE TRIGGER on_translation_key_updated
  BEFORE UPDATE ON translation_keys
  FOR EACH ROW EXECUTE FUNCTION update_translation_updated_at();

DROP TRIGGER IF EXISTS on_language_quiz_updated ON language_quizzes;
CREATE TRIGGER on_language_quiz_updated
  BEFORE UPDATE ON language_quizzes
  FOR EACH ROW EXECUTE FUNCTION update_translation_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE translation_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE language_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE language_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- translation_keys: everyone reads, admin manages
DROP POLICY IF EXISTS "translation_keys_read" ON translation_keys;
DROP POLICY IF EXISTS "translation_keys_admin" ON translation_keys;
CREATE POLICY "translation_keys_read" ON translation_keys FOR SELECT
  USING (true);
CREATE POLICY "translation_keys_admin" ON translation_keys FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- translation_suggestions: authenticated users read all, insert own, update/delete own, admin full
DROP POLICY IF EXISTS "translation_suggestions_read" ON translation_suggestions;
DROP POLICY IF EXISTS "translation_suggestions_insert" ON translation_suggestions;
DROP POLICY IF EXISTS "translation_suggestions_update_own" ON translation_suggestions;
DROP POLICY IF EXISTS "translation_suggestions_delete_own" ON translation_suggestions;
DROP POLICY IF EXISTS "translation_suggestions_admin" ON translation_suggestions;

CREATE POLICY "translation_suggestions_read" ON translation_suggestions FOR SELECT
  USING (true);
CREATE POLICY "translation_suggestions_insert" ON translation_suggestions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM translation_agreements WHERE user_id = auth.uid())
  );
CREATE POLICY "translation_suggestions_update_own" ON translation_suggestions FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "translation_suggestions_delete_own" ON translation_suggestions FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "translation_suggestions_admin" ON translation_suggestions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- translation_votes: authenticated users read all, manage own
DROP POLICY IF EXISTS "translation_votes_read" ON translation_votes;
DROP POLICY IF EXISTS "translation_votes_insert" ON translation_votes;
DROP POLICY IF EXISTS "translation_votes_delete_own" ON translation_votes;
DROP POLICY IF EXISTS "translation_votes_admin" ON translation_votes;

CREATE POLICY "translation_votes_read" ON translation_votes FOR SELECT
  USING (true);
CREATE POLICY "translation_votes_insert" ON translation_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "translation_votes_delete_own" ON translation_votes FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "translation_votes_admin" ON translation_votes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- translation_agreements: users read/insert own, admin reads all
DROP POLICY IF EXISTS "translation_agreements_read" ON translation_agreements;
DROP POLICY IF EXISTS "translation_agreements_insert" ON translation_agreements;
DROP POLICY IF EXISTS "translation_agreements_admin" ON translation_agreements;

CREATE POLICY "translation_agreements_read" ON translation_agreements FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "translation_agreements_insert" ON translation_agreements FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "translation_agreements_admin" ON translation_agreements FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- translation_languages: everyone reads approved, user inserts own, admin full
DROP POLICY IF EXISTS "translation_languages_read" ON translation_languages;
DROP POLICY IF EXISTS "translation_languages_insert" ON translation_languages;
DROP POLICY IF EXISTS "translation_languages_admin" ON translation_languages;

CREATE POLICY "translation_languages_read" ON translation_languages FOR SELECT
  USING (status = 'approved' OR auth.uid() = added_by);
CREATE POLICY "translation_languages_insert" ON translation_languages FOR INSERT
  WITH CHECK (auth.uid() = added_by);
CREATE POLICY "translation_languages_admin" ON translation_languages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- language_quizzes: everyone reads, admin manages
DROP POLICY IF EXISTS "language_quizzes_read" ON language_quizzes;
DROP POLICY IF EXISTS "language_quizzes_admin" ON language_quizzes;

CREATE POLICY "language_quizzes_read" ON language_quizzes FOR SELECT
  USING (true);
CREATE POLICY "language_quizzes_admin" ON language_quizzes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- language_quiz_attempts: users read/insert own, admin reads all
DROP POLICY IF EXISTS "language_quiz_attempts_read" ON language_quiz_attempts;
DROP POLICY IF EXISTS "language_quiz_attempts_insert" ON language_quiz_attempts;
DROP POLICY IF EXISTS "language_quiz_attempts_admin" ON language_quiz_attempts;

CREATE POLICY "language_quiz_attempts_read" ON language_quiz_attempts FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "language_quiz_attempts_insert" ON language_quiz_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "language_quiz_attempts_admin" ON language_quiz_attempts FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Seed initial translation keys ─────────────────────────────
-- Core UI strings organized by section

INSERT INTO translation_keys (key, source_text, context, section) VALUES
  -- Navigation
  ('nav.dashboard', 'Dashboard', 'Main navigation link', 'navigation'),
  ('nav.projects', 'Projects', 'Main navigation link', 'navigation'),
  ('nav.community', 'Community', 'Main navigation link', 'navigation'),
  ('nav.notifications', 'Notifications', 'Main navigation link', 'navigation'),
  ('nav.messages', 'Messages', 'Main navigation link', 'navigation'),
  ('nav.settings', 'Settings', 'Main navigation link', 'navigation'),
  ('nav.admin', 'Admin Panel', 'Main navigation link', 'navigation'),
  ('nav.translations', 'Translator Hub', 'Main navigation link', 'navigation'),

  -- Dashboard
  ('dashboard.title', 'Your Dashboard', 'Dashboard page heading', 'dashboard'),
  ('dashboard.welcome', 'Welcome back', 'Dashboard greeting', 'dashboard'),
  ('dashboard.recent_projects', 'Recent Projects', 'Dashboard section', 'dashboard'),
  ('dashboard.create_project', 'Create Project', 'Dashboard button', 'dashboard'),
  ('dashboard.no_projects', 'No projects yet', 'Dashboard empty state', 'dashboard'),
  ('dashboard.get_started', 'Get started by creating your first project', 'Dashboard empty state', 'dashboard'),

  -- Auth
  ('auth.login', 'Log In', 'Login button', 'auth'),
  ('auth.register', 'Sign Up', 'Register button', 'auth'),
  ('auth.forgot_password', 'Forgot Password?', 'Auth link', 'auth'),
  ('auth.email', 'Email', 'Auth field label', 'auth'),
  ('auth.password', 'Password', 'Auth field label', 'auth'),
  ('auth.confirm_password', 'Confirm Password', 'Auth field label', 'auth'),
  ('auth.full_name', 'Full Name', 'Auth field label', 'auth'),
  ('auth.welcome_back', 'Welcome Back', 'Login page heading', 'auth'),
  ('auth.create_account', 'Create Account', 'Register page heading', 'auth'),

  -- Project
  ('project.title', 'Project', 'Generic project label', 'project'),
  ('project.logline', 'Logline', 'Project field', 'project'),
  ('project.genre', 'Genre', 'Project field', 'project'),
  ('project.format', 'Format', 'Project field', 'project'),
  ('project.status', 'Status', 'Project field', 'project'),
  ('project.team', 'Team', 'Project section', 'project'),
  ('project.share', 'Share', 'Project action', 'project'),
  ('project.delete', 'Delete', 'Project action', 'project'),
  ('project.settings', 'Project Settings', 'Project section', 'project'),

  -- Script
  ('script.title', 'Script', 'Script editor section', 'script'),
  ('script.add_element', 'Add Element', 'Script editor button', 'script'),
  ('script.scene_heading', 'Scene Heading', 'Script element type', 'script'),
  ('script.action', 'Action', 'Script element type', 'script'),
  ('script.character', 'Character', 'Script element type', 'script'),
  ('script.dialogue', 'Dialogue', 'Script element type', 'script'),
  ('script.parenthetical', 'Parenthetical', 'Script element type', 'script'),
  ('script.transition', 'Transition', 'Script element type', 'script'),

  -- Common
  ('common.save', 'Save', 'Common action button', 'common'),
  ('common.cancel', 'Cancel', 'Common action button', 'common'),
  ('common.delete', 'Delete', 'Common action button', 'common'),
  ('common.edit', 'Edit', 'Common action button', 'common'),
  ('common.submit', 'Submit', 'Common action button', 'common'),
  ('common.search', 'Search', 'Common placeholder', 'common'),
  ('common.loading', 'Loading...', 'Common loading state', 'common'),
  ('common.error', 'Something went wrong', 'Common error message', 'common'),
  ('common.success', 'Success!', 'Common success message', 'common'),
  ('common.confirm', 'Confirm', 'Common action button', 'common'),
  ('common.back', 'Back', 'Common navigation', 'common'),
  ('common.next', 'Next', 'Common navigation', 'common'),
  ('common.previous', 'Previous', 'Common navigation', 'common'),
  ('common.close', 'Close', 'Common action button', 'common'),
  ('common.yes', 'Yes', 'Common response', 'common'),
  ('common.no', 'No', 'Common response', 'common'),

  -- Translator Hub
  ('translations.title', 'Translator Hub', 'Translator hub page heading', 'translations'),
  ('translations.description', 'Help translate Screenplay Studio into your language', 'Translator hub page description', 'translations'),
  ('translations.your_language', 'Your Language', 'Translator hub section', 'translations'),
  ('translations.add_language', 'Add Language', 'Translator hub button', 'translations'),
  ('translations.progress', 'Translation Progress', 'Translator hub section', 'translations'),
  ('translations.suggest', 'Suggest Translation', 'Translator hub button', 'translations'),
  ('translations.vote', 'Vote', 'Translator hub action', 'translations'),
  ('translations.winning', 'Winning', 'Translator hub badge for top suggestion', 'translations'),
  ('translations.pending', 'Pending Review', 'Translator hub status', 'translations'),
  ('translations.contributors', 'Top Contributors', 'Translator hub section', 'translations'),
  ('translations.no_suggestions', 'No suggestions yet. Be the first!', 'Translator hub empty state', 'translations'),
  ('translations.agree_first', 'You must agree to the translation guidelines before contributing', 'Translator hub gate message', 'translations'),
  ('translations.agree_button', 'I Agree to the Guidelines', 'Translator hub agreement button', 'translations'),

  -- Settings
  ('settings.title', 'Settings', 'Settings page heading', 'settings'),
  ('settings.profile', 'Profile', 'Settings section', 'settings'),
  ('settings.appearance', 'Appearance', 'Settings section', 'settings'),
  ('settings.notifications', 'Notifications', 'Settings section', 'settings'),
  ('settings.account', 'Account', 'Settings section', 'settings'),
  ('settings.accent_color', 'Accent Color', 'Settings field', 'settings'),
  ('settings.display_name', 'Display Name', 'Settings field', 'settings'),
  ('settings.theme', 'Theme', 'Settings field', 'settings')

ON CONFLICT (key) DO NOTHING;
