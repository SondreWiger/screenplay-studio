import { Metadata } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

const TYPE_MAP: Record<string, string> = {
  bug_report:      'bug',
  feature_request: 'feature',
  testimonial:     'testimonial',
  other:           'feedback',
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createServerSupabaseClient();

  const { data: item } = await supabase
    .from('feedback_items')
    .select('title, body, type, vote_count, comment_count, author_name, rating')
    .eq('id', params.id)
    .eq('is_public', true)
    .single();

  if (!item) {
    return { title: 'Feedback — Screenplay Studio' };
  }

  const title       = item.title || 'Feedback';
  const body        = item.body  || '';
  const description = body.length > 160 ? body.slice(0, 159) + '…' : body;
  const url         = `${BASE_URL}/feedback/${params.id}`;
  const ogType      = TYPE_MAP[item.type] ?? 'feedback';

  const ogImageParams = new URLSearchParams({
    type:  ogType,
    title,
    ...(description                && { subtitle: description }),
    ...(item.author_name           && { author:   item.author_name }),
    ...(item.vote_count    > 0     && { meta1:    `↑ ${item.vote_count}` }),
    ...(item.comment_count > 0     && { meta2:    `💬 ${item.comment_count}` }),
    ...(item.rating && item.type === 'testimonial' && { rating: String(item.rating) }),
  });

  const ogImage = `/api/og?${ogImageParams.toString()}`;

  const ogTitle = item.type === 'bug_report'
    ? `🐛 ${title}`
    : item.type === 'feature_request'
    ? `💡 ${title}`
    : title;

  return {
    title: ogTitle,
    description,
    openGraph: {
      type: 'article',
      title: `${ogTitle} — Screenplay Studio`,
      description,
      url,
      siteName: 'Screenplay Studio',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${ogTitle} — Screenplay Studio`,
      description,
      images: [ogImage],
    },
  };
}

export default function FeedbackDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
