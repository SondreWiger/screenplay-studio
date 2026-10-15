/**
 * The two pages the desktop app shows before the web app is reachable: a
 * launch screen while the bundled server starts, and a recovery screen if it
 * can't. Both are self-contained data: URLs so they paint instantly.
 */

const MARK = `<svg width="64" height="64" viewBox="0 0 512 512" aria-hidden="true">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5F1F"/><stop offset="1" stop-color="#CC4312"/></linearGradient></defs>
  <rect x="16" y="16" width="480" height="480" rx="108" fill="url(#g)"/>
  <path d="M160 176h192M160 240h160M160 304h176M160 176v192" stroke="#fff" stroke-width="22" fill="none" stroke-linecap="round"/>
</svg>`;

const BASE_STYLE = `
:root { color-scheme: dark; --bg: #070710; --text: #F4F4FC; --muted: rgba(244,244,252,.58); --line: rgba(255,255,255,.08); --accent: #FF5F1F; }
@media (prefers-color-scheme: light) {
  :root.follow-system { color-scheme: light; --bg: #F4F4FC; --text: #0F0F1C; --muted: rgba(15,15,28,.6); --line: rgba(15,15,28,.1); }
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  background: var(--bg); color: var(--text);
  font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
  display: flex; align-items: center; justify-content: center;
  -webkit-user-select: none; user-select: none; cursor: default;
}
body::before { content: ''; position: fixed; inset: 0 0 auto 0; height: 40px; -webkit-app-region: drag; }
button, a { -webkit-app-region: no-drag; }
.wrap { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 32px; max-width: 460px; }
.mark { filter: drop-shadow(0 12px 28px rgba(255,95,31,.28)); margin-bottom: 22px; }
h1 { font-size: 17px; font-weight: 600; margin: 0 0 6px; letter-spacing: -.01em; }
p { margin: 0; color: var(--muted); }
`;

function page(body: string, followSystem: boolean, extraStyle = ''): string {
  const html = `<!doctype html><html class="${followSystem ? 'follow-system' : ''}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
<title>Screenplay Studio</title><style>${BASE_STYLE}${extraStyle}</style></head><body>${body}</body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

export function splashPage(followSystem: boolean): string {
  return page(
    `<div class="wrap">
      <div class="mark">${MARK}</div>
      <h1>Screenplay Studio</h1>
      <p id="status">Opening your workspace…</p>
      <div class="bar"><span></span></div>
    </div>
    <script>
      // Only mention the wait if there is one.
      setTimeout(function(){ document.getElementById('status').textContent = 'Starting the local server — this can take a moment the first time.'; }, 4000);
    </script>`,
    followSystem,
    `.bar { margin-top: 22px; width: 140px; height: 3px; border-radius: 3px; background: var(--line); overflow: hidden; }
     .bar span { display: block; width: 40%; height: 100%; border-radius: 3px; background: var(--accent); animation: slide 1.1s cubic-bezier(.4,0,.2,1) infinite; }
     @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
     @media (prefers-reduced-motion: reduce) { .bar span { animation: none; width: 100%; opacity: .5; } }`,
  );
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/**
 * Shown when the local server can't start. The buttons navigate to
 * `ss-desktop://` URLs, which the main process intercepts in `will-navigate`.
 */
export function startupErrorPage(message: string, followSystem: boolean): string {
  return page(
    `<div class="wrap">
      <div class="mark">${MARK}</div>
      <h1>Screenplay Studio couldn’t start</h1>
      <p>The app runs a small server on your computer, and it didn’t come up.</p>
      <pre>${escapeHtml(message)}</pre>
      <div class="actions">
        <a class="primary" href="ss-desktop://retry">Try again</a>
        <a href="ss-desktop://show-logs">Show log</a>
        <a href="ss-desktop://report">Report a problem</a>
      </div>
      <p class="hint">Your projects are safe — nothing is changed by retrying.</p>
    </div>`,
    followSystem,
    `pre { margin: 18px 0 20px; padding: 10px 12px; max-width: 100%; white-space: pre-wrap; word-break: break-word; text-align: left;
           font: 11.5px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--muted);
           background: rgba(127,127,127,.08); border: 1px solid var(--line); border-radius: 8px; -webkit-user-select: text; user-select: text; }
     .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
     .actions a { padding: 7px 14px; border-radius: 7px; border: 1px solid var(--line); color: var(--text); text-decoration: none; font-weight: 500; }
     .actions a:hover { background: rgba(127,127,127,.1); }
     .actions a.primary { background: var(--accent); border-color: transparent; color: #fff; }
     .actions a.primary:hover { filter: brightness(1.08); }
     .hint { margin-top: 18px; font-size: 12px; }`,
  );
}

/** Shown in place of a window whose renderer crashed. */
export function crashedPage(followSystem: boolean): string {
  return page(
    `<div class="wrap">
      <div class="mark">${MARK}</div>
      <h1>This window stopped responding</h1>
      <p>Anything already saved is safe. Reload to pick up where you left off.</p>
      <div class="actions" style="margin-top:20px"><a class="primary" href="ss-desktop://reload">Reload window</a></div>
    </div>`,
    followSystem,
    `.actions { display: flex; justify-content: center; }
     .actions a { padding: 7px 14px; border-radius: 7px; color: #fff; background: var(--accent); text-decoration: none; font-weight: 500; }`,
  );
}
