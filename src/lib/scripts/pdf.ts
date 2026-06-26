/**
 * PDF Screenplay Parser
 *
 * Extracts text from PDF files using pdfjs-dist and applies heuristics
 * to identify screenplay elements (scene headings, characters, dialogue, etc.).
 *
 * This is a best-effort parser — PDFs are visual formats and don't carry
 * semantic screenplay structure. The heuristics work best with PDFs exported
 * from screenwriting software (Final Draft, Fade In, Highland, etc.).
 */

import type { ScriptElement, ScriptElementType, TitlePageData } from '@/lib/types';

export interface PDFImportResult {
  titlePage: TitlePageData;
  elements: Partial<ScriptElement>[];
  rawText: string;
  metadata: {
    pageCount: number;
    confidence: number; // 0-1, how confident we are in the element classification
  };
}

/**
 * Parse a PDF file into screenplay elements.
 */
export async function parsePDF(file: File): Promise<PDFImportResult> {
  const arrayBuffer = await file.arrayBuffer();

  // Dynamic import to avoid bundling pdfjs-dist in non-PDF contexts
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;

  // Extract text from all pages
  const pageTexts: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const lines: string[] = [];
    let lastY: number | null = null;

    for (const item of textContent.items) {
      if ('str' in item) {
        const y = item.transform[5];
        // New line if Y position changed significantly
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          lines.push('\n');
        }
        lines.push(item.str);
        lastY = y;
      }
    }
    pageTexts.push(lines.join(''));
  }

  const rawText = pageTexts.join('\n\n');

  // Extract title page from first page (if it looks like one)
  const { titlePage, bodyText } = extractTitlePage(rawText, file.name);

  // Parse body into screenplay elements
  const { elements, confidence } = classifyElements(bodyText);

  return {
    titlePage,
    elements,
    rawText,
    metadata: { pageCount, confidence },
  };
}

// ── Title Page Extraction ──────────────────────────────────────

function extractTitlePage(text: string, filename: string): { titlePage: TitlePageData; bodyText: string } {
  const titlePage: TitlePageData = {};
  const lines = text.split('\n').map(l => l.trimEnd());

  // Heuristic: first ~20 lines that don't look like scene headings or action
  // might be title page data
  const titlePageEnd = findTitlePageEnd(lines);

  if (titlePageEnd > 0) {
    const titleBlock = lines.slice(0, titlePageEnd).join('\n');
    const bodyLines = lines.slice(titlePageEnd);

    // Try to extract structured fields from the title block
    const titleMatch = titleBlock.match(/^(?:TITLE\s*[:.]?\s*)(.+)/im);
    const authorMatch = titleBlock.match(/^(?:WRITTEN BY|SCREENPLAY BY|BY|AUTHOR)\s*[:.]?\s*(.+)/im);
    const creditMatch = titleBlock.match(/^(?:CREDIT)\s*[:.]?\s*(.+)/im);
    const draftMatch = titleBlock.match(/^(?:DRAFT\s*DATE|DATE)\s*[:.]?\s*(.+)/im);
    const contactMatch = titleBlock.match(/^(?:CONTACT)\s*[:.]?\s*(.+)/im);
    const sourceMatch = titleBlock.match(/^(?:SOURCE|BASED ON)\s*[:.]?\s*(.+)/im);

    if (titleMatch) titlePage.title = titleMatch[1].trim();
    if (creditMatch) titlePage.credit = creditMatch[1].trim();
    if (authorMatch) titlePage.author = authorMatch[1].trim();
    if (draftMatch) titlePage.draft_date = draftMatch[1].trim();
    if (contactMatch) titlePage.contact = contactMatch[1].trim();
    if (sourceMatch) titlePage.source = sourceMatch[1].trim();

    // If no structured fields found, use the largest/first non-empty line as title
    if (!titlePage.title) {
      const firstSignificant = titleBlock.split('\n').find(l => l.trim().length > 1);
      if (firstSignificant) {
        titlePage.title = firstSignificant.trim();
      }
    }

    return { titlePage, bodyText: bodyLines.join('\n') };
  }

  // Fallback: use filename as title
  const derivedTitle = filename
    .replace(/\.(pdf)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  titlePage.title = derivedTitle;

  return { titlePage, bodyText: text };
}

function findTitlePageEnd(lines: string[]): number {
  // Look for the first scene heading — that marks the end of the title page
  const scenePattern = /^(INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[\.\s]/i;

  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i].trim();
    if (scenePattern.test(line)) {
      return i;
    }
  }

  // If no scene heading found in first 40 lines, look for a large gap
  // (common between title page and script body)
  let lastNonEmpty = 0;
  let consecutiveEmpty = 0;
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    if (lines[i].trim() === '') {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 3 && i > 3) {
        return lastNonEmpty + 1;
      }
    } else {
      consecutiveEmpty = 0;
      lastNonEmpty = i;
    }
  }

  return 0;
}

// ── Element Classification ─────────────────────────────────────

function classifyElements(text: string): { elements: Partial<ScriptElement>[]; confidence: number } {
  const lines = text.split('\n');
  const elements: Partial<ScriptElement>[] = [];
  let sortOrder = 0;
  let sceneCount = 0;
  let confidenceHits = 0;
  let totalElements = 0;

  const push = (type: ScriptElementType, content: string, sceneNumber?: string) => {
    elements.push({
      element_type: type,
      content: content.trim(),
      sort_order: sortOrder++,
      scene_number: sceneNumber || null,
    });
    totalElements++;
  };

  const scenePattern = /^(INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[\.\s]/i;
  const transitionPattern = /^(?:FADE IN:|FADE OUT\.?|CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:)[\s]*$/i;
  const transitionEndPattern = /^(?:FADE TO BLACK\.?|FADE OUT\.?|THE END)[\s]*$/i;
  const characterPattern = /^[A-Z][A-Z\s.'\-()]+$/;
  const parenPattern = /^\(.+\)$/;
  const centeredPattern = /^(?:\s*>\s*|\s*<\s*)(.+?)(?:\s*>\s*|\s*<\s*)$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (line === '') {
      i++;
      continue;
    }

    // Skip page numbers (standalone numbers)
    if (/^\d+\s*$/.test(line)) {
      i++;
      continue;
    }

    // Skip common headers/footers
    if (/^(?:©|copyright|draft|confidential|continued|page \d)/i.test(line)) {
      i++;
      continue;
    }

    // Scene Heading
    if (scenePattern.test(line)) {
      sceneCount++;
      const { text: sceneText, sceneNumber } = extractSceneNumber(line);
      push('scene_heading', sceneText, sceneNumber || String(sceneCount));
      confidenceHits++;
      i++;
      continue;
    }

    // Transition
    if (transitionPattern.test(line) || transitionEndPattern.test(line)) {
      push('transition', line);
      confidenceHits++;
      i++;
      continue;
    }

    // All caps line that looks like a transition (ending with TO:)
    if (/^[A-Z\s]+TO:\s*$/.test(line)) {
      push('transition', line);
      confidenceHits++;
      i++;
      continue;
    }

    // Centered text (> ... <)
    const centeredMatch = line.match(centeredPattern);
    if (centeredMatch) {
      push('centered', centeredMatch[1]);
      confidenceHits++;
      i++;
      continue;
    }

    // Character name (ALL CAPS, not too long, followed by dialogue)
    if (isCharacterLike(line) && !scenePattern.test(line)) {
      push('character', line);
      confidenceHits++;
      i++;

      // Collect dialogue block (parentheticals + dialogue lines)
      while (i < lines.length) {
        const dLine = lines[i].trim();
        if (dLine === '') {
          i++;
          break;
        }
        if (parenPattern.test(dLine)) {
          push('parenthetical', dLine);
          i++;
        } else if (isDialogueLine(dLine)) {
          push('dialogue', dLine);
          i++;
        } else {
          break;
        }
      }
      continue;
    }

    // Default: Action
    // Collect consecutive non-empty, non-special lines as one action block
    let actionText = line;
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !isSpecialLine(lines[i].trim(), scenePattern)) {
      actionText += '\n' + lines[i].trim();
      i++;
    }
    push('action', actionText);
  }

  const confidence = totalElements > 0 ? confidenceHits / totalElements : 0;

  return { elements, confidence };
}

function isCharacterLike(line: string): boolean {
  const stripped = line.replace(/\s*\(.*?\)\s*$/, '').trim();
  if (!stripped) return false;
  // Must be mostly uppercase
  if (stripped !== stripped.toUpperCase()) return false;
  // Must have alpha characters
  if (!/[A-Z]/.test(stripped)) return false;
  // Not too long (character names are typically short)
  if (stripped.length > 40) return false;
  // Doesn't look like a scene heading
  if (/^(INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[\.\s]/i.test(stripped)) return false;
  // Not a transition
  if (/TO:\s*$/.test(stripped)) return false;
  return true;
}

function isDialogueLine(line: string): boolean {
  // Dialogue lines are typically not ALL CAPS (that would be a character)
  // and not starting with INT./EXT.
  if (/^[A-Z]{3,}[\s]*$/.test(line)) return false;
  if (/^(INT|EXT|EST)/i.test(line)) return false;
  if (line.length === 0) return false;
  return true;
}

function isSpecialLine(line: string, scenePattern: RegExp): boolean {
  if (scenePattern.test(line)) return true;
  if (/^(?:FADE IN:|FADE OUT\.?|CUT TO:|DISSOLVE TO:)/i.test(line)) return true;
  if (/^[A-Z][A-Z\s.'\-()]{2,}$/.test(line) && line.length < 40) return true;
  return false;
}

function extractSceneNumber(text: string): { text: string; sceneNumber: string | null } {
  // Look for scene number patterns: "1.", "#1#", "Scene 1", etc.
  const match = text.match(/^(.+?)\s*(?:#(\d+)#|Scene\s+(\d+)|\b(\d+)\.\s)/i);
  if (match) {
    const num = match[2] || match[3] || match[4];
    return { text: match[1].trim(), sceneNumber: num || null };
  }
  return { text: text.trim(), sceneNumber: null };
}

// ── FDX Generation from PDF elements ───────────────────────────

export function generateFDXFromPDF(result: PDFImportResult): string {
  const { titlePage, elements } = result;

  const ELEMENT_TO_FDX: Record<string, string> = {
    scene_heading: 'Scene Heading',
    action: 'Action',
    character: 'Character',
    dialogue: 'Dialogue',
    parenthetical: 'Parenthetical',
    transition: 'Transition',
    shot: 'Shot',
    centered: 'Action',
    lyrics: 'Lyrics',
    section: 'New Act',
    note: 'Action',
    page_break: 'Action',
    title_page: 'Action',
    synopsis: 'Action',
    act: 'New Act',
    sequence: 'New Act',
    sequence_end: 'Action',
  };

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  lines.push('<FinalDraft DocumentType="Script" Template="No" Version="5">');

  // Title Page
  if (titlePage.title || titlePage.author) {
    lines.push('  <TitlePage>');
    lines.push('    <Content Location="Header">');
    if (titlePage.title) {
      lines.push(`      <Paragraph Alignment="Center" SpaceBefore="288" StartsNewPage="Yes">`);
      lines.push(`        <Text Style="Bold+UnderLine">${escapeXml(titlePage.title)}</Text>`);
      lines.push('      </Paragraph>');
    }
    if (titlePage.credit) {
      lines.push(`      <Paragraph Alignment="Center" SpaceBefore="24">`);
      lines.push(`        <Text>${escapeXml(titlePage.credit)}</Text>`);
      lines.push('      </Paragraph>');
    }
    if (titlePage.author) {
      lines.push(`      <Paragraph Alignment="Center" SpaceBefore="12">`);
      lines.push(`        <Text>${escapeXml(titlePage.author)}</Text>`);
      lines.push('      </Paragraph>');
    }
    lines.push('    </Content>');

    const hasFooter = titlePage.draft_date || titlePage.contact || titlePage.copyright;
    if (hasFooter) {
      lines.push('    <Content Location="Footer">');
      if (titlePage.draft_date) {
        lines.push(`      <Paragraph Alignment="Left"><Text>${escapeXml(titlePage.draft_date)}</Text></Paragraph>`);
      }
      if (titlePage.contact) {
        lines.push(`      <Paragraph Alignment="Left" SpaceBefore="12"><Text>${escapeXml(titlePage.contact)}</Text></Paragraph>`);
      }
      lines.push('    </Content>');
    }
    lines.push('  </TitlePage>');
  }

  // Content
  lines.push('  <Content>');
  for (const el of elements) {
    const fdxType = ELEMENT_TO_FDX[el.element_type || ''] || 'Action';
    const attrs = [`Type="${fdxType}"`];
    if (el.scene_number) attrs.push(`Number="${escapeXml(el.scene_number)}"`);
    lines.push(`    <Paragraph ${attrs.join(' ')}>`);

    // Handle multi-line content by splitting into multiple Text nodes
    const contentLines = (el.content || '').split('\n');
    for (let j = 0; j < contentLines.length; j++) {
      lines.push(`      <Text>${escapeXml(contentLines[j])}</Text>`);
    }
    lines.push('    </Paragraph>');
  }
  lines.push('  </Content>');
  lines.push('</FinalDraft>');

  return lines.join('\n');
}

// ── Fountain Generation from PDF elements ──────────────────────

export function generateFountainFromPDF(result: PDFImportResult): string {
  const { titlePage, elements } = result;
  const lines: string[] = [];

  // Title Page
  if (titlePage) {
    const tp: [string, string | undefined][] = [
      ['Title', titlePage.title],
      ['Credit', titlePage.credit],
      ['Author', titlePage.author],
      ['Source', titlePage.source],
      ['Draft date', titlePage.draft_date],
      ['Contact', titlePage.contact],
      ['Copyright', titlePage.copyright],
    ];
    let hasTitlePage = false;
    for (const [key, value] of tp) {
      if (value) {
        lines.push(`${key}: ${value}`);
        hasTitlePage = true;
      }
    }
    if (hasTitlePage) lines.push('');
  }

  // Elements
  let prevType: string | null = null;
  for (const el of elements) {
    const content = el.content || '';

    if (prevType !== null) {
      const noBlankBefore =
        (el.element_type === 'dialogue' && prevType === 'character') ||
        (el.element_type === 'parenthetical' && prevType === 'character') ||
        (el.element_type === 'dialogue' && prevType === 'parenthetical') ||
        (el.element_type === 'parenthetical' && prevType === 'dialogue');
      if (!noBlankBefore) lines.push('');
    }

    switch (el.element_type) {
      case 'scene_heading': {
        let heading = content.toUpperCase();
        if (el.scene_number) heading = `${heading} #${el.scene_number}#`;
        if (!/^(INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[\.\s]/i.test(heading)) {
          heading = '.' + heading;
        }
        lines.push(heading);
        break;
      }
      case 'character':
        lines.push(content.toUpperCase());
        break;
      case 'transition':
        lines.push(`> ${content}`);
        break;
      case 'centered':
        lines.push(`> ${content} <`);
        break;
      case 'parenthetical':
        lines.push(content.startsWith('(') ? content : `(${content})`);
        break;
      case 'lyrics':
        lines.push(`~ ${content}`);
        break;
      case 'section':
        lines.push(`# ${content}`);
        break;
      case 'synopsis':
        lines.push(`= ${content}`);
        break;
      case 'page_break':
        lines.push('===');
        break;
      default:
        lines.push(content);
        break;
    }

    prevType = el.element_type || null;
  }

  return lines.join('\n') + '\n';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
