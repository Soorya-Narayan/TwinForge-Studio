/**
 * TwinForge Studio - Water Inlet Supply Circuit
 * Models the hydraulic series path:
 * Mains Water Supply (Boundary) -> Pipe -> PV-2 Valve -> Balance Tank Top Inlet
 *
 * All numeric parameters are PLACEHOLDERS with source: 'placeholder'.
 */

import {
  type FluidState,
  GRAVITY_M_S2,
  PipeElement,
  ValveElement,
  StaticHeadElement,
  solveSeriesOperatingPoint,
} from '../hydraulics/index';

export const WATER_FLUID: FluidState = {
  densityKgM3: 997.0,
  viscosityPaS: 0.00089,
  temperatureC: 25.0,
};

export interface WaterCircuitOutputs {
  flowLph: number;
  flowLpm: number;
  waterTempC: number;
  supplyPressureBar: number; // Gauge supply pressure (bar g)
  supplyPressureAbsBar: number; // Absolute supply pressure (bar abs)
  nodePressuresBar?: Record<string, number>;
  alarms: string[];
}

export interface WaterInletCircuitConfig {
  ratedPv2Kv?: number;
  pipeLengthM?: number;
  pipeDiameterMm?: number;
  fittingsK?: number;
  inletElevationM?: number;
  supplyTempC?: number;
}

export class WaterInletCircuit {
  public readonly pipe: PipeElement;
  public readonly pv2Valve: ValveElement;
  public readonly staticHead: StaticHeadElement;

  public supplyTempC: number = 25.0;
  public inletElevationM: number = 2.0;

  private circuitFaults: Set<string> = new Set();
  private lastOutputs: WaterCircuitOutputs;

  constructor(config?: WaterInletCircuitConfig) {
    if (config?.supplyTempC !== undefined) this.supplyTempC = config.supplyTempC;
    if (config?.inletElevationM !== undefined) this.inletElevationM = config.inletElevationM;

    // Pipe: 48 mm bore, 10 m length, fittings K = 5
    this.pipe = new PipeElement({
      id: 'PIPE-WATER',
      lengthM: { value: config?.pipeLengthM ?? 10.0, source: 'placeholder' },
      diameterMm: { value: config?.pipeDiameterMm ?? 48.0, source: 'placeholder' },
      roughnessMm: { value: 0.0015, source: 'placeholder' },
      fittingsK: { value: config?.fittingsK ?? 5.0, source: 'placeholder' },
    });

    // PV-2 Valve: Kv = 60, default seat leak Kv = 0.0054 (placeholder ~0.009% of 60)
    this.pv2Valve = new ValveElement({
      id: 'PV-2',
      Kv: { value: config?.ratedPv2Kv ?? 60.0, source: 'placeholder' },
      leakKv: { value: 0.0054, source: 'placeholder' },
      positionPct: 0,
    });

    // Static Head: balance tank top inlet 2.0 m above the supply connection
    this.staticHead = new StaticHeadElement({
      id: 'STATIC-RISE',
      deltaZM: { value: this.inletElevationM, source: 'placeholder' },
    });

    const pAtmBar = 1.01325;
    this.lastOutputs = {
      flowLph: 0,
      flowLpm: 0,
      waterTempC: this.supplyTempC,
      supplyPressureBar: 3.0,
      supplyPressureAbsBar: pAtmBar + 3.0,
      nodePressuresBar: {
        inlet: pAtmBar,
        mains_supply: pAtmBar + 3.0,
        'PIPE-WATER': pAtmBar + 3.0,
        'PV-2': pAtmBar + 3.0,
        'STATIC-RISE': pAtmBar,
      },
      alarms: [],
    };
  }

  public applyFault(mode: string): void {
    this.circuitFaults.add(mode);
  }

  public clearFault(mode: string): void {
    this.circuitFaults.delete(mode);
  }

  public clearAllFaults(): void {
    this.circuitFaults.clear();
  }

  public hasFault(mode: string): boolean {
    return this.circuitFaults.has(mode);
  }

  /**
   * Supply pressure curve (bar gauge):
   * 3.0 bar g at 0 L/h falling quadratically to 2.0 bar g at 10,000 L/h
   * P(Q) = 3.0 - (Q / 10000)^2
   */
  public getSupplyPressureBar(flowLph: number): number {
    if (this.circuitFaults.has('water_supply_loss')) {
      return 0.0;
    }
    const q = Math.max(0, flowLph);
    const drop = Math.pow(q / 10000.0, 2);
    return Math.max(0, 3.0 - drop);
  }

  /**
   * Step the water inlet hydraulic circuit
   */
  public step(
    _dt: number,
    inputs: {
      pv2PositionPct: number;
      pv2EffectiveKv?: number;
      waterTempC?: number;
    }
  ): WaterCircuitOutputs {
    const {
      pv2PositionPct,
      pv2EffectiveKv,
      waterTempC = this.supplyTempC,
    } = inputs;

    const fluid: FluidState = {
      ...WATER_FLUID,
      temperatureC: waterTempC,
    };

    // Update PV-2 position and effective Kv
    this.pv2Valve.positionPct = pv2PositionPct;
    if (pv2EffectiveKv !== undefined) {
      this.pv2Valve.setEffectiveKv(pv2EffectiveKv);
    } else {
      this.pv2Valve.clearEffectiveKv();
    }

    const pAtmBar = 1.01325;
    const alarms: string[] = [];

    if (this.circuitFaults.has('water_supply_loss')) {
      alarms.push('WATER_SUPPLY_LOSS');
      this.lastOutputs = {
        flowLph: 0,
        flowLpm: 0,
        waterTempC,
        supplyPressureBar: 0.0,
        supplyPressureAbsBar: pAtmBar,
        nodePressuresBar: {
          inlet: pAtmBar,
          mains_supply: pAtmBar,
          'PIPE-WATER': pAtmBar,
          'PV-2': pAtmBar,
          'STATIC-RISE': pAtmBar,
        },
        alarms,
      };
      return this.lastOutputs;
    }

    const elements = [
      this.pipe,
      this.pv2Valve,
      this.staticHead,
    ];

    const rhoG = fluid.densityKgM3 * GRAVITY_M_S2;

    const supplyHeadFn = (q: number): number => {
      const pGaugeBar = this.getSupplyPressureBar(q);
      return (pGaugeBar * 100000.0) / rhoG;
    };

    const res = solveSeriesOperatingPoint(
      supplyHeadFn,
      elements,
      fluid,
      {
        maxFlowLph: 25000,
        toleranceLph: 0.1,
        inletPressureBar: pAtmBar,
        pumpIndex: 0,
        pumpId: 'mains_supply',
      }
    );

    const flowLph = res.noForwardFlow ? 0 : Number(res.flowLph.toFixed(2));
    const flowLpm = Number((flowLph / 60.0).toFixed(2));
    const supplyPressureBar = Number(this.getSupplyPressureBar(flowLph).toFixed(3));
    const supplyPressureAbsBar = Number((pAtmBar + supplyPressureBar).toFixed(3));

    this.lastOutputs = {
      flowLph,
      flowLpm,
      waterTempC,
      supplyPressureBar,
      supplyPressureAbsBar,
      nodePressuresBar: res.pressuresBar,
      alarms,
    };

    return this.lastOutputs;
  }

  public getOutputs(): WaterCircuitOutputs {
    return { ...this.lastOutputs };
  }
}
