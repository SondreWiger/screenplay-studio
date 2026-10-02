'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Input } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import type { UserRow, ContributorRow } from '../types';
import { toast } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAdminData } from '../data';
import { TabSkeleton } from '../motion';

const CONTRIBUTOR_AREA_OPTIONS = ['Code', 'Design', 'Docs', 'Testing', 'Community', 'Translation'];

export function ContributorsTab({ contributors, onRemove, onAdd, onToggleFeatured }: {
  contributors: ContributorRow[];
  onRemove: (id: string) => void;
  onAdd: (userId: string, github: string, bio: string, areas: string[]) => Promise<void>;
  onToggleFeatured: (id: string, featured: boolean) => void;
}) {
  const [filter, setFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [github, setGithub] = useState('');
  const [bio, setBio] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setUserResults([]); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, display_name, avatar_url, role, is_pro, pro_since, created_at, updated_at')
      .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
      .limit(10);
    setUserResults((data || []) as UserRow[]);
  };

  const handleAdd = async () => {
    if (!selectedUser) return;
    setSaving(true);
    await onAdd(selectedUser.id, github, bio, areas);
    setSaving(false);
    setShowAddForm(false);
    setSelectedUser(null);
    setUserQuery('');
    setGithub('');
    setBio('');
    setAreas([]);
    setUserResults([]);
  };

  const filtered = contributors.filter(c =>
    !filter ||
    (c.cached_name || '').toLowerCase().includes(filter.toLowerCase()) ||
    (c.github_handle || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Contributors</h1>
          <p className="text-sm text-surface-400 mt-1">
            Manage contributors listed on the{' '}
            <a href="/contribute" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">/contribute</a>{' '}
            and{' '}
            <a href="/about" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">/about</a>{' '}
            pages. Featured contributors appear highlighted.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="https://github.com/SondreWiger/screenplay-studio/graphs/contributors"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-surface-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            GitHub Contributors
          </a>
          <Button onClick={() => setShowAddForm(v => !v)} size="sm">
            {showAddForm ? 'Cancel' : '+ Add Contributor'}
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="mb-6 rounded-xl border border-brand-500/20 p-5" style={{ background: 'rgba(255,95,31,0.04)' }}>
          <h3 className="text-sm font-semibold text-white mb-4">Add Contributor</h3>
          <div className="space-y-4">

            {/* User search */}
            <div>
              <label className="text-xs text-surface-400 block mb-1.5">Search user by name or email</label>
              <Input
                value={userQuery}
                onChange={e => { setUserQuery(e.target.value); searchUsers(e.target.value); }}
                placeholder="john@example.com"
              />
              {userResults.length > 0 && !selectedUser && (
                <div className="mt-1 rounded-lg border border-surface-700 bg-surface-900 divide-y divide-surface-800 max-h-44 overflow-y-auto">
                  {userResults.map(u => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setUserResults([]); setUserQuery(u.email); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-800 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {(u.full_name || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-white">{u.full_name || '—'}</p>
                        <p className="text-xs text-surface-500">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedUser && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-500/25" style={{ background: 'rgba(255,95,31,0.08)' }}>
                  <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
                    {(selectedUser.full_name || selectedUser.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{selectedUser.full_name || selectedUser.email}</p>
                    <p className="text-[11px] text-surface-500 truncate">{selectedUser.email}</p>
                  </div>
                  <button onClick={() => { setSelectedUser(null); setUserQuery(''); }} className="text-xs text-surface-500 hover:text-white ml-1">✕</button>
                </div>
              )}
            </div>

            {/* GitHub + Bio */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-surface-400 block mb-1.5">GitHub handle <span className="text-surface-600">(optional)</span></label>
                <Input value={github} onChange={e => setGithub(e.target.value)} placeholder="e.g. johndoe" />
              </div>
              <div>
                <label className="text-xs text-surface-400 block mb-1.5">Short bio <span className="text-surface-600">(optional)</span></label>
                <Input value={bio} onChange={e => setBio(e.target.value)} placeholder="e.g. Frontend dev" />
              </div>
            </div>

            {/* Contribution areas */}
            <div>
              <label className="text-xs text-surface-400 block mb-2">Contribution areas</label>
              <div className="flex flex-wrap gap-2">
                {CONTRIBUTOR_AREA_OPTIONS.map(a => (
                  <button
                    key={a}
                    onClick={() => setAreas(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                    className={cn(
                      'px-3 py-1 text-[11px] font-medium rounded-full border transition-colors',
                      areas.includes(a)
                        ? 'bg-brand-500/20 text-brand-500 border-brand-500/30'
                        : 'bg-surface-900 text-surface-400 border-surface-700 hover:border-surface-500'
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button onClick={() => setShowAddForm(false)} className="text-sm text-surface-400 hover:text-white transition-colors">Cancel</button>
              <Button onClick={handleAdd} disabled={!selectedUser || saving} size="sm">
                {saving ? 'Adding...' : 'Add Contributor'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-5">
        <Input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by name, email or GitHub handle…"
          className="max-w-sm"
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-5">
        <span className="text-sm text-surface-400">{contributors.length} total</span>
        <span className="text-surface-700">·</span>
        <span className="text-sm text-surface-400">{contributors.filter(c => c.is_featured).length} featured</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-3">🔶</div>
          <p className="text-sm text-surface-400">
            {contributors.length === 0
              ? 'No contributors yet. Add someone above to get started.'
              : 'No contributors match your filter.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden">
                  {c.cached_avatar_url
                    ? <img src={c.cached_avatar_url} className="w-full h-full object-cover" alt="" loading="lazy" />
                    : (c.cached_name || '?')[0].toUpperCase()
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {c.cached_name || '—'}
                  </p>
                  {c.github_handle && (
                    <a
                      href={`https://github.com/${c.github_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-brand-500 hover:underline"
                    >
                      @{c.github_handle}
                    </a>
                  )}
                  {c.bio && <p className="text-[11px] text-surface-400 mt-0.5 truncate max-w-md">{c.bio}</p>}
                  {c.contribution_areas?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.contribution_areas.map(a => (
                        <span key={a} className="px-1.5 py-0.5 text-[11px] font-medium rounded bg-surface-800 text-surface-400 border border-surface-700">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onToggleFeatured(c.id, !c.is_featured)}
                    title={c.is_featured ? 'Remove featured' : 'Mark as featured'}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                      c.is_featured
                        ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25 hover:bg-yellow-500/8'
                        : 'bg-surface-900 text-surface-500 border-surface-700 hover:border-surface-500 hover:text-white'
                    )}
                  >
                    {c.is_featured ? '⭐ Featured' : '☆ Feature'}
                  </button>
                  <span className="text-[11px] text-surface-600 hidden sm:inline">{formatDate(c.added_at)}</span>
                  <button
                    onClick={() => onRemove(c.id)}
                    title="Remove contributor"
                    className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContributorsPanel() {
  const { user } = useAuth();
  const { data: contributors, loading, mutate } = useAdminData<ContributorRow[]>('contributors', async () => {
    const { data, error } = await createClient().from('contributors').select('*').order('added_at', { ascending: false });
    if (error) {
      toast.error('Contributors: ' + error.message);
      return [];
    }
    return (data || []) as ContributorRow[];
  }, []);

  const handleAdd = async (userId: string, github: string, bio: string, areas: string[]) => {
    if (!user) return;
    const supabase = createClient();
    // Cache profile details for join-free public display
    const { data: profile } = await supabase.from('profiles').select('full_name, display_name, avatar_url').eq('id', userId).single();
    const { data, error } = await supabase
      .from('contributors')
      .insert({
        user_id: userId,
        github_handle: github || null,
        bio: bio || null,
        contribution_areas: areas,
        cached_name: profile?.full_name || profile?.display_name || null,
        cached_avatar_url: profile?.avatar_url || null,
        added_by: user.id,
      })
      .select('*')
      .single();
    if (error) {
      toast.error(`Failed to add contributor: ${error.message}`);
      return;
    }
    if (data) mutate((prev) => [data as ContributorRow, ...prev]);
    toast.success('Contributor added!');
  };

  const handleRemove = async (id: string) => {
    const { error } = await createClient().from('contributors').delete().eq('id', id);
    if (error) { toast.error('Failed to remove: ' + error.message); return; }
    mutate((prev) => prev.filter((c) => c.id !== id));
    toast.success('Contributor removed');
  };

  const handleToggleFeatured = async (id: string, featured: boolean) => {
    const { error } = await createClient().from('contributors').update({ is_featured: featured }).eq('id', id);
    if (error) { toast.error('Failed to update: ' + error.message); return; }
    mutate((prev) => prev.map((c) => (c.id === id ? { ...c, is_featured: featured } : c)));
  };

  if (loading) return <TabSkeleton />;
  return <ContributorsTab contributors={contributors} onRemove={handleRemove} onAdd={handleAdd} onToggleFeatured={handleToggleFeatured} />;
}
