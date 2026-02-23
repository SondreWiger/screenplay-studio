import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const supabase = getSupabase();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, full_name, bio, avatar_url')
    .eq('username', params.username)
    .single();

  if (!profile) {
    return { title: 'User Not Found' };
  }

  const name = profile.full_name || profile.display_name || params.username;
  const description = profile.bio || `${name}'s profile on Screenplay Studio.`;

  return {
    title: name,
    description,
    openGraph: {
      type: 'profile',
      title: `${name} — Screenplay Studio`,
      description,
      url: `${BASE_URL}/u/${params.username}`,
      images: profile.avatar_url
        ? [{ url: profile.avatar_url, width: 400, height: 400, alt: name }]
        : [{ url: `/api/og?title=${encodeURIComponent(name)}&subtitle=Screenwriter`, width: 1200, height: 630 }],
    },
    twitter: {
      card: profile.avatar_url ? 'summary' : 'summary_large_image',
      title: `${name} — Screenplay Studio`,
      description,
      images: profile.avatar_url ? [profile.avatar_url] : [`/api/og?title=${encodeURIComponent(name)}&subtitle=Screenwriter`],
    },
  };
}

export default function UserProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
