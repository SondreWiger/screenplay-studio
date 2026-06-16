import { describe, it, expect } from 'vitest';
import { estimateLines, paginateScript, PAGE_CONFIGS, ORPHAN_TYPES } from '@/lib/screenplay-paginator';
import type { ScriptElement } from '@/lib/types';

function makeElement(overrides: Partial<ScriptElement> & { id: string; element_type: ScriptElement['element_type'] }): ScriptElement {
  return {
    content: '',
    sort_order: 0,
    scene_number: null,
    revision_color: 'white',
    is_revised: false,
    is_omitted: false,
    scene_status: null,
    metadata: {},
    created_by: null,
    last_edited_by: null,
    script_id: 's1',
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('estimateLines', () => {
  const cfg = PAGE_CONFIGS.letter;

  it('estimates scene_heading lines (content + 2 overhead)', () => {
    const el = makeElement({ id: '1', element_type: 'scene_heading', content: 'INT. OFFICE - DAY' });
    const lines = estimateLines(el, cfg);
    expect(lines).toBeGreaterThanOrEqual(3);
  });

  it('estimates action lines (content + 1 overhead)', () => {
    const el = makeElement({ id: '1', element_type: 'action', content: 'A man walks into a bar and orders a drink.' });
    const lines = estimateLines(el, cfg);
    expect(lines).toBeGreaterThanOrEqual(2);
  });

  it('estimates character lines', () => {
    const el = makeElement({ id: '1', element_type: 'character', content: 'JOHN' });
    const lines = estimateLines(el, cfg);
    expect(lines).toBeGreaterThanOrEqual(2);
  });

  it('estimates parenthetical lines', () => {
    const el = makeElement({ id: '1', element_type: 'parenthetical', content: '(whispering)' });
    const lines = estimateLines(el, cfg);
    expect(lines).toBeGreaterThanOrEqual(1);
  });

  it('estimates dialogue lines', () => {
    const el = makeElement({ id: '1', element_type: 'dialogue', content: 'Hello there, how are you today?' });
    const lines = estimateLines(el, cfg);
    expect(lines).toBeGreaterThanOrEqual(1);
  });

  it('estimates transition lines (content + 2 overhead)', () => {
    const el = makeElement({ id: '1', element_type: 'transition', content: 'CUT TO:' });
    const lines = estimateLines(el, cfg);
    expect(lines).toBeGreaterThanOrEqual(3);
  });

  it('strips HTML before estimating', () => {
    const el = makeElement({ id: '1', element_type: 'action', content: '<b>bold text</b>' });
    const lines = estimateLines(el, cfg);
    expect(lines).toBeGreaterThanOrEqual(1);
  });
});

describe('paginateScript', () => {
  it('returns a single page for short content', () => {
    const elements = [
      makeElement({ id: '1', element_type: 'scene_heading', content: 'INT. ROOM', sort_order: 0 }),
      makeElement({ id: '2', element_type: 'action', content: 'A man enters.', sort_order: 1 }),
    ];
    const result = paginateScript(elements, 'letter');
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageNum).toBe(1);
    expect(result.pages[0].elements).toHaveLength(2);
  });

  it('assigns page numbers correctly', () => {
    const result = paginateScript([], 'letter');
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageNum).toBe(1);
  });

  it('builds elementPageMap', () => {
    const elements = [
      makeElement({ id: '1', element_type: 'scene_heading', content: 'INT. ROOM', sort_order: 0 }),
      makeElement({ id: '2', element_type: 'action', content: 'Something.', sort_order: 1 }),
    ];
    const result = paginateScript(elements, 'letter');
    expect(result.elementPageMap['1']).toBe(1);
    expect(result.elementPageMap['2']).toBe(1);
  });

  it('handles omitted elements without counting lines', () => {
    const elements = [
      makeElement({ id: '1', element_type: 'action', content: 'A'.repeat(600), sort_order: 0, is_omitted: true }),
      makeElement({ id: '2', element_type: 'action', content: 'B'.repeat(600), sort_order: 1, is_omitted: true }),
    ];
    const result = paginateScript(elements, 'letter');
    expect(result.pages).toHaveLength(1);
  });

  it('handles empty elements', () => {
    const result = paginateScript([], 'letter');
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].elements).toEqual([]);
  });

  it('uses A4 config when specified', () => {
    const elements = Array.from({ length: 60 }, (_, i) =>
      makeElement({ id: `${i}`, element_type: 'action', content: `Line ${i}`, sort_order: i })
    );
    const result = paginateScript(elements, 'a4');
    expect(result.pages.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ORPHAN_TYPES', () => {
  it('contains scene_heading, character, parenthetical', () => {
    expect(ORPHAN_TYPES.has('scene_heading')).toBe(true);
    expect(ORPHAN_TYPES.has('character')).toBe(true);
    expect(ORPHAN_TYPES.has('parenthetical')).toBe(true);
  });

  it('does not contain dialogue or action', () => {
    expect(ORPHAN_TYPES.has('dialogue')).toBe(false);
    expect(ORPHAN_TYPES.has('action')).toBe(false);
  });
});

describe('PAGE_CONFIGS', () => {
  it('has letter and a4 configs', () => {
    expect(PAGE_CONFIGS.letter).toBeDefined();
    expect(PAGE_CONFIGS.a4).toBeDefined();
  });

  it('letter has correct dimensions', () => {
    expect(PAGE_CONFIGS.letter.width).toBe('8.5in');
    expect(PAGE_CONFIGS.letter.height).toBe('11in');
  });

  it('a4 has correct dimensions', () => {
    expect(PAGE_CONFIGS.a4.width).toBe('210mm');
    expect(PAGE_CONFIGS.a4.height).toBe('297mm');
  });
});
