import { Metadata } from 'next';

const ogImage = `/api/og?${new URLSearchParams({
  type:     'testimonials',
  title:    'User Reviews',
  subtitle: 'Real screenwriters share their experience with Screenplay Studio.',
}).toString()}`;

export const metadata: Metadata = {
  title: 'Reviews — Screenplay Studio',
  description: 'Read real reviews and testimonials from screenwriters using Screenplay Studio. See what the community thinks.',
  openGraph: {
    type: 'website',
    title: 'User Reviews — Screenplay Studio',
    description: 'Real screenwriters share their experience with Screenplay Studio.',
    url: 'https://screenplaystudio.fun/testimonials',
    siteName: 'Screenplay Studio',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Screenplay Studio Reviews' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'User Reviews — Screenplay Studio',
    description: 'Real screenwriters share their experience with Screenplay Studio.',
    images: [ogImage],
  },
};

export default function TestimonialsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
