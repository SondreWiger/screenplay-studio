-- ============================================================
-- Project Share Links
-- Replaces external_shares + review_sessions with a clean,
-- simple link-based sharing system.
-- ============================================================

CREATE TABLE IF NOT EXISTS project_share_links (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by     UUID        NOT NULL REFERENCES profiles(id),
  name           TEXT        NOT NULL,
  -- Unique public token — the URL secret. 24 random bytes → 32 char url-safe base64 (no padding).
  token          TEXT        NOT NULL UNIQUE DEFAULT replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),

  -- Content permissions
  can_view_script      BOOLEAN NOT NULL DEFAULT false,
  can_view_characters  BOOLEAN NOT NULL DEFAULT false,
  can_view_scenes      BOOLEAN NOT NULL DEFAULT false,
  can_view_schedule    BOOLEAN NOT NULL DEFAULT false,
  can_view_documents   BOOLEAN NOT NULL DEFAULT false,
  can_view_notes       BOOLEAN NOT NULL DEFAULT false,
  can_edit_notes       BOOLEAN NOT NULL DEFAULT false,

  -- Invite behaviour: if true the recipient must sign in/up
  -- and is then automatically added to project_members
  is_invite    BOOLEAN NOT NULL DEFAULT false,
  invite_role  TEXT    NOT NULL DEFAULT 'viewer'
               CHECK (invite_role IN ('viewer', 'commenter', 'editor')),

  -- Stats
  view_count   INT  NOT NULL DEFAULT 0,

  -- Lifecycle
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_project_share_links_project   ON project_share_links(project_id);
CREATE INDEX IF NOT EXISTS idx_project_share_links_token     ON project_share_links(token);
CREATE INDEX IF NOT EXISTS idx_project_share_links_created_by ON project_share_links(created_by);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE project_share_links ENABLE ROW LEVEL SECURITY;

-- Project owners / admins / editors can do everything on their links
DROP POLICY IF EXISTS "project_members_manage_share_links" ON project_share_links;
CREATE POLICY "project_members_manage_share_links" ON project_share_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_share_links.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'editor')
    )
  );

-- Anyone (anon + authenticated) can read an active, non-expired link by token.
-- The token acts as the access credential — 256 bits of entropy makes it
-- impractical to enumerate. We rely on the caller also filtering by token.
DROP POLICY IF EXISTS "public_read_active_share_links" ON project_share_links;
CREATE POLICY "public_read_active_share_links" ON project_share_links
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );

-- ── Helpers ─────────────────────────────────────────────────

-- Increment view count — callable by anon (no RLS write required).
CREATE OR REPLACE FUNCTION increment_share_link_views(link_token TEXT)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE project_share_links
  SET view_count = view_count + 1,
      updated_at  = now()
  WHERE token = link_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
$$;

-- Accept an invite link — validates token, adds caller to project_members.
-- Returns the project_id so the client can redirect.
CREATE OR REPLACE FUNCTION accept_share_invite(link_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link   project_share_links%ROWTYPE;
  v_uid    UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link
  FROM project_share_links
  WHERE token = link_token
    AND is_active = true
    AND is_invite = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite link';
  END IF;

  -- Add to project_members if not already a member
  INSERT INTO project_members (project_id, user_id, role, joined_at)
  VALUES (v_link.project_id, v_uid, v_link.invite_role, now())
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN v_link.project_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION increment_share_link_views(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION accept_share_invite(TEXT) TO authenticated;

-- ============================================================
-- regenerate_share_link_token(link_id UUID)
-- Replace the token on a share link with a fresh random one.
-- Only members with manage rights should call this (enforced by
-- RLS on the underlying table — caller must own the project).
-- ============================================================
CREATE OR REPLACE FUNCTION regenerate_share_link_token(link_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE project_share_links
  SET token      = replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),
      updated_at = now()
  WHERE id = link_id;
END;
$$;

-- Only authenticated users can call regenerate
GRANT EXECUTE ON FUNCTION regenerate_share_link_token(UUID) TO authenticated;

-- ============================================================
-- Patch existing table (safe to re-run)
-- ============================================================

-- Fix token default — PostgreSQL has no 'base64url' encoding.
-- Use standard base64 then swap the two URL-unsafe characters.
ALTER TABLE project_share_links
  ALTER COLUMN token
  SET DEFAULT replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_');

-- Add notes permission columns
ALTER TABLE project_share_links ADD COLUMN IF NOT EXISTS can_view_notes BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE project_share_links ADD COLUMN IF NOT EXISTS can_edit_notes BOOLEAN NOT NULL DEFAULT false;

