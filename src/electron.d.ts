export interface ElectronBridge {
  platform: string;
  saveFile: (options: {
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
    content: string;
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  openFile: (options?: {
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<{ canceled: boolean; filePath?: string; content?: string }>;
  showItemInFolder: (filePath: string) => Promise<void>;
  getVersion: () => Promise<string>;
  printToPDF?: (options?: {
    defaultPath?: string;
  }) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronBridge;
  }
}
