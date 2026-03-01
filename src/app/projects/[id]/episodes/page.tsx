'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import Link from 'next/link';
import type { Script } from '@/lib/types';
// ── Statuses we assign to episodes (via revision_color) ───────────────────

const EPISODE_STATUSES = [
  { value: 'white',     label: 'Draft',        color: 'bg-surface-600',  text: 'text-surface-300' },
  { value: 'blue',      label: 'First Draft',  color: 'bg-blue-600',     text: 'text-blue-300' },
  { value: 'yellow',    label: 'In Progress',  color: 'bg-yellow-600',   text: 'text-yellow-300' },
  { value: 'green',     label: 'Ready',        color: 'bg-green-600',    text: 'text-green-300' },
  { value: 'goldenrod', label: 'Locked',       color: 'bg-amber-600',    text: 'text-amber-300' },
] as const;

function statusForColor(color: string) {
  return EPISODE_STATUSES.find(s => s.value === color) ?? EPISODE_STATUSES[0];
}

// ── Tiny arc colour strip ─────────────────────────────────────────────────

const ARC_COLORS = [
  'bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-rose-500',
  'bg-amber-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500',
];

// ── Helpers ───────────────────────────────────────────────────────────────

function episodeCode(index: number, season: number) {
  const ep = String(index + 1).padStart(2, '0');
  const s  = String(season).padStart(2, '0');
  return `S${s}E${ep}`;
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function EpisodesPage({ params }: { params: { id: string } }) {
  const { user }              = useAuthStore();
  const { currentProject, members } = useProjectStore();

  const canEdit = (() => {
    const role = members.find(m => m.user_id === user?.id)?.role
      ?? (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
    return role !== 'viewer';
  })();

  const season   = currentProject?.season_number  ?? 1;
  const planned  = currentProject?.episode_count  ?? null;

  const [scripts,  setScripts]  = useState<Script[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showNew,  setShowNew]  = useState(false);
  const [showEdit, setShowEdit] = useState<Script | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newSynop, setNewSynop] = useState('');
  const [creating, setCreating] = useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const fetch = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb
      .from('scripts')
      .select('*')
      .eq('project_id', params.id)
      .order('created_at', { ascending: true });
    setScripts(data ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetch(); }, [fetch]);

  // ── Create episode ────────────────────────────────────────────────────

  const createEpisode = async () => {
    if (!newTitle.trim() || !user) return;
    setCreating(true);
    try {
      const sb = createClient();
      const epNum = scripts.length + 1;
      const epCode = episodeCode(scripts.length, season);
      const title  = `${epCode} — ${newTitle.trim()}`;

      const { data, error } = await sb
        .from('scripts')
        .insert({
          project_id: params.id,
          title,
          created_by: user.id,
          title_page_data: {
            title,
            author: user.full_name ?? user.email ?? '',
            notes: newSynop.trim() || null,
          },
        })
        .select()
        .single();

      if (error) { toast.error('Failed to create episode'); return; }

      setScripts(prev => [...prev, data]);
      setNewTitle('');
      setNewSynop('');
      setShowNew(false);
      toast.success(`Episode ${epNum} created`);
    } finally {
      setCreating(false);
    }
  };

  // ── Update episode title/notes ────────────────────────────────────────

  const saveEdit = async () => {
    if (!showEdit) return;
    const sb = createClient();
    await sb
      .from('scripts')
      .update({
        title: showEdit.title,
        title_page_data: {
          ...showEdit.title_page_data,
          title: showEdit.title,
        },
      })
      .eq('id', showEdit.id);
    setScripts(prev => prev.map(s => s.id === showEdit.id ? showEdit : s));
    setShowEdit(null);
    toast.success('Episode updated');
  };

  // ── Delete episode ────────────────────────────────────────────────────

  const deleteEpisode = async (script: Script) => {
    const ok = await confirm({
      title: `Delete "${script.title}"?`,
      message: 'This will permanently delete the episode and all its script content. This cannot be undone.',
      confirmLabel: 'Delete Episode',
      variant: 'danger',
    });
    if (!ok) return;
    const sb = createClient();
    await sb.from('scripts').delete().eq('id', script.id);
    setScripts(prev => prev.filter(s => s.id !== script.id));
    toast.success('Episode deleted');
  };

  // ── Update status ─────────────────────────────────────────────────────

  const setStatus = async (script: Script, color: string) => {
    const sb = createClient();
    await sb.from('scripts').update({ revision_color: color }).eq('id', script.id);
    setScripts(prev => prev.map(s => s.id === script.id ? { ...s, revision_color: color as Script['revision_color'] } : s));
  };

  // ── Stats ─────────────────────────────────────────────────────────────

  const total       = scripts.length;
  const locked      = scripts.filter(s => s.locked || s.revision_color === 'goldenrod').length;
  const ready       = scripts.filter(s => s.revision_color === 'green').length;
  const inProgress  = scripts.filter(s => s.revision_color === 'blue' || s.revision_color === 'yellow').length;
  const progressPct = planned ? Math.round((total / planned) * 100) : null;

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <ConfirmDialog />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-white">{currentProject?.title}</h1>
            <Badge variant="default">Season {season}</Badge>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#FF5F1F]/15 text-[#FF8F5F] font-semibold">Episodic Series</span>
          </div>
          <p className="text-sm text-surface-400">
            {total} episode{total !== 1 ? 's' : ''}
            {planned ? ` · ${planned} planned` : ''}
            {' '}· {locked} locked · {ready} ready
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Link href={`/projects/${params.id}/arc-planner`}>
              <Button variant="ghost">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Arc Planner
              </Button>
            </Link>
            <Button onClick={() => setShowNew(true)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Episode
            </Button>
          </div>
        )}
      </div>

      {/* ── Series progress bar ── */}
      {planned && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-surface-400">Series Progress</span>
            <span className="text-xs font-semibold text-white">{total} / {planned} episodes</span>
          </div>
          <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-500"
              style={{ width: `${Math.min(progressPct ?? 0, 100)}%` }}
            />
          </div>
          {/* Arc colour reference strips */}
          <div className="mt-3 flex gap-1">
            {scripts.map((s, i) => {
              const st = statusForColor(s.revision_color);
              return (
                <div
                  key={s.id}
                  title={s.title}
                  className={cn('h-2 flex-1 rounded-sm', st.color, 'opacity-80')}
                />
              );
            })}
            {planned && Array.from({ length: Math.max(0, planned - scripts.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="h-2 flex-1 rounded-sm bg-surface-700/40" />
            ))}
          </div>
        </Card>
      )}

      {/* ── Episodes grid / list ── */}
      {total === 0 ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          }
          title="No episodes yet"
          description="Create your first episode to start writing your series."
          action={
            canEdit ? (
              <Button onClick={() => setShowNew(true)}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Episode 1
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {scripts.map((script, index) => {
            const code   = episodeCode(index, season);
            const status = statusForColor(script.revision_color);

            return (
              <Card
                key={script.id}
                className="group flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:border-surface-600 transition-colors"
              >
                {/* Colour strip */}
                <div className={cn('w-1 self-stretch rounded-full hidden sm:block shrink-0', status.color)} />

                {/* Episode code */}
                <div className="w-16 shrink-0">
                  <span className="text-xs font-mono font-semibold text-surface-400">{code}</span>
                </div>

                {/* Title + synopsis */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate leading-snug">{script.title}</h3>
                  {script.title_page_data?.notes && (
                    <p className="mt-0.5 text-xs text-surface-500 line-clamp-1">{script.title_page_data.notes}</p>
                  )}
                </div>

                {/* Status picker */}
                {canEdit && (
                  <div className="group/status relative">
                    <button
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                        status.color, status.text, 'hover:opacity-80'
                      )}
                    >
                      {status.label}
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {/* Dropdown */}
                    <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-xl border border-surface-700 bg-surface-900 shadow-2xl py-1 opacity-0 pointer-events-none group-hover/status:opacity-100 group-hover/status:pointer-events-auto transition-opacity">
                      {EPISODE_STATUSES.map(s => (
                        <button
                          key={s.value}
                          onClick={() => setStatus(script, s.value)}
                          className={cn(
                            'flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors hover:bg-surface-900/5',
                            s.text
                          )}
                        >
                          <span className={cn('w-2 h-2 rounded-full', s.color)} />
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Last edited */}
                <span className="text-[11px] text-surface-600 whitespace-nowrap hidden sm:block">
                  {timeAgo(script.updated_at)}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/projects/${params.id}/script?script_id=${script.id}`}>
                    <Button size="sm" variant="ghost">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Write
                    </Button>
                  </Link>
                  {canEdit && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowEdit(script)}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        </svg>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => deleteEpisode(script)}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── New Episode Modal ── */}
      <Modal
        isOpen={showNew}
        onClose={() => { setShowNew(false); setNewTitle(''); setNewSynop(''); }}
        title={`New Episode — ${episodeCode(scripts.length, season)}`}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Episode Title"
            placeholder="e.g. Pilot, The Beginning, Into the Dark..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            autoFocus
          />
          <Textarea
            label="Synopsis (optional)"
            placeholder="A brief description of what happens in this episode..."
            value={newSynop}
            onChange={e => setNewSynop(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setShowNew(false); setNewTitle(''); setNewSynop(''); }}>Cancel</Button>
            <Button onClick={createEpisode} loading={creating} disabled={!newTitle.trim()}>
              Create Episode
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Episode Modal ── */}
      <Modal
        isOpen={!!showEdit}
        onClose={() => setShowEdit(null)}
        title="Edit Episode"
        size="md"
      >
        {showEdit && (
          <div className="space-y-4">
            <Input
              label="Title"
              value={showEdit.title}
              onChange={e => setShowEdit({ ...showEdit, title: e.target.value })}
              autoFocus
            />
            <Textarea
              label="Synopsis"
              value={showEdit.title_page_data?.notes ?? ''}
              onChange={e => setShowEdit({
                ...showEdit,
                title_page_data: { ...showEdit.title_page_data, notes: e.target.value },
              })}
              rows={3}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
