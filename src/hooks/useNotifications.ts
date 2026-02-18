'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useNotificationStore } from '@/lib/stores';
import type { Notification } from '@/lib/types';

/**
 * Hook to initialise notifications: fetches existing ones and
 * subscribes to realtime INSERTs on the notifications table.
 * Call once in a layout-level component.
 */
export function useNotifications(userId: string | undefined) {
  const { fetchNotifications, addNotification } = useNotificationStore();
  const subscribed = useRef(false);

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
            .eq('id', (payload.new as any).id)
            .single();
          if (data) {
            addNotification(data as Notification);
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
