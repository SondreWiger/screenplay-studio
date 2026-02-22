import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/community/', '/legal/', '/pro', '/support', '/trailer'],
        disallow: [
          '/api/',
          '/dashboard',
          '/projects/',
          '/settings',
          '/admin',
          '/onboarding',
          '/messages',
          '/notifications',
          '/auth/',
          '/share/',
          '/company/invite/',
        ],
      },
      // Block AI training crawlers from ALL content
      {
        userAgent: 'GPTBot',
        disallow: ['/'],
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: ['/'],
      },
      {
        userAgent: 'Google-Extended',
        disallow: ['/'],
      },
      {
        userAgent: 'CCBot',
        disallow: ['/'],
      },
      {
        userAgent: 'anthropic-ai',
        disallow: ['/'],
      },
      {
        userAgent: 'Claude-Web',
        disallow: ['/'],
      },
      {
        userAgent: 'Bytespider',
        disallow: ['/'],
      },
      {
        userAgent: 'Diffbot',
        disallow: ['/'],
      },
      {
        userAgent: 'FacebookBot',
        disallow: ['/'],
      },
      {
        userAgent: 'Omgilibot',
        disallow: ['/'],
      },
      {
        userAgent: 'Applebot-Extended',
        disallow: ['/'],
      },
      {
        userAgent: 'PerplexityBot',
        disallow: ['/'],
      },
      {
        userAgent: 'YouBot',
        disallow: ['/'],
      },
      {
        userAgent: 'Amazonbot',
        disallow: ['/'],
      },
      {
        userAgent: 'cohere-ai',
        disallow: ['/'],
      },
      {
        userAgent: 'Meta-ExternalAgent',
        disallow: ['/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
