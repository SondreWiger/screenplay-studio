/**
 * Book exporters. Each takes a CompiledBook (see compile.ts) and returns a
 * file body; the Export Book page turns that into a download.
 *
 *   EPUB 3    e-readers, Kindle (via Send to Kindle), Apple Books, KDP/Draft2Digital upload
 *   DOCX      standard manuscript format for agents and editors, or a book layout
 *   HTML      print-ready page used for PDF (browser print → Save as PDF)
 *   Markdown  / plain text for everything else
 */

import { buildZip } from './zip';
import { escapeXml, runsToHtml, runsToMarkdown, type ProseBlock, type ProseRun } from './text';
import { sectionHeading, roundedWordCount, type CompiledBook, type CompiledSection } from './compile';

export interface ExportMeta {
  language: string;
  sceneBreak: string;
  /** Manuscript title page: name, address, email, agent. One item per line. */
  contactBlock?: string;
  /** Surname used in manuscript page headers. */
  surname?: string;
  description?: string;
}

function blockHtml(b: ProseBlock, sceneBreak: string, firstAfterHeading: boolean): string {
  switch (b.type) {
    case 'break': return `<p class="scene-break">${escapeXml(sceneBreak)}</p>`;
    case 'heading': return `<h3>${runsToHtml(b.runs)}</h3>`;
    case 'quote': return `<blockquote><p>${runsToHtml(b.runs)}</p></blockquote>`;
    case 'p': {
      const cls = [b.center && 'center', (b.noIndent || firstAfterHeading) && 'no-indent'].filter(Boolean).join(' ');
      return `<p${cls ? ` class="${cls}"` : ''}>${runsToHtml(b.runs)}</p>`;
    }
  }
}

/** Body markup for one section; the first paragraph and those after breaks aren't indented. */
export function sectionBodyHtml(s: CompiledSection, sceneBreak: string): string {
  let fresh = true;
  return s.blocks.map((b) => {
    const html = blockHtml(b, sceneBreak, fresh);
    fresh = b.type === 'break' || b.type === 'heading';
    return html;
  }).join('\n');
}

const BOOK_CSS = `
body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.5; margin: 0 5%; }
h1, h2 { text-align: center; font-weight: normal; }
h1.part { margin-top: 30%; font-size: 1.8em; }
h2.chapter { margin: 3em 0 0.3em; font-size: 1.4em; }
p.chapter-title { text-align: center; font-style: italic; margin: 0 0 2.5em; text-indent: 0; }
h3 { text-align: center; font-size: 1em; font-weight: bold; margin: 1.5em 0 0.8em; }
p { margin: 0; text-indent: 1.5em; text-align: justify; }
p.no-indent { text-indent: 0; }
p.center { text-align: center; text-indent: 0; }
p.scene-break { text-align: center; text-indent: 0; margin: 1em 0; }
blockquote { margin: 1em 2em; font-style: italic; }
blockquote p { text-indent: 0; }
.title-page { text-align: center; margin-top: 30%; }
.title-page h1 { font-size: 2.2em; margin-bottom: 0.5em; }
.title-page .author { font-size: 1.2em; }
`;

function sectionXhtml(book: CompiledBook, s: CompiledSection, meta: ExportMeta): string {
  const heading = s.kind === 'part'
    ? `<h1 class="part">${escapeXml(s.label || s.title)}</h1>${s.label && s.title ? `<p class="chapter-title">${escapeXml(s.title)}</p>` : ''}`
    : s.label
      ? `<h2 class="chapter">${escapeXml(s.label)}</h2>${s.title ? `<p class="chapter-title">${escapeXml(s.title)}</p>` : '<p class="chapter-title"></p>'}`
      : s.title ? `<h2 class="chapter">${escapeXml(s.title)}</h2>` : '';
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${meta.language}" lang="${meta.language}">
<head><meta charset="utf-8"/><title>${escapeXml(sectionHeading(s) || book.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<section epub:type="${s.kind === 'part' ? 'part' : s.kind === 'chapter' ? 'chapter' : s.kind === 'front_matter' ? 'frontmatter' : 'backmatter'}">
${heading}
${sectionBodyHtml(s, meta.sceneBreak)}
</section>
</body>
</html>`;
}

/** EPUB 3 with an EPUB 2 NCX for older readers. */
export function buildEpub(book: CompiledBook, meta: ExportMeta): Uint8Array {
  const uid = `urn:uuid:${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const files = book.sections.map((s, i) => ({ s, href: `section-${String(i + 1).padStart(3, '0')}.xhtml`, id: `s${i + 1}` }));

  const titlePage = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${meta.language}" lang="${meta.language}">
<head><meta charset="utf-8"/><title>${escapeXml(book.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body><section epub:type="titlepage" class="title-page"><h1>${escapeXml(book.title)}</h1><p class="author center">${escapeXml(book.author)}</p></section></body>
</html>`;

  const tocItems = files.filter(({ s }) => sectionHeading(s)).map(({ s, href }) =>
    `<li><a href="${href}">${escapeXml(sectionHeading(s))}</a></li>`).join('\n');

  const nav = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${meta.language}" lang="${meta.language}">
<head><meta charset="utf-8"/><title>Contents</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body><nav epub:type="toc" id="toc"><h2>Contents</h2><ol>
<li><a href="title.xhtml">${escapeXml(book.title)}</a></li>
${tocItems}
</ol></nav></body>
</html>`;

  const ncxPoints = [{ label: book.title, href: 'title.xhtml' }, ...files.filter(({ s }) => sectionHeading(s)).map(({ s, href }) => ({ label: sectionHeading(s), href }))]
    .map((p, i) => `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${escapeXml(p.label)}</text></navLabel><content src="${p.href}"/></navPoint>`)
    .join('\n');
  const ncx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="${uid}"/></head>
<docTitle><text>${escapeXml(book.title)}</text></docTitle>
<navMap>
${ncxPoints}
</navMap>
</ncx>`;

  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${meta.language}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${uid}</dc:identifier>
<dc:title>${escapeXml(book.title)}</dc:title>
<dc:creator>${escapeXml(book.author)}</dc:creator>
<dc:language>${meta.language}</dc:language>
${meta.description ? `<dc:description>${escapeXml(meta.description)}</dc:description>` : ''}
<meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="css" href="style.css" media-type="text/css"/>
<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
${files.map(({ href, id }) => `<item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`).join('\n')}
</manifest>
<spine toc="ncx">
<itemref idref="title"/>
<itemref idref="nav"/>
${files.map(({ id }) => `<itemref idref="${id}"/>`).join('\n')}
</spine>
</package>`;

  const container = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

  return buildZip([
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: container },
    { name: 'OEBPS/content.opf', data: opf },
    { name: 'OEBPS/toc.ncx', data: ncx },
    { name: 'OEBPS/nav.xhtml', data: nav },
    { name: 'OEBPS/style.css', data: BOOK_CSS },
    { name: 'OEBPS/title.xhtml', data: titlePage },
    ...files.map(({ s, href }) => ({ name: `OEBPS/${href}`, data: sectionXhtml(book, s, meta) })),
  ]);
}

/** Print-ready HTML. Opened in a new window and printed to PDF. */
export function buildPrintHtml(book: CompiledBook, meta: ExportMeta, trim: { width: string; height: string } = { width: '6in', height: '9in' }): string {
  const body = book.sections.map((s) => {
    const head = s.kind === 'part'
      ? `<div class="part-page"><h1>${escapeXml(s.label || s.title)}</h1>${s.label && s.title ? `<p class="chapter-title">${escapeXml(s.title)}</p>` : ''}</div>`
      : `<h2 class="chapter">${escapeXml(s.label || s.title)}</h2>${s.label && s.title ? `<p class="chapter-title">${escapeXml(s.title)}</p>` : ''}`;
    return `<section class="${s.kind}">${head}${sectionBodyHtml(s, meta.sceneBreak)}</section>`;
  }).join('\n');
  return `<!doctype html>
<html lang="${meta.language}"><head><meta charset="utf-8"><title>${escapeXml(book.title)}</title>
<style>
@page { size: ${trim.width} ${trim.height}; margin: 0.75in 0.6in 0.8in; @bottom-center { content: counter(page); font-size: 9pt; } }
${BOOK_CSS}
body { margin: 0; font-size: 11pt; color: #111; background: #fff; }
.title-page { page-break-after: always; margin-top: 35%; }
section { page-break-before: always; }
section.chapter h2.chapter { margin-top: 25%; }
.part-page { text-align: center; margin-top: 35%; }
@media screen { body { max-width: 34em; margin: 2em auto; padding: 0 1em; } }
</style></head>
<body>
<div class="title-page"><h1>${escapeXml(book.title)}</h1><p class="author center">${escapeXml(book.author)}</p></div>
${body}
</body></html>`;
}

export function buildMarkdown(book: CompiledBook, meta: ExportMeta): string {
  const out: string[] = [`# ${book.title}`, '', `*${book.author}*`, ''];
  for (const s of book.sections) {
    const h = sectionHeading(s);
    if (h) out.push(s.kind === 'part' ? `# ${h}` : `## ${h}`, '');
    for (const b of s.blocks) {
      if (b.type === 'break') out.push(meta.sceneBreak, '');
      else if (b.type === 'heading') out.push(`### ${runsToMarkdown(b.runs)}`, '');
      else if (b.type === 'quote') out.push(`> ${runsToMarkdown(b.runs).replace(/\n/g, '\n> ')}`, '');
      else out.push(runsToMarkdown(b.runs), '');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

const runsText = (runs: ProseRun[]) => runs.map((r) => (r.br ? '\n' : '') + r.text).join('');

export function buildPlainText(book: CompiledBook, meta: ExportMeta): string {
  const out: string[] = [book.title.toUpperCase(), book.author, '', ''];
  for (const s of book.sections) {
    const h = sectionHeading(s);
    if (h) out.push('', h.toUpperCase(), '');
    for (const b of s.blocks) {
      if (b.type === 'break') out.push('', meta.sceneBreak, '');
      else out.push(runsText(b.runs), '');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ── DOCX ────────────────────────────────────────────────────────────────────

export type DocxStyle = 'manuscript' | 'book';

/**
 * DOCX in standard manuscript format (Shunn): Times New Roman 12pt, double
 * spaced, 1" margins, half-inch first-line indents, "Surname / TITLE / page"
 * header, chapters on new pages a third of the way down, "#" scene breaks,
 * title page with contact details and a rounded word count. `book` style is
 * single-spaced Georgia for reading copies.
 */
export async function buildDocx(book: CompiledBook, meta: ExportMeta, style: DocxStyle): Promise<Blob> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Header, PageNumber, PageBreak, LineRuleType, TabStopType } = docx;

  const manuscript = style === 'manuscript';
  const font = manuscript ? 'Times New Roman' : 'Georgia';
  const size = manuscript ? 24 : 22; // half-points
  const line = manuscript ? 480 : 300; // 240 = single
  const indent = 720; // twips: 0.5"

  const run = (r: ProseRun) => new TextRun({
    text: r.text, font, size, italics: r.em, bold: r.strong, underline: r.u ? {} : undefined, strike: r.s, break: r.br ? 1 : undefined,
  });
  const para = (children: InstanceType<typeof TextRun>[], o: { center?: boolean; indent?: boolean; before?: number; after?: number; pageBreak?: boolean } = {}) =>
    new Paragraph({
      alignment: o.center ? AlignmentType.CENTER : manuscript ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
      indent: o.indent ? { firstLine: indent } : undefined,
      spacing: { line, lineRule: LineRuleType.AUTO, before: o.before ?? 0, after: o.after ?? 0 },
      pageBreakBefore: o.pageBreak,
      children,
    });

  const children: InstanceType<typeof Paragraph>[] = [];

  // Title page
  if (manuscript) {
    const contact = (meta.contactBlock || book.author).split('\n').filter(Boolean);
    children.push(new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
      spacing: { line: 240 },
      children: [new TextRun({ text: contact[0] || '', font, size }), new TextRun({ text: `\t${roundedWordCount(book.wordCount)}`, font, size })],
    }));
    for (const l of contact.slice(1)) children.push(new Paragraph({ spacing: { line: 240 }, children: [new TextRun({ text: l, font, size })] }));
    children.push(para([new TextRun({ text: book.title.toUpperCase(), font, size })], { center: true, before: 4800 }));
    children.push(para([new TextRun({ text: `by ${book.author}`, font, size })], { center: true }));
  } else {
    children.push(para([new TextRun({ text: book.title, font, size: 48 })], { center: true, before: 4800, after: 400 }));
    children.push(para([new TextRun({ text: book.author, font, size: 28 })], { center: true }));
  }

  for (const s of book.sections) {
    const isPart = s.kind === 'part';
    // A third of the way down a new page (about 2.5" in double spacing).
    children.push(para([new TextRun({ children: [new PageBreak()] })]));
    const heading = s.label || s.title;
    if (heading) {
      children.push(para([new TextRun({ text: manuscript ? heading.toUpperCase() : heading, font, size: manuscript ? size : 32, bold: !manuscript })],
        { center: true, before: isPart ? 4800 : manuscript ? 2880 : 2400 }));
    }
    if (s.label && s.title) children.push(para([new TextRun({ text: s.title, font, size, italics: !manuscript })], { center: true }));
    if (heading) children.push(para([], {}));

    let fresh = true;
    for (const b of s.blocks) {
      if (b.type === 'break') {
        children.push(para([new TextRun({ text: manuscript ? '#' : meta.sceneBreak, font, size })], { center: true }));
        fresh = true;
        continue;
      }
      if (b.type === 'heading') {
        children.push(para(b.runs.map((r) => run({ ...r, strong: true })), { center: true }));
        fresh = true;
        continue;
      }
      if (b.type === 'quote') {
        children.push(new Paragraph({
          indent: { left: indent, right: indent },
          spacing: { line, before: 0, after: 0 },
          children: b.runs.map((r) => run({ ...r, em: !r.em })),
        }));
        fresh = true;
        continue;
      }
      children.push(para(b.runs.map(run), { center: b.center, indent: !b.center && !b.noIndent && (manuscript || !fresh) }));
      fresh = false;
    }
    if (manuscript && s === book.sections[book.sections.length - 1]) {
      children.push(para([new TextRun({ text: 'END', font, size })], { center: true, before: 480 }));
    }
  }

  const surname = (meta.surname || book.author.split(/\s+/).pop() || '').trim();
  const shortTitle = book.title.toUpperCase().split(/\s+/).slice(0, 4).join(' ');
  const doc = new Document({
    creator: book.author,
    title: book.title,
    styles: { default: { document: { run: { font, size } } } },
    sections: [{
      properties: {
        titlePage: true,
        page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
      },
      headers: manuscript ? {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ font, size, children: [`${surname} / ${shortTitle} / `, PageNumber.CURRENT] })],
          })],
        }),
        first: new Header({ children: [] }),
      } : undefined,
      children,
    }],
  });
  return Packer.toBlob(doc);
}

/** Trigger a browser download. */
export function downloadFile(data: Blob | Uint8Array | string, filename: string, type: string) {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(title: string): string {
  return (title || 'manuscript').replace(/[^\w\s-]+/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'manuscript';
}
