'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { Button, Input, Card, Badge, toast } from '@/components/ui';
import { Icon } from '@/components/ui/icons';
import { applyTheme, type AppTheme } from '@/lib/theme';
import { useThemeStore, useAuthStore } from '@/lib/stores';
import { THEME_CATEGORIES } from '@/lib/theme';
import { timeAgo } from '@/lib/utils';

interface ThemeDetail {
  id: string;
  sha: string;
  name: string;
  description: string | null;
  category: string;
  colors: any;
  author_id: string | null;
  author_name: string | null;
  is_staff_pick: boolean;
  use_count: number;
  comment_count: number;
  created_at: string;
}

interface Comment {
  id: string;
  user_name: string | null;
  content: string;
  created_at: string;
}

function ColorSwatch({ colors }: { colors: Record<string, string> }) {
  return (
    <div className="space-y-3">
      {Object.entries(colors).map(([key, val]) => (
        <div key={key} className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg border border-surface-700 flex-shrink-0"
            style={{ background: val }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-surface-300">{key}</div>
            <div className="text-[11px] text-surface-500 font-mono">{val}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniScriptPreview({ colors }: { colors: any }) {
  return (
    <div className="rounded-xl border border-surface-700 overflow-hidden shadow-xl">
      <div className="flex h-5">
        {[colors.bgBase, colors.bgSurface, colors.brand, colors.scriptBg, colors.textPrimary].map((col: string, i: number) => (
          <div key={i} className="flex-1" style={{ background: col }} />
        ))}
      </div>
      <div className="p-5 mx-3 my-3 rounded-lg" style={{ background: '#fff' }}>
        <div className="font-mono text-[10px] leading-relaxed" style={{ color: '#111' }}>
          <p className="text-center font-bold text-[12px] mb-3" style={{ color: '#000' }}>UNTITLED</p>
          <p className="uppercase font-bold mt-3 mb-1" style={{ color: '#000' }}>INT. OFFICE - DAY</p>
          <p className="mb-2" style={{ color: '#222' }}>A workspace. Monitors glow.</p>
          <p className="uppercase text-right font-bold mt-2" style={{ color: '#000' }}>ALEX</p>
          <p className="text-center" style={{ color: '#222' }}>Done.</p>
        </div>
      </div>
      <div className="h-0.5" style={{ background: colors.brand }} />
    </div>
  );
}

export default function ThemeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const themeId = params.id as string;
  const { setTheme, setEditorOpen } = useThemeStore();
  const user = useAuthStore((s) => s.user);

  const [theme, setTheme_] = useState<ThemeDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    fetchTheme();
    fetchComments();
  }, [themeId]);

  const fetchTheme = async () => {
    try {
      const res = await fetch(`/api/themes/${themeId}`);
      if (res.ok) {
        const data = await res.json();
        setTheme_(data);
      }
    } catch (err) {
      console.error('Failed to fetch theme:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/themes/${themeId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch { /* ok */ }
  };

  const handleUse = async () => {
    if (!theme) return;
    const appTheme: AppTheme = { name: theme.name, colors: theme.colors };
    setTheme(appTheme);
    setApplied(true);
    toast.success('Theme applied!');

    // Increment use count
    try {
      await fetch(`/api/themes/${themeId}/use`, { method: 'POST' });
    } catch { /* ok */ }
  };

  const handleOpenEditor = () => {
    if (!theme) return;
    setTheme({ name: theme.name, colors: theme.colors });
    setEditorOpen(true);
  };

  const handleComment = async () => {
    if (!commentText.trim() || !user) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/themes/${themeId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim(), user_name: user.display_name || user.email }),
      });
      if (res.ok) {
        setCommentText('');
        fetchComments();
        toast.success('Comment posted');
      }
    } catch { /* ok */ }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950">
        <AppHeader />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin h-8 w-8 border-2 border-surface-600 border-t-white rounded-full" />
        </div>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="min-h-screen bg-surface-950">
        <AppHeader />
        <div className="text-center py-32">
          <h1 className="text-2xl font-bold text-white mb-2">Theme not found</h1>
          <p className="text-surface-400 mb-4">This theme may have been removed.</p>
          <Link href="/colors"><Button>Browse Themes</Button></Link>
        </div>
      </div>
    );
  }

  const c = theme.colors;
  const stripeColors = [c.bgBase, c.bgSurface, c.bgElevated, c.brand, c.scriptBg, c.textPrimary, c.scriptText, c.border];
  const categoryInfo = THEME_CATEGORIES.find((cat) => cat.id === theme.category);

  return (
    <div className="min-h-screen bg-surface-950">
      <AppHeader />
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-surface-500 mb-6">
          <Link href="/colors" className="hover:text-white transition-colors">Themes</Link>
          <span>/</span>
          <span className="text-surface-300">{theme.name}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col lg:flex-row gap-8 mb-10">
          {/* Left: preview */}
          <div className="flex-1">
            <MiniScriptPreview colors={c} />
          </div>

          {/* Right: info */}
          <div className="w-full lg:w-80 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-white">{theme.name}</h1>
                {theme.is_staff_pick && <Badge variant="warning">Staff Pick</Badge>}
              </div>
              {theme.description && (
                <p className="text-sm text-surface-400 mt-1">{theme.description}</p>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-surface-500">
              <span>by {theme.author_name || 'Anonymous'}</span>
              <span>{timeAgo(theme.created_at)}</span>
              {categoryInfo && (
                <span className="flex items-center gap-1">
                  {categoryInfo.icon} {categoryInfo.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-surface-300">
                <Icon name="arrowUp" size="sm" />
                <span>{theme.use_count} uses</span>
              </div>
              <div className="flex items-center gap-1 text-surface-300">
                <Icon name="chat" size="sm" />
                <span>{comments.length} comments</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleUse} className="flex-1">
                {applied ? '✓ Applied' : 'Use Theme'}
              </Button>
              <Button variant="secondary" onClick={handleOpenEditor}>
                <Icon name="edit" size="sm" className="mr-1" />
                Edit
              </Button>
            </div>
          </div>
        </div>

        {/* Color palette */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Color Palette</h2>
          <div className="flex h-12 rounded-xl overflow-hidden mb-4 border border-surface-700">
            {stripeColors.map((col: string, i: number) => (
              <div key={i} className="flex-1" style={{ background: col }} />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(c).map(([key, val]) => (
              <div key={key} className="space-y-1.5">
                <div className="w-full h-14 rounded-lg border border-surface-700" style={{ background: val as string }} />
                <div className="text-xs text-surface-400">{key}</div>
                <div className="text-[11px] text-surface-500 font-mono">{val as string}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Comments */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Comments</h2>

          {user ? (
            <div className="flex gap-2 mb-6">
              <Input
                placeholder="Leave a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleComment(); }}
              />
              <Button onClick={handleComment} loading={submitting} disabled={!commentText.trim()}>
                Post
              </Button>
            </div>
          ) : (
            <p className="text-sm text-surface-500 mb-6">
              <Link href="/auth/login" className="text-brand-400 hover:underline">Sign in</Link> to leave a comment.
            </p>
          )}

          {comments.length === 0 ? (
            <p className="text-sm text-surface-500">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="border-t border-surface-800 pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{comment.user_name || 'Anonymous'}</span>
                    <span className="text-[10px] text-surface-500">{timeAgo(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-surface-300">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
