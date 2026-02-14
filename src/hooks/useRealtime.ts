'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePresenceStore, useAuthStore, useScriptStore } from '@/lib/stores';
import type { UserPresence, ScriptElement } from '@/lib/types';

export function useRealtime(projectId: string) {
  const { user } = useAuthStore();
  const { setOnlineUsers } = usePresenceStore();
  const { elements, setElements } = useScriptStore();

  useEffect(() => {
    if (!projectId || !user) return;

    const supabase = createClient();

    // Subscribe to script element changes
    const elementsChannel = supabase
      .channel(`script-elements-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'script_elements',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newElement = payload.new as ScriptElement;
            setElements([...elements, newElement].sort((a, b) => a.sort_order - b.sort_order));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as ScriptElement;
            setElements(
              elements.map((e) => (e.id === updated.id ? updated : e))
            );
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setElements(elements.filter((e) => e.id !== deleted.id));
          }
        }
      )
      .subscribe();

    // Presence tracking
    const presenceChannel = supabase
      .channel(`presence-${projectId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users: UserPresence[] = [];
        for (const key in state) {
          const presences = state[key] as unknown as UserPresence[];
          users.push(...presences);
        }
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await presenceChannel.track({
            user_id: user.id,
            project_id: projectId,
            current_page: window.location.pathname,
            is_online: true,
            last_seen: new Date().toISOString(),
            profile: user,
          });
        }
      });

    return () => {
      supabase.removeChannel(elementsChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [projectId, user?.id]);

  const updatePresence = useCallback(
    async (page: string, elementId?: string) => {
      if (!user || !projectId) return;
      const supabase = createClient();
      await supabase.from('user_presence').upsert({
        user_id: user.id,
        project_id: projectId,
        current_page: page,
        current_element_id: elementId || null,
        is_online: true,
        last_seen: new Date().toISOString(),
      });
    },
    [user, projectId]
  );

  return { updatePresence };
}
