import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ── In-memory rate limiter ──────────────────────────────────
// Tracks request counts per IP per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 120; // 120 req/min for normal users
const RATE_LIMIT_AUTH_MAX = 10; // 10 auth attempts per minute
const RATE_LIMIT_API_MAX = 60; // 60 API calls per minute

interface RateEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateEntry>();

// Clean up stale entries every 5 minutes
let lastCleanup = Date.now();
function cleanupRateLimits() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const key of Array.from(rateLimitMap.keys())) {
    const entry = rateLimitMap.get(key);
    if (entry && entry.resetAt < now) rateLimitMap.delete(key);
  }
}

function checkRateLimit(key: string, max: number): { allowed: boolean; remaining: number; resetAt: number } {
  cleanupRateLimits();
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: max - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  entry.count++;
  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

// ── Known bot user agents to block ──────────────────────────
const BLOCKED_BOTS = [
  'gptbot', 'chatgpt-user', 'google-extended', 'ccbot', 'anthropic-ai',
  'claude-web', 'bytespider', 'diffbot', 'omgilibot', 'applebot-extended',
  'perplexitybot', 'youbot', 'amazonbot', 'cohere-ai', 'meta-externalagent',
  'ai2bot', 'img2dataset', 'commoncrawl',
];

export async function updateSession(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') || 'unknown';
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const pathname = request.nextUrl.pathname;

  // ── Block known AI scraper bots ───────────────────────────
  if (BLOCKED_BOTS.some(bot => ua.includes(bot))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // ── Rate limiting ─────────────────────────────────────────
  let maxRequests = RATE_LIMIT_MAX_REQUESTS;
  let limitKey = `general:${ip}`;

  if (pathname.startsWith('/auth/')) {
    maxRequests = RATE_LIMIT_AUTH_MAX;
    limitKey = `auth:${ip}`;
  } else if (pathname.startsWith('/api/')) {
    maxRequests = RATE_LIMIT_API_MAX;
    limitKey = `api:${ip}`;
  }

  const rateResult = checkRateLimit(limitKey, maxRequests);
  if (!rateResult.allowed) {
    const retryAfter = Math.ceil((rateResult.resetAt - Date.now()) / 1000);
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(rateResult.resetAt),
      },
    });
  }
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Security headers ──────────────────────────────────────
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
  supabaseResponse.headers.set('X-Frame-Options', 'DENY');
  supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block');
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  supabaseResponse.headers.set('X-DNS-Prefetch-Control', 'on');
  supabaseResponse.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  supabaseResponse.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.paypal.com https://www.paypalobjects.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com https://api-m.paypal.com https://api-m.sandbox.paypal.com",
      "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.paypal.com https://www.sandbox.paypal.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ')
  );

  // ── Rate limit headers ────────────────────────────────────
  supabaseResponse.headers.set('X-RateLimit-Limit', String(maxRequests));
  supabaseResponse.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));

  // ── Protected routes ──────────────────────────────────────
  const protectedPaths = ['/dashboard', '/projects', '/admin', '/company', '/notifications', '/settings', '/onboarding'];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // ── Admin / Mod panel route — allow admin UID, admins, and moderators ──
  if (request.nextUrl.pathname.startsWith('/admin') && user) {
    const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';
    if (user.id !== ADMIN_UID) {
      // Fetch profile to check role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const role = profile?.role;
      if (role !== 'admin' && role !== 'moderator') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
    }
  } else if (request.nextUrl.pathname.startsWith('/admin') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // ── Redirect logged-in users away from auth pages ─────────
  const authPaths = ['/auth/login', '/auth/register'];
  const isAuthPage = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    const redirectTo = request.nextUrl.searchParams.get('redirect');
    // Only allow relative redirects — prevent open redirect attacks
    const safeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/dashboard';
    url.pathname = safeRedirect;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
