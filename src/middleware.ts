import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Paths that are entirely public — skip session refresh to avoid
// an unnecessary Supabase roundtrip for unauthenticated visitors.
const PUBLIC_PREFIXES = [
  '/about', '/blog', '/legal', '/changelog', '/press', '/testimonials',
  '/feedback', '/contribute', '/licenses', '/sitemap-visual', '/compare',
  '/translations', '/tutorials', '/quotes', '/api/rss', '/api/og',
];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
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
