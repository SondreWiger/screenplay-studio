/**
 * Fountain Format Import / Export
 *
 * Handles parsing and generating .fountain files — the industry-standard
 * plain-text screenplay format.
 * Spec: https://fountain.io/syntax
 *
 * Supports: title page, scene headings, action, character, dialogue,
 * parenthetical, transition, centered, lyrics, notes, sections, synopsis,
 * page breaks, scene numbers, and boneyard.
 */

import type { ScriptElement, ScriptElementType, TitlePageData } from '@/lib/types';

// ============================================================
// Fountain Import
// ============================================================

export interface FountainImportResult {
  titlePage: TitlePageData;
  elements: Partial<ScriptElement>[];
}

/**
 * Parse a Fountain plain-text string into script elements and title page data.
 */
export function parseFountain(text: string): FountainImportResult {
  const titlePage: TitlePageData = {};
  const elements: Partial<ScriptElement>[] = [];

  // Normalize line endings
  let source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // --- Title Page ---
  // Title page is at the very start of the doc, key: value pairs separated by blank line
  const titlePageMatch = source.match(/^([\s\S]*?)(?:\n\n)/);
  if (titlePageMatch) {
    const block = titlePageMatch[1];
    const isTitlePageBlock = /^(title|credit|author|source|draft date|date|contact|copyright|notes|revision)\s*:/im.test(block);

    if (isTitlePageBlock) {
      // Remove title page from source
      source = source.slice(titlePageMatch[0].length);

      let currentKey = '';
      let currentValue = '';

      const flushKey = () => {
        if (!currentKey) return;
        const key = currentKey.toLowerCase().trim();
        const val = currentValue.trim();
        switch (key) {
          case 'title': titlePage.title = val; break;
          case 'credit': titlePage.credit = val; break;
          case 'author':
          case 'authors': titlePage.author = val; break;
          case 'source': titlePage.source = val; break;
          case 'draft date':
          case 'date': titlePage.draft_date = val; break;
          case 'contact': titlePage.contact = val; break;
          case 'copyright': titlePage.copyright = val; break;
          case 'notes':
          case 'revision': titlePage.notes = val; break;
        }
        currentKey = '';
        currentValue = '';
      };

      for (const line of block.split('\n')) {
        const kvMatch = line.match(/^([A-Za-z ]+?)\s*:\s*(.*)/);
        if (kvMatch) {
          flushKey();
          currentKey = kvMatch[1];
          currentValue = kvMatch[2];
        } else {
          // Continuation line (indented)
          currentValue += '\n' + line.trim();
        }
      }
      flushKey();
    }
  }

  // --- Remove boneyards (/* ... */) ---
  source = source.replace(/\/\*[\s\S]*?\*\//g, '');

  // --- Remove inline notes [[ ... ]] but preserve content as note elements ---
  const inlineNotes: string[] = [];
  source = source.replace(/\[\[([\s\S]*?)\]\]/g, (_match, content) => {
    inlineNotes.push(content.trim());
    return '';
  });

  // --- Parse lines ---
  const lines = source.split('\n');
  let sortOrder = 0;
  let sceneCount = 0;
  let i = 0;

  const pushElement = (type: ScriptElementType, content: string, sceneNumber?: string) => {
    elements.push({
      element_type: type,
      content: content.trim(),
      sort_order: sortOrder++,
      scene_number: sceneNumber || null,
    });
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
      i++;
      continue;
    }

    // === Page Break ===
    if (trimmed === '===') {
      pushElement('page_break', '');
      i++;
      continue;
    }

    // === Section (# prefix) ===
    const sectionMatch = trimmed.match(/^(#{1,6})\s*(.+)/);
    if (sectionMatch) {
      pushElement('section', sectionMatch[2]);
      i++;
      continue;
    }

    // === Synopsis (= prefix) ===
    if (trimmed.startsWith('= ')) {
      pushElement('synopsis', trimmed.slice(2));
      i++;
      continue;
    }

    // === Centered (> text <) ===
    if (trimmed.startsWith('>') && trimmed.endsWith('<')) {
      pushElement('centered', trimmed.slice(1, -1).trim());
      i++;
      continue;
    }

    // === Transition (> at start or UPPERCASE ending with TO:) ===
    if (trimmed.startsWith('>') && !trimmed.endsWith('<')) {
      pushElement('transition', trimmed.slice(1).trim());
      i++;
      continue;
    }

    // === Forced Scene Heading (. prefix) ===
    if (trimmed.startsWith('.') && !trimmed.startsWith('..')) {
      sceneCount++;
      const { text: sceneText, sceneNumber } = extractSceneNumber(trimmed.slice(1));
      pushElement('scene_heading', sceneText, sceneNumber || String(sceneCount));
      i++;
      continue;
    }

    // === Scene Heading (INT. / EXT. / etc.) ===
    const sceneHeadingPattern = /^(INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[\.\s]/i;
    if (sceneHeadingPattern.test(trimmed)) {
      sceneCount++;
      const { text: sceneText, sceneNumber } = extractSceneNumber(trimmed);
      pushElement('scene_heading', sceneText, sceneNumber || String(sceneCount));
      i++;
      continue;
    }

    // === Lyrics (~ prefix) ===
    if (trimmed.startsWith('~')) {
      pushElement('lyrics', trimmed.slice(1).trim());
      i++;
      continue;
    }

    // === Forced character (@prefix) ===
    if (trimmed.startsWith('@')) {
      pushElement('character', trimmed.slice(1).trim());
      // Next lines might be parenthetical/dialogue
      i++;
      i = parseDialogueBlock(lines, i, elements, sortOrder);
      sortOrder = elements.length;
      continue;
    }

    // === Character (ALL CAPS followed by dialogue) ===
    // A line is a character if it's all uppercase, not a scene heading,
    // and is followed by a non-empty line (dialogue or parenthetical)
    if (isCharacterLine(trimmed, lines, i)) {
      // Strip (V.O.), (O.S.), (O.C.), (CONT'D) etc. but keep them in content
      pushElement('character', trimmed);
      i++;
      i = parseDialogueBlock(lines, i, elements, sortOrder);
      sortOrder = elements.length;
      continue;
    }

    // === Transition (all caps ending with TO:) ===
    if (/^[A-Z\s]+TO:$/.test(trimmed)) {
      pushElement('transition', trimmed);
      i++;
      continue;
    }

    // === Note ===
    if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
      pushElement('note', trimmed.slice(2, -2).trim());
      i++;
      continue;
    }

    // === Default: Action ===
    // Collect consecutive non-empty lines as one action block
    let actionText = trimmed;
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !isSpecialLine(lines[i].trim())) {
      actionText += '\n' + lines[i].trim();
      i++;
    }
    pushElement('action', actionText);
  }

  // Add inline notes as note elements at the end
  for (const note of inlineNotes) {
    pushElement('note', note);
  }

  return { titlePage, elements };
}

// ============================================================
// Fountain Export
// ============================================================

export interface FountainExportOptions {
  titlePage?: TitlePageData;
  elements: ScriptElement[];
}

/**
 * Generate a Fountain plain-text string from script elements and title page data.
 */
export function generateFountain(options: FountainExportOptions): string {
  const { titlePage, elements } = options;
  const lines: string[] = [];

  // --- Title Page ---
  if (titlePage) {
    const tp: [string, string | undefined][] = [
      ['Title', titlePage.title],
      ['Credit', titlePage.credit],
      ['Author', titlePage.author],
      ['Source', titlePage.source],
      ['Draft date', titlePage.draft_date],
      ['Contact', titlePage.contact],
      ['Copyright', titlePage.copyright],
      ['Notes', titlePage.notes],
    ];
    let hasTitlePage = false;
    for (const [key, value] of tp) {
      if (value) {
        lines.push(`${key}: ${value}`);
        hasTitlePage = true;
      }
    }
    if (hasTitlePage) {
      lines.push(''); // Blank line separates title page from content
    }
  }

  // --- Elements ---
  let prevType: ScriptElementType | null = null;

  for (const el of elements) {
    const content = el.content || '';

    // Add blank line before elements (except when dialogue follows character)
    if (prevType !== null) {
      const noBlankBefore =
        (el.element_type === 'dialogue' && prevType === 'character') ||
        (el.element_type === 'parenthetical' && prevType === 'character') ||
        (el.element_type === 'dialogue' && prevType === 'parenthetical') ||
        (el.element_type === 'parenthetical' && prevType === 'dialogue');

      if (!noBlankBefore) {
        lines.push('');
      }
    }

    switch (el.element_type) {
      case 'scene_heading': {
        let heading = content.toUpperCase();
        // Only add scene number markers if present
        if (el.scene_number) {
          heading = `${heading} #${el.scene_number}#`;
        }
        // Force scene heading prefix if needed
        if (!/^(INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[\.\s]/i.test(heading)) {
          heading = '.' + heading;
        }
        lines.push(heading);
        break;
      }

      case 'action':
        lines.push(content);
        break;

      case 'character':
        lines.push(content.toUpperCase());
        break;

      case 'dialogue':
        lines.push(content);
        break;

      case 'parenthetical':
        lines.push(content.startsWith('(') ? content : `(${content})`);
        break;

      case 'transition':
        lines.push(`> ${content}`);
        break;

      case 'centered':
        lines.push(`> ${content} <`);
        break;

      case 'lyrics':
        lines.push(`~ ${content}`);
        break;

      case 'note':
        lines.push(`[[ ${content} ]]`);
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

    prevType = el.element_type;
  }

  return lines.join('\n') + '\n';
}

// ============================================================
// Helpers
// ============================================================

function extractSceneNumber(text: string): { text: string; sceneNumber: string | null } {
  // Fountain scene numbers: #number# at the end
  const match = text.match(/^(.+?)\s*#([^#]+)#\s*$/);
  if (match) {
    return { text: match[1].trim(), sceneNumber: match[2].trim() };
  }
  return { text: text.trim(), sceneNumber: null };
}

function isCharacterLine(line: string, lines: string[], index: number): boolean {
  // Must be uppercase (optionally with (V.O.) etc.)
  const stripped = line.replace(/\s*\(.*?\)\s*$/, '').trim();
  if (!stripped) return false;
  if (stripped !== stripped.toUpperCase()) return false;
  if (/^(INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[\.\s]/i.test(stripped)) return false;
  if (/TO:$/.test(stripped)) return false;

  // Must have at least one alpha char
  if (!/[A-Z]/.test(stripped)) return false;

  // Next non-empty line should exist (dialogue or parenthetical expected)
  let next = index + 1;
  while (next < lines.length && lines[next].trim() === '') next++;
  if (next >= lines.length) return false;

  // The next line should be indented or parenthetical-like
  const nextTrimmed = lines[next].trim();
  if (nextTrimmed.startsWith('(') || nextTrimmed.length > 0) return true;

  return false;
}

function parseDialogueBlock(
  lines: string[],
  startIndex: number,
  elements: Partial<ScriptElement>[],
  _sortOrder: number
): number {
  let i = startIndex;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Empty line ends dialogue block
    if (trimmed === '') {
      break;
    }

    // Parenthetical
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      elements.push({
        element_type: 'parenthetical',
        content: trimmed,
        sort_order: elements.length,
        scene_number: null,
      });
      i++;
      continue;
    }

    // Dialogue line
    elements.push({
      element_type: 'dialogue',
      content: trimmed,
      sort_order: elements.length,
      scene_number: null,
    });
    i++;
  }

  return i;
}

function isSpecialLine(line: string): boolean {
  // Check if a line starts a new structural element
  if (line === '===') return true;
  if (line.startsWith('#')) return true;
  if (line.startsWith('= ')) return true;
  if (line.startsWith('>')) return true;
  if (line.startsWith('.') && !line.startsWith('..')) return true;
  if (line.startsWith('~')) return true;
  if (line.startsWith('@')) return true;
  if (line.startsWith('[[')) return true;
  if (/^(INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[\.\s]/i.test(line)) return true;
  return false;
}
