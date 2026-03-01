'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
  BroadcastRundown, BroadcastRundownItem, BroadcastRundownItemType,
  BroadcastRundownStatus, BroadcastRundownItemStatus, BroadcastStory,
} from '@/lib/types';
import {
  BROADCAST_ITEM_TYPES, BROADCAST_RUNDOWN_STATUS_OPTIONS, BROADCAST_STORY_STATUS_OPTIONS,
  formatBroadcastDuration, formatBroadcastTime, calculateBackTimes,
} from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Rundown Page — Production broadcast rundown with real timing
// ────────────────────────────────────────────────────────────

export default function RundownPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject } = useProjectStore();
  const projectId = params.id;

  // ─── State ─────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [rundowns, setRundowns] = useState<BroadcastRundown[]>([]);
  const [activeRundown, setActiveRundown] = useState<BroadcastRundown | null>(null);
  const [items, setItems] = useState<BroadcastRundownItem[]>([]);
  const [wallClock, setWallClock] = useState(new Date());

  // Timing engine state (from API)
  const [timingData, setTimingData] = useState<{
    over_under: { total_planned: number; total_actual: number; over_under: number; show_elapsed: number; items_remaining: number } | null;
    back_times: { item_id: string; back_time: string; cumulative_seconds: number }[];
  }>({ over_under: null, back_times: [] });

  // Modals
  const [showCreateRundown, setShowCreateRundown] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<BroadcastRundownItem | null>(null);

  // Stories
  const [stories, setStories] = useState<BroadcastStory[]>([]);

  // Drag-and-drop reorder
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Refs for timing
  const clockRef = useRef<ReturnType<typeof setInterval>>();
  const pollingRef = useRef<ReturnType<typeof setInterval>>();

  // ─── Data Fetching ─────────────────────────────────────

  const fetchRundowns = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_rundowns')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_template', false)
      .order('show_date', { ascending: false });
    setRundowns(data || []);
    return data || [];
  }, [projectId]);

  const fetchStories = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_stories')
      .select('*')
      .eq('project_id', projectId)
      .not('status', 'eq', 'killed')
      .order('updated_at', { ascending: false });
    setStories((data as BroadcastStory[]) || []);
  }, [projectId]);

  const fetchItems = useCallback(async (rundownId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_rundown_items')
      .select('*')
      .eq('rundown_id', rundownId)
      .order('sort_order', { ascending: true });
    setItems(data || []);
  }, []);

  const fetchTiming = useCallback(async (rundownId: string) => {
    try {
      const res = await fetch(`/api/broadcast/timing?rundown_id=${rundownId}`);
      if (res.ok) {
        const data = await res.json();
        setTimingData({
          over_under: data.timing?.over_under || null,
          back_times: data.timing?.back_times || [],
        });
        // Sync rundown status from server
        if (data.rundown && activeRundown) {
          setActiveRundown(prev => prev ? { ...prev, ...data.rundown } : prev);
        }
      }
    } catch (e) {
      // Non-fatal: timing is supplementary
      console.warn('Timing fetch failed:', e);
    }
  }, [activeRundown]);

  // Initial load
  useEffect(() => {
    fetchStories();
    (async () => {
      const rdList = await fetchRundowns();
      // Auto-select the most recent non-archived or live rundown
      const live = rdList.find((r: BroadcastRundown) => r.status === 'live');
      const recent = rdList.find((r: BroadcastRundown) => r.status !== 'archived');
      const target = live || recent || rdList[0];
      if (target) {
        setActiveRundown(target);
        await fetchItems(target.id);
      }
      setLoading(false);
    })();
  }, [fetchRundowns, fetchItems]);

  // Fetch items when active rundown changes
  useEffect(() => {
    if (activeRundown) {
      fetchItems(activeRundown.id);
      fetchTiming(activeRundown.id);
    }
  }, [activeRundown?.id]);

  // Wall clock — ticks every second
  useEffect(() => {
    clockRef.current = setInterval(() => setWallClock(new Date()), 1000);
    return () => clearInterval(clockRef.current);
  }, []);

  // Timing polling — every 2s when live, every 10s otherwise
  useEffect(() => {
    if (!activeRundown) return;
    const interval = activeRundown.status === 'live' ? 2000 : 10000;
    pollingRef.current = setInterval(() => {
      fetchTiming(activeRundown.id);
      if (activeRundown.status === 'live') fetchItems(activeRundown.id);
    }, interval);
    return () => clearInterval(pollingRef.current);
  }, [activeRundown?.id, activeRundown?.status, fetchTiming, fetchItems]);

  // Supabase Realtime subscription for rundown items
  useEffect(() => {
    if (!activeRundown) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`rundown-${activeRundown.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'broadcast_rundown_items', filter: `rundown_id=eq.${activeRundown.id}` },
        () => {
          fetchItems(activeRundown.id);
          fetchTiming(activeRundown.id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'broadcast_rundowns', filter: `id=eq.${activeRundown.id}` },
        (payload) => {
          setActiveRundown(prev => prev ? { ...prev, ...payload.new } : prev);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeRundown?.id, fetchItems, fetchTiming]);

  // ─── Timing Helpers (client-side) ──────────────────────

  const backTimeMap = useMemo(() => {
    if (!activeRundown) return new Map<string, Date>();
    return calculateBackTimes(items, new Date(activeRundown.scheduled_end));
  }, [items, activeRundown?.scheduled_end]);

  const cumulativeMap = useMemo(() => {
    const map = new Map<string, number>();
    let cum = 0;
    for (const item of items) {
      if (item.status === 'killed' || item.status === 'skipped') continue;
      cum += item.planned_duration;
      map.set(item.id, cum);
    }
    return map;
  }, [items]);

  const totalPlannedDuration = useMemo(() => {
    return items
      .filter(i => i.status !== 'killed' && i.status !== 'skipped')
      .reduce((sum, i) => sum + i.planned_duration, 0);
  }, [items]);

  // ─── Actions ───────────────────────────────────────────

  const callTimingAction = async (action: string, itemId?: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/broadcast/timing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rundown_id: activeRundown?.id,
          item_id: itemId,
          data: { project_id: projectId, operator: user?.full_name || user?.email, operator_id: user?.id, ...extra },
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      // Refresh
      if (activeRundown) {
        await fetchItems(activeRundown.id);
        await fetchTiming(activeRundown.id);
        await fetchRundowns();
      }
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Action failed';
      toast.error(msg);
    }
  };

  const handleStartShow = () => callTimingAction('start_show');
  const handleEndShow = () => callTimingAction('end_show');
  const handleTakeItem = (itemId: string) => callTimingAction('take_item', itemId);
  const handleCompleteItem = (itemId: string) => callTimingAction('complete_item', itemId);
  const handleKillItem = (itemId: string) => callTimingAction('kill_item', itemId);
  const handleSkipItem = (itemId: string) => callTimingAction('skip_item', itemId);

  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const next = [...items];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    await handleDragReorder(next);
  };

  const handleDragReorder = async (reordered: BroadcastRundownItem[]) => {
    // Optimistic
    setItems(reordered);
    const supabase = createClient();
    await Promise.all(
      reordered.map((item, i) =>
        supabase.from('broadcast_rundown_items').update({ sort_order: i * 10 }).eq('id', item.id)
      )
    );
  };

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragEnd = () => { setDraggedId(null); setDragOverId(null); };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== draggedId) setDragOverId(id);
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) { handleDragEnd(); return; }
    const from = items.findIndex(i => i.id === draggedId);
    const to = items.findIndex(i => i.id === targetId);
    if (from === -1 || to === -1) { handleDragEnd(); return; }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    handleDragReorder(next);
    handleDragEnd();
  };

  // ─── Create Rundown ────────────────────────────────────

  const [newRundown, setNewRundown] = useState({
    title: '', show_date: new Date().toISOString().split('T')[0],
    scheduled_start: '', scheduled_end: '',
  });

  const handleCreateRundown = async () => {
    if (!newRundown.title || !newRundown.scheduled_start || !newRundown.scheduled_end) {
      toast.error('Fill in all fields');
      return;
    }
    const supabase = createClient();
    const startISO = new Date(`${newRundown.show_date}T${newRundown.scheduled_start}:00`).toISOString();
    const endISO = new Date(`${newRundown.show_date}T${newRundown.scheduled_end}:00`).toISOString();

    const { data, error } = await supabase
      .from('broadcast_rundowns')
      .insert({
        project_id: projectId,
        title: newRundown.title,
        show_date: newRundown.show_date,
        scheduled_start: startISO,
        scheduled_end: endISO,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) { toast.error(error.message); return; }
    toast.success('Rundown created');
    setShowCreateRundown(false);
    setNewRundown({ title: '', show_date: new Date().toISOString().split('T')[0], scheduled_start: '', scheduled_end: '' });
    await fetchRundowns();
    if (data) { setActiveRundown(data); fetchItems(data.id); }
  };

  // ─── Add / Edit Item ──────────────────────────────────

  const [itemForm, setItemForm] = useState({
    title: '', item_type: 'anchor_read' as BroadcastRundownItemType,
    planned_duration: 30, page_number: '', segment_slug: '',
    camera: '', audio_source: '', video_source: '',
    presenter: '', reporter: '',
    prompter_text: '', director_notes: '', production_notes: '',
    is_float: false, is_break: false,
    story_id: null as string | null,
  });

  const resetItemForm = () => {
    setItemForm({
      title: '', item_type: 'anchor_read', planned_duration: 30,
      page_number: '', segment_slug: '', camera: '', audio_source: '', video_source: '',
      presenter: '', reporter: '', prompter_text: '', director_notes: '', production_notes: '',
      is_float: false, is_break: false, story_id: null,
    });
    setEditingItem(null);
  };

  const openEditItem = (item: BroadcastRundownItem) => {
    setItemForm({
      title: item.title, item_type: item.item_type, planned_duration: item.planned_duration,
      page_number: item.page_number || '', segment_slug: item.segment_slug || '',
      camera: item.camera || '', audio_source: item.audio_source || '', video_source: item.video_source || '',
      presenter: item.presenter || '', reporter: item.reporter || '',
      prompter_text: item.prompter_text || '', director_notes: item.director_notes || '',
      production_notes: item.production_notes || '',
      is_float: item.is_float, is_break: item.is_break, story_id: item.story_id,
    });
    setEditingItem(item);
    setShowAddItem(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.title || !activeRundown) { toast.error('Title is required'); return; }
    const supabase = createClient();

    if (editingItem) {
      // Update
      const { error } = await supabase
        .from('broadcast_rundown_items')
        .update({
          title: itemForm.title,
          item_type: itemForm.item_type,
          planned_duration: itemForm.planned_duration,
          page_number: itemForm.page_number || null,
          segment_slug: itemForm.segment_slug || null,
          camera: itemForm.camera || null,
          audio_source: itemForm.audio_source || null,
          video_source: itemForm.video_source || null,
          presenter: itemForm.presenter || null,
          reporter: itemForm.reporter || null,
          prompter_text: itemForm.prompter_text || null,
          director_notes: itemForm.director_notes || null,
          production_notes: itemForm.production_notes || null,
          is_float: itemForm.is_float,
          is_break: itemForm.is_break,
          story_id: itemForm.story_id || null,
        })
        .eq('id', editingItem.id);

      if (error) { toast.error(error.message); return; }
      toast.success('Item updated');
    } else {
      // Insert
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) : 0;
      const { error } = await supabase
        .from('broadcast_rundown_items')
        .insert({
          rundown_id: activeRundown.id,
          title: itemForm.title,
          item_type: itemForm.item_type,
          planned_duration: itemForm.planned_duration,
          page_number: itemForm.page_number || null,
          segment_slug: itemForm.segment_slug || null,
          sort_order: maxOrder + 10,
          camera: itemForm.camera || null,
          audio_source: itemForm.audio_source || null,
          video_source: itemForm.video_source || null,
          presenter: itemForm.presenter || null,
          reporter: itemForm.reporter || null,
          prompter_text: itemForm.prompter_text || null,
          director_notes: itemForm.director_notes || null,
          production_notes: itemForm.production_notes || null,
          is_float: itemForm.is_float,
          is_break: itemForm.is_break,
          story_id: itemForm.story_id || null,
        });

      if (error) { toast.error(error.message); return; }
      toast.success('Item added');
    }

    setShowAddItem(false);
    resetItemForm();
    fetchItems(activeRundown.id);
    fetchTiming(activeRundown.id);
  };

  const handleDeleteItem = async (itemId: string) => {
    const supabase = createClient();
    await supabase.from('broadcast_rundown_items').delete().eq('id', itemId);
    if (activeRundown) fetchItems(activeRundown.id);
    toast.success('Item deleted');
  };

  // ─── Derived State ─────────────────────────────────────

  const isLive = activeRundown?.status === 'live';
  const onAirItem = items.find(i => i.status === 'on_air');
  const nextPendingItem = items.find(i => i.status === 'pending' || i.status === 'standby');

  const overUnder = timingData.over_under;
  const showElapsed = activeRundown?.actual_start
    ? Math.floor((wallClock.getTime() - new Date(activeRundown.actual_start).getTime()) / 1000)
    : 0;

  const onAirElapsed = onAirItem?.on_air_at
    ? Math.floor((wallClock.getTime() - new Date(onAirItem.on_air_at).getTime()) / 1000)
    : 0;

  const onAirOverUnder = onAirItem
    ? onAirElapsed - onAirItem.planned_duration
    : 0;

  // ─── Render ────────────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-screen bg-surface-950">
      {/* ── Top Bar ─────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-surface-800 px-4 py-2 bg-surface-900/50">
        <div className="flex items-center gap-3">
          {/* Rundown selector */}
          <select
            value={activeRundown?.id || ''}
            onChange={(e) => {
              const rd = rundowns.find(r => r.id === e.target.value);
              if (rd) setActiveRundown(rd);
            }}
            className="bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-[#FF5F1F]"
          >
            {rundowns.map(r => (
              <option key={r.id} value={r.id}>
                {r.title} — {new Date(r.show_date).toLocaleDateString('nb-NO')}
                {r.status === 'live' ? ' 🔴 LIVE' : ''}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={() => setShowCreateRundown(true)}>
            + New Rundown
          </Button>
          {activeRundown && (
            <span className={cn(
              'text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider',
              BROADCAST_RUNDOWN_STATUS_OPTIONS.find(s => s.value === activeRundown.status)?.color || 'bg-surface-700',
              'text-white'
            )}>
              {activeRundown.status.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Wall clock */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-white tracking-wider tabular-nums">
              {wallClock.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Rundown List (main area) ──────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!activeRundown ? (
            <EmptyState
              title="No Rundowns"
              description="Create a rundown to start planning your show."
              action={<Button onClick={() => setShowCreateRundown(true)}>Create Rundown</Button>}
            />
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-surface-400 mb-4">Rundown is empty. Add items to build your show.</p>
              <Button onClick={() => { resetItemForm(); setShowAddItem(true); }}>Add First Item</Button>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="sticky top-0 z-10 grid grid-cols-[28px_60px_60px_1fr_80px_80px_80px_100px_100px_80px] gap-px bg-surface-800 text-[10px] font-bold text-surface-400 uppercase tracking-wider border-b border-surface-700">
                <div className="bg-surface-900 px-1 py-1.5" />
                <div className="bg-surface-900 px-2 py-1.5">Page</div>
                <div className="bg-surface-900 px-2 py-1.5">Type</div>
                <div className="bg-surface-900 px-2 py-1.5">Title / Slug</div>
                <div className="bg-surface-900 px-2 py-1.5 text-right">Dur</div>
                <div className="bg-surface-900 px-2 py-1.5 text-right">Back</div>
                <div className="bg-surface-900 px-2 py-1.5 text-right">Actual</div>
                <div className="bg-surface-900 px-2 py-1.5">Camera</div>
                <div className="bg-surface-900 px-2 py-1.5">Source</div>
                <div className="bg-surface-900 px-2 py-1.5 text-center">•••</div>
              </div>

              {/* Items */}
              {items.map((item, idx) => {
                const typeInfo = BROADCAST_ITEM_TYPES.find(t => t.value === item.item_type);
                const isOnAir = item.status === 'on_air';
                const isDone = item.status === 'done';
                const isKilled = item.status === 'killed' || item.status === 'skipped';
                const bt = backTimeMap.get(item.id);
                const cum = cumulativeMap.get(item.id) || 0;
                const itemOnAirElapsed = isOnAir && item.on_air_at
                  ? Math.floor((wallClock.getTime() - new Date(item.on_air_at).getTime()) / 1000)
                  : null;

                return (
                  <div
                    key={item.id}
                    draggable={!isLive}
                    onDragStart={() => handleDragStart(item.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, item.id)}
                    onDrop={(e) => handleDrop(e, item.id)}
                    className={cn(
                      'grid grid-cols-[28px_60px_60px_1fr_80px_80px_80px_100px_100px_80px] gap-px text-sm border-b border-surface-800/50 transition-colors',
                      isOnAir && 'bg-red-950/40 border-l-2 border-l-red-500',
                      isDone && 'opacity-50',
                      isKilled && 'opacity-30 line-through',
                      item.is_float && !isOnAir && 'bg-amber-950/20',
                      item.is_break && !isOnAir && 'bg-surface-800/30',
                      !isOnAir && !isDone && !isKilled && 'hover:bg-surface-800/30',
                      draggedId === item.id && 'opacity-40',
                      dragOverId === item.id && 'border-t-2 border-t-[#FF5F1F]',
                    )}
                    onDoubleClick={() => openEditItem(item)}
                  >
                    {/* Drag handle */}
                    <div
                      className={cn(
                        'flex items-center justify-center cursor-grab active:cursor-grabbing',
                        isLive && 'cursor-default opacity-0 pointer-events-none',
                      )}
                    >
                      <svg className="w-3 h-3 text-surface-600 hover:text-surface-400 transition-colors" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="2" cy="2" r="1.5" /><circle cx="8" cy="2" r="1.5" />
                        <circle cx="2" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" />
                        <circle cx="2" cy="14" r="1.5" /><circle cx="8" cy="14" r="1.5" />
                      </svg>
                    </div>

                    {/* Page */}
                    <div className="px-2 py-2 font-mono text-xs text-surface-400 flex items-center">
                      {item.page_number || `${idx + 1}`}
                    </div>

                    {/* Type badge */}
                    <div className="px-1 py-2 flex items-center">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: typeInfo?.color || '#64748b' }}
                      >
                        {typeInfo?.abbr || item.item_type.slice(0, 4).toUpperCase()}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="px-2 py-2 flex items-center gap-2 min-w-0">
                      <span className={cn('truncate font-medium', isOnAir && 'text-white font-bold')}>
                        {item.title}
                      </span>
                      {item.segment_slug && (
                        <span className="text-[10px] text-surface-500 font-mono shrink-0">
                          [{item.segment_slug}]
                        </span>
                      )}
                      {item.story_id && (() => {
                        const linked = stories.find(s => s.id === item.story_id);
                        const statusInfo = linked ? BROADCAST_STORY_STATUS_OPTIONS.find(o => o.value === linked.status) : null;
                        return linked ? (
                          <span
                            className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 text-white', statusInfo?.color || 'bg-surface-700')}
                            title={`Story: ${linked.title}`}
                          >
                            {linked.slug || 'STORY'}
                          </span>
                        ) : null;
                      })()}
                      {item.is_float && (
                        <span className="text-[9px] px-1 py-0.5 bg-amber-900/50 text-amber-400 rounded font-bold shrink-0">
                          FLOAT
                        </span>
                      )}
                      {isOnAir && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded font-bold animate-pulse shrink-0">
                          ON AIR
                        </span>
                      )}
                    </div>

                    {/* Planned Duration */}
                    <div className="px-2 py-2 text-right font-mono text-xs text-surface-300 flex items-center justify-end">
                      {formatBroadcastDuration(item.planned_duration)}
                    </div>

                    {/* Back Time */}
                    <div className="px-2 py-2 text-right font-mono text-xs text-surface-500 flex items-center justify-end">
                      {bt ? formatBroadcastTime(bt.toISOString()) : '—'}
                    </div>

                    {/* Actual Duration */}
                    <div className={cn(
                      'px-2 py-2 text-right font-mono text-xs flex items-center justify-end',
                      isOnAir && itemOnAirElapsed !== null && itemOnAirElapsed > item.planned_duration && 'text-red-400 font-bold',
                      isOnAir && itemOnAirElapsed !== null && itemOnAirElapsed <= item.planned_duration && 'text-green-400',
                      isDone && item.actual_duration && item.actual_duration > item.planned_duration && 'text-red-400',
                      isDone && item.actual_duration && item.actual_duration <= item.planned_duration && 'text-green-400',
                    )}>
                      {isOnAir && itemOnAirElapsed !== null
                        ? formatBroadcastDuration(itemOnAirElapsed)
                        : item.actual_duration
                          ? formatBroadcastDuration(item.actual_duration)
                          : '—'}
                    </div>

                    {/* Camera */}
                    <div className="px-2 py-2 text-xs text-surface-400 flex items-center truncate">
                      {item.camera || '—'}
                    </div>

                    {/* Video Source */}
                    <div className="px-2 py-2 text-xs text-surface-400 flex items-center truncate">
                      {item.video_source || '—'}
                    </div>

                    {/* Actions */}
                    <div className="px-1 py-2 flex items-center justify-center gap-1">
                      {isLive && !isDone && !isKilled && (
                        <>
                          {!isOnAir && (
                            <button
                              onClick={() => handleTakeItem(item.id)}
                              className="p-0.5 text-green-500 hover:text-green-300 transition-colors"
                              title="Take (go on air)"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            </button>
                          )}
                          {isOnAir && (
                            <button
                              onClick={() => handleCompleteItem(item.id)}
                              className="p-0.5 text-amber-500 hover:text-amber-300 transition-colors"
                              title="Complete"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </button>
                          )}
                        </>
                      )}
                      {!isLive && !isDone && (
                        <>
                          <button
                            onClick={() => openEditItem(item)}
                            className="p-0.5 text-surface-500 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button
                            onClick={() => handleMoveItem(item.id, 'up')}
                            disabled={idx === 0}
                            className="p-0.5 text-surface-600 hover:text-white transition-colors disabled:opacity-20"
                            title="Move up"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                          </button>
                          <button
                            onClick={() => handleMoveItem(item.id, 'down')}
                            disabled={idx === items.length - 1}
                            className="p-0.5 text-surface-600 hover:text-white transition-colors disabled:opacity-20"
                            title="Move down"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add item row */}
              {!isLive && (
                <div className="border-b border-surface-800/50">
                  <button
                    onClick={() => { resetItemForm(); setShowAddItem(true); }}
                    className="w-full px-4 py-3 text-sm text-surface-500 hover:text-white hover:bg-surface-800/30 text-left transition-colors"
                  >
                    + Add item...
                  </button>
                </div>
              )}

              {/* Total row */}
              <div className="grid grid-cols-[28px_60px_60px_1fr_80px_80px_80px_100px_100px_80px] gap-px bg-surface-900 border-t border-surface-700 text-sm font-bold">
                <div className="px-2 py-2" />
                <div className="px-2 py-2" />
                <div className="px-2 py-2" />
                <div className="px-2 py-2 text-surface-300">
                  Total ({items.filter(i => i.status !== 'killed' && i.status !== 'skipped').length} items)
                </div>
                <div className="px-2 py-2 text-right font-mono text-xs text-white">
                  {formatBroadcastDuration(totalPlannedDuration)}
                </div>
                <div className="px-2 py-2" />
                <div className="px-2 py-2" />
                <div className="px-2 py-2" />
                <div className="px-2 py-2" />
                <div className="px-2 py-2" />
              </div>
            </>
          )}
        </div>

        {/* ── Right Panel: Timing & Controls ────────── */}
        <div className="w-72 border-l border-surface-800 bg-surface-900/50 flex flex-col overflow-y-auto hidden lg:flex">
          {/* Show status */}
          <div className={cn('p-4 border-b border-surface-800', isLive && 'bg-red-950/30')}>
            <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">Show Status</div>
            {isLive ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 font-bold text-lg">LIVE</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-400">Show Time</span>
                    <span className="font-mono text-white">{formatBroadcastDuration(showElapsed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Planned</span>
                    <span className="font-mono text-surface-300">{formatBroadcastDuration(totalPlannedDuration)}</span>
                  </div>
                  {overUnder && (
                    <div className="flex justify-between">
                      <span className="text-surface-400">Over/Under</span>
                      <span className={cn(
                        'font-mono font-bold',
                        overUnder.over_under > 0 ? 'text-red-400' : overUnder.over_under < 0 ? 'text-green-400' : 'text-white'
                      )}>
                        {overUnder.over_under > 0 ? '+' : ''}{formatBroadcastDuration(overUnder.over_under)}
                      </span>
                    </div>
                  )}
                  {overUnder && (
                    <div className="flex justify-between">
                      <span className="text-surface-400">Remaining</span>
                      <span className="font-mono text-surface-300">{overUnder.items_remaining} items</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-surface-400">
                {activeRundown?.status === 'completed' ? 'Show completed' :
                  activeRundown?.scheduled_start
                    ? `Starts ${formatBroadcastTime(activeRundown.scheduled_start)}`
                    : 'Not scheduled'}
              </div>
            )}
          </div>

          {/* On-Air Item */}
          {isLive && onAirItem && (
            <div className="p-4 border-b border-surface-800 bg-red-950/20">
              <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">On Air Now</div>
              <div className="text-white font-bold text-sm mb-1">{onAirItem.title}</div>
              <div className="flex items-center gap-2 text-xs">
                <div className={cn(
                  'font-mono text-lg font-bold tabular-nums',
                  onAirOverUnder > 0 ? 'text-red-400' : 'text-green-400'
                )}>
                  {formatBroadcastDuration(onAirElapsed)}
                </div>
                <span className="text-surface-500">/</span>
                <span className="font-mono text-surface-400">{formatBroadcastDuration(onAirItem.planned_duration)}</span>
              </div>
              {onAirOverUnder > 0 && (
                <div className="text-xs text-red-400 font-bold mt-1">
                  +{formatBroadcastDuration(onAirOverUnder)} OVER
                </div>
              )}
            </div>
          )}

          {/* Next Up */}
          {isLive && nextPendingItem && (
            <div className="p-4 border-b border-surface-800">
              <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1">Next Up</div>
              <div className="text-surface-300 text-sm font-medium">{nextPendingItem.title}</div>
              <div className="text-xs text-surface-500 font-mono mt-1">
                {formatBroadcastDuration(nextPendingItem.planned_duration)}
                {backTimeMap.has(nextPendingItem.id) && (
                  <> · Back {formatBroadcastTime(backTimeMap.get(nextPendingItem.id)!.toISOString())}</>
                )}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="p-4 space-y-2">
            <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">Controls</div>
            {activeRundown && activeRundown.status !== 'live' && activeRundown.status !== 'completed' && (
              <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={handleStartShow}>
                Start Show
              </Button>
            )}
            {isLive && nextPendingItem && (
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => handleTakeItem(nextPendingItem.id)}>
                ▶ Take Next
              </Button>
            )}
            {isLive && onAirItem && (
              <Button className="w-full" variant="outline" onClick={() => handleCompleteItem(onAirItem.id)}>
                ✓ Complete Current
              </Button>
            )}
            {isLive && (
              <Button className="w-full bg-surface-700 hover:bg-surface-600" onClick={handleEndShow}>
                End Show
              </Button>
            )}
          </div>

          {/* Quick item context menu for live mode */}
          {isLive && (
            <div className="p-4 border-t border-surface-800">
              <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">Quick Actions</div>
              <div className="space-y-1">
                {items
                  .filter(i => i.status === 'pending' || i.status === 'standby')
                  .slice(0, 5)
                  .map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => handleSkipItem(item.id)}
                        className="text-surface-600 hover:text-amber-400 shrink-0"
                        title="Skip"
                      >
                        ⏭
                      </button>
                      <button
                        onClick={() => handleKillItem(item.id)}
                        className="text-surface-600 hover:text-red-400 shrink-0"
                        title="Kill"
                      >
                        ✕
                      </button>
                      <span className="text-surface-400 truncate">{item.page_number || ''} {item.title}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Rundown Modal ────────────────────── */}
      <Modal isOpen={showCreateRundown} onClose={() => setShowCreateRundown(false)} title="Create Rundown">
        <div className="space-y-4">
          <Input
            label="Show Title"
            value={newRundown.title}
            onChange={(e) => setNewRundown(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. Kveldsnytt 21:00"
          />
          <Input
            label="Show Date"
            type="date"
            value={newRundown.show_date}
            onChange={(e) => setNewRundown(prev => ({ ...prev, show_date: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Time"
              type="time"
              value={newRundown.scheduled_start}
              onChange={(e) => setNewRundown(prev => ({ ...prev, scheduled_start: e.target.value }))}
            />
            <Input
              label="End Time"
              type="time"
              value={newRundown.scheduled_end}
              onChange={(e) => setNewRundown(prev => ({ ...prev, scheduled_end: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreateRundown(false)}>Cancel</Button>
            <Button onClick={handleCreateRundown}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* ── Add/Edit Item Modal ─────────────────────── */}
      <Modal
        isOpen={showAddItem}
        onClose={() => { setShowAddItem(false); resetItemForm(); }}
        title={editingItem ? 'Edit Rundown Item' : 'Add Rundown Item'}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Story link */}
          <div>
            <label className="text-xs font-medium text-surface-400 block mb-1">Link to Story <span className="text-surface-600">(optional)</span></label>
            <select
              value={itemForm.story_id || ''}
              onChange={(e) => {
                const sid = e.target.value || null;
                const story = stories.find(s => s.id === sid);
                setItemForm(prev => ({
                  ...prev,
                  story_id: sid,
                  // Auto-fill from story when linking
                  ...(story ? {
                    title: prev.title || story.title,
                    prompter_text: prev.prompter_text || story.script_text || '',
                    planned_duration: story.estimated_duration || prev.planned_duration,
                    segment_slug: prev.segment_slug || story.slug || '',
                  } : {}),
                }));
              }}
              className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— No linked story —</option>
              {stories.map(s => {
                const statusInfo = BROADCAST_STORY_STATUS_OPTIONS.find(o => o.value === s.status);
                return (
                  <option key={s.id} value={s.id}>
                    [{s.slug}] {s.title} · {statusInfo?.label}
                  </option>
                );
              })}
            </select>
            {itemForm.story_id && (() => {
              const s = stories.find(st => st.id === itemForm.story_id);
              return s ? (
                <p className="text-[10px] text-surface-500 mt-1">
                  Status: {s.status} · Type: {s.story_type}{s.estimated_duration ? ` · ${s.estimated_duration}s` : ''}
                </p>
              ) : null;
            })()}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Title"
              value={itemForm.title}
              onChange={(e) => setItemForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Top Story: Oslo Fire"
            />
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Type</label>
              <select
                value={itemForm.item_type}
                onChange={(e) => setItemForm(prev => ({ ...prev, item_type: e.target.value as BroadcastRundownItemType }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                {BROADCAST_ITEM_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.abbr} — {t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Page #"
              value={itemForm.page_number}
              onChange={(e) => setItemForm(prev => ({ ...prev, page_number: e.target.value }))}
              placeholder="A1"
            />
            <Input
              label="Slug"
              value={itemForm.segment_slug}
              onChange={(e) => setItemForm(prev => ({ ...prev, segment_slug: e.target.value }))}
              placeholder="OSLO-FIRE"
            />
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Duration (sec)</label>
              <input
                type="number"
                min="0"
                value={itemForm.planned_duration}
                onChange={(e) => setItemForm(prev => ({ ...prev, planned_duration: parseInt(e.target.value) || 0 }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Technical */}
          <div className="border-t border-surface-800 pt-3">
            <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">Technical</div>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Camera"
                value={itemForm.camera}
                onChange={(e) => setItemForm(prev => ({ ...prev, camera: e.target.value }))}
                placeholder="CAM 1"
              />
              <Input
                label="Audio Source"
                value={itemForm.audio_source}
                onChange={(e) => setItemForm(prev => ({ ...prev, audio_source: e.target.value }))}
                placeholder="MIC 1+2"
              />
              <Input
                label="Video Source"
                value={itemForm.video_source}
                onChange={(e) => setItemForm(prev => ({ ...prev, video_source: e.target.value }))}
                placeholder="VT1"
              />
            </div>
          </div>

          {/* Talent */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Presenter"
              value={itemForm.presenter}
              onChange={(e) => setItemForm(prev => ({ ...prev, presenter: e.target.value }))}
              placeholder="Name"
            />
            <Input
              label="Reporter"
              value={itemForm.reporter}
              onChange={(e) => setItemForm(prev => ({ ...prev, reporter: e.target.value }))}
              placeholder="Name"
            />
          </div>

          {/* Prompter */}
          <Textarea
            label="Prompter Text"
            value={itemForm.prompter_text}
            onChange={(e) => setItemForm(prev => ({ ...prev, prompter_text: e.target.value }))}
            placeholder="Text for teleprompter..."
            rows={3}
          />

          {/* Notes */}
          <div className="grid grid-cols-2 gap-3">
            <Textarea
              label="Director Notes"
              value={itemForm.director_notes}
              onChange={(e) => setItemForm(prev => ({ ...prev, director_notes: e.target.value }))}
              rows={2}
            />
            <Textarea
              label="Production Notes"
              value={itemForm.production_notes}
              onChange={(e) => setItemForm(prev => ({ ...prev, production_notes: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Flags */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-surface-300">
              <input
                type="checkbox"
                checked={itemForm.is_float}
                onChange={(e) => setItemForm(prev => ({ ...prev, is_float: e.target.checked }))}
                className="rounded bg-surface-800 border-surface-600"
              />
              Float (optional segment)
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-300">
              <input
                type="checkbox"
                checked={itemForm.is_break}
                onChange={(e) => setItemForm(prev => ({ ...prev, is_break: e.target.checked }))}
                className="rounded bg-surface-800 border-surface-600"
              />
              Break
            </label>
          </div>

          <div className="flex justify-between pt-2">
            {editingItem && (
              <Button
                variant="ghost"
                className="text-red-400 hover:text-red-300"
                onClick={() => {
                  handleDeleteItem(editingItem.id);
                  setShowAddItem(false);
                  resetItemForm();
                }}
              >
                Delete Item
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="ghost" onClick={() => { setShowAddItem(false); resetItemForm(); }}>Cancel</Button>
              <Button onClick={handleSaveItem}>{editingItem ? 'Update' : 'Add Item'}</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
