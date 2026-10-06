'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Bell, FileUp, Lightbulb, MessagesSquare, PenLine, Plus, Sparkles, Wrench } from 'lucide-react';
import { Panel, StatGrid, dailySpark } from '@/components/kit';
import { SupervisorNote } from './SupervisorNote';
import { useNotificationStore } from '@/lib/stores';
import { cn, timeAgo } from '@/lib/utils';
import type { Project } from '@/lib/types';

/** Pipeline stages in production order, with the colour each one uses everywhere on the dashboard. */
export const PIPELINE = [
  { key: 'development', label: 'Development', color: '#a78bfa' },
  { key: 'pre_production', label: 'Pre-production', color: '#fbbf24' },
  { key: 'production', label: 'Production', color: '#34d399' },
  { key: 'post_production', label: 'Post-production', color: '#22d3ee' },
  { key: 'completed', label: 'Completed', color: '#60a5fa' },
] as const;

function greeting(hour: number) {
  if (hour < 5) return 'Writing late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const QUICK = [
  { label: 'Import a script', href: '/dashboard/import', icon: FileUp },
  { label: 'Idea boards', href: '/idea-boards', icon: Lightbulb },
  { label: 'Writer tools', href: '/tools', icon: Wrench },
  { label: 'Community', href: '/community', icon: MessagesSquare },
];

export function DashboardOverview({
  name, badges, projects, lastProject, filterStatus, onFilter, onNewProject, showCommunity,
}: {
  name: string | null;
  badges?: ReactNode;
  /** Every project the user can see, personal and company. */
  projects: Project[];
  lastProject?: Project;
  filterStatus: string;
  onFilter: (status: string) => void;
  onNewProject: () => void;
  showCommunity: boolean;
}) {
  const { notifications, unreadCount } = useNotificationStore();
  const now = new Date();
  const week = 7 * 864e5;
  const editedThisWeek = projects.filter((p) => now.getTime() - Date.parse(p.updated_at) < week).length;
  const createdThisMonth = projects.filter((p) => now.getTime() - Date.parse(p.created_at) < 30 * 864e5).length;
  const active = projects.filter((p) => p.status !== 'archived');
  const stageCounts = PIPELINE.map((s) => ({ ...s, count: active.filter((p) => p.status === s.key).length }));
  const staged = stageCounts.reduce((n, s) => n + s.count, 0);
  const toggle = (status: string) => onFilter(filterStatus === status ? 'all' : status);
  const quick = QUICK.filter((q) => showCommunity || q.href !== '/community');

  return (
    <div className="mb-8 space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Greeting + pick up where you left off */}
        <section className="relative overflow-hidden rounded-3xl border border-surface-800 bg-gradient-to-br from-surface-900 via-surface-900/80 to-brand-950/40 p-6 md:p-7 lg:col-span-2">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-400">
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="relative mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
            {greeting(now.getHours())}{name ? `, ${name}` : ''}
            {badges}
          </h1>
          <p className="relative mt-1 text-sm text-surface-400">
            {projects.length === 0
              ? 'Start your first project — a feature, a pilot, a podcast, anything.'
              : `${projects.length} project${projects.length === 1 ? '' : 's'}${editedThisWeek ? ` · ${editedThisWeek} touched this week` : ''}${unreadCount ? ` · ${unreadCount} unread` : ''}`}
          </p>

          {lastProject ? (
            <Link
              href={`/projects/${lastProject.id}/${lastProject.project_type === 'novel' ? 'manuscript' : 'script'}`}
              className="group relative mt-5 flex items-center gap-4 rounded-2xl border border-surface-700/60 bg-surface-950/50 p-3 pr-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-xl hover:shadow-brand-600/10"
            >
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-500/30 to-surface-800 text-lg font-bold text-white">
                {(lastProject.title || '?')[0].toUpperCase()}
                {lastProject.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lastProject.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-surface-500">Continue writing</p>
                <p className="truncate text-base font-semibold text-white">{lastProject.title}</p>
                <p className="truncate text-xs text-surface-500">
                  {PIPELINE.find((s) => s.key === lastProject.status)?.label ?? 'Project'} · edited {timeAgo(lastProject.updated_at)}
                </p>
              </div>
              <span className="hidden items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-600/20 transition-colors group-hover:bg-brand-500 sm:inline-flex">
                <PenLine className="h-3.5 w-3.5" /> Open script
              </span>
              <ArrowRight className="h-4 w-4 text-surface-500 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-400 sm:hidden" />
            </Link>
          ) : (
            <button
              onClick={onNewProject}
              className="relative mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-500"
            >
              <Plus className="h-4 w-4" /> Create your first project
            </button>
          )}

          <div className="relative mt-4 flex flex-wrap gap-2">
            {quick.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-800 bg-surface-900/60 px-2.5 py-1.5 text-xs font-medium text-surface-300 transition-colors hover:border-surface-700 hover:text-white"
              >
                <q.icon className="h-3.5 w-3.5 text-surface-500" /> {q.label}
              </Link>
            ))}
          </div>

          <SupervisorNote />
        </section>

        {/* Where every project sits in the pipeline */}
        <Panel
          title="Pipeline"
          subtitle={staged ? `${staged} active project${staged === 1 ? '' : 's'}` : 'No active projects yet'}
          action={filterStatus !== 'all' && (
            <button onClick={() => onFilter('all')} className="text-[11px] font-semibold text-brand-400 hover:text-brand-300">Clear filter</button>
          )}
          bodyClassName="space-y-4"
        >
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-800">
            {stageCounts.filter((s) => s.count > 0).map((s, i) => (
              <motion.div
                key={s.key}
                title={`${s.label}: ${s.count}`}
                style={{ background: s.color }}
                className="h-full first:rounded-l-full last:rounded-r-full"
                initial={{ width: 0 }}
                animate={{ width: `${(s.count / Math.max(1, staged)) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
              />
            ))}
          </div>
          <div className="space-y-0.5">
            {stageCounts.map((s) => (
              <button
                key={s.key}
                onClick={() => toggle(s.key)}
                disabled={s.count === 0 && filterStatus !== s.key}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-40',
                  filterStatus === s.key ? 'bg-surface-800/80 text-white' : 'text-surface-300 hover:bg-surface-800/40 hover:text-white',
                )}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="flex-1">{s.label}</span>
                <span className="font-mono tabular-nums text-surface-400">{s.count}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <StatGrid
        cols={4}
        items={[
          { label: 'Projects', value: projects.length, tone: 'brand', active: filterStatus === 'all', onClick: () => onFilter('all'), hint: 'Show all projects' },
          { label: 'Edited this week', value: editedThisWeek, tone: 'aqua', spark: dailySpark(projects, (p) => p.updated_at) },
          { label: 'Started this month', value: createdThisMonth, tone: 'violet', spark: dailySpark(projects, (p) => p.created_at, 30) },
          { label: 'Completed', value: projects.filter((p) => p.status === 'completed').length, tone: 'blue', active: filterStatus === 'completed', onClick: () => toggle('completed'), hint: 'Show completed projects' },
        ]}
      />

      {notifications.length > 0 && (
        <Panel
          title={<span className="flex items-center gap-2"><Bell className="h-4 w-4 text-brand-400" /> Latest activity</span>}
          action={<Link href="/notifications" className="text-[11px] font-semibold text-surface-400 hover:text-white">View all →</Link>}
          bodyClassName="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {notifications.slice(0, 3).map((n) => {
            const body = (
              <>
                <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.read ? 'bg-surface-700' : 'bg-brand-500')} />
                <span className="min-w-0">
                  <span className="line-clamp-1 text-xs font-medium text-surface-200">{n.title}</span>
                  {n.body && <span className="line-clamp-1 text-[11px] text-surface-500">{n.body}</span>}
                  <span className="text-[10px] text-surface-500">{timeAgo(n.created_at)}</span>
                </span>
              </>
            );
            const cls = 'flex gap-2.5 rounded-xl border border-surface-800 bg-surface-950/40 p-3 transition-colors hover:border-surface-700';
            return n.link
              ? <Link key={n.id} href={n.link} className={cls}>{body}</Link>
              : <div key={n.id} className={cls}>{body}</div>;
          })}
        </Panel>
      )}

      {projects.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-surface-500">
          <Sparkles className="h-3.5 w-3.5 text-brand-400" /> Tip: press <kbd className="rounded border border-surface-700 bg-surface-800 px-1 font-mono text-[10px]">⌘N</kbd> anywhere on the dashboard to start a project.
        </p>
      )}
    </div>
  );
}

export function stageOf(status: string) {
  return PIPELINE.find((s) => s.key === status) ?? { key: status, label: status === 'archived' ? 'Archived' : status.replace(/_/g, ' '), color: '#71717a' };
}

/** Status chip in the pipeline's colours, so cards and the pipeline panel read the same. */
export function StageBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const s = stageOf(status);
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full border font-semibold capitalize backdrop-blur', size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]')}
      style={{ color: s.color, borderColor: `${s.color}40`, background: `${s.color}1a` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}
