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

-- ── Profile: preferred_language ────────────────────────────────

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── View: translation_winners ─────────────────────────────────
-- For each key+language, the suggestion with the highest net votes
-- Requires 2+ net votes to be active, UNLESS the author is an admin

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
    p.role AS author_role,
    COALESCE(SUM(CASE WHEN v.vote = 'up' THEN 1 ELSE 0 END), 0) AS upvotes,
    COALESCE(SUM(CASE WHEN v.vote = 'down' THEN 1 ELSE 0 END), 0) AS downvotes,
    (COALESCE(SUM(CASE WHEN v.vote = 'up' THEN 1 ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN v.vote = 'down' THEN 1 ELSE 0 END), 0)
      + CASE WHEN p.role = 'admin' THEN 5 ELSE 0 END) AS net_votes
  FROM translation_suggestions s
  LEFT JOIN translation_votes v ON v.suggestion_id = s.id
  LEFT JOIN profiles p ON p.id = s.user_id
  WHERE s.status IN ('pending', 'approved')
  GROUP BY s.id, s.key_id, s.language, s.translated_text, s.user_id, s.status, s.created_at, p.role
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY key_id, language
      ORDER BY net_votes DESC, created_at ASC
    ) AS rn
  FROM vote_counts
  WHERE net_votes >= 2 OR author_role = 'admin'
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

-- ── Trigger: flag admin suggestions ───────────────────────────
-- Adds a +5 bonus in the translation_winners view

CREATE OR REPLACE FUNCTION flag_admin_suggestion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.user_id AND role = 'admin') THEN
    NEW.status = 'approved';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_translation_suggestion_admin_flag ON translation_suggestions;
CREATE TRIGGER on_translation_suggestion_admin_flag
  BEFORE INSERT ON translation_suggestions
  FOR EACH ROW EXECUTE FUNCTION flag_admin_suggestion();

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
-- Comprehensive UI strings organized by section

INSERT INTO translation_keys (key, source_text, context, section) VALUES
  -- ═══ Navigation ═══
  ('nav.dashboard', 'Dashboard', 'Main navigation link', 'navigation'),
  ('nav.projects', 'Projects', 'Main navigation link', 'navigation'),
  ('nav.community', 'Community', 'Main navigation link', 'navigation'),
  ('nav.notifications', 'Notifications', 'Main navigation link', 'navigation'),
  ('nav.messages', 'Messages', 'Main navigation link', 'navigation'),
  ('nav.settings', 'Settings', 'Main navigation link', 'navigation'),
  ('nav.admin', 'Admin Panel', 'Main navigation link', 'navigation'),
  ('nav.translations', 'Translator Hub', 'Main navigation link', 'navigation'),
  ('nav.ideas', 'Ideas', 'Main navigation link', 'navigation'),
  ('nav.about', 'About', 'Main navigation link', 'navigation'),
  ('nav.quotes', 'Quotes', 'Main navigation link', 'navigation'),
  ('nav.company', 'Company', 'Main navigation link', 'navigation'),
  ('nav.blog', 'Blog', 'Main navigation link', 'navigation'),
  ('nav.pro', 'Pro', 'Pro badge label', 'navigation'),
  ('nav.new_project', 'New Project', 'Dashboard button', 'navigation'),
  ('nav.sign_out', 'Sign Out', 'User menu item', 'navigation'),

  -- ═══ Auth ═══
  ('auth.login', 'Log In', 'Login button', 'auth'),
  ('auth.register', 'Sign Up', 'Register button', 'auth'),
  ('auth.forgot_password', 'Forgot Password?', 'Auth link', 'auth'),
  ('auth.email', 'Email', 'Auth field label', 'auth'),
  ('auth.password', 'Password', 'Auth field label', 'auth'),
  ('auth.confirm_password', 'Confirm Password', 'Auth field label', 'auth'),
  ('auth.full_name', 'Full Name', 'Auth field label', 'auth'),
  ('auth.welcome_back', 'Welcome Back', 'Login page heading', 'auth'),
  ('auth.create_account', 'Create Account', 'Register page heading', 'auth'),
  ('auth.no_account', 'No account? Create one', 'Login link to register', 'auth'),
  ('auth.has_account', 'Have an account? Sign in', 'Register link to login', 'auth'),
  ('auth.signing_in', 'Signing in...', 'Login loading state', 'auth'),
  ('auth.creating_account', 'Creating Account...', 'Register loading state', 'auth'),
  ('auth.verify_email', 'Verify Email', 'Email verification heading', 'auth'),
  ('auth.check_email', 'CHECK YOUR EMAIL', 'Email verification instruction', 'auth'),
  ('auth.verification_sent', 'We sent a verification link to', 'Email verification message', 'auth'),
  ('auth.click_to_activate', 'Click it to activate your account.', 'Email verification instruction', 'auth'),
  ('auth.back_to_signin', 'Back to sign in', 'Email verification link', 'auth'),
  ('auth.password_reset', 'Password Reset', 'Password reset heading', 'auth'),
  ('auth.reset_instruction', 'Enter your email and we''ll send you a reset link.', 'Password reset instruction', 'auth'),
  ('auth.send_reset_link', 'Send Reset Link', 'Password reset button', 'auth'),
  ('auth.sending', 'Sending...', 'Password reset loading state', 'auth'),
  ('auth.remember_it', 'Remember it? Sign in', 'Password reset link to login', 'auth'),
  ('auth.reset_link_sent', 'Reset Link Sent', 'Password reset success heading', 'auth'),
  ('auth.reset_check_inbox', 'If an account exists for', 'Password reset message', 'auth'),
  ('auth.reset_check_spam', 'we sent a password reset link. Check your inbox and spam folder.', 'Password reset message', 'auth'),
  ('auth.free_no_card', 'Free. No card. Takes about ten seconds.', 'Register subtitle', 'auth'),
  ('auth.agree_terms', 'I agree to the Terms of Service and Privacy Policy', 'Register checkbox', 'auth'),
  ('auth.error_incorrect', 'Incorrect email or password. Please try again.', 'Login error', 'auth'),
  ('auth.error_unverified', 'Please verify your email address before signing in. Check your inbox for the verification link.', 'Login error', 'auth'),
  ('auth.error_too_many', 'Too many attempts. Please wait a few minutes before trying again.', 'Auth rate limit error', 'auth'),
  ('auth.error_network', 'Network error — please check your connection and try again.', 'Auth network error', 'auth'),
  ('auth.error_no_account', 'No account found with that email address.', 'Login error', 'auth'),
  ('auth.error_name_required', 'Please enter your full name.', 'Register validation', 'auth'),
  ('auth.error_email_required', 'Please enter your email address.', 'Register validation', 'auth'),
  ('auth.error_email_invalid', 'Please enter a valid email address.', 'Register validation', 'auth'),
  ('auth.error_password_required', 'Please enter a password.', 'Register validation', 'auth'),
  ('auth.error_terms_required', 'Please agree to the Terms of Service and Privacy Policy to continue.', 'Register validation', 'auth'),
  ('auth.error_email_exists', 'An account with this email already exists. Try signing in instead.', 'Register error', 'auth'),
  ('auth.error_password_short', 'Password is too short. Use at least 8 characters.', 'Register validation', 'auth'),
  ('auth.password_rules', 'Password must contain:', 'Register password rules header', 'auth'),
  ('auth.password_rule_length', '8+ characters', 'Register password rule', 'auth'),
  ('auth.password_rule_upper', 'Uppercase letter', 'Register password rule', 'auth'),
  ('auth.password_rule_lower', 'Lowercase letter', 'Register password rule', 'auth'),
  ('auth.password_rule_number', 'Number', 'Register password rule', 'auth'),
  ('auth.password_rule_special', 'Special character', 'Register password rule', 'auth'),

  -- ═══ Dashboard ═══
  ('dashboard.title', 'Dashboard', 'Dashboard page heading', 'dashboard'),
  ('dashboard.welcome_back', 'WELCOME BACK', 'Dashboard greeting', 'dashboard'),
  ('dashboard.your_projects', 'Your film projects and recent work', 'Dashboard subtitle', 'dashboard'),
  ('dashboard.projects', 'Projects', 'Dashboard stats label', 'dashboard'),
  ('dashboard.in_dev', 'In Dev', 'Dashboard stats label', 'dashboard'),
  ('dashboard.in_prod', 'In Prod', 'Dashboard stats label', 'dashboard'),
  ('dashboard.done', 'Done', 'Dashboard stats label', 'dashboard'),
  ('dashboard.continue_writing', 'Continue Writing', 'Dashboard CTA', 'dashboard'),
  ('dashboard.last_edited', 'Last edited', 'Dashboard CTA subtitle', 'dashboard'),
  ('dashboard.search_projects', 'Search projects...', 'Dashboard search placeholder', 'dashboard'),
  ('dashboard.recently_viewed', 'Recently Viewed', 'Dashboard section', 'dashboard'),
  ('dashboard.clear', 'Clear', 'Dashboard button', 'dashboard'),
  ('dashboard.my_projects', 'My Projects', 'Dashboard section', 'dashboard'),
  ('dashboard.new_folder', 'New Folder', 'Dashboard button', 'dashboard'),
  ('dashboard.folder_name', 'Folder name…', 'Dashboard folder placeholder', 'dashboard'),
  ('dashboard.no_projects', 'No projects yet', 'Dashboard empty state', 'dashboard'),
  ('dashboard.create_first', 'Create your first screenplay project to get started', 'Dashboard empty state', 'dashboard'),
  ('dashboard.create_first_project', 'Create First Project', 'Dashboard empty state CTA', 'dashboard'),
  ('dashboard.no_match', 'No projects match your filters.', 'Dashboard empty state', 'dashboard'),
  ('dashboard.clear_filters', 'Clear filters', 'Dashboard empty state CTA', 'dashboard'),
  ('dashboard.unfiled', 'Unfiled', 'Dashboard folder label', 'dashboard'),
  ('dashboard.move_to_folder', 'Move to folder', 'Dashboard action', 'dashboard'),
  ('dashboard.remove_from_folder', 'Remove from folder', 'Dashboard action', 'dashboard'),
  ('dashboard.delete_folder', 'Delete this folder? Projects inside will be unfiled.', 'Dashboard confirm dialog', 'dashboard'),

  -- ═══ New Project Modal ═══
  ('new_project.title', 'What are you creating?', 'New project modal heading', 'new_project'),
  ('new_project.details', 'Project Details', 'New project modal section', 'new_project'),
  ('new_project.from_template', 'Start from template', 'New project modal option', 'new_project'),
  ('new_project.choose_type', 'Choose the type of project you want to create.', 'New project modal instruction', 'new_project'),
  ('new_project.project_title', 'Project Title', 'New project field', 'new_project'),
  ('new_project.logline', 'Logline', 'New project field', 'new_project'),
  ('new_project.genre', 'Genre', 'New project field', 'new_project'),
  ('new_project.create_for', 'Create for', 'New project field', 'new_project'),
  ('new_project.personal', 'Personal', 'New project option', 'new_project'),
  ('new_project.create', 'Create Project', 'New project button', 'new_project'),
  ('new_project.failed', 'Failed to create project. Please try again.', 'New project error', 'new_project'),

  -- ═══ Project ═══
  ('project.title', 'Project', 'Generic project label', 'project'),
  ('project.logline', 'Logline', 'Project field', 'project'),
  ('project.genre', 'Genre', 'Project field', 'project'),
  ('project.format', 'Format', 'Project field', 'project'),
  ('project.status', 'Status', 'Project field', 'project'),
  ('project.team', 'Team', 'Project section', 'project'),
  ('project.share', 'Share', 'Project action', 'project'),
  ('project.delete', 'Delete', 'Project action', 'project'),
  ('project.settings', 'Project Settings', 'Project section', 'project'),
  ('project.save', 'Save', 'Project button', 'project'),
  ('project.saving', 'Saving...', 'Project loading state', 'project'),
  ('project.saved', 'Changes saved', 'Project success message', 'project'),
  ('project.status_development', 'Development', 'Project status', 'project'),
  ('project.status_pre_production', 'Pre-Production', 'Project status', 'project'),
  ('project.status_production', 'Production', 'Project status', 'project'),
  ('project.status_post_production', 'Post-Production', 'Project status', 'project'),
  ('project.status_completed', 'Completed', 'Project status', 'project'),
  ('project.status_archived', 'Archived', 'Project status', 'project'),
  ('project.type_film', 'Film', 'Project type', 'project'),
  ('project.type_tv', 'TV', 'Project type', 'project'),
  ('project.type_audio', 'Audio', 'Project type', 'project'),
  ('project.type_stage', 'Stage', 'Project type', 'project'),
  ('project.type_youtube', 'YouTube', 'Project type', 'project'),
  ('project.type_tiktok', 'TikTok', 'Project type', 'project'),
  ('project.type_podcast', 'Podcast', 'Project type', 'project'),

  -- ═══ Script ═══
  ('script.title', 'Script', 'Script editor section', 'script'),
  ('script.add_element', 'Add Element', 'Script editor button', 'script'),
  ('script.scene_heading', 'Scene Heading', 'Script element type', 'script'),
  ('script.action', 'Action', 'Script element type', 'script'),
  ('script.character', 'Character', 'Script element type', 'script'),
  ('script.dialogue', 'Dialogue', 'Script element type', 'script'),
  ('script.parenthetical', 'Parenthetical', 'Script element type', 'script'),
  ('script.transition', 'Transition', 'Script element type', 'script'),
  ('script.save', 'Save script', 'Script toolbar action', 'script'),
  ('script.search', 'Search in script', 'Script toolbar action', 'script'),
  ('script.export_pdf', 'Export to PDF', 'Script toolbar action', 'script'),
  ('script.new_element', 'New element', 'Script toolbar action', 'script'),
  ('script.cycle_type', 'Cycle element type', 'Script toolbar action', 'script'),
  ('script.draft_snapshot', 'Save draft snapshot', 'Script toolbar action', 'script'),

  -- ═══ Characters ═══
  ('characters.title', 'Characters', 'Characters page heading', 'characters'),
  ('characters.delete_confirm', 'Delete this character?', 'Characters confirm dialog', 'characters'),
  ('characters.filter_all', 'All', 'Characters filter', 'characters'),
  ('characters.filter_protagonist', 'Protagonist', 'Characters filter', 'characters'),
  ('characters.filter_antagonist', 'Antagonist', 'Characters filter', 'characters'),
  ('characters.filter_main', 'Main', 'Characters filter', 'characters'),
  ('characters.filter_supporting', 'Supporting', 'Characters filter', 'characters'),
  ('characters.filter_minor', 'Minor', 'Characters filter', 'characters'),

  -- ═══ Scenes ═══
  ('scenes.title', 'Scenes', 'Scenes page heading', 'scenes'),
  ('scenes.int', 'INT', 'Scene location type', 'scenes'),
  ('scenes.ext', 'EXT', 'Scene location type', 'scenes'),
  ('scenes.int_ext', 'INT/EXT', 'Scene location type', 'scenes'),

  -- ═══ Team ═══
  ('team.title', 'Team', 'Team page heading', 'team'),
  ('team.members', 'members', 'Team count label', 'team'),
  ('team.online', 'online', 'Team count label', 'team'),
  ('team.invite', 'Invite Member', 'Team button', 'team'),
  ('team.role_owner', 'Owner', 'Team role', 'team'),
  ('team.role_admin', 'Admin', 'Team role', 'team'),
  ('team.role_writer', 'Writer', 'Team role', 'team'),
  ('team.role_editor', 'Editor', 'Team role', 'team'),
  ('team.role_viewer', 'Viewer', 'Team role', 'team'),
  ('team.desc_owner', 'Full access, can delete project', 'Team role description', 'team'),
  ('team.desc_admin', 'Manage members, edit everything', 'Team role description', 'team'),
  ('team.desc_writer', 'Edit scripts, characters, scenes', 'Team role description', 'team'),
  ('team.desc_editor', 'Edit content, no admin access', 'Team role description', 'team'),
  ('team.desc_viewer', 'Read-only access', 'Team role description', 'team'),
  ('team.active_now', 'Active Now', 'Team section', 'team'),
  ('team.all_members', 'All Members', 'Team section', 'team'),
  ('team.you', 'You', 'Team badge', 'team'),
  ('team.remove_confirm', 'Remove this team member?', 'Team confirm dialog', 'team'),
  ('team.joined', 'Joined', 'Team member info', 'team'),

  -- ═══ Share ═══
  ('share.title', 'Share', 'Share page heading', 'share'),
  ('share.links_for', 'Shareable links for', 'Share page subtitle', 'share'),
  ('share.new_link', 'New link', 'Share button', 'share'),
  ('share.link_name', 'Link name', 'Share field', 'share'),
  ('share.link_placeholder', 'e.g. Director cut, Client draft…', 'Share placeholder', 'share'),
  ('share.permissions', 'What can they see?', 'Share section', 'share'),
  ('share.perm_script', 'Script', 'Share permission', 'share'),
  ('share.perm_characters', 'Characters', 'Share permission', 'share'),
  ('share.perm_scenes', 'Scenes', 'Share permission', 'share'),
  ('share.perm_schedule', 'Schedule', 'Share permission', 'share'),
  ('share.perm_documents', 'Documents', 'Share permission', 'share'),
  ('share.perm_view_notes', 'View notes', 'Share permission', 'share'),
  ('share.perm_write_notes', 'Write notes', 'Share permission', 'share'),
  ('share.invite_link', 'Invite link', 'Share option', 'share'),
  ('share.invite_role', 'Invite role', 'Share field', 'share'),
  ('share.role_viewer', 'viewer', 'Share role option', 'share'),
  ('share.role_commenter', 'commenter', 'Share role option', 'share'),
  ('share.role_editor', 'editor', 'Share role option', 'share'),
  ('share.no_links', 'No share links yet', 'Share empty state', 'share'),

  -- ═══ Community ═══
  ('community.title', 'Community', 'Community page heading', 'community'),
  ('community.scripts', 'COMMUNITY SCRIPTS', 'Community section', 'community'),
  ('community.discover', 'Discover, share, and collaborate on screenplays', 'Community subtitle', 'community'),
  ('community.all_posts', 'All Posts', 'Community tab', 'community'),
  ('community.your_feed', 'Your Feed', 'Community tab', 'community'),
  ('community.newest', 'newest', 'Community sort', 'community'),
  ('community.popular', 'popular', 'Community sort', 'community'),
  ('community.discussed', 'discussed', 'Community sort', 'community'),
  ('community.categories', 'Categories', 'Community section', 'community'),
  ('community.all_scripts', 'All Scripts', 'Community filter', 'community'),
  ('community.finished', 'Finished Projects', 'Community quick link', 'community'),
  ('community.challenges', 'Writing Challenges', 'Community quick link', 'community'),
  ('community.free_scripts', 'Free-to-Use Scripts', 'Community quick link', 'community'),
  ('community.your_communities', 'Your Communities', 'Community section', 'community'),
  ('community.browse', 'Browse →', 'Community link', 'community'),
  ('community.courses', 'Courses', 'Community section', 'community'),
  ('community.enrolled', 'enrolled', 'Community course label', 'community'),
  ('community.no_posts', 'No scripts shared yet', 'Community empty state', 'community'),
  ('community.be_first', 'Be the first to share your work with the community!', 'Community empty state', 'community'),
  ('community.share_script', 'Share Your Script', 'Community CTA', 'community'),
  ('community.weekly_challenge', 'Weekly Challenge', 'Community challenge section', 'community'),
  ('community.submit', 'Submit', 'Community button', 'community'),
  ('community.view', 'View', 'Community button', 'community'),
  ('community.submissions', 'submissions', 'Community count', 'community'),
  ('community.free_to_use', 'Free to Use', 'Community badge', 'community'),
  ('community.distros_allowed', 'Distros Allowed', 'Community badge', 'community'),
  ('community.open_to_edits', 'Open to Edits', 'Community badge', 'community'),
  ('community.delete_post', 'Delete this post? This cannot be undone.', 'Community confirm dialog', 'community'),

  -- ═══ Settings ═══
  ('settings.title', 'Settings', 'Settings page heading', 'settings'),
  ('settings.profile', 'Profile', 'Settings tab', 'settings'),
  ('settings.preferences', 'Preferences', 'Settings tab', 'settings'),
  ('settings.company', 'Company', 'Settings tab', 'settings'),
  ('settings.privacy', 'Privacy & Data', 'Settings tab', 'settings'),
  ('settings.security', 'Security', 'Settings tab', 'settings'),
  ('settings.gamification', 'Gamification', 'Settings tab', 'settings'),
  ('settings.translations', 'Translations', 'Settings tab', 'settings'),
  ('settings.accountability', 'Accountability', 'Settings tab', 'settings'),
  ('settings.your_profile', 'Your Profile', 'Settings section', 'settings'),
  ('settings.full_name', 'Full Name', 'Settings field', 'settings'),
  ('settings.display_name', 'Display Name', 'Settings field', 'settings'),
  ('settings.username', 'Username', 'Settings field', 'settings'),
  ('settings.headline', 'Headline', 'Settings field', 'settings'),
  ('settings.bio', 'Bio', 'Settings field', 'settings'),
  ('settings.avatar_url', 'Avatar URL', 'Settings field', 'settings'),
  ('settings.public_profile', 'Public Profile', 'Settings section', 'settings'),
  ('settings.customise_profile', 'Customise how your profile appears to visitors.', 'Settings description', 'settings'),
  ('settings.banner_image', 'Banner Image URL', 'Settings field', 'settings'),
  ('settings.location', 'Location', 'Settings field', 'settings'),
  ('settings.website', 'Website', 'Settings field', 'settings'),
  ('settings.profile_theme', 'Profile Theme', 'Settings section', 'settings'),
  ('settings.social_links', 'Social Links', 'Settings section', 'settings'),
  ('settings.social_desc', 'Add links to your social profiles. Leave blank to hide.', 'Settings description', 'settings'),
  ('settings.privacy_visibility', 'Privacy & Visibility', 'Settings section', 'settings'),
  ('settings.privacy_desc', 'Control what others can see on your profile.', 'Settings description', 'settings'),
  ('settings.show_email', 'Show email on profile', 'Settings toggle', 'settings'),
  ('settings.show_projects', 'Show projects', 'Settings toggle', 'settings'),
  ('settings.show_activity', 'Show activity', 'Settings toggle', 'settings'),
  ('settings.allow_dms', 'Allow direct messages', 'Settings toggle', 'settings'),
  ('settings.email_notifications', 'Email Notifications', 'Settings section', 'settings'),
  ('settings.email_notifications_desc', 'Choose which emails you receive. Transactional emails (security alerts) are always sent.', 'Settings description', 'settings'),
  ('settings.notif_invitations', 'Project invitations', 'Settings toggle', 'settings'),
  ('settings.notif_mentions', 'Mentions & comments', 'Settings toggle', 'settings'),
  ('settings.notif_dms', 'Direct messages', 'Settings toggle', 'settings'),
  ('settings.notif_support', 'Support ticket replies', 'Settings toggle', 'settings'),
  ('settings.notif_digest', 'Weekly digest', 'Settings toggle', 'settings'),
  ('settings.save_profile', 'Save Profile', 'Settings button', 'settings'),
  ('settings.saved', '✓ Saved', 'Settings success', 'settings'),
  ('settings.changes_saved', 'Changes saved', 'Settings success message', 'settings'),
  ('settings.how_use', 'How do you use Screenplay Studio?', 'Settings section', 'settings'),
  ('settings.adjusts_layout', 'This adjusts your default workspace layout.', 'Settings description', 'settings'),
  ('settings.intent_writer', 'Writer', 'Settings option', 'settings'),
  ('settings.intent_producer', 'Producer', 'Settings option', 'settings'),
  ('settings.intent_both', 'Both', 'Settings option', 'settings'),
  ('settings.intent_student', 'Student', 'Settings option', 'settings'),
  ('settings.feature_visibility', 'Feature Visibility', 'Settings section', 'settings'),
  ('settings.feat_community', 'Community Hub', 'Settings feature', 'settings'),
  ('settings.feat_community_desc', 'Share scripts, get feedback, join challenges', 'Settings feature description', 'settings'),
  ('settings.feat_production', 'Production Tools', 'Settings feature', 'settings'),
  ('settings.feat_production_desc', 'Locations, shots, schedule, budget', 'Settings feature description', 'settings'),
  ('settings.feat_collaboration', 'Collaboration', 'Settings feature', 'settings'),
  ('settings.feat_collaboration_desc', 'Team members, real-time editing', 'Settings feature description', 'settings'),
  ('settings.feat_accountability', 'Writing Accountability', 'Settings feature', 'settings'),
  ('settings.feat_accountability_desc', 'Streaks, buddies, groups, activity grid', 'Settings feature description', 'settings'),
  ('settings.default_script_type', 'Default Script Type', 'Settings section', 'settings'),
  ('settings.script_type_desc', 'Pre-selected when you create new projects.', 'Settings description', 'settings'),
  ('settings.accent_color', 'Accent Color', 'Settings section', 'settings'),
  ('settings.accent_desc', 'Personalize the interface with your preferred color.', 'Settings description', 'settings'),
  ('settings.editor_style', 'Editor Style', 'Settings section', 'settings'),
  ('settings.editor_desc', 'Choose how the script editor looks across all your projects.', 'Settings description', 'settings'),
  ('settings.sidebar_tabs', 'Project Sidebar Tabs', 'Settings section', 'settings'),
  ('settings.sidebar_desc', 'You can also customize per-project in project settings.', 'Settings description', 'settings'),
  ('settings.gamification_title', 'Gamification', 'Settings section', 'settings'),
  ('settings.gamification_desc', 'Show your XP, level, and badges across the platform.', 'Settings description', 'settings'),
  ('settings.your_progress', 'Your Progress', 'Settings section', 'settings'),
  ('settings.total_xp', 'Total XP', 'Settings stat', 'settings'),
  ('settings.level', 'Level', 'Settings stat', 'settings'),
  ('settings.login_streak', 'Login Streak', 'Settings stat', 'settings'),
  ('settings.your_badges', 'Your Badges', 'Settings section', 'settings'),
  ('settings.no_badges', 'No badges yet — keep writing!', 'Settings empty state', 'settings'),
  ('settings.language', 'Language', 'Settings section', 'settings'),
  ('settings.language_desc', 'Choose your preferred display language. Progress shows how complete each translation is.', 'Settings description', 'settings'),
  ('settings.default_language', 'Default language', 'Settings language label', 'settings'),
  ('settings.add_language', 'Add Your Language', 'Settings section', 'settings'),
  ('settings.add_language_desc', 'Don''t see your language? Add it and take a quick fluency quiz.', 'Settings description', 'settings'),
  ('settings.translation_stats', 'Translation Stats', 'Settings section', 'settings'),
  ('settings.languages_count', 'Languages', 'Settings stat', 'settings'),
  ('settings.keys_count', 'Translation Keys', 'Settings stat', 'settings'),
  ('settings.language_saved', 'Language preference saved', 'Settings success', 'settings'),
  ('settings.export_data', 'Export Your Data', 'Settings section', 'settings'),
  ('settings.export_desc', 'Download all your personal data in a machine-readable format (JSON).', 'Settings description', 'settings'),
  ('settings.download_data', 'Download My Data', 'Settings button', 'settings'),
  ('settings.delete_account', 'Delete Account', 'Settings section', 'settings'),
  ('settings.delete_desc', 'Permanently delete your account and all associated data. This action is immediate and irreversible.', 'Settings description', 'settings'),
  ('settings.delete_button', 'Delete My Account', 'Settings button', 'settings'),
  ('settings.delete_warning', 'This cannot be undone. All your projects, scripts, comments, and personal data will be permanently removed.', 'Settings warning', 'settings'),
  ('settings.account_security', 'Account Security', 'Settings section', 'settings'),
  ('settings.security_desc', 'View your login history, manage active sessions, and review security events.', 'Settings description', 'settings'),
  ('settings.open_security', 'Open Security Dashboard', 'Settings button', 'settings'),
  ('settings.change_password', 'Change your password to keep your account secure.', 'Settings description', 'settings'),
  ('settings.reset_password', 'Reset Password', 'Settings button', 'settings'),
  ('settings.email_verified', 'Email verified', 'Settings status', 'settings'),
  ('settings.view_legal', 'View Legal Center →', 'Settings link', 'settings'),

  -- ═══ Sidebar ═══
  ('sidebar.overview', 'Overview', 'Sidebar link', 'sidebar'),
  ('sidebar.script', 'Script', 'Sidebar link', 'sidebar'),
  ('sidebar.episodes', 'Episodes', 'Sidebar link', 'sidebar'),
  ('sidebar.arc_planner', 'Arc Planner', 'Sidebar link', 'sidebar'),
  ('sidebar.beat_sheet', 'Beat Sheet', 'Sidebar link', 'sidebar'),
  ('sidebar.notes_rounds', 'Notes Rounds', 'Sidebar link', 'sidebar'),
  ('sidebar.ideas', 'Ideas', 'Sidebar link', 'sidebar'),
  ('sidebar.documents', 'Documents', 'Sidebar link', 'sidebar'),
  ('sidebar.characters', 'Characters', 'Sidebar link', 'sidebar'),
  ('sidebar.locations', 'Locations', 'Sidebar link', 'sidebar'),
  ('sidebar.scenes', 'Scenes', 'Sidebar link', 'sidebar'),
  ('sidebar.schedule', 'Schedule', 'Sidebar link', 'sidebar'),
  ('sidebar.budget', 'Budget', 'Sidebar link', 'sidebar'),
  ('sidebar.breakdown', 'Breakdown', 'Sidebar link', 'sidebar'),
  ('sidebar.call_sheet', 'Call Sheet', 'Sidebar link', 'sidebar'),
  ('sidebar.war_room', 'War Room', 'Sidebar link', 'sidebar'),
  ('sidebar.on_set', 'On Set', 'Sidebar link', 'sidebar'),
  ('sidebar.day_pack', 'Day Pack', 'Sidebar link', 'sidebar'),
  ('sidebar.continuity', 'Continuity', 'Sidebar link', 'sidebar'),
  ('sidebar.table_read', 'Table Read', 'Sidebar link', 'sidebar'),
  ('sidebar.camera_reports', 'Camera Reports', 'Sidebar link', 'sidebar'),
  ('sidebar.corkboard', 'Corkboard', 'Sidebar link', 'sidebar'),
  ('sidebar.shot_list', 'Shot List', 'Sidebar link', 'sidebar'),
  ('sidebar.mood_board', 'Mood Board', 'Sidebar link', 'sidebar'),
  ('sidebar.storyboard', 'Storyboard', 'Sidebar link', 'sidebar'),
  ('sidebar.mind_map', 'Mind Map', 'Sidebar link', 'sidebar'),
  ('sidebar.crew_view', 'Crew View', 'Sidebar link', 'sidebar'),
  ('sidebar.gear', 'Gear', 'Sidebar link', 'sidebar'),
  ('sidebar.chat', 'Chat', 'Sidebar link', 'sidebar'),
  ('sidebar.comments', 'Comments', 'Sidebar link', 'sidebar'),
  ('sidebar.team', 'Team', 'Sidebar link', 'sidebar'),
  ('sidebar.casting', 'Casting', 'Sidebar link', 'sidebar'),
  ('sidebar.export', 'Export', 'Sidebar link', 'sidebar'),
  ('sidebar.share', 'Share', 'Sidebar link', 'sidebar'),
  ('sidebar.submissions', 'Submissions', 'Sidebar link', 'sidebar'),
  ('sidebar.press_kit', 'Press Kit', 'Sidebar link', 'sidebar'),
  ('sidebar.branding', 'Custom Branding', 'Sidebar link', 'sidebar'),
  ('sidebar.analytics', 'Analytics', 'Sidebar link', 'sidebar'),
  ('sidebar.reports', 'Reports', 'Sidebar link', 'sidebar'),
  ('sidebar.treatment', 'Treatment', 'Sidebar link', 'sidebar'),
  ('sidebar.coverage', 'Script Coverage', 'Sidebar link', 'sidebar'),
  ('sidebar.analysis', 'Script Analysis', 'Sidebar link', 'sidebar'),
  ('sidebar.revisions', 'Revisions', 'Sidebar link', 'sidebar'),
  ('sidebar.showcase', 'Showcase', 'Sidebar link', 'sidebar'),
  ('sidebar.settings', 'Settings', 'Sidebar link', 'sidebar'),
  ('sidebar.write', 'Write', 'Sidebar category', 'sidebar'),
  ('sidebar.plan', 'Plan', 'Sidebar category', 'sidebar'),
  ('sidebar.on_set_cat', 'On Set', 'Sidebar category', 'sidebar'),
  ('sidebar.creative', 'Creative', 'Sidebar category', 'sidebar'),
  ('sidebar.team_cat', 'Team', 'Sidebar category', 'sidebar'),
  ('sidebar.finish', 'Finish', 'Sidebar category', 'sidebar'),
  ('sidebar.studio', 'Studio', 'Sidebar category', 'sidebar'),

  -- ═══ Common UI ═══
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
  ('common.add', 'Add', 'Common action button', 'common'),
  ('common.rename', 'Rename', 'Common action button', 'common'),
  ('common.copy', 'Copy', 'Common action button', 'common'),
  ('common.paste', 'Paste', 'Common action button', 'common'),
  ('common.undo', 'Undo', 'Common action button', 'common'),
  ('common.redo', 'Redo', 'Common action button', 'common'),
  ('common.refresh', 'Refresh', 'Common action button', 'common'),
  ('common.export', 'Export', 'Common action button', 'common'),
  ('common.import', 'Import', 'Common action button', 'common'),
  ('common.filter', 'Filter', 'Common action', 'common'),
  ('common.sort', 'Sort', 'Common action', 'common'),
  ('common.all', 'All', 'Common filter option', 'common'),
  ('common.none', 'None', 'Common filter option', 'common'),
  ('common.enabled', 'Enabled', 'Common status', 'common'),
  ('common.disabled', 'Disabled', 'Common status', 'common'),
  ('common.active', 'Active', 'Common status', 'common'),
  ('common.inactive', 'Inactive', 'Common status', 'common'),
  ('common.online', 'Online', 'Common status', 'common'),
  ('common.offline', 'Offline', 'Common status', 'common'),
  ('common.view_all', 'View All', 'Common link', 'common'),
  ('common.show_more', 'Show More', 'Common action', 'common'),
  ('common.show_less', 'Show Less', 'Common action', 'common'),
  ('common.no_results', 'No results found', 'Common empty state', 'common'),
  ('common.required', 'Required', 'Common field label', 'common'),
  ('common.optional', 'Optional', 'Common field label', 'common'),
  ('common.characters', 'characters', 'Common character count', 'common'),
  ('common.words', 'words', 'Common word count', 'common'),
  ('common.minutes', 'minutes', 'Common time unit', 'common'),
  ('common.hours', 'hours', 'Common time unit', 'common'),
  ('common.days', 'days', 'Common time unit', 'common'),

  -- ═══ Translator Hub ═══
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
  ('translations.translated', 'translated', 'Translator hub progress label', 'translations'),
  ('translations.suggestion', 'Your suggestion', 'Translator hub label', 'translations'),
  ('translations.votes', 'votes', 'Translator hub vote count', 'translations'),

  -- ═══ Support ═══
  ('support.title', 'Support', 'Support page heading', 'support'),
  ('support.contact', 'Contact Us', 'Support action', 'support'),
  ('support.faq', 'FAQ', 'Support section', 'support'),
  ('support.docs', 'Documentation', 'Support section', 'support'),

  -- ═══ Pro ═══
  ('pro.title', 'Go Pro', 'Pro page heading', 'pro'),
  ('pro.subtitle', 'Unlock all features for your projects', 'Pro page subtitle', 'pro'),
  ('pro.current_plan', 'Current Plan', 'Pro section', 'pro'),
  ('pro.upgrade', 'Upgrade', 'Pro button', 'pro'),
  ('pro.manage', 'Manage Subscription', 'Pro button', 'pro'),

  -- ═══ Onboarding ═══
  ('onboarding.welcome', 'Welcome to Screenplay Studio', 'Onboarding heading', 'onboarding'),
  ('onboarding.lets_get_started', 'Let''s get you set up', 'Onboarding subtitle', 'onboarding'),
  ('onboarding.finish_setup', 'Finish Setup', 'Onboarding button', 'onboarding'),
  ('onboarding.skip', 'Skip for now', 'Onboarding button', 'onboarding'),

  -- ═══ Notifications ═══
  ('notifications.title', 'Notifications', 'Notifications page heading', 'notifications'),
  ('notifications.mark_all_read', 'Mark all as read', 'Notifications button', 'notifications'),
  ('notifications.no_notifications', 'No notifications yet', 'Notifications empty state', 'notifications'),

  -- ═══ Messages ═══
  ('messages.title', 'Messages', 'Messages page heading', 'messages'),
  ('messages.no_messages', 'No messages yet', 'Messages empty state', 'messages'),
  ('messages.new_message', 'New Message', 'Messages button', 'messages'),
  ('messages.search', 'Search conversations...', 'Messages search placeholder', 'messages'),

  -- ═══ Banned / Suspended ═══
  ('banned.title', 'Account Banned', 'Banned page heading', 'moderation'),
  ('banned.reason', 'Reason', 'Banned page label', 'moderation'),
  ('suspended.title', 'Account Suspended', 'Suspended page heading', 'moderation'),
  ('suspended.reason', 'Reason', 'Suspended page label', 'moderation'),
  ('suspended.expires', 'Expires', 'Suspended page label', 'moderation'),

  -- ═══ Keyboard Shortcuts ═══
  ('shortcuts.title', 'Keyboard Shortcuts', 'Shortcuts modal heading', 'shortcuts'),
  ('shortcuts.search', 'Quick search / command palette', 'Shortcuts description', 'shortcuts'),
  ('shortcuts.show', 'Show keyboard shortcuts', 'Shortcuts description', 'shortcuts'),
  ('shortcuts.new_project', 'New project (dashboard)', 'Shortcuts description', 'shortcuts'),
  ('shortcuts.close', 'Close modal / cancel', 'Shortcuts description', 'shortcuts'),
  ('shortcuts.move_up', 'Move up', 'Shortcuts description', 'shortcuts'),
  ('shortcuts.move_down', 'Move down', 'Shortcuts description', 'shortcuts')

ON CONFLICT (key) DO NOTHING;

-- ── Badge: Translator ─────────────────────────────────────────
-- Auto-awarded on first translation suggestion

INSERT INTO badges (name, description, emoji, color, is_system)
VALUES (
  'Translator',
  'Contributed a translation to the community',
  '🌍',
  '#3B82F6',
  true
)
ON CONFLICT DO NOTHING;

-- Trigger: award Translator badge on first translation suggestion

CREATE OR REPLACE FUNCTION award_translator_badge()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  translator_badge_id uuid;
BEGIN
  SELECT id INTO translator_badge_id
  FROM badges
  WHERE name = 'Translator' AND is_system = true
  LIMIT 1;

  IF translator_badge_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO user_badges (user_id, badge_id, awarded_by, display_slot)
  SELECT NEW.user_id, translator_badge_id, NULL, 1
  WHERE NOT EXISTS (
    SELECT 1 FROM user_badges
    WHERE user_id = NEW.user_id AND badge_id = translator_badge_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_translation_suggestion_badge ON translation_suggestions;
CREATE TRIGGER on_translation_suggestion_badge
  AFTER INSERT ON translation_suggestions
  FOR EACH ROW EXECUTE FUNCTION award_translator_badge();
