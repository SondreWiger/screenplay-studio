'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { PRO_LIMITS, type Subscription, type TeamLicense } from '@/lib/types';

// ============================================================
// useProFeatures — DaVinci Resolve model
// Free is fully functional. Pro features are simply not shown
// to free users (never locked/gated with upgrade prompts).
// ============================================================

interface ProFeatures {
  isPro: boolean;
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

export function useProFeatures(): ProFeatures {
  const { user } = useAuthStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const isPro = user?.is_pro === true;
  const limits = isPro ? PRO_LIMITS.pro : PRO_LIMITS.free;

  const fetchSubscription = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setSubscription(data);
    } catch (err) {
      console.error('Error fetching subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const activateDevBypass = useCallback(async () => {
    if (!user) return;
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
  }, [user]);

  const isProForProject = useCallback((project: { pro_enabled?: boolean } | null | undefined) => {
    return isPro || project?.pro_enabled === true;
  }, [isPro]);

  return {
    isPro,
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
    refreshSubscription: fetchSubscription,
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
