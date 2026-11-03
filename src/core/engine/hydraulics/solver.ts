/**
 * TwinForge Studio - Hydraulic Operating Point Solver
 * Solves series pipeline operating points using strictly BISECTION.
 * (No Newton-Raphson as per AGENTS.md / user requirements).
 */

import {
  type HydraulicElement,
  type FluidState,
  type OperatingPointResult,
  GRAVITY_M_S2,
} from './types';

export interface SolverOptions {
  maxFlowLph?: number; // Rated pump maximum flow
  toleranceLph?: number; // Default 1 L/h
  inletPressureBar?: number; // Starting boundary pressure
  maxIterations?: number; // Safety guard
}

/**
 * Solves the operating point where pump head equals series hydraulic resistance.
 * F(Q) = ΔP_pump(Q) - ∑ ΔP_element(Q) = 0
 */
export function solveSeriesOperatingPoint(
  pumpHeadM: (flowLph: number) => number,
  elements: HydraulicElement[],
  fluid: FluidState,
  options: SolverOptions = {}
): OperatingPointResult {
  const maxFlowLph = options.maxFlowLph ?? 16000;
  const toleranceLph = options.toleranceLph ?? 1.0;
  const inletPressureBar = options.inletPressureBar ?? 0.0;
  const maxIterations = options.maxIterations ?? 100;

  // Residual function: net head/pressure driving flow (bar)
  const calcResidual = (flowLph: number): number => {
    const headM = pumpHeadM(flowLph);
    const pumpDeltaPBar = (fluid.densityKgM3 * GRAVITY_M_S2 * headM) / 100000;

    let systemLossBar = 0;
    for (const elem of elements) {
      systemLossBar += elem.pressureDropBar(flowLph, fluid);
    }

    return pumpDeltaPBar - systemLossBar;
  };

  const computeNodePressures = (flowLph: number): Record<string, number> => {
    const pressures: Record<string, number> = {};
    let currentP = inletPressureBar;
    pressures['inlet'] = Number(currentP.toFixed(4));

    for (const elem of elements) {
      const drop = elem.pressureDropBar(flowLph, fluid);
      currentP = currentP - drop;
      pressures[elem.id] = Number(currentP.toFixed(4));
    }

    return pressures;
  };

  const a = 0;
  const b = 1.5 * maxFlowLph;

  const f0 = calcResidual(a);

  // If pump shut-off head is less than static head / initial resistance, forward flow cannot occur
  if (f0 < 0) {
    return {
      flowLph: 0,
      noForwardFlow: true,
      flowAboveBracket: false,
      headM: pumpHeadM(0),
      pressuresBar: computeNodePressures(0),
    };
  }

  const fb = calcResidual(b);

  // When residual is still positive at the top of the bracket (pump head exceeds losses across the whole range)
  if (fb > 0) {
    return {
      flowLph: b,
      noForwardFlow: false,
      flowAboveBracket: true,
      headM: Number(pumpHeadM(b).toFixed(2)),
      pressuresBar: computeNodePressures(b),
    };
  }

  // Bracket [low, high]
  let low = a;
  let high = b;
  let flow = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    flow = 0.5 * (low + high);

    if (high - low <= toleranceLph) {
      break;
    }

    const fMid = calcResidual(flow);
    if (Math.abs(fMid) < 1e-7) {
      break;
    }

    const fLow = calcResidual(low);
    if (fLow * fMid <= 0) {
      high = flow;
    } else {
      low = flow;
    }
  }

  return {
    flowLph: Number(flow.toFixed(2)),
    noForwardFlow: false,
    flowAboveBracket: false,
    headM: Number(pumpHeadM(flow).toFixed(2)),
    pressuresBar: computeNodePressures(flow),
  };
}
