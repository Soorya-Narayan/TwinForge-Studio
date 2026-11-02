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
  opcua?: {
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
    writeTags: (tags: Record<string, { value: any; dataType?: string }>) => Promise<{ success: boolean; error?: string }>;
    startLocalServer: (port?: number) => Promise<{ success: boolean; endpointUrl?: string; error?: string }>;
    stopLocalServer: () => Promise<{ success: boolean }>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronBridge;
  }
}
