'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { PRO_LIMITS, type Subscription, type TeamLicense } from '@/lib/types';

// useProFeatures — DaVinci Resolve model
// Free is fully functional; nothing is taken away to make Pro.
// Pro adds the production tool suite (portfolio, production accounting,
// rights management, distribution, etc.) — see lib/pro-tools/tools.ts.

/** Pro subscriptions started before this date keep the Studio tool suite. */
export const STUDIO_TIER_START = '2026-10-01';

interface ProFeatures {
  isPro: boolean;
  /** Studio tier: the production tool suite (formerly "Pro Tools"). */
  isStudio: boolean;
  subscription: Subscription | null;
  loading: boolean;
  // Limits
  storageLimit: number;
  storageUsed: number;
  maxTeamSize: number;
  maxProjects: number;
  // Feature flags
  hasVersionHistory: boolean;
  hasExternalShares: boolean;
  hasClientReview: boolean;
  hasAnalyticsDashboard: boolean;
  hasCustomBranding: boolean;
  hasPrioritySupport: boolean;
  hasApiAccess: boolean;
  hasAdvancedScheduling: boolean;
  hasWatermarkedExports: boolean;
  hasBulkExport: boolean;
  hasAdvancedExports: boolean;
  // Actions
  activateDevBypass: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  // Per-project Pro check
  isProForProject: (project: { pro_enabled?: boolean } | null | undefined) => boolean;
}

// Shared across every component that calls useProFeatures() (28+ call sites):
// one request per user per TTL instead of two queries per mounted component.
type ProData = { subscription: Subscription | null; gating: boolean };
const PRO_TTL_MS = 5 * 60_000;
let proCache: { userId: string; at: number; data: ProData } | null = null;
let proInflight: { userId: string; promise: Promise<ProData> } | null = null;

function loadProData(userId: string, force = false): Promise<ProData> {
  if (!force && proCache?.userId === userId && Date.now() - proCache.at < PRO_TTL_MS) {
    return Promise.resolve(proCache.data);
  }
  if (!force && proInflight?.userId === userId) return proInflight.promise;
  const supabase = createClient();
  const promise = Promise.all([
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'pro_gating_enabled')
      .maybeSingle(),
  ]).then(([subRes, gatingRes]) => {
    // Default: gating ON. Admin can set 'false' to make everything free.
    const data: ProData = {
      subscription: subRes.data,
      gating: gatingRes.data ? gatingRes.data.value !== 'false' : true,
    };
    proCache = { userId, at: Date.now(), data };
    return data;
  }).finally(() => {
    if (proInflight?.promise === promise) proInflight = null;
  });
  proInflight = { userId, promise };
  return promise;
}

export function useProFeatures(): ProFeatures {
  const { user } = useAuthStore();
  const cached = user && proCache?.userId === user.id ? proCache.data : null;
  const [subscription, setSubscription] = useState<Subscription | null>(cached?.subscription ?? null);
  const [loading, setLoading] = useState(!cached);
  // Assume gating is on until told otherwise, so Pro-only UI doesn't flash for
  // free users while loading (the old default briefly made everyone Pro).
  const [proGatingEnabled, setProGatingEnabled] = useState(cached?.gating ?? true);

  // If pro gating is disabled globally, every user is treated as Pro
  const isProByAccount = user?.is_pro === true;
  const isPro = !proGatingEnabled || isProByAccount;
  const limits = isPro ? PRO_LIMITS.pro : PRO_LIMITS.free;

  // Studio = the production tool suite. Granted by an 'enterprise' plan, to
  // admins, when gating is off, and to everyone who was Pro before the suite
  // moved to Studio — nobody loses a tool they were already paying for.
  const isStudio = !proGatingEnabled
    || user?.role === 'admin'
    || subscription?.plan === 'enterprise'
    || (isProByAccount && !!user?.pro_since && user.pro_since < STUDIO_TIER_START);

  const fetchSubscription = useCallback(async (force = false) => {
    if (!user) { setLoading(false); return; }
    try {
      const data = await loadProData(user.id, force);
      setSubscription(data.subscription);
      setProGatingEnabled(data.gating);
    } catch (err) {
      console.error('Error fetching subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const activateDevBypass = useCallback(async () => {
    if (!user) return;
    // SECURITY: Only allow dev bypass in development environment
    if (process.env.NODE_ENV !== 'development') {
      console.warn('[useProFeatures] activateDevBypass blocked in production');
      return;
    }
    const supabase = createClient();

    // Create a dev bypass subscription
    const { data: sub } = await supabase.from('subscriptions').insert({
      user_id: user.id,
      plan: 'pro',
      status: 'active',
      billing_cycle: 'yearly',
      price_cents: 0,
      payment_method: 'dev_bypass',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: { dev_bypass: true, activated_at: new Date().toISOString() },
    }).select().single();

    // Upgrade the profile
    await supabase.from('profiles').update({
      is_pro: true,
      pro_since: new Date().toISOString(),
      storage_limit_bytes: PRO_LIMITS.pro.storage_bytes,
    }).eq('id', user.id);

    // Update local state
    useAuthStore.getState().setUser({ ...user, is_pro: true, pro_since: new Date().toISOString() });
    if (sub) setSubscription(sub);
    proCache = null;
  }, [user]);

  const isProForProject = useCallback((project: { pro_enabled?: boolean } | null | undefined) => {
    return isPro || project?.pro_enabled === true;
  }, [isPro]);

  return {
    isPro,
    isStudio,
    subscription,
    loading,
    storageLimit: user?.storage_limit_bytes ?? limits.storage_bytes,
    storageUsed: user?.storage_used_bytes ?? 0,
    maxTeamSize: limits.max_team_size,
    maxProjects: limits.max_projects,
    hasVersionHistory: limits.version_history,
    hasExternalShares: limits.external_shares,
    hasClientReview: limits.client_review,
    hasAnalyticsDashboard: limits.analytics_dashboard,
    hasCustomBranding: limits.custom_branding,
    hasPrioritySupport: limits.priority_support,
    hasApiAccess: limits.api_access,
    hasAdvancedScheduling: limits.advanced_scheduling,
    hasWatermarkedExports: limits.watermarked_exports,
    hasBulkExport: limits.bulk_export,
    hasAdvancedExports: limits.advanced_exports,
    activateDevBypass,
    refreshSubscription: () => fetchSubscription(true),
    isProForProject,
  };
}

// Utility: format storage size
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
