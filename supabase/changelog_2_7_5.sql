-- ============================================================
-- Changelog 2.7.5 — Poll Push Notifications
-- ============================================================

-- 1. Create the new release
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.5',
  'Poll Push Notifications',
  'Added ability for admins to send push notifications to all users about published polls.',
  'patch'
);

-- 2. Add changelog entries
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Poll Push Notifications',
  'Admins can now send push notifications to all users for published polls from the admin panel. This allows re-engaging users with polls they may have missed.',
  'feature', 'admin', true, 10
FROM changelog_releases WHERE version = '2.7.5';

-- 3. Publish the release
SELECT publish_release('2.7.5');