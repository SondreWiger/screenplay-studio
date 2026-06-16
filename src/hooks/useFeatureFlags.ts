'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';

// Feature flag types & hook

export type FeatureTier = 'alpha' | 'beta' | 'released' | 'disabled';
export type InsiderTier = 'alpha' | 'beta' | null;
export type FeatureCategory = 'general' | 'editor' | 'collaboration' | 'production' | 'community' | 'ai' | 'export' | 'integration';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  tier: FeatureTier;
  category: FeatureCategory;
  created_at: string;
  updated_at: string;
}

// Cache feature flags globally so we don't refetch per component
let flagsCache: FeatureFlag[] | null = null;
let flagsCacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Check if a user with a given insider tier can access a feature at a given tier.
 *
 * - 'released' → everyone
 * - 'beta'     → beta + alpha insiders
 * - 'alpha'    → alpha insiders only
 * - 'disabled' → no one (unless Pro subscriber accessing a Pro feature)
 *
 * Pro subscribers (`isPro = true`) automatically have access to any feature
 * whose flag key starts with `pro_`, regardless of the flag's tier.
 * Studio subscribers (`isStudio = true`) get access to all features including `studio_` flags.
 */
export function canAccess(
  featureTier: FeatureTier,
  userTier: InsiderTier,
  isPro = false,
  isStudio = false,
  flagKey = ''
): boolean {
  // The Pro subscription page itself is always accessible (self-serve purchase flow)
  if (flagKey === 'pro_subscription' || flagKey === 'studio_subscription') return true;
  // Pro subscribers get all Pro features regardless of tier
  if (isPro && flagKey.startsWith('pro_')) return true;
  // Studio subscribers get everything
  if (isStudio) return true;
  if (featureTier === 'released') return true;
  if (featureTier === 'disabled') return false;
  if (!userTier) return false;
  if (featureTier === 'beta') return userTier === 'beta' || userTier === 'alpha';
  if (featureTier === 'alpha') return userTier === 'alpha';
  return false;
}

/**
 * Hook that returns all feature flags and helper functions.
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(flagsCache ?? []);
  const [loading, setLoading] = useState(!flagsCache);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const now = Date.now();
    if (flagsCache && now - flagsCacheTime < CACHE_TTL) {
      setFlags(flagsCache);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    Promise.resolve(
      supabase
        .from('feature_flags')
        .select('*')
        .order('category')
        .order('name')
    )
      .then(({ data }) => {
        if (data) {
          flagsCache = data;
          flagsCacheTime = Date.now();
          setFlags(data);
        }
        setLoading(false);
      })
      .catch(() => {
        // Table may not exist yet — treat as empty
        setLoading(false);
      });
  }, []);

  const hasAccess = useCallback(
    (featureKey: string): boolean => {
      const flag = flags.find((f) => f.key === featureKey);
      if (!flag) return true; // unknown flags default to accessible
      return canAccess(flag.tier, user?.insider_tier ?? null, user?.is_pro ?? false, user?.is_studio ?? false, flag.key);
    },
    [flags, user?.insider_tier, user?.is_pro, user?.is_studio]
  );

  const getFlag = useCallback(
    (featureKey: string): FeatureFlag | undefined => flags.find((f) => f.key === featureKey),
    [flags]
  );

  const getTier = useCallback(
    (featureKey: string): FeatureTier => {
      const flag = flags.find((f) => f.key === featureKey);
      return flag?.tier ?? 'released';
    },
    [flags]
  );

  /** Invalidate cache and refetch */
  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from('feature_flags').select('*').order('category').order('name');
    if (data) {
      flagsCache = data;
      flagsCacheTime = Date.now();
      setFlags(data);
    }
  }, []);

  return { flags, loading, hasAccess, getFlag, getTier, refresh, userTier: user?.insider_tier ?? null, isPro: user?.is_pro ?? false, isStudio: user?.is_studio ?? false };
}
