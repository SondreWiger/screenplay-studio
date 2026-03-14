-- ============================================================
-- Blog Post: Why We Use Image Links Instead of Uploads
-- ============================================================

INSERT INTO blog_posts (
  slug,
  title,
  excerpt,
  sections,
  tags,
  status,
  published_at,
  author_id,
  allow_comments
)
VALUES (
  'why-we-use-image-links',
  'Why We Use Image Links for Character References (For Now)',
  'When we built the character visual profile system, we made a deliberate choice to use image links instead of file uploads. Here''s the honest reason why — and what we''re planning.',
  $sections$
  [
    {
      "order": 1,
      "heading": "What changed",
      "body": "We recently launched character visual profiles — a way to attach inspiration images, actor reference photos, and versioned production folders (makeup, costume, etc.) directly to your characters in Screenplay Studio.\n\nIf you've used it, you may have noticed that instead of uploading images directly, you paste a URL link to an image hosted somewhere else — your mood board, a Google Drive share, an IMDB page, a Pinterest pin, whatever you have."
    },
    {
      "order": 2,
      "heading": "The honest reason",
      "body": "Storage costs money. Not a lot per image — but a lot when multiplied across thousands of projects and characters with dozens of reference photos each.\n\nRight now, Screenplay Studio is indie-built and self-funded. We're not backed by a VC fund with $40 million to burn on S3 buckets. We're built carefully, sustainably, and with real cost discipline.\n\nAdding file upload infrastructure means: object storage billing, CDN costs, bandwidth charges, image processing (compression, resizing), abuse prevention, and storage quotas management. That's a non-trivial engineering and infrastructure commitment that we're not ready to take on at this stage without pricing it properly for users."
    },
    {
      "order": 3,
      "heading": "Why links actually work well",
      "body": "The good news is: links are genuinely practical for this use case.\n\nMost reference images already live on the web. Film stills, actor headshots, makeup references, runway photos, Pinterest boards — they're all URL-accessible. You don't need to download and re-upload something that already has a stable link.\n\nFor your own original references — production photos, custom character designs, concept art — you can host them for free on services like Google Drive (set to public link), Dropbox, Imgur, or any image hosting site, then paste the link here.\n\nWe do try to render images directly in the panel when the URL is a direct image link (ending in .jpg, .png, etc.). If it's a page URL rather than a direct image, we show the link with a fallback placeholder."
    },
    {
      "order": 4,
      "heading": "What we're planning",
      "body": "We're not abandoning uploads — we're timing them right.\n\nOnce we introduce proper subscription tiers, we'll include storage as part of Pro plans: direct image uploads with a guaranteed storage quota, CDN-delivered thumbnails, and no dependency on external links staying alive.\n\nUntil then, link-based references are the honest, practical, and honest-about-its-constraints solution. We'd rather ship a useful feature now and be transparent about the tradeoff than either not ship it, or quietly introduce hidden costs we can't sustain."
    },
    {
      "order": 5,
      "heading": "A note on link permanence",
      "body": "One real downside of links: they can break. If the site you linked to goes down, or you lose access to a shared Google Drive folder, your references disappear.\n\nFor now, our recommendation is to use stable image hosts (Imgur, Cloudinary free tier, or your own domain) for anything you really care about long-term. We will add a warning indicator when an image URL can no longer be resolved — that's on the roadmap.\n\nThanks for building with us. This kind of iterative, honest ship is how we operate."
    }
  ]
  $sections$,
  ARRAY['features', 'transparency', 'characters', 'visual-references'],
  'published',
  NOW(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77'::uuid,
  true
)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      sections = EXCLUDED.sections,
      tags = EXCLUDED.tags,
      status = EXCLUDED.status,
      published_at = COALESCE(blog_posts.published_at, EXCLUDED.published_at),
      updated_at = NOW();
