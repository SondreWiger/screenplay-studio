-- ============================================================
-- Changelog: 2.7.1 — Security Hardening & Performance
-- ============================================================

INSERT INTO changelog_releases (version, title, summary, release_type)
VALUES (
  '2.7.1',
  'Security Hardening & Performance',
  'Expanded AI scraper blocking, tightened Content Security Policy, faster page loads via bundle optimisation, and an updated Privacy Policy covering community @mentions and collaborator credits.',
  'patch'
)
ON CONFLICT (version) DO NOTHING;

-- ── Security: expanded AI bot blocking ───────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Expanded AI Scraper Blocking',
  'The bot-blocklist now covers Grok/xAI, DuckAssistBot, OAI-SearchBot, Mistral-AI, CommonCrawl, img2dataset, PetalBot, Scrapy, and Turnitin harvester — blocked at both the middleware level (UA detection) and in robots.txt. All blocked bots previously only in the middleware are now also listed in robots.txt for standards compliance.',
  'security',
  'performance',
  true,
  10
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Security: messages route protection ──────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Messages Route Auth Gate',
  '/messages is now enforced as a protected route in middleware — unauthenticated requests are redirected to login. Previously the route was listed in robots.txt disallow but not protected server-side.',
  'security',
  'auth',
  false,
  20
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Security: CSP hardening ───────────────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Content Security Policy Hardened',
  'unsafe-eval is now stripped from the CSP in production builds — it is only present in development for Next.js Fast Refresh. form-action now explicitly whitelists PayPal. object-src ''none'' added to block Flash/plugin injection vectors.',
  'security',
  'admin',
  false,
  30
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Security: UA fingerprint check ───────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Empty User-Agent Blocking',
  'Middleware now rejects requests with an empty or suspiciously short (<10 char) User-Agent. Legitimate browsers always carry a non-trivial UA string; empty UAs are a classic headless-scraper signal.',
  'security',
  'performance',
  false,
  40
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Security: X-Robots-Tag blanket AI opt-out ────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Sitewide AI Opt-Out Header',
  'X-Robots-Tag: noai, noimageai is now served on every page (not just /community and /share). User profile pages (/u/*) also now receive the AI opt-out tag.',
  'security',
  'admin',
  true,
  50
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Performance: lucide-react / date-fns tree-shaking ────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Bundle Tree-Shaking for Icons & Dates',
  'Enabled optimizePackageImports for lucide-react, date-fns, and sonner. Next.js now tree-shakes these libraries at build time, shipping only the icons and date functions actually used. Expect measurable reductions in JS bundle size.',
  'performance',
  'performance',
  true,
  60
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Performance: console stripping in production ─────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Production Console Strip',
  'console.log and console.debug calls are now automatically removed from production builds by the Next.js compiler. console.error and console.warn are retained.',
  'performance',
  'performance',
  false,
  70
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Performance: static asset caching ────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Aggressive Static Asset Caching',
  'Cache-Control headers are now set explicitly: /_next/static/* gets immutable 1-year caching (content-hashed filenames guarantee no stale hits), optimised images get 7-day browser caching with stale-while-revalidate, and public static files (fonts, icons) get 30-day caching.',
  'performance',
  'performance',
  true,
  80
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Performance: AVIF image format support ───────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'AVIF Image Format Support',
  'Next.js image optimisation now serves AVIF (then WebP, then original) to browsers that support it. AVIF averages 50% smaller than JPEG at equivalent quality.',
  'performance',
  'performance',
  true,
  90
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Performance: turbopack dev server ────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Turbopack Dev Server',
  'Local development now uses Next.js Turbopack (--turbopack flag). Turbopack delivers significantly faster cold-start and hot-reload times compared to webpack.',
  'performance',
  'admin',
  false,
  100
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;

-- ── Privacy: policy update ────────────────────────────────────────────────────
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Privacy Policy Updated (March 2026)',
  'Privacy Policy updated to March 18, 2026. New disclosures added for community @mentions (Section 2.6) and collaborator credits (Section 2.6), with corresponding retention table entries. Automated Decision-Making section (Section 17) now documents @mention parsing and bot detection. form-action PayPal addition noted under security measures.',
  'improvement',
  'admin',
  true,
  110
FROM changelog_releases WHERE version = '2.7.1'
ON CONFLICT DO NOTHING;
