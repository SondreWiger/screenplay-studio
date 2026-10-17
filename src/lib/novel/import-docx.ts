/**
 * Word (.docx) → manuscript sections.
 *
 * A .docx is a ZIP of XML. Paragraphs carry a style; Heading 1/2/Title (and
 * custom styles based on them, or with an outline level) mark chapters, so a
 * manuscript written in Word, Pages, Google Docs or Scrivener's DOCX export
 * comes in with its chapters. Italics, bold, underline and strikethrough are
 * kept; tracked deletions are dropped and insertions kept.
 */

import type { ProseRun } from './text';
import { splitBlocks, type ImportBlock, type ImportResult } from './import';
import { readZip } from './zip';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function parseXml(bytes: Uint8Array | undefined): Document | null {
  if (!bytes) return null;
  return new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
}

const kids = (el: Element, name: string) => Array.from(el.children).filter((c) => c.localName === name);
const kid = (el: Element | null | undefined, name: string) => (el ? kids(el, name)[0] ?? null : null);
const val = (el: Element | null) => el?.getAttributeNS(W, 'val') ?? el?.getAttribute('w:val') ?? null;
/** On/off properties such as <w:i/>, <w:i w:val="0"/>. */
const on = (el: Element | null) => !!el && !['0', 'false', 'none'].includes(String(val(el) ?? '').toLowerCase());

interface StyleInfo { heading?: number; center?: boolean; quote?: boolean; italic?: boolean; bold?: boolean }

function readStyles(doc: Document | null): Map<string, StyleInfo> {
  const raw = new Map<string, { name: string; basedOn?: string; outline?: number; center?: boolean; italic?: boolean; bold?: boolean }>();
  if (doc) {
    for (const s of Array.from(doc.getElementsByTagNameNS(W, 'style'))) {
      const id = s.getAttributeNS(W, 'styleId') ?? s.getAttribute('w:styleId');
      if (!id) continue;
      const pPr = kid(s, 'pPr');
      const rPr = kid(s, 'rPr');
      const outline = val(kid(pPr, 'outlineLvl'));
      raw.set(id, {
        name: val(kid(s, 'name')) ?? id,
        basedOn: val(kid(s, 'basedOn')) ?? undefined,
        outline: outline != null ? Number(outline) : undefined,
        center: val(kid(pPr, 'jc')) === 'center' || undefined,
        italic: on(kid(rPr, 'i')) || undefined,
        bold: on(kid(rPr, 'b')) || undefined,
      });
    }
  }
  const resolved = new Map<string, StyleInfo>();
  const resolve = (id: string, depth = 0): StyleInfo => {
    if (resolved.has(id)) return resolved.get(id)!;
    const s = raw.get(id);
    if (!s || depth > 10) return {};
    const parent = s.basedOn ? resolve(s.basedOn, depth + 1) : {};
    const name = s.name.toLowerCase();
    const m = name.match(/^heading\s*(\d)$/) || id.toLowerCase().match(/^heading(\d)$/);
    const heading = /^title$/.test(name) ? 1 : m ? Number(m[1]) : s.outline !== undefined && s.outline < 9 ? s.outline + 1 : parent.heading;
    const info: StyleInfo = {
      heading,
      center: s.center ?? parent.center,
      quote: /quote|block text|epigraph/.test(name) || parent.quote,
      italic: s.italic ?? parent.italic,
      bold: s.bold ?? parent.bold,
    };
    resolved.set(id, info);
    return info;
  };
  Array.from(raw.keys()).forEach((id) => resolve(id));
  return resolved;
}

export async function importDocx(data: ArrayBuffer | Uint8Array): Promise<ImportResult> {
  const files = await readZip(data);
  const doc = parseXml(files.get('word/document.xml'));
  if (!doc) return { format: 'docx', sections: [], warnings: ['This file is not a Word document (no word/document.xml inside).'] };
  const styles = readStyles(parseXml(files.get('word/styles.xml')));

  const blocks: ImportBlock[] = [];
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  const paragraphs = body ? Array.from(body.getElementsByTagNameNS(W, 'p')) : [];

  for (const p of paragraphs) {
    const pPr = kid(p, 'pPr');
    const style = styles.get(val(kid(pPr, 'pStyle')) ?? '') ?? styles.get('Normal') ?? {};
    const outline = val(kid(pPr, 'outlineLvl'));
    const heading = outline != null && Number(outline) < 9 ? Number(outline) + 1 : style.heading;
    const jc = val(kid(pPr, 'jc'));
    const center = jc ? jc === 'center' : !!style.center;

    const runs: ProseRun[] = [];
    const push = (text: string, r: { em?: boolean; strong?: boolean; u?: boolean; s?: boolean }, br = false) => {
      const last = runs[runs.length - 1];
      if (!br && last && !last.br && !!last.em === !!r.em && !!last.strong === !!r.strong && !!last.u === !!r.u && !!last.s === !!r.s) last.text += text;
      else runs.push({ text, ...(br ? { br: true } : {}), ...(r.em ? { em: true } : {}), ...(r.strong ? { strong: true } : {}), ...(r.u ? { u: true } : {}), ...(r.s ? { s: true } : {}) });
    };

    // Runs in document order, including those inside hyperlinks and insertions;
    // deleted text and field instructions are skipped.
    const walk = (el: Element) => {
      for (const c of Array.from(el.children)) {
        const name = c.localName;
        if (name === 'del' || name === 'instrText' || name === 'pPr' || name === 'footnoteReference') continue;
        if (name !== 'r') { if (['hyperlink', 'ins', 'smartTag', 'sdt', 'sdtContent', 'fldSimple'].includes(name)) walk(c); continue; }
        const rPr = kid(c, 'rPr');
        const fmt = {
          em: kid(rPr, 'i') ? on(kid(rPr, 'i')) : !!style.italic,
          strong: !heading && (kid(rPr, 'b') ? on(kid(rPr, 'b')) : !!style.bold),
          u: !!kid(rPr, 'u') && on(kid(rPr, 'u')),
          s: on(kid(rPr, 'strike')) || on(kid(rPr, 'dstrike')),
        };
        for (const t of Array.from(c.children)) {
          switch (t.localName) {
            case 't': push(t.textContent ?? '', fmt); break;
            case 'tab': push(' ', fmt); break;
            case 'noBreakHyphen': push('-', fmt); break;
            case 'br':
            case 'cr':
              if ((t.getAttributeNS(W, 'type') ?? t.getAttribute('w:type')) !== 'page') push('', fmt, true);
              break;
          }
        }
      }
    };
    walk(p);

    const text = runs.map((r) => r.text).join('');
    blocks.push({ runs, text, heading: heading && text.trim().length <= 120 ? heading : undefined, center, quote: style.quote });
  }

  const { sections, bookTitle, warnings } = splitBlocks(blocks);

  const core = parseXml(files.get('docProps/core.xml'));
  const pick = (tag: string) => core?.getElementsByTagNameNS('*', tag)[0]?.textContent?.trim() || undefined;
  return { format: 'docx', title: pick('title') || bookTitle, author: pick('creator'), sections, warnings };
}
