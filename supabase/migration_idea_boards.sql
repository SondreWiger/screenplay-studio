-- ============================================================
-- Idea Boards
-- Collaborative block-based note boards that live outside of
-- projects. Users can have personal boards or share them with
-- collaborators. Boards can optionally be linked to a project.
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS idea_boards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL DEFAULT 'Untitled Board',
  description  text,
  emoji        text DEFAULT '💡',
  color        text DEFAULT '#6366f1',
  linked_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  is_archived  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Members of a board (owner is implicitly an editor)
-- role: 'editor' can read + write nodes; 'viewer' can read only
CREATE TABLE IF NOT EXISTS idea_board_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   uuid NOT NULL REFERENCES idea_boards(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, user_id)
);

-- Content blocks (nodes) on a board
-- type: heading | text | checklist | divider | project_link | image
-- content JSONB shape per type:
--   heading:      { text }
--   text:         { text }
--   checklist:    { text, checked }
--   divider:      {}
--   project_link: { project_id, project_title, project_color }
--   image:        { url, caption }
CREATE TABLE IF NOT EXISTS idea_nodes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    uuid NOT NULL REFERENCES idea_boards(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'text'
                CHECK (type IN ('heading', 'text', 'checklist', 'divider', 'project_link', 'image')),
  content     jsonb NOT NULL DEFAULT '{}',
  sort_order  numeric NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_idea_boards_owner     ON idea_boards(owner_id);
CREATE INDEX IF NOT EXISTS idx_idea_boards_project   ON idea_boards(linked_project_id);
CREATE INDEX IF NOT EXISTS idx_idea_board_members_board ON idea_board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_idea_board_members_user  ON idea_board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_idea_nodes_board      ON idea_nodes(board_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_idea_nodes_created_by ON idea_nodes(created_by);

-- ── updated_at triggers ──────────────────────────────────────

CREATE OR REPLACE FUNCTION set_idea_boards_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_idea_boards_updated_at ON idea_boards;
CREATE TRIGGER trg_idea_boards_updated_at
  BEFORE UPDATE ON idea_boards
  FOR EACH ROW EXECUTE FUNCTION set_idea_boards_updated_at();

CREATE OR REPLACE FUNCTION set_idea_nodes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_idea_nodes_updated_at ON idea_nodes;
CREATE TRIGGER trg_idea_nodes_updated_at
  BEFORE UPDATE ON idea_nodes
  FOR EACH ROW EXECUTE FUNCTION set_idea_nodes_updated_at();

-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE idea_boards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_nodes         ENABLE ROW LEVEL SECURITY;

-- ── idea_boards policies ─────────────────────────────────────

-- Helper: returns board IDs owned by the current user.
-- SECURITY DEFINER bypasses RLS on idea_boards so ibm_select
-- can check ownership without causing infinite recursion.
CREATE OR REPLACE FUNCTION get_owned_board_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT id FROM idea_boards WHERE owner_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_owned_board_ids() TO authenticated;

DROP POLICY IF EXISTS "idea_boards_select" ON idea_boards;
CREATE POLICY "idea_boards_select" ON idea_boards
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (SELECT board_id FROM idea_board_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "idea_boards_insert" ON idea_boards;
CREATE POLICY "idea_boards_insert" ON idea_boards
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "idea_boards_update" ON idea_boards;
CREATE POLICY "idea_boards_update" ON idea_boards
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "idea_boards_delete" ON idea_boards;
CREATE POLICY "idea_boards_delete" ON idea_boards
  FOR DELETE USING (owner_id = auth.uid());

-- ── idea_board_members policies ──────────────────────────────

DROP POLICY IF EXISTS "ibm_select" ON idea_board_members;
CREATE POLICY "ibm_select" ON idea_board_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR board_id IN (SELECT get_owned_board_ids())
  );

DROP POLICY IF EXISTS "ibm_insert" ON idea_board_members;
CREATE POLICY "ibm_insert" ON idea_board_members
  FOR INSERT WITH CHECK (
    board_id IN (SELECT id FROM idea_boards WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "ibm_update" ON idea_board_members;
CREATE POLICY "ibm_update" ON idea_board_members
  FOR UPDATE USING (
    board_id IN (SELECT id FROM idea_boards WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "ibm_delete" ON idea_board_members;
CREATE POLICY "ibm_delete" ON idea_board_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR board_id IN (SELECT id FROM idea_boards WHERE owner_id = auth.uid())
  );

-- ── idea_nodes policies ──────────────────────────────────────

DROP POLICY IF EXISTS "idea_nodes_select" ON idea_nodes;
CREATE POLICY "idea_nodes_select" ON idea_nodes
  FOR SELECT USING (
    board_id IN (
      SELECT id FROM idea_boards WHERE owner_id = auth.uid()
      UNION ALL
      SELECT board_id FROM idea_board_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "idea_nodes_insert" ON idea_nodes;
CREATE POLICY "idea_nodes_insert" ON idea_nodes
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND board_id IN (
      SELECT id FROM idea_boards WHERE owner_id = auth.uid()
      UNION ALL
      SELECT board_id FROM idea_board_members WHERE user_id = auth.uid() AND role = 'editor'
    )
  );

DROP POLICY IF EXISTS "idea_nodes_update" ON idea_nodes;
CREATE POLICY "idea_nodes_update" ON idea_nodes
  FOR UPDATE USING (
    board_id IN (
      SELECT id FROM idea_boards WHERE owner_id = auth.uid()
      UNION ALL
      SELECT board_id FROM idea_board_members WHERE user_id = auth.uid() AND role = 'editor'
    )
  );

DROP POLICY IF EXISTS "idea_nodes_delete" ON idea_nodes;
CREATE POLICY "idea_nodes_delete" ON idea_nodes
  FOR DELETE USING (
    board_id IN (
      SELECT id FROM idea_boards WHERE owner_id = auth.uid()
      UNION ALL
      SELECT board_id FROM idea_board_members WHERE user_id = auth.uid() AND role = 'editor'
    )
  );

-- ── Convenience view for board list with member count ────────

CREATE OR REPLACE VIEW idea_boards_with_meta AS
SELECT
  b.*,
  p.full_name  AS owner_name,
  p.avatar_url AS owner_avatar,
  COUNT(DISTINCT m.user_id) AS member_count,
  lp.title       AS linked_project_title,
  NULL::text     AS linked_project_color
FROM idea_boards b
LEFT JOIN profiles           p  ON p.id = b.owner_id
LEFT JOIN idea_board_members m  ON m.board_id = b.id
LEFT JOIN projects           lp ON lp.id = b.linked_project_id
GROUP BY b.id, p.full_name, p.avatar_url, lp.title;

-- Grant authenticated users access
GRANT SELECT ON idea_boards_with_meta TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON idea_boards        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON idea_board_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON idea_nodes         TO authenticated;

-- ── Changelog entry ──────────────────────────────────────────

INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES ('2.8.0', 'Idea Boards', 'Collaborative block-based boards for capturing ideas outside of projects.', 'minor')
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Idea Boards',
  'New collaborative idea boards that live outside of projects. Create personal boards or share them with collaborators. Add text, headings, checklists, dividers, and project links. Boards can optionally be linked to a specific project.',
  'feature',
  'documents',
  true,
  10
FROM changelog_releases WHERE version = '2.8.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.8.0' AND ce.title = 'Idea Boards'
);
