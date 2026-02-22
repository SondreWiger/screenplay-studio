'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

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

const RELATED_PAGES: Record<string, { href: string; label: string }[]> = {
  tos_update: [
    { href: '/legal/terms', label: 'Terms of Service' },
    { href: '/legal/acceptable-use', label: 'Acceptable Use Policy' },
  ],
  privacy_update: [
    { href: '/legal/privacy', label: 'Privacy Policy' },
    { href: '/legal/cookies', label: 'Cookie Policy' },
  ],
  security_advisory: [
    { href: '/legal/privacy', label: 'Privacy Policy' },
    { href: '/legal/terms', label: 'Terms of Service' },
  ],
  policy_change: [
    { href: '/legal/terms', label: 'Terms of Service' },
    { href: '/legal/privacy', label: 'Privacy Policy' },
    { href: '/legal/acceptable-use', label: 'Acceptable Use Policy' },
  ],
  compliance: [
    { href: '/legal/privacy', label: 'Privacy Policy' },
    { href: '/legal/terms', label: 'Terms of Service' },
  ],
  transparency_report: [
    { href: '/legal/privacy', label: 'Privacy Policy' },
    { href: '/legal/community-guidelines', label: 'Community Guidelines' },
  ],
};

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-400 ring-1 ring-inset ring-red-500/20">
          🚨 Critical
        </span>
      );
    case 'important':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-400 ring-1 ring-inset ring-red-500/20">
          ⚠️ Important
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-800/50 px-3 py-1 text-sm font-medium text-surface-300 ring-1 ring-inset ring-surface-700">
          ℹ️ Info
        </span>
      );
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function renderContent(content: string) {
  const paragraphs = content.split(/\n\n+/);

  return paragraphs.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Headings
    if (trimmed.startsWith('### ')) {
      return (
        <h3
          key={i}
          className="mb-3 mt-8 text-lg font-semibold text-white"
        >
          {trimmed.slice(4)}
        </h3>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h2
          key={i}
          className="mb-4 mt-10 text-xl font-bold text-white"
        >
          {trimmed.slice(3)}
        </h2>
      );
    }
    if (trimmed.startsWith('# ')) {
      return (
        <h1
          key={i}
          className="mb-4 mt-10 text-2xl font-bold text-white"
        >
          {trimmed.slice(2)}
        </h1>
      );
    }

    // Bullet list block
    if (trimmed.split('\n').every((line) => /^[-*]\s/.test(line.trim()))) {
      return (
        <ul key={i} className="mb-4 list-disc space-y-1 pl-6 text-surface-300">
          {trimmed.split('\n').map((line, j) => (
            <li key={j}>{formatInline(line.replace(/^[-*]\s+/, ''))}</li>
          ))}
        </ul>
      );
    }

    // Regular paragraph
    return (
      <p key={i} className="mb-4 leading-relaxed text-surface-300">
        {formatInline(trimmed)}
      </p>
    );
  });
}

function formatInline(text: string): React.ReactNode {
  // Bold **text** and links [text](url)
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Check for bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Check for links
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    // Find the earliest match
    const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : Infinity;
    const linkIndex = linkMatch ? remaining.indexOf(linkMatch[0]) : Infinity;

    if (boldIndex === Infinity && linkIndex === Infinity) {
      parts.push(remaining);
      break;
    }

    if (boldIndex <= linkIndex && boldMatch) {
      if (boldIndex > 0) {
        parts.push(remaining.slice(0, boldIndex));
      }
      parts.push(
        <strong key={key++} className="font-semibold text-white">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldIndex + boldMatch[0].length);
    } else if (linkMatch) {
      if (linkIndex > 0) {
        parts.push(remaining.slice(0, linkIndex));
      }
      parts.push(
        <a
          key={key++}
          href={linkMatch[2]}
          className="text-red-400 underline decoration-red-400/30 transition-colors hover:text-red-300"
          target={linkMatch[2].startsWith('http') ? '_blank' : undefined}
          rel={linkMatch[2].startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkIndex + linkMatch[0].length);
    }
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

export default function LegalBlogPostPage() {
  const params = useParams<{ slug: string }>();
  const [post, setPost] = useState<LegalPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchPost() {
      if (!params.slug) return;

      const supabase = createClient();
      const { data, error } = await supabase
        .from('legal_posts')
        .select('*')
        .eq('slug', params.slug)
        .eq('published', true)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setPost(data);
      }
      setLoading(false);
    }
    fetchPost();
  }, [params.slug]);

  if (loading) {
    return (
      <div>
        <div className="max-w-4xl">
          <div className="animate-pulse">
            <div className="mb-6 h-4 w-32 rounded bg-surface-800" />
            <div className="mb-4 flex gap-2">
              <div className="h-6 w-20 rounded-full bg-surface-800" />
              <div className="h-6 w-28 rounded-full bg-surface-800" />
            </div>
            <div className="mb-3 h-10 w-3/4 rounded bg-surface-800" />
            <div className="mb-8 h-4 w-48 rounded bg-surface-800" />
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-surface-800" />
              <div className="h-4 w-full rounded bg-surface-800" />
              <div className="h-4 w-5/6 rounded bg-surface-800" />
              <div className="h-4 w-full rounded bg-surface-800" />
              <div className="h-4 w-2/3 rounded bg-surface-800" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <div className="max-w-4xl">
          <div className="rounded-xl border border-surface-800 bg-surface-900 px-6 py-20 text-center">
            <p className="text-5xl">📄</p>
            <h1 className="mt-4 text-2xl font-bold text-white">
              Post not found
            </h1>
            <p className="mt-2 text-surface-400">
              This legal blog post doesn&apos;t exist or hasn&apos;t been
              published yet.
            </p>
            <Link
              href="/legal/blog"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-red-400 transition-colors hover:text-red-300"
            >
              ← Back to Legal Blog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!post) return null;

  const relatedPages = RELATED_PAGES[post.category] || [];

  return (
    <div>
      <div className="max-w-4xl">
        {/* Back link */}
        <Link
          href="/legal/blog"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-surface-400 transition-colors hover:text-red-400"
        >
          &larr; Back to Legal Blog
        </Link>

        <div className="mt-6 flex flex-col gap-10 lg:flex-row">
          {/* Main content */}
          <article className="min-w-0 flex-1">
            {/* Meta badges */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <SeverityBadge severity={post.severity} />
              <span className="inline-flex items-center rounded-full bg-surface-900 px-2.5 py-0.5 text-xs font-medium text-surface-300 ring-1 ring-inset ring-surface-800">
                {CATEGORY_LABELS[post.category] || post.category}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {post.title}
            </h1>

            {/* Date & tags */}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-b border-surface-800 pb-6">
              <time className="text-sm text-surface-500">
                Published {formatDate(post.published_at)}
              </time>
              {post.tags && post.tags.length > 0 && (
                <>
                  <span className="text-surface-800">·</span>
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-surface-900 px-2 py-0.5 text-xs text-surface-500 ring-1 ring-inset ring-surface-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Summary */}
            {post.summary && (
              <p className="mt-6 text-lg leading-relaxed text-surface-300">
                {post.summary}
              </p>
            )}

            {/* Content */}
            <div className="mt-8">{renderContent(post.content || '')}</div>
          </article>

          {/* Sidebar */}
          {relatedPages.length > 0 && (
            <aside className="w-full shrink-0 lg:w-64">
              <div className="sticky top-8 rounded-xl border border-surface-800 bg-surface-900 p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-500">
                  Related Pages
                </h3>
                <ul className="space-y-2">
                  {relatedPages.map((page) => (
                    <li key={page.href}>
                      <Link
                        href={page.href}
                        className="block text-sm text-surface-300 transition-colors hover:text-red-400"
                      >
                        {page.label} →
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 border-t border-surface-800 pt-5">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-500">
                    Legal Hub
                  </h3>
                  <ul className="space-y-2">
                    <li>
                      <Link
                        href="/legal"
                        className="block text-sm text-surface-300 transition-colors hover:text-red-400"
                      >
                        All Legal Pages →
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/legal/blog"
                        className="block text-sm text-surface-300 transition-colors hover:text-red-400"
                      >
                        Legal Blog →
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
