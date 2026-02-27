import { Metadata } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const supabase = createServerSupabaseClient();

  const { data: share } = await supabase
    .from('external_shares')
    .select('title, share_type, branding, content_snapshot')
    .eq('access_token', params.token)
    .eq('is_active', true)
    .single();

  if (!share) {
    return { title: 'Shared Content — Screenplay Studio' };
  }

  const title = share.title || 'Shared Content';
  const shareTypeLabel = share.share_type === 'script' ? 'Script' : share.share_type === 'storyboard' ? 'Storyboard' : share.share_type === 'full' ? 'Full Project' : 'Content';
  const projectTitle = (share.content_snapshot as { project?: { title?: string; cover_url?: string } } | null)?.project?.title || '';
  const description = projectTitle
    ? `${shareTypeLabel} shared from "${projectTitle}" on Screenplay Studio.`
    : `${shareTypeLabel} shared via Screenplay Studio.`;
  const coverUrl = (share.content_snapshot as { project?: { title?: string; cover_url?: string } } | null)?.project?.cover_url;
  const brandLogo = (share.branding as { logo_url?: string } | null)?.logo_url;

  return {
    title: `${title} — Screenplay Studio`,
    description,
    openGraph: {
      type: 'article',
      title,
      description,
      url: `${BASE_URL}/share/${params.token}`,
      siteName: 'Screenplay Studio',
      images: (coverUrl || brandLogo)
        ? [{ url: (coverUrl || brandLogo)!, width: 1200, height: 630, alt: title }]
        : [{ url: '/api/og?title=' + encodeURIComponent(title), width: 1200, height: 630, alt: 'Screenplay Studio' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [(coverUrl || brandLogo || '/api/og?title=' + encodeURIComponent(title))],
    },
  };
}

export default function ShareViewerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
