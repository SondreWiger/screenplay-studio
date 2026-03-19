'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

function fmt(n: number | undefined | null) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtBytes(b: number) {
  if (b >= 1_048_576) return (b / 1_048_576).toFixed(1) + ' MB';
  if (b >= 1_024) return (b / 1_024).toFixed(0) + ' KB';
  return b + ' B';
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}

function StatCard({ label, value, sub, color = 'text-white', icon }: StatCardProps) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/40 uppercase tracking-wider font-medium">{label}</span>
        {icon && <span className="text-white/20">{icon}</span>}
      </div>
      <span className={cn('text-2xl font-bold tabular-nums', color)}>{value}</span>
      {sub && <span className="text-[11px] text-white/30">{sub}</span>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">{title}</h2>
      {children}
    </div>
  );
}

function MiniBar({ label, value, max, color = 'bg-violet-500' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-[11px] text-white/50 w-28 shrink-0 capitalize">{label.replace(/_/g, ' ')}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-white/40 tabular-nums w-12 text-right">{fmt(value)}</span>
    </div>
  );
}

function SignupSparkline({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return <p className="text-white/30 text-xs">No data</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  const w = 600, h = 80;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = h - (d.count / max) * (h - 8);
    return `${x},${y}`;
  });
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Daily signups — last 30 days</span>
        <span className="text-[11px] text-white/30">{data.reduce((a, d) => a + d.count, 0)} total</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 80 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${h} ${pts.join(' ')} ${w},${h}`}
          fill="url(#sg)"
        />
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-white/20">{data[0]?.date}</span>
        <span className="text-[10px] text-white/20">{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export default function DevStatsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const isAdmin = !authLoading && user && (user.id === ADMIN_UID || (user as any).role === 'admin' || (user as any).role === 'moderator');

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) { router.replace('/dev/features'); return; }
    fetchStats();
  }, [authLoading, isAdmin]);

  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/dev/stats');
      if (!r.ok) { setError(`${r.status} ${r.statusText}`); return; }
      setData(await r.json());
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-screen gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={fetchStats} className="text-xs text-violet-400 underline">Retry</button>
      </div>
    );
  }

  const { db, codebase, meta } = data ?? {};

  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Platform Stats</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {lastRefresh ? `Last refreshed ${lastRefresh.toLocaleTimeString()}` : ''}
            {meta?.siteVersion ? ` · v${meta.siteVersion}` : ''}
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/[0.08] border border-white/[0.06] text-sm text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      <div className="space-y-10">
        {/* ── Users ── */}
        <Section title="Users">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Users" value={fmt(db?.totalUsers)} color="text-violet-400"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
            <StatCard label="Pro Users" value={fmt(db?.proUsers)} sub={`${db?.totalUsers > 0 ? ((db.proUsers / db.totalUsers) * 100).toFixed(1) : 0}% of total`} color="text-amber-400" />
            <StatCard label="Push Subs" value={fmt(db?.pushSubscriptions)} color="text-emerald-400" />
            <StatCard label="Open Tickets" value={fmt(db?.openTickets)} sub={`${fmt(db?.totalTickets)} total`} color="text-rose-400" />
          </div>
        </Section>

        {/* ── Signup Trend ── */}
        <Section title="Growth">
          <SignupSparkline data={db?.signupTrend ?? []} />
        </Section>

        {/* ── Content ── */}
        <Section title="Content">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard label="Projects" value={fmt(db?.totalProjects)} color="text-blue-400" />
            <StatCard label="Scripts" value={fmt(db?.totalScripts)} color="text-violet-400" />
            <StatCard label="Total Words" value={fmt(db?.totalWords)} color="text-emerald-400" />
            <StatCard label="Scenes" value={fmt(db?.totalScenes)} />
            <StatCard label="Characters" value={fmt(db?.totalCharacters)} />
            <StatCard label="Locations" value={fmt(db?.totalLocations)} />
            <StatCard label="Shots" value={fmt(db?.totalShots)} />
            <StatCard label="Ideas" value={fmt(db?.totalIdeas)} />
            <StatCard label="Documents" value={fmt(db?.totalDocuments)} />
            <StatCard label="Budget Items" value={fmt(db?.totalBudgetItems)} />
            <StatCard label="Schedule Events" value={fmt(db?.totalScheduleEvents)} />
            <StatCard label="Comments" value={fmt(db?.totalComments)} />
            <StatCard label="Blog Posts" value={fmt(db?.totalBlogPosts)} />
            <StatCard label="Community Posts" value={fmt(db?.totalCommunityPosts)} />
          </div>
        </Section>

        {/* ── Breakdowns ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-4">Script Types</h3>
            {(db?.scriptTypeBreakdown ?? []).map((r: any, i: number) => (
              <MiniBar key={r.type} label={r.type} value={r.count} max={db?.scriptTypeBreakdown?.[0]?.count ?? 1} color={colors[i % colors.length]} />
            ))}
            {!db?.scriptTypeBreakdown?.length && <p className="text-white/20 text-xs">No data</p>}
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-4">Project Types</h3>
            {(db?.projectTypeBreakdown ?? []).map((r: any, i: number) => (
              <MiniBar key={r.type} label={r.type} value={r.count} max={db?.projectTypeBreakdown?.[0]?.count ?? 1} color={colors[i % colors.length]} />
            ))}
            {!db?.projectTypeBreakdown?.length && <p className="text-white/20 text-xs">No data</p>}
          </div>
        </div>

        {/* ── Codebase ── */}
        <Section title="Codebase">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Files" value={fmt(codebase?.totalFiles)} color="text-cyan-400" />
            <StatCard label="Total Lines" value={fmt(codebase?.totalLines)} color="text-violet-400" />
            <StatCard label="Code Files" value={fmt(codebase?.codeFiles)} sub=".ts/.tsx/.js" />
            <StatCard label="Code Lines" value={fmt(codebase?.codeLines)} />
            <StatCard label="SQL Files" value={fmt(codebase?.sqlFiles)} />
            <StatCard label="SQL Lines" value={fmt(codebase?.sqlLines)} />
          </div>
          <div className="mt-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-3">
            <p className="text-[11px] text-white/30">
              Total source size: <span className="text-white/60 font-mono">{fmtBytes(codebase?.totalBytes ?? 0)}</span>
              {' · '}Scanned from <span className="text-white/40 font-mono">src/</span> and <span className="text-white/40 font-mono">supabase/</span>
            </p>
          </div>
        </Section>

        <div className="h-8" />
      </div>
    </div>
  );
}
