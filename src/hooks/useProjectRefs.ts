'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ProToolRefSource } from '@/lib/pro-tools';

// Loads the project rows a Pro tool can point at, so a clearance attaches to a
// real scene and a catering order to a real shoot day.

export interface RefOption {
  id: string;
  label: string;
}

type Loaded = Record<string, RefOption[]>;

const truncate = (s: string, max = 48) => (s.length > max ? `${s.slice(0, max)}…` : s);

async function fetchSource(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  source: ProToolRefSource,
): Promise<RefOption[]> {
  switch (source) {
    case 'scenes': {
      const { data } = await supabase
        .from('scenes')
        .select('id, scene_number, scene_heading')
        .eq('project_id', projectId)
        .order('scene_number');
      return ((data ?? []) as { id: string; scene_number: number | null; scene_heading: string | null }[])
        .map((r) => ({
          id: r.id,
          label: truncate([r.scene_number != null ? `Sc ${r.scene_number}` : null, r.scene_heading]
            .filter(Boolean).join(' — ') || 'Untitled scene'),
        }));
    }
    case 'shoot_days': {
      const { data } = await supabase
        .from('shoot_days')
        .select('id, day_number')
        .eq('project_id', projectId)
        .order('day_number');
      return ((data ?? []) as { id: string; day_number: number | null }[])
        .map((r) => ({ id: r.id, label: `Day ${r.day_number ?? '?'}` }));
    }
    case 'characters':
    case 'locations': {
      const { data } = await supabase
        .from(source)
        .select('id, name')
        .eq('project_id', projectId)
        .order('name');
      return ((data ?? []) as { id: string; name: string | null }[])
        .map((r) => ({ id: r.id, label: truncate(r.name || 'Untitled') }));
    }
  }
}

export function useProjectRefs(projectId: string, sources: ProToolRefSource[]) {
  // Depend on the contents rather than the array identity — callers build this
  // list inline, so a new array every render would refetch forever.
  const key = sources.join(',');
  const [options, setOptions] = useState<Loaded>({});
  const [loading, setLoading] = useState(sources.length > 0);

  useEffect(() => {
    const list = key ? (key.split(',') as ProToolRefSource[]) : [];
    if (list.length === 0) {
      setOptions({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      const results = await Promise.all(
        list.map(async (source) => {
          try {
            return [source, await fetchSource(supabase, projectId, source)] as const;
          } catch {
            // A project without a schedule yet simply has nothing to link to.
            return [source, [] as RefOption[]] as const;
          }
        })
      );
      if (cancelled) return;
      setOptions(Object.fromEntries(results));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId, key]);

  const resolve = useCallback(
    (source: ProToolRefSource, id: string) => options[source]?.find((o) => o.id === id)?.label,
    [options]
  );

  return { options, resolve, loading };
}
