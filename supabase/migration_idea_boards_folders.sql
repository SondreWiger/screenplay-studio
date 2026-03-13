-- ============================================================
-- Idea Boards — Folder / Nesting Support
-- 
-- Adds parent_id + root_board_id to idea_boards so boards can
-- nest infinitely (like folders). Members are always attached
-- to the root board; child boards inherit that access.
-- ============================================================

-- ── Schema additions ─────────────────────────────────────────

ALTER TABLE idea_boards
  ADD COLUMN IF NOT EXISTS parent_id     uuid REFERENCES idea_boards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS root_board_id uuid REFERENCES idea_boards(id) ON DELETE CASCADE;

-- parent_id:     direct parent (NULL = top-level / root board)
-- root_board_id: always the top-level ancestor (NULL for root boards themselves)

CREATE INDEX IF NOT EXISTS idx_idea_boards_parent   ON idea_boards(parent_id);
CREATE INDEX IF NOT EXISTS idx_idea_boards_root     ON idea_boards(root_board_id);

-- ── Helper function ───────────────────────────────────────────
-- Returns board_ids where the current user is an explicit member.
-- SECURITY DEFINER + search_path so auth.uid() resolves correctly
-- and breaks the SELECT policy → ibm → idea_boards recursion.

CREATE OR REPLACE FUNCTION get_member_board_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, auth
AS $$
  SELECT board_id FROM idea_board_members WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_member_board_ids() TO authenticated;

-- ── Updated RLS policies ──────────────────────────────────────

-- SELECT: user can see a board if:
--   1. They own it
--   2. It is a root board and they are an explicit member
--   3. Its root ancestor is owned by them (child board of own board)
--   4. Its root ancestor has them as an explicit member (shared subtree)

DROP POLICY IF EXISTS "idea_boards_select" ON idea_boards;
CREATE POLICY "idea_boards_select" ON idea_boards
  FOR SELECT USING (
    owner_id = auth.uid()
    OR (root_board_id IS NULL AND id              IN (SELECT get_member_board_ids()))
    OR                           root_board_id    IN (SELECT get_owned_board_ids())
    OR                           root_board_id    IN (SELECT get_member_board_ids())
  );

-- INSERT: owner_id must be current user.
-- For root boards: no extra check.
-- For child boards: root_board_id must point to a board they own OR are a member of.
-- (The frontend always sets root_board_id = parent.root_board_id ?? parent.id)

DROP POLICY IF EXISTS "idea_boards_insert" ON idea_boards;
CREATE POLICY "idea_boards_insert" ON idea_boards
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    AND (
      parent_id IS NULL                                           -- root board
      OR root_board_id IN (SELECT get_owned_board_ids())         -- child of own board
      OR root_board_id IN (SELECT get_member_board_ids())        -- child of shared board
    )
  );

-- ── Recreate view to pick up new columns ─────────────────────
-- CREATE OR REPLACE VIEW can't change column structure, so drop first.

DROP VIEW IF EXISTS idea_boards_with_meta;
CREATE VIEW idea_boards_with_meta AS
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

GRANT SELECT ON idea_boards_with_meta TO authenticated;
