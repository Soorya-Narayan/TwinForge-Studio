import { describe, it, expect } from 'vitest';
import { PipeElement } from '../elements';
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
});
