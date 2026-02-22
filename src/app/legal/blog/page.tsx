'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface LegalPost {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  severity: string;
  published: boolean;
  published_at: string;
  author_id: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const CATEGORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'tos_update', label: 'TOS Updates' },
  { key: 'privacy_update', label: 'Privacy Updates' },
  { key: 'security_advisory', label: 'Security Advisories' },
  { key: 'policy_change', label: 'Policy Changes' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'transparency_report', label: 'Transparency Reports' },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  tos_update: 'TOS Update',
  privacy_update: 'Privacy Update',
  security_advisory: 'Security Advisory',
  policy_change: 'Policy Change',
  compliance: 'Compliance',
  transparency_report: 'Transparency Report',
  update: 'Update',
  announcement: 'Announcement',
};

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-500/20">
          🚨 Critical
        </span>
      );
    case 'important':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-500/20">
          ⚠️ Important
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-800/50 px-2.5 py-0.5 text-xs font-medium text-surface-300 ring-1 ring-inset ring-surface-700">
          ℹ️ Info
        </span>
      );
  }
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-900 px-2.5 py-0.5 text-xs font-medium text-surface-300 ring-1 ring-inset ring-surface-800">
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function LegalBlogPage() {
  const [posts, setPosts] = useState<LegalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    async function fetchPosts() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('legal_posts')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false });

      if (!error && data) {
        setPosts(data);
      }
      setLoading(false);
    }
    fetchPosts();
  }, []);

  const filteredPosts =
    activeFilter === 'all'
      ? posts
      : posts.filter((p) => p.category === activeFilter);

  return (
    <div>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Legal Updates</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Legal Blog
          </h1>
          <p className="mt-2 text-sm text-surface-500">
            Policy updates, transparency reports, and legal notices
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-8 flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === filter.key
                  ? 'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/30'
                  : 'bg-surface-900 text-surface-400 ring-1 ring-inset ring-surface-800 hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Posts */}
        {loading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-surface-800 bg-surface-900 p-6"
              >
                <div className="mb-3 flex gap-2">
                  <div className="h-5 w-20 rounded-full bg-surface-800" />
                  <div className="h-5 w-24 rounded-full bg-surface-800" />
                </div>
                <div className="mb-2 h-6 w-3/4 rounded bg-surface-800" />
                <div className="mb-4 h-4 w-full rounded bg-surface-800" />
                <div className="h-4 w-1/4 rounded bg-surface-800" />
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-xl border border-surface-800 bg-surface-900 px-6 py-16 text-center">
            <p className="text-lg text-surface-400">
              {posts.length === 0
                ? 'No legal blog posts have been published yet.'
                : 'No posts match the selected filter.'}
            </p>
            {activeFilter !== 'all' && (
              <button
                onClick={() => setActiveFilter('all')}
                className="mt-4 text-sm text-red-400 transition-colors hover:text-red-300"
              >
                View all posts →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredPosts.map((post) => (
              <article
                key={post.id}
                className="group rounded-xl border border-surface-800 bg-surface-900 p-6 transition-colors hover:border-surface-800/80"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={post.severity} />
                  <CategoryBadge category={post.category} />
                </div>

                <h2 className="mb-2 text-xl font-semibold text-white">
                  <Link
                    href={`/legal/blog/${post.slug}`}
                    className="transition-colors hover:text-red-400"
                  >
                    {post.title}
                  </Link>
                </h2>

                {post.summary && (
                  <p className="mb-4 leading-relaxed text-surface-400">
                    {post.summary}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <time className="text-sm text-surface-500">
                    {formatDate(post.published_at)}
                  </time>

                  {post.tags && post.tags.length > 0 && (
                    <>
                      <span className="text-surface-800">·</span>
                      <div className="flex flex-wrap gap-1.5">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-surface-950 px-2 py-0.5 text-xs text-surface-500"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Newsletter Signup */}
        <div className="mt-16 rounded-xl border border-surface-800 bg-surface-900 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">
            Stay informed about policy changes
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-surface-400">
            Get notified when we publish important legal updates, security
            advisories, or transparency reports.
          </p>
          <div className="mx-auto mt-6 flex max-w-sm gap-3">
            <input
              type="email"
              placeholder="you@example.com"
              className="flex-1 rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm text-white placeholder-surface-500 outline-none transition-colors focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
            />
            <button className="whitespace-nowrap rounded-lg bg-red-500/10 px-5 py-2 text-sm font-medium text-red-400 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/20">
              Subscribe
            </button>
          </div>
          <p className="mt-3 text-xs text-surface-500">
            We&apos;ll only email you about legal and policy updates. No spam.
          </p>
        </div>
      </div>
    </div>
  );
}
