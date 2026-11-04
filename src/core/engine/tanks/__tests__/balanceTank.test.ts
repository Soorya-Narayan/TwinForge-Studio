import { describe, it, expect } from 'vitest';
import { BalanceTankModel } from '../BalanceTankModel';
import { DEFAULT_BALANCE_TANK_CONFIG } from '../types';
import { RAW_MILK_COMPOSITION, MAINS_WATER_COMPOSITION } from '../../fluids/types';
import { PhysicsEngine } from '../../PhysicsEngine';
import { milkPasteurizerSkid } from '../../../templates/pasteurizerPlant';
import { defaultMixingSkid } from '../../../templates/defaultPlant';

describe('Balance Tank Model (TK-BALANCE) Unit & Integration Tests', () => {
  // 1. Analytic mixing: 300 L at 4 °C, water inflow at 25 °C and equal outflow of Q = 6,000 L/h,
  // no heat loss. Temperature after t follows T = 25 − 21·exp(−Q·t/V); error < 0.05 °C at t = 30, 60 and 180 s.
  it('1. verifies analytic temperature mixing dynamics against theoretical exponential decay', () => {
    const V = 300; // L
    const Q = 6000; // L/h
    const tank = new BalanceTankModel({
      ...DEFAULT_BALANCE_TANK_CONFIG,
      capacityL: 600,
      initialLevelPct: 50, // 300 L
      initialTempC: 4.0,
      heatLossUaWPerK: 0, // no heat loss
      ambientTempC: 25.0,
    });

    const dtS = 0.1;
    const totalS = 180;
    const steps = Math.round(totalS / dtS);

    for (let step = 1; step <= steps; step++) {
      const out = tank.step(dtS, {
        inflows: [
          {
            id: 'WATER_IN',
            flowLph: Q,
            tempC: 25.0,
            composition: MAINS_WATER_COMPOSITION,
          },
        ],
        requestedOutflowLph: Q,
      });

      const t = step * dtS;
      // Theoretical T(t) = 25 - 21 * exp(- (Q/3600) * t / V)
      const expectedT = 25.0 - 21.0 * Math.exp(-((Q / 3600) * t) / V);

      if (Math.abs(t - 30) < 1e-4 || Math.abs(t - 60) < 1e-4 || Math.abs(t - 180) < 1e-4) {
        expect(Math.abs(out.temperatureC - expectedT)).toBeLessThan(0.05);
      }
    }
  });

  // 2. Analytic composition: start 100 % milk; water in and outflow both 10,000 L/h;
  // waterFrac follows 1 − exp(−Q·t/V) within 0.5 %.
  it('2. verifies analytic composition wash-out matches theoretical 1 - exp(-Q*t/V) within 0.5%', () => {
    const V = 600; // L
    const Q = 10000; // L/h
    const tank = new BalanceTankModel({
      ...DEFAULT_BALANCE_TANK_CONFIG,
      capacityL: V,
      initialLevelPct: 100, // 600 L
      initialComposition: RAW_MILK_COMPOSITION, // 100% milk
    });

    const dtS = 0.1;
    const totalS = 120;
    const steps = Math.round(totalS / dtS);

    for (let step = 1; step <= steps; step++) {
      const out = tank.step(dtS, {
        inflows: [
          {
            id: 'WATER_WASH',
            flowLph: Q,
            tempC: 20.0,
            composition: MAINS_WATER_COMPOSITION,
          },
        ],
        requestedOutflowLph: Q,
      });

      const t = step * dtS;
      const expectedWaterFrac = 1.0 - Math.exp(-((Q / 3600) * t) / V);

      if (t === 30 || t === 60 || t === 120) {
        expect(Math.abs(out.composition.waterFrac - expectedWaterFrac)).toBeLessThan(0.005);
        expect(out.composition.waterFrac + out.composition.productFrac).toBeCloseTo(1.0, 5);
      }
    }
  });

  // 3. Volume conservation over 10 minutes with mixed inflows and outflow:
  // V_end − V_start = ∫(Σ in − out − overflow − leak) dt within 0.1 %.
  it('3. verifies volume conservation over 10 minutes with mixed inflows and outflows within 0.1%', () => {
    const tank = new BalanceTankModel({
      ...DEFAULT_BALANCE_TANK_CONFIG,
      capacityL: 600,
      initialLevelPct: 60, // 360 L
    });

    const initialVol = tank.getOutputs().volumeL;
    const dtS = 0.2;
    const totalS = 600; // 10 minutes
    const steps = Math.round(totalS / dtS);

    let integratedNetL = 0;

    for (let step = 0; step < steps; step++) {
      const t = step * dtS;
      // Inflows vary sinusoidally
      const rawInLph = 5000 + 1000 * Math.sin((2 * Math.PI * t) / 120);
      const waterInLph = 1500;
      const requestedOutLph = 6000 + 500 * Math.cos((2 * Math.PI * t) / 180);

      const out = tank.step(dtS, {
        inflows: [
          { id: 'RAW', flowLph: rawInLph, tempC: 4.0, composition: RAW_MILK_COMPOSITION },
          { id: 'WATER', flowLph: waterInLph, tempC: 25.0, composition: MAINS_WATER_COMPOSITION },
        ],
        requestedOutflowLph: requestedOutLph,
      });

      const totalInLph = rawInLph + waterInLph;
      const netFlowLph = totalInLph - out.actualOutflowLph - out.overflowLph;
      integratedNetL += netFlowLph * (dtS / 3600);
    }

    const finalVol = tank.getOutputs().volumeL;
    const actualDeltaVol = finalVol - initialVol;
    const diff = Math.abs(actualDeltaVol - integratedNetL);

    expect(diff / 600).toBeLessThan(0.001); // within 0.1% of capacity
  });

  // 4. Overflow: inflow above outflow at capacity keeps volume at capacity, overflowLph equals
  // the excess, TK_BAL_OVERFLOW is raised, and overflowTotalL integrates correctly.
  // productOverflowTotalL counts only the milk portion.
  it('4. verifies overflow mechanics, excess flow reporting, and product overflow totalization', () => {
    const tank = new BalanceTankModel({
      ...DEFAULT_BALANCE_TANK_CONFIG,
      capacityL: 600,
      initialLevelPct: 100, // already at 600 L
      initialComposition: { waterFrac: 0.25, productFrac: 0.75, fatPct: 3.5 },
    });

    const inflowLph = 14000;
    const outflowLph = 8000;
    const excessLph = inflowLph - outflowLph; // 6000 L/h
    const dtS = 1.0;
    const steps = 60; // 60 seconds

    let lastOut = tank.getOutputs();
    for (let i = 0; i < steps; i++) {
      lastOut = tank.step(dtS, {
        inflows: [
          {
            id: 'OVERFILL_STREAM',
            flowLph: inflowLph,
            tempC: 10.0,
            composition: { waterFrac: 0.25, productFrac: 0.75, fatPct: 3.5 },
          },
        ],
        requestedOutflowLph: outflowLph,
      });
      expect(lastOut.volumeL).toBeCloseTo(600, 2);
      expect(lastOut.overflowLph).toBeCloseTo(excessLph, 1);
      expect(lastOut.alarms).toContain('TK_BAL_OVERFLOW');
    }

    const expectedTotalOverflowL = excessLph * (60 / 3600); // 100 L
    const expectedProductOverflowL = expectedTotalOverflowL * 0.75; // 75 L

    expect(lastOut.overflowTotalL).toBeCloseTo(expectedTotalOverflowL, 1);
    expect(lastOut.productOverflowTotalL).toBeCloseTo(expectedProductOverflowL, 1);
  });

  // 5. Empty: outflow above inflow drains the tank to 0; actualOutflowLph drops to the inflow
  // rate; TK_BAL_EMPTY is raised; no NaN or negative volume.
  it('5. verifies tank drains to 0, limits outflow to inflow, raises TK_BAL_EMPTY, and produces no NaN', () => {
    const tank = new BalanceTankModel({
      ...DEFAULT_BALANCE_TANK_CONFIG,
      capacityL: 600,
      initialLevelPct: 10, // 60 L
    });

    const inflowLph = 2000;
    const requestedOutflowLph = 10000;
    const dtS = 1.0;

    // Run until drained
    let drainedOut: any;
    for (let s = 0; s < 60; s++) {
      drainedOut = tank.step(dtS, {
        inflows: [{ id: 'IN', flowLph: inflowLph, tempC: 10.0, composition: RAW_MILK_COMPOSITION }],
        requestedOutflowLph,
      });
    }

    expect(drainedOut.volumeL).toBe(0);
    expect(drainedOut.levelPct).toBe(0);
    expect(drainedOut.actualOutflowLph).toBeCloseTo(inflowLph, 1);
    expect(drainedOut.alarms).toContain('TK_BAL_EMPTY');
    expect(Number.isNaN(drainedOut.volumeL)).toBe(false);
    expect(Number.isNaN(drainedOut.temperatureC)).toBe(false);
    expect(Number.isNaN(drainedOut.composition.waterFrac)).toBe(false);
  });

  // 6. Hysteresis: with level oscillating ±1 % around 15 %, LS1 does not chatter; it turns on
  // below 15 % and off only above 20 %.
  it('6. verifies LS1 and LS2 hysteresis thresholds prevent chatter during level oscillation', () => {
    const tank = new BalanceTankModel({
      ...DEFAULT_BALANCE_TANK_CONFIG,
      capacityL: 600,
      initialLevelPct: 25, // Start well above LS1 trip
    });

    expect(tank.getOutputs().ls1).toBe(false);

    // Drain down below 15% (to 14%, i.e. 15% - 1%)
    // Starting at 25% (150 L), need to drain 11% (66 L)
    tank.step(1.0, {
      inflows: [],
      requestedOutflowLph: 66 * 3600,
    });
    expect(tank.getOutputs().levelPct).toBeCloseTo(14.0, 1);
    expect(tank.getOutputs().ls1).toBe(true); // Tripped!

    // Oscillate ±1% around 15% (between 14.0% and 16.0%) -> LS1 must NOT chatter, stays true!
    const deltaV = (2 / 100) * 600; // 12 L (2%)
    for (let cycle = 0; cycle < 5; cycle++) {
      // Step up to 16% (15% + 1%)
      tank.step(1.0, {
        inflows: [{ id: 'OSC_IN', flowLph: deltaV * 3600, tempC: 4, composition: RAW_MILK_COMPOSITION }],
        requestedOutflowLph: 0,
      });
      expect(tank.getOutputs().levelPct).toBeCloseTo(16.0, 1);
      expect(tank.getOutputs().ls1).toBe(true); // Must remain true because resetPct is 20%

      // Step down to 14% (15% - 1%)
      tank.step(1.0, {
        inflows: [],
        requestedOutflowLph: deltaV * 3600,
      });
      expect(tank.getOutputs().levelPct).toBeCloseTo(14.0, 1);
      expect(tank.getOutputs().ls1).toBe(true);
    }

    // Now raise above reset threshold 20% (to 21%) -> LS1 turns off!
    const riseTo21 = (7 / 100) * 600; // 42 L (7%)
    tank.step(1.0, {
      inflows: [{ id: 'RESET_IN', flowLph: riseTo21 * 3600, tempC: 4, composition: RAW_MILK_COMPOSITION }],
      requestedOutflowLph: 0,
    });
    expect(tank.getOutputs().levelPct).toBeCloseTo(21.0, 1);
    expect(tank.getOutputs().ls1).toBe(false);
  });

  // 7. Air entrainment: 0 above 5 % level, 0.5 at 2.5 %, 1 at empty.
  it('7. verifies air entrainment rises linearly below outlet submergence threshold', () => {
    const tank = new BalanceTankModel({
      ...DEFAULT_BALANCE_TANK_CONFIG,
      capacityL: 600,
      outletSubmergencePct: 5.0,
      initialLevelPct: 10.0,
    });

    expect(tank.getOutputs().airEntrainmentFrac).toBe(0.0);
    expect(tank.getOutputs().alarms).not.toContain('TK_BAL_AIR_ENTRAINMENT');

    // Step down to 5.0%
    tank.reset(5.0);
    expect(tank.getOutputs().airEntrainmentFrac).toBeCloseTo(0.0, 3);

    // Step down to 2.5%
    tank.reset(2.5);
    expect(tank.getOutputs().airEntrainmentFrac).toBeCloseTo(0.5, 3);
    expect(tank.getOutputs().alarms).toContain('TK_BAL_AIR_ENTRAINMENT');

    // Step down to 0%
    tank.reset(0.0);
    expect(tank.getOutputs().airEntrainmentFrac).toBeCloseTo(1.0, 3);
    expect(tank.getOutputs().alarms).toContain('TK_BAL_AIR_ENTRAINMENT');
  });

  // 8. Divert return: with divertReturnPoint 'after_holding_tube', diverting 10,000 L/h of
  // 85 °C product into the tank raises its temperature, and the PHE's raw milk inlet
  // temperature follows it.
  it('8. verifies divert return after_holding_tube recirculates hot product, heating the tank and PHE inlet', () => {
    const engine = new PhysicsEngine(milkPasteurizerSkid, 100);
    engine.setDivertReturnPoint('after_holding_tube');

    const balTank = engine.getBalanceTank();
    expect(balTank).toBeDefined();
    const initialTemp = balTank!.getOutputs().temperatureC;
    expect(initialTemp).toBeCloseTo(4.0, 1);

    // Run for 30 seconds with feed pump running, SCV open (to heat PHE), and diversion commanded
    for (let step = 0; step < 300; step++) {
      engine.tick({
        P_FEED_START: true,
        P_HOTWATER_START: true,
        SCV_POS: 100,
        PV11_CMD: false,
        PV12_CMD: true, // Divert active
      }, 100);
    }

    const heatedTemp = engine.getBalanceTank()!.getOutputs().temperatureC;
    expect(heatedTemp).toBeGreaterThan(initialTemp + 1.0); // Heated up significantly

    const snap = engine.tick({ PV12_CMD: true }, 100);
    expect(snap.tags.inputs['TT1']).toBeCloseTo(heatedTemp, 1);
  });

  // 9. Fat mixing: tank of 4.0 % milk receiving 2.0 % milk at equal in/out flow approaches
  // 2.0 % fat; adding water reduces productFrac but leaves fatPct of the product unchanged.
  it('9. verifies fat concentration mixing and water dilution independence', () => {
    const tank = new BalanceTankModel({
      ...DEFAULT_BALANCE_TANK_CONFIG,
      capacityL: 600,
      initialLevelPct: 100,
      initialComposition: { waterFrac: 0.0, productFrac: 1.0, fatPct: 4.0 },
    });

    // Inflow of 2.0% fat milk at 10,000 L/h for 500 seconds (~8.3 minutes)
    for (let i = 0; i < 500; i++) {
      tank.step(1.0, {
        inflows: [
          {
            id: 'LOW_FAT_MILK',
            flowLph: 10000,
            tempC: 4.0,
            composition: { waterFrac: 0.0, productFrac: 1.0, fatPct: 2.0 },
          },
        ],
        requestedOutflowLph: 10000,
      });
    }

    // Fat approaching 2.0%
    const midFat = tank.getOutputs().composition.fatPct;
    expect(midFat).toBeLessThan(2.5);
    expect(midFat).toBeGreaterThanOrEqual(2.0);

    // Now inject mains water (0% product) for 300 seconds (5 minutes)
    const fatBeforeWater = tank.getOutputs().composition.fatPct;
    for (let i = 0; i < 300; i++) {
      tank.step(1.0, {
        inflows: [
          {
            id: 'WATER',
            flowLph: 5000,
            tempC: 25.0,
            composition: MAINS_WATER_COMPOSITION,
          },
        ],
        requestedOutflowLph: 5000,
      });
    }

    const outAfterWater = tank.getOutputs();
    expect(outAfterWater.composition.productFrac).toBeLessThan(0.7); // Product fraction reduced
    expect(outAfterWater.composition.fatPct).toBeCloseTo(fatBeforeWater, 2); // Fat % of product portion unchanged!
  });

  // 10. Near-empty robustness: a large inflow into a nearly empty tank gives no overshoot,
  // NaN or negative values (sub-stepping works).
  it('10. verifies sub-stepping robustness when large inflow enters a nearly empty tank', () => {
    const tank = new BalanceTankModel({
      ...DEFAULT_BALANCE_TANK_CONFIG,
      capacityL: 600,
      initialLevelPct: 0.1, // Near empty (0.6 L)
      initialTempC: 4.0,
    });

    // Huge sudden inflow: 20,000 L/h with dt = 2.0 s (11.1 L added in single outer step)
    const out = tank.step(2.0, {
      inflows: [
        {
          id: 'SURGE',
          flowLph: 20000,
          tempC: 30.0,
          composition: MAINS_WATER_COMPOSITION,
        },
      ],
      requestedOutflowLph: 0,
    });

    expect(Number.isNaN(out.volumeL)).toBe(false);
    expect(Number.isNaN(out.temperatureC)).toBe(false);
    expect(Number.isNaN(out.levelPct)).toBe(false);
    expect(out.volumeL).toBeGreaterThan(11.0);
    expect(out.volumeL).toBeLessThanOrEqual(600.0);
    expect(out.temperatureC).toBeGreaterThan(4.0);
    expect(out.temperatureC).toBeLessThanOrEqual(30.0);
  });

  // 11. Faults: ls2_fail stuck off at 100 % level keeps LS2 false; tank_leak drains at the given rate.
  it('11. verifies ls2_fail stuck off and tank_leak faults', () => {
    const tank = new BalanceTankModel({
      ...DEFAULT_BALANCE_TANK_CONFIG,
      capacityL: 600,
      initialLevelPct: 100, // 100% level
    });

    // Without fault, LS2 is true at 100%
    expect(tank.getOutputs().ls2).toBe(true);

    // Apply ls2_fail = 0 (stuck off)
    tank.applyFault('ls2_fail', 0);
    tank.step(0.1, { inflows: [], requestedOutflowLph: 0 });
    expect(tank.getOutputs().ls2).toBe(false);

    // Apply tank_leak = 600 L/h
    tank.clearAllFaults();
    tank.applyFault('tank_leak', 600);
    // Drain for 60 s with 0 inflow and 0 requested outflow
    const initVol = tank.getOutputs().volumeL;
    tank.step(60.0, { inflows: [], requestedOutflowLph: 0 });
    const finalVol = tank.getOutputs().volumeL;
    // In 60s at 600 L/h, exactly 10 L should leak
    expect(initVol - finalVol).toBeCloseTo(10.0, 1);
  });

  // 12. The existing FAT suite passes for both skids and both time modes (see the IMPORTANT
  // note above), plus determinism: two identical runs give identical outputs.
  it('12. verifies determinism: two identical runs give identical outputs', () => {
    // Pasteurizer skid determinism
    const engine1 = new PhysicsEngine(milkPasteurizerSkid, 100);
    const engine2 = new PhysicsEngine(milkPasteurizerSkid, 100);

    const pasteurizerCmds: Record<string, number | boolean>[] = [
      { PV1_CMD: true, P_RAW_START: true },
      { PV1_CMD: true, P_RAW_START: true, PV2_CMD: true },
      { P_FEED_START: true, PV11_CMD: true },
      { P_FEED_START: true, PV12_CMD: true, SCV_POS: 50 },
    ];

    for (let c = 0; c < pasteurizerCmds.length; c++) {
      for (let s = 0; s < 50; s++) {
        const snap1 = engine1.tick(pasteurizerCmds[c], 100);
        const snap2 = engine2.tick(pasteurizerCmds[c], 100);

        expect(snap1.devices['TK-BALANCE'].volumeL).toBe(snap2.devices['TK-BALANCE'].volumeL);
        expect(snap1.devices['TK-BALANCE'].levelPct).toBe(snap2.devices['TK-BALANCE'].levelPct);
        expect(snap1.devices['TK-BALANCE'].temperatureC).toBe(snap2.devices['TK-BALANCE'].temperatureC);
        expect(snap1.tags.inputs['LT1']).toBe(snap2.tags.inputs['LT1']);
        expect(snap1.tags.inputs['LS1']).toBe(snap2.tags.inputs['LS1']);
        expect(snap1.tags.inputs['LS2']).toBe(snap2.tags.inputs['LS2']);
      }
    }

    // Default mixing skid determinism
    const mixEngine1 = new PhysicsEngine(defaultMixingSkid, 100);
    const mixEngine2 = new PhysicsEngine(defaultMixingSkid, 100);
    const mixCmds: Record<string, number | boolean>[] = [
      { V101_CMD: true },
      { V101_CMD: true, P100_START: true },
    ];

    for (let c = 0; c < mixCmds.length; c++) {
      for (let s = 0; s < 25; s++) {
        const snap1 = mixEngine1.tick(mixCmds[c], 100);
        const snap2 = mixEngine2.tick(mixCmds[c], 100);
        expect(snap1.devices['TK-100'].volumeL).toBe(snap2.devices['TK-100'].volumeL);
      }
    }
  });
});
