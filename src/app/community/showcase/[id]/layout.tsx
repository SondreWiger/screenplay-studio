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

  const title = project.title || 'Showcase';
  const description = project.logline || `Check out "${title}" on Screenplay Studio.`;
  const genre = Array.isArray(project.genre) ? project.genre.join(', ') : project.genre;

  return {
    title: `${title} — Showcase`,
    description,
    openGraph: {
      type: 'article',
      title: `${title} — Screenplay Studio Showcase`,
      description: genre ? `${description} (${genre})` : description,
      url: `${BASE_URL}/community/showcase/${params.id}`,
      siteName: 'Screenplay Studio',
      images: project.cover_url
        ? [{ url: project.cover_url, width: 1200, height: 630, alt: title }]
        : [{ url: '/api/og?title=' + encodeURIComponent(title), width: 1200, height: 630, alt: 'Screenplay Studio' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — Screenplay Studio`,
      description,
      images: project.cover_url ? [project.cover_url] : ['/api/og?title=' + encodeURIComponent(title)],
    },
  };
}

export default function ShowcaseDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
