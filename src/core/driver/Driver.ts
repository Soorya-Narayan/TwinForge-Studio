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
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  /**
   * Reads commands emitted by the PLC (digital/analog outputs)
   */
  readOutputs(): Record<string, boolean | number>;

  /**
   * Writes physical sensor and feedback states to the PLC (digital/analog inputs)
   */
  writeInputs(inputs: Record<string, boolean | number>): void;

  /**
   * Ticks the PLC logic (if running in-process mock)
   */
  tick?(dtMs: number): void;
}
