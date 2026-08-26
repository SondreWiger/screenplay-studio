import { describe, it, expect } from 'vitest';
import { getNavCategories } from '@/lib/navCategories';
import { sidebarIcons } from '@/components/sidebar/SidebarIcons';
import { PAGE_LABELS, getPageLabelKey } from '@/lib/pageLabels';
import { ICON_TO_FLAG } from '@/components/FeatureGate';
import {
  STUDIO_TOOLS, getStudioTool, studioToolsByGroup,
  computeStats, toCSV, matchesQuery, nextStatus, statusMeta, formatField,
  type StudioRecord, type StudioTool,
} from '@/lib/studio';

const PROJECT_ID = 'p1';

const NAV_VARIANTS = ['film', 'tv', 'audioDrama', 'stagePlay', 'contentCreator'] as const;

// The Studio category is repeated in each project-type nav — a slug typo in
// any one of them is a 404 only that project type would hit.
function studioNavItems(variant: (typeof NAV_VARIANTS)[number] = 'film') {
  const cats = getNavCategories(PROJECT_ID, {
    isTvProduction: variant === 'tv',
    isAudioDrama: variant === 'audioDrama',
    isStagePlay: variant === 'stagePlay',
    isContentCreator: variant === 'contentCreator',
    isEpisodic: false,
    isViewer: false,
  });
  return cats.flatMap((c) => c.items).filter((i) => i.studio);
}

function record(over: Partial<StudioRecord> = {}): StudioRecord {
  return {
    id: 'r1', project_id: PROJECT_ID, tool: 'rights', title: 'Needle drop',
    status: 'cleared', data: {}, sort_order: 0, created_by: null,
    created_at: '2026-01-01', updated_at: '2026-01-01', ...over,
  };
}

describe('studio registry', () => {
  it('has a unique slug per tool', () => {
    const slugs = STUDIO_TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(NAV_VARIANTS)('backs every Studio nav item with a tool definition (%s nav)', (variant) => {
    const items = studioNavItems(variant);
    if (variant === 'tv') {
      // Broadcast projects have their own fixed nav with no Studio category.
      expect(items).toHaveLength(0);
      return;
    }
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const slug = item.href.split('/studio/')[1];
      expect(getStudioTool(slug), `no tool for /studio/${slug}`).toBeDefined();
    }
  });

  it.each(NAV_VARIANTS)('uses the same icon as the nav item that links to it (%s nav)', (variant) => {
    for (const item of studioNavItems(variant)) {
      const tool = getStudioTool(item.href.split('/studio/')[1])!;
      expect(tool.icon).toBe(item.icon);
    }
  });

  it('exposes every registered tool in the nav', () => {
    const linked = new Set(studioNavItems().map((i) => i.href.split('/studio/')[1]));
    for (const tool of STUDIO_TOOLS) {
      expect(linked.has(tool.slug), `${tool.slug} is not linked from the sidebar`).toBe(true);
    }
  });

  it('has a rendered icon for every tool', () => {
    for (const tool of STUDIO_TOOLS) {
      expect(sidebarIcons[tool.icon], `missing icon "${tool.icon}"`).toBeTruthy();
    }
  });

  it('has a feature flag matching the FeatureGate map', () => {
    for (const tool of STUDIO_TOOLS) {
      expect(ICON_TO_FLAG[tool.icon], `no flag mapped for icon "${tool.icon}"`).toBe(tool.flag);
    }
  });

  it('has a page label for every tool slug', () => {
    for (const tool of STUDIO_TOOLS) {
      expect(PAGE_LABELS[tool.slug], `missing label for "${tool.slug}"`).toBeTruthy();
    }
  });

  it('defines statuses, fields and stats for every tool', () => {
    for (const tool of STUDIO_TOOLS) {
      expect(tool.statuses.length, tool.slug).toBeGreaterThan(0);
      expect(tool.fields.length, tool.slug).toBeGreaterThan(0);
      expect(tool.stats.length, tool.slug).toBeGreaterThan(0);
      expect(tool.fields.some((f) => f.column), `${tool.slug} has no columns`).toBe(true);
    }
  });

  it('only references its own fields from stats and groupBy', () => {
    for (const tool of STUDIO_TOOLS) {
      const keys = new Set(tool.fields.map((f) => f.key));
      for (const stat of tool.stats) {
        if (stat.field) expect(keys.has(stat.field), `${tool.slug}: ${stat.field}`).toBe(true);
        if (stat.status) {
          expect(tool.statuses.some((s) => s.value === stat.status), `${tool.slug}: ${stat.status}`).toBe(true);
        }
      }
      if (tool.groupBy) expect(keys.has(tool.groupBy), `${tool.slug}: ${tool.groupBy}`).toBe(true);
    }
  });

  it('buckets every tool into a group', () => {
    const total = studioToolsByGroup().reduce((n, g) => n + g.tools.length, 0);
    expect(total).toBe(STUDIO_TOOLS.length);
  });
});

describe('studio label resolution', () => {
  it('resolves a studio tool path to the tool slug', () => {
    expect(getPageLabelKey(`/projects/${PROJECT_ID}/studio/rights`, PROJECT_ID)).toBe('rights');
  });

  it('falls back to "studio" for the suite index', () => {
    expect(getPageLabelKey(`/projects/${PROJECT_ID}/studio`, PROJECT_ID)).toBe('studio');
  });

  it('falls back to "studio" for an unknown tool', () => {
    expect(getPageLabelKey(`/projects/${PROJECT_ID}/studio/nope`, PROJECT_ID)).toBe('studio');
  });

  it('leaves non-studio pages alone', () => {
    expect(getPageLabelKey(`/projects/${PROJECT_ID}/script`, PROJECT_ID)).toBe('script');
  });
});

describe('studio helpers', () => {
  const tool = getStudioTool('rights') as StudioTool;

  it('sums, counts and buckets records into stats', () => {
    const stats = computeStats(tool, [
      record({ id: '1', status: 'cleared', data: { fee: 500, rights_type: 'Music' } }),
      record({ id: '2', status: 'requested', data: { fee: 250, rights_type: 'Footage' } }),
    ]);
    expect(stats.find((s) => s.label === 'Items')?.value).toBe('2');
    expect(stats.find((s) => s.label === 'Cleared')?.value).toBe('1');
    expect(stats.find((s) => s.label === 'Clearance cost')?.value).toBe('$750');
  });

  it('cycles status and wraps at the end', () => {
    const last = tool.statuses[tool.statuses.length - 1].value;
    expect(nextStatus(tool, tool.statuses[0].value)).toBe(tool.statuses[1].value);
    expect(nextStatus(tool, last)).toBe(tool.statuses[0].value);
  });

  it('falls back to a neutral badge for an unknown status', () => {
    expect(statusMeta(tool, 'bogus').tone).toBe('neutral');
  });

  it('matches on the title and on field values', () => {
    const r = record({ data: { rights_holder: 'Sony Music' } });
    expect(matchesQuery(tool, r, 'needle')).toBe(true);
    expect(matchesQuery(tool, r, 'sony')).toBe(true);
    expect(matchesQuery(tool, r, 'unrelated')).toBe(false);
    expect(matchesQuery(tool, r, '  ')).toBe(true);
  });

  it('formats field values by type', () => {
    const fee = tool.fields.find((f) => f.key === 'fee')!;
    expect(formatField(fee, 1200)).toBe('$1,200');
    expect(formatField(fee, '')).toBe('');
  });

  it('exports CSV with a header row and quotes separators', () => {
    const csv = toCSV(tool, [record({ title: 'Track, with comma', data: { fee: 100 } })]);
    const [header, row] = csv.split('\n');
    expect(header.startsWith('Item,Status,')).toBe(true);
    expect(row).toContain('"Track, with comma"');
    expect(row).toContain('$100');
  });
});
