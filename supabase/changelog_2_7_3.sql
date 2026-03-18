-- ============================================================
-- Changelog: 2.7.3 — Push Notifications Overhaul
-- ============================================================

-- Create the 2.7.3 draft release
INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.3',
  'Push Notifications Overhaul',
  'Fixed push notifications that have never worked due to an architecture flaw, and added tab title badges, a Web Audio notification ping, and cross-device push delivery.',
  'patch'
)
ON CONFLICT (version) DO NOTHING;

-- Fix: push notifications now actually work
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Push Notifications Fixed',
  'Push notifications were silently failing on every event due to a missing authentication header — the server-only secret was never sent, so every push call returned 401 and was discarded. The architecture has been corrected: push is now triggered from the recipient''s device using their own session token, which is sent as a Bearer header. The push endpoint also gains a dual-auth path — internal server calls still use the secret header, while client calls use the session token and are restricted to the caller''s own subscriptions.',
  'fix',
  'api',
  true,
  10
FROM changelog_releases WHERE version = '2.7.3'
ON CONFLICT DO NOTHING;

-- Feature: tab title notification badge
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Tab Title Notification Badge',
  'The browser tab title now shows an unread count when you have unread notifications — e.g. "(3) Screenplay Studio". The count updates in real time as new notifications arrive and clears back to "Screenplay Studio" when you have no unread items.',
  'feature',
  'ui',
  true,
  20
FROM changelog_releases WHERE version = '2.7.3'
ON CONFLICT DO NOTHING;

-- Feature: in-browser notification sound
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Notification Sound',
  'High-priority notifications (direct messages, mentions, invitations, task assignments) now play a subtle two-tone ping when the tab is not focused. The sound is synthesised via the Web Audio API — no audio file is needed and it works offline. Low-priority events like upvotes are intentionally excluded to reduce noise.',
  'feature',
  'ui',
  true,
  30
FROM changelog_releases WHERE version = '2.7.3'
ON CONFLICT DO NOTHING;

-- Feature: cross-device push
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Push to Your Other Devices',
  'When a high-priority notification arrives on an active session, it now also pushes to all of the user''s other subscribed devices. This means a notification received while you are on your laptop will still appear as a native system notification on your phone (and vice versa), as long as push is enabled on that device.',
  'feature',
  'ui',
  true,
  40
FROM changelog_releases WHERE version = '2.7.3'
ON CONFLICT DO NOTHING;

-- Internal: service worker cache version bump
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Service Worker Cache Bump (ss-v4)',
  'Bumped the PWA service worker cache version from ss-v1 to ss-v4 to invalidate stale caches on existing installations and pick up the updated push handling logic.',
  'internal',
  'performance',
  false,
  50
FROM changelog_releases WHERE version = '2.7.3'
ON CONFLICT DO NOTHING;
