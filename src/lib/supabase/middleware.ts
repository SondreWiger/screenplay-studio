import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// In-memory rate limiter
// Tracks request counts per IP per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 500; // 500 req/min for normal page loads
const RATE_LIMIT_AUTH_MAX = 100; // 100 auth requests per minute (page loads + attempts)
const RATE_LIMIT_AUTH_POST_MAX = 20; // 20 actual auth POST submissions per minute (login/register forms)
const RATE_LIMIT_API_MAX = 200; // 200 API calls per minute

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

// Known bot/scraper user agents to block
// AI training crawlers + aggressive data-harvesting scrapers
const BLOCKED_BOTS = [
  // OpenAI
  'gptbot', 'chatgpt-user', 'oai-searchbot',
  // Google AI
  'google-extended',
  // Common Crawl (used by many AI training pipelines)
  'ccbot', 'commoncrawl',
  // Anthropic
  'anthropic-ai', 'claude-web',
  // ByteDance / TikTok
  'bytespider',
  // Diffbot
  'diffbot',
  // Omgili
  'omgilibot',
  // Apple AI
  'applebot-extended',
  // Perplexity
  'perplexitybot',
  // You.com
  'youbot',
  // Amazon
  'amazonbot',
  // Cohere
  'cohere-ai',
  // Meta
  'meta-externalagent', 'facebookexternalhit/scraper',
  // AI2 (Allen Institute)
  'ai2bot',
  // Dataset harvesting
  'img2dataset',
  // xAI / Grok
  'grok', 'xai-bot',
  // DuckDuckGo AI assistant
  'duckassistbot',
  // Scrapy (generic scraping framework — no legit search crawler uses it)
  'scrapy',
  // Mistral AI
  'mistral-ai',
  // Turnitin AI detection harvester
  'turnitin',
  // News aggregators that train AI
  'newsgardbot',
  // PetalBot
  'petalbot',
];


// ── Moderation check cache ─────────────────────────────────────
// Ban, suspension and role checks cost up to four database round trips. Their
// result is cached for a few minutes in an HMAC-signed cookie bound to the
// user and IP, so ordinary navigation (and every prefetch) skips them. The
// signature means a banned user can't forge the cookie to get past the check.
const MOD_COOKIE = 'ss-mod';
const MOD_TTL_MS = 5 * 60_000;
const MOD_SECRET = process.env.MIDDLEWARE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let hmacKey: Promise<CryptoKey> | null = null;
function getHmacKey() {
  if (!hmacKey) {
    hmacKey = crypto.subtle.importKey(
      'raw', new TextEncoder().encode(MOD_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
  }
  return hmacKey;
}

async function sign(payload: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await getHmacKey(), new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...Array.from(new Uint8Array(sig)))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c] as string));
}

/** Returns the cached role if a valid, unexpired check exists for this user+IP. */
async function readModCache(value: string | undefined, userId: string, ip: string): Promise<string | null> {
  if (!MOD_SECRET || !value) return null;
  const parts = value.split('.');
  if (parts.length !== 5) return null;
  const [uid, ipHash, exp, role, sig] = parts;
  if (uid !== userId || Number(exp) < Date.now()) return null;
  if (ipHash !== (await sign(ip)).slice(0, 16)) return null;
  if (sig !== (await sign(`${uid}.${ipHash}.${exp}.${role}`))) return null;
  return role;
}

async function writeModCache(userId: string, ip: string, role: string): Promise<string | null> {
  if (!MOD_SECRET) return null;
  const ipHash = (await sign(ip)).slice(0, 16);
  const body = `${userId}.${ipHash}.${Date.now() + MOD_TTL_MS}.${role || 'user'}`;
  return `${body}.${await sign(body)}`;
}

export async function updateSession(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') || 'unknown';
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const pathname = request.nextUrl.pathname;

  // Block known AI scraper bots
  if (BLOCKED_BOTS.some(bot => ua.includes(bot))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Block empty / suspiciously short user agents
  // Legitimate browsers always have a non-trivial UA string.
  if (!ua || ua.length < 10) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Rate limiting — skip entirely for local/Electron requests
  // All requests from the embedded Next.js server come from localhost
  const isLocalRequest = ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

  if (!isLocalRequest) {
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
      return new NextResponse(JSON.stringify({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateResult.resetAt),
        },
      });
    }

    // Separate, tighter limit for actual auth form submissions (POST only)
    // This catches brute-force login attempts while allowing page navigation
    if (pathname.startsWith('/auth/') && request.method === 'POST') {
      const postKey = `auth-post:${ip}`;
      const postResult = checkRateLimit(postKey, RATE_LIMIT_AUTH_POST_MAX);
      if (!postResult.allowed) {
        const retryAfter = Math.ceil((postResult.resetAt - Date.now()) / 1000);
        return new NextResponse(JSON.stringify({
          error: 'Too Many Requests',
          message: `Too many login attempts. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(RATE_LIMIT_AUTH_POST_MAX),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(postResult.resetAt),
          },
        });
      }
    }
  }
  let supabaseResponse = NextResponse.next({ request });

  // ── Local mode bypass ───────────────────────────────────────
  // Check the cookie BEFORE creating a Supabase client so we skip
  // the getUser() roundtrip entirely in Electron / local mode.
  const isLocalMode = request.cookies.get('ss-local-mode')?.value === '1';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any = null;
  let user: { id: string } | null = null;
  let authTimedOut = false;
  // Profile role, known either from the signed cache or the moderation check
  let userRole: string | null = null;
  let modCacheValue: string | null = null;

  if (!isLocalMode) {
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
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

    // Wrap getUser() with a 3s timeout so the middleware doesn't hang when offline.
    // If the network is unavailable, we treat the user as unauthenticated
    // but allow the page to render (client-side auth will handle it).
    try {
      const getUserPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('getUser timeout')), 3000)
      );
      const {
        data: { user: authUser },
      } = await Promise.race([getUserPromise, timeoutPromise]);
      user = authUser;
    } catch {
      // Network timeout or error — proceed without auth.
      // Client-side auth (useAuth) will handle offline restoration.
      user = null;
      authTimedOut = true;
    }

    // Ban / IP ban enforcement
    const enforcementExemptPaths = ['/banned', '/suspended', '/auth/', '/api/auth/', '/_next/', '/favicon.ico'];
    const isEnforcementExempt = enforcementExemptPaths.some(p => pathname.startsWith(p));

    const cachedRole = user
      ? await readModCache(request.cookies.get(MOD_COOKIE)?.value, user.id, ip)
      : null;
    if (cachedRole) userRole = cachedRole;

    if (!isEnforcementExempt && !authTimedOut && !cachedRole) {
      // Independent lookups — run them together rather than one after another.
      const [{ data: ipBan }, profileRes] = await Promise.all([
        supabase
          .from('banned_ips')
          .select('id, reason')
          .eq('ip_address', ip)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle(),
        user
          ? supabase
              .from('profiles')
              .select('role, moderation_status, moderation_notes, last_known_ip')
              .eq('id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (ipBan) {
        const url = request.nextUrl.clone();
        url.pathname = '/banned';
        url.searchParams.set('reason', ipBan.reason || 'IP address banned');
        url.searchParams.set('ip', '1');
        return redirectWithCookies(url);
      }

      const profile = profileRes.data as {
        role?: string; moderation_status?: string; moderation_notes?: string; last_known_ip?: string;
      } | null;

      if (user && profile) {
        userRole = profile.role || 'user';

        if (profile.last_known_ip !== ip) {
          supabase.from('profiles').update({ last_known_ip: ip }).eq('id', user.id).then(() => {});
        }

        if (profile.moderation_status === 'banned') {
          const url = request.nextUrl.clone();
          url.pathname = '/banned';
          url.searchParams.set('reason', profile.moderation_notes || 'Account banned');
          return redirectWithCookies(url);
        }

        let clean = true;
        if (profile.moderation_status === 'suspended') {
          const { data: activeSuspension } = await supabase
            .from('user_bans')
            .select('expires_at')
            .eq('user_id', user.id)
            .eq('ban_type', 'temporary')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activeSuspension?.expires_at && new Date(activeSuspension.expires_at) < new Date()) {
            await supabase.from('user_bans')
              .update({ is_active: false })
              .eq('user_id', user.id)
              .eq('ban_type', 'temporary')
              .eq('is_active', true);
            await supabase.from('profiles')
              .update({ moderation_status: 'clean', moderation_notes: 'Suspension expired' })
              .eq('id', user.id);
          } else {
            clean = false;
            const url = request.nextUrl.clone();
            url.pathname = '/suspended';
            url.searchParams.set('reason', profile.moderation_notes || 'Account suspended');
            if (activeSuspension?.expires_at) {
              url.searchParams.set('expires', activeSuspension.expires_at);
            }
            return redirectWithCookies(url);
          }
        }

        if (clean) modCacheValue = await writeModCache(user.id, ip, userRole);
      }
    }

    // Update last_seen for authenticated users
    if (user) {
      const activityExemptPaths = ['/_next/', '/favicon.ico', '/robots.txt', '/sitemap', '/api/health'];
      const isActivityExempt = activityExemptPaths.some(p => pathname.startsWith(p));
      
      if (!isActivityExempt) {
        const now = Date.now();
        const lastUpdateKey = `last_seen_update:${user.id}`;
        const lastUpdate = rateLimitMap.get(lastUpdateKey);

        if (!lastUpdate || now - lastUpdate.resetAt > 300_000) {
          supabase.from('profiles')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', user.id)
            .then(() => {});
          
          rateLimitMap.set(lastUpdateKey, { count: 1, resetAt: now });
        }
      }
    }
  }

  // Security headers (including the single CSP) live in next.config.js.

  if (modCacheValue) {
    supabaseResponse.cookies.set(MOD_COOKIE, modCacheValue, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MOD_TTL_MS / 1000,
    });
  }

  // Rate limit headers (only when rate limiting was applied)
  // maxRequests and rateResult are set inside the !isLocalRequest block above

  // Helper: create a redirect that preserves any refreshed auth cookies
  function redirectWithCookies(url: URL) {
    const redirectResponse = NextResponse.redirect(url);
    // Copy refreshed auth cookies from supabaseResponse so tokens aren't lost
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Protected routes
  // /dev/features is intentionally public; /dev/stats and /dev/test require login
  const protectedPaths = ['/dashboard', '/projects', '/people', '/admin', '/company', '/notifications', '/settings', '/onboarding', '/messages', '/translations', '/dev/stats', '/dev/test'];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !user && !isLocalMode && !authTimedOut) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return redirectWithCookies(url);
  }

  // Admin / Mod panel route — allow admin UID, admins, and moderators (skip in local mode)
  if (request.nextUrl.pathname.startsWith('/admin') && user && !isLocalMode) {
    const ADMIN_UID = process.env.ADMIN_UID || '';
    if (!ADMIN_UID || user.id !== ADMIN_UID) {
      // Role is usually already known from the moderation check or its cache
      let role = userRole;
      if (!role) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        role = profile?.role;
      }
      if (role !== 'admin' && role !== 'moderator') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return redirectWithCookies(url);
      }
    }
  } else if (request.nextUrl.pathname.startsWith('/admin') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return redirectWithCookies(url);
  }

  // Redirect logged-in users away from auth pages
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
    return redirectWithCookies(url);
  }

  return supabaseResponse;
}
