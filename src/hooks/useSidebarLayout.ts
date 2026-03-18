// useSidebarLayout.ts — 3-tier sidebar layout system
// Resolution: user-project override → project admin default → user global default → null (use hardcoded)

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SidebarLayout, SidebarSection, SidebarNavItem } from '@/lib/types';

export type SaveScope = 'user-project' | 'user-global' | 'project-default';

// Icons that used to exist in the nav but have been permanently removed.
// Any stored layout entry with one of these icons is silently dropped so that
// stale items (e.g. 'Share Portal', 'Client Review') never resurface from old
// saved sidebar layouts in the database.
const DEAD_NAV_ICONS = new Set(['review', 'share-portal', 'client-review']);

interface UseSidebarLayoutReturn {
  layout: SidebarLayout | null;
  loading: boolean;
  /** Merge stored layout onto defaultSections — call with the hardcoded sections */
  applyLayout: (defaultSections: SidebarSection[]) => SidebarSection[];
  saveLayout: (sections: SidebarSection[], scope: SaveScope) => Promise<void>;
  resetLayout: (scope: SaveScope) => Promise<void>;
  /** Which scope is currently active */
  activeScope: SaveScope | null;
}

export function useSidebarLayout(projectId: string, userId: string | undefined, isAdmin: boolean): UseSidebarLayoutReturn {
  const [layout, setLayout] = useState<SidebarLayout | null>(null);
  const [activeScope, setActiveScope] = useState<SaveScope | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const supabase = createClient();

    // Try all three tiers in one query
    const { data } = await supabase
      .from('sidebar_layouts')
      .select('user_id, project_id, layout')
      .or(
        `and(user_id.eq.${userId},project_id.eq.${projectId}),` +
        `and(user_id.is.null,project_id.eq.${projectId}),` +
        `and(user_id.eq.${userId},project_id.is.null)`
      );

    if (!data || data.length === 0) { setLoading(false); return; }

    // Resolve priority: user+project > null+project > user+null
    const userProject = data.find(r => r.user_id === userId && r.project_id === projectId);
    const projectDefault = data.find(r => r.user_id === null && r.project_id === projectId);
    const userGlobal = data.find(r => r.user_id === userId && r.project_id === null);

    let resolved: { layout: SidebarLayout; scope: SaveScope } | null = null;

    if (userProject) {
      resolved = { layout: userProject.layout as SidebarLayout, scope: 'user-project' };
    } else if (projectDefault) {
      resolved = { layout: projectDefault.layout as SidebarLayout, scope: 'project-default' };
    } else if (userGlobal) {
      resolved = { layout: userGlobal.layout as SidebarLayout, scope: 'user-global' };
    }

    if (resolved) {
      // Scrub known-dead icons from the stored layout so the DB row doesn't
      // keep resurfacing stale items (Share Portal, Client Review, etc.) on reload.
      const rawSections = resolved.layout.sections ?? [];
      const hasDead = rawSections.some(s =>
        s.items?.some(i => DEAD_NAV_ICONS.has(i.icon) || i.label === 'Share Portal' || i.label === 'Client Review')
      );
      if (hasDead) {
        const cleaned: SidebarLayout = {
          ...resolved.layout,
          sections: rawSections.map(s => ({
            ...s,
            items: (s.items ?? []).filter(
              i => !DEAD_NAV_ICONS.has(i.icon) && i.label !== 'Share Portal' && i.label !== 'Client Review'
            ),
          })),
        };
        // Write the cleaned layout back so the next load is already clean.
        const scope = resolved.scope;
        const row = {
          layout: cleaned,
          user_id: scope === 'project-default' ? null : userId,
          project_id: scope === 'user-global' ? null : projectId,
        };
        supabase.from('sidebar_layouts').upsert(row, { onConflict: 'user_id,project_id' }).then(() => {});
        resolved = { layout: cleaned, scope };
      }

      setLayout(resolved.layout);
      setActiveScope(resolved.scope);
    }

    setLoading(false);
  }, [projectId, userId]);

  useEffect(() => { load(); }, [load]);

  /**
   * Merges stored layout sections into defaultSections.
   * - Sections are reordered per stored layout
   * - Items within sections are reordered per stored layout
   * - Hidden flag is respected
   * - New sections/items (not in store) are appended
   */
  const applyLayout = useCallback((defaultSections: SidebarSection[]): SidebarSection[] => {
    if (!layout?.sections?.length) return defaultSections;

    const stored = layout.sections;

    // Build a map of section id → stored section
    const storedMap = new Map(stored.map(s => [s.id, s]));

    // Ordered result following stored order first, then any new sections
    const result: SidebarSection[] = [];
    const seen = new Set<string>();

    for (const storedSection of stored) {
      const defaultSection = defaultSections.find(d => d.id === storedSection.id);
      // Skip orphaned sections entirely — sections saved in old layouts that no
      // longer exist in the current nav definition should not ghost-render.
      if (!defaultSection) continue;

      const baseItems: SidebarNavItem[] = defaultSection?.items ?? [];
      const storedItems = storedSection.items ?? [];

      // Build ordered items list
      const storedItemMap = new Map(storedItems.map(i => [i.icon, i]));
      const orderedItems: SidebarNavItem[] = [];
      const seenItems = new Set<string>();

      for (const si of storedItems) {
        // Block known-dead icons — stale items from old saved layouts can't resurface.
        if (DEAD_NAV_ICONS.has(si.icon)) { seenItems.add(si.icon); continue; }
        const base = baseItems.find(b => b.icon === si.icon);
        if (base) {
          // Always use the current nav label — prevents stale labels (e.g. 'Share Portal') from
          // old saved layouts overriding the current default.
          orderedItems.push({ ...base, hidden: si.hidden ?? false });
        }
        // Orphaned items (icon not in current nav for this section) are dropped.
        seenItems.add(si.icon);
      }
      // Append new default items not in stored order
      for (const b of baseItems) {
        if (!seenItems.has(b.icon)) orderedItems.push(b);
      }

      result.push({
        id: storedSection.id,
        label: storedSection.label ?? defaultSection?.label ?? storedSection.id,
        collapsed: storedSection.collapsed,
        items: orderedItems,
      });
      seen.add(storedSection.id);
    }

    // Append any new default sections not in stored layout
    for (const d of defaultSections) {
      if (!seen.has(d.id)) result.push(d);
    }

    return result;
  }, [layout]);

  const saveLayout = useCallback(async (sections: SidebarSection[], scope: SaveScope) => {
    if (!userId) return;
    const supabase = createClient();

    const newLayout: SidebarLayout = { sections, savedAt: new Date().toISOString() };

    const row = {
      layout: newLayout,
      user_id: scope === 'project-default' ? null : userId,
      project_id: scope === 'user-global' ? null : projectId,
    };

    const { error } = await supabase
      .from('sidebar_layouts')
      .upsert(row, { onConflict: 'user_id,project_id' });

    if (error) throw new Error(error.message);
    setLayout(newLayout);
    setActiveScope(scope);
  }, [projectId, userId]);

  const resetLayout = useCallback(async (scope: SaveScope) => {
    if (!userId) return;
    const supabase = createClient();

    let query = supabase.from('sidebar_layouts').delete();
    if (scope === 'user-project') {
      query = query.eq('user_id', userId).eq('project_id', projectId);
    } else if (scope === 'user-global') {
      query = query.eq('user_id', userId).is('project_id', null);
    } else if (scope === 'project-default') {
      query = query.is('user_id', null).eq('project_id', projectId);
    }
    await query;
    // Reload
    setLayout(null);
    setActiveScope(null);
    await load();
  }, [projectId, userId, load]);

  return { layout, loading, applyLayout, saveLayout, resetLayout, activeScope };
}
