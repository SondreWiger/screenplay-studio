'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SubCommunityContext } from '@/lib/SubCommunityContext';
import type { SubCommunity, SubCommunityMember } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const pathname  = usePathname();
  const router    = useRouter();
  const { user }  = useAuth();

  const [community,   setCommunity]   = useState<SubCommunity | null>(null);
  const [membership,  setMembership]  = useState<SubCommunityMember | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);

  const fetch = useCallback(async () => {
    const sb = createClient();
    const { data: comm } = await sb.from('sub_communities').select('*').eq('slug', slug).single();
    if (!comm) { router.replace('/community/c'); return; }
    setCommunity(comm);

    if (user) {
      const { data: mem } = await sb.from('sub_community_members')
        .select('*').eq('community_id', comm.id).eq('user_id', user.id).single();
      setMembership(mem ?? null);
    }
    setLoading(false);
  }, [slug, user, router]);

  useEffect(() => { fetch(); }, [fetch]);

  const isMod   = membership ? ['admin','moderator'].includes(membership.role) : false;
  const isAdmin = membership?.role === 'admin';
  const isBanned = membership?.role === 'banned';
  const canPost  = membership ? (membership.can_post && !isBanned) : false;

  const handleJoin = async () => {
    if (!user || !community) return;
    const sb = createClient();
    setJoinLoading(true);
    try {
      if (membership) {
        if (!isMod && !isAdmin) {
          await sb.from('sub_community_members').delete()
            .eq('community_id', community.id).eq('user_id', user.id);
          setMembership(null);
        }
      } else {
        const role = community.visibility === 'private' ? 'pending_approval' : 'member';
        const can_post = community.posting_mode === 'open';
        const { data } = await sb.from('sub_community_members')
          .insert({ community_id: community.id, user_id: user.id, role, can_post }).select().single();
        setMembership(data ?? null);
      }
    } finally { setJoinLoading(false); }
  };

  const tabs = [
    { href: `/community/c/${slug}`,          label: 'Feed' },
    { href: `/community/c/${slug}/contests`,  label: 'Contests' },
    { href: `/community/c/${slug}/chat`,      label: '💬 Chat' },
    { href: `/community/c/${slug}/about`,     label: 'About' },
    ...(isMod ? [{ href: `/community/c/${slug}/settings`, label: 'Settings' }] : []),
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#070710' }}>
      <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (!community) return null;

  const accent  = community.accent_color ?? '#FF5F1F';
  const gradient = `linear-gradient(135deg, ${accent}44, ${community.accent_color2 ?? accent}22)`;

  return (
    <SubCommunityContext.Provider value={{ community, membership, isMod, isAdmin, isBanned, canPost, refetch: fetch }}>
      <div style={{ background: '#070710', minHeight: '100vh', color: '#fff' }}>

        {/* Banner */}
        <div className="relative w-full overflow-hidden" style={{ height: '7rem', background: gradient }}>
          {community.banner_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={community.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
          )}
        </div>

        {/* Identity bar */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="relative flex items-end gap-4 -mt-8">
            {/* Icon bubble */}
            <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center text-3xl rounded-2xl border-4 z-10"
              style={{ background: accent + '22', borderColor: '#070710', backdropFilter: 'blur(8px)' }}>
              {community.icon ?? '🎬'}
            </div>

            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-lg font-black leading-tight" style={{ letterSpacing: '-0.02em' }}>{community.name}</h2>
              <p className="text-[11px] text-white/40">c/{community.slug}</p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pb-1">
              {canPost && (
                <Link href={`/community/c/${slug}?compose=1`}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:opacity-90"
                  style={{ background: accent }}>
                  + Post
                </Link>
              )}
              {user && !isAdmin && !isMod && (
                <button onClick={handleJoin} disabled={joinLoading}
                  className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border',
                    membership ? 'border-white/20 text-white/70 hover:border-red-400 hover:text-red-400'
                               : 'border-transparent text-white hover:opacity-90')}
                  style={!membership ? { background: accent } : undefined}>
                  {joinLoading ? '…' : membership ? (membership.role === 'pending_approval' ? 'Pending' : 'Leave') : (community.visibility === 'private' ? 'Apply' : 'Join')}
                </button>
              )}
            </div>
          </div>

          {community.description && (
            <p className="text-sm text-white/50 mt-2 max-w-xl">{community.description}</p>
          )}

          {/* Tabs */}
          <nav className="flex gap-1 mt-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {tabs.map(t => {
              const active = pathname === t.href || (t.href !== `/community/c/${slug}` && pathname.startsWith(t.href));
              return (
                <Link key={t.href} href={t.href}
                  className={cn('px-3 py-2 text-xs font-medium relative transition-all',
                    active ? 'text-white' : 'text-white/40 hover:text-white/70')}>
                  {t.label}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: accent }} />
                  )}
                </Link>
              );
            })}
            <div className="ml-auto flex items-center gap-2 pb-1 text-[11px] text-white/35">
              <span>{community.member_count ?? 0} members</span>
              <span>·</span>
              <span>{community.post_count ?? 0} posts</span>
            </div>
          </nav>
        </div>

        {/* Page content */}
        <div className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </div>
      </div>
    </SubCommunityContext.Provider>
  );
}
