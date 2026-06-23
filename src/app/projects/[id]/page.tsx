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

// Inline sparkline (no deps)
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

// WorkTimeCard
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
    comments: 0,
  });
  const [recentScripts, setRecentScripts] = useState<Script[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduleEvent[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  // Collapse Recent Activity by default to improve page form factor
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [isWelcomeDismissed, setIsWelcomeDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(`project-onboarding-dismissed-${params.id}`);
    if (dismissed === 'true') setIsWelcomeDismissed(true);
  }, [params.id]);

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
        supabase.from('budget_items').select('estimated_amount, actual_amount, is_income').eq('project_id', params.id),
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
      const expenseItems = budgetData.filter((b: { is_income?: boolean }) => !b.is_income);
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
        budgetTotal: expenseItems.reduce((sum: number, b: { estimated_amount?: number }) => sum + (b.estimated_amount || 0), 0),
        budgetSpent: expenseItems.reduce((sum: number, b: { actual_amount?: number }) => sum + (b.actual_amount || 0), 0),
        upcomingEvents: events.data?.length || 0,
        completedScenes: scenesData.filter((s: { is_completed?: boolean }) => s.is_completed).length,
        completedShots: shotsData.filter((s: { is_completed?: boolean }) => s.is_completed).length,
        totalDurationMinutes,
        totalPageCount,
        members: members.data?.length || 0,
        documents: documents.count ?? 0,
        scriptLines,
        comments: 0,
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

      // Second batch: docs with editor, comments, stage data
      const [docsData, commentsData, ensembleData, cuesData] = await Promise.all([
        supabase
          .from('project_documents')
          .select('id, title, updated_at, profiles!last_edited_by(display_name)')
          .eq('project_id', params.id)
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('document_comments')
          .select('id, content, created_at, profiles!author_id(display_name)')
          .eq('project_id', params.id)
          .eq('is_resolved', false)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('stage_ensemble_members')
          .select('id, actor_name, character_name, updated_at')
          .eq('project_id', params.id)
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('stage_cues')
          .select('id, cue_number, cue_type, description, updated_at')
          .eq('project_id', params.id)
          .order('updated_at', { ascending: false })
          .limit(5),
      ]);

      const commentCount = commentsData.data?.length ?? 0;
      setStats((prev) => ({ ...prev, comments: commentCount }));

      (docsData.data || []).forEach((d: { id: string; title?: string; updated_at: string; profiles?: { display_name?: string }[] | null }) => {
        const editorName = Array.isArray(d.profiles) ? d.profiles[0]?.display_name : (d.profiles as { display_name?: string } | null | undefined)?.display_name;
        activityItems.push({
          id: 'doc-' + d.id,
          type: 'document',
          label: d.title || 'Untitled Document',
          detail: editorName ? `Edited by ${editorName}` : 'Document updated',
          timestamp: d.updated_at,
          icon: 'document',
          color: '#22d3ee',
        });
      });
      (commentsData.data || []).forEach((c: { id: string; content?: string; created_at: string; profiles?: { display_name?: string }[] | null }) => {
        const authorName = (Array.isArray(c.profiles) ? c.profiles[0]?.display_name : (c.profiles as { display_name?: string } | null | undefined)?.display_name) || 'Someone';
        const preview = c.content ? c.content.slice(0, 45) + (c.content.length > 45 ? '…' : '') : 'Comment';
        activityItems.push({
          id: 'comment-' + c.id,
          type: 'comment',
          label: preview,
          detail: `${authorName} commented`,
          timestamp: c.created_at,
          icon: 'comment',
          color: '#fb923c',
        });
      });
      (ensembleData.data || []).forEach((m: { id: string; actor_name: string; character_name?: string; updated_at: string }) => {
        activityItems.push({
          id: 'ensemble-' + m.id,
          type: 'cast',
          label: m.actor_name + (m.character_name ? ` as ${m.character_name}` : ''),
          detail: 'Cast member updated',
          timestamp: m.updated_at,
          icon: 'cast',
          color: '#a78bfa',
        });
      });
      (cuesData.data || []).forEach((q: { id: string; cue_number: string; cue_type: string; description?: string; updated_at: string }) => {
        activityItems.push({
          id: 'cue-' + q.id,
          type: 'cue',
          label: `${q.cue_type?.toUpperCase()} ${q.cue_number}`,
          detail: q.description || 'Cue updated',
          timestamp: q.updated_at,
          icon: 'cue',
          color: '#fbbf24',
        });
      });

      activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivity(activityItems.slice(0, 20));
      setStatsLoaded(true);
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

  const isAudioDrama = currentProject.project_type === 'audio_drama' || currentProject.script_type === 'audio_drama';
  const showWelcomeCard = !isWelcomeDismissed && statsLoaded && (
    (stats.scripts === 0 && stats.characters === 0 && stats.scenes === 0) ||
    (Date.now() - new Date(currentProject.created_at).getTime() < 60 * 60 * 1000)
  );

  const statusColor =
    currentProject.status === 'production' ? '#22c55e' :
    currentProject.status === 'completed' || currentProject.status === 'post_production' ? '#60a5fa' :
    currentProject.status === 'pre_production' ? '#f59e0b' : '#a78bfa';

  return (
    <div className="page-root">

      {/* ── Breadcrumbs ──────────────────────────── */}
      <nav aria-label="Breadcrumb" className="text-xs text-surface-500 mb-4 flex items-center gap-1.5">
        <Link href="/dashboard" className="flex items-center gap-1.5 hover:text-surface-300 transition-colors group">
          <svg className="w-3.5 h-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          Projects
        </Link>
        <svg className="w-3 h-3 text-surface-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-surface-400 font-medium">{currentProject.title}</span>
      </nav>

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

      {/* ── Welcome Card ──────────────────────────────── */}
      {showWelcomeCard && (
        <div className="relative mb-8 p-6 rounded-xl border border-brand-500/20 bg-gradient-to-br from-brand-500/5 to-surface-900/50">
          <button
            onClick={() => {
              setIsWelcomeDismissed(true);
              localStorage.setItem(`project-onboarding-dismissed-${params.id}`, 'true');
            }}
            className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-surface-500 hover:text-white hover:bg-surface-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Welcome to your new project!</h2>
              <p className="text-sm text-surface-400">Start building your screenplay project. Here are some first steps:</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href={`/projects/${params.id}/script`}>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-900/50 border border-surface-800/60 hover:border-brand-500/30 hover:bg-surface-800/50 transition-colors duration-200 group cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-500 transition-transform">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white text-center">Write Your Script</p>
              </div>
            </Link>
            <Link href={`/projects/${params.id}/characters`}>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-900/50 border border-surface-800/60 hover:border-brand-500/30 hover:bg-surface-800/50 transition-colors duration-200 group cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-500 transition-transform">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white text-center">Add Characters</p>
              </div>
            </Link>
            <Link href={`/projects/${params.id}/locations`}>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-900/50 border border-surface-800/60 hover:border-brand-500/30 hover:bg-surface-800/50 transition-colors duration-200 group cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-500 transition-transform">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white text-center">Plan Locations</p>
              </div>
            </Link>
            <Link href={`/projects/${params.id}/moodboard`}>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-900/50 border border-surface-800/60 hover:border-brand-500/30 hover:bg-surface-800/50 transition-colors duration-200 group cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-500 transition-transform">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white text-center">Create Moodboard</p>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* ── Primary Stats ────────────────────────────── */}
      <div className="mb-3">
        <p className="section-title">Project Numbers</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10 stagger-children">
        {(isAudioDrama ? [
          { label: 'Scripts',    value: stats.scripts,    href: 'script',     color: '#818cf8' },
          { label: 'Characters', value: stats.characters, href: 'characters', color: '#f472b6' },
          { label: 'Locations',  value: stats.locations,  href: 'locations',  color: '#2dd4bf' },
          { label: 'Episodes',   value: stats.scenes,     href: 'scenes',     color: '#a78bfa' },
          { label: 'Ideas',      value: stats.ideas,      href: 'ideas',      color: '#fb923c' },
        ] : [
          { label: 'Scripts',    value: stats.scripts,    href: 'script',     color: '#818cf8' },
          { label: 'Characters', value: stats.characters, href: 'characters', color: '#f472b6' },
          { label: 'Locations',  value: stats.locations,  href: 'locations',  color: '#2dd4bf' },
          { label: 'Scenes',     value: stats.scenes,     href: 'scenes',     color: '#fbbf24' },
          { label: 'Shots',      value: stats.shots,      href: 'shots',      color: '#60a5fa' },
        ]).map((stat) => (
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
          { label: 'Comments',     value: stats.comments,                   href: 'documents', color: '#fb923c' },
          { label: 'Team Members', value: stats.members,                    href: 'team',      color: '#34d399' },
        ].map((stat) => (
          <Link key={stat.label} href={`/projects/${params.id}/${stat.href}`}>
            <div className="card-row group hover:cursor-pointer">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black transition-transform"
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
                {activityExpanded ? 'Show less' : `Show all (${activity.length})`}
              </button>
            )}
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-surface-500">Get started by creating a script, adding characters, or planning scenes.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-1 bottom-1 w-px" style={{ background: 'linear-gradient(to bottom, rgb(var(--brand-500)/0.3), transparent)' }} />
              <div className="space-y-2">
                {(activityExpanded ? activity : activity.slice(0, 6)).map((item) => {
                  const typeIcon = ({
                    Script: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
                    Character: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
                    Scene: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
                    Shot: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
                    Location: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
                    Idea: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
                    Document: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
                    Comment: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
                    Ensemble: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
                  } as Record<string, React.ReactNode>)[item.type] || null;
                  const routeMap = { Script: 'script', Character: 'characters', Scene: 'scenes', Shot: 'shots', Location: 'locations', Idea: 'ideas', Document: 'documents', Comment: 'comments', Ensemble: 'ensemble' } as Record<string, string>;
                  return (
                    <Link key={item.id} href={`/projects/${params.id}/${routeMap[item.type] || ''}`}
                      className="flex items-start gap-3 group rounded-lg transition-colors duration-150 hover:bg-white/[0.03] -mx-2 px-2 py-1.5"
                    >
                      <div
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center z-10 ring-2 ring-surface-950 transition-colors duration-150 group-hover:ring-brand-500/30"
                        style={{ backgroundColor: item.color + '20' }}
                      >
                        {typeIcon ? (
                          <span style={{ color: item.color }}>{typeIcon}</span>
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate group-hover:text-brand-500 transition-colors">{item.label}</p>
                          <Badge size="sm">{item.type}</Badge>
                        </div>
                        <p className="text-[11px] text-surface-500 mt-0.5">{item.detail} · {timeAgo(item.timestamp)}</p>
                      </div>
                    </Link>
                  );
                })}
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
                      <p className="text-sm font-semibold text-white truncate group-hover:text-brand-400 transition-colors">{script.title}</p>
                      <p className="text-[11px] text-surface-500">v{script.version} · {formatDate(script.updated_at)}</p>
                    </div>
                    <Badge size="sm">{script.revision_color}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Creative Tools — conditional per project type */}
        {isAudioDrama ? (
          <Card className="p-6">
            <p className="section-title">Audio Drama Tools</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { href: 'sound-design', label: 'Sound Design', sub: 'SFX · Music · Ambience', color: '#7c3aed', from: 'from-surface-800/50', to: 'to-surface-900/50', border: 'border-surface-700',
                  icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg> },
                { href: 'voice-cast',   label: 'Voice Cast',   sub: `${stats.characters} characters`, color: '#ec4899', from: 'from-surface-800/50', to: 'to-surface-900/50', border: 'border-surface-700',
                  icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg> },
                { href: 'arc-planner', label: 'Arc Planner',   sub: 'Story structure',      color: '#60a5fa', from: 'from-surface-800/50', to: 'to-surface-900/50', border: 'border-surface-700',
                  icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
                { href: 'mindmap',     label: 'Mind Map',      sub: 'Character web',        color: '#f97316', from: 'from-surface-800/50', to: 'to-surface-900/50', border: 'border-surface-700',
                  icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="5" r="2.5" strokeWidth={1.5}/><circle cx="5" cy="18" r="2.5" strokeWidth={1.5}/><circle cx="19" cy="18" r="2.5" strokeWidth={1.5}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7.5v3m0 0l-5.5 5m5.5-5l5.5 5"/></svg> },
              ].map((tool) => (
                <Link key={tool.href} href={`/projects/${params.id}/${tool.href}`}>
                  <div className={cn('p-4 rounded-xl bg-gradient-to-br border transition-all duration-200 group cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20', tool.from, tool.to, tool.border)}>
                    <div className="mb-2.5 transition-transform" style={{ color: tool.color }}>{tool.icon}</div>
                    <p className="text-sm font-bold text-white">{tool.label}</p>
                    <p className="text-[11px] text-surface-500 mt-0.5">{tool.sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <p className="section-title">Creative Tools</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { href: 'mindmap',   label: 'Mind Map',    sub: 'Character web',       color: '#f97316', from: 'from-surface-800/50', to: 'to-surface-900/50', border: 'border-surface-700', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="5" r="2.5" strokeWidth={1.5}/><circle cx="5" cy="18" r="2.5" strokeWidth={1.5}/><circle cx="19" cy="18" r="2.5" strokeWidth={1.5}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7.5v3m0 0l-5.5 5m5.5-5l5.5 5"/></svg> },
                { href: 'moodboard', label: 'Mood Board',  sub: 'Visual references',   color: '#a855f7', from: 'from-surface-800/50', to: 'to-surface-900/50', border: 'border-surface-700', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zm10-2a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" /></svg> },
                { href: 'corkboard', label: 'Corkboard',   sub: `${stats.scenes} scenes`,  color: '#fbbf24', from: 'from-surface-800/50', to: 'to-surface-900/50', border: 'border-surface-700', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
                { href: 'arc-planner', label: 'Arc Planner', sub: 'Story structure',    color: '#60a5fa', from: 'from-surface-800/50', to: 'to-surface-900/50', border: 'border-surface-700',   icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
              ].map((tool) => (
                <Link key={tool.href} href={`/projects/${params.id}/${tool.href}`}>
                  <div className={cn('p-4 rounded-xl bg-gradient-to-br border transition-all duration-200 group cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20', tool.from, tool.to, tool.border, `hover:${tool.border.replace('20', '40')}`)}>
                    <div className="mb-2.5 transition-transform" style={{ color: tool.color }}>{tool.icon}</div>
                    <p className="text-sm font-bold text-white">{tool.label}</p>
                    <p className="text-[11px] text-surface-500 mt-0.5">{tool.sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

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

