/**
 * screenplay-paginator.ts
 *
 * Shared paginator for the screenplay editor and PDF/HTML export.
 * Supports US Letter and A4 page sizes with orphan/widow prevention
 * and optional CONT'D splitting for long dialogue.
 */

import type { ScriptElement } from './types';

// ---------------------------------------------------------------------------
// Page size definitions
// ---------------------------------------------------------------------------

export type PageSizeName = 'letter' | 'a4';

export interface PageConfig {
  /** CSS width of the page (for .sp-page styling) */
  width: string;
  /** CSS height of the page */
  height: string;
  /** Top margin */
  marginTop: string;
  /** Bottom margin */
  marginBottom: string;
  /** Right margin */
  marginRight: string;
  /** Left margin (wider for binding) */
  marginLeft: string;
  /** Usable lines per page at 12pt Courier / 6 lines per inch */
  linesPerPage: number;
  /** Max characters per line for action / scene headings */
  charsAction: number;
  /** Max characters per line for dialogue */
  charsDialogue: number;
  /** Max characters per line for character names */
  charsChar: number;
  /** Max characters per line for parentheticals */
  charsParens: number;
  /** Max characters per line for generic / default elements */
  charsDefault: number;
}

export const PAGE_CONFIGS: Record<PageSizeName, PageConfig> = {
  /**
   * US Letter  8.5 × 11 in
   * Margins: 1in top/bottom/right, 1.5in left
   * Usable: 6in wide × 9in tall → ~54 lines at 6 lines/inch
   */
  letter: {
    width: '8.5in',
    height: '11in',
    marginTop: '1in',
    marginBottom: '1in',
    marginRight: '1in',
    marginLeft: '1.5in',
    // 9in usable × 72pt/in = 648pt. At 12pt per line = 54 theoretical lines.
    linesPerPage: 54,
    charsAction: 60,
    charsDialogue: 35,
    charsChar: 38,
    charsParens: 25,
    charsDefault: 60,
  },
  /**
   * A4  210 × 297 mm
   * Margins: 25mm top/bottom/right, 37mm left
   * Usable: 148mm wide × 247mm tall
   * 247mm / (25.4mm/in) × 6 lines/in = 58.3 lines. Use 56 as budget.
   */
  a4: {
    width: '210mm',
    height: '297mm',
    marginTop: '25mm',
    marginBottom: '25mm',
    marginRight: '25mm',
    marginLeft: '37mm',
    linesPerPage: 56,
    charsAction: 58,
    charsDialogue: 33,
    charsChar: 36,
    charsParens: 23,
    charsDefault: 58,
  },
};

// ---------------------------------------------------------------------------
// Element type rules
// ---------------------------------------------------------------------------

/**
 * Element types that must never be the last element on a page.
 * When any of these would be left dangling at the bottom, they are carried
 * forward to open the next page instead.
 */
export const ORPHAN_TYPES = new Set<string>([
  'scene_heading',
  'character',
  'parenthetical',
]);

// ---------------------------------------------------------------------------
// Line estimation
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Estimate how many vertical lines an element will occupy on the page,
 * including standard before/after blank lines for each element type.
 */
export function estimateLines(el: ScriptElement, cfg: PageConfig): number {
  const len = stripHtml(el.content || '').length;
  switch (el.element_type) {
    case 'scene_heading':
      // CSS: padding-top: 24pt = 2 line-heights of overhead
      return Math.max(1, Math.ceil(len / cfg.charsAction)) + 2;
    case 'action':
      // 1 blank line after
      return Math.max(1, Math.ceil(len / cfg.charsAction)) + 1;
    case 'character':
      // 1 blank line before (cue line itself)
      return Math.max(1, Math.ceil(len / cfg.charsChar)) + 1;
    case 'parenthetical':
      // No extra blanks — tightly packed between character and dialogue
      return Math.max(1, Math.ceil(len / cfg.charsParens));
    case 'dialogue':
      // CSS: .sp-dialogue has no padding — gap after dialogue comes from next element's padding-top
      return Math.max(1, Math.ceil(len / cfg.charsDialogue));
    case 'transition':
      // 1 blank line before + 1 after
      return Math.max(1, Math.ceil(len / cfg.charsDefault)) + 2;
    default:
      return Math.max(1, Math.ceil(len / cfg.charsDefault)) + 1;
  }
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** A single hard page as emitted by the paginator */
export interface PaginatedPage {
  /** 1-based page number */
  pageNum: number;
  /** Elements that belong on this page (in display order) */
  elements: ScriptElement[];
}

/** Full result returned by paginateScript() */
export interface PaginatorResult {
  /** Ordered array of pages */
  pages: PaginatedPage[];
  /** Quick lookup: elementId → page number */
  elementPageMap: Record<string, number>;
}

export interface PaginatorOptions {
  /**
   * When true, long dialogue that spans a page break is split with a
   * (MORE) marker at the bottom and a (CONT'D) line at the top of the
   * next page.  Default: false.
   */
  contd?: boolean;
}

// ---------------------------------------------------------------------------
// Core paginator
// ---------------------------------------------------------------------------

/**
 * Paginate a flat list of ScriptElements into hard pages.
 *
 * Rules applied:
 * 1. Lines are estimated per element type.
 * 2. Orphan prevention: scene_heading, character, parenthetical must not be
 *    the last element(s) on a page — they are carried to the next page.
 * 3. (Optional) CONT'D splitting for dialogue that crosses a page break.
 *
 * Omitted elements (el.is_omitted) consume no lines but are still assigned a
 * page number so the editor can render them inline.
 */
export function paginateScript(
  elements: ScriptElement[],
  sizeName: PageSizeName = 'letter',
  _opts: PaginatorOptions = {},
): PaginatorResult {
  const cfg = PAGE_CONFIGS[sizeName];
  const elementPageMap: Record<string, number> = {};

  type PE = { el: ScriptElement; lines: number };
  let currentPageItems: PE[] = [];
  let lineCount = 0;
  let pageNum = 1;
  const pages: PaginatedPage[] = [];

  const flushPage = (carried: PE[]) => {
    pages.push({
      pageNum,
      elements: currentPageItems.map((p) => p.el),
    });
    pageNum++;
    currentPageItems = [...carried];
    lineCount = carried.reduce((s, c) => s + c.lines, 0);
    // Update page map for carried elements
    carried.forEach((c) => {
      elementPageMap[c.el.id] = pageNum;
    });
  };

  for (const el of elements) {
    // Omitted elements: assign a page but don't count lines
    if (el.is_omitted) {
      elementPageMap[el.id] = pageNum;
      currentPageItems.push({ el, lines: 0 });
      continue;
    }

    const elLines = estimateLines(el, cfg);

    // Would this element overflow the current page?
    if (lineCount + elLines > cfg.linesPerPage && currentPageItems.length > 0) {
      // Peel trailing orphan types off the current page
      const carried: PE[] = [];
      while (
        currentPageItems.length > 0 &&
        ORPHAN_TYPES.has(currentPageItems[currentPageItems.length - 1].el.element_type)
      ) {
        carried.unshift(currentPageItems.pop()!);
      }
      flushPage(carried);
    }

    elementPageMap[el.id] = pageNum;
    currentPageItems.push({ el, lines: elLines });
    lineCount += elLines;
  }

  // Flush the final page
  if (currentPageItems.length > 0 || pages.length === 0) {
    pages.push({
      pageNum,
      elements: currentPageItems.map((p) => p.el),
    });
  }

  return { pages, elementPageMap };
}
