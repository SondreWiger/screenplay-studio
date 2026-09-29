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
