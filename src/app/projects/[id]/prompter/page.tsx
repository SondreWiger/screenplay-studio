'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { BroadcastRundown, BroadcastRundownItem } from '@/lib/types';
import { formatBroadcastDuration } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Prompter — broadcast-grade teleprompter display
// Shows rundown item prompter text in large, scrollable format
// ────────────────────────────────────────────────────────────

export default function PrompterPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [rundowns, setRundowns] = useState<BroadcastRundown[]>([]);
  const [selectedRundownId, setSelectedRundownId] = useState<string | null>(null);
  const [items, setItems] = useState<BroadcastRundownItem[]>([]);
  const [stories, setStories] = useState<Record<string, { title: string; script_text?: string }>>({});

  // Prompter settings
  const [fontSize, setFontSize] = useState(48);
  const [mirror, setMirror] = useState(false);
  const [speed, setSpeed] = useState(0); // 0 = manual, 1-10 = auto scroll speed
  const [showControls, setShowControls] = useState(true);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);

  // ─── Fetch Rundowns ────────────────────────────────────

  const fetchRundowns = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_rundowns')
      .select('*')
      .eq('project_id', projectId)
      .order('show_date', { ascending: false });
    setRundowns(data || []);
    if (data && data.length > 0 && !selectedRundownId) {
      // Default to the live rundown, or the first one
      const liveRundown = data.find(r => r.status === 'live');
      setSelectedRundownId(liveRundown?.id || data[0].id);
    }
  }, [projectId, selectedRundownId]);

  const fetchItems = useCallback(async () => {
    if (!selectedRundownId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_rundown_items')
      .select('*')
      .eq('rundown_id', selectedRundownId)
      .order('sort_order', { ascending: true });
    setItems(data || []);

    // Fetch linked stories for prompter text
    const storyIds = (data || []).filter(d => d.story_id).map(d => d.story_id!);
    if (storyIds.length > 0) {
      const { data: storyData } = await supabase
        .from('broadcast_stories')
        .select('id, title, script_text')
        .in('id', storyIds);
      const map: Record<string, { title: string; script_text?: string }> = {};
      for (const s of storyData || []) { map[s.id] = s; }
      setStories(map);
    }
  }, [selectedRundownId]);

  useEffect(() => {
    (async () => {
      await fetchRundowns();
      setLoading(false);
    })();
  }, [fetchRundowns]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Realtime — track rundown item changes
  useEffect(() => {
    if (!selectedRundownId) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`prompter-${selectedRundownId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_rundown_items', filter: `rundown_id=eq.${selectedRundownId}` }, () => fetchItems())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedRundownId, fetchItems]);

  // ─── Auto-scroll ───────────────────────────────────────

  useEffect(() => {
    if (scrollIntervalRef.current) {
      window.clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    if (speed > 0 && scrollRef.current) {
      const pxPerTick = speed * 0.8;
      scrollIntervalRef.current = window.setInterval(() => {
        scrollRef.current?.scrollBy({ top: pxPerTick });
      }, 50);
    }
    return () => {
      if (scrollIntervalRef.current) window.clearInterval(scrollIntervalRef.current);
    };
  }, [speed]);

  // ─── Fullscreen ────────────────────────────────────────

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Items that have prompter text
  const prompterItems = items.filter(item => {
    if (item.prompter_text) return true;
    if (item.story_id && stories[item.story_id]) {
      return stories[item.story_id].script_text;
    }
    return false;
  });

  const getPrompterText = (item: BroadcastRundownItem): string => {
    if (item.prompter_text) return item.prompter_text;
    if (item.story_id && stories[item.story_id]) {
      return stories[item.story_id].script_text || '';
    }
    return '';
  };

  const scrollToItem = (index: number) => {
    setCurrentItemIndex(index);
    const el = document.getElementById(`prompter-item-${index}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  return (
    <div ref={containerRef} className={cn('flex flex-col h-[calc(100vh-3rem)] md:h-screen', mirror ? 'transform scale-x-[-1]' : '')}>
      {/* Control bar (hideable) */}
      {showControls && (
        <div className={cn('p-2 border-b border-surface-800 bg-surface-900 flex items-center justify-between gap-3 z-10', mirror && 'transform scale-x-[-1]')}>
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold text-white">Prompter</h2>
            <select
              value={selectedRundownId || ''}
              onChange={(e) => setSelectedRundownId(e.target.value)}
              className="bg-surface-800 text-white border border-surface-700 rounded px-2 py-1 text-xs"
            >
              {rundowns.map(r => (
                <option key={r.id} value={r.id}>{r.title} {r.status === 'live' ? '● LIVE' : ''}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Font size */}
            <button onClick={() => setFontSize(Math.max(20, fontSize - 4))} className="text-surface-400 hover:text-white px-1 text-sm">A-</button>
            <span className="text-xs text-surface-500 w-8 text-center">{fontSize}</span>
            <button onClick={() => setFontSize(Math.min(120, fontSize + 4))} className="text-surface-400 hover:text-white px-1 text-lg font-bold">A+</button>
            <div className="w-px h-4 bg-surface-700" />

            {/* Speed */}
            <span className="text-[10px] text-surface-500">Speed:</span>
            <input
              type="range" min="0" max="10" value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-20 accent-brand-500"
            />
            <span className="text-xs text-surface-400 w-4">{speed}</span>
            <div className="w-px h-4 bg-surface-700" />

            {/* Mirror */}
            <Button size="sm" variant={mirror ? 'primary' : 'ghost'} onClick={() => setMirror(!mirror)}>
              Mirror
            </Button>

            {/* Nav */}
            <Button size="sm" variant="ghost" onClick={() => scrollToItem(Math.max(0, currentItemIndex - 1))}>
              ▲ Prev
            </Button>
            <Button size="sm" variant="ghost" onClick={() => scrollToItem(Math.min(prompterItems.length - 1, currentItemIndex + 1))}>
              ▼ Next
            </Button>

            <Button size="sm" variant="ghost" onClick={toggleFullscreen}>
              {isFullscreen ? 'Exit FS' : 'Fullscreen'}
            </Button>
          </div>

          <button onClick={() => setShowControls(false)} className="text-surface-500 hover:text-white text-xs">
            Hide Controls
          </button>
        </div>
      )}

      {/* Tap to show controls when hidden */}
      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="absolute top-0 left-0 right-0 h-8 z-20 opacity-0 hover:opacity-100 flex items-center justify-center bg-surface-900/80 text-xs text-surface-400"
        >
          Show Controls
        </button>
      )}

      {/* Prompter display */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-black"
        style={{ scrollBehavior: speed > 0 ? 'auto' : 'smooth' }}
      >
        {prompterItems.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className={cn('text-surface-500', mirror && 'transform scale-x-[-1]')}>
              {items.length === 0 ? 'No rundown selected or rundown is empty.' : 'No items have prompter text.'}
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto py-8 px-8">
            {prompterItems.map((item, i) => {
              const text = getPrompterText(item);
              const isOnAir = item.status === 'on_air';
              const isActive = i === currentItemIndex;

              return (
                <div
                  key={item.id}
                  id={`prompter-item-${i}`}
                  className={cn(
                    'mb-12 transition-opacity',
                    mirror && 'transform scale-x-[-1]',
                    isActive ? 'opacity-100' : 'opacity-60',
                  )}
                  onClick={() => setCurrentItemIndex(i)}
                >
                  {/* Item marker */}
                  <div className={cn(
                    'flex items-center gap-3 mb-3 pb-2 border-b',
                    isOnAir ? 'border-red-500' : 'border-surface-800',
                  )}>
                    <span className={cn(
                      'text-sm font-bold px-2 py-0.5 rounded',
                      isOnAir ? 'bg-red-600 text-white' : 'bg-surface-800 text-surface-400',
                    )}>
                      {item.page_number || `#${i + 1}`}
                    </span>
                    <span className="text-base text-surface-400 font-medium">{item.title}</span>
                    {item.planned_duration && (
                      <span className="text-sm text-surface-600">{formatBroadcastDuration(item.planned_duration)}</span>
                    )}
                    {isOnAir && <span className="text-sm text-red-400 font-bold animate-pulse ml-auto">ON AIR</span>}
                  </div>

                  {/* Prompter text */}
                  <div
                    className="text-white leading-relaxed"
                    style={{
                      fontSize: `${fontSize}px`,
                      lineHeight: '1.5',
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    {text.split('\n').map((line, j) => (
                      <p key={j} className={cn(
                        'mb-2',
                        line.startsWith('(') && line.endsWith(')') && 'text-yellow-400 italic',
                        line.startsWith('[') && line.endsWith(']') && 'text-cyan-400 text-[0.7em]',
                        line.toUpperCase() === line && line.length > 3 && 'text-green-300 font-bold',
                      )}>
                        {line || '\u00A0'}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* End marker */}
            <div className={cn('text-center py-20', mirror && 'transform scale-x-[-1]')}>
              <span className="text-2xl text-surface-700 font-bold">/// END ///</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
