import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog — Screenplay Studio',
  description: 'News, updates, and behind-the-scenes from the Screenplay Studio team.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
