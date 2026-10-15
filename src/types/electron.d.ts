export {};

/** Mirrors the bridge exposed by `electron/preload.ts`. Keep the two in sync. */

export type DesktopMenuAction =
  | 'menu:new-project'
  | 'menu:open-file'
  | 'menu:save'
  | 'menu:save-as'
  | 'menu:open-recent'
  | 'menu:toggle-sidebar'
  | 'menu:shortcuts';

export interface DesktopRecentProject {
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

export type DesktopUpdateStatus =
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

declare global {
  interface Window {
    electron?: {
      platform: string;
      saveFile: (options?: { defaultPath?: string; filters?: FileFilter[] }) => Promise<{ canceled: boolean; filePath?: string }>;
      openFile: (options?: { filters?: FileFilter[] }) => Promise<{ canceled: boolean; filePaths: string[] }>;
      readFile: (filePath: string) => Promise<string>;
      writeFile: (filePath: string, content: string) => Promise<void>;
      getHomeDir: () => Promise<string>;
      getDocumentsDir: () => Promise<string>;
      listDir: (dirPath: string) => Promise<string[]>;
      getPlatform: () => Promise<string>;
      getVersions: () => Promise<{ node: string; chrome: string; electron: string; app: string }>;
      setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
      isPackaged: () => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
      getUserDataPath: () => Promise<string>;
      getRecentProjects: () => Promise<DesktopRecentProject[]>;
      addRecentProject: (project: { id: string; title: string; path?: string }) => Promise<void>;
      clearRecentProjects: () => Promise<void>;
      onMenuAction: (callback: (action: DesktopMenuAction, ...args: unknown[]) => void) => () => void;
      onAutoSaveTick: (callback: () => void) => () => void;
      onExternalFileOpen?: (callback: (filePath: string) => void) => () => void;
      takePendingFiles?: () => Promise<string[]>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getPreferenceSync: (key: string) => any;
      setPreference: (key: string, value: unknown) => Promise<void>;

      // Desktop shell — optional so older installed builds degrade quietly.
      getSettings?: () => Promise<DesktopSettings>;
      updateSettings?: (patch: Partial<DesktopSettings>) => Promise<DesktopSettings>;
      onSettingsChanged?: (callback: (settings: DesktopSettings) => void) => () => void;
      getInfo?: () => Promise<DesktopInfo>;
      openLocation?: (which: 'projects' | 'logs') => Promise<void>;
      newWindow?: (path?: string) => Promise<void>;
      onNavigate?: (callback: (path: string) => void) => () => void;
      setDocumentEdited?: (edited: boolean) => Promise<void>;
      getUpdateStatus?: () => Promise<DesktopUpdateStatus>;
      checkForUpdates?: () => Promise<void>;
      installUpdate?: () => Promise<void>;
      onUpdateStatus?: (callback: (status: DesktopUpdateStatus) => void) => () => void;
    };
  }
}
