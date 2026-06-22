import { BrowserWindow, Menu, MenuItemConstructorOptions, app, shell } from 'electron';

const isMac = process.platform === 'darwin';
const SITE = 'https://screenplaystudio.fun';

export function setupMenu(window: BrowserWindow) {
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
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
