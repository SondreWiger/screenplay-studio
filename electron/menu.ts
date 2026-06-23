import { BrowserWindow, Menu, MenuItemConstructorOptions, app, shell, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const isMac = process.platform === 'darwin';
const SITE = 'https://screenplaystudio.fun';

// ── Recent Projects persistence ────────────────────────────────

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
      const raw = fs.readFileSync(RECENT_FILE, 'utf-8');
      const list = JSON.parse(raw) as RecentProject[];
      return Array.isArray(list) ? list.slice(0, MAX_RECENT) : [];
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
  const list = getRecentProjects().filter((p) => p.id !== project.id);
  list.unshift({
    id: project.id,
    title: project.title,
    path: project.path,
    lastOpened: new Date().toISOString(),
  });
  saveRecentProjects(list);
}

export function clearRecentProjects(): void {
  saveRecentProjects([]);
}

// ── Menu setup ─────────────────────────────────────────────────

export function setupMenu(window: BrowserWindow) {
  const recentProjects = getRecentProjects();

  const recentSubmenu: MenuItemConstructorOptions[] =
    recentProjects.length > 0
      ? [
          ...recentProjects.map((rp) => ({
            label: rp.title || 'Untitled',
            click: () => {
              window.webContents.send('menu:open-recent', rp.id);
            },
          })),
          { type: 'separator' as const },
          {
            label: 'Clear Recent Projects',
            click: () => {
              clearRecentProjects();
              setupMenu(window); // Rebuild
            },
          },
        ]
      : [{ label: 'No Recent Projects', enabled: false }];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: `About ${app.name}`,
                click: () => {
                  dialog.showMessageBox(window, {
                    type: 'info',
                    title: `About ${app.name}`,
                    message: app.name,
                    detail: [
                      `Version ${app.getVersion()}`,
                      `Electron ${process.versions.electron}`,
                      `Chromium ${process.versions.chrome}`,
                      `Node.js ${process.versions.node}`,
                      '',
                      '© 2024 Nordhem Development',
                      'screenplaystudio.fun',
                    ].join('\n'),
                    buttons: ['OK'],
                  });
                },
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => window.webContents.send('menu:new-project'),
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => window.webContents.send('menu:open-file'),
        },
        {
          label: 'Open Recent',
          submenu: recentSubmenu,
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => window.webContents.send('menu:save'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => window.webContents.send('menu:save-as'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
            ]
          : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        ...(!isMac
          ? [
              {
                label: `About ${app.name}`,
                click: () => {
                  dialog.showMessageBox(window, {
                    type: 'info',
                    title: `About ${app.name}`,
                    message: app.name,
                    detail: [
                      `Version ${app.getVersion()}`,
                      `Electron ${process.versions.electron}`,
                      `Chromium ${process.versions.chrome}`,
                      `Node.js ${process.versions.node}`,
                      '',
                      '© 2024 Nordhem Development',
                      'screenplaystudio.fun',
                    ].join('\n'),
                    buttons: ['OK'],
                  });
                },
              },
              { type: 'separator' as const },
            ]
          : []),
        {
          label: 'Report a Bug',
          click: () => shell.openExternal(`${SITE}/support`),
        },
        {
          label: 'Documentation',
          click: () => shell.openExternal(`${SITE}/docs`),
        },
        { type: 'separator' },
        {
          label: 'Terms of Service',
          click: () => shell.openExternal(`${SITE}/legal/terms`),
        },
        {
          label: 'Privacy Policy',
          click: () => shell.openExternal(`${SITE}/legal/privacy`),
        },
        {
          label: 'Community Guidelines',
          click: () => shell.openExternal(`${SITE}/legal/community-guidelines`),
        },
        { type: 'separator' },
        {
          label: 'View on GitHub',
          click: () => shell.openExternal('https://github.com/SondreWiger/screenplay-studio'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
