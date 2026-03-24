-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Ban Enforcement — IP bans, banned IPs table               ║
-- ║  Tracks IPs of banned users so new accounts are blocked    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════
-- BANNED IPs — Persist IPs associated with banned users
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS banned_ips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address  TEXT NOT NULL,
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ban_id      UUID REFERENCES user_bans(id) ON DELETE SET NULL,
  reason      TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banned_ips_ip ON banned_ips(ip_address) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_banned_ips_user ON banned_ips(user_id);

ALTER TABLE banned_ips ENABLE ROW LEVEL SECURITY;

-- Only admins can manage banned IPs
DROP POLICY IF EXISTS "Admins manage banned IPs" ON banned_ips;
CREATE POLICY "Admins manage banned IPs" ON banned_ips
  FOR ALL USING (public.is_platform_admin());

-- Service role can insert (from middleware/API)
DROP POLICY IF EXISTS "Service can insert banned IPs" ON banned_ips;
CREATE POLICY "Service can insert banned IPs" ON banned_ips
  FOR INSERT WITH CHECK (true);

GRANT ALL ON banned_ips TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════
-- Add last_known_ip to profiles for IP tracking
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_known_ip TEXT;


-- ═══════════════════════════════════════════════════════════════
-- SYSTEM USER — A special profile for system-generated messages
-- Using a deterministic UUID so it's consistent everywhere
-- ═══════════════════════════════════════════════════════════════
INSERT INTO profiles (id, email, full_name, display_name, role, avatar_url)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'system@screenplaystudio.app',
  'Screenplay Studio',
  'SYSTEM',
  'admin',
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  full_name = 'Screenplay Studio',
  display_name = 'SYSTEM',
  role = 'admin';
