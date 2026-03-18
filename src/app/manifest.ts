import type { MetadataRoute } from 'next';
import { isOpenSourceEnabled } from '@/lib/site-settings';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const oss = await isOpenSourceEnabled();
  return {
    name: 'Screenplay Studio',
    short_name: 'Screenplay',
    description: oss
      ? 'Open-source screenwriting suite — write, plan, produce, and collaborate.'
      : 'Professional screenwriting suite — write, plan, produce, and collaborate.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#7c3aed',
    orientation: 'any',
    // Enables offline storage & background sync signals to the browser
    prefer_related_applications: false,
    icons: [
      { src: '/icon',     sizes: '32x32',   type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
      { src: '/icon-192', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['productivity', 'entertainment', 'utilities'],
    screenshots: [],
  };
}
