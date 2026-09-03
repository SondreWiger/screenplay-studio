-- Track Ko-Fi donations. Pro access itself is granted through the existing
-- profiles.is_pro / subscriptions mechanism (see grantPro() in
-- /api/webhooks/kofi), not a separate column here.
BEGIN;

CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  amount_cents INTEGER NOT NULL,
  kofi_transaction_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed', -- completed (recorded by webhook), verified (claimed by a user)
  pro_months_granted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_email ON donations(email);

ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Users can see their own claimed donation records.
CREATE POLICY "donations_select_own" ON donations FOR SELECT USING (
  user_id = auth.uid()
);

-- All writes go through the service role (webhook + claim API), which
-- bypasses RLS entirely - no policy here grants direct client writes.

COMMIT;
