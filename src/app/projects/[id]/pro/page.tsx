'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Card } from '@/components/ui';
import { sidebarIcons } from '@/components/sidebar/SidebarIcons';
import { createClient } from '@/lib/supabase/client';
import { useProFeatures } from '@/hooks/useProFeatures';
import { cn } from '@/lib/utils';
import { GROUP_ACCENT, PRO_TOOLS, proToolsByGroup, layoutFor } from '@/lib/pro-tools';

// Index for the Pro tool suite — the sidebar links straight to individual tools,
// this page is the map of what the tier includes.

export default function ProToolsIndexPage({ params }: { params: { id: string } }) {
  const { isPro, loading } = useProFeatures();
  const [query, setQuery] = useState('');
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  // One query for the whole suite — showing where work already exists turns
  // this page from a menu into a status board.
  useEffect(() => {
    if (!isPro) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('pro_tool_records')
        .select('tool')
        .eq('project_id', params.id);
      if (cancelled) return;
      if (error || !data) { setCounts({}); return; }
      const tally: Record<string, number> = {};
      for (const row of data as { tool: string }[]) {
        tally[row.tool] = (tally[row.tool] ?? 0) + 1;
      }
      setCounts(tally);
    })();
    return () => { cancelled = true; };
  }, [params.id, isPro]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return proToolsByGroup()
      .map(({ group, tools }) => ({
        group,
        tools: needle
          ? tools.filter((t) =>
              t.label.toLowerCase().includes(needle) || t.tagline.toLowerCase().includes(needle))
          : tools,
      }))
      .filter(({ tools }) => tools.length > 0);
  }, [query]);

  const inUse = useMemo(
    () => (counts ? Object.values(counts).filter((n) => n > 0).length : 0),
    [counts]
  );

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Matches the sidebar's Pro gating in projects/[id]/layout.tsx.
  if (!isPro) return (
    <div className="p-3 sm:p-4 md:p-8 max-w-3xl">
      <Card className="p-8 text-center">
        <Badge variant="warning" className="mb-3">Pro Feature</Badge>
        <h2 className="text-xl font-bold text-white mb-2">The Pro tool suite</h2>
        <p className="text-surface-400 mb-4">
          {PRO_TOOLS.length} production tools — accounting, rights, distribution, VFX tracking and more.
        </p>
        <a
          href="/pro"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors"
        >
          See Pro
        </a>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b border-surface-800 px-6 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">Pro Tools</h1>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 font-semibold uppercase tracking-[0.04em]">
            Pro
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
          <p className="text-sm text-surface-400">
            {PRO_TOOLS.length} tools for running a production at scale
            {counts && inUse > 0 && <> · <span className="text-surface-300">{inUse} in use</span></>}
          </p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tools…"
            className="text-sm bg-surface-900 border border-surface-700 rounded-lg px-3 py-1.5 text-surface-200 outline-none focus:border-brand-500/50 w-56"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-8">
        {groups.length === 0 && (
          <p className="text-sm text-surface-500 py-12 text-center">
            No tool matches “{query}”.
          </p>
        )}
        {groups.map(({ group, tools }) => (
          <div key={group}>
            <div className="flex items-center gap-2 mb-3">
              <span className={cn('w-1 h-3.5 rounded-full', GROUP_ACCENT[group].rule)} />
              <h2 className={cn('text-[11px] font-semibold uppercase tracking-[0.04em]', GROUP_ACCENT[group].text)}>
                {group}
              </h2>
              <span className="text-[11px] text-surface-600">{tools.length}</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/projects/${params.id}/pro/${tool.slug}`}
                  className={cn(
                    'relative rounded-xl border border-surface-800 bg-surface-900/40 p-4 pl-5 overflow-hidden',
                    'hover:bg-surface-800/40 transition-colors group',
                    `hover:${GROUP_ACCENT[tool.group].border}`,
                  )}
                >
                  <span className={cn('absolute left-0 inset-y-0 w-0.5', GROUP_ACCENT[tool.group].rule)} />
                  <div className="flex items-start gap-3">
                    <span className={cn('shrink-0 mt-0.5', GROUP_ACCENT[tool.group].text)}>{sidebarIcons[tool.icon]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-white text-sm group-hover:text-brand-500 transition-colors">
                          {tool.label}
                        </div>
                        {counts?.[tool.slug] ? (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-surface-800 text-surface-300 border border-surface-700 shrink-0">
                            {counts[tool.slug]}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-surface-500 mt-1">{tool.tagline}</p>
                      <span className="text-[11px] text-surface-600 mt-1.5 inline-block capitalize">
                        {layoutFor(tool)} view
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
