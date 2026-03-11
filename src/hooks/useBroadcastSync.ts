'use client';

import { useCallback, useEffect, useRef } from 'react';

// ============================================================
// Typed events that can be broadcast across windows/tabs
// ============================================================
export type BroadcastEvent =
  | { type: 'navigate'; payload: { href: string; label?: string } }
  | { type: 'scene-select'; payload: { sceneId: string; sceneTitle?: string } }
  | { type: 'character-select'; payload: { characterId: string; name?: string } }
  | { type: 'episode-select'; payload: { episodeId: string; title?: string } }
  | { type: 'script-scroll'; payload: { elementId: string; sceneNumber?: number } }
  | { type: 'cursor'; payload: { page: string; userId: string } }
  | { type: 'ping'; payload: { windowId: string } }
  | { type: 'pong'; payload: { windowId: string } };

export type BroadcastEventType = BroadcastEvent['type'];

interface UseBroadcastSyncOptions {
  projectId: string;
  onEvent?: (event: BroadcastEvent) => void;
}

// Stable window ID for this tab/window session
const WINDOW_ID = typeof crypto !== 'undefined'
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);

export function useBroadcastSync({ projectId, onEvent }: UseBroadcastSyncOptions) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(`ss-project-${projectId}`);
    channelRef.current = channel;

    channel.onmessage = (e: MessageEvent<BroadcastEvent>) => {
      onEventRef.current?.(e.data);
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [projectId]);

  const broadcast = useCallback((event: BroadcastEvent) => {
    channelRef.current?.postMessage(event);
  }, []);

  return { broadcast, windowId: WINDOW_ID };
}
