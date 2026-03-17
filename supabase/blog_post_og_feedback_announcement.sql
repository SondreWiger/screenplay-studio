-- Blog post: OG embeds + feedback system + testimonials announcement
-- Run in Supabase SQL editor

INSERT INTO blog_posts (
  slug,
  title,
  excerpt,
  tags,
  status,
  published_at,
  author_id,
  allow_comments,
  sections
)
VALUES (
  'link-previews-feedback-reviews',
  'your links finally look good (also we have a feedback page now)',
  'discord embeds that don''t look terrible, a whole feedback/roadmap section, and a reviews wall. shipped at 2am. you''re welcome.',
  ARRAY['updates', 'features', 'feedback', 'community'],
  'published',
  NOW(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77',
  true,
  $sections$
  [
    {
      "order": 1,
      "heading": "ok so i fixed the discord thing",
      "body": "you know how when you pasted a screenplaystudio.fun link into discord it just showed like... the site name and nothing else? yeah that was embarrassing. it's fixed now.\n\nevery page on the site now generates a proper embed with actual useful info. post pages show the title, who wrote it, and how many upvotes/comments it has. blog posts show the author. bug reports show what kind of report it is. reviews show the star rating.\n\nand they actually look good?? like the design matches the site. dark background, orange accent, the whole thing. i spent way too long on this."
    },
    {
      "order": 2,
      "heading": "we have a feedback page now",
      "body": "go to [screenplaystudio.fun/feedback](https://screenplaystudio.fun/feedback) and you can submit bug reports, feature requests, or just yell into the void. it's all public so you can see what other people have reported, upvote stuff, and leave comments on individual items.\n\nthe status system actually works too. things move from Open to Planned to In Progress to Resolved. there's also Won't Fix and Intended Behavior for the classic 'that's not a bug' moments.\n\ni built this mostly because i kept losing track of things people told me in discord dms. now there's a real place for it."
    },
    {
      "order": 3,
      "heading": "there's a reviews page",
      "body": "if you've been using screenplay studio and like it (or hate it, honestly works either way), you can leave a review at [screenplaystudio.fun/feedback](https://screenplaystudio.fun/feedback) and tick the testimonial option.\n\nall the approved ones show up at [screenplaystudio.fun/testimonials](https://screenplaystudio.fun/testimonials) in this big grid wall thing. you can filter by star rating, click one to read it properly, and see if anyone's commented on it. the average rating is shown huge at the top which is either going to be very good or very bad for me personally.\n\nplease be honest. bad reviews make me improve things faster."
    },
    {
      "order": 4,
      "heading": "also some smaller stuff",
      "body": "the feedback detail pages let you see the full report, admin updates, and leave comments if you're signed in. the admin panel got a proper sidebar so it doesn't look like a forgotten settings page anymore.\n\nalso votes on the feedback page no longer redirect you to the login page if you're already logged in but the page hasn't fully loaded yet. that was a fun bug."
    },
    {
      "order": 5,
      "heading": "what's next",
      "body": "probably sleep. but after that, whatever gets the most upvotes on the feedback page. that's kind of the whole point of building it.\n\nif something is broken please tell me at [screenplaystudio.fun/feedback](https://screenplaystudio.fun/feedback) instead of suffering in silence. i cannot fix things i don't know are broken."
    }
  ]
  $sections$
);
