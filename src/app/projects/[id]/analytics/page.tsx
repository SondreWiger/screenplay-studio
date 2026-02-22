'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useProjectStore } from '@/lib/stores';
import { Card, Badge, LoadingSpinner } from '@/components/ui';
import type { ProjectAnalyticsEvent, Profile } from '@/lib/types';

// ============================================================
// Team Analytics Dashboard — Pro feature
// Real-time activity tracking, writing velocity, team productivity
// ============================================================

type TimeRange = '7d' | '30d' | '90d' | 'all';

interface MemberStats {
  userId: string;
  name: string;
  avatar: string | null;
  totalEvents: number;
  wordCountDelta: number;
  lastActive: string;
  pageBreakdown: Record<string, number>;
}

export default function AnalyticsPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { isPro, hasAnalyticsDashboard } = useProFeatures();
  const { currentProject, members } = useProjectStore();
  const [events, setEvents] = useState<ProjectAnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>('30d');

  useEffect(() => { fetchAnalytics(); }, [params.id, range]);

  const fetchAnalytics = async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from('project_analytics')
      .select('*')
      .eq('project_id', params.id)
      .order('created_at', { ascending: false });

    if (range !== 'all') {
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      query = query.gte('created_at', since);
    }

    const { data } = await query.limit(2000);
    setEvents(data || []);
    setLoading(false);
  };

  // Compute stats
  const memberStats = useMemo(() => {
    const statsMap = new Map<string, MemberStats>();

    events.forEach(ev => {
      if (!ev.user_id) return;
      if (!statsMap.has(ev.user_id)) {
        const member = members.find((m: any) => m.user_id === ev.user_id);
        const profile = (member as any)?.profile as Profile | undefined;
        statsMap.set(ev.user_id, {
          userId: ev.user_id,
          name: profile?.full_name || profile?.email || 'Unknown',
          avatar: profile?.avatar_url || null,
          totalEvents: 0,
          wordCountDelta: 0,
          lastActive: ev.created_at,
          pageBreakdown: {},
        });
      }
      const s = statsMap.get(ev.user_id)!;
      s.totalEvents++;
      s.wordCountDelta += ev.word_count_delta || 0;
      if (ev.page) s.pageBreakdown[ev.page] = (s.pageBreakdown[ev.page] || 0) + 1;
      if (ev.created_at > s.lastActive) s.lastActive = ev.created_at;
    });

    return Array.from(statsMap.values()).sort((a, b) => b.totalEvents - a.totalEvents);
  }, [events, members]);

  const totalWords = events.reduce((sum, e) => sum + (e.word_count_delta || 0), 0);
  const totalEdits = events.filter(e => e.event_type === 'page_edit').length;
  const totalExports = events.filter(e => e.event_type === 'export').length;

  // Activity by day
  const activityByDay = useMemo(() => {
    const days = new Map<string, number>();
    events.forEach(ev => {
      const day = ev.created_at.split('T')[0];
      days.set(day, (days.get(day) || 0) + 1);
    });
    return Array.from(days.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30);
  }, [events]);

  const maxDayActivity = Math.max(...activityByDay.map(([, c]) => c), 1);

  // Event type breakdown
  const eventTypes = useMemo(() => {
    const types = new Map<string, number>();
    events.forEach(ev => {
      types.set(ev.event_type, (types.get(ev.event_type) || 0) + 1);
    });
    return Array.from(types.entries()).sort(([, a], [, b]) => b - a);
  }, [events]);

  if (!hasAnalyticsDashboard || !isPro) return null;

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Analytics</h1>
            <Badge variant="warning">⭐ Pro</Badge>
          </div>
          <p className="text-sm text-surface-400 mt-1">Team activity, writing velocity, and production progress.</p>
        </div>
        <div className="flex items-center gap-1 bg-surface-800/50 rounded-lg p-0.5">
          {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                range === r ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-white'
              }`}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingSpinner className="py-32" /> : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Events', value: events.length.toLocaleString(), icon: '📊' },
              { label: 'Words Written', value: totalWords >= 0 ? `+${totalWords.toLocaleString()}` : totalWords.toLocaleString(), icon: '✍️' },
              { label: 'Script Edits', value: totalEdits.toLocaleString(), icon: '📝' },
              { label: 'Exports', value: totalExports.toLocaleString(), icon: '📤' },
            ].map(s => (
              <Card key={s.label} className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span>{s.icon}</span>
                  <p className="text-xs text-surface-500 font-medium">{s.label}</p>
                </div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
              </Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Activity Chart */}
            <div className="lg:col-span-2">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Daily Activity</h3>
                {activityByDay.length > 0 ? (
                  <div className="flex items-end gap-1 h-32">
                    {activityByDay.map(([day, count]) => (
                      <div key={day} className="flex-1 flex flex-col items-center group relative">
                        <div
                          className="w-full bg-brand-500/60 hover:bg-brand-500 rounded-t transition-colors min-h-[2px]"
                          style={{ height: `${(count / maxDayActivity) * 100}%` }}
                        />
                        <div className="absolute -top-6 hidden group-hover:block bg-surface-800 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-10">
                          {day.slice(5)}: {count} events
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-surface-500 text-center py-8">No activity data yet. Events are tracked automatically as your team works.</p>
                )}
              </Card>
            </div>

            {/* Event Type Breakdown */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Event Types</h3>
              {eventTypes.length > 0 ? (
                <div className="space-y-2">
                  {eventTypes.slice(0, 8).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-xs text-surface-300 capitalize">{type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-surface-500">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-surface-500">No events yet.</p>
              )}
            </Card>
          </div>

          {/* Team Members */}
          <Card className="p-5 mt-6">
            <h3 className="text-sm font-semibold text-white mb-4">Team Activity</h3>
            {memberStats.length > 0 ? (
              <div className="space-y-3">
                {memberStats.map((m) => (
                  <div key={m.userId} className="flex items-center gap-4 p-3 rounded-lg bg-surface-800/30 hover:bg-surface-800/50 transition-colors">
                    {m.avatar ? (
                      <img src={m.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface-700 flex items-center justify-center text-xs font-semibold text-white">
                        {m.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{m.name}</p>
                      <p className="text-xs text-surface-500">
                        Last active {new Date(m.lastActive).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-white">{m.totalEvents} events</p>
                      <p className="text-xs text-surface-500">
                        {m.wordCountDelta >= 0 ? '+' : ''}{m.wordCountDelta} words
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-500 text-center py-8">
                No team activity data yet. Activity is tracked automatically when team members work on the project.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
