import { describe, it, expect } from 'vitest';
import { PipeElement, ValveElement, StaticHeadElement } from '../elements';
import { solveSeriesOperatingPoint } from '../solver';
import { RAW_MILK_FLUID } from '../types';
import { RawMilkSupplyCircuit } from '../../circuits/RawMilkSupplyCircuit';

describe('Hydraulic Operating Point Solver', () => {
  it('returns upper bracket value and flowAboveBracket = true when residual is positive across the entire bracket', () => {
    // Constant 30 m pump head
    const pumpHeadFn = () => 30.0;

    // 0.1 m, 200 mm pipe (very low loss)
    const largeShortPipe = new PipeElement({
      id: 'PIPE-LARGE-SHORT',
      lengthM: { value: 0.1, source: 'placeholder' },
      diameterMm: { value: 200.0, source: 'placeholder' },
      roughnessMm: { value: 0.0015, source: 'placeholder' },
      fittingsK: { value: 0.0, source: 'placeholder' },
    });

    const maxFlowLph = 16000;
    const expectedUpperBracket = 1.5 * maxFlowLph; // 24,000 L/h

    const res = solveSeriesOperatingPoint(
      pumpHeadFn,
      [largeShortPipe],
      RAW_MILK_FLUID,
      { maxFlowLph }
    );

    expect(res.flowAboveBracket).toBe(true);
    expect(res.noForwardFlow).toBe(false);
    expect(res.flowLph).toBe(expectedUpperBracket);
  });

  it('includes pump head in computeNodePressures and equals circuit dischargePressureBar', () => {
    const circuit = new RawMilkSupplyCircuit();
    // Ramp up across 2.5 seconds with PV-1 open
    let out = circuit.step(0.1, { startCmd: true, pv1PositionPct: 100 });
    for (let t = 0.1; t < 2.5; t += 0.1) {
      out = circuit.step(0.1, { startCmd: true, pv1PositionPct: 100 });
    }

    expect(out.nodePressuresBar).toBeDefined();
    const pumpDischargeNodeP = out.nodePressuresBar!['pump'];
    expect(pumpDischargeNodeP).toBeCloseTo(out.dischargePressureBar, 2);

    // Verify node pressures after pump equal suction pressure + pump DeltaP - downstream losses
    const suctionNodeP = out.nodePressuresBar!['PIPE-SUCTION'];
    expect(suctionNodeP).toBeCloseTo(out.suctionPressureBar, 2);
    expect(pumpDischargeNodeP).toBeGreaterThan(suctionNodeP);

    const dischargePipeNodeP = out.nodePressuresBar!['PIPE-DISCHARGE'];
    expect(dischargePipeNodeP).toBeLessThan(pumpDischargeNodeP);
  });

  it('verifies general solver invariant: for any series circuit whose start and end are both at atmospheric pressure, the last node pressure equals the start pressure at the solved flow', () => {
    const pAtmBar = 1.01325;
    const dropStatic = new StaticHeadElement({
      id: 'STATIC-DROP',
      deltaZM: { value: -3.5, source: 'placeholder' },
    });
    const pipeSuction = new PipeElement({
      id: 'PIPE-SUCTION-GEN',
      lengthM: { value: 8.0, source: 'placeholder' },
      diameterMm: { value: 50.0, source: 'placeholder' },
      fittingsK: { value: 2.5, source: 'placeholder' },
    });
    const pipeDischarge = new PipeElement({
      id: 'PIPE-DISCHARGE-GEN',
      lengthM: { value: 18.0, source: 'placeholder' },
      diameterMm: { value: 50.0, source: 'placeholder' },
      fittingsK: { value: 5.0, source: 'placeholder' },
    });
    const valve = new ValveElement({
      id: 'VALVE-GEN',
      Kv: { value: 45.0, source: 'placeholder' },
      positionPct: 90,
    });
    const riseStatic = new StaticHeadElement({
      id: 'STATIC-RISE',
      deltaZM: { value: 2.5, source: 'placeholder' },
    });

    const elements = [dropStatic, pipeSuction, pipeDischarge, valve, riseStatic];
    const pumpHeadFn = (q: number) => 30.0 - 5e-8 * q * q;

    const res = solveSeriesOperatingPoint(
      pumpHeadFn,
      elements,
      RAW_MILK_FLUID,
      {
        inletPressureBar: pAtmBar,
        pumpIndex: 2,
        pumpId: 'pump',
      }
    );

    expect(res.noForwardFlow).toBe(false);
    expect(res.pressuresBar).toBeDefined();

    // The last element in elements is 'STATIC-RISE'
    const lastNodeP = res.pressuresBar['STATIC-RISE'];
    expect(lastNodeP).toBeDefined();
    expect(lastNodeP).toBeCloseTo(pAtmBar, 3);
  });
});
