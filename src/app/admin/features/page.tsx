'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { FeatureFlag, FeatureTier, FeatureCategory } from '@/hooks/useFeatureFlags';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

const TIER_CONFIG: Record<FeatureTier, { label: string; color: string; bg: string; dot: string }> = {
  released: { label: 'Released', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
  beta: { label: 'Beta', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400' },
  alpha: { label: 'Alpha', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', dot: 'bg-purple-400' },
  disabled: { label: 'Disabled', color: 'text-surface-500', bg: 'bg-surface-800 border-surface-700', dot: 'bg-surface-500' },
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
  const supabase = createClient();

  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTier, setFilterTier] = useState<FeatureTier | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<FeatureCategory | 'all'>('all');
  const [saving, setSaving] = useState<string | null>(null);

  // New flag form
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTier, setNewTier] = useState<FeatureTier>('beta');
  const [newCategory, setNewCategory] = useState<FeatureCategory>('general');

  // Insider stats
  const [insiderStats, setInsiderStats] = useState({ alpha: 0, beta: 0, total: 0 });

  const isAdmin = user && (user.id === ADMIN_UID || user.role === 'admin');

  const fetchFlags = useCallback(async () => {
    const { data } = await supabase.from('feature_flags').select('*').order('category').order('name');
    if (data) setFlags(data);
    setLoading(false);
  }, [supabase]);

  const fetchInsiderStats = useCallback(async () => {
    const { count: alphaCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('insider_tier', 'alpha');
    const { count: betaCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('insider_tier', 'beta');
    const { count: totalCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).not('insider_tier', 'is', null);
    setInsiderStats({ alpha: alphaCount ?? 0, beta: betaCount ?? 0, total: totalCount ?? 0 });
  }, [supabase]);

  useEffect(() => {
    if (!authLoading && !isAdmin) { router.push('/dashboard'); return; }
    if (isAdmin) { fetchFlags(); fetchInsiderStats(); }
  }, [authLoading, isAdmin, router, fetchFlags, fetchInsiderStats]);

  const updateTier = async (flagId: string, tier: FeatureTier) => {
    setSaving(flagId);
    await supabase.from('feature_flags').update({ tier, updated_at: new Date().toISOString() }).eq('id', flagId);
    setFlags((prev) => prev.map((f) => (f.id === flagId ? { ...f, tier } : f)));
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
    }
    if (error) alert(error.message);
  };

  const deleteFlag = async (flagId: string) => {
    if (!confirm('Delete this feature flag?')) return;
    await supabase.from('feature_flags').delete().eq('id', flagId);
    setFlags((prev) => prev.filter((f) => f.id !== flagId));
  };

  const filtered = flags.filter((f) => {
    if (filterTier !== 'all' && f.tier !== filterTier) return false;
    if (filterCategory !== 'all' && f.category !== filterCategory) return false;
    return true;
  });

  // Group by category
  const grouped = filtered.reduce<Record<string, FeatureFlag[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  if (authLoading || loading) {
    return <div className="min-h-screen bg-surface-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!isAdmin) return null;

  const tierCounts = { alpha: flags.filter((f) => f.tier === 'alpha').length, beta: flags.filter((f) => f.tier === 'beta').length, released: flags.filter((f) => f.tier === 'released').length, disabled: flags.filter((f) => f.tier === 'disabled').length };

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-surface-950/90 backdrop-blur-xl border-b border-surface-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-surface-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                Feature Flags
              </h1>
              <p className="text-xs text-surface-500">Manage alpha, beta & release tiers</p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Feature
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TIERS.map((t) => (
            <div key={t} className={`rounded-xl border p-4 ${TIER_CONFIG[t].bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${TIER_CONFIG[t].dot}`} />
                <span className={`text-xs font-medium ${TIER_CONFIG[t].color}`}>{TIER_CONFIG[t].label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{tierCounts[t]}</p>
              <p className="text-[11px] text-surface-500">features</p>
            </div>
          ))}
        </div>

        {/* Insider Users Stats */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-4">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Insider Program Members
          </h3>
          <div className="flex gap-6">
            <div>
              <span className="text-xl font-bold text-purple-400">{insiderStats.alpha}</span>
              <span className="text-xs text-surface-500 ml-1.5">Alpha testers</span>
            </div>
            <div>
              <span className="text-xl font-bold text-amber-400">{insiderStats.beta}</span>
              <span className="text-xs text-surface-500 ml-1.5">Beta testers</span>
            </div>
            <div>
              <span className="text-xl font-bold text-white">{insiderStats.total}</span>
              <span className="text-xs text-surface-500 ml-1.5">Total insiders</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select value={filterTier} onChange={(e) => setFilterTier(e.target.value as any)} className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none">
            <option value="all">All Tiers</option>
            {TIERS.map((t) => <option key={t} value={t}>{TIER_CONFIG[t].label}</option>)}
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)} className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none">
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <span className="text-xs text-surface-500 self-center ml-2">{filtered.length} features</span>
        </div>

        {/* Feature List */}
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">{CATEGORY_LABELS[category as FeatureCategory] ?? category}</h3>
            <div className="space-y-1.5">
              {items.map((flag) => (
                <div key={flag.id} className="rounded-xl border border-surface-800 bg-surface-900/50 px-4 py-3 flex items-center gap-4 group hover:border-surface-700 transition-colors">
                  {/* Tier dot & name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${TIER_CONFIG[flag.tier].dot}`} />
                      <span className="text-sm font-medium text-white truncate">{flag.name}</span>
                      <code className="text-[11px] text-surface-600 bg-surface-800 px-1.5 py-0.5 rounded font-mono hidden sm:inline">{flag.key}</code>
                    </div>
                    {flag.description && <p className="text-xs text-surface-500 mt-0.5 ml-[18px]">{flag.description}</p>}
                  </div>

                  {/* Tier selector */}
                  <div className="flex items-center gap-1">
                    {TIERS.map((t) => (
                      <button
                        key={t}
                        onClick={() => updateTier(flag.id, t)}
                        disabled={saving === flag.id}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                          flag.tier === t
                            ? TIER_CONFIG[t].bg + ' ' + TIER_CONFIG[t].color + ' border-current'
                            : 'bg-transparent border-transparent text-surface-600 hover:text-surface-300 hover:bg-surface-800'
                        }`}
                      >
                        {TIER_CONFIG[t].label}
                      </button>
                    ))}
                  </div>

                  {/* Delete */}
                  <button onClick={() => deleteFlag(flag.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-surface-600 hover:text-red-400 transition-all">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-surface-500">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
            <p className="text-sm">No features match your filters</p>
          </div>
        )}
      </div>

      {/* Add Feature Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Feature Flag
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Feature Key</label>
                <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="e.g. ai_script_gen" className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-600 focus:border-purple-500 focus:outline-none font-mono" />
              </div>
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Display Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. AI Script Generation" className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-600 focus:border-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Description</label>
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does this feature do?" rows={2} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-600 focus:border-purple-500 focus:outline-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-surface-400 mb-1 block">Tier</label>
                  <select value={newTier} onChange={(e) => setNewTier(e.target.value as FeatureTier)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none">
                    {TIERS.map((t) => <option key={t} value={t}>{TIER_CONFIG[t].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-surface-400 mb-1 block">Category</label>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as FeatureCategory)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-surface-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={addFlag} disabled={!newKey.trim() || !newName.trim()} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">Add Feature</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
