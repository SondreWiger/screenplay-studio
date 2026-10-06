'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, LoadingPage, toast, ToastContainer } from '@/components/ui';
import { cn } from '@/lib/utils';
import { fetchChapters, localDay, useNovelSettings } from '@/hooks/useNovel';
import { addDays, bestStreak, currentStreak, dayToDate, daysBetween, pace, wordsByDay } from '@/lib/novel/goals';
import { NOVEL_FORMAT_OPTIONS, NOVEL_STATUS_CONFIG, type NovelChapter, type NovelChapterStatus, type NovelWritingLogEntry } from '@/lib/types';

const WEEKS = 26;

export default function WritingGoalsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';

  const { settings, save, loading: settingsLoading } = useNovelSettings(projectId);
  const [chapters, setChapters] = useState<NovelChapter[]>([]);
  const [log, setLog] = useState<NovelWritingLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'me' | 'team'>('me');

  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [daily, setDaily] = useState('');

  useEffect(() => {
    (async () => {
      const since = addDays(localDay(), -WEEKS * 7);
      const [rows, logRes] = await Promise.all([
        fetchChapters(projectId),
        createClient().from('novel_writing_log').select('*').eq('project_id', projectId).gte('day', since).order('day'),
      ]);
      setChapters(rows);
      setLog((logRes.data as NovelWritingLogEntry[]) || []);
      setLoading(false);
    })();
  }, [projectId]);

  const initialised = useRef(false);
  useEffect(() => {
    if (settingsLoading || initialised.current) return;
    initialised.current = true;
    const fmt = NOVEL_FORMAT_OPTIONS.find((f) => f.value === currentProject?.format);
    setTarget(String(settings.target_words ?? (fmt ? fmt.words[0] : 80000)));
    setDeadline(settings.deadline ?? '');
    setDaily(settings.daily_goal ? String(settings.daily_goal) : '');
  }, [settingsLoading, settings, currentProject?.format]);

  const today = localDay();
  const rows = scope === 'me' ? log.filter((r) => r.user_id === user?.id) : log;
  const byDay = useMemo(() => wordsByDay(rows), [rows]);
  const total = chapters.filter((c) => c.kind !== 'part').reduce((n, c) => n + c.word_count, 0);
  const targetNum = settings.target_words || parseInt(target, 10) || 0;
  const p = pace({ total, target: targetNum, deadline: settings.deadline, today, byDay });
  const streak = currentStreak(byDay, today);
  const best = bestStreak(byDay);
  const sprints = rows.reduce((n, r) => n + r.sprints, 0);
  const todayWords = byDay.get(today) || 0;
  const dailyGoal = settings.daily_goal || 0;
  const bestDay = Array.from(byDay.entries()).sort((a, b) => b[1] - a[1])[0];
  const writtenInWindow = Array.from(byDay.values()).reduce((a, b) => a + b, 0);

  const saveGoals = async () => {
    const t = parseInt(target, 10);
    const d = parseInt(daily, 10);
    const { error } = await save({
      target_words: Number.isFinite(t) && t > 0 ? t : null,
      deadline: deadline || null,
      daily_goal: Number.isFinite(d) && d > 0 ? d : null,
    });
    if (error) toast('Could not save goals', 'error');
    else toast('Goals saved', 'success');
  };

  const suggestDaily = () => {
    const t = parseInt(target, 10) || 0;
    if (!deadline) { toast('Set a deadline first', 'info'); return; }
    const left = Math.max(1, daysBetween(today, deadline) + 1);
    setDaily(String(Math.ceil(Math.max(0, t - total) / left)));
  };

  if (loading || settingsLoading) return <LoadingPage />;

  // Heatmap grid: columns are weeks (Monday first), newest on the right.
  const end = today;
  const dow = (new Date().getDay() + 6) % 7; // 0 = Monday
  const gridStart = addDays(end, -(WEEKS - 1) * 7 - dow);
  const max = Math.max(1, ...Array.from(byDay.values()));
  const cells: { day: string; words: number }[] = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const day = addDays(gridStart, i);
    if (day > end) break;
    cells.push({ day, words: byDay.get(day) || 0 });
  }
  const level = (w: number) => (w === 0 ? 0 : w < max * 0.25 ? 1 : w < max * 0.5 ? 2 : w < max * 0.75 ? 3 : 4);
  const LEVEL_BG = ['bg-surface-800', 'bg-teal-900', 'bg-teal-700', 'bg-teal-500', 'bg-teal-300'];

  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const barMax = Math.max(dailyGoal, ...last30.map((d) => byDay.get(d) || 0), 1);

  const statusCounts = chapters.filter((c) => c.kind === 'chapter').reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<NovelChapterStatus, number>);
  const chapterCount = chapters.filter((c) => c.kind === 'chapter').length;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <ToastContainer />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Goals &amp; Sprints</h1>
          <p className="text-sm text-surface-400 mt-0.5">Word targets, deadlines and streaks for {currentProject?.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-surface-700 p-0.5" role="group" aria-label="Whose writing">
            {(['me', 'team'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setScope(s)} aria-pressed={scope === s}
                className={cn('px-3 py-1 text-xs font-medium rounded-md', scope === s ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white')}>
                {s === 'me' ? 'Mine' : 'Whole team'}
              </button>
            ))}
          </div>
          <Link href={`/projects/${projectId}/manuscript`} className="rounded-lg bg-teal-600 hover:bg-teal-500 px-3 py-1.5 text-sm font-semibold text-white">
            Start a sprint
          </Link>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Manuscript" value={total.toLocaleString()} sub={targetNum ? `${Math.round((total / targetNum) * 100)}% of ${targetNum.toLocaleString()}` : 'words'} />
        <Stat label="Today" value={todayWords.toLocaleString()} sub={dailyGoal ? (todayWords >= dailyGoal ? 'Daily goal met' : `${(dailyGoal - todayWords).toLocaleString()} to go`) : 'words written'} accent={dailyGoal > 0 && todayWords >= dailyGoal} />
        <Stat label="Streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} sub={`Best: ${best} · ${sprints} ${sprints === 1 ? 'sprint' : 'sprints'}`} />
        <Stat
          label={settings.deadline ? 'Needed per day' : 'Projected finish'}
          value={settings.deadline
            ? p.neededPerDay !== null ? p.neededPerDay.toLocaleString() : 'Deadline passed'
            : p.projectedFinish ? dayToDate(p.projectedFinish).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          sub={settings.deadline
            ? `${p.daysLeft !== null && p.daysLeft > 0 ? `${p.daysLeft} days left` : 'Set a new deadline'} · pace ${Math.round(p.recentPerDay).toLocaleString()}/day`
            : p.projectedFinish ? `At ${Math.round(p.recentPerDay).toLocaleString()} words/day (last 14 days)` : 'Write on three days to see a projection'}
        />
      </div>

      {targetNum > 0 && (
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-surface-300">{p.remaining.toLocaleString()} words to go</span>
            <span className="text-surface-500 tabular-nums">{total.toLocaleString()} / {targetNum.toLocaleString()}</span>
          </div>
          <div className="h-3 rounded-full bg-surface-800 overflow-hidden" role="progressbar" aria-valuenow={total} aria-valuemax={targetNum} aria-label="Book progress">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400" style={{ width: `${Math.min(100, (total / targetNum) * 100)}%` }} />
          </div>
          {settings.deadline && p.projectedFinish && (
            <p className={cn('mt-2 text-xs', p.projectedFinish <= settings.deadline ? 'text-teal-300' : 'text-amber-300')}>
              {p.projectedFinish <= settings.deadline
                ? `On track: at your recent pace you finish by ${dayToDate(p.projectedFinish).toLocaleDateString()}.`
                : `Behind: at your recent pace you finish ${dayToDate(p.projectedFinish).toLocaleDateString()}, after the deadline.`}
            </p>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Goals form */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Goals</h2>
          <label className="block">
            <span className="block text-xs text-surface-400 mb-1">Book length target (words)</span>
            <input type="number" min={0} step={1000} value={target} onChange={(e) => setTarget(e.target.value)} disabled={!canEdit}
              className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" />
            <span className="mt-1 flex flex-wrap gap-1">
              {NOVEL_FORMAT_OPTIONS.slice(0, 5).map((f) => (
                <button key={f.value} type="button" disabled={!canEdit} onClick={() => setTarget(String(f.words[0]))}
                  className="rounded px-1.5 py-0.5 text-[10px] text-surface-400 bg-surface-800 hover:text-white">
                  {f.label} {Math.round(f.words[0] / 1000)}k
                </button>
              ))}
            </span>
          </label>
          <label className="block">
            <span className="block text-xs text-surface-400 mb-1">Deadline</span>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={!canEdit}
              className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" />
          </label>
          <label className="block">
            <span className="flex justify-between text-xs text-surface-400 mb-1">
              Daily goal (words)
              {canEdit && <button type="button" onClick={suggestDaily} className="text-teal-300 hover:underline">Work it out from the deadline</button>}
            </span>
            <input type="number" min={0} step={50} value={daily} onChange={(e) => setDaily(e.target.value)} disabled={!canEdit} placeholder="e.g. 1000"
              className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" />
          </label>
          {canEdit && <Button className="w-full" onClick={saveGoals}>Save goals</Button>}
        </div>

        {/* Last 30 days */}
        <div className="lg:col-span-2 rounded-xl border border-surface-800 bg-surface-900/50 p-5">
          <div className="flex justify-between items-baseline mb-4">
            <h2 className="text-sm font-semibold text-white">Last 30 days</h2>
            <span className="text-xs text-surface-500">{bestDay ? `Best day: ${bestDay[1].toLocaleString()} words` : 'No writing logged yet'}</span>
          </div>
          <div className="relative h-40 flex items-end gap-[3px]" role="img" aria-label="Words written per day over the last 30 days">
            {dailyGoal > 0 && (
              <div className="absolute inset-x-0 border-t border-dashed border-teal-400/50" style={{ bottom: `${(dailyGoal / barMax) * 100}%` }}>
                <span className="absolute right-0 -top-4 text-[10px] text-teal-300">goal</span>
              </div>
            )}
            {last30.map((d) => {
              const w = byDay.get(d) || 0;
              return (
                <div key={d} className="flex-1 h-full flex items-end group relative">
                  <div className={cn('w-full rounded-t-sm', w >= dailyGoal && dailyGoal > 0 ? 'bg-teal-400' : 'bg-teal-700', d === today && 'ring-1 ring-white/50')}
                    style={{ height: `${(w / barMax) * 100}%`, minHeight: w ? 2 : 0 }} />
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded bg-surface-800 px-1.5 py-0.5 text-[10px] text-white z-10">
                    {dayToDate(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: {w.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-surface-500">
            <span>{dayToDate(last30[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
        <div className="flex justify-between items-baseline mb-4">
          <h2 className="text-sm font-semibold text-white">Writing calendar</h2>
          <span className="text-xs text-surface-500">{writtenInWindow.toLocaleString()} words in the last {WEEKS} weeks</span>
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-rows-7 grid-flow-col gap-[3px] w-max" role="img" aria-label="Writing activity calendar">
            {cells.map((c) => (
              <div key={c.day} title={`${c.day}: ${c.words.toLocaleString()} words`} className={cn('w-3 h-3 rounded-sm', LEVEL_BG[level(c.words)], c.day === today && 'ring-1 ring-white/60')} />
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-surface-500">
          Less {LEVEL_BG.map((bg) => <span key={bg} className={cn('w-3 h-3 rounded-sm', bg)} />)} More
        </div>
      </div>

      {/* Chapters */}
      <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
        <div className="flex flex-wrap justify-between items-baseline gap-2 mb-4">
          <h2 className="text-sm font-semibold text-white">Chapters</h2>
          <div className="flex flex-wrap gap-3 text-xs text-surface-400">
            {(Object.keys(NOVEL_STATUS_CONFIG) as NovelChapterStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', NOVEL_STATUS_CONFIG[s].dot)} />
                {NOVEL_STATUS_CONFIG[s].label} {statusCounts[s] || 0}
              </span>
            ))}
          </div>
        </div>
        {chapterCount === 0 ? (
          <p className="text-sm text-surface-500">No chapters yet. <Link className="text-teal-300 hover:underline" href={`/projects/${projectId}/manuscript`}>Start writing</Link>.</p>
        ) : (
          <ul className="space-y-2">
            {chapters.filter((c) => c.kind !== 'part').map((c, i) => {
              const goal = c.target_words || (targetNum && chapterCount ? Math.round(targetNum / chapterCount) : 0);
              return (
                <li key={c.id} className="flex items-center gap-3">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', NOVEL_STATUS_CONFIG[c.status].dot)} />
                  <span className="w-48 truncate text-sm text-surface-200">{c.title || (c.kind === 'chapter' ? `Chapter ${chapters.filter((x) => x.kind === 'chapter').indexOf(c) + 1}` : `Section ${i + 1}`)}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-800 overflow-hidden">
                    {goal > 0 && <div className="h-full bg-teal-600" style={{ width: `${Math.min(100, (c.word_count / goal) * 100)}%` }} />}
                  </div>
                  <span className="w-28 text-right text-xs tabular-nums text-surface-400">
                    {c.word_count.toLocaleString()}{goal ? ` / ${goal.toLocaleString()}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-surface-500">Chapters without their own target share the book target equally.</p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-4', accent ? 'border-teal-500/40 bg-teal-500/10' : 'border-surface-800 bg-surface-900/50')}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-surface-400">{sub}</p>
    </div>
  );
}
