/**
 * Import an existing manuscript into binder items.
 *
 * This file holds the shared pieces — the section model, heading detection
 * and title clean-up — plus the plain text / Markdown importer. Format
 * readers live beside it: import-pdf.ts, import-docx.ts, import-epub.ts.
 *
 * Chapters are split on headings: Markdown `#`/`##`, or lines like
 * "Chapter 3", "CHAPTER THREE: The Flood", "Prologue", "Part Two", in
 * English and the common European languages.
 */

import type { NovelItemKind } from '@/lib/types';
import { escapeXml, runsToHtml, type ProseRun } from './text';

export interface ImportedSection {
  kind: NovelItemKind;
  title: string;
  /** Manuscript HTML (see lib/novel/text.ts). */
  content: string;
}

/** A section offered in the import preview, which the writer can untick. */
export interface ImportCandidate extends ImportedSection {
  include: boolean;
  /** Why it's unticked or how it was found, shown in the preview. */
  note?: string;
}

export interface ImportResult {
  format: 'pdf' | 'docx' | 'epub' | 'html' | 'text';
  title?: string;
  author?: string;
  sections: ImportCandidate[];
  warnings: string[];
}

const CHAPTER_WORDS = 'chapter|ch\\.|kapittel|kapitel|kapitlet|chapitre|cap[ií]tulo|capitolo|hoofdstuk|luku|rozdzia[łl]';
const PART_WORDS = 'part|book|del|delen|bok|boken|teil|buch|partie|livre|parte|libro|deel|osa';
const NUMBER = '(?:\\d{1,3}|[ivxlc]{1,7}|[\\p{L}]{2,12}(?:[- ][\\p{L}]{2,8})?)';
const CHAPTER_RE = new RegExp(`^(?:${CHAPTER_WORDS})\\s+${NUMBER}(?=$|[\\s:.\\-—–])\\s*[:.\\-—–]?\\s*(.*)$`, 'iu');
const PART_RE = new RegExp(`^(?:${PART_WORDS})\\s+${NUMBER}(?=$|[\\s:.\\-—–·•])\\s*[:.\\-—–·•]?\\s*(.*)$`, 'iu');
const FRONT = /^(prologue|prolog|pr[óo]logo|foreword|forord|f[öo]rord|vorwort|pr[ée]face|preface|dedication|dedikasjon|epigraph|introduction|innledning|inledning|einleitung|introducci[óo]n)\b\s*[:.\-—–]?\s*(.*)$/i;
const BACK = /^(epilogue|epilog|ep[íi]logo|afterword|etterord|efterord|nachwort|postface|acknowledg(?:e)?ments|takk|takksigelser|tack|danksagung|remerciements|agradecimientos|about the author|om forfatteren|om f[öo]rfattaren|author'?s note|forfatterens (?:merknad|etterord)|glossary|ordliste|appendix|vedlegg|anhang|notes|noter)\b\s*[:.\-—–]?\s*(.*)$/i;
export const SCENE_BREAK = /^\s*(?:\*\s*\*\s*\*|#{1}|~+|-{3,}|_{3,}|⁂|•\s*•\s*•|\*{3,}|◆|◇|❧|§)\s*$/;
const NUMBER_ONLY = /^(?:\d{1,3}|[IVXLC]{1,7})\.?$/;
const NUMBER_WORDS = /^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[- ]\w+)?|thirty(?:[- ]\w+)?|en|ett|to|tre|fire|fem|seks|sju|syv|åtte|ni|ti|elleve|tolv|eins|zwei|drei|vier|fünf|un|deux|trois|uno|dos|tres)$/i;

/** Inline Markdown (bold, italics, strikethrough) to manuscript HTML. */
function inline(text: string): string {
  return escapeXml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^\s*](?:[^*]*?[^\s*])?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^\s_](?:[^_]*?[^\s_])?)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>');
}

/** Is this line a chapter/part/front/back heading? Used for text without heading styles. */
export function classifyHeading(line: string): { kind: NovelItemKind; title: string } | null {
  const md = line.match(/^(#{1,3})\s+(.+?)\s*#*$/);
  const text = md ? md[2].trim() : line.trim();
  if (!md && (text.length > 80 || /[.!?,;]$/.test(text) && !CHAPTER_RE.test(text))) return null;
  let m: RegExpMatchArray | null;
  if ((m = text.match(PART_RE))) return { kind: 'part', title: m[1].trim() };
  if ((m = text.match(CHAPTER_RE))) return { kind: 'chapter', title: m[1].trim() };
  if ((m = text.match(FRONT))) return { kind: 'front_matter', title: cap(m[1]) + (m[2] ? `: ${m[2]}` : '') };
  if ((m = text.match(BACK))) return { kind: 'back_matter', title: cap(m[1]) + (m[2] ? `: ${m[2]}` : '') };
  if (md) return { kind: md[1] === '#' && /^part\b/i.test(text) ? 'part' : 'chapter', title: text };
  return null;
}

/**
 * Make sense of a heading block — the display lines at the top of a chapter,
 * largest first in reading order: ["1", "I DAG, KOMPIS"], ["Prolog", "PIP"],
 * ["DEL ÉN", "TORSDAG"], ["Chapter Seven: The Flood"].
 */
export function interpretHeading(lines: string[]): { kind: NovelItemKind; title: string } {
  const [first = '', second = ''] = lines.map((l) => l.trim());
  let m: RegExpMatchArray | null;
  if (NUMBER_ONLY.test(first) || NUMBER_WORDS.test(first)) return { kind: 'chapter', title: second };
  if ((m = first.match(PART_RE))) return { kind: 'part', title: m[1].trim() || second };
  if ((m = first.match(CHAPTER_RE))) return { kind: 'chapter', title: m[1].trim() || second };
  if ((m = first.match(FRONT))) return { kind: 'front_matter', title: [cap(m[1]), m[2] || second].filter(Boolean).join(': ') };
  if ((m = first.match(BACK))) return { kind: 'back_matter', title: [cap(m[1]), m[2] || second].filter(Boolean).join(': ') };
  return { kind: 'chapter', title: first };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const SINGLE_LETTERS = new RegExp('^\\p{L} \\p{L}$', 'u');
const NOT_ALNUM = new RegExp('[^\\p{L}\\p{N}]', 'gu');
const TWO_CAPS = new RegExp('\\p{Lu}{2}', 'u');
const letters = (s: string) => s.toLocaleUpperCase().replace(NOT_ALNUM, '');

/**
 * Titles set in capitals ("I DAG, KOMPIS") get their real casing from the
 * book's table of contents when it has one, otherwise sentence case.
 */
export function tidyTitle(title: string, toc: string[] = []): string {
  const t = title.replace(/\s+/g, ' ').trim();
  if (!t || t !== t.toLocaleUpperCase() || !TWO_CAPS.test(t)) return t;
  // Find the title inside a contents line ("12 Nittini kroner ..... 68").
  const want = letters(t);
  for (const entry of toc) {
    if (!letters(entry).includes(want)) continue;
    for (let i = 0; i < entry.length; i++) {
      for (let j = i + 1; j <= entry.length; j++) {
        const got = letters(entry.slice(i, j));
        if (got.length > want.length) break;
        if (got === want) {
          const found = entry.slice(i, j).trim();
          if (found && found !== found.toLocaleUpperCase()) return found;
        }
      }
    }
  }
  const lower = t.toLocaleLowerCase();
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}

/** Is this the heading of a table of contents page? */
export function isContentsHeading(text: string): boolean {
  return /^(contents|table of contents|innhold|innholdsfortegnelse|innehåll|indhold|inhalt|inhaltsverzeichnis|sommaire|table des matières|[íi]ndice|contenido|inhoud|sisällys)$/i
    .test(text.replace(/\s+/g, ' ').trim());
}

/** Collapse letter-spaced text: "D E L" → "DEL". Leaves normal text alone. */
export function collapseLetterSpacing(s: string): string {
  if (!/^(?:\S ){1,}\S$/.test(s)) return s;
  // Two tokens only when both are letters ("É N"), so ". T" between sentences stays.
  if (s.length === 3 && !SINGLE_LETTERS.test(s)) return s;
  return s.replace(/ /g, '').replace(/([,;])(?=\S)/g, '$1 ');
}

/**
 * Split text into sections. Paragraphs are separated by blank lines; when a
 * file has no blank lines at all, every line is a paragraph.
 */
export function importManuscript(raw: string): ImportedSection[] {
  const text = raw.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const lines = text.split('\n');
  const blankSeparated = /\n\s*\n/.test(text);

  const sections: ImportedSection[] = [];
  let current: ImportedSection | null = null;
  let para: string[] = [];

  const flushPara = () => {
    const joined = para.join(' ').replace(/\s+/g, ' ').trim();
    para = [];
    if (!joined) return;
    if (!current) { current = { kind: 'chapter', title: '', content: '' }; sections.push(current); }
    current.content += joined.startsWith('&gt; ') || joined.startsWith('> ')
      ? `<blockquote>${inline(joined.replace(/^>\s*/, ''))}</blockquote>`
      : `<p>${inline(joined)}</p>`;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flushPara(); continue; }
    if (SCENE_BREAK.test(trimmed)) {
      flushPara();
      if (current && current.content) current.content += '<hr>';
      continue;
    }
    const heading = classifyHeading(trimmed);
    if (heading) {
      flushPara();
      current = { kind: heading.kind, title: heading.title, content: '' };
      sections.push(current);
      continue;
    }
    para.push(trimmed);
    if (!blankSeparated) flushPara();
  }
  flushPara();

  for (const s of sections) s.content = s.content.replace(/(<hr>)+$/, '');

  // A lone short line before the first heading is the book's title, not a chapter.
  const first = sections[0];
  if (sections.length > 1 && first.kind === 'chapter' && !first.title) {
    const only = first.content.match(/^<p>([^<]{1,80})<\/p>$/);
    if (only && !/[.!?…"”,;:]$/.test(only[1].trim())) sections.shift();
  }
  return sections.filter((s) => s.content || s.title || s.kind === 'part');
}

// ── Styled paragraphs → sections (Word, EPUB, HTML) ─────────────────────────

/** A paragraph from a structured format, with its heading level if it is one. */
export interface ImportBlock {
  runs: ProseRun[];
  text: string;
  /** 1 = top-level heading (Heading 1 / h1), 2 = next level… */
  heading?: number;
  center?: boolean;
  quote?: boolean;
  /** An explicit scene break (a horizontal rule). */
  rule?: boolean;
}

function blockHtml(b: ImportBlock): string {
  if (b.rule || SCENE_BREAK.test(b.text)) return '<hr>';
  const inner = runsToHtml(trimRuns(b.runs));
  if (!inner.trim()) return '';
  if (b.heading) return `<h2>${inner}</h2>`;
  if (b.quote) return `<blockquote>${inner}</blockquote>`;
  return `<p${b.center ? ' class="center"' : ''}>${inner}</p>`;
}

function trimRuns(runs: ProseRun[]): ProseRun[] {
  const out = runs.filter((r) => r.text || r.br).map((r) => ({ ...r }));
  while (out.length && !out[0].br && !out[0].text.trim()) out.shift();
  while (out.length && !out[out.length - 1].br && !out[out.length - 1].text.trim()) out.pop();
  if (out.length) {
    out[0].text = out[0].text.replace(/^\s+/, '');
    out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, '');
  }
  return out;
}

const COPYRIGHT = /©|copyright|isbn|all rights reserved|alle rettigheter|first published/i;

/**
 * Split styled paragraphs into sections. Heading styles decide where chapters
 * start when the document uses them; otherwise "Chapter 3"-style lines do.
 * A single top-level heading above many second-level ones is the book title.
 */
export function splitBlocks(input: ImportBlock[]): { sections: ImportCandidate[]; bookTitle?: string; warnings: string[] } {
  const blocks = input.filter((b) => b.rule || b.text.trim());
  const warnings: string[] = [];

  const count = new Map<number, number>();
  for (const b of blocks) if (b.heading) count.set(b.heading, (count.get(b.heading) || 0) + 1);
  const levels = Array.from(count.keys()).sort((a, b) => a - b);
  let bookTitle: string | undefined;
  let split = levels.find((l) => (count.get(l) || 0) >= 2);
  let partLevel: number | undefined;
  if (split !== undefined) {
    const above = levels.filter((l) => l < split!);
    if (above.length === 1 && count.get(above[0]) === 1) {
      bookTitle = blocks.find((b) => b.heading === above[0])?.text.trim();
    }
    // Two heading levels both used repeatedly: the upper one is parts.
    const below = levels.find((l) => l > split! && (count.get(l) || 0) >= 2);
    if (below !== undefined && (count.get(below) || 0) > (count.get(split) || 0)) {
      partLevel = split;
      split = below;
    }
  }

  const sections: ImportCandidate[] = [];
  let current: ImportCandidate | null = null;
  const frontBlocks: ImportBlock[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const text = b.text.trim();
    let heading: { kind: NovelItemKind; title: string } | null = null;

    if (split !== undefined && b.heading !== undefined && b.heading <= split && !(bookTitle && text === bookTitle && b.heading < split && partLevel === undefined)) {
      // A bare "Chapter 3" heading followed by a subtitle heading.
      const next = blocks[i + 1];
      const pair = next?.heading && next.heading > b.heading && next.text.trim().length <= 80 ? [text, next.text.trim()] : [text];
      heading = interpretHeading(pair.map((t) => tidyTitle(t)));
      if (b.heading === partLevel) heading = { kind: 'part', title: heading.kind === 'part' ? heading.title : tidyTitle(text) };
      if (pair.length === 2 && heading.title && heading.title === tidyTitle(pair[1])) i++;
    } else if (split === undefined && !b.heading && text.length <= 80) {
      const k = classifyHeading(text);
      if (k) heading = { kind: k.kind, title: tidyTitle(k.title) };
    } else if (split === undefined && b.heading) {
      heading = interpretHeading([tidyTitle(text)]);
    }

    if (heading) {
      current = { kind: heading.kind, title: heading.title, content: '', include: true };
      sections.push(current);
      continue;
    }
    if (bookTitle && b.heading && text === bookTitle && !current) continue;
    if (current) current.content += blockHtml(b);
    else frontBlocks.push(b);
  }

  // What came before the first chapter: a title page, a copyright page, or front matter to keep.
  const front: ImportCandidate[] = [];
  if (frontBlocks.length) {
    const html = frontBlocks.map(blockHtml).join('');
    const text = frontBlocks.map((b) => b.text).join(' ');
    if (!sections.length) {
      front.push({ kind: 'chapter', title: '', content: html, include: true });
      warnings.push('No chapter headings were found, so everything came in as one chapter. Use heading styles or "Chapter 1" lines to split it.');
    } else if (COPYRIGHT.test(text)) {
      front.push({ kind: 'front_matter', title: 'Copyright', content: html, include: false, note: 'Copyright page' });
    } else if (frontBlocks.length <= 4 && text.length < 200) {
      front.push({ kind: 'front_matter', title: 'Title page', content: html, include: false, note: 'Title page — your exports make their own' });
      bookTitle = bookTitle || frontBlocks[0]?.text.trim();
    } else {
      front.push({ kind: 'front_matter', title: 'Front matter', content: html, include: true });
    }
  }

  const all = [...front, ...sections].map((s) => ({ ...s, content: s.content.replace(/^(<hr>)+|(<hr>)+$/g, '').replace(/(<hr>){2,}/g, '<hr>') }));
  return { sections: all.filter((s) => s.content || s.kind === 'part' || s.title), bookTitle, warnings };
}
