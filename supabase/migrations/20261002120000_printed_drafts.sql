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

-- Fingerprint of a script's visible text, used to tell whether a printed
-- draft still matches the script.
CREATE OR REPLACE FUNCTION public.script_content_hash(p_script_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT md5(COALESCE(string_agg(e.element_type || ':' || COALESCE(e.content, ''), E'\n' ORDER BY e.sort_order, e.id::text COLLATE "C"), ''))
  FROM public.script_elements e
  WHERE e.script_id = p_script_id AND NOT COALESCE(e.is_omitted, false);
$$;

CREATE OR REPLACE FUNCTION public.snapshot_content_hash(p_snapshot JSONB)
RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT md5(COALESCE(string_agg((el->>'element_type') || ':' || COALESCE(el->>'content', ''), E'\n' ORDER BY (el->>'sort_order')::numeric, (el->>'id') COLLATE "C"), ''))
  FROM jsonb_array_elements(p_snapshot) el
  WHERE NOT COALESCE((el->>'is_omitted')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.create_printed_draft(
  p_script_id UUID,
  p_recipient TEXT DEFAULT NULL,
  p_notes     TEXT DEFAULT NULL,
  p_source    TEXT DEFAULT 'manual',
  p_format    TEXT DEFAULT NULL
)
RETURNS public.printed_drafts
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_script   public.scripts%ROWTYPE;
  v_snapshot JSONB;
  v_words    INTEGER;
  v_count    INTEGER;
  -- No 0/O or 1/I, so a code read off paper can't be mistyped.
  v_alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code     TEXT;
  v_row      public.printed_drafts%ROWTYPE;
  i          INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_script FROM public.scripts WHERE id = p_script_id;
  IF NOT FOUND OR NOT public.has_project_access(v_script.project_id, v_uid) THEN
    RAISE EXCEPTION 'Script not found' USING ERRCODE = '42501';
  END IF;

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
    ) ORDER BY e.sort_order, e.id::text COLLATE "C"), '[]'::jsonb),
    COUNT(*) FILTER (WHERE NOT COALESCE(e.is_omitted, false)),
    COALESCE(SUM(array_length(regexp_split_to_array(
      trim(regexp_replace(COALESCE(e.content, ''), '<[^>]*>', '', 'g')), '\s+'), 1))
      FILTER (WHERE NOT COALESCE(e.is_omitted, false)
              AND trim(regexp_replace(COALESCE(e.content, ''), '<[^>]*>', '', 'g')) <> ''), 0)
  INTO v_snapshot, v_count, v_words
  FROM public.script_elements e
  WHERE e.script_id = p_script_id;

  FOR attempt IN 1..20 LOOP
    v_code := '';
    FOR i IN 1..5 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;

    BEGIN
      INSERT INTO public.printed_drafts (
        code, project_id, script_id, script_title, snapshot, title_page,
        content_hash, element_count, word_count, recipient, notes, source,
        format, created_by
      ) VALUES (
        v_code, v_script.project_id, v_script.id, COALESCE(v_script.title, ''),
        v_snapshot, COALESCE(v_script.title_page_data, '{}'::jsonb),
        public.snapshot_content_hash(v_snapshot), v_count, v_words,
        NULLIF(trim(p_recipient), ''), NULLIF(trim(p_notes), ''),
        CASE WHEN p_source IN ('manual', 'export', 'print') THEN p_source ELSE 'manual' END,
        NULLIF(trim(p_format), ''), v_uid
      )
      RETURNING * INTO v_row;
      RETURN v_row;
    EXCEPTION WHEN unique_violation THEN
      -- Code already taken; draw another.
    END;
  END LOOP;

  RAISE EXCEPTION 'Could not allocate a unique draft code';
END;
$$;

REVOKE ALL ON FUNCTION public.create_printed_draft(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_printed_draft(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Code lookup for /lookup. Called only from the rate-limited API route with
-- the service role, which passes the signed-in user (or NULL).
--  * Project members get the full record, including recipient.
--  * Anyone else gets the basics — only if the project allows public lookup.
--  * Otherwise NULL, indistinguishable from an unknown code.
CREATE OR REPLACE FUNCTION public.lookup_printed_draft(p_code TEXT, p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_draft   public.printed_drafts%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_member  BOOLEAN;
  v_current BOOLEAN;
BEGIN
  SELECT * INTO v_draft FROM public.printed_drafts WHERE code = upper(trim(p_code));
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = v_draft.project_id;
  v_member := p_user_id IS NOT NULL AND public.has_project_access(v_draft.project_id, p_user_id);

  IF NOT v_member AND NOT COALESCE(v_project.drafts_public_lookup, false) THEN
    RETURN NULL;
  END IF;

  v_current := CASE
    WHEN v_draft.script_id IS NULL THEN NULL
    ELSE public.script_content_hash(v_draft.script_id) = v_draft.content_hash
  END;

  RETURN jsonb_build_object(
    'code', v_draft.code,
    'printed_at', v_draft.printed_at,
    'script_title', v_draft.script_title,
    'project_title', v_project.title,
    'element_count', v_draft.element_count,
    'word_count', v_draft.word_count,
    'is_current', v_current,
    'script_deleted', v_draft.script_id IS NULL,
    'member', v_member
  ) || CASE WHEN v_member THEN jsonb_build_object(
    'id', v_draft.id,
    'project_id', v_draft.project_id,
    'recipient', v_draft.recipient,
    'source', v_draft.source,
    'format', v_draft.format
  ) ELSE '{}'::jsonb END;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_printed_draft(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_printed_draft(TEXT, UUID) TO service_role;

-- Internal helper: it skips access checks, so only the functions above call it.
REVOKE ALL ON FUNCTION public.script_content_hash(UUID) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
