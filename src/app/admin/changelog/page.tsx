'use client';

/**
 * /admin/changelog — Changelog Release Manager
 * Create draft releases, add individual entries, and publish.
 * Admin-only (enforced by RLS — only admin UUID can write; redirected if not admin).
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';
const ORANGE = '#FF5F1F';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReleaseStatus = 'draft' | 'published' | 'yanked';
type ReleaseType = 'major' | 'minor' | 'patch' | 'hotfix';
type EntryType = 'feature' | 'improvement' | 'fix' | 'performance' | 'security' | 'breaking' | 'deprecation' | 'internal';
type Area =
  | 'editor' | 'scripts' | 'scenes' | 'characters' | 'locations' | 'production'
  | 'schedule' | 'cast' | 'budget' | 'gear' | 'storyboard' | 'community'
  | 'challenges' | 'courses' | 'gamification' | 'collaboration' | 'documents'
  | 'versioning' | 'formats' | 'arc_planner' | 'work_tracking' | 'festival'
  | 'blog' | 'admin' | 'auth' | 'database' | 'performance' | 'api' | 'ui';

interface Release {
  id: string;
  version: string;
  title: string;
  summary: string | null;
  release_type: ReleaseType;
  status: ReleaseStatus;
  released_at: string | null;
  feature_count: number;
  improvement_count: number;
  fix_count: number;
  created_at: string;
}

interface Entry {
  id: string;
  release_id: string;
  title: string;
  description: string | null;
  entry_type: EntryType;
  area: Area;
  is_public: boolean;
  sort_order: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ReleaseStatus, string> = {
  draft: 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/40',
  published: 'bg-green-900/30 text-green-400 border border-green-700/40',
  yanked: 'bg-red-900/30 text-red-400 border border-red-700/40',
};

const TYPE_STYLES: Record<EntryType, string> = {
  feature: 'text-orange-400',
  improvement: 'text-indigo-400',
  fix: 'text-green-400',
  performance: 'text-yellow-400',
  security: 'text-red-400',
  breaking: 'text-red-500',
  deprecation: 'text-orange-600',
  internal: 'text-white/30',
};

const RELEASE_TYPE_BADGE: Record<ReleaseType, string> = {
  major: 'bg-orange-900/40 text-orange-300',
  minor: 'bg-white/5 text-white/40',
  patch: 'bg-white/5 text-white/30',
  hotfix: 'bg-red-900/40 text-red-400',
};

const ENTRY_TYPES: EntryType[] = ['feature', 'improvement', 'fix', 'performance', 'security', 'breaking', 'deprecation', 'internal'];
const AREAS: Area[] = [
  'editor', 'scripts', 'scenes', 'characters', 'locations', 'production',
  'schedule', 'cast', 'budget', 'gear', 'storyboard', 'community',
  'challenges', 'courses', 'gamification', 'collaboration', 'documents',
  'versioning', 'formats', 'arc_planner', 'work_tracking', 'festival',
  'blog', 'admin', 'auth', 'database', 'performance', 'api', 'ui',
];
const RELEASE_TYPES: ReleaseType[] = ['major', 'minor', 'patch', 'hotfix'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminChangelogPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [releases, setReleases] = useState<Release[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // New release form state
  const [showNewRelease, setShowNewRelease] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newReleaseType, setNewReleaseType] = useState<ReleaseType>('minor');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // New entry form state
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [eTitle, setETitle] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eType, setEType] = useState<EntryType>('feature');
  const [eArea, setEArea] = useState<Area>('editor');
  const [ePublic, setEPublic] = useState(true);
  const [savingEntry, setSavingEntry] = useState(false);
  const [entryError, setEntryError] = useState('');

  // Publishing state
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishError, setPublishError] = useState('');

  // ─── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user || user.id !== ADMIN_UID) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  // ─── Data loading ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [{ data: relData }, { data: entData }] = await Promise.all([
      supabase.from('changelog_releases').select('*').order('created_at', { ascending: false }),
      supabase.from('changelog_entries').select('*').order('sort_order'),
    ]);

    setReleases(relData || []);
    setEntries(entData || []);
    // Auto-select first draft if nothing selected
    if (!selectedId && relData?.length) {
      const firstDraft = relData.find(r => r.status === 'draft');
      setSelectedId(firstDraft?.id || relData[0].id);
    }
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    if (!authLoading && user?.id === ADMIN_UID) {
      loadData();
    }
  }, [authLoading, user]);

  // ─── Create release ─────────────────────────────────────────────────────────
  async function handleCreateRelease() {
    if (!newVersion.trim() || !newTitle.trim()) {
      setCreateError('Version and title are required.');
      return;
    }
    setCreating(true);
    setCreateError('');
    const supabase = createClient();
    const { data, error } = await supabase.from('changelog_releases').insert({
      version: newVersion.trim(),
      title: newTitle.trim(),
      summary: newSummary.trim() || null,
      release_type: newReleaseType,
      status: 'draft',
    }).select().single();

    if (error) {
      setCreateError(error.message);
    } else {
      setReleases(prev => [data, ...prev]);
      setSelectedId(data.id);
      setShowNewRelease(false);
      setNewVersion(''); setNewTitle(''); setNewSummary('');
    }
    setCreating(false);
  }

  // ─── Add entry ───────────────────────────────────────────────────────────────
  async function handleAddEntry() {
    if (!eTitle.trim() || !selectedId) {
      setEntryError('Title is required.');
      return;
    }
    setSavingEntry(true);
    setEntryError('');
    const supabase = createClient();
    const existing = entries.filter(e => e.release_id === selectedId);
    const maxOrder = existing.length ? Math.max(...existing.map(e => e.sort_order)) : 0;

    const { data, error } = await supabase.from('changelog_entries').insert({
      release_id: selectedId,
      title: eTitle.trim(),
      description: eDesc.trim() || null,
      entry_type: eType,
      area: eArea,
      is_public: ePublic,
      sort_order: maxOrder + 10,
    }).select().single();

    if (error) {
      setEntryError(error.message);
    } else {
      setEntries(prev => [...prev, data]);
      setETitle(''); setEDesc('');
      setShowNewEntry(false);
    }
    setSavingEntry(false);
  }

  // ─── Delete entry ────────────────────────────────────────────────────────────
  async function handleDeleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return;
    const supabase = createClient();
    await supabase.from('changelog_entries').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    // Refresh release counts
    await loadData();
  }

  // ─── Publish release ─────────────────────────────────────────────────────────
  async function handlePublish(version: string) {
    if (!confirm(`Publish release v${version}? This will update the live site_version.`)) return;
    setPublishing(version);
    setPublishError('');
    const supabase = createClient();
    const { error } = await supabase.rpc('publish_release', { v_version: version });
    if (error) {
      setPublishError(error.message);
    } else {
      await loadData();
    }
    setPublishing(null);
  }

  // ─── Delete release ───────────────────────────────────────────────────────────
  async function handleDeleteRelease(id: string, version: string) {
    if (!confirm(`Delete release v${version} and ALL its entries? This cannot be undone.`)) return;
    const supabase = createClient();
    await supabase.from('changelog_releases').delete().eq('id', id);
    setReleases(prev => prev.filter(r => r.id !== id));
    setEntries(prev => prev.filter(e => e.release_id !== id));
    if (selectedId === id) setSelectedId(releases.find(r => r.id !== id)?.id || null);
  }

  // ─── UI ───────────────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07070f' }}>
        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: ORANGE, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const selectedRelease = releases.find(r => r.id === selectedId) || null;
  const selectedEntries = entries.filter(e => e.release_id === selectedId).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="min-h-screen" style={{ background: '#07070f', color: '#fff' }}>

      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-white/30 hover:text-white transition-colors text-sm">
              ← Admin
            </Link>
            <span className="text-white/10">/</span>
            <span className="text-white/70 text-sm font-mono">changelog</span>
          </div>
          <button
            onClick={() => { setShowNewRelease(true); setCreateError(''); }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-all hover:-translate-y-px"
            style={{ background: ORANGE }}
          >
            + New Release
          </button>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-8 flex gap-6 h-[calc(100vh-57px)]">

        {/* ─── Left panel: releases list ──────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto pr-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/25 mb-1">
            {releases.length} releases
          </p>
          {releases.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={cn(
                'w-full text-left p-3 border transition-all',
                selectedId === r.id
                  ? 'border-orange-600/50 bg-orange-950/20'
                  : 'border-white/5 hover:border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm font-bold text-white/90">v{r.version}</span>
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider', STATUS_STYLES[r.status])}>
                  {r.status}
                </span>
              </div>
              <p className="text-xs text-white/50 truncate">{r.title}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold uppercase', RELEASE_TYPE_BADGE[r.release_type])}>
                  {r.release_type}
                </span>
                <span className="text-[9px] text-white/25">
                  {r.feature_count + r.improvement_count + r.fix_count} changes
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* ─── Right panel: release detail ───────────────────────── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {!selectedRelease ? (
            <div className="flex items-center justify-center h-48 text-white/20 text-sm">
              Select a release
            </div>
          ) : (
            <div className="space-y-6">
              {/* Release header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-black text-white">v{selectedRelease.version}</h1>
                    <span className={cn('text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider', STATUS_STYLES[selectedRelease.status])}>
                      {selectedRelease.status}
                    </span>
                    <span className={cn('text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider', RELEASE_TYPE_BADGE[selectedRelease.release_type])}>
                      {selectedRelease.release_type}
                    </span>
                  </div>
                  <p className="text-lg text-white/70 font-semibold">{selectedRelease.title}</p>
                  {selectedRelease.summary && (
                    <p className="text-sm text-white/40 mt-1 max-w-2xl">{selectedRelease.summary}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-white/30">
                    <span>🟠 {selectedRelease.feature_count} features</span>
                    <span>🟣 {selectedRelease.improvement_count} improvements</span>
                    <span>🟢 {selectedRelease.fix_count} fixes</span>
                    {selectedRelease.released_at && (
                      <span>Released {new Date(selectedRelease.released_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedRelease.status === 'draft' && (
                    <button
                      onClick={() => handlePublish(selectedRelease.version)}
                      disabled={!!publishing}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-all hover:-translate-y-px disabled:opacity-50"
                      style={{ background: '#16a34a' }}
                    >
                      {publishing === selectedRelease.version ? 'Publishing…' : '✓ Publish'}
                    </button>
                  )}
                  {selectedRelease.status === 'draft' && (
                    <button
                      onClick={() => handleDeleteRelease(selectedRelease.id, selectedRelease.version)}
                      className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-400 border border-red-900/40 hover:bg-red-950/30 transition-all"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {publishError && (
                <p className="text-sm text-red-400 bg-red-950/30 px-3 py-2 border border-red-900/40">
                  {publishError}
                </p>
              )}

              {/* Entries */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[11px] font-mono uppercase tracking-widest text-white/30">
                    {selectedEntries.length} entries
                  </h2>
                  {selectedRelease.status === 'draft' && (
                    <button
                      onClick={() => { setShowNewEntry(true); setEntryError(''); }}
                      className="text-xs font-bold px-3 py-1.5 border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all"
                    >
                      + Add Entry
                    </button>
                  )}
                </div>

                {selectedEntries.length === 0 ? (
                  <div className="border border-dashed border-white/10 p-8 text-center text-white/20 text-sm">
                    No entries yet — add the first change
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedEntries.map(entry => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-3 border border-white/5 hover:border-white/10 transition-all group"
                      >
                        <div className="w-24 shrink-0">
                          <span className={cn('text-[10px] font-bold uppercase', TYPE_STYLES[entry.entry_type])}>
                            {entry.entry_type}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/80 font-medium">{entry.title}</p>
                          {entry.description && (
                            <p className="text-xs text-white/35 mt-0.5 line-clamp-2">{entry.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-mono text-white/20 uppercase">{entry.area}</span>
                            {!entry.is_public && (
                              <span className="text-[9px] text-yellow-500/60 uppercase font-bold">internal</span>
                            )}
                          </div>
                        </div>
                        {selectedRelease.status === 'draft' && (
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-500/50 hover:text-red-400 transition-all text-xs px-1.5"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── New Release Modal ──────────────────────────────────────── */}
      {showNewRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-lg border p-6 space-y-4" style={{ background: '#0d0d1a', borderColor: 'rgba(255,255,255,0.08)' }}>
            <h2 className="text-base font-black text-white uppercase tracking-wide">New Draft Release</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Version *</label>
                <input
                  type="text"
                  value={newVersion}
                  onChange={e => setNewVersion(e.target.value)}
                  placeholder="e.g. 2.7.0"
                  className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. The AI Drop"
                  className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Summary</label>
                <textarea
                  value={newSummary}
                  onChange={e => setNewSummary(e.target.value)}
                  rows={3}
                  placeholder="One paragraph describing what this release brings."
                  className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Release Type</label>
                <select
                  value={newReleaseType}
                  onChange={e => setNewReleaseType(e.target.value as ReleaseType)}
                  className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                >
                  {RELEASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {createError && <p className="text-sm text-red-400">{createError}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCreateRelease}
                disabled={creating}
                className="flex-1 py-2.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                style={{ background: ORANGE }}
              >
                {creating ? 'Creating…' : 'Create Draft'}
              </button>
              <button
                onClick={() => { setShowNewRelease(false); setCreateError(''); }}
                className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white/50 border border-white/10 hover:border-white/20 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── New Entry Modal ────────────────────────────────────────── */}
      {showNewEntry && selectedRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-xl border p-6 space-y-4" style={{ background: '#0d0d1a', borderColor: 'rgba(255,255,255,0.08)' }}>
            <h2 className="text-base font-black text-white uppercase tracking-wide">
              Add Entry — v{selectedRelease.version}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Title *</label>
                <input
                  type="text"
                  value={eTitle}
                  onChange={e => setETitle(e.target.value)}
                  placeholder="Short one-line description"
                  className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Description</label>
                <textarea
                  value={eDesc}
                  onChange={e => setEDesc(e.target.value)}
                  rows={3}
                  placeholder="Longer explanation (optional, markdown supported in public UI)"
                  className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Type</label>
                  <select
                    value={eType}
                    onChange={e => setEType(e.target.value as EntryType)}
                    className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                  >
                    {ENTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Area</label>
                  <select
                    value={eArea}
                    onChange={e => setEArea(e.target.value as Area)}
                    className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                  >
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ePublic}
                  onChange={e => setEPublic(e.target.checked)}
                  className="accent-orange-500"
                />
                <span className="text-sm text-white/50">Public (shown in the public changelog)</span>
              </label>
            </div>

            {entryError && <p className="text-sm text-red-400">{entryError}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAddEntry}
                disabled={savingEntry}
                className="flex-1 py-2.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                style={{ background: ORANGE }}
              >
                {savingEntry ? 'Adding…' : 'Add Entry'}
              </button>
              <button
                onClick={() => { setShowNewEntry(false); setEntryError(''); }}
                className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white/50 border border-white/10 hover:border-white/20 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
