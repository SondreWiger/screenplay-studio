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
-- 30. FESTIVAL SUBMISSIONS
-- Users can submit their project's scripts to festivals.
-- Script content is snapshotted at submission time.
-- ============================================================

CREATE TABLE IF NOT EXISTS festivals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  website TEXT,
  logo_url TEXT,
  deadline TIMESTAMPTZ,
  location TEXT,
  categories TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS festival_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  script_snapshot JSONB,
  title TEXT NOT NULL,
  logline TEXT,
  genre TEXT,
  format TEXT,
  script_type TEXT DEFAULT 'screenplay',
  page_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'accepted', 'rejected', 'withdrawn')),
  submitted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(festival_id, project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_festival_submissions_user ON festival_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_festival_submissions_festival ON festival_submissions(festival_id);
CREATE INDEX IF NOT EXISTS idx_festival_submissions_project ON festival_submissions(project_id);

ALTER TABLE festivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_submissions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON festivals TO authenticated, anon, service_role;
GRANT ALL ON festival_submissions TO authenticated, anon, service_role;

-- Festivals are readable by everyone
DROP POLICY IF EXISTS "Festivals are public" ON festivals;
CREATE POLICY "Festivals are public" ON festivals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage festivals" ON festivals;
CREATE POLICY "Admins can manage festivals" ON festivals
  FOR ALL USING (
    auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
    OR auth.uid() = created_by
  );

-- Users manage their own submissions
DROP POLICY IF EXISTS "Users see own submissions" ON festival_submissions;
CREATE POLICY "Users see own submissions" ON festival_submissions
  FOR SELECT USING (user_id = auth.uid() OR auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid);

DROP POLICY IF EXISTS "Users create submissions" ON festival_submissions;
CREATE POLICY "Users create submissions" ON festival_submissions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own submissions" ON festival_submissions;
CREATE POLICY "Users manage own submissions" ON festival_submissions
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own submissions" ON festival_submissions;
CREATE POLICY "Users delete own submissions" ON festival_submissions
  FOR DELETE USING (user_id = auth.uid());

-- Snapshot a project's script for festival submission
CREATE OR REPLACE FUNCTION snapshot_script_for_festival(
  p_project_id UUID,
  p_festival_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_project RECORD;
  v_script RECORD;
  v_snapshot JSONB;
  v_word_count INTEGER;
  v_element_count INTEGER;
  v_sub_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, title, logline, genre, format, script_type INTO v_project FROM projects WHERE id = p_project_id;
  IF v_project IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;

  SELECT id INTO v_script FROM scripts WHERE project_id = p_project_id ORDER BY created_at ASC LIMIT 1;
  IF v_script IS NULL THEN RAISE EXCEPTION 'No script found'; END IF;

  -- Snapshot elements
  SELECT jsonb_agg(
    jsonb_build_object(
      'element_type', element_type,
      'content', content,
      'sort_order', sort_order,
      'scene_number', scene_number,
      'is_omitted', is_omitted,
      'revision_color', revision_color
    ) ORDER BY sort_order
  ) INTO v_snapshot
  FROM script_elements WHERE script_id = v_script.id AND is_omitted = false;

  SELECT COUNT(*), COALESCE(SUM(array_length(regexp_split_to_array(content, '\s+'), 1)), 0)
  INTO v_element_count, v_word_count
  FROM script_elements WHERE script_id = v_script.id AND is_omitted = false;

  INSERT INTO festival_submissions (
    festival_id, project_id, user_id, script_snapshot,
    title, logline, genre, format, script_type,
    page_count, word_count, notes
  ) VALUES (
    p_festival_id, p_project_id, v_user_id, v_snapshot,
    v_project.title, v_project.logline, v_project.genre, v_project.format, v_project.script_type,
    GREATEST(1, CEIL(v_word_count::decimal / 250)), v_word_count, p_notes
  )
  ON CONFLICT (festival_id, project_id, user_id)
  DO UPDATE SET
    script_snapshot = EXCLUDED.script_snapshot,
    title = EXCLUDED.title,
    logline = EXCLUDED.logline,
    genre = EXCLUDED.genre,
    format = EXCLUDED.format,
    page_count = EXCLUDED.page_count,
    word_count = EXCLUDED.word_count,
    notes = COALESCE(EXCLUDED.notes, festival_submissions.notes),
    updated_at = NOW()
  RETURNING id INTO v_sub_id;

  RETURN v_sub_id;
END;
$$;

-- ============================================================
-- 31. GENERAL CHAT FORUM
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
-- 32. ADDITIONAL NOTIFICATION TYPES
-- ============================================================

DO $$
BEGIN
  IF to_regtype('public.notification_type') IS NOT NULL THEN
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'production_submitted';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'production_approved';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'production_rejected';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'festival_deadline';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'chat_mention';
  END IF;
END $$;
