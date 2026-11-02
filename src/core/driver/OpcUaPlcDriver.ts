/**
 * TwinForge Studio - OPC UA Real PLC Driver
 * 
 * Communicates with live industrial PLC hardware or software controllers (Siemens S7,
 * Beckhoff TwinCAT, CODESYS, Rockwell Allen-Bradley, B&R, Omron) over OPC UA (IEC 62541).
 * Uses node-opcua in Electron main process to read live outputs and write simulation sensors.
 */

import type { Driver, DriverStatus } from './Driver';

export interface InterlockStatus {
  id: string;
  name: string;
  condition: string;
  isOk: boolean;
  tripped: boolean;
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
  public serverRunning: boolean = false;
  public state: string = 'OFFLINE';

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

  constructor(endpointUrl?: string) {
    if (endpointUrl) {
      this.endpointUrl = endpointUrl;
    }
  }

  /**
   * Connect to the live OPC UA server via Electron IPC bridge
   */
  public async connect(endpointUrl?: string): Promise<void> {
    const targetUrl = endpointUrl || this.endpointUrl;
    this.endpointUrl = targetUrl;

    if (window.electronAPI?.opcua) {
      const res = await window.electronAPI.opcua.connect(targetUrl);
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
      // Browser fallback (mock connected state for demonstration when running without Electron)
      this.status.connected = true;
      this.state = 'EMULATED_CONNECTED';
    }
  }

  /**
   * Disconnect from live OPC UA server
   */
  public async disconnect(): Promise<void> {
    if (window.electronAPI?.opcua) {
      await window.electronAPI.opcua.disconnect();
    }
    this.status.connected = false;
    this.state = 'OFFLINE';
  }

  /**
   * Start local embedded test OPC UA server
   */
  public async startLocalServer(port: number = 4840): Promise<string> {
    if (!window.electronAPI?.opcua) {
      throw new Error('Local OPC UA Server requires Electron runtime.');
    }
    const res = await window.electronAPI.opcua.startLocalServer(port);
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
    if (window.electronAPI?.opcua) {
      await window.electronAPI.opcua.stopLocalServer();
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
  public writeInputs(inputs: Record<string, boolean | number>): void {
    this.inputs = { ...inputs };

    if (!this.status.connected || this.isWriting || !window.electronAPI?.opcua) {
      return;
    }

    this.isWriting = true;
    const writePayload: Record<string, { value: any; dataType?: string }> = {};

    for (const [tag, value] of Object.entries(inputs)) {
      writePayload[tag] = {
        value,
        dataType: typeof value === 'boolean' ? 'Boolean' : typeof value === 'string' ? 'String' : 'Double',
      };
    }

    window.electronAPI.opcua
      .writeTags(writePayload)
      .catch((err) => {
        console.warn('OPC UA write error:', err);
      })
      .finally(() => {
        this.isWriting = false;
      });
  }

  /**
   * Cyclic scan tick called by the simulation engine loop
   */
  public tick(dtMs: number): void {
    this.status.lastScanMs = dtMs;

    if (!this.status.connected) {
      return;
    }

    // Trigger async poll of PLC outputs
    this.syncOutputsFromPlc();
  }

  /**
   * Asynchronously poll live outputs from the real PLC
   */
  public async syncOutputsFromPlc(): Promise<void> {
    if (this.isReading || !window.electronAPI?.opcua) {
      return;
    }

    this.isReading = true;
    const startTime = performance.now();

    try {
      const readResult = await window.electronAPI.opcua.readTags(this.outputTags);
      this.status.latencyMs = Math.round(performance.now() - startTime);

      for (const [tag, val] of Object.entries(readResult)) {
        if (val !== null && val !== undefined) {
          if (typeof val === 'boolean' || typeof val === 'number') {
            this.outputs[tag] = val;
          } else if (typeof val === 'string' && tag === 'PLC_STATE') {
            this.state = val;
          }

          // Parse live interlock tags from PLC
          if (this.interlocks.has(tag)) {
            const il = this.interlocks.get(tag)!;
            const isOk = Boolean(val);
            this.interlocks.set(tag, {
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
    if (this.status.connected && window.electronAPI?.opcua) {
      window.electronAPI.opcua.writeTags({
        START_CMD: { value: true, dataType: 'Boolean' },
        P100_START: { value: true, dataType: 'Boolean' },
        P_FEED_CMD: { value: true, dataType: 'Boolean' },
      });
    }
  }

  public divertManually(): void {
    if (this.status.connected && window.electronAPI?.opcua) {
      window.electronAPI.opcua.writeTags({
        PV11_CMD: { value: false, dataType: 'Boolean' },
        PV12_CMD: { value: true, dataType: 'Boolean' },
      });
    }
  }

  public emergencyStop(): void {
    if (this.status.connected && window.electronAPI?.opcua) {
      window.electronAPI.opcua.writeTags({
        E_STOP_PB: { value: false, dataType: 'Boolean' },
        E_STOP: { value: false, dataType: 'Boolean' },
      });
    }
  }
}
