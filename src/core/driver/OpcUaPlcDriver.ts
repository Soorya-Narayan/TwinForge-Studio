/**
 * TwinForge Studio - OPC UA Real PLC Driver
 * 
 * Communicates with external PLC controllers over OPC UA (IEC 62541).
 * Uses node-opcua in Electron main process to read live outputs and write simulation sensors.
 */

import type { Driver, DriverStatus } from './Driver';
import { loadStoredTagMap } from './opcuaTagMap';

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
  tagMap?: Record<string, string>;
}

export interface InterlockStatus {
  id: string;
  name: string;
  condition: string;
  isOk: boolean;
  tripped: boolean;
}

function getElectronOpcUa() {
  if (typeof window !== 'undefined' && window.electronAPI?.opcua) {
    return window.electronAPI.opcua;
  }
  return null;
}

export class OpcUaPlcDriver implements Driver {
  public status: DriverStatus = {
    connected: false,
    driverType: 'opcua',
    scanRateHz: 10,
    lastScanMs: 0,
    latencyMs: 0,
  };

  public endpointUrl: string = 'opc.tcp://127.0.0.1:4840';
  public securityOptions: OpcUaConnectionOptions = {
    endpointUrl: 'opc.tcp://127.0.0.1:4840',
    securityMode: 'None',
    securityPolicy: 'None',
    authMode: 'Anonymous',
  };
  public serverRunning: boolean = false;
  public state: string = 'OFFLINE';
  public tagMap: Record<string, string> = {};

  // Live I/O mirrors matching industrial PLC register tags
  public inputs: Record<string, boolean | number> = {};
  public outputs: Record<string, boolean | number> = {};

  // Interlock status parsed from real PLC
  public interlocks: Map<string, InterlockStatus> = new Map([
    ['IL-01', { id: 'IL-01', name: 'Suction Valve Interlock (OPC UA)', condition: 'Pump P-100 locked out unless V-101 is open', isOk: true, tripped: false }],
    ['IL-02', { id: 'IL-02', name: 'Low Level Permissive (OPC UA)', condition: 'TK-100 inventory must be > 50%', isOk: true, tripped: false }],
    ['IL-03', { id: 'IL-03', name: 'High Temperature Safety (OPC UA)', condition: 'TT-100 must be <= 95°C', isOk: true, tripped: false }],
    ['IL-FDV', { id: 'IL-FDV', name: 'Legal Flow Diversion (OPC UA)', condition: 'TT5 >= 88.0°C for forward product flow', isOk: true, tripped: false }],
    ['IL-DIFF', { id: 'IL-DIFF', name: 'Sanitary Differential Pressure (OPC UA)', condition: 'PT4 - PT2 >= 0.5 bar', isOk: true, tripped: false }],
  ]);

  // Output tags to read cyclically from the real PLC
  public outputTags: string[] = [
    // Batch Mixing Skid
    'P100_START',
    'V101_CMD',
    'V102_CMD',
    'V103_CMD',
    'HEATER_CMD',
    'AGITATOR_CMD',
    'PLC_STATE',
    'IL-01',
    'IL-02',
    'IL-03',

    // Pasteurizer Skid
    'P_FEED_CMD',
    'P_BOOSTER_CMD',
    'P_HOT_WATER_CMD',
    'PV11_CMD',
    'PV12_CMD',
    'MOD_VALVE',
    'IL-FDV',
    'IL-DIFF',
  ];

  private isReading: boolean = false;
  private isWriting: boolean = false;

  constructor(endpointOrOptions?: string | OpcUaConnectionOptions) {
    if (typeof endpointOrOptions === 'string') {
      this.endpointUrl = endpointOrOptions;
      this.securityOptions.endpointUrl = endpointOrOptions;
      this.tagMap = loadStoredTagMap();
    } else if (endpointOrOptions) {
      this.securityOptions = { ...this.securityOptions, ...endpointOrOptions };
      this.endpointUrl = endpointOrOptions.endpointUrl || this.endpointUrl;
      this.tagMap = endpointOrOptions.tagMap ? { ...endpointOrOptions.tagMap } : loadStoredTagMap();
    } else {
      this.tagMap = loadStoredTagMap();
    }
  }

  /**
   * Set or update tag mapping (internal simulator tag -> real PLC NodeId)
   */
  public setTagMap(tagMap: Record<string, string>): void {
    this.tagMap = { ...this.tagMap, ...tagMap };
  }

  /**
   * Get active tag mapping table
   */
  public getTagMap(): Record<string, string> {
    return { ...this.tagMap };
  }

  /**
   * Translate internal tag name to real PLC NodeId
   */
  public resolvePlcNodeId(internalTag: string): string {
    return this.tagMap[internalTag] || internalTag;
  }

  /**
   * Connect to the live OPC UA server via Electron IPC bridge
   */
  public async connect(options?: string | OpcUaConnectionOptions): Promise<void> {
    const connOpts: OpcUaConnectionOptions = typeof options === 'string'
      ? { ...this.securityOptions, endpointUrl: options }
      : options
      ? { ...this.securityOptions, ...options }
      : this.securityOptions;

    this.endpointUrl = connOpts.endpointUrl || this.endpointUrl;
    this.securityOptions = connOpts;

    const api = getElectronOpcUa();
    if (api) {
      const res = await api.connect(connOpts);
      if (res.success) {
        this.status.connected = true;
        this.state = 'CONNECTED';
        await this.syncOutputsFromPlc();
      } else {
        this.status.connected = false;
        this.state = 'DISCONNECTED';
        throw new Error(res.error || 'Failed to connect to OPC UA server');
      }
    } else {
      // Browser/headless fallback (mock connected state for demonstration when running without Electron)
      this.status.connected = true;
      this.state = 'EMULATED_CONNECTED';
    }
  }

  /**
   * Disconnect from live OPC UA server
   */
  public async disconnect(): Promise<void> {
    const api = getElectronOpcUa();
    if (api) {
      await api.disconnect();
    }
    this.status.connected = false;
    this.state = 'OFFLINE';
  }

  /**
   * Start local embedded test OPC UA server
   */
  public async startLocalServer(port: number = 4840): Promise<string> {
    const api = getElectronOpcUa();
    if (!api) {
      throw new Error('Local OPC UA Server requires Electron runtime.');
    }
    const res = await api.startLocalServer(port);
    if (!res.success || !res.endpointUrl) {
      throw new Error(res.error || 'Could not start local test OPC UA server');
    }
    this.serverRunning = true;
    this.endpointUrl = res.endpointUrl;
    return res.endpointUrl;
  }

  /**
   * Stop local embedded test OPC UA server
   */
  public async stopLocalServer(): Promise<void> {
    const api = getElectronOpcUa();
    if (api) {
      await api.stopLocalServer();
      this.serverRunning = false;
    }
  }

  /**
   * Reads commands emitted by the live PLC
   */
  public readOutputs(): Record<string, boolean | number> {
    return { ...this.outputs };
  }

  /**
   * Writes physical sensor and feedback states to the real PLC
   */
  public async writeInputs(inputs: Record<string, boolean | number>): Promise<void> {
    this.inputs = { ...inputs };

    const api = getElectronOpcUa();
    if (!this.status.connected || this.isWriting || !api) {
      return;
    }

    this.isWriting = true;
    const writePayload: Record<string, { value: any; dataType?: string }> = {};

    for (const [tag, value] of Object.entries(inputs)) {
      const plcNodeId = this.resolvePlcNodeId(tag);
      writePayload[plcNodeId] = {
        value,
        dataType: typeof value === 'boolean' ? 'Boolean' : typeof value === 'string' ? 'String' : 'Double',
      };
    }

    try {
      await api.writeTags(writePayload);
    } catch (err) {
      console.warn('OPC UA write error:', err);
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Cyclic scan tick called by the simulation engine loop / lockstep runner
   */
  public async tick(dtMs: number): Promise<void> {
    this.status.lastScanMs = dtMs;

    if (!this.status.connected) {
      return;
    }

    // In lockstep scan mode, wait for the PLC scan cycle duration
    if (dtMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, dtMs));
    }

    // Poll latest outputs produced by the PLC during its scan
    await this.syncOutputsFromPlc();
  }

  /**
   * Asynchronously poll live outputs from the real PLC
   */
  public async syncOutputsFromPlc(): Promise<void> {
    const api = getElectronOpcUa();
    if (this.isReading || !api) {
      return;
    }

    this.isReading = true;
    const startTime = performance.now();

    try {
      // Map internal output tag names to configured real PLC NodeIds
      const nodesToRead = this.outputTags.map((tag) => this.resolvePlcNodeId(tag));
      const readResult = await api.readTags(nodesToRead);
      this.status.latencyMs = Math.round(performance.now() - startTime);

      for (const internalTag of this.outputTags) {
        const plcNodeId = this.resolvePlcNodeId(internalTag);
        const val = readResult[plcNodeId] ?? readResult[internalTag];

        if (val !== null && val !== undefined) {
          if (typeof val === 'boolean' || typeof val === 'number') {
            this.outputs[internalTag] = val;
          } else if (typeof val === 'string' && internalTag === 'PLC_STATE') {
            this.state = val;
          }

          // Parse live interlock tags from PLC
          if (this.interlocks.has(internalTag)) {
            const il = this.interlocks.get(internalTag)!;
            const isOk = Boolean(val);
            this.interlocks.set(internalTag, {
              ...il,
              isOk,
              tripped: !isOk,
            });
          }
        }
      }
    } catch (err) {
      console.warn('Failed to poll OPC UA tags:', err);
    } finally {
      this.isReading = false;
    }
  }

  /**
   * Reset helper for FAT test suite runs
   */
  public resetBatch(): void {
    this.writeInputs({
      E_STOP_PB: true,
      TK100_LT: 75.0,
      V101_ZSO: false,
    });
  }

  public resetSystem(): void {
    this.resetBatch();
  }

  public startProduction(): void {
    const api = getElectronOpcUa();
    if (this.status.connected && api) {
      api.writeTags({
        [this.resolvePlcNodeId('START_CMD')]: { value: true, dataType: 'Boolean' },
        [this.resolvePlcNodeId('P100_START')]: { value: true, dataType: 'Boolean' },
        [this.resolvePlcNodeId('P_FEED_CMD')]: { value: true, dataType: 'Boolean' },
      });
    }
  }

  public divertManually(): void {
    const api = getElectronOpcUa();
    if (this.status.connected && api) {
      api.writeTags({
        [this.resolvePlcNodeId('PV11_CMD')]: { value: false, dataType: 'Boolean' },
        [this.resolvePlcNodeId('PV12_CMD')]: { value: true, dataType: 'Boolean' },
      });
    }
  }

  public startBatch(): void {
    const api = getElectronOpcUa();
    if (this.status.connected && api) {
      api.writeTags({
        [this.resolvePlcNodeId('START_PB')]: { value: true, dataType: 'Boolean' },
        [this.resolvePlcNodeId('P100_START')]: { value: true, dataType: 'Boolean' },
      });
    }
  }

  public dischargeBatch(): void {
    const api = getElectronOpcUa();
    if (this.status.connected && api) {
      api.writeTags({
        [this.resolvePlcNodeId('V400_PROD_CMD')]: { value: true, dataType: 'Boolean' },
      });
    }
  }

  public abortBatch(): void {
    const api = getElectronOpcUa();
    if (this.status.connected && api) {
      api.writeTags({
        [this.resolvePlcNodeId('ABORT_PB')]: { value: true, dataType: 'Boolean' },
        [this.resolvePlcNodeId('P100_START')]: { value: false, dataType: 'Boolean' },
        [this.resolvePlcNodeId('V101_CMD')]: { value: false, dataType: 'Boolean' },
        [this.resolvePlcNodeId('V400_PROD_CMD')]: { value: false, dataType: 'Boolean' },
      });
    }
  }

  public clearAllOutputs(): void {
    for (const tag of Object.keys(this.outputs)) {
      if (typeof this.outputs[tag] === 'boolean') {
        this.outputs[tag] = false;
      } else if (typeof this.outputs[tag] === 'number') {
        this.outputs[tag] = 0;
      }
    }
  }

  public emergencyStop(): void {
    const api = getElectronOpcUa();
    if (this.status.connected && api) {
      api.writeTags({
        [this.resolvePlcNodeId('E_STOP_PB')]: { value: false, dataType: 'Boolean' },
        [this.resolvePlcNodeId('E_STOP')]: { value: false, dataType: 'Boolean' },
      });
    }
  }
}
