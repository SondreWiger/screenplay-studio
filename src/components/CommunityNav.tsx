'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { CommunityStatsPanel } from '@/components/community/CommunityStatsPanel';
import { ShellActions } from '@/components/shell/ShellActions';
import { cn } from '@/lib/utils';


/**
 * Community area actions for the app shell topbar: context-sensitive create
 * buttons and the personal stats panel. Navigation lives in the shell sidebar.
 */
export function CommunityNav() {
  const { user } = useAuth();
  const pathname = usePathname() || '';
  const [statsOpen, setStatsOpen] = useState(false);

  const canCreateCourse =
    user && (
      user.role === 'admin' ||
      user.role === 'moderator' ||
      ((user as { level?: number }).level ?? 0) >= 10
    );
  const sub = pathname.match(/^\/community\/c\/([^/]+)/)?.[1];
  const btn = 'inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-500';

  return (
    <ShellActions>
      {user ? (
        <>
          {pathname.startsWith('/community/courses') && canCreateCourse && (
            <Link href="/community/courses/create" className={btn}>+ <span className="hidden sm:inline">Create </span>course</Link>
          )}
          {(pathname === '/community' || pathname.startsWith('/community/post') || pathname === '/community/free-scripts') && (
            <Link href="/community/share" className={btn}>+ Share<span className="hidden sm:inline"> script</span></Link>
          )}
          {sub && sub !== 'create' && (
            <Link href={`/community/c/${sub}?compose=1`} className={btn}>+ Post</Link>
          )}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setStatsOpen((v) => !v)}
              className={cn('rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors', statsOpen ? 'border-brand-500/50 text-white' : 'border-surface-800 text-surface-300 hover:text-white')}
              aria-label="My community stats"
              aria-expanded={statsOpen}
            >
              My stats
            </button>
            {statsOpen && <CommunityStatsPanel user={user} onClose={() => setStatsOpen(false)} />}
          </div>
        </>
      ) : (
        <Link href={`/auth/login?redirect=${encodeURIComponent(pathname)}`} className="hidden rounded-xl border border-surface-800 px-3 py-1.5 text-xs font-semibold text-surface-300 hover:text-white md:inline-flex">
          Sign in to post
        </Link>
      )}
    </ShellActions>
  );
}
