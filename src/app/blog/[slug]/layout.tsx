import { Metadata } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = createServerSupabaseClient();

  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, excerpt, cover_image_url, tags, published_at, author:profiles!author_id(display_name, full_name)')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single();

  if (!post) {
    return { title: 'Post Not Found' };
  }

  const author = post.author as { full_name?: string; display_name?: string } | null;
  const authorName = author?.full_name || author?.display_name || 'Screenplay Studio';
  const title       = post.title  || 'Blog Post';
  const description = post.excerpt || 'Read this article on Screenplay Studio Blog.';
  const url         = `${BASE_URL}/blog/${params.slug}`;

  const ogFallbackParams = new URLSearchParams({
    type:  'blog',
    title,
    ...(authorName && authorName !== 'Screenplay Studio' ? { author: authorName } : {}),
  });
  const fallbackOgImage = `/api/og?${ogFallbackParams.toString()}`;
  const ogImage = post.cover_image_url ?? fallbackOgImage;

  return {
    title,
    description,
    keywords: post.tags || [],
    authors: [{ name: authorName }],
    openGraph: {
      type: 'article',
      title: `${title} — Screenplay Studio Blog`,
      description,
      url,
      siteName: 'Screenplay Studio',
      publishedTime: post.published_at || undefined,
      authors: [authorName],
      tags: post.tags || [],
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — Screenplay Studio`,
      description,
      images: [ogImage],
    },
  };
}

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
