/**
 * Prose storage helpers for the Novel manuscript.
 *
 * Chapters are stored as a small, fixed subset of HTML so the editor, the
 * analysis tools and every exporter agree on what a paragraph is:
 *
 *   <p>…</p>                    paragraph  (class="center" / "no-indent")
 *   <h2>…</h2>                  in-chapter heading (epigraph title, letter heading…)
 *   <blockquote>…</blockquote>  quoted passage, epigraph, letter
 *   <hr>                        scene break
 *   <em> <strong> <u> <s> <br>  inline
 *
 * Anything else (pasted Word markup, MCP-written HTML) is reduced to that
 * subset by `sanitizeProse` before it is shown or saved.
 */

import DOMPurify from 'dompurify';

const BLOCK_TAGS = ['P', 'H2', 'BLOCKQUOTE', 'HR'];
const ALLOWED_CLASSES = new Set(['center', 'no-indent']);

/** Reduce arbitrary HTML to the manuscript subset. Browser (or jsdom) only. */
export function sanitizeProse(html: string): string {
  if (!html) return '';
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'hr', 'br', 'em', 'i', 'strong', 'b', 'u', 's', 'strike', 'span'],
    ALLOWED_ATTR: ['class'],
  });

  const doc = new DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html');
  const body = doc.body;

  // Inline synonyms → canonical tags; drop spans and unknown classes.
  const rename = (from: string, to: string) => {
    body.querySelectorAll(from).forEach((el) => {
      const next = doc.createElement(to);
      while (el.firstChild) next.appendChild(el.firstChild);
      el.replaceWith(next);
    });
  };
  rename('b', 'strong');
  rename('i', 'em');
  rename('strike', 's');
  rename('h1', 'h2');
  rename('h3', 'h2');
  rename('h4', 'h2');
  body.querySelectorAll('span').forEach((el) => el.replaceWith(...Array.from(el.childNodes)));
  body.querySelectorAll('[class]').forEach((el) => {
    const keep = Array.from(el.classList).filter((c) => ALLOWED_CLASSES.has(c) && el.tagName === 'P');
    if (keep.length) el.className = keep.join(' ');
    else el.removeAttribute('class');
  });

  // Flatten: every top-level node becomes a block. contentEditable produces
  // <div> lines and bare text; nested blocks inside <p> are unwrapped.
  const out = doc.createElement('div');
  let pending: HTMLElement | null = null;
  const flush = () => {
    if (pending && (pending.textContent || '').trim()) out.appendChild(pending);
    pending = null;
  };
  const visit = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'DIV') {
        // A div holding blocks is a wrapper; a div holding inline content is a line.
        if (Array.from(el.children).some((c) => BLOCK_TAGS.includes(c.tagName) || c.tagName === 'DIV')) {
          el.childNodes.forEach(visit);
          return;
        }
        flush();
        const p = doc.createElement('p');
        while (el.firstChild) p.appendChild(el.firstChild);
        if (p.innerHTML === '<br>') return;
        out.appendChild(p);
        return;
      }
      if (BLOCK_TAGS.includes(el.tagName)) {
        flush();
        if (el.tagName === 'HR') { out.appendChild(doc.createElement('hr')); return; }
        if (el.tagName === 'BLOCKQUOTE') {
          // Keep blockquote paragraphs as plain inline content with <br>s.
          const bq = doc.createElement('blockquote');
          const parts = Array.from(el.childNodes);
          parts.forEach((child, i) => {
            if (child.nodeType === Node.ELEMENT_NODE && ['P', 'DIV'].includes((child as HTMLElement).tagName)) {
              while (child.firstChild) bq.appendChild(child.firstChild);
              if (i < parts.length - 1) bq.appendChild(doc.createElement('br'));
            } else {
              bq.appendChild(child);
            }
          });
          if ((bq.textContent || '').trim()) out.appendChild(bq);
          return;
        }
        if (!(el.textContent || '').trim()) return;
        out.appendChild(el);
        return;
      }
    }
    if (node.nodeType === Node.TEXT_NODE && !pending && !(node.textContent || '').trim()) return;
    if (!pending) pending = doc.createElement('p');
    pending.appendChild(node);
  };
  Array.from(body.childNodes).forEach(visit);
  flush();
  return out.innerHTML;
}

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'",
  '&mdash;': '—', '&ndash;': '–', '&hellip;': '…', '&rsquo;': '’', '&lsquo;': '‘', '&rdquo;': '”', '&ldquo;': '“',
};

/**
 * Plain text with one paragraph per line. Regex-based so it runs anywhere
 * (server routes, tests, the MCP server) without a DOM.
 */
export function htmlToPlain(html: string): string {
  if (!html) return '';
  return html
    .replace(/<hr\s*\/?>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h2|blockquote|div)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Words in a piece of prose: whitespace-separated tokens after stripping tags.
 * Same rule as the novel_chapter_word_count() trigger, so the editor and the
 * database agree.
 */
export function countWords(htmlOrText: string): number {
  if (!htmlOrText) return 0;
  const plain = htmlOrText.includes('<') || htmlOrText.includes('&') ? htmlToPlain(htmlOrText) : htmlOrText;
  const trimmed = plain.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// ── Structured blocks for exporters ─────────────────────────────────────────

export interface ProseRun {
  text: string;
  em?: boolean;
  strong?: boolean;
  u?: boolean;
  s?: boolean;
  /** A hard line break before this run's text. */
  br?: boolean;
}

export type ProseBlock =
  | { type: 'p'; runs: ProseRun[]; center?: boolean; noIndent?: boolean }
  | { type: 'heading'; runs: ProseRun[] }
  | { type: 'quote'; runs: ProseRun[] }
  | { type: 'break' };

function collectRuns(node: Node, marks: Omit<ProseRun, 'text'>, runs: ProseRun[]) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (text) runs.push({ text, ...marks });
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    if (el.tagName === 'BR') { runs.push({ text: '', br: true, ...marks }); return; }
    const next = { ...marks };
    if (el.tagName === 'EM' || el.tagName === 'I') next.em = true;
    if (el.tagName === 'STRONG' || el.tagName === 'B') next.strong = true;
    if (el.tagName === 'U') next.u = true;
    if (el.tagName === 'S') next.s = true;
    collectRuns(el, next, runs);
  });
}

/** Parse stored prose into blocks. Browser (or jsdom) only. */
export function parseProse(html: string): ProseBlock[] {
  const doc = new DOMParser().parseFromString(`<body>${sanitizeProse(html)}</body>`, 'text/html');
  const blocks: ProseBlock[] = [];
  doc.body.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.tagName === 'HR') { blocks.push({ type: 'break' }); return; }
    const runs: ProseRun[] = [];
    collectRuns(el, {}, runs);
    if (el.tagName === 'H2') blocks.push({ type: 'heading', runs });
    else if (el.tagName === 'BLOCKQUOTE') blocks.push({ type: 'quote', runs });
    else blocks.push({ type: 'p', runs, center: el.classList.contains('center'), noIndent: el.classList.contains('no-indent') });
  });
  return blocks;
}

/** Escape text for XHTML/HTML output. */
export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Render runs back to (X)HTML inline markup. */
export function runsToHtml(runs: ProseRun[]): string {
  return runs.map((r) => {
    if (r.br) return '<br/>' + (r.text ? escapeXml(r.text) : '');
    let t = escapeXml(r.text);
    if (r.s) t = `<s>${t}</s>`;
    if (r.u) t = `<u>${t}</u>`;
    if (r.strong) t = `<strong>${t}</strong>`;
    if (r.em) t = `<em>${t}</em>`;
    return t;
  }).join('');
}

/** Render runs as Markdown inline text. */
export function runsToMarkdown(runs: ProseRun[]): string {
  return runs.map((r) => {
    if (r.br) return '  \n' + r.text;
    if (!r.text.trim()) return r.text;
    // Keep surrounding spaces outside the markers so Markdown parses them.
    const m = r.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    let t = m[2];
    if (r.strong) t = `**${t}**`;
    if (r.em) t = `*${t}*`;
    if (r.s) t = `~~${t}~~`;
    return m[1] + t + m[3];
  }).join('');
}
