-- Storyboard print & scan.
--
-- 1. shots.storyboard_versions: earlier takes of a frame (scans, drawings kept
--    before a scan replaced them). storyboard_drawing stays the current one.
-- 2. storyboard_print_sheets: every printed template page that is tied to
--    shots gets a small numeric code. The code is printed as a bit strip next
--    to the corner marks, so a scan of the page knows which shot each frame
--    belongs to. Blank templates use code 0 and have no row. Re-runnable.

ALTER TABLE shots ADD COLUMN IF NOT EXISTS storyboard_versions JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN shots.storyboard_versions IS
  'Earlier versions of the storyboard frame: [{id, label, source: scan|drawn|restore, created_at, created_by, drawing: DrawingLayer[]}]';

CREATE SEQUENCE IF NOT EXISTS storyboard_print_sheet_code_seq START 1 MAXVALUE 16777215 CYCLE;

CREATE TABLE IF NOT EXISTS storyboard_print_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 24-bit code printed on the page (the strip holds 24 bits + a CRC).
  code INT NOT NULL UNIQUE DEFAULT nextval('storyboard_print_sheet_code_seq'),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- 'shotlist' (template pre-filled from the shot list) or 'drawn' (the board as drawn).
  kind TEXT NOT NULL CHECK (kind IN ('shotlist', 'drawn')),
  page_index INT NOT NULL DEFAULT 0,
  page_count INT NOT NULL DEFAULT 1,
  -- Shot id for each frame slot on the page, in print order; null = empty slot.
  frames JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER SEQUENCE storyboard_print_sheet_code_seq OWNED BY storyboard_print_sheets.code;

CREATE INDEX IF NOT EXISTS idx_storyboard_print_sheets_project ON storyboard_print_sheets(project_id);

ALTER TABLE storyboard_print_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Print sheets follow project access" ON storyboard_print_sheets;
CREATE POLICY "Print sheets follow project access"
  ON storyboard_print_sheets FOR ALL USING (
    public.has_project_access(project_id, auth.uid())
  );
