/**
 * TwinForge Studio - Comprehensive PHE Model Acceptance Tests (Vitest)
 * Validates thermodynamic accuracy, dynamic response, numerical stability, and regulatory compliance.
 */

import { describe, it, expect } from 'vitest';
import { PHEAssemblyModel } from '../PHEAssemblyModel';

describe('Plate Heat Exchanger Physical Model Acceptance Tests', () => {
  it('Test 1: Steady State at 10,000 L/h, 4°C raw milk, 95°C hot water supply', () => {
    const phe = new PHEAssemblyModel();

    // Simulate 200 seconds of operation to reach full thermal steady-state at 100ms ticks
    let snap;
    for (let t = 0; t < 2000; t++) {
      snap = phe.step(0.1, {
        feedFlowRateLph: 10000,
        rawMilkTempC: 4.0,
        hotWaterFlowRateLph: 12000,
        hotWaterSupplyTempC: 95.0,
        chilledWaterFlowRateLph: 12000,
        chilledWaterSupplyTempC: 1.5,
        isForwardFlow: true,
      });
    }

    const heaterOutlet = snap!.heating.tempColdOutC;
    const holdingTubeTT5 = snap!.overall.holdingTubeExitTempC;
    const regenEff = snap!.overall.regenerationEfficiencyPct;
    const productOut = snap!.chilling.tempHotOutC;
    const energyErr = snap!.heating.energyBalanceErrorPct;

    // Test 1.1: Pasteurization Temperature Reached (86-94°C)
    expect(heaterOutlet).toBeGreaterThanOrEqual(86.0);
    expect(heaterOutlet).toBeLessThanOrEqual(94.0);

    // Test 1.2: Holding Tube Exit Temp TT5 In Legal Zone (86-94°C)
    expect(holdingTubeTT5).toBeGreaterThanOrEqual(86.0);
    expect(holdingTubeTT5).toBeLessThanOrEqual(94.0);

    // Test 1.3: High-Performance Thermal Regeneration Efficiency (82-96%)
    expect(regenEff).toBeGreaterThanOrEqual(82.0);
    expect(regenEff).toBeLessThanOrEqual(96.0);

    // Test 1.4: Finished Product Chilled to ~4°C (3.0-5.5°C)
    expect(productOut).toBeGreaterThanOrEqual(3.0);
    expect(productOut).toBeLessThanOrEqual(5.5);

    // Test 1.5: Steady-State Energy Balance Conservation (< 1.5%)
    expect(energyErr).toBeLessThanOrEqual(1.5);
  });

  it('Test 2: Step Change - Cut Hot Water Supply (Transients & Diversion Trip)', () => {
    const phe = new PHEAssemblyModel();

    // 1. Bring to steady state first (200s)
    for (let t = 0; t < 2000; t++) {
      phe.step(0.1, {
        feedFlowRateLph: 10000,
        rawMilkTempC: 4.0,
        hotWaterFlowRateLph: 12000,
        hotWaterSupplyTempC: 95.0,
        chilledWaterFlowRateLph: 12000,
        chilledWaterSupplyTempC: 1.5,
        isForwardFlow: true,
      });
    }
    const initialTT5 = phe.getOverallMetrics().holdingTubeExitTempC;

    // 2. Cut hot water (loss of heating utility: supply drops to 25°C)
    for (let t = 0; t < 650; t++) {
      phe.step(0.1, {
        feedFlowRateLph: 10000,
        rawMilkTempC: 4.0,
        hotWaterFlowRateLph: 0,
        hotWaterSupplyTempC: 25.0, // Hot water pump stopped
        chilledWaterFlowRateLph: 12000,
        chilledWaterSupplyTempC: 1.5,
        isForwardFlow: phe.getOverallMetrics().holdingTubeExitTempC >= 88.0,
        lossOfHotWater: true,
      });
    }
    const finalTT5 = phe.getOverallMetrics().holdingTubeExitTempC;

    expect(initialTT5).toBeGreaterThanOrEqual(88.0);
    expect(finalTT5).toBeLessThan(78.0);
  });

  it('Test 3: Zero Flow Edge Case (Feed Pump Stop -> No NaN, Finite Numbers)', () => {
    const phe = new PHEAssemblyModel();

    // Run 100 steps with 0 flow
    let hasNaN = false;
    for (let t = 0; t < 100; t++) {
      const s = phe.step(0.1, {
        feedFlowRateLph: 0,
        rawMilkTempC: 4.0,
        hotWaterFlowRateLph: 0,
        hotWaterSupplyTempC: 95.0,
        chilledWaterFlowRateLph: 0,
        chilledWaterSupplyTempC: 1.5,
        isForwardFlow: false,
      });
      if (
        isNaN(s.overall.holdingTubeExitTempC) ||
        isNaN(s.heating.uValue_W_per_m2_K) ||
        isNaN(s.heating.dutyAverageKW) ||
        !isFinite(s.overall.holdingTubeResidenceTimeS)
      ) {
        hasNaN = true;
        break;
      }
    }

    expect(hasNaN).toBe(false);
    expect(phe.getOverallMetrics().holdingTubeResidenceTimeS).toBe(0);
  });

  it('Test 4: Doubled Flow Lowers Residence Time, Fouling Lowers U', () => {
    const phe = new PHEAssemblyModel();

    // Normal flow 10,000 L/h
    phe.step(0.1, {
      feedFlowRateLph: 10000,
      rawMilkTempC: 4.0,
      hotWaterFlowRateLph: 12000,
      hotWaterSupplyTempC: 95.0,
      chilledWaterFlowRateLph: 12000,
      chilledWaterSupplyTempC: 1.5,
      isForwardFlow: true,
    });
    const normalResTime = phe.getOverallMetrics().holdingTubeResidenceTimeS;

    // Double flow 20,000 L/h
    phe.step(0.1, {
      feedFlowRateLph: 20000,
      rawMilkTempC: 4.0,
      hotWaterFlowRateLph: 12000,
      hotWaterSupplyTempC: 95.0,
      chilledWaterFlowRateLph: 12000,
      chilledWaterSupplyTempC: 1.5,
      isForwardFlow: true,
    });
    const doubledResTime = phe.getOverallMetrics().holdingTubeResidenceTimeS;

    // Clean U vs Fouled U
    const cleanU = phe.heating.getMetrics().uValue_W_per_m2_K;
    phe.heating.foulingResistance = 0.0005; // Inject heavy fouling resistance
    phe.step(0.1, {
      feedFlowRateLph: 10000,
      rawMilkTempC: 4.0,
      hotWaterFlowRateLph: 12000,
      hotWaterSupplyTempC: 95.0,
      chilledWaterFlowRateLph: 12000,
      chilledWaterSupplyTempC: 1.5,
      isForwardFlow: true,
    });
    const fouledU = phe.heating.getMetrics().uValue_W_per_m2_K;

    expect(Math.abs(doubledResTime - normalResTime / 2)).toBeLessThan(0.2);
    expect(fouledU).toBeLessThan(cleanU * 0.7);
  });

  it('Test 5: Plate Leak Pressure Differential & Contamination Interlock', () => {
    const phe = new PHEAssemblyModel();

    // Case A: Leak active with PT4 > PT2 (Pasteurized > Raw -> Safe Direction)
    const safeLeak = phe.step(0.1, {
      feedFlowRateLph: 10000,
      rawMilkTempC: 4.0,
      hotWaterFlowRateLph: 12000,
      hotWaterSupplyTempC: 95.0,
      chilledWaterFlowRateLph: 12000,
      chilledWaterSupplyTempC: 1.5,
      isForwardFlow: true,
      plateLeakSizePct: 50,
    });

    const safeAlarm = safeLeak.overall.contaminationAlarm;
    const safeLeakRate = safeLeak.overall.plateLeakFlowRateLpm;

    expect(safeAlarm).toBe(false);
    expect(safeLeakRate).toBeGreaterThan(0);

    // Case B: Booster pump tripped / raw pressure exceeds pasteurized (PT2 > PT4)
    const hazardLeak = phe.step(0.1, {
      feedFlowRateLph: 10000,
      rawMilkTempC: 4.0,
      hotWaterFlowRateLph: 12000,
      hotWaterSupplyTempC: 95.0,
      chilledWaterFlowRateLph: 12000,
      chilledWaterSupplyTempC: 1.5,
      isForwardFlow: false, // Forward booster tripped, PT4 < PT2
      plateLeakSizePct: 50,
    });

    const hazardAlarm = hazardLeak.overall.contaminationAlarm;
    expect(hazardAlarm).toBe(true);
  });

  it('Test 6: Stability & Accuracy Across Simulation Speed Multipliers (1x vs 10x)', () => {
    // Run A: 10 seconds at 1x speed (dt = 0.1s, 100 steps)
    const phe1x = new PHEAssemblyModel();
    let snap1x;
    for (let i = 0; i < 100; i++) {
      snap1x = phe1x.step(0.1, {
        feedFlowRateLph: 10000,
        rawMilkTempC: 4.0,
        hotWaterFlowRateLph: 12000,
        hotWaterSupplyTempC: 95.0,
        chilledWaterFlowRateLph: 12000,
        chilledWaterSupplyTempC: 1.5,
        isForwardFlow: true,
      });
    }

    // Run B: 10 seconds at 10x speed (dt = 1.0s, 10 steps)
    const phe10x = new PHEAssemblyModel();
    let snap10x;
    for (let i = 0; i < 10; i++) {
      snap10x = phe10x.step(1.0, {
        feedFlowRateLph: 10000,
        rawMilkTempC: 4.0,
        hotWaterFlowRateLph: 12000,
        hotWaterSupplyTempC: 95.0,
        chilledWaterFlowRateLph: 12000,
        chilledWaterSupplyTempC: 1.5,
        isForwardFlow: true,
      });
    }

    const temp1x = snap1x!.heating.tempColdOutC;
    const temp10x = snap10x!.heating.tempColdOutC;
    const tempDiff = Math.abs(temp1x - temp10x);

    expect(tempDiff).toBeLessThan(0.6);
    expect(isNaN(temp10x)).toBe(false);
  });
});
