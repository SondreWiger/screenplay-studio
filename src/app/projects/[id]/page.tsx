'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/lib/stores';
import { Card, Badge, Progress, Button, LoadingPage } from '@/components/ui';
import { formatDate, formatCurrency, timeAgo, cn } from '@/lib/utils';
import { formatWorkSeconds } from '@/hooks/useWorkTimeTracker';
import type { Script, Character, Location, Scene, Shot, Idea, BudgetItem, ScheduleEvent } from '@/lib/types';
import Link from 'next/link';

interface ActivityItem {
  id: string;
  type: string;
  label: string;
  detail: string;
  timestamp: string;
  icon: string;
  color: string;
}

// ── Inline sparkline (no deps) ───────────────────────────────
function MiniSparkline({ values, color = '#6366f1' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 160;
  const h = 40;
  const step = w / (values.length - 1);
  const pts = values
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(' ');
  const fill = values
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .concat([`${w},${h}`, `0,${h}`])
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polygon points={fill} fill={color} fillOpacity={0.15} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── WorkTimeCard ─────────────────────────────────────────────
interface WorkTimeData {
  my_total_seconds: number;
  team_total_seconds: number;
  daily: { date: string; seconds: number }[];
  context_breakdown: Record<string, number>;
}

function WorkTimeCard({ projectId }: { projectId: string }) {
  const [data, setData]     = useState<WorkTimeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/work-session?projectId=${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: WorkTimeData | null) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  const dailyValues = (data?.daily ?? []).map((d) => d.seconds);
  const peakDay     = data?.daily?.reduce(
    (best, d) => d.seconds > best.seconds ? d : best,
    { date: '', seconds: 0 },
  );

  // Context labels
  const ctxColour: Record<string, string> = {
    script:       '#6366f1',
    documents:    '#22d3ee',
    'arc-planner': '#a855f7',
    general:      '#6b7280',
  };

  const ctxEntries = Object.entries(data?.context_breakdown ?? {})
    .sort(([, a], [, b]) => b - a);

  return (
    <Card className="p-6 border-surface-800/80">
      <p className="section-title mb-5">Working Time</p>

      {loading ? (
        <p className="text-xs text-surface-500">Loading…</p>
      ) : !data ? (
        <p className="text-xs text-surface-500">No sessions yet — open the script or documents editor to start tracking.</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <p className="stat-label">My time</p>
              <p className="text-3xl font-black text-white leading-tight mt-1">{formatWorkSeconds(data.my_total_seconds)}</p>
            </div>
            <div>
              <p className="stat-label">Team total</p>
              <p className="text-3xl font-black text-white leading-tight mt-1">{formatWorkSeconds(data.team_total_seconds)}</p>
            </div>
          </div>

          {/* 30-day sparkline */}
          {dailyValues.some((v) => v > 0) && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-surface-500">Last 30 days</p>
                {peakDay && peakDay.seconds > 0 && (
                  <p className="text-[11px] text-surface-500">
                    Peak: <span className="text-white">{formatWorkSeconds(peakDay.seconds)}</span> on {peakDay.date.slice(5)}
                  </p>
                )}
              </div>
              <MiniSparkline values={dailyValues} color="#6366f1" />
              <div className="flex justify-between text-[10px] text-surface-600 mt-0.5">
                <span>{data.daily[0]?.date.slice(5)}</span>
                <span>{data.daily[data.daily.length - 1]?.date.slice(5)}</span>
              </div>
            </div>
          )}

          {/* Context breakdown */}
          {ctxEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-surface-500 uppercase tracking-wider">Where you worked</p>
              {ctxEntries.map(([ctx, secs]) => (
                <div key={ctx}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-surface-300 capitalize">{ctx.replace(/-/g, ' ')}</span>
                    <span className="text-surface-400">{formatWorkSeconds(secs)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: ctxColour[ctx] ?? '#6366f1',
                        width: `${data.my_total_seconds > 0 ? (secs / data.my_total_seconds) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hourly rate helper note */}
          <p className="text-[11px] text-surface-600 mt-4">
            💡 Billing hourly? My time = {(data.my_total_seconds / 3600).toFixed(2)} hrs (exact)
          </p>
        </>
      )}
    </Card>
  );
}

export default function ProjectOverviewPage({ params }: { params: { id: string } }) {
  const { currentProject } = useProjectStore();
  const [stats, setStats] = useState({
    scripts: 0,
    characters: 0,
    locations: 0,
    scenes: 0,
    shots: 0,
    ideas: 0,
    budgetTotal: 0,
    budgetSpent: 0,
    upcomingEvents: 0,
    completedScenes: 0,
    completedShots: 0,
    totalDurationMinutes: 0,
    totalPageCount: 0,
    members: 0,
    documents: 0,
    scriptLines: 0,
  });
  const [recentScripts, setRecentScripts] = useState<Script[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduleEvent[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  // Collapse Recent Activity by default to improve page form factor
  const [activityExpanded, setActivityExpanded] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [params.id]);

  const fetchStats = async () => {
    try {
      const supabase = createClient();
      const [scripts, characters, locations, scenes, shots, ideas, budget, events, members, documents] = await Promise.all([
        supabase.from('scripts').select('*').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('characters').select('id, name, updated_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('locations').select('id, name, updated_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('scenes').select('id, scene_number, is_completed, estimated_duration_minutes, page_count, updated_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('shots').select('id, shot_number, is_completed, updated_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('ideas').select('id, title, updated_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('budget_items').select('estimated_amount, actual_amount').eq('project_id', params.id),
        supabase.from('production_schedule').select('*').eq('project_id', params.id).gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(5),
        supabase.from('project_members').select('id').eq('project_id', params.id),
        supabase.from('project_documents').select('id', { count: 'exact', head: true }).eq('project_id', params.id),
      ]);

      // Count script lines (script_elements) using actual script IDs
      const scriptIds = (scripts.data || []).map((s: { id: string }) => s.id);
      let scriptLines = 0;
      if (scriptIds.length > 0) {
        const { count } = await supabase
          .from('script_elements')
          .select('id', { count: 'exact', head: true })
          .in('script_id', scriptIds);
        scriptLines = count ?? 0;
      }

      const budgetData = budget.data || [];
      const scenesData = scenes.data || [];
      const shotsData = shots.data || [];

      // Calculate estimated duration from scenes
      const totalDurationMinutes = scenesData.reduce((sum: number, s: { estimated_duration_minutes?: number }) => sum + (s.estimated_duration_minutes || 0), 0);
      const totalPageCount = scenesData.reduce((sum: number, s: { page_count?: number }) => sum + (s.page_count || 0), 0);

      setStats({
        scripts: scripts.data?.length || 0,
        characters: characters.data?.length || 0,
        locations: locations.data?.length || 0,
        scenes: scenesData.length,
        shots: shotsData.length,
        ideas: ideas.data?.length || 0,
        budgetTotal: budgetData.reduce((sum: number, b: { estimated_amount?: number }) => sum + (b.estimated_amount || 0), 0),
        budgetSpent: budgetData.reduce((sum: number, b: { actual_amount?: number }) => sum + (b.actual_amount || 0), 0),
        upcomingEvents: events.data?.length || 0,
        completedScenes: scenesData.filter((s: { is_completed?: boolean }) => s.is_completed).length,
        completedShots: shotsData.filter((s: { is_completed?: boolean }) => s.is_completed).length,
        totalDurationMinutes,
        totalPageCount,
        members: members.data?.length || 0,
        documents: documents.count ?? 0,
        scriptLines,
      });
      setRecentScripts((scripts.data || []).slice(0, 3));
      setUpcomingEvents((events.data || []).slice(0, 5));

      // Build activity timeline from recent changes across all tables
      const activityItems: ActivityItem[] = [];

      (scripts.data || []).slice(0, 5).forEach((s: { id: string; title: string; updated_at: string }) => {
        activityItems.push({ id: 'script-' + s.id, type: 'script', label: s.title, detail: 'Script updated', timestamp: s.updated_at, icon: 'script', color: '#6366f1' });
      });
      (characters.data || []).slice(0, 5).forEach((c: { id: string; name: string; updated_at: string }) => {
        activityItems.push({ id: 'char-' + c.id, type: 'character', label: c.name, detail: 'Character updated', timestamp: c.updated_at, icon: 'character', color: '#ec4899' });
      });
      (locations.data || []).slice(0, 5).forEach((l: { id: string; name: string; updated_at: string }) => {
        activityItems.push({ id: 'loc-' + l.id, type: 'location', label: l.name, detail: 'Location updated', timestamp: l.updated_at, icon: 'location', color: '#14b8a6' });
      });
      scenesData.slice(0, 5).forEach((s: { id: string; scene_number?: string; is_completed?: boolean; updated_at: string }) => {
        activityItems.push({ id: 'scene-' + s.id, type: 'scene', label: 'Scene ' + (s.scene_number || ''), detail: s.is_completed ? 'Scene completed' : 'Scene updated', timestamp: s.updated_at, icon: 'scene', color: '#f59e0b' });
      });
      shotsData.slice(0, 5).forEach((s: { id: string; shot_number?: string; is_completed?: boolean; updated_at: string }) => {
        activityItems.push({ id: 'shot-' + s.id, type: 'shot', label: 'Shot ' + (s.shot_number || ''), detail: s.is_completed ? 'Shot completed' : 'Shot updated', timestamp: s.updated_at, icon: 'shot', color: '#3b82f6' });
      });
      (ideas.data || []).slice(0, 5).forEach((i: { id: string; title: string; updated_at: string }) => {
        activityItems.push({ id: 'idea-' + i.id, type: 'idea', label: i.title, detail: 'Idea updated', timestamp: i.updated_at, icon: 'idea', color: '#a855f7' });
      });

      activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivity(activityItems.slice(0, 15));
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  if (!currentProject) return <LoadingPage />;

  // Duration display logic
  const estimatedMinutes = stats.totalDurationMinutes || Math.round(stats.totalPageCount * 1);
  const targetMinutes = currentProject.target_length_minutes || 0;
  const durationHours = Math.floor(estimatedMinutes / 60);
  const durationMins = estimatedMinutes % 60;
  const durationStr = durationHours > 0 ? durationHours + 'h ' + durationMins + 'm' : durationMins + ' min';
  const targetStr = targetMinutes > 0 ? (Math.floor(targetMinutes / 60) > 0 ? Math.floor(targetMinutes / 60) + 'h ' + (targetMinutes % 60) + 'm' : targetMinutes + ' min') : '';

  const statusColor =
    currentProject.status === 'production' ? '#22c55e' :
    currentProject.status === 'completed' || currentProject.status === 'post_production' ? '#60a5fa' :
    currentProject.status === 'pre_production' ? '#f59e0b' : '#a78bfa';

  return (
    <div className="page-root">

      {/* ── Page Header ─────────────────────────────── */}
      <div className="mb-10">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="page-title">{currentProject.title}</h1>
            {currentProject.logline && (
              <p className="page-subtitle max-w-2xl mt-2">{currentProject.logline}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide"
                style={{ background: statusColor + '18', color: statusColor, border: `1px solid ${statusColor}35` }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusColor }} />
                {currentProject.status.replace(/_/g, ' ')}
              </span>
              <Badge variant="info">{currentProject.format}</Badge>
              {currentProject.genre?.map((g: string) => (
                <Badge key={g}>{g}</Badge>
              ))}
            </div>
          </div>
          {estimatedMinutes > 0 && (
            <div className="shrink-0 text-right hidden md:block">
              <p className="stat-value" style={{ color: 'rgb(var(--brand-400))' }}>{durationStr}</p>
              <p className="stat-label">estimated runtime</p>
              {targetMinutes > 0 && (
                <p className="text-[11px] text-surface-600 mt-1">target: {targetStr}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Primary Stats ────────────────────────────── */}
      <div className="mb-3">
        <p className="section-title">Project Numbers</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10 stagger-children">
        {[
          { label: 'Scripts',     value: stats.scripts,    href: 'script',     color: '#818cf8' },
          { label: 'Characters',  value: stats.characters, href: 'characters', color: '#f472b6' },
          { label: 'Locations',   value: stats.locations,  href: 'locations',  color: '#2dd4bf' },
          { label: 'Scenes',      value: stats.scenes,     href: 'scenes',     color: '#fbbf24' },
          { label: 'Shots',       value: stats.shots,      href: 'shots',      color: '#60a5fa' },
        ].map((stat) => (
          <Link key={stat.label} href={`/projects/${params.id}/${stat.href}`}>
            <div
              className="stat-card group"
              style={{ '--stat-color': stat.color } as React.CSSProperties}
            >
              <p className="stat-value group-hover:text-white" style={{ color: stat.color }}>{stat.value}</p>
              <p className="stat-label">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Secondary Stats ───────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {[
          { label: 'Documents',    value: stats.documents,                  href: 'documents', color: '#22d3ee' },
          { label: 'Script Lines', value: stats.scriptLines.toLocaleString(), href: 'script',  color: '#a78bfa' },
          { label: 'Ideas',        value: stats.ideas,                      href: 'ideas',     color: '#fb923c' },
          { label: 'Team Members', value: stats.members,                    href: 'team',      color: '#34d399' },
        ].map((stat) => (
          <Link key={stat.label} href={`/projects/${params.id}/${stat.href}`}>
            <div className="card-row group hover:cursor-pointer">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black transition-transform group-hover:scale-110"
                style={{ background: stat.color + '18', color: stat.color }}
              >
                {typeof stat.value === 'number' ? stat.value : <span className="text-xs">{stat.value}</span>}
              </div>
              <p className="stat-label leading-none">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Main Content Grid ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Production Progress */}
        <Card className="p-6">
          <p className="section-title">Production Progress</p>
          <div className="space-y-5">
            <Progress label="Scenes Complete" value={stats.completedScenes} max={Math.max(stats.scenes, 1)} color="#22c55e" />
            <Progress label="Shots Complete"  value={stats.completedShots}  max={Math.max(stats.shots, 1)}  color="#60a5fa" />
            <Progress
              label="Budget Used"
              value={stats.budgetSpent}
              max={Math.max(stats.budgetTotal, 1)}
              color={stats.budgetSpent > stats.budgetTotal * 0.9 ? '#ef4444' : '#f59e0b'}
            />
          </div>
          {stats.budgetTotal > 0 && (
            <div className="mt-5 pt-4 border-t border-surface-800/60 flex justify-between items-center">
              <span className="text-xs text-surface-500">{formatCurrency(stats.budgetSpent)} spent of {formatCurrency(stats.budgetTotal)}</span>
              <span className={cn('text-xs font-bold', stats.budgetSpent > stats.budgetTotal ? 'text-red-400' : 'text-green-400')}>
                {formatCurrency(stats.budgetTotal - stats.budgetSpent)} left
              </span>
            </div>
          )}
        </Card>

        {/* Working Time */}
        <WorkTimeCard projectId={params.id} />

        {/* Activity Timeline */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="section-title mb-0">Recent Activity</p>
            {activity.length > 0 && (
              <button
                onClick={() => setActivityExpanded((v) => !v)}
                className="text-[10px] font-bold uppercase tracking-wider text-surface-600 hover:text-white transition-colors"
              >
                {activityExpanded ? 'Show less' : 'Show all'}
              </button>
            )}
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-surface-500">No activity yet — add scripts, characters, or scenes to start.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-1 bottom-1 w-px" style={{ background: 'linear-gradient(to bottom, rgb(var(--brand-500)/0.3), transparent)' }} />
              <div className="space-y-3">
                {(activityExpanded ? activity : activity.slice(0, 6)).map((item) => (
                  <div key={item.id} className="flex items-start gap-3 group">
                    <div
                      className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center z-10 mt-0.5 ring-2 ring-surface-950 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: item.color + '25' }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">{item.label}</p>
                        <Badge size="sm">{item.type}</Badge>
                      </div>
                      <p className="text-[11px] text-surface-500 mt-0.5">{item.detail} · {timeAgo(item.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Upcoming Schedule */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="section-title mb-0">Upcoming Schedule</p>
            <Link href={`/projects/${params.id}/schedule`}>
              <Button variant="ghost" size="sm">View All →</Button>
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-surface-500">No upcoming events scheduled.</p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="card-row">
                  <div className="w-1 h-9 rounded-full shrink-0" style={{ backgroundColor: event.color || '#6366f1' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{event.title}</p>
                    <p className="text-[11px] text-surface-500">{formatDate(event.start_time)} · {event.event_type.replace('_', ' ')}</p>
                  </div>
                  {event.is_confirmed && <Badge variant="success" size="sm">confirmed</Badge>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Scripts */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="section-title mb-0">Scripts</p>
            <Link href={`/projects/${params.id}/script`}>
              <Button variant="ghost" size="sm">Open Editor →</Button>
            </Link>
          </div>
          {recentScripts.length === 0 ? (
            <p className="text-sm text-surface-500">No scripts yet — create one in the editor.</p>
          ) : (
            <div className="space-y-2">
              {recentScripts.map((script) => (
                <Link key={script.id} href={`/projects/${params.id}/script`}>
                  <div className="card-row group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgb(99 102 241 / 0.15)', color: '#818cf8' }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate group-hover:text-[#FF8F5F] transition-colors">{script.title}</p>
                      <p className="text-[11px] text-surface-500">v{script.version} · {formatDate(script.updated_at)}</p>
                    </div>
                    <Badge size="sm">{script.revision_color}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Creative Tools */}
        <Card className="p-6">
          <p className="section-title">Creative Tools</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { href: 'mindmap',   label: 'Mind Map',    sub: 'Character web',       color: '#f97316', from: 'from-orange-500/10', to: 'to-red-500/10',    border: 'border-orange-500/20', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="5" r="2.5" strokeWidth={1.5}/><circle cx="5" cy="18" r="2.5" strokeWidth={1.5}/><circle cx="19" cy="18" r="2.5" strokeWidth={1.5}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7.5v3m0 0l-5.5 5m5.5-5l5.5 5"/></svg> },
              { href: 'moodboard', label: 'Mood Board',  sub: 'Visual references',   color: '#a855f7', from: 'from-purple-500/10', to: 'to-pink-500/10',   border: 'border-purple-500/20', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zm10-2a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" /></svg> },
              { href: 'corkboard', label: 'Corkboard',   sub: `${stats.scenes} scenes`,  color: '#fbbf24', from: 'from-yellow-500/10', to: 'to-amber-500/10',  border: 'border-yellow-500/20', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
              { href: 'arc-planner', label: 'Arc Planner', sub: 'Story structure',    color: '#60a5fa', from: 'from-blue-500/10',   to: 'to-indigo-500/10', border: 'border-blue-500/20',   icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
            ].map((tool) => (
              <Link key={tool.href} href={`/projects/${params.id}/${tool.href}`}>
                <div className={cn('p-4 rounded-xl bg-gradient-to-br border transition-all duration-200 group cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20', tool.from, tool.to, tool.border, `hover:${tool.border.replace('20', '40')}`)}>
                  <div className="mb-2.5 transition-transform group-hover:scale-110" style={{ color: tool.color }}>{tool.icon}</div>
                  <p className="text-sm font-bold text-white">{tool.label}</p>
                  <p className="text-[11px] text-surface-500 mt-0.5">{tool.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Synopsis */}
        {currentProject.synopsis && (
          <Card className="p-6 lg:col-span-2">
            <p className="section-title">Synopsis</p>
            <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-wrap">{currentProject.synopsis}</p>
          </Card>
        )}

      </div>
    </div>
  );
}

