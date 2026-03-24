-- ============================================================
-- Creator & Affiliate Program
-- ============================================================

-- Creator profiles (one per user)
CREATE TABLE IF NOT EXISTS creator_profiles (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ref_code          TEXT        NOT NULL,  -- = username at apply time, used in /ref/[ref_code]
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  -- Social links
  social_instagram  TEXT,
  social_twitter    TEXT,
  social_tiktok     TEXT,
  social_youtube    TEXT,
  -- Application
  application_note  TEXT,
  applied_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at       TIMESTAMPTZ,
  approved_by       UUID        REFERENCES profiles(id),
  rejected_reason   TEXT,
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (ref_code)
);

-- Referral events: visits to /ref/[code] and signups from those links
CREATE TABLE IF NOT EXISTS creator_referral_events (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id         UUID        NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  event_type         TEXT        NOT NULL CHECK (event_type IN ('visit', 'signup')),
  -- visit metadata
  referrer           TEXT,
  country            TEXT,
  -- signup link (NULL for visits)
  converted_user_id  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_ref_events_creator
  ON creator_referral_events(creator_id, created_at);

CREATE INDEX IF NOT EXISTS idx_creator_ref_events_month
  ON creator_referral_events(event_type, created_at);

-- Prevent double-counting: one signup event per converted user
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_ref_events_user_unique
  ON creator_referral_events(converted_user_id)
  WHERE event_type = 'signup' AND converted_user_id IS NOT NULL;

-- Payout batches (admin runs these on the 12th of each month)
CREATE TABLE IF NOT EXISTS creator_payout_batches (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start     DATE         NOT NULL,
  period_end       DATE         NOT NULL,
  total_amount     NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  status           TEXT         NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'paid')),
  notes            TEXT,
  created_by       UUID         REFERENCES profiles(id),
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Per-creator allocation within a batch
CREATE TABLE IF NOT EXISTS creator_payout_items (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id       UUID          NOT NULL REFERENCES creator_payout_batches(id) ON DELETE CASCADE,
  creator_id     UUID          NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  signups_count  INTEGER       NOT NULL DEFAULT 0,
  proportion     NUMERIC(7,6)  NOT NULL DEFAULT 0, -- 0.0–1.0
  amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (batch_id, creator_id)
);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_payout_items ENABLE ROW LEVEL SECURITY;

-- creator_profiles
DROP POLICY IF EXISTS "creator_profiles_owner_select" ON creator_profiles;
CREATE POLICY "creator_profiles_owner_select" ON creator_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "creator_profiles_owner_insert" ON creator_profiles;
CREATE POLICY "creator_profiles_owner_insert" ON creator_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "creator_profiles_owner_update" ON creator_profiles;
CREATE POLICY "creator_profiles_owner_update" ON creator_profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Users may not change their own status; admin does that
    AND (status = (SELECT status FROM creator_profiles WHERE user_id = auth.uid()))
  );

-- Public read for approved:
DROP POLICY IF EXISTS "creator_profiles_public_approved" ON creator_profiles;
CREATE POLICY "creator_profiles_public_approved" ON creator_profiles
  FOR SELECT USING (status = 'approved');

-- Admin full access
DROP POLICY IF EXISTS "creator_profiles_admin" ON creator_profiles;
CREATE POLICY "creator_profiles_admin" ON creator_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (id = 'f0e0c4a4-0833-4c64-b012-15829c087c77' OR role = 'admin'))
  );

-- creator_referral_events
DROP POLICY IF EXISTS "creator_ref_events_owner_select" ON creator_referral_events;
CREATE POLICY "creator_ref_events_owner_select" ON creator_referral_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.id = creator_id AND cp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "creator_ref_events_insert_anon" ON creator_referral_events;
CREATE POLICY "creator_ref_events_insert_anon" ON creator_referral_events
  FOR INSERT WITH CHECK (true); -- server-side route handles auth gating

DROP POLICY IF EXISTS "creator_ref_events_admin" ON creator_referral_events;
CREATE POLICY "creator_ref_events_admin" ON creator_referral_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (id = 'f0e0c4a4-0833-4c64-b012-15829c087c77' OR role = 'admin'))
  );

-- creator_payout_batches — admin only
DROP POLICY IF EXISTS "creator_payout_batches_admin" ON creator_payout_batches;
CREATE POLICY "creator_payout_batches_admin" ON creator_payout_batches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (id = 'f0e0c4a4-0833-4c64-b012-15829c087c77' OR role = 'admin'))
  );

-- creator_payout_items — admin + owner creator read
DROP POLICY IF EXISTS "creator_payout_items_admin" ON creator_payout_items;
CREATE POLICY "creator_payout_items_admin" ON creator_payout_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (id = 'f0e0c4a4-0833-4c64-b012-15829c087c77' OR role = 'admin'))
  );

DROP POLICY IF EXISTS "creator_payout_items_owner_select" ON creator_payout_items;
CREATE POLICY "creator_payout_items_owner_select" ON creator_payout_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM creator_profiles cp
      WHERE cp.id = creator_id AND cp.user_id = auth.uid()
    )
  );

-- ── site_settings toggles ─────────────────────────────────────
INSERT INTO site_settings (key, value)
VALUES ('creator_program_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value)
VALUES ('creator_payout_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ── Stored function: compute payout proportions ──────────────
CREATE OR REPLACE FUNCTION compute_creator_payout_items(
  p_batch_id   UUID,
  p_start_date DATE,
  p_end_date   DATE,
  p_total      NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  total_signups INTEGER;
BEGIN
  -- Clean existing items for this batch
  DELETE FROM creator_payout_items WHERE batch_id = p_batch_id;

  -- Count signups per creator in period
  SELECT COALESCE(SUM(signup_count), 0) INTO total_signups
  FROM (
    SELECT creator_id, COUNT(*) AS signup_count
    FROM creator_referral_events
    WHERE event_type = 'signup'
      AND created_at >= p_start_date::timestamptz
      AND created_at < (p_end_date + INTERVAL '1 day')::timestamptz
    GROUP BY creator_id
  ) sub;

  IF total_signups = 0 THEN RETURN; END IF;

  -- Insert proportional items
  INSERT INTO creator_payout_items (batch_id, creator_id, signups_count, proportion, amount)
  SELECT
    p_batch_id,
    creator_id,
    signup_count,
    signup_count::NUMERIC / total_signups,
    ROUND((signup_count::NUMERIC / total_signups) * p_total, 2)
  FROM (
    SELECT creator_id, COUNT(*) AS signup_count
    FROM creator_referral_events
    WHERE event_type = 'signup'
      AND created_at >= p_start_date::timestamptz
      AND created_at < (p_end_date + INTERVAL '1 day')::timestamptz
    GROUP BY creator_id
  ) sub;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION compute_creator_payout_items TO authenticated;
