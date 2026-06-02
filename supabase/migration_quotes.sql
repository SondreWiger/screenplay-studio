-- ============================================================
-- Quotes
-- Fun quotes from set and everyday life. Global quotes are
-- accessible from the navbar, while project-scoped quotes
-- live within a specific project workspace.
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quotes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content      text NOT NULL,
  said_by      text NOT NULL,
  said_at      date,
  context      text,
  location     text,
  group_name   text,
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_quotes_created_by   ON quotes(created_by);
CREATE INDEX IF NOT EXISTS idx_quotes_project_id   ON quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_quotes_group_name   ON quotes(group_name);

-- ── updated_at trigger ──────────────────────────────────────

CREATE OR REPLACE FUNCTION set_quotes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_updated_at ON quotes;
CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_quotes_updated_at();

-- ── Row Level Security ──────────────────────────────────────

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- SELECT: users see their own quotes, project quotes for
-- projects they're members of, and global quotes (NULL project_id)
DROP POLICY IF EXISTS "quotes_select" ON quotes;
CREATE POLICY "quotes_select" ON quotes
  FOR SELECT USING (
    created_by = auth.uid()
    OR (project_id IS NULL)
    OR project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- INSERT: any authenticated user can create a quote
DROP POLICY IF EXISTS "quotes_insert" ON quotes;
CREATE POLICY "quotes_insert" ON quotes
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- UPDATE: only the creator can update
DROP POLICY IF EXISTS "quotes_update" ON quotes;
CREATE POLICY "quotes_update" ON quotes
  FOR UPDATE USING (created_by = auth.uid());

-- DELETE: only the creator can delete
DROP POLICY IF EXISTS "quotes_delete" ON quotes;
CREATE POLICY "quotes_delete" ON quotes
  FOR DELETE USING (created_by = auth.uid());

-- ── Grants ──────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON quotes TO authenticated;

-- ── Changelog entry ─────────────────────────────────────────

INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES ('2.9.0', 'Quotes', 'Fun quotes from set and everyday life — global and project-scoped.', 'minor')
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Quotes',
  'Capture fun quotes from set and everyday life. Global quotes are accessible from the top navbar, and project-scoped quotes let the crew save memorable moments forever. Sort and filter by who said it, context, location, and group.',
  'feature',
  'documents',
  true,
  10
FROM changelog_releases WHERE version = '2.9.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce
  JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.9.0' AND ce.title = 'Quotes'
);
