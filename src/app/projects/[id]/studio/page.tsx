'use client';

import Link from 'next/link';
import { Badge, Card } from '@/components/ui';
import { sidebarIcons } from '@/components/sidebar/SidebarIcons';
import { useProFeatures } from '@/hooks/useProFeatures';
import { STUDIO_TOOLS, studioToolsByGroup } from '@/lib/studio';

// Index for the Studio suite — the sidebar links straight to individual tools,
// this page is the map of what the tier includes.

export default function StudioIndexPage({ params }: { params: { id: string } }) {
  const { isStudio, loading } = useProFeatures();

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Matches the sidebar's Studio gating in projects/[id]/layout.tsx.
  if (!isStudio) return (
    <div className="p-3 sm:p-4 md:p-8 max-w-3xl">
      <Card className="p-8 text-center">
        <Badge variant="warning" className="mb-3">Studio Feature</Badge>
        <h2 className="text-xl font-black text-white mb-2">The Studio suite</h2>
        <p className="text-surface-400 mb-4">
          {STUDIO_TOOLS.length} production tools — accounting, rights, distribution, VFX tracking and more.
        </p>
        <a
          href="/pro"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors"
        >
          See Studio
        </a>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b border-surface-800 px-6 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">Studio</h1>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 font-semibold uppercase tracking-wider">
            Studio
          </span>
        </div>
        <p className="text-sm text-surface-400 mt-0.5">
          {STUDIO_TOOLS.length} tools for running a production at scale.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-8">
        {studioToolsByGroup().map(({ group, tools }) => (
          <div key={group}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">{group}</h2>
              <span className="text-[10px] text-surface-700">{tools.length}</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/projects/${params.id}/studio/${tool.slug}`}
                  className="rounded-xl border border-surface-800 bg-surface-900/40 p-4 hover:border-brand-500/50 hover:bg-surface-800/40 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-brand-500 shrink-0 mt-0.5">{sidebarIcons[tool.icon]}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-sm group-hover:text-brand-500 transition-colors">
                        {tool.label}
                      </div>
                      <p className="text-xs text-surface-500 mt-1">{tool.tagline}</p>
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
