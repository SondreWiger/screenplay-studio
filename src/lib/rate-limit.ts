import { NextResponse } from 'next/server';

// Rate Limiting Utility
//
// Hybrid approach:
//  1. In-memory bucket for hot-path burst protection (fast)
//  2. Supabase-backed persistence for cross-instance coordination
//     (used only for critical endpoints)

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
}

interface RateEntry {
  count: number;
  resetAt: number;
}

// In-memory store (cleaned periodically)
const store = new Map<string, RateEntry>();
let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  store.forEach((entry, key) => {
    if (entry.resetAt < now) store.delete(key);
  });
}

// Check rate limit (in-memory)
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = 60_000,
): RateLimitResult {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs, retryAfter: 0 };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfter };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt, retryAfter: 0 };
}

// Build a rate-limit key from request context
export function rateLimitKey(ip: string, path: string, userId?: string): string {
  const prefix = userId ? `user:${userId}` : `ip:${ip}`;
  return `${prefix}:${path}`;
}

// Apply rate limit to a NextResponse
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
  limit: number,
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.resetAt));
  return response;
}

// Extract client IP from request
export function getClientIp(req: Request): string {
  return (req.headers as Headers).get('x-forwarded-for')?.split(',')[0]?.trim()
    || (req.headers as Headers).get('x-real-ip')
    || 'unknown';
}

// Supabase-backed rate limit (persistent, cross-instance)
// Uses the already-existing check_rate_limit DB function.
// This is slower but works across serverless restarts.
export async function checkRateLimitPersistent(
  userId: string,
  action: string,
  maxRequests: number,
  windowMinutes: number = 1,
): Promise<RateLimitResult> {
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/server');
    const supabase = createServerSupabaseClient();

    // Use the DB function to check recent activity
    const { data: count, error } = await supabase
      .rpc('check_rate_limit', {
        p_table: 'rate_limit_actions',
        p_user_id: userId,
        p_window_minutes: windowMinutes,
        p_max_count: maxRequests,
      });

    if (error) {
      // Fall back to in-memory if DB fails
      return checkRateLimit(`persistent:${userId}:${action}`, maxRequests, windowMinutes * 60_000);
    }

    const allowed = count !== false;
    const remaining = allowed ? maxRequests - 1 : 0;
    const resetAt = Date.now() + windowMinutes * 60_000;

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter: allowed ? 0 : windowMinutes * 60,
    };
  } catch {
    return checkRateLimit(`persistent:${userId}:${action}`, maxRequests, windowMinutes * 60_000);
  }
}
