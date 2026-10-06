'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Flag, Plus, Trash2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import type { FeatureFlag, FeatureTier, FeatureCategory } from '@/hooks/useFeatureFlags';
import {
  ActionButton, AdminPage, AnimatedItem, AnimatedNumber, BarList, Dialog, EmptyState, Field, Meter, PageHeader, Panel,
  Reveal, SearchInput, Segmented, StatGrid, TabSkeleton, Toolbar, fieldClass, SERIES, type Tone,
} from '@/components/admin/kit';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

const TIER_CONFIG: Record<FeatureTier, { label: string; tone: Tone; color: string; ring: string; text: string }> = {
  released: { label: 'Released', tone: 'green', color: '#22c55e', ring: 'bg-emerald-500/15 ring-emerald-500/40', text: 'text-emerald-300' },
  beta: { label: 'Beta', tone: 'amber', color: '#f59e0b', ring: 'bg-amber-500/15 ring-amber-500/40', text: 'text-amber-300' },
  alpha: { label: 'Alpha', tone: 'violet', color: SERIES.violet, ring: 'bg-violet-500/15 ring-violet-500/40', text: 'text-violet-300' },
  disabled: { label: 'Disabled', tone: 'neutral', color: 'rgb(var(--surface-500))', ring: 'bg-surface-700/60 ring-surface-600', text: 'text-surface-300' },
};

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  general: 'General',
  editor: 'Editor',
  collaboration: 'Collaboration',
  production: 'Production',
  community: 'Community',
  ai: 'AI',
  export: 'Export',
  integration: 'Integrations',
};

const TIERS: FeatureTier[] = ['released', 'beta', 'alpha', 'disabled'];
const CATEGORIES: FeatureCategory[] = ['general', 'editor', 'collaboration', 'production', 'community', 'ai', 'export', 'integration'];

export default function FeatureFlagsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTier, setFilterTier] = useState<FeatureTier | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<FeatureCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTier, setNewTier] = useState<FeatureTier>('beta');
  const [newCategory, setNewCategory] = useState<FeatureCategory>('general');

  const [insiderStats, setInsiderStats] = useState({ alpha: 0, beta: 0, total: 0, users: 0 });

  const isAdmin = user && (user.id === ADMIN_UID || user.role === 'admin');

  const fetchFlags = useCallback(async () => {
    const { data } = await supabase.from('feature_flags').select('*').order('category').order('name');
    if (data) setFlags(data);
    setLoading(false);
  }, [supabase]);

  const fetchInsiderStats = useCallback(async () => {
    const [alpha, beta, total, users] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('insider_tier', 'alpha'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('insider_tier', 'beta'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).not('insider_tier', 'is', null),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);
    setInsiderStats({ alpha: alpha.count ?? 0, beta: beta.count ?? 0, total: total.count ?? 0, users: users.count ?? 0 });
  }, [supabase]);

  useEffect(() => {
    if (!authLoading && !isAdmin) { router.push('/dashboard'); return; }
    if (isAdmin) { fetchFlags(); fetchInsiderStats(); }
  }, [authLoading, isAdmin, router, fetchFlags, fetchInsiderStats]);

  const updateTier = async (flagId: string, tier: FeatureTier) => {
    const prev = flags.find((f) => f.id === flagId)?.tier;
    if (prev === tier) return;
    setSaving(flagId);
    setFlags((p) => p.map((f) => (f.id === flagId ? { ...f, tier } : f)));
    const { error } = await supabase.from('feature_flags').update({ tier, updated_at: new Date().toISOString() }).eq('id', flagId);
    if (error) {
      toast.error(error.message);
      if (prev) setFlags((p) => p.map((f) => (f.id === flagId ? { ...f, tier: prev } : f)));
    }
    setSaving(null);
  };

  const addFlag = async () => {
    if (!newKey.trim() || !newName.trim()) return;
    const slug = newKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const { data, error } = await supabase.from('feature_flags')
      .insert({ key: slug, name: newName.trim(), description: newDesc.trim() || null, tier: newTier, category: newCategory })
      .select()
      .single();
    if (data) {
      setFlags((prev) => [...prev, data]);
      setNewKey(''); setNewName(''); setNewDesc(''); setNewTier('beta'); setNewCategory('general');
      setShowAdd(false);
      toast.success('Feature flag added');
    }
    if (error) toast.error(error.message);
  };

  const deleteFlag = async (flagId: string) => {
    if (!confirm('Delete this feature flag?')) return;
    const { error } = await supabase.from('feature_flags').delete().eq('id', flagId);
    if (error) { toast.error(error.message); return; }
    setFlags((prev) => prev.filter((f) => f.id !== flagId));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flags.filter((f) => {
      if (filterTier !== 'all' && f.tier !== filterTier) return false;
      if (filterCategory !== 'all' && f.category !== filterCategory) return false;
      if (q && !`${f.name} ${f.key} ${f.description || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [flags, filterTier, filterCategory, query]);

  const grouped = useMemo(() => filtered.reduce<Record<string, FeatureFlag[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {}), [filtered]);

  if (authLoading || loading) return <TabSkeleton />;
  if (!isAdmin) return null;

  const tierCounts = Object.fromEntries(TIERS.map((t) => [t, flags.filter((f) => f.tier === t).length])) as Record<FeatureTier, number>;
  const toggleTier = (t: FeatureTier) => () => setFilterTier((cur) => (cur === t ? 'all' : t));
  const insiderShare = insiderStats.users ? (insiderStats.total / insiderStats.users) * 100 : 0;

  return (
    <AdminPage>
      <PageHeader
        icon={<Flag className="h-5 w-5" />}
        title="Feature Flags"
        description="Roll features out through alpha, beta and release."
        actions={<ActionButton variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>Add feature</ActionButton>}
      />

      <StatGrid
        cols={4}
        layoutGroup="flags"
        items={TIERS.map((t) => ({
          label: TIER_CONFIG[t].label,
          value: tierCounts[t],
          tone: TIER_CONFIG[t].tone,
          hint: `Show only ${TIER_CONFIG[t].label.toLowerCase()} features`,
          onClick: toggleTier(t),
          active: filterTier === t,
        }))}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Rollout mix" subtitle={`${flags.length} features across all tiers`}>
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-800">
            {TIERS.map((t, i) => (
              <motion.div
                key={t}
                className="h-full"
                style={{ background: TIER_CONFIG[t].color, marginLeft: i ? 2 : 0 }}
                initial={{ width: 0 }}
                animate={{ width: `${flags.length ? (tierCounts[t] / flags.length) * 100 : 0}%` }}
                transition={{ duration: 0.8, delay: 0.1 * i }}
                title={`${TIER_CONFIG[t].label}: ${tierCounts[t]}`}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {TIERS.map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-surface-400">
                <span className="h-2 w-2 rounded-full" style={{ background: TIER_CONFIG[t].color }} />
                {TIER_CONFIG[t].label}
                <span className="ml-auto font-semibold tabular-nums text-white">{flags.length ? Math.round((tierCounts[t] / flags.length) * 100) : 0}%</span>
              </span>
            ))}
          </div>
        </Panel>
        <Panel title="By category" subtitle="Features per area">
          <BarList items={CATEGORIES.map((c) => ({ label: CATEGORY_LABELS[c], count: flags.filter((f) => f.category === c).length })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count)} color={SERIES.violet} limit={6} />
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><Users className="h-4 w-4 text-violet-400" />Insider program</span>} subtitle="Users opted into early tiers">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Alpha', value: insiderStats.alpha, color: TIER_CONFIG.alpha.color },
              { label: 'Beta', value: insiderStats.beta, color: TIER_CONFIG.beta.color },
              { label: 'Total', value: insiderStats.total, color: 'white' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[11px] text-surface-500">{s.label}</p>
                <span style={{ color: s.color }}><AnimatedNumber value={s.value} className="text-xl font-bold" /></span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[11px] text-surface-500">
              <span>Share of all users</span>
              <span className="font-semibold text-surface-200">{insiderShare.toFixed(1)}%</span>
            </div>
            <Meter value={insiderShare} color={SERIES.violet} />
          </div>
        </Panel>
      </div>

      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name, key or description…" />
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as FeatureCategory | 'all')} className={cn(fieldClass, 'w-auto py-2')}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <span className="text-xs text-surface-500 sm:ml-1">{filtered.length} of {flags.length}</span>
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState icon={<Flag className="h-8 w-8" />} title="No features match your filters" description="Clear the search or pick another tier or category." />
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <Reveal key={category}>
            <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-surface-500">
              {CATEGORY_LABELS[category as FeatureCategory] ?? category}
              <span className="rounded bg-surface-800 px-1.5 text-surface-400">{items.length}</span>
            </h3>
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {items.map((flag) => (
                  <AnimatedItem key={flag.id} className="group flex flex-col gap-3 rounded-xl border border-surface-800 bg-surface-900/60 px-4 py-3 transition-colors hover:border-surface-700 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <motion.span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          animate={{ backgroundColor: TIER_CONFIG[flag.tier].color }}
                        />
                        <span className="truncate text-sm font-medium text-white">{flag.name}</span>
                        <code className="hidden rounded bg-surface-800 px-1.5 py-0.5 font-mono text-[11px] text-surface-500 sm:inline">{flag.key}</code>
                      </div>
                      {flag.description && <p className="ml-[18px] mt-0.5 text-xs text-surface-500">{flag.description}</p>}
                      {flag.updated_at && <p className="ml-[18px] mt-0.5 text-[10px] text-surface-500">Updated {timeAgo(flag.updated_at)}</p>}
                    </div>

                    <div className="flex items-center gap-1 rounded-lg border border-surface-800 bg-surface-950/60 p-0.5" role="radiogroup" aria-label={`${flag.name} tier`}>
                      {TIERS.map((t) => {
                        const active = flag.tier === t;
                        return (
                          <button
                            key={t}
                            role="radio"
                            aria-checked={active}
                            onClick={() => updateTier(flag.id, t)}
                            disabled={saving === flag.id}
                            className={cn('relative rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors', active ? TIER_CONFIG[t].text : 'text-surface-500 hover:text-surface-200')}
                          >
                            {active && (
                              <motion.span
                                layoutId={`tier-${flag.id}`}
                                className={cn('absolute inset-0 rounded-md ring-1', TIER_CONFIG[t].ring)}
                                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                              />
                            )}
                            <span className="relative">{TIER_CONFIG[t].label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button onClick={() => deleteFlag(flag.id)} className="self-end p-1.5 text-surface-500 transition-all hover:text-red-400 sm:self-auto sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Delete ${flag.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </AnimatedItem>
                ))}
              </AnimatePresence>
            </ul>
          </Reveal>
        ))
      )}

      <Dialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add feature flag"
        footer={
          <>
            <ActionButton variant="ghost" onClick={() => setShowAdd(false)}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={addFlag} disabled={!newKey.trim() || !newName.trim()}>Add feature</ActionButton>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Feature key">
            <input autoFocus value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="e.g. ai_script_gen" className={cn(fieldClass, 'font-mono')} />
          </Field>
          <Field label="Display name">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. AI Script Generation" className={fieldClass} />
          </Field>
          <Field label="Description">
            <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does this feature do?" rows={2} className={cn(fieldClass, 'resize-none')} />
          </Field>
          <Field label="Tier">
            <Segmented id="new-flag-tier" value={newTier} onChange={setNewTier} options={TIERS.map((t) => ({ key: t, label: TIER_CONFIG[t].label }))} />
          </Field>
          <Field label="Category">
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as FeatureCategory)} className={fieldClass}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </Field>
        </div>
      </Dialog>
    </AdminPage>
  );
}
