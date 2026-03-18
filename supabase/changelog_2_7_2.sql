-- ============================================================
-- Changelog: 2.7.2 — Security Patches & SEO Fixes
-- ============================================================

INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.2',
  'Security Patches & SEO Fixes',
  'Patched an unauthenticated API endpoint, added rate limiting to the public feedback form, fixed the sitemap (cached + 8 missing pages), and tightened robots.txt coverage.',
  'patch'
)
ON CONFLICT (version) DO NOTHING;

-- ── Security: automod route was unauthenticated ───────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Automod Route Authentication',
  '/api/automod had no authentication check, allowing any external caller to trigger database writes (including hiding posts). It now requires the PUSH_API_SECRET internal header, consistent with the push notification and email routes.',
  'security',
  'admin',
  false,
  10
FROM changelog_releases WHERE version = '2.7.2'
ON CONFLICT DO NOTHING;

-- ── Security: feedback/submit rate limiting ───────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Feedback Submission Rate Limiting',
  '/api/feedback/submit now enforces a server-side rate limit of 5 anonymous submissions per IP per 15 minutes. This prevents the public bug report / feature request form from being used to flood the feedback_items table with the service role key.',
  'security',
  'admin',
  false,
  20
FROM changelog_releases WHERE version = '2.7.2'
ON CONFLICT DO NOTHING;

-- ── SEO: sitemap caching ──────────────────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Sitemap Now Cached (30-min Revalidation)',
  'The sitemap was previously set to force-dynamic, meaning Next.js regenerated it on every single request — including Googlebot crawls. It now uses revalidate = 1800, serving a cached response and regenerating in the background every 30 minutes.',
  'performance',
  'performance',
  false,
  30
FROM changelog_releases WHERE version = '2.7.2'
ON CONFLICT DO NOTHING;

-- ── SEO: missing sitemap pages ────────────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Sitemap: 8 Missing Pages Added',
  'Added /about, /press, /testimonials, /licenses, /contribute, /feedback, /changelog, and /u/ (user profiles) to the sitemap static pages list. These valid public pages were previously invisible to search engines.',
  'improvement',
  'admin',
  false,
  40
FROM changelog_releases WHERE version = '2.7.2'
ON CONFLICT DO NOTHING;

-- ── SEO: robots.txt improvements ─────────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'robots.txt: Explicit Allow & Disallow Lists',
  'Added /about, /press, /testimonials, /licenses, /contribute, /feedback, /changelog, /u/ to the allow list. Added /idea-boards, /accountability, and /casting to the disallow list for the default user-agent (these are auth-gated or user-private pages).',
  'improvement',
  'admin',
  false,
  50
FROM changelog_releases WHERE version = '2.7.2'
ON CONFLICT DO NOTHING;
