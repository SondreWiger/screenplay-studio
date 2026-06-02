import { Metadata } from 'next';

const BASE_URL = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

const _ogChangelog = `/api/og?${new URLSearchParams({
  type:     'changelog',
  title:    'Changelog',
  subtitle: 'Every feature, fix, and improvement shipped to Screenplay Studio.',
}).toString()}`;

export const metadata: Metadata = {
  title: 'Changelog — Screenplay Studio',
  description: 'Every feature, fix, and improvement shipped to Screenplay Studio — a full version history of the platform.',
  openGraph: {
    type: 'website',
    title: 'Changelog — Screenplay Studio',
    description: 'Every feature, fix, and improvement shipped to Screenplay Studio.',
    url: `${BASE_URL()}/changelog`,
    siteName: 'Screenplay Studio',
    images: [{ url: _ogChangelog, width: 1200, height: 630, alt: 'Screenplay Studio Changelog' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Changelog — Screenplay Studio',
    description: 'Every feature, fix, and improvement shipped to Screenplay Studio.',
    images: [_ogChangelog],
  },
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
