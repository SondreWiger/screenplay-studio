/**
 * Script injected into the print window of the script editor's PDF export.
 *
 * The paginator splits pages by *estimated* line counts. When a page's real
 * text runs a little taller than the sheet (word wrap, element spacing), the
 * browser spilled the overflow onto an extra sheet — and then the forced
 * break after the page started yet another, leaving sheets with one line on
 * them. This measures every page once fonts have loaded and moves overflowing
 * elements to the start of the next page (creating pages as needed), keeping
 * scene headings, character cues and parentheticals with what follows them.
 * Pages are then fixed to exactly one sheet so the browser never splits one.
 *
 * Expects: .page > .page-content (+ optional .page-number), title page marked
 * .title-page. Exposes window.__reflowPages().
 */
export const PRINT_REFLOW_SCRIPT = `
(function () {
  var ORPHANS = ['el-scene-heading', 'el-character', 'el-parenthetical'];
  function isOrphan(el) {
    if (!el) return false;
    for (var k = 0; k < ORPHANS.length; k++) if (el.classList.contains(ORPHANS[k])) return true;
    return false;
  }
  function px(v) { return parseFloat(v) || 0; }
  function capacity(page) {
    var cs = getComputedStyle(page);
    return px(cs.minHeight) - px(cs.paddingTop) - px(cs.paddingBottom);
  }
  function makePageAfter(page) {
    var np = page.cloneNode(true);
    np.classList.remove('page-overflow');
    np.querySelector('.page-content').innerHTML = '';
    page.parentNode.insertBefore(np, page.nextSibling);
    return np;
  }
  window.__reflowPages = function () {
    var pages = Array.prototype.slice.call(document.querySelectorAll('.page:not(.title-page)'));
    for (var i = 0; i < pages.length; i++) {
      var page = pages[i];
      var content = page.querySelector('.page-content');
      var limit = capacity(page) + 0.5;
      var guard = 0;
      while (content.offsetHeight > limit && content.children.length > 1 && guard++ < 1000) {
        var next = pages[i + 1];
        if (!next) { next = makePageAfter(page); pages.splice(i + 1, 0, next); }
        var nextContent = next.querySelector('.page-content');
        nextContent.insertBefore(content.lastElementChild, nextContent.firstChild);
        // Don't leave a heading/cue stranded at the bottom.
        while (content.children.length > 1 && isOrphan(content.lastElementChild)) {
          nextContent.insertBefore(content.lastElementChild, nextContent.firstChild);
        }
      }
      // A single element taller than a sheet can't be moved; let it flow.
      if (content.offsetHeight > limit) page.classList.add('page-overflow');
    }
    pages = pages.filter(function (p) {
      if (p.querySelector('.page-content').children.length === 0) { p.parentNode.removeChild(p); return false; }
      return true;
    });
    pages.forEach(function (p, idx) {
      var num = p.querySelector('.page-number');
      if (num) num.textContent = (idx + 1) + '.';
    });
    document.documentElement.classList.add('reflowed');
  };
})();
`;

/**
 * CSS that pins each page to exactly one sheet once reflowed. Pages that
 * still overflow (one enormous element) keep growing instead of being clipped.
 */
export function printReflowCSS(pageHeight: string): string {
  return `
  html.reflowed .page:not(.page-overflow) { height: ${pageHeight}; overflow: hidden; }
  html.reflowed .page.page-overflow { height: auto; }
  `;
}
