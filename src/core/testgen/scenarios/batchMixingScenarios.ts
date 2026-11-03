/**
 * TwinForge Studio - Batch Mixing Skid FAT Scenarios
 * Time-based automated FAT test cases (TC-01 to TC-07) for the three-solution batch mixing skid.
 */

import type { TestCase } from '../types';

export const batchMixingFatScenarios: TestCase[] = [
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
      const tripLatencyMs = tripStepIndex >= 0 ? (history[tripStepIndex].timeMs - history[faultStep].timeMs) : 9999;

      // Find when pump de-energized after fault
      const pumpDropIndex = history.findIndex((h, idx) => idx >= faultStep && !h.outputs['P100_START']);
      const pumpDropLatencyMs = pumpDropIndex >= 0 ? (history[pumpDropIndex].timeMs - history[faultStep].timeMs) : 9999;

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
          timingToleranceMs: 100,
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
          timingToleranceMs: 100,
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
      const strokeTimeMs = proveStepIndex >= 0 ? history[proveStepIndex].timeMs : 9999;
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
          timingToleranceMs: 150,
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
      const strokeTimeMs = openStepIndex >= 0 ? history[openStepIndex].timeMs : 9999;
      const strokePassed = strokeTimeMs <= 2500;

      return [
        {
          tag: 'V400_PROD_STROKE_TIME',
          expected: '<= 2500 ms',
          actual: `${strokeTimeMs} ms`,
          passed: strokePassed,
          responseTimeMs: strokeTimeMs,
          timingLimitMs: 2500,
          timingToleranceMs: 200,
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
      const latencyMs = allZeroStep >= 0 ? (history[allZeroStep].timeMs - history[estopStep].timeMs) : 9999;
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
          timingToleranceMs: 100,
          message: latencyPassed
            ? `All contactor and valve outputs de-energized within ${latencyMs} ms (limit: <= 100 ms)`
            : `Outputs failed to de-energize within safety latency limit (${latencyMs} ms > 100 ms)`,
        },
      ];
    },
  },
];

// Alias for backwards compatibility
export const fatScenarios = batchMixingFatScenarios;
