import { createBrowserClient } from '@supabase/ssr';
import { isLocalMode, createLocalSupabaseClient } from './electron-client';

/**
 * Offline-aware fetch wrapper for the Supabase client.
 *
 * When offline, auth refresh/verify requests fail fast with a network error.
 * supabase-js treats network errors as retryable and keeps the existing
 * session, whereas any HTTP response (even a fake "OK") would be stored as the
 * new session. The previous shim returned an empty access token here, which
 * could overwrite a valid session and sign the user out once back online.
 */
function offlineSafeFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (navigator.onLine) {
    return fetch(url, init);
  }

  const urlString = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
  if (urlString.includes('/auth/v1/token') || urlString.includes('/auth/v1/verify')) {
    return Promise.reject(new TypeError('Failed to fetch (offline)'));
  }

  return fetch(url, init);
}

// Singleton — avoid creating multiple Supabase clients (each one spawns its
// own token-refresh interval, which compounds the offline problem).
type BrowserClient = ReturnType<typeof createBrowserClient>;
let sharedClient: BrowserClient | null = null;

export function createClient(): BrowserClient {
  if (isLocalMode()) {
    // The local (IndexedDB-backed) client mimics the Supabase query API. Typing
    // it as the real client keeps inference working at every call site —
    // returning `any` here made callback parameters implicitly `any` app-wide.
    return createLocalSupabaseClient() as unknown as BrowserClient;
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
