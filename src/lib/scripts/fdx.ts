/**
 * FDX (Final Draft) Import / Export
 *
 * Handles parsing and generating .fdx XML files (Final Draft 8+ format).
 * Supports title page data, all standard screenplay element types,
 * scene numbers, revision colors, and dual dialogue.
 */

import type { ScriptElement, ScriptElementType, TitlePageData } from '@/lib/types';

// ============================================================
// FDX Element Type Mapping
// ============================================================

const FDX_TO_ELEMENT: Record<string, ScriptElementType> = {
  'Scene Heading': 'scene_heading',
  'Action': 'action',
  'Character': 'character',
  'Dialogue': 'dialogue',
  'Parenthetical': 'parenthetical',
  'Transition': 'transition',
  'Shot': 'shot',
  'General': 'action',
  'Cast List': 'action',
  'Lyrics': 'lyrics',
  'New Act': 'section',
  'End of Act': 'section',
  'Scene Number': 'scene_heading',
};

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
  lyrics: 'Lyrics',
  synopsis: 'Action',
  section: 'New Act',
  // YouTube/Content Creator elements (map to Action in FDX)
  hook: 'Action',
  talking_point: 'Action',
  broll_note: 'Action',
  cta: 'Action',
  sponsor_read: 'Action',
  chapter_marker: 'Action',
  // Audio Drama elements → nearest FDX equivalent
  sfx_cue: 'Action',
  music_cue: 'Action',
  ambience_cue: 'Action',
  sound_cue: 'Action',
  act_break: 'Scene Heading',
  announcer: 'Character',
  // Stage play elements → nearest FDX equivalent
  song_title: 'Scene Heading',
  lyric: 'Lyrics',
  dance_direction: 'Action',
  musical_cue: 'Action',
  lighting_cue: 'Action',
  set_direction: 'Action',
  // Screenplay act heading
  act: 'New Act',
};

// ============================================================
// FDX Import
// ============================================================

export interface FDXImportResult {
  titlePage: TitlePageData;
  elements: Partial<ScriptElement>[];
  metadata: {
    fdxVersion?: string;
    generator?: string;
  };
}

/**
 * Parse an FDX XML string into script elements and title page data.
 */
export function parseFDX(xmlString: string): FDXImportResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid FDX file: ' + parseError.textContent?.slice(0, 200));
  }

  const root = doc.documentElement;
  const fdxVersion = root.getAttribute('Version') || undefined;

  // --- Title Page ---
  const titlePage: TitlePageData = {};
  const titlePageNode = doc.querySelector('TitlePage');
  if (titlePageNode) {
    const headerDefs = titlePageNode.querySelectorAll('HeaderAndFooter Content Paragraph');
    headerDefs.forEach((para) => {
      const text = getTextFromParagraph(para);
      if (!text) return;
      // Final Draft puts title page elements as Content paragraphs
      // Try to infer which field it belongs to
    });

    // Also check for TitlePage > Content elements
    const contentNodes = titlePageNode.querySelectorAll('Content');
    contentNodes.forEach((content) => {
      const paras = content.querySelectorAll('Paragraph');
      const texts: string[] = [];
      paras.forEach((p) => {
        const t = getTextFromParagraph(p);
        if (t) texts.push(t);
      });

      const location = content.getAttribute('Location');
      if (location === 'Header') {
        // Title is usually the first large text
        if (texts.length > 0 && !titlePage.title) {
          titlePage.title = texts[0];
        }
        if (texts.length > 1) {
          // Check for "written by" / "by" pattern
          const creditIdx = texts.findIndex((t) =>
            /^(written by|screenplay by|by|teleplay by|story by)/i.test(t.trim())
          );
          if (creditIdx >= 0) {
            titlePage.credit = texts[creditIdx];
            if (texts[creditIdx + 1]) {
              titlePage.author = texts[creditIdx + 1];
            }
          } else if (texts.length > 1 && !titlePage.author) {
            titlePage.author = texts[1];
          }
        }
        if (texts.length > 2) {
          const sourceIdx = texts.findIndex((t) =>
            /^(based on|adapted from|source)/i.test(t.trim())
          );
          if (sourceIdx >= 0) {
            titlePage.source = texts[sourceIdx];
          }
        }
      } else if (location === 'Footer') {
        texts.forEach((t) => {
          if (/draft|date/i.test(t) && !titlePage.draft_date) {
            titlePage.draft_date = t;
          } else if (/(contact|address|phone|email|©|copyright)/i.test(t)) {
            if (/©|copyright/i.test(t)) {
              titlePage.copyright = t;
            } else {
              titlePage.contact = (titlePage.contact ? titlePage.contact + '\n' : '') + t;
            }
          } else if (!titlePage.contact) {
            titlePage.contact = t;
          }
        });
      }
    });
  }

  // Fallback: look for SmartType > TitlePage children
  const smartTitlePage = doc.querySelector('SmartType TitlePage');
  if (smartTitlePage) {
    const titleEl = smartTitlePage.querySelector('Title');
    const authorEl = smartTitlePage.querySelector('Author');
    const creditEl = smartTitlePage.querySelector('Credit');
    if (titleEl?.textContent && !titlePage.title) titlePage.title = titleEl.textContent;
    if (authorEl?.textContent && !titlePage.author) titlePage.author = authorEl.textContent;
    if (creditEl?.textContent && !titlePage.credit) titlePage.credit = creditEl.textContent;
  }

  // --- Script Elements ---
  const elements: Partial<ScriptElement>[] = [];
  const paragraphs = doc.querySelectorAll('Content > Paragraph');
  let sortOrder = 0;
  let sceneCount = 0;

  paragraphs.forEach((para) => {
    const fdxType = para.getAttribute('Type') || 'Action';
    const elementType = FDX_TO_ELEMENT[fdxType] || 'action';
    const content = getTextFromParagraph(para);

    // Scene number from attributes
    let sceneNumber: string | null = null;
    const sceneNumAttr = para.getAttribute('Number');
    if (sceneNumAttr) {
      sceneNumber = sceneNumAttr;
    } else if (elementType === 'scene_heading') {
      sceneCount++;
      sceneNumber = String(sceneCount);
    }

    // Revision color
    const revColor = para.getAttribute('Color');

    const element: Partial<ScriptElement> = {
      element_type: elementType,
      content: content || '',
      sort_order: sortOrder++,
      scene_number: sceneNumber,
    };

    if (revColor) {
      element.metadata = { fdx_revision_color: revColor };
    }

    // Check for dual dialogue
    const dualDialogue = para.getAttribute('DualDialogue');
    if (dualDialogue) {
      element.metadata = { ...element.metadata, dual_dialogue: dualDialogue };
    }

    elements.push(element);
  });

  return {
    titlePage,
    elements,
    metadata: {
      fdxVersion,
      generator: doc.querySelector('FinalDraft')?.getAttribute('DocumentType') || undefined,
    },
  };
}

// ============================================================
// FDX Export
// ============================================================

export interface FDXExportOptions {
  titlePage?: TitlePageData;
  elements: ScriptElement[];
  scriptTitle?: string;
}

/**
 * Generate an FDX XML string from script elements and title page data.
 */
export function generateFDX(options: FDXExportOptions): string {
  const { titlePage, elements, scriptTitle } = options;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  lines.push('<FinalDraft DocumentType="Script" Template="No" Version="5">');

  // --- Title Page ---
  if (titlePage && (titlePage.title || titlePage.author)) {
    lines.push('  <TitlePage>');

    // Header content (title, credit, author)
    lines.push('    <Content Location="Header">');
    if (titlePage.title) {
      lines.push(`      <Paragraph Alignment="Center" SpaceBefore="288" StartsNewPage="Yes">`);
      lines.push(`        <Text Style="Bold+UnderLine">${escapeXml(titlePage.title)}</Text>`);
      lines.push('      </Paragraph>');
    }
    if (titlePage.credit) {
      lines.push('      <Paragraph Alignment="Center" SpaceBefore="24">');
      lines.push(`        <Text>${escapeXml(titlePage.credit)}</Text>`);
      lines.push('      </Paragraph>');
    }
    if (titlePage.author) {
      lines.push('      <Paragraph Alignment="Center" SpaceBefore="12">');
      lines.push(`        <Text>${escapeXml(titlePage.author)}</Text>`);
      lines.push('      </Paragraph>');
    }
    if (titlePage.source) {
      lines.push('      <Paragraph Alignment="Center" SpaceBefore="24">');
      lines.push(`        <Text>${escapeXml(titlePage.source)}</Text>`);
      lines.push('      </Paragraph>');
    }
    lines.push('    </Content>');

    // Footer content (draft date, contact, copyright)
    const hasFooter = titlePage.draft_date || titlePage.contact || titlePage.copyright;
    if (hasFooter) {
      lines.push('    <Content Location="Footer">');
      if (titlePage.draft_date) {
        lines.push('      <Paragraph Alignment="Left">');
        lines.push(`        <Text>${escapeXml(titlePage.draft_date)}</Text>`);
        lines.push('      </Paragraph>');
      }
      if (titlePage.copyright) {
        lines.push('      <Paragraph Alignment="Left" SpaceBefore="12">');
        lines.push(`        <Text>${escapeXml(titlePage.copyright)}</Text>`);
        lines.push('      </Paragraph>');
      }
      if (titlePage.contact) {
        lines.push('      <Paragraph Alignment="Left" SpaceBefore="12">');
        lines.push(`        <Text>${escapeXml(titlePage.contact)}</Text>`);
        lines.push('      </Paragraph>');
      }
      lines.push('    </Content>');
    }

    lines.push('  </TitlePage>');
  }

  // --- Script Content ---
  lines.push('  <Content>');

  for (const el of elements) {
    const fdxType = ELEMENT_TO_FDX[el.element_type] || 'Action';
    const attrs: string[] = [`Type="${fdxType}"`];

    if (el.scene_number) {
      attrs.push(`Number="${escapeXml(el.scene_number)}"`);
    }

    if (el.metadata?.dual_dialogue) {
      attrs.push(`DualDialogue="${el.metadata.dual_dialogue}"`);
    }

    lines.push(`    <Paragraph ${attrs.join(' ')}>`);
    lines.push(`      <Text>${escapeXml(el.content || '')}</Text>`);
    lines.push('    </Paragraph>');
  }

  lines.push('  </Content>');
  lines.push('</FinalDraft>');

  return lines.join('\n');
}

// ============================================================
// Helpers
// ============================================================

function getTextFromParagraph(para: Element): string {
  const texts: string[] = [];
  const textNodes = para.querySelectorAll('Text');
  textNodes.forEach((t) => {
    if (t.textContent) texts.push(t.textContent);
  });
  return texts.join('');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
