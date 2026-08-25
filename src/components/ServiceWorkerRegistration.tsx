'use client';

import { useEffect } from 'react';
import { processSyncQueue } from '@/lib/offline/queue';

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

    // When the app comes back online, flush any queued offline writes
    const handleOnline = () => {
      processSyncQueue().catch(console.warn);
    };
    // Also triggered by offlineUpsert/offlineDelete when online
    const handleSyncEvent = () => {
      processSyncQueue().catch(console.warn);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('ss:sync', handleSyncEvent);

    // Also attempt a sync on initial load (in case there are leftovers)
    if (navigator.onLine) {
      processSyncQueue().catch(console.warn);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('ss:sync', handleSyncEvent);
    };
  }, []);

  return null;
}
