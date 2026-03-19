'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

type ResultState = { ok: boolean; data: any } | null;

interface TestCardProps {
  title: string;
  description: string;
  icon: string;
  color: string;
  fields?: { key: string; label: string; placeholder?: string; default?: string }[];
  onRun: (values: Record<string, string>) => Promise<void>;
  loading: boolean;
  result: ResultState;
}

function TestCard({ title, description, icon, color, fields = [], onRun, loading, result }: TestCardProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, f.default ?? '']))
  );

  return (
    <div className={cn('bg-white/[0.03] border rounded-xl p-5 flex flex-col gap-4 transition-all', color)}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm">{title}</h3>
          <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>

      {fields.map(f => (
        <div key={f.key}>
          <label className="text-[11px] text-white/40 uppercase tracking-wide block mb-1">{f.label}</label>
          <input
            value={values[f.key] ?? ''}
            onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
        </div>
      ))}

      <button
        onClick={() => onRun(values)}
        disabled={loading}
        className={cn(
          'w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
          loading
            ? 'bg-white/5 text-white/30 cursor-not-allowed'
            : 'bg-violet-600 hover:bg-violet-500 text-white'
        )}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : 'Run'}
      </button>

      {result && (
        <div className={cn(
          'rounded-lg px-4 py-3 font-mono text-xs overflow-auto max-h-48',
          result.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'
        )}>
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default function DevTestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [resultMap, setResultMap] = useState<Record<string, ResultState>>({});

  const isAdmin = !authLoading && user && (user.id === ADMIN_UID || (user as any).role === 'admin' || (user as any).role === 'moderator');

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) router.replace('/dev/features');
  }, [authLoading, isAdmin]);

  async function run(action: string, payload: Record<string, any>) {
    setLoadingMap(m => ({ ...m, [action]: true }));
    setResultMap(m => ({ ...m, [action]: null }));
    try {
      const res = await fetch('/api/dev/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      setResultMap(m => ({ ...m, [action]: { ok: res.ok, data: json } }));
    } catch (e: any) {
      setResultMap(m => ({ ...m, [action]: { ok: false, data: { error: e.message } } }));
    } finally {
      setLoadingMap(m => ({ ...m, [action]: false }));
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const TESTS = [
    {
      id: 'send_notification',
      title: 'Send Notification',
      description: 'Send a notification to your own account. Shows immediately in the notification bell.',
      icon: '🔔',
      color: 'border-blue-500/20 hover:border-blue-500/40',
      fields: [
        { key: 'title', label: 'Title', placeholder: '🧪 Test Notification', default: '🧪 Test Notification' },
        { key: 'body', label: 'Body', placeholder: 'This is a test…', default: 'This is a test notification from the dev panel.' },
        { key: 'type', label: 'Type', placeholder: 'system', default: 'system' },
      ],
      run: (v: Record<string, string>) => run('send_notification', v),
    },
    {
      id: 'award_xp',
      title: 'Award XP',
      description: 'Fire an XP award event to your account. Tests the gamification pipeline.',
      icon: '⚡',
      color: 'border-amber-500/20 hover:border-amber-500/40',
      fields: [{ key: 'amount', label: 'XP Amount', placeholder: '50', default: '50' }],
      run: (v: Record<string, string>) => run('award_xp', { amount: Number(v.amount) || 50 }),
    },
    {
      id: 'send_email',
      title: 'Simulate Email Send',
      description: 'Simulates triggering a transactional email. Logs a notification instead of actually sending.',
      icon: '📧',
      color: 'border-violet-500/20 hover:border-violet-500/40',
      fields: [{ key: 'template', label: 'Template name', placeholder: 'welcome', default: 'welcome' }],
      run: (v: Record<string, string>) => run('send_email', { template: v.template }),
    },
    {
      id: 'send_push',
      title: 'Test Push Notification',
      description: 'Fires a test push notification to your registered device. Requires browser push subscription.',
      icon: '📱',
      color: 'border-emerald-500/20 hover:border-emerald-500/40',
      fields: [],
      run: () => run('send_push', {}),
    },
    {
      id: 'db_health',
      title: 'DB Health Check',
      description: 'Pings all major tables and reports row counts + response times.',
      icon: '🩺',
      color: 'border-cyan-500/20 hover:border-cyan-500/40',
      fields: [],
      run: () => run('db_health', {}),
    },
    {
      id: 'simulate_error',
      title: 'Simulate Error',
      description: 'Returns a specific HTTP error code. Useful for testing error handling in the frontend.',
      icon: '💥',
      color: 'border-red-500/20 hover:border-red-500/40',
      fields: [{ key: 'type', label: 'Error type', placeholder: '404 | 500 | 429', default: '404' }],
      run: (v: Record<string, string>) => run('simulate_error', { type: v.type || '404' }),
    },
  ];

  return (
    <div className="p-8 max-w-[1200px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Test Bench</h1>
        <p className="text-white/40 text-sm mt-0.5">Trigger events and test platform functions. All actions run against your own account.</p>
      </div>

      {/* Warning */}
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-8">
        <span className="text-lg">⚠️</span>
        <p className="text-amber-300 text-sm">Actions on this page have real effects on your account and the database. Use with care.</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TESTS.map(t => (
          <TestCard
            key={t.id}
            title={t.title}
            description={t.description}
            icon={t.icon}
            color={t.color}
            fields={t.fields}
            onRun={t.run}
            loading={!!loadingMap[t.id]}
            result={resultMap[t.id] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
