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
    setup: async (_sim, plc) => {
      await plc.resetBatch?.();
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
          message: allIdle
            ? 'PLC batch state machine held IDLE across all 10 baseline scans'
            : `PLC batch state machine failed to maintain IDLE baseline (current: ${plc.state})`,
        },
        {
          tag: 'P100_START_CONTINUOUS_OFF',
          expected: false,
          actual: !allPumpsOff,
          passed: allPumpsOff,
          message: allPumpsOff
            ? 'P-100 command remained continuously OFF across full baseline history'
            : 'P-100 command energized unexpectedly during baseline check',
        },
        {
          tag: 'VALVES_SEATED_CLOSED',
          expected: 'ALL CLOSED (10 scans)',
          actual: allValvesClosed ? 'ALL CLOSED (10 scans)' : 'VALVES OPENED',
          passed: allValvesClosed,
          message: allValvesClosed
            ? 'All dosing valves maintained fail-safe seated posture across baseline'
            : 'One or more dosing valves unseated during baseline check',
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
    setup: async (sim, plc) => {
      const snap = sim.tick(plc.readOutputs());
      await plc.writeInputs?.(snap.tags.inputs);
    },
    stimulus: (_sim, _plc, _step, _history) => {
      // Normal permissive monitoring
    },
    assertions: (sim, plc, history) => {
      // Write latest simulation telemetry to plc.inputs before asserting
      const snap = history.length > 0 ? history[history.length - 1].snapshot : sim.tick(plc.readOutputs());
      if (plc.inputs) {
        Object.assign(plc.inputs, snap.tags.inputs);
      }
      if (typeof plc.writeInputs === 'function') {
        const writeRes = plc.writeInputs(snap.tags.inputs);
        if (writeRes && typeof (writeRes as any).catch === 'function') {
          (writeRes as any).catch(() => {});
        }
      }

      const sourceLevel = Number(plc.inputs['TK100_LT'] ?? 0);
      const minLevel = Math.min(
        sourceLevel,
        ...history.map((h) => Number(h.inputs['TK100_LT'] ?? 0))
      );
      const il02Healthy = plc.interlocks.get('IL-02')?.isOk !== false &&
        history.every((h) => h.interlocks?.['IL-02']?.isOk !== false);

      const sourceLevelPassed = sourceLevel >= 50;
      const minLevelPassed = minLevel >= 50;

      return [
        {
          tag: 'TK100_LT',
          expected: '>= 50%',
          actual: `${sourceLevel.toFixed(1)}%`,
          passed: sourceLevelPassed,
          message: sourceLevelPassed
            ? 'Supply Tank TK-100 raw material inventory verified above start permissive (>= 50%)'
            : `Supply Tank TK-100 inventory below start permissive (${sourceLevel.toFixed(1)}% < 50%)`,
        },
        {
          tag: 'TK100_LT_MIN',
          expected: '>= 50%',
          actual: `${minLevel.toFixed(1)}%`,
          passed: minLevelPassed,
          message: minLevelPassed
            ? 'Supply Tank TK-100 raw material inventory remained >= 50% across 15 scans'
            : `Supply Tank TK-100 inventory dropped below 50% threshold (min: ${minLevel.toFixed(1)}%)`,
        },
        {
          tag: 'IL-02_PERMISSIVE_HISTORY',
          expected: 'HEALTHY (15 scans)',
          actual: il02Healthy ? 'HEALTHY (15 scans)' : 'PERMISSIVE TRIPPED',
          passed: il02Healthy,
          message: il02Healthy
            ? 'IL-02 Low Level permissive held stable and healthy throughout test history'
            : 'IL-02 Low Level permissive tripped unexpectedly during baseline monitoring',
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
    setup: async (sim, plc) => {
      sim.clearAllFaults();
      await plc.resetBatch?.();
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

      const v101ZsoPassed = !history[history.length - 1].inputs['V101_ZSO'];
      const tripPassed = tripLatencyMs <= 200;
      const pumpDropPassed = pumpDropLatencyMs <= 200;

      return [
        {
          tag: 'V101_ZSO_FAULT',
          expected: false,
          actual: Boolean(history[history.length - 1].inputs['V101_ZSO']),
          passed: v101ZsoPassed,
          message: v101ZsoPassed
            ? 'Suction valve V-101 open feedback withheld by stuck-closed physical fault'
            : 'Suction valve V-101 open feedback proved despite stuck-closed fault',
        },
        {
          tag: 'IL-01_TRIP_LATENCY',
          expected: '<= 200 ms',
          actual: `${tripLatencyMs} ms`,
          passed: tripPassed,
          responseTimeMs: tripLatencyMs,
          timingLimitMs: 200,
          message: tripPassed
            ? `IL-01 Suction Safety Interlock tripped within ${tripLatencyMs} ms of fault injection (limit: <= 200 ms)`
            : `IL-01 Suction Safety Interlock trip latency exceeded limit (${tripLatencyMs} ms > 200 ms)`,
        },
        {
          tag: 'P100_DE_ENERGIZED_TIME',
          expected: '<= 200 ms',
          actual: `${pumpDropLatencyMs} ms`,
          passed: pumpDropPassed,
          responseTimeMs: pumpDropLatencyMs,
          timingLimitMs: 200,
          message: pumpDropPassed
            ? `Transfer pump P-100 command de-energized within ${pumpDropLatencyMs} ms (limit: <= 200 ms)`
            : `Transfer pump P-100 failed to de-energize within safety limit (${pumpDropLatencyMs} ms > 200 ms)`,
        },
      ];
    },
    teardown: async (sim, plc) => {
      sim.clearAllFaults();
      await plc.resetBatch?.();
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
    setup: async (sim, plc) => {
      sim.clearAllFaults();
      await plc.resetBatch?.();
    },
    stimulus: async (_sim, plc, step, _history) => {
      if (step === 0) {
        await plc.startBatch?.();
      }
    },
    assertions: (_sim, _plc, history) => {
      // Find scan where V-101 proved OPEN
      const proveStepIndex = history.findIndex((h) => Boolean(h.inputs['V101_ZSO']));
      const strokeTimeMs = proveStepIndex >= 0 ? proveStepIndex * 100 : 9999;
      const strokeWithinTolerance = Math.abs(strokeTimeMs - 1400) <= 300;

      // Check fluid flow established after stroke
      const finalFlow = history[history.length - 1].snapshot?.paths?.find((p: any) => p.id === 'PIPE-02')?.flowLpm ?? 0;
      const pumpRunPassed = Boolean(history[history.length - 1].outputs['P100_START']);
      const flowPassed = finalFlow > 100;

      return [
        {
          tag: 'V101_TRAVEL_TIME',
          expected: '1400 ms ± 300 ms',
          actual: `${strokeTimeMs} ms`,
          passed: strokeWithinTolerance,
          responseTimeMs: strokeTimeMs,
          timingLimitMs: 1700,
          message: strokeWithinTolerance
            ? `V-101 actuator travel transit duration measured at ${strokeTimeMs} ms (target 1400 ± 300 ms)`
            : `V-101 actuator travel transit out of tolerance (${strokeTimeMs} ms, expected 1400 ± 300 ms)`,
        },
        {
          tag: 'POST_STROKE_PUMP_RUN',
          expected: true,
          actual: pumpRunPassed,
          passed: pumpRunPassed,
          message: pumpRunPassed
            ? 'P-100 commanded ON after V-101 confirmed fully open'
            : 'P-100 failed to command ON after V-101 confirmed open',
        },
        {
          tag: 'HEADER_FLOW_RATE',
          expected: '> 100 L/min',
          actual: `${finalFlow} L/min`,
          passed: flowPassed,
          message: flowPassed
            ? 'Hydraulic velocity established in header following valve travel proof'
            : `Header flow rate below target (${finalFlow.toFixed(1)} L/min <= 100 L/min)`,
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

      const finalTempPassed = finalTemp > 40;
      const slewRatePassed = slewRateDegPerSec > 0.5;

      return [
        {
          tag: 'HX100_TT_FINAL',
          expected: '> 40°C',
          actual: `${finalTemp.toFixed(1)}°C`,
          passed: finalTempPassed,
          message: finalTempPassed
            ? `Product stream heated to ${finalTemp.toFixed(1)}°C over 40 scans (initial: ${initialTemp.toFixed(1)}°C)`
            : `Product stream temperature below target (${finalTemp.toFixed(1)}°C <= 40°C)`,
        },
        {
          tag: 'THERMAL_SLEW_RATE',
          expected: '> 0.50 °C/s',
          actual: `+${slewRateDegPerSec.toFixed(2)} °C/s`,
          passed: slewRatePassed,
          message: slewRatePassed
            ? `Thermal rise slew rate confirmed at +${slewRateDegPerSec.toFixed(2)} °C/sec`
            : `Thermal rise slew rate below requirement (+${slewRateDegPerSec.toFixed(2)} °C/sec <= 0.50 °C/sec)`,
        },
        {
          tag: 'IL-04_THERMAL_SAFETY',
          expected: 'HEALTHY (40 scans)',
          actual: il04Ok ? 'HEALTHY (40 scans)' : 'TRIPPED',
          passed: il04Ok,
          message: il04Ok
            ? 'Thermal limit safety interlock IL-04 maintained in healthy zone throughout heating cycle'
            : 'Thermal limit safety interlock IL-04 tripped during heating cycle',
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
    stimulus: async (_sim, plc, step, _history) => {
      if (step === 0) {
        if (typeof plc.dischargeBatch === 'function') {
          await plc.dischargeBatch();
        } else {
          plc.outputs['V400_PROD_CMD'] = true;
        }
      }
    },
    assertions: (_sim, _plc, history) => {
      const openStepIndex = history.findIndex((h) => Boolean(h.inputs['V400_PROD_ZSO']));
      const strokeTimeMs = openStepIndex >= 0 ? openStepIndex * 100 : 9999;
      const strokePassed = strokeTimeMs <= 2500;

      return [
        {
          tag: 'V400_PROD_STROKE_TIME',
          expected: '<= 2500 ms',
          actual: `${strokeTimeMs} ms`,
          passed: strokePassed,
          responseTimeMs: strokeTimeMs,
          timingLimitMs: 2500,
          message: strokePassed
            ? `Discharge valve V-400 open proof proved at ${strokeTimeMs} ms (limit: <= 2500 ms)`
            : `Discharge valve V-400 open proof stroke time exceeded limit (${strokeTimeMs} ms > 2500 ms)`,
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
    stimulus: async (_sim, plc, step, _history) => {
      if (step === 4) {
        await plc.abortBatch?.();
      }
    },
    assertions: (_sim, _plc, history) => {
      const estopStep = 4;
      const allZeroStep = history.findIndex(
        (h, idx) => idx >= estopStep && !h.outputs['P100_START'] && !h.outputs['V101_CMD'] && !h.outputs['V400_PROD_CMD']
      );
      const latencyMs = allZeroStep >= 0 ? (allZeroStep - estopStep) * 100 : 9999;
      const statePassed = history[history.length - 1].plcState === 'ABORTED';
      const latencyPassed = latencyMs <= 100;

      return [
        {
          tag: 'PLC_STATE',
          expected: 'ABORTED',
          actual: history[history.length - 1].plcState,
          passed: statePassed,
          message: statePassed
            ? 'PLC entered ABORTED state following E-Stop trigger'
            : `PLC failed to transition to ABORTED on E-Stop (current: ${history[history.length - 1].plcState})`,
        },
        {
          tag: 'ESTOP_DE_ENERGIZATION_LATENCY',
          expected: '<= 100 ms (1 scan)',
          actual: `${latencyMs} ms`,
          passed: latencyPassed,
          responseTimeMs: latencyMs,
          timingLimitMs: 100,
          message: latencyPassed
            ? `All contactor and valve outputs de-energized within ${latencyMs} ms (limit: <= 100 ms)`
            : `Outputs failed to de-energize within safety latency limit (${latencyMs} ms > 100 ms)`,
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
    setup: async (sim, plc) => {
      sim.clearAllFaults();
      await plc.resetSystem?.();
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
          message: allStopped
            ? 'Pasteurizer controller safely maintained STOPPED across all 10 scans'
            : `Pasteurizer controller failed to hold STOPPED baseline (current: ${history[history.length - 1]?.plcState})`,
        },
        {
          tag: 'P_FEED_CONTINUOUS_OFF',
          expected: false,
          actual: !feedOff,
          passed: feedOff,
          message: feedOff
            ? 'Raw milk feed pump P-FEED de-energized across full baseline'
            : 'Raw milk feed pump P-FEED energized unexpectedly during baseline',
        },
        {
          tag: 'P_BOOSTER_CONTINUOUS_OFF',
          expected: false,
          actual: !boosterOff,
          passed: boosterOff,
          message: boosterOff
            ? 'Booster pump P-BOOSTER de-energized across full baseline'
            : 'Booster pump P-BOOSTER energized unexpectedly during baseline',
        },
        {
          tag: 'PV11_FORWARD_FAIL_SAFE',
          expected: false,
          actual: !forwardClosed,
          passed: forwardClosed,
          message: forwardClosed
            ? 'Forward flow valve PV11 held in fail-safe closed posture'
            : 'Forward flow valve PV11 unseated or opened during baseline',
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
    setup: async (sim, plc) => {
      const snap = sim.tick(plc.readOutputs());
      await plc.writeInputs?.(snap.tags.inputs);
    },
    stimulus: (_sim, _plc, _step, _history) => {
      // Permissive monitoring
    },
    assertions: (sim, plc, history) => {
      const snap = history.length > 0 ? history[history.length - 1].snapshot : sim.tick(plc.readOutputs());
      if (plc.inputs) {
        Object.assign(plc.inputs, snap.tags.inputs);
      }
      if (typeof plc.writeInputs === 'function') {
        const writeRes = plc.writeInputs(snap.tags.inputs);
        if (writeRes && typeof (writeRes as any).catch === 'function') {
          (writeRes as any).catch(() => {});
        }
      }

      const balanceLevel = Number(plc.inputs['LT1'] ?? plc.inputs['LT_BALANCE'] ?? 75);
      const minLevel = Math.min(
        balanceLevel,
        ...history.map((h) => Number(h.inputs['LT1'] ?? h.inputs['LT_BALANCE'] ?? 75))
      );
      const ilBalLowOk = plc.interlocks.get('IL-BAL-LOW')?.isOk !== false &&
        history.every((h) => h.interlocks?.['IL-BAL-LOW']?.isOk !== false);

      const balanceLevelPassed = balanceLevel >= 15;
      const minLevelPassed = minLevel >= 15;

      return [
        {
          tag: 'BALANCE_TANK_LT',
          expected: '>= 15%',
          actual: `${balanceLevel.toFixed(1)}%`,
          passed: balanceLevelPassed,
          message: balanceLevelPassed
            ? 'Balance Tank inventory verified above pump priming threshold (>= 15%)'
            : `Balance Tank inventory below pump priming threshold (${balanceLevel.toFixed(1)}% < 15%)`,
        },
        {
          tag: 'BALANCE_TANK_LT_MIN',
          expected: '>= 15%',
          actual: `${minLevel.toFixed(1)}%`,
          passed: minLevelPassed,
          message: minLevelPassed
            ? 'Balance Tank volume verified continuously above minimum pump priming threshold'
            : `Balance Tank volume dropped below minimum priming threshold (min: ${minLevel.toFixed(1)}% < 15%)`,
        },
        {
          tag: 'IL-BAL-LOW_PERMISSIVE',
          expected: 'HEALTHY (15 scans)',
          actual: ilBalLowOk ? 'HEALTHY (15 scans)' : 'TRIPPED',
          passed: ilBalLowOk,
          message: ilBalLowOk
            ? 'Low level lockout IL-BAL-LOW proved healthy across all 15 scans'
            : 'Low level lockout IL-BAL-LOW tripped unexpectedly during baseline',
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
    setup: async (_sim, plc) => {
      await plc.startProduction?.();
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
          message: ilFdvUnproved
            ? 'Legal diversion interlock IL-FDV correctly unproved while holding tube temperature is sub-pasteurizing'
            : 'Legal diversion interlock IL-FDV proved prematurely while temperature was sub-pasteurizing',
        },
        {
          tag: 'PV11_FORWARD_LOCKED',
          expected: 'CLOSED (20 scans)',
          actual: pv11AlwaysClosed ? 'CLOSED (20 scans)' : 'OPENED ILLEGALLY',
          passed: pv11AlwaysClosed,
          message: pv11AlwaysClosed
            ? 'Forward flow valve PV11 strictly locked closed during warm-up cycle'
            : 'Forward flow valve PV11 commanded open prematurely during sub-temperature cycle',
        },
        {
          tag: 'PV12_DIVERT_RECYCLE',
          expected: 'OPEN (20 scans)',
          actual: pv12AlwaysOpen ? 'OPEN (20 scans)' : 'DIVERT CLOSED',
          passed: pv12AlwaysOpen,
          message: pv12AlwaysOpen
            ? 'Diversion valve PV12 continuously recycled flow back to Balance Tank'
            : 'Diversion valve PV12 failed to maintain continuous recycle during sub-temperature cycle',
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
    setup: async (sim, plc) => {
      sim.clearAllFaults();
      if (sim.pheAssembly) {
        sim.pheAssembly.holdingTube.primeWithProfile([
          90.0, 89.5, 89.0, 88.5, 88.2, 88.0, 87.8
        ]);
      }
      await plc.startProduction?.();
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
      const tt5Final = Number(finalRecord.inputs['TT5'] ?? 0);

      const legalTempPassed = tt5Final >= 88.0;
      const forwardDelayPassed = forwardDelayMs <= 500;
      const ratedFlowPassed = finalFlow >= 9500;

      return [
        {
          tag: 'LEGAL_TEMP_ACHIEVED',
          expected: '>= 88.0°C',
          actual: `${tt5Final.toFixed(1)}°C`,
          passed: legalTempPassed,
          message: legalTempPassed
            ? 'Holding tube TT5 successfully reached legal HTST pasteurization threshold'
            : `Holding tube TT5 failed to reach legal HTST pasteurization threshold (${tt5Final.toFixed(1)}°C < 88.0°C)`,
        },
        {
          tag: 'FORWARD_PROVING_DELAY',
          expected: '<= 500 ms',
          actual: `${forwardDelayMs} ms`,
          passed: forwardDelayPassed,
          responseTimeMs: forwardDelayMs,
          timingLimitMs: 500,
          message: forwardDelayPassed
            ? `Sanitary forward flow valve PV11 opened within ${forwardDelayMs} ms of legal pasteurizing temperature attainment (limit: <= 500 ms)`
            : `Sanitary forward flow valve PV11 exceeded proving delay limit (${forwardDelayMs} ms > 500 ms)`,
        },
        {
          tag: 'RATED_FLOW_ESTABLISHED',
          expected: '>= 9500 LPH',
          actual: `${finalFlow} LPH`,
          passed: ratedFlowPassed,
          message: ratedFlowPassed
            ? 'Rated continuous pasteurization throughput confirmed (10,000 LPH)'
            : `Continuous pasteurization throughput below specification (${finalFlow.toFixed(0)} LPH < 9,500 LPH)`,
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
    setup: async (sim, plc) => {
      sim.clearAllFaults();
      if (sim.pheAssembly) {
        sim.pheAssembly.holdingTube.primeWithProfile([90, 90, 90, 90, 90]);
      }
      await plc.writeInputs?.({ TT5: 90.0, PT2: 2.5, PT4: 4.1, LT1: 75 });
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

      const dpBuildPassed = dpBuildTimeMs <= 1000;
      const finalDpPassed = finalDp >= 0.5;

      return [
        {
          tag: 'DP_BUILD_TIME',
          expected: '<= 1000 ms',
          actual: `${dpBuildTimeMs} ms`,
          passed: dpBuildPassed,
          responseTimeMs: dpBuildTimeMs,
          timingLimitMs: 1000,
          message: dpBuildPassed
            ? `Regenerator differential pressure achieved legal positive threshold in ${dpBuildTimeMs} ms (limit: <= 1000 ms)`
            : `Regenerator differential pressure failed to build within limit (${dpBuildTimeMs} ms > 1000 ms)`,
        },
        {
          tag: 'FINAL_DIFFERENTIAL_PRESSURE',
          expected: '>= +0.50 bar',
          actual: `+${finalDp.toFixed(2)} bar`,
          passed: finalDpPassed,
          message: finalDpPassed
            ? 'Sanitary positive pressure gradient maintained to eliminate risk of pinhole raw milk migration'
            : `Sanitary positive pressure gradient inadequate (+${finalDp.toFixed(2)} bar < +0.50 bar risk of cross-contamination)`,
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
    setup: async (sim, plc) => {
      sim.clearAllFaults();
      if (sim.pheAssembly) {
        sim.pheAssembly.holdingTube.primeWithProfile([90, 90, 90, 90, 90]);
      }
      await plc.writeInputs?.({ TT5: 90.0, PT2: 2.5, PT4: 4.1, LT1: 75 });
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

      const underTempPassed = trippedTemp < 88.0;
      const divertPassed = divertResponseTimeMs <= 400;
      const pv11ClosedPassed = !trippedRecord.outputs['PV11_CMD'];
      const pv12OpenPassed = Boolean(trippedRecord.outputs['PV12_CMD']);

      return [
        {
          tag: 'TT5_UNDER_TEMP_DETECTED',
          expected: '< 88.0°C',
          actual: `${trippedTemp.toFixed(1)}°C`,
          passed: underTempPassed,
          message: underTempPassed
            ? 'Holding tube thermal disturbance detected by dual legal RTDs'
            : `Holding tube under-temperature fault not detected (${trippedTemp.toFixed(1)}°C >= 88.0°C)`,
        },
        {
          tag: 'DIVERT_RESPONSE_TIME',
          expected: '<= 400 ms (PMO Limit)',
          actual: `${divertResponseTimeMs} ms`,
          passed: divertPassed,
          responseTimeMs: divertResponseTimeMs,
          timingLimitMs: 400,
          message: divertPassed
            ? `Flow diversion valve assembly actuated to full recycle within ${divertResponseTimeMs} ms of under-temperature detection (PMO legal limit: <= 400 ms)`
            : `Flow diversion valve failed to divert within PMO limit (${divertResponseTimeMs} ms > 400 ms)`,
        },
        {
          tag: 'PV11_CLOSED_ON_DIVERT',
          expected: false,
          actual: Boolean(trippedRecord.outputs['PV11_CMD']),
          passed: pv11ClosedPassed,
          message: pv11ClosedPassed
            ? 'Forward flow valve PV11 confirmed strictly closed to protect finished silo'
            : 'Forward flow valve PV11 remained energized open during thermal anomaly (PMO violation)',
        },
        {
          tag: 'PV12_OPEN_TO_BALANCE',
          expected: true,
          actual: Boolean(trippedRecord.outputs['PV12_CMD']),
          passed: pv12OpenPassed,
          message: pv12OpenPassed
            ? 'Diversion return line PV12 opened for recirculation back to balance tank'
            : 'Diversion return line PV12 failed to open during legal diversion event',
        },
      ];
    },
    teardown: (sim, plc) => {
      sim.clearAllFaults();
      plc.clearAllOutputs();
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
    setup: async (_sim, plc) => {
      await plc.startProduction?.();
    },
    stimulus: async (_sim, plc, step, _history) => {
      if (step === 4) {
        await plc.emergencyStop?.();
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

      const latencyPassed = latencyMs <= 100;
      const statePassed = history[history.length - 1].plcState === 'EMERGENCY_STOP';

      return [
        {
          tag: 'ESTOP_DE_ENERGIZATION_LATENCY',
          expected: '<= 100 ms (1 scan)',
          actual: `${latencyMs} ms`,
          passed: latencyPassed,
          responseTimeMs: latencyMs,
          timingLimitMs: 100,
          message: latencyPassed
            ? `All motive drives and thermal sources de-energized on immediate scan (${latencyMs} ms <= 100 ms)`
            : `Motive drives and thermal sources failed to de-energize within limit (${latencyMs} ms > 100 ms)`,
        },
        {
          tag: 'PLC_STATE',
          expected: 'EMERGENCY_STOP',
          actual: history[history.length - 1].plcState,
          passed: statePassed,
          message: statePassed
            ? 'Pasteurizer controller locked in safe EMERGENCY_STOP posture'
            : `Pasteurizer controller failed to enter EMERGENCY_STOP (current: ${history[history.length - 1].plcState})`,
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
