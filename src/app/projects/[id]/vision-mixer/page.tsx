'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, Modal, Input, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
  BroadcastSource, BroadcastSwitcherState, BroadcastTransitionType,
} from '@/lib/types';
import { BROADCAST_TRANSITION_TYPES } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Vision Mixer — Live Production Switcher
// Program/Preview bus, transitions, keyers, DSK, FTB
// ────────────────────────────────────────────────────────────

export default function VisionMixerPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject } = useProjectStore();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<BroadcastSource[]>([]);
  const [switcherState, setSwitcherState] = useState<BroadcastSwitcherState | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [tBarPosition, setTBarPosition] = useState(0); // 0..100
  const clockRef = useRef<HTMLDivElement>(null);

  // ─── Live Clock ──────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      if (clockRef.current) {
        const now = new Date();
        clockRef.current.textContent = now.toLocaleTimeString('nb-NO', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        });
      }
    }, 200);
    return () => clearInterval(iv);
  }, []);

  // ─── Data Fetching ───────────────────────────────────
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

    if (data) {
      setSwitcherState(data);
    } else {
      // Initialize switcher state for this project
      const { data: newState, error } = await supabase
        .from('broadcast_switcher_state')
        .insert({
          project_id: projectId,
          transition_type: 'cut',
          transition_duration_ms: 500,
        })
        .select()
        .single();
      if (!error && newState) setSwitcherState(newState);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchSources();
    fetchSwitcherState();
  }, [fetchSources, fetchSwitcherState]);

  // Realtime sync - critical for multi-operator setups
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`vision-mixer-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_switcher_state', filter: `project_id=eq.${projectId}` }, () => fetchSwitcherState())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_sources', filter: `project_id=eq.${projectId}` }, () => fetchSources())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, fetchSwitcherState, fetchSources]);

  // ─── Switcher Actions ────────────────────────────────

  const updateSwitcher = async (updates: Partial<BroadcastSwitcherState>) => {
    if (!switcherState) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('broadcast_switcher_state')
      .update({ ...updates, operator_id: user?.id })
      .eq('id', switcherState.id);
    if (error) toast.error(error.message);
  };

  const setPreview = async (sourceId: string) => {
    await updateSwitcher({ preview_source_id: sourceId });
    // Update tally
    await updateTally(sourceId, 'preview');
  };

  const setProgram = async (sourceId: string) => {
    await updateSwitcher({ program_source_id: sourceId, last_take_at: new Date().toISOString() });
    await updateTally(sourceId, 'program');
    // Log to as-run
    const src = sources.find(s => s.id === sourceId);
    if (src) logAsRun('source_switch', `PGM → ${src.name}`);
  };

  const executeTake = async () => {
    if (!switcherState?.preview_source_id) return;
    setTransitioning(true);

    const prevProgram = switcherState.program_source_id;
    const newProgram = switcherState.preview_source_id;

    // CUT is instant, others animate
    if (switcherState.transition_type === 'cut') {
      await updateSwitcher({
        program_source_id: newProgram,
        preview_source_id: prevProgram,
        last_take_at: new Date().toISOString(),
      });
    } else {
      // For MIX/WIPE etc - simulate transition
      await updateSwitcher({
        program_source_id: newProgram,
        preview_source_id: prevProgram,
        last_take_at: new Date().toISOString(),
      });
    }

    // Update tallies
    if (prevProgram) await updateTally(prevProgram, 'off');
    await updateTally(newProgram, 'program');
    if (prevProgram) await updateTally(prevProgram, 'preview');

    const src = sources.find(s => s.id === newProgram);
    if (src) logAsRun('source_switch', `TAKE → ${src.name}`);

    setTimeout(() => setTransitioning(false), switcherState.transition_type === 'cut' ? 50 : switcherState.transition_duration_ms);
  };

  const executeAuto = async () => {
    // Auto transition with T-bar animation
    setTransitioning(true);
    const duration = switcherState?.transition_duration_ms || 500;
    const steps = 20;
    const stepDuration = duration / steps;

    for (let i = 0; i <= steps; i++) {
      setTBarPosition((i / steps) * 100);
      await new Promise(r => setTimeout(r, stepDuration));
    }

    await executeTake();
    setTBarPosition(0);
  };

  const executeFTB = async () => {
    const newState = !switcherState?.ftb_active;
    await updateSwitcher({ ftb_active: newState });
    logAsRun(newState ? 'override' : 'source_switch', newState ? 'FADE TO BLACK' : 'FADE UP from BLACK');
  };

  const updateTally = async (sourceId: string, state: 'off' | 'preview' | 'program') => {
    const supabase = createClient();
    await supabase
      .from('broadcast_sources')
      .update({ tally_state: state })
      .eq('id', sourceId);
  };

  const logAsRun = async (eventType: string, title: string) => {
    const supabase = createClient();
    await supabase.from('broadcast_as_run_log').insert({
      project_id: projectId,
      event_type: eventType,
      title,
      operator: user?.email || user?.id,
      is_automatic: false,
    });
  };

  // ─── Helpers ─────────────────────────────────────────

  const getSourceName = (id: string | null) => {
    if (!id) return '—';
    return sources.find(s => s.id === id)?.name || 'Unknown';
  };

  const getSourceShort = (id: string | null) => {
    if (!id) return '—';
    const s = sources.find(s => s.id === id);
    return s?.short_name || s?.name?.substring(0, 6) || '?';
  };

  // ─── Render ──────────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  const programSource = sources.find(s => s.id === switcherState?.program_source_id);
  const previewSource = sources.find(s => s.id === switcherState?.preview_source_id);

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-screen bg-black text-white select-none">
      {/* ── Top Bar: Status ──────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-950 border-b border-surface-800">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold uppercase tracking-wider text-surface-300">Vision Mixer</h1>
          <div className="flex items-center gap-2">
            {switcherState?.ftb_active && (
              <Badge className="bg-red-600 text-white animate-pulse">FTB</Badge>
            )}
            {transitioning && (
              <Badge className="bg-amber-600 text-black">TRANSITION</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-xs text-surface-500">
            Operator: <span className="text-surface-300">{user?.email?.split('@')[0] || 'Unknown'}</span>
          </div>
          <div ref={clockRef} className="font-mono text-lg text-red-500 font-bold tabular-nums" />
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Preview/Program Monitors */}
        <div className="grid grid-cols-2 gap-1 p-2 flex-shrink-0" style={{ height: '40%' }}>
          {/* Preview Monitor */}
          <div className="relative rounded-lg overflow-hidden border-2 border-green-500 bg-surface-950">
            <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
              <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Preview</span>
              <span className="text-xs text-white/80 font-mono">{getSourceName(switcherState?.preview_source_id || null)}</span>
            </div>
            <div className="flex items-center justify-center h-full">
              {previewSource ? (
                previewSource.connection_url ? (
                  <div className="relative w-full h-full bg-gradient-to-br from-green-950/30 to-surface-950 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl font-black text-green-400/60 mb-2">{previewSource.short_name || previewSource.name}</div>
                      <div className="text-xs text-surface-500">{previewSource.source_type} • {previewSource.protocol || 'SDI'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-3xl font-black text-green-400/40">{previewSource.short_name || previewSource.name}</div>
                    <div className="text-xs text-surface-600 mt-1">{previewSource.source_type}</div>
                  </div>
                )
              ) : (
                <div className="text-surface-700 text-sm">No Preview Source</div>
              )}
            </div>
          </div>

          {/* Program Monitor */}
          <div className={cn(
            'relative rounded-lg overflow-hidden border-2 bg-surface-950',
            switcherState?.ftb_active ? 'border-red-900' : 'border-red-500'
          )}>
            <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
              <span className={cn(
                'text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase',
                switcherState?.ftb_active ? 'bg-red-900 animate-pulse' : 'bg-red-600'
              )}>
                {switcherState?.ftb_active ? 'FTB' : 'Program'}
              </span>
              <span className="text-xs text-white/80 font-mono">{getSourceName(switcherState?.program_source_id || null)}</span>
            </div>
            <div className="flex items-center justify-center h-full">
              {switcherState?.ftb_active ? (
                <div className="text-red-800 text-xl font-black animate-pulse">FADE TO BLACK</div>
              ) : programSource ? (
                <div className="relative w-full h-full bg-gradient-to-br from-red-950/30 to-surface-950 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl font-black text-red-400/60 mb-2">{programSource.short_name || programSource.name}</div>
                    <div className="text-xs text-surface-500">{programSource.source_type} • {programSource.protocol || 'SDI'}</div>
                    {switcherState?.pip_enabled && switcherState.pip_source_id && (
                      <div className="mt-2 text-[10px] text-amber-400">PiP: {getSourceName(switcherState.pip_source_id)}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-surface-700 text-sm">No Program Source</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Source Buses ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* Program Bus */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Program Bus</span>
              <div className="flex-1 h-px bg-red-900/40" />
            </div>
            <div className="flex flex-wrap gap-1">
              {sources.map(src => (
                <button
                  key={`pgm-${src.id}`}
                  onClick={() => setProgram(src.id)}
                  className={cn(
                    'px-3 py-2 text-xs font-bold rounded transition-all duration-100 min-w-[80px] text-center uppercase',
                    switcherState?.program_source_id === src.id
                      ? 'bg-red-600 text-white ring-2 ring-red-400 shadow-lg shadow-red-600/30'
                      : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                  )}
                >
                  {src.short_name || src.name}
                </button>
              ))}
              <button
                onClick={() => updateSwitcher({ program_source_id: null })}
                className="px-3 py-2 text-xs font-bold rounded bg-surface-900 text-surface-600 hover:bg-surface-800 min-w-[80px] uppercase"
              >
                BLK
              </button>
            </div>
          </div>

          {/* Preview Bus */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Preview Bus</span>
              <div className="flex-1 h-px bg-green-900/40" />
            </div>
            <div className="flex flex-wrap gap-1">
              {sources.map(src => (
                <button
                  key={`pvw-${src.id}`}
                  onClick={() => setPreview(src.id)}
                  className={cn(
                    'px-3 py-2 text-xs font-bold rounded transition-all duration-100 min-w-[80px] text-center uppercase',
                    switcherState?.preview_source_id === src.id
                      ? 'bg-green-600 text-white ring-2 ring-green-400 shadow-lg shadow-green-600/30'
                      : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                  )}
                >
                  {src.short_name || src.name}
                </button>
              ))}
            </div>
          </div>

          {/* ── Transition Controls ───────────────────── */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
            {/* Transition Type */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider px-1">Transition Style</div>
              <div className="grid grid-cols-4 gap-1">
                {BROADCAST_TRANSITION_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => updateSwitcher({ transition_type: t.value })}
                    className={cn(
                      'px-2 py-1.5 text-[11px] font-bold rounded transition-colors text-center',
                      switcherState?.transition_type === t.value
                        ? 'bg-amber-600 text-black'
                        : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {/* Duration */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] text-surface-500">Duration:</span>
                {[250, 500, 1000, 2000].map(ms => (
                  <button
                    key={ms}
                    onClick={() => updateSwitcher({ transition_duration_ms: ms })}
                    className={cn(
                      'px-2 py-1 text-[10px] rounded font-mono',
                      switcherState?.transition_duration_ms === ms
                        ? 'bg-surface-600 text-white'
                        : 'bg-surface-800 text-surface-500 hover:text-white'
                    )}
                  >
                    {ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}
                  </button>
                ))}
              </div>
            </div>

            {/* T-Bar & Action Buttons */}
            <div className="flex flex-col items-center gap-2 min-w-[120px]">
              <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Control</div>
              {/* T-Bar */}
              <div className="relative w-8 h-32 bg-surface-800 rounded-full overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-600 to-amber-400 transition-all duration-75 rounded-full"
                  style={{ height: `${tBarPosition}%` }}
                />
                <input
                  type="range"
                  min="0" max="100"
                  value={tBarPosition}
                  onChange={(e) => setTBarPosition(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize"
                  style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                />
              </div>
              <div className="space-y-1 w-full">
                <button
                  onClick={executeTake}
                  disabled={!switcherState?.preview_source_id || transitioning}
                  className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:bg-surface-800 disabled:text-surface-600 text-white text-xs font-black uppercase rounded transition-colors"
                >
                  TAKE
                </button>
                <button
                  onClick={executeAuto}
                  disabled={!switcherState?.preview_source_id || transitioning}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-surface-800 disabled:text-surface-600 text-black text-xs font-black uppercase rounded transition-colors"
                >
                  AUTO
                </button>
              </div>
            </div>

            {/* Keyers & FTB */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider px-1">Keyers & Output</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => updateSwitcher({ dsk_1_on_air: !switcherState?.dsk_1_on_air })}
                  className={cn(
                    'px-2 py-2 text-[11px] font-bold rounded transition-colors',
                    switcherState?.dsk_1_on_air
                      ? 'bg-yellow-500 text-black'
                      : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                  )}
                >
                  DSK 1
                </button>
                <button
                  onClick={() => updateSwitcher({ dsk_2_on_air: !switcherState?.dsk_2_on_air })}
                  className={cn(
                    'px-2 py-2 text-[11px] font-bold rounded transition-colors',
                    switcherState?.dsk_2_on_air
                      ? 'bg-yellow-500 text-black'
                      : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                  )}
                >
                  DSK 2
                </button>
                <button
                  onClick={() => updateSwitcher({ usk_1_on_air: !switcherState?.usk_1_on_air })}
                  className={cn(
                    'px-2 py-2 text-[11px] font-bold rounded transition-colors',
                    switcherState?.usk_1_on_air
                      ? 'bg-orange-500 text-black'
                      : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                  )}
                >
                  KEY 1
                </button>
                <button
                  onClick={() => updateSwitcher({ pip_enabled: !switcherState?.pip_enabled })}
                  className={cn(
                    'px-2 py-2 text-[11px] font-bold rounded transition-colors',
                    switcherState?.pip_enabled
                      ? 'bg-cyan-500 text-black'
                      : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                  )}
                >
                  PiP
                </button>
              </div>
              {/* FTB */}
              <button
                onClick={executeFTB}
                className={cn(
                  'w-full py-3 text-xs font-black uppercase rounded transition-all',
                  switcherState?.ftb_active
                    ? 'bg-red-700 text-white ring-2 ring-red-400 animate-pulse'
                    : 'bg-surface-800 text-surface-400 hover:bg-red-900 hover:text-red-300'
                )}
              >
                FTB
              </button>
              {/* Audio Follow Video */}
              <button
                onClick={() => updateSwitcher({ audio_follow_video: !switcherState?.audio_follow_video })}
                className={cn(
                  'w-full py-2 text-[10px] font-bold rounded transition-colors',
                  switcherState?.audio_follow_video
                    ? 'bg-surface-700 text-green-400'
                    : 'bg-surface-800 text-surface-500'
                )}
              >
                AFV {switcherState?.audio_follow_video ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* ── Source Tally Overview ──────────────────── */}
          {sources.length > 0 && (
            <div className="space-y-1 pb-4">
              <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider px-1">Source Tally</div>
              <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1">
                {sources.map(src => (
                  <div
                    key={`tally-${src.id}`}
                    className={cn(
                      'text-center py-2 rounded text-[10px] font-bold transition-all',
                      src.id === switcherState?.program_source_id
                        ? 'bg-red-600 text-white ring-1 ring-red-400'
                        : src.id === switcherState?.preview_source_id
                        ? 'bg-green-600 text-white ring-1 ring-green-400'
                        : 'bg-surface-900 text-surface-600'
                    )}
                  >
                    {src.short_name || src.name?.substring(0, 5)}
                    <div className="text-[8px] mt-0.5 opacity-70">{src.source_type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sources.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                title="No sources configured"
                description="Add sources in the Sources page, then return here to switch between them live."
                icon={<svg className="w-12 h-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" /></svg>}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
