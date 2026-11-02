/**
 * TwinForge Studio - FAT Test Engine Types & Time-Based Scenarios
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

export interface ScanHistoryRecord {
  step: number;
  scan: number;
  timeMs: number;
  inputs: Record<string, boolean | number>;
  outputs: Record<string, boolean | number>;
  plcState?: string;
  interlocks?: Record<string, { isOk: boolean; tripped: boolean }>;
  snapshot?: any;
}

export interface TestAssertion {
  tag: string;
  expected: boolean | number | string;
  actual?: boolean | number | string;
  passed?: boolean;
  message: string;
  responseTimeMs?: number;
  timingLimitMs?: number;
}

export interface TestCase {
  id: string;
  phase: TestPhase;
  title: string;
  clause: string;
  description: string;
  durationScans?: number; // Number of simulation scans to step (e.g. 25 = 2.5s)
  dtMs?: number;          // Time delta per scan in ms (default 100ms)
  faults?: DeviceFault[];
  setup?: (sim: any, plc: any) => void;
  stimulus: (sim: any, plc: any, step: number, history: ScanHistoryRecord[]) => void;
  assertions: (sim: any, plc: any, history: ScanHistoryRecord[]) => TestAssertion[];
  teardown?: (sim: any, plc: any) => void;
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
  scansExecuted?: number;
}
