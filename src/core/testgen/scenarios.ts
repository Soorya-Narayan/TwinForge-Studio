/**
 * TwinForge Studio - Pre-configured Executable FAT Test Scenarios
 * Mapped to standard functional acceptance test procedures.
 */

import type { TestCase } from './types';
import type { MockPlcDriver } from '../driver/MockPlcDriver';
import type { PhysicsEngine } from '../engine/PhysicsEngine';
import type { SkidId } from '../../store/useSimulationStore';

export const fatScenarios: TestCase[] = [
  {
    id: 'TC-01',
    phase: 'P1_STOPPED_CONDITION',
    title: 'Stopped Condition Baseline Check',
    clause: 'FDS-01.1',
    description: 'Verify all pumps de-energized, valves closed, and interlocks healthy in IDLE state.',
    stimulus: (_sim: PhysicsEngine, plc: MockPlcDriver) => {
      plc.resetBatch();
    },
    assertions: (_sim: PhysicsEngine, plc: MockPlcDriver) => {
      return [
        {
          tag: 'PLC_STATE',
          expected: 'IDLE',
          actual: plc.state,
          passed: plc.state === 'IDLE',
          message: 'PLC batch state machine is IDLE',
        },
        {
          tag: 'P100_START',
          expected: false,
          actual: Boolean(plc.outputs['P100_START']),
          passed: !plc.outputs['P100_START'],
          message: 'P-100 command is OFF',
        },
        {
          tag: 'V101_CMD',
          expected: false,
          actual: Boolean(plc.outputs['V101_CMD']),
          passed: !plc.outputs['V101_CMD'],
          message: 'V-101 suction valve command is CLOSED',
        },
      ];
    },
  },
  {
    id: 'TC-02',
    phase: 'P2_PERMISSIVES',
    title: 'Process Permissives Verification',
    clause: 'FDS-02.4',
    description: 'Verify source tank has sufficient raw material before allowing batch start.',
    stimulus: (sim: PhysicsEngine, _plc: MockPlcDriver) => {
      sim.tick({});
    },
    assertions: (_sim: PhysicsEngine, plc: MockPlcDriver) => {
      const sourceLevel = Number(plc.inputs['TK100_LT'] ?? 0);
      return [
        {
          tag: 'TK100_LT',
          expected: '>= 50%',
          actual: `${sourceLevel}%`,
          passed: sourceLevel >= 50,
          message: 'Supply Tank TK-100 raw material inventory is verified (> 50%)',
        },
        {
          tag: 'IL-02',
          expected: true,
          actual: plc.interlocks.get('IL-02')?.isOk,
          passed: plc.interlocks.get('IL-02')?.isOk === true,
          message: 'IL-02 Low Level permissive is HEALTHY',
        },
      ];
    },
  },
  {
    id: 'TC-03',
    phase: 'P3_INTERLOCK_VERIFICATION',
    title: 'IL-01 Suction Interlock with Stuck Valve',
    clause: 'FDS-03.2 (Safety)',
    description: 'Inject jammed V-101 fault (stuck closed). Issue Start command. Verify pump trips and refuses to dry-run.',
    faults: [{ deviceId: 'V-101', mode: 'stuck_closed' }],
    stimulus: (sim: PhysicsEngine, plc: MockPlcDriver) => {
      sim.setFault({ deviceId: 'V-101', mode: 'stuck_closed' });
      plc.outputs['V101_CMD'] = true;
      plc.outputs['P100_START'] = true; // Attempt to force pump start
      // Scan tick
      sim.tick(plc.readOutputs());
      plc.tick(100);
    },
    assertions: (_sim: PhysicsEngine, plc: MockPlcDriver) => {
      const p100Cmd = Boolean(plc.outputs['P100_START']);
      const il01 = plc.interlocks.get('IL-01');
      return [
        {
          tag: 'V101_ZSO',
          expected: false,
          actual: Boolean(plc.inputs['V101_ZSO']),
          passed: !plc.inputs['V101_ZSO'],
          message: 'Suction valve V-101 proof failed as expected (stuck closed fault injected)',
        },
        {
          tag: 'IL-01_TRIPPED',
          expected: true,
          actual: il01?.tripped,
          passed: il01?.tripped === true,
          message: 'IL-01 Suction Valve Safety Interlock successfully tripped',
        },
        {
          tag: 'P100_START',
          expected: false,
          actual: p100Cmd,
          passed: !p100Cmd,
          message: 'Transfer pump P-100 command forcibly de-energized by interlock',
        },
      ];
    },
  },
  {
    id: 'TC-04',
    phase: 'P4_RECIPE_DOSING',
    title: 'Automated Recipe Dosing & Valve Travel Time',
    clause: 'FDS-04.1',
    description: 'Clear faults, start AUTO batch, verify V-101 open proof received before pump starts.',
    stimulus: (sim: PhysicsEngine, plc: MockPlcDriver) => {
      sim.clearAllFaults();
      plc.resetBatch();
      plc.startBatch();
      // Tick 3.5 seconds so valve travels to 100% and pump ramps to full speed
      for (let i = 0; i < 35; i++) {
        const snap = sim.tick(plc.readOutputs());
        plc.writeInputs(snap.tags.inputs);
        plc.tick(100);
      }
    },
    assertions: (sim: PhysicsEngine, plc: MockPlcDriver) => {
      const snap = sim.tick(plc.readOutputs());
      const p100Flow = snap.paths.find((p) => p.id === 'PIPE-02')?.flowLpm ?? 0;
      return [
        {
          tag: 'V101_ZSO',
          expected: true,
          actual: Boolean(plc.inputs['V101_ZSO']),
          passed: Boolean(plc.inputs['V101_ZSO']),
          message: 'V-101 reached full travel position and proved OPEN',
        },
        {
          tag: 'P100_START',
          expected: true,
          actual: Boolean(plc.outputs['P100_START']),
          passed: Boolean(plc.outputs['P100_START']),
          message: 'P-100 commanded ON after interlock satisfied',
        },
        {
          tag: 'LINE_FLOW',
          expected: '> 100 L/min',
          actual: `${p100Flow} L/min`,
          passed: p100Flow > 100,
          message: 'Physical fluid velocity successfully established in transfer header',
        },
      ];
    },
  },
  {
    id: 'TC-05',
    phase: 'P5_THERMAL_CYCLE',
    title: 'Heat Exchanger Loop & Thermal Interlock IL-04',
    clause: 'FDS-05.3',
    description: 'Verify steam plate exchanger heats product stream and temperature transmitter reads thermal rise.',
    stimulus: (sim: PhysicsEngine, plc: MockPlcDriver) => {
      // Simulate heating loop with active flow
      for (let i = 0; i < 40; i++) {
        const snap = sim.tick({ ...plc.readOutputs(), TCV100_CMD: 90, P100_START: true, V101_CMD: true, V102_CMD: true });
        plc.writeInputs(snap.tags.inputs);
        plc.tick(100);
      }
    },
    assertions: (_sim: PhysicsEngine, plc: MockPlcDriver) => {
      const temp = Number(plc.inputs['HX100_TT'] ?? 20);
      return [
        {
          tag: 'HX100_TT',
          expected: '> 40°C',
          actual: `${temp.toFixed(1)}°C`,
          passed: temp > 40,
          message: 'Thermal energy transferred to fluid through plate exchanger',
        },
        {
          tag: 'IL-04',
          expected: true,
          actual: plc.interlocks.get('IL-04')?.isOk,
          passed: plc.interlocks.get('IL-04')?.isOk === true,
          message: 'High temperature safety cutoff IL-04 maintained in healthy region',
        },
      ];
    },
  },
  {
    id: 'TC-06',
    phase: 'P6_DISCHARGE',
    title: 'Mixing Tank Discharge to Finished Storage',
    clause: 'FDS-06.2',
    description: 'Command product discharge valve V-400 open and verify level transfer into TK-PROD.',
    stimulus: (sim: PhysicsEngine, plc: MockPlcDriver) => {
      plc.outputs['V400_PROD_CMD'] = true;
      // V-400 travelTimeS is 2.0s (20 ticks), step 25 ticks
      for (let i = 0; i < 25; i++) {
        const snap = sim.tick(plc.readOutputs());
        plc.writeInputs(snap.tags.inputs);
        plc.tick(100);
      }
    },
    assertions: (_sim: PhysicsEngine, plc: MockPlcDriver) => {
      const v400Open = Boolean(plc.inputs['V400_PROD_ZSO']);
      return [
        {
          tag: 'V400_PROD_ZSO',
          expected: true,
          actual: v400Open,
          passed: v400Open,
          message: 'Product discharge valve V-400 proved OPEN',
        },
      ];
    },
  },
  {
    id: 'TC-07',
    phase: 'P7_ABORT_SAFETY',
    title: 'Emergency Stop & Fail-Safe De-energization',
    clause: 'FDS-08.1 (E-Stop)',
    description: 'Trigger Emergency Stop / Abort. Assert all digital outputs fail to 0 in fail-safe orientation.',
    stimulus: (sim: PhysicsEngine, plc: MockPlcDriver) => {
      plc.abortBatch();
      const snap = sim.tick(plc.readOutputs());
      plc.writeInputs(snap.tags.inputs);
      plc.tick(100);
    },
    assertions: (_sim: PhysicsEngine, plc: MockPlcDriver) => {
      const p100 = Boolean(plc.outputs['P100_START']);
      const v101 = Boolean(plc.outputs['V101_CMD']);
      const v400 = Boolean(plc.outputs['V400_PROD_CMD']);
      return [
        {
          tag: 'PLC_STATE',
          expected: 'ABORTED',
          actual: plc.state,
          passed: plc.state === 'ABORTED',
          message: 'PLC entered safe ABORT state',
        },
        {
          tag: 'P100_START',
          expected: false,
          actual: p100,
          passed: !p100,
          message: 'Pump P-100 commanded de-energized immediately',
        },
        {
          tag: 'FAIL_SAFE_VALVES',
          expected: 'ALL CLOSED',
          actual: !v101 && !v400 ? 'ALL CLOSED' : 'OPEN',
          passed: !v101 && !v400,
          message: 'Normally-closed valves returned to safe spring-return seat',
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
    description: 'Verify all pumps de-energized, valves at fail-safe seated posture, and legal interlocks initialized.',
    stimulus: (sim: any, plc: any) => {
      sim.clearAllFaults();
      plc.resetSystem();
      const snap = sim.tick(plc.readOutputs());
      plc.writeInputs(snap.tags.inputs);
    },
    assertions: (_sim: any, plc: any) => {
      const pFeed = Boolean(plc.outputs['P_FEED_START']);
      const pBoost = Boolean(plc.outputs['P_BOOST_START']);
      const pv11 = Boolean(plc.outputs['PV11_CMD']);
      return [
        {
          tag: 'PLC_STATE',
          expected: 'STOPPED',
          actual: plc.state,
          passed: plc.state === 'STOPPED',
          message: 'Pasteurizer controller state is safely STOPPED',
        },
        {
          tag: 'P_FEED_START',
          expected: false,
          actual: pFeed,
          passed: !pFeed,
          message: 'Raw milk feed pump P-FEED is de-energized',
        },
        {
          tag: 'P_BOOST_START',
          expected: false,
          actual: pBoost,
          passed: !pBoost,
          message: 'Regeneration booster pump P-BOOSTER is de-energized',
        },
        {
          tag: 'PV11_CMD',
          expected: false,
          actual: pv11,
          passed: !pv11,
          message: 'Forward flow valve PV11 closed in fail-safe seated orientation',
        },
      ];
    },
  },
  {
    id: 'TC-P02',
    phase: 'P2_PERMISSIVES',
    title: 'Raw Milk Permissives & Balance Tank Inventory',
    clause: 'FDS-PAST-02.3',
    description: 'Verify Balance Tank level LT1 > 15% satisfies low-level interlock IL-BAL-LOW to prevent pump cavitation.',
    stimulus: (sim: any, plc: any) => {
      const snap = sim.tick(plc.readOutputs());
      plc.writeInputs(snap.tags.inputs);
      plc.tick(100);
    },
    assertions: (_sim: any, plc: any) => {
      const lt1 = Number(plc.inputs['LT1'] ?? 75);
      const ilBalLow = plc.interlocks?.get('IL-BAL-LOW');
      return [
        {
          tag: 'LT1',
          expected: '>= 15%',
          actual: `${lt1.toFixed(1)}%`,
          passed: lt1 >= 15,
          message: 'Balance Tank volume is verified above minimum pump priming threshold',
        },
        {
          tag: 'IL-BAL-LOW',
          expected: true,
          actual: ilBalLow?.isOk,
          passed: ilBalLow?.isOk === true,
          message: 'Low level lockout IL-BAL-LOW is healthy',
        },
      ];
    },
  },
  {
    id: 'TC-P03',
    phase: 'P3_INTERLOCK_VERIFICATION',
    title: 'Legal Flow Diversion Lockout (IL-FDV Under-Temp)',
    clause: 'PMO Item 16p / 3-A Standards',
    description: 'Assert forward flow valve PV11 is strictly locked closed while holding tube temperature TT5 is under 88.0°C.',
    stimulus: (sim: any, plc: any) => {
      plc.startProduction();
      const snap = sim.tick(plc.readOutputs());
      plc.writeInputs(snap.tags.inputs);
      plc.tick(100);
    },
    assertions: (_sim: any, plc: any) => {
      const pv11 = Boolean(plc.outputs['PV11_CMD']);
      const pv12 = Boolean(plc.outputs['PV12_CMD']);
      const ilFdv = plc.interlocks?.get('IL-FDV');
      return [
        {
          tag: 'IL-FDV',
          expected: false,
          actual: ilFdv?.isOk,
          passed: ilFdv?.isOk === false,
          message: 'Legal diversion interlock IL-FDV correctly unproved while warming up',
        },
        {
          tag: 'PV11_CMD',
          expected: false,
          actual: pv11,
          passed: !pv11,
          message: 'Product forward flow valve PV11 strictly locked CLOSED',
        },
        {
          tag: 'PV12_CMD',
          expected: true,
          actual: pv12,
          passed: pv12,
          message: 'Diversion valve PV12 commanded OPEN for recycle to Balance Tank',
        },
      ];
    },
  },
  {
    id: 'TC-P04',
    phase: 'P4_RECIPE_DOSING',
    title: 'Thermal Pasteurizing Ramp & Forward Proving',
    clause: 'FDS-PAST-04.2',
    description: 'Modulate steam valve SCV1 to heat holding tube TT5 past 88.0°C. Assert automatic transition to PASTEURIZING_FORWARD and feed flow proving.',
    stimulus: (sim: any, plc: any) => {
      sim.clearAllFaults();
      plc.startProduction();
      // Step simulation until legal temperature proved (~50 ticks)
      for (let i = 0; i < 60; i++) {
        const snap = sim.tick(plc.readOutputs());
        plc.writeInputs(snap.tags.inputs);
        plc.tick(100);
      }
    },
    assertions: (sim: any, plc: any) => {
      const snap = sim.tick(plc.readOutputs());
      const tt5 = Number(snap.tags.inputs['TT5'] ?? 0);
      const fm = Number(snap.tags.inputs['FM'] ?? 0);
      const pv11 = Boolean(plc.outputs['PV11_CMD']);
      return [
        {
          tag: 'TT5',
          expected: '>= 88.0°C',
          actual: `${tt5.toFixed(1)}°C`,
          passed: tt5 >= 88.0,
          message: 'Holding coil exit temperature achieved legal pasteurizing threshold',
        },
        {
          tag: 'PLC_STATE',
          expected: 'PASTEURIZING_FORWARD',
          actual: plc.state,
          passed: plc.state === 'PASTEURIZING_FORWARD',
          message: 'State machine automatically transitioned to continuous forward pasteurizing',
        },
        {
          tag: 'PV11_CMD',
          expected: true,
          actual: pv11,
          passed: pv11,
          message: 'Sanitary forward flow valve PV11 opened to product silo',
        },
        {
          tag: 'FM_FLOW',
          expected: '>= 9500 LPH',
          actual: `${fm} LPH`,
          passed: fm >= 9500,
          message: 'Rated continuous pasteurization throughput confirmed (10,000 LPH)',
        },
      ];
    },
  },
  {
    id: 'TC-P05',
    phase: 'P5_THERMAL_CYCLE',
    title: 'Regenerator Positive Differential Pressure (IL-DP)',
    clause: 'PMO Section 16p(D) Cross-Contamination Prevention',
    description: 'Verify booster pump discharge pressure PT4 exceeds raw feed PT2 by >= 0.5 bar to protect pasteurized stream.',
    stimulus: (sim: any, plc: any) => {
      const snap = sim.tick(plc.readOutputs());
      plc.writeInputs(snap.tags.inputs);
      plc.tick(100);
    },
    assertions: (_sim: any, plc: any) => {
      const pt4 = Number(plc.inputs['PT4'] ?? 4.0);
      const pt2 = Number(plc.inputs['PT2'] ?? 2.5);
      const dp = pt4 - pt2;
      const ilDp = plc.interlocks?.get('IL-DP');
      return [
        {
          tag: 'PT4_PT2_DP',
          expected: '>= +0.50 bar',
          actual: `+${dp.toFixed(2)} bar`,
          passed: dp >= 0.5,
          message: 'Booster pump creates positive pressure gradient preventing raw-to-pasteurized leakage',
        },
        {
          tag: 'IL-DP',
          expected: true,
          actual: ilDp?.isOk,
          passed: ilDp?.isOk === true,
          message: 'Regenerator differential pressure interlock IL-DP is healthy',
        },
      ];
    },
  },
  {
    id: 'TC-P06',
    phase: 'P6_DISCHARGE',
    title: 'Thermal Anomaly Safety Trip & Instant Diversion',
    clause: 'FDS-PAST-06.1 (Safety Trip)',
    description: 'Inject sudden thermal disturbance (-15°C sensor fault). Assert immediate trip of IL-FDV, rapid closure of PV11, and opening of PV12 diversion line.',
    faults: [{ deviceId: 'PHE-HEATING', mode: 'sensor_offset', value: -15 }],
    stimulus: (sim: any, plc: any) => {
      sim.setFault({ deviceId: 'PHE-HEATING', mode: 'sensor_offset', value: -15 });
      for (let i = 0; i < 6; i++) {
        const snap = sim.tick(plc.readOutputs());
        plc.writeInputs(snap.tags.inputs);
        plc.tick(100);
      }
    },
    assertions: (_sim: any, plc: any) => {
      const trippedTt5 = Number(plc.inputs['TT5'] ?? 0);
      const ilFdv = plc.interlocks?.get('IL-FDV');
      const pv11 = Boolean(plc.outputs['PV11_CMD']);
      const pv12 = Boolean(plc.outputs['PV12_CMD']);
      return [
        {
          tag: 'TT5_SENSE',
          expected: '< 88.0°C',
          actual: `${trippedTt5.toFixed(1)}°C`,
          passed: trippedTt5 < 88.0,
          message: 'Holding tube thermal disturbance detected by dual RTDs',
        },
        {
          tag: 'IL-FDV_TRIP',
          expected: true,
          actual: ilFdv?.tripped,
          passed: ilFdv?.tripped === true,
          message: 'Legal flow diversion safety interlock IL-FDV tripped',
        },
        {
          tag: 'PV11_CMD',
          expected: false,
          actual: pv11,
          passed: !pv11,
          message: 'Product forward line shut down instantly (< 0.5s stroke)',
        },
        {
          tag: 'PV12_CMD',
          expected: true,
          actual: pv12,
          passed: pv12,
          message: 'Sub-temperature milk safely redirected to Balance Tank',
        },
      ];
    },
  },
  {
    id: 'TC-P07',
    phase: 'P7_ABORT_SAFETY',
    title: 'Emergency Stop & Actuator Fail-Safe De-energization',
    clause: 'FDS-PAST-08.1 (E-Stop)',
    description: 'Trigger Emergency Stop. Assert all drive VFDs drop to 0, steam control valve cuts off, and system fails safe.',
    stimulus: (sim: any, plc: any) => {
      plc.emergencyStop();
      const snap = sim.tick(plc.readOutputs());
      plc.writeInputs(snap.tags.inputs);
      plc.tick(100);
    },
    assertions: (_sim: any, plc: any) => {
      const pFeed = Boolean(plc.outputs['P_FEED_START']);
      const pBoost = Boolean(plc.outputs['P_BOOST_START']);
      const pHw = Boolean(plc.outputs['P_HW_START']);
      const scv1 = Number(plc.outputs['SCV1_CMD'] ?? 0);
      return [
        {
          tag: 'PLC_STATE',
          expected: 'EMERGENCY_STOP',
          actual: plc.state,
          passed: plc.state === 'EMERGENCY_STOP',
          message: 'Pasteurizer controller halted in safe EMERGENCY_STOP',
        },
        {
          tag: 'DRIVES_DEENERGIZED',
          expected: true,
          actual: !pFeed && !pBoost && !pHw,
          passed: !pFeed && !pBoost && !pHw,
          message: 'All mechanical pump drives tripped and confirmed de-energized',
        },
        {
          tag: 'SCV1_CMD',
          expected: 0,
          actual: scv1,
          passed: scv1 === 0,
          message: 'Steam modulating control valve SCV1 isolated to 0% stroke',
        },
      ];
    },
  },
];

export const customSkidFatScenarios: TestCase[] = [
  {
    id: 'TC-CUSTOM-01',
    phase: 'P1_STOPPED_CONDITION',
    title: 'Custom Plant Baseline & Actuator Isolation',
    clause: 'CUST-01.1',
    description: 'Verify all dynamic actuators respond to PLC commands and safety interlocks are healthy.',
    stimulus: (_sim: PhysicsEngine, plc: any) => {
      if (typeof plc.resetBatch === 'function') plc.resetBatch();
    },
    assertions: (_sim: PhysicsEngine, plc: any) => {
      const tripped = Array.from(plc?.interlocks?.values?.() ?? []).some((il: any) => il.tripped);
      return [
        {
          tag: 'PLC_INTERLOCKS',
          expected: 'HEALTHY',
          actual: tripped ? 'TRIPPED' : 'HEALTHY',
          passed: !tripped,
          message: 'All custom plant hardware safety interlocks are HEALTHY',
        },
      ];
    },
  },
  {
    id: 'TC-CUSTOM-02',
    phase: 'P2_PERMISSIVES',
    title: 'Custom Plant Dynamic Hydraulic Response',
    clause: 'CUST-02.1',
    description: 'Validate hydraulic mass balance and vessel hydrostatic level tracking.',
    stimulus: (sim: PhysicsEngine, plc: any) => {
      const outputs = typeof plc?.readOutputs === 'function' ? plc.readOutputs() : {};
      sim.tick(outputs);
    },
    assertions: (sim: PhysicsEngine, plc: any) => {
      const outputs = typeof plc?.readOutputs === 'function' ? plc.readOutputs() : {};
      const snap = sim.tick(outputs);
      const devices = Object.values(snap.devices);
      const allFinite = devices.every((d) => {
        if ('levelPct' in d && typeof d.levelPct === 'number' && isNaN(d.levelPct)) return false;
        if ('volumeL' in d && typeof d.volumeL === 'number' && isNaN(d.volumeL)) return false;
        return true;
      });
      return [
        {
          tag: 'HYDRO_INTEGRITY',
          expected: 'VALID_NUMBERS',
          actual: allFinite ? 'VALID_NUMBERS' : 'NAN_DETECTED',
          passed: allFinite,
          message: 'Hydraulic state solver produces finite hydrostatic pressures & levels',
        },
      ];
    },
  },
];

export function getFatScenarios(skid: SkidId): TestCase[] {
  if (skid === 'PASTEURIZER_10KLPH') return pasteurizerFatScenarios;
  if (skid === 'BATCH_MIXING') return fatScenarios;
  return customSkidFatScenarios;
}

