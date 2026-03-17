import { Metadata } from 'next';

const ogImage = `/api/og?${new URLSearchParams({
  type:     'roadmap',
  title:    'Feedback & Roadmap',
  subtitle: 'Report bugs, request features, and track what\'s being built.',
}).toString()}`;

export const metadata: Metadata = {
  title: 'Feedback & Roadmap — Screenplay Studio',
  description: 'Report bugs, request features, and follow what the Screenplay Studio team is building.',
  openGraph: {
    type: 'website',
    title: 'Feedback & Roadmap — Screenplay Studio',
    description: 'Report bugs, request features, and track what\'s being built.',
    url: 'https://screenplaystudio.fun/feedback',
    siteName: 'Screenplay Studio',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Screenplay Studio Feedback' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Feedback & Roadmap — Screenplay Studio',
    description: 'Report bugs, request features, and track what\'s being built.',
    images: [ogImage],
  },
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
