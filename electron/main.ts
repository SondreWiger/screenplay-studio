import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import { setupMenu } from './menu';

const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';
const SERVER_PORT = 3456;

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let menuSetup = false;
let updaterSetup = false;

function getDevUrl(): string {
  return process.env.ELECTRON_DEV_URL || 'http://localhost:3000';
}

function getServerUrl(): string {
  return `http://localhost:${SERVER_PORT}`;
}

function findServerScript(): string | null {
  if (isDev) return null;

  // extraResources copies to Resources/app/
  const resourcesPath = process.resourcesPath;
  const candidate = path.join(resourcesPath, 'app', 'server.js');
  console.log(`[electron] looking for server at: ${candidate}`);
  if (fs.existsSync(candidate)) return candidate;

  // Fallback: check asarUnpacked
  const unpacked = path.join(resourcesPath, 'app.asar.unpacked', '.next', 'standalone', 'server.js');
  if (fs.existsSync(unpacked)) return unpacked;

  console.error('[electron] server.js not found');
  return null;
}

function startServer(): Promise<void> {
  return new Promise((resolve) => {
    if (isDev) {
      resolve();
      return;
    }

    const serverPath = findServerScript();
    if (!serverPath) {
      console.error('[electron] No server found, resolving anyway');
      resolve();
      return;
    }

    const serverDir = path.dirname(serverPath);
    console.log(`[electron] starting server from: ${serverDir}`);

    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: serverDir,
      env: { ...process.env, PORT: String(SERVER_PORT), HOSTNAME: 'localhost' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let resolved = false;

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      console.log(`[server] ${msg}`);
      if (!resolved && (msg.includes('Ready') || msg.includes('started') || msg.includes('listening'))) {
        resolved = true;
        resolve();
      }
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString();
      console.error(`[server] ${msg}`);
      if (!resolved && (msg.includes('Ready') || msg.includes('listening') || msg.includes('started'))) {
        resolved = true;
        resolve();
      }
    });

    serverProcess.on('error', (err) => {
      console.error('[server] spawn error:', err);
      if (!resolved) { resolved = true; resolve(); }
    });

    serverProcess.on('exit', (code) => {
      console.log(`[server] exited with code ${code}`);
      serverProcess = null;
    });

    setTimeout(() => {
      if (!resolved) { resolved = true; resolve(); }
    }, 15_000);
  });
}

function waitForServer(url: string, maxRetries = 30): Promise<void> {
  return new Promise((resolve) => {
    let retries = 0;
    const check = () => {
      const http = require('http');
      http.get(url, () => {
        resolve();
      }).on('error', () => {
        if (++retries >= maxRetries) {
          console.log('[electron] server did not respond, proceeding anyway');
          resolve();
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
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
    },
    backgroundColor: '#070710',
    show: false,
  });

  const url = isDev ? getDevUrl() : getServerUrl();

  if (!isDev) {
    await waitForServer(url);
  }

  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
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
    const fs2 = await import('fs/promises');
    await fs2.mkdir(path.dirname(filePath), { recursive: true });
    await fs2.writeFile(filePath, content, 'utf-8');
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
}

// ── Single instance lock ────────────────────────────────────
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
    await startServer();
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
  stopServer();
  if (!isMac) app.quit();
});

app.on('before-quit', () => { stopServer(); });

export { mainWindow };
