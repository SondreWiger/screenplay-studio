import { Metadata } from 'next';
import { SupportButton } from '@/components/SupportButton';
import { CommunityNav } from '@/components/CommunityNav';

const _ogCommunity = `/api/og?${new URLSearchParams({
  type:    'post',
  title:   'Community',
  subtitle: 'Share scripts, get feedback, join writing challenges, and discover free-to-use screenplays.',
}).toString()}`;

export const metadata: Metadata = {
  title: 'Community — Screenplay Studio',
  description: 'Share scripts, get feedback, join writing challenges, and discover free-to-use screenplays.',
  openGraph: {
    type: 'website',
    title: 'Community — Screenplay Studio',
    description: 'Share scripts, get feedback, join writing challenges, and discover free-to-use screenplays.',
    url: 'https://screenplaystudio.fun/community',
    siteName: 'Screenplay Studio',
    images: [{ url: _ogCommunity, width: 1200, height: 630, alt: 'Screenplay Studio Community' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Community — Screenplay Studio',
    description: 'Share scripts, get feedback, join writing challenges, and discover free-to-use screenplays.',
    images: [_ogCommunity],
  },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CommunityNav />
      {children}
      <SupportButton />
    </>
  );
}
