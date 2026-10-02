-- Printed drafts: every time a script is printed or exported (or a draft is
-- issued by hand) it gets a short code (5 letters/digits) and a frozen
-- snapshot of the script, so a paper copy can be traced back to exactly what
-- was on it and compared with the script as it is now.
--
-- Safe to run again.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS drafts_public_lookup BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.printed_drafts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{5}$'),
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Kept when the script is deleted: the record of what was handed out
  -- outlives the script itself.
  script_id     UUID REFERENCES public.scripts(id) ON DELETE SET NULL,
  script_title  TEXT NOT NULL DEFAULT '',
  snapshot      JSONB NOT NULL DEFAULT '[]'::jsonb,
  title_page    JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash  TEXT NOT NULL DEFAULT '',
  element_count INTEGER NOT NULL DEFAULT 0,
  word_count    INTEGER NOT NULL DEFAULT 0,
  recipient     TEXT,
  notes         TEXT,
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'export', 'print')),
  format        TEXT,
  printed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS printed_drafts_project_idx ON public.printed_drafts (project_id, printed_at DESC);
CREATE INDEX IF NOT EXISTS printed_drafts_script_idx  ON public.printed_drafts (script_id);

ALTER TABLE public.printed_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drafts readable by project members" ON public.printed_drafts;
CREATE POLICY "Drafts readable by project members"
  ON public.printed_drafts FOR SELECT
  USING (public.has_project_access(project_id, auth.uid()));

-- Recipient and notes can be filled in after the fact by anyone on the project.
DROP POLICY IF EXISTS "Drafts editable by project members" ON public.printed_drafts;
CREATE POLICY "Drafts editable by project members"
  ON public.printed_drafts FOR UPDATE
  USING (public.has_project_access(project_id, auth.uid()))
  WITH CHECK (public.has_project_access(project_id, auth.uid()));

DROP POLICY IF EXISTS "Drafts deletable by creator or project admins" ON public.printed_drafts;
CREATE POLICY "Drafts deletable by creator or project admins"
  ON public.printed_drafts FOR DELETE
  USING (created_by = auth.uid() OR public.is_project_owner_or_admin(project_id, auth.uid()));

-- Only the snapshot-free columns may change; the code, snapshot and print
-- time are the record and stay as issued.
REVOKE UPDATE ON public.printed_drafts FROM authenticated, anon;
GRANT UPDATE (recipient, notes) ON public.printed_drafts TO authenticated;

-- No INSERT policy: drafts are only created through create_printed_draft(),
-- which takes the snapshot on the server so it matches what was saved.

-- All functions below are plain SQL with a single statement each (no
-- semicolons inside the bodies), so SQL editors that split a file into
-- statements cannot cut a function in half.

-- Fingerprint of the visible text of a script, used to tell whether a printed
-- draft still matches the script.
CREATE OR REPLACE FUNCTION public.script_content_hash(p_script_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT md5(COALESCE(string_agg(e.element_type || ':' || COALESCE(e.content, ''), E'\n' ORDER BY e.sort_order, e.id::text COLLATE "C"), ''))
  FROM public.script_elements e
  WHERE e.script_id = p_script_id AND NOT COALESCE(e.is_omitted, false)
$fn$;

CREATE OR REPLACE FUNCTION public.snapshot_content_hash(p_snapshot JSONB)
RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT md5(COALESCE(string_agg((el->>'element_type') || ':' || COALESCE(el->>'content', ''), E'\n' ORDER BY (el->>'sort_order')::numeric, (el->>'id') COLLATE "C"), ''))
  FROM jsonb_array_elements(p_snapshot) el
  WHERE NOT COALESCE((el->>'is_omitted')::boolean, false)
$fn$;

-- Issues a code and snapshots the script. Returns no row when the caller is
-- signed out or has no access to the script.
DROP FUNCTION IF EXISTS public.create_printed_draft(UUID, TEXT, TEXT, TEXT, TEXT);
CREATE FUNCTION public.create_printed_draft(
  p_script_id UUID,
  p_recipient TEXT DEFAULT NULL,
  p_notes     TEXT DEFAULT NULL,
  p_source    TEXT DEFAULT 'manual',
  p_format    TEXT DEFAULT NULL
)
RETURNS SETOF public.printed_drafts
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $fn$
  WITH sc AS (
    SELECT s.*
    FROM public.scripts s
    WHERE s.id = p_script_id
      AND auth.uid() IS NOT NULL
      AND public.has_project_access(s.project_id, auth.uid())
  ),
  snap AS (
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'element_type', e.element_type,
        'content', e.content,
        'sort_order', e.sort_order,
        'scene_number', e.scene_number,
        'revision_color', e.revision_color,
        'is_revised', e.is_revised,
        'is_omitted', e.is_omitted,
        'metadata', e.metadata
      ) ORDER BY e.sort_order, e.id::text COLLATE "C"), '[]'::jsonb) AS snapshot,
      COUNT(*) FILTER (WHERE NOT COALESCE(e.is_omitted, false))::int AS element_count,
      COALESCE(SUM(array_length(regexp_split_to_array(
        trim(regexp_replace(COALESCE(e.content, ''), '<[^>]*>', '', 'g')), '\s+'), 1))
        FILTER (WHERE NOT COALESCE(e.is_omitted, false)
                AND trim(regexp_replace(COALESCE(e.content, ''), '<[^>]*>', '', 'g')) <> ''), 0)::int AS word_count
    FROM public.script_elements e
    WHERE e.script_id = p_script_id
  ),
  -- Ten random candidates from an alphabet without 0/O or 1/I (so a code read
  -- off paper cannot be mistyped); the first one not already in use wins.
  candidates AS (
    SELECT g.n, (
      SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      FROM generate_series(1, 5) c(k)
      WHERE g.n IS NOT NULL
    ) AS code
    FROM generate_series(1, 10) g(n)
  ),
  pick AS (
    SELECT c.code
    FROM candidates c
    WHERE NOT EXISTS (SELECT 1 FROM public.printed_drafts d WHERE d.code = c.code)
    ORDER BY c.n
    LIMIT 1
  )
  INSERT INTO public.printed_drafts (
    code, project_id, script_id, script_title, snapshot, title_page,
    content_hash, element_count, word_count, recipient, notes, source,
    format, created_by
  )
  SELECT
    pick.code, sc.project_id, sc.id, COALESCE(sc.title, ''),
    snap.snapshot, COALESCE(sc.title_page_data, '{}'::jsonb),
    public.snapshot_content_hash(snap.snapshot), snap.element_count, snap.word_count,
    NULLIF(trim(p_recipient), ''), NULLIF(trim(p_notes), ''),
    CASE WHEN p_source IN ('manual', 'export', 'print') THEN p_source ELSE 'manual' END,
    NULLIF(trim(p_format), ''), auth.uid()
  FROM sc, snap, pick
  RETURNING *
$fn$;

REVOKE ALL ON FUNCTION public.create_printed_draft(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_printed_draft(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Code lookup for /lookup. Called only from the rate-limited API route with
-- the service role, which passes the signed-in user (or NULL).
--  * Project members get the full record, including recipient.
--  * Anyone else gets the basics, and only if the project allows public lookup.
--  * Otherwise NULL, indistinguishable from an unknown code.
DROP FUNCTION IF EXISTS public.lookup_printed_draft(TEXT, UUID);
CREATE FUNCTION public.lookup_printed_draft(p_code TEXT, p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT
    jsonb_build_object(
      'code', d.code,
      'printed_at', d.printed_at,
      'script_title', d.script_title,
      'project_title', p.title,
      'element_count', d.element_count,
      'word_count', d.word_count,
      'is_current', CASE WHEN d.script_id IS NULL THEN NULL
                         ELSE public.script_content_hash(d.script_id) = d.content_hash END,
      'script_deleted', d.script_id IS NULL,
      'member', d.member
    ) || CASE WHEN d.member THEN jsonb_build_object(
      'id', d.id,
      'project_id', d.project_id,
      'recipient', d.recipient,
      'source', d.source,
      'format', d.format
    ) ELSE '{}'::jsonb END
  FROM (
    SELECT x.*, (p_user_id IS NOT NULL AND public.has_project_access(x.project_id, p_user_id)) AS member
    FROM public.printed_drafts x
    WHERE x.code = upper(trim(p_code))
  ) d
  JOIN public.projects p ON p.id = d.project_id
  WHERE d.member OR COALESCE(p.drafts_public_lookup, false)
$fn$;

REVOKE ALL ON FUNCTION public.lookup_printed_draft(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_printed_draft(TEXT, UUID) TO service_role;

-- Internal helper: it skips access checks, so only the functions above call it.
REVOKE ALL ON FUNCTION public.script_content_hash(UUID) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
