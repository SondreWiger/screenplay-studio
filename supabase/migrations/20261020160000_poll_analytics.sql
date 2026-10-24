-- Poll analytics: how long people spend on a poll and where they drop off.
--
--  * poll_responses gets when the person started, how long they actively spent
--    (time with the poll on screen, not time the tab sat in the background),
--    where they came from and whether they resumed a saved draft.
--  * poll_answers gets the time spent on each question.
--  * poll_views keeps one row per person per poll from the moment it is shown,
--    so admins see views → started → finished and the question people quit on.
--
-- Safe to run again.

ALTER TABLE public.poll_responses
  ADD COLUMN IF NOT EXISTS started_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  ADD COLUMN IF NOT EXISTS source      TEXT,
  ADD COLUMN IF NOT EXISTS resumed     BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.poll_answers
  ADD COLUMN IF NOT EXISTS time_ms INTEGER CHECK (time_ms IS NULL OR time_ms >= 0);

CREATE TABLE IF NOT EXISTS public.poll_views (
  session_id     UUID NOT NULL REFERENCES public.poll_sessions(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source         TEXT,
  first_shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Furthest step reached: 0 = intro, 1..n = question n
  max_step       INTEGER NOT NULL DEFAULT 0,
  view_count     INTEGER NOT NULL DEFAULT 1,
  dismiss_count  INTEGER NOT NULL DEFAULT 0,
  active_ms      INTEGER NOT NULL DEFAULT 0,
  completed_at   TIMESTAMPTZ,
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS poll_views_session_idx ON public.poll_views (session_id, first_shown_at);

ALTER TABLE public.poll_views ENABLE ROW LEVEL SECURITY;

-- Written only through the API route (service role); admins can read.
DROP POLICY IF EXISTS "poll_views_admin_read" ON public.poll_views;
CREATE POLICY "poll_views_admin_read" ON public.poll_views FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

NOTIFY pgrst, 'reload schema';
