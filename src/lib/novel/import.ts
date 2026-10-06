/**
 * Import an existing manuscript (plain text or Markdown) into binder items.
 * Chapters are split on headings: Markdown `#`/`##`, or lines like
 * "Chapter 3", "CHAPTER THREE: The Flood", "Prologue", "Part Two".
 */

import type { NovelItemKind } from '@/lib/types';
import { escapeXml } from './text';

export interface ImportedSection {
  kind: NovelItemKind;
  title: string;
  /** Manuscript HTML (see lib/novel/text.ts). */
  content: string;
}

const NUMBER = '(?:\\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?';
const CHAPTER_RE = new RegExp(`^(?:chapter|ch\\.)\\s+${NUMBER}\\b\\s*[:.\\-—–]?\\s*(.*)$`, 'i');
const PART_RE = new RegExp(`^(?:part|book)\\s+${NUMBER}\\b\\s*[:.\\-—–]?\\s*(.*)$`, 'i');
const FRONT = /^(prologue|foreword|preface|dedication|epigraph|introduction)\b\s*[:.\-—–]?\s*(.*)$/i;
const BACK = /^(epilogue|afterword|acknowledg(?:e)?ments|about the author|author'?s note|glossary|appendix)\b\s*[:.\-—–]?\s*(.*)$/i;
const SCENE_BREAK = /^\s*(?:\*\s*\*\s*\*|#{1}|~+|-{3,}|_{3,}|⁂|•\s*•\s*•|\*{3,})\s*$/;

/** Inline Markdown (bold, italics, strikethrough) to manuscript HTML. */
function inline(text: string): string {
  return escapeXml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^\s*](?:[^*]*?[^\s*])?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^\s_](?:[^_]*?[^\s_])?)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>');
}

function classify(line: string): { kind: NovelItemKind; title: string } | null {
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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

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
    const heading = classify(trimmed);
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
