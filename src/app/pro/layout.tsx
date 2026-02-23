import { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

export const metadata: Metadata = {
  title: 'Pro — Screenplay Studio',
  description: 'Unlock AI Script Analysis, Client Review, Export, Custom Branding, Casting Tools, and more. Upgrade a single project or go Pro platform-wide.',
  openGraph: {
    type: 'website',
    title: 'Go Pro — Screenplay Studio',
    description: 'Unlock AI Script Analysis, Client Review, Export, Custom Branding, Casting Tools, and more.',
    url: `${BASE_URL}/pro`,
    siteName: 'Screenplay Studio',
    images: [{ url: '/api/og?title=Go+Pro&subtitle=Unlock+AI+Analysis+Export+and+more', width: 1200, height: 630, alt: 'Screenplay Studio Pro' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Go Pro — Screenplay Studio',
    description: 'Unlock AI Script Analysis, Client Review, Export, Custom Branding, Casting Tools, and more.',
    images: ['/api/og?title=Go+Pro&subtitle=Unlock+AI+Analysis+Export+and+more'],
  },
};

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return children;
}
