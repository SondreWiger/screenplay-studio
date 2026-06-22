import { contextBridge, ipcRenderer } from 'electron';

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
  getPlatform: () => Promise<string>;
  getVersions: () => Promise<{
    node: string;
    chrome: string;
    electron: string;
    app: string;
  }>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  isPackaged: () => Promise<boolean>;
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
  getPlatform: () =>
    ipcRenderer.invoke('electron:get-platform'),
  getVersions: () =>
    ipcRenderer.invoke('electron:get-versions'),
  setTheme: (theme: 'light' | 'dark' | 'system') =>
    ipcRenderer.invoke('electron:set-theme', theme),
  isPackaged: () =>
    ipcRenderer.invoke('electron:is-packaged'),
} satisfies ElectronAPI);
