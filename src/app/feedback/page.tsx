'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { cn, timeAgo } from '@/lib/utils';
import {
  ChevronUp, Megaphone, MessageSquare, Search, Plus,
  TrendingUp, Clock,
  Sparkles,
  ArrowRight, Star,
} from 'lucide-react';
import { toast } from '@/components/ui';
import { ShellActions } from '@/components/shell/ShellActions';
import { ActionButton, AdminPage, PageHeader, StatGrid } from '@/components/kit';
import { FeedbackSubmitModal } from '@/components/feedback/FeedbackSubmitModal';
import { STATUS_META, TYPE_META } from './config';
import type { FeedbackStatus, FeedbackType, FeedbackSort, FeedbackItem } from './config';


function StatusBadge({ status }: { status: FeedbackStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide"
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
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide"
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
    <div className="group flex gap-4 p-4 rounded-xl border border-surface-800 bg-surface-900/60 hover:border-surface-700 hover:bg-surface-900 transition-colors duration-150">
      {/* Vote button */}
      <button
        onClick={(e) => { e.stopPropagation(); onVote(item.id); }}
        className={cn(
          'flex flex-col items-center justify-center min-w-[44px] py-2 px-1 rounded-lg border text-xs font-semibold transition-colors duration-150 shrink-0',
          userVoted
            ? 'border-brand-500 bg-brand-500/10 text-brand-500'
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
            <span key={tag} className="px-1.5 py-0.5 rounded text-[11px] bg-surface-800 text-surface-500 font-mono">
              {tag}
            </span>
          ))}
        </div>
        <h3 className="text-sm font-semibold text-white group-hover:text-brand-500 transition-colors line-clamp-2 leading-snug mb-1">
          {item.title}
        </h3>
        <p className="text-xs text-surface-500 line-clamp-2 leading-relaxed mb-2">{item.body}</p>
        <div className="flex items-center gap-3 text-[11px] text-surface-600">
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
  const { user, initialized } = useAuthStore();
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
      if (reset) setItems(data ?? []); else setItems(prev => [...prev, ...(data ?? [])]);
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



      <ShellActions>
        <ActionButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowSubmit(true)}>Submit feedback</ActionButton>
      </ShellActions>

      <AdminPage className="max-w-screen-lg mx-auto px-6 pt-8">
        <PageHeader
          icon={<Megaphone className="h-5 w-5" />}
          title="Feedback & Roadmap"
          description="Report bugs, request features, and follow what's being built. Your input shapes the product directly."
        />
        <StatGrid
          cols={4}
          items={[
            { label: 'Open', value: stats.open, tone: 'blue', onClick: () => setStatusFilter(statusFilter === 'open' ? 'active' : 'open'), active: statusFilter === 'open', hint: 'Show open items' },
            { label: 'In progress', value: stats.in_progress, tone: 'amber', onClick: () => setStatusFilter(statusFilter === 'in_progress' ? 'active' : 'in_progress'), active: statusFilter === 'in_progress', hint: 'Show items in progress' },
            { label: 'Fixed in 30 days', value: stats.resolved_30d, tone: 'green', onClick: () => setStatusFilter(statusFilter === 'resolved' ? 'active' : 'resolved'), active: statusFilter === 'resolved', hint: 'Show resolved items' },
            { label: 'Matching now', value: total, tone: 'brand' },
          ]}
        />
      </AdminPage>

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
                  'px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wide transition-colors',
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
            className="px-3 py-2 text-xs font-medium uppercase tracking-wide bg-surface-900 border border-surface-800 rounded-lg text-surface-300 focus:outline-none focus:border-surface-600"
          >
            {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as FeedbackSort)}
            className="px-3 py-2 text-xs font-medium uppercase tracking-wide bg-surface-900 border border-surface-800 rounded-lg text-surface-300 focus:outline-none focus:border-surface-600"
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
            <button onClick={() => setShowSubmit(true)} className="mt-4 text-brand-500 text-sm font-bold hover:underline">
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
                className="w-full py-3 text-sm font-semibold text-surface-400 hover:text-white border border-surface-800 rounded-xl hover:border-surface-700 transition-colors"
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
              <h2 className="text-lg font-bold">What Users Say</h2>
              <p className="text-xs text-surface-500 mt-0.5">Real feedback from the community</p>
            </div>
            <button
              onClick={() => setShowSubmit(true)}
              className="text-xs font-bold text-brand-500 hover:underline flex items-center gap-1"
            >
              Leave a review <ArrowRight size={12} />
            </button>
          </div>
          <TestimonialsStrip />
        </div>
      </div>

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
