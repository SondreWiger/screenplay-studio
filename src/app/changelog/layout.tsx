import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Changelog — Screenplay Studio',
  description:
    'Every feature, fix, and improvement shipped to Screenplay Studio — a full version history of the platform.',
  openGraph: {
    title: 'Changelog — Screenplay Studio',
    description: 'Every feature, fix, and improvement shipped to Screenplay Studio.',
    url: 'https://screenplaystudio.fun/changelog',
    siteName: 'Screenplay Studio',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Changelog — Screenplay Studio',
    description: 'Every feature, fix, and improvement shipped to Screenplay Studio.',
  },
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
