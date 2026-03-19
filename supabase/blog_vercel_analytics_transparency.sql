-- Legal blog post: Vercel Analytics transparency notice
-- Run in Supabase SQL editor

INSERT INTO legal_posts (
  slug,
  title,
  summary,
  content,
  category,
  severity,
  published,
  published_at,
  author_id,
  notify_users,
  tags
)
VALUES (
  'we-added-analytics-heres-exactly-what-that-means',
  'We added analytics. Here''s exactly what that means.',
  'We now use Vercel Analytics to see basic traffic data. No cookies, no tracking, no personal data stored. Full disclosure.',
  $content$
## What we added

We've added [Vercel Analytics](https://vercel.com/analytics) to Screenplay Studio. It's a tool that tells us things like how many people visited the site today, which pages are popular, and roughly where in the world traffic comes from.

That's it. Nothing sinister. But because this is the kind of thing you deserve to know about, here's every detail.

## What it actually collects

Every time you load a page, Vercel Analytics records:

- **The page URL** — so we know /dashboard is more popular than /blog
- **Your referrer** — the page you came from (if any)
- **Your browser and OS** — the user-agent string, e.g. "Chrome 122 on macOS"
- **Device type** — desktop, mobile, or tablet
- **Country** — derived from your IP address, then immediately discarded

That last point is worth emphasising. Your IP address is used for one second to figure out which country you're probably in, then it's gone. It is not logged, not stored, not linked to anything.

## What it does NOT collect

- No cookies. Vercel Analytics is fully cookieless.
- No persistent user identifier. There is no session ID, no fingerprint, nothing that follows you across page loads or visits.
- No personal information. We cannot see your name, email, account, or anything about who you specifically are.
- No cross-site tracking. This only runs on screenplaystudio.fun.
- No advertising data. We are not in the advertising business. This data is never sold, never shared with ad networks, never used to build profiles.

If you loaded the same page a hundred times, we'd see a hundred page views. We would not know it was you.

## Why we added it at all

Honestly, we were flying completely blind. We had no idea if anyone was actually using the arc planner, or if the storyboard feature was getting any traction, or which parts of the platform people spent time in.

Building in the dark is fine philosophically but practically it means spending two weeks building something nobody wanted and zero time on something everyone was waiting for.

Vercel Analytics gives us enough signal to make better decisions about what to work on next. The tradeoff is that you send a small amount of anonymised data when you visit a page. We think that's a reasonable tradeoff, but we wanted to be upfront about it rather than just quietly adding a script tag.

## Legal basis and the privacy policy update

Under GDPR, we're processing this data under **legitimate interests** (Article 6(1)(f)) — specifically, our interest in operating and improving the Service. Because Vercel Analytics doesn't use cookies and doesn't collect personal data, it doesn't require explicit cookie consent under the ePrivacy Directive.

We've updated our [Privacy Policy](/legal/privacy#vercel-analytics) with a dedicated section (§14.1) explaining all of this in full. If you want the formal version, it's there.

If you prefer not to be counted at all, a browser content blocker or enabling Do Not Track will do the job.

## Questions

If something about this doesn't sit right with you, open a thread on the [feedback board](/feedback) or reach out directly. We'd rather have a conversation about analytics than have you not trust the platform.

Transparency is the whole point of writing posts like this.
  $content$,
  'transparency_report',
  'info',
  true,
  NOW(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77',
  true,
  ARRAY['transparency', 'privacy', 'analytics', 'vercel']
);


-- Changelog entry
INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Vercel Analytics added',
  'Added privacy-first, cookieless Vercel Analytics for aggregate page traffic. No PII stored, no cookies set. Privacy Policy updated with full disclosure (§14.1).',
  'internal',
  'performance',
  true,
  (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM changelog_entries ce2
   WHERE ce2.release_id = (SELECT id FROM changelog_releases ORDER BY created_at DESC LIMIT 1))
FROM changelog_releases ORDER BY created_at DESC LIMIT 1;
