import { BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

const USER_AGENT = 'ScreenplayStudio';

export function setupAutoUpdater(window: BrowserWindow) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (msg) => console.log('[updater]', msg),
    warn: (msg) => console.warn('[updater]', msg),
    error: (msg) => console.error('[updater]', msg),
  };

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'SondreWiger',
    repo: 'screenplay-studio',
    releaseType: 'release',
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] App is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[updater] Download progress: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is ready to install.`,
      detail: 'The app will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err);
  });

  // Check for updates 3 seconds after launch, then every 4 hours
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}
