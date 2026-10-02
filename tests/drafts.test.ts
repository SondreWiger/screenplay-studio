import { describe, it, expect } from 'vitest';
import {
  normalizeDraftCode,
  draftStampText,
  draftStampMarginCSS,
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
