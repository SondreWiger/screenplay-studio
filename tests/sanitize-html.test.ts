import { sanitizeHtml, sanitizeInlineHtml } from '@/lib/sanitize-html';

describe('sanitizeInlineHtml', () => {
  it('keeps inline formatting', () => {
    expect(sanitizeInlineHtml('<b>INT.</b> <i>HOUSE</i><br>')).toBe('<b>INT.</b> <i>HOUSE</i><br>');
  });

  it('strips attributes from allowed tags', () => {
    // The old regex sanitiser let this through unchanged.
    expect(sanitizeInlineHtml('<b style="animation-name:spin" onanimationstart="alert(1)">x</b>')).toBe('<b>x</b>');
  });

  it('drops disallowed tags but keeps their text', () => {
    expect(sanitizeInlineHtml('<img src=x onerror=alert(1)><span>hi</span>')).toBe('hi');
  });
});

describe('sanitizeHtml', () => {
  it('removes event handlers and javascript: links', () => {
    const out = sanitizeHtml('<p onclick="x()">a</p><a href="javascript:alert(1)" target="_blank">b</a>');
    expect(out).not.toMatch(/onclick|javascript:/);
    expect(out).toContain('target="_blank"');
  });
});
