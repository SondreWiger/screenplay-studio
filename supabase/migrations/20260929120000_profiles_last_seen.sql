-- profiles.last_seen is written by the middleware (at most every 5 minutes per
-- user) and read by the admin active-user / DAU / WAU / MAU stats, but was never
-- created — every write returned 400 and those stats always showed 0.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON public.profiles (last_seen DESC NULLS LAST);
