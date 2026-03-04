/**
 * Client-side parsers for common screenplay file formats.
 *
 * Supported:
 *  .fountain  — Fountain plain-text screenplay format
 *  .fdx       — Final Draft XML
 *  .txt       — plain text (returned as-is)
 *  .pdf       — binary; must be uploaded to storage, cannot be parsed here
 */

import type { ScriptElementType } from '@/lib/types';

export interface ParsedElement {
  element_type: ScriptElementType;
  content: string;
  scene_number?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fountain parser
// Based on the Fountain specification: https://fountain.io/syntax
// ─────────────────────────────────────────────────────────────────────────────

function isAllUpperCase(s: string): boolean {
  const cleaned = s.replace(/[^A-Za-z]/g, '');
  return cleaned.length > 0 && cleaned === cleaned.toUpperCase();
}

/**
 * Parse a Fountain (.fountain) script into ScreenplayElements.
 * Fountain uses blank-line-separated "blocks"; element type is inferred
 * from the content of the first line.
 */
export function parseFountain(text: string): ParsedElement[] {
  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into blocks (paragraphs) — separated by one or more blank lines.
  const rawBlocks: string[] = [];
  let current: string[] = [];
  for (const line of normalized.split('\n')) {
    if (line.trim() === '') {
      if (current.length > 0) {
        rawBlocks.push(current.join('\n'));
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) rawBlocks.push(current.join('\n'));

  const elements: ParsedElement[] = [];
  let sceneIndex = 1;

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n').map((l) => l.trim());
    const first = lines[0];

    // ── Skip directives ──────────────────────────────────────────────────────
    // Boneyard / inline notes / section headings / synopses / page breaks
    if (/^={3,}$/.test(trimmed)) continue;                 // page break
    if (first.startsWith('/*') || first.endsWith('*/')) continue; // boneyard
    if (first.startsWith('[[') || first.endsWith(']]')) continue; // note
    if (first.startsWith('#')) continue;                   // section heading
    if (first.startsWith('= ')) continue;                  // synopsis

    // ── Title page keys (e.g. "Title:", "Author:") ───────────────────────────
    if (/^(Title|Credit|Author|Source|Draft date|Contact|Copyright|Notes):/i.test(first)) {
      elements.push({ element_type: 'title_page', content: trimmed });
      continue;
    }

    // ── Scene heading ─────────────────────────────────────────────────────────
    // Forced: .SOMETHING
    if (first.startsWith('.') && !first.startsWith('..')) {
      elements.push({
        element_type: 'scene_heading',
        content: first.slice(1).trim() + (lines.length > 1 ? '\n' + lines.slice(1).join('\n') : ''),
        scene_number: String(sceneIndex++),
      });
      continue;
    }
    // Standard INT./EXT./EST. etc. (case-insensitive per spec, but almost always uppercase)
    if (/^(INT|EXT|EST|INT\.\/EXT|EXT\.\/INT|INT\/EXT|EXT\/INT|I\/E)[\.\s:]/i.test(first)) {
      elements.push({
        element_type: 'scene_heading',
        content: trimmed,
        scene_number: String(sceneIndex++),
      });
      continue;
    }

    // ── Transition ────────────────────────────────────────────────────────────
    // Explicit: "> CUT TO:" (without trailing < which means centered)
    if (first.startsWith('>') && !trimmed.endsWith('<')) {
      elements.push({ element_type: 'transition', content: first.slice(1).trim() });
      continue;
    }
    // Standard transitions: all caps, ending with TO: or just FADE OUT / FADE IN
    if (
      /^[A-Z\s\/]+TO:$/.test(trimmed) ||
      /^(FADE OUT|FADE IN|SMASH CUT|HARD CUT|MATCH CUT|JUMP CUT)\.?$/.test(trimmed)
    ) {
      elements.push({ element_type: 'transition', content: trimmed });
      continue;
    }

    // ── Centered text ">text<" ────────────────────────────────────────────────
    if (first.startsWith('>') && trimmed.endsWith('<')) {
      elements.push({ element_type: 'centered', content: trimmed.slice(1, -1).trim() });
      continue;
    }

    // ── Lyrics ────────────────────────────────────────────────────────────────
    if (first.startsWith('~')) {
      const lyricLines = lines.map((l) => (l.startsWith('~') ? l.slice(1).trim() : l)).join('\n');
      elements.push({ element_type: 'lyrics', content: lyricLines });
      continue;
    }

    // ── Forced character: @NAME ───────────────────────────────────────────────
    if (first.startsWith('@')) {
      const charName = first.slice(1).trim();
      elements.push({ element_type: 'character', content: charName });
      _pushDialogueLines(lines.slice(1), elements);
      continue;
    }

    // ── Character + dialogue block ────────────────────────────────────────────
    // In Fountain, a character block is identified by the first line being:
    //  - ALL CAPS (optionally ending with ^ for dual dialogue)
    //  - At least 2 characters long
    //  - NOT ending with a colon (that would be a transition or label)
    //  - Followed by at least one other line in the same block (the dialogue)
    const charCandidate = first.replace(/\s*\^$/, ''); // strip dual-marker
    if (
      lines.length > 1 &&
      isAllUpperCase(charCandidate) &&
      charCandidate.length > 1 &&
      !charCandidate.endsWith(':')
    ) {
      elements.push({ element_type: 'character', content: first.replace(/\s*\^$/, '').trim() });
      _pushDialogueLines(lines.slice(1), elements);
      continue;
    }

    // ── Default: action ───────────────────────────────────────────────────────
    // Strip leading "!" (forced action marker)
    const actionContent = first.startsWith('!') ? first.slice(1) + (lines.length > 1 ? '\n' + lines.slice(1).join('\n') : '') : trimmed;
    elements.push({ element_type: 'action', content: actionContent });
  }

  return elements;
}

/** Push dialogue / parenthetical lines that follow a character cue. */
function _pushDialogueLines(lines: string[], out: ParsedElement[]): void {
  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    if (t.startsWith('(') && t.endsWith(')')) {
      out.push({ element_type: 'parenthetical', content: t });
    } else {
      out.push({ element_type: 'dialogue', content: t });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Final Draft (.fdx) parser
// FDX is XML — <Paragraph Type="Scene Heading"><Text>...</Text></Paragraph>
// ─────────────────────────────────────────────────────────────────────────────

const FDX_TYPE_MAP: Record<string, ScriptElementType> = {
  'Scene Heading': 'scene_heading',
  'Action': 'action',
  'Character': 'character',
  'Dialogue': 'dialogue',
  'Parenthetical': 'parenthetical',
  'Transition': 'transition',
  'Shot': 'shot',
  'General': 'action',
  'Cast List': 'action',
  'More': 'action',
  'Centered': 'centered',
  'Lyrics': 'lyrics',
};

/**
 * Parse a Final Draft XML (.fdx) string into ScreenplayElements.
 * Uses the browser's DOMParser — must be called client-side.
 */
export function parseFdx(xmlText: string): ParsedElement[] {
  const elements: ParsedElement[] = [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  // Detect parse errors
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) {
    throw new Error('Invalid FDX XML: ' + (parseErr.textContent || 'unknown error'));
  }

  let sceneIndex = 1;

  // FDX v1 / v2: paragraphs live directly under <Content>
  // Some documents nest them inside <Scene> or other containers — querySelectorAll finds them all.
  const paragraphs = Array.from(doc.querySelectorAll('Paragraph'));

  for (const para of paragraphs) {
    const type = para.getAttribute('Type') || 'General';

    // Collect all <Text> node content, preserving inline bold/italic etc. as plain text
    const textNodes = Array.from(para.querySelectorAll('Text'));
    const content = textNodes.map((t) => t.textContent ?? '').join('').trim();

    if (!content) continue; // skip empty paragraphs

    const elementType: ScriptElementType = FDX_TYPE_MAP[type] ?? 'action';

    if (elementType === 'scene_heading') {
      elements.push({ element_type: 'scene_heading', content, scene_number: String(sceneIndex++) });
    } else {
      elements.push({ element_type: elementType, content });
    }
  }

  return elements;
}

// ─────────────────────────────────────────────────────────────────────────────
// Highland 2 (.highland) — actually a ZIP containing a .fountain file
// We can't unzip client-side without a library, so we reject it with a hint.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// File info helpers
// ─────────────────────────────────────────────────────────────────────────────

export type UploadableFormat = 'fountain' | 'fdx' | 'txt' | 'pdf';

export const FORMAT_LABELS: Record<UploadableFormat, string> = {
  fountain: 'Fountain',
  fdx: 'Final Draft',
  txt: 'Plain Text',
  pdf: 'PDF',
};

export const ACCEPTED_EXTENSIONS = '.fdx,.fountain,.txt,.pdf';
export const ACCEPTED_MIME =
  'application/pdf,text/plain,application/xml,text/xml,application/octet-stream';

/**
 * Return the lowercase extension of a filename, or empty string.
 */
export function fileExtension(name: string): string {
  return (name.split('.').pop() ?? '').toLowerCase();
}

/**
 * Return true if the format can be parsed into ScreenplayElements.
 * PDF cannot — it must be uploaded to storage and embedded.
 */
export function isParseable(ext: string): ext is 'fountain' | 'fdx' | 'txt' {
  return ext === 'fountain' || ext === 'fdx' || ext === 'txt';
}

/**
 * Human-readable file size (e.g. "1.2 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
