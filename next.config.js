/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
      {
        // Prevent caching of API routes (except RSS feed)
        source: '/api/((?!rss).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        // RSS feed — allow caching and cross-origin access for bots
        source: '/api/rss',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600' },
        ],
      },
      {
        // Add anti-AI scraping meta to public content pages
        source: '/community/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noai, noimageai' },
        ],
      },
      {
        // Prevent script content from being indexed by AI
        source: '/share/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, noai, noimageai' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Standard feed URL aliases
      { source: '/feed.xml', destination: '/api/rss' },
      { source: '/feed', destination: '/api/rss' },
      { source: '/rss', destination: '/api/rss' },
      { source: '/rss.xml', destination: '/api/rss' },
    ];
  },
  async redirects() {
    return [
      // Redirect old legal pages to new legal hub
      { source: '/terms', destination: '/legal/terms', permanent: true },
      { source: '/privacy', destination: '/legal/privacy', permanent: true },
      { source: '/content-policy', destination: '/legal/content-policy', permanent: true },
      { source: '/community-guidelines', destination: '/legal/community-guidelines', permanent: true },
      { source: '/acceptable-use', destination: '/legal/acceptable-use', permanent: true },
    ];
  },
  poweredByHeader: false, // Remove X-Powered-By header
};

module.exports = nextConfig;
