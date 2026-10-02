'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fillEmails } from '@/lib/private-profile';
import { Button, Badge } from '@/components/ui';
import { cn, formatDate, timeAgo, getChallengePhase, getPhaseLabel } from '@/lib/utils';
import type { CommunityPost, CommunityCategory, ChallengeTheme, CommunityChallenge } from '@/lib/types';
import type { PendingProduction } from '../types';
import { useAuth } from '@/hooks/useAuth';
import { useAdminData } from '../data';
import { TabSkeleton } from '../motion';

export function CommunityTab({ posts, categories, themes, challenges, onDeletePost, onSaveCategory, onDeleteCategory, onSaveTheme, onDeleteTheme, onCreateChallenge }: {
  posts: CommunityPost[];
  categories: CommunityCategory[];
  themes: ChallengeTheme[];
  challenges: CommunityChallenge[];
  onDeletePost: (id: string) => void;
  onSaveCategory: (cat: Partial<CommunityCategory> & { id?: string }) => void;
  onDeleteCategory: (id: string) => void;
  onSaveTheme: (theme: Partial<ChallengeTheme> & { id?: string }) => void;
  onDeleteTheme: (id: string) => void;
  onCreateChallenge: (data: { title: string; description: string; starts_at: string; submissions_close_at: string; voting_close_at: string; reveal_at: string; prize_title?: string | null; prize_description?: string | null }) => void;
}) {
  const [view, setView] = useState<'posts' | 'categories' | 'themes' | 'challenges' | 'productions'>('posts');
  const [editingCat, setEditingCat] = useState<CommunityCategory | 'new' | null>(null);
  const [editingTheme, setEditingTheme] = useState<ChallengeTheme | 'new' | null>(null);
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [pendingProductions, setPendingProductions] = useState<PendingProduction[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  // New challenge form
  const [chTitle, setChTitle] = useState('');
  const [chDesc, setChDesc] = useState('');
  const [chStart, setChStart] = useState('');
  const [chSubClose, setChSubClose] = useState('');
  const [chVoteClose, setChVoteClose] = useState('');
  const [chReveal, setChReveal] = useState('');
  const [chPrize, setChPrize] = useState('');
  const [chPrizeDesc, setChPrizeDesc] = useState('');

  // Category form
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catIcon, setCatIcon] = useState('');
  const [catColor, setCatColor] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // Theme form
  const [thTitle, setThTitle] = useState('');
  const [thDesc, setThDesc] = useState('');
  const [thGenre, setThGenre] = useState('');
  const [thConstraints, setThConstraints] = useState('');

  const startEditCat = (cat: CommunityCategory | null) => {
    if (cat) {
      setCatName(cat.name); setCatSlug(cat.slug); setCatIcon(cat.icon || ''); setCatColor(cat.color || ''); setCatDesc(cat.description || '');
    } else {
      setCatName(''); setCatSlug(''); setCatIcon(''); setCatColor(''); setCatDesc('');
    }
    setEditingCat(cat || 'new');
  };

  const saveCat = () => {
    if (!catName.trim() || !catSlug.trim()) return;
    const data: Partial<CommunityCategory> & { id?: string } = { name: catName.trim(), slug: catSlug.trim(), icon: catIcon.trim() || null, color: catColor.trim() || null, description: catDesc.trim() || null };
    if (editingCat !== 'new' && editingCat !== null) data.id = editingCat.id;
    onSaveCategory(data);
    setEditingCat(null);
  };

  const startEditTheme = (theme: ChallengeTheme | null) => {
    if (theme) {
      setThTitle(theme.title); setThDesc(theme.description); setThGenre(theme.genre_hint || ''); setThConstraints(theme.constraints || '');
    } else {
      setThTitle(''); setThDesc(''); setThGenre(''); setThConstraints('');
    }
    setEditingTheme(theme || 'new');
  };

  const saveTheme = () => {
    if (!thTitle.trim() || !thDesc.trim()) return;
    const data: Partial<ChallengeTheme> & { id?: string } = { title: thTitle.trim(), description: thDesc.trim(), genre_hint: thGenre.trim() || null, constraints: thConstraints.trim() || null, difficulty: 'intermediate' };
    if (editingTheme !== 'new' && editingTheme !== null) { data.id = editingTheme.id; data.is_active = editingTheme.is_active; }
    onSaveTheme(data);
    setEditingTheme(null);
  };

  const createChallenge = () => {
    if (!chTitle.trim() || !chDesc.trim() || !chStart || !chSubClose || !chVoteClose || !chReveal) return;
    onCreateChallenge({
      title: chTitle.trim(), description: chDesc.trim(),
      starts_at: new Date(chStart).toISOString(),
      submissions_close_at: new Date(chSubClose).toISOString(),
      voting_close_at: new Date(chVoteClose).toISOString(),
      reveal_at: new Date(chReveal).toISOString(),
      prize_title: chPrize.trim() || null,
      prize_description: chPrizeDesc.trim() || null,
    });
    setShowNewChallenge(false);
    setChTitle(''); setChDesc(''); setChStart(''); setChSubClose(''); setChVoteClose(''); setChReveal(''); setChPrize(''); setChPrizeDesc('');
  };

  // Productions review
  const loadProductions = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('script_productions')
      .select('*, submitter:profiles!submitter_id(id, full_name, email, avatar_url), post:community_posts!post_id(title, slug)')
      .order('created_at', { ascending: false });
    await fillEmails(supabase, (data || []).map((p: { submitter?: { id?: string; email?: string | null } | null }) => p.submitter));
    setPendingProductions(data || []);
  }, []);

  useEffect(() => { if (view === 'productions') loadProductions(); }, [view, loadProductions]);

  const handleReviewProduction = async (id: string, status: 'approved' | 'rejected') => {
    const supabase = createClient();
    await supabase.from('script_productions').update({
      status,
      review_notes: reviewNotes[id] || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'f0e0c4a4-0833-4c64-b012-15829c087c77',
    }).eq('id', id);
    await loadProductions();
  };

  const inputCls = 'w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Community</h1>
          <p className="text-sm text-surface-400">Manage posts, categories, themes & challenges</p>
        </div>
        <Link href="/community" className="text-sm text-surface-400 hover:text-white transition-colors">
          View Community →
        </Link>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 bg-surface-900 rounded-lg p-1 w-fit overflow-x-auto">
        {([
          { k: 'posts', label: `Posts (${posts.length})` },
          { k: 'productions', label: `Productions (${pendingProductions.filter(p => p.status === 'pending').length})` },
          { k: 'categories', label: `Categories (${categories.length})` },
          { k: 'themes', label: `Themes (${themes.length})` },
          { k: 'challenges', label: `Challenges (${challenges.length})` },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setView(t.k as 'posts' | 'categories' | 'themes' | 'challenges' | 'productions')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              view === t.k ? 'bg-surface-700 text-white shadow-sm' : 'text-surface-400 hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* POSTS */}
      {view === 'posts' && (
        <div className="space-y-3">
          {posts.length === 0 ? (
            <p className="text-center text-surface-400 text-sm py-12">No community posts yet.</p>
          ) : posts.map((post) => (
            <div key={post.id} className="rounded-xl border border-surface-800 bg-surface-900/50 p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={post.status === 'published' ? 'success' : post.status === 'archived' ? 'warning' : 'default'} size="sm">{post.status}</Badge>
                  {post.allow_free_use && <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold">Free Use</span>}
                </div>
                <p className="text-sm font-medium text-white truncate">{post.title}</p>
                <p className="text-xs text-surface-500 mt-0.5">
                  by {post.author?.full_name || post.author?.email || 'Unknown'} · {timeAgo(post.created_at)} · ↑{post.upvote_count} · 💬{post.comment_count}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`/community/post/${post.slug}`} target="_blank" className="text-xs text-surface-400 hover:text-white transition-colors">View</a>
                <button onClick={() => onDeletePost(post.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PRODUCTIONS REVIEW */}
      {view === 'productions' && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-4">Film Productions — Review Queue</h3>
          {pendingProductions.length === 0 ? (
            <p className="text-center text-surface-400 text-sm py-12">No productions submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {pendingProductions.map((prod: PendingProduction) => (
                <div key={prod.id} className="rounded-xl border border-surface-800 bg-surface-900/50 p-4">
                  <div className="flex items-start gap-4">
                    {prod.thumbnail_url && (
                      <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0">
                        <img src={prod.thumbnail_url} alt={prod.title || 'Production thumbnail'} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={prod.status === 'approved' ? 'success' : prod.status === 'rejected' ? 'error' : 'warning'} size="sm">{prod.status}</Badge>
                        <span className="text-sm font-medium text-white">{prod.title}</span>
                      </div>
                      {prod.description && <p className="text-xs text-surface-400 line-clamp-2">{prod.description}</p>}
                      <p className="text-xs text-surface-500 mt-1">
                        by {prod.submitter?.full_name || prod.submitter?.email || 'Unknown'} · {timeAgo(prod.created_at)}
                        {prod.post && <> · script: <a href={`/community/post/${prod.post.slug}`} target="_blank" className="text-brand-500 hover:underline">{prod.post.title}</a></>}
                      </p>
                      {prod.url && <a href={prod.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-500 hover:underline mt-1 inline-block">🔗 Watch →</a>}
                    </div>
                  </div>
                  {prod.status === 'pending' && (
                    <div className="mt-3 pt-3 border-t border-surface-800">
                      <input
                        value={reviewNotes[prod.id] || ''}
                        onChange={(e) => setReviewNotes(prev => ({ ...prev, [prod.id]: e.target.value }))}
                        placeholder="Review notes (optional)..."
                        className={inputCls + ' mb-2'}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleReviewProduction(prod.id, 'approved')}>✅ Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => handleReviewProduction(prod.id, 'rejected')}>❌ Reject</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CATEGORIES */}
      {view === 'categories' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => startEditCat(null)}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Category
            </Button>
          </div>

          {editingCat && (
            <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 mb-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">{editingCat === 'new' ? 'New Category' : 'Edit Category'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Name" value={catName} onChange={(e) => setCatName(e.target.value)} />
                <input className={inputCls} placeholder="slug" value={catSlug} onChange={(e) => setCatSlug(e.target.value)} />
                <input className={inputCls} placeholder="Icon (emoji)" value={catIcon} onChange={(e) => setCatIcon(e.target.value)} />
                <input className={inputCls} placeholder="Color (#hex)" value={catColor} onChange={(e) => setCatColor(e.target.value)} />
              </div>
              <input className={inputCls} placeholder="Description" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveCat}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingCat(null)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-lg border border-surface-800 bg-surface-900/50 px-4 py-3 flex items-center gap-3">
                <span className="text-lg">{cat.icon || '📁'}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-white">{cat.name}</span>
                  <span className="text-xs text-surface-500 ml-2">/{cat.slug}</span>
                  {cat.color && <span className="inline-block w-3 h-3 rounded-full ml-2" style={{ backgroundColor: cat.color }} />}
                </div>
                <button onClick={() => startEditCat(cat)} className="text-xs text-surface-400 hover:text-white transition-colors">Edit</button>
                <button onClick={() => onDeleteCategory(cat.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* THEMES */}
      {view === 'themes' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => startEditTheme(null)}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Theme
            </Button>
          </div>

          {editingTheme && (
            <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 mb-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">{editingTheme === 'new' ? 'New Theme' : 'Edit Theme'}</h3>
              <input className={inputCls} placeholder="Title" value={thTitle} onChange={(e) => setThTitle(e.target.value)} />
              <textarea className={inputCls + ' resize-none'} rows={3} placeholder="Description / prompt for writers" value={thDesc} onChange={(e) => setThDesc(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Genre hint (optional)" value={thGenre} onChange={(e) => setThGenre(e.target.value)} />
                <input className={inputCls} placeholder="Constraints (optional)" value={thConstraints} onChange={(e) => setThConstraints(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveTheme}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingTheme(null)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {themes.map((theme) => (
              <div key={theme.id} className="rounded-lg border border-surface-800 bg-surface-900/50 px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white">{theme.title}</span>
                    {!theme.is_active && <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">Inactive</span>}
                    <span className="text-[11px] text-surface-500">used {theme.used_count}×</span>
                  </div>
                  <p className="text-xs text-surface-400 line-clamp-1">{theme.description}</p>
                </div>
                <button onClick={() => startEditTheme(theme)} className="text-xs text-surface-400 hover:text-white transition-colors shrink-0">Edit</button>
                <button onClick={() => onDeleteTheme(theme.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0">Delete</button>
              </div>
            ))}
            {themes.length === 0 && <p className="text-center text-surface-400 text-sm py-8">No challenge themes. Add some to enable weekly challenges.</p>}
          </div>
        </div>
      )}

      {/* CHALLENGES */}
      {view === 'challenges' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowNewChallenge(true)}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Custom Challenge
            </Button>
          </div>

          {showNewChallenge && (
            <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 mb-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Create Custom Challenge</h3>
              <input className={inputCls} placeholder="Title" value={chTitle} onChange={(e) => setChTitle(e.target.value)} />
              <textarea className={inputCls + ' resize-none'} rows={3} placeholder="Description / prompt" value={chDesc} onChange={(e) => setChDesc(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-surface-400 block mb-1">Starts At</label><input type="datetime-local" className={inputCls} value={chStart} onChange={(e) => setChStart(e.target.value)} /></div>
                <div><label className="text-xs text-surface-400 block mb-1">Submissions Close</label><input type="datetime-local" className={inputCls} value={chSubClose} onChange={(e) => setChSubClose(e.target.value)} /></div>
                <div><label className="text-xs text-surface-400 block mb-1">Voting Closes</label><input type="datetime-local" className={inputCls} value={chVoteClose} onChange={(e) => setChVoteClose(e.target.value)} /></div>
                <div><label className="text-xs text-surface-400 block mb-1">Reveal At</label><input type="datetime-local" className={inputCls} value={chReveal} onChange={(e) => setChReveal(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Prize title (optional)" value={chPrize} onChange={(e) => setChPrize(e.target.value)} />
                <input className={inputCls} placeholder="Prize description (optional)" value={chPrizeDesc} onChange={(e) => setChPrizeDesc(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={createChallenge}>Create Challenge</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewChallenge(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {challenges.map((ch) => {
              const phase = getChallengePhase(ch);
              return (
                <div key={ch.id} className="rounded-lg border border-surface-800 bg-surface-900/50 px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-white">{ch.title}</span>
                      <Badge variant={phase === 'completed' ? 'default' : phase === 'submissions' ? 'success' : phase === 'voting' ? 'warning' : 'info'} size="sm">{getPhaseLabel(phase)}</Badge>
                      <span className="text-[11px] text-surface-500">{ch.challenge_type}</span>
                    </div>
                    <p className="text-xs text-surface-400">{ch.submission_count} submissions · {formatDate(ch.starts_at)} → {formatDate(ch.reveal_at)}</p>
                  </div>
                  <a href={`/community/challenges/${ch.id}`} target="_blank" className="text-xs text-surface-400 hover:text-white transition-colors shrink-0">View</a>
                </div>
              );
            })}
            {challenges.length === 0 && <p className="text-center text-surface-400 text-sm py-8">No challenges yet. Weekly challenges auto-create when themes exist.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

interface CommunityData { posts: CommunityPost[]; categories: CommunityCategory[]; themes: ChallengeTheme[]; challenges: CommunityChallenge[] }

export default function CommunityPanel() {
  const { user } = useAuth();
  const { data, loading, reload } = useAdminData<CommunityData>('community', async () => {
    const supabase = createClient();
    const [postsRes, catsRes, themesRes, challengesRes] = await Promise.all([
      supabase.from('community_posts').select('*, author:profiles!author_id(id, full_name, email)').order('created_at', { ascending: false }),
      supabase.from('community_categories').select('*').order('display_order'),
      supabase.from('challenge_themes').select('*').order('title'),
      supabase.from('community_challenges').select('*').order('starts_at', { ascending: false }),
    ]);
    await fillEmails(supabase, (postsRes.data || []).map((p: { author?: { id?: string; email?: string | null } | null }) => p.author));
    return { posts: postsRes.data || [], categories: catsRes.data || [], themes: themesRes.data || [], challenges: challengesRes.data || [] };
  }, { posts: [], categories: [], themes: [], challenges: [] });

  const handleDeletePost = async (id: string) => {
    if (!confirm('Delete this community post?')) return;
    const supabase = createClient();
    await supabase.from('community_post_categories').delete().eq('post_id', id);
    await supabase.from('community_comments').delete().eq('post_id', id);
    await supabase.from('community_upvotes').delete().eq('post_id', id);
    await supabase.from('community_posts').delete().eq('id', id);
    await reload();
  };
  const handleSaveCategory = async (cat: Partial<CommunityCategory> & { id?: string }) => {
    const supabase = createClient();
    if (cat.id) {
      await supabase.from('community_categories').update({ name: cat.name, slug: cat.slug, description: cat.description, icon: cat.icon, color: cat.color, display_order: cat.display_order }).eq('id', cat.id);
    } else {
      await supabase.from('community_categories').insert({ name: cat.name!, slug: cat.slug!, description: cat.description, icon: cat.icon, color: cat.color, display_order: cat.display_order || 0 });
    }
    await reload();
  };
  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    const supabase = createClient();
    await supabase.from('community_post_categories').delete().eq('category_id', id);
    await supabase.from('community_categories').delete().eq('id', id);
    await reload();
  };
  const handleSaveTheme = async (theme: Partial<ChallengeTheme> & { id?: string }) => {
    const supabase = createClient();
    if (theme.id) {
      await supabase.from('challenge_themes').update({ title: theme.title, description: theme.description, genre_hint: theme.genre_hint, constraints: theme.constraints, difficulty: theme.difficulty, is_active: theme.is_active }).eq('id', theme.id);
    } else {
      await supabase.from('challenge_themes').insert({ title: theme.title!, description: theme.description!, genre_hint: theme.genre_hint, constraints: theme.constraints, difficulty: theme.difficulty || 'intermediate', is_active: true });
    }
    await reload();
  };
  const handleDeleteTheme = async (id: string) => {
    if (!confirm('Delete this challenge theme?')) return;
    await createClient().from('challenge_themes').delete().eq('id', id);
    await reload();
  };
  const handleCreateChallenge = async (challenge: { title: string; description: string; starts_at: string; submissions_close_at: string; voting_close_at: string; reveal_at: string; prize_title?: string | null; prize_description?: string | null }) => {
    if (!user) return;
    await createClient().from('community_challenges').insert({ ...challenge, challenge_type: 'custom', created_by: user.id });
    await reload();
  };

  if (loading) return <TabSkeleton />;
  return (
    <CommunityTab
      posts={data.posts}
      categories={data.categories}
      themes={data.themes}
      challenges={data.challenges}
      onDeletePost={handleDeletePost}
      onSaveCategory={handleSaveCategory}
      onDeleteCategory={handleDeleteCategory}
      onSaveTheme={handleSaveTheme}
      onDeleteTheme={handleDeleteTheme}
      onCreateChallenge={handleCreateChallenge}
    />
  );
}
