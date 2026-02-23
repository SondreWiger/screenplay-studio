'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/lib/stores';
import { Card, Badge, Progress, Button, LoadingPage } from '@/components/ui';
import { formatDate, formatCurrency, timeAgo } from '@/lib/utils';
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
      const [scripts, characters, locations, scenes, shots, ideas, budget, events, members] = await Promise.all([
        supabase.from('scripts').select('*').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('characters').select('id, name, updated_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('locations').select('id, name, updated_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('scenes').select('id, scene_number, is_completed, estimated_duration_minutes, page_count, updated_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('shots').select('id, shot_number, is_completed, updated_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('ideas').select('id, title, updated_at').eq('project_id', params.id).order('updated_at', { ascending: false }),
        supabase.from('budget_items').select('estimated_amount, actual_amount').eq('project_id', params.id),
        supabase.from('production_schedule').select('*').eq('project_id', params.id).gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(5),
        supabase.from('project_members').select('id').eq('project_id', params.id),
      ]);

      const budgetData = budget.data || [];
      const scenesData = scenes.data || [];
      const shotsData = shots.data || [];

      // Calculate estimated duration from scenes
      const totalDurationMinutes = scenesData.reduce((sum: number, s: any) => sum + (s.estimated_duration_minutes || 0), 0);
      const totalPageCount = scenesData.reduce((sum: number, s: any) => sum + (s.page_count || 0), 0);

      setStats({
        scripts: scripts.data?.length || 0,
        characters: characters.data?.length || 0,
        locations: locations.data?.length || 0,
        scenes: scenesData.length,
        shots: shotsData.length,
        ideas: ideas.data?.length || 0,
        budgetTotal: budgetData.reduce((sum: number, b: any) => sum + (b.estimated_amount || 0), 0),
        budgetSpent: budgetData.reduce((sum: number, b: any) => sum + (b.actual_amount || 0), 0),
        upcomingEvents: events.data?.length || 0,
        completedScenes: scenesData.filter((s: any) => s.is_completed).length,
        completedShots: shotsData.filter((s: any) => s.is_completed).length,
        totalDurationMinutes,
        totalPageCount,
        members: members.data?.length || 0,
      });
      setRecentScripts((scripts.data || []).slice(0, 3));
      setUpcomingEvents((events.data || []).slice(0, 5));

      // Build activity timeline from recent changes across all tables
      const activityItems: ActivityItem[] = [];

      (scripts.data || []).slice(0, 5).forEach((s: any) => {
        activityItems.push({ id: 'script-' + s.id, type: 'script', label: s.title, detail: 'Script updated', timestamp: s.updated_at, icon: 'script', color: '#6366f1' });
      });
      (characters.data || []).slice(0, 5).forEach((c: any) => {
        activityItems.push({ id: 'char-' + c.id, type: 'character', label: c.name, detail: 'Character updated', timestamp: c.updated_at, icon: 'character', color: '#ec4899' });
      });
      (locations.data || []).slice(0, 5).forEach((l: any) => {
        activityItems.push({ id: 'loc-' + l.id, type: 'location', label: l.name, detail: 'Location updated', timestamp: l.updated_at, icon: 'location', color: '#14b8a6' });
      });
      scenesData.slice(0, 5).forEach((s: any) => {
        activityItems.push({ id: 'scene-' + s.id, type: 'scene', label: 'Scene ' + (s.scene_number || ''), detail: s.is_completed ? 'Scene completed' : 'Scene updated', timestamp: s.updated_at, icon: 'scene', color: '#f59e0b' });
      });
      shotsData.slice(0, 5).forEach((s: any) => {
        activityItems.push({ id: 'shot-' + s.id, type: 'shot', label: 'Shot ' + (s.shot_number || ''), detail: s.is_completed ? 'Shot completed' : 'Shot updated', timestamp: s.updated_at, icon: 'shot', color: '#3b82f6' });
      });
      (ideas.data || []).slice(0, 5).forEach((i: any) => {
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
  const estimatedMinutes = stats.totalDurationMinutes || Math.round(stats.totalPageCount * 1); // ~1 min per page industry standard
  const targetMinutes = currentProject.target_length_minutes || 0;
  const durationHours = Math.floor(estimatedMinutes / 60);
  const durationMins = estimatedMinutes % 60;
  const durationStr = durationHours > 0 ? durationHours + 'h ' + durationMins + 'm' : durationMins + ' min';
  const targetStr = targetMinutes > 0 ? (Math.floor(targetMinutes / 60) > 0 ? Math.floor(targetMinutes / 60) + 'h ' + (targetMinutes % 60) + 'm' : targetMinutes + ' min') : '';

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{currentProject.title}</h1>
            {currentProject.logline && (
              <p className="mt-2 text-surface-400 max-w-2xl">{currentProject.logline}</p>
            )}
            <div className="flex items-center gap-3 mt-4">
              <Badge variant="info">{currentProject.format}</Badge>
              {currentProject.genre?.map((g: string) => (
                <Badge key={g}>{g}</Badge>
              ))}
            </div>
          </div>
          <Badge
            variant={
              currentProject.status === 'production' ? 'success' :
              currentProject.status === 'completed' ? 'success' : 'info'
            }
            size="md"
          >
            {currentProject.status.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      {/* Quick Stats + Duration */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8 stagger-children">
        {[
          { label: 'Scripts', value: stats.scripts, href: 'script', color: '#6366f1' },
          { label: 'Characters', value: stats.characters, href: 'characters', color: '#ec4899' },
          { label: 'Mind Map', value: '→', href: 'mindmap', color: '#f97316' },
          { label: 'Locations', value: stats.locations, href: 'locations', color: '#14b8a6' },
          { label: 'Scenes', value: stats.scenes, href: 'scenes', color: '#f59e0b' },
          { label: 'Shots', value: stats.shots, href: 'shots', color: '#3b82f6' },
          { label: 'Ideas', value: stats.ideas, href: 'ideas', color: '#a855f7' },
        ].map((stat) => (
          <Link key={stat.label} href={'/projects/' + params.id + '/' + stat.href}>
            <Card hover className="p-4 text-center">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-surface-500 mt-1">{stat.label}</p>
              <div className="mt-2 h-0.5 rounded-full" style={{ backgroundColor: stat.color, opacity: 0.3 }}>
                <div className="h-full rounded-full" style={{ backgroundColor: stat.color, width: '100%' }} />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Duration Estimate Card */}
      {(estimatedMinutes > 0 || targetMinutes > 0) && (
        <Card className="p-6 mb-8 border-brand-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Estimated Runtime</h3>
                <p className="text-sm text-surface-400">
                  {stats.totalDurationMinutes > 0
                    ? 'Based on scene durations'
                    : stats.totalPageCount > 0
                    ? 'Based on page count (~1 min/page)'
                    : 'Add scene durations or page counts to estimate'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">{estimatedMinutes > 0 ? durationStr : '\u2014'}</p>
              {targetMinutes > 0 && (
                <p className="text-sm mt-1">
                  <span className="text-surface-400">Target: {targetStr}</span>
                  {estimatedMinutes > 0 && (
                    <span className={estimatedMinutes > targetMinutes * 1.1 ? ' text-red-400 ml-2' : estimatedMinutes < targetMinutes * 0.9 ? ' text-yellow-400 ml-2' : ' text-green-400 ml-2'}>
                      ({estimatedMinutes > targetMinutes ? '+' : ''}{estimatedMinutes - targetMinutes} min)
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          {targetMinutes > 0 && estimatedMinutes > 0 && (
            <div className="mt-4">
              <Progress
                label=""
                value={Math.min(estimatedMinutes, targetMinutes)}
                max={targetMinutes}
                color={estimatedMinutes > targetMinutes * 1.1 ? '#ef4444' : estimatedMinutes < targetMinutes * 0.9 ? '#f59e0b' : '#22c55e'}
              />
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production Progress */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Production Progress</h3>
          <div className="space-y-5">
            <Progress
              label="Scenes Completed"
              value={stats.completedScenes}
              max={Math.max(stats.scenes, 1)}
              color="#22c55e"
            />
            <Progress
              label="Shots Completed"
              value={stats.completedShots}
              max={Math.max(stats.shots, 1)}
              color="#3b82f6"
            />
            <Progress
              label="Budget Used"
              value={stats.budgetSpent}
              max={Math.max(stats.budgetTotal, 1)}
              color={stats.budgetSpent > stats.budgetTotal * 0.9 ? '#ef4444' : '#f59e0b'}
            />
          </div>

          {stats.budgetTotal > 0 && (
            <div className="mt-6 pt-4 border-t border-surface-800 flex justify-between text-sm">
              <span className="text-surface-400">Budget: {formatCurrency(stats.budgetSpent)} / {formatCurrency(stats.budgetTotal)}</span>
              <span className={stats.budgetSpent > stats.budgetTotal ? 'text-red-400' : 'text-green-400'}>
                {formatCurrency(stats.budgetTotal - stats.budgetSpent)} remaining
              </span>
            </div>
          )}
        </Card>

        {/* Activity Timeline */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Recent Activity</h3>
          {activity.length === 0 ? (
            <p className="text-sm text-surface-500">No activity yet. Start by adding scripts, characters, or scenes.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-2 bottom-2 w-px bg-surface-800" />
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 relative">
                    <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center z-10" style={{ backgroundColor: item.color + '20' }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{item.label}</p>
                        <Badge size="sm">{item.type}</Badge>
                      </div>
                      <p className="text-xs text-surface-500 mt-0.5">{item.detail} \u00B7 {timeAgo(item.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Upcoming Schedule */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Upcoming Schedule</h3>
            <Link href={'/projects/' + params.id + '/schedule'}>
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-surface-500">No upcoming events scheduled</p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-800/50">
                  <div
                    className="w-1 h-10 rounded-full shrink-0"
                    style={{ backgroundColor: event.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{event.title}</p>
                    <p className="text-xs text-surface-500">
                      {formatDate(event.start_time)} &bull; {event.event_type.replace('_', ' ')}
                    </p>
                  </div>
                  {event.is_confirmed && <Badge variant="success" size="sm">Confirmed</Badge>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Scripts */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Scripts</h3>
            <Link href={'/projects/' + params.id + '/script'}>
              <Button variant="ghost" size="sm">Open Editor</Button>
            </Link>
          </div>
          {recentScripts.length === 0 ? (
            <p className="text-sm text-surface-500">No scripts yet</p>
          ) : (
            <div className="space-y-3">
              {recentScripts.map((script) => (
                <Link key={script.id} href={'/projects/' + params.id + '/script'}>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-800/50 hover:bg-surface-800 transition-colors cursor-pointer">
                    <svg className="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{script.title}</p>
                      <p className="text-xs text-surface-500">v{script.version} &bull; {formatDate(script.updated_at)}</p>
                    </div>
                    <Badge size="sm">{script.revision_color}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Creative Tools Integration */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Creative Tools</h3>
          <p className="text-xs text-surface-500 mb-4">Your project's creative workspace — everything connected.</p>
          <div className="grid grid-cols-2 gap-3">
            <Link href={'/projects/' + params.id + '/mindmap'}>
              <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-all group cursor-pointer">
                <svg className="w-6 h-6 text-orange-400 mb-2 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="5" r="2.5" strokeWidth={1.5}/><circle cx="5" cy="18" r="2.5" strokeWidth={1.5}/><circle cx="19" cy="18" r="2.5" strokeWidth={1.5}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7.5v3m0 0l-5.5 5m5.5-5l5.5 5"/></svg>
                <p className="text-sm font-medium text-white">Mind Map</p>
                <p className="text-[11px] text-surface-500 mt-0.5">Character relationships</p>
              </div>
            </Link>
            <Link href={'/projects/' + params.id + '/moodboard'}>
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all group cursor-pointer">
                <svg className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zm10-2a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" /></svg>
                <p className="text-sm font-medium text-white">Mood Board</p>
                <p className="text-[11px] text-surface-500 mt-0.5">Visual references & palette</p>
              </div>
            </Link>
            <Link href={'/projects/' + params.id + '/characters'}>
              <div className="p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 hover:border-pink-500/40 transition-all group cursor-pointer">
                <svg className="w-6 h-6 text-pink-400 mb-2 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <p className="text-sm font-medium text-white">Characters</p>
                <p className="text-[11px] text-surface-500 mt-0.5">{stats.characters} cast members</p>
              </div>
            </Link>
            <Link href={'/projects/' + params.id + '/ideas'}>
              <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 hover:border-yellow-500/40 transition-all group cursor-pointer">
                <svg className="w-6 h-6 text-yellow-400 mb-2 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                <p className="text-sm font-medium text-white">Ideas</p>
                <p className="text-[11px] text-surface-500 mt-0.5">{stats.ideas} ideas & inspirations</p>
              </div>
            </Link>
          </div>
        </Card>

        {/* Synopsis */}
        {currentProject.synopsis && (
          <Card className="p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-white mb-4">Synopsis</h3>
            <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-wrap">
              {currentProject.synopsis}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
