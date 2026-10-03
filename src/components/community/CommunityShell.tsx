'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, LogOut, Menu, MessageSquare, Settings, UserRound, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { useAuthStore, useNotificationStore } from '@/lib/stores';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SiteVersion } from '@/components/SiteVersion';
import { Avatar } from '@/components/ui';
import { ShellSlotContext } from '@/components/shell/ShellActions';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/community', label: 'Feed', match: ['/community/post', '/community/share'], exact: true },
  { href: '/community/c', label: 'Communities' },
  { href: '/community/showcase', label: 'Showcase' },
  { href: '/community/challenges', label: 'Challenges' },
  { href: '/community/courses', label: 'Courses' },
  { href: '/community/free-scripts', label: 'Free Scripts' },
  { href: '/community/chat', label: 'Chat' },
] as const;

/** Pages that fill the screen under the bar (chats, course player) skip the footer. */
const FULL_HEIGHT = /^\/community\/(chat|c\/[^/]+\/chat|courses\/(?!create$)[^/]+$|showcase\/[^/]+\/mindmap)/;

function tabActive(tab: (typeof TABS)[number], pathname: string) {
  if (pathname === tab.href) return true;
  if ('match' in tab && tab.match.some((m) => pathname.startsWith(m))) return true;
  if ('exact' in tab && tab.exact) return false;
  return pathname.startsWith(tab.href + '/');
}

/**
 * The community is its own site inside the studio: its own top bar, tabs and
 * footer, with one button back to the studio. Pages still put their buttons
 * in the bar through <ShellActions>.
 */
export function CommunityShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname() || '';
  const router = useRouter();
  const { notifications } = useNotificationStore();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const unreadDMs = notifications.filter((n) => n.type === 'direct_message' && !n.read).length;
  const messages = isFeatureEnabled('directMessages');

  useEffect(() => { setMobileOpen(false); setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const signOut = async () => {
    await useAuthStore.getState().signOut();
    router.replace('/community');
  };

  return (
    <ShellSlotContext.Provider value={{ slot, inShell: true }}>
      <div className="flex min-h-screen flex-col bg-surface-950">
        <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-surface-950/85 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
            {/* Brand: the community's own mark */}
            <Link href="/community" className="group flex shrink-0 items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center bg-brand-500 text-[11px] font-semibold text-white" style={{ letterSpacing: '-0.04em' }}>SS</span>
              <span className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50 transition-colors group-hover:text-white sm:block lg:hidden xl:block">Community</span>
            </Link>

            {/* Tabs */}
            <nav className="mx-1 hidden min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] lg:flex xl:mx-2" aria-label="Community">
              {TABS.map((tab) => {
                const active = tabActive(tab, pathname);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      'relative shrink-0 whitespace-nowrap px-2 py-4 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors xl:px-2.5',
                      active ? 'text-white' : 'text-white/40 hover:text-white/80',
                    )}
                  >
                    {tab.label}
                    {active && (
                      <motion.span layoutId="community-tab" className="absolute inset-x-2 -bottom-px h-0.5 bg-brand-500 xl:inset-x-2.5" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
              <div ref={setSlot} className="flex items-center gap-2 [&_a]:whitespace-nowrap [&_button]:whitespace-nowrap" />
              {user ? (
                <>
                  {messages && (
                    <Link href="/messages" className="relative hidden rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white sm:block" aria-label="Messages">
                      <MessageSquare className="h-5 w-5" />
                      {unreadDMs > 0 && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-surface-950" />}
                    </Link>
                  )}
                  <NotificationBell />
                  <div ref={menuRef} className="relative">
                    <button onClick={() => setMenuOpen((o) => !o)} className="rounded-full ring-1 ring-white/10 transition hover:ring-white/30" aria-label="Account menu">
                      <Avatar src={user.avatar_url} name={user.display_name || user.full_name || user.email} size="sm" />
                    </button>
                    <AnimatePresence>
                      {menuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-surface-800 bg-surface-900 p-1 shadow-2xl shadow-black/50"
                        >
                          <div className="border-b border-surface-800 px-3 py-2">
                            <p className="truncate text-sm font-medium text-white">{user.display_name || user.full_name || 'You'}</p>
                            {user.username && <p className="truncate text-xs text-surface-500">@{user.username}</p>}
                          </div>
                          {user.username && (
                            <Link href={`/u/${user.username}`} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 hover:text-white">
                              <UserRound className="h-4 w-4" /> Public profile
                            </Link>
                          )}
                          <Link href="/settings" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 hover:text-white">
                            <Settings className="h-4 w-4" /> Settings
                          </Link>
                          <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 hover:text-white">
                            <LogOut className="h-4 w-4" /> Sign out
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {/* The way back into the studio */}
                  <Link href="/dashboard" className="hidden items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:border-white/25 hover:text-white md:inline-flex" title="Back to the studio">
                    <ArrowLeft className="h-3.5 w-3.5" /> <span className="lg:hidden xl:inline">Studio</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link href={`/auth/login?redirect=${encodeURIComponent(pathname)}`} className="hidden px-2 text-xs font-semibold text-white/60 hover:text-white sm:block">Sign in</Link>
                  <Link href="/auth/register" className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500">Get started</Link>
                </>
              )}
              <button onClick={() => setMobileOpen((o) => !o)} className="rounded-lg p-1.5 text-white/50 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Community menu" aria-expanded={mobileOpen}>
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          <AnimatePresence initial={false}>
            {mobileOpen && (
              <motion.nav
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                className="overflow-hidden border-t border-white/[0.06] lg:hidden"
                aria-label="Community"
              >
                <div className="mx-auto grid max-w-7xl grid-cols-2 gap-1 px-4 py-3 sm:grid-cols-3">
                  {TABS.map((tab) => (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={cn(
                        'rounded-lg px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors',
                        tabActive(tab, pathname) ? 'bg-brand-500/10 text-brand-400' : 'text-white/55 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {tab.label}
                    </Link>
                  ))}
                  {user && (
                    <Link href="/dashboard" className="col-span-full mt-1 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/70">
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to the studio
                    </Link>
                  )}
                </div>
              </motion.nav>
            )}
          </AnimatePresence>
        </header>

        <main className="shell-main page-cascade min-w-0 flex-1">
          <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
        </main>

        {!FULL_HEIGHT.test(pathname) && (
          <footer className="border-t border-white/[0.06]">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center bg-brand-500 text-[10px] font-semibold text-white">SS</span>
                <span className="text-[11px] uppercase tracking-[0.08em] text-white/40">Screenplay Studio Community</span>
                <SiteVersion />
              </div>
              <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.06em] text-white/35" aria-label="Community footer">
                <Link href="/community/showcase" className="hover:text-white">Showcase</Link>
                <Link href="/community/challenges" className="hover:text-white">Challenges</Link>
                <Link href="/legal/community-guidelines" className="hover:text-white">Guidelines</Link>
                <Link href="/blog" className="hover:text-white">Blog</Link>
                <Link href={user ? '/dashboard' : '/'} className="text-brand-500/80 hover:text-brand-400">{user ? 'Open the studio →' : 'About the studio →'}</Link>
              </nav>
            </div>
          </footer>
        )}
      </div>
    </ShellSlotContext.Provider>
  );
}
