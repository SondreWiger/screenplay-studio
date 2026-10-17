/**
 * HTML sanitisers for anything stored by one user and rendered as HTML for
 * another (script elements, idea-board notes, wire stories, course lessons,
 * company blog posts). The CSP allows inline scripts, so a stray
 * `<b onanimationstart=…>` in the database would otherwise run in every
 * collaborator's session.
 *
 * Browser only: DOMPurify needs a DOM. On the server these return '' — every
 * caller renders data fetched on the client, so nothing is lost in SSR.
 */

import DOMPurify from 'dompurify';

const INLINE_TAGS = ['b', 'i', 'u', 's', 'strong', 'em', 'br'];

/** Inline formatting only (bold, italic, underline, strike, line break), no attributes. */
export function sanitizeInlineHtml(html: string): string {
  if (!html || typeof window === 'undefined') return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: INLINE_TAGS, ALLOWED_ATTR: [] });
}

/**
 * General rich text: DOMPurify's defaults (no scripts, event handlers or
 * javascript: URLs) plus `target` so markdown links can open in a new tab.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof window === 'undefined') return '';
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
}
