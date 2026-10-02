'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronsLeft, Menu, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { isFullAdmin } from '@/components/admin/types';
import { NAV_SECTIONS, preloadTab, type NavItem } from '@/components/admin/registry';
import { EASE } from '@/components/admin/motion';

const COLLAPSE_KEY = 'admin:sidebar:collapsed';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const full = !!user && isFullAdmin(user.id, user.role);
  const activeTab = searchParams.get('tab') || (full ? 'overview' : 'tickets');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch { /* storage unavailable */ }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  };

  // "/" focuses the nav filter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== '/' || el.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      setCollapsed(false);
      setMobileOpen(true);
      requestAnimationFrame(() => searchRef.current?.focus());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname, activeTab]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return NAV_SECTIONS
      .map((s) => ({
        ...s,
        items: s.items.filter((i) => (full || i.mod) && (!q || i.label.toLowerCase().includes(q))),
      }))
      .filter((s) => s.items.length > 0);
  }, [query, full]);

  const isActive = (item: NavItem) => {
    if (item.tab) return pathname === '/admin' && activeTab === item.tab;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  const sidebar = (compact: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-center gap-3 border-b border-surface-800 p-4', compact && 'justify-center px-2')}>
        <Link href="/dashboard" title="Back to dashboard" className="shrink-0">
          <motion.div
            whileHover={{ rotate: -6, scale: 1.05 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-400 text-xs font-bold text-white shadow-lg shadow-brand-600/30"
          >
            A
          </motion.div>
        </Link>
        {!compact && (
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-white">Admin</h2>
            <p className="truncate text-[11px] text-surface-500">{full ? 'Platform management' : 'Moderation tools'}</p>
          </div>
        )}
      </div>

      {!compact && (
        <div className="px-3 pt-3">
          <label className="flex items-center gap-2 rounded-lg border border-surface-800 bg-surface-900/60 px-2.5 py-1.5 text-surface-500 focus-within:border-brand-500/50">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); } }}
              placeholder="Jump to…"
              className="w-full bg-transparent text-xs text-white placeholder:text-surface-600 focus:outline-none"
            />
            <kbd className="rounded border border-surface-700 px-1 text-[10px] text-surface-500">/</kbd>
          </label>
        </div>
      )}

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {sections.map((section) => (
          <div key={section.label}>
            {!compact && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">{section.label}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={compact ? item.label : undefined}
                    onMouseEnter={() => item.tab && preloadTab(item.tab)}
                    onFocus={() => item.tab && preloadTab(item.tab)}
                    className={cn(
                      'relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                      compact && 'justify-center px-0',
                      active ? 'text-white' : 'text-surface-400 hover:bg-surface-800/40 hover:text-white',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={compact ? 'admin-nav-active-compact' : 'admin-nav-active'}
                        className="absolute inset-0 rounded-lg bg-brand-600/15 ring-1 ring-brand-500/25"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      >
                        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand-400" />
                      </motion.span>
                    )}
                    <span className={cn('relative', active ? 'text-brand-400' : 'text-surface-500')}>{item.icon}</span>
                    {!compact && <span className="relative truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {sections.length === 0 && <p className="px-3 text-xs text-surface-600">No matches</p>}
      </nav>

      <div className={cn('flex items-center border-t border-surface-800 p-3', compact ? 'flex-col gap-2' : 'justify-between')}>
        <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-surface-500 transition-colors hover:text-white" title="Back to dashboard">
          <ArrowLeft className="h-4 w-4" />
          {!compact && 'Dashboard'}
        </Link>
        <button
          onClick={toggleCollapsed}
          className="hidden rounded-lg p-1.5 text-surface-500 transition-colors hover:bg-surface-800/50 hover:text-white md:block"
          title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <motion.span className="block" animate={{ rotate: compact ? 180 : 0 }}>
            <ChevronsLeft className="h-4 w-4" />
          </motion.span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      {/* Mobile header */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center gap-3 border-b border-surface-800 bg-surface-950/90 px-3 backdrop-blur md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800/50 hover:text-white" aria-label="Open admin menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-white">Admin</span>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
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
              {sidebar(false)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        className="hidden shrink-0 border-r border-surface-800 bg-surface-950 md:block"
        initial={false}
        animate={{ width: collapsed ? 68 : 248 }}
        transition={{ duration: 0.25, ease: EASE }}
      >
        {sidebar(collapsed)}
      </motion.aside>

      {/* Main */}
      <main className="min-w-0 flex-1 overflow-y-auto pt-12 md:pt-0">
        <div className="mx-auto max-w-[1440px] p-4 md:p-8">
          {/* Keyed on route + tab: each view fades in and gets a fresh error boundary */}
          <motion.div
            key={`${pathname}?${activeTab}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <ErrorBoundary>{children}</ErrorBoundary>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
