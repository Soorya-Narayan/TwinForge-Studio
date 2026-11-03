/**
 * TwinForge Studio - Time-Based Automated FAT Test Scenarios
 * 
 * Steps the engine and PLC across N scans, recording full scan-by-scan history,
 * and asserting on dynamic temporal behavior: response times, divert timing,
 * trip latencies, and valve travel transit durations.
 *
 * Modularized per skid into dedicated scenario files:
 * - batchMixingScenarios.ts (TC-01..TC-07)
 * - pasteurizerScenarios.ts (TC-P01..TC-P07)
 */

import type { TestCase } from './types';
import type { SkidId } from '../../store/useSimulationStore';
import { batchMixingFatScenarios } from './scenarios/batchMixingScenarios';
import { pasteurizerFatScenarios } from './scenarios/pasteurizerScenarios';

export { batchMixingFatScenarios, pasteurizerFatScenarios };
export const fatScenarios = batchMixingFatScenarios;

export const getFatScenarios = (skid: SkidId): TestCase[] => {
  if (skid === 'PASTEURIZER_10KLPH') {
    return pasteurizerFatScenarios;
  }
  return fatScenarios;
};
