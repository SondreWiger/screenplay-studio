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
    <div className="min-h-screen text-white" style={{ background: '#070710' }}>


      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="text-[9px] font-mono uppercase tracking-widest mb-3" style={{ color: '#FF5F1F' }}>
            <span className="inline-block w-3 h-px bg-[#FF5F1F] mr-2 align-middle" />Community Showcase
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>
            FINISHED PROJECTS
          </h1>
          <p className="text-lg text-white/40 mt-3 max-w-xl font-mono text-sm">
            Watch completed productions from the Screenplay Studio community. From short films to features — see what others have created.
          </p>
          <div className="flex items-center gap-3 mt-6 text-xs font-mono text-white/50">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5" style={{ background: '#FF5F1F' }} />
              {projects.length} projects
            </span>
          </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort */}
          <div className="flex items-center gap-1 p-1" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            {(['newest', 'title'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-widest capitalize transition-colors ${
                  sortBy === s ? 'text-white' : 'text-white/40 hover:text-white'
                }`}
                style={sortBy === s ? { background: '#FF5F1F' } : {}}
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
              className="text-xs font-mono text-[#FF5F1F] hover:opacity-80 transition-opacity"
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
          <p className="text-xl font-black text-white mb-2" style={{ letterSpacing: '-0.02em' }}>NO FINISHED PROJECTS YET</p>
            <p className="text-sm font-mono text-white/40 mb-6">Be the first to showcase your completed production!</p>
            {user && (
              <Link href="/dashboard" className="ss-btn-orange text-sm">
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
                  className="group overflow-hidden hover:opacity-90 transition-all duration-300"
                  style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
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
                      <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#FF5F1F' }}>
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
                    <h3 className="font-black text-white group-hover:text-[#FF5F1F] transition-colors line-clamp-1" style={{ letterSpacing: '-0.02em' }}>
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
                          <img src={project.author.avatar_url} alt={project.author.full_name || 'Author avatar'} className="w-5 h-5 rounded-full" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/50">
                            {(project.author?.full_name || '?')[0]}
                          </div>
                        )}
                        <span className="text-xs text-white/50">{project.author?.full_name || 'Unknown'}</span>
                      </div>
                      <span className="text-[10px] text-white/50">{timeAgo(project.updated_at)}</span>
                    </div>

                    {/* Rating */}
                    {reviewStats[project.id] && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <svg className="w-3.5 h-3.5 text-[#FF5F1F]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                        <span className="text-xs font-semibold text-[#FF5F1F]">{reviewStats[project.id].avg.toFixed(1)}</span>
                        <span className="text-[10px] text-white/50">({reviewStats[project.id].count})</span>
                      </div>
                    )}

                    {/* Genre tags */}
                    {project.genre && project.genre.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {project.genre.slice(0, 3).map((g) => (
                          <span key={g} className="px-2 py-0.5 text-[10px] font-mono uppercase text-white/50" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
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
      <footer className="py-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Screenplay Studio</span>
          <div className="flex items-center gap-6 text-[11px] font-mono uppercase tracking-widest text-white/50">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/community" className="hover:text-white transition-colors">Community</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <SiteVersion />
          </div>
        </div>
      </footer>
    </div>
  );
}
