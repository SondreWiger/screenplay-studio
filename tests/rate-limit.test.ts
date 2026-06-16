import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit';

// Reset the internal store between tests by importing internals isn't possible,
// so we rely on unique keys per test.

describe('checkRateLimit', () => {
  it('allows first request', () => {
    const result = checkRateLimit('test-allow-first', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.retryAfter).toBe(0);
  });

  it('tracks remaining requests', () => {
    const key = 'test-remaining';
    checkRateLimit(key, 3, 60_000);
    checkRateLimit(key, 3, 60_000);
    const result = checkRateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('blocks when limit exceeded', () => {
    const key = 'test-blocked';
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    const result = checkRateLimit(key, 2, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('resets after window expires', () => {
    vi.useFakeTimers();
    const key = 'test-reset-window';
    const now = Date.now();
    vi.setSystemTime(now);

    checkRateLimit(key, 1, 1000);
    const blocked = checkRateLimit(key, 1, 1000);
    expect(blocked.allowed).toBe(false);

    vi.setSystemTime(now + 1001);
    const allowed = checkRateLimit(key, 1, 1000);
    expect(allowed.allowed).toBe(true);

    vi.useRealTimers();
  });

  it('uses default 60s window', () => {
    const result = checkRateLimit('test-default-window', 5);
    expect(result.allowed).toBe(true);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});

describe('rateLimitKey', () => {
  it('builds IP-based key', () => {
    expect(rateLimitKey('1.2.3.4', '/api/test')).toBe('ip:1.2.3.4:/api/test');
  });

  it('builds user-based key when userId provided', () => {
    expect(rateLimitKey('1.2.3.4', '/api/test', 'user-123')).toBe('user:user-123:/api/test');
  });
});
