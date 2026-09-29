-- Screenplay Studio 3.0 — out of beta.
-- Run at launch, after 20260929120000_missing_profile_columns.sql and
-- 20260628100000_world_entities.sql.

-- Version shown in the site footer
INSERT INTO public.site_settings (key, value, updated_at)
VALUES ('site_version', '3.0.0', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- The site no longer describes itself as open source (the LICENSE is
-- proprietary). This is also the default when the key is absent.
INSERT INTO public.site_settings (key, value, updated_at)
VALUES ('opensource_enabled', 'false', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
