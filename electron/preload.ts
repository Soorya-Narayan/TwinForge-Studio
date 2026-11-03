import { contextBridge, ipcRenderer } from 'electron';

export type OpcUaSecurityMode = 'None' | 'Sign' | 'SignAndEncrypt';
export type OpcUaSecurityPolicy =
  | 'None'
  | 'Basic256Sha256'
  | 'Aes128_Sha256_RsaOaep'
  | 'Basic256'
  | 'Basic128Rsa15';
export type OpcUaAuthMode = 'Anonymous' | 'Username' | 'Certificate';

export interface OpcUaConnectionOptions {
  endpointUrl: string;
  securityMode?: OpcUaSecurityMode;
  securityPolicy?: OpcUaSecurityPolicy;
  authMode?: OpcUaAuthMode;
  username?: string;
  password?: string;
  certificatePath?: string;
  privateKeyPath?: string;
}

export interface ProjectFileItem {
  name: string;
  relativePath: string;
  absolutePath: string;
  size: number;
  ext: string;
}

export interface ProjectScanResult {
  success: boolean;
  error?: string;
  folderPath?: string;
  folderName?: string;
  drawings?: ProjectFileItem[];
  datasheets?: ProjectFileItem[];
  plantData?: ProjectFileItem[];
  totalFiles?: number;
}

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
  openDirectory: () => Promise<{ canceled: boolean; folderPath?: string }>;
  openPath: (filePath: string) => Promise<string>;
  showItemInFolder: (filePath: string) => Promise<void>;
  getVersion: () => Promise<string>;
  printToPDF: (options?: {
    defaultPath?: string;
  }) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
  project: {
    openDirectory: () => Promise<{ canceled: boolean; folderPath?: string }>;
    scanDirectory: (folderPath: string) => Promise<ProjectScanResult>;
    readFile: (filePath: string, asBinary?: boolean) => Promise<{ success: boolean; content?: string; dataUri?: string; error?: string }>;
    openPath: (filePath: string) => Promise<string>;
  };
  opcua: {
    connect: (options?: string | OpcUaConnectionOptions) => Promise<{ success: boolean; error?: string }>;
    disconnect: () => Promise<{ success: boolean }>;
    getStatus: () => Promise<{
      connected: boolean;
      endpointUrl: string;
      securityMode?: OpcUaSecurityMode;
      securityPolicy?: OpcUaSecurityPolicy;
      authMode?: OpcUaAuthMode;
      latencyMs: number;
      lastScanMs: number;
      serverRunning: boolean;
      serverEndpointUrl?: string;
      error?: string;
    }>;
    readTags: (tags: string[]) => Promise<Record<string, any>>;
    readNodeDataTypes: (tags: string[]) => Promise<Record<string, string>>;
    writeTags: (tags: Record<string, { value: any; dataType?: string }>) => Promise<{ success: boolean; error?: string }>;
    startLocalServer: (port?: number) => Promise<{ success: boolean; endpointUrl?: string; error?: string }>;
    stopLocalServer: () => Promise<{ success: boolean }>;
  };
}

const api: ElectronAPI = {
  platform: process.platform,
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  printToPDF: (options) => ipcRenderer.invoke('print:toPDF', options),
  project: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    scanDirectory: (folderPath) => ipcRenderer.invoke('project:scanDirectory', folderPath),
    readFile: (filePath, asBinary) => ipcRenderer.invoke('project:readFile', filePath, asBinary),
    openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
  },
  opcua: {
    connect: (endpointUrl) => ipcRenderer.invoke('opcua:connect', endpointUrl),
    disconnect: () => ipcRenderer.invoke('opcua:disconnect'),
    getStatus: () => ipcRenderer.invoke('opcua:getStatus'),
    readTags: (tags) => ipcRenderer.invoke('opcua:readTags', tags),
    readNodeDataTypes: (tags) => ipcRenderer.invoke('opcua:readNodeDataTypes', tags),
    writeTags: (tags) => ipcRenderer.invoke('opcua:writeTags', tags),
    startLocalServer: (port) => ipcRenderer.invoke('opcua:startLocalServer', port),
    stopLocalServer: () => ipcRenderer.invoke('opcua:stopLocalServer'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
