/**
 * TwinForge Studio - On/Off Valve Model
 * High-fidelity physical model for pneumatic and solenoid automated on/off process valves.
 * Features travel ramping, fail-safe spring positioning, limit switch feedback (ZSO/ZSC),
 * seat leakage Kv, and comprehensive physical fault injection.
 */

import type {
  OnOffValveConfig,
  OnOffValveInputs,
  OnOffValveOutputs,
  ValveFaultMode,
  ValveFault,
  FailPosition,
} from './types';
import { type NumericParameter } from '../hydraulics/types';

function extractNumeric(param: NumericParameter<number> | number | undefined, defaultValue: number): number {
  if (param === undefined) return defaultValue;
  if (typeof param === 'number') return param;
  return param.value;
}

export class OnOffValveModel {
  public readonly id: string;
  public readonly tag: string;
  public readonly travelTimeS: number;
  public readonly failPosition: FailPosition;
  public readonly kv: number;
  public readonly leakKvPct: number;
  public readonly zsoThresholdPct: number;
  public readonly zscThresholdPct: number;
  public readonly passableThresholdPct: number;

  private positionPct: number;
  private faults: Map<ValveFaultMode, ValveFault> = new Map();
  private lastOutputs: OnOffValveOutputs;

  constructor(config: OnOffValveConfig) {
    this.id = config.id;
    this.tag = config.tag;
    this.travelTimeS = Math.max(0.01, extractNumeric(config.travelTimeS, 2.0));
    this.failPosition = config.failPosition;
    this.kv = Math.max(0.001, extractNumeric(config.kv, 60.0));
    this.leakKvPct = Math.max(0, extractNumeric(config.leakKvPct, 0.01)); // Default 0.01%
    this.zsoThresholdPct = extractNumeric(config.zsoThresholdPct, 95.0);
    this.zscThresholdPct = extractNumeric(config.zscThresholdPct, 5.0);
    this.passableThresholdPct = extractNumeric(config.passableThresholdPct, 90.0);

    const defaultInitialPos = config.failPosition === 'open' ? 100 : 0;
    this.positionPct = config.initialPositionPct !== undefined ? config.initialPositionPct : defaultInitialPos;

    this.lastOutputs = this.computeOutputs();
  }

  public applyFault(mode: ValveFaultMode, value?: number): void {
    this.faults.set(mode, { mode, value });
    // Recompute outputs immediately to reflect stuck or override switch faults
    this.lastOutputs = this.computeOutputs();
  }

  public clearFault(mode: ValveFaultMode): void {
    this.faults.delete(mode);
    this.lastOutputs = this.computeOutputs();
  }

  public clearAllFaults(): void {
    this.faults.clear();
    this.lastOutputs = this.computeOutputs();
  }

  public getFault(mode: ValveFaultMode): ValveFault | undefined {
    return this.faults.get(mode);
  }

  /**
   * Execute single simulation scan step
   */
  public step(dtS: number, inputs: OnOffValveInputs): OnOffValveOutputs {
    const { command, instrumentAirOk, solenoidPowerOk } = inputs;

    // 1. Determine effective target position:
    // If instrument air is lost, solenoid power is lost, or this valve has lost actuator air,
    // the valve physically defaults to its fail position regardless of PLC command.
    const isActuatorPressurized = instrumentAirOk && solenoidPowerOk && !this.faults.has('actuator_air_loss');
    let targetPct: number;
    if (!isActuatorPressurized) {
      targetPct = this.failPosition === 'open' ? 100 : 0;
    } else {
      targetPct = command ? 100 : 0;
    }

    // 2. Position dynamics (mechanical travel ramp)
    if (this.faults.has('stuck_open')) {
      this.positionPct = 100;
    } else if (this.faults.has('stuck_closed')) {
      this.positionPct = 0;
    } else {
      const travelDelayFault = this.faults.get('travel_delay');
      const delayMult = travelDelayFault?.value !== undefined && travelDelayFault.value > 0 ? travelDelayFault.value : 1.0;
      const effectiveTravelTimeS = Math.max(0.01, this.travelTimeS * delayMult);
      const ratePctPerSec = 100.0 / effectiveTravelTimeS;
      const maxDelta = ratePctPerSec * Math.max(0, dtS);

      if (targetPct > this.positionPct) {
        this.positionPct = Math.min(targetPct, this.positionPct + maxDelta);
      } else if (targetPct < this.positionPct) {
        this.positionPct = Math.max(targetPct, this.positionPct - maxDelta);
      }
    }

    this.lastOutputs = this.computeOutputs();
    return this.lastOutputs;
  }

  private computeOutputs(): OnOffValveOutputs {
    // If stuck faults are present, enforce position bounds
    if (this.faults.has('stuck_open')) {
      this.positionPct = 100;
    } else if (this.faults.has('stuck_closed')) {
      this.positionPct = 0;
    }

    const pos = Math.max(0, Math.min(100, this.positionPct));

    // Limit switch outputs:
    // Neither ZSO nor ZSC is true while traveling between thresholds
    let zso = pos >= this.zsoThresholdPct;
    let zsc = pos <= this.zscThresholdPct;

    // Switch electrical faults override physical position
    const zsoFault = this.faults.get('zso_fail');
    if (zsoFault !== undefined) {
      zso = zsoFault.value === 1;
    }

    const zscFault = this.faults.get('zsc_fail');
    if (zscFault !== undefined) {
      zsc = zscFault.value === 1;
    }

    // Flow passability indicator (legacy threshold)
    const isOpen = pos >= this.passableThresholdPct;

    // Effective hydraulic flow coefficient (Kv):
    // Linear valve opening characteristic + seat leakage Kv when closed/throttled.
    const seatLeakFault = this.faults.get('seat_leak');
    const effectiveLeakPct = seatLeakFault?.value !== undefined ? Math.max(0, seatLeakFault.value) : this.leakKvPct;
    const leakKv = this.kv * (effectiveLeakPct / 100);
    const strokeKv = this.kv * (pos / 100);
    const effectiveKv = Math.max(strokeKv, leakKv);

    return {
      positionPct: Number(pos.toFixed(2)),
      isOpen,
      zso,
      zsc,
      effectiveKv,
    };
  }

  public getState(): OnOffValveOutputs {
    return { ...this.lastOutputs };
  }

  public getEffectiveKv(): number {
    return this.lastOutputs.effectiveKv;
  }
}
