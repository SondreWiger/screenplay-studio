import type { Metadata } from 'next';
import { Providers } from './providers';
import { CookieConsentBanner } from '@/components/CookieConsent';
import './globals.css';

export const metadata: Metadata = {
  title: 'Screenplay Studio — Professional Film Production Suite',
  description: 'Write, collaborate, plan and produce your film with industry-standard screenplay tools. Multi-user editing, scene breakdowns, shot lists, scheduling, and more.',
  keywords: ['screenplay', 'screenwriting', 'film production', 'script writing', 'collaboration'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface-950">
        <Providers>{children}</Providers>
        <CookieConsentBanner />
      </body>
    </html>
  );
}
