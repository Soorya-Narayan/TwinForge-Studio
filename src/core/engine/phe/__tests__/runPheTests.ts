/**
 * TwinForge Studio - Comprehensive PHE Model Acceptance Tests
 * Validates thermodynamic accuracy, dynamic response, numerical stability, and regulatory compliance.
 */

import { PHEAssemblyModel } from '../PHEAssemblyModel';

declare const process: any;

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details: string) {
  results.push({
    name,
    passed: condition,
    details: condition ? `PASSED: ${details}` : `FAILED: ${details}`,
  });
}

console.log('====================================================');
console.log('Running Plate Heat Exchanger Physical Model Acceptance Tests');
console.log('====================================================\n');

// ------------------------------------------------------------------------------------------------
// TEST 1: Steady State at 10,000 L/h, 4°C raw milk, 95°C hot water supply
// ------------------------------------------------------------------------------------------------
{
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

  assert(
    heaterOutlet >= 86.0 && heaterOutlet <= 94.0,
    'Test 1.1: Pasteurization Temperature Reached',
    `Heater cold outlet = ${heaterOutlet}°C (expected 86-94°C)`
  );

  assert(
    holdingTubeTT5 >= 86.0 && holdingTubeTT5 <= 94.0,
    'Test 1.2: Holding Tube Exit Temp TT5 In Legal Zone',
    `TT5 = ${holdingTubeTT5}°C`
  );

  assert(
    regenEff >= 82.0 && regenEff <= 96.0,
    'Test 1.3: High-Performance Thermal Regeneration Efficiency',
    `Regeneration efficiency = ${regenEff}% (expected 82-96%)`
  );

  assert(
    productOut >= 3.0 && productOut <= 5.5,
    'Test 1.4: Finished Product Chilled to ~4°C',
    `Product outlet = ${productOut}°C (expected 3.0-5.5°C)`
  );

  assert(
    energyErr <= 1.5,
    'Test 1.5: Steady-State Energy Balance Conservation',
    `Heating energy error = ${energyErr}% (expected < 1.5%)`
  );
}

// ------------------------------------------------------------------------------------------------
// TEST 2: Step Change - Cut Hot Water Supply (Transients & Diversion Trip)
// ------------------------------------------------------------------------------------------------
{
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

  assert(
    initialTT5 >= 88.0 && finalTT5 < 78.0,
    'Test 2: Loss of Hot Water Drops TT5 Below Setpoint with Realistic Lag',
    `Initial TT5 = ${initialTT5}°C, dropped to ${finalTT5}°C over 65s`
  );
}

// ------------------------------------------------------------------------------------------------
// TEST 3: Zero Flow Edge Case (Feed Pump Stop -> No NaN, Finite Numbers)
// ------------------------------------------------------------------------------------------------
{
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

  assert(
    !hasNaN && phe.getOverallMetrics().holdingTubeResidenceTimeS === 0,
    'Test 3: Zero Flow Robustness (No NaN, Finite Valid Stagnant Time)',
    `Residence time = ${phe.getOverallMetrics().holdingTubeResidenceTimeS}s, NaN detected: ${hasNaN}`
  );
}

// ------------------------------------------------------------------------------------------------
// TEST 4: Doubled Flow Lowers Residence Time, Fouling Lowers U
// ------------------------------------------------------------------------------------------------
{
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

  assert(
    Math.abs(doubledResTime - normalResTime / 2) < 0.2,
    'Test 4.1: Flow Rate Scales Holding Tube Residence Time Inversely',
    `Normal = ${normalResTime}s, Doubled = ${doubledResTime}s`
  );

  assert(
    fouledU < cleanU * 0.7,
    'Test 4.2: Fouling Resistance Degrades Overall Heat Transfer Coefficient U',
    `Clean U = ${cleanU} W/m²K, Fouled U = ${fouledU} W/m²K`
  );
}

// ------------------------------------------------------------------------------------------------
// TEST 5: Plate Leak Pressure Differential & Contamination Interlock
// ------------------------------------------------------------------------------------------------
{
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

  // Case B: Booster pump tripped / raw pressure exceeds pasteurized (PT2 > PT4)
  // Simulate by setting isForwardFlow = false so PT4 drops to suction pressure
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

  assert(
    !safeAlarm && safeLeakRate > 0,
    'Test 5.1: Plate Leak With PT4 > PT2 Produces No Contamination Alarm',
    `Leak flow = ${safeLeakRate} L/min, Contamination alarm: ${safeAlarm}`
  );

  assert(
    hazardAlarm,
    'Test 5.2: Plate Leak With PT2 > PT4 Triggers Immediate Contamination Hazard Alarm',
    `Contamination alarm: ${hazardAlarm} (PT2=${hazardLeak.overall.rawPressurePT2Bar}b > PT4=${hazardLeak.overall.pasteurizedPressurePT4Bar}b)`
  );
}

// ------------------------------------------------------------------------------------------------
// TEST 6: Stability & Accuracy Across Simulation Speed Multipliers (1x vs 10x)
// ------------------------------------------------------------------------------------------------
{
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

  assert(
    tempDiff < 0.6 && !isNaN(temp10x),
    'Test 6: 10x Speed Multiplier Preserves Numerical Stability and Conservation',
    `1x Temp = ${temp1x}°C, 10x Temp = ${temp10x}°C, Difference = ${tempDiff.toFixed(2)}°C`
  );
}

console.log('\n====================================================');
console.log('ACCEPTANCE TEST SUMMARY:');
console.log('====================================================');
let allPassed = true;
for (const r of results) {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.name}`);
  console.log(`       ${r.details}`);
  if (!r.passed) allPassed = false;
}
console.log('====================================================');
if (allPassed) {
  console.log('ALL 6 ACCEPTANCE TESTS PASSED SUCCESSFULLY! (100% COMPLIANT)');
  process.exit(0);
} else {
  console.error('SOME ACCEPTANCE TESTS FAILED!');
  process.exit(1);
}
