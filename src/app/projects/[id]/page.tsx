'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { attachProfiles } from '@/lib/supabase/fetch-all';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { getCachedByProject, getCachedByScript } from '@/lib/offline/db';
import { renameProject, deleteProject, renameScript, deleteScript } from '@/lib/project-actions';
import { MoreMenu, RenameDialog, DeleteProjectDialog, DeleteScriptDialog } from '@/components/projects/ManageControls';
import { useRouter } from 'next/navigation';
import { LoadingPage, toast } from '@/components/ui';
import { sidebarIcons } from '@/components/sidebar/SidebarIcons';
import {
  AdminPage, AnimatedNumber, BarList, Meter, Panel, Pill, Reveal, StatGrid, TimeChart, TrendPanel, SERIES,
} from '@/components/kit';
import { formatDate, formatCurrency, timeAgo, cn } from '@/lib/utils';
import { formatWorkSeconds } from '@/hooks/useWorkTimeTracker';
import type { Script, ScheduleEvent } from '@/lib/types';
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

type GrowthKey = 'characters' | 'locations' | 'scenes' | 'shots' | 'ideas';

// Writing time
interface WorkTimeData {
  my_total_seconds: number;
  team_total_seconds: number;
  daily: { date: string; seconds: number }[];
  context_breakdown: Record<string, number>;
}

const hoursFmt = (n: number) => formatWorkSeconds(Math.round(n));

function WorkTimePanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<WorkTimeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/work-session?projectId=${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: WorkTimeData | null) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  const daily = data?.daily ?? [];
  const buckets = daily.map((d) => Date.parse(`${d.date}T00:00:00Z`));
  const values = daily.map((d) => d.seconds);
  const peak = daily.reduce((best, d) => (d.seconds > best.seconds ? d : best), { date: '', seconds: 0 });
  const activeDays = values.filter((v) => v > 0).length;
  const contexts = Object.entries(data?.context_breakdown ?? {}).map(([label, count]) => ({ label: label.replace(/-/g, ' '), count })).sort((a, b) => b.count - a.count);

  return (
    <Panel title="Writing time" subtitle="Tracked while the script, documents or planners are open" className="lg:col-span-2">
      {loading ? (
        <p className="text-xs text-surface-500">Loading…</p>
      ) : !data ? (
        <p className="text-xs text-surface-500">No sessions yet — open the script or documents editor to start tracking.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-surface-500">You</p>
                <AnimatedNumber value={data.my_total_seconds} format={hoursFmt} className="text-2xl font-bold text-white" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-surface-500">Whole team</p>
                <AnimatedNumber value={data.team_total_seconds} format={hoursFmt} className="text-2xl font-bold text-white" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-surface-500">Active days · 30d</p>
                <AnimatedNumber value={activeDays} className="text-2xl font-bold text-white" />
              </div>
              {peak.seconds > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-surface-500">Best day</p>
                  <p className="text-2xl font-bold text-white">{formatWorkSeconds(peak.seconds)}</p>
                  <p className="text-[10px] text-surface-500">{peak.date.slice(5)}</p>
                </div>
              )}
            </div>
            {buckets.length > 1 && values.some((v) => v > 0) ? (
              <TimeChart animKey="work" buckets={buckets} unit="day" height={170} format={hoursFmt} bars series={[{ key: 'me', label: 'Your time', color: SERIES.violet, values }]} />
            ) : (
              <p className="py-8 text-center text-xs text-surface-500">No writing time in the last 30 days</p>
            )}
            <p className="mt-2 text-[11px] text-surface-500">Billing hourly? Your time is {(data.my_total_seconds / 3600).toFixed(2)} h exactly.</p>
          </div>
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-surface-500">Where you worked</p>
            <BarList items={contexts} color={SERIES.violet} format={formatWorkSeconds} empty="No sessions yet" />
          </div>
        </div>
      )}
    </Panel>
  );
}

const STATUS_TONE: Record<string, 'green' | 'blue' | 'amber' | 'violet'> = {
  production: 'green', completed: 'blue', post_production: 'blue', pre_production: 'amber',
};

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
  const [scriptToRename, setScriptToRename] = useState<Script | null>(null);
  const [scriptToDelete, setScriptToDelete] = useState<Script | null>(null);
  const [renamingProject, setRenamingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduleEvent[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  // Collapse Recent Activity by default to improve page form factor
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  // created_at per content type, for the growth chart
  const [growth, setGrowth] = useState<Record<GrowthKey, { created_at?: string | null }[]>>({ characters: [], locations: [], scenes: [], shots: [], ideas: [] });
  const [isWelcomeDismissed, setIsWelcomeDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(`project-onboarding-dismissed-${params.id}`);
    if (dismissed === 'true') setIsWelcomeDismissed(true);
  }, [params.id]);

  useEffect(() => {
    fetchStats();
  }, [params.id]);

  const handleRenameScript = async (title: string) => {
    if (!scriptToRename) return true;
    const res = await renameScript(scriptToRename.id, title);
    if (!res.ok) { toast.error(res.message); return false; }
    setRecentScripts(prev => prev.map(s => (s.id === res.data.id ? { ...s, title: res.data.title } : s)));
    toast.success('Script renamed');
    return true;
  };

  const handleDeleteScript = async () => {
    if (!scriptToDelete) return true;
    const res = await deleteScript(scriptToDelete.id);
    if (!res.ok) { toast.error(res.message); return false; }
    toast.success(`Deleted “${scriptToDelete.title}”`);
    setRecentScripts(prev => prev.filter(s => s.id !== scriptToDelete.id));
    setStats(prev => ({ ...prev, scripts: Math.max(0, prev.scripts - 1) }));
    return true;
  };

  const handleRenameProject = async (title: string) => {
    if (!currentProject) return true;
    const res = await renameProject(currentProject.id, title);
    if (!res.ok) { toast.error(res.message); return false; }
    toast.success('Project renamed');
    return true;
  };

  const handleDeleteProject = async () => {
    if (!currentProject) return true;
    const title = currentProject.title;
    const res = await deleteProject(currentProject.id);
    if (!res.ok) { toast.error(res.message); return false; }
    toast.success(`Deleted “${title}”`);
    router.push('/dashboard');
    return true;
  };

  const fetchStats = async () => {
    try {
      if (!navigator.onLine) {
        throw new Error('Browser is offline');
      }
      const supabase = createClient();
      const [scripts, characters, locations, scenes, shots, ideas, budget, events, members, documents] = await Promise.all([
        supabase.from('scripts').select('*').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('characters').select('id, name, updated_at, created_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('locations').select('id, name, updated_at, created_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('scenes').select('id, scene_number, is_completed, estimated_duration_minutes, page_count, updated_at, created_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('shots').select('id, shot_number, is_completed, updated_at, created_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('ideas').select('id, title, updated_at, created_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('budget_items').select('estimated_amount, actual_amount, is_income').eq('project_id', params.id),
        supabase.from('production_schedule').select('*').eq('project_id', params.id).gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(5),
        supabase.from('project_members').select('id').eq('project_id', params.id),
        supabase.from('project_documents').select('id', { count: 'exact', head: true }).eq('project_id', params.id),
      ]);

      if (scripts.error) throw scripts.error;

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
      setGrowth({ characters: characters.data || [], locations: locations.data || [], scenes: scenesData, shots: shotsData, ideas: ideas.data || [] });

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
        // author_id references auth.users, so profiles are attached separately
        supabase
          .from('document_comments')
          .select('id, content, created_at, author_id')
          .eq('project_id', params.id)
          .eq('is_resolved', false)
          .order('created_at', { ascending: false })
          .limit(10)
          .then(async (res: { data: Record<string, any>[] | null; error: unknown }): Promise<{ data: any[] | null; error: unknown }> => ({
            ...res,
            data: res.data ? await attachProfiles(supabase, res.data, 'author_id', 'profiles', 'id, display_name') : null,
          })),
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
      console.error('Error fetching stats from Supabase, falling back to local cache:', err);
      try {
        const scripts = await getCachedByProject('scripts', params.id) as any[];
        const characters = await getCachedByProject('characters', params.id) as any[];
        const locations = await getCachedByProject('locations', params.id) as any[];
        const scenes = await getCachedByProject('scenes', params.id) as any[];
        const shots = await getCachedByProject('shots', params.id) as any[];
        const ideas = await getCachedByProject('ideas', params.id) as any[];
        const budget = await getCachedByProject('budget_items', params.id) as any[];
        const events = await getCachedByProject('production_schedule', params.id) as any[];
        const members = await getCachedByProject('project_members', params.id) as any[];

        let scriptLines = 0;
        for (const s of scripts) {
          try {
            const elts = await getCachedByScript(s.id);
            scriptLines += elts.length;
          } catch {}
        }

        const expenseItems = budget.filter((b: { is_income?: boolean }) => !b.is_income);
        const totalDurationMinutes = scenes.reduce((sum: number, s: { estimated_duration_minutes?: number }) => sum + (s.estimated_duration_minutes || 0), 0);
        const totalPageCount = scenes.reduce((sum: number, s: { page_count?: number }) => sum + (s.page_count || 0), 0);

        setStats({
          scripts: scripts.length,
          characters: characters.length,
          locations: locations.length,
          scenes: scenes.length,
          shots: shots.length,
          ideas: ideas.length,
          budgetTotal: expenseItems.reduce((sum: number, b: { estimated_amount?: number }) => sum + (b.estimated_amount || 0), 0),
          budgetSpent: expenseItems.reduce((sum: number, b: { actual_amount?: number }) => sum + (b.actual_amount || 0), 0),
          upcomingEvents: events.length,
          completedScenes: scenes.filter((s: { is_completed?: boolean }) => s.is_completed).length,
          completedShots: shots.filter((s: { is_completed?: boolean }) => s.is_completed).length,
          totalDurationMinutes,
          totalPageCount,
          members: members.length,
          documents: 0,
          scriptLines,
          comments: 0,
        });

        setRecentScripts(scripts.slice(0, 3));
        setUpcomingEvents(events.slice(0, 5));
        setGrowth({ characters, locations, scenes, shots, ideas });

        // Build activity timeline from offline cached records
        const activityItems: ActivityItem[] = [];
        scripts.slice(0, 5).forEach((s: { id: string; title: string; updated_at: string }) => {
          activityItems.push({ id: 'script-' + s.id, type: 'script', label: s.title, detail: 'Script updated (cached)', timestamp: s.updated_at, icon: 'script', color: '#6366f1' });
        });
        characters.slice(0, 5).forEach((c: { id: string; name: string; updated_at: string }) => {
          activityItems.push({ id: 'char-' + c.id, type: 'character', label: c.name, detail: 'Character updated (cached)', timestamp: c.updated_at, icon: 'character', color: '#ec4899' });
        });
        locations.slice(0, 5).forEach((l: { id: string; name: string; updated_at: string }) => {
          activityItems.push({ id: 'loc-' + l.id, type: 'location', label: l.name, detail: 'Location updated (cached)', timestamp: l.updated_at, icon: 'location', color: '#14b8a6' });
        });
        scenes.slice(0, 5).forEach((s: { id: string; scene_number?: string; is_completed?: boolean; updated_at: string }) => {
          activityItems.push({ id: 'scene-' + s.id, type: 'scene', label: 'Scene ' + (s.scene_number || ''), detail: s.is_completed ? 'Scene completed (cached)' : 'Scene updated (cached)', timestamp: s.updated_at, icon: 'scene', color: '#f59e0b' });
        });
        shots.slice(0, 5).forEach((s: { id: string; shot_number?: string; is_completed?: boolean; updated_at: string }) => {
          activityItems.push({ id: 'shot-' + s.id, type: 'shot', label: 'Shot ' + (s.shot_number || ''), detail: s.is_completed ? 'Shot completed (cached)' : 'Shot updated (cached)', timestamp: s.updated_at, icon: 'shot', color: '#3b82f6' });
        });
        ideas.slice(0, 5).forEach((i: { id: string; title: string; updated_at: string }) => {
          activityItems.push({ id: 'idea-' + i.id, type: 'idea', label: i.title, detail: 'Idea updated (cached)', timestamp: i.updated_at, icon: 'idea', color: '#a855f7' });
        });

        activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setActivity(activityItems.slice(0, 20));
        setStatsLoaded(true);
      } catch (cacheErr) {
        console.error('Failed to load stats from local cache:', cacheErr);
      }
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

  const pid = params.id;
  const go = (path: string) => () => router.push(`/projects/${pid}/${path}`);
  const runtimePct = targetMinutes > 0 ? (estimatedMinutes / targetMinutes) * 100 : 0;
  const scenePct = stats.scenes ? (stats.completedScenes / stats.scenes) * 100 : 0;
  const shotPct = stats.shots ? (stats.completedShots / stats.shots) * 100 : 0;
  const budgetPct = stats.budgetTotal ? (stats.budgetSpent / stats.budgetTotal) * 100 : 0;
  const routeMap: Record<string, string> = { script: 'script', character: 'characters', scene: 'scenes', shot: 'shots', location: 'locations', idea: 'ideas', document: 'documents', comment: 'comments', cast: 'ensemble', cue: 'cues' };
  const shownActivity = activityExpanded ? activity : activity.slice(0, 7);
  const tools = isAudioDrama
    ? [
        { href: 'sound-design', label: 'Sound Design', sub: 'SFX · music · ambience', icon: 'sound-design' },
        { href: 'voice-cast', label: 'Voice Cast', sub: `${stats.characters} characters`, icon: 'voice-cast' },
        { href: 'arc-planner', label: 'Arc Planner', sub: 'Story structure', icon: 'arc-planner' },
        { href: 'mindmap', label: 'Mind Map', sub: 'Character web', icon: 'mindmap' },
      ]
    : [
        { href: 'mindmap', label: 'Mind Map', sub: 'Character web', icon: 'mindmap' },
        { href: 'moodboard', label: 'Mood Board', sub: 'Visual references', icon: 'moodboard' },
        { href: 'corkboard', label: 'Corkboard', sub: `${stats.scenes} scenes`, icon: 'corkboard' },
        { href: 'arc-planner', label: 'Arc Planner', sub: 'Story structure', icon: 'arc-planner' },
      ];

  return (
    <div className="page-root">
      <RenameDialog
        isOpen={renamingProject}
        onClose={() => setRenamingProject(false)}
        title="Rename project"
        label="Project name"
        initialValue={currentProject.title}
        onSave={handleRenameProject}
      />
      <DeleteProjectDialog
        isOpen={deletingProject}
        onClose={() => setDeletingProject(false)}
        projectTitle={currentProject.title}
        onConfirm={handleDeleteProject}
      />
      <RenameDialog
        isOpen={!!scriptToRename}
        onClose={() => setScriptToRename(null)}
        title="Rename script"
        label="Script name"
        initialValue={scriptToRename?.title || ''}
        onSave={handleRenameScript}
      />
      <DeleteScriptDialog
        isOpen={!!scriptToDelete}
        onClose={() => setScriptToDelete(null)}
        scriptTitle={scriptToDelete?.title || ''}
        onConfirm={handleDeleteScript}
      />

      <AdminPage>
        {/* ── Hero ─────────────────────────────────── */}
        <Reveal className="relative overflow-hidden rounded-3xl border border-surface-800 bg-gradient-to-br from-surface-900 via-surface-900/80 to-brand-950/40 p-6 md:p-8">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          />
          <nav aria-label="Breadcrumb" className="relative mb-4 flex items-center gap-1.5 text-xs text-surface-500">
            <Link href="/dashboard" className="transition-colors hover:text-surface-300">Projects</Link>
            <span className="text-surface-700">/</span>
            <span className="font-medium text-surface-400">{currentProject.title}</span>
          </nav>
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-start gap-2">
                <h1 className="page-title min-w-0 break-words">{currentProject.title}</h1>
                <MoreMenu
                  alwaysVisible
                  align="left"
                  label="Project actions"
                  className="mt-1 shrink-0"
                  buttonClassName="bg-surface-800/60 hover:bg-surface-700"
                  items={[
                    { label: 'Rename project', icon: 'rename', onSelect: () => setRenamingProject(true) },
                    { label: 'Project settings', icon: 'settings', onSelect: () => router.push(`/projects/${pid}/settings`) },
                    {
                      label: 'Delete project', icon: 'delete', danger: true, onSelect: () => setDeletingProject(true),
                      disabledReason: currentProject.created_by === user?.id ? undefined : 'Only the creator can delete it',
                    },
                  ]}
                />
              </div>
              {currentProject.logline && <p className="page-subtitle mt-2 max-w-2xl">{currentProject.logline}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <Pill tone={STATUS_TONE[currentProject.status] ?? 'violet'} dot>{currentProject.status.replace(/_/g, ' ')}</Pill>
                <Pill tone="blue">{currentProject.format}</Pill>
                {currentProject.genre?.map((g: string) => <Pill key={g}>{g}</Pill>)}
                <span className="ml-1 text-[11px] text-surface-500">Created {timeAgo(currentProject.created_at)}</span>
              </div>
            </div>
            {estimatedMinutes > 0 && (
              <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-surface-800 bg-surface-950/40 px-5 py-4">
                <RuntimeRing pct={targetMinutes > 0 ? Math.min(100, runtimePct) : 100} over={runtimePct > 105} />
                <div>
                  <p className="text-2xl font-bold tracking-tight" style={{ color: 'rgb(var(--brand-400))' }}>{durationStr}</p>
                  <p className="text-[11px] uppercase tracking-wide text-surface-500">estimated runtime</p>
                  {targetMinutes > 0 && (
                    <p className={cn('mt-0.5 text-[11px]', runtimePct > 105 ? 'text-amber-400' : 'text-surface-500')}>
                      {Math.round(runtimePct)}% of the {targetStr} target{runtimePct > 105 ? ' — running long' : ''}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Reveal>

        {/* ── Welcome ─────────────────────────────── */}
        <AnimatePresence>
          {showWelcomeCard && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="relative overflow-hidden rounded-2xl border border-brand-500/25 bg-gradient-to-br from-brand-500/[0.07] to-surface-900/50 p-6"
            >
              <button
                onClick={() => { setIsWelcomeDismissed(true); localStorage.setItem(`project-onboarding-dismissed-${pid}`, 'true'); }}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-surface-500 transition-colors hover:bg-surface-800 hover:text-white"
                aria-label="Dismiss"
              >
                ✕
              </button>
              <h2 className="text-lg font-bold text-white">Welcome to your new project</h2>
              <p className="mb-4 text-sm text-surface-400">A few good first steps:</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { href: 'script', label: 'Write your script', icon: 'script' },
                  { href: 'characters', label: 'Add characters', icon: 'characters' },
                  { href: 'locations', label: 'Plan locations', icon: 'locations' },
                  { href: 'moodboard', label: 'Build a mood board', icon: 'moodboard' },
                ].map((step, i) => (
                  <motion.div key={step.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                    <Link href={`/projects/${pid}/${step.href}`} className="group flex flex-col items-center gap-2 rounded-xl border border-surface-800 bg-surface-900/60 p-4 transition-all hover:-translate-y-0.5 hover:border-brand-500/40">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400 [&>svg]:h-5 [&>svg]:w-5">{sidebarIcons[step.icon]}</span>
                      <span className="text-center text-sm font-semibold text-white">{step.label}</span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Numbers ─────────────────────────────── */}
        <StatGrid
          cols={5}
          items={[
            { label: 'Scripts', value: stats.scripts, tone: 'violet', onClick: go('script'), hint: 'Open the script editor' },
            { label: 'Characters', value: stats.characters, tone: 'pink', onClick: go('characters'), spark: growthSpark(growth.characters) },
            { label: 'Locations', value: stats.locations, tone: 'aqua', onClick: go('locations'), spark: growthSpark(growth.locations) },
            isAudioDrama
              ? { label: 'Episodes', value: stats.scenes, tone: 'amber', onClick: go('scenes') }
              : { label: 'Scenes', value: stats.scenes, tone: 'amber', onClick: go('scenes'), spark: growthSpark(growth.scenes) },
            isAudioDrama
              ? { label: 'Ideas', value: stats.ideas, tone: 'brand', onClick: go('ideas') }
              : { label: 'Shots', value: stats.shots, tone: 'blue', onClick: go('shots'), spark: growthSpark(growth.shots) },
            { label: 'Script lines', value: stats.scriptLines, tone: 'violet', onClick: go('script') },
            { label: 'Documents', value: stats.documents, tone: 'aqua', onClick: go('documents') },
            { label: 'Open comments', value: stats.comments, tone: 'brand', onClick: go('comments') },
            { label: 'Team', value: stats.members, tone: 'green', onClick: go('team') },
            { label: 'Upcoming events', value: stats.upcomingEvents, tone: 'red', onClick: go('schedule') },
          ]}
        />

        {/* ── Progress + runtime ──────────────────── */}
        <div className="grid gap-5 lg:grid-cols-3">
          <Panel title="Production progress" subtitle="How far along everything is">
            <div className="space-y-4">
              {[
                { label: isAudioDrama ? 'Episodes complete' : 'Scenes complete', done: stats.completedScenes, total: stats.scenes, pct: scenePct, color: '#22c55e' },
                ...(!isAudioDrama ? [{ label: 'Shots complete', done: stats.completedShots, total: stats.shots, pct: shotPct, color: SERIES.blue }] : []),
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-surface-300">{row.label}</span>
                    <span className="tabular-nums text-surface-400"><span className="font-semibold text-white">{row.done}</span> / {row.total} · {Math.round(row.pct)}%</span>
                  </div>
                  <Meter value={row.pct} color={row.color} />
                </div>
              ))}
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-surface-300">Budget used</span>
                  <span className="tabular-nums text-surface-400">{stats.budgetTotal > 0 ? `${Math.round(budgetPct)}%` : 'No budget yet'}</span>
                </div>
                <Meter value={budgetPct} color={budgetPct > 90 ? SERIES.red : SERIES.yellow} />
                {stats.budgetTotal > 0 && (
                  <p className="mt-1.5 flex justify-between text-[11px] text-surface-500">
                    <span>{formatCurrency(stats.budgetSpent)} of {formatCurrency(stats.budgetTotal)}</span>
                    <span className={cn('font-semibold', stats.budgetSpent > stats.budgetTotal ? 'text-red-400' : 'text-emerald-400')}>
                      {formatCurrency(stats.budgetTotal - stats.budgetSpent)} left
                    </span>
                  </p>
                )}
              </div>
            </div>
          </Panel>
          <WorkTimePanel projectId={pid} />
        </div>

        {/* ── Growth ──────────────────────────────── */}
        {(growth.characters.length + growth.locations.length + growth.scenes.length + growth.shots.length + growth.ideas.length) > 0 && (
          <TrendPanel
            id="project-growth"
            title="How the project has grown"
            subtitle="New characters, locations, scenes, shots and ideas over time"
            defaultRange="90d"
            stacked
            sources={[
              { key: 'characters', label: 'Characters', color: SERIES.magenta, rows: growth.characters, time: (r: { created_at?: string | null }) => r.created_at },
              { key: 'locations', label: 'Locations', color: SERIES.aqua, rows: growth.locations, time: (r: { created_at?: string | null }) => r.created_at },
              { key: 'scenes', label: isAudioDrama ? 'Episodes' : 'Scenes', color: SERIES.yellow, rows: growth.scenes, time: (r: { created_at?: string | null }) => r.created_at },
              ...(!isAudioDrama ? [{ key: 'shots', label: 'Shots', color: SERIES.blue, rows: growth.shots, time: (r: { created_at?: string | null }) => r.created_at }] : []),
              { key: 'ideas', label: 'Ideas', color: SERIES.violet, rows: growth.ideas, time: (r: { created_at?: string | null }) => r.created_at },
            ]}
          />
        )}

        {/* ── Activity / schedule / scripts ───────── */}
        <div className="grid gap-5 lg:grid-cols-3">
          <Panel
            title="Recent activity"
            subtitle="Latest changes across the project"
            className="lg:col-span-2"
            action={activity.length > 7 ? (
              <button onClick={() => setActivityExpanded((v) => !v)} className="text-[11px] font-semibold text-surface-400 hover:text-white">
                {activityExpanded ? 'Show less' : `Show all (${activity.length})`}
              </button>
            ) : null}
          >
            {activity.length === 0 ? (
              <p className="text-sm text-surface-500">Get started by creating a script, adding characters, or planning scenes.</p>
            ) : (
              <ol className="relative">
                <span className="absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-brand-500/40 to-transparent" aria-hidden />
                <AnimatePresence initial={false}>
                  {shownActivity.map((item, i) => (
                    <motion.li key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                      <Link href={`/projects/${pid}/${routeMap[item.type] || ''}`} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-800/40">
                        <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface-900 [&>svg]:h-3.5 [&>svg]:w-3.5" style={{ backgroundColor: item.color + '22', color: item.color }}>
                          {sidebarIcons[routeMap[item.type] || ''] ?? <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white group-hover:text-brand-300">{item.label}</span>
                          <span className="block text-[11px] text-surface-500">{item.detail}</span>
                        </span>
                        <span className="shrink-0 text-[11px] text-surface-500">{timeAgo(item.timestamp)}</span>
                      </Link>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            )}
          </Panel>

          <div className="space-y-5">
            <Panel title="Coming up" action={<Link href={`/projects/${pid}/schedule`} className="text-[11px] font-semibold text-brand-400 hover:text-brand-300">Schedule →</Link>}>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-surface-500">Nothing scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingEvents.map((event) => (
                    <li key={event.id} className="flex items-center gap-3">
                      <span className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-surface-800 bg-surface-950/60 py-1 leading-none">
                        <span className="text-[9px] uppercase text-surface-500">{new Date(event.start_time).toLocaleString('en', { month: 'short' })}</span>
                        <span className="text-base font-bold text-white">{new Date(event.start_time).getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{event.title}</span>
                        <span className="block text-[11px] capitalize text-surface-500">{event.event_type.replace(/_/g, ' ')} · {formatDate(event.start_time)}</span>
                      </span>
                      {event.is_confirmed && <Pill tone="green">confirmed</Pill>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Scripts" action={<Link href={`/projects/${pid}/script`} className="text-[11px] font-semibold text-brand-400 hover:text-brand-300">Editor →</Link>}>
              {recentScripts.length === 0 ? (
                <p className="text-sm text-surface-500">No scripts yet — create one in the editor.</p>
              ) : (
                <ul className="space-y-1">
                  {recentScripts.map((script) => (
                    <li key={script.id} className="group relative">
                      <Link href={`/projects/${pid}/script?script_id=${script.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 pr-10 transition-colors hover:bg-surface-800/40">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 [&>svg]:h-4 [&>svg]:w-4">{sidebarIcons.script}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white group-hover:text-brand-300">{script.title}</span>
                          <span className="block text-[11px] text-surface-500">v{script.version} · {timeAgo(script.updated_at)} · {script.revision_color}</span>
                        </span>
                      </Link>
                      <MoreMenu
                        className="absolute right-1 top-1/2 z-10 -translate-y-1/2"
                        buttonClassName="bg-transparent hover:bg-surface-800 text-surface-400"
                        label={`Actions for ${script.title}`}
                        items={[
                          { label: 'Open in editor', icon: 'open', onSelect: () => router.push(`/projects/${pid}/script?script_id=${script.id}`) },
                          { label: 'Rename', icon: 'rename', onSelect: () => setScriptToRename(script) },
                          { label: 'Delete script', icon: 'delete', danger: true, onSelect: () => setScriptToDelete(script) },
                        ]}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        {/* ── Tools + synopsis ────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-3">
          <Panel title={isAudioDrama ? 'Audio drama tools' : 'Creative tools'} className={currentProject.synopsis ? '' : 'lg:col-span-3'}>
            <div className={cn('grid gap-2.5', currentProject.synopsis ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4')}>
              {tools.map((tool, i) => (
                <motion.div key={tool.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
                  <Link href={`/projects/${pid}/${tool.href}`} className="group block rounded-xl border border-surface-800 bg-surface-950/40 p-4 transition-all hover:-translate-y-0.5 hover:border-surface-700 hover:shadow-lg hover:shadow-black/20">
                    <span className="mb-2.5 block text-brand-400 transition-transform group-hover:scale-110 [&>svg]:h-5 [&>svg]:w-5">{sidebarIcons[tool.icon]}</span>
                    <span className="block text-sm font-bold text-white">{tool.label}</span>
                    <span className="mt-0.5 block text-[11px] text-surface-500">{tool.sub}</span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </Panel>
          {currentProject.synopsis && (
            <Panel title="Synopsis" className="lg:col-span-2">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-surface-300">{currentProject.synopsis}</p>
            </Panel>
          )}
        </div>
      </AdminPage>
    </div>
  );
}

/** Daily counts of newly created items over the last 14 days. */
function growthSpark(rows: { created_at?: string | null }[]): number[] {
  const DAY = 86_400_000;
  const today = Math.floor(Date.now() / DAY);
  const out = new Array(14).fill(0);
  rows.forEach((r) => {
    if (!r.created_at) return;
    const d = today - Math.floor(Date.parse(r.created_at) / DAY);
    if (d >= 0 && d < 14) out[13 - d] += 1;
  });
  return out.some((v) => v > 0) ? out : [];
}

/** Circular progress toward the target runtime. */
function RuntimeRing({ pct, over = false }: { pct: number; over?: boolean }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" className="-rotate-90" aria-hidden>
      <circle cx={28} cy={28} r={r} fill="none" stroke="rgb(var(--surface-800))" strokeWidth={5} />
      <motion.circle
        cx={28}
        cy={28}
        r={r}
        fill="none"
        stroke={over ? '#f59e0b' : 'rgb(var(--brand-500))'}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct / 100) }}
        transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </svg>
  );
}
