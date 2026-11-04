/**
 * TwinForge Studio - Sanitary Balance Tank Model
 * Models liquid mass balance, overflow, heat transfer with ambient,
 * multi-component fluid composition mixing, switch hysteresis, and air entrainment.
 */

import type { FluidComposition } from '../fluids/types';
import {
  type BalanceTankConfig,
  type BalanceTankInputs,
  type BalanceTankOutputs,
  type BalanceTankFaultMode,
  type BalanceTankFault,
  type VolumeHeightPoint,
  extractNumeric,
} from './types';

export class BalanceTankModel {
  public readonly id: string;
  public readonly tag: string;
  public readonly capacityL: number;
  public readonly geometry: VolumeHeightPoint[];
  public readonly ambientTempC: number;
  public readonly heatLossUaWPerK: number;
  public readonly outletSubmergencePct: number;
  public readonly ls1Config: { tripPct: number; resetPct: number; type: 'low' };
  public readonly ls2Config: { tripPct: number; resetPct: number; type: 'high' };

  private volumeL: number;
  private temperatureC: number;
  private composition: FluidComposition;
  private ls1State: boolean;
  private ls2State: boolean;
  private overflowTotalL: number = 0;
  private productOverflowTotalL: number = 0;
  private faults: Map<BalanceTankFaultMode, BalanceTankFault> = new Map();
  private lastOutputs: BalanceTankOutputs;

  constructor(config: BalanceTankConfig) {
    this.id = config.id;
    this.tag = config.tag;
    this.capacityL = Math.max(1, extractNumeric(config.capacityL, 600));

    // Sort geometry by volume
    this.geometry = [...config.geometry].sort((a, b) => a.volumeL - b.volumeL);
    if (this.geometry.length === 0) {
      this.geometry = [
        { volumeL: 0, heightMm: 0 },
        { volumeL: this.capacityL, heightMm: 800 },
      ];
    }

    this.ambientTempC = extractNumeric(config.ambientTempC, 25.0);
    this.heatLossUaWPerK = Math.max(0, extractNumeric(config.heatLossUaWPerK, 5.0));
    this.outletSubmergencePct = Math.max(0, extractNumeric(config.outletSubmergencePct, 5.0));

    this.ls1Config = {
      tripPct: extractNumeric(config.ls1.tripPct, 15.0),
      resetPct: extractNumeric(config.ls1.resetPct, 20.0),
      type: 'low',
    };

    this.ls2Config = {
      tripPct: extractNumeric(config.ls2.tripPct, 95.0),
      resetPct: extractNumeric(config.ls2.resetPct, 90.0),
      type: 'high',
    };

    const initialLevelPct = Math.max(0, Math.min(100, extractNumeric(config.initialLevelPct, 75.0)));
    this.volumeL = (this.capacityL * initialLevelPct) / 100.0;
    this.temperatureC = extractNumeric(config.initialTempC, 4.0);
    this.composition = { ...config.initialComposition };

    // Initial switch states based on starting level
    this.ls1State = initialLevelPct < this.ls1Config.tripPct;
    this.ls2State = initialLevelPct > this.ls2Config.tripPct;

    this.lastOutputs = this.computeOutputs(0, 0, false, false);
  }

  public applyFault(mode: BalanceTankFaultMode, value?: number): void {
    this.faults.set(mode, { mode, value });
  }

  public clearFault(mode: BalanceTankFaultMode): void {
    this.faults.delete(mode);
  }

  public clearAllFaults(): void {
    this.faults.clear();
  }

  public getFault(mode: BalanceTankFaultMode): BalanceTankFault | undefined {
    return this.faults.get(mode);
  }

  public getOutputs(): BalanceTankOutputs {
    return this.lastOutputs;
  }

  public getComposition(): FluidComposition {
    return { ...this.composition };
  }

  public reset(initialLevelPct?: number, initialTempC?: number, initialComposition?: FluidComposition): void {
    const lvl = initialLevelPct !== undefined ? Math.max(0, Math.min(100, initialLevelPct)) : 75.0;
    this.volumeL = (this.capacityL * lvl) / 100.0;
    this.temperatureC = initialTempC !== undefined ? initialTempC : 4.0;
    if (initialComposition) {
      this.composition = { ...initialComposition };
    }
    this.ls1State = lvl < this.ls1Config.tripPct;
    this.ls2State = lvl > this.ls2Config.tripPct;
    this.overflowTotalL = 0;
    this.productOverflowTotalL = 0;
    this.clearAllFaults();
    this.lastOutputs = this.computeOutputs(0, 0, false, false);
  }

  /**
   * Execute single simulation scan step
   * @param dtS Scan time step in seconds
   * @param inputs Inflow streams and requested outflow
   */
  public step(dtS: number, inputs: BalanceTankInputs): BalanceTankOutputs {
    if (dtS <= 0) {
      return this.lastOutputs;
    }

    const { inflows, requestedOutflowLph } = inputs;
    const leakFault = this.faults.get('tank_leak');
    const leakRateLph = Math.max(0, leakFault?.value ?? 0);

    const totalInflowLph = inflows.reduce((sum, inf) => sum + Math.max(0, inf.flowLph), 0);
    const safeRequestedOutflowLph = Math.max(0, requestedOutflowLph);

    // 1. Sub-step so that no sub-step changes volume by more than 5 % of capacity
    const maxFlowLph = Math.max(
      totalInflowLph,
      safeRequestedOutflowLph + leakRateLph,
      Math.abs(totalInflowLph - safeRequestedOutflowLph - leakRateLph)
    );
    const maxDeltaV = (maxFlowLph / 3600.0) * dtS;
    const maxAllowedSubstepDeltaV = 0.05 * this.capacityL;
    const nSubSteps = Math.max(1, Math.min(1000, Math.ceil(maxDeltaV / maxAllowedSubstepDeltaV)));
    const subDtS = dtS / nSubSteps;
    const subDtHr = subDtS / 3600.0;

    let emptyAlarmRaised = false;
    let overflowAlarmRaised = false;
    let totalActualOutflowVolL = 0;
    let totalOverflowVolL = 0;

    for (let step = 0; step < nSubSteps; step++) {
      const vStart = this.volumeL;
      const subInflowVolL = totalInflowLph * subDtHr;
      const subLeakVolL = leakRateLph * subDtHr;
      const subOutflowVolL = safeRequestedOutflowLph * subDtHr;

      let v = vStart + subInflowVolL;

      // Leakage
      if (subLeakVolL > 0) {
        const actualLeak = Math.min(v, subLeakVolL);
        v -= actualLeak;
      }

      // Outflow
      let actualSubOutflow = 0;
      if (subOutflowVolL > v) {
        actualSubOutflow = Math.max(0, v);
        v = 0;
        emptyAlarmRaised = true;
      } else {
        actualSubOutflow = subOutflowVolL;
        v -= subOutflowVolL;
      }
      totalActualOutflowVolL += actualSubOutflow;

      // Overflow at capacity
      let subOverflow = 0;
      if (v > this.capacityL) {
        subOverflow = v - this.capacityL;
        v = this.capacityL;
        overflowAlarmRaised = true;
      }
      totalOverflowVolL += subOverflow;
      this.overflowTotalL += subOverflow;
      this.productOverflowTotalL += subOverflow * this.composition.productFrac;

      // 3 & 4 & 5. Temperature and Composition mixing
      const minMixingVolL = 0.02 * this.capacityL;
      if (vStart < minMixingVolL) {
        // Below 2% capacity: freeze updates unless fluid is entering (replaces contents)
        if (subInflowVolL > 0) {
          let sumT = 0;
          let sumWater = 0;
          let sumProduct = 0;
          let sumFatWeight = 0;

          for (const inf of inflows) {
            const infVol = Math.max(0, inf.flowLph) * subDtHr;
            sumT += infVol * inf.tempC;
            sumWater += infVol * inf.composition.waterFrac;
            const pVol = infVol * inf.composition.productFrac;
            sumProduct += pVol;
            sumFatWeight += pVol * inf.composition.fatPct;
          }

          this.temperatureC = sumT / subInflowVolL;
          const wFrac = Math.max(0, Math.min(1, sumWater / subInflowVolL));
          const pFrac = 1.0 - wFrac;
          const fat = sumProduct > 0 ? sumFatWeight / sumProduct : this.composition.fatPct;

          this.composition = {
            waterFrac: wFrac,
            productFrac: pFrac,
            fatPct: fat,
          };
        }
      } else {
        // Standard well-mixed dynamic updates
        // Temperature: dT/dt = (1/V) Σ Q_in (T_in - T) - UA (T - T_ambient) / (ρ cp V)
        // With ρ = 1030 kg/m³, cp = 3930 J/kg·K: ρ cp / 1000 = 4047.9 J/(L·K)
        let dTIn = 0;
        for (const inf of inflows) {
          const infVol = Math.max(0, inf.flowLph) * subDtHr;
          dTIn += (infVol / vStart) * (inf.tempC - this.temperatureC);
        }

        const dTLoss = -((this.heatLossUaWPerK * (this.temperatureC - this.ambientTempC)) / (4047.9 * vStart)) * subDtS;
        this.temperatureC += (dTIn + dTLoss);

        // Composition: dc/dt = (1/V) Σ Q_in (c_in - c)
        let dWaterFrac = 0;
        for (const inf of inflows) {
          const infVol = Math.max(0, inf.flowLph) * subDtHr;
          dWaterFrac += (infVol / vStart) * (inf.composition.waterFrac - this.composition.waterFrac);
        }
        const newWaterFrac = Math.max(0, Math.min(1, this.composition.waterFrac + dWaterFrac));
        const newProductFrac = 1.0 - newWaterFrac;

        // Fat mixing (mixed by product volume)
        const vProductOld = vStart * this.composition.productFrac;
        let addedProductVol = 0;
        let addedFatWeight = 0;
        for (const inf of inflows) {
          const infVol = Math.max(0, inf.flowLph) * subDtHr;
          const pVol = infVol * inf.composition.productFrac;
          addedProductVol += pVol;
          addedFatWeight += pVol * inf.composition.fatPct;
        }

        let newFatPct = this.composition.fatPct;
        const totalProduct = vProductOld + addedProductVol;
        if (totalProduct > 0.0001 && addedProductVol > 0) {
          newFatPct = (vProductOld * this.composition.fatPct + addedFatWeight) / totalProduct;
        }

        this.composition = {
          waterFrac: newWaterFrac,
          productFrac: newProductFrac,
          fatPct: newFatPct,
        };
      }

      this.volumeL = v;
    }

    const actualOutflowLph = totalActualOutflowVolL / (dtS / 3600.0);
    const overflowLph = totalOverflowVolL / (dtS / 3600.0);

    this.lastOutputs = this.computeOutputs(actualOutflowLph, overflowLph, emptyAlarmRaised, overflowAlarmRaised);
    return this.lastOutputs;
  }

  private computeOutputs(
    actualOutflowLph: number,
    overflowLph: number,
    emptyAlarm: boolean,
    overflowAlarm: boolean
  ): BalanceTankOutputs {
    // 6. Level: interpolate geometry table; levelPct = height / max height * 100
    const heightMm = this.interpolateHeight(this.volumeL);
    const maxHeightMm = this.getMaxHeight();
    const levelPct = maxHeightMm > 0 ? (heightMm / maxHeightMm) * 100.0 : 0;

    // 7. Switches with hysteresis
    if (levelPct < this.ls1Config.tripPct) {
      this.ls1State = true;
    } else if (levelPct > this.ls1Config.resetPct) {
      this.ls1State = false;
    }

    if (levelPct > this.ls2Config.tripPct) {
      this.ls2State = true;
    } else if (levelPct < this.ls2Config.resetPct) {
      this.ls2State = false;
    }

    // Fault overrides for limit switches
    let ls1 = this.ls1State;
    const ls1Fault = this.faults.get('ls1_fail');
    if (ls1Fault !== undefined) {
      ls1 = ls1Fault.value === 1;
    }

    let ls2 = this.ls2State;
    const ls2Fault = this.faults.get('ls2_fail');
    if (ls2Fault !== undefined) {
      ls2 = ls2Fault.value === 1;
    }

    // 8. Air entrainment
    let airEntrainmentFrac = 0;
    let airAlarm = false;
    if (levelPct < this.outletSubmergencePct) {
      airEntrainmentFrac = Math.max(0, Math.min(1, (this.outletSubmergencePct - levelPct) / this.outletSubmergencePct));
      airAlarm = true;
    }

    // Alarms
    const alarms: string[] = [];
    if (emptyAlarm) alarms.push('TK_BAL_EMPTY');
    if (overflowAlarm) alarms.push('TK_BAL_OVERFLOW');
    if (airAlarm) alarms.push('TK_BAL_AIR_ENTRAINMENT');

    return {
      volumeL: Number(this.volumeL.toFixed(4)),
      levelPct: Number(levelPct.toFixed(2)),
      temperatureC: Number(this.temperatureC.toFixed(2)),
      composition: {
        waterFrac: Number(this.composition.waterFrac.toFixed(6)),
        productFrac: Number(this.composition.productFrac.toFixed(6)),
        fatPct: Number(this.composition.fatPct.toFixed(4)),
      },
      actualOutflowLph: Number(actualOutflowLph.toFixed(2)),
      overflowLph: Number(overflowLph.toFixed(2)),
      overflowTotalL: Number(this.overflowTotalL.toFixed(4)),
      productOverflowTotalL: Number(this.productOverflowTotalL.toFixed(4)),
      ls1,
      ls2,
      airEntrainmentFrac: Number(airEntrainmentFrac.toFixed(4)),
      alarms,
    };
  }

  private interpolateHeight(volumeL: number): number {
    const pts = this.geometry;
    if (volumeL <= pts[0].volumeL) {
      return pts[0].heightMm;
    }
    if (volumeL >= pts[pts.length - 1].volumeL) {
      return pts[pts.length - 1].heightMm;
    }

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      if (volumeL >= p1.volumeL && volumeL <= p2.volumeL) {
        const deltaV = p2.volumeL - p1.volumeL;
        if (deltaV <= 0) return p1.heightMm;
        const frac = (volumeL - p1.volumeL) / deltaV;
        return p1.heightMm + frac * (p2.heightMm - p1.heightMm);
      }
    }

    return pts[pts.length - 1].heightMm;
  }

  private getMaxHeight(): number {
    return this.geometry[this.geometry.length - 1].heightMm;
  }
}
