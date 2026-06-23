'use client';

import { useState, useEffect } from 'react';

/**
 * Returns true when the browser is online.
 * In Electron local mode, always returns true (no network required).
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // In Electron, we're always "online" for local features
    if (typeof window !== 'undefined' && (window as any).electron) {
      setOnline(true);
      return;
    }

    setOnline(navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
