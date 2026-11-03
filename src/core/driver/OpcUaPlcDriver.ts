/**
 * TwinForge Studio - OPC UA PLC Driver
 * 
 * Communicates with an external OPC UA server (IEC 62541), typically a PLC or soft-PLC,
 * or with the app's built-in Loopback Test Server (which contains no PLC control logic).
 * Uses node-opcua in Electron main process to read live outputs and write simulation sensors.
 */

import type { Driver, DriverStatus } from './Driver';
import {
  loadStoredTagMap,
  getOutputTagsForSkid,
  DEFAULT_OPCUA_TAGS,
  loadStoredTagTypeMap,
  type TagDataType,
} from './opcuaTagMap';
import {
  createInterlocksMapForSkid,
  loadStoredInterlockDefinitions,
  type InterlockStatus,
  type InterlockDefinition,
} from './interlockConfig';

export type { InterlockStatus, InterlockDefinition };

export type OpcUaSecurityMode = 'None' | 'Sign' | 'SignAndEncrypt';
export type OpcUaSecurityPolicy =
  | 'None'
  | 'Basic256Sha256'
  | 'Aes128_Sha256_RsaOaep'
  | 'Basic256'
  | 'Basic128Rsa15';
export type OpcUaAuthMode = 'Anonymous' | 'Username' | 'Certificate';

export type OpcUaConcurrencyMode = 'wait' | 'throw';

/** Standard NodeId of Server.ServerStatus.BuildInfo.ProductName (VariableIds.Server_ServerStatus_BuildInfo_ProductName) */
export const BUILDINFO_PRODUCT_NAME_NODE = 'ns=0;i=2261';
/** BuildInfo.ProductName advertised by the built-in loopback server in electron/opcuaManager.ts */
export const LOOPBACK_PRODUCT_NAME = 'Loopback Test Server';

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
  tagTypeMap?: Record<string, TagDataType>;
  activeSkid?: 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'CUSTOM';
  interlockDefinitions?: InterlockDefinition[];
  concurrencyMode?: OpcUaConcurrencyMode;
  operationTimeoutMs?: number;
}

function getElectronOpcUa() {
  if (typeof window !== 'undefined' && window.electronAPI?.opcua) {
    return window.electronAPI.opcua;
  }
  return null;
}

class AsyncLock {
  private queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timeoutTimer?: ReturnType<typeof setTimeout>;
  }> = [];
  private locked: boolean = false;
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  public get isLocked(): boolean {
    return this.locked;
  }

  public async acquire(timeoutMs: number, operationDescription: string): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
    }

    return new Promise<() => void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      if (timeoutMs > 0 && timeoutMs !== Infinity) {
        timer = setTimeout(() => {
          const index = this.queue.findIndex((entry) => entry.timeoutTimer === timer);
          if (index !== -1) {
            this.queue.splice(index, 1);
            reject(
              new Error(
                `Timeout (${timeoutMs}ms) waiting for prior OPC UA ${this.name} (${operationDescription}) to complete.`
              )
            );
          }
        }, timeoutMs);
      }

      this.queue.push({
        resolve: () => {
          if (timer) clearTimeout(timer);
          let released = false;
          resolve(() => {
            if (!released) {
              released = true;
              this.release();
            }
          });
        },
        reject: (err: Error) => {
          if (timer) clearTimeout(timer);
          reject(err);
        },
        timeoutTimer: timer,
      });
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next.resolve();
    } else {
      this.locked = false;
    }
  }

  public abortAll(err: Error): void {
    const pending = [...this.queue];
    this.queue = [];
    this.locked = false;
    for (const item of pending) {
      if (item.timeoutTimer) clearTimeout(item.timeoutTimer);
      item.reject(err);
    }
  }
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
  public tagTypeMap: Record<string, TagDataType> = {};
  public activeSkid: 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'CUSTOM' = 'PASTEURIZER_10KLPH';
  public interlockDefinitions: InterlockDefinition[] = [];

  // Live I/O mirrors matching industrial PLC register tags
  public inputs: Record<string, boolean | number> = {};
  public outputs: Record<string, boolean | number> = {};

  // Interlock status parsed from configuration and updated from connected PLC
  public interlocks: Map<string, InterlockStatus> = new Map();

  // Output tags read cyclically from the connected PLC (split per skid)
  public outputTags: string[] = [];

  private _isReading: boolean = false;
  private _isWriting: boolean = false;

  public get isReading(): boolean {
    return this._isReading || this.readLock.isLocked;
  }
  public set isReading(value: boolean) {
    this._isReading = value;
  }

  public get isWriting(): boolean {
    return this._isWriting || this.writeLock.isLocked;
  }
  public set isWriting(value: boolean) {
    this._isWriting = value;
  }

  public concurrencyMode: OpcUaConcurrencyMode = 'wait';
  public operationTimeoutMs: number = 5000;
  public customApi?: any;

  private writeLock = new AsyncLock('write');
  private readLock = new AsyncLock('read');

  public serverNodeDataTypes: Record<string, TagDataType> = {};

  /** Endpoint URL returned by startLocalServer() for the built-in Loopback Test Server */
  private localServerEndpointUrl: string | null = null;
  /** BuildInfo.ProductName read from the connected server after connect (null if unreadable) */
  private _serverProductName: string | null = null;
  /** Set at connect time from the facts above; never guessed */
  private _loopbackSession: boolean = false;

  /**
   * BuildInfo.ProductName reported by the connected OPC UA server (null if not read).
   */
  public get serverProductName(): string | null {
    return this._serverProductName;
  }

  /**
   * True only while connected to the app's built-in Loopback Test Server.
   * Determined at connect time from (a) the endpoint URL matching the URL returned by
   * startLocalServer() while the server is running, and/or (b) the server's
   * BuildInfo.ProductName being "Loopback Test Server".
   */
  public isLoopbackSession(): boolean {
    return this.status.connected && this._loopbackSession;
  }

  constructor(endpointOrOptions?: string | OpcUaConnectionOptions) {
    if (typeof endpointOrOptions === 'string') {
      this.endpointUrl = endpointOrOptions;
      this.securityOptions.endpointUrl = endpointOrOptions;
      this.tagMap = loadStoredTagMap();
      this.tagTypeMap = loadStoredTagTypeMap();
      this.activeSkid = 'PASTEURIZER_10KLPH';
      this.interlockDefinitions = loadStoredInterlockDefinitions();
    } else if (endpointOrOptions) {
      this.securityOptions = { ...this.securityOptions, ...endpointOrOptions };
      this.endpointUrl = endpointOrOptions.endpointUrl || this.endpointUrl;
      this.tagMap = endpointOrOptions.tagMap ? { ...endpointOrOptions.tagMap } : loadStoredTagMap();
      this.tagTypeMap = endpointOrOptions.tagTypeMap ? { ...endpointOrOptions.tagTypeMap } : loadStoredTagTypeMap();
      this.activeSkid = endpointOrOptions.activeSkid || 'PASTEURIZER_10KLPH';
      this.interlockDefinitions = endpointOrOptions.interlockDefinitions
        ? [...endpointOrOptions.interlockDefinitions]
        : loadStoredInterlockDefinitions();
      if (endpointOrOptions.concurrencyMode) {
        this.concurrencyMode = endpointOrOptions.concurrencyMode;
      }
      if (endpointOrOptions.operationTimeoutMs) {
        this.operationTimeoutMs = endpointOrOptions.operationTimeoutMs;
      }
    } else {
      this.tagMap = loadStoredTagMap();
      this.tagTypeMap = loadStoredTagTypeMap();
      this.activeSkid = 'PASTEURIZER_10KLPH';
      this.interlockDefinitions = loadStoredInterlockDefinitions();
    }

    this.outputTags = this.getActiveOutputTags();
    this.interlocks = createInterlocksMapForSkid(this.activeSkid, this.interlockDefinitions);
  }

  /**
   * Looks up the configured OPC UA DataType for a tag, falling back to DEFAULT_OPCUA_TAGS or Float for analogs.
   */
  public getTagDataType(tag: string): TagDataType {
    const plcNodeId = this.resolvePlcNodeId(tag);
    if (this.serverNodeDataTypes[plcNodeId]) {
      return this.serverNodeDataTypes[plcNodeId];
    }
    if (this.serverNodeDataTypes[tag]) {
      return this.serverNodeDataTypes[tag];
    }
    if (this.tagTypeMap && this.tagTypeMap[tag]) {
      return this.tagTypeMap[tag];
    }
    const def = DEFAULT_OPCUA_TAGS.find((d) => d.tag === tag);
    if (def) {
      return def.dataType;
    }
    if (tag === 'SEQ') {
      return 'Int32';
    }
    if (tag.startsWith('DI_') || tag.endsWith('_PB') || tag.endsWith('_SW') || tag.endsWith('_ZSO') || tag.endsWith('_ZSC')) {
      return 'Boolean';
    }
    return 'Float';
  }

  /**
   * Set the active plant skid to read only relevant tags and interlocks during cyclic scans
   */
  public setSkid(skid: 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'CUSTOM'): void {
    this.activeSkid = skid;
    this.outputTags = this.getActiveOutputTags();
    this.interlocks = createInterlocksMapForSkid(skid, this.interlockDefinitions);
  }

  /**
   * Update interlock definitions from configuration
   */
  public setInterlockDefinitions(definitions: InterlockDefinition[]): void {
    this.interlockDefinitions = [...definitions];
    this.interlocks = createInterlocksMapForSkid(this.activeSkid, this.interlockDefinitions);
  }

  /**
   * Get active interlock definitions
   */
  public getInterlockDefinitions(): InterlockDefinition[] {
    return [...this.interlockDefinitions];
  }

  /**
   * Returns output tags relevant to the currently active skid (plus any custom user tags)
   */
  public getActiveOutputTags(): string[] {
    const baseTags = getOutputTagsForSkid(this.activeSkid);

    // Also include any user-defined custom output tags from tagMap
    const customOutputTags = Object.keys(this.tagMap).filter((tag) => {
      const isKnown = DEFAULT_OPCUA_TAGS.some((d) => d.tag === tag);
      if (isKnown) return false;
      return tag.includes('CMD') || tag.includes('START') || tag.includes('IL-') || tag.includes('MOD_');
    });

    return [...new Set([...baseTags, ...customOutputTags])];
  }

  /**
   * Set or update tag mapping (internal simulator tag -> PLC NodeId)
   */
  public setTagMap(tagMap: Record<string, string>): void {
    this.tagMap = { ...this.tagMap, ...tagMap };
    this.outputTags = this.getActiveOutputTags();
  }

  /**
   * Get active tag mapping table
   */
  public getTagMap(): Record<string, string> {
    return { ...this.tagMap };
  }

  /**
   * Set or update tag data types (internal simulator tag -> OPC UA TagDataType)
   */
  public setTagTypeMap(tagTypeMap: Record<string, TagDataType>): void {
    this.tagTypeMap = { ...this.tagTypeMap, ...tagTypeMap };
  }

  /**
   * Get active tag data types table
   */
  public getTagTypeMap(): Record<string, TagDataType> {
    return { ...this.tagTypeMap };
  }

  /**
   * Translate internal tag name to PLC NodeId
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
    if (connOpts.concurrencyMode) {
      this.concurrencyMode = connOpts.concurrencyMode;
    }
    if (connOpts.operationTimeoutMs) {
      this.operationTimeoutMs = connOpts.operationTimeoutMs;
    }

    const api = this.customApi || getElectronOpcUa();
    if (!api) {
      this.status.connected = false;
      this.state = 'DISCONNECTED';
      throw new Error(
        `OPC UA connect failed: Electron OPC UA API (window.electronAPI.opcua) is unavailable (${this.endpointUrl}).`
      );
    }

    this._loopbackSession = false;
    this._serverProductName = null;

    const res = await api.connect(connOpts);
    if (res.success) {
      this.status.connected = true;
      this.state = 'CONNECTED';
      await this.detectLoopbackSession(api);
      await this.discoverServerDataTypes();
      await this.syncOutputsFromPlc();
    } else {
      this.status.connected = false;
      this.state = 'DISCONNECTED';
      throw new Error(res.error || 'Failed to connect to OPC UA server');
    }
  }

  /**
   * Decide whether the current session targets the built-in Loopback Test Server.
   * Uses only facts: the URL returned by startLocalServer() (from this driver or the
   * main-process status) and the server's BuildInfo.ProductName (ns=0;i=2261).
   */
  private async detectLoopbackSession(api: any): Promise<void> {
    let urlMatches = this.serverRunning && this.localServerEndpointUrl !== null && this.endpointUrl === this.localServerEndpointUrl;

    if (!urlMatches && typeof api.getStatus === 'function') {
      try {
        const st = await api.getStatus();
        urlMatches = Boolean(st?.serverRunning && st?.serverEndpointUrl && st.serverEndpointUrl === this.endpointUrl);
      } catch {
        // Status unavailable: rely on BuildInfo check below
      }
    }

    let productMatches = false;
    if (typeof api.readTags === 'function') {
      try {
        const res = await api.readTags([BUILDINFO_PRODUCT_NAME_NODE]);
        const raw = res?.[BUILDINFO_PRODUCT_NAME_NODE];
        const name = raw === null || raw === undefined ? null : String(typeof raw === 'object' && 'text' in raw ? raw.text : raw);
        this._serverProductName = name;
        productMatches = name === LOOPBACK_PRODUCT_NAME;
      } catch {
        this._serverProductName = null;
      }
    }

    this._loopbackSession = urlMatches || productMatches;
  }

  /**
   * Discover node DataTypes from the connected OPC UA server
   */
  public async discoverServerDataTypes(): Promise<void> {
    const api = this.customApi || getElectronOpcUa();
    if (!api || typeof api.readNodeDataTypes !== 'function') return;

    try {
      const tagsToQuery = Array.from(
        new Set([
          ...DEFAULT_OPCUA_TAGS.map((d) => d.tag),
          ...DEFAULT_OPCUA_TAGS.map((d) => d.defaultNodeId),
          ...Object.keys(this.tagMap),
          ...Object.values(this.tagMap),
        ])
      );
      const types = await api.readNodeDataTypes(tagsToQuery);
      if (types) {
        for (const [k, v] of Object.entries(types)) {
          this.serverNodeDataTypes[k] = v as TagDataType;
        }
      }
    } catch (err) {
      console.warn('Failed to read node DataTypes from OPC UA server:', err);
    }
  }

  /**
   * Disconnect from live OPC UA server
   */
  public async disconnect(): Promise<void> {
    const api = this.customApi || getElectronOpcUa();
    if (api) {
      try {
        await api.disconnect();
      } catch (err) {
        console.warn('Error during OPC UA disconnect:', err);
      }
    }
    this.status.connected = false;
    this.state = 'OFFLINE';
    this._loopbackSession = false;
    this._serverProductName = null;
    this.outputs = {}; // Invalidate stale outputs upon disconnect
    this.serverNodeDataTypes = {};
    this.isWriting = false;
    this.isReading = false;
    this.writeLock.abortAll(new Error(`OPC UA driver disconnected (${this.endpointUrl})`));
    this.readLock.abortAll(new Error(`OPC UA driver disconnected (${this.endpointUrl})`));
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
    this.localServerEndpointUrl = res.endpointUrl;
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
      this.localServerEndpointUrl = null;
    }
  }

  /**
   * Reads commands emitted by the live PLC
   */
  public readOutputs(): Record<string, boolean | number> {
    return { ...this.outputs };
  }

  /**
   * Writes physical sensor and feedback states to the connected PLC.
   * If a write is currently in progress, it waits for completion up to operationTimeoutMs,
   * or throws immediately if concurrencyMode is 'throw'. Never silently returns.
   */
  public async writeInputs(
    inputs: Record<string, boolean | number>,
    options?: { concurrencyMode?: OpcUaConcurrencyMode; timeoutMs?: number }
  ): Promise<void> {
    this.inputs = { ...inputs };

    if (!this.status.connected) {
      throw new Error(`Cannot write inputs: OPC UA PLC driver is disconnected (${this.endpointUrl})`);
    }

    const mode = options?.concurrencyMode ?? this.concurrencyMode;
    const timeout = options?.timeoutMs ?? this.operationTimeoutMs;

    // Guard: Prevent skipped writes.
    // If another write is already running or queued:
    if (this.isWriting) {
      if (mode === 'throw') {
        throw new Error(
          `Cannot write inputs: OPC UA write collision detected on ${this.endpointUrl}. An active write is already in progress and concurrency mode is THROW.`
        );
      }
    }

    // If _isWriting was set directly/externally, wait for it to clear
    if (this._isWriting) {
      const waitStart = performance.now();
      while (this._isWriting) {
        if (!this.status.connected) {
          throw new Error(
            `Cannot write inputs: OPC UA PLC driver disconnected while waiting for in-flight write (${this.endpointUrl})`
          );
        }
        if (performance.now() - waitStart >= timeout) {
          throw new Error(
            `OPC UA write timeout: previous write did not complete within ${timeout}ms (${this.endpointUrl})`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }

    let releaseLock: (() => void) | null = null;
    try {
      releaseLock = await this.writeLock.acquire(timeout, `writeInputs to ${this.endpointUrl}`);
    } catch (err: any) {
      throw new Error(`Failed to acquire OPC UA write lock: ${err.message || String(err)}`);
    }

    this._isWriting = true;

    try {
      const api = this.customApi || getElectronOpcUa();
      if (!api) {
        throw new Error(`Cannot write inputs: Electron OPC UA API is unavailable (${this.endpointUrl})`);
      }

      const writePayload: Record<string, { value: any; dataType?: string }> = {};

      for (const [tag, value] of Object.entries(inputs)) {
        const plcNodeId = this.resolvePlcNodeId(tag);
        let dataType: TagDataType | undefined =
          this.serverNodeDataTypes[plcNodeId] ||
          this.serverNodeDataTypes[tag] ||
          this.tagTypeMap[tag];

        if (!dataType) {
          const def = DEFAULT_OPCUA_TAGS.find((d) => d.tag === tag);
          if (def) {
            dataType = def.dataType;
          }
        }

        if (!dataType) {
          if (typeof value === 'boolean') {
            dataType = 'Boolean';
          } else if (typeof value === 'string') {
            dataType = 'String';
          } else if (tag === 'SEQ') {
            dataType = 'Int32';
          } else {
            dataType = 'Float';
          }
        }
        writePayload[plcNodeId] = {
          value,
          dataType,
        };
      }

      const res = await api.writeTags(writePayload);
      if (res && res.success === false) {
        if (res.error?.toLowerCase().includes('connect') || res.error?.toLowerCase().includes('session')) {
          this.status.connected = false;
          this.state = 'DISCONNECTED';
          this.outputs = {};
        }
        throw new Error(res.error || 'Failed to write OPC UA tags');
      }
    } catch (err) {
      console.warn('OPC UA write error:', err);
      this.status.connected = false;
      this.state = 'DISCONNECTED';
      this.outputs = {};
      throw err;
    } finally {
      this._isWriting = false;
      if (releaseLock) {
        releaseLock();
      }
    }
  }

  /**
   * Cyclic scan tick called by the simulation engine loop / lockstep runner
   */
  public async tick(dtMs: number): Promise<void> {
    this.status.lastScanMs = dtMs;

    if (!this.status.connected) {
      throw new Error(`PLC scan tick failed: OPC UA driver is disconnected (${this.endpointUrl}). Stale outputs discarded.`);
    }

    // In lockstep scan mode, wait for the PLC scan cycle duration
    if (dtMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, dtMs));
    }

    // Poll latest outputs produced by the PLC during its scan
    await this.syncOutputsFromPlc();
  }

  /**
   * Sequence-number handshake for lockstep scan verification.
   * Awaits until the PLC outputs SEQ_ACK matching expectedSeq.
   * If the handshake does not complete within timeoutMs, throws an Error that fails the test.
   */
  public async waitForSeqAck(expectedSeq: number, timeoutMs: number = 3000): Promise<void> {
    if (!this.status.connected) {
      throw new Error(
        `Lockstep handshake failed: OPC UA driver is disconnected (${this.endpointUrl}). Stale outputs discarded.`
      );
    }



    const startTime = performance.now();
    while (Number(this.outputs['SEQ_ACK']) !== expectedSeq) {
      if (!this.status.connected) {
        throw new Error(
          `Lockstep handshake failed: OPC UA driver disconnected while waiting for SEQ_ACK = ${expectedSeq} (${this.endpointUrl})`
        );
      }
      if (performance.now() - startTime >= timeoutMs) {
        const receivedAck = this.outputs['SEQ_ACK'];
        throw new Error(
          `Lockstep handshake timeout: PLC failed to acknowledge SEQ = ${expectedSeq} (received SEQ_ACK = ${receivedAck !== undefined ? receivedAck : 'none'}) within ${timeoutMs}ms (${this.endpointUrl}).`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, Math.min(20, this.status.lastScanMs || 50)));
      await this.syncOutputsFromPlc();
    }
  }

  /**
   * Asynchronously poll live outputs from the connected PLC.
   * If a read is currently in progress, it waits for completion up to operationTimeoutMs,
   * or throws immediately if concurrencyMode is 'throw'. Never silently returns.
   */
  public async syncOutputsFromPlc(
    options?: { concurrencyMode?: OpcUaConcurrencyMode; timeoutMs?: number }
  ): Promise<void> {
    if (!this.status.connected) {
      throw new Error(`PLC sync failed: OPC UA driver is disconnected (${this.endpointUrl}). Stale outputs discarded.`);
    }

    const mode = options?.concurrencyMode ?? this.concurrencyMode;
    const timeout = options?.timeoutMs ?? this.operationTimeoutMs;

    // Guard: Prevent skipped reads.
    if (this.isReading) {
      if (mode === 'throw') {
        throw new Error(
          `Cannot read outputs: OPC UA read collision detected on ${this.endpointUrl}. An active read is already in progress and concurrency mode is THROW.`
        );
      }
    }

    // If _isReading was set directly/externally, wait for it to clear
    if (this._isReading) {
      const waitStart = performance.now();
      while (this._isReading) {
        if (!this.status.connected) {
          throw new Error(
            `PLC sync failed: OPC UA PLC driver disconnected while waiting for in-flight read (${this.endpointUrl})`
          );
        }
        if (performance.now() - waitStart >= timeout) {
          throw new Error(
            `OPC UA read timeout: previous read did not complete within ${timeout}ms (${this.endpointUrl})`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }

    let releaseLock: (() => void) | null = null;
    try {
      releaseLock = await this.readLock.acquire(timeout, `syncOutputsFromPlc from ${this.endpointUrl}`);
    } catch (err: any) {
      throw new Error(`Failed to acquire OPC UA read lock: ${err.message || String(err)}`);
    }

    this._isReading = true;
    const startTime = performance.now();

    try {
      const api = this.customApi || getElectronOpcUa();
      if (!api) {
        throw new Error(`Cannot read outputs: Electron OPC UA API is unavailable (${this.endpointUrl})`);
      }

      // Split tag lists per skid: read only active skid's output tags on every scan
      const tagsToRead = this.getActiveOutputTags();
      this.outputTags = tagsToRead;
      const nodesToRead = tagsToRead.map((tag) => this.resolvePlcNodeId(tag));
      const readResult = await api.readTags(nodesToRead);
      this.status.latencyMs = Math.round(performance.now() - startTime);

      // Verify whether connection was lost:
      // If tags were requested but 0 tags were returned, query live connection status
      if (nodesToRead.length > 0 && Object.keys(readResult).length === 0) {
        const liveStatus = await api.getStatus?.();
        if (liveStatus && !liveStatus.connected) {
          this.status.connected = false;
          this.state = 'DISCONNECTED';
          this.outputs = {};
          throw new Error(`OPC UA connection lost during tag read: Server unreachable (${this.endpointUrl})`);
        }
      }

      for (const internalTag of tagsToRead) {
        const plcNodeId = this.resolvePlcNodeId(internalTag);
        const val = readResult[plcNodeId] ?? readResult[internalTag];

        if (val !== null && val !== undefined) {
          if (typeof val === 'boolean' || typeof val === 'number') {
            this.outputs[internalTag] = val;
          } else if (typeof val === 'string' && internalTag === 'PLC_STATE') {
            this.state = val;
            (this.outputs as any)['PLC_STATE'] = val;
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
    } catch (err: any) {
      console.warn('Failed to poll OPC UA tags:', err);
      this.status.connected = false;
      this.state = 'DISCONNECTED';
      this.outputs = {};
      throw err;
    } finally {
      this._isReading = false;
      if (releaseLock) {
        releaseLock();
      }
    }
  }

  /**
   * Reset helper for FAT test suite runs
   */
  public async writeCommandTags(
    commandName: string,
    tags: Record<string, boolean | number>
  ): Promise<void> {
    if (!this.status.connected) {
      throw new Error(
        `Command ${commandName} failed: OPC UA driver is disconnected (${this.endpointUrl}). Stale outputs discarded.`
      );
    }

    try {
      await this.writeInputs(tags);
    } catch (err: any) {
      throw new Error(
        `Command ${commandName} failed writing tags to ${this.endpointUrl}: ${err.message || String(err)}`
      );
    }
  }

  public async resetBatch(): Promise<void> {

    await this.writeCommandTags('resetBatch', {
      RESET_CMD: true,
      E_STOP_PB: true,
      TK100_LT: 75.0,
      V101_ZSO: false,
    });
  }

  public async resetSystem(): Promise<void> {

    if (this.activeSkid === 'BATCH_MIXING') {
      await this.resetBatch();
    } else {
      await this.writeCommandTags('resetSystem', {
        RESET_CMD: true,
        E_STOP_PB: true,
        LT_BALANCE: 60.0,
        TT5: 20.0,
      });
    }
  }

  /**
   * Reset Precondition for HIL testing:
   * Commands a reset to the PLC, then waits for and verifies that the PLC has
   * transitioned to a known clean state (e.g. PLC_STATE == 'STOPPED' or 'IDLE').
   * Fails with an error if the PLC does not confirm the known state within timeoutMs.
   */
  public async resetPrecondition(
    expectedStates?: string | string[],
    timeoutMs: number = 3000
  ): Promise<void> {
    if (!this.status.connected) {
      throw new Error(
        `Reset precondition failed: PLC connection is offline (${this.endpointUrl}). Stale outputs discarded.`
      );
    }

    const validStates = expectedStates
      ? (Array.isArray(expectedStates) ? expectedStates : [expectedStates])
      : (this.activeSkid === 'BATCH_MIXING' ? ['IDLE', 'STOPPED'] : ['STOPPED']);

    // 1. Command reset to the PLC
    await this.resetSystem();



    // 2. Poll and verify that the PLC reached the expected known state
    const startTime = Date.now();
    let lastKnownState = this.state;

    while (Date.now() - startTime < timeoutMs) {
      await this.syncOutputsFromPlc();
      const plcStateTag = (this.outputs as any)['PLC_STATE'];
      lastKnownState = plcStateTag !== undefined && plcStateTag !== '' ? String(plcStateTag) : this.state;

      if (validStates.includes(lastKnownState)) {
        return; // Verified known state!
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error(
      `Reset precondition failed: PLC state is '${lastKnownState}', expected ${validStates.map((s) => `'${s}'`).join(' or ')} within ${timeoutMs}ms (${this.endpointUrl}).`
    );
  }

  public async startProduction(): Promise<void> {
    await this.writeCommandTags('startProduction', {
      START_CMD: true,
      P100_START: true,
      P_FEED_CMD: true,
    });
  }

  public async divertManually(): Promise<void> {
    await this.writeCommandTags('divertManually', {
      PV11_CMD: false,
      PV12_CMD: true,
    });
  }

  public async startBatch(): Promise<void> {
    await this.writeCommandTags('startBatch', {
      START_PB: true,
      P100_START: true,
    });
  }

  public async dischargeBatch(): Promise<void> {
    await this.writeCommandTags('dischargeBatch', {
      V400_PROD_CMD: true,
    });
  }

  public async abortBatch(): Promise<void> {
    await this.writeCommandTags('abortBatch', {
      ABORT_PB: true,
      P100_START: false,
      V101_CMD: false,
      V400_PROD_CMD: false,
    });
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

  public async emergencyStop(): Promise<void> {
    await this.writeCommandTags('emergencyStop', {
      E_STOP_PB: false,
      E_STOP: false,
    });
  }
}
