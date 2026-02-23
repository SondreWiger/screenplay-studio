import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, published_at, cover_image, tags, author:profiles!author_id(display_name, full_name)')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);

  const items = (posts || []).map((post: any) => {
    const authorName = post.author?.full_name || post.author?.display_name || 'Screenplay Studio';
    const pubDate = post.published_at ? new Date(post.published_at).toUTCString() : new Date().toUTCString();
    const categories = (post.tags || []).map((t: string) => `      <category>${escapeXml(t)}</category>`).join('\n');

    return `    <item>
      <title>${escapeXml(post.title || 'Untitled')}</title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${post.slug}</guid>
      <description>${escapeXml(post.excerpt || '')}</description>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(authorName)}</dc:creator>
${categories}${post.cover_image ? `\n      <enclosure url="${escapeXml(post.cover_image)}" type="image/jpeg" />` : ''}
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
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
