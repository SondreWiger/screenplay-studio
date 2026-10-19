-- Company tools: the policy bugs behind "it doesn't work".
--
-- Each of these made a company tool fail silently for someone, or let the
-- wrong people in. Re-runnable.

-- 1. A company owner who is not in company_members.
--    Every org_* policy asks is_company_member() / is_company_admin(), which
--    only look at company_members. An owner whose row is missing (companies
--    made before onboarding wrote one) could open the dashboard and then do
--    nothing on it. Backfill, and keep it true for new companies.
INSERT INTO public.company_members (company_id, user_id, role)
SELECT c.id, c.owner_id, 'owner'
FROM public.companies c
WHERE c.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.company_id = c.id AND m.user_id = c.owner_id
  );

CREATE OR REPLACE FUNCTION public.ensure_company_owner_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (company_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS companies_ensure_owner_member ON public.companies;
CREATE TRIGGER companies_ensure_owner_member
  AFTER INSERT OR UPDATE OF owner_id ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.ensure_company_owner_member();

-- 2. Pitch votes were readable only by the voter, so every pitch's score was
--    just your own vote. Members may read all votes on their company's pitches.
DROP POLICY IF EXISTS "org_pitch_votes_select_members" ON public.org_pitch_votes;
CREATE POLICY "org_pitch_votes_select_members" ON public.org_pitch_votes
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.org_pitches p WHERE p.id = org_pitch_votes.pitch_id AND public.is_company_member(p.company_id))
  );

-- 3. Pitch comments: any signed-in user could comment on any pitch.
DROP POLICY IF EXISTS "org_pitch_comments_insert" ON public.org_pitch_comments;
CREATE POLICY "org_pitch_comments_insert" ON public.org_pitch_comments
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.org_pitches p WHERE p.id = org_pitch_comments.pitch_id AND public.is_company_member(p.company_id))
  );

-- 4. Class assignments: `s.class_id = class_id` compared the student row with
--    itself, so being enrolled in any class showed every class's assignments.
DROP POLICY IF EXISTS "org_class_assignments_select" ON public.org_class_assignments;
CREATE POLICY "org_class_assignments_select" ON public.org_class_assignments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.org_classes c WHERE c.id = org_class_assignments.class_id AND public.is_company_member(c.company_id))
    OR EXISTS (SELECT 1 FROM public.org_class_students s WHERE s.class_id = org_class_assignments.class_id AND s.user_id = auth.uid())
  );

-- 5. Channel messages: anyone signed in could post into any company's channel,
--    and a manager's "Pin" was refused because only the author could update.
DROP POLICY IF EXISTS "org_messages_insert" ON public.org_channel_messages;
CREATE POLICY "org_messages_insert" ON public.org_channel_messages
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.org_channels c WHERE c.id = org_channel_messages.channel_id AND public.is_company_member(c.company_id))
  );

DROP POLICY IF EXISTS "org_messages_update" ON public.org_channel_messages;
CREATE POLICY "org_messages_update" ON public.org_channel_messages
  FOR UPDATE TO authenticated USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.org_channels c WHERE c.id = org_channel_messages.channel_id AND public.is_company_manager(c.company_id))
  );

-- 6. Members may start channels, not only managers. A writers' room that has
--    to ask an admin before it can have a #second-act channel will not use it.
DROP POLICY IF EXISTS "org_channels_insert" ON public.org_channels;
CREATE POLICY "org_channels_insert" ON public.org_channels
  FOR INSERT TO authenticated WITH CHECK (
    public.is_company_member(company_id) AND (created_by IS NULL OR created_by = auth.uid())
  );

-- Verify: every company owner is a member (should be 0).
SELECT count(*) AS owners_missing_membership
FROM public.companies c
WHERE c.owner_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = c.id AND m.user_id = c.owner_id);
