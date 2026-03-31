-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Blog Post: Content Safety & User Privacy Commitment      ║
-- ║  + Security Advisory: Moderation System Transparency      ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════
-- 1) DEV BLOG POST — Content Safety & Privacy
-- ═══════════════════════════════════════════════════════════════
INSERT INTO blog_posts (
  slug, title, excerpt, cover_image_url, sections, tags,
  status, published_at, author_id, allow_comments
)
VALUES (
  'content-safety-and-user-privacy',
  'Content Safety & User Privacy: How We Protect Both',
  'A transparent look at our new content moderation system — what it does, what it doesn''t, and why your scripts and conversations remain yours.',
  NULL,
  $sections$
[
  {
    "order": 1,
    "heading": "Your Work Is Yours — Full Stop",
    "body": "Let's get the most important thing out of the way first: **we cannot and do not read your scripts, screenplays, treatments, or any other creative content.** Period.\n\nScreenplay Studio was built by a writer, for writers. The idea that someone could be looking over your shoulder while you write is antithetical to everything this platform stands for. Your projects, your scripts, your notes, your ideas — they are private. They belong to you. No one on our team has access to them, and that is by design.\n\nThis hasn't changed. It will never change."
  },
  {
    "order": 2,
    "heading": "So What Did Change?",
    "body": "We've introduced an automated content safety system that scans for a very specific and narrow set of terms — terms exclusively associated with child sexual abuse material (CSAM), child exploitation, and trafficking.\n\nThis system exists for one reason: **legal and moral obligation.** Every platform that allows user-generated content has a duty to prevent the distribution of material that exploits children. This is non-negotiable, and it's the law in virtually every jurisdiction we operate in.\n\nHere's exactly what the system does:\n\n- It checks text content against a fixed list of terms that are unambiguously tied to CSAM and child exploitation\n- If — and only if — a match is found, a flag is created for admin review\n- The flag contains only the matched term(s) and a short snippet of surrounding context — not your entire script, not your whole document, not your project\n- No content is read, opened, or accessed by any human unless a flag is triggered\n\nThat's it. No AI reading your scripts. No keyword surveillance for profanity, violence, or mature themes. No monitoring of your creative choices. Just a targeted safety net for the worst possible content."
  },
  {
    "order": 3,
    "heading": "What About Legitimate Creative Work?",
    "body": "We understand that screenwriting often engages with difficult, dark, and uncomfortable subject matter. A documentary about human trafficking. A crime thriller that depicts exploitation. A social commentary that confronts abuse. These are important stories, and we have no interest in censoring them.\n\nOur system is designed with this in mind:\n\n- **The term list is narrow and specific.** It does not flag words like \"child,\" \"abuse,\" or \"violence\" on their own. It targets compound phrases and known coded language that have no legitimate creative application.\n- **Flags are reviewed by a human before any action.** If a flag is triggered, an admin reviews the context. A documentary script about trafficking is obviously different from someone uploading illegal content — and we treat it that way.\n- **We ask before we act.** If there's any ambiguity, we will send you a direct message asking for context before taking any action. We don't delete first and ask questions later.\n- **You can explain, and we will listen.** If your work is flagged and you're working on legitimate creative content, just let us know. We'll mark it as a false positive and move on. No penalty, no mark on your account, no judgment.\n\nThe goal is to catch the 0.001% of bad actors without disrupting the 99.999% of writers doing legitimate work."
  },
  {
    "order": 4,
    "heading": "What We Cannot Access",
    "body": "Let's be specific about what the admin team **cannot** do:\n\n- ❌ **Open or read your scripts** — We have no access to your screenplay content unless a specific safety flag is triggered, and even then we only see a short snippet around the flagged term\n- ❌ **Browse your projects** — The admin project list shows titles and metadata (format, status, member count) for platform management. We cannot open, edit, or view anything inside your projects\n- ❌ **Read your conversations** — We have zero access to your DMs or project chat messages. We cannot open your conversations, scroll through your history, or read your messages\n- ❌ **Access your documents, notes, or ideas** — Your creative workspace is private\n- ❌ **See who you collaborate with** — Project membership details are your business\n\nThe only scenario where we see any content is when the automated system flags a specific term. And even then, we see exactly one snippet — not the rest of your work."
  },
  {
    "order": 5,
    "heading": "What About Chat and DMs?",
    "body": "Direct messages and project chat follow the same principle, with an even higher standard of privacy.\n\n**We cannot access your conversations.** We don't have a \"read all DMs\" button. We can't browse chat history. Your private conversations are exactly that — private.\n\nIf the automated system detects a flagged term in a message, here's what happens:\n\n1. The system records that one specific message — not the conversation, not the history, just the single message that triggered the flag\n2. An admin reviews the flag and sees only that message snippet\n3. If context is needed, we'll **send you a DM** to ask about it — we don't go digging through your other messages\n4. If it's a false positive (which we expect most flags to be), we dismiss it immediately\n\nThis is a system built on trust, and trust goes both ways. We trust that the vast majority of our users are here to write and collaborate. In return, we ask that you trust that we're not interested in snooping — we're interested in keeping the platform safe for everyone."
  },
  {
    "order": 6,
    "heading": "Enforcement Actions",
    "body": "When a genuine violation is confirmed — after human review, after asking for context when appropriate — we have a graduated enforcement system:\n\n1. **Warning** — A notification explaining what was found and asking you to review the community guidelines\n2. **Temporary Suspension** — For repeated or serious violations, with a clear end date\n3. **Permanent Ban** — Reserved for the most severe cases, particularly confirmed CSAM distribution\n\nEvery enforcement action comes with:\n- A System DM explaining exactly what happened and why\n- The specific reason for the action\n- Instructions for how to appeal if you believe the action was taken in error\n- A direct email address to reach us\n\nWe don't do silent bans. We don't do unexplained removals. If we take action on your account, you will know exactly why."
  },
  {
    "order": 7,
    "heading": "The Appeal Process",
    "body": "If you receive a warning, suspension, or ban that you believe is unjust:\n\n1. Check the System DM in your messages for the specific reason\n2. Email **sondre@northem.no** with your account email and your explanation\n3. We'll review the case personally and respond within 48 hours\n\nAppeals are reviewed by a real person, not an algorithm. If we got it wrong, we'll say so and restore your account immediately."
  },
  {
    "order": 8,
    "heading": "Why Transparency Matters",
    "body": "We could have deployed this system silently. Many platforms do. But that's not how we want to operate.\n\nYou deserve to know exactly what systems are running on a platform where you store your creative work. You deserve to know what we can and cannot see. You deserve to know that your privacy is a feature, not an afterthought.\n\nScreenplay Studio is a small platform built by people who care about both safety and privacy. We believe you can have both, and this system is our attempt to prove it.\n\nIf you have any questions about this system, how it works, or how your data is handled, reach out to **sondre@northem.no**. We'll answer honestly."
  }
]
$sections$,
  ARRAY['privacy', 'safety', 'transparency', 'moderation', 'trust'],
  'published',
  NOW(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  sections = EXCLUDED.sections,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  updated_at = NOW();


-- ═══════════════════════════════════════════════════════════════
-- 2) LEGAL/SECURITY POST — Moderation System Security Advisory
-- ═══════════════════════════════════════════════════════════════
INSERT INTO legal_posts (
  slug, title, summary, content, category, severity,
  published, published_at, author_id, notify_users, tags
)
VALUES (
  'content-moderation-system-transparency-2026',
  'Security Update: Content Moderation & Safety System',
  'Details on our new automated content safety system, what data it accesses, how enforcement works, and your privacy protections.',
  $content$
## Overview

Screenplay Studio has implemented an automated content safety system designed to detect and prevent the distribution of child sexual abuse material (CSAM) and related exploitation content on our platform. This document describes what the system does, what it accesses, and what protections are in place for your privacy.

## What the System Monitors

The system scans user-generated text content against a fixed, narrow list of terms exclusively associated with CSAM, child exploitation, and child trafficking. The term list does not include general profanity, violence, mature themes, or any language commonly used in legitimate creative writing.

Content types subject to scanning:
- Script elements (dialogue, action lines, scene headings)
- Story ideas and brainstorming notes
- Project documents
- Scene descriptions and character backstories
- Project chat messages
- Direct messages

## What the System Does NOT Do

- It does not use artificial intelligence or machine learning to analyze your writing
- It does not flag profanity, violence, sexual content, or any other mature themes
- It does not provide any human with access to your full scripts, projects, or conversations
- It does not scan images, audio, or video content
- It does not share any data with third parties, law enforcement, or external services unless required by law

## Access Controls

**Admin access to projects**: Platform administrators can see project titles, formats, and membership counts in the admin panel for operational purposes. Administrators **cannot** open, read, edit, or access the contents of any project they are not a member of.

**Admin access to scripts**: Administrators have **no access** to script content. The only exception is when the automated system flags a specific term — in which case the administrator sees only a short text snippet (approximately 100 characters) surrounding the flagged term, not the full script.

**Admin access to conversations**: Administrators have **no access** to direct messages or project chat history. If a message triggers an automated flag, the administrator sees only that single message. They cannot view the rest of the conversation, scroll through message history, or access any other messages in the thread.

## How Flags Are Handled

1. The automated system detects a matching term and creates a flag
2. The flag contains: the content type, the matched term(s), and a short snippet of surrounding context
3. An administrator reviews the flag
4. If the content appears to be legitimate creative work (e.g., a documentary script, a crime thriller, social commentary), the flag is dismissed as a false positive — no action is taken
5. If context is ambiguous, the administrator will **send you a direct message** asking for clarification before taking any action
6. Only confirmed violations result in enforcement action

## Legitimate Creative Use

We recognize that screenwriting frequently addresses difficult subjects including abuse, exploitation, and violence. Our system is intentionally designed to avoid interfering with legitimate creative work:

- General terms like "child," "abuse," or "violence" do **not** trigger flags on their own
- The detection list targets only compound phrases and known coded language with no legitimate creative application
- Every flag is reviewed by a human who understands the difference between depicting a subject and promoting it
- Ambiguous cases are always resolved in favor of the creator — we ask first, act second
- False positives are dismissed with no record on your account

## Enforcement & Notification

All enforcement actions are communicated via an in-platform System DM that includes:
- The specific reason for the action
- What content was flagged
- The moderator's notes
- Instructions for appeal

Enforcement tiers:
- **Warning** — Informational notice, no access restrictions
- **Temporary Suspension** — Time-limited restriction with a clear expiration date; access is automatically restored when the suspension expires
- **Permanent Ban** — Reserved for confirmed distribution of illegal content; includes IP-based access restriction

## Appeals

Any enforcement action can be appealed by emailing **sondre@northem.no**. Appeals are reviewed personally and responded to within 48 hours. If a mistake was made, the action will be reversed immediately and no record will be retained against the account.

## IP-Based Enforcement

For permanent bans related to confirmed illegal content, the user's IP address is recorded to prevent re-registration. This data is stored securely and is only used for ban enforcement purposes. IP data is not shared, sold, or used for any other purpose.

## Data Retention

- Content flags are retained for the duration required by applicable law
- Evidence snapshots (preserved copies of flagged content) are stored in a tamper-proof, append-only table. They cannot be modified or deleted by any user, including administrators
- Evidence integrity is verified using SHA-256 content hashing
- IP ban records are retained only while the ban is active

## Your Rights

You have the right to:
- Know what data we collect about you (see our Privacy Policy)
- Request a copy of any moderation flags associated with your account
- Appeal any enforcement action taken against your account
- Contact us at **sondre@northem.no** with questions about this system

## Changes to This Policy

This document will be updated whenever material changes are made to the content moderation system. All changes will be communicated via the legal blog and platform notifications.

*Last updated: March 2026*
$content$,
  'security_advisory',
  'important',
  true,
  NOW(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77',
  true,
  ARRAY['security', 'privacy', 'moderation', 'csam', 'transparency', 'trust-and-safety']
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  category = EXCLUDED.category,
  severity = EXCLUDED.severity,
  published = EXCLUDED.published,
  updated_at = NOW();
