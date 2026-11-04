/**
 * TwinForge Studio - On/Off Valve Model Types
 * Reusable type definitions, configurations, and fault modes for pneumatic/solenoid on-off valves.
 */

import { type NumericParameter } from '../hydraulics/types';

export type FailPosition = 'closed' | 'open';

export interface OnOffValveConfig {
  id: string;
  tag: string;
  travelTimeS: NumericParameter<number> | number;
  failPosition: FailPosition;
  kv: NumericParameter<number> | number;
  leakKvPct?: NumericParameter<number> | number; // % of rated Kv when closed (default 0.01%)
  zsoThresholdPct?: NumericParameter<number> | number; // Position % for ZSO open limit switch (default 95%)
  zscThresholdPct?: NumericParameter<number> | number; // Position % for ZSC closed limit switch (default 5%)
  passableThresholdPct?: NumericParameter<number> | number; // Position % for flow passability (default 90%)
  initialPositionPct?: number; // Initial position (default: 0 if closed, 100 if open)
}

export type ValveFaultMode =
  | 'stuck_open'
  | 'stuck_closed'
  | 'travel_delay'
  | 'seat_leak'
  | 'zso_fail'
  | 'zsc_fail'
  | 'actuator_air_loss';

export interface ValveFault {
  mode: ValveFaultMode;
  value?: number;
}

export interface OnOffValveInputs {
  command: boolean;
  instrumentAirOk: boolean;
  solenoidPowerOk: boolean;
}

export interface OnOffValveOutputs {
  positionPct: number;
  isOpen: boolean;
  zso: boolean;
  zsc: boolean;
  effectiveKv: number;
}
