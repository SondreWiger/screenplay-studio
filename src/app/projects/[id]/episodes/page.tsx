'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Modal, Input, Textarea, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import Link from 'next/link';
import type { Script } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SeasonDef {
  num: number;
  name: string;
  color: string;
}

// Per-episode metadata stored in scripts.metadata
interface EpisodeMeta {
  sort_order?: number;
  episode_season?: number;
  episode_color?: string;
  version_config?: unknown;
  [key: string]: unknown;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EPISODE_STATUSES = [
  { value: 'white',     label: 'Draft',       dot: 'bg-surface-500',  pill: 'bg-surface-700  text-surface-300' },
  { value: 'blue',      label: 'First Draft', dot: 'bg-blue-500',     pill: 'bg-blue-500/20  text-blue-300' },
  { value: 'yellow',    label: 'In Progress', dot: 'bg-yellow-500',   pill: 'bg-yellow-500/20  text-yellow-300' },
  { value: 'green',     label: 'Ready',       dot: 'bg-green-500',    pill: 'bg-green-500/20  text-green-300' },
  { value: 'goldenrod', label: 'Locked',      dot: 'bg-amber-500',    pill: 'bg-amber-500/20  text-amber-300' },
] as const;

const SEASON_PALETTE = [
  '#6366f1','#0ea5e9','#10b981','#f59e0b',
  '#ef4444','#ec4899','#8b5cf6','#14b8a6',
];

const EPISODE_COLORS = [
  { label: 'None',      value: '' },
  { label: 'Violet',    value: '#7c3aed' },
  { label: 'Sky',       value: '#0284c7' },
  { label: 'Emerald',   value: '#059669' },
  { label: 'Amber',     value: '#d97706' },
  { label: 'Rose',      value: '#e11d48' },
  { label: 'Pink',      value: '#db2777' },
  { label: 'Orange',    value: '#FF5F1F' },
  { label: 'Teal',      value: '#0d9488' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusFor(color: string) {
  return EPISODE_STATUSES.find(s => s.value === color) ?? EPISODE_STATUSES[0];
}

function epMeta(s: Script): EpisodeMeta {
  return (s.metadata ?? {}) as EpisodeMeta;
}

function episodeCode(episodeNum: number, seasonNum: number) {
  return `S${String(seasonNum).padStart(2,'0')}E${String(episodeNum).padStart(2,'0')}`;
}

/** Strip the leading SxxExx — prefix from a stored title for display. */
function stripEpCode(title: string): string {
  return title.replace(/^S\d+E\d+\s*[-\u2013\u2014]\s*/i, '').trim() || title;
}

function defaultSeasons(count: number): SeasonDef[] {
  return Array.from({ length: count }, (_, i) => ({
    num: i + 1,
    name: `Season ${i + 1}`,
    color: SEASON_PALETTE[i % SEASON_PALETTE.length],
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EpisodesPage({ params }: { params: { id: string } }) {
  const { user }              = useAuthStore();
  const { currentProject, members } = useProjectStore();

  const canEdit = (() => {
    const role = members.find(m => m.user_id === user?.id)?.role
      ?? (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
    return role !== 'viewer';
  })();

  // ── State ──────────────────────────────────────────────────────────────────

  const [scripts,  setScripts]  = useState<Script[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [seasons,  setSeasons]  = useState<SeasonDef[]>([]);
  const [savingSeason, setSavingSeason] = useState(false);

  // Modals
  const [showNew,      setShowNew]      = useState(false);
  const [showEdit,     setShowEdit]     = useState<Script | null>(null);
  const [showSeasonMgr, setShowSeasonMgr] = useState(false);

  // New episode form
  const [newTitle,   setNewTitle]   = useState('');
  const [newSynop,   setNewSynop]   = useState('');
  const [newSeason,  setNewSeason]  = useState<number>(1);
  const [creating,   setCreating]   = useState(false);

  // Controlled dropdowns (fixes z-index)
  const [openStatusFor,  setOpenStatusFor]  = useState<string | null>(null);
  const [openSeasonFor,  setOpenSeasonFor]  = useState<string | null>(null);
  const [openColorFor,   setOpenColorFor]   = useState<string | null>(null);

  // Drag-and-drop
  const [dragging,  setDragging]  = useState<string | null>(null);
  const [dragOver,  setDragOver]  = useState<string | null>(null);

  const { confirm, ConfirmDialog } = useConfirmDialog();

  // ── Data loading ───────────────────────────────────────────────────────────

  const fetchScripts = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb
      .from('scripts')
      .select('*')
      .eq('project_id', params.id);
    if (data) {
      // Sort by metadata.sort_order, fallback to created_at
      const sorted = [...data].sort((a, b) => {
        const oa = (a.metadata as EpisodeMeta)?.sort_order ?? 9999;
        const ob = (b.metadata as EpisodeMeta)?.sort_order ?? 9999;
        if (oa !== ob) return oa - ob;
        return a.created_at < b.created_at ? -1 : 1;
      });
      setScripts(sorted as Script[]);
    }
    setLoading(false);
  }, [params.id]);

  const loadSeasons = useCallback(() => {
    if (!currentProject) return;
    const stored = (currentProject.content_metadata as any)?.series_seasons;
    if (stored) {
      try {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSeasons(parsed);
          setNewSeason(parsed[0].num);
          return;
        }
      } catch {}
    }
    // Bootstrap from project season_number
    const count = currentProject.season_number ?? 1;
    const def = defaultSeasons(count);
    setSeasons(def);
    setNewSeason(def[0].num);
  }, [currentProject]);

  useEffect(() => { fetchScripts(); }, [fetchScripts]);
  useEffect(() => { loadSeasons(); }, [loadSeasons]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openStatusFor && !openSeasonFor && !openColorFor) return;
    const close = () => {
      setOpenStatusFor(null);
      setOpenSeasonFor(null);
      setOpenColorFor(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openStatusFor, openSeasonFor, openColorFor]);

  // ── Season persistence ─────────────────────────────────────────────────────

  const saveSeasons = async (next: SeasonDef[]) => {
    setSavingSeason(true);
    try {
      const sb = createClient();
      const existing = (currentProject?.content_metadata ?? {}) as Record<string, unknown>;
      await sb
        .from('projects')
        .update({ content_metadata: { ...existing, series_seasons: next } })
        .eq('id', params.id);
    } finally {
      setSavingSeason(false);
    }
  };

  // ── Episode metadata helpers ───────────────────────────────────────────────

  const patchMeta = async (scriptId: string, patch: Partial<EpisodeMeta>) => {
    const sb = createClient();
    const current = scripts.find(s => s.id === scriptId);
    const next = { ...(current?.metadata ?? {}), ...patch };
    await sb.from('scripts').update({ metadata: next }).eq('id', scriptId);
    setScripts(prev => prev.map(s => s.id === scriptId ? { ...s, metadata: next } : s));
  };

  // ── Create episode ─────────────────────────────────────────────────────────

  const createEpisode = async () => {
    if (!newTitle.trim() || !user) return;
    setCreating(true);
    try {
      const sb = createClient();
      const seasonEpisodes = scripts.filter(s => (epMeta(s).episode_season ?? 1) === newSeason);
      const epNum   = seasonEpisodes.length + 1;
      const epCode  = episodeCode(epNum, newSeason);
      const title   = `${epCode} — ${newTitle.trim()}`;
      const sortOrd = scripts.length;

      const { data, error } = await sb
        .from('scripts')
        .insert({
          project_id: params.id,
          title,
          created_by: user.id,
          title_page_data: {
            title,
            author: (user as any).full_name ?? (user as any).email ?? '',
            notes: newSynop.trim() || null,
          },
          metadata: { sort_order: sortOrd, episode_season: newSeason },
        })
        .select()
        .single();

      if (error) { toast.error('Failed to create episode'); return; }
      setScripts(prev => [...prev, data as Script]);
      setNewTitle('');
      setNewSynop('');
      setShowNew(false);
      toast.success(`${epCode} created`);
    } finally {
      setCreating(false);
    }
  };

  // ── Save episode edit ──────────────────────────────────────────────────────

  const saveEdit = async () => {
    if (!showEdit) return;
    const sb = createClient();
    await sb
      .from('scripts')
      .update({
        title: showEdit.title,
        title_page_data: { ...showEdit.title_page_data, title: showEdit.title },
      })
      .eq('id', showEdit.id);
    setScripts(prev => prev.map(s => s.id === showEdit!.id ? showEdit! : s));
    setShowEdit(null);
    toast.success('Episode updated');
  };

  // ── Delete episode ─────────────────────────────────────────────────────────

  const deleteEpisode = async (script: Script) => {
    const ok = await confirm({
      title: `Delete "${script.title}"?`,
      message: 'This will permanently delete the episode and all its script content.',
      confirmLabel: 'Delete Episode',
      variant: 'danger',
    });
    if (!ok) return;
    const sb = createClient();
    await sb.from('scripts').delete().eq('id', script.id);
    setScripts(prev => prev.filter(s => s.id !== script.id));
    toast.success('Episode deleted');
  };

  // ── Status / season / color updates ───────────────────────────────────────

  const setStatus = async (script: Script, color: string) => {
    const sb = createClient();
    await sb.from('scripts').update({ revision_color: color }).eq('id', script.id);
    setScripts(prev => prev.map(s =>
      s.id === script.id ? { ...s, revision_color: color as Script['revision_color'] } : s
    ));
    setOpenStatusFor(null);
  };

  const setEpisodeSeason = async (scriptId: string, seasonNum: number) => {
    await patchMeta(scriptId, { episode_season: seasonNum });
    setOpenSeasonFor(null);
  };

  const setEpisodeColor = async (scriptId: string, color: string) => {
    await patchMeta(scriptId, { episode_color: color });
    setOpenColorFor(null);
  };

  // ── Reorder (move up / down) ───────────────────────────────────────────────

  const moveEpisode = async (scriptId: string, direction: 'up' | 'down') => {
    const idx = scripts.findIndex(s => s.id === scriptId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= scripts.length) return;

    const next = [...scripts];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];

    // Re-assign sort_order values
    const sb = createClient();
    await Promise.all(
      next.map((s, i) =>
        sb.from('scripts')
          .update({ metadata: { ...(s.metadata ?? {}), sort_order: i } })
          .eq('id', s.id)
      )
    );
    setScripts(next.map((s, i) => ({ ...s, metadata: { ...(s.metadata ?? {}), sort_order: i } })));
  };

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  const onDragStart = (e: React.DragEvent, scriptId: string) => {
    setDragging(scriptId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent, scriptId: string) => {
    e.preventDefault();
    if (scriptId !== dragging) setDragOver(scriptId);
  };

  const onDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragging || dragging === targetId) { setDragging(null); setDragOver(null); return; }
    const fromIdx = scripts.findIndex(s => s.id === dragging);
    const toIdx   = scripts.findIndex(s => s.id === targetId);
    if (fromIdx < 0 || toIdx < 0) { setDragging(null); setDragOver(null); return; }

    const next = [...scripts];
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);

    const sb = createClient();
    await Promise.all(
      next.map((s, i) =>
        sb.from('scripts')
          .update({ metadata: { ...(s.metadata ?? {}), sort_order: i } })
          .eq('id', s.id)
      )
    );
    setScripts(next.map((s, i) => ({ ...s, metadata: { ...(s.metadata ?? {}), sort_order: i } })));
    setDragging(null);
    setDragOver(null);
  };

  const onDragEnd = () => { setDragging(null); setDragOver(null); };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const planned = currentProject?.episode_count ?? null;
  const total   = scripts.length;
  const locked  = scripts.filter(s => s.locked || s.revision_color === 'goldenrod').length;
  const ready   = scripts.filter(s => s.revision_color === 'green').length;

  // Group episodes by season for rendering
  const bySeasonMap = new Map<number, Script[]>();
  for (const s of scripts) {
    const snum = epMeta(s).episode_season ?? 1;
    if (!bySeasonMap.has(snum)) bySeasonMap.set(snum, []);
    bySeasonMap.get(snum)!.push(s);
  }
  // Season numbers that exist
  const usedSeasonNums = Array.from(bySeasonMap.keys()).sort((a, b) => a - b);
  const allSeasonNums  = Array.from(new Set([...seasons.map(s => s.num), ...usedSeasonNums])).sort((a, b) => a - b);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <ConfirmDialog />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-black text-white">{currentProject?.title}</h1>
            <div className="flex items-center gap-1.5">
              {seasons.map(s => (
                <span
                  key={s.num}
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white"
                  style={{ backgroundColor: s.color + '33', color: s.color }}
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
          <p className="text-sm text-surface-400">
            {total} episode{total !== 1 ? 's' : ''}
            {planned ? ` of ${planned} planned` : ''}
            {' · '}{locked} locked · {ready} ready
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" onClick={() => setShowSeasonMgr(true)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h8m-8 4h16m-8 4h8" />
              </svg>
              Seasons
            </Button>
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

      {/* ── Progress bar ── */}
      {planned && (
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-surface-400">Series Progress</span>
            <span className="text-xs font-semibold text-white">{total} / {planned} episodes</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FF5F1F] to-[#FF8F5F] transition-all"
              style={{ width: `${Math.min(Math.round((total / planned) * 100), 100)}%` }}
            />
          </div>
          <div className="mt-2 flex gap-0.5">
            {scripts.map(s => {
              const meta = epMeta(s);
              return (
                <div
                  key={s.id}
                  title={s.title}
                  className={cn('h-1.5 flex-1 rounded-sm', !meta.episode_color && statusFor(s.revision_color).dot, !meta.episode_color && 'opacity-70')}
                  style={meta.episode_color ? { backgroundColor: meta.episode_color, opacity: 0.8 } : undefined}
                />
              );
            })}
            {planned && Array.from({ length: Math.max(0, planned - total) }).map((_, i) => (
              <div key={`empty-${i}`} className="h-1.5 flex-1 rounded-sm bg-surface-700/30" />
            ))}
          </div>
        </div>
      )}

      {/* ── Episodes ── */}
      {total === 0 ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          }
          title="No episodes yet"
          description="Create your first episode to start writing."
          action={canEdit ? (
            <Button onClick={() => setShowNew(true)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Episode 1
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-6">
          {allSeasonNums.map(snum => {
            const seasonDef = seasons.find(s => s.num === snum);
            const seasonName = seasonDef?.name ?? `Season ${snum}`;
            const seasonColor = seasonDef?.color ?? SEASON_PALETTE[(snum - 1) % SEASON_PALETTE.length];
            const seasonEps = (bySeasonMap.get(snum) ?? []);
            if (seasonEps.length === 0 && !seasons.find(s => s.num === snum)) return null;

            return (
              <div key={snum}>
                {/* Season header */}
                <div className="flex items-center gap-2.5 mb-2 px-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seasonColor }} />
                  <h2 className="text-sm font-bold text-white">{seasonName}</h2>
                  <span className="text-[11px] text-surface-600 font-mono">{seasonEps.length} ep{seasonEps.length !== 1 ? 's' : ''}</span>
                  <div className="flex-1 h-px bg-surface-800" />
                </div>

                {seasonEps.length === 0 ? (
                  <p className="text-xs text-surface-600 italic px-5 mb-2">No episodes assigned to this season yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {seasonEps.map((script, index) => {
                      const meta   = epMeta(script);
                      const status = statusFor(script.revision_color);
                      const epColor = meta.episode_color;
                      const isDraggingThis = dragging === script.id;
                      const isDragTarget   = dragOver === script.id;
                      const globalIdx = scripts.findIndex(s => s.id === script.id);

                      return (
                        <div
                          key={script.id}
                          draggable={canEdit}
                          onDragStart={e => onDragStart(e, script.id)}
                          onDragOver={e => onDragOver(e, script.id)}
                          onDrop={e => onDrop(e, script.id)}
                          onDragEnd={onDragEnd}
                          className={cn(
                            'flex items-center gap-2 p-2.5 rounded-xl border transition-all',
                            isDraggingThis
                              ? 'opacity-40 border-surface-600 bg-surface-900'
                              : isDragTarget
                                ? 'border-[#FF5F1F]/50 bg-[#FF5F1F]/5'
                                : 'border-surface-800 bg-surface-900/40 hover:border-surface-700 hover:bg-surface-900/70',
                          )}
                        >
                          {/* Drag handle */}
                          {canEdit && (
                            <div className="shrink-0 cursor-grab text-surface-700 hover:text-surface-500 transition-colors px-0.5">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                                <circle cx="5" cy="4"  r="1.2"/><circle cx="5" cy="8"  r="1.2"/><circle cx="5" cy="12" r="1.2"/>
                                <circle cx="11" cy="4" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
                              </svg>
                            </div>
                          )}

                          {/* Color strip */}
                          <div
                            className={cn('w-0.5 self-stretch rounded-full shrink-0', !epColor && status.dot)}
                            style={epColor ? { backgroundColor: epColor } : undefined}
                          />

                          {/* Episode code */}
                          <span className="text-[10px] font-mono font-semibold text-surface-500 w-14 shrink-0">
                            S{String(snum).padStart(2,'0')}E{String(index + 1).padStart(2,'0')}
                          </span>

                          {/* Title + synopsis */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-white truncate">{stripEpCode(script.title)}</h3>
                            {script.title_page_data?.notes && (
                              <p className="text-[11px] text-surface-500 truncate">{script.title_page_data.notes}</p>
                            )}
                          </div>

                          {/* Last edited */}
                          <span className="text-[10px] text-surface-600 shrink-0 hidden md:block">
                            {timeAgo(script.updated_at)}
                          </span>

                          {/* ── Controls ── */}
                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0">

                              {/* Season selector */}
                              <div className="relative" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => setOpenSeasonFor(openSeasonFor === script.id ? null : script.id)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors hover:bg-surface-800 text-surface-400 hover:text-white"
                                  title="Assign season"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: seasonColor }} />
                                  S{snum}
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {openSeasonFor === script.id && (
                                  <div className="absolute right-0 top-full mt-1 z-[200] min-w-[140px] rounded-xl border border-surface-700 bg-surface-900 shadow-2xl py-1 overflow-hidden">
                                    {seasons.map(s => (
                                      <button
                                        key={s.num}
                                        onClick={() => setEpisodeSeason(script.id, s.num)}
                                        className={cn(
                                          'flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors hover:bg-surface-800',
                                          meta.episode_season === s.num ? 'text-white font-semibold' : 'text-surface-400',
                                        )}
                                      >
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                        {s.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Color picker */}
                              <div className="relative" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => setOpenColorFor(openColorFor === script.id ? null : script.id)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors hover:bg-surface-800"
                                  title="Episode color"
                                >
                                  <span
                                    className={cn('w-3 h-3 rounded-full', !epColor && 'bg-surface-600')}
                                    style={epColor ? { backgroundColor: epColor } : undefined}
                                  />
                                </button>
                                {openColorFor === script.id && (
                                  <div className="absolute right-0 top-full mt-1 z-[200] rounded-xl border border-surface-700 bg-surface-900 shadow-2xl p-2">
                                    <div className="grid grid-cols-3 gap-1">
                                      {EPISODE_COLORS.map(c => (
                                        <button
                                          key={c.value}
                                          onClick={() => setEpisodeColor(script.id, c.value)}
                                          title={c.label}
                                          className={cn(
                                            'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                                            epColor === c.value ? 'border-white' : 'border-transparent',
                                            !c.value && 'bg-surface-700 flex items-center justify-center',
                                          )}
                                          style={c.value ? { backgroundColor: c.value } : undefined}
                                        >
                                          {!c.value && (
                                            <svg className="w-3 h-3 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Status picker */}
                              <div className="relative" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => setOpenStatusFor(openStatusFor === script.id ? null : script.id)}
                                  className={cn(
                                    'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors',
                                    status.pill,
                                  )}
                                >
                                  {status.label}
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {openStatusFor === script.id && (
                                  <div className="absolute right-0 top-full mt-1 z-[200] w-36 rounded-xl border border-surface-700 bg-surface-900 shadow-2xl py-1 overflow-hidden">
                                    {EPISODE_STATUSES.map(s => (
                                      <button
                                        key={s.value}
                                        onClick={() => setStatus(script, s.value)}
                                        className={cn(
                                          'flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors hover:bg-surface-800',
                                          script.revision_color === s.value ? 'text-white font-semibold' : 'text-surface-400',
                                        )}
                                      >
                                        <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
                                        {s.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Up/Down */}
                              <div className="flex flex-col gap-0.5">
                                <button
                                  onClick={() => moveEpisode(script.id, 'up')}
                                  disabled={globalIdx === 0}
                                  className="w-5 h-4 flex items-center justify-center rounded text-surface-600 hover:text-white hover:bg-surface-800 disabled:opacity-20 transition-colors"
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => moveEpisode(script.id, 'down')}
                                  disabled={globalIdx === scripts.length - 1}
                                  className="w-5 h-4 flex items-center justify-center rounded text-surface-600 hover:text-white hover:bg-surface-800 disabled:opacity-20 transition-colors"
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7 7" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Write button */}
                          <Link href={`/projects/${params.id}/script?script_id=${script.id}`} onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="ghost">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              Write
                            </Button>
                          </Link>
                          {canEdit && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setShowEdit(script)}>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                </svg>
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => deleteEpisode(script)}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Episode Modal ── */}
      <Modal
        isOpen={showNew}
        onClose={() => { setShowNew(false); setNewTitle(''); setNewSynop(''); }}
        title="New Episode"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Episode Title"
            placeholder="e.g. Pilot, The Beginning…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            autoFocus
          />
          <Textarea
            label="Synopsis (optional)"
            placeholder="What happens in this episode?"
            value={newSynop}
            onChange={e => setNewSynop(e.target.value)}
            rows={3}
          />
          {seasons.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Season</label>
              <div className="flex flex-wrap gap-2">
                {seasons.map(s => (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => setNewSeason(s.num)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                      newSeason === s.num
                        ? 'text-white border-transparent'
                        : 'text-surface-400 border-surface-700 hover:border-surface-500',
                    )}
                    style={newSeason === s.num ? { backgroundColor: s.color, borderColor: s.color } : undefined}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setShowNew(false); setNewTitle(''); setNewSynop(''); }}>Cancel</Button>
            <Button onClick={createEpisode} loading={creating} disabled={!newTitle.trim()}>Create Episode</Button>
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
              onChange={e => setShowEdit({ ...showEdit, title_page_data: { ...showEdit.title_page_data, notes: e.target.value } })}
              rows={3}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Season Manager Modal ── */}
      <SeasonManager
        isOpen={showSeasonMgr}
        onClose={() => setShowSeasonMgr(false)}
        seasons={seasons}
        onSave={async (next) => {
          setSeasons(next);
          await saveSeasons(next);
          toast.success('Seasons saved');
        }}
        saving={savingSeason}
      />
    </div>
  );
}

// ── Season Manager Modal ───────────────────────────────────────────────────────

function SeasonManager({
  isOpen, onClose, seasons, onSave, saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  seasons: SeasonDef[];
  onSave: (next: SeasonDef[]) => Promise<void>;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<SeasonDef[]>([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (isOpen) setDraft(seasons.map(s => ({ ...s })));
  }, [isOpen, seasons]);

  const addSeason = () => {
    const num = draft.length > 0 ? Math.max(...draft.map(s => s.num)) + 1 : 1;
    setDraft(prev => [
      ...prev,
      { num, name: newName.trim() || `Season ${num}`, color: SEASON_PALETTE[(num - 1) % SEASON_PALETTE.length] },
    ]);
    setNewName('');
  };

  const removeSeason = (num: number) => setDraft(prev => prev.filter(s => s.num !== num));

  const updateName  = (num: number, name: string)  => setDraft(prev => prev.map(s => s.num === num ? { ...s, name } : s));
  const updateColor = (num: number, color: string) => setDraft(prev => prev.map(s => s.num === num ? { ...s, color } : s));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Seasons" size="md">
      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
        {draft.map(s => (
          <div key={s.num} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-800/50 border border-surface-700">
            {/* Color swatch picker */}
            <div className="flex gap-1 shrink-0">
              {SEASON_PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => updateColor(s.num, c)}
                  className={cn(
                    'w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 shrink-0',
                    s.color === c ? 'border-white scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            {/* Name input */}
            <input
              className="flex-1 min-w-0 bg-transparent border-b border-surface-600 text-sm text-white placeholder:text-surface-600 outline-none focus:border-[#FF5F1F]/60 py-0.5 transition-colors"
              value={s.name}
              onChange={e => updateName(s.num, e.target.value)}
              placeholder={`Season ${s.num}`}
            />
            <span className="text-[10px] text-surface-600 font-mono shrink-0">S{s.num}</span>
            <button
              onClick={() => removeSeason(s.num)}
              className="shrink-0 text-surface-600 hover:text-red-400 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {/* Add season */}
        <div className="flex items-center gap-2 pt-1">
          <input
            className="flex-1 min-w-0 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white placeholder:text-surface-600 px-2.5 py-1.5 outline-none focus:border-[#FF5F1F]/40 transition-colors"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSeason(); } }}
            placeholder="New season name…"
          />
          <Button type="button" variant="secondary" onClick={addSeason}>Add</Button>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-5 mt-1 border-t border-surface-800">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(draft)} loading={saving} disabled={draft.length === 0}>
          Save Seasons
        </Button>
      </div>
    </Modal>
  );
}
