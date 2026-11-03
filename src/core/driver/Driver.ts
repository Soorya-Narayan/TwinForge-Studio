/**
 * TwinForge Studio - Universal PLC Driver Interface
 * 
 * Clean hardware boundary enabling identical simulation calls whether against
 * an in-process mock, an OPC UA server, or live factory hardware.
 */

export interface DriverStatus {
  connected: boolean;
  driverType: 'mock' | 'opcua' | 's7' | 'modbus';
  scanRateHz: number;
  lastScanMs: number;
  latencyMs: number;
}

export interface Driver {
  status: DriverStatus;
  state?: string;
  endpointUrl?: string;
  customApi?: any;
  inputs: Record<string, boolean | number>;
  outputs: Record<string, boolean | number | string>;
  interlocks?: Map<string, any>;
  mode?: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  /**
   * Reads commands emitted by the PLC (digital/analog outputs)
   */
  readOutputs(): Record<string, boolean | number>;

  /**
   * Writes physical sensor and feedback states to the PLC (digital/analog inputs)
   */
  writeInputs(inputs: Record<string, boolean | number>): Promise<void> | void;

  /**
   * Ticks the PLC logic (if running in-process mock) or waits for the PLC scan cycle
   */
  tick?(dtMs: number): Promise<void> | void;

  /**
   * Set active plant skid
   */
  setSkid?(skid: 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'CUSTOM'): void;

  /**
   * Verify and enforce reset precondition before test execution
   */
  resetPrecondition?(expectedResetStates?: string[]): Promise<void> | void;

  /**
   * Reset control system logic
   */
  resetSystem?(): Promise<void> | void;

  /**
   * Reset batch control logic
   */
  resetBatch?(): Promise<void> | void;

  /**
   * Synchronize / poll live outputs from external PLC
   */
  syncOutputsFromPlc?(): Promise<void>;

  /**
   * Wait for PLC to acknowledge lockstep sequence number
   */
  waitForSeqAck?(expectedSeq: number, timeoutMs?: number): Promise<void> | void;

  /**
   * True only when the live session is connected to the app's built-in
   * Loopback Test Server (which contains no PLC control logic).
   */
  isLoopbackSession?(): boolean;

  /**
   * Set runtime interlock definitions
   */
  setInterlockDefinitions?(defs: any): void;

  /**
   * Emergency stop trigger
   */
  emergencyStop?(): any;
}
