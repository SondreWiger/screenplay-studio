-- ============================================================
-- Changelog 2.7.6 — Live Active Users Dashboard
-- ============================================================

-- 1. Create the new release
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.6',
  'Live Active Users Dashboard',
  'Added real-time active user counts to the admin dashboard showing users active in the last 5 minutes, 15 minutes, and 1 hour.',
  'feature'
);

-- 2. Add changelog entries
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Live Active Users Tracking',
  'Admin dashboard now shows real-time counts of users active within the last 5 minutes, 15 minutes, and 1 hour. User activity is tracked globally across the platform.',
  'feature', 'admin', true, 10
FROM changelog_releases WHERE version = '2.7.6';

-- 3. Publish the release
SELECT publish_release('2.7.6');