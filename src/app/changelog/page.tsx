'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';

// ============================================================
// Public Changelog — staggered timeline layout
// ============================================================

type ChangelogEntry = {
  id: string;
  title: string;
  description: string | null;
  entry_type: string;
  area: string;
  is_public: boolean;
};

type ChangelogRelease = {
  id: string;
  version: string;
  title: string;
  summary: string | null;
  release_type: string;
  released_at: string;
  feature_count: number;
  improvement_count: number;
  fix_count: number;
  total_changes: number;
  entries?: ChangelogEntry[];
};

// Stagger pattern — each card cascades to a different left indent (px)
const STAGGER_ML = [0, 64, 32, 96, 16, 80];

const TYPE_STYLES: Record<string, { label: string; color: string; dot: string }> = {
  feature:     { label: 'Feature',     color: 'rgba(255,95,31,0.15)',   dot: '#FF5F1F'  },
  improvement: { label: 'Improvement', color: 'rgba(99,102,241,0.15)',  dot: '#818CF8'  },
  fix:         { label: 'Fix',         color: 'rgba(34,197,94,0.12)',   dot: '#4ADE80'  },
  performance: { label: 'Performance', color: 'rgba(234,179,8,0.12)',   dot: '#FACC15'  },
  security:    { label: 'Security',    color: 'rgba(239,68,68,0.12)',   dot: '#F87171'  },
  breaking:    { label: 'Breaking',    color: 'rgba(239,68,68,0.2)',    dot: '#EF4444'  },
  internal:    { label: 'Internal',    color: 'rgba(255,255,255,0.05)', dot: '#6B7280'  },
  deprecation: { label: 'Deprecated',  color: 'rgba(255,255,255,0.05)', dot: '#9CA3AF'  },
};

const RELEASE_TYPE_BADGE: Record<string, { label: string; border: string; text: string }> = {
  major:  { label: 'MAJOR',  border: '#FF5F1F', text: '#FF5F1F'    },
  minor:  { label: 'MINOR',  border: 'rgba(255,255,255,0.2)', text: 'rgba(255,255,255,0.4)' },
  patch:  { label: 'PATCH',  border: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.3)' },
  hotfix: { label: 'HOTFIX', border: '#F87171', text: '#F87171'    },
};

function formatReleaseDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function ChangelogPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [releases, setReleases] = useState<ChangelogRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const handleSignOut = async () => {
    const supabase = createClient();
    try { sessionStorage.removeItem('ss_session_active'); } catch {}
    await supabase.auth.signOut();
    router.refresh();
  };

  useEffect(() => {
    fetchChangelog();
  }, []);

  const fetchChangelog = async () => {
    try {
      const supabase = createClient();

      // Fetch published releases
      const { data: releasesData } = await supabase
        .from('changelog_releases')
        .select('*')
        .eq('status', 'published')
        .order('released_at', { ascending: false });

      if (!releasesData?.length) { setLoading(false); return; }

      // Fetch all public entries for those releases
      const releaseIds = releasesData.map((r) => r.id);
      const { data: entriesData } = await supabase
        .from('changelog_entries')
        .select('*')
        .in('release_id', releaseIds)
        .eq('is_public', true)
        .order('sort_order', { ascending: true });

      // Group entries by release_id
      const entriesByRelease: Record<string, ChangelogEntry[]> = {};
      for (const entry of entriesData || []) {
        if (!entriesByRelease[entry.release_id]) entriesByRelease[entry.release_id] = [];
        entriesByRelease[entry.release_id].push(entry);
      }

      setReleases(releasesData.map((r) => ({
        ...r,
        entries: entriesByRelease[r.id] || [],
      })));
    } catch (err) {
      console.error('Error loading changelog:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="min-h-screen" style={{ background: '#070710', color: '#fff' }}>
      {/* Dot-grid texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Nav */}
      <nav
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(7,7,16,0.9)' }}
      >
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 flex items-center justify-center shrink-0" style={{ background: '#FF5F1F' }}>
              <span className="font-black text-white text-[10px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/40 uppercase tracking-widest group-hover:text-white/70 transition-colors">
              Screenplay Studio
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <span className="ss-label" style={{ color: '#FF5F1F' }}>Changelog</span>
            <Link href="/blog" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">
              Blog
            </Link>
            <Link href="/community" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">
              Community
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">
                  Dashboard
                </Link>
                <button onClick={handleSignOut} className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">
                  Sign Out
                </button>
                <div className="flex items-center gap-2">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name || 'User avatar'} className="w-6 h-6" />
                  ) : (
                    <div
                      className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-white"
                      style={{ background: '#FF5F1F' }}
                    >
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login?redirect=/changelog" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">
                  Sign In
                </Link>
                <Link href="/auth/register?redirect=/changelog" className="ss-btn-orange" style={{ padding: '0.35rem 0.9rem', fontSize: '10px' }}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 pt-16 pb-12 relative z-10">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-3 h-px shrink-0" style={{ background: '#FF5F1F' }} />
          <span className="ss-label">Platform History</span>
        </div>
        <h1
          className="font-black text-white"
          style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)', letterSpacing: '-0.04em', lineHeight: 0.88 }}
        >
          CHANGELOG
        </h1>
        <p className="mt-6 text-base text-white/30 max-w-2xl leading-relaxed">
          Every feature shipped, every bug squashed, every improvement made — in order, with receipts.
        </p>
      </header>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-32">
          <div
            className="h-6 w-6 animate-spin"
            style={{ border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FF5F1F', borderRadius: 0 }}
          />
        </div>
      )}

      {/* Timeline */}
      {!loading && releases.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 pb-32 relative z-10">
          {/*
            Layout: a left gutter (pl-8) holds the vertical spine.
            Each row is a flex pair: [dot] + [card].
            The row gets a margin-left from STAGGER_ML so cards cascade.
            The spine is an absolute line in the gutter — dots always sit on it.
          */}
          <div className="relative pl-8">
            {/* Vertical spine */}
            <div
              className="absolute left-3 top-0 bottom-0 w-px pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, rgba(255,95,31,0.5) 0%, rgba(255,255,255,0.06) 60%, transparent 100%)',
              }}
            />

            <div className="space-y-5">
              {releases.map((release, idx) => {
                const ml = STAGGER_ML[idx % STAGGER_ML.length];
                const rtBadge = RELEASE_TYPE_BADGE[release.release_type] ?? RELEASE_TYPE_BADGE.minor;
                const isOpen = expanded.has(release.id);
                const isLatest = idx === 0;

                return (
                  <div
                    key={release.id}
                    className="flex items-start gap-4"
                    style={{ marginLeft: ml }}
                  >
                    {/* Dot — sits against the spine */}
                    <div className="shrink-0 flex flex-col items-center" style={{ marginLeft: -ml - 20, width: 20 }}>
                      <div
                        style={{
                          width: isLatest ? 12 : 8,
                          height: isLatest ? 12 : 8,
                          background: isLatest ? '#FF5F1F' : 'rgba(255,255,255,0.18)',
                          boxShadow: isLatest ? '0 0 0 3px rgba(255,95,31,0.2)' : 'none',
                          marginTop: 22,
                          flexShrink: 0,
                        }}
                      />
                    </div>

                    {/* Card */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer transition-all duration-150"
                      style={{
                        border: `1px solid ${isLatest ? 'rgba(255,95,31,0.22)' : 'rgba(255,255,255,0.07)'}`,
                        background: isLatest ? 'rgba(255,95,31,0.025)' : 'rgba(255,255,255,0.018)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = isLatest
                          ? 'rgba(255,95,31,0.42)'
                          : 'rgba(255,255,255,0.13)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isLatest
                          ? 'rgba(255,95,31,0.22)'
                          : 'rgba(255,255,255,0.07)';
                      }}
                      onClick={() => toggleExpand(release.id)}
                    >
                      {/* Header */}
                      <div className="px-5 pt-4 pb-4 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          {/* Version + badges */}
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span
                              className="font-mono font-black text-white"
                              style={{ fontSize: '0.95rem', letterSpacing: '-0.015em' }}
                            >
                              v{release.version}
                            </span>
                            {isLatest && (
                              <span
                                className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5"
                                style={{
                                  background: 'rgba(255,95,31,0.15)',
                                  color: '#FF5F1F',
                                  border: '1px solid rgba(255,95,31,0.3)',
                                }}
                              >
                                Latest
                              </span>
                            )}
                            <span
                              className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5"
                              style={{ border: `1px solid ${rtBadge.border}`, color: rtBadge.text }}
                            >
                              {rtBadge.label}
                            </span>
                          </div>

                          {/* Title */}
                          <h2
                            className="font-black text-white leading-tight"
                            style={{ fontSize: 'clamp(0.95rem, 2vw, 1.2rem)', letterSpacing: '-0.02em' }}
                          >
                            {release.title}
                          </h2>

                          {/* Date */}
                          <time className="block mt-1 text-[10px] font-mono text-white/20 uppercase tracking-wider">
                            {formatReleaseDate(release.released_at)}
                          </time>

                          {/* Summary */}
                          {release.summary && (
                            <p className="mt-2 text-[13px] text-white/30 leading-relaxed">
                              {release.summary}
                            </p>
                          )}

                          {/* Stats */}
                          {(release.feature_count > 0 || release.improvement_count > 0 || release.fix_count > 0) && (
                            <div className="flex flex-wrap items-center gap-4 mt-3">
                              {release.feature_count > 0 && (
                                <span className="flex items-center gap-1.5 text-[10px] font-mono text-white/25">
                                  <span className="w-1.5 h-1.5 shrink-0" style={{ background: '#FF5F1F' }} />
                                  {release.feature_count} feature{release.feature_count !== 1 ? 's' : ''}
                                </span>
                              )}
                              {release.improvement_count > 0 && (
                                <span className="flex items-center gap-1.5 text-[10px] font-mono text-white/25">
                                  <span className="w-1.5 h-1.5 shrink-0" style={{ background: '#818CF8' }} />
                                  {release.improvement_count} improvement{release.improvement_count !== 1 ? 's' : ''}
                                </span>
                              )}
                              {release.fix_count > 0 && (
                                <span className="flex items-center gap-1.5 text-[10px] font-mono text-white/25">
                                  <span className="w-1.5 h-1.5 shrink-0" style={{ background: '#4ADE80' }} />
                                  {release.fix_count} fix{release.fix_count !== 1 ? 'es' : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Expand toggle */}
                        {(release.entries?.length ?? 0) > 0 && (
                          <span className="shrink-0 mt-1 text-[10px] font-mono uppercase tracking-widest text-white/20 hover:text-white/50 transition-colors select-none">
                            {isOpen ? '↑' : '↓'}
                          </span>
                        )}
                      </div>

                      {/* Expanded entry list */}
                      {isOpen && (release.entries?.length ?? 0) > 0 && (
                        <div
                          className="px-5 pb-4"
                          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <div className="pt-3 space-y-1.5">
                            {release.entries!.map((entry) => {
                              const ts = TYPE_STYLES[entry.entry_type] ?? TYPE_STYLES.feature;
                              return (
                                <div
                                  key={entry.id}
                                  className="flex items-start gap-3 px-3 py-2.5"
                                  style={{ background: ts.color }}
                                >
                                  <div
                                    className="mt-[5px] shrink-0"
                                    style={{ width: 5, height: 5, background: ts.dot }}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                      <span
                                        className="text-[9px] font-mono uppercase tracking-widest"
                                        style={{ color: ts.dot, opacity: 0.85 }}
                                      >
                                        {ts.label}
                                      </span>
                                      <span className="text-[9px] font-mono uppercase tracking-widest text-white/12">
                                        {entry.area.replace(/_/g, '\u00a0')}
                                      </span>
                                    </div>
                                    <p className="text-[12px] font-semibold text-white/75 leading-snug">
                                      {entry.title}
                                    </p>
                                    {entry.description && (
                                      <p className="mt-0.5 text-[11px] text-white/25 leading-relaxed">
                                        {entry.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && releases.length === 0 && (
        <div className="max-w-6xl mx-auto px-6 py-24 text-center relative z-10">
          <p className="text-sm text-white/20">No releases published yet.</p>
        </div>
      )}

      {/* Footer */}
      <footer className="py-10 px-6 relative z-10" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 flex items-center justify-center" style={{ background: '#FF5F1F' }}>
              <span className="font-black text-white text-[9px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/30 uppercase tracking-widest">Screenplay Studio</span>
          </div>
          <div className="flex items-center gap-6">
            {[
              { href: '/', label: 'Home' },
              { href: '/blog', label: 'Blog' },
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
            <a
              href="https://development.northem.no/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono uppercase tracking-[0.15em] transition-colors text-[#FF5F1F]/40 hover:text-[#FF5F1F]/80"
            >
              Northem ♥
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
