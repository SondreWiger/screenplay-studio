/**
 * sidebarDefaults.ts
 *
 * Smart sidebar defaults — decides which tools go to the "Other Tools"
 * folder based on the user's usage intent and project type.
 *
 * An item in "Other" is still accessible; it's just not cluttering the
 * main sidebar for users who don't need it. Users can always pull items
 * back into the main nav via the sidebar customiser.
 */

import type { UsageIntent } from '@/lib/types';

/**
 * Returns the set of icon names that should land in "Other Tools"
 * by default for a given intent + project type combination.
 *
 * These are AVAILABLE tools (the user has access) that are simply
 * lower priority for their workflow.
 */
// Shared groups for the balanced defaults below
const ON_SET_TOOLS = [
  'continuity', 'dood', 'table-read', 'camera-reports', 'safety-plan',
  'production-overview', 'onset', 'schedule-pack', 'one-liner', 'auto-breakdown',
];
const BUSINESS_TOOLS = ['invoice', 'reports', 'analytics', 'branding', 'presskit', 'docx'];
const NICHE_TOOLS = ['seo', 'sponsors', 'thumbnails', 'quotes', 'compare'];
// Casting and crew management, and the public showcase — useful once there's
// a production, noise while someone is writing their first draft.
const CAST_CREW_TOOLS = ['crew', 'casting', 'actors', 'showcase'];

export function getDefaultOtherIcons(
  intent: UsageIntent | undefined | null,
  projectType?: string | null,
  scriptType?: string | null,
): Set<string> {
  // Content-creator projects (YouTube, TikTok, podcast…)
  const isContentCreator =
    ['youtube', 'tiktok', 'podcast', 'educational', 'livestream'].includes(projectType ?? '') ||
    ['youtube', 'tiktok'].includes(scriptType ?? '');

  const isAudioDrama =
    projectType === 'audio_drama' || scriptType === 'audio_drama';

  const isStagePlay =
    projectType === 'stage_play' || scriptType === 'stageplay';

  const isTvProduction = projectType === 'tv_production';

  // TV / Broadcast and Novel have their own fixed nav — no "Other" logic needed
  if (isTvProduction || projectType === 'novel' || scriptType === 'novel') return new Set();

  switch (intent) {
    // Writer — wants to write, not plan a full production
    case 'writer':
      return new Set([
        // Heavy production tools
        'schedule',
        'budget',
        'breakdown',
        'call-sheet',
        'gear',
        'continuity',
        'dood',
        'table-read',
        'camera-reports',
        'safety-plan',
        'production-overview',
        'onset',
        'schedule-pack',
        'one-liner',
        // Delivery / business
        'invoice',
        'reports',
        'analytics',
        'branding',
        // Collab tools they can enable later
        'crew',
        // Technical / advanced
        'revisions',
        'drafts',
        'coverage',
        'presskit',
        ...CAST_CREW_TOOLS,
      ]);

    // Producer / Filmmaker
    case 'producer':
      return new Set([
        // Pure writing development tools that aren't production-facing
        'arc-planner',
        'beat-sheet',
        'corkboard',
        'mindmap',
        'moodboard',
        // Community/sharing
        'showcase',
        // AI tools
        'ai',
        // Content-creator-specific
        'seo',
        'sponsors',
        'thumbnails',
      ]);

    // Writer & Producer — keep writing and core planning up front; the
    // day-of-shoot paperwork and business tools wait under "Other Tools".
    case 'both':
      return new Set([...ON_SET_TOOLS, ...BUSINESS_TOOLS, ...NICHE_TOOLS]);

    // Content Creator — focus on content pipeline
    case 'content_creator':
      return isContentCreator
        ? new Set([
            // Film/TV production tools irrelevant to creators
            'breakdown',
            'call-sheet',
            'continuity',
            'dood',
            'camera-reports',
            'safety-plan',
            'production-overview',
            'onset',
            'schedule-pack',
            'one-liner',
            'gear',
            // Dev tools
            'arc-planner',
            'beat-sheet',
            'corkboard',
            'treatment',
            'coverage',
            // Collab
            'crew',
            'presskit',
            'invoice',
          ])
        : new Set([
            'seo',
            'sponsors',
            'thumbnails',
          ]);

    // Student — keep it focused on the writing craft
    case 'student':
      return new Set([
        // Full production management is overkill for students
        'budget',
        'breakdown',
        'call-sheet',
        'gear',
        'continuity',
        'dood',
        'table-read',
        'camera-reports',
        'safety-plan',
        'production-overview',
        'onset',
        'schedule-pack',
        // Delivery / business
        'invoice',
        'reports',
        'analytics',
        'branding',
        // Advanced
        'revisions',
        'drafts',
        'coverage',
        'presskit',
        ...CAST_CREW_TOOLS,
      ]);

    // No stated intent: a balanced default. Showing all 50+ tools at once
    // (the old behaviour) buried the ones most people use.
    default:
      return isContentCreator || isAudioDrama || isStagePlay
        ? new Set([...NICHE_TOOLS])
        : new Set([...ON_SET_TOOLS, ...BUSINESS_TOOLS, ...NICHE_TOOLS, ...CAST_CREW_TOOLS]);
  }
}

// localStorage helpers

const LS_KEY = (userId: string, projectId: string) =>
  `ss_sidebar_other_${userId}_${projectId}`;

/**
 * Read user's persisted "Other" icon set.
 * Returns null if no customisation has been saved yet.
 */
export function loadOtherIcons(userId: string, projectId: string): Set<string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_KEY(userId, projectId));
    if (!raw) return null;
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return null;
  }
}

/**
 * Persist the user's "Other" icon set to localStorage.
 */
export function saveOtherIcons(userId: string, projectId: string, icons: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY(userId, projectId), JSON.stringify(Array.from(icons)));
  } catch {
    // Quota or private browsing — silently ignore
  }
}
