'use client';

/**
 * Arc / Act Planner — story planning mind-map canvas
 *
 * For episodic projects: Episode Arc Planner (existing behaviour)
 * For film/TV scripts:   Act Structure Planner — seeds default act nodes
 *
 * Route: /projects/[id]/arc-planner
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { LoadingSpinner, toast } from '@/components/ui';
import { ArcMindmap, type MindmapData, type MapNode } from '@/components/ArcMindmap';
import type { Script } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Default act-structure seed for non-episodic scripts
// Creates a horizontal waterfall of act/event nodes across the canvas
// ─────────────────────────────────────────────────────────────────────────────

function seedActStructure(): MindmapData {
  const acts: Array<{ type: MapNode['type']; label: string; body: string; color: string; x: number; y: number }> = [
    { type: 'arc',     label: 'Act 1 — Setup',           body: 'Establish world, hero, stakes. End with inciting incident.',         color: '#6366f1', x: 80,   y: 200 },
    { type: 'event',   label: 'Inciting Incident',        body: 'The event that kicks off the main conflict.',                         color: '#ec4899', x: 320,  y: 80  },
    { type: 'arc',     label: 'Act 1 Break',              body: 'Point of no return. Hero commits to the journey.',                    color: '#f97316', x: 560,  y: 200 },
    { type: 'arc',     label: 'Act 2A — Rising Action',   body: 'Hero pursues goal. Obstacles escalate. Alliances form.',             color: '#22c55e', x: 800,  y: 200 },
    { type: 'event',   label: 'Midpoint',                 body: 'False victory or defeat. Stakes double. No going back.',             color: '#14b8a6', x: 1040, y: 80  },
    { type: 'arc',     label: 'Act 2B — Complications',   body: 'Things fall apart. Reversal, betrayal, or revelation.',              color: '#3b82f6', x: 1280, y: 200 },
    { type: 'event',   label: 'All Is Lost',              body: 'Hero\'s darkest hour. Everything they wanted is gone.',               color: '#ef4444', x: 1520, y: 80  },
    { type: 'arc',     label: 'Act 3 — Climax',           body: 'Hero finds inner strength. Final confrontation and resolution.',     color: '#9333ea', x: 1760, y: 200 },
    { type: 'note',    label: 'Resolution',               body: 'New equilibrium. Show the changed world.',                           color: '#374151', x: 2000, y: 200 },
  ];
  const nodes: MapNode[] = acts.map((a) => ({
    id: crypto.randomUUID(),
    type: a.type,
    label: a.label,
    body: a.body,
    x: a.x,
    y: a.y,
    color: a.color,
  }));
  return { nodes, edges: [], version: 1 };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ArcPlannerPage({ params }: { params: { id: string } }) {
  const { user }           = useAuthStore();
  const { currentProject, members } = useProjectStore();

  const isEpisodic = currentProject?.script_type === 'episodic';

  const canEdit = (() => {
    if (!user) return false;
    const role = members.find((m) => m.user_id === user.id)?.role
      ?? (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
    return role !== 'viewer';
  })();

  const [episodes, setEpisodes]   = useState<Script[]>([]);
  const [arcData,  setArcData]    = useState<MindmapData | null>(null);
  const [loading,  setLoading]    = useState(true);

  // ── Load episodes + saved arc map ──────────────────────────────────────

  const load = useCallback(async () => {
    const supabase = createClient();

    const [{ data: scripts }, { data: project }] = await Promise.all([
      supabase
        .from('scripts')
        .select('*')
        .eq('project_id', params.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('projects')
        .select('content_metadata')
        .eq('id', params.id)
        .single(),
    ]);

    setEpisodes(scripts ?? []);

    // Decode saved arc map from content_metadata.arc_map (stored as JSON string)
    let loaded: MindmapData | null = null;
    try {
      const raw = (project?.content_metadata as Record<string, unknown> | null)?.arc_map;
      if (typeof raw === 'string') {
        loaded = JSON.parse(raw) as MindmapData;
      }
    } catch {
      // ignore parse errors — will start fresh
    }

    // For non-episodic scripts with no saved data, seed act structure nodes
    if (!loaded && currentProject && currentProject.script_type !== 'episodic') {
      loaded = seedActStructure();
    }

    setArcData(loaded);
    setLoading(false);
  }, [params.id, currentProject]);

  useEffect(() => { load(); }, [load]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100dvh-3rem)] md:h-[100dvh] flex flex-col bg-[#0d0d14]">
      {/* Top bar */}
      <div className="h-10 shrink-0 flex items-center px-3 gap-3 border-b border-white/5 bg-black/30 z-20">
        <Link
          href={isEpisodic ? `/projects/${params.id}/episodes` : `/projects/${params.id}/overview`}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {isEpisodic ? 'Episodes' : 'Overview'}
        </Link>
        <span className="text-white/20">/</span>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-sm font-semibold text-white/80">
            {isEpisodic ? 'Arc Planner' : 'Act Planner'}
          </span>
        </div>
        {currentProject && (
          <>
            <span className="text-white/20">·</span>
            <span className="text-xs text-white/40 truncate max-w-[200px]">{currentProject.title}</span>
          </>
        )}

        {!isEpisodic && (
          <>
            <span className="text-white/20">·</span>
            <span className="text-[10px] text-violet-400/60 italic">Act Structure Mode</span>
          </>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-3 text-[11px] text-white/25">
          <span>Double-click canvas = add node</span>
          <span>·</span>
          <span>Hover node ports to draw edges</span>
          <span>·</span>
          <span>⌘S to save</span>
        </div>

        {!canEdit && (
          <span className="px-2 py-0.5 rounded-full bg-surface-800 text-[10px] text-surface-400">
            View only
          </span>
        )}
      </div>

      {/* Canvas */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ArcMindmap
            projectId={params.id}
            initialData={arcData}
            episodes={isEpisodic ? episodes : []}
            canEdit={canEdit}
          />
        </div>
      )}
    </div>
  );
}

