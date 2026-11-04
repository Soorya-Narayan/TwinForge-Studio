/**
 * TwinForge Studio - Tank Model Types
 * Configurations, fault definitions, and I/O contracts for process vessels.
 */

import type { NumericParameter } from '../hydraulics/types';
import { type FluidComposition, RAW_MILK_COMPOSITION } from '../fluids/types';

export interface VolumeHeightPoint {
  volumeL: number;
  heightMm: number;
}

export interface SwitchConfig {
  tripPct: NumericParameter<number> | number;
  resetPct: NumericParameter<number> | number;
  type: 'low' | 'high';
}

export interface BalanceTankConfig {
  id: string;
  tag: string;
  capacityL: NumericParameter<number> | number;
  geometry: VolumeHeightPoint[];
  ambientTempC: NumericParameter<number> | number;
  heatLossUaWPerK: NumericParameter<number> | number;
  outletSubmergencePct: NumericParameter<number> | number;
  ls1: SwitchConfig;
  ls2: SwitchConfig;
  initialLevelPct: NumericParameter<number> | number;
  initialTempC: NumericParameter<number> | number;
  initialComposition: FluidComposition;
}

export type BalanceTankFaultMode = 'ls1_fail' | 'ls2_fail' | 'tank_leak';

export interface BalanceTankFault {
  mode: BalanceTankFaultMode;
  value?: number;
}

export interface InflowStream {
  id: string;
  flowLph: number;
  tempC: number;
  composition: FluidComposition;
}

export interface BalanceTankInputs {
  inflows: InflowStream[];
  requestedOutflowLph: number;
}

export interface BalanceTankOutputs {
  volumeL: number;
  levelPct: number;
  temperatureC: number;
  composition: FluidComposition;
  actualOutflowLph: number;
  overflowLph: number;
  overflowTotalL: number;
  productOverflowTotalL: number;
  ls1: boolean;
  ls2: boolean;
  airEntrainmentFrac: number;
  alarms: string[];
}

export function extractNumeric(param: NumericParameter<number> | number | undefined, fallback: number): number {
  if (param === undefined) return fallback;
  if (typeof param === 'number') return param;
  return param.value;
}

export const DEFAULT_BALANCE_TANK_CONFIG: BalanceTankConfig = {
  id: 'TK-BALANCE',
  tag: 'TK_BAL',
  capacityL: { value: 600, source: 'placeholder' },
  geometry: [
    { volumeL: 0, heightMm: 0 },
    { volumeL: 600, heightMm: 800 },
  ],
  ambientTempC: { value: 25, source: 'placeholder' },
  heatLossUaWPerK: { value: 5, source: 'placeholder' },
  outletSubmergencePct: { value: 5, source: 'placeholder' },
  ls1: {
    tripPct: { value: 15, source: 'placeholder' },
    resetPct: { value: 20, source: 'placeholder' },
    type: 'low',
  },
  ls2: {
    tripPct: { value: 95, source: 'placeholder' },
    resetPct: { value: 90, source: 'placeholder' },
    type: 'high',
  },
  initialLevelPct: { value: 75, source: 'placeholder' },
  initialTempC: { value: 4.0, source: 'placeholder' },
  initialComposition: RAW_MILK_COMPOSITION,
};
