'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Returns true when the browser is online.
 * In Electron local mode, always returns true (no network required).
 *
 * Debounces the "offline" event by 3 seconds to avoid false positives
 * from brief disconnections (Wi-Fi reconnection, VPN switches, etc.).
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // In Electron, we're always "online" for local features
    if (typeof window !== 'undefined' && (window as any).electron) {
      setOnline(true);
      return;
    }

    setOnline(navigator.onLine);

    const handleOnline = () => {
      // Clear any pending offline flip
      if (offlineTimer.current) {
        clearTimeout(offlineTimer.current);
        offlineTimer.current = null;
      }
      setOnline(true);
    };

    const handleOffline = () => {
      // Debounce: only go offline after 3s of continuous offline events.
      // Brief disconnections during Wi-Fi/VPN switches fire "offline"
      // followed quickly by "online" — this prevents the flicker.
      offlineTimer.current = setTimeout(() => {
        setOnline(false);
        offlineTimer.current = null;
      }, 3000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (offlineTimer.current) clearTimeout(offlineTimer.current);
    };
  }, []);

  return online;
}
