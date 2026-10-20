-- QR codes on printed drafts.
--
-- The front page of a print carries a QR code that opens /lookup for that
-- draft. Next to the code it holds a private key (qr_token), so whoever has
-- the paper can scan it and see the print info and what has changed since,
-- even when the project keeps typed-in code lookup private. Typing just the
-- 5-character code still follows drafts_public_lookup as before.
--
-- Safe to run again.

-- On by default; owners can switch it off in project settings.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS print_qr_code BOOLEAN NOT NULL DEFAULT true;

-- 16 hex characters (64 bits): unguessable, and the lookup route is rate
-- limited on top. Existing drafts get one too, but their paper has no QR.
ALTER TABLE public.printed_drafts
  ADD COLUMN IF NOT EXISTS qr_token TEXT NOT NULL
  DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

-- All functions below are plain SQL with a single statement each (no
-- semicolons inside the bodies), so SQL editors that split a file into
-- statements cannot cut a function in half.

-- Code lookup for /lookup. Called only from the rate-limited API route with
-- the service role, which passes the signed-in user (or NULL) and the QR key
-- when the page was opened from a scanned code.
--  * Project members get the full record, including recipient.
--  * Anyone else gets the basics if the project allows public lookup or the
--    QR key matches.
--  * Otherwise NULL, indistinguishable from an unknown code.
-- script_id is for the route to work out what changed; it is not passed on.
DROP FUNCTION IF EXISTS public.lookup_printed_draft(TEXT, UUID);
DROP FUNCTION IF EXISTS public.lookup_printed_draft(TEXT, UUID, TEXT);
CREATE FUNCTION public.lookup_printed_draft(p_code TEXT, p_user_id UUID DEFAULT NULL, p_token TEXT DEFAULT NULL)
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
      'script_id', d.script_id,
      'via_qr', d.via_qr,
      'newer_prints', (SELECT COUNT(*) FROM public.printed_drafts n
                       WHERE n.script_id = d.script_id AND n.printed_at > d.printed_at),
      'latest_print_at', (SELECT MAX(n.printed_at) FROM public.printed_drafts n
                          WHERE n.script_id = d.script_id AND n.printed_at > d.printed_at),
      'member', d.member
    ) || CASE WHEN d.member THEN jsonb_build_object(
      'id', d.id,
      'project_id', d.project_id,
      'recipient', d.recipient,
      'source', d.source,
      'format', d.format,
      'printed_by', (SELECT COALESCE(NULLIF(pr.full_name, ''), pr.display_name)
                     FROM public.profiles pr WHERE pr.id = d.created_by)
    ) ELSE '{}'::jsonb END
  FROM (
    SELECT x.*,
      (p_user_id IS NOT NULL AND public.has_project_access(x.project_id, p_user_id)) AS member,
      (p_token IS NOT NULL AND x.qr_token = p_token) AS via_qr
    FROM public.printed_drafts x
    WHERE x.code = upper(trim(p_code))
  ) d
  JOIN public.projects p ON p.id = d.project_id
  WHERE d.member OR d.via_qr OR COALESCE(p.drafts_public_lookup, false)
$fn$;

REVOKE ALL ON FUNCTION public.lookup_printed_draft(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_printed_draft(TEXT, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
