-- ▼▼▼ COPY FROM HERE — select the whole file (Cmd+A) so nothing is cut off ▼▼▼
-- ============================================================================
-- Novel projects
--
-- A project type for books and short stories. The manuscript is a binder of
-- parts, chapters and front/back matter, each stored as its own row so a
-- 100k-word book loads and saves one chapter at a time.
--
--   novel_chapters         binder items and their prose
--   novel_snapshots        saved versions of a chapter, restorable
--   novel_writing_log      words written per writer per day (goals, streaks)
--   novel_timeline_events  story chronology, separate from narrative order
--
-- Book-level settings (word target, deadline, query kit, export options)
-- live in projects.content_metadata.novel, like the beat sheets do.
-- ============================================================================

-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so it goes
-- first and on its own.
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'novel';

BEGIN;

-- ─── Binder ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS novel_chapters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL DEFAULT 'chapter'
                     CHECK (kind IN ('part', 'chapter', 'front_matter', 'back_matter')),
  title            TEXT NOT NULL DEFAULT '',
  content          TEXT NOT NULL DEFAULT '',          -- sanitised HTML
  synopsis         TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('idea', 'outline', 'draft', 'revised', 'final')),
  pov_character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  pov              TEXT,                              -- free text when no character row fits
  tense            TEXT CHECK (tense IN ('past', 'present', 'future', 'mixed')),
  label_color      TEXT,
  target_words     INTEGER CHECK (target_words IS NULL OR target_words >= 0),
  word_count       INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  include_in_export BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS novel_chapters_project_idx ON novel_chapters (project_id, sort_order);

-- ─── Snapshots ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS novel_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id  UUID NOT NULL REFERENCES novel_chapters(id) ON DELETE CASCADE,
  label       TEXT,
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  word_count  INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS novel_snapshots_chapter_idx ON novel_snapshots (chapter_id, created_at DESC);

-- ─── Writing log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS novel_writing_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  words       INTEGER NOT NULL DEFAULT 0,
  sprints     INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id, day)
);

CREATE INDEX IF NOT EXISTS novel_writing_log_project_idx ON novel_writing_log (project_id, day);

-- ─── Timeline ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS novel_timeline_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  story_date    TEXT,                                 -- "Day 3", "Spring 1888", "2041-05-02"
  description   TEXT,
  chapter_id    UUID REFERENCES novel_chapters(id) ON DELETE SET NULL,
  character_ids UUID[] NOT NULL DEFAULT '{}',
  color         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,           -- chronological order
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS novel_timeline_events_project_idx ON novel_timeline_events (project_id, sort_order);

-- ─── updated_at triggers ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS novel_chapters_updated_at ON novel_chapters;
CREATE TRIGGER novel_chapters_updated_at BEFORE UPDATE ON novel_chapters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS novel_snapshots_updated_at ON novel_snapshots;
CREATE TRIGGER novel_snapshots_updated_at BEFORE UPDATE ON novel_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS novel_writing_log_updated_at ON novel_writing_log;
CREATE TRIGGER novel_writing_log_updated_at BEFORE UPDATE ON novel_writing_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS novel_timeline_events_updated_at ON novel_timeline_events;
CREATE TRIGGER novel_timeline_events_updated_at BEFORE UPDATE ON novel_timeline_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Word count is derived from the prose, so chapters written through the MCP
-- server or the API stay correct without the client sending a count. Splits
-- on whitespace after stripping tags, the same rule as lib/novel/text.ts.
CREATE OR REPLACE FUNCTION public.novel_chapter_word_count() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE plain TEXT;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.content IS DISTINCT FROM OLD.content THEN
    plain := btrim(regexp_replace(
      replace(regexp_replace(COALESCE(NEW.content, ''), '<[^>]*>', ' ', 'g'), '&nbsp;', ' '),
      '\s+', ' ', 'g'));
    NEW.word_count := CASE WHEN plain = '' THEN 0
                           ELSE array_length(string_to_array(plain, ' '), 1) END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS novel_chapters_word_count ON novel_chapters;
CREATE TRIGGER novel_chapters_word_count BEFORE INSERT OR UPDATE ON novel_chapters
  FOR EACH ROW EXECUTE FUNCTION public.novel_chapter_word_count();

-- ─── Row level security ─────────────────────────────────────────────────────
-- Members read; owners and editing roles write. Same rules as pro_tool_records.
ALTER TABLE novel_chapters        ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_writing_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_timeline_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['novel_chapters', 'novel_snapshots', 'novel_timeline_events'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_insert" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_update" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_delete" ON %1$I', t);

    EXECUTE format($p$
      CREATE POLICY "%1$s_select" ON %1$I FOR SELECT USING (
        EXISTS (SELECT 1 FROM project_members WHERE project_id = %1$I.project_id AND user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM projects WHERE id = %1$I.project_id AND created_by = auth.uid())
      )$p$, t);

    EXECUTE format($p$
      CREATE POLICY "%1$s_insert" ON %1$I FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM project_members WHERE project_id = %1$I.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
        EXISTS (SELECT 1 FROM projects WHERE id = %1$I.project_id AND created_by = auth.uid())
      )$p$, t);

    EXECUTE format($p$
      CREATE POLICY "%1$s_update" ON %1$I FOR UPDATE USING (
        EXISTS (SELECT 1 FROM project_members WHERE project_id = %1$I.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
        EXISTS (SELECT 1 FROM projects WHERE id = %1$I.project_id AND created_by = auth.uid())
      )$p$, t);

    EXECUTE format($p$
      CREATE POLICY "%1$s_delete" ON %1$I FOR DELETE USING (
        EXISTS (SELECT 1 FROM project_members WHERE project_id = %1$I.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
        EXISTS (SELECT 1 FROM projects WHERE id = %1$I.project_id AND created_by = auth.uid())
      )$p$, t);
  END LOOP;
END $$;

-- Writing log: every member sees the team's progress; each writer only
-- writes their own rows.
DROP POLICY IF EXISTS "novel_writing_log_select" ON novel_writing_log;
DROP POLICY IF EXISTS "novel_writing_log_insert" ON novel_writing_log;
DROP POLICY IF EXISTS "novel_writing_log_update" ON novel_writing_log;

CREATE POLICY "novel_writing_log_select" ON novel_writing_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_members WHERE project_id = novel_writing_log.project_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM projects WHERE id = novel_writing_log.project_id AND created_by = auth.uid())
);

CREATE POLICY "novel_writing_log_insert" ON novel_writing_log FOR INSERT WITH CHECK (
  user_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM project_members WHERE project_id = novel_writing_log.project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'writer', 'editor')) OR
    EXISTS (SELECT 1 FROM projects WHERE id = novel_writing_log.project_id AND created_by = auth.uid())
  )
);

CREATE POLICY "novel_writing_log_update" ON novel_writing_log FOR UPDATE USING (user_id = auth.uid());

-- Add words (or a finished sprint) to today's row without a read-modify-write
-- race between two open tabs. Runs as the caller, so the policies above apply.
CREATE OR REPLACE FUNCTION public.log_novel_words(
  p_project_id UUID,
  p_words INTEGER,
  p_day DATE DEFAULT CURRENT_DATE,
  p_sprints INTEGER DEFAULT 0
) RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO novel_writing_log (project_id, user_id, day, words, sprints)
  VALUES (p_project_id, auth.uid(), p_day, GREATEST(p_words, 0), GREATEST(p_sprints, 0))
  ON CONFLICT (project_id, user_id, day)
  DO UPDATE SET words   = novel_writing_log.words   + GREATEST(EXCLUDED.words, 0),
                sprints = novel_writing_log.sprints + GREATEST(EXCLUDED.sprints, 0);
$$;

GRANT EXECUTE ON FUNCTION public.log_novel_words(UUID, INTEGER, DATE, INTEGER) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON novel_chapters, novel_snapshots, novel_timeline_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON novel_writing_log TO authenticated;

-- ─── Submissions: publishing recipients ─────────────────────────────────────
ALTER TABLE script_submissions DROP CONSTRAINT IF EXISTS submission_recipient_type;
ALTER TABLE script_submissions ADD CONSTRAINT submission_recipient_type CHECK (recipient_type IN (
  'agent', 'manager', 'producer', 'festival', 'network', 'studio', 'other',
  'publisher', 'magazine', 'contest'
));

COMMIT;
