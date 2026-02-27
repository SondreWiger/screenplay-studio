'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useNotificationStore } from '@/lib/stores';
import type { Notification } from '@/lib/types';

/**
 * Request browser notification permission.
 * Returns true if granted.
 */
function requestBrowserPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return Promise.resolve(false);
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') return Promise.resolve(false);
  return Notification.requestPermission().then((p) => p === 'granted');
}

/**
 * Show a native browser notification.
 */
function showBrowserNotification(notification: Notification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  // Don't notify if page is focused
  if (document.hasFocus()) return;

  const actorName = notification.actor?.display_name || notification.actor?.full_name || 'Someone';
  const title = notification.title || `New notification from ${actorName}`;
  const body = notification.body || '';

  try {
    const n = new window.Notification(title, {
      body,
      icon: notification.actor?.avatar_url || '/icon-192.png',
      tag: notification.id, // Prevents duplicate notifications
      silent: false,
    });

    // Click to navigate
    if (notification.link) {
      n.onclick = () => {
        window.focus();
        window.location.href = notification.link!;
        n.close();
      };
    } else {
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }

    // Auto-close after 6s
    setTimeout(() => n.close(), 6000);
  } catch {
    // Fallback: some browsers don't support Notification constructor
  }
}

/**
 * Hook to initialise notifications: fetches existing ones and
 * subscribes to realtime INSERTs on the notifications table.
 * Also requests browser notification permission and shows
 * native OS notifications when new ones arrive.
 * Call once in a layout-level component.
 */
export function useNotifications(userId: string | undefined) {
  const { fetchNotifications, addNotification } = useNotificationStore();
  const subscribed = useRef(false);
  const permissionRequested = useRef(false);

  // Request browser notification permission once
  useEffect(() => {
    if (!userId || permissionRequested.current) return;
    permissionRequested.current = true;
    // Small delay so it doesn't fire immediately on page load
    const timer = setTimeout(() => {
      requestBrowserPermission();
    }, 3000);
    return () => clearTimeout(timer);
  }, [userId]);

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
          if (data) {
            const notif = data as Notification;
            addNotification(notif);
            // Show browser push notification
            showBrowserNotification(notif);
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
