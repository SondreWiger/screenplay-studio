'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/stores';
import { cn, timeAgo } from '@/lib/utils';
import { SiteVersion } from '@/components/SiteVersion';
import { toast } from '@/components/ui';
import { X, MessageSquare, ChevronUp, User, Star } from 'lucide-react';

const ORANGE = '#FF5F1F';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Testimonial {
  id: string;
  title: string;
  body: string;
  rating: number | null;
  display_name: string | null;
  vote_count: number;
  comment_count: number;
  created_at: string;
}

interface Comment {
  id: string;
  content: string;
  comment_type: string;
  author_id: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StarRow({ rating, size = 14 }: { rating: number | null; size?: number }) {
  const r = rating ?? 0;
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          fill={i < r ? ORANGE : 'none'}
          stroke={i < r ? ORANGE : 'rgba(255,255,255,0.15)'}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function TestimonialModal({
  t,
  onClose,
}: {
  t: Testimonial;
  onClose: () => void;
}) {
  const { user, initialized } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(t.vote_count);

  const supabase = createClient();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from('feedback_comments')
      .select('*')
      .eq('item_id', t.id)
      .eq('is_public', true)
      .order('created_at');
    setComments(data ?? []);
  }, [t.id]);

  useEffect(() => {
    loadComments();
    if (user) {
      supabase.from('feedback_votes').select('id').eq('item_id', t.id).eq('user_id', user.id).maybeSingle()
        .then(({ data }) => setVoted(!!data));
    }
  }, [t.id, user]);

  const handleVote = async () => {
    if (!initialized) return;
    if (!user) { toast('Sign in to vote', 'info'); return; }
    if (voted) {
      await supabase.from('feedback_votes').delete().eq('item_id', t.id).eq('user_id', user.id);
      setVoted(false);
      setVoteCount(n => Math.max(0, n - 1));
    } else {
      await supabase.from('feedback_votes').insert({ item_id: t.id, user_id: user.id });
      setVoted(true);
      setVoteCount(n => n + 1);
    }
  };

  const handleComment = async () => {
    if (!user || !text.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('feedback_comments').insert({
      item_id: t.id,
      author_id: user.id,
      content: text.trim(),
      comment_type: 'note',
      is_public: true,
    });
    setSubmitting(false);
    if (error) { toast('Failed to post', 'error'); return; }
    setText('');
    toast.success('Comment posted!');
    loadComments();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        style={{ background: '#0a0a1a', border: '1px solid rgba(255,255,255,0.1)' }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 pb-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex-1 min-w-0">
            <StarRow rating={t.rating} size={16} />
            <h2 className="text-lg font-black text-white mt-2 leading-snug">{t.title}</h2>
            <p className="text-[11px] text-white/30 mt-1 font-mono uppercase tracking-widest">
              {t.display_name ?? 'Anonymous'} · {timeAgo(t.created_at)}
            </p>
          </div>
          <button onClick={onClose}
            className="text-white/30 hover:text-white transition-colors shrink-0 mt-1">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Quote */}
          <div className="px-6 py-6">
            <div className="text-4xl font-black leading-none mb-4" style={{ color: ORANGE }}>"</div>
            <p className="text-sm text-white/60 leading-[1.9] whitespace-pre-wrap">{t.body}</p>
          </div>

          {/* Vote strip */}
          <div className="px-6 pb-5 flex items-center gap-4">
            <button
              onClick={handleVote}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-bold border transition-all',
                voted
                  ? 'text-white'
                  : 'border-white/10 text-white/30 hover:text-white hover:border-white/30'
              )}
              style={voted ? { background: ORANGE, borderColor: ORANGE } : {}}
            >
              <ChevronUp size={15} />
              {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
            </button>
            <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">
              {t.comment_count} comment{t.comment_count !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Comments */}
          {comments.length > 0 && (
            <div className="px-6 pb-6 space-y-4"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1.5rem' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 flex items-center gap-2">
                <MessageSquare size={11} /> Discussion
              </p>
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center bg-white/5 border border-white/10">
                    <User size={13} className="text-white/30" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-white/50 leading-relaxed p-3 whitespace-pre-wrap"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {c.content}
                    </div>
                    <p className="text-[10px] text-white/20 mt-1">{timeAgo(c.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment form — admin only */}
          <div className="px-6 pb-6" style={{ borderTop: comments.length > 0 ? 'none' : '1px solid rgba(255,255,255,0.07)', paddingTop: comments.length > 0 ? 0 : '1.5rem' }}>
            {user?.id === 'f0e0c4a4-0833-4c64-b012-15829c087c77' ? (
              <div className="flex gap-3">
                <div className="w-7 h-7 shrink-0 flex items-center justify-center text-[11px] font-black text-white mt-1"
                  style={{ background: ORANGE }}>
                  {(user.full_name || user.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 space-y-2">
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Admin note…"
                    rows={2}
                    className="w-full bg-white/3 text-sm text-white placeholder-white/20 px-4 py-3 resize-none focus:outline-none transition-colors"
                    style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
                  />
                  <button
                    onClick={handleComment}
                    disabled={submitting || !text.trim()}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-30 transition-opacity"
                    style={{ background: ORANGE }}
                  >
                    {submitting ? 'Posting…' : 'Post'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TestimonialsPage() {
  // useAuth() initializes the auth store — without this call, user stays null forever
  const { user, loading: authLoading } = useAuth();
  const { signOut } = useAuthStore();
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStar, setFilterStar] = useState<number | null>(null);
  const [selected, setSelected] = useState<Testimonial | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('public_testimonials')
        .select('id,title,body,rating,display_name,vote_count,comment_count,created_at')
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) console.error('[TestimonialsPage] fetch error:', error);
      setItems((data ?? []) as Testimonial[]);
      setLoading(false);
    })();
  }, []);

  const filtered = filterStar !== null
    ? items.filter(i => i.rating === filterStar)
    : items;

  // Average rating
  const rated = items.filter(i => i.rating != null);
  const avg = rated.length
    ? (rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length)
    : null;

  // Distribution
  const dist = [5, 4, 3, 2, 1].map(s => ({
    star: s,
    count: items.filter(i => i.rating === s).length,
  }));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#070710', color: '#fff' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(7,7,16,0.9)' }}
      >
        <div className="max-w-screen-xl mx-auto px-6 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 flex items-center justify-center shrink-0" style={{ background: ORANGE }}>
              <span className="font-black text-white text-[10px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/40 uppercase tracking-widest group-hover:text-white/70 transition-colors">
              Screenplay Studio
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-6">
            <Link href="/testimonials" className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: ORANGE }}>Reviews</Link>
            <Link href="/feedback" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">Feedback</Link>
            <Link href="/changelog" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">Changelog</Link>
            {user ? (
              <>
                <Link href="/dashboard" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">Dashboard</Link>
                <button onClick={() => signOut()} className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">Sign Out</button>
                <div className="flex items-center">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-white" style={{ background: ORANGE }}>
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">Sign In</Link>
                <Link href="/auth/register" className="text-[10px] font-black uppercase tracking-widest text-white px-4 py-2" style={{ background: ORANGE }}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero / Stats ─────────────────────────────────────────────────── */}
      <section className="max-w-screen-xl mx-auto px-6 pt-20 pb-16 w-full">
        <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-12">

          {/* Left: headline */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-4 h-px shrink-0" style={{ background: ORANGE }} />
              <span className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/25 font-mono">Writer Reviews</span>
            </div>
            <h1
              className="font-black text-white leading-[0.92]"
              style={{ fontSize: 'clamp(3rem, 9vw, 8rem)', letterSpacing: '-0.03em' }}
            >
              WHAT WRITERS<br />ARE SAYING.
            </h1>
            <p className="mt-6 text-sm text-white/35 max-w-md leading-relaxed">
              Real feedback from writers using Screenplay Studio every day.
              Unfiltered, unedited, from the community.
            </p>
          </div>

          {/* Right: big average score */}
          {avg !== null && (
            <div className="flex items-end gap-8 shrink-0">
              <div className="text-right">
                {/* Massive avg number */}
                <div
                  className="font-black leading-none tabular-nums"
                  style={{ fontSize: 'clamp(5rem, 12vw, 10rem)', color: ORANGE, letterSpacing: '-0.04em' }}
                >
                  {avg.toFixed(1)}
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-2">
                  <StarRow rating={Math.round(avg)} size={18} />
                </div>
                <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest mt-2">
                  avg from {rated.length} review{rated.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Distribution bars */}
              <div className="space-y-1.5 pb-1">
                {dist.map(({ star, count }) => {
                  const pct = rated.length ? (count / rated.length) * 100 : 0;
                  return (
                    <button
                      key={star}
                      onClick={() => setFilterStar(filterStar === star ? null : star)}
                      className={cn(
                        'flex items-center gap-2 group transition-opacity',
                        filterStar !== null && filterStar !== star ? 'opacity-30' : 'opacity-100'
                      )}
                    >
                      <span className="text-[10px] font-mono text-white/40 w-3 text-right">{star}</span>
                      <Star size={9} fill={ORANGE} stroke={ORANGE} />
                      <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: ORANGE }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-white/25 w-3">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Rule */}
      <div className="max-w-screen-xl mx-auto px-6 w-full">
        <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-6 py-6 flex items-center gap-3 flex-wrap w-full">
        <button
          onClick={() => setFilterStar(null)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all',
            filterStar === null
              ? 'text-white'
              : 'text-white/30 hover:text-white/60'
          )}
          style={filterStar === null ? { background: ORANGE } : { border: '1px solid rgba(255,255,255,0.1)' }}
        >
          All — {items.length}
        </button>
        {[5, 4, 3, 2, 1].map(s => {
          const count = items.filter(i => i.rating === s).length;
          if (count === 0) return null;
          return (
            <button
              key={s}
              onClick={() => setFilterStar(filterStar === s ? null : s)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all',
                filterStar === s
                  ? 'text-white'
                  : 'text-white/30 hover:text-white/60'
              )}
              style={filterStar === s ? { background: ORANGE } : { border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {'★'.repeat(s)} — {count}
            </button>
          );
        })}

        <Link
          href="/feedback?submit=testimonial"
          className="ml-auto text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 hover:text-white/60 transition-colors pb-0.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          Leave a review →
        </Link>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-screen-xl mx-auto px-6 pb-24 w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${ORANGE} transparent transparent transparent` }} />
            <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest">Loading reviews…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-white/25 text-sm">No reviews for this rating yet.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Corner crosshairs */}
            {[
              'absolute -top-3 -left-3',
              'absolute -top-3 -right-3 rotate-90',
              'absolute -bottom-3 -left-3 -rotate-90',
              'absolute -bottom-3 -right-3 rotate-180',
            ].map((cls, i) => (
              <svg key={i} className={`${cls} w-5 h-5 pointer-events-none`} style={{ color: 'rgba(255,255,255,0.12)' }} viewBox="0 0 20 20" fill="none">
                <path d="M6 1H1v5M14 1h5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            ))}

            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {filtered.map((t, i) => {
                const cols = 3; // lg breakpoint
                const rows = Math.ceil(filtered.length / cols);
                const col = i % cols;
                const row = Math.floor(i / cols);
                const totalRows = Math.ceil(filtered.length / cols);

                return (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="group relative text-left p-7 overflow-hidden transition-colors duration-150 hover:bg-white/[0.025]"
                    style={{
                      borderRight: (i + 1) % cols !== 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                      borderBottom: i < filtered.length - cols ? '1px solid rgba(255,255,255,0.07)' : 'none',
                    }}
                  >
                    {/* Orange accent bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[2px] origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-250"
                      style={{ background: ORANGE }}
                    />

                    {/* Index number */}
                    <span
                      className="text-[10px] font-black font-mono opacity-30 group-hover:opacity-100 transition-opacity duration-150 block mb-4"
                      style={{ color: ORANGE }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>

                    {/* Stars */}
                    <StarRow rating={t.rating} size={13} />

                    {/* Quote mark */}
                    <div
                      className="mt-3 text-3xl font-black leading-none opacity-20 group-hover:opacity-60 transition-opacity duration-150"
                      style={{ color: ORANGE }}
                    >
                      "
                    </div>

                    {/* Body */}
                    <p className="mt-1 text-[13px] text-white/40 leading-[1.85] group-hover:text-white/65 transition-colors duration-150 line-clamp-5">
                      {t.body}
                    </p>

                    {/* Footer: author + meta */}
                    <div
                      className="mt-5 pt-4 flex items-center justify-between gap-2"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 flex items-center justify-center text-[9px] font-black text-white shrink-0"
                          style={{ background: ORANGE + '44' }}
                        >
                          {(t.display_name ?? 'A')[0].toUpperCase()}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/25">
                          {t.display_name ?? 'Anonymous'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-[10px] text-white/20 font-mono shrink-0">
                        {t.comment_count > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare size={9} />{t.comment_count}
                          </span>
                        )}
                        {t.vote_count > 0 && (
                          <span className="flex items-center gap-1">
                            <ChevronUp size={9} />{t.vote_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA block */}
        {!loading && (
          <div className="mt-16 relative overflow-hidden p-12 text-center" style={{ background: ORANGE }}>
            {/* dot grid */}
            <div
              className="absolute inset-0 pointer-events-none opacity-10"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.8) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60 mb-4 relative z-10">Used Screenplay Studio?</p>
            <h2
              className="font-black text-white relative z-10"
              style={{ fontSize: 'clamp(1.8rem, 5vw, 3.5rem)', letterSpacing: '-0.03em', lineHeight: 0.9 }}
            >
              LEAVE YOUR REVIEW
            </h2>
            <p className="text-sm text-white/70 mt-4 mb-8 relative z-10 max-w-md mx-auto">
              Help other writers find the right tool.
            </p>
            <Link
              href="/feedback?submit=testimonial"
              className="relative z-10 inline-block px-8 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-80"
              style={{ background: 'rgba(0,0,0,0.35)' }}
            >
              Write a Review
            </Link>
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 flex items-center justify-center" style={{ background: ORANGE }}>
              <span className="font-black text-white text-[9px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/30 uppercase tracking-widest">Screenplay Studio</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            {[
              { href: '/', label: 'Home' },
              { href: '/testimonials', label: 'Reviews' },
              { href: '/feedback', label: 'Feedback' },
              { href: '/changelog', label: 'Changelog' },
              { href: 'https://ko-fi.com/northemdevelopment', label: 'Support', external: true },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                target={(l as any).external ? '_blank' : undefined}
                rel={(l as any).external ? 'noopener noreferrer' : undefined}
                className="text-[11px] font-mono text-white/25 uppercase tracking-widest hover:text-white/60 transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <SiteVersion light />
            <span className="text-white/10">·</span>
            <a href="https://development.northem.no/" target="_blank" rel="noopener noreferrer"
              className="text-[9px] font-mono uppercase tracking-[0.15em] text-[#FF5F1F]/40 hover:text-[#FF5F1F]/80 transition-colors">
              Northem ♥
            </a>
          </div>
        </div>
      </footer>

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      {selected && (
        <TestimonialModal t={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
