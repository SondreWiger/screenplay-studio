'use client';

import { useEffect, useState } from 'react';
import { getSyncStatus, processSyncQueue, type SyncStatus } from '@/lib/offline/queue';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

/** Live state of the offline write queue (see lib/offline/queue.ts). */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  useEffect(() => {
    const onStatus = (e: Event) => setStatus((e as CustomEvent<SyncStatus>).detail);
    window.addEventListener('ss:sync-status', onStatus);
    setStatus(getSyncStatus());
    return () => window.removeEventListener('ss:sync-status', onStatus);
  }, []);
  return status;
}

/**
 * Warn before closing the tab while edits haven't reached the server.
 * Mount once per editing surface.
 */
export function useUnsavedChangesGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);
}

/**
 * Honest save indicator: "Saved" only once the server has the changes.
 * `localSaving` covers the moment between a keystroke and the write being queued.
 */
export function SaveStatus({ localSaving = false, className, compact = false }: {
  localSaving?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const online = useOnlineStatus();
  const { pending, failed, syncing } = useSyncStatus();
  const [retrying, setRetrying] = useState(false);

  useUnsavedChangesGuard(pending > 0 || localSaving);

  let dot = 'bg-green-500';
  let label: React.ReactNode = 'Saved';
  let title = 'All changes are saved to the cloud';

  if (failed > 0 && online) {
    dot = 'bg-red-500';
    title = 'Some changes were rejected by the server. They are kept on this device.';
    label = (
      <>
        {failed} {failed === 1 ? 'change' : 'changes'} not saved
        <button
          type="button"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true);
            try { await processSyncQueue({ includeFailed: true }); } finally { setRetrying(false); }
          }}
          className="ml-1 underline underline-offset-2 hover:text-white disabled:opacity-50"
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      </>
    );
  } else if (!online) {
    dot = 'bg-amber-500';
    label = pending > 0 ? `Offline · ${pending} unsynced` : 'Offline';
    title = 'Changes are saved on this device and will sync when you reconnect';
  } else if (localSaving || syncing || pending > 0) {
    dot = 'bg-yellow-500 animate-pulse';
    label = 'Saving…';
    title = 'Sending your latest changes';
  }

  return (
    <span
      role="status"
      aria-live="polite"
      title={title}
      className={cn(
        'flex items-center gap-1.5 text-[11px] shrink-0',
        failed > 0 && online ? 'text-red-400' : !online ? 'text-amber-400' : 'text-surface-500',
        className,
      )}
    >
      <span className={cn('rounded-full', compact ? 'w-1.5 h-1.5' : 'w-2 h-2', dot)} />
      {label}
    </span>
  );
}
