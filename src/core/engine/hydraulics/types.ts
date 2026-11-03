/**
 * TwinForge Studio - Hydraulic Elements & Operating Point Solver
 * Series hydraulic element definitions and fluid state.
 */

export type ParameterSource = 'datasheet' | 'placeholder';

export interface NumericParameter<T = number> {
  value: T;
  source: ParameterSource;
}

export interface FluidState {
  densityKgM3: number;
  viscosityPaS: number;
  temperatureC: number;
}

/**
 * Raw milk reference fluid state at 4 °C
 * Density: 1032 kg/m³, Viscosity: 0.0030 Pa·s (3.0 cP)
 */
export const RAW_MILK_FLUID: FluidState = {
  densityKgM3: 1032,
  viscosityPaS: 0.0030,
  temperatureC: 4.0,
};

export const GRAVITY_M_S2 = 9.80665;

export interface HydraulicElement {
  id: string;
  pressureDropBar(flowLph: number, fluid: FluidState): number; // >= 0 for forward flow
}

export interface OperatingPointResult {
  flowLph: number;
  noForwardFlow: boolean;
  flowAboveBracket: boolean;
  headM: number;
  pressuresBar: Record<string, number>;
}
