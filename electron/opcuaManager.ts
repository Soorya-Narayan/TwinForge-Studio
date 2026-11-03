/**
 * TwinForge Studio - OPC UA Connection Manager (Electron Main Process)
 * 
 * Powered by node-opcua-client and node-opcua-server.
 * Connects to external PLC controllers or local test servers over standard opc.tcp:// protocol.
 */

import fs from 'fs';
import {
  OPCUAClient,
  ClientSession,
  AttributeIds,
  DataType,
  StatusCodes,
  MessageSecurityMode,
  SecurityPolicy,
  UserTokenType,
  type ReadValueIdOptions,
  type WriteValueOptions,
  type UserIdentityInfo,
} from 'node-opcua-client';
import { OPCUAServer } from 'node-opcua-server';
import { readCertificate, readPrivateKeyPEM, convertPEMtoDER } from 'node-opcua-crypto';

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

export interface OpcUaStatus {
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
}

export class OpcUaManager {
  private client: OPCUAClient | null = null;
  private session: ClientSession | null = null;
  private testServer: OPCUAServer | null = null;

  private connected: boolean = false;
  private endpointUrl: string = 'opc.tcp://127.0.0.1:4840';
  private securityMode: OpcUaSecurityMode = 'None';
  private securityPolicy: OpcUaSecurityPolicy = 'None';
  private authMode: OpcUaAuthMode = 'Anonymous';
  private latencyMs: number = 0;
  private lastScanMs: number = 0;
  private lastError?: string;

  private defaultNamespaceIndex: number = 1;

  public getStatus(): OpcUaStatus {
    return {
      connected: this.connected && !!this.session,
      endpointUrl: this.endpointUrl,
      securityMode: this.securityMode,
      securityPolicy: this.securityPolicy,
      authMode: this.authMode,
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
  public async connect(
    options: string | OpcUaConnectionOptions = 'opc.tcp://127.0.0.1:4840'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.session) {
        await this.disconnect();
      }

      const opts: OpcUaConnectionOptions =
        typeof options === 'string'
          ? { endpointUrl: options }
          : options;

      const endpointUrl = opts.endpointUrl || 'opc.tcp://127.0.0.1:4840';
      this.endpointUrl = endpointUrl;
      this.securityMode = opts.securityMode || 'None';
      this.securityPolicy = opts.securityPolicy || 'None';
      this.authMode = opts.authMode || 'Anonymous';
      this.lastError = undefined;

      // Map MessageSecurityMode
      let clientSecurityMode: MessageSecurityMode = MessageSecurityMode.None;
      if (this.securityMode === 'Sign') {
        clientSecurityMode = MessageSecurityMode.Sign;
      } else if (this.securityMode === 'SignAndEncrypt') {
        clientSecurityMode = MessageSecurityMode.SignAndEncrypt;
      }

      // Map SecurityPolicy
      let clientSecurityPolicy: SecurityPolicy = SecurityPolicy.None;
      if (this.securityPolicy === 'Basic256Sha256') {
        clientSecurityPolicy = SecurityPolicy.Basic256Sha256;
      } else if (this.securityPolicy === 'Aes128_Sha256_RsaOaep') {
        clientSecurityPolicy = SecurityPolicy.Aes128_Sha256_RsaOaep;
      } else if (this.securityPolicy === 'Basic256') {
        clientSecurityPolicy = SecurityPolicy.Basic256;
      } else if (this.securityPolicy === 'Basic128Rsa15') {
        clientSecurityPolicy = SecurityPolicy.Basic128Rsa15;
      }

      this.client = OPCUAClient.create({
        endpointMustExist: false,
        securityMode: clientSecurityMode,
        securityPolicy: clientSecurityPolicy,
        connectionStrategy: {
          maxRetry: 2,
          initialDelay: 500,
          maxDelay: 2000,
        },
        requestedSessionTimeout: 30000,
      });

      // Prepare User Identity Info for session authentication
      let userIdentity: UserIdentityInfo | undefined = undefined;

      if (this.authMode === 'Username') {
        userIdentity = {
          type: UserTokenType.UserName,
          userName: opts.username || '',
          password: opts.password || '',
        };
      } else if (this.authMode === 'Certificate') {
        const certInput = (opts.certificatePath || '').trim();
        const keyInput = (opts.privateKeyPath || '').trim();

        if (!certInput) {
          throw new Error('Certificate file path or PEM data is required for X.509 Certificate authentication');
        }

        let certData: Buffer;
        if (fs.existsSync(certInput)) {
          certData = readCertificate(certInput);
        } else if (certInput.includes('BEGIN CERTIFICATE')) {
          certData = convertPEMtoDER(certInput);
        } else {
          throw new Error(`Certificate file not found or invalid PEM: "${certInput}"`);
        }

        let privKey: string | undefined = undefined;
        if (keyInput) {
          if (fs.existsSync(keyInput)) {
            privKey = readPrivateKeyPEM(keyInput);
          } else if (keyInput.includes('BEGIN')) {
            privKey = keyInput;
          } else {
            throw new Error(`Private key file not found or invalid PEM: "${keyInput}"`);
          }
        }

        userIdentity = {
          type: UserTokenType.Certificate,
          certificateData: certData,
          privateKey: privKey,
        };
      } else {
        // Anonymous identity
        userIdentity = {
          type: UserTokenType.Anonymous,
        };
      }

      const startTime = performance.now();
      await this.client.connect(endpointUrl);
      this.session = await this.client.createSession(userIdentity);
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
    if (
      tagOrNodeId.startsWith('ns=') ||
      tagOrNodeId.startsWith('i=') ||
      tagOrNodeId.startsWith('s=') ||
      tagOrNodeId.startsWith('g=') ||
      tagOrNodeId.startsWith('b=')
    ) {
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
   * Read DataType attributes for given tags from connected OPC UA server
   */
  public async readNodeDataTypes(tags: string[]): Promise<Record<string, string>> {
    if (!this.session || !this.connected) {
      return {};
    }

    try {
      const nodesToRead: ReadValueIdOptions[] = tags.map((t) => ({
        nodeId: this.formatNodeId(t),
        attributeId: AttributeIds.DataType,
      }));

      const dataValues = await this.session.read(nodesToRead);
      const result: Record<string, string> = {};

      dataValues.forEach((dv, index) => {
        const tag = tags[index];
        if (dv.statusCode.equals(StatusCodes.Good) && dv.value?.value) {
          const typeNodeId = dv.value.value.toString();
          let typeName: string | undefined;
          if (typeNodeId.endsWith('i=10') || typeNodeId === 'ns=0;i=10') {
            typeName = 'Float';
          } else if (typeNodeId.endsWith('i=11') || typeNodeId === 'ns=0;i=11') {
            typeName = 'Double';
          } else if (typeNodeId.endsWith('i=6') || typeNodeId === 'ns=0;i=6') {
            typeName = 'Int32';
          } else if (typeNodeId.endsWith('i=4') || typeNodeId === 'ns=0;i=4') {
            typeName = 'Int16';
          } else if (typeNodeId.endsWith('i=1') || typeNodeId === 'ns=0;i=1') {
            typeName = 'Boolean';
          } else if (typeNodeId.endsWith('i=12') || typeNodeId === 'ns=0;i=12') {
            typeName = 'String';
          }

          if (typeName) {
            result[tag] = typeName;
            result[this.formatNodeId(tag)] = typeName;
          }
        }
      });

      return result;
    } catch (err: any) {
      console.warn('Error reading OPC UA node data types:', err?.message || String(err));
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
        let opcDataType = DataType.Float;
        let val = item.value;

        if (item.dataType === 'Float') {
          opcDataType = DataType.Float;
          val = Math.fround(Number(val));
        } else if (item.dataType === 'Double') {
          opcDataType = DataType.Double;
          val = Number(val);
        } else if (item.dataType === 'Int16') {
          opcDataType = DataType.Int16;
          val = Math.trunc(Number(val));
        } else if (item.dataType === 'Int32') {
          opcDataType = DataType.Int32;
          val = Math.trunc(Number(val));
        } else if (item.dataType === 'Boolean' || typeof val === 'boolean') {
          opcDataType = DataType.Boolean;
          val = Boolean(val);
        } else if (item.dataType === 'String' || typeof val === 'string') {
          opcDataType = DataType.String;
          val = String(val);
        } else if (typeof val === 'number') {
          if (tag === 'SEQ' || tag.endsWith(';s=SEQ') || tag.endsWith('.SEQ')) {
            opcDataType = DataType.Int32;
            val = Math.trunc(val);
          } else {
            opcDataType = DataType.Float;
            val = Math.fround(val);
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
        host: '127.0.0.1',
        hostname: '127.0.0.1',
        resourcePath: '/TwinForge/UA/LoopbackServer',
        buildInfo: {
          productName: 'Loopback Test Server',
          buildNumber: '1.0.0',
          buildDate: new Date(),
        },
        userManager: {
          isValidUser(userName: string, _password: string) {
            if (userName === 'admin' || userName === 'operator' || userName === 'twinforge') {
              return true;
            }
            return Boolean(userName && userName.toLowerCase() !== 'anonymous');
          },
          getUserRoles(_user: string) {
            return [];
          },
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
          // Batch Skid (Siemens & Rockwell REAL tags are 32-bit Float)
          { name: 'TK100_LT', type: DataType.Float, initial: 75.0 },
          { name: 'TK400_LT', type: DataType.Float, initial: 10.0 },
          { name: 'TT100', type: DataType.Float, initial: 24.5 },
          { name: 'FT100', type: DataType.Float, initial: 0.0 },
          { name: 'PT100', type: DataType.Float, initial: 1.2 },
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
          { name: 'LT_BALANCE', type: DataType.Float, initial: 60.0 },
          { name: 'LT_PRODUCT', type: DataType.Float, initial: 15.0 },
          { name: 'TT1', type: DataType.Float, initial: 4.0 },
          { name: 'TT2', type: DataType.Float, initial: 65.0 },
          { name: 'TT3', type: DataType.Float, initial: 85.0 },
          { name: 'TT4', type: DataType.Float, initial: 72.0 },
          { name: 'TT5', type: DataType.Float, initial: 88.5 }, // Holding tube
          { name: 'FM', type: DataType.Float, initial: 10000.0 },
          { name: 'PT2', type: DataType.Float, initial: 2.5 },
          { name: 'PT4', type: DataType.Float, initial: 4.2 },
          { name: 'P_FEED_CMD', type: DataType.Boolean, initial: true },
          { name: 'P_BOOSTER_CMD', type: DataType.Boolean, initial: true },
          { name: 'P_HOT_WATER_CMD', type: DataType.Boolean, initial: true },
          { name: 'PV11_CMD', type: DataType.Boolean, initial: true }, // Forward
          { name: 'PV12_CMD', type: DataType.Boolean, initial: false }, // Divert
          { name: 'MOD_VALVE', type: DataType.Float, initial: 45.0 },
          { name: 'IL-FDV', type: DataType.Boolean, initial: true },
          { name: 'IL-DIFF', type: DataType.Boolean, initial: true },
          // Lockstep Handshake & Reset Tags
          { name: 'RESET_CMD', type: DataType.Boolean, initial: false },
          { name: 'SEQ', type: DataType.Int32, initial: 0 },
          { name: 'SEQ_ACK', type: DataType.Int32, initial: 0 },
        ];

        const createdVariables: Map<string, any> = new Map();

        for (const tag of defaultTags) {
          const variable = namespace.addVariable({
            componentOf: plantFolder,
            browseName: tag.name,
            nodeId: `ns=1;s=${tag.name}`,
            dataType:
              tag.type === DataType.Boolean
                ? 'Boolean'
                : tag.type === DataType.String
                ? 'String'
                : tag.type === DataType.Int32
                ? 'Int32'
                : tag.type === DataType.Int16
                ? 'Int16'
                : tag.type === DataType.Float
                ? 'Float'
                : 'Double',
            value: { dataType: tag.type, value: tag.initial },
          });

          createdVariables.set(tag.name, variable);

          // Restrict anonymous writes: reads are permitted, but writes require an authenticated user
          const originalIsWritable = variable.isWritable ? variable.isWritable.bind(variable) : () => true;
          (variable as any).isUserWritable = (context: any) => {
            if (!originalIsWritable(context)) {
              return false;
            }
            if (!context || !context.session) {
              // Server-internal / in-process write permitted
              return true;
            }
            const username = context.getUserName ? context.getUserName() : '';
            return Boolean(username && username.toLowerCase() !== 'anonymous');
          };
        }

        // When RESET_CMD is written to true, transition PLC_STATE to STOPPED
        const resetVar = createdVariables.get('RESET_CMD');
        const stateVar = createdVariables.get('PLC_STATE');
        if (resetVar && stateVar) {
          resetVar.on('value_changed', (newVal: any) => {
            if (newVal?.value?.value === true) {
              stateVar.setValueFromSource({
                dataType: DataType.String,
                value: 'STOPPED',
              });
            }
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
