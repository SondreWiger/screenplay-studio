'use client';

/**
 * /admin/changelog — Changelog Release Manager
 * Create draft releases, add individual entries, and publish.
 * Admin-only (enforced by RLS — only admin UUID can write; redirected if not admin).
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Rocket, ScrollText, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn, timeAgo } from '@/lib/utils';
import {
  ActionButton, AdminPage, AnimatedItem, BarList, Dialog, Dots, EmptyState, Field, PageHeader, Panel, Pill,
  SearchInput, Segmented, StatGrid, TabSkeleton, TrendPanel, fieldClass, tally, type Tone,
} from '@/components/admin/kit';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

// Types

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

// Helpers

const STATUS_TONE: Record<ReleaseStatus, Tone> = { draft: 'amber', published: 'green', yanked: 'red' };
const RELEASE_TONE: Record<ReleaseType, Tone> = { major: 'brand', minor: 'blue', patch: 'neutral', hotfix: 'red' };
const TYPE_TONE: Record<EntryType, Tone> = {
  feature: 'brand',
  improvement: 'violet',
  fix: 'green',
  performance: 'amber',
  security: 'red',
  breaking: 'red',
  deprecation: 'amber',
  internal: 'neutral',
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

  // List filters
  const [statusFilter, setStatusFilter] = useState<ReleaseStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all');

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user || user.id !== ADMIN_UID) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  // Data loading
  const loadData = useCallback(async () => {
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

  // Create release
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

  // Add entry
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

  // Delete entry
  async function handleDeleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return;
    const supabase = createClient();
    await supabase.from('changelog_entries').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    // Refresh release counts
    await loadData();
  }

  // Publish release
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

  // Delete release
  async function handleDeleteRelease(id: string, version: string) {
    if (!confirm(`Delete release v${version} and ALL its entries? This cannot be undone.`)) return;
    const supabase = createClient();
    await supabase.from('changelog_releases').delete().eq('id', id);
    setReleases(prev => prev.filter(r => r.id !== id));
    setEntries(prev => prev.filter(e => e.release_id !== id));
    if (selectedId === id) setSelectedId(releases.find(r => r.id !== id)?.id || null);
  }

  // UI
  if (authLoading || loading) return <TabSkeleton />;

  const selectedRelease = releases.find(r => r.id === selectedId) || null;
  const selectedEntries = entries.filter(e => e.release_id === selectedId).sort((a, b) => a.sort_order - b.sort_order);
  const visibleEntries = selectedEntries.filter(e => typeFilter === 'all' || e.entry_type === typeFilter);
  const q = query.trim().toLowerCase();
  const visibleReleases = releases.filter(r =>
    (statusFilter === 'all' || r.status === statusFilter) &&
    (!q || `${r.version} ${r.title} ${r.summary || ''}`.toLowerCase().includes(q)));
  const published = releases.filter(r => r.status === 'published');
  const drafts = releases.filter(r => r.status === 'draft');
  const releaseById = new Map(releases.map(r => [r.id, r]));
  const toggleStatus = (st: ReleaseStatus) => () => setStatusFilter(cur => (cur === st ? 'all' : st));

  return (
    <AdminPage>
      <PageHeader
        icon={<ScrollText className="h-5 w-5" />}
        title="Changelog"
        description="Draft releases, add entries, publish to the public changelog."
        meta={published[0]?.released_at ? <>Latest: <span className="font-mono text-surface-300">v{published[0].version}</span> · {timeAgo(published[0].released_at)}</> : undefined}
        actions={
          <ActionButton variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => { setShowNewRelease(true); setCreateError(''); }}>
            New release
          </ActionButton>
        }
      />

      <StatGrid
        cols={4}
        layoutGroup="changelog"
        items={[
          { label: 'Releases', value: releases.length, tone: 'brand', onClick: () => setStatusFilter('all'), active: statusFilter === 'all' },
          { label: 'Published', value: published.length, tone: 'green', onClick: toggleStatus('published'), active: statusFilter === 'published' },
          { label: 'Drafts', value: drafts.length, tone: 'amber', onClick: toggleStatus('draft'), active: statusFilter === 'draft' },
          { label: 'Entries', value: entries.length, tone: 'violet', hint: `${entries.filter(e => !e.is_public).length} internal` },
        ]}
      />

      {releases.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-5">
          <TrendPanel
            id="changelog"
            className="lg:col-span-3"
            title="Shipping cadence"
            subtitle="Releases published over time"
            defaultRange="1y"
            sources={[{ key: 'published', label: 'Releases published', rows: releases, time: r => r.released_at }]}
          />
          <Panel title="What ships" subtitle="All entries, by type" className="lg:col-span-2">
            <BarList items={tally(entries, e => e.entry_type)} limit={6} />
            <div className="mt-4 border-t border-surface-800 pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-surface-500">Most-changed areas</p>
              <div className="flex flex-wrap gap-1.5">
                {tally(entries.filter(e => releaseById.get(e.release_id)?.status === 'published'), e => e.area).slice(0, 10).map(a => (
                  <Pill key={a.label}>{a.label.replace(/_/g, ' ')} <span className="text-white">{a.count}</span></Pill>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Release list */}
        <Panel title="Releases" subtitle={`${visibleReleases.length} shown`} bodyClassName="space-y-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Version or title…" />
          <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1 lg:max-h-[calc(100vh-260px)]">
            {visibleReleases.length === 0 && <p className="py-6 text-center text-xs text-surface-600">No releases match</p>}
            {visibleReleases.map(r => {
              const active = selectedId === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => { setSelectedId(r.id); setTypeFilter('all'); }}
                  className={cn('relative w-full rounded-xl border p-3 text-left transition-colors', active ? 'border-transparent' : 'border-surface-800 hover:border-surface-700 hover:bg-surface-800/30')}
                >
                  {active && (
                    <motion.span layoutId="release-active" className="absolute inset-0 rounded-xl bg-brand-500/10 ring-1 ring-brand-500/40" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
                  )}
                  <span className="relative block">
                    <span className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-white">v{r.version}</span>
                      <Pill tone={STATUS_TONE[r.status]} dot>{r.status}</Pill>
                    </span>
                    <span className="block truncate text-xs text-surface-400">{r.title}</span>
                    <span className="mt-1.5 flex items-center gap-2 text-[11px] text-surface-500">
                      <Pill tone={RELEASE_TONE[r.release_type]}>{r.release_type}</Pill>
                      {r.feature_count + r.improvement_count + r.fix_count} changes
                      <span className="ml-auto">{timeAgo(r.released_at || r.created_at)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* Release detail */}
        <AnimatePresence mode="wait">
          {!selectedRelease ? (
            <EmptyState icon={<ScrollText className="h-8 w-8" />} title="Select a release" description="Pick a release on the left, or create a new draft." />
          ) : (
            <motion.div key={selectedRelease.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }} className="space-y-5">
              <Panel>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h2 className="font-mono text-2xl font-bold text-white">v{selectedRelease.version}</h2>
                      <Pill tone={STATUS_TONE[selectedRelease.status]} dot>{selectedRelease.status}</Pill>
                      <Pill tone={RELEASE_TONE[selectedRelease.release_type]}>{selectedRelease.release_type}</Pill>
                    </div>
                    <p className="text-lg font-semibold text-surface-200">{selectedRelease.title}</p>
                    {selectedRelease.summary && <p className="mt-1 max-w-2xl text-sm text-surface-400">{selectedRelease.summary}</p>}
                    <p className="mt-2 text-xs text-surface-500">
                      {selectedRelease.released_at ? `Released ${new Date(selectedRelease.released_at).toLocaleDateString()}` : `Drafted ${timeAgo(selectedRelease.created_at)}`}
                    </p>
                  </div>
                  {selectedRelease.status === 'draft' && (
                    <div className="flex shrink-0 items-center gap-2">
                      <ActionButton variant="success" icon={<Rocket className="h-4 w-4" />} onClick={() => handlePublish(selectedRelease.version)} disabled={!!publishing}>
                        {publishing === selectedRelease.version ? <>Publishing <Dots /></> : 'Publish'}
                      </ActionButton>
                      <ActionButton variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => handleDeleteRelease(selectedRelease.id, selectedRelease.version)}>
                        Delete
                      </ActionButton>
                    </div>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-surface-800 pt-4">
                  {[
                    { label: 'Features', value: selectedRelease.feature_count, tone: TYPE_TONE.feature },
                    { label: 'Improvements', value: selectedRelease.improvement_count, tone: TYPE_TONE.improvement },
                    { label: 'Fixes', value: selectedRelease.fix_count, tone: TYPE_TONE.fix },
                  ].map(x => (
                    <div key={x.label}>
                      <p className="text-[11px] text-surface-500">{x.label}</p>
                      <p className="text-xl font-bold tabular-nums text-white">{x.value}</p>
                    </div>
                  ))}
                </div>
                {publishError && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{publishError}</p>}
              </Panel>

              <Panel
                title={`${selectedEntries.length} entries`}
                action={selectedRelease.status === 'draft' ? (
                  <ActionButton icon={<Plus className="h-4 w-4" />} onClick={() => { setShowNewEntry(true); setEntryError(''); }}>Add entry</ActionButton>
                ) : null}
              >
                {selectedEntries.length > 0 && (
                  <div className="mb-3">
                    <Segmented
                      id="entry-type"
                      size="sm"
                      value={typeFilter}
                      onChange={setTypeFilter}
                      options={[{ key: 'all' as const, label: 'All' }, ...ENTRY_TYPES.filter(t => selectedEntries.some(e => e.entry_type === t)).map(t => ({ key: t, label: t }))]}
                    />
                  </div>
                )}
                {visibleEntries.length === 0 ? (
                  <EmptyState title="No entries yet" description={selectedRelease.status === 'draft' ? 'Add the first change to this release.' : undefined} />
                ) : (
                  <ul className="space-y-2">
                    <AnimatePresence initial={false}>
                      {visibleEntries.map(entry => (
                        <AnimatedItem key={entry.id} className="group flex items-start gap-3 rounded-xl border border-surface-800 p-3 transition-colors hover:border-surface-700">
                          <div className="w-28 shrink-0"><Pill tone={TYPE_TONE[entry.entry_type]} dot>{entry.entry_type}</Pill></div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">{entry.title}</p>
                            {entry.description && <p className="mt-0.5 line-clamp-2 text-xs text-surface-400">{entry.description}</p>}
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-[11px] uppercase text-surface-500">{entry.area.replace(/_/g, ' ')}</span>
                              {!entry.is_public && <Pill tone="amber">internal</Pill>}
                            </div>
                          </div>
                          {selectedRelease.status === 'draft' && (
                            <button onClick={() => handleDeleteEntry(entry.id)} className="p-1 text-surface-600 transition-all hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100" aria-label="Delete entry">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </AnimatedItem>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog
        open={showNewRelease}
        onClose={() => { setShowNewRelease(false); setCreateError(''); }}
        title="New draft release"
        footer={
          <>
            <ActionButton variant="ghost" onClick={() => { setShowNewRelease(false); setCreateError(''); }}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handleCreateRelease} disabled={creating}>{creating ? <>Creating <Dots /></> : 'Create draft'}</ActionButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Version *">
              <input autoFocus value={newVersion} onChange={e => setNewVersion(e.target.value)} placeholder="e.g. 2.7.0" className={cn(fieldClass, 'font-mono')} />
            </Field>
            <Field label="Release type">
              <select value={newReleaseType} onChange={e => setNewReleaseType(e.target.value as ReleaseType)} className={fieldClass}>
                {RELEASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Title *">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. The AI Drop" className={fieldClass} />
          </Field>
          <Field label="Summary">
            <textarea value={newSummary} onChange={e => setNewSummary(e.target.value)} rows={3} placeholder="One paragraph describing what this release brings." className={cn(fieldClass, 'resize-none')} />
          </Field>
          {createError && <p className="text-sm text-red-400">{createError}</p>}
        </div>
      </Dialog>

      <Dialog
        open={showNewEntry && !!selectedRelease}
        onClose={() => { setShowNewEntry(false); setEntryError(''); }}
        title={`Add entry — v${selectedRelease?.version ?? ''}`}
        size="lg"
        footer={
          <>
            <ActionButton variant="ghost" onClick={() => { setShowNewEntry(false); setEntryError(''); }}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handleAddEntry} disabled={savingEntry}>{savingEntry ? <>Adding <Dots /></> : 'Add entry'}</ActionButton>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title *">
            <input autoFocus value={eTitle} onChange={e => setETitle(e.target.value)} placeholder="Short one-line description" className={fieldClass} />
          </Field>
          <Field label="Description">
            <textarea value={eDesc} onChange={e => setEDesc(e.target.value)} rows={3} placeholder="Longer explanation (optional, markdown supported in public UI)" className={cn(fieldClass, 'resize-none')} />
          </Field>
          <Field label="Type">
            <div className="flex flex-wrap gap-1.5">
              {ENTRY_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setEType(t)} className={cn('rounded-lg transition-opacity', eType === t ? 'opacity-100 ring-1 ring-white/30' : 'opacity-50 hover:opacity-90')}>
                  <Pill tone={TYPE_TONE[t]} dot>{t}</Pill>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Area">
            <select value={eArea} onChange={e => setEArea(e.target.value as Area)} className={fieldClass}>
              {AREAS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={ePublic} onChange={e => setEPublic(e.target.checked)} className="accent-brand-500" />
            <span className="text-sm text-surface-300">Public (shown in the public changelog)</span>
          </label>
          {entryError && <p className="text-sm text-red-400">{entryError}</p>}
        </div>
      </Dialog>
    </AdminPage>
  );
}
