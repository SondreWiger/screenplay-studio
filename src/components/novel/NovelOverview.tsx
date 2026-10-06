'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { fetchChapters, localDay, useNovelSettings } from '@/hooks/useNovel';
import { currentStreak, wordsByDay, addDays } from '@/lib/novel/goals';
import { numberBinder } from '@/lib/novel/compile';
import { NOVEL_FORMAT_OPTIONS, NOVEL_STATUS_CONFIG, type NovelChapter, type NovelChapterStatus, type Project } from '@/lib/types';

/** Project home for novels: progress, structure and where to pick up. */
export function NovelOverview({ project }: { project: Project }) {
  const { settings } = useNovelSettings(project.id);
  const [chapters, setChapters] = useState<NovelChapter[] | null>(null);
  const [log, setLog] = useState<{ day: string; words: number }[]>([]);
  const [counts, setCounts] = useState({ characters: 0, places: 0, events: 0 });

  useEffect(() => {
    const supabase = createClient();
    const head = { count: 'exact' as const, head: true };
    Promise.all([
      fetchChapters(project.id),
      supabase.from('novel_writing_log').select('day, words').eq('project_id', project.id).gte('day', addDays(localDay(), -60)),
      supabase.from('characters').select('id', head).eq('project_id', project.id),
      supabase.from('locations').select('id', head).eq('project_id', project.id),
      supabase.from('novel_timeline_events').select('id', head).eq('project_id', project.id),
    ]).then(([rows, l, ch, pl, ev]) => {
      setChapters(rows);
      setLog((l.data as { day: string; words: number }[]) || []);
      setCounts({ characters: ch.count || 0, places: pl.count || 0, events: ev.count || 0 });
    });
  }, [project.id]);

  const p = `/projects/${project.id}`;
  const list = chapters || [];
  const prose = list.filter((c) => c.kind !== 'part');
  const total = prose.reduce((n, c) => n + c.word_count, 0);
  const fmt = NOVEL_FORMAT_OPTIONS.find((f) => f.value === project.format);
  const target = settings.target_words || fmt?.words[0] || 0;
  const byDay = wordsByDay(log);
  const today = localDay();
  const streak = currentStreak(byDay, today);
  const week = Array.from({ length: 7 }, (_, i) => byDay.get(addDays(today, -i)) || 0).reduce((a, b) => a + b, 0);
  const labels = numberBinder(list, 'numerals');
  const lastEdited = [...prose].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const statusCounts = list.filter((c) => c.kind === 'chapter').reduce((m, c) => ({ ...m, [c.status]: (m[c.status] || 0) + 1 }), {} as Record<NovelChapterStatus, number>);
  const chapterCount = list.filter((c) => c.kind === 'chapter').length;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">{fmt?.label || 'Novel'}{project.genre?.length ? ` · ${project.genre.join(', ')}` : ''}</p>
          <h1 className="mt-1 text-3xl font-bold text-white truncate">{project.title}</h1>
          {project.logline && <p className="mt-2 max-w-2xl text-surface-300">{project.logline}</p>}
        </div>
        <Link href={`${p}/manuscript`} className="rounded-xl bg-teal-600 hover:bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow">
          {total > 0 ? 'Keep writing' : 'Start writing'}
        </Link>
      </div>

      <div className="rounded-2xl border border-surface-800 bg-gradient-to-br from-teal-500/10 to-transparent p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-4xl font-bold text-white tabular-nums">{total.toLocaleString()}</p>
            <p className="text-sm text-surface-400">words{target ? ` of ${target.toLocaleString()}` : ''}</p>
          </div>
          <div className="flex gap-8 text-sm">
            <Mini label="This week" value={week.toLocaleString()} />
            <Mini label="Streak" value={`${streak}d`} />
            <Mini label="Chapters" value={String(chapterCount)} />
            <Mini label="Pages" value={String(Math.max(0, Math.round(total / 250)))} hint="at 250 words a page" />
          </div>
        </div>
        {target > 0 && (
          <div className="mt-4 h-2.5 rounded-full bg-surface-800 overflow-hidden" role="progressbar" aria-valuenow={total} aria-valuemax={target} aria-label="Book progress">
            <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, (total / target) * 100)}%` }} />
          </div>
        )}
        {lastEdited && (
          <p className="mt-3 text-xs text-surface-400">
            Last worked on: <Link href={`${p}/manuscript`} className="text-teal-300 hover:underline">{[labels.get(lastEdited.id), lastEdited.title].filter(Boolean).join(': ') || 'Untitled'}</Link>
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-surface-800 bg-surface-900/50 p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Structure</h2>
            <div className="flex gap-3 text-[11px] text-surface-400">
              {(Object.keys(NOVEL_STATUS_CONFIG) as NovelChapterStatus[]).filter((s) => statusCounts[s]).map((s) => (
                <span key={s} className="flex items-center gap-1"><span className={cn('w-1.5 h-1.5 rounded-full', NOVEL_STATUS_CONFIG[s].dot)} />{statusCounts[s]} {NOVEL_STATUS_CONFIG[s].label.toLowerCase()}</span>
              ))}
            </div>
          </div>
          {chapters === null ? (
            <p className="text-sm text-surface-500">Loading…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-surface-400">No chapters yet. <Link href={`${p}/manuscript`} className="text-teal-300 hover:underline">Write Chapter One</Link>, or plan first in <Link href={`${p}/beat-sheet`} className="text-teal-300 hover:underline">Plot Structure</Link>.</p>
          ) : (
            <ol className="space-y-1 max-h-96 overflow-y-auto">
              {list.map((c) => (
                <li key={c.id} className={cn('flex items-center gap-3 text-sm', c.kind === 'part' && 'pt-2 text-[11px] font-semibold uppercase tracking-wider text-surface-400')}>
                  {c.kind !== 'part' && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', NOVEL_STATUS_CONFIG[c.status].dot)} />}
                  <span className={cn('flex-1 truncate', c.kind !== 'part' && 'text-surface-200', (c.kind === 'front_matter' || c.kind === 'back_matter') && 'italic text-surface-400')}>
                    {[labels.get(c.id), c.title].filter(Boolean).join(': ') || 'Untitled'}
                    {c.synopsis && <span className="ml-2 text-xs text-surface-500">{c.synopsis}</span>}
                  </span>
                  {c.kind !== 'part' && <span className="text-xs tabular-nums text-surface-500">{c.word_count.toLocaleString()}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="space-y-3">
          <Tile href={`${p}/characters`} label="Characters" value={counts.characters} />
          <Tile href={`${p}/locations`} label="Places" value={counts.places} />
          <Tile href={`${p}/timeline`} label="Timeline events" value={counts.events} />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <QuickLink href={`${p}/writing-goals`}>Goals &amp; sprints</QuickLink>
            <QuickLink href={`${p}/prose-analysis`}>Prose analysis</QuickLink>
            <QuickLink href={`${p}/book-export`}>Export book</QuickLink>
            <QuickLink href={`${p}/query-kit`}>Query kit</QuickLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint}>
      <p className="text-[11px] uppercase tracking-wider text-surface-500">{label}</p>
      <p className="text-lg font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}

function Tile({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl border border-surface-800 bg-surface-900/50 px-4 py-3 hover:border-surface-700">
      <span className="text-sm text-surface-300">{label}</span>
      <span className="text-lg font-semibold text-white tabular-nums">{value}</span>
    </Link>
  );
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-lg border border-surface-800 px-3 py-2 text-center text-xs text-surface-300 hover:text-white hover:border-surface-700">
      {children}
    </Link>
  );
}
