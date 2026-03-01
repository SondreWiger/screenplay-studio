'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useProjectStore } from '@/lib/stores';
import { Card, Badge, LoadingSpinner, Button } from '@/components/ui';
import { formatWorkSeconds } from '@/hooks/useWorkTimeTracker';

// ============================================================
// Analytics Dashboard — Pro feature
// Computed from real project data: script_elements, scenes,
// characters, scripts, shots, comments, project_members
// ============================================================

type TimeRange = '7d' | '30d' | '90d' | 'all';

interface ProjectStats {
  totalWords: number;
  totalPages: number;
  totalScenes: number;
  completedScenes: number;
  totalCharacters: number;
  mainCharacters: number;
  castCharacters: number;
  totalShots: number;
  completedShots: number;
  totalComments: number;
  resolvedComments: number;
  teamMembers: number;
  scriptsCount: number;
  dialogueWords: number;
  actionWords: number;
  estimatedRuntime: number;
  locationsCount: number;
}

interface ScriptActivity {
  date: string;
  elementCount: number;
  wordCount: number;
}

interface MemberActivity {
  userId: string;
  name: string;
  avatar: string | null;
  role: string;
  elementsCreated: number;
  lastActive: string;
}

export default function AnalyticsPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { isPro } = useProFeatures();
  const { currentProject, members } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [scriptActivity, setScriptActivity] = useState<ScriptActivity[]>([]);
  const [memberActivity, setMemberActivity] = useState<MemberActivity[]>([]);
  const [elementTypeCounts, setElementTypeCounts] = useState<Record<string, number>>({});
  const [charDialogue, setCharDialogue] = useState<{ name: string; wordCount: number; lines: number }[]>([]);
  const [range, setRange] = useState<TimeRange>('30d');

  // Work time
  interface WorkTimeData {
    my_total_seconds: number;
    team_total_seconds: number;
    daily: { date: string; seconds: number }[];
    user_totals: Record<string, number>;
    context_breakdown: Record<string, number>;
  }
  const [workTime, setWorkTime] = useState<WorkTimeData | null>(null);

  useEffect(() => {
    fetch(`/api/work-session?projectId=${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: WorkTimeData | null) => setWorkTime(d))
      .catch(() => null);
  }, [params.id]);

  useEffect(() => { fetchAnalytics(); }, [params.id, range]);

  const fetchAnalytics = async () => {
    setLoading(true);
    const supabase = createClient();

    let sinceDate: string | null = null;
    if (range !== 'all') {
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      sinceDate = new Date(Date.now() - days * 86400000).toISOString();
    }

    const { data: scripts } = await supabase
      .from('scripts')
      .select('id, title, updated_at')
      .eq('project_id', params.id);

    const scriptIds = (scripts || []).map(s => s.id);

    const [elemRes, sceneRes, charRes, shotRes, commentRes, memberRes, locationRes] = await Promise.all([
      scriptIds.length > 0
        ? supabase
            .from('script_elements')
            .select('id, element_type, content, sort_order, created_at, created_by, last_edited_by')
            .in('script_id', scriptIds)
        : Promise.resolve({ data: [] }),
      supabase.from('scenes').select('id, is_completed, created_at').eq('project_id', params.id),
      supabase.from('characters').select('id, is_main, cast_actor, created_at').eq('project_id', params.id),
      supabase.from('shots').select('id, is_completed, created_at').eq('project_id', params.id),
      supabase.from('comments').select('id, is_resolved, created_at, user_id').eq('project_id', params.id),
      supabase.from('project_members')
        .select('id, user_id, role, created_at, profiles:user_id(full_name, display_name, avatar_url, email)')
        .eq('project_id', params.id),
      supabase.from('locations').select('id').eq('project_id', params.id),
    ]);

    type ScriptElementRow = { id: string; element_type: string; content: string; sort_order: number; created_at: string; created_by: string; last_edited_by: string };
    const elements = (elemRes.data || []) as ScriptElementRow[];
    const scenes = (sceneRes.data || []) as { id: string; is_completed: boolean; created_at: string }[];
    const characters = (charRes.data || []) as { id: string; is_main: boolean; cast_actor: string | null; created_at: string }[];
    const shots = (shotRes.data || []) as { id: string; is_completed: boolean; created_at: string }[];
    const comments = (commentRes.data || []) as { id: string; is_resolved: boolean; created_at: string; user_id: string }[];
    const teamMembers = (memberRes.data || []) as { id: string; user_id: string; role: string; created_at: string; profiles?: { full_name?: string; display_name?: string; avatar_url?: string; email?: string } }[];
    const locations = (locationRes.data || []) as { id: string }[];

    const filterByDate = <T extends { created_at: string }>(items: T[]): T[] => {
      if (!sinceDate) return items;
      return items.filter(i => i.created_at && i.created_at >= sinceDate);
    };

    const filteredElements = filterByDate(elements);

    let totalWords = 0, dialogueWords = 0, actionWords = 0;
    const typeCounts: Record<string, number> = {};

    for (const el of elements) {
      const words = (el.content || '').trim().split(/\s+/).filter(Boolean).length;
      totalWords += words;
      typeCounts[el.element_type] = (typeCounts[el.element_type] || 0) + 1;
      if (el.element_type === 'dialogue' || el.element_type === 'parenthetical') {
        dialogueWords += words;
      } else if (el.element_type === 'action') {
        actionWords += words;
      }
    }

    const totalPages = Math.round((elements.length / 56) * 10) / 10;

    setStats({
      totalWords,
      totalPages,
      totalScenes: scenes.length,
      completedScenes: scenes.filter((s) => s.is_completed).length,
      totalCharacters: characters.length,
      mainCharacters: characters.filter((c) => c.is_main).length,
      castCharacters: characters.filter((c) => c.cast_actor).length,
      totalShots: shots.length,
      completedShots: shots.filter((s) => s.is_completed).length,
      totalComments: comments.length,
      resolvedComments: comments.filter((c) => c.is_resolved).length,
      teamMembers: teamMembers.length,
      scriptsCount: scriptIds.length,
      dialogueWords,
      actionWords,
      estimatedRuntime: Math.round(totalPages),
      locationsCount: locations.length,
    });

    setElementTypeCounts(typeCounts);

    // ── Character dialogue stats ─────────────────────────────
    const sortedElements = [...elements].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const charWordMap = new Map<string, { wordCount: number; lines: number }>();
    let currentSpeaker: string | null = null;
    for (const el of sortedElements) {
      if (el.element_type === 'scene_heading') {
        currentSpeaker = null;
      } else if (el.element_type === 'character') {
        // Normalize: strip extensions like (V.O.) (O.S.) (CONT'D)
        currentSpeaker = (el.content || '').replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase();
        if (!currentSpeaker) currentSpeaker = null;
      } else if (el.element_type === 'dialogue' && currentSpeaker) {
        const words = (el.content || '').trim().split(/\s+/).filter(Boolean).length;
        const existing = charWordMap.get(currentSpeaker) || { wordCount: 0, lines: 0 };
        existing.wordCount += words;
        existing.lines += 1;
        charWordMap.set(currentSpeaker, existing);
      } else if (el.element_type === 'action') {
        currentSpeaker = null;
      }
    }
    setCharDialogue(
      Array.from(charWordMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.wordCount - a.wordCount)
        .slice(0, 15),
    );
    // ──────────────────────────────────────────────────────────

    const dayMap = new Map<string, { count: number; words: number }>();
    for (const el of filteredElements) {
      if (!el.created_at) continue;
      const day = el.created_at.split('T')[0];
      const existing = dayMap.get(day) || { count: 0, words: 0 };
      existing.count += 1;
      existing.words += (el.content || '').trim().split(/\s+/).filter(Boolean).length;
      dayMap.set(day, existing);
    }

    setScriptActivity(
      Array.from(dayMap.entries())
        .map(([date, data]) => ({ date, elementCount: data.count, wordCount: data.words }))
        .sort((a, b) => a.date.localeCompare(b.date))
    );

    const memberMap = new Map<string, { count: number; lastActive: string }>();
    for (const el of filteredElements) {
      const uid = el.last_edited_by || el.created_by;
      if (!uid) continue;
      const existing = memberMap.get(uid) || { count: 0, lastActive: '' };
      existing.count += 1;
      if (el.created_at > existing.lastActive) existing.lastActive = el.created_at;
      memberMap.set(uid, existing);
    }
    for (const c of comments) {
      if (!c.user_id) continue;
      const existing = memberMap.get(c.user_id) || { count: 0, lastActive: '' };
      existing.count += 1;
      if (c.created_at > existing.lastActive) existing.lastActive = c.created_at;
      memberMap.set(c.user_id, existing);
    }

    setMemberActivity(
      Array.from(memberMap.entries())
        .map(([userId, data]) => {
          const member = teamMembers.find((m) => m.user_id === userId);
          const profile = member?.profiles;
          return {
            userId,
            name: profile?.full_name || profile?.display_name || profile?.email || 'Unknown',
            avatar: profile?.avatar_url || null,
            role: member?.role || 'contributor',
            elementsCreated: data.count,
            lastActive: data.lastActive,
          };
        })
        .sort((a, b) => b.elementsCreated - a.elementsCreated)
    );

    setLoading(false);
  };

  const maxActivity = Math.max(...scriptActivity.map(a => a.elementCount), 1);

  const hasProAccess = isPro || currentProject?.pro_enabled === true;

  if (!hasProAccess) return (
    <div className="p-3 sm:p-4 md:p-8 max-w-6xl">
      <Card className="p-8 text-center">
        <Badge variant="warning" className="mb-3">Pro Feature</Badge>
        <h2 className="text-xl font-black text-white mb-2">Analytics Dashboard</h2>
        <p className="text-surface-400 mb-4">Unlock real project metrics, script activity tracking, and team contribution analytics.</p>
        <a href="/pro" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E54E15] text-white text-sm font-medium hover:bg-[#FF5F1F] transition-colors">Upgrade to Pro</a>
      </Card>
    </div>
  );

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-white">Analytics</h1>
            <Badge variant="warning">Pro</Badge>
          </div>
          <p className="text-sm text-surface-400 mt-1">Real project metrics computed from your actual data.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchAnalytics}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </Button>
          <div className="flex items-center gap-1 bg-surface-800/50 rounded-lg p-0.5">
            {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  range === r ? 'bg-[#FF5F1F] text-white' : 'text-surface-400 hover:text-white'
                }`}
              >
                {r === 'all' ? 'All' : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner className="py-32" /> : stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Words', value: stats.totalWords.toLocaleString(), sub: `${stats.totalPages} pages`, color: 'text-white' },
              { label: 'Est. Runtime', value: `${stats.estimatedRuntime} min`, sub: '1 page ≈ 1 minute', color: 'text-amber-400' },
              { label: 'Scenes', value: `${stats.completedScenes}/${stats.totalScenes}`, sub: 'completed', color: 'text-green-400' },
              { label: 'Shots', value: `${stats.completedShots}/${stats.totalShots}`, sub: 'completed', color: 'text-blue-400' },
            ].map(s => (
              <Card key={s.label} className="p-4">
                <p className="text-xs text-surface-500 font-medium mb-1">{s.label}</p>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-surface-500">{s.sub}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Characters', value: stats.totalCharacters, sub: `${stats.mainCharacters} main, ${stats.castCharacters} cast` },
              { label: 'Locations', value: stats.locationsCount, sub: 'unique locations' },
              { label: 'Team', value: stats.teamMembers, sub: 'project members' },
              { label: 'Comments', value: stats.totalComments, sub: `${stats.resolvedComments} resolved` },
              { label: 'Scripts', value: stats.scriptsCount, sub: 'in project' },
            ].map(s => (
              <Card key={s.label} className="p-3">
                <p className="text-xs text-surface-500 font-medium">{s.label}</p>
                <p className="text-xl font-black text-white">{s.value}</p>
                <p className="text-[10px] text-surface-500">{s.sub}</p>
              </Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Writing Activity</h3>
                {scriptActivity.length > 0 ? (
                  <>
                    <div className="flex items-end gap-1 h-32">
                      {scriptActivity.slice(-60).map(({ date, elementCount }) => (
                        <div key={date} className="flex-1 flex flex-col items-center group relative">
                          <div
                            className="w-full bg-[#FF5F1F]/60 hover:bg-[#FF5F1F] rounded-t transition-colors min-h-[2px]"
                            style={{ height: `${(elementCount / maxActivity) * 100}%` }}
                          />
                          <div className="absolute -top-8 hidden group-hover:block bg-surface-800 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-10">
                            {date.slice(5)}: {elementCount} elements
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-surface-600 mt-2 text-center">Elements created/edited per day</p>
                  </>
                ) : (
                  <p className="text-sm text-surface-500 text-center py-8">No writing activity in this period.</p>
                )}
              </Card>
            </div>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Content Breakdown</h3>
              <div className="space-y-4">
                {[
                  { label: 'Dialogue', words: stats.dialogueWords, color: 'bg-amber-500', textColor: 'text-amber-400' },
                  { label: 'Action', words: stats.actionWords, color: 'bg-blue-500', textColor: 'text-blue-400' },
                  { label: 'Other', words: stats.totalWords - stats.dialogueWords - stats.actionWords, color: 'bg-surface-600', textColor: 'text-surface-400' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={item.textColor}>{item.label}</span>
                      <span className="text-surface-400">{item.words.toLocaleString()} words</span>
                    </div>
                    <div className="h-2.5 bg-surface-800 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${stats.totalWords > 0 ? (item.words / stats.totalWords) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Element Types</h3>
              {Object.keys(elementTypeCounts).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(elementTypeCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => {
                      const maxCount = Math.max(...Object.values(elementTypeCounts));
                      return (
                        <div key={type}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="text-surface-300 capitalize">{type.replace(/_/g, ' ')}</span>
                            <span className="text-surface-500">{count}</span>
                          </div>
                          <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                            <div className="h-full bg-[#FF5F1F]/60 rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-xs text-surface-500">No script elements yet.</p>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Production Progress</h3>
              <div className="space-y-5">
                {[
                  { label: 'Scenes Completed', value: stats.completedScenes, max: stats.totalScenes, color: 'bg-green-500' },
                  { label: 'Shots Completed', value: stats.completedShots, max: stats.totalShots, color: 'bg-blue-500' },
                  { label: 'Characters Cast', value: stats.castCharacters, max: stats.totalCharacters, color: 'bg-amber-500' },
                  { label: 'Comments Resolved', value: stats.resolvedComments, max: stats.totalComments, color: 'bg-purple-500' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-surface-300">{item.label}</span>
                      <span className="text-surface-400">{item.value}/{item.max}</span>
                    </div>
                    <div className="h-2.5 bg-surface-800 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${item.max > 0 ? (item.value / item.max) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ── Working Time ─────────────────────────────────── */}
          {workTime && (workTime.my_total_seconds > 0 || workTime.team_total_seconds > 0) && (
            <Card className="p-5 mb-6">
              <h3 className="text-sm font-semibold text-white mb-4">Working Time</h3>

              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {[
                  { label: 'My total', value: formatWorkSeconds(workTime.my_total_seconds), sub: `${(workTime.my_total_seconds / 3600).toFixed(2)} hrs exact` },
                  { label: 'Team total', value: formatWorkSeconds(workTime.team_total_seconds), sub: `${Object.keys(workTime.user_totals).length} contributor${Object.keys(workTime.user_totals).length !== 1 ? 's' : ''}` },
                  { label: 'Avg / day', value: formatWorkSeconds(Math.round((workTime.daily.filter(d => d.seconds > 0).reduce((s, d) => s + d.seconds, 0)) / Math.max(workTime.daily.filter(d => d.seconds > 0).length, 1))), sub: 'on active days' },
                  { label: 'Active days', value: String(workTime.daily.filter(d => d.seconds > 0).length), sub: 'of last 30 days' },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-lg bg-surface-800/40">
                    <p className="text-[10px] text-surface-500 uppercase tracking-wider">{item.label}</p>
                    <p className="text-xl font-black text-white mt-0.5">{item.value}</p>
                    <p className="text-[10px] text-surface-500">{item.sub}</p>
                  </div>
                ))}
              </div>

              {/* 30-day bar chart */}
              {workTime.daily.some(d => d.seconds > 0) && (() => {
                const maxSecs = Math.max(...workTime.daily.map(d => d.seconds), 1);
                return (
                  <div className="mb-5">
                    <p className="text-[11px] text-surface-500 mb-2">Daily hours — last 30 days</p>
                    <div className="flex items-end gap-0.5 h-20">
                      {workTime.daily.map(({ date, seconds }) => (
                        <div key={date} className="flex-1 flex flex-col items-center group relative">
                          <div
                            className="w-full bg-indigo-500/60 hover:bg-indigo-500 rounded-t transition-colors min-h-[2px]"
                            style={{ height: `${(seconds / maxSecs) * 100}%` }}
                          />
                          {seconds > 0 && (
                            <div className="absolute -top-8 hidden group-hover:block bg-surface-800 border border-surface-700 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-10 pointer-events-none">
                              {date.slice(5)}: {formatWorkSeconds(seconds)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-surface-600 mt-1">
                      <span>{workTime.daily[0]?.date.slice(5)}</span>
                      <span>{workTime.daily[workTime.daily.length - 1]?.date.slice(5)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Context breakdown */}
              {Object.keys(workTime.context_breakdown).length > 0 && (
                <div>
                  <p className="text-[11px] text-surface-500 uppercase tracking-wider mb-2">Time by area</p>
                  <div className="space-y-2">
                    {Object.entries(workTime.context_breakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([ctx, secs]) => {
                        const ctxColour: Record<string, string> = {
                          script: '#6366f1',
                          documents: '#22d3ee',
                          'arc-planner': '#a855f7',
                          general: '#6b7280',
                        };
                        return (
                          <div key={ctx}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="text-surface-300 capitalize">{ctx.replace(/-/g, ' ')}</span>
                              <span className="text-surface-400">{formatWorkSeconds(secs)}</span>
                            </div>
                            <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  backgroundColor: ctxColour[ctx] ?? '#6366f1',
                                  width: `${workTime.my_total_seconds > 0 ? (secs / workTime.my_total_seconds) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Character Dialogue Stats */}
          {charDialogue.length > 0 && (() => {
            const maxWords = charDialogue[0]?.wordCount || 1;
            const totalDialogueWords = charDialogue.reduce((a, c) => a + c.wordCount, 0) || 1;
            const BAR_COLORS = ['#6366f1','#ec4899','#f97316','#22c55e','#14b8a6','#3b82f6','#a855f7','#eab308','#ef4444','#10b981'];
            return (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Character Dialogue</h3>
                  <span className="text-xs text-surface-500">{charDialogue.length} speaking roles</span>
                </div>
                <div className="space-y-2.5">
                  {charDialogue.map((c, i) => {
                    const pct = (c.wordCount / totalDialogueWords) * 100;
                    const color = BAR_COLORS[i % BAR_COLORS.length];
                    return (
                      <div key={c.name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: color, opacity: 0.7 }} />
                            <span className="text-surface-200 font-medium truncate">{c.name}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2 text-surface-400">
                            <span>{c.wordCount.toLocaleString()} words</span>
                            <span>{c.lines} {c.lines === 1 ? 'line' : 'lines'}</span>
                            <span className="text-surface-300 font-medium w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${(c.wordCount / maxWords) * 100}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })()}

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Team Activity</h3>
            {memberActivity.length > 0 ? (
              <div className="space-y-3">
                {memberActivity.map((m) => (
                  <div key={m.userId} className="flex items-center gap-4 p-3 rounded-lg bg-surface-800/30 hover:bg-surface-800/50 transition-colors">
                    {m.avatar ? (
                      <img src={m.avatar} alt={m.name || 'Team member avatar'} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface-700 flex items-center justify-center text-xs font-semibold text-white">
                        {m.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{m.name}</p>
                      <p className="text-xs text-surface-500 capitalize">{m.role}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-white">{m.elementsCreated} contributions</p>
                      {workTime?.user_totals?.[m.userId] && (
                        <p className="text-xs text-indigo-400 font-medium">
                          ⏱ {formatWorkSeconds(workTime.user_totals[m.userId])}
                        </p>
                      )}
                      {m.lastActive && (
                        <p className="text-xs text-surface-500">
                          Last: {new Date(m.lastActive).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-500 text-center py-8">
                No team activity recorded yet.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
