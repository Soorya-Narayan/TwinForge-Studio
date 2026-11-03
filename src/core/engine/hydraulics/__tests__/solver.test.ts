import { describe, it, expect } from 'vitest';
import { PipeElement } from '../elements';
import { solveSeriesOperatingPoint } from '../solver';
import { RAW_MILK_FLUID } from '../types';

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
});
