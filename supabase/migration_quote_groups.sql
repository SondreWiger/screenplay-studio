-- ============================================================
-- Quote Groups
-- Shared groups that allow multiple users to contribute quotes
-- to a common collection. Each group has an owner and members.
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quote_groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  emoji        text DEFAULT '💬',
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_group_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES quote_groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- Add group_id to the existing quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES quote_groups(id) ON DELETE SET NULL;

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_quote_groups_created_by ON quote_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_quote_group_members_group ON quote_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_quote_group_members_user ON quote_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_group_id ON quotes(group_id);

-- ── updated_at triggers ──────────────────────────────────────

CREATE OR REPLACE FUNCTION set_quote_groups_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_quote_groups_updated_at ON quote_groups;
CREATE TRIGGER trg_quote_groups_updated_at
  BEFORE UPDATE ON quote_groups
  FOR EACH ROW EXECUTE FUNCTION set_quote_groups_updated_at();

-- ── Row Level Security ──────────────────────────────────────

ALTER TABLE quote_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_group_members  ENABLE ROW LEVEL SECURITY;

-- ── quote_groups policies ───────────────────────────────────

DROP POLICY IF EXISTS "quote_groups_select" ON quote_groups;
CREATE POLICY "quote_groups_select" ON quote_groups
  FOR SELECT USING (
    created_by = auth.uid()
    OR id IN (SELECT group_id FROM quote_group_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "quote_groups_insert" ON quote_groups;
CREATE POLICY "quote_groups_insert" ON quote_groups
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "quote_groups_update" ON quote_groups;
CREATE POLICY "quote_groups_update" ON quote_groups
  FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "quote_groups_delete" ON quote_groups;
CREATE POLICY "quote_groups_delete" ON quote_groups
  FOR DELETE USING (created_by = auth.uid());

-- ── quote_group_members policies ────────────────────────────

DROP POLICY IF EXISTS "qgm_select" ON quote_group_members;
CREATE POLICY "qgm_select" ON quote_group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR group_id IN (SELECT id FROM quote_groups WHERE created_by = auth.uid())
  );

DROP POLICY IF EXISTS "qgm_insert" ON quote_group_members;
CREATE POLICY "qgm_insert" ON quote_group_members
  FOR INSERT WITH CHECK (
    group_id IN (SELECT id FROM quote_groups WHERE created_by = auth.uid())
  );

DROP POLICY IF EXISTS "qgm_delete" ON quote_group_members;
CREATE POLICY "qgm_delete" ON quote_group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR group_id IN (SELECT id FROM quote_groups WHERE created_by = auth.uid())
  );

-- ── Update quotes RLS to include group-based access ─────────

-- Drop and recreate the SELECT policy to also allow group members
DROP POLICY IF EXISTS "quotes_select" ON quotes;
CREATE POLICY "quotes_select" ON quotes
  FOR SELECT USING (
    created_by = auth.uid()
    OR (project_id IS NULL AND group_id IS NULL)
    OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    OR group_id IN (SELECT id FROM quote_groups WHERE created_by = auth.uid())
    OR group_id IN (SELECT group_id FROM quote_group_members WHERE user_id = auth.uid())
  );

-- ── Grants ──────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON quote_groups        TO authenticated;
GRANT SELECT, INSERT, DELETE        ON quote_group_members  TO authenticated;

-- ── Changelog entry ─────────────────────────────────────────

INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES ('2.10.0', 'Shared Quote Groups', 'Create shared quote groups and invite others to contribute.', 'minor')
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Shared Quote Groups',
  'Create shared quote groups and invite others to contribute. Groups can be public or private, and members can add quotes to the group collection.',
  'feature',
  'collaboration',
  true,
  10
FROM changelog_releases WHERE version = '2.10.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.10.0' AND ce.title = 'Shared Quote Groups'
);
