'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useNotificationStore } from '@/lib/stores';
import { triggerSelfPush } from '@/lib/notifications';
import type { Notification, NotificationType } from '@/lib/types';

// ---------------------------------------------------------------------------
// Notification types that get sound + tab-title treatment.
// Upvotes and low-priority events are intentionally excluded to avoid noise.
// ---------------------------------------------------------------------------
const HIGH_PRIORITY_TYPES = new Set([
  'direct_message',
  'mention',
  'chat_mention',
  'project_invitation',
  'company_invitation',
  'task_assigned',
  'ticket_reply',
] as NotificationType[]);

// ---------------------------------------------------------------------------
// Web Audio — subtle two-tone ping, no audio file required.
// Only fires when the page is not focused.
// ---------------------------------------------------------------------------
function playNotificationSound() {
  if (typeof window === 'undefined') return;
  if (document.hasFocus()) return; // don't beep if user is looking at the page
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const makeBeep = (freq: number, startTime: number, duration: number, volume = 0.08) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Two-tone ascending ping: 880 Hz then 1100 Hz
    makeBeep(880,  now,        0.12);
    makeBeep(1100, now + 0.12, 0.12);

    // Auto-close context to free resources
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    // Audio API unavailable or blocked — silent fallback is fine
  }
}

// ---------------------------------------------------------------------------
// Tab title badge
// ---------------------------------------------------------------------------
const ORIGINAL_TITLE_REF = { value: '' };

function setTabBadge(count: number) {
  if (typeof document === 'undefined') return;
  if (!ORIGINAL_TITLE_REF.value) {
    // Strip any existing badge from a prior session so we always capture clean
    ORIGINAL_TITLE_REF.value = document.title.replace(/^\(\d+\)\s*/, '');
  }
  if (count > 0) {
    document.title = `(${count > 99 ? '99+' : count}) ${ORIGINAL_TITLE_REF.value}`;
  } else {
    document.title = ORIGINAL_TITLE_REF.value;
  }
}

// ---------------------------------------------------------------------------
// Browser (OS-level) notification
// ---------------------------------------------------------------------------
function requestBrowserPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return Promise.resolve(false);
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') return Promise.resolve(false);
  return Notification.requestPermission().then((p) => p === 'granted');
}

function showBrowserNotification(notification: Notification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  // Don't show OS popup if the page already has focus — the in-app bell suffices
  if (document.hasFocus()) return;

  const actorName = notification.actor?.display_name || notification.actor?.full_name || 'Someone';
  const title = notification.title || `New notification from ${actorName}`;
  const body = notification.body || '';

  try {
    const n = new window.Notification(title, {
      body,
      icon: notification.actor?.avatar_url || '/icon-192',
      badge: '/icon-192',
      tag: notification.id, // collapses duplicate notifications for the same event
      silent: false,
    });

    const dest = notification.link || '/notifications';
    n.onclick = () => {
      window.focus();
      window.location.href = dest;
      n.close();
    };
    // Auto-close after 8 seconds
    setTimeout(() => n.close(), 8000);
  } catch {
    // Some browsers don't support Notification with options — ignore
  }
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------
export function useNotifications(userId: string | undefined) {
  const { fetchNotifications, addNotification, unreadCount } = useNotificationStore();
  const subscribed = useRef(false);
  const permissionRequested = useRef(false);

  // ── Tab title: keep in sync with unreadCount ───────────────────────────────
  useEffect(() => {
    setTabBadge(unreadCount);
  }, [unreadCount]);

  // ── Restore clean title when tab gains focus ───────────────────────────────
  useEffect(() => {
    const onFocus = () => {
      // Don't clear the badge on focus — only clear when user marks all read.
      // This matches Discord/Slack behaviour: badge stays until you read it.
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // ── Permission request (once, with delay to avoid annoying on first load) ──
  useEffect(() => {
    if (!userId || permissionRequested.current) return;
    permissionRequested.current = true;
    const timer = setTimeout(() => requestBrowserPermission(), 3000);
    return () => clearTimeout(timer);
  }, [userId]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    if (subscribed.current) return;
    subscribed.current = true;

    const supabase = createClient();
    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          // Fetch the full notification with actor profile joined
          const { data } = await supabase
            .from('notifications')
            .select('*, actor:profiles!notifications_actor_id_fkey(*)')
            .eq('id', (payload.new as { id: string }).id)
            .single();

          if (!data) return;
          const notif = data as Notification;
          addNotification(notif);

          const isHighPriority = HIGH_PRIORITY_TYPES.has(notif.type);

          // OS popup (when not focused)
          showBrowserNotification(notif);

          // Sound for high-priority types (when not focused)
          if (isHighPriority) {
            playNotificationSound();
          }

          // Push to user's other subscribed devices (e.g., phone while on laptop).
          // Only for high-priority — avoids push-flooding on every upvote.
          if (isHighPriority) {
            triggerSelfPush(notif.title, notif.body || undefined, notif.link || undefined);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      subscribed.current = false;
    };
  }, [userId]);
}
