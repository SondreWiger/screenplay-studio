'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';
import { timeAgo } from '@/lib/utils';
import { LANGUAGE_OPTIONS } from '@/lib/types';
import type { Project } from '@/lib/types';

// ============================================================
// Finished Projects — IMDB-style gallery of showcased productions
// ============================================================

type ShowcasedProject = Project & {
  author?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
  };
  team?: { user_id: string; production_role: string; profile: { full_name: string | null; avatar_url: string | null; username: string | null } }[];
};

function getEmbedUrl(url: string): string | null {
  // YouTube — various formats
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?dnt=1`;
  return null;
}

function getThumbnail(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  return null;
}

export default function ShowcasePage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ShowcasedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'title'>('newest');
  const [filterGenre, setFilterGenre] = useState<string | null>(null);
  const [filterFormat, setFilterFormat] = useState<string | null>(null);
  const [filterLanguage, setFilterLanguage] = useState<string | null>(null);
  const [reviewStats, setReviewStats] = useState<Record<string, { avg: number; count: number }>>({});

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('*, author:profiles!created_by(id, full_name, avatar_url, username)')
      .eq('is_showcased', true)
      .not('wrap_url', 'is', null)
      .order('updated_at', { ascending: false });

    if (error) console.error('Showcase fetch error:', error.message);
    setProjects(data || []);

    // Fetch review stats for all showcased projects
    if (data && data.length > 0) {
      const { data: reviews } = await supabase
        .from('showcase_reviews')
        .select('project_id, rating')
        .in('project_id', data.map((p) => p.id));
      if (reviews) {
        const stats: Record<string, { avg: number; count: number }> = {};
        reviews.forEach((r) => {
          if (!stats[r.project_id]) stats[r.project_id] = { avg: 0, count: 0 };
          stats[r.project_id].count++;
          stats[r.project_id].avg += r.rating;
        });
        Object.keys(stats).forEach((pid) => {
          stats[pid].avg = stats[pid].avg / stats[pid].count;
        });
        setReviewStats(stats);
      }
    }

    setLoading(false);
  };

  // Collect unique genres & formats for filters
  const allGenres = Array.from(new Set(projects.flatMap((p) => p.genre || []))).sort();
  const allFormats = Array.from(new Set(projects.map((p) => p.format).filter(Boolean))).sort();
  const allLanguages = Array.from(new Set(projects.map((p) => p.language).filter(Boolean))).sort() as string[];

  const filtered = projects
    .filter((p) => !filterGenre || (p.genre || []).includes(filterGenre))
    .filter((p) => !filterFormat || p.format === filterFormat)
    .filter((p) => !filterLanguage || p.language === filterLanguage)
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-[#0d0d0d]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/community" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
              Finished Projects
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/community" className="text-sm text-white/50 hover:text-white transition-colors">Community</Link>
            <Link href="/community/showcase" className="text-sm font-semibold text-white border-b-2 border-amber-500 pb-0.5">Showcase</Link>
            <Link href="/community/challenges" className="text-sm text-white/50 hover:text-white transition-colors">Challenges</Link>
            <Link href="/community/free-scripts" className="text-sm text-white/50 hover:text-white transition-colors">Free Scripts</Link>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/dashboard" className="text-xs text-white/50 hover:text-white transition-colors">Dashboard</Link>
                <Link href={`/u/${user.username || user.id}`}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full hover:ring-2 ring-amber-400 transition-all" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-amber-900/50 flex items-center justify-center text-xs font-bold text-amber-400 hover:ring-2 ring-amber-400 transition-all">
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </Link>
              </>
            ) : (
              <Link href="/auth/login?redirect=/community/showcase" className="px-4 py-2 text-sm font-medium text-black bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors">Sign In</Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/20 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-6 py-16 relative">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Finished Projects</span>
          </h1>
          <p className="text-lg text-white/50 mt-3 max-w-xl">
            Watch completed productions from the Screenplay Studio community. From short films to features — see what others have created.
          </p>
          <div className="flex items-center gap-3 mt-6 text-sm text-white/40">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2" /></svg>
              {projects.length} projects
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            {(['newest', 'title'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                  sortBy === s ? 'bg-amber-500 text-black' : 'text-white/50 hover:text-white'
                }`}
              >
                {s === 'newest' ? 'Latest' : 'A–Z'}
              </button>
            ))}
          </div>

          {/* Genre filter */}
          {allGenres.length > 0 && (
            <select
              value={filterGenre || ''}
              onChange={(e) => setFilterGenre(e.target.value || null)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 appearance-none cursor-pointer"
            >
              <option value="">All Genres</option>
              {allGenres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}

          {/* Format filter */}
          {allFormats.length > 0 && (
            <select
              value={filterFormat || ''}
              onChange={(e) => setFilterFormat(e.target.value || null)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 appearance-none cursor-pointer"
            >
              <option value="">All Formats</option>
              {allFormats.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          )}

          {/* Language filter */}
          {allLanguages.length > 0 && (
            <select
              value={filterLanguage || ''}
              onChange={(e) => setFilterLanguage(e.target.value || null)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 appearance-none cursor-pointer"
            >
              <option value="">All Languages</option>
              {allLanguages.map((l) => (
                <option key={l} value={l}>{LANGUAGE_OPTIONS.find((lo) => lo.value === l)?.label || l}</option>
              ))}
            </select>
          )}

          {(filterGenre || filterFormat || filterLanguage) && (
            <button
              onClick={() => { setFilterGenre(null); setFilterFormat(null); setFilterLanguage(null); }}
              className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white/5 animate-pulse">
                <div className="aspect-video bg-white/10 rounded-t-xl" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="h-3 bg-white/10 rounded w-full" />
                  <div className="h-3 bg-white/10 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🎬</div>
            <p className="text-xl font-semibold text-white/80 mb-2">No finished projects yet</p>
            <p className="text-sm text-white/40 mb-6">Be the first to showcase your completed production!</p>
            {user && (
              <Link href="/dashboard" className="px-5 py-2.5 text-sm font-medium text-black bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors">
                Go to Dashboard
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((project) => {
              const thumb = project.wrap_url ? getThumbnail(project.wrap_url) : null;
              return (
                <Link
                  key={project.id}
                  href={`/community/showcase/${project.id}`}
                  className="group rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden hover:border-amber-500/30 hover:bg-white/[0.05] transition-all duration-300"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video relative bg-black overflow-hidden">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : project.cover_url ? (
                      <img
                        src={project.cover_url}
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : project.poster_url ? (
                      <img
                        src={project.poster_url}
                        alt={project.title}
                        className="w-full h-full object-contain bg-neutral-900 group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-neutral-900 to-neutral-800 flex items-center justify-center">
                        <svg className="w-12 h-12 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <svg className="w-6 h-6 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                    {/* Format badge */}
                    {project.format && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-black/70 text-white/80 rounded">
                        {project.format}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                      {project.title}
                    </h3>
                    {(project.showcase_description || project.logline) && (
                      <p className="text-sm text-white/40 mt-1 line-clamp-2">
                        {project.showcase_description || project.logline}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        {project.author?.avatar_url ? (
                          <img src={project.author.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/50">
                            {(project.author?.full_name || '?')[0]}
                          </div>
                        )}
                        <span className="text-xs text-white/50">{project.author?.full_name || 'Unknown'}</span>
                      </div>
                      <span className="text-[10px] text-white/30">{timeAgo(project.updated_at)}</span>
                    </div>

                    {/* Rating */}
                    {reviewStats[project.id] && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                        <span className="text-xs font-semibold text-amber-400">{reviewStats[project.id].avg.toFixed(1)}</span>
                        <span className="text-[10px] text-white/30">({reviewStats[project.id].count})</span>
                      </div>
                    )}

                    {/* Genre tags */}
                    {project.genre && project.genre.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {project.genre.slice(0, 3).map((g) => (
                          <span key={g} className="px-2 py-0.5 text-[10px] font-medium text-amber-400/70 bg-amber-500/10 rounded-full">
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-white/50">Screenplay Studio</span>
          <div className="flex items-center gap-6 text-sm text-white/30">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/community" className="hover:text-white transition-colors">Community</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <SiteVersion light />
          </div>
        </div>
      </footer>
    </div>
  );
}
