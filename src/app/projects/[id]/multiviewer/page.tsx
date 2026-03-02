'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, LoadingSpinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { BroadcastSource, BroadcastSwitcherState } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Multiviewer — Monitoring wall with tally lights
// Grid of source tiles, UMD labels, audio meters, clock
// ────────────────────────────────────────────────────────────

type GridLayout = '2x2' | '3x3' | '4x4' | '1+5' | '2+4';

export default function MultiviewerPage({ params }: { params: { id: string } }) {
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<BroadcastSource[]>([]);
  const [switcherState, setSwitcherState] = useState<BroadcastSwitcherState | null>(null);
  const [layout, setLayout] = useState<GridLayout>('3x3');
  const [showLabels, setShowLabels] = useState(true);
  const [showAudioMeters, setShowAudioMeters] = useState(true);
  const clockRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  // ─── Live Clock ──────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      if (clockRef.current) {
        clockRef.current.textContent = now.toLocaleTimeString('nb-NO', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        });
      }
      if (dateRef.current) {
        dateRef.current.textContent = now.toLocaleDateString('nb-NO', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        });
      }
    }, 200);
    return () => clearInterval(iv);
  }, []);

  // ─── Data Fetching ───────────────────────────────
  const fetchSources = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_sources')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('sort_order');
    setSources(data || []);
  }, [projectId]);

  const fetchSwitcherState = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_switcher_state')
      .select('*')
      .eq('project_id', projectId)
      .single();
    if (data) setSwitcherState(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchSources();
    fetchSwitcherState();
  }, [fetchSources, fetchSwitcherState]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`multiview-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_sources', filter: `project_id=eq.${projectId}` }, () => fetchSources())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_switcher_state', filter: `project_id=eq.${projectId}` }, () => fetchSwitcherState())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, fetchSources, fetchSwitcherState]);

  // ─── Helpers ─────────────────────────────────────

  const getGridClass = () => {
    switch (layout) {
      case '2x2': return 'grid-cols-2 grid-rows-2';
      case '3x3': return 'grid-cols-3 grid-rows-3';
      case '4x4': return 'grid-cols-4 grid-rows-4';
      case '1+5': return 'grid-cols-3 grid-rows-3';
      case '2+4': return 'grid-cols-3 grid-rows-3';
      default: return 'grid-cols-3 grid-rows-3';
    }
  };

  const getTallyState = (sourceId: string) => {
    if (sourceId === switcherState?.program_source_id) return 'program';
    if (sourceId === switcherState?.preview_source_id) return 'preview';
    return 'off';
  };

  const getTallyBorder = (state: string) => {
    switch (state) {
      case 'program': return 'border-red-500 shadow-lg shadow-red-500/20';
      case 'preview': return 'border-green-500 shadow-lg shadow-green-500/20';
      default: return 'border-surface-700';
    }
  };

  const getTallyBg = (state: string) => {
    switch (state) {
      case 'program': return 'bg-red-950/30';
      case 'preview': return 'bg-green-950/30';
      default: return 'bg-surface-950';
    }
  };

  // Simulated audio level (in real use, would come from WebRTC/NDI)
  const getSimulatedAudioLevel = (sourceId: string) => {
    const tally = getTallyState(sourceId);
    if (tally === 'program') return 70 + Math.random() * 20;
    if (tally === 'preview') return 40 + Math.random() * 15;
    return Math.random() * 20;
  };

  // ─── Render ──────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-full bg-black"><LoadingSpinner /></div>;

  // For 1+5 layout: first source is large, rest are small
  const isSpecialLayout = layout === '1+5' || layout === '2+4';

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-screen bg-black select-none">
      {/* ── Control Bar ──────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-950 border-b border-surface-800">
        <div className="flex items-center gap-3">
          <h1 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Multiviewer</h1>
          <div className="flex items-center gap-1">
            {(['2x2', '3x3', '4x4', '1+5'] as GridLayout[]).map(l => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-bold rounded transition-colors',
                  layout === l ? 'bg-surface-600 text-white' : 'text-surface-500 hover:text-white'
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-surface-700" />
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={cn('text-[10px] px-2 py-0.5 rounded', showLabels ? 'bg-surface-700 text-white' : 'text-surface-500')}
          >
            UMD
          </button>
          <button
            onClick={() => setShowAudioMeters(!showAudioMeters)}
            className={cn('text-[10px] px-2 py-0.5 rounded', showAudioMeters ? 'bg-surface-700 text-white' : 'text-surface-500')}
          >
            Audio
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div ref={dateRef} className="text-[10px] text-surface-500" />
          <div ref={clockRef} className="font-mono text-xl text-red-500 font-bold tabular-nums" />
        </div>
      </div>

      {/* ── Multiview Grid ───────────────────────────── */}
      <div className={cn('flex-1 grid gap-1 p-1', getGridClass())}>
        {sources.map((src, idx) => {
          const tally = getTallyState(src.id);
          const isLargeInSpecial = isSpecialLayout && idx === 0;

          return (
            <div
              key={src.id}
              className={cn(
                'relative border-2 rounded overflow-hidden transition-all',
                getTallyBorder(tally),
                getTallyBg(tally),
                isLargeInSpecial && layout === '1+5' && 'col-span-2 row-span-2',
                isLargeInSpecial && layout === '2+4' && 'col-span-2 row-span-2',
              )}
            >
              {/* Tally Light */}
              <div className={cn(
                'absolute top-0 left-0 right-0 h-1 z-10',
                tally === 'program' && 'bg-red-500',
                tally === 'preview' && 'bg-green-500',
              )} />

              {/* Source Preview */}
              <div className="flex items-center justify-center h-full">
                {src.connection_url && src.source_type === 'web_feed' ? (
                  <iframe
                    src={src.connection_url}
                    className="w-full h-full border-0 pointer-events-none"
                    title={src.name}
                  />
                ) : (
                  <div className="text-center">
                    <div className={cn(
                      'font-bold mb-1',
                      isLargeInSpecial ? 'text-3xl' : 'text-xl',
                      tally === 'program' ? 'text-red-400/60' :
                      tally === 'preview' ? 'text-green-400/60' :
                      'text-surface-600/60'
                    )}>
                      {src.short_name || src.name}
                    </div>
                    <div className="text-[10px] text-surface-600">
                      {src.source_type}
                      {src.protocol && ` • ${src.protocol.toUpperCase()}`}
                    </div>
                  </div>
                )}
              </div>

              {/* UMD (Under Monitor Display) label */}
              {showLabels && (
                <div className={cn(
                  'absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1',
                  tally === 'program' ? 'bg-red-600' :
                  tally === 'preview' ? 'bg-green-700' :
                  'bg-surface-900/90'
                )}>
                  <span className={cn(
                    'text-[10px] font-bold uppercase truncate',
                    tally === 'program' || tally === 'preview' ? 'text-white' : 'text-surface-400'
                  )}>
                    {src.name}
                  </span>
                  {tally !== 'off' && (
                    <span className="text-[8px] font-bold text-white/80 uppercase">
                      {tally === 'program' ? 'PGM' : 'PVW'}
                    </span>
                  )}
                </div>
              )}

              {/* Audio Meter */}
              {showAudioMeters && (
                <div className="absolute top-2 right-2 flex flex-col gap-px">
                  <AudioMeter level={getSimulatedAudioLevel(src.id)} />
                </div>
              )}
            </div>
          );
        })}

        {/* Fill empty grid cells with black */}
        {Array.from({ length: Math.max(0, getGridSize(layout) - sources.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="border-2 border-surface-800 rounded bg-black flex items-center justify-center"
          >
            <span className="text-surface-800 text-xs">No Signal</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Audio Meter Component ─────────────────────────────────

function AudioMeter({ level }: { level: number }) {
  const segments = 10;
  const active = Math.round((level / 100) * segments);

  return (
    <div className="flex flex-col-reverse gap-px w-2">
      {Array.from({ length: segments }).map((_, i) => {
        const isActive = i < active;
        const isRed = i >= segments - 2;
        const isYellow = i >= segments - 4 && i < segments - 2;
        return (
          <div
            key={i}
            className={cn(
              'w-2 h-1 rounded-[1px] transition-all duration-75',
              isActive
                ? isRed ? 'bg-red-500' : isYellow ? 'bg-yellow-500' : 'bg-green-500'
                : 'bg-surface-800'
            )}
          />
        );
      })}
    </div>
  );
}

function getGridSize(layout: GridLayout): number {
  switch (layout) {
    case '2x2': return 4;
    case '3x3': return 9;
    case '4x4': return 16;
    case '1+5': return 6;
    case '2+4': return 6;
    default: return 9;
  }
}
