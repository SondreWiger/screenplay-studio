'use client';

import { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

/**
 * A small status indicator shown in the app header (or anywhere).
 *
 * Shows:
 *  - Green dot        → online, everything synced
 *  - Animated dot     → syncing pending writes
 *  - Orange dot       → online but pending writes exist
 *  - Grey "Offline"   → no internet connection + pending count badge
 */
export function OfflineIndicator({ className }: { className?: string }) {
  const isOnline = useOnlineStatus();

  // Only show when actually offline — don't confuse users with
  // "pending" badges that make them think they're offline
  if (isOnline) {
    return null;
  }

  return (
    <div
      title="You appear to be offline"
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
        'bg-amber-500/15 text-amber-400',
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      <span>Offline</span>
    </div>
  );
}
