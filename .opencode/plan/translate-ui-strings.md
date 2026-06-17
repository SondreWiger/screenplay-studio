# Plan: Wrap hardcoded UI strings with translation calls

## Overview

Wrap visible sidebar and navigation strings with `t()` calls using the `useTranslation` hook from `@/components/TranslationProvider`.

## Architecture

- Sidebar labels are **data** in `src/lib/navCategories.ts` (a pure function, not React)
- Labels are **rendered** in `src/app/projects/[id]/layout.tsx` via `{item.label}` and `{cat.category}`
- Navigation links are hardcoded in `AppHeader.tsx` and `CommandPalette.tsx`
- Translation approach: translate at the render site using a helper that maps known strings to `t()` keys

## Files to Edit

### 1. `src/app/projects/[id]/layout.tsx` (sidebar)

**Add imports/hooks:**
- Add `import { useTranslation } from '@/components/TranslationProvider';`
- Add `const { t } = useTranslation();` in the `ProjectLayout` component (after existing hooks, ~line 157)

**Add translation helper** (before `sidebarContent`, ~line 441):
```ts
const sidebarT = (label: string) => {
  const key = sidebarLabelMap[label];
  return key ? t(key) : label;
};
```

**Translation map** (same location):
```ts
const sidebarLabelMap: Record<string, string> = {
  'Overview': 'sidebar.overview',
  'Script': 'sidebar.script',
  'Episodes': 'sidebar.episodes',
  'Arc Planner': 'sidebar.arc_planner',
  'Beat Sheet': 'sidebar.beat_sheet',
  'Notes Rounds': 'sidebar.notes_rounds',
  'Ideas': 'sidebar.ideas',
  'Documents': 'sidebar.documents',
  'Characters': 'sidebar.characters',
  'Locations': 'sidebar.locations',
  'Scenes': 'sidebar.scenes',
  'Schedule': 'sidebar.schedule',
  'Budget': 'sidebar.budget',
  'Breakdown': 'sidebar.breakdown',
  'Call Sheet': 'sidebar.call_sheet',
  'War Room': 'sidebar.war_room',
  'On Set': 'sidebar.on_set',
  'Day Pack': 'sidebar.day_pack',
  'Continuity': 'sidebar.continuity',
  'Table Read': 'sidebar.table_read',
  'Camera Reports': 'sidebar.camera_reports',
  'Corkboard': 'sidebar.corkboard',
  'Shot List': 'sidebar.shot_list',
  'Mood Board': 'sidebar.mood_board',
  'Storyboard': 'sidebar.storyboard',
  'Mind Map': 'sidebar.mind_map',
  'Crew View': 'sidebar.crew_view',
  'Gear': 'sidebar.gear',
  'Chat': 'sidebar.chat',
  'Comments': 'sidebar.comments',
  'Team': 'sidebar.team',
  'Casting': 'sidebar.casting',
  'Export': 'sidebar.export',
  'Share': 'sidebar.share',
  'Submissions': 'sidebar.submissions',
  'Press Kit': 'sidebar.press_kit',
  'Custom Branding': 'sidebar.branding',
  'Analytics': 'sidebar.analytics',
  'Reports': 'sidebar.reports',
  'Treatment': 'sidebar.treatment',
  'Script Coverage': 'sidebar.coverage',
  'Script Analysis': 'sidebar.analysis',
  'Revisions': 'sidebar.revisions',
  'Showcase': 'sidebar.showcase',
  'Settings': 'sidebar.settings',
  // Category labels
  'Write': 'sidebar.write',
  'Plan': 'sidebar.plan',
  'Creative': 'sidebar.creative',
  'Finish': 'sidebar.finish',
  'Studio': 'sidebar.studio',
};
```

Note: 'Team' appears as both an item label and a category label. The item label maps to `sidebar.team`, the category label should map to `sidebar.team_cat`. Since 'On Set' also appears as both, item → `sidebar.on_set`, category → `sidebar.on_set_cat`. I'll handle this by checking if the label is rendered as `cat.category` (use `_cat` suffix) vs `item.label`.

**Render site changes:**
- Line 521: `{cat.category}` → `{cat.category === 'On Set' ? t('sidebar.on_set_cat') : cat.category === 'Team' ? t('sidebar.team_cat') : sidebarT(cat.category)}`
- Line 555: `<span>{item.label}</span>` → `<span>{sidebarT(item.label)}</span>`
- Line 597: `<span>{item.label}</span>` → `<span>{sidebarT(item.label)}</span>`
- Line 645: `<span>{item.label}</span>` → `<span>{sidebarT(item.label)}</span>`

### 2. `src/components/AppHeader.tsx`

**Add imports/hooks:**
- Add `import { useTranslation } from '@/components/TranslationProvider';`
- Add `const { t } = useTranslation();` at top of `AppHeader` function

**Changes:**
- Line 57: `{ href: '/dashboard', label: 'Dashboard' }` → `{ href: '/dashboard', label: t('nav.dashboard') }`
- Line 58: `label: 'Ideas'` → `label: t('nav.ideas')`
- Line 59: `label: 'Quotes'` → `label: t('nav.quotes')`
- Line 60: `label: 'Blog'` → `label: t('nav.blog')`
- Line 61: `label: 'Community'` → `label: t('nav.community')`
- Line 189: `{ href: '/settings', label: 'Settings', ...}` → `label: t('nav.settings')`
- Line 192: `label: 'Company'` → `label: t('nav.company')`
- Line 230: `Sign out` → `{t('nav.sign_out')}`

### 3. `src/components/ui/CommandPalette.tsx`

**Add imports/hooks:**
- Add `import { useTranslation } from '@/components/TranslationProvider';`
- Add `const { t } = useTranslation();` in `CommandPaletteModal` component

**Changes:**
- Line 395: `label: 'Dashboard'` → `label: t('nav.dashboard')`
- Line 398: `label: 'Community'` → `label: t('nav.community')`
- Line 399: `label: 'Settings'` → `label: t('nav.settings')`

## String Count

- **Layout (sidebar)**: ~45 unique item labels + 5 category labels = ~50 wrapped strings
- **AppHeader**: 7 strings wrapped
- **CommandPalette**: 3 strings wrapped
- **Total**: ~60 strings wrapped

## Verification

After editing, run `npm run lint` and `npm run typecheck` to verify correctness.
