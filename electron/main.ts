import { app, BrowserWindow, ipcMain, dialog, session, shell, nativeTheme, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { addRecentProject, clearRecentProjects, getRecentProjects, handleLaunchArgs, openProjectsFolder, rebuildMenus, setupMenus } from './menu';
import { getLogPath, serverEvents, stopLocalServer } from './next-server';
import { flushPreferences, getPreference, getSettings, setPreference, updateSettings, type DesktopSettings } from './preferences';
import { applyUpdatePreference, checkForUpdatesManually, getUpdateStatus, installUpdate, setupAutoUpdater } from './updater';
import {
  applySpellcheckToAll, applyZoomToAll, broadcast, createAppWindow, getAppOrigin, isAppUrl,
  reloadAllWindows, setWindowsChangedListener, targetWindow,
} from './windows';

const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';

// Notifications and the jump list are tied to this id on Windows.
if (process.platform === 'win32') app.setAppUserModelId('fun.screenplaystudio.app');

// ── Files opened from Finder / Explorer ─────────────────────────

let pendingFiles: string[] = [];
let appReady = false;

function isOpenableFile(arg: string | undefined): arg is string {
  return !!arg && !arg.startsWith('-') && /\.(screenplay|fountain|fdx|studio|json)$/i.test(arg);
}

function deliverFile(filePath: string) {
  const win = targetWindow();
  if (!win) {
    pendingFiles.push(filePath);
    createAppWindow({ path: '/dashboard' });
    return;
  }
  if (win.isMinimized()) win.restore();
  win.focus();
  app.addRecentDocument(filePath);
  // The renderer may still be loading; it asks for queued files once ready.
  if (isAppUrl(win.webContents.getURL()) && !win.webContents.isLoading()) {
    win.webContents.send('open-external-file', filePath);
  } else {
    pendingFiles.push(filePath);
  }
}

// macOS: a file double-clicked in Finder, before or after launch.
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (appReady) deliverFile(filePath);
  else pendingFiles.push(filePath);
});

// Windows / Linux: the file arrives as a command-line argument.
if (!isMac) {
  const fileArg = process.argv.slice(app.isPackaged ? 1 : 2).find(isOpenableFile);
  if (fileArg) pendingFiles.push(fileArg);
}

// ── IPC ────────────────────────────────────────────────────────

/**
 * Only the app's own pages get the desktop bridge. A window can briefly show a
 * remote page (signing in with a provider), and that page must not be able to
 * read or write files.
 */
function isTrusted(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? '';
  if (isAppUrl(url)) return true;
  const origin = getAppOrigin();
  return !!origin && url.startsWith(origin);
}

function handle(channel: string, fn: (event: IpcMainInvokeEvent, ...args: any[]) => unknown) { // eslint-disable-line @typescript-eslint/no-explicit-any
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrusted(event)) throw new Error('Not allowed from this page.');
    return fn(event, ...args);
  });
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? undefined;
}

function applySettings(next: DesktopSettings, previous: DesktopSettings) {
  if (next.theme !== previous.theme) nativeTheme.themeSource = next.theme;
  if (next.zoomLevel !== previous.zoomLevel) applyZoomToAll(next.zoomLevel);
  if (next.spellcheck !== previous.spellcheck) applySpellcheckToAll(next.spellcheck);
  if (next.autoUpdate !== previous.autoUpdate) applyUpdatePreference();
  broadcast('desktop:settings-changed', next);
  rebuildMenus();
}

type FileFilter = { name: string; extensions: string[] };

function setupIPC() {
  handle('electron:save-file', async (event, options: { defaultPath?: string; filters?: FileFilter[] } = {}) => {
    const win = senderWindow(event);
    const opts = {
      defaultPath: options.defaultPath,
      filters: options.filters || [
        { name: 'Screenplay Files', extensions: ['screenplay'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    };
    const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (!result.canceled && result.filePath) app.addRecentDocument(result.filePath);
    return result;
  });

  handle('electron:open-file', async (event, options?: { filters?: FileFilter[] }) => {
    const win = senderWindow(event);
    const opts = {
      properties: ['openFile' as const],
      filters: options?.filters || [
        { name: 'Screenplay Files', extensions: ['screenplay'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    };
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (!result.canceled && result.filePaths[0]) app.addRecentDocument(result.filePaths[0]);
    return result;
  });

  handle('electron:read-file', async (_event, filePath: string) => {
    return (await import('fs/promises')).readFile(filePath, 'utf-8');
  });

  handle('electron:write-file', async (_event, filePath: string, content: string) => {
    const fsp = await import('fs/promises');
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    // Write beside the target and rename over it, so a crash or full disk
    // mid-save never leaves a truncated project file behind.
    const tmp = `${filePath}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, content, 'utf-8');
    await fsp.rename(tmp, filePath);
  });

  handle('electron:get-home-dir', () => app.getPath('home'));
  handle('electron:get-documents-dir', () => app.getPath('documents'));

  handle('electron:list-dir', async (_event, dirPath: string) => {
    const fsp = await import('fs/promises');
    try {
      const entries = await fsp.readdir(dirPath, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  });

  handle('electron:get-platform', () => process.platform);

  handle('electron:get-versions', () => ({
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    app: app.getVersion(),
  }));

  handle('electron:set-theme', (_event, theme: 'light' | 'dark' | 'system') => {
    const previous = getSettings();
    applySettings(updateSettings({ theme }), previous);
  });

  handle('electron:is-packaged', () => app.isPackaged);

  handle('electron:open-external', (_event, url: string) => {
    if (/^(https?:|mailto:)/i.test(url)) void shell.openExternal(url);
  });

  handle('electron:get-user-data-path', () => app.getPath('userData'));

  // The web app's own keys (local mode, onboarding) — synchronous because
  // auth decides local vs cloud before its first render.
  ipcMain.on('electron:get-preference-sync', (event, key: string) => {
    event.returnValue = isTrusted(event) ? getPreference(key) : undefined;
  });
  handle('electron:set-preference', (_event, key: string, value: unknown) => {
    if (typeof key === 'string' && key.startsWith('ss-')) setPreference(key, value);
  });

  handle('electron:get-recent-projects', () => getRecentProjects());
  handle('electron:add-recent-project', (_event, project: { id: string; title: string; path?: string }) => {
    if (project && typeof project.id === 'string') addRecentProject(project);
  });
  handle('electron:clear-recent-projects', () => clearRecentProjects());

  // ── Desktop settings and app info ───────────────────────────
  handle('desktop:get-settings', () => getSettings());
  handle('desktop:update-settings', (_event, patch: Partial<DesktopSettings>) => {
    const previous = getSettings();
    const next = updateSettings(patch || {});
    applySettings(next, previous);
    return next;
  });

  handle('desktop:get-info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    projectsFolder: path.join(app.getPath('documents'), 'ScreenplayStudio', 'projects'),
    logPath: getLogPath(),
    isPackaged: app.isPackaged,
  }));

  handle('desktop:open-location', (_event, which: 'projects' | 'logs') => {
    if (which === 'projects') openProjectsFolder();
    else if (which === 'logs') shell.showItemInFolder(getLogPath());
  });

  handle('desktop:new-window', (_event, appPath?: string) => {
    createAppWindow({ path: typeof appPath === 'string' && appPath.startsWith('/') ? appPath : '/dashboard' });
  });

  handle('desktop:get-update-status', () => getUpdateStatus());
  handle('desktop:check-for-updates', () => checkForUpdatesManually());
  handle('desktop:install-update', () => installUpdate());

  handle('desktop:set-document-edited', (event, edited: boolean) => {
    const win = senderWindow(event);
    if (win && isMac) win.setDocumentEdited(!!edited);
  });

  // Files that arrived before this window's page was ready.
  handle('desktop:take-pending-files', () => {
    const files = pendingFiles;
    pendingFiles = [];
    for (const f of files) app.addRecentDocument(f);
    return files;
  });
}

// ── Lifecycle ──────────────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (handleLaunchArgs(commandLine)) return;
    const fileArg = commandLine.slice(1).find(isOpenableFile);
    if (fileArg) {
      deliverFile(fileArg);
      return;
    }
    const win = targetWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    } else {
      createAppWindow();
    }
  });

  app.whenReady().then(() => {
    appReady = true;
    nativeTheme.themeSource = getSettings().theme;

    // Notifications (reminders, collaborator activity) and the clipboard are
    // the only permissions the app asks for; camera and mic for the table read
    // and slate tools are allowed on the app's own pages.
    session.fromPartition('persist:screenplay').setPermissionRequestHandler((contents, permission, callback, details) => {
      const fromApp = isAppUrl(details.requestingUrl || contents.getURL());
      const allowed = ['notifications', 'clipboard-read', 'clipboard-sanitized-write', 'media', 'fullscreen', 'pointerLock'];
      callback(fromApp && allowed.includes(permission));
    });

    setupIPC();
    setWindowsChangedListener(() => rebuildMenus());
    setupMenus();

    if (!handleLaunchArgs(process.argv)) createAppWindow();

    if (!isDev) {
      setTimeout(() => setupAutoUpdater(() => rebuildMenus()), 5_000);
    }

    // If the bundled server dies, start it again and bring every window back.
    serverEvents.on('exit', () => {
      console.error('[main] Local server exited; restarting.');
      reloadAllWindows();
    });

    // Autosave heartbeat for the editor's on-disk copy.
    setInterval(() => broadcast('auto-save-tick'), 30_000);

    app.on('activate', () => {
      // macOS: clicking the dock icon with no windows open opens one.
      if (BrowserWindow.getAllWindows().length === 0) createAppWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('before-quit', () => {
  broadcast('auto-save-tick');
  flushPreferences();
});

app.on('will-quit', () => {
  stopLocalServer();
});
