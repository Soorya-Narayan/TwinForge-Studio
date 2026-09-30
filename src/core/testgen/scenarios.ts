/**
 * TwinForge Studio - Pre-configured Executable FAT Test Scenarios
 * Mapped to standard functional acceptance test procedures.
 */

import type { TestCase } from './types';
import type { MockPlcDriver } from '../driver/MockPlcDriver';
import type { PhysicsEngine } from '../engine/PhysicsEngine';

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
      // Tick 2 seconds so valve travels to 100% and pump starts
      for (let i = 0; i < 20; i++) {
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
      // Simulate heating loop
      for (let i = 0; i < 30; i++) {
        const snap = sim.tick({ ...plc.readOutputs(), TCV100_CMD: 80 });
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
      for (let i = 0; i < 15; i++) {
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
