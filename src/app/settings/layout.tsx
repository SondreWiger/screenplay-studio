'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureAccess } from '@/components/FeatureGate';
import { AppShell } from '@/components/shell/AppShell';
import { SubNav } from '@/components/shell/SubNav';
import { Pill, TabSkeleton } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const NAV_ITEMS = [
  { href: '/settings?tab=profile', label: 'Profile', param: 'profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { href: '/settings?tab=notifications', label: 'Notifications', param: 'notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { href: '/settings?tab=preferences', label: 'Preferences', param: 'preferences', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
  { href: '/settings?tab=appearance', label: 'Appearance', param: 'appearance', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
  { href: '/settings?tab=company', label: 'Company', param: 'company', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { href: '/settings?tab=privacy', label: 'Privacy & Data', param: 'privacy', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { href: '/settings/security', label: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  { href: '/settings/mcp', label: 'Claude & MCP', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
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

const icon = (d: string) => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} /></svg>
);

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <SettingsFrame>{children}</SettingsFrame>
    </AppShell>
  );
}

function SettingsFrame({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canUse: canUseFeature } = useFeatureAccess();
  const activeTab = searchParams.get('tab') || 'profile';

  if (authLoading) return <div className="p-6 md:p-8"><TabSkeleton /></div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-32 text-center">
        <p className="text-sm text-surface-400">Sign in to manage your settings.</p>
        <Link href="/auth/login?redirect=/settings" className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500">Sign in</Link>
      </div>
    );
  }

  const onSettingsRoot = pathname === '/settings';
  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.param) return onSettingsRoot && activeTab === item.param;
    return pathname.startsWith(item.href.split('?')[0]);
  };

  const all = [...NAV_ITEMS, ...PRO_ITEMS, ...BOTTOM_ITEMS];
  const section = all.find((item) => ('param' in item && item.param ? onSettingsRoot && activeTab === item.param : pathname.startsWith(item.href.split('?')[0])));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
      {/* Who you are, and where in settings you are */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-surface-800 bg-gradient-to-br from-surface-900 via-surface-900/80 to-brand-950/30 p-5">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-600/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <Avatar src={user.avatar_url} name={user.display_name || user.full_name || user.email} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-400">Settings{section ? ` · ${section.label}` : ''}</p>
            <h1 className="mt-0.5 flex items-center gap-2 truncate text-xl font-bold tracking-tight text-white">
              {user.display_name || user.full_name || 'Your account'}
              {user.is_pro && <Pill tone="amber">Pro</Pill>}
            </h1>
            <p className="truncate text-xs text-surface-500">{user.username ? `@${user.username} · ` : ''}{user.email}</p>
          </div>
          {user.username && (
            <Link href={`/u/${user.username}`} className="hidden rounded-xl border border-surface-800 px-3 py-1.5 sm:inline-flex text-xs font-semibold text-surface-300 transition-colors hover:border-surface-700 hover:text-white">
              View public profile →
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <SubNav
          id="settings"
          title="Settings"
          groups={[
            { items: NAV_ITEMS.map((item) => ({ label: item.label, href: item.href, icon: icon(item.icon), active: isActive(item) })) },
            ...(canUseFeature('pro_subscription') ? [{ label: 'Pro', items: PRO_ITEMS.map((item) => ({ label: item.label, href: item.href, icon: icon(item.icon), active: pathname.startsWith(item.href) })) }] : []),
            { label: 'More', items: BOTTOM_ITEMS.map((item) => ({ label: item.label, href: item.href, icon: icon(item.icon), active: pathname.startsWith(item.href) })) },
          ]}
        />
        <div className="min-w-0 flex-1 pb-16">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
