'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fetchAllResult } from '@/lib/supabase/fetch-all';
import { Button, Badge } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import type { ProjectWithCounts, ProjectStatsDetail } from '../types';
import { MindmapTab } from '../MindmapTab';
import { useAdminData } from '../data';
import { TabSkeleton } from '../motion';
import { fillEmails } from '@/lib/private-profile';
import { FolderKanban, Network } from 'lucide-react';
import { AdminPage, BarList, PageHeader, Panel, Reveal, StatGrid, TrendPanel, tally, windowCounts, dailySpark, SERIES } from '../kit';

export function ProjectsTab({ projects, search, onSearchChange }: {
  projects: ProjectWithCounts[];
  search: string;
  onSearchChange: (s: string) => void;
}) {
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [projectStats, setProjectStats] = useState<Record<string, ProjectStatsDetail>>({});

  const loadProjectStats = async (projectId: string) => {
    if (projectStats[projectId]) {
      setExpandedProject(expandedProject === projectId ? null : projectId);
      return;
    }

    const supabase = createClient();
    const [scripts, , chars, locs, scenes, shots, ideas, budget, schedule] = await Promise.all([
      supabase.from('scripts').select('id, title, version', { count: 'exact' }).eq('project_id', projectId),
      Promise.resolve(null), // element stats are fetched below, once script ids are known
      supabase.from('characters').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('locations').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('scenes').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('shots').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('ideas').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('budget_items').select('id, amount:estimated_amount', { count: 'exact' }).eq('project_id', projectId),
      supabase.from('production_schedule').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    ]);

    // Get word count from elements via scripts
    const scriptIds = (scripts.data || []).map((s: { id: string }) => s.id);
    let wordCount = 0;
    let elementCount = 0;
    if (scriptIds.length > 0) {
      const { data: elData } = await fetchAllResult<{ content: string | null }>(() => supabase
        .from('script_elements')
        .select('content')
        .in('script_id', scriptIds));
      elementCount = elData?.length || 0;
      wordCount = (elData || []).reduce((sum: number, el: { content: string | null }) => {
        return sum + (el.content || '').trim().split(/\s+/).filter(Boolean).length;
      }, 0);
    }

    const totalBudget = (budget.data || []).reduce((sum: number, b: { amount: number | null }) => sum + (b.amount || 0), 0);

    setProjectStats({
      ...projectStats,
      [projectId]: {
        scripts: scripts.count || 0,
        elements: elementCount,
        words: wordCount,
        characters: chars.count || 0,
        locations: locs.count || 0,
        scenes: scenes.count || 0,
        shots: shots.count || 0,
        ideas: ideas.count || 0,
        budgetItems: budget.count || 0,
        totalBudget,
        scheduleEvents: schedule.count || 0,
        scriptList: scripts.data || [],
      },
    });

    setExpandedProject(projectId);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder:text-surface-500 outline-none focus:border-brand-500 w-64"
          />
        </div>
      </div>

      <div className="space-y-3">
        {projects.map((p) => (
          <div key={p.id} className="rounded-xl border border-surface-800 bg-surface-900/50 overflow-hidden">
            <button
              onClick={() => loadProjectStats(p.id)}
              className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-surface-800/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {p.title?.[0] || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{p.title}</p>
                <p className="text-xs text-surface-500">{p.logline || 'No logline'}</p>
              </div>
              <Badge variant="default" size="sm">{(p.status || '').replace('_', ' ')}</Badge>
              <div className="text-right">
                <p className="text-xs text-surface-400">{p.format || '—'}</p>
                <p className="text-[11px] text-surface-500">{timeAgo(p.updated_at)}</p>
              </div>
              <svg className={cn('w-4 h-4 text-surface-500 transition-transform', expandedProject === p.id && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {expandedProject === p.id && projectStats[p.id] && (
              <div className="border-t border-surface-800 px-6 py-4 bg-surface-900/80">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 mb-4">
                  {[
                    { label: 'Scripts', val: projectStats[p.id].scripts },
                    { label: 'Words', val: projectStats[p.id].words.toLocaleString() },
                    { label: 'Elements', val: projectStats[p.id].elements.toLocaleString() },
                    { label: 'Characters', val: projectStats[p.id].characters },
                    { label: 'Locations', val: projectStats[p.id].locations },
                    { label: 'Scenes', val: projectStats[p.id].scenes },
                    { label: 'Shots', val: projectStats[p.id].shots },
                    { label: 'Ideas', val: projectStats[p.id].ideas },
                    { label: 'Budget Items', val: projectStats[p.id].budgetItems },
                    { label: 'Schedule', val: projectStats[p.id].scheduleEvents },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-lg font-bold text-white">{s.val}</p>
                      <p className="text-[11px] text-surface-500">{s.label}</p>
                    </div>
                  ))}
                </div>
                {projectStats[p.id].totalBudget > 0 && (
                  <p className="text-xs text-surface-400">Total Budget: <span className="text-white font-medium">${projectStats[p.id].totalBudget.toLocaleString()}</span></p>
                )}
                <div className="mt-3 flex gap-2">
                  <Link href={`/projects/${p.id}`}>
                    <Button variant="ghost" className="text-xs">Open Project</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

async function loadAdminProjects(): Promise<ProjectWithCounts[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_members(role, user_id, profile:profiles!project_members_user_id_fkey(id, display_name, email, avatar_url)), scripts(count)')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  await fillEmails(supabase, (data || []).flatMap((p: { project_members?: { profile?: { id?: string; email?: string | null } | null }[] }) => (p.project_members || []).map((m) => m.profile)));
  return (data || []) as unknown as ProjectWithCounts[];
}

export default function ProjectsPanel() {
  const [search, setSearch] = useState('');
  const { data: projects, loading } = useAdminData('projects', loadAdminProjects, []);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? projects.filter((p) => p.title.toLowerCase().includes(q)) : projects;
  }, [projects, search]);
  if (loading) return <TabSkeleton />;
  const created = (p: ProjectWithCounts) => p.created_at;
  const week = windowCounts(projects, created, 7);
  const activeWeek = windowCounts(projects, (p) => p.updated_at, 7);
  const scripts = projects.reduce((n, p) => n + (p.scripts?.[0]?.count ?? 0), 0);
  const collaborative = projects.filter((p) => (p.project_members?.length ?? 0) > 1).length;
  return (
    <AdminPage>
      <PageHeader icon={<FolderKanban className="h-5 w-5" />} title="Projects" description="Every project on the platform, with members and content stats." meta={<>{activeWeek.current} edited in the last 7 days</>} />
      <StatGrid
        cols={5}
        items={[
          { label: 'Projects', value: projects.length, tone: 'brand' },
          { label: 'New · 7 days', value: week.current, delta: week.delta, tone: 'amber', spark: dailySpark(projects, created) },
          { label: 'Active · 7 days', value: activeWeek.current, tone: 'aqua', hint: 'Updated in the last 7 days' },
          { label: 'Collaborative', value: collaborative, tone: 'violet', hint: 'Projects with more than one member' },
          { label: 'Scripts', value: scripts, tone: 'blue' },
        ]}
      />
      <div className="grid gap-5 lg:grid-cols-5">
        <TrendPanel id="projects-created" className="lg:col-span-3" title="Project activity" subtitle="Created vs. last edited" sources={[
          { key: 'created', label: 'Created', color: SERIES.orange, rows: projects, time: created },
          { key: 'updated', label: 'Last edited', color: SERIES.aqua, rows: projects, time: (p) => p.updated_at },
        ]} />
        <Panel title="By format" className="lg:col-span-2">
          <BarList items={tally(projects, (p) => p.format)} color={SERIES.orange} limit={6} />
          <div className="mt-4 border-t border-surface-800 pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-surface-500">By status</p>
            <BarList items={tally(projects, (p) => p.status)} color={SERIES.violet} limit={4} />
          </div>
        </Panel>
      </div>
      <Reveal><ProjectsTab projects={filtered} search={search} onSearchChange={setSearch} /></Reveal>
    </AdminPage>
  );
}

/** Mind map shares the projects cache with the Projects tab. */
export function MindmapPanel() {
  const { data: projects, loading } = useAdminData('projects', loadAdminProjects, []);
  if (loading) return <TabSkeleton />;
  return (
    <AdminPage>
      <PageHeader icon={<Network className="h-5 w-5" />} title="Mind Map" description="How projects and people connect across the platform." />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Reveal><MindmapTab projects={projects as any} /></Reveal>
    </AdminPage>
  );
}
