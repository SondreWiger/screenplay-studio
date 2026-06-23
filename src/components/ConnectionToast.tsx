'use client';

import { useEffect, useRef } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { toast } from '@/components/ui';

/**
 * Watches online status transitions and shows toasts:
 * - Going offline: "Connection lost — changes saved locally"
 * - Coming back online: "Back online — syncing changes..."
 */
export function ConnectionToast() {
  const isOnline = useOnlineStatus();
  const wasOnline = useRef<boolean>(true);
  const mounted = useRef(false);

  useEffect(() => {
    // Skip the first render — we don't want a toast on page load
    if (!mounted.current) {
      mounted.current = true;
      wasOnline.current = isOnline;
      return;
    }

    if (wasOnline.current && !isOnline) {
      // Went offline
      toast.error('Connection lost — changes are being saved locally');
    } else if (!wasOnline.current && isOnline) {
      // Came back online
      toast.success('Back online — syncing your changes...');
    }

    wasOnline.current = isOnline;
  }, [isOnline]);

  return null;
}
