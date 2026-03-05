'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/lib/stores';
import { Card, LoadingSpinner, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ============================================================
// Production War Room
// Central dashboard showing the live state of production:
// scene progress, safety alerts, upcoming call sheets,
// and DOOD scheduling at a glance.
// ============================================================

interface SceneSummary { total: number; completed: number }
interface SafetyAlert { id: string; description: string | null; risk_level: string; scene_id: string | null }
interface CallSheetItem { id: string; title: string | null; shoot_date: string; general_call: string | null }
interface DOODEntry { character_name: string; shoot_date: string; status: string }
interface CameraReportCount { count: number }

export default function ProductionOverviewPage({ params }: { params: { id: string } }) {
  const { currentProject } = useProjectStore();

  const [loading, setLoading] = useState(true);
  const [scenes, setScenes] = useState<SceneSummary>({ total: 0, completed: 0 });
  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlert[]>([]);
  const [callSheets, setCallSheets] = useState<CallSheetItem[]>([]);
  const [doodEntries, setDoodEntries] = useState<DOODEntry[]>([]);
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => { load(); }, [params.id]);

  const load = async () => {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    const [sceneRes, safetyRes, callRes, doodRes, reportRes] = await Promise.all([
      supabase.from('scenes').select('id, is_completed').eq('project_id', params.id),
      supabase.from('safety_plan_items').select('id, description, risk_level, scene_id').eq('project_id', params.id).eq('is_cleared', false).order('risk_level'),
      supabase.from('call_sheets').select('id, title, shoot_date, general_call').eq('project_id', params.id).gte('shoot_date', today).order('shoot_date').limit(3),
      supabase.from('dood_entries').select('character_name, shoot_date, status').eq('project_id', params.id).in('shoot_date', [today, nextDay(today)]).neq('status', ''),
      supabase.from('camera_reports').select('id', { count: 'exact', head: true }).eq('project_id', params.id),
    ]);

    const rawScenes = sceneRes.data ?? [];
    setScenes({ total: rawScenes.length, completed: rawScenes.filter((s: { is_completed: boolean }) => s.is_completed).length });
    setSafetyAlerts((safetyRes.data ?? []) as SafetyAlert[]);
    setCallSheets((callRes.data ?? []) as CallSheetItem[]);
    setDoodEntries((doodRes.data ?? []) as DOODEntry[]);
    setReportCount(reportRes.count ?? 0);
    setLoading(false);
  };

  if (loading) return <LoadingSpinner className="py-32" />;

  const pct = scenes.total > 0 ? Math.round((scenes.completed / scenes.total) * 100) : 0;
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = nextDay(today);
  const todayChars = Array.from(new Set(doodEntries.filter((e) => e.shoot_date === today).map((e) => e.character_name)));
  const tomorrowChars = Array.from(new Set(doodEntries.filter((e) => e.shoot_date === tomorrow).map((e) => e.character_name)));

  const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedAlerts = [...safetyAlerts].sort((a, b) => (riskOrder[a.risk_level] ?? 9) - (riskOrder[b.risk_level] ?? 9));

  const riskColor: Record<string, string> = {
    critical: 'text-red-400 bg-red-500/10 border-red-500/20',
    high:     'text-orange-400 bg-orange-500/10 border-orange-500/20',
    medium:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
    low:      'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-black text-white">Production War Room</h1>
        <p className="text-sm text-surface-400 mt-0.5">{currentProject?.title} — live production snapshot</p>
      </div>

      {/* Scene Progress */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white">Scene Progress</h2>
          <Link href={`/projects/${params.id}/scenes`} className="text-xs text-[#FF5F1F] hover:underline">View all →</Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Progress value={pct} showPercent={false} className="h-3" />
          </div>
          <span className="text-white font-black text-xl tabular-nums">{pct}%</span>
        </div>
        <p className="text-sm text-surface-500 mt-2">{scenes.completed} of {scenes.total} scenes shot</p>

        {scenes.total > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Shot', value: scenes.completed, color: 'text-green-400' },
              { label: 'Remaining', value: scenes.total - scenes.completed, color: 'text-amber-400' },
              { label: 'Total', value: scenes.total, color: 'text-white' },
            ].map((s) => (
              <div key={s.label} className="bg-surface-800/50 rounded-lg p-3 text-center">
                <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
                <p className="text-xs text-surface-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Upcoming Call Sheets */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">Upcoming Call Sheets</h2>
            <Link href={`/projects/${params.id}/call-sheet`} className="text-xs text-[#FF5F1F] hover:underline">All →</Link>
          </div>
          {callSheets.length === 0 ? (
            <p className="text-sm text-surface-500">No upcoming shoot days.</p>
          ) : (
            <div className="space-y-2">
              {callSheets.map((cs) => (
                <div key={cs.id} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{cs.title ?? cs.shoot_date}</p>
                    {cs.title && <p className="text-xs text-surface-500">{cs.shoot_date}</p>}
                  </div>
                  {cs.general_call && (
                    <span className="text-xs font-mono text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">{cs.general_call}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Safety Alerts */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">Safety Alerts</h2>
            <Link href={`/projects/${params.id}/safety-plan`} className="text-xs text-[#FF5F1F] hover:underline">All →</Link>
          </div>
          {sortedAlerts.length === 0 ? (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <span>✓</span><span>All safety items cleared</span>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium', riskColor[alert.risk_level] ?? 'text-surface-400 bg-surface-800/50 border-surface-700')}>
                  <span className="uppercase font-black shrink-0">{alert.risk_level}</span>
                  <span className="truncate">{alert.description ?? '—'}</span>
                </div>
              ))}
              {sortedAlerts.length > 5 && <p className="text-xs text-surface-500 mt-1">+{sortedAlerts.length - 5} more alerts</p>}
            </div>
          )}
        </Card>

        {/* DOOD Today/Tomorrow */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">On Set Today &amp; Tomorrow</h2>
            <Link href={`/projects/${params.id}/dood`} className="text-xs text-[#FF5F1F] hover:underline">DOOD →</Link>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-surface-500 mb-1.5">Today <span className="font-mono">{today.slice(5)}</span></p>
              {todayChars.length === 0 ? (
                <p className="text-xs text-surface-600 italic">No characters scheduled</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {todayChars.map((name) => (
                    <span key={name} className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">{name}</span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-surface-500 mb-1.5">Tomorrow <span className="font-mono">{tomorrow.slice(5)}</span></p>
              {tomorrowChars.length === 0 ? (
                <p className="text-xs text-surface-600 italic">No characters scheduled</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tomorrowChars.map((name) => (
                    <span key={name} className="text-xs bg-surface-700/60 text-surface-300 px-2 py-0.5 rounded-full">{name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Quick Links */}
        <Card className="p-5">
          <h2 className="font-bold text-white mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Call Sheets', href: 'call-sheet', icon: '📋' },
              { label: 'Day Out of Days', href: 'dood', icon: '📅' },
              { label: 'Breakdown', href: 'breakdown', icon: '🎬' },
              { label: 'Safety Plan', href: 'safety-plan', icon: '🦺' },
              { label: reportCount > 0 ? `Camera Reports (${reportCount})` : 'Camera Reports', href: 'camera-reports', icon: '🎥' },
              { label: 'Continuity', href: 'continuity', icon: '🔄' },
              { label: 'Table Read', href: 'table-read', icon: '⏱' },
              { label: 'Treatment', href: 'treatment', icon: '📄' },
            ].map((l) => (
              <Link key={l.href + l.label} href={`/projects/${params.id}/${l.href}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800/50 hover:bg-surface-700/60 text-xs text-surface-300 hover:text-white transition-colors">
                <span>{l.icon}</span><span className="truncate">{l.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
