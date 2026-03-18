-- ============================================================
-- Changelog 2.7.4 — Share System Overhaul
-- ============================================================

-- 1. Create the new release
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.4',
  'New Share System',
  'Replaced Share Portal and Client Review with a streamlined token-based sharing system.',
  'minor'
);

-- 2. Changelog entries

-- Token-based share links
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'New share links system',
  'Replaced Share Portal and Client Review with a clean, token-based sharing system. Create named links that grant access to specific sections — script, characters, scenes, schedule, or documents — with no login required.',
  'feature',
  'ui',
  true,
  10
FROM changelog_releases WHERE version = '2.7.4';

-- Invite links
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Invite links',
  'Share links can optionally be set as invite links. When someone opens an invite link they are prompted to sign in or create an account, then automatically added to the project with the chosen role (viewer, commenter, or editor).',
  'feature',
  'collaboration',
  true,
  20
FROM changelog_releases WHERE version = '2.7.4';

-- Permission control
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Per-link content permissions',
  'Each share link carries its own set of permissions. Enable only the sections you want the recipient to see. Useful for sharing a script draft without exposing the full production schedule.',
  'feature',
  'ui',
  true,
  30
FROM changelog_releases WHERE version = '2.7.4';

-- View tracking
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'View count tracking',
  'Each link tracks how many times it has been opened. View count is shown on the share management page.',
  'improvement',
  'ui',
  true,
  40
FROM changelog_releases WHERE version = '2.7.4';

-- Token regeneration
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Regenerate or deactivate links',
  'Instantly invalidate a shared link by regenerating its token or deactivating it entirely — without deleting the link record.',
  'feature',
  'ui',
  true,
  50
FROM changelog_releases WHERE version = '2.7.4';

-- DB: new table
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'project_share_links table',
  'New table replaces external_shares and review_sessions. Includes RLS, accept_share_invite(), increment_share_link_views(), and regenerate_share_link_token() SECURITY DEFINER functions.',
  'internal',
  'database',
  false,
  60
FROM changelog_releases WHERE version = '2.7.4';

-- 3. Publish
SELECT publish_release('2.7.4');
