import type { Metadata } from 'next';
import { Inter, Courier_Prime } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from './providers';
import { CookieConsentBanner } from '@/components/CookieConsent';
import { isOpenSourceEnabled } from '@/lib/site-settings';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const courierPrime = Courier_Prime({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-courier-prime',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const oss = await isOpenSourceEnabled();
  const titleDefault = oss
    ? 'Screenplay Studio — Open-source screenwriting suite'
    : 'Screenplay Studio — Professional screenwriting suite';
  const desc = oss
    ? 'Write screenplays, plan productions, and collaborate with your team. Free & open-source.'
    : 'Write screenplays, plan productions, and collaborate with your team.';
  const ogSubtitle = oss ? 'Open-source screenwriting suite' : 'Professional screenwriting suite';

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun'),
    title: {
      default: titleDefault,
      template: '%s | Screenplay Studio',
    },
    description: 'Write screenplays, plan productions, and collaborate with your team. Script editor, scene breakdowns, shot lists, scheduling, budget tracking, and more.',
    keywords: ['screenplay', 'screenwriting', 'film production', 'script writing', 'collaboration'],
    openGraph: {
      type: 'website',
      siteName: 'Screenplay Studio',
      title: titleDefault,
      description: desc,
      images: [{ url: `/api/og?subtitle=${encodeURIComponent(ogSubtitle)}`, width: 1200, height: 630, alt: 'Screenplay Studio' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: titleDefault,
      description: desc,
      images: [`/api/og?subtitle=${encodeURIComponent(ogSubtitle)}`],
    },
    alternates: {
      types: {
        'application/rss+xml': '/api/rss',
      },
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${courierPrime.variable}`}>
      <body className="min-h-screen bg-surface-950">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#E54E15] focus:text-white focus:rounded-lg focus:text-sm">Skip to content</a>
        <Providers><main id="main-content">{children}</main></Providers>
        <CookieConsentBanner />
        <Analytics />
      </body>
    </html>
  );
}
