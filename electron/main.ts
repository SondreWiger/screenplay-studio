import { app, BrowserWindow, ipcMain, dialog, shell, session, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { setupMenu, addRecentProject, getRecentProjects, clearRecentProjects } from './menu';
import { startLocalServer, stopLocalServer } from './next-server';
import { loadWindowState, trackWindowState } from './window-state';
import { getPreference, setPreference } from './preferences';

const MARKETING_PATHS = [
  '/blog', '/community', '/legal', '/support', '/about', '/pricing', '/pro',
  '/testimonials', '/translations', '/download', '/colorbar', '/compare',
  '/changelog', '/contribute', '/feedback', '/licenses', '/press', '/ref',
  '/sitemap-visual', '/dev',
];

const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';
const WEB_URL = 'https://screenplaystudio.fun';

let mainWindow: BrowserWindow | null = null;
let menuSetup = false;
let updaterSetup = false;

// Auto-save interval handle
let autoSaveInterval: ReturnType<typeof setInterval> | null = null;

function getDevUrl(): string {
  return process.env.ELECTRON_DEV_URL || 'http://localhost:3000';
}

async function createWindow() {
  // ── Restore saved window geometry ────────────────────────
  const savedState = loadWindowState();

  mainWindow = new BrowserWindow({
    x: savedState.x,
    y: savedState.y,
    width: savedState.width,
    height: savedState.height,
    minWidth: 800,
    minHeight: 600,
    title: 'Screenplay Studio',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: 'persist:screenplay',
    },
    backgroundColor: isMac ? '#00000000' : '#070710',
    vibrancy: isMac ? 'under-window' : undefined,
    visualEffectState: isMac ? 'active' : undefined,
    show: true, // Show immediately with loading screen
  });

  // Restore maximized state after creation
  if (savedState.isMaximized) {
    mainWindow.maximize();
  }

  // ── Track window geometry for next launch ────────────────
  trackWindowState(mainWindow);

  // Load a simple loading HTML first (instant)
  mainWindow.loadURL(`data:text/html;charset=utf-8,
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 0;
          background: #070710;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .loader {
          text-align: center;
          color: white;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,95,31,0.3);
          border-top-color: #FF5F1F;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .text {
          font-size: 14px;
          color: rgba(255,255,255,0.6);
        }
      </style>
    </head>
    <body>
      <div class="loader">
        <div class="spinner"></div>
        <div class="text">Starting Screenplay Studio...</div>
      </div>
    </body>
    </html>
  `);

     // Start server in background and load real app when ready
     if (isDev) {
       const url = getDevUrl();
       setTimeout(() => {
         loadAppUrl(url);
       }, 100);
     } else {
       // Start server immediately without blocking window show
       startLocalServer().then((serverUrl) => {
         const url = `${serverUrl}/`;
         console.log('Local server started at', serverUrl);
         loadAppUrl(url);
       }).catch((err) => {
         console.error('Failed to start local server, falling back to remote:', err);
         const url = `${WEB_URL}/`;
         loadAppUrl(url);
       });
     }

}

function loadAppUrl(url: string) {
  if (!mainWindow) return;
  
  const localModePref = getPreference('ss-local-mode');
  const onboardingCompleted = getPreference('ss-onboarding-completed');
  const authChoice = getPreference('ss-auth-choice');

  if (onboardingCompleted === '1') {
    try {
      const parsedUrl = new URL(url);
      const origin = parsedUrl.origin;
      
      session.defaultSession.cookies.set({
        url: origin,
        name: 'ss-onboarding-completed',
        value: '1',
        path: '/',
      });

      if (authChoice) {
        session.defaultSession.cookies.set({
          url: origin,
          name: 'ss-auth-choice',
          value: authChoice,
          path: '/',
        });
      }

      if (localModePref === '1') {
        session.defaultSession.cookies.set({
          url: origin,
          name: 'ss-local-mode',
          value: '1',
          path: '/',
        });
      }
    } catch (err) {
      console.error('Failed to set onboarding cookies:', err);
    }
  }

  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
      autoSaveInterval = null;
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (e, url) => {
    try {
      const parsed = new URL(url);
      const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

      if (isLocal) {
        if (parsed.pathname === '/') {
          e.preventDefault();
          mainWindow?.loadURL(`${parsed.origin}/dashboard`);
          return;
        }
        if (MARKETING_PATHS.some((p) => parsed.pathname === p || parsed.pathname.startsWith(`${p}/`))) {
          e.preventDefault();
          shell.openExternal(`https://screenplaystudio.fun${parsed.pathname}${parsed.search}`);
          return;
        }
      } else if (MARKETING_PATHS.some((p) => parsed.pathname.startsWith(p))) {
        e.preventDefault();
        shell.openExternal(url);
      }
    } catch { /* ignore */ }
  });

  mainWindow.webContents.once('did-finish-load', () => {
    if (!menuSetup && mainWindow) {
      setupMenu(mainWindow);
      menuSetup = true;
    }
    if (!updaterSetup && !isDev) {
      setTimeout(() => {
        import('./updater').then(({ setupAutoUpdater }) => {
          if (mainWindow) {
            setupAutoUpdater(mainWindow);
            updaterSetup = true;
          }
        });
      }, 5_000);
    }

    // ── Start auto-save heartbeat (every 30s) ──────────────
    if (!autoSaveInterval && mainWindow) {
      autoSaveInterval = setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('auto-save-tick');
        }
      }, 30_000);
    }
  });
}

function setupIPC() {
  ipcMain.handle('electron:save-file', async (_event, options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
    return dialog.showSaveDialog(mainWindow!, {
      defaultPath: options.defaultPath,
      filters: options.filters || [
        { name: 'Screenplay Files', extensions: ['screenplay'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
  });

  ipcMain.handle('electron:open-file', async (_event, options?: { filters?: { name: string; extensions: string[] }[] }) => {
    return dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: options?.filters || [
        { name: 'Screenplay Files', extensions: ['screenplay'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
  });

  ipcMain.handle('electron:read-file', async (_event, filePath: string) => {
    return (await import('fs/promises')).readFile(filePath, 'utf-8');
  });

  ipcMain.handle('electron:write-file', async (_event, filePath: string, content: string) => {
    const fsp = await import('fs/promises');
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, content, 'utf-8');
  });

  ipcMain.handle('electron:get-home-dir', () => app.getPath('home'));
  ipcMain.handle('electron:get-documents-dir', () => app.getPath('documents'));

  ipcMain.handle('electron:list-dir', async (_event, dirPath: string) => {
    const fsp = await import('fs/promises');
    try {
      const entries = await fsp.readdir(dirPath, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  });

  ipcMain.handle('electron:get-platform', () => process.platform);

  ipcMain.handle('electron:get-versions', () => ({
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    app: app.getVersion(),
  }));

  ipcMain.handle('electron:set-theme', (_event, theme: 'light' | 'dark' | 'system') => {
    nativeTheme.themeSource = theme;
  });

  ipcMain.handle('electron:is-packaged', () => app.isPackaged);

  ipcMain.handle('electron:open-external', (_event, url: string) => {
    shell.openExternal(url);
  });

  // ── New: User data path (for auto-save etc.) ─────────────
  ipcMain.handle('electron:get-user-data-path', () => app.getPath('userData'));

  // ── Preferences ──────────────────────────────────────────
  ipcMain.on('electron:get-preference-sync', (event, key: string) => {
    event.returnValue = getPreference(key);
  });

  ipcMain.handle('electron:set-preference', (_event, key: string, value: any) => {
    setPreference(key, value);
  });

  // ── New: Recent projects ─────────────────────────────────
  ipcMain.handle('electron:get-recent-projects', () => getRecentProjects());

  ipcMain.handle('electron:add-recent-project', (_event, project: { id: string; title: string; path?: string }) => {
    addRecentProject(project);
    // Rebuild menu with updated recent list
    if (mainWindow) setupMenu(mainWindow);
  });

  ipcMain.handle('electron:clear-recent-projects', () => {
    clearRecentProjects();
    if (mainWindow) setupMenu(mainWindow);
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    setupIPC();
    await createWindow();

    app.on('activate', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('before-quit', () => {
  stopLocalServer();
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
});

export { mainWindow };
