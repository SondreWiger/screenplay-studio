'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { SubCommunity } from '@/lib/types';

export default function BrowseCommunitiesPage() {
  const { user } = useAuth();
  const [all,       setAll]       = useState<SubCommunity[]>([]);
  const [mine,      setMine]      = useState<SubCommunity[]>([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [joining,   setJoining]   = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    const sb = createClient();
    const [pubRes, mineRes] = await Promise.all([
      sb.from('sub_communities')
        .select('*')
        .in('visibility', ['public', 'restricted'])
        .order('member_count', { ascending: false })
        .limit(100),
      user
        ? sb.from('sub_community_members').select('community_id, sub_communities(*)').eq('user_id', user.id)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (pubRes.error) console.error('[communities] fetch error:', pubRes.error);
    setAll((pubRes.data ?? []) as SubCommunity[]);
    const mineData = ((mineRes.data ?? []) as any[]).map(r => r.sub_communities).filter(Boolean) as SubCommunity[];
    setMine(mineData);
    setMemberships(new Set(mineData.map(c => c.id)));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const join = async (c: SubCommunity) => {
    if (!user) return;
    setJoining(c.id);
    const sb = createClient();
    const role = c.posting_mode === 'apply_to_post' ? 'pending_approval' : 'member';
    await sb.from('sub_community_members').insert({ community_id: c.id, user_id: user.id, role, can_post: role === 'member' });
    setMemberships(prev => new Set(Array.from(prev).concat(c.id)));
    setMine(prev => [c, ...prev.filter(x => x.id !== c.id)]);
    setJoining(null);
  };

  const leave = async (id: string) => {
    if (!user) return;
    const sb = createClient();
    await sb.from('sub_community_members').delete().eq('community_id', id).eq('user_id', user.id);
    setMemberships(prev => { const s = new Set(Array.from(prev)); s.delete(id); return s; });
    setMine(prev => prev.filter(c => c.id !== id));
  };

  const filtered = all.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
    c.slug.includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: '#070710', color: '#fff' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono text-[#FF5F1F] uppercase tracking-widest mb-1">Communities</p>
            <h1 className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>
              BROWSE COMMUNITIES
            </h1>
            <p className="text-white/40 text-sm mt-1">Find your people. Create your space.</p>
          </div>
          {user && (
            <Link
              href="/community/c/create"
              className="self-start sm:self-auto px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-all hover:opacity-90"
              style={{ background: '#FF5F1F' }}
            >
              + Create Community
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search communities…"
            className="w-full pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 rounded-xl outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
        </div>

        {/* Your communities */}
        {mine.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Your Communities</h2>
            <div className="flex flex-wrap gap-2">
              {mine.map(c => (
                <Link
                  key={c.id}
                  href={`/community/c/${c.slug}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:opacity-80"
                  style={{
                    background: c.accent_color + '22',
                    color: c.accent_color,
                    border: `1px solid ${c.accent_color}44`,
                  }}
                >
                  <span>{c.icon}</span>
                  <span>c/{c.slug}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#FF5F1F]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-white/30 text-sm">{search ? 'No communities match your search.' : 'No communities yet. Be the first!'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(c => {
              const joined = memberships.has(c.id);
              return (
                <div
                  key={c.id}
                  className="rounded-2xl overflow-hidden transition-all hover:translate-y-[-1px]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* Banner */}
                  <div
                    className="h-16 relative"
                    style={{ background: `linear-gradient(135deg, ${c.accent_color}44, ${c.accent_color2 ?? c.accent_color}22)` }}
                  >
                    {c.banner_url && (
                      <img src={c.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <div
                      className="absolute bottom-0 left-4 translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg"
                      style={{ background: '#070710', border: `2px solid ${c.accent_color}` }}
                    >
                      {c.icon}
                    </div>
                  </div>

                  <div className="pt-7 p-4">
                    <Link href={`/community/c/${c.slug}`} className="block group">
                      <h3 className="text-sm font-bold text-white group-hover:text-white/80 transition-colors">{c.name}</h3>
                      <p className="text-[10px] text-white/30 font-mono">c/{c.slug}</p>
                    </Link>
                    {c.description && (
                      <p className="text-xs text-white/45 mt-2 line-clamp-2">{c.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[11px] text-white/25">
                        {c.member_count.toLocaleString()} member{c.member_count !== 1 ? 's' : ''} · {c.post_count} posts
                      </span>
                      {user && (
                        <button
                          onClick={() => joined ? leave(c.id) : join(c)}
                          disabled={joining === c.id}
                          className="px-3 py-1 text-[11px] font-semibold rounded-lg transition-all"
                          style={
                            joined
                              ? { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }
                              : { background: c.accent_color, color: '#fff' }
                          }
                        >
                          {joining === c.id ? '…' : joined ? 'Joined ✓' : 'Join'}
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex gap-1 flex-wrap">
                      <span
                        className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }}
                      >
                        {c.visibility}
                      </span>
                      <span
                        className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }}
                      >
                        {c.posting_mode.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
