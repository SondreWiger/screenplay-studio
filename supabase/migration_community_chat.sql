-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Community Chat (Discord-style channels + messages)
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables:
--   community_channels   – text/announcement channels per community
--   community_messages   – messages per channel (real-time)
-- Alterations:
--   sub_communities      – adds discord_invite_url, discord_server_id
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Add Discord fields to sub_communities ────────────────────────────────────
ALTER TABLE sub_communities
  ADD COLUMN IF NOT EXISTS discord_invite_url TEXT,       -- e.g. https://discord.gg/xyz
  ADD COLUMN IF NOT EXISTS discord_server_id  TEXT,       -- numeric guild ID for the embed widget
  ADD COLUMN IF NOT EXISTS chat_mode          TEXT NOT NULL DEFAULT 'chat'
                            CHECK (chat_mode IN ('chat','discord_only'));
-- 'chat'         → built-in channel chat is shown
-- 'discord_only' → chat tab redirects to the Discord invite / shows only a join-Discord card

-- ── Community channels ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_channels (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID        NOT NULL REFERENCES sub_communities(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,                -- e.g. "general", "feedback"
  description   TEXT,                               -- shown in channel header
  type          TEXT        NOT NULL DEFAULT 'text'
                            CHECK (type IN ('text', 'announcement', 'readonly')),
  -- 'text'         → members can post
  -- 'announcement' → only mods/admins can post
  -- 'readonly'     → nobody can post (pinboard style)
  position      INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(community_id, name)
);

CREATE INDEX IF NOT EXISTS idx_community_channels_community
  ON community_channels(community_id, position);

-- ── Community messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID        NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  edited_at   TIMESTAMPTZ,
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_messages_channel
  ON community_messages(channel_id, created_at DESC);

-- ── Default channel for every existing community ─────────────────────────────
INSERT INTO community_channels (community_id, name, description, type, position)
SELECT id, 'general', 'General discussion', 'text', 0
FROM sub_communities
ON CONFLICT (community_id, name) DO NOTHING;

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE community_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_messages ENABLE ROW LEVEL SECURITY;

-- Channels: visible to anyone who can see the community
CREATE POLICY "community_channels_select" ON community_channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sub_communities sc
      WHERE sc.id = community_id
        AND (
          sc.visibility IN ('public', 'restricted')
          OR EXISTS (
            SELECT 1 FROM sub_community_members m
            WHERE m.community_id = sc.id
              AND m.user_id = auth.uid()
              AND m.role NOT IN ('banned', 'pending_approval')
          )
        )
    )
  );

-- Channels: only mods/admins can create
CREATE POLICY "community_channels_insert_mod" ON community_channels
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sub_community_members
      WHERE community_id = community_channels.community_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'moderator')
    )
  );

-- Channels: only mods/admins can update
CREATE POLICY "community_channels_update_mod" ON community_channels
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sub_community_members
      WHERE community_id = community_channels.community_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'moderator')
    )
  );

-- Channels: only mods/admins can delete
CREATE POLICY "community_channels_delete_mod" ON community_channels
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM sub_community_members
      WHERE community_id = community_channels.community_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'moderator')
    )
  );

-- Messages: readable by anyone who can see the community
CREATE POLICY "community_messages_select" ON community_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_channels cc
      JOIN sub_communities sc ON sc.id = cc.community_id
      WHERE cc.id = channel_id
        AND (
          sc.visibility IN ('public', 'restricted')
          OR EXISTS (
            SELECT 1 FROM sub_community_members m
            WHERE m.community_id = sc.id
              AND m.user_id = auth.uid()
              AND m.role NOT IN ('banned', 'pending_approval')
          )
        )
    )
  );

-- Messages: members can post to 'text' channels; only mods to 'announcement'
CREATE POLICY "community_messages_insert_member" ON community_messages
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM community_channels cc
      JOIN sub_communities sc ON sc.id = cc.community_id
      LEFT JOIN sub_community_members m ON m.community_id = sc.id AND m.user_id = auth.uid()
      WHERE cc.id = channel_id
        AND cc.type != 'readonly'
        AND (
          -- 'announcement' channels only mods/admins
          (cc.type = 'announcement' AND m.role IN ('admin', 'moderator'))
          OR
          -- 'text' channels: must be a member (or public community)
          (
            cc.type = 'text'
            AND (
              sc.visibility = 'public'
              OR (m.role IS NOT NULL AND m.role NOT IN ('banned', 'pending_approval'))
            )
          )
        )
    )
  );

-- Messages: author can edit own (non-deleted) messages
CREATE POLICY "community_messages_update_own" ON community_messages
  FOR UPDATE USING (
    auth.uid() = author_id AND NOT is_deleted
  );

-- Messages: author can delete own; mods can delete any in their community
CREATE POLICY "community_messages_delete" ON community_messages
  FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM community_channels cc
      JOIN sub_community_members m ON m.community_id = cc.community_id AND m.user_id = auth.uid()
      WHERE cc.id = channel_id AND m.role IN ('admin', 'moderator')
    )
  );

-- ── Enable Supabase Realtime ──────────────────────────────────────────────────
-- Run this in Supabase dashboard → Database → Replication, or uncomment:
-- ALTER PUBLICATION supabase_realtime ADD TABLE community_messages;
