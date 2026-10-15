'use client';

import { useSyncExternalStore } from 'react';
import { isElectronMode, isLocalMode } from '@/lib/supabase/electron-client';

const noopSubscribe = () => () => {};

/**
 * Whether this page is running inside the desktop app, and whether it is in
 * local (no account) mode.
 *
 * The server can't know either, so it renders the web version; reading these
 * during render made the desktop app's first render disagree with the server
 * HTML and throw away hydration. This returns `false` while hydrating and the
 * real value immediately after.
 */
export function useDesktop(): { isDesktop: boolean; isLocal: boolean } {
  const isDesktop = useSyncExternalStore(noopSubscribe, isElectronMode, () => false);
  const isLocal = useSyncExternalStore(noopSubscribe, isLocalMode, () => false);
  return { isDesktop, isLocal };
}
