'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsLeft, LogIn, LogOut, Menu, MessageSquare, Search, Settings, UserRound, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureAccess } from '@/components/FeatureGate';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { isElectronMode, isLocalMode } from '@/lib/supabase/electron-client';
import { useAuthStore, useNotificationStore } from '@/lib/stores';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { SiteVersion } from '@/components/SiteVersion';
import { buildShellNav, isNavItemActive, type ShellNavItem } from './nav';
import { ShellSlotContext } from './ShellActions';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';
const COLLAPSE_KEY = 'shell:sidebar:collapsed';
const EASE = [0.2, 0.8, 0.2, 1] as const;
/** Pages that fill the viewport under the topbar (the inbox) skip the footer. */
const FULL_HEIGHT = /^\/(messages)/;

/**
 * The app shell for everything outside a project: one sidebar, one topbar,
 * one account menu — the same structure as the project and admin layouts.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname() || '';
  const router = useRouter();
  const { canUse } = useFeatureAccess();
  const { notifications, unreadCount } = useNotificationStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const signedIn = !!user;
  const isElectron = isElectronMode();
  const isAdmin = !!user && (user.id === ADMIN_UID || user.role === 'admin');
  const staff = isAdmin || user?.role === 'moderator';
  const unreadDMs = notifications.filter((n) => n.type === 'direct_message' && !n.read).length;
  const badges = { messages: unreadDMs, notifications: unreadCount };

  const sections = useMemo(() => buildShellNav({
    signedIn: !!user,
    isElectron,
    community: canUse('community') && isFeatureEnabled('community') && user?.show_community !== false,
    messages: isFeatureEnabled('directMessages') && !isElectron,
    companies: isFeatureEnabled('companies'),
    hasCompany: true,
    accountability: user?.show_accountability !== false,
    staff,
    isAdmin,
    username: user?.username ?? null,
  }), [user, isElectron, canUse, staff, isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({ ...s, items: s.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((s) => s.items.length > 0);
  }, [sections, query]);

  const current = useMemo(() => {
    for (const s of sections) for (const i of s.items) if (isNavItemActive(i, pathname)) return { section: s.label, item: i };
    return null;
  }, [sections, pathname]);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { setMobileOpen(false); setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== '/' || el.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      setCollapsed(false);
      if (window.innerWidth < 768) setMobileOpen(true);
      requestAnimationFrame(() => searchRef.current?.focus());
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, []);

  const toggleCollapsed = () => setCollapsed((c) => {
    try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* ignore */ }
    return !c;
  });

  const signOut = async () => {
    await useAuthStore.getState().signOut();
    router.replace('/auth/login');
  };

  const renderLink = (item: ShellNavItem, compact: boolean, layoutId: string) => {
    const active = isNavItemActive(item, pathname);
    const count = item.badge ? badges[item.badge] : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={compact ? item.label : undefined}
        className={cn(
          'relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
          compact && 'justify-center px-0',
          active ? 'text-white' : 'text-surface-400 hover:bg-surface-800/40 hover:text-white',
        )}
      >
        {active && (
          <motion.span layoutId={layoutId} className="absolute inset-0 rounded-lg bg-brand-600/15 ring-1 ring-brand-500/25" transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand-400" />
          </motion.span>
        )}
        <span className={cn('relative', active ? 'text-brand-400' : 'text-surface-500')}>{item.icon}</span>
        {!compact && <span className="relative min-w-0 flex-1 truncate">{item.label}</span>}
        {count > 0 && (
          <span className={cn('relative min-w-[18px] rounded-full bg-brand-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white', compact && 'absolute -right-0.5 -top-0.5')}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Link>
    );
  };

  const sidebar = (compact: boolean, idSuffix: string) => (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-center gap-3 border-b border-surface-800 p-4', compact && 'justify-center px-2')}>
        <Link href={signedIn ? '/dashboard' : '/'} className="flex shrink-0 items-center gap-2.5" title="Screenplay Studio">
          <motion.span
            whileHover={{ rotate: -6, scale: 1.05 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-400 text-[11px] font-bold text-white shadow-lg shadow-brand-600/30"
          >
            SS
          </motion.span>
          {!compact && (
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-white">Screenplay Studio</span>
              <span className="block text-[11px] text-surface-500">{current?.section ?? 'Welcome'}</span>
            </span>
          )}
        </Link>
      </div>

      {!compact && (
        <div className="px-3 pt-3">
          <label className="flex items-center gap-2 rounded-lg border border-surface-800 bg-surface-900/60 px-2.5 py-1.5 text-surface-500 focus-within:border-brand-500/50">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
                if (e.key === 'Enter' && filtered[0]?.items[0]) { router.push(filtered[0].items[0].href); setQuery(''); }
              }}
              placeholder="Jump to…"
              className="w-full bg-transparent text-xs text-white placeholder:text-surface-600 focus:outline-none"
            />
            <kbd className="rounded border border-surface-700 px-1 text-[10px] text-surface-500">/</kbd>
          </label>
        </div>
      )}

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {filtered.map((section) => (
          <div key={section.id}>
            {!compact && <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">{section.label}</p>}
            <div className="space-y-0.5">
              {section.items.map((item) => renderLink(item, compact, `shell-nav-${idSuffix}`))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="px-3 text-xs text-surface-600">No matches</p>}
      </nav>

      {/* Account */}
      <div className={cn('border-t border-surface-800 p-3', compact && 'px-2')}>
        {user ? (
          <div ref={menuRef} className="relative">
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className={cn('absolute bottom-full z-50 mb-2 w-60 overflow-hidden rounded-2xl border border-surface-800 bg-surface-900 shadow-2xl', compact ? 'left-0' : 'left-0 right-0 w-auto')}
                  role="menu"
                >
                  <div className="border-b border-surface-800 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-white">{user.display_name || user.full_name || 'Your account'}</p>
                    <p className="truncate text-[11px] text-surface-500">{user.email}</p>
                  </div>
                  <div className="py-1">
                    {user.username && (
                      <Link href={`/u/${user.username}`} className="flex items-center gap-2.5 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800/60 hover:text-white" role="menuitem">
                        <UserRound className="h-4 w-4 text-surface-500" /> Public profile
                      </Link>
                    )}
                    <Link href="/settings" className="flex items-center gap-2.5 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800/60 hover:text-white" role="menuitem">
                      <Settings className="h-4 w-4 text-surface-500" /> Settings
                    </Link>
                    <button onClick={signOut} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10" role="menuitem">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={cn('flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-surface-800/50', compact && 'justify-center')}
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              <Avatar src={user.avatar_url} name={user.display_name || user.full_name || user.email} size="sm" />
              {!compact && (
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-[13px] font-medium text-white">
                    <span className="truncate">{user.display_name || user.full_name || 'Account'}</span>
                    {user.is_pro && <span className="rounded bg-amber-500/15 px-1 text-[9px] font-bold text-amber-300">PRO</span>}
                  </span>
                  <span className="block truncate text-[11px] text-surface-500">{user.email}</span>
                </span>
              )}
            </button>
          </div>
        ) : (
          <div className={cn('flex gap-2', compact ? 'flex-col items-center' : '')}>
            <Link href={`/auth/login?redirect=${encodeURIComponent(pathname)}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-surface-800 px-3 py-2 text-xs font-semibold text-surface-200 hover:text-white" title="Sign in">
              <LogIn className="h-4 w-4" />{!compact && 'Sign in'}
            </Link>
            {!compact && <Link href="/auth/register" className="flex-1 rounded-xl bg-brand-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-brand-500">Get started</Link>}
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          className={cn('mt-2 hidden w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-surface-500 transition-colors hover:bg-surface-800/50 hover:text-white md:flex', compact && 'justify-center')}
          aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <motion.span animate={{ rotate: compact ? 180 : 0 }}><ChevronsLeft className="h-4 w-4" /></motion.span>
          {!compact && 'Collapse'}
        </button>
      </div>
    </div>
  );

  return (
    <ShellSlotContext.Provider value={{ slot, inShell: true }}>
      <div className="flex min-h-screen bg-surface-950">
        {/* Desktop sidebar */}
        <motion.aside
          className="sticky top-0 hidden h-screen shrink-0 border-r border-surface-800 bg-surface-950 md:block"
          initial={false}
          animate={{ width: collapsed ? 68 : 248 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {sidebar(collapsed, 'desktop')}
        </motion.aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
              <motion.aside
                className="fixed inset-y-0 left-0 z-50 w-72 border-r border-surface-800 bg-surface-950 md:hidden"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              >
                <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 rounded-lg p-1 text-surface-500 hover:text-white" aria-label="Close menu">
                  <X className="h-4 w-4" />
                </button>
                {sidebar(false, 'mobile')}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar: where you are, page actions, inbox */}
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-surface-800 bg-surface-950/85 px-3 backdrop-blur-xl sm:px-6 md:static md:bg-transparent md:backdrop-blur-none">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800/50 hover:text-white md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              {current ? (
                <>
                  <span className="hidden text-surface-500 sm:inline">{current.section}</span>
                  <span className="hidden text-surface-700 sm:inline">/</span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={current.item.href} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="flex items-center gap-1.5 truncate font-medium text-white">
                      <span className="text-brand-400 [&>svg]:h-4 [&>svg]:w-4">{current.item.icon}</span>
                      {current.item.label}
                    </motion.span>
                  </AnimatePresence>
                </>
              ) : (
                <span className="font-medium text-white">Screenplay Studio</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <div ref={setSlot} className="flex items-center gap-2 [&_a]:whitespace-nowrap [&_button]:whitespace-nowrap" />
              {!isElectron && <OfflineIndicator />}
              {signedIn && isFeatureEnabled('directMessages') && !isElectron && (
                <Link href="/messages" className="relative hidden rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-800/50 hover:text-white sm:block" aria-label="Messages">
                  <MessageSquare className="h-5 w-5" />
                  {unreadDMs > 0 && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-surface-950" />}
                </Link>
              )}
              {user && (!isElectron || !isLocalMode()) && <NotificationBell />}
              {!user && (
                <Link href="/auth/register" className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 md:hidden">Get started</Link>
              )}
            </div>
          </header>

          <main className="shell-main page-cascade min-w-0 flex-1">
            <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
          </main>

          {!FULL_HEIGHT.test(pathname) && <ShellFooter isElectron={isElectron} />}
        </div>
      </div>
    </ShellSlotContext.Provider>
  );
}

const FOOTER_LINKS = [
  { href: '/blog', label: 'Blog', web: true },
  { href: '/changelog', label: 'Changelog', web: true },
  { href: '/feedback', label: 'Feedback' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
  { href: 'https://ko-fi.com/northemdevelopment', label: 'Support us', web: true, external: true },
];

/** One quiet footer for every shell page, replacing the per-page copies. */
function ShellFooter({ isElectron }: { isElectron: boolean }) {
  return (
    <footer className="border-t border-surface-800/70 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 text-[11px] text-surface-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-[9px] font-bold text-white">SS</span>
          <span>Screenplay Studio</span>
          <SiteVersion />
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Footer">
          {FOOTER_LINKS.filter((l) => !(isElectron && l.web)).map((l) =>
            l.external ? (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">{l.label}</a>
            ) : (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-white">{l.label}</Link>
            ),
          )}
          <a href="https://development.northem.no/" target="_blank" rel="noopener noreferrer" className="text-brand-500/60 transition-colors hover:text-brand-400">
            Northem Development ♥
          </a>
        </nav>
      </div>
    </footer>
  );
}
