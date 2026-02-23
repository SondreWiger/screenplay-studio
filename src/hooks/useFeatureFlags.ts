'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';

// ============================================================
// Feature flag types & hook
// ============================================================

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
 * - 'disabled' → no one
 */
export function canAccess(featureTier: FeatureTier, userTier: InsiderTier): boolean {
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
      return canAccess(flag.tier, user?.insider_tier ?? null);
    },
    [flags, user?.insider_tier]
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

  return { flags, loading, hasAccess, getFlag, getTier, refresh, userTier: user?.insider_tier ?? null };
}
