'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';
import { formatDate, timeAgo } from '@/lib/utils';
import { toast } from '@/components/ui';
import { PRODUCTION_ROLES, LANGUAGE_OPTIONS } from '@/lib/types';
import type { Project, Profile, ProjectMember, Character, ExternalCredit, ShowcaseComment, ShowcaseReview } from '@/lib/types';

// ============================================================
// Showcase Detail — IMDB-style project page
// ============================================================

type ShowcaseProject = Project & {
  author?: Profile;
};

type SetPhoto = {
  url: string;
  caption?: string;
  scene?: string;
  context?: string;
};

function parseSetPhotos(raw: unknown): SetPhoto[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') return { url: item };
    if (typeof item === 'object' && item && 'url' in item) return item as SetPhoto;
    return null;
  }).filter(Boolean) as SetPhoto[];
}

function getEmbedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`;
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?dnt=1`;
  return null;
}

function getRoleLabel(role: string): string {
  return PRODUCTION_ROLES.find((r) => r.value === role)?.label || role;
}

function StarRating({ rating, max = 5, size = 'sm', interactive = false, onChange }: {
  rating: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const sizeClass = size === 'lg' ? 'w-7 h-7' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const starVal = i + 1;
        const filled = interactive ? starVal <= (hoverRating || rating) : starVal <= Math.round(rating);
        const halfFilled = !interactive && !filled && starVal - 0.5 <= rating;
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
            onMouseEnter={() => interactive && setHoverRating(starVal)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            onClick={() => interactive && onChange?.(starVal)}
          >
            <svg className={`${sizeClass} ${filled ? 'text-amber-400' : halfFilled ? 'text-amber-400/50' : 'text-white/15'}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

export default function ShowcaseDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<ShowcaseProject | null>(null);
  const [team, setTeam] = useState<(ProjectMember & { profile?: Profile })[]>([]);
  const [externalCredits, setExternalCredits] = useState<ExternalCredit[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [sceneCount, setSceneCount] = useState(0);
  const [shotCount, setShotCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moreProjects, setMoreProjects] = useState<ShowcaseProject[]>([]);
  const [comments, setComments] = useState<ShowcaseComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reviews, setReviews] = useState<ShowcaseReview[]>([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<SetPhoto | null>(null);

  useEffect(() => {
    if (params.id) fetchProject();
  }, [params.id]);

  const fetchProject = async () => {
    const supabase = createClient();

    // Fetch project, team, characters, scene/shot counts, external credits, and more from same author
    const [projRes, teamRes, charRes, sceneRes, shotRes, extCreditsRes, commentsRes, reviewsRes] = await Promise.all([
      supabase
        .from('projects')
        .select('*, author:profiles!created_by(*)')
        .eq('id', params.id)
        .eq('is_showcased', true)
        .single(),
      supabase
        .from('project_members')
        .select('*, profile:profiles!user_id(*)')
        .eq('project_id', params.id),
      supabase
        .from('characters')
        .select('*')
        .eq('project_id', params.id)
        .order('name'),
      supabase
        .from('scenes')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', params.id),
      supabase
        .from('shots')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', params.id),
      supabase
        .from('external_credits')
        .select('*')
        .eq('project_id', params.id)
        .order('production_role'),
      supabase
        .from('showcase_comments')
        .select('*, profile:profiles(*)')
        .eq('project_id', params.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('showcase_reviews')
        .select('*, profile:profiles(*)')
        .eq('project_id', params.id)
        .order('created_at', { ascending: false }),
    ]);

    if (projRes.error || !projRes.data) {
      setLoading(false);
      return;
    }

    setProject(projRes.data);
    setTeam(teamRes.data || []);
    setExternalCredits(extCreditsRes.data || []);
    setCharacters(charRes.data || []);
    setSceneCount(sceneRes.count || 0);
    setShotCount(shotRes.count || 0);
    setComments(commentsRes.data || []);
    setReviews(reviewsRes.data || []);

    // Fetch more showcased projects from the same author, excluding this one
    const { data: moreData } = await supabase
      .from('projects')
      .select('*, author:profiles!created_by(id, full_name, avatar_url, username)')
      .eq('is_showcased', true)
      .eq('created_by', projRes.data.created_by)
      .neq('id', params.id)
      .not('wrap_url', 'is', null)
      .limit(4);

    setMoreProjects(moreData || []);
    setLoading(false);
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;
    setSubmittingComment(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('showcase_comments')
        .insert({ project_id: params.id, user_id: user.id, content: newComment.trim() })
        .select('*, profile:profiles(*)')
        .single();
      if (!error && data) {
        setComments((prev) => [...prev, data]);
        setNewComment('');
      }
    } catch (err) {
      console.error('Comment error:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('showcase_comments').delete().eq('id', commentId);
    if (!error) setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handleSubmitReview = async () => {
    if (!reviewRating || !user) return;
    setSubmittingReview(true);
    try {
      const supabase = createClient();
      // Use upsert to handle both insert and update — avoids 409 from UNIQUE(project_id, user_id)
      const { data, error } = await supabase
        .from('showcase_reviews')
        .upsert(
          {
            project_id: params.id,
            user_id: user.id,
            rating: reviewRating,
            title: reviewTitle.trim() || null,
            content: reviewContent.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'project_id,user_id' }
        )
        .select('*')
        .single();

      if (!error && data) {
        // Re-fetch with profile join
        const { data: full, error: refetchErr } = await supabase
          .from('showcase_reviews')
          .select('*, profile:profiles(*)')
          .eq('id', data.id)
          .single();

        if (refetchErr) toast.error('Failed to refresh review data');
        const review = full || data;
        setReviews((prev) => {
          const idx = prev.findIndex((r) => r.id === review.id || r.user_id === user.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = review;
            return updated;
          }
          return [review, ...prev];
        });
      }

      setShowReviewForm(false);
      setReviewRating(0);
      setReviewTitle('');
      setReviewContent('');
    } catch (err) {
      console.error('Review error:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('showcase_reviews').delete().eq('id', reviewId);
    if (!error) setReviews((prev) => prev.filter((r) => r.id !== reviewId));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-amber-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🎬</div>
        <h1 className="text-2xl font-black">Project not found</h1>
        <p className="text-white/40">This project may not be showcased or doesn&apos;t exist.</p>
        <Link href="/community/showcase" className="mt-4 px-5 py-2.5 text-sm font-medium text-black bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors">
          Browse Projects
        </Link>
      </div>
    );
  }

  const embedUrl = project.wrap_url ? getEmbedUrl(project.wrap_url) : null;
  const director = team.find((m) => m.production_role === 'director');
  const crewByRole = team.filter((m) => m.production_role && m.production_role !== 'actor' && m.production_role !== 'extra');
  const cast = team.filter((m) => m.production_role === 'actor' || m.production_role === 'extra');
  const externalCast = externalCredits.filter((c) => c.production_role === 'actor' || c.production_role === 'extra');
  const externalCrew = externalCredits.filter((c) => c.production_role !== 'actor' && c.production_role !== 'extra');
  const externalLinks = (project.external_links || {}) as Record<string, string>;
  const setPhotos = parseSetPhotos(project.set_photos);

  // Build unified cast cards: match characters to their actors
  const usedCharIds = new Set<string>();
  const usedCastIds = new Set<string>();
  const usedExtCastIds = new Set<string>();

  type UnifiedCastCard = {
    id: string;
    characterName: string | null;
    characterDesc: string | null;
    actorName: string | null;
    actorAvatar: string | null;
    actorLink: string | null;
    externalUrl: string | null;
    role: string;
  };

  const unifiedCast: UnifiedCastCard[] = [];

  // First: match characters to internal cast members by character_name
  characters.forEach((char) => {
    const matchMember = cast.find(
      (m) => !usedCastIds.has(m.id) && m.character_name?.toLowerCase().trim() === char.name.toLowerCase().trim()
    );
    const matchExternal = !matchMember
      ? externalCast.find((c) => !usedExtCastIds.has(c.id) && c.character_name?.toLowerCase().trim() === char.name.toLowerCase().trim())
      : null;

    if (matchMember) {
      usedCharIds.add(char.id);
      usedCastIds.add(matchMember.id);
      unifiedCast.push({
        id: `char-${char.id}`,
        characterName: char.name,
        characterDesc: char.description || null,
        actorName: matchMember.profile?.full_name || 'Unknown',
        actorAvatar: matchMember.profile?.avatar_url || null,
        actorLink: `/u/${matchMember.profile?.username || matchMember.user_id}`,
        externalUrl: null,
        role: matchMember.production_role || 'actor',
      });
    } else if (matchExternal) {
      usedCharIds.add(char.id);
      usedExtCastIds.add(matchExternal.id);
      unifiedCast.push({
        id: `char-${char.id}`,
        characterName: char.name,
        characterDesc: char.description || null,
        actorName: matchExternal.name,
        actorAvatar: matchExternal.avatar_url,
        actorLink: null,
        externalUrl: matchExternal.external_url,
        role: matchExternal.production_role,
      });
    } else {
      // Character with no matched actor
      usedCharIds.add(char.id);
      unifiedCast.push({
        id: `char-${char.id}`,
        characterName: char.name,
        characterDesc: char.description || null,
        actorName: null,
        actorAvatar: null,
        actorLink: null,
        externalUrl: null,
        role: 'character',
      });
    }
  });

  // Remaining internal cast without a character match
  cast.filter((m) => !usedCastIds.has(m.id)).forEach((member) => {
    unifiedCast.push({
      id: `member-${member.id}`,
      characterName: member.character_name || null,
      characterDesc: null,
      actorName: member.profile?.full_name || 'Unknown',
      actorAvatar: member.profile?.avatar_url || null,
      actorLink: `/u/${member.profile?.username || member.user_id}`,
      externalUrl: null,
      role: member.production_role || 'actor',
    });
  });

  // Remaining external cast without a character match
  externalCast.filter((c) => !usedExtCastIds.has(c.id)).forEach((credit) => {
    unifiedCast.push({
      id: `ext-${credit.id}`,
      characterName: credit.character_name || null,
      characterDesc: null,
      actorName: credit.name,
      actorAvatar: credit.avatar_url,
      actorLink: null,
      externalUrl: credit.external_url,
      role: credit.production_role,
    });
  });

  // Review computed values
  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const userReview = user ? reviews.find((r) => r.user_id === user.id) : null;
  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: reviews.length > 0 ? (reviews.filter((r) => r.rating === star).length / reviews.length) * 100 : 0,
  }));

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-[#0d0d0d]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link href="/community/showcase" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              <span className="text-sm font-medium">All Projects</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/community" className="text-xs text-white/40 hover:text-white transition-colors">Community</Link>
            {user && <Link href="/dashboard" className="text-xs text-white/40 hover:text-white transition-colors">Dashboard</Link>}
          </div>
        </div>
      </nav>

      {/* Hero — Video Player */}
      <div className="bg-black">
        <div className="max-w-5xl mx-auto">
          {embedUrl ? (
            <div className="aspect-video">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                title={project.title}
              />
            </div>
          ) : project.cover_url ? (
            <div className="aspect-video relative">
              <img src={project.cover_url} alt={project.title} className="w-full h-full object-cover" />
              {project.wrap_url && (
                <a
                  href={project.wrap_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 bg-black/40 flex items-center justify-center group"
                >
                  <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center shadow-2xl shadow-amber-500/30 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-black ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </a>
              )}
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-neutral-900 to-neutral-800 flex items-center justify-center">
              {project.wrap_url ? (
                <a
                  href={project.wrap_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-3 text-white/40 hover:text-amber-400 transition-colors"
                >
                  <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-sm font-medium">Watch on external site ↗</span>
                </a>
              ) : (
                <svg className="w-16 h-16 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Project Details */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Main Column */}
          <div className="flex-1 min-w-0">
            {/* Title Section */}
            <div className="flex items-start gap-6">
              {/* Poster (if available) */}
              {project.poster_url && (
                <div className="hidden md:block w-32 shrink-0 rounded-lg overflow-hidden shadow-xl">
                  <img src={project.poster_url} alt={project.title} className="w-full aspect-[2/3] object-cover" />
                </div>
              )}

              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">{project.title}</h1>

                {/* Meta badges */}
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  {project.format && (
                    <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                      {project.format}
                    </span>
                  )}
                  {project.genre && project.genre.length > 0 && project.genre.map((g) => (
                    <span key={g} className="px-3 py-1 text-xs font-medium text-white/60 bg-surface-900/5 rounded-full border border-white/10">
                      {g}
                    </span>
                  ))}
                  {project.target_length_minutes && (
                    <span className="text-xs text-white/40">{project.target_length_minutes} min</span>
                  )}
                  {project.status === 'completed' && (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 rounded-full border border-green-500/20">
                      Completed
                    </span>
                  )}
                </div>

                {/* Average Rating */}
                {reviews.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <StarRating rating={avgRating} size="sm" />
                    <span className="text-sm font-semibold text-amber-400">{avgRating.toFixed(1)}</span>
                    <span className="text-xs text-white/50">({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
                  </div>
                )}

                {/* Director / Author */}
                <div className="mt-4 text-sm text-white/50">
                  {director ? (
                    <span>
                      Directed by{' '}
                      <Link
                        href={`/u/${director.profile?.username || director.user_id}`}
                        className="text-white/80 hover:text-amber-400 transition-colors font-medium"
                      >
                        {director.profile?.full_name || 'Unknown'}
                      </Link>
                    </span>
                  ) : project.author ? (
                    <span>
                      Created by{' '}
                      <Link
                        href={`/u/${project.author.username || project.created_by}`}
                        className="text-white/80 hover:text-amber-400 transition-colors font-medium"
                      >
                        {project.author.full_name || 'Unknown'}
                      </Link>
                    </span>
                  ) : null}
                </div>

                {/* Watch button (external link) */}
                {project.wrap_url && (
                  <a
                    href={project.wrap_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 text-sm font-semibold text-black bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    Watch
                    <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-surface-900/10 my-8" />

            {/* Synopsis / Description */}
            {(project.showcase_description || project.synopsis || project.logline) && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-3 text-white/90">About</h2>
                {project.logline && (
                  <p className="text-white/70 italic mb-3">&ldquo;{project.logline}&rdquo;</p>
                )}
                {(project.showcase_description || project.synopsis) && (
                  <p className="text-white/50 leading-relaxed whitespace-pre-line">
                    {project.showcase_description || project.synopsis}
                  </p>
                )}
              </section>
            )}

            {/* Production Stats */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4 text-white/90">Production Details</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Format', value: project.format || '—' },
                  { label: 'Length', value: project.target_length_minutes ? `${project.target_length_minutes} min` : '—' },
                  { label: 'Scenes', value: sceneCount > 0 ? sceneCount.toString() : '—' },
                  { label: 'Shots', value: shotCount > 0 ? shotCount.toString() : '—' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-surface-900/[0.03] border border-white/[0.06] rounded-lg p-4">
                    <p className="text-[11px] uppercase tracking-wider text-white/50 mb-1">{stat.label}</p>
                    <p className="text-lg font-semibold text-white/80">{stat.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Cast / Characters — unified cards */}
            {unifiedCast.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4 text-white/90">Cast</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {unifiedCast.map((card) => (
                    <div key={card.id} className="flex items-center gap-3 bg-surface-900/[0.03] border border-white/[0.06] rounded-lg p-3">
                      {/* Avatar */}
                      {card.actorAvatar ? (
                        <img src={card.actorAvatar} alt={card.actorName || card.characterName || 'Cast avatar'} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${card.actorName ? 'bg-surface-900/10 text-white/40' : 'bg-amber-500/10 text-amber-400/60'}`}>
                          {(card.actorName || card.characterName || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        {/* Character name (primary line) */}
                        {card.characterName && (
                          <p className="text-sm font-semibold text-white/90 truncate">{card.characterName}</p>
                        )}
                        {/* Actor info */}
                        {card.actorName ? (
                          <div className="flex items-center gap-1.5">
                            {card.characterName && <span className="text-xs text-white/50">played by</span>}
                            {card.actorLink ? (
                              <Link
                                href={card.actorLink}
                                className={`text-xs font-medium hover:text-amber-400 transition-colors truncate ${card.characterName ? 'text-amber-400/70' : 'text-sm text-white/80'}`}
                              >
                                {card.actorName}
                              </Link>
                            ) : (
                              <span className={`text-xs font-medium truncate ${card.characterName ? 'text-amber-400/70' : 'text-sm text-white/80'}`}>
                                {card.actorName}
                              </span>
                            )}
                            {card.externalUrl && (
                              <a href={card.externalUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400/60 hover:text-amber-400 shrink-0">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-white/50">{card.characterDesc || 'Character'}</p>
                        )}
                        {/* If no character name but actor has one assigned */}
                        {!card.characterName && card.actorName && (
                          <p className="text-xs text-white/50">{getRoleLabel(card.role)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Crew */}
            {(crewByRole.length > 0 || externalCrew.length > 0) && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4 text-white/90">Crew</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {crewByRole.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 bg-surface-900/[0.03] border border-white/[0.06] rounded-lg p-3">
                      {member.profile?.avatar_url ? (
                        <img src={member.profile.avatar_url} alt={member.profile.full_name || 'Team member'} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-surface-900/10 flex items-center justify-center text-sm font-bold text-white/40">
                          {(member.profile?.full_name || '?')[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/u/${member.profile?.username || member.user_id}`}
                          className="text-sm font-medium text-white/80 hover:text-amber-400 transition-colors truncate block"
                        >
                          {member.profile?.full_name || 'Unknown'}
                        </Link>
                        <p className="text-xs text-amber-400/60">{getRoleLabel(member.production_role || '')}</p>
                      </div>
                    </div>
                  ))}
                  {externalCrew.map((credit) => (
                    <div key={credit.id} className="flex items-center gap-3 bg-surface-900/[0.03] border border-white/[0.06] rounded-lg p-3">
                      {credit.avatar_url ? (
                        <img src={credit.avatar_url} alt={credit.name || 'Credit avatar'} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-surface-900/10 flex items-center justify-center text-sm font-bold text-white/40">
                          {credit.name[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white/80 truncate">{credit.name}</p>
                          {credit.external_url && (
                            <a href={credit.external_url} target="_blank" rel="noopener noreferrer" className="text-amber-400/60 hover:text-amber-400 shrink-0">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-amber-400/60">{getRoleLabel(credit.production_role)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Production Trivia */}
            {project.production_trivia && (project.production_trivia as { title: string; content: string }[]).length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4 text-white/90 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  Production Trivia
                </h2>
                <div className="space-y-3">
                  {(project.production_trivia as { title: string; content: string }[]).map((item, idx) => (
                    <div key={idx} className="bg-surface-900/[0.03] border border-white/[0.06] rounded-lg p-4">
                      {item.title && (
                        <h3 className="text-sm font-semibold text-amber-400/80 mb-1">{item.title}</h3>
                      )}
                      {item.content && (
                        <p className="text-sm text-white/50 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Set Photos */}
            {setPhotos.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4 text-white/90 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Set Photos
                  <span className="text-xs font-normal text-white/50 ml-1">({setPhotos.length})</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {setPhotos.map((photo, idx) => (
                    <button
                      key={idx}
                      onClick={() => setLightboxPhoto(photo)}
                      className="text-left aspect-video bg-surface-900/[0.03] border border-white/[0.06] rounded-lg overflow-hidden hover:border-amber-500/30 transition-all group relative"
                    >
                      <img src={photo.url} alt={photo.caption || `Set photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      {(photo.caption || photo.scene) && (
                        <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {photo.scene && <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">{photo.scene}</span>}
                          {photo.caption && <p className="text-xs text-white/80 line-clamp-1">{photo.caption}</p>}
                        </div>
                      )}
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-3.5 h-3.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Photo Lightbox Modal */}
            {lightboxPhoto && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setLightboxPhoto(null)}>
                <div className="relative max-w-4xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setLightboxPhoto(null)}
                    className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  <img
                    src={lightboxPhoto.url}
                    alt={lightboxPhoto.caption || 'Set photo'}
                    className="w-full max-h-[80vh] object-contain rounded-xl"
                  />
                  {(lightboxPhoto.caption || lightboxPhoto.scene || lightboxPhoto.context) && (
                    <div className="mt-3 bg-surface-900/[0.05] border border-white/[0.08] rounded-lg p-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        {lightboxPhoto.scene && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 rounded-full border border-amber-500/20">
                            {lightboxPhoto.scene}
                          </span>
                        )}
                        {lightboxPhoto.context && (
                          <span className="px-2 py-0.5 text-[10px] font-medium text-white/50 bg-surface-900/[0.05] rounded-full border border-white/10">
                            {lightboxPhoto.context}
                          </span>
                        )}
                      </div>
                      {lightboxPhoto.caption && (
                        <p className="text-sm text-white/70 mt-2 leading-relaxed">{lightboxPhoto.caption}</p>
                      )}
                    </div>
                  )}
                  {/* Navigate between photos */}
                  {setPhotos.length > 1 && (
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none px-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); const idx = setPhotos.findIndex((p) => p.url === lightboxPhoto.url); setLightboxPhoto(setPhotos[(idx - 1 + setPhotos.length) % setPhotos.length]); }}
                        className="pointer-events-auto w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/70 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); const idx = setPhotos.findIndex((p) => p.url === lightboxPhoto.url); setLightboxPhoto(setPhotos[(idx + 1) % setPhotos.length]); }}
                        className="pointer-events-auto w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/70 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reviews & Ratings */}
            <section id="reviews-section" className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  Reviews
                  <span className="text-xs font-normal text-white/50 ml-1">({reviews.length})</span>
                </h2>
                {user && !userReview && !showReviewForm && (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="px-4 py-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors"
                  >
                    Write a Review
                  </button>
                )}
              </div>

              {/* Review form */}
              {showReviewForm && user && (
                <div className="bg-surface-900/[0.03] border border-white/[0.08] rounded-xl p-5 mb-4">
                  <h3 className="text-sm font-semibold text-white/70 mb-3">{userReview ? 'Edit Your Review' : 'Your Review'}</h3>
                  <div className="mb-4">
                    <label className="text-xs text-white/40 mb-1.5 block">Rating</label>
                    <StarRating rating={reviewRating} size="lg" interactive onChange={setReviewRating} />
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-white/40 mb-1.5 block">Title (optional)</label>
                    <input
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      placeholder="Summarize your thoughts..."
                      className="w-full bg-surface-900/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-amber-500/40"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-white/40 mb-1.5 block">Review (optional)</label>
                    <textarea
                      value={reviewContent}
                      onChange={(e) => setReviewContent(e.target.value)}
                      placeholder="Tell others what you liked or disliked..."
                      rows={3}
                      className="w-full bg-surface-900/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-amber-500/40 resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => { setShowReviewForm(false); setReviewRating(userReview?.rating || 0); setReviewTitle(userReview?.title || ''); setReviewContent(userReview?.content || ''); }}
                      className="px-4 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitReview}
                      disabled={!reviewRating || submittingReview}
                      className="px-5 py-1.5 text-xs font-semibold text-black bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      {submittingReview ? 'Submitting...' : userReview ? 'Update Review' : 'Submit Review'}
                    </button>
                  </div>
                </div>
              )}

              {/* Rating summary */}
              {reviews.length > 0 && (
                <div className="bg-surface-900/[0.03] border border-white/[0.06] rounded-xl p-5 mb-4">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-4xl font-black text-amber-400">{avgRating.toFixed(1)}</div>
                      <StarRating rating={avgRating} size="sm" />
                      <div className="text-xs text-white/50 mt-1">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</div>
                    </div>
                    <div className="flex-1 space-y-1">
                      {ratingDistribution.map(({ star, count, pct }) => (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-xs text-white/40 w-3 text-right">{star}</span>
                          <svg className="w-3 h-3 text-amber-400/60" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                          <div className="flex-1 h-2 bg-surface-900/[0.06] rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-white/50 w-5">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Reviews list */}
              {reviews.length > 0 ? (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-surface-900/[0.02] border border-white/[0.05] rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        {review.profile?.avatar_url ? (
                          <img src={review.profile.avatar_url} alt={review.profile.full_name || 'Reviewer avatar'} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-surface-900/10 flex items-center justify-center text-xs font-bold text-white/40 shrink-0">
                            {(review.profile?.full_name || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Link
                              href={`/u/${review.profile?.username || review.user_id}`}
                              className="text-xs font-semibold text-white/70 hover:text-amber-400 transition-colors"
                            >
                              {review.profile?.full_name || 'User'}
                            </Link>
                            {review.profile?.role === 'moderator' && <span className="px-1 py-0.5 text-[8px] font-bold text-green-400 bg-green-500/10 rounded border border-green-500/20">MOD</span>}
                            {review.profile?.role === 'admin' && <span className="px-1 py-0.5 text-[8px] font-bold text-red-400 bg-red-500/10 rounded border border-red-500/20">ADMIN</span>}
                            <StarRating rating={review.rating} size="sm" />
                            <span className="text-[10px] text-white/20">{timeAgo(review.created_at)}</span>
                            {user && (user.id === review.user_id || user.role === 'moderator' || user.role === 'admin') && (
                              <div className="ml-auto flex items-center gap-2">
                                {user.id === review.user_id && (
                                  <button
                                    onClick={() => { setShowReviewForm(true); setReviewRating(review.rating); setReviewTitle(review.title || ''); setReviewContent(review.content || ''); }}
                                    className="text-white/20 hover:text-amber-400 transition-colors"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteReview(review.id)}
                                  className="text-white/20 hover:text-red-400 transition-colors"
                                  title={user.id !== review.user_id ? 'Remove (mod)' : 'Delete'}
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                {user.id !== review.user_id && <span className="text-[9px] font-semibold text-amber-400/60">MOD</span>}
                              </div>
                            )}
                          </div>
                          {review.title && <p className="text-sm font-semibold text-white/80 mb-1">{review.title}</p>}
                          {review.content && <p className="text-sm text-white/50 leading-relaxed whitespace-pre-wrap">{review.content}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !showReviewForm ? (
                <p className="text-sm text-white/20 text-center py-4">No reviews yet. Be the first to rate this project!</p>
              ) : null}

              {/* Sign-in prompt */}
              {!user && (
                <div className="bg-surface-900/[0.03] border border-white/[0.06] rounded-lg p-4 mt-3 text-center">
                  <p className="text-sm text-white/40">
                    <Link href="/auth/login" className="text-amber-400 hover:text-amber-300 transition-colors">Sign in</Link> to leave a review
                  </p>
                </div>
              )}
            </section>

            {/* Comments / Feedback */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4 text-white/90 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                Feedback
                <span className="text-xs font-normal text-white/50 ml-1">({comments.length})</span>
              </h2>

              {/* Comment input */}
              {user ? (
                <div className="flex gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0 mt-1">
                    {(user.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Share your thoughts on this project..."
                      rows={2}
                      className="w-full bg-surface-900/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-amber-500/40 resize-none"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim() || submittingComment}
                        className="px-4 py-1.5 text-xs font-semibold text-black bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                      >
                        {submittingComment ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-900/[0.03] border border-white/[0.06] rounded-lg p-4 mb-4 text-center">
                  <p className="text-sm text-white/40">
                    <Link href="/auth/login" className="text-amber-400 hover:text-amber-300 transition-colors">Sign in</Link> to leave feedback
                  </p>
                </div>
              )}

              {/* Comments list */}
              {comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 bg-surface-900/[0.02] border border-white/[0.05] rounded-lg p-3">
                      {comment.profile?.avatar_url ? (
                        <img src={comment.profile.avatar_url} alt={comment.profile.full_name || 'Commenter avatar'} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-surface-900/10 flex items-center justify-center text-xs font-bold text-white/40 shrink-0">
                          {(comment.profile?.full_name || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/u/${comment.profile?.username || comment.user_id}`}
                            className="text-xs font-semibold text-white/70 hover:text-amber-400 transition-colors"
                          >
                            {comment.profile?.full_name || 'User'}
                          </Link>
                          {comment.profile?.role === 'moderator' && <span className="px-1 py-0.5 text-[8px] font-bold text-green-400 bg-green-500/10 rounded border border-green-500/20">MOD</span>}
                          {comment.profile?.role === 'admin' && <span className="px-1 py-0.5 text-[8px] font-bold text-red-400 bg-red-500/10 rounded border border-red-500/20">ADMIN</span>}
                          <span className="text-[10px] text-white/20">{timeAgo(comment.created_at)}</span>
                          {user && (user.id === comment.user_id || user.role === 'moderator' || user.role === 'admin') && (
                            <div className="ml-auto flex items-center gap-1">
                              {user.id !== comment.user_id && <span className="text-[9px] font-semibold text-amber-400/60">MOD</span>}
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-white/20 hover:text-red-400 transition-colors"
                                title={user.id !== comment.user_id ? 'Remove (mod)' : 'Delete'}
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-white/50 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/20 text-center py-4">No feedback yet. Be the first to share your thoughts!</p>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="lg:w-72 shrink-0 space-y-6">
            {/* Project Info Card */}
            <div className="bg-surface-900/[0.03] border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Info</h3>
              <dl className="space-y-3 text-sm">
                {project.format && (
                  <div>
                    <dt className="text-white/50">Format</dt>
                    <dd className="text-white/70 font-medium">{project.format}</dd>
                  </div>
                )}
                {project.genre && project.genre.length > 0 && (
                  <div>
                    <dt className="text-white/50">Genre</dt>
                    <dd className="text-white/70 font-medium">{project.genre.join(', ')}</dd>
                  </div>
                )}
                {project.target_length_minutes && (
                  <div>
                    <dt className="text-white/50">Runtime</dt>
                    <dd className="text-white/70 font-medium">{project.target_length_minutes} minutes</dd>
                  </div>
                )}
                {project.script_type && (
                  <div>
                    <dt className="text-white/50">Script Type</dt>
                    <dd className="text-white/70 font-medium capitalize">{project.script_type}</dd>
                  </div>
                )}
                {project.episode_count && project.episode_count > 0 && (
                  <div>
                    <dt className="text-white/50">Episodes</dt>
                    <dd className="text-white/70 font-medium">{project.episode_count}{project.season_number ? ` (S${project.season_number})` : ''}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-white/50">Added</dt>
                  <dd className="text-white/70 font-medium">{formatDate(project.created_at)}</dd>
                </div>
                {project.language && (
                  <div>
                    <dt className="text-white/50">Language</dt>
                    <dd className="text-white/70 font-medium">{LANGUAGE_OPTIONS.find((l) => l.value === project.language)?.label || project.language}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Rating Card */}
            <div className="bg-surface-900/[0.03] border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Rating</h3>
              {reviews.length > 0 ? (
                <div className="text-center">
                  <div className="text-3xl font-black text-amber-400">{avgRating.toFixed(1)}</div>
                  <div className="flex justify-center mt-1"><StarRating rating={avgRating} size="sm" /></div>
                  <p className="text-xs text-white/50 mt-1">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</p>
                </div>
              ) : (
                <p className="text-xs text-white/50 text-center">No ratings yet</p>
              )}
              {user && !userReview && (
                <button
                  onClick={() => { setShowReviewForm(true); document.querySelector('#reviews-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="w-full mt-3 px-4 py-2 text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors"
                >
                  Rate this project
                </button>
              )}
            </div>

            {/* Creator Card */}
            {project.author && (
              <Link
                href={`/u/${project.author.username || project.created_by}`}
                className="block bg-surface-900/[0.03] border border-white/[0.06] rounded-xl p-5 hover:border-amber-500/30 transition-colors"
              >
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Creator</h3>
                <div className="flex items-center gap-3">
                  {project.author.avatar_url ? (
                    <img src={project.author.avatar_url} alt={project.author.full_name || 'Author avatar'} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-lg font-bold text-amber-400">
                      {(project.author.full_name || '?')[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-white/90">{project.author.full_name || 'Unknown'}</p>
                    {project.author.username && (
                      <p className="text-xs text-white/40">@{project.author.username}</p>
                    )}
                  </div>
                </div>
                {project.author.bio && (
                  <p className="text-xs text-white/40 mt-3 line-clamp-3">{project.author.bio}</p>
                )}
              </Link>
            )}

            {/* External watch link */}
            {project.wrap_url && (
              <a
                href={project.wrap_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-semibold text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                Watch on {project.wrap_url.includes('youtube') ? 'YouTube' : project.wrap_url.includes('vimeo') ? 'Vimeo' : 'External Site'}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            )}

            {/* Deep Dive Section */}
            {(project.showcase_script || project.showcase_mindmap || project.showcase_moodboard) && (
              <div className="bg-surface-900/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Deep Dive</h3>
                <p className="text-xs text-white/50 mb-4">Explore the creative process behind this production</p>
                <div className="space-y-2">
                  {project.showcase_script && (
                    <Link
                      href={`/community/showcase/${params.id}/script`}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-white/80 bg-surface-900/[0.04] hover:bg-surface-900/[0.08] border border-white/[0.08] hover:border-amber-500/30 rounded-lg transition-all group"
                    >
                      <svg className="w-5 h-5 text-amber-400/60 group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <div>
                        <p className="font-medium">Read Script</p>
                        <p className="text-[10px] text-white/50">Full screenplay</p>
                      </div>
                      <svg className="w-4 h-4 ml-auto text-white/20 group-hover:text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  )}
                  {project.showcase_mindmap && (
                    <Link
                      href={`/community/showcase/${params.id}/mindmap`}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-white/80 bg-surface-900/[0.04] hover:bg-surface-900/[0.08] border border-white/[0.08] hover:border-amber-500/30 rounded-lg transition-all group"
                    >
                      <svg className="w-5 h-5 text-purple-400/60 group-hover:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      <div>
                        <p className="font-medium">Explore Mind Map</p>
                        <p className="text-[10px] text-white/50">Ideas &amp; connections</p>
                      </div>
                      <svg className="w-4 h-4 ml-auto text-white/20 group-hover:text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  )}
                  {project.showcase_moodboard && (
                    <Link
                      href={`/community/showcase/${params.id}/moodboard`}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-white/80 bg-surface-900/[0.04] hover:bg-surface-900/[0.08] border border-white/[0.08] hover:border-amber-500/30 rounded-lg transition-all group"
                    >
                      <svg className="w-5 h-5 text-pink-400/60 group-hover:text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <div>
                        <p className="font-medium">View Moodboard</p>
                        <p className="text-[10px] text-white/50">Visual inspiration</p>
                      </div>
                      <svg className="w-4 h-4 ml-auto text-white/20 group-hover:text-pink-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* External Links */}
            {Object.keys(externalLinks).filter((k) => externalLinks[k]).length > 0 && (
              <div className="bg-surface-900/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Links</h3>
                <div className="space-y-2">
                  {externalLinks.imdb && (
                    <a href={externalLinks.imdb} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-white/70 hover:text-amber-400 transition-colors">
                      <span className="text-[10px] font-black text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">IMDb</span>
                      IMDb Page
                      <svg className="w-3 h-3 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  )}
                  {externalLinks.tmdb && (
                    <a href={externalLinks.tmdb} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-white/70 hover:text-amber-400 transition-colors">
                      <span className="text-[10px] font-bold text-teal-400 bg-teal-400/10 px-1.5 py-0.5 rounded">TMDB</span>
                      TMDB Page
                      <svg className="w-3 h-3 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  )}
                  {externalLinks.letterboxd && (
                    <a href={externalLinks.letterboxd} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-white/70 hover:text-amber-400 transition-colors">
                      <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">LB</span>
                      Letterboxd
                      <svg className="w-3 h-3 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  )}
                  {externalLinks.website && (
                    <a href={externalLinks.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-white/70 hover:text-amber-400 transition-colors">
                      <span className="text-[10px] font-bold text-white/40 bg-surface-900/5 px-1.5 py-0.5 rounded">WWW</span>
                      Official Website
                      <svg className="w-3 h-3 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Report / Mod Actions */}
            {user && (
              <div className="space-y-2">
                <Link
                  href={`/support?type=showcase&id=${params.id}&subject=${encodeURIComponent(`Report showcase: ${project.title}`)}`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-xs font-medium text-white/40 bg-surface-900/[0.03] hover:bg-surface-900/[0.06] border border-white/[0.06] rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                  Report this showcase
                </Link>
              </div>
            )}
          </aside>
        </div>

        {/* More from this creator */}
        {moreProjects.length > 0 && (
          <section className="mt-16">
            <div className="h-px bg-surface-900/10 mb-8" />
            <h2 className="text-xl font-black mb-6">
              More from{' '}
              <span className="text-amber-400">{project.author?.full_name || 'this creator'}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {moreProjects.map((p) => {
                const ytMatch = p.wrap_url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                const thumb = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg` : p.cover_url || p.poster_url;
                return (
                  <Link
                    key={p.id}
                    href={`/community/showcase/${p.id}`}
                    className="group rounded-xl bg-surface-900/[0.03] border border-white/[0.06] overflow-hidden hover:border-amber-500/30 transition-all"
                  >
                    <div className="aspect-video relative bg-black overflow-hidden">
                      {thumb ? (
                        <img src={thumb} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-neutral-900 to-neutral-800 flex items-center justify-center">
                          <svg className="w-8 h-8 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold text-white/80 group-hover:text-amber-400 transition-colors line-clamp-1">{p.title}</h3>
                      {p.genre && <p className="text-[10px] text-white/50 mt-1">{p.genre.join(', ')}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6 mt-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-white/50">Screenplay Studio</span>
          <div className="flex items-center gap-6 text-sm text-white/50">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/community/showcase" className="hover:text-white transition-colors">Showcase</Link>
            <Link href="/community" className="hover:text-white transition-colors">Community</Link>
            <SiteVersion light />
          </div>
        </div>
      </footer>
    </div>
  );
}
