import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Casting Call',
  description: 'View open roles and submit your application for this casting call on Screenplay Studio.',
  openGraph: {
    title: 'Casting Call — Screenplay Studio',
    description: 'View open roles and submit your application.',
    images: [{ url: '/api/og?title=Casting+Call&subtitle=Apply+for+a+role', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Casting Call — Screenplay Studio',
    description: 'View open roles and submit your application.',
    images: ['/api/og?title=Casting+Call&subtitle=Apply+for+a+role'],
  },
};

export default function CastingPublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
