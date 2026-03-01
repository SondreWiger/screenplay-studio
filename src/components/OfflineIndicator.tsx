'use client';

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
  const { isOnline, pendingCount, isSyncing, triggerSync } = useOnlineStatus();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    // Everything is in sync — show nothing (or a subtle green dot)
    return null;
  }

  return (
    <button
      onClick={triggerSync}
      title={
        !isOnline
          ? `Offline — ${pendingCount} change${pendingCount !== 1 ? 's' : ''} queued`
          : isSyncing
          ? 'Syncing…'
          : `${pendingCount} change${pendingCount !== 1 ? 's' : ''} waiting to sync — click to retry`
      }
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
        !isOnline
          ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
          : isSyncing
          ? 'bg-sky-500/15 text-sky-400'
          : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25',
        className
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          !isOnline
            ? 'bg-amber-400'
            : isSyncing
            ? 'bg-sky-400 animate-pulse'
            : 'bg-amber-400 animate-pulse'
        )}
      />

      {!isOnline ? (
        <span>
          Offline
          {pendingCount > 0 && (
            <span className="ml-1 font-semibold">({pendingCount})</span>
          )}
        </span>
      ) : isSyncing ? (
        <span>Syncing…</span>
      ) : (
        <span>
          {pendingCount} pending
        </span>
      )}
    </button>
  );
}
