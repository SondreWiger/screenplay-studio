import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Paths that are entirely public — skip session refresh to avoid
// an unnecessary Supabase roundtrip for unauthenticated visitors.
const PUBLIC_PREFIXES = [
  '/about', '/blog', '/legal', '/changelog', '/press', '/testimonials',
  '/feedback', '/contribute', '/licenses', '/sitemap-visual', '/compare',
  '/translations', '/tutorials', '/quotes', '/api/rss', '/api/og', '/mcp/',
];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  // MCP clients authenticate with a bearer token, carry no cookies and often a
  // short user agent the bot filter would reject. The route does its own auth
  // and rate limiting. (/api/mcp/tokens is a normal cookie-session route.)
  if (pathname === '/api/mcp') return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/rss|feed\\.xml|feed$|rss\\.xml|rss$|ref/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
