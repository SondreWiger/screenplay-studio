import { BrowserWindow, app, dialog, nativeTheme, screen, shell } from 'electron';
import * as path from 'path';
import { ensureLocalServer, getLogPath } from './next-server';
import { crashedPage, splashPage, startupErrorPage } from './pages';
import { attachContextMenu } from './context-menu';
import { loadWindowState, trackWindowState } from './window-state';
import { getPreference, getSettings, updateSettings } from './preferences';

const isMac = process.platform === 'darwin';
const isDev = !app.isPackaged;
const WEB_URL = 'https://screenplaystudio.fun';

/** Routes that belong in a browser rather than the app window. */
const MARKETING_PATHS = [
  '/blog', '/community', '/legal', '/support', '/about', '/pricing', '/pro',
  '/testimonials', '/translations', '/download', '/colorbar', '/compare',
  '/changelog', '/contribute', '/feedback', '/licenses', '/press', '/ref',
  '/sitemap-visual', '/dev', '/docs', '/learn', '/tutorials',
];

/** Paths worth reopening on the next launch. */
const RESTORABLE = /^\/(dashboard|projects|idea-boards|quotes|people|accountability|company|settings)(\/|$|\?)/;

let appOrigin: string | null = null;

/** Called whenever a window opens, closes or changes focus, to refresh menus. */
let onWindowsChanged: () => void = () => {};
export function setWindowsChangedListener(fn: () => void) {
  onWindowsChanged = fn;
}

function isMarketingPath(pathname: string): boolean {
  if (pathname === '/') return false;
  return MARKETING_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** True for URLs served by the app's own server. */
export function isAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (appOrigin && parsed.origin === appOrigin) return true;
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

export function getAppOrigin(): string | null {
  return appOrigin;
}

async function resolveAppOrigin(): Promise<string> {
  if (isDev) {
    appOrigin = new URL(process.env.ELECTRON_DEV_URL || 'http://localhost:3000').origin;
    return appOrigin;
  }
  appOrigin = await ensureLocalServer();
  return appOrigin;
}

/** Load a page without letting an interrupted load surface as an error. */
function show(win: BrowserWindow, url: string) {
  if (!win.isDestroyed()) win.loadURL(url).catch(() => { /* superseded by a newer navigation */ });
}

function followsSystemTheme(): boolean {
  return getSettings().theme === 'system';
}

function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? '#070710' : '#F4F4FC';
}

/** The path a fresh launch should open. */
function launchPath(): string {
  const settings = getSettings();
  if (settings.launchBehaviour === 'restore' && settings.lastPath && RESTORABLE.test(settings.lastPath)) {
    return settings.lastPath;
  }
  return '/';
}

/**
 * Onboarding state lives in cookies the server reads. They are set on the
 * window's own session partition — setting them on the default session (as the
 * app used to) put them somewhere the windows never looked.
 */
async function primeCookies(win: BrowserWindow, origin: string) {
  const cookies = win.webContents.session.cookies;
  const set = (name: string, value: string) =>
    cookies.set({ url: origin, name, value, path: '/', expirationDate: Date.now() / 1000 + 31_536_000 }).catch(() => {});

  if (getPreference('ss-onboarding-completed') === '1') {
    await set('ss-onboarding-completed', '1');
    const choice = getPreference('ss-auth-choice');
    if (typeof choice === 'string' && choice) await set('ss-auth-choice', choice);
  }
  if (getPreference('ss-local-mode') === '1') await set('ss-local-mode', '1');
}

/** Opens `path` in `win`, starting the local server first if needed. */
export async function loadApp(win: BrowserWindow, appPath: string) {
  try {
    const origin = await resolveAppOrigin();
    if (win.isDestroyed()) return;
    await primeCookies(win, origin);
    await win.loadURL(`${origin}${appPath.startsWith('/') ? appPath : `/${appPath}`}`);
  } catch (err) {
    if (win.isDestroyed()) return;
    // ERR_ABORTED just means a newer navigation replaced this one.
    if ((err as { code?: string })?.code === 'ERR_ABORTED') return;
    const message = err instanceof Error ? err.message : String(err);
    console.error('[window] Failed to open the app:', message);
    show(win, startupErrorPage(message, followsSystemTheme()));
  }
}

/** Ask the renderer to navigate client-side; fall back to a full load. */
export function navigate(win: BrowserWindow, appPath: string) {
  if (win.isDestroyed()) return;
  if (isAppUrl(win.webContents.getURL())) {
    win.webContents.send('desktop:navigate', appPath);
  } else {
    void loadApp(win, appPath);
  }
}

function handleDesktopAction(win: BrowserWindow, url: string): boolean {
  if (!url.startsWith('ss-desktop://')) return false;
  const action = url.slice('ss-desktop://'.length).replace(/\/$/, '');
  if (action === 'retry') {
    show(win, splashPage(followsSystemTheme()));
    void loadApp(win, launchPath());
  } else if (action === 'reload') {
    void loadApp(win, '/dashboard');
  } else if (action === 'show-logs') {
    shell.showItemInFolder(getLogPath());
  } else if (action === 'report') {
    void shell.openExternal(`${WEB_URL}/support`);
  }
  return true;
}

function cascadeFrom(): { x?: number; y?: number } {
  const ref = BrowserWindow.getFocusedWindow();
  if (!ref) return {};
  const [x, y] = ref.getPosition();
  const area = screen.getDisplayMatching(ref.getBounds()).workArea;
  const nx = x + 28, ny = y + 28;
  // Wrap back to the corner rather than walking off-screen.
  if (nx + 400 > area.x + area.width || ny + 300 > area.y + area.height) return { x: area.x + 40, y: area.y + 40 };
  return { x: nx, y: ny };
}

export interface CreateWindowOptions {
  /** App path to open; defaults to the launch path. */
  path?: string;
}

export function createAppWindow(options: CreateWindowOptions = {}): BrowserWindow {
  const isFirst = BrowserWindow.getAllWindows().length === 0;
  const saved = loadWindowState();
  const position = isFirst ? { x: saved.x, y: saved.y } : cascadeFrom();
  const settings = getSettings();

  const win = new BrowserWindow({
    ...position,
    width: saved.width,
    height: saved.height,
    minWidth: 760,
    minHeight: 520,
    title: 'Screenplay Studio',
    icon: path.join(__dirname, '../../build/icon.png'),
    show: false,
    backgroundColor: windowBackground(),
    // macOS: content runs under the title bar and the traffic lights sit in
    // the sidebar, as in Mail or Notes. The web app reserves room for them.
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 18, y: 18 } : undefined,
    tabbingIdentifier: isMac ? 'screenplay-studio' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: settings.spellcheck,
      partition: 'persist:screenplay',
    },
  });

  if (isFirst && saved.isMaximized) win.maximize();
  trackWindowState(win);
  win.once('ready-to-show', () => win.show());

  const contents = win.webContents;
  contents.session.setSpellCheckerEnabled(settings.spellcheck);

  // ── Navigation guards ───────────────────────────────────────
  contents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || url === '') {
      // Print previews and export helpers write into a blank window.
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#ffffff' } };
    }
    if (isAppUrl(url)) {
      const parsed = new URL(url);
      if (isMarketingPath(parsed.pathname)) {
        void shell.openExternal(`${WEB_URL}${parsed.pathname}${parsed.search}`);
      } else {
        // In-app links that ask for a new tab (pop-outs for a second screen,
        // "open in new window") become real app windows.
        createAppWindow({ path: `${parsed.pathname}${parsed.search}${parsed.hash}` });
      }
      return { action: 'deny' };
    }
    if (/^https?:/i.test(url) || /^mailto:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (handleDesktopAction(win, url)) { event.preventDefault(); return; }
    try {
      const parsed = new URL(url);
      if (isAppUrl(url)) {
        if (parsed.pathname === '/' && getPreference('ss-onboarding-completed') === '1') {
          // The landing page is the website's; the app's home is the dashboard.
          event.preventDefault();
          navigate(win, '/dashboard');
        } else if (isMarketingPath(parsed.pathname)) {
          event.preventDefault();
          void shell.openExternal(`${WEB_URL}${parsed.pathname}${parsed.search}`);
        }
      } else if (parsed.origin === WEB_URL && isMarketingPath(parsed.pathname)) {
        event.preventDefault();
        void shell.openExternal(url);
      }
      // Anything else (sign-in providers) navigates in place and returns to
      // the app through the auth callback.
    } catch { /* malformed URL: let Chromium deal with it */ }
  });

  const rememberPath = (url: string) => {
    if (!isAppUrl(url)) return;
    try {
      const parsed = new URL(url);
      const appPath = `${parsed.pathname}${parsed.search}`;
      if (RESTORABLE.test(appPath) && !parsed.searchParams.has('popout')) updateSettings({ lastPath: appPath });
    } catch { /* ignore */ }
  };
  contents.on('did-navigate', (_e, url) => rememberPath(url));
  contents.on('did-navigate-in-page', (_e, url, isMainFrame) => { if (isMainFrame) rememberPath(url); });

  // ── Zoom (kept across launches and shared by every window) ─
  contents.on('did-finish-load', () => {
    if (isAppUrl(contents.getURL())) contents.setZoomLevel(getSettings().zoomLevel);
    contents.send('desktop:window-state', { fullscreen: win.isFullScreen(), focused: win.isFocused() });
  });

  // ── Native gestures and buttons for Back / Forward ──────────
  win.on('swipe', (_e, direction) => {
    if (direction === 'right' && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
    if (direction === 'left' && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
  });
  win.on('app-command', (_e, command) => {
    if (command === 'browser-backward' && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
    if (command === 'browser-forward' && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
  });

  // ── Window state the web app styles around ──────────────────
  const sendState = () => {
    if (!win.isDestroyed()) contents.send('desktop:window-state', { fullscreen: win.isFullScreen(), focused: win.isFocused() });
  };
  win.on('enter-full-screen', sendState);
  win.on('leave-full-screen', sendState);
  win.on('focus', () => { sendState(); onWindowsChanged(); });
  win.on('blur', sendState);
  win.on('closed', () => onWindowsChanged());

  // ── Recovery ────────────────────────────────────────────────
  contents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit') return;
    console.error('[window] Renderer gone:', details.reason);
    show(win, crashedPage(followsSystemTheme()));
  });
  win.on('unresponsive', async () => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      message: 'Screenplay Studio isn’t responding',
      detail: 'You can wait for it to recover, or reload the window. Work that was already saved is kept.',
      buttons: ['Wait', 'Reload Window'],
      defaultId: 0,
      cancelId: 0,
    });
    if (response === 1 && !win.isDestroyed()) contents.reload();
  });

  attachContextMenu(win, {
    isAppUrl,
    openInNewWindow: (url) => {
      const parsed = new URL(url);
      createAppWindow({ path: `${parsed.pathname}${parsed.search}${parsed.hash}` });
    },
  });

  show(win, splashPage(followsSystemTheme()));
  void loadApp(win, options.path ?? launchPath());
  onWindowsChanged();
  return win;
}

/** The window menu actions and IPC replies should target. */
export function targetWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

export function applyZoomToAll(level: number) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && isAppUrl(win.webContents.getURL())) win.webContents.setZoomLevel(level);
  }
}

export function applySpellcheckToAll(enabled: boolean) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.session.setSpellCheckerEnabled(enabled);
  }
}

export function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args);
  }
}

/** Reload every app window, e.g. after the local server restarted. */
export function reloadAllWindows() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    let appPath = '/dashboard';
    try {
      const parsed = new URL(win.webContents.getURL());
      if (isAppUrl(parsed.href)) appPath = `${parsed.pathname}${parsed.search}`;
    } catch { /* keep default */ }
    show(win, splashPage(followsSystemTheme()));
    void loadApp(win, appPath);
  }
}
