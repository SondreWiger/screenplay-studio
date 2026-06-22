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
  // In packaged app, app.getAppPath() points inside the ASAR.
  // The standalone server must run from outside the ASAR.
  // electron-builder extracts asarUnpack files to resources/app.asar.unpacked/
  const resourcesPath = process.resourcesPath || app.getAppPath();

  // Try unpacked first (for packaged app)
  const unpacked = path.join(resourcesPath, 'app.asar.unpacked', '.next', 'standalone', 'server.js');
  if (fs.existsSync(unpacked)) return unpacked;

  // Try inside ASAR (may not work for spawn, but worth a try)
  const asar = path.join(app.getAppPath(), '.next', 'standalone', 'server.js');
  if (fs.existsSync(asar)) return asar;

  // Development: relative to project root
  const dev = path.join(__dirname, '..', '.next', 'standalone', 'server.js');
  if (fs.existsSync(dev)) return dev;

  return null;
}

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isDev) {
      resolve();
      return;
    }

    const serverPath = findServerScript();
    if (!serverPath) {
      console.error('[electron] server.js not found');
      resolve();
      return;
    }

    console.log(`[electron] starting server from: ${serverPath}`);

    serverProcess = spawn(process.execPath, [serverPath], {
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
      console.error('[server] error:', err);
      if (!resolved) {
        resolved = true;
        resolve(); // Don't block app launch
      }
    });

    serverProcess.on('exit', (code) => {
      console.log(`[server] exited with code ${code}`);
      serverProcess = null;
    });

    // Fallback: resolve after timeout so the app still launches
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 10_000);
  });
}

function waitForServer(url: string, maxRetries = 30): Promise<void> {
  return new Promise((resolve) => {
    let retries = 0;
    const check = () => {
      const http = require('http');
      http.get(url, (res: { statusCode: number }) => {
        console.log(`[electron] server responded with ${res.statusCode}`);
        resolve();
      }).on('error', () => {
        retries++;
        if (retries >= maxRetries) {
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.once('did-finish-load', () => {
    if (!menuSetup) {
      setupMenu(mainWindow!);
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
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: options.defaultPath,
      filters: options.filters || [
        { name: 'Screenplay Files', extensions: ['screenplay'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result;
  });

  ipcMain.handle('electron:open-file', async (_event, options?: { filters?: { name: string; extensions: string[] }[] }) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: options?.filters || [
        { name: 'Screenplay Files', extensions: ['screenplay'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result;
  });

  ipcMain.handle('electron:read-file', async (_event, filePath: string) => {
    const fs = await import('fs/promises');
    return fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('electron:write-file', async (_event, filePath: string, content: string) => {
    const fs = await import('fs/promises');
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
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
  if (!isMac) {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});

export { mainWindow };
