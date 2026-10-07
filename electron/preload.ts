import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
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
}

const api: ElectronAPI = {
  platform: process.platform,
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
