'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, Modal, Input, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { BroadcastPlayoutItem, BroadcastPlayoutItemType, BroadcastPlayoutItemStatus } from '@/lib/types';
import { BROADCAST_PLAYOUT_ITEM_TYPES, formatBroadcastDuration } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Master Control / Playout — Media playlist sequencing
// Play, Cue, Next, transport controls, chain-of-events
// ────────────────────────────────────────────────────────────

export default function MasterControlPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BroadcastPlayoutItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<BroadcastPlayoutItem | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const clockRef = useRef<HTMLDivElement>(null);

  const [newItem, setNewItem] = useState({
    title: '',
    item_type: 'clip' as BroadcastPlayoutItemType,
    duration_seconds: 0,
    media_url: '',
    auto_next: true,
    loop: false,
  });

  // ─── Live Clock ──────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      if (clockRef.current) {
        clockRef.current.textContent = new Date().toLocaleTimeString('nb-NO', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        });
      }
      // Update elapsed for playing item
      const playing = items.find(i => i.status === 'playing');
      if (playing?.played_at) {
        setElapsed(Math.floor((Date.now() - new Date(playing.played_at).getTime()) / 1000));
      }
    }, 200);
    return () => clearInterval(iv);
  }, [items]);

  // ─── Data Fetching ───────────────────────────────
  const fetchItems = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('broadcast_playout_items')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order');
    if (error) console.error('Playout fetch error:', error);
    setItems(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`playout-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_playout_items', filter: `project_id=eq.${projectId}` }, () => fetchItems())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, fetchItems]);

  // ─── CRUD ────────────────────────────────────────

  const handleAddItem = async () => {
    if (!newItem.title) { toast.error('Title is required'); return; }
    const supabase = createClient();
    const { error } = await supabase.from('broadcast_playout_items').insert({
      project_id: projectId,
      title: newItem.title,
      item_type: newItem.item_type,
      duration_seconds: newItem.duration_seconds,
      media_url: newItem.media_url || null,
      auto_next: newItem.auto_next,
      loop: newItem.loop,
      sort_order: items.length,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Item added');
    setShowAddItem(false);
    setNewItem({ title: '', item_type: 'clip', duration_seconds: 0, media_url: '', auto_next: true, loop: false });
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    const supabase = createClient();
    await supabase.from('broadcast_playout_items').delete().eq('id', id);
    if (selectedItem?.id === id) setSelectedItem(null);
    fetchItems();
  };

  // ─── Transport Controls ──────────────────────────

  const playItem = async (item: BroadcastPlayoutItem) => {
    const supabase = createClient();
    // Stop any currently playing item
    const playing = items.find(i => i.status === 'playing');
    if (playing) {
      await supabase.from('broadcast_playout_items').update({ status: 'done' }).eq('id', playing.id);
    }
    // Play the new item
    await supabase.from('broadcast_playout_items').update({
      status: 'playing',
      played_at: new Date().toISOString(),
    }).eq('id', item.id);
    setElapsed(0);
    // Log to as-run
    await supabase.from('broadcast_as_run_log').insert({
      project_id: projectId,
      event_type: 'segment_start',
      title: `PLAY: ${item.title}`,
      is_automatic: false,
    });
    fetchItems();
  };

  const cueItem = async (item: BroadcastPlayoutItem) => {
    const supabase = createClient();
    await supabase.from('broadcast_playout_items').update({ status: 'cued' }).eq('id', item.id);
    fetchItems();
  };

  const stopCurrent = async () => {
    const playing = items.find(i => i.status === 'playing');
    if (!playing) return;
    const supabase = createClient();
    await supabase.from('broadcast_playout_items').update({ status: 'done' }).eq('id', playing.id);
    await supabase.from('broadcast_as_run_log').insert({
      project_id: projectId,
      event_type: 'segment_end',
      title: `STOP: ${playing.title}`,
      is_automatic: false,
    });
    setElapsed(0);
    fetchItems();
  };

  const playNext = async () => {
    const playingIdx = items.findIndex(i => i.status === 'playing');
    const nextIdx = playingIdx >= 0 ? playingIdx + 1 : items.findIndex(i => i.status === 'cued');
    if (nextIdx < 0 || nextIdx >= items.length) { toast.warning('No next item'); return; }
    await playItem(items[nextIdx]);
  };

  const resetAll = async () => {
    const supabase = createClient();
    await supabase.from('broadcast_playout_items')
      .update({ status: 'queued', played_at: null })
      .eq('project_id', projectId);
    setElapsed(0);
    fetchItems();
  };

  // ─── Render ──────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  const playingItem = items.find(i => i.status === 'playing');
  const cuedItem = items.find(i => i.status === 'cued');
  const nextItem = playingItem
    ? items[items.findIndex(i => i.id === playingItem.id) + 1]
    : cuedItem || items.find(i => i.status === 'queued');

  const totalDuration = items.reduce((sum, i) => sum + (i.duration_seconds || 0), 0);
  const elapsedTotal = items.filter(i => i.status === 'done').reduce((sum, i) => sum + (i.duration_seconds || 0), 0) + elapsed;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-screen bg-surface-950">
      {/* ── Top Bar ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-800">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold text-white uppercase tracking-wider">Master Control</h1>
          {playingItem && (
            <Badge className="bg-red-600 text-white animate-pulse">ON AIR</Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-surface-500">
            {items.filter(i => i.status === 'done').length}/{items.length} played
          </div>
          <div ref={clockRef} className="font-mono text-lg text-red-500 font-bold tabular-nums" />
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Playlist ────────────────────────── */}
        <div className="w-2/3 border-r border-surface-800 flex flex-col">
          {/* Transport Bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-800 bg-surface-900">
            <button
              onClick={stopCurrent}
              disabled={!playingItem}
              className="p-2 rounded bg-surface-800 text-surface-400 hover:bg-red-600 hover:text-white disabled:opacity-30 transition-colors"
              title="Stop"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" /></svg>
            </button>
            <button
              onClick={() => playingItem ? playNext() : nextItem && playItem(nextItem)}
              disabled={!nextItem && !playingItem}
              className="p-2 rounded bg-surface-800 text-surface-400 hover:bg-green-600 hover:text-white disabled:opacity-30 transition-colors"
              title="Play / Next"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </button>
            <button
              onClick={playNext}
              disabled={!playingItem}
              className="p-2 rounded bg-surface-800 text-surface-400 hover:bg-amber-600 hover:text-black disabled:opacity-30 transition-colors"
              title="Next"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            </button>
            <div className="flex-1" />
            {/* Elapsed / Total */}
            <div className="font-mono text-sm text-surface-400">
              <span className={cn(playingItem && 'text-red-400')}>{formatBroadcastDuration(elapsedTotal)}</span>
              <span className="text-surface-700 mx-1">/</span>
              <span>{formatBroadcastDuration(totalDuration)}</span>
            </div>
            <div className="flex items-center gap-1 ml-4">
              <Button size="sm" variant="ghost" onClick={resetAll}>Reset</Button>
              <Button size="sm" onClick={() => setShowAddItem(true)}>+ Add</Button>
            </div>
          </div>

          {/* Item List */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <EmptyState
                  title="Empty playlist"
                  description="Add clips, live sources, graphics, and breaks to build your playout chain."
                  action={<Button onClick={() => setShowAddItem(true)}>Add First Item</Button>}
                />
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-surface-900 sticky top-0">
                  <tr className="text-surface-500 uppercase text-[10px]">
                    <th className="px-2 py-1.5 text-left w-8">#</th>
                    <th className="px-2 py-1.5 text-left w-16">Status</th>
                    <th className="px-2 py-1.5 text-left w-16">Type</th>
                    <th className="px-2 py-1.5 text-left">Title</th>
                    <th className="px-2 py-1.5 text-right w-16">Dur</th>
                    <th className="px-2 py-1.5 text-right w-20">Elapsed</th>
                    <th className="px-2 py-1.5 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const typeInfo = BROADCAST_PLAYOUT_ITEM_TYPES.find(t => t.value === item.item_type);
                    const isPlaying = item.status === 'playing';
                    const isCued = item.status === 'cued';
                    const isDone = item.status === 'done';
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={cn(
                          'border-b border-surface-800/50 cursor-pointer transition-colors',
                          isPlaying && 'bg-red-950/40',
                          isCued && 'bg-amber-950/30',
                          isDone && 'opacity-50',
                          selectedItem?.id === item.id && 'bg-surface-800/50',
                          !isPlaying && !isCued && !isDone && 'hover:bg-surface-800/30'
                        )}
                      >
                        <td className="px-2 py-2 text-surface-600 font-mono">{idx + 1}</td>
                        <td className="px-2 py-2">
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                            isPlaying && 'bg-red-600 text-white',
                            isCued && 'bg-amber-600 text-black',
                            isDone && 'bg-surface-700 text-surface-400',
                            item.status === 'queued' && 'bg-surface-800 text-surface-500',
                            item.status === 'skipped' && 'bg-surface-800 text-surface-600 line-through',
                          )}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style={{ backgroundColor: typeInfo?.color + '20', color: typeInfo?.color }}
                          >
                            {typeInfo?.label || item.item_type}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-white font-medium">
                          {item.title}
                          {item.loop && <span className="ml-1 text-cyan-400 text-[10px]">↻</span>}
                          {item.auto_next && <span className="ml-1 text-green-400 text-[10px]">▸</span>}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-surface-400">
                          {formatBroadcastDuration(item.duration_seconds)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          {isPlaying ? (
                            <span className="text-red-400">{formatBroadcastDuration(elapsed)}</span>
                          ) : isDone ? (
                            <span className="text-surface-600">{formatBroadcastDuration(item.duration_seconds)}</span>
                          ) : ''}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {!isDone && !isPlaying && (
                              <button
                                onClick={(e) => { e.stopPropagation(); playItem(item); }}
                                className="p-1 rounded hover:bg-green-600/20 text-green-400"
                                title="Play"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                              </button>
                            )}
                            {!isDone && !isPlaying && !isCued && (
                              <button
                                onClick={(e) => { e.stopPropagation(); cueItem(item); }}
                                className="p-1 rounded hover:bg-amber-600/20 text-amber-400"
                                title="Cue"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" /></svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                              className="p-1 rounded hover:bg-red-600/20 text-surface-600 hover:text-red-400"
                              title="Delete"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right: Now Playing / Next ──────────────── */}
        <div className="w-1/3 flex flex-col overflow-y-auto">
          {/* Now Playing */}
          <div className="p-4 border-b border-surface-800">
            <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">
              {playingItem ? 'Now Playing' : 'Stopped'}
            </div>
            {playingItem ? (
              <div className="space-y-3">
                <div className="text-lg font-bold text-white">{playingItem.title}</div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{
                      backgroundColor: BROADCAST_PLAYOUT_ITEM_TYPES.find(t => t.value === playingItem.item_type)?.color + '20',
                      color: BROADCAST_PLAYOUT_ITEM_TYPES.find(t => t.value === playingItem.item_type)?.color,
                    }}
                  >
                    {playingItem.item_type}
                  </span>
                  {playingItem.loop && <span className="text-cyan-400 text-xs">LOOP</span>}
                </div>
                {/* Progress bar */}
                {playingItem.duration_seconds > 0 && (
                  <div className="space-y-1">
                    <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-600 transition-all rounded-full"
                        style={{ width: `${Math.min(100, (elapsed / playingItem.duration_seconds) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-red-400">{formatBroadcastDuration(elapsed)}</span>
                      <span className={cn(
                        elapsed > playingItem.duration_seconds ? 'text-red-400 animate-pulse' : 'text-surface-500'
                      )}>
                        {elapsed > playingItem.duration_seconds
                          ? `+${formatBroadcastDuration(elapsed - playingItem.duration_seconds)}`
                          : `-${formatBroadcastDuration(playingItem.duration_seconds - elapsed)}`
                        }
                      </span>
                      <span className="text-surface-500">{formatBroadcastDuration(playingItem.duration_seconds)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-surface-600 text-sm">No item playing</div>
            )}
          </div>

          {/* Next Up */}
          <div className="p-4 border-b border-surface-800">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">Next Up</div>
            {nextItem ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white font-medium">{nextItem.title}</div>
                  <div className="text-xs text-surface-500">
                    {nextItem.item_type} • {formatBroadcastDuration(nextItem.duration_seconds)}
                    {nextItem.auto_next && ' • Auto'}
                  </div>
                </div>
                <Button size="sm" onClick={() => playItem(nextItem)}>Play</Button>
              </div>
            ) : (
              <div className="text-surface-600 text-xs">No next item</div>
            )}
          </div>

          {/* Show Progress */}
          <div className="p-4">
            <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-3">Show Progress</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-surface-400">Total Items</span>
                <span className="text-white font-mono">{items.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-surface-400">Completed</span>
                <span className="text-green-400 font-mono">{items.filter(i => i.status === 'done').length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-surface-400">Remaining</span>
                <span className="text-surface-300 font-mono">{items.filter(i => i.status === 'queued' || i.status === 'cued').length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-surface-400">Total Duration</span>
                <span className="text-white font-mono">{formatBroadcastDuration(totalDuration)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-surface-400">Elapsed</span>
                <span className="text-red-400 font-mono">{formatBroadcastDuration(elapsedTotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-surface-400">Remaining Time</span>
                <span className="text-surface-300 font-mono">{formatBroadcastDuration(Math.max(0, totalDuration - elapsedTotal))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Item Modal ──────────────────────────── */}
      <Modal isOpen={showAddItem} onClose={() => setShowAddItem(false)} title="Add Playout Item">
        <div className="space-y-4">
          <Input
            label="Title"
            value={newItem.title}
            onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. Opening Titles, VT Package 1, Commercial Break"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Type</label>
              <select
                value={newItem.item_type}
                onChange={(e) => setNewItem(prev => ({ ...prev, item_type: e.target.value as BroadcastPlayoutItemType }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                {BROADCAST_PLAYOUT_ITEM_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <Input
              label="Duration (seconds)"
              type="number"
              value={String(newItem.duration_seconds)}
              onChange={(e) => setNewItem(prev => ({ ...prev, duration_seconds: Number(e.target.value) }))}
              placeholder="30"
            />
          </div>
          <Input
            label="Media URL (optional)"
            value={newItem.media_url}
            onChange={(e) => setNewItem(prev => ({ ...prev, media_url: e.target.value }))}
            placeholder="https://..."
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newItem.auto_next}
                onChange={(e) => setNewItem(prev => ({ ...prev, auto_next: e.target.checked }))}
                className="rounded border-surface-600"
              />
              Auto-next
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newItem.loop}
                onChange={(e) => setNewItem(prev => ({ ...prev, loop: e.target.checked }))}
                className="rounded border-surface-600"
              />
              Loop
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddItem(false)}>Cancel</Button>
            <Button onClick={handleAddItem}>Add Item</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
