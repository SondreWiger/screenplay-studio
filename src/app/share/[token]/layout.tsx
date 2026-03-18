import { Metadata } from 'next';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const admin = createAdminSupabaseClient();

  const { data: link } = await admin
    .from('project_share_links')
    .select('name, project_id, projects(title, cover_url)')
    .eq('token', params.token)
    .eq('is_active', true)
    .single();

  if (!link) {
    return { title: 'Shared Content — Screenplay Studio' };
  }

  const project = link.projects as { title?: string; cover_url?: string } | null;
  const projectTitle = project?.title ?? '';
  const linkName = link.name ?? 'Shared Content';
  const title = projectTitle ? `${linkName} — ${projectTitle}` : linkName;
  const description = projectTitle
    ? `${linkName} shared from "${projectTitle}" on Screenplay Studio.`
    : `Shared via Screenplay Studio.`;
  const coverUrl = project?.cover_url;

  return {
    title: `${title} — Screenplay Studio`,
    description,
    openGraph: {
      type: 'article',
      title,
      description,
      url: `${BASE_URL}/share/${params.token}`,
      siteName: 'Screenplay Studio',
      images: coverUrl
        ? [{ url: coverUrl, width: 1200, height: 630, alt: title }]
        : [{ url: '/api/og?title=' + encodeURIComponent(title), width: 1200, height: 630, alt: 'Screenplay Studio' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [coverUrl ?? '/api/og?title=' + encodeURIComponent(title)],
    },
  };
}

export default function ShareViewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {children}
    </div>
  );
}
