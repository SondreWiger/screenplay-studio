'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
// ============================================================
// Corkboard — drag-and-drop index-card scene organiser
// Cards reorder scenes by updating sort_order in the DB.
// ============================================================

interface Scene {
  id: string;
  project_id: string;
  scene_number: string | null;
  scene_heading: string | null;
  title: string | null;
  synopsis: string | null;
  color: string | null;
  location_type: string | null;
  time_of_day: string | null;
  page_count: number | null;
  estimated_duration_minutes: number | null;
  is_completed: boolean;
  sort_order: number;
}

const TIME_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  DAY:   { bg: 'bg-amber-500/8',  border: 'border-amber-500/30',  badge: 'bg-amber-500/20 text-amber-300' },
  NIGHT: { bg: 'bg-indigo-500/8', border: 'border-indigo-500/30', badge: 'bg-indigo-500/20 text-indigo-300' },
  DAWN:  { bg: 'bg-orange-500/8', border: 'border-orange-500/30', badge: 'bg-orange-400/20 text-orange-300' },
  DUSK:  { bg: 'bg-purple-500/8', border: 'border-purple-500/30', badge: 'bg-purple-500/20 text-purple-300' },
  DUSK_DAWN: { bg: 'bg-pink-500/8', border: 'border-pink-500/30', badge: 'bg-pink-500/20 text-pink-300' },
  CONTINUOUS: { bg: 'bg-teal-500/8', border: 'border-teal-500/30', badge: 'bg-teal-500/20 text-teal-300' },
  LATER: { bg: 'bg-surface-700/30', border: 'border-surface-600/30', badge: 'bg-surface-700 text-surface-400' },
};
const DEFAULT_COLOR = { bg: 'bg-surface-800/40', border: 'border-surface-700/40', badge: 'bg-surface-700 text-surface-400' };

function getTimeColor(time?: string) {
  if (!time) return DEFAULT_COLOR;
  const t = time.toUpperCase().trim();
  return TIME_COLORS[t] ?? DEFAULT_COLOR;
}

type SceneCard = Scene & { _dragIdx?: number };

// ── Inline editable synopsis ──────────────────────────────────
function SynopsisEditor({
  sceneId,
  value,
  canEdit,
  onSave,
}: {
  sceneId: string;
  value: string;
  canEdit: boolean;
  onSave: (id: string, synopsis: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const handleBlur = () => {
    setEditing(false);
    if (draft !== value) onSave(sceneId, draft);
  };

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        className="w-full text-xs text-surface-300 bg-surface-700/60 rounded p-1.5 resize-none border border-[#FF5F1F]/40 focus:outline-none leading-relaxed"
        rows={4}
      />
    );
  }

  return (
    <p
      className={cn(
        'text-xs text-surface-400 leading-relaxed min-h-[3rem]',
        canEdit && 'cursor-text hover:text-surface-300 transition-colors',
        !value && 'italic text-surface-600',
      )}
      onClick={() => canEdit && setEditing(true)}
      title={canEdit ? 'Click to edit synopsis' : undefined}
    >
      {value || 'Click to add synopsis…'}
    </p>
  );
}

// ── Main scene card ───────────────────────────────────────────
function SceneCard({
  scene,
  index,
  isDragging,
  isDragOver,
  canEdit,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onSynopsisSave,
  onToggleComplete,
  onColorChange,
}: {
  scene: SceneCard;
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  canEdit: boolean;
  onDragStart: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDrop: (i: number) => void;
  onDragEnd: () => void;
  onSynopsisSave: (id: string, text: string) => void;
  onToggleComplete: (id: string, val: boolean) => void;
  onColorChange: (id: string, color: string) => void;
}) {
  const timeColor = getTimeColor(scene.time_of_day ?? '');
  const CARD_COLORS = [
    { label: 'Default', value: '' },
    { label: 'Red',     value: 'red' },
    { label: 'Green',   value: 'green' },
    { label: 'Blue',    value: 'blue' },
    { label: 'Yellow',  value: 'yellow' },
    { label: 'Purple',  value: 'purple' },
    { label: 'Pink',    value: 'pink' },
    { label: 'Teal',    value: 'teal' },
  ];
  const customColorMap: Record<string, string> = {
    red:    'bg-red-900/40 border-red-700/40',
    green:  'bg-emerald-900/40 border-emerald-700/40',
    blue:   'bg-blue-900/40 border-blue-700/40',
    yellow: 'bg-amber-900/40 border-amber-700/40',
    purple: 'bg-purple-900/40 border-purple-700/40',
    pink:   'bg-pink-900/40 border-pink-700/40',
    teal:   'bg-teal-900/40 border-teal-700/40',
  };
  const cardColorClass = scene.color
    ? customColorMap[scene.color] ?? `${timeColor.bg} ${timeColor.border}`
    : `${timeColor.bg} ${timeColor.border}`;

  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div
      draggable={canEdit}
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      onDragEnd={onDragEnd}
      className={cn(
        'relative rounded-xl border p-4 transition-all duration-150 group',
        cardColorClass,
        isDragging && 'opacity-30 scale-95',
        isDragOver && !isDragging && 'ring-2 ring-[#FF5F1F]/60 scale-[1.02]',
        canEdit && 'cursor-grab active:cursor-grabbing',
      )}
    >
      {/* Scene number + type + completion */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-surface-500 font-mono">
            #{scene.scene_number ?? index + 1}
          </span>
          {scene.location_type && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/60 text-surface-300 font-mono">
              {scene.location_type.replace('_', '/')}
            </span>
          )}
          {scene.time_of_day && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-mono', timeColor.badge)}>
              {scene.time_of_day}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && (
            <div className="relative">
              <button
                onClick={() => setShowColorPicker((v) => !v)}
                className="w-5 h-5 rounded border border-surface-700 bg-surface-800 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                title="Card colour"
              >
                <div className="w-full h-full rounded" style={{ background: 'conic-gradient(red,yellow,green,blue,red)' }} />
              </button>
              {showColorPicker && (
                <div className="absolute right-0 top-6 z-20 bg-surface-800 border border-surface-700 rounded-lg p-2 flex gap-1 shadow-xl">
                  {CARD_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => { onColorChange(scene.id, c.value); setShowColorPicker(false); }}
                      className="w-5 h-5 rounded border border-surface-600 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c.value ? c.value : '#374151' }}
                      title={c.label}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => canEdit && onToggleComplete(scene.id, !scene.is_completed)}
            className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
              scene.is_completed
                ? 'bg-green-500 border-green-500'
                : 'border-surface-600 hover:border-green-500',
            )}
            title={scene.is_completed ? 'Mark incomplete' : 'Mark complete'}
            disabled={!canEdit}
          >
            {scene.is_completed && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Scene heading / title */}
      <p className={cn(
        'text-sm font-semibold mb-2 leading-snug',
        scene.is_completed ? 'text-surface-500 line-through' : 'text-white',
      )}>
        {scene.scene_heading || scene.title || `Scene ${scene.scene_number ?? index + 1}`}
      </p>

      {/* Synopsis — inline editable */}
      <SynopsisEditor
        sceneId={scene.id}
        value={scene.synopsis ?? ''}
        canEdit={canEdit}
        onSave={onSynopsisSave}
      />

      {/* Footer: page count + duration */}
      {(scene.page_count || scene.estimated_duration_minutes) && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-surface-700/40">
          {scene.page_count && (
            <span className="text-[10px] text-surface-500">{scene.page_count}p</span>
          )}
          {scene.estimated_duration_minutes && (
            <span className="text-[10px] text-surface-500">{scene.estimated_duration_minutes} min</span>
          )}
        </div>
      )}

      {/* Drag handle indicator */}
      {canEdit && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-30 transition-opacity">
          <svg className="w-4 h-4 text-surface-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function CorkboardPage({ params }: { params: { id: string } }) {
  const { user }              = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole       = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit               = currentUserRole !== 'viewer';

  const [scenes, setScenes]   = useState<SceneCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [filter, setFilter]   = useState<'all' | 'incomplete' | 'complete'>('all');

  const dragIdx   = useRef<number | null>(null);
  const dragOver  = useRef<number | null>(null);

  useEffect(() => { fetchScenes(); }, [params.id]);

  const fetchScenes = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('scenes')
      .select('*')
      .eq('project_id', params.id)
      .order('sort_order');
    setScenes(data || []);
    setLoading(false);
  };

  const handleDragStart = useCallback((index: number) => {
    dragIdx.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOver.current = index;
    setScenes((prev) => {
      const arr = [...prev];
      arr.forEach((s, i) => { (s as SceneCard)._dragIdx = i; });
      return arr;
    });
  }, []);

  const handleDrop = useCallback(async (toIndex: number) => {
    if (dragIdx.current === null || dragIdx.current === toIndex) return;

    setScenes((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIdx.current!, 1);
      arr.splice(toIndex, 0, moved);
      return arr;
    });

    dragIdx.current  = null;
    dragOver.current = null;
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIdx.current  = null;
    dragOver.current = null;
  }, []);

  const persistOrder = useCallback(async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await Promise.all(
        scenes.map((s, i) =>
          supabase.from('scenes').update({ sort_order: i * 10 }).eq('id', s.id),
        ),
      );
      toast.success('Order saved');
    } catch {
      toast.error('Failed to save order');
    } finally {
      setSaving(false);
    }
  }, [scenes, canEdit]);

  const handleSynopsisSave = useCallback(async (sceneId: string, synopsis: string) => {
    setScenes((prev) => prev.map((s) => s.id === sceneId ? { ...s, synopsis } : s));
    const supabase = createClient();
    await supabase.from('scenes').update({ synopsis }).eq('id', sceneId);
  }, []);

  const handleToggleComplete = useCallback(async (sceneId: string, val: boolean) => {
    setScenes((prev) => prev.map((s) => s.id === sceneId ? { ...s, is_completed: val } : s));
    const supabase = createClient();
    await supabase.from('scenes').update({ is_completed: val }).eq('id', sceneId);
  }, []);

  const handleColorChange = useCallback(async (sceneId: string, color: string) => {
    setScenes((prev) => prev.map((s) => s.id === sceneId ? { ...s, color } : s));
    const supabase = createClient();
    await supabase.from('scenes').update({ color }).eq('id', sceneId);
  }, []);

  const filteredScenes = scenes.filter((s) => {
    if (filter === 'incomplete') return !s.is_completed;
    if (filter === 'complete')   return s.is_completed;
    return true;
  });

  const completedCount = scenes.filter((s) => s.is_completed).length;

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Corkboard</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {scenes.length} scenes · {completedCount} completed
            {canEdit && ' · Drag to reorder'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter */}
          <div className="flex items-center gap-0.5 bg-surface-800/60 rounded-lg p-0.5">
            {(['all', 'incomplete', 'complete'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                  filter === f ? 'bg-[#FF5F1F] text-white' : 'text-surface-400 hover:text-white',
                )}
              >
                {f}
              </button>
            ))}
          </div>
          {canEdit && (
            <Button onClick={persistOrder} disabled={saving} size="sm">
              {saving ? 'Saving…' : 'Save Order'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchScenes}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner className="py-32" />
      ) : filteredScenes.length === 0 ? (
        <div className="text-center py-24 text-surface-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />
          </svg>
          <p className="font-medium">No scenes yet</p>
          <p className="text-sm mt-1">Add scenes from the Scenes page or sync from your script</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredScenes.map((scene, index) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              index={index}
              isDragging={dragIdx.current === index}
              isDragOver={dragOver.current === index && dragIdx.current !== index}
              canEdit={canEdit}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onSynopsisSave={handleSynopsisSave}
              onToggleComplete={handleToggleComplete}
              onColorChange={handleColorChange}
            />
          ))}
        </div>
      )}

      {canEdit && scenes.length > 0 && (
        <p className="text-xs text-surface-600 text-center mt-8">
          Drag cards to reorder · Click synopsis text to edit inline · Click ○ to mark complete
        </p>
      )}
    </div>
  );
}
