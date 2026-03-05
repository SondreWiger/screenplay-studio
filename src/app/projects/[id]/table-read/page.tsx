'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Card, Button, LoadingSpinner, Modal, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

// ============================================================
// Table Read / Script Timer
// Live timer per scene during a table read session.
// Saves total time + per-scene breakdown to table_read_sessions.
// ============================================================

interface Scene {
  id: string;
  scene_number: string | null;
  scene_heading: string | null;
  page_count: number | null;
}

interface SceneTiming {
  scene_id: string;
  heading: string;
  seconds: number;
}

interface Session {
  id: string;
  session_name: string;
  session_date: string;
  total_seconds: number;
  scene_timings: SceneTiming[];
  created_at: string;
}

function fmt(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h > 0 ? String(h).padStart(2, '0') : null, String(m).padStart(2, '0'), String(s).padStart(2, '0')]
    .filter(Boolean).join(':');
}

export default function TableReadPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'active' | 'summary'>('list');

  // Live session state
  const [sessionName, setSessionName] = useState('');
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [sceneTimings, setSceneTimings] = useState<SceneTiming[]>([]);
  const [elapsed, setElapsed] = useState(0);         // for current scene
  const [totalElapsed, setTotalElapsed] = useState(0); // total session time
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailSession, setDetailSession] = useState<Session | null>(null);

  useEffect(() => { load(); }, [params.id]);

  const load = async () => {
    const supabase = createClient();
    const [{ data: sceneData }, { data: sessionData }] = await Promise.all([
      supabase.from('scenes').select('id, scene_number, scene_heading, page_count').eq('project_id', params.id).order('sort_order', { ascending: true }),
      supabase.from('table_read_sessions').select('*').eq('project_id', params.id).order('created_at', { ascending: false }),
    ]);
    setScenes((sceneData ?? []) as Scene[]);
    setSessions((sessionData ?? []) as Session[]);
    setLoading(false);
  };

  // Tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
        setTotalElapsed((e) => e + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const startSession = () => {
    setCurrentSceneIdx(0);
    setSceneTimings([]);
    setElapsed(0);
    setTotalElapsed(0);
    setRunning(true);
    setView('active');
  };

  const nextScene = () => {
    const scene = scenes[currentSceneIdx];
    const timing: SceneTiming = { scene_id: scene.id, heading: scene.scene_heading ?? `Scene ${scene.scene_number}`, seconds: elapsed };
    const newTimings = [...sceneTimings, timing];
    setSceneTimings(newTimings);
    setElapsed(0);

    if (currentSceneIdx + 1 >= scenes.length) {
      setRunning(false);
      setView('summary');
    } else {
      setCurrentSceneIdx(currentSceneIdx + 1);
    }
  };

  const skipScene = () => {
    const scene = scenes[currentSceneIdx];
    const timing: SceneTiming = { scene_id: scene.id, heading: scene.scene_heading ?? `Scene ${scene.scene_number}`, seconds: 0 };
    setSceneTimings((prev) => [...prev, timing]);
    setElapsed(0);
    if (currentSceneIdx + 1 >= scenes.length) { setRunning(false); setView('summary'); }
    else setCurrentSceneIdx(currentSceneIdx + 1);
  };

  const saveSession = async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      project_id: params.id,
      session_name: sessionName || `Table Read ${new Date().toLocaleDateString()}`,
      session_date: new Date().toISOString().split('T')[0],
      total_seconds: totalElapsed,
      scene_timings: sceneTimings,
      created_by: user?.id,
    };
    const { data, error } = await supabase.from('table_read_sessions').insert(payload).select().single();
    if (!error && data) {
      setSessions((prev) => [data as Session, ...prev]);
      toast.success('Session saved!');
    }
    setSaving(false);
    setView('list');
  };

  // Warn before leaving mid-session
  useEffect(() => {
    if (view !== 'active') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [view]);

  const deleteSession = async (id: string) => {
    const ok = await confirm({ message: 'Delete this session?', variant: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    await createClient().from('table_read_sessions').delete().eq('id', id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.success('Deleted.');
  };

  if (loading) return <LoadingSpinner className="py-32" />;

  // ─── Summary view ───────────────────────────────────────────
  if (view === 'summary') return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-white">Session Complete</h1>
          <p className="text-sm text-surface-400 mt-0.5">Total runtime: <span className="text-orange-400 font-bold text-base">{fmt(totalElapsed)}</span></p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setView('list')}>Discard</Button>
          <Button onClick={saveSession} disabled={saving}>{saving ? 'Saving…' : 'Save Session'}</Button>
        </div>
      </div>

      <Card className="p-4 mb-4">
        <label className="text-xs text-surface-400 mb-1 block">Session Name</label>
        <input
          value={sessionName} onChange={(e) => setSessionName(e.target.value)}
          placeholder={`Table Read ${new Date().toLocaleDateString()}`}
          className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white"
        />
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-800/60 text-surface-400 text-[11px] uppercase tracking-wider">
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Scene</th>
              <th className="px-4 py-2 text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {sceneTimings.map((t, i) => (
              <tr key={t.scene_id} className="border-t border-surface-800 hover:bg-surface-800/30">
                <td className="px-4 py-2.5 text-surface-500">{i + 1}</td>
                <td className="px-4 py-2.5 text-surface-300 text-xs line-clamp-1">{t.heading}</td>
                <td className={cn('px-4 py-2.5 text-right font-mono font-semibold', t.seconds === 0 ? 'text-surface-600' : 'text-white')}>
                  {t.seconds === 0 ? '—' : fmt(t.seconds)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-orange-500/30 bg-orange-500/5">
              <td colSpan={2} className="px-4 py-2.5 text-orange-300 font-bold text-xs uppercase tracking-wider">Total</td>
              <td className="px-4 py-2.5 text-right font-mono font-black text-orange-400 text-base">{fmt(totalElapsed)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );

  // ─── Active session ──────────────────────────────────────────
  if (view === 'active') {
    const scene = scenes[currentSceneIdx];
    const progress = ((currentSceneIdx) / scenes.length) * 100;
    return (
      <div className="p-4 md:p-8 max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black text-white">Table Read</h1>
          <p className="text-sm text-surface-400">{currentSceneIdx + 1} / {scenes.length} scenes</p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-surface-800 rounded-full mb-8">
          <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>

        {/* Current scene card */}
        <Card className="p-8 text-center mb-4">
          <p className="text-xs text-surface-500 uppercase tracking-widest mb-2">Current Scene</p>
          <p className="text-base font-semibold text-white mb-1 line-clamp-3">{scene.scene_heading ?? `Scene ${scene.scene_number}`}</p>
          {scene.page_count && <p className="text-xs text-surface-500">{scene.page_count} pages</p>}
          <div className={cn('text-5xl font-black font-mono mt-6 tabular-nums', running ? 'text-orange-400' : 'text-surface-600')}>
            {fmt(elapsed)}
          </div>
          <p className="text-xs text-surface-500 mt-2">Total: {fmt(totalElapsed)}</p>
        </Card>

        <div className="flex gap-3 mb-4">
          <Button variant="ghost" onClick={() => setRunning((r) => !r)} className="flex-1">
            {running ? '⏸ Pause' : '▶ Resume'}
          </Button>
          <Button variant="ghost" onClick={skipScene} className="flex-1">Skip Scene</Button>
          <Button onClick={nextScene} className="flex-1 bg-orange-500 hover:bg-orange-400">
            {currentSceneIdx + 1 >= scenes.length ? 'Finish' : 'Next Scene →'}
          </Button>
        </div>

        {/* Upcoming list */}
        {scenes.slice(currentSceneIdx + 1, currentSceneIdx + 5).length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-surface-500 mb-2 uppercase tracking-wider">Up next</p>
            {scenes.slice(currentSceneIdx + 1, currentSceneIdx + 5).map((s, i) => (
              <div key={s.id} className="text-xs text-surface-500 py-1 border-b border-surface-800/50 truncate">
                {currentSceneIdx + i + 2}. {s.scene_heading ?? `Scene ${s.scene_number}`}
              </div>
            ))}
          </div>
        )}

        {/* Already timed */}
        {sceneTimings.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-surface-500 mb-2 uppercase tracking-wider">Completed</p>
            {[...sceneTimings].reverse().map((t) => (
              <div key={t.scene_id} className="flex justify-between text-xs text-surface-500 py-1 border-b border-surface-800/50">
                <span className="truncate pr-4">{t.heading}</span>
                <span className="font-mono shrink-0">{t.seconds === 0 ? '—' : fmt(t.seconds)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── List view ─────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-white">Table Read</h1>
          <p className="text-sm text-surface-400 mt-0.5">Time each scene live and save the session.</p>
        </div>
        {canEdit && scenes.length > 0 && (
          <Button onClick={startSession} className="bg-orange-500 hover:bg-orange-400">▶ Start New Read</Button>
        )}
      </div>

      {scenes.length === 0 && (
        <Card className="p-6 text-center text-surface-500 mb-4">
          <p className="text-sm">Add scenes to your project first — they will appear here as timed segments.</p>
        </Card>
      )}

      {sessions.length === 0 ? (
        <Card className="p-10 text-center text-surface-500">
          <p className="font-medium text-white mb-1">No sessions yet</p>
          <p className="text-sm">Start a table read to time each scene and save the breakdown.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const timings: SceneTiming[] = (s.scene_timings ?? []) as SceneTiming[];
            const timedCount = timings.filter((t) => t.seconds > 0).length;
            return (
              <Card key={s.id} className="group p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{s.session_name}</p>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {s.session_date} · {timedCount} scenes · <span className="font-mono font-bold text-orange-400">{fmt(s.total_seconds)}</span>
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button onClick={() => setDetailSession(s)} className="px-3 py-1.5 text-xs bg-surface-700/60 hover:bg-surface-700 border border-surface-600 rounded-lg text-white">Details</button>
                    {canEdit && <button onClick={() => deleteSession(s.id)} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg">Delete</button>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Session detail modal */}
      <Modal isOpen={!!detailSession} onClose={() => setDetailSession(null)} title={detailSession?.session_name ?? 'Session Details'} size="md">
        {detailSession && (
          <div className="space-y-2">
            <p className="text-xs text-surface-500 mb-3">{detailSession.session_date} · Total: <span className="font-mono font-bold text-orange-400">{fmt(detailSession.total_seconds)}</span></p>
            {((detailSession.scene_timings ?? []) as SceneTiming[]).map((t, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-surface-800 last:border-0">
                <span className="text-sm text-surface-300 truncate flex-1">{t.heading}</span>
                <span className="font-mono text-sm text-orange-400 ml-3 shrink-0">{t.seconds > 0 ? fmt(t.seconds) : <span className="text-surface-600">skipped</span>}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
      <ConfirmDialog />
    </div>
  );
}
