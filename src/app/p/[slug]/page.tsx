'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Company, CompanyMember, Project, Profile, CompanyBlogPost } from '@/lib/types';

// ============================================================
// Company Public Page — /<slug>
// ============================================================

export default function CompanyPublicPage({ params }: { params: { slug: string } }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [blogPosts, setBlogPosts] = useState<CompanyBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchCompany();
  }, [params.slug]);

  const fetchCompany = async () => {
    const supabase = createClient();
    const { data: co, error } = await supabase
      .from('companies')
      .select('*')
      .eq('slug', params.slug)
      .eq('public_page_enabled', true)
      .single();

    if (error || !co) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setCompany(co);

    let mems: CompanyMember[] = [];
    let projs: Project[] = [];

    if (co.show_team_on_public) {
      const { data } = await supabase.from('company_members')
        .select('*, profile:profiles!user_id(*)')
        .eq('company_id', co.id)
        .eq('is_public', true)
        .order('role');
      mems = data || [];
    }

    if (co.show_projects_on_public) {
      const { data } = await supabase.from('projects')
        .select('*')
        .eq('company_id', co.id)
        .order('updated_at', { ascending: false })
        .limit(20);
      projs = data || [];
    }

    setMembers(mems);
    setProjects(projs);

    // Fetch published blog posts
    const { data: posts } = await supabase
      .from('company_blog_posts')
      .select('*')
      .eq('company_id', co.id)
      .eq('published', true)
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(6);
    setBlogPosts(posts || []);

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#070710' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#FF5F1F]" />
      </div>
    );
  }

  if (notFound || !company) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#070710' }}>
        <h1 className="text-3xl font-black text-white mb-2" style={{ letterSpacing: '-0.03em' }}>PAGE NOT FOUND</h1>
        <p className="text-white/40 mb-6 font-mono text-sm">This company page doesn&apos;t exist or isn&apos;t public.</p>
        <Link href="/" className="ss-btn-orange text-sm">
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: '#070710' }}>
      {/* Hero */}
      <header
        className="relative"
        style={{
          backgroundColor: company.brand_color,
          backgroundImage: company.cover_url ? `url(${company.cover_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-lg object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl font-black text-white bg-white/20 backdrop-blur">
              {company.name[0]}
            </div>
          )}
          <h1 className="text-4xl font-black text-white mb-2" style={{ letterSpacing: '-0.03em' }}>{company.name}</h1>
          {company.tagline && <p className="text-xl text-white/80">{company.tagline}</p>}
          {company.description && <p className="mt-4 text-white/60 max-w-2xl mx-auto">{company.description}</p>}
          <div className="flex justify-center gap-4 mt-6">
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-white/70 hover:text-white underline underline-offset-4 transition-colors">
                Website ↗
              </a>
            )}
            {company.email && (
              <a href={`mailto:${company.email}`} className="text-sm text-white/70 hover:text-white underline underline-offset-4 transition-colors">
                Contact
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Projects */}
        {projects.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-black text-white mb-6" style={{ letterSpacing: '-0.03em' }}>PROJECTS</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div key={project.id} className="overflow-hidden hover:opacity-90 transition-opacity" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                  {project.poster_url ? (
                    <img src={project.poster_url} alt={project.title || 'Project poster'} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center" style={{ backgroundColor: company.brand_color + '15' }}>
                      <svg className="w-12 h-12 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                      </svg>
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-black text-white" style={{ letterSpacing: '-0.02em' }}>{project.title}</h3>
                    {project.logline && <p className="text-sm text-white/40 mt-1 line-clamp-2">{project.logline}</p>}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs font-mono text-white/30 capitalize">{project.format}</span>
                      {project.genre.length > 0 && (
                        <span className="text-xs font-mono text-white/30">· {project.genre.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Team */}
        {members.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-black text-white mb-6" style={{ letterSpacing: '-0.03em' }}>OUR TEAM</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {members.map((m) => {
                const profile = m.profile as Profile | undefined;
                return (
                  <div key={m.id} className="text-center">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.full_name || profile.username || 'Team member'} className="w-24 h-24 rounded-full mx-auto object-cover" />
                    ) : (
                      <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-2xl font-black text-white/40 bg-white/10">
                        {(profile?.display_name || profile?.full_name || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <h3 className="font-black text-white mt-3" style={{ letterSpacing: '-0.02em' }}>{profile?.display_name || profile?.full_name || 'Team Member'}</h3>
                    <p className="text-sm text-white/50 font-mono">{m.job_title || m.role}</p>
                    {m.department && <p className="text-xs text-white/30 font-mono">{m.department}</p>}
                    {m.bio && <p className="text-xs text-white/30 mt-1 line-clamp-2">{m.bio}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Blog */}
        {blogPosts.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>BLOG</h2>
              <Link href={`/company/${company.slug}/blog`} className="text-sm font-medium hover:underline" style={{ color: company.brand_color }}>
                View all posts →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogPosts.map((post) => (
                <Link key={post.id} href={`/company/${company.slug}/blog/${post.slug}`}
                  className="block overflow-hidden hover:opacity-80 transition-opacity group" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                  {post.cover_image_url ? (
                    <img src={post.cover_image_url} alt={post.title || 'Blog post cover'} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center" style={{ backgroundColor: company.brand_color + '10' }}>
                      <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                  )}
                  <div className="p-4">
                    {post.pinned && <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5F1F] mb-1 block">Pinned</span>}
                    <h3 className="font-black text-white line-clamp-2" style={{ letterSpacing: '-0.02em' }}>{post.title}</h3>
                    {post.excerpt && <p className="text-sm text-white/40 mt-1 line-clamp-2">{post.excerpt}</p>}
                    <div className="flex items-center gap-2 mt-3">
                      {post.tags?.length > 0 && post.tags.slice(0, 2).map((tag: string) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 font-mono uppercase text-white/40" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>{tag}</span>
                      ))}
                      {post.published_at && (
                        <span className="text-xs font-mono text-white/30 ml-auto">{new Date(post.published_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-8 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-mono text-white/30">
            {company.name} · Powered by <Link href="/" className="text-white/50 hover:text-white transition-colors">Screenplay Studio</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
