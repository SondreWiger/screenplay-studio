'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePresenceStore, useAuthStore, useScriptStore } from '@/lib/stores';
import type { UserPresence, ScriptElement } from '@/lib/types';

export function useRealtime(projectId: string) {
  const { user } = useAuthStore();
  const { setOnlineUsers } = usePresenceStore();
  // Only grab setElements — avoid capturing `elements` in the closure (stale)
  const { setElements } = useScriptStore();

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
          // Ignore changes made by the current user — we already update state locally
          const newRecord = payload.new as ScriptElement | undefined;
          if (newRecord && newRecord.last_edited_by === user.id) return;

          // For DELETE, check old record's last_edited_by as well
          if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as { id: string; last_edited_by?: string };
            if (oldRecord?.last_edited_by === user.id) return;
          }

          // Use getState() to avoid stale closure
          const currentElements = useScriptStore.getState().elements;

          if (payload.eventType === 'INSERT') {
            const newElement = payload.new as ScriptElement;
            // Avoid duplicates (we may already have it from local addElement)
            if (currentElements.some((e) => e.id === newElement.id)) return;
            setElements([...currentElements, newElement].sort((a, b) => a.sort_order - b.sort_order));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as ScriptElement;
            setElements(
              currentElements.map((e) => (e.id === updated.id ? updated : e))
            );
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setElements(currentElements.filter((e) => e.id !== deleted.id));
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
          const page = window.location.pathname.split('/').pop() || 'overview';
          await presenceChannel.track({
            user_id: user.id,
            project_id: projectId,
            current_page: page,
            is_online: true,
            last_seen: new Date().toISOString(),
            full_name: user.full_name || user.email || '',
            email: user.email || '',
            avatar_url: user.avatar_url || '',
            focused_element_id: null,
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

      // Update presence channel (realtime) with the page slug + focused element
      const presenceChannel = supabase.channel(`presence-${projectId}`);
      try {
        await presenceChannel.track({
          user_id: user.id,
          project_id: projectId,
          current_page: page,
          is_online: true,
          last_seen: new Date().toISOString(),
          full_name: user.full_name || user.email || '',
          email: user.email || '',
          avatar_url: user.avatar_url || '',
          focused_element_id: elementId || null,
        });
      } catch {} // channel may not be joined yet

      // Also persist to DB
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
