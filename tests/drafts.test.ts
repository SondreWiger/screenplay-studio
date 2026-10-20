import { describe, it, expect } from 'vitest';
import { summarizeDraftChanges } from '@/lib/scripts/draft-changes';
import {
  normalizeDraftCode,
  draftStampText,
  draftStampMarginCSS,
  draftLookupUrl,
  DRAFT_CODE_ALPHABET,
} from '@/lib/scripts/drafts';
import { diffLines, diffStats, snapshotToLines } from '@/lib/scripts/diff';

describe('normalizeDraftCode', () => {
  it('accepts 5 letters/digits in any case, ignoring spaces and dashes', () => {
    expect(normalizeDraftCode('a7k2q')).toBe('A7K2Q');
    expect(normalizeDraftCode(' A7K-2Q ')).toBe('A7K2Q');
  });

  it('rejects anything that is not 5 characters of A-Z/0-9', () => {
    expect(normalizeDraftCode('A7K2')).toBeNull();
    expect(normalizeDraftCode('A7K2QX')).toBeNull();
    expect(normalizeDraftCode('A7K2!')).toBeNull();
    expect(normalizeDraftCode('')).toBeNull();
  });
});

describe('draft code alphabet', () => {
  it('leaves out characters that are easy to misread on paper', () => {
    for (const c of ['0', 'O', '1', 'I']) expect(DRAFT_CODE_ALPHABET).not.toContain(c);
    expect(DRAFT_CODE_ALPHABET).toHaveLength(32);
  });
});

describe('draft stamp', () => {
  it('reads "Draft CODE · date"', () => {
    expect(draftStampText({ code: 'A7K2Q', printed_at: '2026-10-02T12:00:00Z' })).toBe('Draft A7K2Q · 2 Oct 2026');
  });

  it('puts the stamp in the page margin and strips characters that would break the CSS string', () => {
    const css = draftStampMarginCSS('Draft "X\\');
    expect(css).toContain('@bottom-right');
    expect(css).toContain('content:"Draft X"');
  });
});

describe('snapshot diff', () => {
  const el = (sort_order: number, element_type: string, content: string, is_omitted = false) =>
    ({ sort_order, element_type, content, is_omitted });

  it('orders by sort_order, labels types and skips omitted elements', () => {
    expect(snapshotToLines([
      el(2, 'dialogue', 'Hi.'),
      el(1, 'character', 'ALEX'),
      el(3, 'action', 'gone', true),
    ])).toEqual(['[CHARACTER] ALEX', '[DIALOGUE] Hi.']);
  });

  it('counts added and removed lines between a printed draft and now', () => {
    const printed = ['[ACTION] A', '[ACTION] B', '[ACTION] C'];
    const now = ['[ACTION] A', '[ACTION] B2', '[ACTION] C', '[ACTION] D'];
    expect(diffStats(diffLines(printed, now))).toEqual({ added: 2, removed: 1 });
    expect(diffStats(diffLines(printed, printed))).toEqual({ added: 0, removed: 0 });
  });
});

describe('summarizeDraftChanges', () => {
  const el = (id: string, element_type: string, content: string, sort_order: number) => ({
    id, element_type, content, sort_order, scene_number: null, is_omitted: false,
  });
  const then = [
    el('h1', 'scene_heading', 'INT. KITCHEN - DAY', 1),
    el('a1', 'action', 'Anna makes coffee.', 2),
    el('h2', 'scene_heading', 'EXT. STREET - NIGHT', 3),
    el('a2', 'action', 'Rain.', 4),
    el('h3', 'scene_heading', 'INT. CAR - NIGHT', 5),
    el('a3', 'action', 'Silence.', 6),
  ];

  it('reports changed, cut and new scenes from the printed copy', () => {
    const now = [
      el('h1', 'scene_heading', 'INT. KITCHEN - DAY', 1),
      el('a1', 'action', 'Anna makes tea.', 2),
      el('h3', 'scene_heading', 'INT. CAR - NIGHT', 5),
      el('a3', 'action', 'Silence.', 6),
      el('h4', 'scene_heading', 'INT. SECRET LAB - DAY', 7),
    ];
    const c = summarizeDraftChanges(then, now, { includeNewHeadings: false });
    expect(c.changed.map((s) => s.heading)).toEqual(['INT. KITCHEN - DAY']);
    expect(c.removed.map((s) => s.number)).toEqual(['2']);
    expect(c.added_count).toBe(1);
    expect(c.added).toEqual([]); // new text stays private for non-members
    expect(c.scenes_then).toBe(3);
    expect(c.scenes_now).toBe(3);
    expect(summarizeDraftChanges(then, now, { includeNewHeadings: true }).added[0].heading).toBe('INT. SECRET LAB - DAY');
  });

  it('notices reordered scenes without calling them changed', () => {
    const now = [then[4], then[5], then[0], then[1], then[2], then[3]].map((e, i) => ({ ...e, sort_order: i }));
    const c = summarizeDraftChanges(then, now, { includeNewHeadings: false });
    expect(c.changed).toEqual([]);
    expect(c.moved_count).toBe(1);
  });
});

describe('draftLookupUrl', () => {
  it('never points the QR at a local dev address', () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
    try {
      const url = draftLookupUrl({ code: 'A7K2Q', qr_token: 'abc123' });
      expect(url).toMatch(/^https:\/\/screenplaystudio\.fun\/lookup\?code=A7K2Q&k=abc123$/);
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });
});
