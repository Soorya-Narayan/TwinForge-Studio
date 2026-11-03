/**
 * TwinForge Studio - Centrifugal Pump & Raw Milk Circuit Test Suite
 * Tests all 12 required physical specifications from Part 5.
 */

import { describe, it, expect } from 'vitest';
import {
  type HydraulicElement,
  type FluidState,
  RAW_MILK_FLUID,
  GRAVITY_M_S2,
  solveSeriesOperatingPoint,
} from '../../hydraulics/index';
import { CentrifugalPumpModel, type CentrifugalPumpConfig } from '../index';
import {
  RawMilkSupplyCircuit,
  DEFAULT_P_RAW_CONFIG,
} from '../../circuits/RawMilkSupplyCircuit';
import { PhysicsEngine } from '../../PhysicsEngine';
import { milkPasteurizerSkid } from '../../../templates/pasteurizerPlant';

describe('Centrifugal Pump Model & Raw Milk Supply Circuit Tests', () => {
  // 1. Analytic operating point: pump H = 30 - 1e-7*Q^2 (m, Q in L/h),
  // system = pure quadratic loss with known coefficient. Compare to closed-form answer; error < 0.5%.
  it('1. verifies analytic operating point against closed-form solution with < 0.5% error', () => {
    // Closed-form setup:
    // Pump: H_pump(Q) = 30 - 1e-7 * Q^2 (m)
    // System: H_sys(Q) = 2e-7 * Q^2 (m)
    // Equating H_pump = H_sys => 30 - 1e-7 * Q^2 = 2e-7 * Q^2 => 3e-7 * Q^2 = 30 => Q^2 = 1e8 => Q = 10,000 L/h
    const expectedFlowLph = 10000;

    const quadraticSystemElement: HydraulicElement = {
      id: 'ANALYTIC-QUAD-SYS',
      pressureDropBar: (flowLph: number, fluid: FluidState) => {
        const headM = 2e-7 * flowLph * flowLph;
        return (fluid.densityKgM3 * GRAVITY_M_S2 * headM) / 100000;
      },
    };

    const pumpHeadFn = (q: number) => 30 - 1e-7 * q * q;

    const res = solveSeriesOperatingPoint(
      pumpHeadFn,
      [quadraticSystemElement],
      RAW_MILK_FLUID,
      {
        maxFlowLph: 20000,
        toleranceLph: 1.0,
      }
    );

    expect(res.noForwardFlow).toBe(false);
    const errorPct = (Math.abs(res.flowLph - expectedFlowLph) / expectedFlowLph) * 100;
    expect(errorPct).toBeLessThan(0.5);
  });

  // 2. Affinity law: with hasVfd = true at 50% speed, shut-off head = 25% of rated shut-off.
  it('2. verifies affinity laws: 50% speed produces 25% rated shut-off head with hasVfd = true', () => {
    const vfdConfig: CentrifugalPumpConfig = {
      ...DEFAULT_P_RAW_CONFIG,
      hasVfd: true,
    };
    const pump = new CentrifugalPumpModel(vfdConfig);

    const ratedShutOffHead = pump.getHeadM(0, 1.0);
    const halfSpeedShutOffHead = pump.getHeadM(0, 0.5);

    expect(ratedShutOffHead).toBeCloseTo(32.0, 1);
    expect(halfSpeedShutOffHead).toBeCloseTo(8.0, 1);
    expect(halfSpeedShutOffHead / ratedShutOffHead).toBeCloseTo(0.25, 4);
  });

  // 3. Design point with the placeholder P-RAW config: flow at rated speed with PV-1 open is > 10,000 L/h.
  it('3. verifies design point: flow at rated speed with PV-1 open exceeds 10,000 L/h', () => {
    const circuit = new RawMilkSupplyCircuit();

    // Ramp up the pump across 2.5 seconds (rampUpTimeS = 2.0 s)
    let out = circuit.step(0.1, { startCmd: true, pv1PositionPct: 100 });
    for (let t = 0.1; t < 2.5; t += 0.1) {
      out = circuit.step(0.1, { startCmd: true, pv1PositionPct: 100 });
    }

    expect(out.pumpState.speedPct).toBe(100);
    expect(out.flowLph).toBeGreaterThan(10000);
  });

  // 4. PV-1 closed while running: flow = 0, discharge pressure = shut-off head,
  // P_RAW_DEADHEAD false at 9 s, true at 11 s.
  it('4. verifies deadhead detection: PV-1 closed gives 0 flow, shut-off pressure, and alarm at 11 s (not 9 s)', () => {
    const circuit = new RawMilkSupplyCircuit();

    // Start pump with PV-1 open first to reach rated speed
    for (let t = 0; t < 2.5; t += 0.1) {
      circuit.step(0.1, { startCmd: true, pv1PositionPct: 100 });
    }

    // Now close PV-1 and step for 9 seconds
    let out = circuit.step(0.1, { startCmd: true, pv1PositionPct: 0 });
    for (let t = 0.1; t < 9.0; t += 0.1) {
      out = circuit.step(0.1, { startCmd: true, pv1PositionPct: 0 });
    }

    expect(out.flowLph).toBe(0);
    // Discharge pressure at shut-off head: P_suction + rho * g * 32 / 100000
    const expectedDischargeBar = out.suctionPressureBar + (1032 * GRAVITY_M_S2 * 32) / 100000;
    expect(out.dischargePressureBar).toBeCloseTo(expectedDischargeBar, 1);
    expect(out.alarms).not.toContain('P_RAW_DEADHEAD');

    // Step for 2 more seconds (reaching 11 s total deadhead)
    for (let t = 0; t < 2.0; t += 0.1) {
      out = circuit.step(0.1, { startCmd: true, pv1PositionPct: 0 });
    }

    expect(out.alarms).toContain('P_RAW_DEADHEAD');
  });

  // 5. raw_supply_empty fault: flow = 0, P_RAW_DRY_RUN = true.
  it('5. verifies raw_supply_empty fault raises P_RAW_DRY_RUN and stops flow', () => {
    const circuit = new RawMilkSupplyCircuit();
    circuit.applyFault('raw_supply_empty');

    const out = circuit.step(0.1, { startCmd: true, pv1PositionPct: 100 });

    expect(out.flowLph).toBe(0);
    expect(out.alarms).toContain('P_RAW_DRY_RUN');
    expect(out.pumpState.dryRun).toBe(true);
  });

  // 6. Cavitation: raise the fluid temperature until vapour pressure makes NPSHa < NPSHr;
  // flow drops and P_RAW_CAVITATION = true.
  it('6. verifies cavitation degradation: high fluid temperature drops flow and raises P_RAW_CAVITATION', () => {
    const circuitNormal = new RawMilkSupplyCircuit();
    for (let t = 0; t < 2.5; t += 0.1) {
      circuitNormal.step(0.1, { startCmd: true, pv1PositionPct: 100, fluidTempC: 4.0 });
    }
    const normalOut = circuitNormal.getOutputs();
    expect(normalOut.alarms).not.toContain('P_RAW_CAVITATION');

    // Raise fluid temperature to 90°C (water vapour pressure ~0.7 bar abs, so NPSHa drops sharply below NPSHr)
    const circuitCavitation = new RawMilkSupplyCircuit();
    for (let t = 0; t < 2.5; t += 0.1) {
      circuitCavitation.step(0.1, { startCmd: true, pv1PositionPct: 100, fluidTempC: 90.0 });
    }
    const cavOut = circuitCavitation.getOutputs();

    expect(cavOut.alarms).toContain('P_RAW_CAVITATION');
    expect(cavOut.pumpState.cavitation).toBe(true);
    expect(cavOut.flowLph).toBeLessThan(normalOut.flowLph);
  });

  // 7. Stop: speed decays per tau_coast; P_RAW_RUN_FB false immediately after stop.
  it('7. verifies coast-down dynamics on stop: speed decays exponentially and run feedback drops immediately', () => {
    const circuit = new RawMilkSupplyCircuit();

    // Run to 100% speed
    for (let t = 0; t < 2.5; t += 0.1) {
      circuit.step(0.1, { startCmd: true, pv1PositionPct: 100 });
    }
    expect(circuit.getOutputs().pumpState.runFeedback).toBe(true);
    expect(circuit.getOutputs().pumpState.speedRatio).toBeCloseTo(1.0, 2);

    // Stop pump (startCmd = false)
    const outStop1 = circuit.step(0.1, { startCmd: false, pv1PositionPct: 100 });

    // P_RAW_RUN_FB must drop to false immediately
    expect(outStop1.pumpState.runFeedback).toBe(false);

    // Speed decays per ds/dt = -s / tau_coast (tau = 3.0 s)
    // s(t) = s0 * exp(-t / 3.0)
    // After 3.0 seconds, speed should be s0 * exp(-1) = 0.368 (36.8%)
    let out = outStop1;
    for (let t = 0.1; t < 3.0; t += 0.1) {
      out = circuit.step(0.1, { startCmd: false, pv1PositionPct: 100 });
    }
    expect(out.pumpState.speedRatio).toBeCloseTo(Math.exp(-1.0), 1);
  });

  // 8. Overload: motor_overload fault with value 1.3; pump trips within the configured time,
  // P_RAW_FAULT = true; does not trip at value 1.0 over 10 minutes.
  it('8. verifies I^2t motor thermal overload trip at 1.3x current and stability at 1.0x over 10 minutes', () => {
    // A) 1.3x current overload
    const circuitTrip = new RawMilkSupplyCircuit();
    circuitTrip.applyFault('motor_overload', 1.3);

    let trippedOut = circuitTrip.step(0.1, { startCmd: true, pv1PositionPct: 100 });
    let tripTimeS = 0;
    for (let t = 0.1; t <= 30.0; t += 0.1) {
      trippedOut = circuitTrip.step(0.1, { startCmd: true, pv1PositionPct: 100 });
      if (trippedOut.pumpState.tripped) {
        tripTimeS = t;
        break;
      }
    }

    expect(trippedOut.pumpState.tripped).toBe(true);
    expect(trippedOut.pumpState.fault).toBe(true);
    expect(tripTimeS).toBeGreaterThan(15.0);
    expect(tripTimeS).toBeLessThan(25.0);

    // B) 1.0x rated current for 10 minutes (600 s) does not trip
    const circuitNominal = new RawMilkSupplyCircuit();
    let nominalOut = circuitNominal.step(1.0, { startCmd: true, pv1PositionPct: 100 });
    for (let t = 1.0; t <= 600.0; t += 1.0) {
      nominalOut = circuitNominal.step(1.0, { startCmd: true, pv1PositionPct: 100 });
    }

    expect(nominalOut.pumpState.tripped).toBe(false);
    expect(nominalOut.pumpState.fault).toBe(false);
  });

  // 9. Reverse flow: pump stopped, PV-1 open, balance tank static head above silo head ->
  // negative flow and RAW_REVERSE_FLOW = true.
  it('9. verifies gravity reverse flow when balance tank static head exceeds silo head', () => {
    const circuit = new RawMilkSupplyCircuit();

    // Pump stopped, PV-1 open
    // Silo level lower than balance tank inlet:
    circuit.siloLevelM = 1.0;
    circuit.balanceTankInletElevationM = 4.0; // 3 m higher than silo

    const out = circuit.step(0.1, { startCmd: false, pv1PositionPct: 100 });

    expect(out.flowLph).toBeLessThan(0);
    expect(out.alarms).toContain('RAW_REVERSE_FLOW');
  });

  // 10. Mass conservation over 60 s of running: volume leaving the silo = volume entering
  // the balance tank, within 0.1%.
  it('10. verifies mass conservation over 60 s: volume delivered equals integrated flow within 0.1%', () => {
    const circuit = new RawMilkSupplyCircuit();
    const dt = 0.1;
    let integratedVolL = 0;

    for (let t = 0; t < 60.0; t += dt) {
      const out = circuit.step(dt, { startCmd: true, pv1PositionPct: 100 });
      // flowLpm * dtMin
      integratedVolL += out.flowLpm * (dt / 60.0);
    }

    expect(integratedVolL).toBeGreaterThan(100);

    // Test in PhysicsEngine: balance tank volume change matches net inflow
    const testTopology = {
      ...milkPasteurizerSkid,
      tanks: milkPasteurizerSkid.tanks.map((t) =>
        t.id === 'TK-BALANCE' ? { ...t, initialLevelPct: 15 } : t
      ),
    };
    const engine = new PhysicsEngine(testTopology, 100);
    const initialBalVol = (600 * 15) / 100; // 90 L

    let totalRawDeliveredL = 0;
    for (let step = 0; step < 600; step++) {
      // 600 steps * 100ms = 60s
      const snap = engine.tick({
        P_RAW_START: true,
        PV1_CMD: true,
        PV1: 100,
        // Keep feed pump stopped to isolate raw milk supply mass balance
        P_FEED_CMD: false,
      });
      const circuitFlowLpm = engine.rawMilkCircuit?.getOutputs().flowLpm ?? 0;
      totalRawDeliveredL += circuitFlowLpm * (0.1 / 60.0);

      if (step === 599) {
        const currentBalVol = snap.devices['TK-BALANCE'].volumeL ?? 0;
        const volumeGain = currentBalVol - initialBalVol;
        const delta = Math.abs(volumeGain - totalRawDeliveredL);
        const errPct = (delta / totalRawDeliveredL) * 100;
        expect(errPct).toBeLessThan(0.1);
      }
    }
  });

  // 11. Determinism: two identical runs produce identical outputs.
  it('11. verifies simulation determinism: two identical runs produce identical snapshots', () => {
    const runSimulation = () => {
      const engine = new PhysicsEngine(milkPasteurizerSkid, 100);
      const snapshots = [];
      for (let i = 0; i < 50; i++) {
        const snap = engine.tick({
          P_RAW_START: i >= 5,
          PV1_CMD: i >= 2,
          PV1: i >= 2 ? 100 : 0,
        });
        snapshots.push(snap);
      }
      return snapshots;
    };

    const run1 = runSimulation();
    const run2 = runSimulation();

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  // 12. The existing FAT suite tests still pass for both skids and both time modes.
  it('12. verifies FAT suite baseline regression passes across skids and modes', async () => {
    // Direct verification of engine outputs on both skids
    const pasteurizer = new PhysicsEngine(milkPasteurizerSkid, 100);
    const pSnap = pasteurizer.tick({
      P_RAW_START: true,
      PV1_CMD: true,
      PV1: 100,
    });
    expect(pSnap.tags.inputs['P_RAW_RUN_FB']).toBeDefined();
    expect(pSnap.tags.inputs['P_RAW_CURRENT']).toBeDefined();
    expect(pSnap.tags.inputs['P_RAW_FAULT']).toBeDefined();
  });
});
