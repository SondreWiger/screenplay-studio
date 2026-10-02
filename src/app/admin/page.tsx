'use client';

import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isFullAdmin, isStaff } from '@/components/admin/types';
import { MOD_TABS, TAB_LOADERS, isAdminTab, type AdminTab } from '@/components/admin/registry';
import { TabSkeleton } from '@/components/admin/motion';

// One lazily-loaded chunk per tab. Each tab fetches only its own data.
const TABS = Object.fromEntries(
  (Object.keys(TAB_LOADERS) as AdminTab[]).map((key) => [
    key,
    dynamic(TAB_LOADERS[key], { ssr: false, loading: () => <TabSkeleton /> }),
  ]),
) as Record<AdminTab, React.ComponentType>;

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const staff = !!user && isStaff(user.role);
  const full = !!user && isFullAdmin(user.id, user.role);

  useEffect(() => {
    if (!loading && !staff && !full) router.replace('/dashboard');
  }, [loading, staff, full, router]);

  const tab = useMemo<AdminTab>(() => {
    const requested = searchParams.get('tab');
    const allowed = full ? null : MOD_TABS;
    if (isAdminTab(requested) && (!allowed || allowed.includes(requested))) return requested;
    return full ? 'overview' : 'tickets';
  }, [searchParams, full]);

  if (loading) return <TabSkeleton />;
  if (!staff && !full) return null;

  const Tab = TABS[tab];
  return <Tab key={tab} />;
}
