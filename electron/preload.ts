import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

export type MenuAction =
  | 'menu:new-project'
  | 'menu:open-file'
  | 'menu:save'
  | 'menu:save-as'
  | 'menu:open-recent'
  | 'menu:toggle-sidebar'
  | 'menu:shortcuts';

export interface RecentProject {
  id: string;
  title: string;
  path?: string;
  lastOpened: string;
}

export interface DesktopSettings {
  theme: 'system' | 'light' | 'dark';
  zoomLevel: number;
  spellcheck: boolean;
  launchBehaviour: 'restore' | 'dashboard';
  autoUpdate: boolean;
  lastPath: string;
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'up-to-date' }
  | { state: 'error'; message: string };

export interface DesktopInfo {
  version: string;
  platform: string;
  arch: string;
  electron: string;
  chrome: string;
  projectsFolder: string;
  logPath: string;
  isPackaged: boolean;
}

type FileFilter = { name: string; extensions: string[] };

const MENU_CHANNELS: MenuAction[] = [
  'menu:new-project', 'menu:open-file', 'menu:save', 'menu:save-as', 'menu:toggle-sidebar', 'menu:shortcuts',
];

/** Subscribe to a main-process channel; returns the unsubscribe function. */
function subscribe<T extends unknown[]>(channel: string, callback: (...args: T) => void): () => void {
  const fn = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...(args as T));
  ipcRenderer.on(channel, fn);
  return () => { ipcRenderer.removeListener(channel, fn); };
}

// ── Window chrome classes ───────────────────────────────────────
// Set before the page's own scripts run so the layout reserves room for the
// macOS traffic lights from the first paint, with no React involvement.

function setRootClass(name: string, on: boolean) {
  const root = document.documentElement;
  if (root) root.classList.toggle(name, on);
}

function applyBaseClasses() {
  setRootClass('desktop', true);
  setRootClass(`desktop-${process.platform}`, true);
}

if (document.documentElement) applyBaseClasses();
document.addEventListener('DOMContentLoaded', applyBaseClasses);
ipcRenderer.on('desktop:window-state', (_event, state: { fullscreen: boolean; focused: boolean }) => {
  setRootClass('desktop-fullscreen', !!state?.fullscreen);
  setRootClass('desktop-inactive', !state?.focused);
});

const api = {
  /** Synchronous so layout code can branch before first render. */
  platform: process.platform,

  saveFile: (options?: { defaultPath?: string; filters?: FileFilter[] }): Promise<{ canceled: boolean; filePath?: string }> =>
    ipcRenderer.invoke('electron:save-file', options),
  openFile: (options?: { filters?: FileFilter[] }): Promise<{ canceled: boolean; filePaths: string[] }> =>
    ipcRenderer.invoke('electron:open-file', options),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('electron:read-file', filePath),
  writeFile: (filePath: string, content: string): Promise<void> => ipcRenderer.invoke('electron:write-file', filePath, content),
  getHomeDir: (): Promise<string> => ipcRenderer.invoke('electron:get-home-dir'),
  getDocumentsDir: (): Promise<string> => ipcRenderer.invoke('electron:get-documents-dir'),
  listDir: (dirPath: string): Promise<string[]> => ipcRenderer.invoke('electron:list-dir', dirPath),
  getPlatform: (): Promise<string> => ipcRenderer.invoke('electron:get-platform'),
  getVersions: (): Promise<{ node: string; chrome: string; electron: string; app: string }> =>
    ipcRenderer.invoke('electron:get-versions'),
  setTheme: (theme: 'light' | 'dark' | 'system'): Promise<void> => ipcRenderer.invoke('electron:set-theme', theme),
  isPackaged: (): Promise<boolean> => ipcRenderer.invoke('electron:is-packaged'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('electron:open-external', url),
  getUserDataPath: (): Promise<string> => ipcRenderer.invoke('electron:get-user-data-path'),

  getRecentProjects: (): Promise<RecentProject[]> => ipcRenderer.invoke('electron:get-recent-projects'),
  addRecentProject: (project: { id: string; title: string; path?: string }): Promise<void> =>
    ipcRenderer.invoke('electron:add-recent-project', project),
  clearRecentProjects: (): Promise<void> => ipcRenderer.invoke('electron:clear-recent-projects'),

  onMenuAction: (callback: (action: MenuAction, ...args: unknown[]) => void): (() => void) => {
    const offs = MENU_CHANNELS.map((channel) => subscribe(channel, (...args: unknown[]) => callback(channel, ...args)));
    offs.push(subscribe('menu:open-recent', (projectId: unknown) => callback('menu:open-recent', projectId)));
    return () => offs.forEach((off) => off());
  },
  onAutoSaveTick: (callback: () => void): (() => void) => subscribe('auto-save-tick', callback),
  onExternalFileOpen: (callback: (filePath: string) => void): (() => void) => subscribe('open-external-file', callback),
  /** Files opened from Finder/Explorer before this page was ready. */
  takePendingFiles: (): Promise<string[]> => ipcRenderer.invoke('desktop:take-pending-files'),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPreferenceSync: (key: string): any => ipcRenderer.sendSync('electron:get-preference-sync', key),
  setPreference: (key: string, value: unknown): Promise<void> => ipcRenderer.invoke('electron:set-preference', key, value),

  // ── Desktop shell ─────────────────────────────────────────────
  getSettings: (): Promise<DesktopSettings> => ipcRenderer.invoke('desktop:get-settings'),
  updateSettings: (patch: Partial<DesktopSettings>): Promise<DesktopSettings> => ipcRenderer.invoke('desktop:update-settings', patch),
  onSettingsChanged: (callback: (settings: DesktopSettings) => void): (() => void) => subscribe('desktop:settings-changed', callback),
  getInfo: (): Promise<DesktopInfo> => ipcRenderer.invoke('desktop:get-info'),
  openLocation: (which: 'projects' | 'logs'): Promise<void> => ipcRenderer.invoke('desktop:open-location', which),
  newWindow: (path?: string): Promise<void> => ipcRenderer.invoke('desktop:new-window', path),
  onNavigate: (callback: (path: string) => void): (() => void) => subscribe('desktop:navigate', callback),
  setDocumentEdited: (edited: boolean): Promise<void> => ipcRenderer.invoke('desktop:set-document-edited', edited),

  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('desktop:get-update-status'),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('desktop:check-for-updates'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('desktop:install-update'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => subscribe('desktop:update-status', callback),
};

export type ElectronAPI = typeof api;

contextBridge.exposeInMainWorld('electron', api);
