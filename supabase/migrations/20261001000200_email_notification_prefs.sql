-- Email notification preferences on profiles.
--
-- The settings page reads and writes these columns, but they were only ever in
-- supabase/migration_email_prefs.sql (never folded into FULL.sql or
-- migrations/). Where that file wasn't run, every save on the Profile tab —
-- including the email notification switches — failed with "Could not find the
-- 'email_…' column". Safe to run again.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_project_invites BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_mentions        BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_direct_messages BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_ticket_replies  BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_weekly_digest   BOOLEAN DEFAULT false;

-- PostgREST caches the schema; reload so the new columns are writable at once.
NOTIFY pgrst, 'reload schema';
