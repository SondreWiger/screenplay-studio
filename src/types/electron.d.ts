export {};

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
      getPlatform: () => Promise<string>;
      getVersions: () => Promise<{
        node: string;
        chrome: string;
        electron: string;
        app: string;
      }>;
      setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
      isPackaged: () => Promise<boolean>;
    };
  }
}
