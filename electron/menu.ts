import { BrowserWindow, Menu, MenuItemConstructorOptions, app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getLogPath } from './next-server';
import { getSettings, updateSettings } from './preferences';
import { checkForUpdatesManually, getUpdateStatus, installUpdate } from './updater';
import {
  applySpellcheckToAll, applyZoomToAll, broadcast, createAppWindow, isAppUrl, navigate, targetWindow,
} from './windows';

const isMac = process.platform === 'darwin';
const SITE = 'https://screenplaystudio.fun';

// ── Recent projects ───────────────────────────────────────────

export interface RecentProject {
  id: string;
  title: string;
  path?: string;
  lastOpened: string; // ISO timestamp
}

const RECENT_FILE = path.join(app.getPath('userData'), 'recent-projects.json');
const MAX_RECENT = 10;

export function getRecentProjects(): RecentProject[] {
  try {
    if (fs.existsSync(RECENT_FILE)) {
      const list = JSON.parse(fs.readFileSync(RECENT_FILE, 'utf-8')) as RecentProject[];
      return Array.isArray(list) ? list.filter((p) => p && typeof p.id === 'string').slice(0, MAX_RECENT) : [];
    }
  } catch { /* ignore */ }
  return [];
}

function saveRecentProjects(list: RecentProject[]): void {
  try {
    fs.writeFileSync(RECENT_FILE, JSON.stringify(list.slice(0, MAX_RECENT), null, 2), 'utf-8');
  } catch { /* ignore */ }
}

export function addRecentProject(project: { id: string; title: string; path?: string }): void {
  const list = getRecentProjects();
  const existing = list.find((p) => p.id === project.id);
  // Autosave calls this every few seconds; only touch the disk (and rebuild
  // the menu) when the list would actually change.
  if (existing && list[0]?.id === project.id && existing.title === project.title) return;
  const next = list.filter((p) => p.id !== project.id);
  next.unshift({ id: project.id, title: project.title, path: project.path, lastOpened: new Date().toISOString() });
  saveRecentProjects(next);
  rebuildMenus();
}

export function clearRecentProjects(): void {
  saveRecentProjects([]);
  app.clearRecentDocuments();
  rebuildMenus();
}

// ── Helpers ───────────────────────────────────────────────────

/** Run `fn` against the focused app window, opening one if none exists. */
function withWindow(fn: (win: BrowserWindow) => void) {
  const win = targetWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
    fn(win);
    return;
  }
  // A new window shows the launch screen first; wait for the app itself.
  const created = createAppWindow({ path: '/dashboard' });
  const onLoad = () => {
    if (created.isDestroyed()) return;
    if (!isAppUrl(created.webContents.getURL())) return;
    created.webContents.off('did-finish-load', onLoad);
    fn(created);
  };
  created.webContents.on('did-finish-load', onLoad);
}

function sendMenuAction(action: string, ...args: unknown[]) {
  withWindow((win) => win.webContents.send(action, ...args));
}

function go(appPath: string) {
  withWindow((win) => navigate(win, appPath));
}

/** The project the focused window is showing, if any. */
function currentProjectId(): string | null {
  const win = targetWindow();
  if (!win || win.isDestroyed()) return null;
  const url = win.webContents.getURL();
  if (!isAppUrl(url)) return null;
  const match = new URL(url).pathname.match(/^\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

function setZoom(level: number) {
  const next = updateSettings({ zoomLevel: level });
  applyZoomToAll(next.zoomLevel);
  broadcast('desktop:settings-changed', next);
}

function updateMenuItem(): MenuItemConstructorOptions {
  const status = getUpdateStatus();
  if (status.state === 'ready') {
    return { label: `Restart to Install ${status.version}`, click: () => installUpdate() };
  }
  if (status.state === 'downloading') {
    return { label: `Downloading Update… ${status.percent}%`, enabled: false };
  }
  if (status.state === 'checking') {
    return { label: 'Checking for Updates…', enabled: false };
  }
  return { label: 'Check for Updates…', click: () => checkForUpdatesManually() };
}

const PROJECT_TOOLS: { label: string; path: string }[] = [
  { label: 'Overview', path: '' },
  { label: 'Script', path: '/script' },
  { label: 'Scenes', path: '/scenes' },
  { label: 'Characters', path: '/characters' },
  { label: 'Locations', path: '/locations' },
  { label: 'Ideas', path: '/ideas' },
  { label: 'Shot List', path: '/shots' },
  { label: 'Schedule', path: '/schedule' },
];

// ── Menus ─────────────────────────────────────────────────────

export function buildMenuTemplate(): MenuItemConstructorOptions[] {
  const recent = getRecentProjects();
  const settings = getSettings();
  const projectId = currentProjectId();

  const recentSubmenu: MenuItemConstructorOptions[] = recent.length
    ? [
        ...recent.map((rp) => ({
          label: rp.title || 'Untitled',
          click: () => go(`/projects/${rp.id}`),
        })),
        { type: 'separator' as const },
        { label: 'Clear Menu', click: () => clearRecentProjects() },
      ]
    : [{ label: 'No Recent Projects', enabled: false }];

  const settingsItem: MenuItemConstructorOptions = {
    label: isMac ? 'Settings…' : 'Settings',
    accelerator: 'CmdOrCtrl+,',
    click: () => go('/settings?tab=desktop'),
  };

  const aboutItem: MenuItemConstructorOptions = isMac
    ? { role: 'about', label: `About ${app.name}` }
    : { label: `About ${app.name}`, click: () => app.showAboutPanel() };

  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        aboutItem,
        updateMenuItem(),
        { type: 'separator' },
        settingsItem,
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push({
    label: 'File',
    submenu: [
      { label: 'New Project…', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('menu:new-project') },
      { label: 'New Window', accelerator: 'CmdOrCtrl+Shift+N', click: () => createAppWindow({ path: '/dashboard' }) },
      { type: 'separator' },
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('menu:open-file') },
      { label: 'Open Recent', submenu: recentSubmenu },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('menu:save') },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuAction('menu:save-as') },
      { type: 'separator' },
      ...(isMac
        ? [{ role: 'close' as const }]
        : [settingsItem, { type: 'separator' as const }, { role: 'close' as const, label: 'Close Window' }, { role: 'quit' as const, label: 'Exit' }]),
    ],
  });

  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteAndMatchStyle' },
      { role: 'delete' },
      { role: 'selectAll' },
      { type: 'separator' },
      {
        label: 'Check Spelling While Typing',
        type: 'checkbox',
        checked: settings.spellcheck,
        click: (item) => {
          const next = updateSettings({ spellcheck: item.checked });
          applySpellcheckToAll(next.spellcheck);
          broadcast('desktop:settings-changed', next);
        },
      },
      ...(isMac
        ? [
            { type: 'separator' as const },
            {
              label: 'Speech',
              submenu: [{ role: 'startSpeaking' as const }, { role: 'stopSpeaking' as const }],
            },
          ]
        : []),
    ],
  });

  template.push({
    label: 'View',
    submenu: [
      { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: () => sendMenuAction('menu:toggle-sidebar') },
      { type: 'separator' },
      { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: () => setZoom(0) },
      { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => setZoom(getSettings().zoomLevel + 0.5) },
      // Unlabelled duplicate so ⌘= works too, as it does in every browser.
      { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', visible: false, acceleratorWorksWhenHidden: true, click: () => setZoom(getSettings().zoomLevel + 0.5) },
      { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => setZoom(getSettings().zoomLevel - 0.5) },
      { type: 'separator' },
      { role: 'togglefullscreen' },
      { type: 'separator' },
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => withWindow((win) => win.webContents.reload()) },
    ],
  });

  template.push({
    label: 'Go',
    submenu: [
      {
        label: 'Back',
        accelerator: 'CmdOrCtrl+[',
        click: () => withWindow((win) => { if (win.webContents.navigationHistory.canGoBack()) win.webContents.navigationHistory.goBack(); }),
      },
      {
        label: 'Forward',
        accelerator: 'CmdOrCtrl+]',
        click: () => withWindow((win) => { if (win.webContents.navigationHistory.canGoForward()) win.webContents.navigationHistory.goForward(); }),
      },
      { type: 'separator' },
      { label: 'Projects', accelerator: 'CmdOrCtrl+Shift+H', click: () => go('/dashboard') },
      { label: 'Idea Boards', click: () => go('/idea-boards') },
      ...(projectId
        ? [
            { type: 'separator' as const },
            { label: 'This Project', enabled: false },
            ...PROJECT_TOOLS.map((tool) => ({
              label: tool.label,
              click: () => go(`/projects/${projectId}${tool.path}`),
            })),
          ]
        : []),
    ],
  });

  template.push(
    isMac
      ? { role: 'windowMenu' }
      : {
          label: 'Window',
          submenu: [
            { role: 'minimize' },
            {
              label: 'Maximize',
              click: () => withWindow((win) => (win.isMaximized() ? win.unmaximize() : win.maximize())),
            },
            { type: 'separator' },
            { role: 'close' },
          ],
        },
  );

  template.push({
    role: 'help',
    submenu: [
      { label: 'Screenplay Studio Help', click: () => shell.openExternal(`${SITE}/learn`) },
      { label: 'Keyboard Shortcuts', accelerator: 'CmdOrCtrl+/', click: () => sendMenuAction('menu:shortcuts') },
      { label: 'What’s New', click: () => shell.openExternal(`${SITE}/changelog`) },
      { type: 'separator' },
      { label: 'Report a Problem…', click: () => shell.openExternal(`${SITE}/support`) },
      { label: 'Send Feedback…', click: () => shell.openExternal(`${SITE}/feedback`) },
      { type: 'separator' },
      ...(!isMac ? [updateMenuItem(), aboutItem, { type: 'separator' as const }] : []),
      {
        label: 'Troubleshooting',
        submenu: [
          { label: 'Show Server Log', click: () => shell.showItemInFolder(getLogPath()) },
          { label: 'Open Projects Folder', click: () => openProjectsFolder() },
          { type: 'separator' },
          { label: 'Toggle Developer Tools', accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I', click: () => withWindow((win) => win.webContents.toggleDevTools()) },
        ],
      },
      { type: 'separator' },
      { label: 'Privacy Policy', click: () => shell.openExternal(`${SITE}/legal/privacy`) },
      { label: 'Terms of Service', click: () => shell.openExternal(`${SITE}/legal/terms`) },
    ],
  });

  return template;
}

export function openProjectsFolder() {
  const dir = path.join(app.getPath('documents'), 'ScreenplayStudio', 'projects');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  void shell.openPath(dir);
}

function buildDockMenu(): Menu {
  const recent = getRecentProjects().slice(0, 5);
  return Menu.buildFromTemplate([
    { label: 'New Window', click: () => createAppWindow({ path: '/dashboard' }) },
    { label: 'New Project…', click: () => sendMenuAction('menu:new-project') },
    ...(recent.length
      ? [
          { type: 'separator' as const },
          ...recent.map((rp) => ({ label: rp.title || 'Untitled', click: () => go(`/projects/${rp.id}`) })),
        ]
      : []),
  ]);
}

function updateJumpList() {
  if (process.platform !== 'win32') return;
  try {
    app.setUserTasks([
      {
        program: process.execPath,
        arguments: '--new-window',
        iconPath: process.execPath,
        iconIndex: 0,
        title: 'New Window',
        description: 'Open another Screenplay Studio window',
      },
      {
        program: process.execPath,
        arguments: '--new-project',
        iconPath: process.execPath,
        iconIndex: 0,
        title: 'New Project',
        description: 'Start a new project',
      },
    ]);
  } catch { /* not available on this build */ }
}

let rebuildQueued = false;

/** Rebuild the application menu (and dock menu). Coalesced per tick. */
export function rebuildMenus() {
  if (rebuildQueued) return;
  rebuildQueued = true;
  setImmediate(() => {
    rebuildQueued = false;
    Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate()));
    if (isMac) app.dock?.setMenu(buildDockMenu());
  });
}

export function setupMenus() {
  app.setAboutPanelOptions({
    applicationName: 'Screenplay Studio',
    applicationVersion: app.getVersion(),
    copyright: `© ${new Date().getFullYear()} Northem Development`,
    website: SITE,
    iconPath: path.join(__dirname, '../../build/icon.png'),
  });
  updateJumpList();
  rebuildMenus();
}

/** Handle the `--new-window` / `--new-project` jump-list arguments. */
export function handleLaunchArgs(argv: string[]): boolean {
  if (argv.includes('--new-window')) {
    createAppWindow({ path: '/dashboard' });
    return true;
  }
  if (argv.includes('--new-project')) {
    sendMenuAction('menu:new-project');
    return true;
  }
  return false;
}
