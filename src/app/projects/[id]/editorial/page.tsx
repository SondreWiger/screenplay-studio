'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/lib/stores';
import { Button, Modal, Input, Textarea, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { BroadcastStory, BroadcastStoryStatus, BroadcastStoryType } from '@/lib/types';
import {
  BROADCAST_STORY_STATUS_OPTIONS,
  BROADCAST_STORY_TYPES,
  formatBroadcastDuration,
} from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Editorial Board — Story pitching, assignment & status kanban
// The morning meeting view: see every story, who owns it, where it is
// ────────────────────────────────────────────────────────────

const BOARD_COLUMNS: { status: BroadcastStoryStatus; label: string; color: string; bg: string }[] = [
  { status: 'draft',    label: 'Pitched / Draft', color: 'text-surface-400', bg: 'bg-surface-800/50' },
  { status: 'working',  label: 'In Progress',      color: 'text-blue-400',    bg: 'bg-blue-950/30' },
  { status: 'ready',    label: 'Ready to Air',     color: 'text-cyan-400',    bg: 'bg-cyan-950/30' },
  { status: 'approved', label: 'Approved',          color: 'text-green-400',   bg: 'bg-green-950/30' },
  { status: 'killed',   label: 'Killed',            color: 'text-red-400',     bg: 'bg-red-950/20' },
];

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Routine', color: 'text-surface-500' },
  1: { label: 'Normal',  color: 'text-surface-400' },
  2: { label: 'Urgent',  color: 'text-amber-400' },
  3: { label: 'Flash',   color: 'text-red-400' },
};

const TYPE_BADGE: Record<BroadcastStoryType, string> = {
  reader: 'bg-surface-700', vo: 'bg-sky-800', sot: 'bg-indigo-800',
  vosot: 'bg-indigo-700', pkg: 'bg-violet-800', live: 'bg-red-800',
  interview: 'bg-blue-800', donut: 'bg-purple-800',
  break: 'bg-surface-800', tease: 'bg-amber-800', cold_open: 'bg-orange-800',
  kicker: 'bg-emerald-800', other: 'bg-surface-700',
};

interface PitchForm {
  title: string;
  story_type: BroadcastStoryType;
  priority: number;
  estimated_duration: number;
  source: string;
  script_text: string;
  assigned_to: string;
}

const DEFAULT_FORM: PitchForm = {
  title: '', story_type: 'reader', priority: 1,
  estimated_duration: 30, source: '', script_text: '', assigned_to: '',
};

export default function EditorialPage({ params }: { params: { id: string } }) {
  const { currentProject, members } = useProjectStore();
  const projectId = params.id;

  const [stories, setStories] = useState<BroadcastStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [search, setSearch] = useState('');
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [editStory, setEditStory] = useState<BroadcastStory | null>(null);
  const [form, setForm] = useState<PitchForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // ─── Fetch ─────────────────────────────────────────────

  const fetchStories = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('broadcast_stories')
      .select('*')
      .eq('project_id', projectId)
      .not('status', 'in', '("archived","on_air")')
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) console.error(error);
    setStories(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchStories(); }, [fetchStories]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`editorial-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_stories', filter: `project_id=eq.${projectId}` }, fetchStories)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, fetchStories]);

  // ─── Moves & Updates ───────────────────────────────────

  const moveStory = async (story: BroadcastStory, newStatus: BroadcastStoryStatus) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('broadcast_stories')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', story.id);
    if (error) toast.error(error.message);
    else fetchStories();
  };

  const savePitch = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    const supabase = createClient();

    const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

    if (editStory) {
      const { error } = await supabase.from('broadcast_stories').update({
        title: form.title,
        story_type: form.story_type,
        priority: form.priority,
        estimated_duration: form.estimated_duration || null,
        source: form.source || null,
        script_text: form.script_text || null,
        assigned_to: form.assigned_to || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editStory.id);
      if (error) toast.error(error.message);
      else { toast.success('Story updated'); setShowPitchModal(false); setEditStory(null); fetchStories(); }
    } else {
      const { error } = await supabase.from('broadcast_stories').insert({
        project_id: projectId,
        slug: `${slug}-${Date.now().toString(36)}`,
        title: form.title,
        story_type: form.story_type,
        priority: form.priority,
        status: 'draft',
        estimated_duration: form.estimated_duration || null,
        source: form.source || null,
        script_text: form.script_text || null,
        assigned_to: form.assigned_to || null,
        version: 1,
      });
      if (error) toast.error(error.message);
      else { toast.success('Pitch added'); setShowPitchModal(false); fetchStories(); }
    }
    setSaving(false);
  };

  const openEdit = (s: BroadcastStory) => {
    setEditStory(s);
    setForm({
      title: s.title, story_type: s.story_type, priority: s.priority,
      estimated_duration: s.estimated_duration || 30, source: s.source || '',
      script_text: s.script_text || '', assigned_to: s.assigned_to || '',
    });
    setShowPitchModal(true);
  };

  const deleteStory = async (id: string) => {
    if (!confirm('Archive this story?')) return;
    const supabase = createClient();
    await supabase.from('broadcast_stories').update({ status: 'archived' }).eq('id', id);
    fetchStories();
  };

  // ─── Derived ────────────────────────────────────────────

  const filtered = stories.filter(s => {
    if (filterAssignee !== 'all' && s.assigned_to !== filterAssignee) return false;
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPlannedSeconds = stories
    .filter(s => ['working', 'ready', 'approved'].includes(s.status))
    .reduce((sum, s) => sum + (s.estimated_duration || 0), 0);

  const getMemberName = (userId: string | null) => {
    if (!userId) return null;
    const m = members.find(m => m.user_id === userId);
    return (m?.profile as { full_name?: string; email?: string } | null)?.full_name
      || (m?.profile as { email?: string } | null)?.email?.split('@')[0]
      || null;
  };

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-screen bg-surface-950 overflow-hidden">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-800 bg-surface-900/60 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold text-white">Editorial Board</h1>
          <span className="text-xs text-surface-500">
            {stories.length} stories · {formatBroadcastDuration(totalPlannedSeconds)} planned
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search stories…"
            className="w-40 bg-surface-800 border border-surface-700 rounded px-2.5 py-1 text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-[#FF5F1F]"
          />
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded px-2 py-1 text-xs text-white"
          >
            <option value="all">All reporters</option>
            {members.map(m => (
              <option key={m.user_id} value={m.user_id}>
                {(m.profile as { full_name?: string } | null)?.full_name || m.user_id}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => { setEditStory(null); setForm(DEFAULT_FORM); setShowPitchModal(true); }}>
            + Pitch Story
          </Button>
        </div>
      </div>

      {/* ── Kanban Board ───────────────────────────────── */}
      <div className="flex-1 flex gap-3 overflow-x-auto p-4 min-h-0">
        {BOARD_COLUMNS.map(col => {
          const colStories = filtered.filter(s => s.status === col.status);
          return (
            <div key={col.status} className={cn('flex flex-col rounded-lg min-h-0 flex-none w-64', col.bg)}>
              {/* Column header */}
              <div className={cn('flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0')}>
                <span className={cn('text-xs font-bold uppercase tracking-wider', col.color)}>
                  {col.label}
                </span>
                <span className="text-[10px] text-surface-600 bg-surface-900/60 px-1.5 py-0.5 rounded-full">
                  {colStories.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {colStories.length === 0 && (
                  <div className="text-center py-8 text-surface-700 text-xs">No stories</div>
                )}
                {colStories.map(story => {
                  const typeInfo = BROADCAST_STORY_TYPES.find(t => t.value === story.story_type);
                  const prio = PRIORITY_LABELS[story.priority] || PRIORITY_LABELS[0];
                  const assignee = getMemberName(story.assigned_to);
                  return (
                    <div
                      key={story.id}
                      className="bg-surface-900 border border-surface-800 rounded-lg p-3 cursor-pointer hover:border-surface-600 transition-all group"
                      onClick={() => openEdit(story)}
                    >
                      {/* Type badge + priority */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn('text-[10px] font-bold text-white px-1.5 py-0.5 rounded uppercase', TYPE_BADGE[story.story_type])}>
                          {typeInfo?.abbr || story.story_type}
                        </span>
                        <span className={cn('text-[10px] font-medium', prio.color)}>{prio.label}</span>
                      </div>

                      {/* Title */}
                      <p className="text-xs font-semibold text-white leading-tight mb-2 line-clamp-2">
                        {story.title}
                      </p>

                      {/* Duration + Assignee */}
                      <div className="flex items-center justify-between text-[10px] text-surface-500">
                        <span>{story.estimated_duration ? formatBroadcastDuration(story.estimated_duration) : '—'}</span>
                        {assignee && <span className="text-surface-400 truncate max-w-[80px]">@{assignee}</span>}
                      </div>

                      {/* Source chip */}
                      {story.source && (
                        <div className="mt-1.5 text-[9px] text-surface-600 bg-surface-800 px-1.5 py-0.5 rounded inline-block uppercase tracking-wide">
                          {story.source}
                        </div>
                      )}

                      {/* Move buttons */}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        {BOARD_COLUMNS.filter(c => c.status !== col.status).map(target => (
                          <button
                            key={target.status}
                            onClick={() => moveStory(story, target.status)}
                            className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-colors', target.color, 'bg-surface-800 hover:bg-surface-700')}
                          >
                            → {target.label.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add pitch quick-add */}
              {col.status === 'draft' && (
                <button
                  onClick={() => { setEditStory(null); setForm(DEFAULT_FORM); setShowPitchModal(true); }}
                  className="mx-2 mb-2 mt-1 py-1.5 text-[11px] text-surface-600 hover:text-surface-400 border border-dashed border-surface-800 hover:border-surface-600 rounded text-center transition-colors flex-shrink-0"
                >
                  + Pitch a story
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Pitch / Edit Modal ─────────────────────────── */}
      <Modal
        isOpen={showPitchModal}
        onClose={() => { setShowPitchModal(false); setEditStory(null); }}
        title={editStory ? 'Edit Story' : 'Pitch a Story'}
      >
        <div className="space-y-3">
          <Input
            label="Headline"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Story headline…"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Story Type</label>
              <select
                value={form.story_type}
                onChange={e => setForm(p => ({ ...p, story_type: e.target.value as BroadcastStoryType }))}
                className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-white"
              >
                {BROADCAST_STORY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.abbr} — {t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-surface-400 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) }))}
                className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-white"
              >
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Planned Duration (sec)</label>
              <input
                type="number"
                value={form.estimated_duration}
                onChange={e => setForm(p => ({ ...p, estimated_duration: Number(e.target.value) }))}
                className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-white"
                min={0} step={5}
              />
            </div>

            <div>
              <label className="block text-xs text-surface-400 mb-1">Assign To</label>
              <select
                value={form.assigned_to}
                onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-white"
              >
                <option value="">Unassigned</option>
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {(m.profile as { full_name?: string } | null)?.full_name || m.user_id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-surface-400 mb-1">Source / Origin</label>
            <input
              value={form.source}
              onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
              placeholder="e.g. staff, wire:ap, wire:reuters, tip"
              className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-white placeholder:text-surface-600"
            />
          </div>

          <Textarea
            label="Initial Script / Notes"
            value={form.script_text}
            onChange={e => setForm(p => ({ ...p, script_text: e.target.value }))}
            placeholder="Anchor copy, key facts, background…"
            rows={5}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setShowPitchModal(false); setEditStory(null); }}>Cancel</Button>
            <Button onClick={savePitch} disabled={saving}>{saving ? 'Saving…' : editStory ? 'Update' : 'Pitch'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
