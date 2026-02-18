'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, LoadingPage } from '@/components/ui';
import type { Company, CompanyBlogPost } from '@/lib/types';

export default function CompanyBlogPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [company, setCompany] = useState<Company | null>(null);
  const [posts, setPosts] = useState<CompanyBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    loadBlog();
  }, [slug]);

  const loadBlog = async () => {
    const supabase = createClient();

    const { data: co } = await supabase
      .from('companies')
      .select('*')
      .eq('slug', slug)
      .single();

    if (!co) { setLoading(false); return; }
    setCompany(co);

    const { data: blogPosts } = await supabase
      .from('company_blog_posts')
      .select('*, author:profiles!author_id(*)')
      .eq('company_id', co.id)
      .eq('status', 'published')
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false });

    setPosts(blogPosts || []);
    setLoading(false);
  };

  if (loading) return <LoadingPage />;
  if (!company) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <p className="text-surface-400">Company not found.</p>
      </div>
    );
  }

  const allTags = posts.flatMap((p) => p.tags).filter((tag, i, arr) => arr.indexOf(tag) === i);
  const filteredPosts = selectedTag ? posts.filter((p) => p.tags.includes(selectedTag)) : posts;
  const pinnedPosts = filteredPosts.filter((p) => p.pinned);
  const regularPosts = filteredPosts.filter((p) => !p.pinned);

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-950">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-4">
            <Link href={`/company/${slug}`} className="text-sm text-surface-400 hover:text-white transition-colors flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              {company.name}
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: company.brand_color }}>
                {company.name[0]}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{company.name} Blog</h1>
              {company.tagline && <p className="text-sm text-surface-400 mt-0.5">{company.tagline}</p>}
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  !selectedTag ? 'bg-brand-600 text-white' : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedTag === tag ? 'bg-brand-600 text-white' : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {posts.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-surface-400">No blog posts published yet.</p>
          </Card>
        )}

        {/* Pinned Posts */}
        {pinnedPosts.length > 0 && (
          <div className="mb-8">
            {pinnedPosts.map((post) => (
              <Link key={post.id} href={`/company/${slug}/blog/${post.slug}`}>
                <Card hover className="overflow-hidden group mb-4">
                  {post.cover_image_url && (
                    <img src={post.cover_image_url} alt="" className="w-full h-48 object-cover" />
                  )}
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-bold">PINNED</span>
                      {post.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-400">{tag}</span>
                      ))}
                    </div>
                    <h2 className="text-xl font-bold text-white group-hover:text-brand-400 transition-colors">{post.title}</h2>
                    {post.excerpt && <p className="text-sm text-surface-400 mt-2 line-clamp-2">{post.excerpt}</p>}
                    <div className="flex items-center gap-3 mt-4 text-xs text-surface-500">
                      <span>{(post as any).author?.display_name || 'Unknown'}</span>
                      <span>·</span>
                      <span>{post.published_at ? new Date(post.published_at).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Regular Posts */}
        <div className="space-y-4">
          {regularPosts.map((post) => (
            <Link key={post.id} href={`/company/${slug}/blog/${post.slug}`}>
              <Card hover className="p-5 group flex gap-5 items-start">
                {post.cover_image_url && (
                  <img src={post.cover_image_url} alt="" className="w-24 h-16 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white group-hover:text-brand-400 transition-colors">{post.title}</h3>
                  {post.excerpt && <p className="text-sm text-surface-400 mt-1 line-clamp-1">{post.excerpt}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-surface-500">
                    <span>{(post as any).author?.display_name || 'Unknown'}</span>
                    <span>·</span>
                    <span>{post.published_at ? new Date(post.published_at).toLocaleDateString() : ''}</span>
                    {post.tags.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{post.tags.join(', ')}</span>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
