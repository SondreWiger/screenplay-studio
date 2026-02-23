import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Convert markdown-ish section body to simple HTML paragraphs */
function bodyToHtml(body: string): string {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((p) => `<p>${escapeXml(p.trim())}</p>`)
    .join('\n');
}

/** Build full article HTML from the JSONB sections array */
function sectionsToHtml(sections: { heading?: string; body?: string; order?: number }[], coverImage?: string): string {
  const sorted = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const parts: string[] = [];

  if (coverImage) {
    parts.push(`<p><img src="${escapeXml(coverImage)}" alt="Cover image" /></p>`);
  }

  for (const section of sorted) {
    if (section.heading) {
      parts.push(`<h2>${escapeXml(section.heading)}</h2>`);
    }
    if (section.body) {
      parts.push(bodyToHtml(section.body));
    }
  }

  return parts.join('\n');
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, sections, published_at, cover_image_url, tags, author:profiles!author_id(display_name, full_name)')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);

  const items = (posts || []).map((post: any) => {
    const authorName = post.author?.full_name || post.author?.display_name || 'Screenplay Studio';
    const pubDate = post.published_at ? new Date(post.published_at).toUTCString() : new Date().toUTCString();
    const categories = (post.tags || []).map((t: string) => `      <category>${escapeXml(t)}</category>`).join('\n');
    const contentHtml = sectionsToHtml(post.sections || [], post.cover_image_url);

    return `    <item>
      <title>${escapeXml(post.title || 'Untitled')}</title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${post.slug}</guid>
      <description>${escapeXml(post.excerpt || '')}</description>
      <content:encoded><![CDATA[${contentHtml}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(authorName)}</dc:creator>
${categories}${post.cover_image_url ? `\n      <enclosure url="${escapeXml(post.cover_image_url)}" type="image/jpeg" />` : ''}
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Screenplay Studio Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Tips, tutorials, and updates for screenwriters and filmmakers using Screenplay Studio.</description>
    <language>en</language>
    <atom:link href="${BASE_URL}/api/rss" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
