import { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme } from 'electron';
import * as path from 'path';
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

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isDev) {
      resolve();
      return;
    }

    // Next.js standalone output: .next/standalone/server.js
    const appDir = app.getAppPath();
    const serverPath = path.join(appDir, '.next', 'standalone', 'server.js');

    serverProcess = spawn(process.execPath, [serverPath], {
      env: { ...process.env, PORT: String(SERVER_PORT), HOSTNAME: 'localhost' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      console.log(`[server] ${msg}`);
      if (msg.includes('Ready') || msg.includes('started') || msg.includes('listening')) {
        resolve();
      }
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[server] ${data.toString()}`);
    });

    serverProcess.on('error', reject);
    serverProcess.on('exit', (code) => {
      console.log(`[server] exited with code ${code}`);
      serverProcess = null;
    });

    // Fallback: resolve after timeout so the app still launches
    setTimeout(() => resolve(), 5_000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

function createWindow() {
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

app.whenReady().then(async () => {
  setupIPC();
  await startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

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
