import type { Metadata, Viewport } from 'next';
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

const BASE_URL = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

export const viewport: Viewport = {
  themeColor: '#070710',
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const oss = await isOpenSourceEnabled();
  const titleDefault = oss
    ? 'Screenplay Studio — Open-source screenwriting suite'
    : 'Screenplay Studio — Professional screenwriting suite';
  const desc = oss
    ? 'Write screenplays, plan productions, and collaborate with your team. Free & open-source.'
    : 'Write screenplays, plan productions, and collaborate with your team.';

  return {
    metadataBase: new URL(BASE_URL()),
    title: {
      default: titleDefault,
      template: '%s | Screenplay Studio',
    },
    description: 'Write screenplays, plan productions, and collaborate with your team. Script editor, scene breakdowns, shot lists, scheduling, budget tracking, and more.',
    keywords: ['screenplay', 'screenwriting', 'film production', 'script writing', 'screenplay studio', 'script editor', 'screenwriting software', 'film pre-production', 'script breakdown', 'shot list', 'collaborative screenwriting'],
    alternates: {
      canonical: BASE_URL(),
      languages: {
        en: BASE_URL(),
      },
      types: {
        'application/rss+xml': '/api/rss',
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Screenplay Studio',
      title: titleDefault,
      description: desc,
      url: BASE_URL(),
      locale: 'en_US',
      images: [{ url: `/api/og?subtitle=${encodeURIComponent(oss ? 'Open-source screenwriting suite' : 'Professional screenwriting suite')}`, width: 1200, height: 630, alt: 'Screenplay Studio' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: titleDefault,
      description: desc,
      images: [`/api/og?subtitle=${encodeURIComponent(oss ? 'Open-source screenwriting suite' : 'Professional screenwriting suite')}`],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const baseUrl = BASE_URL();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: 'Screenplay Studio',
        url: baseUrl,
        logo: `${baseUrl}/icon`,
        description: 'Professional screenwriting software for writers, filmmakers, and production teams.',
        foundingDate: '2024',
        founder: { name: 'Sondre' },
        sameAs: [
          'https://github.com/anomalyco/screenplay-studio',
          'https://x.com/screenplay_studio',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        url: baseUrl,
        name: 'Screenplay Studio',
        description: 'Write screenplays, plan productions, and collaborate with your team.',
        publisher: { '@id': `${baseUrl}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${baseUrl}/?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${baseUrl}/#software`,
        name: 'Screenplay Studio',
        applicationCategory: 'Multimedia',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
    ],
  };

  return (
    <html lang="en" className={`dark ${inter.variable} ${courierPrime.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SS Studio" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://va.vercel-scripts.com" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="dns-prefetch" href="https://*.supabase.co" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-surface-950">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-600 focus:text-white focus:focus:rounded-lg focus:text-sm">Skip to content</a>
        <Providers><main id="main-content">{children}</main></Providers>
        <CookieConsentBanner />
        <Analytics />
      </body>
    </html>
  );
}
