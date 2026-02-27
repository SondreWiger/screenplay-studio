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
  const title = post.title || 'Blog Post';
  const description = post.excerpt || 'Read this article on Screenplay Studio Blog.';
  const url = `${BASE_URL}/blog/${params.slug}`;

  return {
    title,
    description,
    keywords: post.tags || [],
    authors: [{ name: authorName }],
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: 'Screenplay Studio',
      publishedTime: post.published_at || undefined,
      authors: [authorName],
      tags: post.tags || [],
      images: post.cover_image_url
        ? [{ url: post.cover_image_url, width: 1200, height: 630, alt: title }]
        : [{ url: '/api/og?title=' + encodeURIComponent(title), width: 1200, height: 630, alt: 'Screenplay Studio' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: post.cover_image_url ? [post.cover_image_url] : ['/api/og?title=' + encodeURIComponent(title)],
    },
  };
}

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
