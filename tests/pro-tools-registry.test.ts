import { describe, it, expect } from 'vitest';
import { getNavCategories } from '@/lib/navCategories';
import { sidebarIcons } from '@/components/sidebar/SidebarIcons';
import { PAGE_LABELS, getPageLabelKey } from '@/lib/pageLabels';
import { ICON_TO_FLAG } from '@/components/FeatureGate';
import {
  PRO_TOOLS, getProTool, proToolsByGroup, relatedTools, refSourcesFor, REF_SOURCE_ROUTE,
  accentFor, layoutFor, doneStatusFor, GROUP_ACCENT,
  computeStats, toCSV, matchesQuery, nextStatus, statusMeta, formatField,
  type ProToolRecord, type ProTool,
} from '@/lib/pro-tools';

const PROJECT_ID = 'p1';

const NAV_VARIANTS = ['film', 'tv', 'audioDrama', 'stagePlay', 'contentCreator'] as const;

// The Pro Tools category is repeated in each project-type nav — a slug typo in
// any one of them is a 404 only that project type would hit.
function proNavItems(variant: (typeof NAV_VARIANTS)[number] = 'film') {
  const cats = getNavCategories(PROJECT_ID, {
    isTvProduction: variant === 'tv',
    isAudioDrama: variant === 'audioDrama',
    isStagePlay: variant === 'stagePlay',
    isContentCreator: variant === 'contentCreator',
    isEpisodic: false,
    isViewer: false,
  });
  return cats.flatMap((c) => c.items).filter((i) => i.pro);
}

function record(over: Partial<ProToolRecord> = {}): ProToolRecord {
  return {
    id: 'r1', project_id: PROJECT_ID, tool: 'rights', title: 'Needle drop',
    status: 'cleared', data: {}, sort_order: 0, created_by: null,
    created_at: '2026-01-01', updated_at: '2026-01-01', ...over,
  };
}

describe('pro tool registry', () => {
  it('has a unique slug per tool', () => {
    const slugs = PRO_TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(NAV_VARIANTS)('links the hub, not 37 rows, from the %s nav', (variant) => {
    const items = proNavItems(variant);
    if (variant === 'tv') {
      // Broadcast projects have their own fixed nav with no Pro Tools category.
      expect(items).toHaveLength(0);
      return;
    }
    // One entry, so the suite cannot swamp the sidebar.
    expect(items).toHaveLength(1);
    expect(items[0].href).toBe(`/projects/${PROJECT_ID}/pro`);
    expect(items[0].icon).toBe('protools');
  });

  it('has a rendered icon for the hub entry', () => {
    expect(sidebarIcons.protools).toBeTruthy();
  });

  it('reaches every tool from the hub', () => {
    const fromHub = proToolsByGroup().flatMap((g) => g.tools.map((t) => t.slug));
    expect(new Set(fromHub).size).toBe(PRO_TOOLS.length);
  });

  it('only lists related tools that exist, and never itself', () => {
    for (const tool of PRO_TOOLS) {
      for (const slug of tool.related ?? []) {
        expect(getProTool(slug), `${tool.slug} → unknown related "${slug}"`).toBeDefined();
        expect(slug, `${tool.slug} lists itself as related`).not.toBe(tool.slug);
      }
    }
  });

  it('offers somewhere to go from every tool', () => {
    for (const tool of PRO_TOOLS) {
      expect(relatedTools(tool).length, `${tool.slug} has no related tools`).toBeGreaterThan(0);
    }
  });

  it('falls back to same-group siblings when no explicit list is set', () => {
    const tool = PRO_TOOLS.find((t) => !t.related)!;
    for (const r of relatedTools(tool)) {
      expect(r.group).toBe(tool.group);
      expect(r.slug).not.toBe(tool.slug);
    }
  });

  it('honours the explicit related list and the limit', () => {
    const rights = getProTool('rights')!;
    expect(rights.related).toBeDefined();
    expect(relatedTools(rights).map((t) => t.slug)).toEqual(rights.related!.slice(0, 3));
    expect(relatedTools(rights, 2)).toHaveLength(2);
  });

  it('gives every ref field a source, and every source a route', () => {
    for (const tool of PRO_TOOLS) {
      for (const field of tool.fields) {
        if (field.type !== 'ref') continue;
        expect(field.refSource, `${tool.slug}.${field.key} has no refSource`).toBeDefined();
        expect(REF_SOURCE_ROUTE[field.refSource!], `no route for ${field.refSource}`).toBeTruthy();
      }
      // A non-ref field must not carry a stray refSource.
      for (const field of tool.fields) {
        if (field.type !== 'ref') {
          expect(field.refSource, `${tool.slug}.${field.key}`).toBeUndefined();
        }
      }
    }
  });

  it('collects each ref source once per tool', () => {
    const rights = getProTool('rights')!;
    expect(refSourcesFor(rights)).toEqual(['scenes']);
    const talent = getProTool('talent')!;
    expect(refSourcesFor(talent)).toEqual(['characters']);
    // Tools with no links need no lookups fetched.
    expect(refSourcesFor(getProTool('newsletter')!)).toEqual([]);
  });

  it('links day-of-shoot tools to the schedule', () => {
    for (const slug of ['catering', 'extras', 'dailies', 'script-supervising']) {
      const field = getProTool(slug)!.fields.find((f) => f.key === 'shoot_day');
      expect(field?.refSource, slug).toBe('shoot_days');
    }
  });

  it('gives every group its own accent', () => {
    const rules = Object.values(GROUP_ACCENT).map((a) => a.rule);
    expect(new Set(rules).size).toBe(rules.length);
    for (const tool of PRO_TOOLS) {
      expect(accentFor(tool), tool.slug).toBeDefined();
      expect(accentFor(tool).rule, tool.slug).toBeTruthy();
    }
  });

  it('does not put every tool behind the same layout', () => {
    const used = new Set(PRO_TOOLS.map(layoutFor));
    // Five layouts exist; a suite that only used one would be the old problem.
    expect(used.size).toBeGreaterThanOrEqual(4);
    expect(used.has('table')).toBe(true);
  });

  it('only uses layouts that have a view', () => {
    const known = new Set(['table', 'ledger', 'board', 'cards', 'checklist']);
    for (const tool of PRO_TOOLS) {
      expect(known.has(layoutFor(tool)), `${tool.slug} → ${layoutFor(tool)}`).toBe(true);
    }
  });

  it('gives money tools a currency column to total', () => {
    for (const tool of PRO_TOOLS.filter((t) => layoutFor(t) === 'ledger')) {
      const hasMoney = tool.fields.some((f) => f.type === 'currency' && f.column);
      expect(hasMoney, `${tool.slug} uses the ledger but has no currency column`).toBe(true);
    }
  });

  it('gives every checklist tool a real finishing status', () => {
    for (const tool of PRO_TOOLS.filter((t) => layoutFor(t) === 'checklist')) {
      const done = doneStatusFor(tool);
      expect(done, `${tool.slug} has no positive terminal status`).toBeDefined();
      const tone = tool.statuses.find((s) => s.value === done)!.tone;
      expect(['good', 'accent']).toContain(tone);
    }
  });

  it('never treats a failure state as done', () => {
    // Insurance ends on "Expired" and Archival on "Missing" — ticking those off
    // would hide exactly the rows that need attention.
    expect(doneStatusFor(getProTool('compliance')!)).toBe('bound');
    expect(doneStatusFor(getProTool('archival')!)).toBe('verified');
    for (const tool of PRO_TOOLS) {
      const done = doneStatusFor(tool);
      if (!done) continue;
      const tone = tool.statuses.find((s) => s.value === done)!.tone;
      expect(tone, `${tool.slug} → ${done}`).not.toBe('bad');
    }
  });

  it('buckets every tool into a group', () => {
    const total = proToolsByGroup().reduce((n, g) => n + g.tools.length, 0);
    expect(total).toBe(PRO_TOOLS.length);
  });
});

describe('pro tool label resolution', () => {
  it('resolves a pro tool path to the tool slug', () => {
    expect(getPageLabelKey(`/projects/${PROJECT_ID}/pro/rights`, PROJECT_ID)).toBe('rights');
  });

  it('falls back to "pro" for the suite index', () => {
    expect(getPageLabelKey(`/projects/${PROJECT_ID}/pro`, PROJECT_ID)).toBe('pro');
  });

  it('falls back to "pro" for an unknown tool', () => {
    expect(getPageLabelKey(`/projects/${PROJECT_ID}/pro/nope`, PROJECT_ID)).toBe('pro');
  });

  it('leaves non-pro pages alone', () => {
    expect(getPageLabelKey(`/projects/${PROJECT_ID}/script`, PROJECT_ID)).toBe('script');
  });
});

describe('pro tool helpers', () => {
  const tool = getProTool('rights') as ProTool;

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

  it('renders a ref through the resolver and blank without one', () => {
    const rights = getProTool('rights')!;
    const scene = rights.fields.find((f) => f.key === 'scene')!;
    expect(formatField(scene, 'scene-id-1', () => 'Sc 12 — INT. BAR')).toBe('Sc 12 — INT. BAR');
    expect(formatField(scene, 'scene-id-1')).toBe('');
    expect(formatField(scene, '')).toBe('');
  });

  it('searches resolved ref labels, not raw ids', () => {
    const rights = getProTool('rights')!;
    const r = record({ title: 'Poster art', data: { scene: 'abc-123' } });
    const resolve = () => 'INT. WAREHOUSE — NIGHT';
    expect(matchesQuery(rights, r, 'warehouse', resolve)).toBe(true);
    expect(matchesQuery(rights, r, 'warehouse')).toBe(false);
    expect(matchesQuery(rights, r, 'abc-123', resolve)).toBe(false);
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
