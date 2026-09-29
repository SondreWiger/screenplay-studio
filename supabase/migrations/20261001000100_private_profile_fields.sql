-- ============================================================================
-- Private profile fields
--
-- profiles is readable by everyone (it backs public profile pages), and it
-- held every user's email, last known IP and moderation notes — readable even
-- without logging in. This moves those fields into two tables with their own
-- access rules:
--
--   profile_contact     email                       — the user, admins/mods,
--                                                     people who share a project
--                                                     or company, or anyone if
--                                                     the user set show_email
--   profile_moderation  last_known_ip, moderation_notes — the user, admins/mods
--
-- A BEFORE trigger on profiles moves any write of those columns into the new
-- tables and leaves NULL behind, so existing writers (the signup trigger, the
-- middleware, older app code) keep working without leaking.
--
-- Run after 20260929120000_missing_profile_columns.sql.
-- ============================================================================

-- 1. Tables ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profile_contact (
  id         uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE
             DEFERRABLE INITIALLY DEFERRED,  -- written from a BEFORE INSERT on profiles
  email      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profile_contact_email_idx ON public.profile_contact (lower(email));

CREATE TABLE IF NOT EXISTS public.profile_moderation (
  id               uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE
                   DEFERRABLE INITIALLY DEFERRED,
  last_known_ip    text,
  moderation_notes text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 2. Access rules ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_staff(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.role IN ('admin', 'moderator'));
$$;

CREATE OR REPLACE FUNCTION public.can_see_contact(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    auth.uid() = target
    OR public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = target AND p.show_email IS TRUE)
    OR EXISTS (
      SELECT 1 FROM public.project_members a
      JOIN public.project_members b ON a.project_id = b.project_id
      WHERE a.user_id = auth.uid() AND b.user_id = target
    )
    OR EXISTS (
      SELECT 1 FROM public.projects pr
      JOIN public.project_members m ON m.project_id = pr.id
      WHERE (pr.created_by = auth.uid() AND m.user_id = target)
         OR (pr.created_by = target AND m.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.company_members a
      JOIN public.company_members b ON a.company_id = b.company_id
      WHERE a.user_id = auth.uid() AND b.user_id = target
    );
$$;

ALTER TABLE public.profile_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_moderation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_contact_read ON public.profile_contact;
CREATE POLICY profile_contact_read ON public.profile_contact
  FOR SELECT USING (public.can_see_contact(id));

DROP POLICY IF EXISTS profile_moderation_read ON public.profile_moderation;
CREATE POLICY profile_moderation_read ON public.profile_moderation
  FOR SELECT USING (auth.uid() = id OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS profile_moderation_staff_write ON public.profile_moderation;
CREATE POLICY profile_moderation_staff_write ON public.profile_moderation
  FOR UPDATE USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Invites by email: the invitee isn't a collaborator yet, so their contact row
-- isn't visible. Signed-in users may resolve an exact address to a user id.
CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email text)
RETURNS TABLE (id uuid, display_name text, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.full_name
  FROM public.profile_contact c JOIN public.profiles p ON p.id = c.id
  WHERE auth.uid() IS NOT NULL AND lower(c.email) = lower(trim(p_email))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_user_by_email(text) FROM anon;

-- 3. Move writes out of profiles ---------------------------------------------

ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.profiles_privatize()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    INSERT INTO public.profile_contact (id, email) VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
    NEW.email := NULL;
  END IF;
  IF NEW.last_known_ip IS NOT NULL OR NEW.moderation_notes IS NOT NULL THEN
    INSERT INTO public.profile_moderation (id, last_known_ip, moderation_notes)
    VALUES (NEW.id, NEW.last_known_ip, NEW.moderation_notes)
    ON CONFLICT (id) DO UPDATE SET
      last_known_ip    = COALESCE(EXCLUDED.last_known_ip, public.profile_moderation.last_known_ip),
      moderation_notes = COALESCE(EXCLUDED.moderation_notes, public.profile_moderation.moderation_notes),
      updated_at       = now();
    NEW.last_known_ip := NULL;
    NEW.moderation_notes := NULL;
  END IF;
  RETURN NEW;
END $$;

-- 4. Backfill, then install the trigger --------------------------------------

INSERT INTO public.profile_contact (id, email)
SELECT id, email FROM public.profiles WHERE email IS NOT NULL
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

INSERT INTO public.profile_moderation (id, last_known_ip, moderation_notes)
SELECT id, last_known_ip, moderation_notes FROM public.profiles
WHERE last_known_ip IS NOT NULL OR moderation_notes IS NOT NULL
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET email = NULL, last_known_ip = NULL, moderation_notes = NULL
WHERE email IS NOT NULL OR last_known_ip IS NOT NULL OR moderation_notes IS NOT NULL;

DROP TRIGGER IF EXISTS profiles_privatize ON public.profiles;
CREATE TRIGGER profiles_privatize
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_privatize();

-- 5. Keep email in step with the auth account ---------------------------------

CREATE OR REPLACE FUNCTION public.sync_contact_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.profile_contact (id, email) VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_contact_email();
