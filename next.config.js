/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Strip console.* in production builds ─────────────────
  // (Turbopack used in dev doesn't support this key — guard it)
  ...(process.env.NODE_ENV === 'production' ? {
    compiler: {
      removeConsole: { exclude: ['error', 'warn'] },
    },
  } : {}),

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/**',
      },
    ],
    // Serve modern formats first
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images for 7 days at the CDN/browser
    minimumCacheTTL: 604800,
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Tree-shake icon/utility libraries — biggest single bundle win
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'sonner',
    ],
  },

  async headers() {
    return [
      {
        // ── Security headers for every route ───────────────
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          // Blanket AI training opt-out on every page
          { key: 'X-Robots-Tag', value: 'noai, noimageai' },
        ],
      },
      {
        // ── Immutable cache for hashed Next.js static assets ─
        // _next/static chunks have content-hashed names — safe to cache forever
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // ── Optimized images served by Next.js image pipeline ─
        source: '/_next/image',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
          { key: 'Vary', value: 'Accept' },
        ],
      },
      {
        // ── Public static files (SVG, icons, manifests, etc.) ─
        source: '/:path*\\.(svg|png|jpg|jpeg|gif|webp|avif|ico|woff2|woff|ttf|otf)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
      {
        // Colorbar — allow iframe embedding for broadcast tools
        source: '/colorbar',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        // ── No caching for API routes (except RSS) ──────────
        source: '/api/((?!rss).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        // RSS — cacheable and freely fetchable by feed readers
        source: '/api/rss',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=1800' },
        ],
      },
      {
        // Community content — extra AI blocking signal
        source: '/community/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noai, noimageai' },
        ],
      },
      {
        // Share pages — no indexing + no AI
        source: '/share/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, noai, noimageai' },
        ],
      },
      {
        // User profile pages — no AI training
        source: '/u/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noai, noimageai' },
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
