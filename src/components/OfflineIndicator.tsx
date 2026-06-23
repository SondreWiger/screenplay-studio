'use client';

import { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { pendingSyncCount } from '@/lib/offline/db';
import { cn } from '@/lib/utils';

/**
 * A small status indicator shown in the app header (or anywhere).
 *
 * Shows:
 *  - Nothing         → online
 *  - Grey "Offline"  → no internet connection + pending count badge
 */
export function OfflineIndicator({ className }: { className?: string }) {
  const isOnline = useOnlineStatus();
  const [pending, setPending] = useState(0);

  // Poll pending count when offline
  useEffect(() => {
    if (isOnline) { setPending(0); return; }
    let active = true;
    const check = async () => {
      try {
        const count = await pendingSyncCount();
        if (active) setPending(count);
      } catch { /* ignore */ }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [isOnline]);

  if (isOnline) {
    return null;
  }

  return (
    <div
      title={pending > 0 ? `${pending} change${pending !== 1 ? 's' : ''} saved locally — will sync when online` : 'You are offline'}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
        'bg-amber-500/15 text-amber-400',
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      <span>
        Offline
        {pending > 0 && <span className="ml-1 font-semibold">({pending})</span>}
      </span>
    </div>
  );
}
