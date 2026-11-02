/**
 * TwinForge Studio - OPC UA Connection Manager (Electron Main Process)
 * 
 * Powered by node-opcua-client and node-opcua-server.
 * Connects to external PLC controllers or local test servers over standard opc.tcp:// protocol.
 */

import {
  OPCUAClient,
  ClientSession,
  AttributeIds,
  DataType,
  StatusCodes,
  type ReadValueIdOptions,
  type WriteValueOptions,
} from 'node-opcua-client';
import { OPCUAServer } from 'node-opcua-server';

export interface OpcUaStatus {
  connected: boolean;
  endpointUrl: string;
  latencyMs: number;
  lastScanMs: number;
  serverRunning: boolean;
  serverEndpointUrl?: string;
  error?: string;
}

export class OpcUaManager {
  private client: OPCUAClient | null = null;
  private session: ClientSession | null = null;
  private testServer: OPCUAServer | null = null;

  private connected: boolean = false;
  private endpointUrl: string = 'opc.tcp://127.0.0.1:4840';
  private latencyMs: number = 0;
  private lastScanMs: number = 0;
  private lastError?: string;

  private defaultNamespaceIndex: number = 1;

  public getStatus(): OpcUaStatus {
    return {
      connected: this.connected && !!this.session,
      endpointUrl: this.endpointUrl,
      latencyMs: this.latencyMs,
      lastScanMs: this.lastScanMs,
      serverRunning: !!this.testServer,
      serverEndpointUrl: this.testServer?.getEndpointUrl() || undefined,
      error: this.lastError,
    };
  }

  /**
   * Connect to an external or local OPC UA Server
   */
  public async connect(endpointUrl: string = 'opc.tcp://127.0.0.1:4840'): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.session) {
        await this.disconnect();
      }

      this.endpointUrl = endpointUrl;
      this.lastError = undefined;

      this.client = OPCUAClient.create({
        endpointMustExist: false,
        connectionStrategy: {
          maxRetry: 2,
          initialDelay: 500,
          maxDelay: 2000,
        },
        requestedSessionTimeout: 30000,
      });

      const startTime = performance.now();
      await this.client.connect(endpointUrl);
      this.session = await this.client.createSession();
      this.latencyMs = Math.round(performance.now() - startTime);
      this.connected = true;

      // Handle connection loss
      this.client.on('connection_lost', () => {
        this.connected = false;
        this.lastError = 'OPC UA Connection lost';
      });

      this.client.on('connection_reestablished', () => {
        this.connected = true;
        this.lastError = undefined;
      });

      return { success: true };
    } catch (err: any) {
      this.connected = false;
      this.lastError = err?.message || 'Failed to connect to OPC UA server';
      return { success: false, error: this.lastError };
    }
  }

  /**
   * Disconnect from OPC UA server
   */
  public async disconnect(): Promise<{ success: boolean }> {
    try {
      if (this.session) {
        await this.session.close();
        this.session = null;
      }
      if (this.client) {
        await this.client.disconnect();
        this.client = null;
      }
    } catch (err) {
      console.warn('Error during OPC UA disconnect:', err);
    } finally {
      this.connected = false;
    }
    return { success: true };
  }

  /**
   * Format NodeId string (defaults to ns=1;s=TAG if raw tag name is given)
   */
  private formatNodeId(tagOrNodeId: string): string {
    if (tagOrNodeId.startsWith('ns=') || tagOrNodeId.startsWith('i=')) {
      return tagOrNodeId;
    }
    return `ns=${this.defaultNamespaceIndex};s=${tagOrNodeId}`;
  }

  /**
   * Read multiple tags from the connected OPC UA Server
   */
  public async readTags(tags: string[]): Promise<Record<string, any>> {
    if (!this.session || !this.connected) {
      return {};
    }

    try {
      const startTime = performance.now();
      const nodesToRead: ReadValueIdOptions[] = tags.map((t) => ({
        nodeId: this.formatNodeId(t),
        attributeId: AttributeIds.Value,
      }));

      const dataValues = await this.session.read(nodesToRead);
      this.latencyMs = Math.round(performance.now() - startTime);
      this.lastScanMs = Date.now();

      const result: Record<string, any> = {};
      dataValues.forEach((dv, index) => {
        const tag = tags[index];
        if (dv.statusCode.equals(StatusCodes.Good)) {
          result[tag] = dv.value?.value;
        } else {
          // If node not found, retain null/undefined
          result[tag] = dv.value?.value ?? null;
        }
      });

      return result;
    } catch (err: any) {
      this.lastError = err?.message || 'Error reading OPC UA tags';
      return {};
    }
  }

  /**
   * Write multiple tags to the connected OPC UA Server
   */
  public async writeTags(tags: Record<string, { value: any; dataType?: string }>): Promise<{ success: boolean; error?: string }> {
    if (!this.session || !this.connected) {
      return { success: false, error: 'Not connected to OPC UA server' };
    }

    try {
      const nodesToWrite: WriteValueOptions[] = Object.entries(tags).map(([tag, item]) => {
        let opcDataType = DataType.Double;
        let val = item.value;

        if (typeof val === 'boolean' || item.dataType === 'Boolean') {
          opcDataType = DataType.Boolean;
          val = Boolean(val);
        } else if (typeof val === 'string' || item.dataType === 'String') {
          opcDataType = DataType.String;
          val = String(val);
        } else if (typeof val === 'number') {
          if (Number.isInteger(val) && (item.dataType === 'Int32' || item.dataType === 'Int16')) {
            opcDataType = DataType.Int32;
          } else {
            opcDataType = DataType.Double;
          }
        }

        return {
          nodeId: this.formatNodeId(tag),
          attributeId: AttributeIds.Value,
          value: {
            value: {
              dataType: opcDataType,
              value: val,
            },
          },
        };
      });

      const statusCodes = await this.session.write(nodesToWrite);
      const allGood = statusCodes.every((sc) => sc.equals(StatusCodes.Good));

      return { success: allGood };
    } catch (err: any) {
      this.lastError = err?.message || 'Error writing OPC UA tags';
      return { success: false, error: this.lastError };
    }
  }

  /**
   * Start an embedded local OPC UA Test Server with pre-populated plant registers
   * for self-contained testing when external hardware is unavailable.
   */
  public async startLocalServer(port: number = 4840): Promise<{ success: boolean; endpointUrl?: string; error?: string }> {
    try {
      if (this.testServer) {
        await this.stopLocalServer();
      }

      this.testServer = new OPCUAServer({
        port,
        resourcePath: '/TwinForge/UA/PLC',
        buildInfo: {
          productName: 'TwinForge Industrial Virtual PLC',
          buildNumber: '1.0.0',
          buildDate: new Date(),
        },
      });

      await this.testServer.initialize();

      const addressSpace = this.testServer.engine.addressSpace;
      if (addressSpace) {
        const namespace = addressSpace.getOwnNamespace();
        const rootObjects = addressSpace.rootFolder.objects;

        const plantFolder = namespace.addFolder(rootObjects, {
          browseName: 'TwinForgePlant',
        });

        // Common skid tags
        const defaultTags: Array<{ name: string; type: DataType; initial: any }> = [
          // Batch Skid
          { name: 'TK100_LT', type: DataType.Double, initial: 75.0 },
          { name: 'TK400_LT', type: DataType.Double, initial: 10.0 },
          { name: 'TT100', type: DataType.Double, initial: 24.5 },
          { name: 'FT100', type: DataType.Double, initial: 0.0 },
          { name: 'PT100', type: DataType.Double, initial: 1.2 },
          { name: 'P100_START', type: DataType.Boolean, initial: false },
          { name: 'V101_CMD', type: DataType.Boolean, initial: false },
          { name: 'V101_ZSO', type: DataType.Boolean, initial: false },
          { name: 'V102_CMD', type: DataType.Boolean, initial: false },
          { name: 'V103_CMD', type: DataType.Boolean, initial: false },
          { name: 'HEATER_CMD', type: DataType.Boolean, initial: false },
          { name: 'AGITATOR_CMD', type: DataType.Boolean, initial: false },
          { name: 'PLC_STATE', type: DataType.String, initial: 'IDLE' },
          { name: 'IL-01', type: DataType.Boolean, initial: true },
          { name: 'IL-02', type: DataType.Boolean, initial: true },
          { name: 'IL-03', type: DataType.Boolean, initial: true },
          { name: 'E_STOP_PB', type: DataType.Boolean, initial: true },

          // Pasteurizer Skid
          { name: 'LT_BALANCE', type: DataType.Double, initial: 60.0 },
          { name: 'LT_PRODUCT', type: DataType.Double, initial: 15.0 },
          { name: 'TT1', type: DataType.Double, initial: 4.0 },
          { name: 'TT2', type: DataType.Double, initial: 65.0 },
          { name: 'TT3', type: DataType.Double, initial: 85.0 },
          { name: 'TT4', type: DataType.Double, initial: 72.0 },
          { name: 'TT5', type: DataType.Double, initial: 88.5 }, // Holding tube
          { name: 'FM', type: DataType.Double, initial: 10000.0 },
          { name: 'PT2', type: DataType.Double, initial: 2.5 },
          { name: 'PT4', type: DataType.Double, initial: 4.2 },
          { name: 'P_FEED_CMD', type: DataType.Boolean, initial: true },
          { name: 'P_BOOSTER_CMD', type: DataType.Boolean, initial: true },
          { name: 'P_HOT_WATER_CMD', type: DataType.Boolean, initial: true },
          { name: 'PV11_CMD', type: DataType.Boolean, initial: true }, // Forward
          { name: 'PV12_CMD', type: DataType.Boolean, initial: false }, // Divert
          { name: 'MOD_VALVE', type: DataType.Double, initial: 45.0 },
          { name: 'IL-FDV', type: DataType.Boolean, initial: true },
          { name: 'IL-DIFF', type: DataType.Boolean, initial: true },
        ];

        for (const tag of defaultTags) {
          namespace.addVariable({
            componentOf: plantFolder,
            browseName: tag.name,
            nodeId: `ns=1;s=${tag.name}`,
            dataType: tag.type === DataType.Boolean ? 'Boolean' : tag.type === DataType.String ? 'String' : 'Double',
            value: { dataType: tag.type, value: tag.initial },
          });
        }
      }

      await this.testServer.start();
      const endpoint = this.testServer.getEndpointUrl();
      return { success: true, endpointUrl: endpoint };
    } catch (err: any) {
      console.error('Failed to start local test OPC UA server:', err);
      return { success: false, error: err?.message || 'Failed to start local server' };
    }
  }

  /**
   * Stop embedded test server
   */
  public async stopLocalServer(): Promise<{ success: boolean }> {
    try {
      if (this.testServer) {
        await this.testServer.shutdown();
        this.testServer = null;
      }
    } catch (err) {
      console.warn('Error shutting down test OPC UA server:', err);
    }
    return { success: true };
  }

  /**
   * Full cleanup on app shutdown
   */
  public async destroy(): Promise<void> {
    await this.disconnect();
    await this.stopLocalServer();
  }
}
