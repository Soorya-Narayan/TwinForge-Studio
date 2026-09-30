/**
 * TwinForge Studio - Pasteurizer PLC Control Driver
 * Implements dairy pasteurization process state machine and PMO/FDA safety interlocks.
 */

import type { Driver, DriverStatus } from './Driver';

export type PasteurizerState = 
  | 'STOPPED' 
  | 'WATER_CIRCULATION' 
  | 'WARM_UP' 
  | 'PASTEURIZING_FORWARD' 
  | 'DIVERTED_TO_BALANCE' 
  | 'CIP_CLEANING' 
  | 'EMERGENCY_STOP';

export interface InterlockStatus {
  id: string;
  name: string;
  condition: string;
  isOk: boolean;
  tripped: boolean;
}

export class PasteurizerPlcDriver implements Driver {
  public status: DriverStatus = {
    connected: true,
    driverType: 'mock',
    scanRateHz: 10,
    lastScanMs: 0,
    latencyMs: 0,
  };

  public state: PasteurizerState = 'STOPPED';

  // PLC I/O Registers
  public inputs: Record<string, boolean | number> = {};
  public outputs: Record<string, boolean | number> = {};

  // Pasteurizer Setpoints
  public setpoints = {
    pasteurizationTempSP: 90.0, // °C
    divertThresholdTempC: 88.0, // °C (legal divert limit)
    holdingTimeSeconds: 20.0,
    differentialPressureBar: 0.5,
  };

  // Interlocks
  public interlocks: Map<string, InterlockStatus> = new Map([
    [
      'IL-FDV',
      {
        id: 'IL-FDV',
        name: 'Legal Flow Diversion Interlock (PV-11)',
        condition: 'Holding tube temp TT3 must be >= 88°C for forward flow to product storage',
        isOk: false,
        tripped: false,
      },
    ],
    [
      'IL-DP',
      {
        id: 'IL-DP',
        name: 'Regenerator Differential Pressure (PT4 - PT3)',
        condition: 'Pasteurized milk pressure must exceed raw milk pressure by >= 0.5 bar',
        isOk: true,
        tripped: false,
      },
    ],
    [
      'IL-BAL',
      {
        id: 'IL-BAL',
        name: 'Balance Tank Low Level Lockout (LS1)',
        condition: 'Milk Feed Pump trips if Balance Tank level < 15%',
        isOk: true,
        tripped: false,
      },
    ],
    [
      'IL-SEAL',
      {
        id: 'IL-SEAL',
        name: 'Homogenizer Seal Water Interlock',
        condition: 'Homogenizer locked out if seal cooling water line is unproved',
        isOk: true,
        tripped: false,
      },
    ],
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

  public tick(dtMs: number): void {
    void dtMs;
    // 1. Evaluate Legal Safety Interlocks
    this.evaluateInterlocks();

    // 2. Advance Pasteurization State Machine
    this.advanceStateMachine();
  }

  private evaluateInterlocks(): void {
    const holdingTemp = Number(this.inputs['PHE_HEAT_TT'] ?? 20);
    const balLevel = Number(this.inputs['TK_BAL_LT'] ?? 75);

    // IL-FDV: Flow Diversion Valve Safety Lockout
    const ilFdv = this.interlocks.get('IL-FDV')!;
    const isAtLegalTemp = holdingTemp >= this.setpoints.divertThresholdTempC;
    ilFdv.isOk = isAtLegalTemp;

    if (!isAtLegalTemp && this.state === 'PASTEURIZING_FORWARD') {
      ilFdv.tripped = true;
      this.state = 'DIVERTED_TO_BALANCE';
      this.outputs['PV11_CMD'] = false; // Divert back to balance tank!
      this.outputs['PV8_CMD'] = false;  // Lockout forward line
    }

    // IL-BAL: Balance Tank Low Level
    const ilBal = this.interlocks.get('IL-BAL')!;
    if (balLevel < 15) {
      ilBal.isOk = false;
      ilBal.tripped = true;
      this.outputs['P_FEED_START'] = false; // Trip feed pump to avoid cavitation
    } else {
      ilBal.isOk = true;
    }
  }

  private advanceStateMachine(): void {
    const holdingTemp = Number(this.inputs['PHE_HEAT_TT'] ?? 20);

    switch (this.state) {
      case 'STOPPED':
        this.clearAllOutputs();
        break;

      case 'WATER_CIRCULATION':
      case 'WARM_UP': {
        // Feed pump runs, hot water loop runs, steam valve modulates
        this.outputs['P_FEED_START'] = true;
        this.outputs['P_HW_START'] = true;
        this.outputs['SCV1_CMD'] = 85; // Steam on to heat up
        this.outputs['PV11_CMD'] = false; // Under temp -> in diversion loop

        if (holdingTemp >= this.setpoints.divertThresholdTempC) {
          this.state = 'PASTEURIZING_FORWARD';
          this.outputs['PV11_CMD'] = true; // Legal forward flow proved!
          this.outputs['PV8_CMD'] = true;  // Forward to product silo
          this.outputs['P_BOOST_START'] = true; // Booster pump on
        }
        break;
      }

      case 'PASTEURIZING_FORWARD': {
        this.outputs['P_FEED_START'] = true;
        this.outputs['P_HW_START'] = true;
        this.outputs['P_BOOST_START'] = true;
        this.outputs['PV11_CMD'] = true;  // Forward flow valve
        this.outputs['PV8_CMD'] = true;   // Product forward
        this.outputs['SCV1_CMD'] = 55;   // Modulating hold steam

        if (holdingTemp < this.setpoints.divertThresholdTempC) {
          this.state = 'DIVERTED_TO_BALANCE';
          this.outputs['PV11_CMD'] = false; // Divert immediately!
          this.outputs['PV8_CMD'] = false;
        }
        break;
      }

      case 'DIVERTED_TO_BALANCE': {
        // Keep running in recycle loop until temperature recovers
        this.outputs['PV11_CMD'] = false;
        this.outputs['PV8_CMD'] = false;
        this.outputs['SCV1_CMD'] = 90; // Apply boost steam

        if (holdingTemp >= this.setpoints.pasteurizationTempSP) {
          this.state = 'PASTEURIZING_FORWARD';
          this.outputs['PV11_CMD'] = true;
          this.outputs['PV8_CMD'] = true;
        }
        break;
      }

      case 'EMERGENCY_STOP':
        this.clearAllOutputs();
        break;
    }
  }

  public startProduction(): void {
    this.state = 'WARM_UP';
  }

  public divertManually(): void {
    this.state = 'DIVERTED_TO_BALANCE';
    this.outputs['PV11_CMD'] = false;
    this.outputs['PV8_CMD'] = false;
  }

  public emergencyStop(): void {
    this.state = 'EMERGENCY_STOP';
    this.clearAllOutputs();
  }

  public resetSystem(): void {
    this.state = 'STOPPED';
    this.clearAllOutputs();
    for (const il of this.interlocks.values()) {
      il.tripped = false;
    }
  }

  private clearAllOutputs(): void {
    for (const k of Object.keys(this.outputs)) {
      this.outputs[k] = typeof this.outputs[k] === 'number' ? 0 : false;
    }
  }
}
