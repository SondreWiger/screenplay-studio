import { contextBridge, ipcRenderer } from 'electron';

export type MenuAction = 'menu:new-project' | 'menu:open-file' | 'menu:save' | 'menu:save-as' | 'menu:open-recent';

export interface RecentProject {
  id: string;
  title: string;
  path?: string;
  lastOpened: string;
}

export interface ElectronAPI {
  saveFile: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<{
    canceled: boolean;
    filePath?: string;
  }>;
  openFile: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<{
    canceled: boolean;
    filePaths: string[];
  }>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  getHomeDir: () => Promise<string>;
  getDocumentsDir: () => Promise<string>;
  listDir: (dirPath: string) => Promise<string[]>;
  getPlatform: () => Promise<string>;
  getVersions: () => Promise<{
    node: string;
    chrome: string;
    electron: string;
    app: string;
  }>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  isPackaged: () => Promise<boolean>;
  openExternal: (url: string) => Promise<void>;
  getUserDataPath: () => Promise<string>;
  getRecentProjects: () => Promise<RecentProject[]>;
  addRecentProject: (project: { id: string; title: string; path?: string }) => Promise<void>;
  clearRecentProjects: () => Promise<void>;
  onMenuAction: (callback: (action: MenuAction, ...args: unknown[]) => void) => () => void;
  onAutoSaveTick: (callback: () => void) => () => void;
  getPreferenceSync: (key: string) => any;
  setPreference: (key: string, value: any) => Promise<void>;
}

contextBridge.exposeInMainWorld('electron', {
  saveFile: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('electron:save-file', options),
  openFile: (options?: { filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('electron:open-file', options),
  readFile: (filePath: string) =>
    ipcRenderer.invoke('electron:read-file', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('electron:write-file', filePath, content),
  getHomeDir: () =>
    ipcRenderer.invoke('electron:get-home-dir'),
  getDocumentsDir: () =>
    ipcRenderer.invoke('electron:get-documents-dir'),
  listDir: (dirPath: string) =>
    ipcRenderer.invoke('electron:list-dir', dirPath),
  getPlatform: () =>
    ipcRenderer.invoke('electron:get-platform'),
  getVersions: () =>
    ipcRenderer.invoke('electron:get-versions'),
  setTheme: (theme: 'light' | 'dark' | 'system') =>
    ipcRenderer.invoke('electron:set-theme', theme),
  isPackaged: () =>
    ipcRenderer.invoke('electron:is-packaged'),
  openExternal: (url: string) =>
    ipcRenderer.invoke('electron:open-external', url),
  getUserDataPath: () =>
    ipcRenderer.invoke('electron:get-user-data-path'),
  getRecentProjects: () =>
    ipcRenderer.invoke('electron:get-recent-projects'),
  addRecentProject: (project: { id: string; title: string; path?: string }) =>
    ipcRenderer.invoke('electron:add-recent-project', project),
  clearRecentProjects: () =>
    ipcRenderer.invoke('electron:clear-recent-projects'),
  onMenuAction: (callback: (action: MenuAction, ...args: unknown[]) => void) => {
    const channels: MenuAction[] = ['menu:new-project', 'menu:open-file', 'menu:save', 'menu:save-as'];
    const handlers = channels.map((channel) => {
      const fn = () => callback(channel);
      ipcRenderer.on(channel, fn);
      return { channel, fn };
    });
    // Also handle open-recent with project id argument
    const recentFn = (_event: Electron.IpcRendererEvent, projectId: string) => callback('menu:open-recent', projectId);
    ipcRenderer.on('menu:open-recent', recentFn);
    return () => {
      handlers.forEach(({ channel, fn }) => ipcRenderer.removeListener(channel, fn));
      ipcRenderer.removeListener('menu:open-recent', recentFn);
    };
  },
  onAutoSaveTick: (callback: () => void) => {
    const fn = () => callback();
    ipcRenderer.on('auto-save-tick', fn);
    return () => {
      ipcRenderer.removeListener('auto-save-tick', fn);
    };
  },
  getPreferenceSync: (key: string) => ipcRenderer.sendSync('electron:get-preference-sync', key),
  setPreference: (key: string, value: any) => ipcRenderer.invoke('electron:set-preference', key, value),
} satisfies ElectronAPI);
