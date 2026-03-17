'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { cn, timeAgo } from '@/lib/utils';
import {
  ChevronUp, ArrowLeft, Bug, Lightbulb, MessageSquare,
  Bell, BellOff, Tag, CheckCircle2, Clock, Hammer, BookMarked,
  XCircle, AlertTriangle, Star, Monitor, Globe, User, Link2,
  CircleDot, Flag,
} from 'lucide-react';
import { toast } from '@/components/ui';
import { SiteVersion } from '@/components/SiteVersion';
import { STATUS_META, TYPE_META } from '@/app/feedback/config';
import type { FeedbackItem, FeedbackStatus, FeedbackType } from '@/app/feedback/config';

interface Comment {
  id: string;
  content: string;
  comment_type: string;
  is_public: boolean;
  metadata: Record<string, string> | null;
  created_at: string;
  author_id: string | null;
}

interface SimilarItem {
  id: string;
  title: string;
  type: FeedbackType;
  status: FeedbackStatus;
  vote_count: number;
}

const COMMENT_TYPE_STYLE: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  note:           { color: '#94a3b8', label: 'Note',           icon: MessageSquare },
  status_change:  { color: '#f59e0b', label: 'Status Update',  icon: Flag          },
  resolution:     { color: '#22c55e', label: 'Resolution',      icon: CheckCircle2  },
  question:       { color: '#38bdf8', label: 'Question',        icon: MessageSquare },
  update:         { color: '#a78bfa', label: 'Update',          icon: Flag          },
  duplicate_link: { color: '#6b7280', label: 'Duplicate',       icon: Link2         },
};

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
      style={{ background: m.color + '22', color: m.color }}>
      <Icon size={12} />{m.label}
    </span>
  );
}

export default function FeedbackItemPage() {
  const { id } = useParams<{ id: string }>();
  const { user, signOut, initialized } = useAuthStore();
  const router = useRouter();

  const [item, setItem] = useState<FeedbackItem & {
    steps_to_reproduce?: string;
    expected_behavior?: string;
    actual_behavior?: string;
    use_case?: string;
    browser_info?: Record<string, string>;
    error_message?: string;
    url_where_occurred?: string;
    rating?: number;
  } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [similar, setSimilar] = useState<SimilarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [itemRes, commentsRes, similarRes] = await Promise.all([
      supabase.from('feedback_items').select('*').eq('id', id).single(),
      supabase.from('feedback_comments').select('*').eq('item_id', id).eq('is_public', true).order('created_at'),
      supabase.from('feedback_similar_links')
        .select('similar_item_id, feedback_items!similar_item_id(id,title,type,status,vote_count)')
        .eq('item_id', id)
        .limit(4),
    ]);

    if (itemRes.data) setItem(itemRes.data);
    setComments(commentsRes.data ?? []);
    setSimilar((similarRes.data ?? []).map((r: any) => r.feedback_items).filter(Boolean));

    if (user) {
      const [voteRes, subRes] = await Promise.all([
        supabase.from('feedback_votes').select('id').eq('item_id', id).eq('user_id', user.id).maybeSingle(),
        supabase.from('feedback_subscriptions').select('id').eq('item_id', id).eq('user_id', user.id).maybeSingle(),
      ]);
      setVoted(!!voteRes.data);
      setSubscribed(!!subRes.data);
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const handleVote = async () => {
    if (!initialized) return;
    if (!user) { toast('Sign in to vote', 'info'); router.push('/auth/login'); return; }
    const supabase = createClient();
    if (voted) {
      await supabase.from('feedback_votes').delete().eq('item_id', id).eq('user_id', user.id);
      setVoted(false);
      setItem(p => p ? { ...p, vote_count: Math.max(0, p.vote_count - 1) } : p);
    } else {
      await supabase.from('feedback_votes').insert({ item_id: id, user_id: user.id });
      setVoted(true);
      setItem(p => p ? { ...p, vote_count: p.vote_count + 1 } : p);
    }
  };

  const handleSubscribe = async () => {
    if (!user) { toast('Sign in to subscribe', 'info'); router.push('/auth/login'); return; }
    const supabase = createClient();
    if (subscribed) {
      await supabase.from('feedback_subscriptions').delete().eq('item_id', id).eq('user_id', user.id);
      setSubscribed(false);
      toast('Unsubscribed from updates', 'info');
    } else {
      await supabase.from('feedback_subscriptions').insert({ item_id: id, user_id: user.id });
      setSubscribed(true);
      toast.success("You'll be notified of updates");
    }
  };

  const handleComment = async () => {
    if (!user || !commentText.trim()) return;
    setCommentSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from('feedback_comments').insert({
      item_id: id,
      author_id: user.id,
      content: commentText.trim(),
      comment_type: 'note',
      is_public: true,
    });
    setCommentSubmitting(false);
    if (error) { toast('Failed to post comment', 'error'); return; }
    setCommentText('');
    toast.success('Comment posted!');
    load(); // reload to show new comment
  };

  if (loading) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!item) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center text-center">
      <div>
        <p className="text-surface-400 mb-4">Issue not found.</p>
        <Link href="/feedback" className="text-[#FF5F1F] font-bold hover:underline">← Back to Feedback</Link>
      </div>
    </div>
  );

  const typeM = TYPE_META[item.type];
  const TypeIcon = typeM.icon;

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">

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
            <Link href="/feedback" className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: '#FF5F1F' }}>Feedback</Link>
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

      <div className="flex-1 max-w-screen-lg mx-auto px-6 py-8 w-full">

        {/* Breadcrumb */}
        <Link href="/feedback" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-surface-500 hover:text-white transition-colors mb-6">
          <ArrowLeft size={14} /> Feedback
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          {/* Main */}
          <div>
            {/* Title + badges */}
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide"
                  style={{ background: typeM.color + '22', color: typeM.color }}>
                  <TypeIcon size={12} />{typeM.label}
                </span>
                <StatusBadge status={item.status} />
                {item.tags?.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded bg-surface-800 text-surface-400 text-xs font-mono">{t}</span>
                ))}
              </div>
              <h1 className="text-2xl font-black leading-snug mb-1">{item.title}</h1>
              <p className="text-xs text-surface-500">{timeAgo(item.created_at)}{item.author_name ? ` · by ${item.author_name}` : ''}</p>
            </div>

            {/* Body */}
            <div className="prose prose-invert prose-sm max-w-none mb-6 text-surface-300 leading-relaxed whitespace-pre-wrap">
              {item.body}
            </div>

            {/* Bug-specific details */}
            {item.type === 'bug_report' && (item.steps_to_reproduce || item.expected_behavior || item.actual_behavior) && (
              <div className="mb-6 space-y-3 pl-3 border-l-2 border-red-500/30">
                {item.steps_to_reproduce && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-surface-500 mb-1">Steps to Reproduce</h3>
                    <pre className="text-sm text-surface-300 whitespace-pre-wrap font-mono bg-surface-900 rounded-lg p-3 text-xs">{item.steps_to_reproduce}</pre>
                  </div>
                )}
                {(item.expected_behavior || item.actual_behavior) && (
                  <div className="grid grid-cols-2 gap-3">
                    {item.expected_behavior && (
                      <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                        <div className="text-xs font-bold text-green-400 mb-1 uppercase tracking-wide">Expected</div>
                        <p className="text-xs text-surface-300">{item.expected_behavior}</p>
                      </div>
                    )}
                    {item.actual_behavior && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                        <div className="text-xs font-bold text-red-400 mb-1 uppercase tracking-wide">Actual</div>
                        <p className="text-xs text-surface-300">{item.actual_behavior}</p>
                      </div>
                    )}
                  </div>
                )}
                {item.browser_info && (
                  <div className="flex items-center gap-2 text-xs text-surface-600 bg-surface-900 rounded-lg px-3 py-2">
                    <Monitor size={12} /><span className="font-mono">{(item.browser_info as any)?.ua?.slice(0, 80)}</span>
                  </div>
                )}
                {item.url_where_occurred && (
                  <div className="flex items-center gap-2 text-xs text-surface-600">
                    <Globe size={12} /><span className="font-mono">{item.url_where_occurred}</span>
                  </div>
                )}
              </div>
            )}

            {/* Feature use case */}
            {item.type === 'feature_request' && item.use_case && (
              <div className="mb-6 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">Use Case</h3>
                <p className="text-sm text-surface-300">{item.use_case}</p>
              </div>
            )}

            {/* Admin Timeline (public team updates) */}
            {comments.filter(c => c.author_id === 'f0e0c4a4-0833-4c64-b012-15829c087c77').length > 0 && (
              <div className="mt-8">
                <h2 className="text-xs font-bold uppercase tracking-widest text-surface-500 mb-4 flex items-center gap-2">
                  <MessageSquare size={12} /> Updates from the team
                </h2>
                <div className="space-y-0">
                  {comments.filter(c => c.author_id === 'f0e0c4a4-0833-4c64-b012-15829c087c77').map((c, idx, arr) => {
                    const cs = COMMENT_TYPE_STYLE[c.comment_type] ?? COMMENT_TYPE_STYLE.note;
                    const Icon = cs.icon;
                    return (
                      <div key={c.id} className="flex gap-3 relative">
                        {idx < arr.length - 1 && (
                          <div className="absolute left-4 top-8 bottom-0 w-px bg-surface-800" />
                        )}
                        <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center z-10"
                          style={{ background: cs.color + '22', color: cs.color }}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cs.color }}>{cs.label}</span>
                            <span className="text-[10px] text-surface-600">{timeAgo(c.created_at)}</span>
                          </div>
                          <div className="bg-surface-900 border border-surface-800 rounded-xl px-4 py-3 text-sm text-surface-300 leading-relaxed whitespace-pre-wrap">
                            {c.content}
                          </div>
                          {c.metadata?.from_status && c.metadata?.to_status && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-surface-600">
                              <StatusBadge status={c.metadata.from_status as FeedbackStatus} />
                              <span>→</span>
                              <StatusBadge status={c.metadata.to_status as FeedbackStatus} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Community Discussion */}
            <div className="mt-10">
              <h2 className="text-xs font-bold uppercase tracking-widest text-surface-500 mb-4 flex items-center gap-2">
                <MessageSquare size={12} /> Community Discussion
              </h2>

              {/* Existing user comments */}
              {comments.filter(c => c.author_id !== 'f0e0c4a4-0833-4c64-b012-15829c087c77').length > 0 && (
                <div className="space-y-3 mb-6">
                  {comments.filter(c => c.author_id !== 'f0e0c4a4-0833-4c64-b012-15829c087c77').map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center bg-surface-800 border border-surface-700 text-[11px] font-bold text-surface-400">
                        <User size={13} />
                      </div>
                      <div className="flex-1">
                        <div className="bg-surface-900 border border-surface-800 rounded-xl px-4 py-3 text-sm text-surface-300 whitespace-pre-wrap">
                          {c.content}
                        </div>
                        <p className="text-[10px] text-surface-600 mt-1">{timeAgo(c.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Comment form */}
              {user ? (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-black text-white mt-1"
                    style={{ background: '#FF5F1F' }}>
                    {(user.full_name || user.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 space-y-2">
                    <textarea
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Share your thoughts or additional context…"
                      rows={3}
                      className="w-full bg-surface-900 border border-surface-800 rounded-xl px-4 py-3 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-[#FF5F1F]/50 resize-none transition-colors"
                    />
                    <button
                      onClick={handleComment}
                      disabled={commentSubmitting || !commentText.trim()}
                      className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-40"
                      style={{ background: '#FF5F1F' }}
                    >
                      {commentSubmitting ? 'Posting…' : 'Post Comment'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 text-center">
                  <p className="text-sm text-surface-400 mb-3">Sign in to join the discussion</p>
                  <Link href="/auth/login?redirect=/feedback" className="px-5 py-2 rounded-lg text-sm font-bold text-white inline-block"
                    style={{ background: '#FF5F1F' }}>
                    Sign In
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Vote */}
            <div className="rounded-xl border border-surface-800 bg-surface-900 p-4 text-center">
              <button
                onClick={handleVote}
                className={cn(
                  'w-full flex flex-col items-center justify-center py-4 px-4 rounded-xl border-2 font-black transition-all duration-150 text-3xl mb-2',
                  voted
                    ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 text-[#FF5F1F]'
                    : 'border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-500 hover:text-white'
                )}
              >
                <ChevronUp size={24} className={cn('transition-transform mb-1', voted && '-translate-y-1')} />
                <span>{item.vote_count}</span>
              </button>
              <p className="text-xs text-surface-500">{voted ? 'You voted · click to undo' : 'Upvote this issue'}</p>
            </div>

            {/* Subscribe */}
            <button
              onClick={handleSubscribe}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all',
                subscribed
                  ? 'border-surface-600 bg-surface-800 text-surface-300 hover:border-surface-500'
                  : 'border-surface-700 bg-surface-900 text-surface-400 hover:text-white hover:border-surface-600'
              )}
            >
              {subscribed ? <><BellOff size={14} /> Unsubscribe</> : <><Bell size={14} /> Subscribe to updates</>}
            </button>

            {/* Metadata */}
            <div className="rounded-xl border border-surface-800 bg-surface-900 p-4 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-surface-500 uppercase tracking-wide font-bold">Status</span>
                <StatusBadge status={item.status} />
              </div>
              <div className="h-px bg-surface-800" />
              <div className="flex justify-between">
                <span className="text-surface-500 uppercase tracking-wide font-bold">Priority</span>
                <span className={cn('font-bold capitalize', {
                  'text-red-400': item.priority === 'critical',
                  'text-orange-400': item.priority === 'high',
                  'text-yellow-400': item.priority === 'medium',
                  'text-surface-400': item.priority === 'low',
                })}>{item.priority}</span>
              </div>
              <div className="h-px bg-surface-800" />
              <div className="flex justify-between">
                <span className="text-surface-500 uppercase tracking-wide font-bold">Comments</span>
                <span className="text-white">{item.comment_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500 uppercase tracking-wide font-bold">Submitted</span>
                <span className="text-surface-300">{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Similar issues */}
            {similar.length > 0 && (
              <div className="rounded-xl border border-surface-800 bg-surface-900 p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-surface-500 mb-3">Related Issues</h3>
                <div className="space-y-2">
                  {similar.map(s => (
                    <Link key={s.id} href={`/feedback/${s.id}`}
                      className="flex items-start gap-2 p-2 rounded-lg hover:bg-surface-800 transition-colors">
                      <ChevronUp size={11} className="text-surface-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-white line-clamp-2 leading-snug">{s.title}</p>
                        <p className="text-[10px] text-surface-600 mt-0.5">{s.vote_count} votes · {s.status}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Back link */}
            <Link href="/feedback"
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-surface-500 hover:text-white transition-colors">
              <ArrowLeft size={14} /> All feedback
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 px-6 mt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
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
    </div>
  );
}
