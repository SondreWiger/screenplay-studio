'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import type { ScriptElement } from '@/lib/types';

/**
 * Real-time cross-tool sync:
 * - script_elements INSERT/UPDATE → auto-create characters (new names)
 * - script_elements INSERT/UPDATE → auto-create scenes (new headings)
 * - runs only for changes made by OTHER users (local changes already optimistically applied)
 */
export function useCrossToolSync(projectId: string) {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!projectId || !user) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`cross-tool-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'script_elements',
        },
        async (payload) => {
          const element = payload.new as ScriptElement;
          if (element.last_edited_by === user.id) return;

          if (element.element_type === 'character' && !element.is_omitted) {
            await syncCharacterFromScript(projectId, element, user.id);
          }

          if (element.element_type === 'scene_heading' && !element.is_omitted) {
            await syncSceneFromScript(projectId, element, user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, user?.id]);
}

async function syncCharacterFromScript(
  projectId: string,
  element: ScriptElement,
  userId: string
) {
  const name = element.content.trim()
    .replace(/\s*\(.*\)\s*$/, '')
    .toUpperCase();
  if (!name) return;

  const supabase = createClient();

  const { data: existing } = await supabase
    .from('characters')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', name.charAt(0) + name.slice(1).toLowerCase())
    .maybeSingle();

  if (existing) return;

  // Count how many lines this character has across the script
  const { data: scriptRes } = await supabase
    .from('scripts').select('id').eq('project_id', projectId);
  if (!scriptRes?.length) return;

  const scriptIds = scriptRes.map(s => s.id);
  const { count } = await supabase
    .from('script_elements')
    .select('id', { count: 'exact', head: true })
    .in('script_id', scriptIds)
    .eq('element_type', 'character')
    .eq('is_omitted', false)
    .textSearch('content', name);

  const lineCount = count ?? 0;

  const { data: maxOrder } = await supabase
    .from('characters')
    .select('sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1);

  await supabase.from('characters').insert({
    project_id: projectId,
    name: name.charAt(0) + name.slice(1).toLowerCase(),
    is_main: lineCount >= 10,
    role: lineCount >= 20 ? 'main' : lineCount >= 10 ? 'supporting' : 'minor',
    color: `hsl(${Math.random() * 360}, 60%, 50%)`,
    sort_order: (maxOrder?.[0]?.sort_order ?? -1) + 1,
    created_by: userId,
    personality_traits: [],
  });
}

async function syncSceneFromScript(
  projectId: string,
  element: ScriptElement,
  userId: string
) {
  const content = element.content.trim();
  if (!content) return;

  const supabase = createClient();

  const { data: existing } = await supabase
    .from('scenes')
    .select('id')
    .eq('script_element_id', element.id)
    .maybeSingle();

  if (existing) return;

  const upper = content.toUpperCase();
  const prefixMatch = upper.match(/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.|INT\/EXT\.?)\s*/);
  const locationType = prefixMatch ? prefixMatch[1].replace(/\.$/, '') : 'INT';
  const rest = prefixMatch ? upper.slice(prefixMatch[0].length) : upper;
  const dashIdx = rest.lastIndexOf(' - ');
  const locationName = dashIdx >= 0 ? rest.slice(0, dashIdx).trim() : rest.trim();
  const timeOfDay = dashIdx >= 0 ? rest.slice(dashIdx + 3).trim() : '';

  const { data: maxOrder } = await supabase
    .from('scenes')
    .select('sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1);

  await supabase.from('scenes').insert({
    project_id: projectId,
    script_id: element.script_id ?? null,
    script_element_id: element.id,
    scene_number: element.scene_number ?? null,
    scene_heading: content,
    location_type: locationType as 'INT' | 'EXT' | 'INT/EXT',
    location_name: locationName,
    time_of_day: timeOfDay as 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'MORNING' | 'AFTERNOON' | 'EVENING' | 'CONTINUOUS' | 'MOMENTS LATER' | '',
    sort_order: (maxOrder?.[0]?.sort_order ?? -1) + 10,
    created_by: userId,
  });
}
