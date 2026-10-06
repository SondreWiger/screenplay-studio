'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, LoadingPage, Modal, MoveButtons, toast, ToastContainer } from '@/components/ui';
import { cn } from '@/lib/utils';
import { fetchChapters } from '@/hooks/useNovel';
import { numberBinder } from '@/lib/novel/compile';
import type { NovelChapter, NovelTimelineEvent } from '@/lib/types';

const COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#64748b'];

type Draft = Pick<NovelTimelineEvent, 'title' | 'story_date' | 'description' | 'chapter_id' | 'character_ids' | 'color'>;
const emptyDraft = (): Draft => ({ title: '', story_date: '', description: '', chapter_id: null, character_ids: [], color: COLORS[0] });

export default function StoryTimelinePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';

  const [events, setEvents] = useState<NovelTimelineEvent[]>([]);
  const [chapters, setChapters] = useState<NovelChapter[]>([]);
  const [characters, setCharacters] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'story' | 'told'>('story');
  const [charFilter, setCharFilter] = useState<string>('');
  const [editing, setEditing] = useState<NovelTimelineEvent | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [ev, rows, chars] = await Promise.all([
      supabase.from('novel_timeline_events').select('*').eq('project_id', projectId).order('sort_order'),
      fetchChapters(projectId),
      supabase.from('characters').select('id, name, color').eq('project_id', projectId).order('name'),
    ]);
    setEvents((ev.data as NovelTimelineEvent[]) || []);
    setChapters(rows);
    setCharacters((chars.data as { id: string; name: string; color: string | null }[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const chapterLabels = useMemo(() => numberBinder(chapters, 'numerals'), [chapters]);
  const chapterName = (id: string | null) => {
    const c = chapters.find((x) => x.id === id);
    if (!c) return null;
    const label = chapterLabels.get(c.id);
    return [label, c.title].filter(Boolean).join(': ') || 'Untitled';
  };
  const charName = (id: string) => characters.find((c) => c.id === id)?.name ?? 'Unknown';

  const visible = events.filter((e) => !charFilter || e.character_ids.includes(charFilter));

  // In told order, an event is a flashback when it happens earlier in the
  // story than something already shown.
  const told = useMemo(() => {
    const chapterIndex = new Map(chapters.map((c, i) => [c.id, i]));
    const rank = new Map(events.map((e, i) => [e.id, i]));
    const list = [...visible].sort((a, b) =>
      (a.chapter_id ? chapterIndex.get(a.chapter_id) ?? 1e9 : 1e9) - (b.chapter_id ? chapterIndex.get(b.chapter_id) ?? 1e9 : 1e9)
      || (rank.get(a.id)! - rank.get(b.id)!));
    let maxSeen = -1;
    return list.map((e) => {
      const r = rank.get(e.id)!;
      const flashback = e.chapter_id !== null && r < maxSeen;
      if (e.chapter_id) maxSeen = Math.max(maxSeen, r);
      return { e, flashback };
    });
  }, [visible, events, chapters]);

  const openNew = () => { setEditing(null); setDraft(emptyDraft()); };
  const openEdit = (e: NovelTimelineEvent) => {
    setEditing(e);
    setDraft({ title: e.title, story_date: e.story_date, description: e.description, chapter_id: e.chapter_id, character_ids: e.character_ids, color: e.color });
  };

  const saveDraft = async () => {
    if (!draft || !draft.title.trim()) { toast('Give the event a title', 'error'); return; }
    const supabase = createClient();
    const payload = { ...draft, title: draft.title.trim(), story_date: draft.story_date?.trim() || null, description: draft.description?.trim() || null };
    if (editing) {
      const { error } = await supabase.from('novel_timeline_events').update(payload).eq('id', editing.id);
      if (error) { toast('Could not save', 'error'); return; }
    } else {
      const { error } = await supabase.from('novel_timeline_events').insert({ ...payload, project_id: projectId, sort_order: events.length, created_by: user?.id });
      if (error) { toast('Could not add', 'error'); return; }
    }
    setDraft(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    await createClient().from('novel_timeline_events').delete().eq('id', id);
    setDraft(null);
    load();
  };

  const move = async (id: string, dir: -1 | 1) => {
    const list = [...events];
    const i = list.findIndex((e) => e.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setEvents(list.map((e, k) => ({ ...e, sort_order: k })));
    const supabase = createClient();
    await Promise.all([
      supabase.from('novel_timeline_events').update({ sort_order: j }).eq('id', list[j].id),
      supabase.from('novel_timeline_events').update({ sort_order: i }).eq('id', list[i].id),
    ]);
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <ToastContainer />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Story Timeline</h1>
          <p className="text-sm text-surface-400 mt-0.5">What happens when, in the story&apos;s world, and where each event is told.</p>
        </div>
        {canEdit && <Button onClick={openNew}>Add event</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-surface-700 p-0.5" role="group" aria-label="Order">
          <button type="button" onClick={() => setView('story')} aria-pressed={view === 'story'}
            className={cn('px-3 py-1 text-xs font-medium rounded-md', view === 'story' ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white')}>
            Story order
          </button>
          <button type="button" onClick={() => setView('told')} aria-pressed={view === 'told'}
            className={cn('px-3 py-1 text-xs font-medium rounded-md', view === 'told' ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white')}>
            As told
          </button>
        </div>
        {characters.length > 0 && (
          <select value={charFilter} onChange={(e) => setCharFilter(e.target.value)} aria-label="Filter by character"
            className="rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-1.5 text-xs text-white">
            <option value="">All characters</option>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <span className="text-xs text-surface-500">{visible.length} {visible.length === 1 ? 'event' : 'events'}</span>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-700 p-10 text-center">
          <p className="text-white font-medium">No events yet</p>
          <p className="mt-1 text-sm text-surface-400">Add events in the order they happen. Link each to the chapter that tells it to spot flashbacks and gaps.</p>
        </div>
      ) : (
        <ol className="relative border-l border-surface-700 ml-3 space-y-4">
          {(view === 'story' ? visible.map((e) => ({ e, flashback: false })) : told).map(({ e, flashback }, i, arr) => {
            const prevChapter = view === 'told' && i > 0 ? arr[i - 1].e.chapter_id : undefined;
            const showChapterHead = view === 'told' && (i === 0 || prevChapter !== e.chapter_id);
            return (
              <li key={e.id} className="ml-6">
                {showChapterHead && (
                  <p className="-ml-6 mb-2 pl-6 text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                    {e.chapter_id ? chapterName(e.chapter_id) : 'Not in a chapter yet'}
                  </p>
                )}
                <span className="absolute -left-[7px] mt-4 w-3.5 h-3.5 rounded-full ring-4 ring-surface-950" style={{ background: e.color || COLORS[0] }} />
                <div className="group rounded-xl border border-surface-800 bg-surface-900/50 p-4 hover:border-surface-700">
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => openEdit(e)} className="flex-1 min-w-0 text-left">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        {e.story_date && <span className="text-xs font-semibold text-teal-300">{e.story_date}</span>}
                        <h3 className="text-sm font-semibold text-white">{e.title}</h3>
                        {flashback && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">Flashback</span>}
                      </div>
                      {e.description && <p className="mt-1 text-sm text-surface-400 line-clamp-3">{e.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {view === 'story' && e.chapter_id && (
                          <span className="rounded bg-surface-800 px-1.5 py-0.5 text-[10px] text-surface-300">{chapterName(e.chapter_id)}</span>
                        )}
                        {e.character_ids.map((id) => (
                          <span key={id} className="rounded-full bg-surface-800 px-2 py-0.5 text-[10px] text-surface-300">{charName(id)}</span>
                        ))}
                      </div>
                    </button>
                    {canEdit && view === 'story' && !charFilter && (
                      <MoveButtons
                        onMoveUp={() => move(e.id, -1)}
                        onMoveDown={() => move(e.id, 1)}
                        disableUp={i === 0}
                        disableDown={i === events.length - 1}
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Modal isOpen={!!draft} onClose={() => setDraft(null)} title={editing ? 'Edit event' : 'New event'}>
        {draft && (
          <div className="space-y-4">
            <label className="block">
              <span className="block text-xs text-surface-400 mb-1">What happens</span>
              <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} readOnly={!canEdit}
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" placeholder="The lighthouse goes dark" />
            </label>
            <label className="block">
              <span className="block text-xs text-surface-400 mb-1">When, in the story</span>
              <input value={draft.story_date || ''} onChange={(e) => setDraft({ ...draft, story_date: e.target.value })} readOnly={!canEdit}
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" placeholder="Day 3, evening · Spring 1888 · 12 years earlier" />
            </label>
            <label className="block">
              <span className="block text-xs text-surface-400 mb-1">Details</span>
              <textarea value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} readOnly={!canEdit} rows={3}
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" />
            </label>
            <label className="block">
              <span className="block text-xs text-surface-400 mb-1">Told in</span>
              <select value={draft.chapter_id || ''} onChange={(e) => setDraft({ ...draft, chapter_id: e.target.value || null })} disabled={!canEdit}
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white">
                <option value="">Not in a chapter (backstory, offstage)</option>
                {chapters.filter((c) => c.kind !== 'part').map((c) => <option key={c.id} value={c.id}>{chapterName(c.id)}</option>)}
              </select>
            </label>
            {characters.length > 0 && (
              <div>
                <span className="block text-xs text-surface-400 mb-1.5">Who&apos;s involved</span>
                <div className="flex flex-wrap gap-1.5">
                  {characters.map((c) => {
                    const on = draft.character_ids.includes(c.id);
                    return (
                      <button key={c.id} type="button" disabled={!canEdit} aria-pressed={on}
                        onClick={() => setDraft({ ...draft, character_ids: on ? draft.character_ids.filter((x) => x !== c.id) : [...draft.character_ids, c.id] })}
                        className={cn('rounded-full px-2.5 py-1 text-xs', on ? 'bg-teal-600 text-white' : 'bg-surface-800 text-surface-400 hover:text-white')}>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <span className="block text-xs text-surface-400 mb-1.5">Colour</span>
              <div className="flex gap-1.5">
                {COLORS.map((c) => (
                  <button key={c} type="button" disabled={!canEdit} onClick={() => setDraft({ ...draft, color: c })} aria-label={`Colour ${c}`}
                    className={cn('w-6 h-6 rounded-full', draft.color === c && 'ring-2 ring-white/70 ring-offset-2 ring-offset-surface-900')} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex justify-between pt-2">
              {editing && canEdit ? <Button variant="danger" onClick={() => remove(editing.id)}>Delete</Button> : <span />}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                {canEdit && <Button onClick={saveDraft}>{editing ? 'Save' : 'Add event'}</Button>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
