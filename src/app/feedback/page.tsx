'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { cn, timeAgo } from '@/lib/utils';
import {
  Bug, Lightbulb, ChevronUp, MessageSquare, Search, Plus,
  Filter, TrendingUp, Clock, CheckCircle2, CircleDot,
  Hammer, XCircle, BookMarked, AlertTriangle, Tag, Sparkles,
  ArrowRight, Star,
} from 'lucide-react';
import { toast } from '@/components/ui';
import { FeedbackSubmitModal } from '@/components/feedback/FeedbackSubmitModal';
import { SiteVersion } from '@/components/SiteVersion';

export type FeedbackStatus = 'open' | 'in_progress' | 'planned' | 'resolved' | 'wont_fix' | 'intended' | 'duplicate' | 'pending_review';
export type FeedbackType   = 'bug_report' | 'feature_request' | 'testimonial' | 'other';
export type FeedbackSort   = 'votes' | 'newest' | 'updated' | 'comments';

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  title: string;
  body: string;
  status: FeedbackStatus;
  priority: string;
  vote_count: number;
  comment_count: number;
  tags: string[];
  user_id: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_META: Record<FeedbackStatus, { label: string; color: string; icon: React.ElementType }> = {
  open:           { label: 'Open',           color: '#3b82f6', icon: CircleDot      },
  in_progress:    { label: 'In Progress',    color: '#f59e0b', icon: Hammer         },
  planned:        { label: 'Planned',        color: '#8b5cf6', icon: BookMarked     },
  resolved:       { label: 'Resolved',       color: '#22c55e', icon: CheckCircle2   },
  wont_fix:       { label: "Won't Fix",      color: '#6b7280', icon: XCircle        },
  intended:       { label: 'Intended',       color: '#6b7280', icon: BookMarked     },
  duplicate:      { label: 'Duplicate',      color: '#6b7280', icon: Tag            },
  pending_review: { label: 'Under Review',   color: '#f97316', icon: AlertTriangle  },
};

export const TYPE_META: Record<FeedbackType, { label: string; icon: React.ElementType; color: string }> = {
  bug_report:      { label: 'Bug',     icon: Bug,         color: '#ef4444' },
  feature_request: { label: 'Feature', icon: Lightbulb,   color: '#f59e0b' },
  testimonial:     { label: 'Review',  icon: Star,        color: '#8b5cf6' },
  other:           { label: 'Other',   icon: MessageSquare, color: '#6b7280' },
};

const ORANGE = '#FF5F1F';

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
      style={{ background: m.color + '22', color: m.color }}
    >
      <Icon size={10} />
      {m.label}
    </span>
  );
}

function TypeBadge({ type }: { type: FeedbackType }) {
  const m = TYPE_META[type];
  const Icon = m.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
      style={{ background: m.color + '22', color: m.color }}
    >
      <Icon size={10} />
      {m.label}
    </span>
  );
}

function FeedbackCard({ item, userVoted, onVote }: {
  item: FeedbackItem;
  userVoted: boolean;
  onVote: (id: string) => void;
}) {
  return (
    <div className="group flex gap-4 p-4 rounded-xl border border-surface-800 bg-surface-900/60 hover:border-surface-700 hover:bg-surface-900 transition-all duration-150">
      {/* Vote button */}
      <button
        onClick={(e) => { e.stopPropagation(); onVote(item.id); }}
        className={cn(
          'flex flex-col items-center justify-center min-w-[44px] py-2 px-1 rounded-lg border text-xs font-black transition-all duration-150 shrink-0',
          userVoted
            ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 text-[#FF5F1F]'
            : 'border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-500 hover:text-white'
        )}
        title={userVoted ? 'Remove vote' : 'Upvote'}
      >
        <ChevronUp size={14} className={cn('transition-transform', userVoted && '-translate-y-px')} />
        <span className="text-[11px] leading-none mt-0.5">{item.vote_count}</span>
      </button>

      {/* Content */}
      <Link href={`/feedback/${item.id}`} className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <TypeBadge type={item.type} />
          <StatusBadge status={item.status} />
          {item.tags?.slice(0, 2).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-surface-800 text-surface-500 font-mono">
              {tag}
            </span>
          ))}
        </div>
        <h3 className="text-sm font-semibold text-white group-hover:text-[#FF5F1F] transition-colors line-clamp-2 leading-snug mb-1">
          {item.title}
        </h3>
        <p className="text-xs text-surface-500 line-clamp-2 leading-relaxed mb-2">{item.body}</p>
        <div className="flex items-center gap-3 text-[10px] text-surface-600">
          <span className="flex items-center gap-1">
            <MessageSquare size={10} /> {item.comment_count} comments
          </span>
          <span>·</span>
          <span>{timeAgo(item.created_at)}</span>
        </div>
      </Link>
    </div>
  );
}

export default function FeedbackPage() {
  const { user, signOut, initialized } = useAuthStore();
  const router = useRouter();

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const [typeFilter, setTypeFilter] = useState<FeedbackType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all' | 'active'>('active');
  const [sort, setSort] = useState<FeedbackSort>('votes');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [showSubmit, setShowSubmit] = useState(false);
  const [stats, setStats] = useState({ open: 0, in_progress: 0, resolved_30d: 0 });

  const PAGE_SIZE = 15;

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    const supabase = createClient();
    const offset = reset ? 0 : page * PAGE_SIZE;

    let q = supabase
      .from('feedback_items')
      .select('id,type,title,body,status,priority,vote_count,comment_count,tags,user_id,author_name,created_at,updated_at', { count: 'exact' })
      .eq('is_public', true)
      .neq('type', 'testimonial');

    if (typeFilter !== 'all') q = q.eq('type', typeFilter);

    if (statusFilter === 'active') {
      q = q.in('status', ['open', 'in_progress', 'planned', 'pending_review']);
    } else if (statusFilter !== 'all') {
      q = q.eq('status', statusFilter);
    }

    if (search) {
      q = q.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
    }

    switch (sort) {
      case 'votes':    q = q.order('vote_count', { ascending: false }); break;
      case 'newest':   q = q.order('created_at', { ascending: false }); break;
      case 'updated':  q = q.order('updated_at', { ascending: false }); break;
      case 'comments': q = q.order('comment_count', { ascending: false }); break;
    }

    q = q.range(offset, offset + PAGE_SIZE - 1);

    const { data, count, error } = await q;
    if (!error) {
      reset ? setItems(data ?? []) : setItems(prev => [...prev, ...(data ?? [])]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [typeFilter, statusFilter, sort, search, page]);

  const loadStats = useCallback(async () => {
    const supabase = createClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [open, inProg, resolved] = await Promise.all([
      supabase.from('feedback_items').select('id', { count: 'exact', head: true }).eq('status', 'open').neq('type', 'testimonial'),
      supabase.from('feedback_items').select('id', { count: 'exact', head: true }).eq('status', 'in_progress').neq('type', 'testimonial'),
      supabase.from('feedback_items').select('id', { count: 'exact', head: true }).eq('status', 'resolved').gte('updated_at', thirtyDaysAgo),
    ]);
    setStats({
      open: open.count ?? 0,
      in_progress: inProg.count ?? 0,
      resolved_30d: resolved.count ?? 0,
    });
  }, []);

  const loadVotes = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase.from('feedback_votes').select('item_id').eq('user_id', user.id);
    if (data) setVotedIds(new Set(data.map(v => v.item_id)));
  }, [user]);

  useEffect(() => { setPage(0); load(true); }, [typeFilter, statusFilter, sort, search]);
  useEffect(() => { loadStats(); loadVotes(); }, []);

  const handleVote = async (itemId: string) => {
    if (!initialized) return;
    if (!user) { toast('Sign in to vote', 'info'); router.push('/auth/login'); return; }
    const supabase = createClient();
    const hasVoted = votedIds.has(itemId);
    if (hasVoted) {
      await supabase.from('feedback_votes').delete().eq('item_id', itemId).eq('user_id', user.id);
      setVotedIds(p => { const n = new Set(Array.from(p)); n.delete(itemId); return n; });
      setItems(p => p.map(i => i.id === itemId ? { ...i, vote_count: Math.max(0, i.vote_count - 1) } : i));
    } else {
      await supabase.from('feedback_votes').insert({ item_id: itemId, user_id: user.id });
      setVotedIds(p => new Set([...Array.from(p), itemId]));
      setItems(p => p.map(i => i.id === itemId ? { ...i, vote_count: i.vote_count + 1 } : i));
    }
  };

  const handleSearchInput = (v: string) => {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(v), 400);
  };

  const SORT_OPTS: { value: FeedbackSort; label: string; icon: React.ElementType }[] = [
    { value: 'votes',    label: 'Most Voted',    icon: TrendingUp     },
    { value: 'newest',   label: 'Newest',         icon: Clock          },
    { value: 'updated',  label: 'Recently Updated', icon: Sparkles     },
    { value: 'comments', label: 'Most Discussed', icon: MessageSquare  },
  ];

  const STATUS_FILTERS: { value: FeedbackStatus | 'all' | 'active'; label: string }[] = [
    { value: 'active',   label: 'Active' },
    { value: 'all',      label: 'All' },
    { value: 'open',     label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'planned',  label: 'Planned' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'wont_fix', label: "Won't Fix" },
  ];

  return (
    <div className="min-h-screen bg-surface-950 text-white">

      {/* Nav */}
      <nav
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(7,7,16,0.9)' }}
      >
        <div className="max-w-screen-lg mx-auto px-6 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 flex items-center justify-center shrink-0" style={{ background: '#FF5F1F' }}>
              <span className="font-black text-white text-[10px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/40 uppercase tracking-widest group-hover:text-white/70 transition-colors">
              Screenplay Studio
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-6">
            <span className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: '#FF5F1F' }}>Feedback</span>
            <Link href="/blog" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">Blog</Link>
            <Link href="/community" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">Community</Link>
            {user ? (
              <>
                <Link href="/dashboard" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">Dashboard</Link>
                <button onClick={() => signOut()} className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">Sign Out</button>
                <div className="flex items-center">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name ?? 'Avatar'} className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: '#FF5F1F' }}>
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login?redirect=/feedback" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">Sign In</Link>
                <Link href="/auth/register?redirect=/feedback" className="ss-btn-orange" style={{ padding: '0.35rem 0.9rem', fontSize: '10px' }}>Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="border-b border-surface-800">
        <div className="max-w-screen-lg mx-auto px-6 py-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Link href="/" className="text-[10px] font-bold uppercase tracking-widest text-surface-500 hover:text-white transition-colors">
                  Screenplay Studio
                </Link>
                <span className="text-surface-700">/</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF5F1F]">Feedback</span>
              </div>
              <h1 className="text-4xl font-black tracking-tight mb-2">Feedback & Roadmap</h1>
              <p className="text-surface-400 text-sm max-w-xl leading-relaxed">
                Report bugs, request features, and follow what&apos;s being built. Your input shapes the product directly.
              </p>
            </div>
            <button
              onClick={() => setShowSubmit(true)}
              className="flex items-center gap-2 px-5 py-3 font-bold text-sm text-white transition-all hover:-translate-y-px"
              style={{ background: ORANGE }}
            >
              <Plus size={16} /> Submit Feedback
            </button>
          </div>

          {/* Stats strip */}
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-sm">
            {[
              { label: 'Open',        val: stats.open,         color: '#3b82f6' },
              { label: 'In Progress', val: stats.in_progress,  color: '#f59e0b' },
              { label: 'Fixed (30d)', val: stats.resolved_30d, color: '#22c55e' },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-surface-800 bg-surface-900 px-3 py-2.5 text-center">
                <div className="text-2xl font-black" style={{ color: s.color }}>{s.val}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-surface-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-screen-lg mx-auto px-6 py-8">
        {/* Filters bar */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder="Search issues…"
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-surface-900 border border-surface-700 rounded-lg text-white placeholder-surface-500 focus:outline-none focus:border-surface-500"
            />
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-900 border border-surface-800">
            {(['all', 'bug_report', 'feature_request'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all',
                  typeFilter === t
                    ? 'bg-surface-700 text-white'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {t === 'all' ? 'All' : t === 'bug_report' ? '🐛 Bugs' : '💡 Features'}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wide bg-surface-900 border border-surface-800 rounded-lg text-surface-300 focus:outline-none focus:border-surface-600"
          >
            {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as FeedbackSort)}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wide bg-surface-900 border border-surface-800 rounded-lg text-surface-300 focus:outline-none focus:border-surface-600"
          >
            {SORT_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Results */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs text-surface-500 font-mono">{total} item{total !== 1 ? 's' : ''}</p>
        </div>

        {loading && items.length === 0 ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-surface-900 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-surface-500">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No items found</p>
            <p className="text-sm mt-1">Try adjusting your filters or be the first to submit!</p>
            <button onClick={() => setShowSubmit(true)} className="mt-4 text-[#FF5F1F] text-sm font-bold hover:underline">
              Submit feedback →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <FeedbackCard
                key={item.id}
                item={item}
                userVoted={votedIds.has(item.id)}
                onVote={handleVote}
              />
            ))}

            {items.length < total && (
              <button
                onClick={() => { setPage(p => p + 1); load(false); }}
                className="w-full py-3 text-sm font-semibold text-surface-400 hover:text-white border border-surface-800 rounded-xl hover:border-surface-700 transition-all"
              >
                Load more ({total - items.length} remaining)
              </button>
            )}
          </div>
        )}

        {/* Testimonials strip */}
        <div className="mt-16 pt-10 border-t border-surface-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-black">What Users Say</h2>
              <p className="text-xs text-surface-500 mt-0.5">Real feedback from the community</p>
            </div>
            <button
              onClick={() => setShowSubmit(true)}
              className="text-xs font-bold text-[#FF5F1F] hover:underline flex items-center gap-1"
            >
              Leave a review <ArrowRight size={12} />
            </button>
          </div>
          <TestimonialsStrip />
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 px-6 mt-16" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-screen-lg mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 flex items-center justify-center" style={{ background: '#FF5F1F' }}>
              <span className="font-black text-white text-[9px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/30 uppercase tracking-widest">Screenplay Studio</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            {[
              { href: '/', label: 'Home' },
              { href: '/feedback', label: 'Feedback' },
              { href: '/changelog', label: 'Changelog' },
              { href: 'https://ko-fi.com/northemdevelopment', label: 'Support', external: true },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                target={l.external ? '_blank' : undefined}
                rel={l.external ? 'noopener noreferrer' : undefined}
                className="text-[11px] font-mono text-white/25 uppercase tracking-widest hover:text-white/60 transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <SiteVersion light />
            <span className="text-white/10">·</span>
            <a href="https://development.northem.no/" target="_blank" rel="noopener noreferrer"
              className="text-[9px] font-mono uppercase tracking-[0.15em] transition-colors text-[#FF5F1F]/40 hover:text-[#FF5F1F]/80">
              Northem ♥
            </a>
          </div>
        </div>
      </footer>

      {showSubmit && (
        <FeedbackSubmitModal
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { setShowSubmit(false); load(true); loadStats(); toast.success('Thanks for your feedback!'); }}
        />
      )}
    </div>
  );
}

function TestimonialsStrip() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    createClient()
      .from('public_testimonials')
      .select('*')
      .limit(6)
      .then(({ data }) => setItems(data ?? []));
  }, []);

  if (!items.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map(t => (
        <div key={t.id} className="rounded-xl border border-surface-800 bg-surface-900 p-4">
          <div className="flex gap-0.5 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={12} fill={i < t.rating ? '#f59e0b' : 'none'} className={i < t.rating ? 'text-amber-400' : 'text-surface-700'} />
            ))}
          </div>
          <p className="text-sm text-surface-300 leading-relaxed line-clamp-3">&ldquo;{t.body}&rdquo;</p>
          <p className="mt-2 text-xs text-surface-500 font-semibold">{t.display_name}</p>
        </div>
      ))}
    </div>
  );
}
