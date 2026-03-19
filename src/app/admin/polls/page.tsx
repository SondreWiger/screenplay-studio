'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';
import type { PollSession } from '@/lib/types';

// ============================================================
// Admin — Poll Sessions List
// ============================================================

const STATUS_COLOR: Record<string, string> = {
  draft:     'bg-white/10 text-white/50',
  review:    'bg-amber-500/20 text-amber-300',
  published: 'bg-emerald-500/20 text-emerald-300',
  closed:    'bg-white/5 text-white/30',
};

export default function AdminPollsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<PollSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPreface, setNewPreface] = useState('');
  const [creating, setCreating] = useState(false);

  const isAdmin = user && (user.id === 'f0e0c4a4-0833-4c64-b012-15829c087c77' || user.role === 'admin');

  useEffect(() => {
    if (!authLoading && !isAdmin) { router.push('/admin'); return; }
    if (!isAdmin) return;
    fetch('/api/admin/polls')
      .then((r) => r.json())
      .then((d) => { setSessions(Array.isArray(d) ? d : []); setLoading(false); });
  }, [isAdmin, authLoading, router]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const res = await fetch('/api/admin/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, preface: newPreface }),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) {
      router.push(`/admin/polls/${data.id}`);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-surface-950/95 border-b border-white/[0.06] px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-white/40 hover:text-white transition-colors text-sm">
            ← Admin
          </Link>
          <span className="text-white/20">/</span>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <span>📊</span> Polls
          </h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-[#FF5F1F] hover:bg-[#FF7F3F] text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + New Poll
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {sessions.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-white/40 text-sm">No polls yet. Create one to get started.</p>
          </div>
        )}

        <div className="space-y-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/admin/polls/${s.id}`}
              className="block bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLOR[s.status] ?? 'bg-white/10 text-white/40'}`}>
                      {s.status}
                    </span>
                    {s.questions && (
                      <span className="text-xs text-white/30">{s.questions.length} question{s.questions.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <h2 className="font-semibold text-white group-hover:text-[#FF8F5F] transition-colors truncate">{s.title}</h2>
                  {s.preface && (
                    <p className="text-sm text-white/40 mt-1 line-clamp-2">{s.preface}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  {s.status === 'published' || s.status === 'closed' ? (
                    <p className="text-xl font-bold text-white">{s.response_count}</p>
                  ) : null}
                  {(s.status === 'published' || s.status === 'closed') && (
                    <p className="text-[10px] text-white/30">responses</p>
                  )}
                  <p className="text-[10px] text-white/20 mt-1">{formatDate(s.created_at)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-[#111113] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-5">New Poll</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="What should we work on next?"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF5F1F]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Preface <span className="normal-case text-white/20">(optional intro shown to users)</span></label>
                <textarea
                  rows={3}
                  value={newPreface}
                  onChange={(e) => setNewPreface(e.target.value)}
                  placeholder="We want to hear your thoughts on what to build next…"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF5F1F]/50 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-xl transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || creating}
                className="flex-1 py-2.5 bg-[#FF5F1F] hover:bg-[#FF7F3F] disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {creating ? 'Creating…' : 'Create & Edit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
