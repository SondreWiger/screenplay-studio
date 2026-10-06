-- Indexes for the admin Engagement report and the daily Pro expiry job.
--
-- The report reads recent rows by updated_at from the content tables and by
-- date from work_sessions; without these it scans whole tables. On a large
-- production database, run each statement on its own with CONCURRENTLY
-- (e.g. CREATE INDEX CONCURRENTLY IF NOT EXISTS …) to avoid blocking writes.
--
-- Safe to run again.

CREATE INDEX IF NOT EXISTS work_sessions_date_idx        ON public.work_sessions (date);
CREATE INDEX IF NOT EXISTS script_elements_updated_idx   ON public.script_elements (updated_at);
CREATE INDEX IF NOT EXISTS project_documents_updated_idx ON public.project_documents (updated_at);
CREATE INDEX IF NOT EXISTS scenes_updated_idx            ON public.scenes (updated_at);
CREATE INDEX IF NOT EXISTS characters_updated_idx        ON public.characters (updated_at);
CREATE INDEX IF NOT EXISTS shots_updated_idx             ON public.shots (updated_at);
CREATE INDEX IF NOT EXISTS ideas_updated_idx             ON public.ideas (updated_at);

-- Daily expiry looks up active subscriptions past their end date
CREATE INDEX IF NOT EXISTS subscriptions_active_end_idx
  ON public.subscriptions (current_period_end)
  WHERE status = 'active';
