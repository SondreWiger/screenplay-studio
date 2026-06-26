export {};

type MenuAction = 'menu:new-project' | 'menu:open-file' | 'menu:save' | 'menu:save-as';

declare global {
  interface Window {
    electron?: {
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
      onMenuAction: (callback: (action: MenuAction) => void) => () => void;
      onAutoSaveTick: (callback: () => void) => () => void;
      getPreferenceSync: (key: string) => any;
      setPreference: (key: string, value: any) => Promise<void>;
    };
  }
}
