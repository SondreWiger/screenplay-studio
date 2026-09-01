-- ============================================================
-- Screenplay Studio — bundle codes
--
-- Pro here also covers Cinderra and CastingCall. Those run on their own
-- Supabase projects with no shared database, so entitlement travels as a
-- signed, single use code the subscriber redeems in the other app.
--
-- This table is the issuing record: what we handed out, to whom, and
-- whether they have told us it was used. It is not what makes a code
-- valid — the signature does that — so the other apps never read it.
-- ============================================================

CREATE TABLE IF NOT EXISTS bundle_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Which app this code is for. One row per app, so a subscriber sees two
  -- codes and cannot accidentally paste the Cinderra one into CastingCall.
  product     TEXT NOT NULL CHECK (product IN ('cinderra', 'castingcall')),

  -- Shown to the subscriber, so it is stored in the clear. It is only
  -- useful to the account it was issued for, and it is single use.
  code        TEXT NOT NULL,

  expires_at  TIMESTAMPTZ NOT NULL,
  -- Set when the other app tells us it was redeemed. Purely informational:
  -- single use is enforced over there, in that app's own ledger.
  redeemed_at TIMESTAMPTZ,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One live code per person per product. Re-issuing on renewal replaces the
-- row rather than leaving a drawer full of half valid codes.
CREATE UNIQUE INDEX IF NOT EXISTS bundle_codes_one_per_product
  ON bundle_codes (user_id, product);

CREATE INDEX IF NOT EXISTS bundle_codes_user_idx ON bundle_codes (user_id);

ALTER TABLE bundle_codes ENABLE ROW LEVEL SECURITY;

-- A subscriber may read their own codes and nothing else. No insert or
-- update policy exists, so codes can only be minted server side with the
-- service role — a browser cannot mint itself a licence.
DROP POLICY IF EXISTS "Owners read their codes" ON bundle_codes;
CREATE POLICY "Owners read their codes" ON bundle_codes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON bundle_codes FROM anon;
