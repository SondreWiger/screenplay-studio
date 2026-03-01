'use client';

import { useEffect, useState, useCallback } from 'react';
import { processSyncQueue, pendingSyncCount } from '@/lib/offline/queue';

export interface OnlineStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  triggerSync: () => Promise<void>;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const count = await pendingSyncCount();
    setPendingCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      await processSyncQueue();
      setLastSyncedAt(new Date());
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [isSyncing, isOnline, refreshPendingCount]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      // Auto-sync pending writes as soon as we reconnect
      triggerSync();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [triggerSync]);

  // Poll pending count every 10 s so the badge stays accurate
  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 10_000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  return { isOnline, pendingCount, isSyncing, lastSyncedAt, triggerSync };
}
