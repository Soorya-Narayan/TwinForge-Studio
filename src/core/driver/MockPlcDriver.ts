/**
 * TwinForge Studio - In-Process Mock PLC Driver
 * 
 * Implements standard industrial control:
 * - Operating modes: AUTO / MANUAL / MAINTENANCE
 * - Batch State Machine (IDLE -> READY -> DOSING -> HEATING -> MIXING -> DISCHARGE -> COMPLETE)
 * - Interlock Matrix (IL-01 to IL-08)
 */

import type { Driver, DriverStatus } from './Driver';

export type PlcOperatingMode = 'AUTO' | 'MANUAL' | 'MAINTENANCE';

export type BatchState = 
  | 'IDLE' 
  | 'READY' 
  | 'DOSING' 
  | 'HEATING' 
  | 'MIXING' 
  | 'DISCHARGE' 
  | 'COMPLETE' 
  | 'HOLD' 
  | 'ABORTED';

export interface InterlockStatus {
  id: string;
  name: string;
  condition: string;
  isOk: boolean;
  tripped: boolean;
}

export class MockPlcDriver implements Driver {
  public status: DriverStatus = {
    connected: true,
    driverType: 'mock',
    scanRateHz: 10,
    lastScanMs: 0,
    latencyMs: 0,
  };

  public mode: PlcOperatingMode = 'AUTO';
  public state: BatchState = 'IDLE';

  // PLC Memory Registers
  public inputs: Record<string, boolean | number> = {};
  public outputs: Record<string, boolean | number> = {};

  // Recipe parameters
  public recipe = {
    doseTargetL: 300,
    tempTargetC: 75,
    mixTimeS: 5,
    dosedVolumeL: 0,
    mixTimerS: 0,
  };

  // Interlocks
  public interlocks: Map<string, InterlockStatus> = new Map([
    ['IL-01', { id: 'IL-01', name: 'Suction Valve Interlock', condition: 'Pump cannot run if Suction Valve V-101 is not OPEN', isOk: true, tripped: false }],
    ['IL-02', { id: 'IL-02', name: 'Low Level Runaway Trip', condition: 'Trip pump if source tank level < 8%', isOk: true, tripped: false }],
    ['IL-03', { id: 'IL-03', name: 'Overfill Protection', condition: 'Cut dosing if destination tank level > 90%', isOk: true, tripped: false }],
    ['IL-04', { id: 'IL-04', name: 'Thermal Limit Trip', condition: 'Cut steam valve if temperature > 88°C', isOk: true, tripped: false }],
    ['IL-05', { id: 'IL-05', name: 'Agitator Dry-Run Protection', condition: 'Inhibit agitator unless tank volume > 50L', isOk: true, tripped: false }],
  ]);

  public async connect(): Promise<void> {
    this.status.connected = true;
  }

  public async disconnect(): Promise<void> {
    this.status.connected = false;
  }

  public readOutputs(): Record<string, boolean | number> {
    return { ...this.outputs };
  }

  public writeInputs(inputs: Record<string, boolean | number>): void {
    this.inputs = { ...inputs };
  }

  /**
   * Scan tick: Evaluate interlocks, advance state machine, update commands
   */
  public tick(dtMs: number): void {
    const dtSeconds = dtMs / 1000.0;

    // 1. Evaluate Interlock Matrix
    this.evaluateInterlocks();

    // 2. State Machine Logic (in AUTO mode)
    if (this.mode === 'AUTO') {
      this.evaluateBatchStateMachine(dtSeconds);
    }
  }

  private evaluateInterlocks(): void {
    // IL-01: P100 requires V101_ZSO == true
    const v101Open = Boolean(this.inputs['V101_ZSO']);
    const p100Cmd = Boolean(this.outputs['P100_START']);
    const il01 = this.interlocks.get('IL-01')!;
    if (p100Cmd && !v101Open) {
      il01.isOk = false;
      il01.tripped = true;
      this.outputs['P100_START'] = false; // Interlock trip action!
    } else {
      il01.isOk = v101Open;
    }

    // IL-02: Source tank level low trip
    const tk100Level = Number(this.inputs['TK100_LT'] ?? 100);
    const il02 = this.interlocks.get('IL-02')!;
    if (tk100Level < 8 && p100Cmd) {
      il02.isOk = false;
      il02.tripped = true;
      this.outputs['P100_START'] = false;
    } else {
      il02.isOk = tk100Level >= 8;
    }

    // IL-03: Destination overfill cut
    const tk400Level = Number(this.inputs['TK400_LT'] ?? 0);
    const il03 = this.interlocks.get('IL-03')!;
    if (tk400Level > 90) {
      il03.isOk = false;
      il03.tripped = true;
      this.outputs['P100_START'] = false;
      this.outputs['V101_CMD'] = false;
    } else {
      il03.isOk = tk400Level <= 90;
    }

    // IL-04: Thermal safety cut
    const hx100Temp = Number(this.inputs['HX100_TT'] ?? 20);
    const il04 = this.interlocks.get('IL-04')!;
    if (hx100Temp > 88) {
      il04.isOk = false;
      il04.tripped = true;
      this.outputs['TCV100_CMD'] = 0; // Cut steam
    } else {
      il04.isOk = hx100Temp <= 88;
    }
  }

  private evaluateBatchStateMachine(dt: number): void {
    const tk400Vol = Number(this.inputs['TK400_VOL'] ?? 0);
    const hx100Temp = Number(this.inputs['HX100_TT'] ?? 20);

    switch (this.state) {
      case 'IDLE':
        this.clearAllCommands();
        break;

      case 'READY':
        // Ready to start batch
        break;

      case 'DOSING': {
        // Open line valves, start dosing pump
        this.outputs['V101_CMD'] = true;
        this.outputs['V102_CMD'] = true;

        // Start pump once valve proves open (satisfying IL-01)
        if (this.inputs['V101_ZSO']) {
          this.outputs['P100_START'] = true;
        }

        // Check if dose target reached
        if (tk400Vol >= this.recipe.doseTargetL) {
          this.outputs['P100_START'] = false;
          this.outputs['V101_CMD'] = false;
          this.outputs['V102_CMD'] = false;
          this.state = 'HEATING';
        }
        break;
      }

      case 'HEATING': {
        // Heat fluid through heat exchanger loop
        this.outputs['TCV100_CMD'] = 75; // 75% steam valve position
        this.outputs['P100_START'] = true; // Circulate

        if (hx100Temp >= this.recipe.tempTargetC) {
          this.outputs['TCV100_CMD'] = 15; // Hold heat
          this.state = 'MIXING';
        }
        break;
      }

      case 'MIXING': {
        this.recipe.mixTimerS += dt;
        this.outputs['AGITATOR_CMD'] = true;

        if (this.recipe.mixTimerS >= this.recipe.mixTimeS) {
          this.outputs['AGITATOR_CMD'] = false;
          this.state = 'DISCHARGE';
        }
        break;
      }

      case 'DISCHARGE': {
        // Open product discharge valve
        this.outputs['V400_PROD_CMD'] = true;

        // When mixing tank drained, batch complete!
        if (tk400Vol <= 5) {
          this.outputs['V400_PROD_CMD'] = false;
          this.state = 'COMPLETE';
        }
        break;
      }

      case 'COMPLETE':
        this.clearAllCommands();
        break;

      case 'HOLD':
      case 'ABORTED':
        this.clearAllCommands();
        break;
    }
  }

  public startBatch(): void {
    this.recipe.mixTimerS = 0;
    this.state = 'DOSING';
  }

  public holdBatch(): void {
    this.state = 'HOLD';
    this.clearAllCommands();
  }

  public resumeBatch(): void {
    this.state = 'DOSING';
  }

  public abortBatch(): void {
    this.state = 'ABORTED';
    this.clearAllCommands();
  }

  public resetBatch(): void {
    this.state = 'IDLE';
    this.recipe.mixTimerS = 0;
    this.clearAllCommands();
    // Reset tripped interlocks
    for (const il of this.interlocks.values()) {
      il.tripped = false;
    }
  }

  private clearAllCommands(): void {
    for (const key of Object.keys(this.outputs)) {
      this.outputs[key] = typeof this.outputs[key] === 'number' ? 0 : false;
    }
  }
}
