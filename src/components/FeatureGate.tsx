'use client';

import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// ============================================================
// FeatureGate — Conditionally renders children based on
// whether the current user has access to a feature flag.
//
// Usage:
//   <FeatureGate feature="storyboard">
//     <StoryboardPanel />
//   </FeatureGate>
//
//   <FeatureGate feature="community" fallback={<LockedBanner />}>
//     <CommunityFeed />
//   </FeatureGate>
// ============================================================

/**
 * Maps sidebar icon keys (used in the project layout nav) to feature flag keys
 * stored in the feature_flags table. Only entries that differ from the icon key
 * are listed; if an icon key isn't in this map it's used as-is.
 */
export const ICON_TO_FLAG: Record<string, string> = {
  // Sidebar icon key  →  feature_flags.key
  shots: 'broll_manager',     // "B-Roll" uses icon key "shots"
  seo: 'seo_toolkit',         // "SEO & Metadata" uses icon key "seo"
  chat: 'real_time_collab',
  comments: 'real_time_collab',
  team: 'real_time_collab',
  share: 'pro_share_portal',
  versions: 'pro_version_history',
  budget: 'budget',
  schedule: 'schedule',
  storyboard: 'storyboard',
  moodboard: 'moodboard',
  mindmap: 'mindmap',
  documents: 'documents',
  script: 'script_editor',
  episodes: 'script_editor',  // Episodes page is part of the script editor feature
  'arc-planner': 'script_editor',  // Arc planner is part of the episodic writing workflow
  // Pro tools
  analytics: 'pro_analytics',
  export: 'pro_export',
  ai: 'pro_ai_analysis',
  review: 'pro_client_review',
  branding: 'pro_branding',
  revisions: 'pro_revisions',
  reports: 'pro_reports',
  casting: 'pro_casting',
};

/** Resolve an icon key (or direct flag key) to the canonical feature_flags.key */
export function resolveFlag(iconOrFlag: string): string {
  return ICON_TO_FLAG[iconOrFlag] ?? iconOrFlag;
}

type FeatureGateProps = {
  /** The feature flag key (or sidebar icon key — it's auto-resolved) */
  feature: string;
  /** Optional fallback when the feature is not accessible */
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export function FeatureGate({ feature, fallback = null, children }: FeatureGateProps) {
  const { hasAccess, loading } = useFeatureFlags();
  const flagKey = resolveFlag(feature);

  // While loading, render children to avoid layout flash
  if (loading) return <>{children}</>;

  if (!hasAccess(flagKey)) return <>{fallback}</>;

  return <>{children}</>;
}

/**
 * Imperative check — useful inside callbacks, array filters, etc.
 * Returns a function that checks whether a feature (by icon key or flag key) is accessible.
 */
export function useFeatureAccess() {
  const { hasAccess, loading, flags } = useFeatureFlags();

  const canUse = (iconOrFlag: string): boolean => {
    if (loading) return true; // optimistic while loading
    return hasAccess(resolveFlag(iconOrFlag));
  };

  return { canUse, loading, flags };
}
