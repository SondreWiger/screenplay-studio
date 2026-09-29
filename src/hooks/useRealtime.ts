'use client';

import { useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePresenceStore, useAuthStore, useScriptStore } from '@/lib/stores';
import logger from '@/lib/logger';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { UserPresence, ScriptElement } from '@/lib/types';

export function useRealtime(projectId: string) {
  const { user } = useAuthStore();
  const { setOnlineUsers } = usePresenceStore();
  // Only grab setElements — avoid capturing `elements` in the closure (stale)
  const { setElements } = useScriptStore();
  const scriptId = useScriptStore((s) => s.currentScript?.id ?? null);

  // Store a ref to the presence channel so updatePresence can reuse it
  const presenceChannelRef = useRef<ReturnType<typeof createClient.prototype.channel> | null>(null);

  useEffect(() => {
    if (!projectId || !user) return;

    const supabase = createClient();
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
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED' && user) {
          const raw = window.location.pathname.split('/').pop() || '';
          const page = raw === projectId || raw === '' ? 'overview' : raw;
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

    presenceChannelRef.current = presenceChannel;

    return () => {
      supabase.removeChannel(presenceChannel);
      presenceChannelRef.current = null;
    };
  }, [projectId, user?.id]);

  // Live edits to the open script. Filtered server-side by script_id — the
  // old unfiltered channel received every element change in every project the
  // user belongs to, and merged other scripts' lines into the open editor.
  useEffect(() => {
    if (!scriptId || !user) return;
    const supabase = createClient();
    const userId = user.id;

    const apply = (payload: RealtimePostgresChangesPayload<ScriptElement>) => {
      const current = useScriptStore.getState();
      if (current.currentScript?.id !== scriptId) return;
      const elements = current.elements;

      if (payload.eventType === 'DELETE') {
        const old = payload.old as { id: string; last_edited_by?: string };
        if (!old?.id || old.last_edited_by === userId) return;
        if (!elements.some((e) => e.id === old.id)) return;
        setElements(elements.filter((e) => e.id !== old.id));
        return;
      }

      const row = payload.new as ScriptElement | undefined;
      // Ignore our own echoes — local state already has them
      if (!row || row.script_id !== scriptId || row.last_edited_by === userId) return;

      if (payload.eventType === 'INSERT') {
        if (elements.some((e) => e.id === row.id)) return;
        setElements([...elements, row].sort((a, b) => a.sort_order - b.sort_order));
      } else if (payload.eventType === 'UPDATE') {
        const moved = elements.find((e) => e.id === row.id)?.sort_order !== row.sort_order;
        const next = elements.map((e) => (e.id === row.id ? row : e));
        setElements(moved ? next.sort((a, b) => a.sort_order - b.sort_order) : next);
      }
    };

    const channel = supabase
      .channel(`script-elements-${scriptId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'script_elements', filter: `script_id=eq.${scriptId}` }, apply)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'script_elements', filter: `script_id=eq.${scriptId}` }, apply)
      // Realtime can't filter DELETEs; apply() only removes ids we actually hold.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'script_elements' }, apply)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [scriptId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updatePresence = useCallback(
    async (page: string, elementId?: string) => {
      if (!user || !projectId) return;

      // Reuse the existing channel instead of creating a new one each call
      if (!presenceChannelRef.current) return;

      try {
        await presenceChannelRef.current.track({
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
      } catch (err) {
        logger.debug('useRealtime', 'Presence track failed:', err);
      }

      // Also persist to DB
      const supabase = createClient();
      await supabase.from('user_presence').upsert({
        user_id: user.id,
        project_id: projectId,
        current_page: page,
        current_element_id: elementId || null,
        is_online: true,
        last_seen: new Date().toISOString(),
      // One row per user+project: without this every update after the first
      // tried to insert a duplicate and failed with 409.
      }, { onConflict: 'user_id,project_id' });
    },
    [user, projectId]
  );

  return { updatePresence };
}
