/**
 * TwinForge Studio - Centrifugal Pump Physical Model
 * Fits polynomial H-Q curves with affinity law scaling, motor soft start/coast-down,
 * power & current estimation, I²t thermal overload, cavitation, and dry running.
 */

import {
  type CentrifugalPumpConfig,
  type PumpState,
  type PumpFaultMode,
  type PumpFault,
} from './types';
import { GRAVITY_M_S2 } from '../hydraulics/types';

export class CentrifugalPumpModel {
  public readonly config: CentrifugalPumpConfig;
  public readonly id: string;
  public readonly tag: string;

  // Head curve coefficients: H(Q) = a + b*Q + c*Q²
  public readonly a: number;
  public readonly b: number;
  public readonly c: number;

  public readonly ratedFlowLph: number;
  public readonly maxFlowLph: number;
  public readonly ratedHeadM: number;
  public readonly ratedPowerKw: number;
  public readonly ratedCurrentA: number;
  public readonly motorEfficiency: number;
  public readonly rampUpTimeS: number;
  public readonly coastDownTauS: number;
  public readonly peakEfficiency: number;
  public readonly npshrRatedM: number;
  public readonly deadheadTimeoutS: number;
  public readonly tripCurrentRatio: number;
  public readonly tripTimeS: number;
  public readonly overloadLimit: number;

  // Physical dynamic states
  private speedRatio: number = 0; // s in [0, 1]
  private startTimerS: number = 0;
  private tripped: boolean = false;
  private overloadIntegral: number = 0;
  private deadheadTimerS: number = 0;

  // Active faults
  private faults: Map<PumpFaultMode, PumpFault> = new Map();

  // Cached outputs
  private state: PumpState;

  constructor(config: CentrifugalPumpConfig) {
    this.config = config;
    this.id = config.id;
    this.tag = config.tag;

    const H0 = config.curvePoints.shutOff.headM.value;
    const Q1 = config.curvePoints.rated.flowLph.value;
    const H1 = config.curvePoints.rated.headM.value;
    const Q2 = config.curvePoints.maxFlow.flowLph.value;
    const H2 = config.curvePoints.maxFlow.headM.value;

    this.ratedFlowLph = Q1;
    this.maxFlowLph = Q2;
    this.ratedHeadM = H1;
    this.ratedPowerKw = config.motor.ratedPowerKw.value;
    this.ratedCurrentA = config.motor.ratedCurrentA.value;
    this.motorEfficiency = config.motor.motorEfficiency.value;
    this.rampUpTimeS = config.motor.rampUpTimeS.value;
    this.coastDownTauS = config.motor.coastDownTauS.value;
    this.peakEfficiency = (config.efficiencyPeak.efficiencyPct.value) / 100;
    this.npshrRatedM = config.npshrRatedM.value;
    this.deadheadTimeoutS = config.deadheadTimeoutS?.value ?? 10.0;
    this.tripCurrentRatio = config.motor.tripCurrentRatio?.value ?? 1.2;
    this.tripTimeS = config.motor.tripTimeS?.value ?? 30.0;
    this.overloadLimit = (Math.pow(this.tripCurrentRatio, 2) - 1) * this.tripTimeS;

    // Fit quadratic curve: H(Q) = a + b*Q + c*Q² through (0, H0), (Q1, H1), (Q2, H2)
    this.a = H0;
    const d1 = (H1 - this.a) / Q1;
    const d2 = (H2 - this.a) / Q2;
    this.c = (d2 - d1) / (Q2 - Q1);
    this.b = d1 - this.c * Q1;

    this.state = {
      speedRatio: 0,
      speedPct: 0,
      runFeedback: false,
      currentA: 0,
      shaftPowerKw: 0,
      efficiencyPct: 0,
      tripped: false,
      fault: false,
      cavitation: false,
      dryRun: false,
      deadhead: false,
      runout: false,
      headM: 0,
      npshaM: 0,
      npshrM: 0,
    };
  }

  /**
   * Theoretical developed head at flow Q and speed ratio s (with wear/fault effects)
   * H(Q, s) = a*s² + b*s*Q + c*Q²
   */
  public getHeadM(flowLph: number, speedRatio?: number): number {
    const s = speedRatio ?? this.speedRatio;
    if (s <= 1e-4) {
      return 0;
    }

    if (this.state.dryRun) {
      return 0;
    }

    const Q = Math.max(0, flowLph);
    let head = this.a * s * s + this.b * s * Q + this.c * Q * Q;

    // Apply impeller wear if faulted
    const wearFault = this.faults.get('impeller_wear');
    if (wearFault?.value) {
      const wearFactor = Math.max(0, 1 - wearFault.value / 100);
      head *= wearFactor;
    }

    return Math.max(0, head);
  }

  /**
   * Water vapour pressure in Pa using standard Antoine/Magnus correlation
   */
  public static getWaterVapourPressurePa(temperatureC: number): number {
    const T = Math.max(0, Math.min(100, temperatureC));
    return 611.2 * Math.exp((17.67 * T) / (T + 243.5));
  }

  /**
   * Step physical pump model forward by dt seconds
   */
  public step(
    dt: number,
    inputs: {
      startCmd: boolean;
      speedSpPct?: number;
      flowLph: number;
      suctionPressureAbsBar?: number;
      fluidTempC?: number;
      fluidDensityKgM3?: number;
      suctionPipeDiameterMm?: number;
      isSuctionEmpty?: boolean;
    }
  ): PumpState {
    const {
      startCmd,
      speedSpPct,
      flowLph,
      suctionPressureAbsBar = 1.01325,
      fluidTempC = 4.0,
      fluidDensityKgM3 = 1032,
      suctionPipeDiameterMm = 48,
      isSuctionEmpty = false,
    } = inputs;

    // Reset thermal trip only when start command is removed
    if (!startCmd && this.tripped) {
      this.tripped = false;
      this.overloadIntegral = 0;
    }

    // Direct manual trip fault
    const tripFault = this.faults.get('pump_trip');
    if (tripFault) {
      this.tripped = true;
    }

    const canRun = startCmd && !this.tripped;

    // Target speed ratio
    let targetSpeed = 0;
    if (canRun) {
      if (this.config.hasVfd) {
        targetSpeed = Math.max(0, Math.min(1, (speedSpPct ?? 100) / 100));
      } else {
        targetSpeed = 1.0;
      }
    }

    // Motor ramp-up and coast-down dynamics
    if (canRun) {
      this.startTimerS += dt;
      if (this.speedRatio < targetSpeed) {
        const rampRate = 1 / Math.max(0.1, this.rampUpTimeS);
        this.speedRatio = Math.min(targetSpeed, this.speedRatio + rampRate * dt);
      } else if (this.speedRatio > targetSpeed) {
        const rampRate = 1 / Math.max(0.1, this.rampUpTimeS);
        this.speedRatio = Math.max(targetSpeed, this.speedRatio - rampRate * dt);
      }
    } else {
      this.startTimerS = 0;
      // Coast down: ds/dt = -s / tau_coast
      const tau = Math.max(0.1, this.coastDownTauS);
      this.speedRatio = this.speedRatio * Math.exp(-dt / tau);
      if (this.speedRatio < 1e-4) {
        this.speedRatio = 0;
      }
    }

    // Run feedback: true 0.5s after start command while not tripped, false immediately on stop
    const feedbackFault = this.faults.get('run_feedback_fail');
    let runFeedback = false;
    if (canRun && this.startTimerS >= 0.5 && !feedbackFault) {
      runFeedback = true;
    }

    // Dry running detection
    const dryRun = Boolean(isSuctionEmpty);

    // Theoretical head
    const Q = dryRun ? 0 : Math.max(0, flowLph);
    let head = dryRun ? 0 : this.getHeadM(Q, this.speedRatio);

    // Cavitation (NPSHa vs NPSHr)
    const D = suctionPipeDiameterMm / 1000;
    const A = (Math.PI / 4) * D * D;
    const Q_m3s = Q / (3600 * 1000);
    const v = A > 0 ? Q_m3s / A : 0;

    const pVapourPa = CentrifugalPumpModel.getWaterVapourPressurePa(fluidTempC);
    const pSuctionPa = suctionPressureAbsBar * 100000;
    const rhoG = fluidDensityKgM3 * GRAVITY_M_S2;

    const npshaM = Math.max(0, (pSuctionPa - pVapourPa) / rhoG + (v * v) / (2 * GRAVITY_M_S2));
    const flowRatio = this.ratedFlowLph > 0 ? Q / this.ratedFlowLph : 0;
    const npshrM = this.npshrRatedM * Math.pow(flowRatio, 2);

    let cavitation = false;
    if (!dryRun && this.speedRatio > 0.1 && npshaM < npshrM && npshrM > 0.05) {
      cavitation = true;
      const degradation = Math.max(0, 1 - 1.5 * ((npshrM - npshaM) / npshrM));
      head *= degradation;
    }

    // Hydraulic and Shaft Power
    // Parabolic efficiency peaking at rated flow
    const etaRatio = this.ratedFlowLph > 0 ? (Q - this.ratedFlowLph) / this.ratedFlowLph : 0;
    const eta = Math.max(0.15, this.peakEfficiency * (1 - Math.pow(etaRatio, 2)));

    const pHydraulicW = rhoG * Q_m3s * head;
    let pShaftKw = this.speedRatio > 0 ? (pHydraulicW / (eta * 1000)) : 0;

    // Minimum spinning power (iron/friction losses ~10% rated power at full speed)
    if (this.speedRatio > 0.01) {
      pShaftKw = Math.max(pShaftKw, 0.10 * this.ratedPowerKw * Math.pow(this.speedRatio, 2));
    }

    // Motor Current
    let currentA = 0;
    if (this.speedRatio > 0.01) {
      const overloadFault = this.faults.get('motor_overload');
      if (overloadFault?.value !== undefined) {
        currentA = this.ratedCurrentA * overloadFault.value;
      } else {
        currentA = this.ratedCurrentA * (pShaftKw / (this.ratedPowerKw * this.motorEfficiency));
      }
    }

    // Thermal Overload Integration: max(0, (I/I_rated)² - 1)
    if (this.speedRatio > 0.05 && currentA > this.ratedCurrentA) {
      const overloadRate = Math.pow(currentA / this.ratedCurrentA, 2) - 1;
      this.overloadIntegral += overloadRate * dt;
    } else {
      // Natural thermal cooling when under rated
      this.overloadIntegral = Math.max(0, this.overloadIntegral - 0.5 * dt);
    }

    // Trip limit computed from motor config: (tripCurrentRatio² - 1) * tripTimeS
    if (this.overloadIntegral >= this.overloadLimit) {
      this.tripped = true;
      runFeedback = false;
    }

    // Deadhead detection (running but no flow for >= timeout)
    let deadhead = false;
    if (this.speedRatio > 0.2 && Q < 20) {
      this.deadheadTimerS += dt;
      if (this.deadheadTimerS >= this.deadheadTimeoutS) {
        deadhead = true;
      }
    } else {
      this.deadheadTimerS = 0;
    }

    // Run-out detection (operating flow exceeds curve's maxFlow point by > 2%)
    const runout = Boolean((canRun || this.speedRatio > 0.05) && Q > this.maxFlowLph * 1.02);

    this.state = {
      speedRatio: Number(this.speedRatio.toFixed(4)),
      speedPct: Number((this.speedRatio * 100).toFixed(1)),
      runFeedback,
      currentA: Number(currentA.toFixed(2)),
      shaftPowerKw: Number(pShaftKw.toFixed(2)),
      efficiencyPct: Number((eta * 100).toFixed(1)),
      tripped: this.tripped,
      fault: this.tripped || Boolean(this.faults.get('pump_trip')),
      cavitation,
      dryRun,
      deadhead,
      runout,
      headM: Number(head.toFixed(2)),
      npshaM: Number(npshaM.toFixed(2)),
      npshrM: Number(npshrM.toFixed(2)),
    };

    return this.state;
  }

  public applyFault(mode: PumpFaultMode, value?: number): void {
    this.faults.set(mode, { mode, value });
  }

  public clearFault(mode: PumpFaultMode): void {
    this.faults.delete(mode);
    if (mode === 'pump_trip') {
      this.tripped = false;
    }
  }

  public clearAllFaults(): void {
    this.faults.clear();
    this.tripped = false;
    this.overloadIntegral = 0;
  }

  public getSuctionBlockageExtraK(): number {
    const blockage = this.faults.get('suction_blockage');
    return blockage?.value ?? 0;
  }

  public getOverloadPct(): number {
    return Math.min(100, Math.max(0, (this.overloadIntegral / this.overloadLimit) * 100));
  }

  public getState(): PumpState {
    return { ...this.state };
  }
}

