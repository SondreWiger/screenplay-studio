import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Get help with Screenplay Studio. Submit a ticket, browse FAQs, or contact our team for assistance.',
  openGraph: {
    title: 'Support — Screenplay Studio',
    description: 'Get help with Screenplay Studio. Submit a ticket or contact our team.',
    images: [{ url: '/api/og?title=Support&subtitle=Help+%26+Contact', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Support — Screenplay Studio',
    description: 'Get help with Screenplay Studio. Submit a ticket or contact our team.',
    images: ['/api/og?title=Support&subtitle=Help+%26+Contact'],
  },
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
