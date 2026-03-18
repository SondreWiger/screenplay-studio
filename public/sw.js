// Screenplay Studio — Service Worker
// Handles: Push Notifications + Offline Caching (PWA)
//
// ⚠️  CACHE_VERSION — bump this string on any meaningful deploy that changes
//     cached pages or the SW logic itself. The browser byte-diffs sw.js on
//     every page load and will re-install if the file changed at all, but an
//     explicit version bump forces old caches to be purged even if the rest of
//     the SW logic is identical.

const CACHE_VERSION = 'ss-v4';   // bumped March 2026
const STATIC_CACHE   = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE  = `${CACHE_VERSION}-dynamic`;

// App-shell pages & assets that are pre-cached on install
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/offline',
];

// ── Install: pre-cache app shell ─────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: purge old caches ────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('ss-') && k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first with cache fallback ─────────────────────────────────
//
// Strategy:
//   • API calls (/api/*) and Supabase (supabase.co) → network-only (never cache)
//   • Navigation requests                          → network-first, fallback to cache, then /offline
//   • Static assets (_next/*, images, fonts, etc.) → cache-first
//   • Everything else                              → network-first, cache on success

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http requests (chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Never cache API calls or Supabase requests
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.in')
  ) {
    return; // let browser handle as-is
  }

  // Static asset cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|woff2?|ttf|otf|ico)$/)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation (page loads) → network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigate(request));
    return;
  }

  // Default: network-first
  event.respondWith(networkFirst(request));
});

// ── Strategies ───────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirstNavigate(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try matching from cache
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fall back to cached dashboard or root
    const fallback = await caches.match('/dashboard') || await caches.match('/');
    if (fallback) return fallback;
    // Last resort — build a minimal offline page inline
    return new Response(
      `<!doctype html><html lang="en"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Offline — Screenplay Studio</title>
      <style>
        body{font-family:system-ui,sans-serif;background:#0a0a0f;color:#e5e7eb;
          display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .card{text-align:center;padding:2rem;max-width:420px}
        h1{font-size:1.5rem;margin-bottom:.5rem;color:#a78bfa}
        p{color:#9ca3af;margin-bottom:1.5rem;line-height:1.6}
        button{background:#7c3aed;color:#fff;border:none;padding:.75rem 1.5rem;
          border-radius:.5rem;cursor:pointer;font-size:1rem}
        button:hover{background:#6d28d9}
      </style>
      </head><body>
      <div class="card">
        <h1>You're offline</h1>
        <p>Your work is saved locally. Any changes you make will sync automatically when your connection returns.</p>
        <button onclick="location.reload()">Try again</button>
      </div>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: '/icon-192',
      badge: '/icon-192',
      tag: data.tag || `ss-${Date.now()}`,
      data: {
        url: data.url || '/notifications',
      },
      actions: data.actions || [],
      vibrate: [100, 50, 100],
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Screenplay Studio', options)
    );
  } catch (err) {
    // Fallback for text payloads
    event.waitUntil(
      self.registration.showNotification('Screenplay Studio', {
        body: event.data.text(),
        icon: '/icon-192',
        tag: `ss-text-${Date.now()}`,
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});
