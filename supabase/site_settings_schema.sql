-- ============================================================
-- SITE SETTINGS — key/value store for admin-managed settings
-- ============================================================

CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (version shown in footer)
CREATE POLICY "Site settings are public" ON site_settings FOR SELECT USING (true);

-- Only admin can modify settings
CREATE POLICY "Admin can manage settings" ON site_settings FOR ALL USING (
  auth.uid() = 'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid
);

-- Seed default version
INSERT INTO site_settings (key, value) VALUES ('site_version', '0.1.0')
ON CONFLICT (key) DO NOTHING;

-- Open-source mode: set to 'false' to hide /contribute, strip open-source mentions
-- from metadata, embeds, and the about page. Defaults to 'true'.
INSERT INTO site_settings (key, value) VALUES ('opensource_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
