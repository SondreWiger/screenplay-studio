-- ═══════════════════════════════════════════════════════════════════════════
--  COMMUNITY COLLABORATION + MENTIONS + NOTIFICATION EXPANSIONS
--  new tables: community_post_collaborators
--  new notification types added via comments (handled in app types)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Collaborators table ────────────────────────────────────────────────────
-- Tracks users credited as collaborators on a community post.

CREATE TABLE IF NOT EXISTS community_post_collaborators (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cpc_post ON community_post_collaborators(post_id);
CREATE INDEX IF NOT EXISTS idx_cpc_user ON community_post_collaborators(user_id);

ALTER TABLE community_post_collaborators ENABLE ROW LEVEL SECURITY;

-- Anyone can read collaborators
DROP POLICY IF EXISTS "cpc_select" ON community_post_collaborators;
CREATE POLICY "cpc_select" ON community_post_collaborators FOR SELECT USING (true);

-- Post owner or existing collaborator can add/remove collaborators
DROP POLICY IF EXISTS "cpc_insert" ON community_post_collaborators;
CREATE POLICY "cpc_insert" ON community_post_collaborators FOR INSERT
  WITH CHECK (
    auth.uid() = added_by
    AND (
      auth.uid() IN (SELECT author_id FROM community_posts WHERE id = post_id)
      OR auth.uid() IN (SELECT user_id FROM community_post_collaborators WHERE post_id = community_post_collaborators.post_id)
    )
  );

DROP POLICY IF EXISTS "cpc_delete" ON community_post_collaborators;
CREATE POLICY "cpc_delete" ON community_post_collaborators FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT author_id FROM community_posts WHERE id = post_id)
  );

GRANT SELECT, INSERT, DELETE ON community_post_collaborators TO authenticated;

-- ── 2. Post mentions table ────────────────────────────────────────────────────
-- Stores @username mentions made in comments, so we can index/notify.

CREATE TABLE IF NOT EXISTS community_mentions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id   UUID,               -- optional: link to the comment row
  mentioned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentioned_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_user ON community_mentions(mentioned_user_id);

ALTER TABLE community_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cm_select" ON community_mentions;
CREATE POLICY "cm_select" ON community_mentions FOR SELECT USING (true);

DROP POLICY IF EXISTS "cm_insert" ON community_mentions;
CREATE POLICY "cm_insert" ON community_mentions FOR INSERT WITH CHECK (
  auth.uid() = mentioned_by
);

GRANT SELECT, INSERT ON community_mentions TO authenticated;

-- ── 3. Feedback subscriptions (already in feedback migration, no-op if exists) ─
-- Ensures users can follow feedback items and receive notifications on updates.
CREATE TABLE IF NOT EXISTS feedback_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);
