import type { Metadata } from 'next';
import { Providers } from './providers';
import { CookieConsentBanner } from '@/components/CookieConsent';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun'),
  title: {
    default: 'Screenplay Studio — Open-source screenwriting suite',
    template: '%s | Screenplay Studio',
  },
  description: 'Write screenplays, plan productions, and collaborate with your team. Script editor, scene breakdowns, shot lists, scheduling, budget tracking, and more.',
  keywords: ['screenplay', 'screenwriting', 'film production', 'script writing', 'collaboration'],
  openGraph: {
    type: 'website',
    siteName: 'Screenplay Studio',
    title: 'Screenplay Studio — Open-source screenwriting suite',
    description: 'Write screenplays, plan productions, and collaborate with your team. Free & open-source.',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Screenplay Studio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Screenplay Studio — Open-source screenwriting suite',
    description: 'Write screenplays, plan productions, and collaborate with your team. Free & open-source.',
    images: ['/api/og'],
  },
  alternates: {
    types: {
      'application/rss+xml': '/api/rss',
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface-950">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#E54E15] focus:text-white focus:rounded-lg focus:text-sm">Skip to content</a>
        <Providers><main id="main-content">{children}</main></Providers>
        <CookieConsentBanner />
      </body>
    </html>
  );
}
