'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { BroadcastAsRunLogEntry, BroadcastAsRunEventType, BroadcastRundown } from '@/lib/types';
import { formatBroadcastDuration, formatBroadcastTime } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// As-Run Log — official broadcast compliance log
// Records every event during a live show with precise timing
// ────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<BroadcastAsRunEventType, string> = {
  segment_start: 'bg-green-600', segment_end: 'bg-blue-600',
  break_start: 'bg-purple-600', break_end: 'bg-purple-500',
  graphic_on: 'bg-orange-600', graphic_off: 'bg-orange-500',
  source_switch: 'bg-cyan-600', override: 'bg-amber-600',
  manual_note: 'bg-surface-700', error: 'bg-red-700',
  show_start: 'bg-emerald-700', show_end: 'bg-surface-600',
};

const EVENT_LABELS: Record<BroadcastAsRunEventType, string> = {
  segment_start: 'SEG START', segment_end: 'SEG END',
  break_start: 'BREAK START', break_end: 'BREAK END',
  graphic_on: 'GFX ON', graphic_off: 'GFX OFF',
  source_switch: 'SRC SWITCH', override: 'OVERRIDE',
  manual_note: 'NOTE', error: 'ERROR',
  show_start: 'SHOW START', show_end: 'SHOW END',
};

export default function AsRunPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [rundowns, setRundowns] = useState<BroadcastRundown[]>([]);
  const [selectedRundownId, setSelectedRundownId] = useState<string | null>(null);
  const [entries, setEntries] = useState<BroadcastAsRunLogEntry[]>([]);
  const [filterEvent, setFilterEvent] = useState<BroadcastAsRunEventType | 'all'>('all');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  const listEndRef = useRef<HTMLDivElement>(null);

  // ─── Fetch ─────────────────────────────────────────────

  const fetchRundowns = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_rundowns')
      .select('*')
      .eq('project_id', projectId)
      .order('show_date', { ascending: false });
    setRundowns(data || []);
    if (data && data.length > 0 && !selectedRundownId) {
      const live = data.find(r => r.status === 'live');
      setSelectedRundownId(live?.id || data[0].id);
    }
  }, [projectId, selectedRundownId]);

  const fetchEntries = useCallback(async () => {
    if (!selectedRundownId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_as_run_log')
      .select('*')
      .eq('rundown_id', selectedRundownId)
      .order('actual_time', { ascending: true });
    setEntries(data || []);
  }, [selectedRundownId]);

  useEffect(() => {
    (async () => { await fetchRundowns(); setLoading(false); })();
  }, [fetchRundowns]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Realtime
  useEffect(() => {
    if (!selectedRundownId) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`asrun-${selectedRundownId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcast_as_run_log', filter: `rundown_id=eq.${selectedRundownId}` }, () => fetchEntries())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedRundownId, fetchEntries]);

  useEffect(() => {
    if (autoScroll && listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries.length, autoScroll]);

  // ─── Add Manual Note ───────────────────────────────────

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedRundownId) return;
    const supabase = createClient();
    const { error } = await supabase.from('broadcast_as_run_log').insert({
      rundown_id: selectedRundownId,
      project_id: projectId,
      event_type: 'manual_note' as BroadcastAsRunEventType,
      title: 'Manual Note',
      notes: noteText.trim(),
      operator: user?.email || user?.id,
    });
    if (error) { toast.error(error.message); return; }
    setNoteText('');
    setShowNoteInput(false);
    fetchEntries();
  };

  // ─── Export ────────────────────────────────────────────

  const handleExport = () => {
    const rundown = rundowns.find(r => r.id === selectedRundownId);
    const csv = [
      ['Time', 'Event', 'Title', 'Notes', 'Planned', 'Actual', 'Deviation'].join(','),
      ...entries.map(e => [
        e.actual_time || '',
        e.event_type,
        `"${(e.title || '').replace(/"/g, '""')}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`,
        e.planned_duration?.toString() || '',
        e.actual_duration?.toString() || '',
        e.deviation_seconds?.toString() || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `as-run-${rundown?.title || 'log'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('As-run log exported');
  };

  // ─── Filter ────────────────────────────────────────────

  const filtered = entries.filter(e => {
    if (filterEvent === 'all') return true;
    return e.event_type === filterEvent;
  });

  // Stats
  const showStart = entries.find(e => e.event_type === 'show_start');
  const showEnd = entries.find(e => e.event_type === 'show_end');
  const totalDeviations = entries.filter(e => e.deviation_seconds != null && e.deviation_seconds !== 0);
  const avgDeviation = totalDeviations.length > 0
    ? totalDeviations.reduce((sum, e) => sum + (e.deviation_seconds ?? 0), 0) / totalDeviations.length
    : 0;
  const maxOver = totalDeviations.length > 0 ? Math.max(0, ...totalDeviations.map(e => e.deviation_seconds)) : 0;
  const maxUnder = totalDeviations.length > 0 ? Math.min(0, ...totalDeviations.map(e => e.deviation_seconds)) : 0;

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-screen bg-surface-950">
      {/* Main log */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-surface-800 bg-surface-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-white">As-Run Log</h2>
            <select
              value={selectedRundownId || ''}
              onChange={(e) => setSelectedRundownId(e.target.value)}
              className="bg-surface-800 text-white border border-surface-700 rounded px-2 py-1 text-xs"
            >
              {rundowns.map(r => (
                <option key={r.id} value={r.id}>
                  {r.title} {r.status === 'live' ? '● LIVE' : r.status === 'completed' ? '✓' : ''}
                </option>
              ))}
            </select>
            <select
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value as BroadcastAsRunEventType | 'all')}
              className="bg-surface-800 text-white border border-surface-700 rounded px-2 py-1 text-xs"
            >
              <option value="all">All Events ({entries.length})</option>
              {(Object.keys(EVENT_LABELS) as BroadcastAsRunEventType[]).map(k => {
                const count = entries.filter(e => e.event_type === k).length;
                if (count === 0) return null;
                return <option key={k} value={k}>{EVENT_LABELS[k]} ({count})</option>;
              })}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-surface-400">
              <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="rounded bg-surface-800 border-surface-600" />
              Auto-scroll
            </label>
            <Button size="sm" variant="ghost" onClick={() => setShowNoteInput(!showNoteInput)}>+ Note</Button>
            <Button size="sm" variant="ghost" onClick={handleExport} disabled={entries.length === 0}>Export CSV</Button>
          </div>
        </div>

        {/* Note input */}
        {showNoteInput && (
          <div className="p-2 border-b border-surface-800 flex gap-2">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              placeholder="Add manual note to as-run log..."
              className="flex-1 bg-surface-800 text-white border border-surface-700 rounded px-3 py-1.5 text-sm"
              autoFocus
            />
            <Button size="sm" onClick={handleAddNote}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNoteInput(false)}>Cancel</Button>
          </div>
        )}

        {/* Column headers */}
        <div className="grid grid-cols-[100px_90px_200px_1fr_70px_70px_70px] px-3 py-1.5 text-[10px] font-bold text-surface-500 uppercase border-b border-surface-800/50">
          <span>Time</span><span>Event</span><span>Title</span><span>Notes</span>
          <span className="text-right">Planned</span><span className="text-right">Actual</span><span className="text-right">Dev</span>
        </div>

        {/* Log entries */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState
                title="No Log Entries"
                description="As-run entries are recorded automatically when the show is live."
              />
            </div>
          ) : (
            filtered.map(entry => (
              <div
                key={entry.id}
                className={cn(
                  'grid grid-cols-[100px_90px_200px_1fr_70px_70px_70px] px-3 py-2 border-b border-surface-800/30 text-xs items-center',
                  entry.event_type === 'show_start' && 'bg-emerald-950/20',
                  entry.event_type === 'show_end' && 'bg-surface-800/30',
                  entry.event_type === 'error' && 'bg-red-950/10',
                  entry.event_type === 'manual_note' && 'bg-surface-800/20 italic',
                )}
              >
                <span className="text-surface-400 font-mono text-[11px]">
                  {formatBroadcastTime(entry.actual_time)}
                </span>
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded text-white w-fit', EVENT_COLORS[entry.event_type])}>
                  {EVENT_LABELS[entry.event_type]}
                </span>
                <span className="text-surface-300 truncate">{entry.title || '—'}</span>
                <span className="text-surface-400 truncate">{entry.notes || ''}</span>
                <span className="text-right text-surface-500 font-mono">
                  {entry.planned_duration != null ? formatBroadcastDuration(entry.planned_duration) : ''}
                </span>
                <span className="text-right text-surface-300 font-mono">
                  {entry.actual_duration != null ? formatBroadcastDuration(entry.actual_duration) : ''}
                </span>
                <span className={cn('text-right font-mono font-bold',
                  entry.deviation_seconds > 0 ? 'text-red-400' :
                  entry.deviation_seconds < 0 ? 'text-blue-400' : 'text-surface-600'
                )}>
                  {entry.deviation_seconds !== 0
                    ? `${entry.deviation_seconds > 0 ? '+' : ''}${entry.deviation_seconds}s`
                    : ''}
                </span>
              </div>
            ))
          )}
          <div ref={listEndRef} />
        </div>
      </div>

      {/* Stats sidebar */}
      <div className="w-64 border-l border-surface-800 p-4 space-y-4 overflow-y-auto bg-surface-900/30">
        <h3 className="text-xs font-bold text-surface-400 uppercase">Show Summary</h3>

        <StatBox label="Total Events" value={entries.length.toString()} />
        <StatBox label="Show Start" value={showStart ? formatBroadcastTime(showStart.actual_time) : 'Not started'} />
        <StatBox label="Show End" value={showEnd ? formatBroadcastTime(showEnd.actual_time) : 'Not ended'} />
        <StatBox label="Segments" value={entries.filter(e => e.event_type === 'segment_start').length.toString()} />
        <StatBox label="Source Switches" value={entries.filter(e => e.event_type === 'source_switch').length.toString()} />
        <StatBox label="Errors" value={entries.filter(e => e.event_type === 'error').length.toString()} danger={entries.filter(e => e.event_type === 'error').length > 0} />

        <div className="border-t border-surface-800 pt-4">
          <h3 className="text-xs font-bold text-surface-400 uppercase mb-3">Timing</h3>
          <StatBox
            label="Avg Deviation"
            value={totalDeviations.length > 0 ? `${avgDeviation > 0 ? '+' : ''}${avgDeviation.toFixed(1)}s` : 'N/A'}
          />
          <StatBox label="Max Over" value={maxOver > 0 ? `+${maxOver}s` : '—'} danger={maxOver > 5} />
          <StatBox label="Max Under" value={maxUnder < 0 ? `${maxUnder}s` : '—'} />
        </div>

        <div className="border-t border-surface-800 pt-4">
          <h3 className="text-xs font-bold text-surface-400 uppercase mb-3">Graphics</h3>
          <StatBox label="Graphics On" value={entries.filter(e => e.event_type === 'graphic_on').length.toString()} />
          <StatBox label="Graphics Off" value={entries.filter(e => e.event_type === 'graphic_off').length.toString()} />
        </div>

        <div className="border-t border-surface-800 pt-4">
          <h3 className="text-xs font-bold text-surface-400 uppercase mb-2">Manual Notes</h3>
          <div className="space-y-1.5">
            {entries.filter(e => e.event_type === 'manual_note').map(e => (
              <div key={e.id} className="text-[10px]">
                <span className="text-surface-500">{formatBroadcastTime(e.actual_time)}</span>
                <span className="text-surface-300 ml-2">{e.notes}</span>
              </div>
            ))}
            {entries.filter(e => e.event_type === 'manual_note').length === 0 && (
              <p className="text-[10px] text-surface-600">No notes</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-surface-500">{label}</span>
      <span className={cn('text-sm font-bold', danger ? 'text-red-400' : 'text-white')}>{value}</span>
    </div>
  );
}
