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


COMMIT;
