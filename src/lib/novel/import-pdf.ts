/**
 * PDF → manuscript sections.
 *
 * PDFs carry no paragraphs or chapters, only positioned runs of text, so the
 * book's structure is rebuilt from its typography:
 *
 *   - The body font size is the size most of the text is set in. Anything
 *     clearly larger is display type: chapter numbers, titles, part pages.
 *   - Chapters start at a block of display type ("1" + "I DAG, KOMPIS",
 *     "Prologue", "CHAPTER SEVEN"), or at the PDF's bookmarks when it has them.
 *   - Page numbers and running headers/footers are found by position and
 *     repetition and dropped.
 *   - Paragraphs come back from first-line indents (or the gaps between
 *     block paragraphs); a wider gap in indented text is a scene break.
 *   - Words hyphenated across lines are rejoined, small caps are lowercased
 *     again, letter-spaced labels are closed up, italics survive.
 *   - A table of contents is used to restore the casing of titles set in
 *     capitals, and is not imported itself.
 *   - Cover, title, copyright and back-cover pages are offered unticked.
 *
 * `readPdf` extracts text with pdf.js (browser, or Node with the legacy build);
 * `pdfToSections` is pure, so the heuristics are unit-tested on synthetic pages.
 */

import type { NovelItemKind } from '@/lib/types';
import { runsToHtml, type ProseRun } from './text';
import {
  SCENE_BREAK, classifyHeading, collapseLetterSpacing, interpretHeading, isContentsHeading, tidyTitle,
  type ImportCandidate, type ImportResult,
} from './import';

export interface PdfItem { str: string; x: number; y: number; w: number; size: number; italic: boolean; bold: boolean }
export interface PdfPage { number: number; width: number; height: number; items: PdfItem[] }
export interface PdfOutlineEntry { title: string; page: number; depth: number }
export interface PdfDoc { pages: PdfPage[]; outline: PdfOutlineEntry[]; title?: string; author?: string }

// ── Reading ─────────────────────────────────────────────────────────────────

// Minimal shape of the parts of pdf.js used here, so either build can be passed in.
/* eslint-disable @typescript-eslint/no-explicit-any */
type PdfJs = { getDocument: (src: any) => { promise: Promise<any> }; GlobalWorkerOptions?: { workerSrc: string } };

export async function readPdf(
  data: ArrayBuffer | Uint8Array,
  opts: { pdfjs?: PdfJs; onProgress?: (done: number, total: number) => void } = {},
): Promise<PdfDoc> {
  let pdfjs = opts.pdfjs;
  if (!pdfjs) {
    pdfjs = (await import('pdfjs-dist')) as unknown as PdfJs;
    if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
  // A plain Uint8Array: pdf.js rejects subclasses such as Node's Buffer.
  const bytes = data instanceof Uint8Array ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
  const pdf = await pdfjs.getDocument({ data: bytes, verbosity: 0 }).promise;

  const meta = await pdf.getMetadata().catch(() => null);
  const info = (meta?.info ?? {}) as Record<string, unknown>;

  const outline: PdfOutlineEntry[] = [];
  const walk = async (entries: any[] | null, depth: number) => {
    for (const e of entries ?? []) {
      try {
        const dest = typeof e.dest === 'string' ? await pdf.getDestination(e.dest) : e.dest;
        const ref = Array.isArray(dest) ? dest[0] : null;
        const index = ref == null ? null : typeof ref === 'number' ? ref : await pdf.getPageIndex(ref);
        if (index != null && e.title?.trim()) outline.push({ title: e.title.trim(), page: index + 1, depth });
      } catch { /* broken destination — skip it */ }
      if (e.items?.length) await walk(e.items, depth + 1);
    }
  };
  await walk(await pdf.getOutline().catch(() => null), 0);

  const pages: PdfPage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    // Fonts are only resolved once the page's operators are loaded; the
    // font names are how italics and bold are told apart.
    await page.getOperatorList().catch(() => null);
    const styles = new Map<string, { italic: boolean; bold: boolean }>();
    const styleOf = (fontName: string) => {
      let s = styles.get(fontName);
      if (!s) {
        let name = '';
        let italic = false;
        let bold = false;
        try {
          const f = page.commonObjs.get(fontName);
          name = String(f?.name ?? '');
          italic = !!f?.italic;
          bold = !!f?.bold;
        } catch { /* font not loaded */ }
        s = { italic: italic || /italic|oblique|kursiv/i.test(name), bold: bold || /bold|black|heavy|semibold|demi/i.test(name) };
        styles.set(fontName, s);
      }
      return s;
    };
    const items: PdfItem[] = [];
    for (const it of content.items as any[]) {
      if (typeof it.str !== 'string' || it.str === '') continue;
      const [a, b, c, d, e, f] = it.transform as number[];
      const size = Math.hypot(c, d) || Math.hypot(a, b) || it.height || 0;
      items.push({ str: it.str, x: e, y: f, w: it.width ?? 0, size, ...styleOf(it.fontName) });
    }
    pages.push({ number: n, width: viewport.width, height: viewport.height, items });
    page.cleanup?.();
    opts.onProgress?.(n, pdf.numPages);
  }
  await pdf.destroy?.();

  return {
    pages,
    outline,
    title: typeof info.Title === 'string' && info.Title.trim() ? info.Title.trim() : undefined,
    author: typeof info.Author === 'string' && info.Author.trim() ? info.Author.trim() : undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Lines ───────────────────────────────────────────────────────────────────

type LineKind = 'body' | 'display' | 'small';

export interface Line {
  page: number;
  y: number;
  x0: number;
  x1: number;
  size: number;
  text: string;
  runs: ProseRun[];
  kind: LineKind;
}

type RawLine = Omit<Line, 'kind'>;

function mergeRun(runs: ProseRun[], text: string, italic: boolean, bold: boolean) {
  const last = runs[runs.length - 1];
  if (last && !!last.em === italic && !!last.strong === bold) last.text += text;
  else runs.push({ text, ...(italic ? { em: true } : {}), ...(bold ? { strong: true } : {}) });
}

const UPPER_ONLY = new RegExp('^[\\p{Lu}\\s]+$', 'u');
const HYPHEN_END = new RegExp('\\p{L}-$', 'u');
const LOWER_START = new RegExp('^\\p{Ll}', 'u');

function buildLines(page: PdfPage): RawLine[] {
  const items = [...page.items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PdfItem[][] = [];
  for (const it of items) {
    const row = rows[rows.length - 1];
    const ref = row?.[0];
    if (ref && Math.abs(ref.y - it.y) < 0.45 * Math.max(ref.size, it.size, 1)) row.push(it);
    else rows.push([it]);
  }

  const lines: RawLine[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    const visible = row.filter((i) => i.str.trim());
    if (!visible.length) continue;
    const size = Math.max(...visible.map((i) => i.size));
    const runs: ProseRun[] = [];
    let text = '';
    let prevEnd: number | null = null;
    for (const it of row) {
      let s = collapseLetterSpacing(it.str);
      // Small caps: lowercase letters drawn as smaller capitals.
      if (it.size < 0.85 * size && it.size > 0.5 * size && UPPER_ONLY.test(s) && s.trim()) s = s.toLocaleLowerCase();
      if (prevEnd !== null && it.x - prevEnd > 0.18 * it.size && !/\s$/.test(text) && !/^\s/.test(s)) {
        mergeRun(runs, ' ', it.italic, it.bold);
        text += ' ';
      }
      mergeRun(runs, s, it.italic, it.bold);
      text += s;
      prevEnd = it.x + it.w;
    }
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    lines.push({
      page: page.number,
      y: row[0].y,
      x0: visible[0].x,
      x1: Math.max(...visible.map((i) => i.x + i.w)),
      size,
      text: clean.replace(/­/g, ''),
      runs: runs.map((r) => ({ ...r, text: r.text.replace(/\s+/g, ' ').replace(/­/g, '') })),
    });
  }
  return lines;
}

/** The size most of the book's characters are set in. */
function bodySize(pages: PdfPage[]): number {
  const counts = new Map<number, number>();
  for (const p of pages) for (const it of p.items) {
    const k = Math.round(it.size * 10) / 10;
    counts.set(k, (counts.get(k) || 0) + it.str.trim().length);
  }
  let best = 10;
  let n = -1;
  for (const [k, c] of Array.from(counts)) if (c > n) { best = k; n = c; }
  return best;
}

const PAGE_NUMBER = /^(?:[-–—]\s*)?(?:page|side|seite|sida|p\.)?\s*(?:\d{1,4}|[ivxlc]{1,6})(?:\s*(?:of|av|von|\/)\s*\d{1,4})?(?:\s*[-–—])?$/i;

/** Drop page numbers and running headers/footers. */
function removeFurniture(byPage: RawLine[][], pages: PdfPage[]): RawLine[][] {
  const band = (l: RawLine, h: number) => l.y > h * 0.9 || l.y < h * 0.1;
  const key = (t: string) => t.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
  const seen = new Map<string, number>();
  byPage.forEach((lines, i) => {
    const keys = new Set(lines.filter((l) => band(l, pages[i].height)).map((l) => key(l.text)));
    keys.forEach((k) => seen.set(k, (seen.get(k) || 0) + 1));
  });
  const repeatAt = Math.max(3, Math.round(pages.length * 0.2));
  return byPage.map((lines, i) => lines.filter((l) => {
    if (!band(l, pages[i].height)) return true;
    if (PAGE_NUMBER.test(l.text)) return false;
    return (seen.get(key(l.text)) || 0) < repeatAt;
  }));
}

// ── Structure ───────────────────────────────────────────────────────────────

interface Draft extends ImportCandidate {
  lines: Line[];
  /** Small lines under the heading — a dateline or place, kept as a centred line. */
  kicker: string[];
}

const NUMBER_HEADING = /^(?:\d{1,3}|[IVXLC]{1,7})\.?$/;

export function pdfToSections(doc: PdfDoc): ImportResult {
  const warnings: string[] = [];
  const { pages } = doc;
  const B = bodySize(pages);
  const totalChars = pages.reduce((n, p) => n + p.items.reduce((m, i) => m + i.str.trim().length, 0), 0);
  if (totalChars < Math.max(200, pages.length * 20)) {
    return {
      format: 'pdf', title: doc.title, author: doc.author, sections: [],
      warnings: ['This PDF has (almost) no text in it — it is probably scanned pages. Run it through OCR (Preview, Acrobat or Google Drive can do this) and import the result.'],
    };
  }

  const kindOf = (size: number): LineKind => (size >= 1.3 * B ? 'display' : Math.abs(size - B) <= 0.12 * B ? 'body' : 'small');
  const byPage: Line[][] = removeFurniture(pages.map(buildLines), pages)
    .map((ls) => ls.map((l) => ({ ...l, kind: kindOf(l.size) })));

  // Table of contents: dropped, but its entries fix the casing of titles.
  const toc: string[] = [];
  const tocPages = new Set<number>();
  byPage.forEach((lines, i) => {
    const first = lines[0];
    const numbered = lines.filter((l) => /^\d{1,3}\D|\D\d{1,3}$/.test(l.text)).length;
    const continues = tocPages.has(i - 1) && lines.length > 0 && !lines.some((l) => l.kind === 'display') && numbered >= lines.length * 0.5;
    if ((first && isContentsHeading(first.text)) || continues) {
      tocPages.add(i);
      toc.push(...lines.slice(first && isContentsHeading(first.text) ? 1 : 0).map((l) => l.text));
    }
  });

  // Cover, title and part pages: a few lines, some display type, little prose.
  const isDisplayPage = (lines: Line[]) => {
    if (!lines.length || lines.length > 10) return false;
    const chars = (k: LineKind) => lines.filter((l) => l.kind === k).reduce((n, l) => n + l.text.length, 0);
    return chars('display') > 0 && chars('body') < 120;
  };

  const sections: Draft[] = [];
  const front: Draft[] = [];
  let current: Draft | null = null;
  const start = (kind: NovelItemKind, title: string, note?: string): Draft => {
    const d: Draft = { kind, title, content: '', include: true, note, lines: [], kicker: [] };
    sections.push(d);
    current = d;
    return d;
  };
  const inBackCover = () => {
    const c = current as Draft | null;
    return !!c && c.title === 'Back cover' && !c.include;
  };

  const titlePage = (texts: string[]): Draft => ({
    kind: 'front_matter', title: 'Title page', content: '', include: false,
    note: 'Title or cover page — your exports make their own', lines: [], kicker: texts,
  });

  function frontPage(lines: Line[], display: boolean): Draft {
    const text = lines.map((l) => l.text).join(' ');
    if (display) return titlePage(lines.map((l) => l.text));
    if (/©|copyright|isbn|all rights reserved|alle rettigheter|first published/i.test(text)) {
      return { kind: 'front_matter', title: 'Copyright', content: '', include: false, note: 'Copyright page', lines, kicker: [] };
    }
    const epigraph = lines.length <= 8 && (lines.some((l) => /^[—–-]\s*\S/.test(l.text)) || lines.every((l) => l.kind !== 'body'));
    return { kind: 'front_matter', title: epigraph ? 'Epigraph' : 'Front matter', content: '', include: true, lines, kicker: [] };
  }

  function placeHeading(block: Line[], displayPage: boolean, pageIndex: number) {
    if (inBackCover()) { (current as Draft).lines.push(...block); return; }
    const texts = block.map((l) => tidyTitle(l.text, toc));
    const joined = texts.join(' ');
    const h = interpretHeading(texts);
    // Long display text, or a sentence, is a blurb or pull quote — not a title.
    const sentence = /[.!?…]\s+\S/.test(joined) || /[.!?…]$/.test(texts[0]);
    const keyword = h.kind !== 'chapter' || NUMBER_HEADING.test(texts[0]) || !!classifyHeading(texts[0]);
    if (joined.length > 90 || (sentence && !keyword)) {
      if (pageIndex >= byPage.length - 2 && sections.length) {
        const d = start('back_matter', 'Back cover', 'Looks like the back cover');
        d.include = false;
        d.lines.push(...block);
      } else if (current) {
        (current as Draft).lines.push(...block);
      } else {
        front.push(frontPage(block, displayPage));
      }
      return;
    }
    if (displayPage && !sections.length && h.kind === 'chapter') {
      front.push(titlePage(texts));
      return;
    }
    const d = start(h.kind, h.title);
    // Lines the heading didn't use (a dateline, a place) stay as a centred line.
    const used = h.kind === 'part' ? texts.length : h.title && texts[1] && h.title.endsWith(texts[1]) ? 2 : 1;
    d.kicker.push(...block.slice(used).map((l) => l.text));
  }

  if (doc.outline.length >= 2) {
    const nested = doc.outline.some((e, i) => e.depth === 0 && doc.outline[i + 1]?.depth === 1);
    const starts = new Map<number, PdfOutlineEntry>();
    for (const e of doc.outline) if (e.depth <= (nested ? 1 : 0) && !starts.has(e.page)) starts.set(e.page, e);
    byPage.forEach((lines, i) => {
      if (tocPages.has(i)) return;
      const entry = starts.get(i + 1);
      if (entry) {
        const h = interpretHeading([tidyTitle(entry.title, toc)]);
        const kind: NovelItemKind = nested && entry.depth === 0 && h.kind === 'chapter' ? 'part' : h.kind;
        const d = start(kind, h.title || (kind === 'chapter' ? '' : entry.title), 'From the PDF’s bookmarks');
        // The heading is on the page as display type; don't repeat it in the text.
        let k = 0;
        while (k < lines.length && lines[k].kind !== 'body') {
          if (lines[k].kind === 'small' && k > 0) d.kicker.push(lines[k].text);
          k++;
        }
        d.lines.push(...lines.slice(k));
      } else if (current) {
        (current as Draft).lines.push(...lines);
      } else if (lines.length) {
        front.push(frontPage(lines, isDisplayPage(lines)));
      }
    });
  } else {
    byPage.forEach((lines, i) => {
      if (tocPages.has(i) || !lines.length) return;
      if (isDisplayPage(lines)) { placeHeading(lines, true, i); return; }
      let k = 0;
      while (k < lines.length) {
        const line = lines[k];
        const prev = lines[k - 1];
        const next = lines[k + 1];

        // A block of display type, with the small lines that belong to it.
        if (line.kind === 'display') {
          const block: Line[] = [];
          while (k < lines.length && lines[k].kind !== 'body' && (!block.length || block[block.length - 1].y - lines[k].y < 6 * B)) {
            block.push(lines[k]);
            k++;
          }
          placeHeading(block, false, i);
          continue;
        }

        // "Chapter Seven" set in body type on a line of its own (manuscript format).
        const gapAbove = prev ? prev.y - line.y : Infinity;
        const gapBelow = next ? line.y - next.y : Infinity;
        const kw = !inBackCover() && gapAbove > 1.8 * B && gapBelow > 1.6 * B && line.text.length <= 60 ? classifyHeading(line.text) : null;
        if (kw) {
          start(kw.kind, tidyTitle(kw.title, toc));
          k++;
          continue;
        }

        if (!current) {
          // Before the first chapter: the rest of this page is front matter.
          front.push(frontPage(lines.slice(k), false));
          break;
        }
        (current as Draft).lines.push(line);
        k++;
      }
    });
  }

  const all = [...front, ...sections];
  for (const d of all) {
    const kicker = d.kicker.map((t) => `<p class="center">${esc(t)}</p>`).join('');
    d.content = kicker + paragraphs(d.lines, B);
  }

  if (!sections.length && all.length) {
    warnings.push('No chapter headings were found, so the text came in as one section. Split it in the Manuscript, or use a PDF that has bookmarks.');
  }
  const kept = all.filter((d) => d.content || d.kind === 'part');
  if (!kept.length) warnings.push('No text could be read from this PDF.');
  if (toc.length) warnings.push('The table of contents was left out — the binder and your exports build their own.');

  return {
    format: 'pdf',
    title: doc.title,
    author: doc.author,
    sections: kept.map(({ kind, title, content, include, note }) => ({ kind, title, content, include, ...(note ? { note } : {}) })),
    warnings,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Paragraphs ──────────────────────────────────────────────────────────────

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Rebuild paragraphs, scene breaks and inline styling from positioned lines. */
export function paragraphs(lines: Line[], B: number): string {
  if (!lines.length) return '';
  // Per-page margins: books mirror them left and right.
  const margins = new Map<number, { left: number; right: number }>();
  for (const l of lines) {
    if (l.kind === 'display') continue;
    const m = margins.get(l.page) ?? { left: Infinity, right: -Infinity };
    m.left = Math.min(m.left, l.x0);
    m.right = Math.max(m.right, l.x1);
    margins.set(l.page, m);
  }
  const marginOf = (l: Line) => margins.get(l.page) ?? { left: l.x0, right: l.x1 };

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1].y - lines[i].y;
    if (lines[i].page === lines[i - 1].page && g > 0 && g < 3 * B) gaps.push(g);
  }
  const L = median(gaps) || B * 1.4;
  const indentOf = (l: Line) => l.x0 - marginOf(l).left;
  const indented = (l: Line) => indentOf(l) > 0.6 * B && indentOf(l) < 6 * B;
  const indentDoc = lines.filter(indented).length > lines.length * 0.03;

  const out: string[] = [];
  let para: ProseRun[] = [];
  let cls = '';
  const flush = () => {
    while (para.length && !para[para.length - 1].text.trim()) para.pop();
    if (para.length) {
      para[0] = { ...para[0], text: para[0].text.replace(/^\s+/, '') };
      const last = para[para.length - 1];
      para[para.length - 1] = { ...last, text: last.text.replace(/\s+$/, '') };
      out.push(`<p${cls ? ` class="${cls}"` : ''}>${runsToHtml(para)}</p>`);
    }
    para = [];
    cls = '';
  };

  lines.forEach((line, i) => {
    const prev = lines[i - 1];
    const samePage = !!prev && prev.page === line.page;
    if (SCENE_BREAK.test(line.text)) {
      flush();
      if (out.length && out[out.length - 1] !== '<hr>') out.push('<hr>');
      return;
    }
    if (line.kind === 'display') {
      flush();
      out.push(`<h2>${runsToHtml(line.runs)}</h2>`);
      return;
    }
    const m = marginOf(line);
    const centred = line.x0 - m.left > 3 * B && m.right - line.x1 > 3 * B && Math.abs((line.x0 - m.left) - (m.right - line.x1)) < 2.5 * B;
    const gap = samePage ? prev.y - line.y : 0;
    const blank = samePage && gap > 1.7 * L;
    const prevShort = !!prev && prev.x1 < marginOf(prev).right - 3 * B;
    const prevEnds = !!prev && /[.!?…:"”»’)]$/.test(prev.text);
    const dash = /^[—–]\s/.test(line.text);
    const newPara = !prev || indented(line) || blank || centred || dash
      || (para.length > 0 && cls === 'center')
      || (!indentDoc && prevShort && prevEnds);

    if (newPara) {
      flush();
      if (blank && indentDoc && out.length && out[out.length - 1] !== '<hr>') out.push('<hr>');
      if (centred) cls = 'center';
      para = line.runs.map((r) => ({ ...r }));
      return;
    }

    // Same paragraph: rejoin a word split across the line break.
    const last = para[para.length - 1];
    const firstRun = line.runs[0];
    if (last && HYPHEN_END.test(last.text) && firstRun && LOWER_START.test(firstRun.text)) {
      last.text = last.text.slice(0, -1);
    } else if (last && !/\s$/.test(last.text)) {
      last.text += ' ';
    }
    for (const r of line.runs) mergeRun(para, r.text, !!r.em, !!r.strong);
  });
  flush();
  while (out[out.length - 1] === '<hr>') out.pop();
  return out.join('');
}
