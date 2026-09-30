/**
 * TwinForge Studio - Pasteurizer PLC Control Driver
 * Implements dairy pasteurization process state machine and PMO/FDA safety interlocks.
 * Standard Continuous HTST Sanitary Process Automation
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
    pasteurizationTempSP: 90.0, // °C target holding temperature
    divertThresholdTempC: 88.0, // °C legal divert limit (PMO / 3A standard)
    holdingTimeSeconds: 20.0,
    differentialPressureBar: 0.5, // PT4 - PT2 >= 0.5 bar
    ratedFlowLph: 10000.0, // 10 KLPH
  };

  // Interlocks mirroring P&ID Drawing Sheet-1
  public interlocks: Map<string, InterlockStatus> = new Map([
    [
      'IL-FDV',
      {
        id: 'IL-FDV',
        name: 'Legal Flow Diversion Interlock (PV11 / PV12)',
        condition: 'Holding tube temp TT5 must be >= 88.0°C for forward flow to product out; else divert to Balance Tank',
        isOk: false,
        tripped: false,
      },
    ],
    [
      'IL-DP',
      {
        id: 'IL-DP',
        name: 'Regenerator Differential Pressure (PT4 - PT2)',
        condition: 'Booster discharge PT4 must exceed raw feed PT2 by >= 0.5 bar to prevent raw-to-pasteurized contamination',
        isOk: true,
        tripped: false,
      },
    ],
    [
      'IL-BAL-LOW',
      {
        id: 'IL-BAL-LOW',
        name: 'Balance Tank Low Level Lockout (LS1 / LT1)',
        condition: 'Feed Pump trips if Balance Tank level < 15% to protect pump mechanical seal from cavitation',
        isOk: true,
        tripped: false,
      },
    ],
    [
      'IL-BAL-HIGH',
      {
        id: 'IL-BAL-HIGH',
        name: 'Balance Tank High Level Protection (LS2)',
        condition: 'Raw milk transfer and inlet valve PV1 trip if Balance Tank level > 95% to prevent tank overflow',
        isOk: true,
        tripped: false,
      },
    ],
    [
      'IL-SEAL',
      {
        id: 'IL-SEAL',
        name: 'Homogenizer Seal Water Interlock',
        condition: 'Homogenizer locked out if Ø 25 mm seal cooling water line is unproved',
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
    const holdingTemp = Number(this.inputs['TT5'] ?? this.inputs['PHE_HEAT_TT'] ?? 20);
    const balLevel = Number(this.inputs['LT1'] ?? this.inputs['TK_BAL_LT'] ?? 75);
    const pt4 = Number(this.inputs['PT4'] ?? 4.0);
    const pt2 = Number(this.inputs['PT2'] ?? 2.5);

    // 1. IL-FDV: Flow Diversion Valve Safety Lockout
    const ilFdv = this.interlocks.get('IL-FDV')!;
    const isAtLegalTemp = holdingTemp >= this.setpoints.divertThresholdTempC;
    ilFdv.isOk = isAtLegalTemp;

    if (!isAtLegalTemp && this.state === 'PASTEURIZING_FORWARD') {
      ilFdv.tripped = true;
      this.state = 'DIVERTED_TO_BALANCE';
      this.outputs['PV11_CMD'] = false; // Forward closed
      this.outputs['PV12_CMD'] = true;  // Divert open to Balance Tank!
    }

    // 2. IL-DP: Differential Pressure
    const ilDp = this.interlocks.get('IL-DP')!;
    const dp = pt4 - pt2;
    ilDp.isOk = dp >= this.setpoints.differentialPressureBar;
    if (!ilDp.isOk && this.state === 'PASTEURIZING_FORWARD') {
      ilDp.tripped = true;
      // Safety divert on loss of positive pressure differential
      this.state = 'DIVERTED_TO_BALANCE';
      this.outputs['PV11_CMD'] = false;
      this.outputs['PV12_CMD'] = true;
    }

    // 3. IL-BAL-LOW: Balance Tank Low Level
    const ilBalLow = this.interlocks.get('IL-BAL-LOW')!;
    if (balLevel < 15) {
      ilBalLow.isOk = false;
      ilBalLow.tripped = true;
      this.outputs['P_FEED_START'] = false; // Trip feed pump
      this.outputs['P_BOOST_START'] = false;
    } else {
      ilBalLow.isOk = true;
    }

    // 4. IL-BAL-HIGH: Balance Tank Overfill
    const ilBalHigh = this.interlocks.get('IL-BAL-HIGH')!;
    if (balLevel > 95) {
      ilBalHigh.isOk = false;
      ilBalHigh.tripped = true;
      this.outputs['PV1_CMD'] = false; // Close milk inlet
      this.outputs['P_RAW_START'] = false; // Stop raw milk pump
    } else {
      ilBalHigh.isOk = true;
    }
  }

  private advanceStateMachine(): void {
    const holdingTemp = Number(this.inputs['TT5'] ?? this.inputs['PHE_HEAT_TT'] ?? 20);

    switch (this.state) {
      case 'STOPPED':
        this.clearAllOutputs();
        break;

      case 'WATER_CIRCULATION':
      case 'WARM_UP': {
        // Water inlet open, feed pump on, hot water skid running
        this.outputs['PV2_CMD'] = true;    // Water inlet to balance tank
        this.outputs['P_FEED_START'] = true; // Feed pump VFD running
        this.outputs['P_HW_START'] = true;   // Hot water circulation
        this.outputs['SCV1_CMD'] = 90;       // Open steam control valve
        this.outputs['PV10_CMD'] = 20;       // Chilled water minimum
        this.outputs['PV11_CMD'] = false;    // Forward closed
        this.outputs['PV12_CMD'] = true;     // Divert loop to balance tank open

        // Separator & Homogenizer in bypass during warmup
        this.outputs['PV7_CMD'] = true;      // Separator bypass
        this.outputs['PV9_CMD'] = true;      // Homogenizer bypass

        if (holdingTemp >= this.setpoints.divertThresholdTempC) {
          this.state = 'PASTEURIZING_FORWARD';
          this.outputs['PV11_CMD'] = true;   // Legal forward flow proved!
          this.outputs['PV12_CMD'] = false;  // Divert valve closed
          this.outputs['P_BOOST_START'] = true; // Booster pump on
          this.outputs['PV10_CMD'] = 65;     // Chilled water loop active to hit 4°C
          
          // Switch raw milk infeed
          this.outputs['PV2_CMD'] = false;   // Close water
          this.outputs['PV1_CMD'] = true;    // Open raw milk
          this.outputs['P_RAW_START'] = true; // Start raw transfer pump

          // Engage separator & homogenizer
          this.outputs['PV4_CMD'] = true;    // Separator infeed
          this.outputs['PV5_CMD'] = true;    // Skim return
          this.outputs['PV7_CMD'] = false;   // Close bypass
          this.outputs['PV8_CMD'] = true;    // Homogenizer infeed
          this.outputs['PV9_CMD'] = false;   // Close bypass
        }
        break;
      }

      case 'PASTEURIZING_FORWARD': {
        this.outputs['PV1_CMD'] = true;      // Raw milk inlet
        this.outputs['P_RAW_START'] = true;
        this.outputs['P_FEED_START'] = true;
        this.outputs['P_BOOST_START'] = true;
        this.outputs['P_HW_START'] = true;
        this.outputs['PV11_CMD'] = true;     // Forward flow to product
        this.outputs['PV12_CMD'] = false;    // Divert closed
        this.outputs['PV10_CMD'] = 65;      // Chilled water cooling to 4°C
        this.outputs['SCV1_CMD'] = 58;      // Modulating steam to hold 90°C

        if (holdingTemp < this.setpoints.divertThresholdTempC) {
          this.state = 'DIVERTED_TO_BALANCE';
          this.outputs['PV11_CMD'] = false; // Divert immediately!
          this.outputs['PV12_CMD'] = true;
        }
        break;
      }

      case 'DIVERTED_TO_BALANCE': {
        // Keep running in diversion recycle loop until temperature recovers
        this.outputs['PV11_CMD'] = false;
        this.outputs['PV12_CMD'] = true;    // Full divert to Balance Tank
        this.outputs['SCV1_CMD'] = 95;      // High steam to recover

        if (holdingTemp >= this.setpoints.pasteurizationTempSP) {
          this.state = 'PASTEURIZING_FORWARD';
          this.outputs['PV11_CMD'] = true;
          this.outputs['PV12_CMD'] = false;
        }
        break;
      }

      case 'CIP_CLEANING': {
        this.outputs['PV2_CMD'] = true;     // Water / CIP solution
        this.outputs['P_FEED_START'] = true;
        this.outputs['P_BOOST_START'] = true;
        this.outputs['PV7_CMD'] = true;     // Bypass separator
        this.outputs['PV9_CMD'] = true;     // Bypass homogenizer
        this.outputs['PV11_CMD'] = true;
        this.outputs['PV12_CMD'] = false;
        this.outputs['SCV1_CMD'] = 75;      // 75°C caustic sanitize
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
    this.outputs['PV12_CMD'] = true;
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
