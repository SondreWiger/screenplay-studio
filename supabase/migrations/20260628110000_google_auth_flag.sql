INSERT INTO feature_flags (key, name, description, tier, category)
VALUES
  ('google_auth_enabled', 'Google Authentication', 'Allow users to sign in or register using their Google account', 'disabled', 'integration')
ON CONFLICT (key) DO UPDATE
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;
