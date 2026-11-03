/**
 * TwinForge Studio - Hydraulic Elements
 * Physical implementation of series pipe, valve, and static head elements.
 */

import {
  type HydraulicElement,
  type FluidState,
  type NumericParameter,
  GRAVITY_M_S2,
} from './types';

export interface PipeElementConfig {
  id: string;
  lengthM: NumericParameter<number>;
  diameterMm: NumericParameter<number>;
  roughnessMm?: NumericParameter<number>;
  fittingsK?: NumericParameter<number>;
}

export class PipeElement implements HydraulicElement {
  public readonly id: string;
  public readonly lengthM: number;
  public readonly diameterMm: number;
  public readonly roughnessMm: number;
  public fittingsK: number;

  constructor(config: PipeElementConfig) {
    this.id = config.id;
    this.lengthM = config.lengthM.value;
    this.diameterMm = config.diameterMm.value;
    this.roughnessMm = config.roughnessMm?.value ?? 0.0015;
    this.fittingsK = config.fittingsK?.value ?? 0;
  }

  public pressureDropBar(flowLph: number, fluid: FluidState): number {
    if (flowLph <= 0) {
      return 0;
    }

    const D = this.diameterMm / 1000; // m
    const A = (Math.PI / 4) * D * D; // m²
    const Q_m3s = flowLph / (3600 * 1000); // m³/s
    const v = Q_m3s / A; // m/s

    const Re = (fluid.densityKgM3 * v * D) / fluid.viscosityPaS;

    let f = 0;
    if (Re > 0) {
      if (Re < 2300) {
        // Laminar regime
        f = 64 / Re;
      } else {
        // Turbulent regime: Swamee-Jain formula
        const eps = this.roughnessMm / 1000;
        const term = (eps / D) / 3.7 + 5.74 / Math.pow(Re, 0.9);
        f = 0.25 / Math.pow(Math.log10(term), 2);
      }
    }

    const dynamicPressurePa = 0.5 * fluid.densityKgM3 * v * v;
    const deltaP_pipePa = f * (this.lengthM / D) * dynamicPressurePa;
    const deltaP_fittingsPa = this.fittingsK * dynamicPressurePa;
    const totalPa = deltaP_pipePa + deltaP_fittingsPa;

    return Math.max(0, totalPa / 100000); // bar
  }
}

export interface ValveElementConfig {
  id: string;
  Kv: NumericParameter<number>; // m³/h at 1 bar ΔP with water
  positionPct?: number; // 0 to 100
  characteristic?: 'linear';
}

export class ValveElement implements HydraulicElement {
  public readonly id: string;
  public readonly Kv: number;
  public positionPct: number;
  public readonly characteristic: 'linear';

  constructor(config: ValveElementConfig) {
    this.id = config.id;
    this.Kv = config.Kv.value;
    this.positionPct = config.positionPct ?? 100;
    this.characteristic = config.characteristic ?? 'linear';
  }

  public pressureDropBar(flowLph: number, fluid: FluidState): number {
    if (flowLph <= 0) {
      return 0;
    }

    const x = Math.max(0, Math.min(1, this.positionPct / 100));
    if (x <= 0) {
      // 0% position blocks flow completely
      return 1e9;
    }

    const fx = x; // Linear characteristic: f(x) = x
    const effectiveKv = this.Kv * fx;
    if (effectiveKv <= 1e-6) {
      return 1e9;
    }

    const SG = fluid.densityKgM3 / 1000; // Specific gravity relative to water
    const Q_m3h = flowLph / 1000; // m³/h

    const deltaPBar = SG * Math.pow(Q_m3h / effectiveKv, 2);
    return Math.max(0, deltaPBar);
  }
}

export interface StaticHeadElementConfig {
  id: string;
  deltaZM: NumericParameter<number>; // Elevation change: z_out - z_in (m)
}

export class StaticHeadElement implements HydraulicElement {
  public readonly id: string;
  public deltaZM: number;

  constructor(config: StaticHeadElementConfig) {
    this.id = config.id;
    this.deltaZM = config.deltaZM.value;
  }

  public pressureDropBar(_flowLph: number, fluid: FluidState): number {
    // ΔP = ρ * g * Δz (Pa). Positive when elevation increases (opposes flow)
    const deltaPPa = fluid.densityKgM3 * GRAVITY_M_S2 * this.deltaZM;
    return deltaPPa / 100000; // bar (can be negative if flowing downhill)
  }
}

export class PumpElement implements HydraulicElement {
  public readonly id: string;
  public readonly pumpHeadM: (flowLph: number) => number;

  constructor(id: string, pumpHeadM: (flowLph: number) => number) {
    this.id = id;
    this.pumpHeadM = pumpHeadM;
  }

  public pressureDropBar(flowLph: number, fluid: FluidState): number {
    const head = this.pumpHeadM(flowLph);
    return -(fluid.densityKgM3 * GRAVITY_M_S2 * head) / 100000;
  }
}
