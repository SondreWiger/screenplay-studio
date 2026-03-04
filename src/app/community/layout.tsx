import { Metadata } from 'next';
import { SupportButton } from '@/components/SupportButton';
import { CommunityNav } from '@/components/CommunityNav';

export const metadata: Metadata = {
  title: 'Community — Screenplay Studio',
  description: 'Share scripts, get feedback, join writing challenges, and discover free-to-use screenplays.',
  openGraph: {
    type: 'website',
    title: 'Community — Screenplay Studio',
    description: 'Share scripts, get feedback, join writing challenges, and discover free-to-use screenplays.',
    images: [{ url: '/api/og?title=Community&subtitle=Share+scripts+and+collaborate', width: 1200, height: 630, alt: 'Screenplay Studio Community' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Community — Screenplay Studio',
    description: 'Share scripts, get feedback, join writing challenges, and discover free-to-use screenplays.',
    images: ['/api/og?title=Community&subtitle=Share+scripts+and+collaborate'],
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
