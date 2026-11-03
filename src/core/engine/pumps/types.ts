/**
 * TwinForge Studio - Centrifugal Pump Model Types
 * Type definitions, parameters, and fault modes.
 */

import { type NumericParameter } from '../hydraulics/types';

export interface PumpCurvePoint {
  flowLph: NumericParameter<number>;
  headM: NumericParameter<number>;
}

export interface MotorConfig {
  ratedPowerKw: NumericParameter<number>; // e.g. 2.2 kW
  ratedCurrentA: NumericParameter<number>; // e.g. 4.8 A
  motorEfficiency: NumericParameter<number>; // e.g. 0.85
  rampUpTimeS: NumericParameter<number>; // e.g. 2.0 s
  coastDownTauS: NumericParameter<number>; // e.g. 3.0 s
}

export interface CentrifugalPumpConfig {
  id: string;
  tag: string;
  hasVfd?: boolean; // false for Direct-On-Line (P-RAW), true if VFD equipped
  ratedSpeedRpm?: NumericParameter<number>; // e.g. 2900 RPM
  curvePoints: {
    shutOff: PumpCurvePoint; // 32 m at 0 L/h
    rated: PumpCurvePoint; // 24 m at 12,000 L/h
    maxFlow: PumpCurvePoint; // 12 m at 16,000 L/h
  };
  motor: MotorConfig;
  efficiencyPeak: {
    flowLph: NumericParameter<number>; // 12,000 L/h
    efficiencyPct: NumericParameter<number>; // 60%
  };
  npshrRatedM: NumericParameter<number>; // 2.5 m at rated flow
  deadheadTimeoutS?: NumericParameter<number>; // 10 s
}

export type PumpFaultMode =
  | 'pump_trip'
  | 'impeller_wear'
  | 'suction_blockage'
  | 'motor_overload'
  | 'run_feedback_fail';

export interface PumpFault {
  mode: PumpFaultMode;
  value?: number;
}

export interface PumpState {
  speedRatio: number; // 0.0 to 1.0
  speedPct: number; // 0 to 100%
  runFeedback: boolean; // P_<TAG>_RUN_FB
  currentA: number; // P_<TAG>_CURRENT
  shaftPowerKw: number;
  efficiencyPct: number;
  tripped: boolean;
  fault: boolean; // P_<TAG>_FAULT
  cavitation: boolean; // P_<TAG>_CAVITATION
  dryRun: boolean; // P_<TAG>_DRY_RUN
  deadhead: boolean; // P_<TAG>_DEADHEAD
  runout: boolean; // P_<TAG>_RUNOUT
  headM: number;
  npshaM: number;
  npshrM: number;
}
