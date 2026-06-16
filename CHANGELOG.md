# Changelog

## [2.7.7] - 2026-06-14
### Studio Tier — Big Production Tools
- All previous Pro features (version history, share portals, analytics, AI analysis, client review, branding, revision tracking, reports, casting, advanced export) are now **free for everyone**
- Introducing the **Studio tier** for big productions:
  - Multi-project portfolio dashboard across all productions
  - Production accounting (payroll integration, investor reports, tax docs)
  - Rights & clearance tracking (music rights, location releases, talent agreements)
  - Distribution & delivery (DCP specs, subtitle generation, QC reports, festival submissions)
  - Crew portal (crew database, availability calendar, digital call sheets)
  - Department management (per-department task tracking, dependencies, handoffs)
  - Insurance & compliance (COI management, SAG/AFTRA paperwork, safety reports)
  - API & integrations (webhooks, Zapier, Slack, Monday.com)
  - SSO & audit (SAML/SSO, role-based access, full audit trail)
  - Advanced security (IP watermarking, DRM, NDA enforcement)

## [2.7.6] - 2026-06-14
### Live Active Users Dashboard
- Admin dashboard now shows real-time counts of users active within the last 5 minutes, 15 minutes, and 1 hour

## [2.7.5] - 2026-04-12
### Poll Push Notifications
- Admins can now send push notifications to all users for published polls from the admin panel, re-engaging users with polls they may have missed

## [2.7.4] - 2026-03-19
### New Share System
- Replaced Share Portal and Client Review with a clean, token-based sharing system — create named links that grant access to specific sections with no login required
- Share links can optionally be set as invite links that prompt sign-in and auto-join the project with a chosen role
- Each share link carries its own content permissions, letting you expose only what you want the recipient to see
- View count tracking shows how many times each link has been opened
- Links can be instantly invalidated by regenerating the token or deactivating without deleting the link record

## [2.7.3] - 2026-03-18
### Push Notifications Overhaul
- Fixed push notifications that were silently failing on every event due to a missing authentication header — push is now triggered from the recipient's device using their own session token
- Browser tab title now shows an unread notification count that updates in real time
- High-priority notifications (direct messages, mentions, invitations, task assignments) play a subtle two-tone ping via the Web Audio API when the tab is not focused
- Notifications now push to all of the user's subscribed devices, so a notification on laptop also appears on your phone

## [2.7.2] - 2026-03-18
### Security Patches & SEO Fixes
- `/api/automod` now requires the `PUSH_API_SECRET` internal header — previously unauthenticated, allowing external callers to trigger database writes
- `/api/feedback/submit` enforces rate limiting of 5 anonymous submissions per IP per 15 minutes
- Sitemap now uses 30-minute revalidation caching instead of regenerating on every request
- Added 8 missing public pages (/about, /press, /testimonials, /licenses, /contribute, /feedback, /changelog, /u/) to the sitemap
- robots.txt updated with explicit allow and disallow lists for auth-gated and user-private pages

## [2.7.1] - 2026-03-18
### Security Hardening & Performance
- Expanded AI scraper blocking to cover Grok/xAI, DuckAssistBot, OAI-SearchBot, CommonCrawl, and more — blocked at middleware level and in robots.txt
- `/messages` is now enforced as a protected route in middleware with redirect to login for unauthenticated requests
- Content Security Policy hardened — `unsafe-eval` stripped in production, `form-action` whitelists PayPal, `object-src 'none'` added
- Requests with empty or suspiciously short User-Agent strings are now rejected by middleware
- Sitewide `X-Robots-Tag: noai, noimageai` header served on every page
- Bundle tree-shaking enabled for lucide-react, date-fns, and sonner — measurable JS bundle size reduction
- `console.log` and `console.debug` stripped from production builds by Next.js compiler
- Aggressive static asset caching — immutable 1-year for content-hashed assets, 7-day for optimised images, 30-day for public static files
- AVIF image format support added with fallback to WebP and original format
- Local development now uses Next.js Turbopack for faster cold-start and hot-reload times
- Privacy Policy updated to March 18, 2026 with new disclosures for @mentions and collaborator credits

## [2.7.0] - 2026-03-14
### Character Visual Profiles
- Clicking a character card now opens a read-only detail panel with full overview, description, backstory, arc, traits, and appearance — with an Edit button to open the editor
- Inspiration Board tab lets you paste image URLs to build a mood board for each character's look and aesthetic
- Actor Reference Photo tab lets you link an actor headshot, character design, or casting reference image
- Production Reference Folders give makeup, costume, and other departments a place to store versioned reference image folders (typed as Makeup, Costume, or Other)
- Character avatars now show the actor's photo when linked to a cast member record, or accept a directly pasted photo URL
