'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

interface PostStat {
  id: string;
  slug: string;
  title: string | null;
  upvote_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
  role: 'author' | 'collaborator';
}

interface Props {
  user: Profile;
  onClose: () => void;
}

export function CommunityStatsPanel({ user, onClose }: Props) {
  const [posts, setPosts] = useState<PostStat[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Own posts
      const { data: ownPosts } = await supabase
        .from('community_posts')
        .select('id, slug, title, upvote_count, comment_count, view_count, created_at')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Collaborator posts
      const { data: collabRows } = await supabase
        .from('community_post_collaborators')
        .select('post_id, community_posts(id, slug, title, upvote_count, comment_count, view_count, created_at)')
        .eq('user_id', user.id)
        .limit(20);

      const combined: PostStat[] = [];

      (ownPosts || []).forEach((p) =>
        combined.push({ ...p, role: 'author' })
      );

      (collabRows || []).forEach((row: any) => {
        const p = row.community_posts;
        if (p && !combined.find((x) => x.id === p.id)) {
          combined.push({ ...p, role: 'collaborator' });
        }
      });

      combined.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setPosts(combined);
      setLoading(false);
    }

    load();
  }, [user.id]);

  const totalViews   = posts.reduce((s, p) => s + (p.view_count   || 0), 0);
  const totalVotes   = posts.reduce((s, p) => s + (p.upvote_count || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comment_count || 0), 0);

  return (
    /* Outer anchor so clicks inside don't propagate to the body listener */
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 md:w-96 z-50
                 rounded-xl border border-white/8 shadow-2xl shadow-black/60
                 overflow-hidden flex flex-col"
      style={{ background: '#0e0e12' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name || 'Avatar'}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div
              className="w-8 h-8 flex items-center justify-center text-[11px] font-black text-white rounded-full shrink-0"
              style={{ background: '#FF5F1F' }}
            >
              {(user.full_name || user.email || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-[13px] font-semibold text-white leading-tight">
              {user.full_name || user.username || 'My Stats'}
            </p>
            <p className="text-[10px] text-white/40 font-mono">community stats</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/u/${user.username || user.id}`}
            className="text-[10px] font-mono uppercase tracking-widest text-white/40 hover:text-[#FF5F1F] transition-colors"
            onClick={onClose}
          >
            Profile ↗
          </Link>
          <button
            onClick={onClose}
            className="p-1 text-white/30 hover:text-white/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Totals row */}
      {!loading && (
        <div className="grid grid-cols-3 divide-x divide-white/8 border-b border-white/8">
          {[
            { label: 'Views',    value: totalViews    },
            { label: 'Upvotes',  value: totalVotes    },
            { label: 'Comments', value: totalComments },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center py-3 gap-0.5">
              <span className="text-lg font-black text-white tabular-nums">
                {value.toLocaleString()}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Post list */}
      <div className="overflow-y-auto max-h-72 divide-y divide-white/5">
        {loading && (
          <div className="flex items-center justify-center py-10 text-white/30 text-sm">
            Loading…
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-white/30 text-sm">
            <span>No posts yet.</span>
            <Link
              href="/community/share"
              className="text-[#FF5F1F] text-xs hover:underline"
              onClick={onClose}
            >
              Share something →
            </Link>
          </div>
        )}
        {posts.map((p) => (
          <Link
            key={p.id}
            href={`/community/post/${p.slug}`}
            onClick={onClose}
            className="flex items-start gap-3 px-4 py-3 hover:bg-white/3 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white/80 group-hover:text-white truncate leading-snug">
                {p.title || 'Untitled Post'}
              </p>
              <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-white/30">
                <span>↑ {p.upvote_count || 0}</span>
                <span>💬 {p.comment_count || 0}</span>
                <span>👁 {p.view_count || 0}</span>
                {p.role === 'collaborator' && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold text-green-400"
                    style={{ background: 'rgb(74 222 128 / 0.12)' }}
                  >
                    Collab
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-white/8 flex items-center justify-between">
        <Link
          href="/community"
          className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors"
          onClick={onClose}
        >
          All posts ↗
        </Link>
        <span className="text-[10px] font-mono text-white/20">
          {posts.length} post{posts.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
