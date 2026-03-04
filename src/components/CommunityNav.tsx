'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// ============================================================
// Unified Community Nav
// Replaces the duplicated <nav> in every community page.
// Active tab is derived from the current pathname automatically.
// ============================================================

const NAV_LINKS = [
  { href: '/community',             label: 'Feed'       },
  { href: '/community/showcase',    label: 'Showcase'   },
  { href: '/community/challenges',  label: 'Challenges' },
  { href: '/community/courses',     label: 'Courses'    },
  { href: '/community/free-scripts',label: 'Scripts'    },
  { href: '/community/chat',        label: 'Chat'       },
  { href: '/blog',                  label: 'Blog'       },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/community') return pathname === '/community' || pathname.startsWith('/community/post');
  return pathname === href || pathname.startsWith(href + '/');
}

export function CommunityNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router   = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const canCreateCourse =
    user && (
      user.role === 'admin' ||
      user.role === 'moderator' ||
      (user as { level?: number }).level !== undefined && (user as { level?: number }).level! >= 10
    );

  return (
    <>
      {/* ── Main bar ── */}
      <nav
        className="sticky top-0 z-40 backdrop-blur-xl shrink-0"
        style={{ background: 'rgba(7,7,16,0.94)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 gap-4">

          {/* Logo */}
          <Link href="/community" className="flex items-center gap-2.5 group shrink-0">
            <div
              className="w-7 h-7 flex items-center justify-center shrink-0"
              style={{ background: '#FF5F1F' }}
            >
              <span className="font-black text-white text-[10px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/40 uppercase tracking-widest group-hover:text-white/70 transition-colors hidden sm:block">
              Community
            </span>
          </Link>

          {/* Desktop nav tabs */}
          <div className="hidden lg:flex items-center gap-5 flex-1 justify-center">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="text-[11px] font-mono uppercase tracking-widest transition-colors whitespace-nowrap"
                  style={{
                    color: active ? '#FF5F1F' : 'rgba(255,255,255,0.45)',
                    paddingBottom: active ? '2px' : undefined,
                    borderBottom: active ? '1px solid #FF5F1F' : undefined,
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user ? (
              <>
                {/* Context-sensitive CTAs */}
                {pathname.startsWith('/community/courses') && canCreateCourse && (
                  <Link
                    href="/community/courses/create"
                    className="ss-btn-orange hidden sm:inline-flex"
                    style={{ padding: '0.35rem 0.9rem', fontSize: '10px' }}
                  >
                    Create Course
                  </Link>
                )}
                {(pathname === '/community' || pathname.startsWith('/community/post') || pathname === '/community/free-scripts') && (
                  <Link
                    href="/community/share"
                    className="ss-btn-orange hidden sm:inline-flex"
                    style={{ padding: '0.35rem 0.9rem', fontSize: '10px' }}
                  >
                    Share Script
                  </Link>
                )}

                {/* Notifications */}
                <NotificationBell />

                {/* Messages */}
                <Link
                  href="/messages"
                  className="relative p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                  aria-label="Messages"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </Link>

                {/* Avatar */}
                <Link href={`/u/${user.username || user.id}`} className="shrink-0">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name || 'Avatar'}
                      className="w-7 h-7 rounded-full"
                      style={{ boxShadow: '0 0 0 1.5px rgba(255,255,255,0.12)' }}
                    />
                  ) : (
                    <div
                      className="w-7 h-7 flex items-center justify-center text-[10px] font-black text-white rounded-full shrink-0"
                      style={{ background: '#FF5F1F' }}
                    >
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </Link>

                {/* Sign out — desktop */}
                <button
                  onClick={handleSignOut}
                  className="text-[10px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors hidden xl:block"
                >
                  Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href={`/auth/login?redirect=${encodeURIComponent(pathname)}`}
                  className="text-[11px] font-mono text-white/50 uppercase tracking-widest hover:text-white/70 transition-colors hidden sm:block"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  className="ss-btn-orange"
                  style={{ padding: '0.35rem 0.9rem', fontSize: '10px' }}
                >
                  Get Started
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="lg:hidden p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div
            className="lg:hidden border-t border-white/[0.07] pb-4"
            style={{ background: 'rgba(7,7,16,0.98)' }}
          >
            <div className="max-w-7xl mx-auto px-4 pt-2 flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'text-[11px] font-mono uppercase tracking-widest py-2.5 px-3 rounded-lg transition-colors',
                      active
                        ? 'text-[#FF5F1F] bg-[#FF5F1F]/[0.08]'
                        : 'text-white/50 hover:text-white hover:bg-white/5',
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
              <div className="h-px bg-white/[0.06] my-1" />
              {user ? (
                <>
                  <Link href="/messages" onClick={() => setMobileOpen(false)}
                    className="text-[11px] font-mono uppercase tracking-widest py-2.5 px-3 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors">
                    Messages
                  </Link>
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)}
                    className="text-[11px] font-mono uppercase tracking-widest py-2.5 px-3 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors">
                    Dashboard
                  </Link>
                  <Link href="/community/share" onClick={() => setMobileOpen(false)}
                    className="text-[11px] font-mono uppercase tracking-widest py-2.5 px-3 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors">
                    Share Script
                  </Link>
                  <button
                    onClick={() => { setMobileOpen(false); handleSignOut(); }}
                    className="text-left text-[11px] font-mono uppercase tracking-widest py-2.5 px-3 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href={`/auth/login?redirect=${encodeURIComponent(pathname)}`}
                  onClick={() => setMobileOpen(false)}
                  className="text-[11px] font-mono uppercase tracking-widest py-2.5 px-3 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
