import { createBrowserClient } from '@supabase/ssr';
import { isLocalMode, createLocalSupabaseClient } from './electron-client';

/**
 * Offline-aware fetch wrapper for the Supabase client.
 *
 * When offline, blocks token refresh requests (grant_type=refresh_token) and
 * other auth requests to prevent the client from firing SIGNED_OUT events
 * that would destroy the user state.  The session cookies are still valid —
 * we just can't verify them right now.
 */
function offlineSafeFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Only intercept when offline
  if (navigator.onLine) {
    return fetch(url, init);
  }

  const urlString = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;

  // Block Supabase auth token refresh / verify requests when offline
  if (
    urlString.includes('/auth/v1/token') ||
    urlString.includes('/auth/v1/verify')
  ) {
    // Return a minimal "session still valid" response so the Supabase client
    // doesn't fire SIGNED_OUT.  The user object is empty which is fine —
    // useAuth already handles the offline case via navigator.onLine.
    return Promise.resolve(
      new Response(
        JSON.stringify({
          access_token: '',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: '',
          user: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }

  // For all other requests when offline, let them fail naturally
  return fetch(url, init);
}

// Singleton — avoid creating multiple Supabase clients (each one spawns its
// own token-refresh interval, which compounds the offline problem).
let sharedClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (isLocalMode()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createLocalSupabaseClient() as any;
  }

  if (!sharedClient) {
    sharedClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          fetch: offlineSafeFetch,
        },
      }
    );
  }
  return sharedClient;
}
