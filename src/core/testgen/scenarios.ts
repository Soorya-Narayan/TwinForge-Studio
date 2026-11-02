/**
 * TwinForge Studio - Time-Based Automated FAT Test Scenarios
 * 
 * Steps the engine and PLC across N scans, recording full scan-by-scan history,
 * and asserting on dynamic temporal behavior: response times, divert timing,
 * trip latencies, and valve travel transit durations.
 */

import type { TestCase } from './types';
import type { SkidId } from '../../store/useSimulationStore';

export const fatScenarios: TestCase[] = [
  {
    id: 'TC-01',
    phase: 'P1_STOPPED_CONDITION',
    title: 'Stopped Condition Baseline Check',
    clause: 'FDS-01.1',
    description: 'Step engine for 10 scans in IDLE state. Verify all motive equipment and valves remain de-energized continuously.',
    durationScans: 10,
    dtMs: 100,
    setup: (_sim, plc) => {
      plc.resetBatch();
    },
    stimulus: (_sim, _plc, _step, _history) => {
      // Passive baseline
    },
    assertions: (_sim, plc, history) => {
      const allIdle = history.every((h) => h.plcState === 'IDLE');
      const allPumpsOff = history.every((h) => !h.outputs['P100_START']);
      const allValvesClosed = history.every((h) => !h.outputs['V101_CMD'] && !h.outputs['V102_CMD']);

      return [
        {
          tag: 'PLC_STATE_STABILITY',
          expected: 'IDLE (10 scans)',
          actual: allIdle ? 'IDLE (10 scans)' : `${plc.state}`,
          passed: allIdle,
          message: 'PLC batch state machine held IDLE across all 10 baseline scans',
        },
        {
          tag: 'P100_START_CONTINUOUS_OFF',
          expected: false,
          actual: !allPumpsOff,
          passed: allPumpsOff,
          message: 'P-100 command remained continuously OFF across full baseline history',
        },
        {
          tag: 'VALVES_SEATED_CLOSED',
          expected: 'ALL CLOSED (10 scans)',
          actual: allValvesClosed ? 'ALL CLOSED (10 scans)' : 'VALVES OPENED',
          passed: allValvesClosed,
          message: 'All dosing valves maintained fail-safe seated posture across baseline',
        },
      ];
    },
  },
  {
    id: 'TC-02',
    phase: 'P2_PERMISSIVES',
    title: 'Process Permissives & Level Telemetry Stability',
    clause: 'FDS-02.4',
    description: 'Step engine for 15 scans. Verify source tank inventory is stably maintained above the 50% start permissive.',
    durationScans: 15,
    dtMs: 100,
    stimulus: (_sim, _plc, _step, _history) => {
      // Normal permissive monitoring
    },
    assertions: (_sim, _plc, history) => {
      const minLevel = Math.min(...history.map((h) => Number(h.inputs['TK100_LT'] ?? 0)));
      const il02HealthyThroughout = history.every((h) => h.interlocks?.['IL-02']?.isOk !== false);

      return [
        {
          tag: 'TK100_LT_MIN',
          expected: '>= 50%',
          actual: `${minLevel.toFixed(1)}%`,
          passed: minLevel >= 50,
          message: 'Supply Tank TK-100 raw material inventory remained >= 50% across 15 scans',
        },
        {
          tag: 'IL-02_PERMISSIVE_HISTORY',
          expected: 'HEALTHY (15 scans)',
          actual: il02HealthyThroughout ? 'HEALTHY (15 scans)' : 'PERMISSIVE TRIPPED',
          passed: il02HealthyThroughout,
          message: 'IL-02 Low Level permissive held stable and healthy throughout test history',
        },
      ];
    },
  },
  {
    id: 'TC-03',
    phase: 'P3_INTERLOCK_VERIFICATION',
    title: 'IL-01 Suction Interlock Trip Latency with Stuck Valve',
    clause: 'FDS-03.2 (Safety)',
    description: 'At scan 3, inject V-101 stuck-closed fault and issue pump start. Assert IL-01 trips and de-energizes P-100 within <= 200ms.',
    durationScans: 25,
    dtMs: 100,
    faults: [{ deviceId: 'V-101', mode: 'stuck_closed' }],
    setup: (sim, plc) => {
      sim.clearAllFaults();
      plc.resetBatch();
    },
    stimulus: (sim, plc, step, _history) => {
      if (step === 3) {
        sim.setFault({ deviceId: 'V-101', mode: 'stuck_closed' });
        plc.outputs['V101_CMD'] = true;
        plc.outputs['P100_START'] = true;
      }
    },
    assertions: (_sim, _plc, history) => {
      const faultStep = 3;
      // Find when IL-01 tripped
      const tripStepIndex = history.findIndex((h, idx) => idx >= faultStep && h.interlocks?.['IL-01']?.tripped);
      const tripLatencyMs = tripStepIndex >= 0 ? (tripStepIndex - faultStep) * 100 : 9999;

      // Find when pump de-energized after fault
      const pumpDropIndex = history.findIndex((h, idx) => idx >= faultStep && !h.outputs['P100_START']);
      const pumpDropLatencyMs = pumpDropIndex >= 0 ? (pumpDropIndex - faultStep) * 100 : 9999;

      return [
        {
          tag: 'V101_ZSO_FAULT',
          expected: false,
          actual: Boolean(history[history.length - 1].inputs['V101_ZSO']),
          passed: !history[history.length - 1].inputs['V101_ZSO'],
          message: 'Suction valve V-101 open feedback withheld by stuck-closed physical fault',
        },
        {
          tag: 'IL-01_TRIP_LATENCY',
          expected: '<= 200 ms',
          actual: `${tripLatencyMs} ms`,
          passed: tripLatencyMs <= 200,
          responseTimeMs: tripLatencyMs,
          timingLimitMs: 200,
          message: `IL-01 Suction Safety Interlock tripped within ${tripLatencyMs} ms of fault injection (limit: <= 200 ms)`,
        },
        {
          tag: 'P100_DE_ENERGIZED_TIME',
          expected: '<= 200 ms',
          actual: `${pumpDropLatencyMs} ms`,
          passed: pumpDropLatencyMs <= 200,
          responseTimeMs: pumpDropLatencyMs,
          timingLimitMs: 200,
          message: `Transfer pump P-100 command de-energized within ${pumpDropLatencyMs} ms (limit: <= 200 ms)`,
        },
      ];
    },
  },
  {
    id: 'TC-04',
    phase: 'P4_RECIPE_DOSING',
    title: 'Automated Recipe Dosing & Valve Travel Transit Time',
    clause: 'FDS-04.1',
    description: 'Start AUTO batch at scan 0. Step for 35 scans. Measure V-101 pneumatic travel stroke time until fully proved open (target: 1400ms ± 300ms).',
    durationScans: 35,
    dtMs: 100,
    setup: (sim, plc) => {
      sim.clearAllFaults();
      plc.resetBatch();
    },
    stimulus: (_sim, plc, step, _history) => {
      if (step === 0) {
        plc.startBatch();
      }
    },
    assertions: (_sim, _plc, history) => {
      // Find scan where V-101 proved OPEN
      const proveStepIndex = history.findIndex((h) => Boolean(h.inputs['V101_ZSO']));
      const strokeTimeMs = proveStepIndex >= 0 ? proveStepIndex * 100 : 9999;
      const strokeWithinTolerance = Math.abs(strokeTimeMs - 1400) <= 300;

      // Check fluid flow established after stroke
      const finalFlow = history[history.length - 1].snapshot?.paths?.find((p: any) => p.id === 'PIPE-02')?.flowLpm ?? 0;

      return [
        {
          tag: 'V101_TRAVEL_TIME',
          expected: '1400 ms ± 300 ms',
          actual: `${strokeTimeMs} ms`,
          passed: strokeWithinTolerance,
          responseTimeMs: strokeTimeMs,
          timingLimitMs: 1700,
          message: `V-101 actuator travel transit duration measured at ${strokeTimeMs} ms (target 1400 ± 300 ms)`,
        },
        {
          tag: 'POST_STROKE_PUMP_RUN',
          expected: true,
          actual: Boolean(history[history.length - 1].outputs['P100_START']),
          passed: Boolean(history[history.length - 1].outputs['P100_START']),
          message: 'P-100 commanded ON after V-101 confirmed fully open',
        },
        {
          tag: 'HEADER_FLOW_RATE',
          expected: '> 100 L/min',
          actual: `${finalFlow} L/min`,
          passed: finalFlow > 100,
          message: 'Hydraulic velocity established in header following valve travel proof',
        },
      ];
    },
  },
  {
    id: 'TC-05',
    phase: 'P5_THERMAL_CYCLE',
    title: 'Thermal Exchange Response & Temperature Slew Rate',
    clause: 'FDS-05.3',
    description: 'Step 40 scans with heating steam valve commanded 90%. Assert positive temperature rise rate and thermal interlock IL-04 stability.',
    durationScans: 40,
    dtMs: 100,
    setup: (sim, plc) => {
      sim.clearAllFaults();
      plc.mode = 'MANUAL';
      plc.outputs['V101_CMD'] = true;
      plc.outputs['V102_CMD'] = true;
    },
    stimulus: (_sim, plc, step, _history) => {
      plc.outputs['V101_CMD'] = true;
      plc.outputs['V102_CMD'] = true;
      if (step >= 15) {
        plc.outputs['P100_START'] = true;
        plc.outputs['TCV100_CMD'] = 90;
      }
    },
    assertions: (_sim, _plc, history) => {
      const initialTemp = Number(history[0].inputs['HX100_TT'] ?? 20);
      const finalTemp = Number(history[history.length - 1].inputs['HX100_TT'] ?? 20);
      const tempRise = finalTemp - initialTemp;
      const durationSec = (history.length * 100) / 1000;
      const slewRateDegPerSec = tempRise / durationSec;
      const il04Ok = history.every((h) => h.interlocks?.['IL-04']?.isOk !== false);

      return [
        {
          tag: 'HX100_TT_FINAL',
          expected: '> 40°C',
          actual: `${finalTemp.toFixed(1)}°C`,
          passed: finalTemp > 40,
          message: `Product stream heated to ${finalTemp.toFixed(1)}°C over 40 scans (initial: ${initialTemp.toFixed(1)}°C)`,
        },
        {
          tag: 'THERMAL_SLEW_RATE',
          expected: '> 0.50 °C/s',
          actual: `+${slewRateDegPerSec.toFixed(2)} °C/s`,
          passed: slewRateDegPerSec > 0.5,
          message: `Thermal rise slew rate confirmed at +${slewRateDegPerSec.toFixed(2)} °C/sec`,
        },
        {
          tag: 'IL-04_THERMAL_SAFETY',
          expected: 'HEALTHY (40 scans)',
          actual: il04Ok ? 'HEALTHY (40 scans)' : 'TRIPPED',
          passed: il04Ok,
          message: 'Thermal limit safety interlock IL-04 maintained in healthy zone throughout heating cycle',
        },
      ];
    },
  },
  {
    id: 'TC-06',
    phase: 'P6_DISCHARGE',
    title: 'Mixing Tank Discharge Valve V-400 Stroke Timing',
    clause: 'FDS-06.2',
    description: 'Command product discharge valve V-400 open at scan 0. Step for 25 scans and verify open proof timing (target: <= 2500ms).',
    durationScans: 25,
    dtMs: 100,
    setup: (_sim, plc) => {
      plc.mode = 'MANUAL';
    },
    stimulus: (_sim, plc, step, _history) => {
      if (step === 0) {
        plc.outputs['V400_PROD_CMD'] = true;
      }
    },
    assertions: (_sim, _plc, history) => {
      const openStepIndex = history.findIndex((h) => Boolean(h.inputs['V400_PROD_ZSO']));
      const strokeTimeMs = openStepIndex >= 0 ? openStepIndex * 100 : 9999;

      return [
        {
          tag: 'V400_PROD_STROKE_TIME',
          expected: '<= 2500 ms',
          actual: `${strokeTimeMs} ms`,
          passed: strokeTimeMs <= 2500,
          responseTimeMs: strokeTimeMs,
          timingLimitMs: 2500,
          message: `Discharge valve V-400 open proof proved at ${strokeTimeMs} ms (limit: <= 2500 ms)`,
        },
      ];
    },
  },
  {
    id: 'TC-07',
    phase: 'P7_ABORT_SAFETY',
    title: 'Emergency Stop De-energization Latency',
    clause: 'FDS-08.1 (E-Stop)',
    description: 'At scan 4, trigger Emergency Stop. Assert all outputs de-energize on the immediate following scan (latency <= 100ms).',
    durationScans: 20,
    dtMs: 100,
    setup: (_sim, plc) => {
      plc.outputs['P100_START'] = true;
      plc.outputs['V101_CMD'] = true;
      plc.outputs['V400_PROD_CMD'] = true;
    },
    stimulus: (_sim, plc, step, _history) => {
      if (step === 4) {
        plc.abortBatch();
      }
    },
    assertions: (_sim, _plc, history) => {
      const estopStep = 4;
      const allZeroStep = history.findIndex(
        (h, idx) => idx >= estopStep && !h.outputs['P100_START'] && !h.outputs['V101_CMD'] && !h.outputs['V400_PROD_CMD']
      );
      const latencyMs = allZeroStep >= 0 ? (allZeroStep - estopStep) * 100 : 9999;

      return [
        {
          tag: 'PLC_STATE',
          expected: 'ABORTED',
          actual: history[history.length - 1].plcState,
          passed: history[history.length - 1].plcState === 'ABORTED',
          message: 'PLC entered ABORTED state following E-Stop trigger',
        },
        {
          tag: 'ESTOP_DE_ENERGIZATION_LATENCY',
          expected: '<= 100 ms (1 scan)',
          actual: `${latencyMs} ms`,
          passed: latencyMs <= 100,
          responseTimeMs: latencyMs,
          timingLimitMs: 100,
          message: `All contactor and valve outputs de-energized within ${latencyMs} ms (limit: <= 100 ms)`,
        },
      ];
    },
  },
];

export const pasteurizerFatScenarios: TestCase[] = [
  {
    id: 'TC-P01',
    phase: 'P1_STOPPED_CONDITION',
    title: 'Stopped Condition Baseline & Fail-Safe Audit',
    clause: 'FDS-PAST-01.1',
    description: 'Step pasteurizer for 10 scans in STOPPED state. Verify pumps, booster, and forward diversion valves remain locked.',
    durationScans: 10,
    dtMs: 100,
    setup: (sim, plc) => {
      sim.clearAllFaults();
      plc.resetSystem();
    },
    stimulus: (_sim, _plc, _step, _history) => {
      // Stopped baseline
    },
    assertions: (_sim, _plc, history) => {
      const allStopped = history.every((h) => h.plcState === 'STOPPED');
      const feedOff = history.every((h) => !h.outputs['P_FEED_CMD'] && !h.outputs['P_FEED_START']);
      const boosterOff = history.every((h) => !h.outputs['P_BOOSTER_CMD'] && !h.outputs['P_BOOST_START']);
      const forwardClosed = history.every((h) => !h.outputs['PV11_CMD']);

      return [
        {
          tag: 'PLC_STATE_STABILITY',
          expected: 'STOPPED (10 scans)',
          actual: allStopped ? 'STOPPED (10 scans)' : 'NOT STOPPED',
          passed: allStopped,
          message: 'Pasteurizer controller safely maintained STOPPED across all 10 scans',
        },
        {
          tag: 'P_FEED_CONTINUOUS_OFF',
          expected: false,
          actual: !feedOff,
          passed: feedOff,
          message: 'Raw milk feed pump P-FEED de-energized across full baseline',
        },
        {
          tag: 'P_BOOSTER_CONTINUOUS_OFF',
          expected: false,
          actual: !boosterOff,
          passed: boosterOff,
          message: 'Booster pump P-BOOSTER de-energized across full baseline',
        },
        {
          tag: 'PV11_FORWARD_FAIL_SAFE',
          expected: false,
          actual: !forwardClosed,
          passed: forwardClosed,
          message: 'Forward flow valve PV11 held in fail-safe closed posture',
        },
      ];
    },
  },
  {
    id: 'TC-P02',
    phase: 'P2_PERMISSIVES',
    title: 'Raw Milk Permissives & Balance Tank Inventory Stability',
    clause: 'FDS-PAST-02.3',
    description: 'Step for 15 scans. Assert Balance Tank level LT1 > 15% satisfies cavitation prevention permissive IL-BAL-LOW.',
    durationScans: 15,
    dtMs: 100,
    stimulus: (_sim, _plc, _step, _history) => {
      // Permissive monitoring
    },
    assertions: (_sim, _plc, history) => {
      const minLevel = Math.min(...history.map((h) => Number(h.inputs['LT1'] ?? h.inputs['LT_BALANCE'] ?? 75)));
      const ilBalLowOk = history.every((h) => h.interlocks?.['IL-BAL-LOW']?.isOk !== false);

      return [
        {
          tag: 'BALANCE_TANK_LT_MIN',
          expected: '>= 15%',
          actual: `${minLevel.toFixed(1)}%`,
          passed: minLevel >= 15,
          message: 'Balance Tank volume verified continuously above minimum pump priming threshold',
        },
        {
          tag: 'IL-BAL-LOW_PERMISSIVE',
          expected: 'HEALTHY (15 scans)',
          actual: ilBalLowOk ? 'HEALTHY (15 scans)' : 'TRIPPED',
          passed: ilBalLowOk,
          message: 'Low level lockout IL-BAL-LOW proved healthy across all 15 scans',
        },
      ];
    },
  },
  {
    id: 'TC-P03',
    phase: 'P3_INTERLOCK_VERIFICATION',
    title: 'Legal Flow Diversion Lockout (IL-FDV Under-Temp Response)',
    clause: 'PMO Item 16p / 3-A Standards',
    description: 'At scan 0, command start while cold (< 88°C). Step for 20 scans. Assert PV11 remains strictly locked closed and PV12 diverts.',
    durationScans: 20,
    dtMs: 100,
    setup: (_sim, plc) => {
      plc.startProduction();
    },
    stimulus: (_sim, _plc, _step, _history) => {
      // Warm up phase with cold product
    },
    assertions: (_sim, _plc, history) => {
      const pv11AlwaysClosed = history.every((h) => !h.outputs['PV11_CMD']);
      const pv12AlwaysOpen = history.every((h) => Boolean(h.outputs['PV12_CMD']));
      const ilFdvUnproved = history.every((h) => h.interlocks?.['IL-FDV']?.isOk === false);

      return [
        {
          tag: 'IL-FDV_UNPROVED_HISTORY',
          expected: 'UNPROVED (< 88°C)',
          actual: ilFdvUnproved ? 'UNPROVED (< 88°C)' : 'PREMATURELY PROVED',
          passed: ilFdvUnproved,
          message: 'Legal diversion interlock IL-FDV correctly unproved while holding tube temperature is sub-pasteurizing',
        },
        {
          tag: 'PV11_FORWARD_LOCKED',
          expected: 'CLOSED (20 scans)',
          actual: pv11AlwaysClosed ? 'CLOSED (20 scans)' : 'OPENED ILLEGALLY',
          passed: pv11AlwaysClosed,
          message: 'Forward flow valve PV11 strictly locked closed during warm-up cycle',
        },
        {
          tag: 'PV12_DIVERT_RECYCLE',
          expected: 'OPEN (20 scans)',
          actual: pv12AlwaysOpen ? 'OPEN (20 scans)' : 'DIVERT CLOSED',
          passed: pv12AlwaysOpen,
          message: 'Diversion valve PV12 continuously recycled flow back to Balance Tank',
        },
      ];
    },
  },
  {
    id: 'TC-P04',
    phase: 'P4_RECIPE_DOSING',
    title: 'Thermal Pasteurizing Ramp & Forward Proving Delay',
    clause: 'FDS-PAST-04.2',
    description: 'Heat holding tube past 88.0°C over 45 scans. Measure forward flow switchover delay from legal temperature attainment to PV11 opening.',
    durationScans: 45,
    dtMs: 100,
    setup: (sim, plc) => {
      sim.clearAllFaults();
      if (sim.pheAssembly) {
        sim.pheAssembly.holdingTube.primeWithProfile([
          90.0, 89.5, 89.0, 88.5, 88.2, 88.0, 87.8
        ]);
      }
      plc.startProduction();
    },
    stimulus: (_sim, _plc, _step, _history) => {
      // Production warming cycle
    },
    assertions: (_sim, _plc, history) => {
      // Find scan when TT5 crossed >= 88.0°C
      const legalTempStep = history.findIndex((h) => Number(h.inputs['TT5'] ?? 0) >= 88.0);
      // Find scan when PV11 opened
      const pv11OpenStep = history.findIndex((h) => Boolean(h.outputs['PV11_CMD']));

      const forwardDelayMs =
        legalTempStep >= 0 && pv11OpenStep >= legalTempStep ? (pv11OpenStep - legalTempStep) * 100 : 9999;

      const finalRecord = history[history.length - 1];
      const finalFlow = Number(finalRecord.inputs['FM'] ?? 0);

      return [
        {
          tag: 'LEGAL_TEMP_ACHIEVED',
          expected: '>= 88.0°C',
          actual: `${Number(finalRecord.inputs['TT5'] ?? 0).toFixed(1)}°C`,
          passed: Number(finalRecord.inputs['TT5'] ?? 0) >= 88.0,
          message: 'Holding tube TT5 successfully reached legal HTST pasteurization threshold',
        },
        {
          tag: 'FORWARD_PROVING_DELAY',
          expected: '<= 500 ms',
          actual: `${forwardDelayMs} ms`,
          passed: forwardDelayMs <= 500,
          responseTimeMs: forwardDelayMs,
          timingLimitMs: 500,
          message: `Sanitary forward flow valve PV11 opened within ${forwardDelayMs} ms of legal pasteurizing temperature attainment (limit: <= 500 ms)`,
        },
        {
          tag: 'RATED_FLOW_ESTABLISHED',
          expected: '>= 9500 LPH',
          actual: `${finalFlow} LPH`,
          passed: finalFlow >= 9500,
          message: 'Rated continuous pasteurization throughput confirmed (10,000 LPH)',
        },
      ];
    },
  },
  {
    id: 'TC-P05',
    phase: 'P5_THERMAL_CYCLE',
    title: 'Regenerator Differential Pressure Stabilization Time',
    clause: 'PMO Section 16p(D) Cross-Contamination Prevention',
    description: 'Step for 20 scans. Measure time for booster pump to establish required positive gradient (PT4 - PT2 >= +0.50 bar).',
    durationScans: 20,
    dtMs: 100,
    setup: (sim, plc) => {
      sim.clearAllFaults();
      if (sim.pheAssembly) {
        sim.pheAssembly.holdingTube.primeWithProfile([90, 90, 90, 90, 90]);
      }
      plc.writeInputs({ TT5: 90.0, PT2: 2.5, PT4: 4.1, LT1: 75 });
      plc.state = 'PASTEURIZING_FORWARD';
    },
    stimulus: (_sim, _plc, _step, _history) => {
      // Hydraulic stabilization
    },
    assertions: (_sim, _plc, history) => {
      const dpBuildStep = history.findIndex((h) => {
        const pt4 = Number(h.inputs['PT4'] ?? 0);
        const pt2 = Number(h.inputs['PT2'] ?? 0);
        return pt4 - pt2 >= 0.5;
      });
      const dpBuildTimeMs = dpBuildStep >= 0 ? dpBuildStep * 100 : 9999;

      const finalRecord = history[history.length - 1];
      const finalDp = Number(finalRecord.inputs['PT4'] ?? 0) - Number(finalRecord.inputs['PT2'] ?? 0);

      return [
        {
          tag: 'DP_BUILD_TIME',
          expected: '<= 1000 ms',
          actual: `${dpBuildTimeMs} ms`,
          passed: dpBuildTimeMs <= 1000,
          responseTimeMs: dpBuildTimeMs,
          timingLimitMs: 1000,
          message: `Regenerator differential pressure achieved legal positive threshold in ${dpBuildTimeMs} ms (limit: <= 1000 ms)`,
        },
        {
          tag: 'FINAL_DIFFERENTIAL_PRESSURE',
          expected: '>= +0.50 bar',
          actual: `+${finalDp.toFixed(2)} bar`,
          passed: finalDp >= 0.5,
          message: 'Sanitary positive pressure gradient maintained to eliminate risk of pinhole raw milk migration',
        },
      ];
    },
  },
  {
    id: 'TC-P06',
    phase: 'P6_DISCHARGE',
    title: 'Thermal Anomaly Safety Trip & PMO Legal Divert Timing',
    clause: 'FDS-PAST-06.1 / PMO Item 16p',
    description: 'At scan 4, inject sudden holding tube thermal disturbance (-15°C offset). Measure exact divert response time until PV11 closes and PV12 diverts (PMO limit: <= 400ms).',
    durationScans: 25,
    dtMs: 100,
    faults: [{ deviceId: 'PHE-HEATING', mode: 'sensor_offset', value: -15 }],
    setup: (sim, plc) => {
      sim.clearAllFaults();
      if (sim.pheAssembly) {
        sim.pheAssembly.holdingTube.primeWithProfile([90, 90, 90, 90, 90]);
      }
      plc.writeInputs({ TT5: 90.0, PT2: 2.5, PT4: 4.1, LT1: 75 });
      plc.state = 'PASTEURIZING_FORWARD';
    },
    stimulus: (sim, _plc, step, _history) => {
      if (step === 4) {
        sim.setFault({ deviceId: 'PHE-HEATING', mode: 'sensor_offset', value: -15 });
      }
    },
    assertions: (_sim, _plc, history) => {
      const faultStep = 4;

      // Find first scan after fault where IL-FDV tripped and diversion actuated
      const divertStep = history.findIndex(
        (h, idx) => idx >= faultStep && !h.outputs['PV11_CMD'] && Boolean(h.outputs['PV12_CMD'])
      );
      const divertResponseTimeMs = divertStep >= 0 ? (divertStep - faultStep) * 100 : 9999;

      const trippedRecord = history[history.length - 1];
      const trippedTemp = Number(trippedRecord.inputs['TT5'] ?? 0);

      return [
        {
          tag: 'TT5_UNDER_TEMP_DETECTED',
          expected: '< 88.0°C',
          actual: `${trippedTemp.toFixed(1)}°C`,
          passed: trippedTemp < 88.0,
          message: 'Holding tube thermal disturbance detected by dual legal RTDs',
        },
        {
          tag: 'DIVERT_RESPONSE_TIME',
          expected: '<= 400 ms (PMO Limit)',
          actual: `${divertResponseTimeMs} ms`,
          passed: divertResponseTimeMs <= 400,
          responseTimeMs: divertResponseTimeMs,
          timingLimitMs: 400,
          message: `Flow diversion valve assembly actuated to full recycle within ${divertResponseTimeMs} ms of under-temperature detection (PMO legal limit: <= 400 ms)`,
        },
        {
          tag: 'PV11_CLOSED_ON_DIVERT',
          expected: false,
          actual: Boolean(trippedRecord.outputs['PV11_CMD']),
          passed: !trippedRecord.outputs['PV11_CMD'],
          message: 'Forward flow valve PV11 confirmed strictly closed to protect finished silo',
        },
        {
          tag: 'PV12_OPEN_TO_BALANCE',
          expected: true,
          actual: Boolean(trippedRecord.outputs['PV12_CMD']),
          passed: Boolean(trippedRecord.outputs['PV12_CMD']),
          message: 'Diversion return line PV12 opened for recirculation back to balance tank',
        },
      ];
    },
  },
  {
    id: 'TC-P07',
    phase: 'P7_ABORT_SAFETY',
    title: 'Emergency Stop & Safe De-energization Latency',
    clause: 'FDS-PAST-08.1 (E-Stop)',
    description: 'At scan 4, trigger Emergency Stop. Assert raw feed, booster pump, and steam valve drop to 0 on the immediate following scan (latency <= 100ms).',
    durationScans: 20,
    dtMs: 100,
    setup: (_sim, plc) => {
      plc.startProduction();
    },
    stimulus: (_sim, plc, step, _history) => {
      if (step === 4) {
        plc.emergencyStop();
      }
    },
    assertions: (_sim, _plc, history) => {
      const estopStep = 4;
      const deEnergizedStep = history.findIndex(
        (h, idx) =>
          idx >= estopStep &&
          !h.outputs['P_FEED_CMD'] &&
          !h.outputs['P_BOOSTER_CMD'] &&
          Number(h.outputs['MOD_VALVE'] ?? 0) === 0
      );
      const latencyMs = deEnergizedStep >= 0 ? (deEnergizedStep - estopStep) * 100 : 9999;

      return [
        {
          tag: 'ESTOP_DE_ENERGIZATION_LATENCY',
          expected: '<= 100 ms (1 scan)',
          actual: `${latencyMs} ms`,
          passed: latencyMs <= 100,
          responseTimeMs: latencyMs,
          timingLimitMs: 100,
          message: `All motive drives and thermal sources de-energized on immediate scan (${latencyMs} ms <= 100 ms)`,
        },
        {
          tag: 'PLC_STATE',
          expected: 'EMERGENCY_STOP',
          actual: history[history.length - 1].plcState,
          passed: history[history.length - 1].plcState === 'EMERGENCY_STOP',
          message: 'Pasteurizer controller locked in safe EMERGENCY_STOP posture',
        },
      ];
    },
  },
];

export const getFatScenarios = (skid: SkidId): TestCase[] => {
  if (skid === 'PASTEURIZER_10KLPH') {
    return pasteurizerFatScenarios;
  }
  return fatScenarios;
};
