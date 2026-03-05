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
