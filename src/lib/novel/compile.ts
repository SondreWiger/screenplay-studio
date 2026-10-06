/**
 * Assemble a manuscript's binder into a book: reading order, chapter numbers,
 * parts, and front/back matter. Every exporter (EPUB, DOCX, PDF, Markdown,
 * plain text) works from the CompiledBook this returns.
 */

import type { NovelChapter, NovelSettings } from '@/lib/types';
import { parseProse, type ProseBlock } from './text';

export type ChapterNumbering = NonNullable<NovelSettings['chapter_numbering']>;

export interface CompiledSection {
  id: string;
  kind: NovelChapter['kind'];
  /** e.g. "Chapter Seven" or "Part Two"; empty for front/back matter. */
  label: string;
  /** The writer's title, if any. */
  title: string;
  blocks: ProseBlock[];
}

export interface CompiledBook {
  title: string;
  author: string;
  sections: CompiledSection[];
  wordCount: number;
}

const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** 1 → "One", 42 → "Forty-Two", 120 → "One Hundred Twenty". */
export function numberToWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numberToWords(n % 100) : '');
  return String(n);
}

export function toRoman(n: number): string {
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

export function formatNumber(n: number, style: ChapterNumbering): string {
  if (style === 'words') return numberToWords(n);
  if (style === 'roman') return toRoman(n);
  if (style === 'numerals') return String(n);
  return '';
}

/**
 * Chapter and part labels in reading order. Chapter numbers run through the
 * whole book (they don't restart per part); front/back matter is unnumbered.
 */
export function numberBinder(items: Pick<NovelChapter, 'id' | 'kind'>[], style: ChapterNumbering): Map<string, string> {
  const labels = new Map<string, string>();
  let chapter = 0;
  let part = 0;
  for (const item of items) {
    if (item.kind === 'chapter') {
      chapter++;
      labels.set(item.id, style === 'none' ? '' : `Chapter ${formatNumber(chapter, style)}`);
    } else if (item.kind === 'part') {
      part++;
      labels.set(item.id, style === 'none' ? '' : `Part ${formatNumber(part, style === 'numerals' ? 'words' : style)}`);
    } else {
      labels.set(item.id, '');
    }
  }
  return labels;
}

export interface CompileOptions {
  numbering: ChapterNumbering;
  includeFrontMatter: boolean;
  includeBackMatter: boolean;
}

export function compileBook(
  chapters: NovelChapter[],
  meta: { title: string; author: string },
  opts: CompileOptions,
): CompiledBook {
  const ordered = [...chapters]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((c) => c.include_in_export)
    .filter((c) => (c.kind !== 'front_matter' || opts.includeFrontMatter) && (c.kind !== 'back_matter' || opts.includeBackMatter));
  const labels = numberBinder(ordered, opts.numbering);
  const sections = ordered.map<CompiledSection>((c) => ({
    id: c.id,
    kind: c.kind,
    label: labels.get(c.id) || '',
    title: c.title?.trim() || '',
    blocks: parseProse(c.content || ''),
  }));
  return {
    title: meta.title,
    author: meta.author,
    sections,
    wordCount: ordered.reduce((n, c) => n + (c.word_count || 0), 0),
  };
}

/** Heading text for a section: "Chapter Three: The Flood", "The Flood", "Chapter Three". */
export function sectionHeading(s: CompiledSection): string {
  if (s.label && s.title) return `${s.label}: ${s.title}`;
  return s.label || s.title || (s.kind === 'chapter' ? 'Untitled chapter' : '');
}

/** Manuscript-format word count: rounded to the nearest 1,000 (100 under 10k). */
export function roundedWordCount(n: number): string {
  const step = n < 10000 ? 100 : 1000;
  const r = Math.max(step, Math.round(n / step) * step);
  return `about ${r.toLocaleString('en-US')} words`;
}
