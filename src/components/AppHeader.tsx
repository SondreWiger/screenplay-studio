'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useFeatureAccess } from '@/components/FeatureGate';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Avatar } from '@/components/ui';

// ============================================================
// AppHeader — Shared navigation header for all top-level pages
// Provides consistent navigation across dashboard, settings,
// company, pro, billing, blog, community, and other pages.
// ============================================================

type AppHeaderProps = {
  /** Optional right-side content (e.g., action buttons) */
  actions?: React.ReactNode;
  /** If true, show a minimal back-to-dashboard header */
  minimal?: boolean;
  /** Override the back link destination */
  backHref?: string;
  /** Override back link label */
  backLabel?: string;
};

export function AppHeader({ actions, minimal, backHref, backLabel }: AppHeaderProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const { canUse: canUseFeature } = useFeatureAccess();

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/settings', label: 'Settings', match: ['/settings'] },
    { href: '/company', label: 'Company', match: ['/company'] },
    { href: '/blog', label: 'Blog', match: ['/blog'] },
    ...(canUseFeature('community') ? [{ href: '/community', label: 'Community', match: ['/community'] }] : []),
  ];

  const isActive = (link: typeof navLinks[0]) => {
    if (pathname === link.href) return true;
    if (link.match) return link.match.some(m => pathname.startsWith(m));
    return false;
  };

  if (minimal) {
    return (
      <header className="sticky top-0 z-40 border-b border-surface-800 bg-surface-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <Link href={backHref || '/dashboard'} className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span className="text-sm">{backLabel || 'Back'}</span>
          </Link>
          <div className="flex items-center gap-3">
            {actions}
            <NotificationBell />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-surface-800 bg-surface-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-3 sm:px-6 py-3">
        {/* Logo + Nav */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-orange-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white hidden sm:inline">Screenplay Studio</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  isActive(link) ? 'text-white bg-surface-800' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          {actions}
          <Link href="/messages" className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-white/5 transition-colors" title="Messages">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </Link>
          <NotificationBell />
          <Link href="/settings" className="shrink-0">
            <Avatar src={user?.avatar_url} name={user?.full_name} size="md" />
          </Link>
        </div>
      </div>
    </header>
  );
}
