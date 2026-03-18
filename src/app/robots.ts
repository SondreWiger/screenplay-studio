import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/community/',
          '/legal/',
          '/pro',
          '/support',
          '/blog/',
          '/sitemap-visual',
          '/about',
          '/press',
          '/testimonials',
          '/licenses',
          '/contribute',
          '/feedback',
          '/changelog',
          '/u/',
        ],
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
          '/idea-boards',
          '/accountability',
          '/casting',
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
      // xAI / Grok
      {
        userAgent: 'Grok',
        disallow: ['/'],
      },
      {
        userAgent: 'xAI-Bot',
        disallow: ['/'],
      },
      // DuckDuckGo AI assistant
      {
        userAgent: 'DuckAssistBot',
        disallow: ['/'],
      },
      // AI2 (Allen Institute for AI)
      {
        userAgent: 'Ai2Bot',
        disallow: ['/'],
      },
      // Dataset collectors
      {
        userAgent: 'img2dataset',
        disallow: ['/'],
      },
      {
        userAgent: 'CommonCrawl',
        disallow: ['/'],
      },
      // Mistral AI
      {
        userAgent: 'Mistral-AI',
        disallow: ['/'],
      },
      // PetalBot
      {
        userAgent: 'PetalBot',
        disallow: ['/'],
      },
      // Scrapy (generic scraping framework)
      {
        userAgent: 'Scrapy',
        disallow: ['/'],
      },
      // OAI SearchBot (OpenAI search)
      {
        userAgent: 'OAI-SearchBot',
        disallow: ['/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
