/**
 * Script Import/Export Library
 * Handles FDX (Final Draft) and Fountain format parsing and generation.
 */

import type { ScriptElement, ScriptElementType, TitlePageData } from './types';

// ============================================================
// Types used by parsers/generators
// ============================================================
interface ParseResult {
  titlePage: Partial<TitlePageData>;
  elements: Partial<ScriptElement>[];
}

interface GenerateFDXOptions {
  titlePage?: Partial<TitlePageData>;
  elements: ScriptElement[];
  scriptTitle?: string;
}

interface GenerateFountainOptions {
  titlePage?: Partial<TitlePageData>;
  elements: ScriptElement[];
}

// ============================================================
// XML Helpers
// ============================================================
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Simple XML text extraction — gets inner text of a tag
function getTagContent(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? unescapeXml(match[1].trim()) : '';
}

function getAllTagContents(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

function getAttr(tag: string, attr: string): string {
  const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
  const match = tag.match(regex);
  return match ? match[1] : '';
}

// ============================================================
// FDX (Final Draft) Parser
// ============================================================

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
  'Lyrics': 'action',
  'New Act': 'transition',
  'End of Act': 'transition',
};

export function parseFDX(xml: string): ParseResult {
  const titlePage: Partial<TitlePageData> = {};
  const elements: Partial<ScriptElement>[] = [];

  // Parse title page
  const titlePageMatch = xml.match(/<TitlePage>([\s\S]*?)<\/TitlePage>/i);
  if (titlePageMatch) {
    const tp = titlePageMatch[1];
    // FDX title page has <Content> elements inside <HeaderAndFooter> or direct <Paragraph>
    const paragraphs = getAllTagContents(tp, 'Paragraph');
    for (const p of paragraphs) {
      const text = getAllTagContents(p, 'Text').map(t => unescapeXml(t.replace(/<[^>]*>/g, ''))).join('').trim();
      if (!text) continue;
      // Heuristic: first non-empty is title, next with "by"/"written" is credit, next is author
      if (!titlePage.title) {
        titlePage.title = text;
      } else if (!titlePage.credit && /^(written by|by|screenplay by|based on)/i.test(text)) {
        titlePage.credit = text;
      } else if (!titlePage.author && titlePage.credit) {
        titlePage.author = text;
      } else if (!titlePage.draft_date && /draft|revision|date/i.test(text)) {
        titlePage.draft_date = text;
      } else if (!titlePage.contact) {
        titlePage.contact = text;
      }
    }
  }

  // Parse paragraphs (main content)
  const paragraphRegex = /<Paragraph[^>]*>([\s\S]*?)<\/Paragraph>/gi;
  let match;
  let sortOrder = 0;
  let currentSceneNumber: string | null = null;

  while ((match = paragraphRegex.exec(xml)) !== null) {
    // Skip title page paragraphs
    if (titlePageMatch && match.index < (titlePageMatch.index || 0) + titlePageMatch[0].length &&
        match.index >= (titlePageMatch.index || 0)) continue;

    const paragraphTag = xml.substring(match.index, xml.indexOf('>', match.index) + 1);
    const inner = match[1];

    // Get paragraph type
    const typeAttr = getAttr(paragraphTag, 'Type');
    const elementType = FDX_TYPE_MAP[typeAttr] || 'action';

    // Extract text content from <Text> tags
    const textParts = getAllTagContents(inner, 'Text');
    let content = textParts.map(t => unescapeXml(t.replace(/<[^>]*>/g, ''))).join('').trim();

    if (!content && elementType !== 'action') continue;

    // Extract scene number
    const sceneProps = inner.match(/<SceneProperties[^>]*>/i);
    if (sceneProps) {
      const num = getAttr(sceneProps[0], 'Number');
      if (num) currentSceneNumber = num;
    }

    if (elementType === 'scene_heading') {
      // Check for scene number in the heading text
      const sceneNumMatch = content.match(/^(\d+[A-Z]?)\s+/);
      if (sceneNumMatch) {
        currentSceneNumber = sceneNumMatch[1];
      }
    }

    elements.push({
      element_type: elementType,
      content,
      sort_order: sortOrder++,
      scene_number: elementType === 'scene_heading' ? currentSceneNumber : null,
    });
  }

  return { titlePage, elements };
}

// ============================================================
// FDX (Final Draft) Generator
// ============================================================

const ELEMENT_TO_FDX: Record<ScriptElementType, string> = {
  scene_heading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
  shot: 'Shot',
  note: 'Action',
  page_break: 'Action',
  title_page: 'Action',
  centered: 'Action',
  lyrics: 'Action',
  synopsis: 'Action',
  section: 'Action',
  // Content creator types → Action
  hook: 'Action',
  talking_point: 'Action',
  broll_note: 'Action',
  cta: 'Action',
  sponsor_read: 'Action',
  chapter_marker: 'Action',
};

export function generateFDX({ titlePage, elements, scriptTitle }: GenerateFDXOptions): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<FinalDraft DocumentType="Script" Template="No" Version="4">\n';

  // Title page
  xml += '  <TitlePage>\n';
  xml += '    <Content>\n';
  if (titlePage?.title) {
    xml += `      <Paragraph Alignment="Center" SpaceBefore="288">\n`;
    xml += `        <Text Style="AllCaps+Bold">${escapeXml(titlePage.title)}</Text>\n`;
    xml += '      </Paragraph>\n';
  }
  if (titlePage?.credit) {
    xml += '      <Paragraph Alignment="Center" SpaceBefore="24">\n';
    xml += `        <Text>${escapeXml(titlePage.credit)}</Text>\n`;
    xml += '      </Paragraph>\n';
  }
  if (titlePage?.author) {
    xml += '      <Paragraph Alignment="Center" SpaceBefore="24">\n';
    xml += `        <Text>${escapeXml(titlePage.author)}</Text>\n`;
    xml += '      </Paragraph>\n';
  }
  if (titlePage?.draft_date) {
    xml += '      <Paragraph Alignment="Left" SpaceBefore="576">\n';
    xml += `        <Text>${escapeXml(titlePage.draft_date)}</Text>\n`;
    xml += '      </Paragraph>\n';
  }
  if (titlePage?.contact) {
    xml += '      <Paragraph Alignment="Left" SpaceBefore="24">\n';
    xml += `        <Text>${escapeXml(titlePage.contact)}</Text>\n`;
    xml += '      </Paragraph>\n';
  }
  if (titlePage?.copyright) {
    xml += '      <Paragraph Alignment="Left" SpaceBefore="24">\n';
    xml += `        <Text>${escapeXml(titlePage.copyright)}</Text>\n`;
    xml += '      </Paragraph>\n';
  }
  xml += '    </Content>\n';
  xml += '  </TitlePage>\n';

  // Content
  xml += '  <Content>\n';
  for (const el of elements) {
    if (el.is_omitted) continue;
    const fdxType = ELEMENT_TO_FDX[el.element_type] || 'Action';
    const content = escapeXml(el.content || '');
    xml += `    <Paragraph Type="${fdxType}">\n`;
    if (el.element_type === 'scene_heading' && el.scene_number) {
      xml += `      <SceneProperties Number="${escapeXml(el.scene_number)}" />\n`;
    }
    xml += `      <Text>${content}</Text>\n`;
    xml += '    </Paragraph>\n';
  }
  xml += '  </Content>\n';

  xml += '</FinalDraft>\n';
  return xml;
}

// ============================================================
// Fountain Parser
// ============================================================

export function parseFountain(text: string): ParseResult {
  const titlePage: Partial<TitlePageData> = {};
  const elements: Partial<ScriptElement>[] = [];

  // Split into lines
  const lines = text.split('\n');
  let lineIndex = 0;

  // Parse title page (key: value pairs at the top, before any blank line followed by content)
  const titlePageLines: string[] = [];
  let inTitlePage = false;

  // Check for title page (starts with "Title:", "Credit:", "Author:", etc.)
  if (lines.length > 0 && /^(Title|Credit|Author|Source|Draft date|Contact|Copyright|Notes)\s*:/i.test(lines[0])) {
    inTitlePage = true;
    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      if (line.trim() === '' && lineIndex > 0 && lines[lineIndex - 1].trim() === '') {
        lineIndex++;
        break;
      }
      titlePageLines.push(line);
      lineIndex++;
      // If we hit a blank line followed by a non-key line, we're done
      if (line.trim() === '') {
        if (lineIndex < lines.length && !/^\s/.test(lines[lineIndex]) && !/^(Title|Credit|Author|Source|Draft date|Contact|Copyright|Notes)\s*:/i.test(lines[lineIndex])) {
          break;
        }
      }
    }
  }

  // Parse title page key-value pairs
  if (inTitlePage) {
    let currentKey = '';
    let currentValue = '';
    for (const line of titlePageLines) {
      const kvMatch = line.match(/^(Title|Credit|Author|Source|Draft date|Contact|Copyright|Notes)\s*:\s*(.*)/i);
      if (kvMatch) {
        if (currentKey) {
          assignTitlePageField(titlePage, currentKey, currentValue.trim());
        }
        currentKey = kvMatch[1].toLowerCase();
        currentValue = kvMatch[2];
      } else if (currentKey && /^\s/.test(line)) {
        // Continuation line
        currentValue += '\n' + line.trim();
      }
    }
    if (currentKey) {
      assignTitlePageField(titlePage, currentKey, currentValue.trim());
    }
  }

  // Parse body
  let sortOrder = 0;
  let sceneNumber = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    // Skip blank lines
    if (trimmed === '') {
      lineIndex++;
      continue;
    }

    // Page break
    if (trimmed === '===') {
      elements.push({ element_type: 'page_break', content: '', sort_order: sortOrder++ });
      lineIndex++;
      continue;
    }

    // Section headers
    if (/^#{1,6}\s/.test(trimmed)) {
      elements.push({ element_type: 'section', content: trimmed.replace(/^#+\s*/, ''), sort_order: sortOrder++ });
      lineIndex++;
      continue;
    }

    // Synopsis
    if (trimmed.startsWith('=') && !trimmed.startsWith('===')) {
      elements.push({ element_type: 'synopsis', content: trimmed.substring(1).trim(), sort_order: sortOrder++ });
      lineIndex++;
      continue;
    }

    // Centered text
    if (trimmed.startsWith('>') && trimmed.endsWith('<')) {
      elements.push({ element_type: 'centered', content: trimmed.slice(1, -1).trim(), sort_order: sortOrder++ });
      lineIndex++;
      continue;
    }

    // Scene heading — forced with "." or matches INT/EXT pattern
    if (trimmed.startsWith('.') && trimmed.length > 1 && !trimmed.startsWith('..')) {
      sceneNumber++;
      const content = trimmed.substring(1).trim();
      const snMatch = content.match(/^(.+?)\s*#(\d+[A-Za-z]?)#\s*$/);
      elements.push({
        element_type: 'scene_heading',
        content: snMatch ? snMatch[1].trim() : content,
        scene_number: snMatch ? snMatch[2] : String(sceneNumber),
        sort_order: sortOrder++,
      });
      lineIndex++;
      continue;
    }

    if (/^(INT|EXT|INT\.?\/?EXT|EXT\.?\/?INT|I\.?\/?E|E\.?\/?I)[\.\s]/i.test(trimmed)) {
      sceneNumber++;
      const snMatch = trimmed.match(/^(.+?)\s*#(\d+[A-Za-z]?)#\s*$/);
      elements.push({
        element_type: 'scene_heading',
        content: snMatch ? snMatch[1].trim() : trimmed,
        scene_number: snMatch ? snMatch[2] : String(sceneNumber),
        sort_order: sortOrder++,
      });
      lineIndex++;
      continue;
    }

    // Transition — forced with ">" or ends with "TO:"
    if (trimmed.startsWith('>') && !trimmed.endsWith('<')) {
      elements.push({ element_type: 'transition', content: trimmed.substring(1).trim(), sort_order: sortOrder++ });
      lineIndex++;
      continue;
    }

    if (/^[A-Z\s]+TO:$/.test(trimmed)) {
      elements.push({ element_type: 'transition', content: trimmed, sort_order: sortOrder++ });
      lineIndex++;
      continue;
    }

    // Note
    if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
      elements.push({ element_type: 'note', content: trimmed.slice(2, -2).trim(), sort_order: sortOrder++ });
      lineIndex++;
      continue;
    }

    // Character — all caps line (possibly forced with @), followed by dialogue
    const isForceChar = trimmed.startsWith('@');
    const charName = isForceChar ? trimmed.substring(1).trim() : trimmed;
    const isCharLine = isForceChar || (
      /^[A-Z][A-Z0-9 .'\-]+(\s*\(.*\))?$/.test(charName) &&
      charName.length > 1 &&
      lineIndex + 1 < lines.length &&
      lines[lineIndex + 1].trim() !== ''
    );

    if (isCharLine) {
      elements.push({ element_type: 'character', content: charName, sort_order: sortOrder++ });
      lineIndex++;

      // Consume following parenthetical and dialogue lines
      while (lineIndex < lines.length) {
        const nextLine = lines[lineIndex];
        const nextTrimmed = nextLine.trim();
        if (nextTrimmed === '') break;

        if (nextTrimmed.startsWith('(') && nextTrimmed.endsWith(')')) {
          elements.push({ element_type: 'parenthetical', content: nextTrimmed, sort_order: sortOrder++ });
        } else {
          elements.push({ element_type: 'dialogue', content: nextTrimmed, sort_order: sortOrder++ });
        }
        lineIndex++;
      }
      continue;
    }

    // Action (default)
    elements.push({ element_type: 'action', content: trimmed, sort_order: sortOrder++ });
    lineIndex++;
  }

  return { titlePage, elements };
}

function assignTitlePageField(tp: Partial<TitlePageData>, key: string, value: string) {
  switch (key) {
    case 'title': tp.title = value; break;
    case 'credit': tp.credit = value; break;
    case 'author': tp.author = value; break;
    case 'source': tp.source = value; break;
    case 'draft date': tp.draft_date = value; break;
    case 'contact': tp.contact = value; break;
    case 'copyright': tp.copyright = value; break;
    case 'notes': tp.notes = value; break;
  }
}

// ============================================================
// Fountain Generator
// ============================================================

export function generateFountain({ titlePage, elements }: GenerateFountainOptions): string {
  let output = '';

  // Title page
  if (titlePage && (titlePage.title || titlePage.author)) {
    if (titlePage.title) output += `Title: ${titlePage.title}\n`;
    if (titlePage.credit) output += `Credit: ${titlePage.credit}\n`;
    if (titlePage.author) output += `Author: ${titlePage.author}\n`;
    if (titlePage.source) output += `Source: ${titlePage.source}\n`;
    if (titlePage.draft_date) output += `Draft date: ${titlePage.draft_date}\n`;
    if (titlePage.contact) output += `Contact: ${titlePage.contact}\n`;
    if (titlePage.copyright) output += `Copyright: ${titlePage.copyright}\n`;
    if (titlePage.notes) output += `Notes: ${titlePage.notes}\n`;
    output += '\n';
  }

  let prevType: ScriptElementType | null = null;
  for (const el of elements) {
    if (el.is_omitted) continue;
    const content = (el.content || '').trim();
    if (!content && el.element_type !== 'page_break') continue;

    switch (el.element_type) {
      case 'scene_heading': {
        output += '\n';
        // Check if content already starts with INT/EXT
        if (/^(INT|EXT|INT\.?\/?EXT|EXT\.?\/?INT)/i.test(content)) {
          output += content;
        } else {
          output += `.${content}`;
        }
        if (el.scene_number) {
          output += ` #${el.scene_number}#`;
        }
        output += '\n\n';
        break;
      }

      case 'action':
        if (prevType !== 'scene_heading') output += '\n';
        output += content + '\n';
        break;

      case 'character':
        output += '\n' + content.toUpperCase() + '\n';
        break;

      case 'parenthetical':
        output += content + '\n';
        break;

      case 'dialogue':
        output += content + '\n';
        break;

      case 'transition':
        output += '\n> ' + content + '\n\n';
        break;

      case 'centered':
        output += '\n>' + content + '<\n\n';
        break;

      case 'note':
        output += '\n[[' + content + ']]\n';
        break;

      case 'page_break':
        output += '\n===\n\n';
        break;

      case 'section':
        output += '\n# ' + content + '\n\n';
        break;

      case 'synopsis':
        output += '\n= ' + content + '\n\n';
        break;

      case 'lyrics':
        output += '\n~' + content + '\n';
        break;

      // Content creator types — output as action with a label prefix
      case 'hook':
        output += '\n[HOOK] ' + content + '\n';
        break;
      case 'talking_point':
        output += '\n[TALKING POINT] ' + content + '\n';
        break;
      case 'broll_note':
        output += '\n[B-ROLL] ' + content + '\n';
        break;
      case 'cta':
        output += '\n[CTA] ' + content + '\n';
        break;
      case 'sponsor_read':
        output += '\n[SPONSOR] ' + content + '\n';
        break;
      case 'chapter_marker':
        output += '\n# ' + content + '\n\n';
        break;

      default:
        output += content + '\n';
        break;
    }

    prevType = el.element_type;
  }

  return output.trim() + '\n';
}
