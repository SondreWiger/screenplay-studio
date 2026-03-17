import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = getSupabase();

  const { data: company } = await supabase
    .from('companies')
    .select('name, description, logo_url')
    .eq('slug', params.slug)
    .eq('public_page_enabled', true)
    .single();

  if (!company) {
    return { title: 'Company Not Found' };
  }

  const title = company.name || params.slug;
  const description = company.description || `${title} on Screenplay Studio.`;

  const ogFallbackParams = new URLSearchParams({
    type:     'company',
    title,
    subtitle: description,
  });
  const fallbackOgImage = `/api/og?${ogFallbackParams.toString()}`;
  const ogImage = company.logo_url ?? fallbackOgImage;

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title: `${title} — Screenplay Studio`,
      description,
      url: `${BASE_URL}/p/${params.slug}`,
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

export default function CompanyPublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
