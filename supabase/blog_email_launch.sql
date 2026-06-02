-- Blog post: The email launch story
-- Run this in Supabase SQL Editor

INSERT INTO blog_posts (
  slug,
  title,
  excerpt,
  sections,
  tags,
  status,
  published_at,
  allow_comments,
  view_count
) VALUES (
  'email-launch-whoops',
  'We broke email. Twice. Here''s what happened.',
  'Our email system had a rough start — wrong links, broken senders, and a few lessons learned the hard way.',
  '[
    {
      "heading": "So we built an email system",
      "body": "After weeks of work, we finally had a proper email system baked into Screenplay Studio. Welcome emails, project invites, support ticket replies, re-engagement messages — the whole thing. Resend as the provider, branded templates, the works. We were ready to ship it.",
      "order": 1
    },
    {
      "heading": "Take one: the wrong link",
      "body": "First batch went out. \"We miss you\" emails to everyone who had been inactive. Looked great. Except every single link pointed to localhost:3000. Not the production URL. Just... localhost. The email equivalent of sending someone directions to your couch. Nobody could click through. Nobody could come back. The emails were basically decorative.",
      "order": 2
    },
    {
      "heading": "Take two: same sender, different problem",
      "body": "Okay, fixed the URL. Sent the correction email. Same sender address — which was a noreply address that didn''t actually accept replies. So if anyone wanted to respond, ask a question, or just say \"hey this link is wrong\" — they couldn''t. We also stress-typed the correction and didn''t exactly proofread it. Twice.",
      "order": 3
    },
    {
      "heading": "Take three: actually fixing it",
      "body": "Third time we got it right. Real domain in the links. Reply-to address that goes to an actual inbox. Proper sender configuration. Spell-checked copy. The email system that should have worked from day one, finally working on day three.",
      "order": 4
    },
    {
      "heading": "What we learned",
      "body": "1. Always double-check your environment variables before sending to real users. A localhost URL in a production email is a special kind of embarrassment.<br><br>2. \"noreply\" addresses should never be the default for a product that says \"reply to this email.\" Either commit to reading replies or don''t promise them.<br><br>3. When you screw up, fix it fast and don''t sugarcoat it. Users appreciate honesty over polished excuses.<br><br>4. Test with 1 user before sending to 100. Or 1000. Or however many you have.",
      "order": 5
    },
    {
      "heading": "Where we are now",
      "body": "The email system works. Welcome emails send on signup. Project invites go out when you add team members. Support tickets get replies. Inactive users get a gentle nudge after 30 days. And when we send you something, the links work, the sender replies, and we actually proofread it (mostly).<br><br>It had a rough start. But it works now, and it''ll keep working. Promise. (This time we mean it.)",
      "order": 6
    }
  ]'::jsonb,
  ARRAY['launch', 'email', 'behind the scenes', 'postmortem'],
  'published',
  NOW(),
  true,
  0
);
