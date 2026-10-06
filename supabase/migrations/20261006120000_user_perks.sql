-- Perks the team hands out to engaged users from the admin Engagement tab:
-- gifted Pro time, a badge, or simply a thank-you message. One row per person
-- per send, so the panel can show who was already rewarded and when.
--
-- Rows are only written by the admin API with the service role; there is no
-- INSERT/UPDATE policy on purpose.
--
-- Safe to run again.

CREATE TABLE IF NOT EXISTS public.user_perks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  perk        TEXT NOT NULL CHECK (perk IN ('pro', 'badge', 'thanks')),
  -- e.g. { "months": 3, "subscription_id": "…" } or { "badge_id": "…", "badge_name": "…" }
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  subject     TEXT,
  -- Where the message went: 'notification', 'email'
  channels    TEXT[] NOT NULL DEFAULT '{}',
  -- Engagement tier and score when the perk was given, for later review
  tier        TEXT,
  score       INTEGER,
  granted_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_perks_user_idx    ON public.user_perks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_perks_created_idx ON public.user_perks (created_at DESC);

ALTER TABLE public.user_perks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own perks" ON public.user_perks;
CREATE POLICY "Users read their own perks"
  ON public.user_perks FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all perks" ON public.user_perks;
CREATE POLICY "Admins read all perks"
  ON public.user_perks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Gifted Pro is a normal subscription row with payment_method = 'gift' and an
-- end date; /api/cron/expire-gifts ends it when the period is over.
CREATE INDEX IF NOT EXISTS subscriptions_gift_expiry_idx
  ON public.subscriptions (current_period_end)
  WHERE payment_method = 'gift' AND status = 'active';

NOTIFY pgrst, 'reload schema';
