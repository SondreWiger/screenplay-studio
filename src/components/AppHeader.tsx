'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useFeatureAccess } from '@/components/FeatureGate';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Avatar } from '@/components/ui';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { createClient } from '@/lib/supabase/client';

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
  const router = useRouter();
  const { canUse: canUseFeature } = useFeatureAccess();

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  // Primary nav — keep lean; secondary links live in the avatar dropdown
  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/idea-boards', label: 'Ideas', match: ['/idea-boards'] },
    { href: '/blog', label: 'Blog', match: ['/blog'] },
    ...(canUseFeature('community') ? [{ href: '/community', label: 'Community', match: ['/community'] }] : []),
    ...(user?.show_accountability !== false ? [{ href: '/accountability', label: 'Accountability', match: ['/accountability'] }] : []),
  ];

  const isActive = (link: typeof navLinks[0]) => {
    if (pathname === link.href) return true;
    if (link.match) return link.match.some(m => pathname.startsWith(m));
    return false;
  };

  if (minimal) {
    return (
      <header className="sticky top-0 z-40 backdrop-blur-xl" style={{ background: 'rgba(7,7,16,0.92)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <Link href={backHref || '/dashboard'} className="flex items-center gap-2 text-white/40 hover:text-white transition-all group">
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span className="text-sm font-medium">{backLabel || 'Back'}</span>
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
    <header className="sticky top-0 z-40 backdrop-blur-xl" style={{ background: 'rgba(7,7,16,0.92)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>

      <div className="max-w-7xl mx-auto flex items-center justify-between px-3 sm:px-6 h-14">
        {/* Logo + Nav */}
        <div className="flex items-center gap-5 sm:gap-7">

          {/* Wordmark */}
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
            <div
              className="w-8 h-8 flex items-center justify-center transition-all duration-200 group-hover:scale-105"
              style={{ background: '#FF5F1F' }}
            >
              <span className="text-white font-black text-[11px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white">Screenplay</span>
              <span className="text-[9px] font-mono uppercase tracking-widest text-white/40">Studio</span>
            </div>
          </Link>

          {/* Divider */}
          <div className="hidden md:block w-px h-5" style={{ background: 'rgba(255,255,255,0.07)' }} />

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const active = isActive(link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'relative px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest transition-all duration-150',
                    active
                      ? 'text-white'
                      : 'text-white/40 hover:text-white/70'
                  )}
                >
                  <span className="relative">{link.label}</span>
                  {active && (
                    <span
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-px"
                      style={{ background: '#FF5F1F' }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1 sm:gap-2">
          {actions}
          <OfflineIndicator />

          {/* Messages */}
          <Link
            href="/messages"
            className="p-2 text-white/30 hover:text-white hover:bg-white/5 transition-all"
            title="Messages"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </Link>

          <NotificationBell />

          {/* Profile dropdown */}
          <div ref={profileRef} className="relative ml-1">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="shrink-0 rounded-full transition-all duration-200 hover:scale-105"
              style={profileOpen ? { boxShadow: '0 0 0 2px #FF5F1F, 0 0 16px rgba(255,95,31,0.3)' } : { boxShadow: '0 0 0 2px rgba(255,255,255,0.08)' }}
              aria-label="Open profile menu"
            >
              <Avatar src={user?.avatar_url} name={user?.full_name} size="md" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2.5 w-56 overflow-hidden z-50 animate-scale-in"
                style={{
                  border: '1px solid rgba(255,255,255,0.07)',
                  background: '#0d0d1a',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
                }}
              >
                {/* User hero */}
                <div className="px-4 py-3.5 relative overflow-hidden"
                  style={{ background: 'rgba(255,95,31,0.08)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[#FF5F1F] mb-1">Signed in as</p>
                  <p className="text-sm font-black text-white truncate" style={{ letterSpacing: '-0.02em' }}>{user?.full_name || 'Your Account'}</p>
                  <p className="text-[11px] text-white/40 truncate mt-0.5">{user?.email}</p>
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  {[
                    { href: '/settings', label: 'Settings', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /> },
                    { href: '/accountability', label: 'Accountability', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /> },
                    { href: '/idea-boards', label: 'Idea Boards', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /> },
                    { href: '/company', label: 'Company', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" /> },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all group"
                    >
                      <svg className="w-4 h-4 text-white/30 group-hover:text-[#FF5F1F] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">{item.icon}</svg>
                      {item.label}
                    </Link>
                  ))}
                </div>

                {/* Pro upsell */}
                <div className="mx-3 mb-2"
                  style={{ border: '1px solid rgba(255,95,31,0.3)', background: 'rgba(255,95,31,0.06)' }}
                >
                  <Link href="/pro" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 group">
                    <div className="w-7 h-7 flex items-center justify-center shrink-0"
                      style={{ background: '#FF5F1F' }}>
                      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#FF5F1F]" style={{ letterSpacing: '-0.02em' }}>UPGRADE TO PRO</p>
                      <p className="text-[10px] font-mono text-white/40">Unlock all features</p>
                    </div>
                    <svg className="w-3.5 h-3.5 text-white/30 group-hover:text-[#FF5F1F] ml-auto transition-all group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                </div>

                {/* Sign out */}
                <div className="py-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-surface-400 hover:text-red-400 hover:bg-red-500/5 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}