import { BrowserWindow, app, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import { getSettings } from './preferences';

/**
 * Background updates.
 *
 * Updates download quietly and the app says so in place — a banner in the
 * window and a menu item — instead of interrupting writing with a modal. The
 * only dialogs are answers to "Check for Updates…", which the user asked for.
 */

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'up-to-date' }
  | { state: 'error'; message: string };

let status: UpdateStatus = { state: 'idle' };
let initialised = false;
let manualCheck = false;
let periodic: ReturnType<typeof setInterval> | null = null;
let onChange: (() => void) | null = null;

const FOUR_HOURS = 4 * 60 * 60 * 1000;

function broadcast() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('desktop:update-status', status);
  }
  onChange?.();
}

function setStatus(next: UpdateStatus) {
  status = next;
  broadcast();
}

export function getUpdateStatus(): UpdateStatus {
  return status;
}

function parentWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

export function setupAutoUpdater(listener: () => void) {
  if (initialised) return;
  initialised = true;
  onChange = listener;

  autoUpdater.autoDownload = getSettings().autoUpdate;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (msg) => console.log('[updater]', msg),
    warn: (msg) => console.warn('[updater]', msg),
    error: (msg) => console.error('[updater]', msg),
    debug: () => {},
  };

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'SondreWiger',
    repo: 'screenplay-studio',
    releaseType: 'release',
  });

  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }));

  autoUpdater.on('update-available', async (info) => {
    setStatus({ state: 'downloading', version: info.version, percent: 0 });
    if (!autoUpdater.autoDownload) {
      // Automatic downloads are off, so this came from a manual check: ask.
      const win = parentWindow();
      const options = {
        type: 'info' as const,
        message: `Screenplay Studio ${info.version} is available`,
        detail: `You have ${app.getVersion()}. Download it now? You can keep working while it downloads.`,
        buttons: ['Download', 'Not Now'],
        defaultId: 0,
        cancelId: 1,
      };
      const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
      if (response === 0) {
        autoUpdater.downloadUpdate().catch((err) => setStatus({ state: 'error', message: String(err?.message || err) }));
      } else {
        setStatus({ state: 'idle' });
      }
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (status.state === 'downloading') {
      setStatus({ ...status, percent: Math.round(progress.percent) });
    }
  });

  autoUpdater.on('update-not-available', async () => {
    setStatus({ state: 'up-to-date' });
    if (manualCheck) {
      manualCheck = false;
      const win = parentWindow();
      const options = {
        type: 'info' as const,
        message: 'You’re up to date',
        detail: `Screenplay Studio ${app.getVersion()} is the newest version.`,
        buttons: ['OK'],
      };
      if (win) await dialog.showMessageBox(win, options);
      else await dialog.showMessageBox(options);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    manualCheck = false;
    setStatus({ state: 'ready', version: info.version });
  });

  autoUpdater.on('error', async (err) => {
    const message = String(err?.message || err);
    console.error('[updater] Error:', message);
    setStatus({ state: 'error', message });
    if (manualCheck) {
      manualCheck = false;
      const win = parentWindow();
      const options = {
        type: 'warning' as const,
        message: 'Couldn’t check for updates',
        detail: 'Check your internet connection and try again. You can also download the latest version from screenplaystudio.fun/download.',
        buttons: ['OK'],
      };
      if (win) await dialog.showMessageBox(win, options);
      else await dialog.showMessageBox(options);
    }
  });

  applyUpdatePreference();
}

/** Re-read the auto-update setting and start or stop background checks. */
export function applyUpdatePreference() {
  if (!initialised) return;
  const enabled = getSettings().autoUpdate;
  autoUpdater.autoDownload = enabled;
  if (enabled && !periodic) {
    setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}); }, 3_000);
    periodic = setInterval(() => { autoUpdater.checkForUpdates().catch(() => {}); }, FOUR_HOURS);
  } else if (!enabled && periodic) {
    clearInterval(periodic);
    periodic = null;
  }
}

export function checkForUpdatesManually() {
  if (!initialised) {
    const win = parentWindow();
    const options = {
      type: 'info' as const,
      message: 'Updates aren’t available in development builds',
      buttons: ['OK'],
    };
    void (win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options));
    return;
  }
  if (status.state === 'ready') {
    installUpdate();
    return;
  }
  manualCheck = true;
  autoUpdater.checkForUpdates().catch(() => {});
}

export function installUpdate() {
  if (status.state !== 'ready') return;
  // Give windows a beat to flush their autosave before the app restarts.
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('auto-save-tick');
  }
  setTimeout(() => autoUpdater.quitAndInstall(), 600);
}
