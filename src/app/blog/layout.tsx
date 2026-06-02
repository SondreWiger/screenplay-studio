import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog — Screenplay Studio',
  description: 'News, updates, and behind-the-scenes from the Screenplay Studio team.',
  openGraph: {
    title: 'Blog — Screenplay Studio',
    description: 'News, updates, and behind-the-scenes from the Screenplay Studio team.',
    type: 'article',
    images: [{ url: '/api/og?type=blog&title=Screenplay+Studio+Blog&subtitle=News+%26+updates', width: 1200, height: 630, alt: 'Screenplay Studio Blog' }],
  },
  twitter: {
    title: 'Blog — Screenplay Studio',
    description: 'News, updates, and behind-the-scenes from the Screenplay Studio team.',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
