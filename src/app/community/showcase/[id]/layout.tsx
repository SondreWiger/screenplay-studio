import { Metadata } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createServerSupabaseClient();

  const { data: project } = await supabase
    .from('projects')
    .select('title, logline, genre, cover_url')
    .eq('id', params.id)
    .single();

  if (!project) {
    return { title: 'Showcase — Screenplay Studio' };
  }

  const title       = project.title   || 'Showcase';
  const description = project.logline || `Check out "${title}" on Screenplay Studio.`;
  const genre       = Array.isArray(project.genre) ? project.genre.join(', ') : (project.genre ?? '');

  const ogFallbackParams = new URLSearchParams({
    type:  'showcase',
    title,
    ...(description && { subtitle: description }),
    ...(genre       && { badge:    genre }),
  });
  const fallbackOgImage = `/api/og?${ogFallbackParams.toString()}`;
  const ogImage = project.cover_url ?? fallbackOgImage;

  return {
    title: `${title} — Showcase`,
    description: genre ? `${description} · ${genre}` : description,
    openGraph: {
      type: 'article',
      title: `${title} — Screenplay Studio Showcase`,
      description,
      url: `${BASE_URL}/community/showcase/${params.id}`,
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

export default function ShowcaseDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
