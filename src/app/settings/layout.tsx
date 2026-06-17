'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureAccess } from '@/components/FeatureGate';
import { AppHeader } from '@/components/AppHeader';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const NAV_ITEMS = [
  { href: '/settings?tab=profile', label: 'Profile', param: 'profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { href: '/settings?tab=preferences', label: 'Preferences', param: 'preferences', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
  { href: '/settings?tab=company', label: 'Company', param: 'company', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { href: '/settings?tab=privacy', label: 'Privacy & Data', param: 'privacy', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { href: '/settings/security', label: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  { href: '/settings?tab=gamification', label: 'Gamification', param: 'gamification', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/settings?tab=translations', label: 'Translations', param: 'translations', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' },
  { href: '/settings?tab=accountability', label: 'Accountability', param: 'accountability', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
];

const PRO_ITEMS = [
  { href: '/settings/billing', label: 'Billing', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
];

const BOTTOM_ITEMS = [
  { href: '/settings/creator', label: 'Creator Program', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { href: '/legal', label: 'Legal Center', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canUse: canUseFeature } = useFeatureAccess();
  const activeTab = searchParams.get('tab') || 'profile';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-950">
        <AppHeader />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin h-8 w-8 border-2 border-surface-600 border-t-white rounded-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-950">
        <AppHeader />
        <div className="flex items-center justify-center py-32">
          <p className="text-surface-400">Please sign in to access settings.</p>
        </div>
      </div>
    );
  }

  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.param) return activeTab === item.param;
    return pathname.startsWith(item.href.split('?')[0]);
  };

  return (
    <div className="min-h-screen bg-surface-950">
      <AppHeader />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          <aside className="w-full lg:w-56 shrink-0">
            <nav className="lg:sticky lg:top-20">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors mb-4 px-3 py-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Dashboard
              </Link>

              <div className="mb-2 px-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">Settings</span>
              </div>
              <div className="space-y-0.5">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive(item) ? 'bg-white/5 text-white font-medium' : 'text-surface-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                ))}
              </div>

              {canUseFeature('pro_subscription') && (
                <>
                  <div className="my-3 mx-3 border-t border-surface-800" />
                  <div className="mb-2 px-3">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">Pro</span>
                  </div>
                  <div className="space-y-0.5">
                    {PRO_ITEMS.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          pathname.startsWith(item.href) ? 'bg-white/5 text-white font-medium' : 'text-surface-400 hover:text-white hover:bg-white/[0.03]'
                        }`}
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                        </svg>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}

              <div className="my-3 mx-3 border-t border-surface-800" />
              <div className="space-y-0.5">
                {BOTTOM_ITEMS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      pathname.startsWith(item.href) ? 'bg-white/5 text-white font-medium' : 'text-surface-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </aside>

          <main className="flex-1 min-w-0 pb-16">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
