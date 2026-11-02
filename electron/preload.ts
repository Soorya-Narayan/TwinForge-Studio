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
  printToPDF: (options?: {
    defaultPath?: string;
  }) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
  opcua: {
    connect: (endpointUrl?: string) => Promise<{ success: boolean; error?: string }>;
    disconnect: () => Promise<{ success: boolean }>;
    getStatus: () => Promise<{
      connected: boolean;
      endpointUrl: string;
      latencyMs: number;
      lastScanMs: number;
      serverRunning: boolean;
      serverEndpointUrl?: string;
      error?: string;
    }>;
    readTags: (tags: string[]) => Promise<Record<string, any>>;
    writeTags: (tags: Record<string, { value: any; dataType?: string }>) => Promise<{ success: boolean; error?: string }>;
    startLocalServer: (port?: number) => Promise<{ success: boolean; endpointUrl?: string; error?: string }>;
    stopLocalServer: () => Promise<{ success: boolean }>;
  };
}

const api: ElectronAPI = {
  platform: process.platform,
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  printToPDF: (options) => ipcRenderer.invoke('print:toPDF', options),
  opcua: {
    connect: (endpointUrl) => ipcRenderer.invoke('opcua:connect', endpointUrl),
    disconnect: () => ipcRenderer.invoke('opcua:disconnect'),
    getStatus: () => ipcRenderer.invoke('opcua:getStatus'),
    readTags: (tags) => ipcRenderer.invoke('opcua:readTags', tags),
    writeTags: (tags) => ipcRenderer.invoke('opcua:writeTags', tags),
    startLocalServer: (port) => ipcRenderer.invoke('opcua:startLocalServer', port),
    stopLocalServer: () => ipcRenderer.invoke('opcua:stopLocalServer'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
