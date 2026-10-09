'use client';

import { useEffect } from 'react';
import { processSyncQueue, requestSync, flushSyncQueue } from '@/lib/offline/queue';
import { requestPersistentStorage } from '@/lib/offline/db';

/**
 * Registers the service worker and wires up the offline sync queue.
 * Mount this component once near the root of the app (inside Providers).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'development') {
      // The worker serves /_next/static/* cache-first. In production that is
      // safe because those filenames are content-hashed, so a new build asks
      // for new URLs. In development the filenames are stable across rebuilds,
      // so cache-first pins the browser to whatever JS it saw first — edits
      // stop appearing, and errors from deleted code keep being thrown.
      //
      // Tear down anything left over from a previous run so a developer who is
      // already stuck gets unstuck on the next reload rather than having to
      // find this in DevTools.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      caches?.keys().then((names) => {
        names.filter((n) => n.startsWith('ss-')).forEach((n) => caches.delete(n));
      });
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.debug('[sw] registered', reg.scope);
      })
      .catch((err) => {
        console.warn('[sw] registration failed', err);
      });

  }, []);

  // Offline write queue. Independent of the service worker — it must run in
  // every environment (it used to be skipped entirely in development).
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Without this, Safari/iOS and low-disk devices may silently evict local data.
    requestPersistentStorage().then((ok) => {
      if (!ok) console.warn('[offline] Persistent storage not granted; local data may be evicted');
    });

    const handleOnline = () => { processSyncQueue({ includeFailed: true }).catch(console.warn); };
    // Fired by offlineUpsert/offlineDelete; debounced so typing batches up.
    const handleSyncEvent = () => requestSync();
    // Don't leave edits sitting in the debounce window when the tab goes away.
    const handleHidden = () => { if (document.visibilityState === 'hidden') flushSyncQueue(); };
    const handlePageHide = () => { flushSyncQueue(); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('ss:sync', handleSyncEvent);
    document.addEventListener('visibilitychange', handleHidden);
    window.addEventListener('pagehide', handlePageHide);

    // Leftovers from a previous session (including ones that had failed)
    if (navigator.onLine) {
      processSyncQueue({ includeFailed: true }).catch(console.warn);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('ss:sync', handleSyncEvent);
      document.removeEventListener('visibilitychange', handleHidden);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  return null;
}
