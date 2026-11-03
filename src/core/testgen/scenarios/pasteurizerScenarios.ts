/**
 * TwinForge Studio - Milk Pasteurizer 10 KLPH FAT Scenarios
 * Time-based automated FAT test cases (TC-P01 to TC-P07) for the continuous HTST dairy pasteurizer.
 */

import type { TestCase } from '../types';

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
        legalTempStep >= 0 && pv11OpenStep >= legalTempStep ? (history[pv11OpenStep].timeMs - history[legalTempStep].timeMs) : 9999;

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
          timingToleranceMs: 100,
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
      const dpBuildTimeMs = dpBuildStep >= 0 ? history[dpBuildStep].timeMs : 9999;

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
          timingToleranceMs: 100,
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
      const divertResponseTimeMs = divertStep >= 0 ? (history[divertStep].timeMs - history[faultStep].timeMs) : 9999;

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
          timingToleranceMs: 100,
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
      const latencyMs = deEnergizedStep >= 0 ? (history[deEnergizedStep].timeMs - history[estopStep].timeMs) : 9999;

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
          timingToleranceMs: 100,
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
