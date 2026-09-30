/**
 * TwinForge Studio - FAT Test Engine Types & Scenarios
 */

import type { DeviceFault } from '../engine/types';

export type TestPhase = 
  | 'P1_STOPPED_CONDITION'
  | 'P2_PERMISSIVES'
  | 'P3_INTERLOCK_VERIFICATION'
  | 'P4_RECIPE_DOSING'
  | 'P5_THERMAL_CYCLE'
  | 'P6_DISCHARGE'
  | 'P7_ABORT_SAFETY';

export interface TestAssertion {
  tag: string;
  expected: boolean | number | string;
  actual?: boolean | number | string;
  passed?: boolean;
  message: string;
}

export interface TestCase {
  id: string;
  phase: TestPhase;
  title: string;
  clause: string;
  description: string;
  faults?: DeviceFault[];
  stimulus: (sim: any, plc: any) => void;
  assertions: (sim: any, plc: any) => TestAssertion[];
}

export interface TestResult {
  testId: string;
  phase: TestPhase;
  title: string;
  clause: string;
  passed: boolean;
  assertions: TestAssertion[];
  timestamp: string;
  durationMs: number;
}
