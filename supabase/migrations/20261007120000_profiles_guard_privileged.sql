-- Privileged profile columns can only be changed by the server.
--
-- "Users can update own profile" is USING (auth.uid() = id) with no column
-- restriction, so any signed-in user could run, from the browser console:
--   supabase.from('profiles').update({ role: 'admin', is_pro: true }).eq('id', me)
-- role = 'admin' passes rejectUnlessAdmin() and unlocks every service-role
-- admin route. This trigger puts those columns back to their old values when
-- the write comes straight from a browser session (PostgREST runs those as
-- the `authenticated` / `anon` roles). The service role and SECURITY DEFINER
-- functions (redeem code, donation grant, moderation RPCs) run as other roles
-- and are unaffected.
--
-- Columns that don't exist in a given database are skipped, so this is safe
-- to run on any environment.

CREATE OR REPLACE FUNCTION public.profiles_guard_privileged()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  privileged CONSTANT text[] := ARRAY[
    'role', 'is_pro', 'pro_since', 'is_studio', 'studio_since',
    'moderation_status', 'moderation_flags', 'moderation_notes', 'last_flagged_at'
  ];
  defaults CONSTANT jsonb := jsonb_build_object(
    'role', 'writer', 'is_pro', false, 'pro_since', null, 'is_studio', false,
    'studio_since', null, 'moderation_status', 'clean',
    'moderation_flags', 0, 'moderation_notes', null, 'last_flagged_at', null
  );
  source jsonb;
  keep jsonb;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  source := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE defaults END;

  SELECT coalesce(jsonb_object_agg(k, source -> k), '{}'::jsonb)
    INTO keep
    FROM unnest(privileged) AS k
   WHERE to_jsonb(NEW) ? k;

  NEW := jsonb_populate_record(NEW, keep);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged ON public.profiles;
CREATE TRIGGER profiles_guard_privileged
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged();
