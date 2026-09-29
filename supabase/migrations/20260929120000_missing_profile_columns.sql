-- Columns the app reads and writes but that were never created.
-- Found by validating every query in src/ against the live schema.

-- profiles.last_seen: written by the middleware (at most every 5 minutes per
-- user), read by the admin active-user / DAU / WAU / MAU stats and the
-- re-engagement email. Every write returned 400 and those stats showed 0.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON public.profiles (last_seen DESC NULLS LAST);

-- profiles.writing_goal_words_per_day: the dashboard Writing Goal widget.
-- Saving a goal failed ("Failed to save goal") without it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS writing_goal_words_per_day INTEGER
  CHECK (writing_goal_words_per_day IS NULL OR writing_goal_words_per_day BETWEEN 1 AND 100000);
