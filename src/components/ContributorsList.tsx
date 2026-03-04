'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const ORANGE = '#FF5F1F';

const AREA_COLORS: Record<string, string> = {
  Code:        '#60a5fa',
  Design:      '#e879f9',
  Docs:        'rgba(255,255,255,0.35)',
  Testing:     '#34d399',
  Community:   '#fb923c',
  Translation: '#fbbf24',
};

interface Contributor {
  id: string;
  github_handle: string | null;
  bio: string | null;
  cached_name: string | null;
  cached_avatar_url: string | null;
  contribution_areas: string[];
  is_featured: boolean;
}

export default function ContributorsList() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('contributors')
      .select('id, github_handle, bio, cached_name, cached_avatar_url, contribution_areas, is_featured')
      .order('is_featured', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('ContributorsList error:', error);
        setContributors((data || []) as Contributor[]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8">
        <div className="w-1 h-4 animate-pulse" style={{ background: ORANGE }} />
        <span className="text-xs text-white/20 font-mono uppercase tracking-widest">Loading contributors…</span>
      </div>
    );
  }

  if (contributors.length === 0) {
    return (
      <p className="text-xs text-white/20 py-4">
        No contributors listed yet. Be the first —{' '}
        <a href="/contribute" className="hover:text-white/50 transition-colors underline">contribute to the project</a>.
      </p>
    );
  }

  // Featured first, then rest
  const featured = contributors.filter(c => c.is_featured);
  const rest = contributors.filter(c => !c.is_featured);

  return (
    <div>
      {/* Featured strip */}
      {featured.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: ORANGE }}>Featured</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,95,31,0.15)' }} />
          </div>
          <div className="flex flex-wrap gap-3">
            {featured.map(c => <ContributorCard key={c.id} c={c} large />)}
          </div>
        </div>
      )}

      {/* All contributors */}
      {rest.length > 0 && (
        <div>
          {featured.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/20">All Contributors</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {rest.map(c => <ContributorCard key={c.id} c={c} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ContributorCard({ c, large = false }: { c: Contributor; large?: boolean }) {
  const name = c.cached_name || (c.github_handle ? `@${c.github_handle}` : 'Anonymous');
  const initials = (name[0] || '?').toUpperCase();
  const href = c.github_handle ? `https://github.com/${c.github_handle}` : null;

  const inner = (
    <div
      className={`group flex items-center gap-2.5 transition-all duration-150 rounded-sm ${large ? 'px-3 py-2.5' : 'px-2.5 py-2'}`}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        minWidth: large ? 180 : 0,
      }}
    >
      {/* Avatar */}
      <div
        className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center font-black text-white ${large ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs'}`}
        style={{ background: c.is_featured ? ORANGE : 'rgba(255,255,255,0.08)' }}
      >
        {c.cached_avatar_url
          ? <img src={c.cached_avatar_url} className="w-full h-full object-cover" alt="" />
          : initials}
      </div>

      {/* Info */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`font-semibold text-white/80 group-hover:text-white transition-colors truncate ${large ? 'text-sm' : 'text-xs'}`}>
            {name}
          </p>
          {c.is_featured && (
            <span className="shrink-0 text-[8px]" title="Featured contributor">⭐</span>
          )}
        </div>
        {large && c.bio && (
          <p className="text-[10px] text-white/30 truncate max-w-[160px]">{c.bio}</p>
        )}
        {c.contribution_areas?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {c.contribution_areas.slice(0, large ? 4 : 2).map(a => (
              <span
                key={a}
                className="text-[8px] font-bold uppercase tracking-wide"
                style={{ color: AREA_COLORS[a] || 'rgba(255,255,255,0.25)' }}
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:-translate-y-px transition-transform duration-150">
        {inner}
      </a>
    );
  }
  return <div>{inner}</div>;
}
