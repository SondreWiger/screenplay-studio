import { Metadata } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = createServerSupabaseClient();

  const { data: post } = await supabase
    .from('community_posts')
    .select('title, description, upvote_count, comment_count, cover_image_url, author:profiles!author_id(display_name, full_name)')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single();

  if (!post) {
    return { title: 'Community Post — Screenplay Studio' };
  }

  const author = post.author as { display_name?: string; full_name?: string } | null;
  const authorName = author?.display_name || author?.full_name || '';
  const title    = post.title || 'Community Post';
  const description = post.description || `Read "${title}" on Screenplay Studio Community.`;
  const url      = `${BASE_URL}/community/post/${params.slug}`;

  const ogImageParams = new URLSearchParams({
    type:  'post',
    title,
    ...(description && { subtitle: description }),
    ...(authorName  && { author: authorName }),
    ...(post.upvote_count  > 0 && { meta1: `↑ ${post.upvote_count}` }),
    ...(post.comment_count > 0 && { meta2: `💬 ${post.comment_count}` }),
  });

  const ogImage = post.cover_image_url
    ? post.cover_image_url
    : `/api/og?${ogImageParams.toString()}`;

  return {
    title,
    description,
    openGraph: {
      type: 'article',
      title: `${title} — Screenplay Studio`,
      description,
      url,
      siteName: 'Screenplay Studio',
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

export default function CommunityPostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
