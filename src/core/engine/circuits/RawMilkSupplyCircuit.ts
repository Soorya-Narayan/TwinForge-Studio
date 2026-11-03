/**
 * TwinForge Studio - Raw Milk Supply Circuit
 * Models the hydraulic series path:
 * Raw Milk Silo (Boundary) -> Suction Pipe -> P-RAW Pump -> Discharge Pipe -> PV-1 Valve -> Balance Tank (Inlet)
 */

import {
  type FluidState,
  RAW_MILK_FLUID,
  GRAVITY_M_S2,
  PipeElement,
  ValveElement,
  StaticHeadElement,
  solveSeriesOperatingPoint,
} from '../hydraulics/index';
import {
  CentrifugalPumpModel,
  type CentrifugalPumpConfig,
  type PumpState,
  type PumpFaultMode,
} from '../pumps/index';

export interface SiloBoundaryState {
  levelM: number; // Liquid level above pump suction centerline (m)
  temperatureC: number;
  available: boolean;
  pressureAbsBar: number;
}

export interface CircuitOutputs {
  flowLph: number; // Signed flow (positive = forward into balance tank, negative = reverse)
  flowLpm: number; // Signed flow in L/min
  suctionPressureBar: number; // Absolute suction pressure (bar)
  dischargePressureBar: number; // Absolute discharge pressure (bar)
  pumpState: PumpState;
  alarms: string[];
}

export const DEFAULT_P_RAW_CONFIG: CentrifugalPumpConfig = {
  id: 'P-RAW',
  tag: 'P_RAW',
  hasVfd: false,
  ratedSpeedRpm: { value: 2900, source: 'placeholder' },
  curvePoints: {
    shutOff: {
      flowLph: { value: 0, source: 'placeholder' },
      headM: { value: 32, source: 'placeholder' },
    },
    rated: {
      flowLph: { value: 12000, source: 'placeholder' },
      headM: { value: 24, source: 'placeholder' },
    },
    maxFlow: {
      flowLph: { value: 16000, source: 'placeholder' },
      headM: { value: 12, source: 'placeholder' },
    },
  },
  motor: {
    ratedPowerKw: { value: 2.2, source: 'placeholder' },
    ratedCurrentA: { value: 4.8, source: 'placeholder' },
    motorEfficiency: { value: 0.85, source: 'placeholder' },
    rampUpTimeS: { value: 2.0, source: 'placeholder' },
    coastDownTauS: { value: 3.0, source: 'placeholder' },
  },
  efficiencyPeak: {
    flowLph: { value: 12000, source: 'placeholder' },
    efficiencyPct: { value: 60, source: 'placeholder' },
  },
  npshrRatedM: { value: 2.5, source: 'placeholder' },
  deadheadTimeoutS: { value: 10.0, source: 'placeholder' },
};

export class RawMilkSupplyCircuit {
  public readonly pump: CentrifugalPumpModel;

  // Hydraulic Elements
  public readonly suctionPipe: PipeElement;
  public readonly dischargePipe: PipeElement;
  public readonly pv1Valve: ValveElement;
  public readonly staticHead: StaticHeadElement;

  // Boundary conditions
  public siloLevelM: number = 3.0; // Level above pump suction (placeholder)
  public siloTemperatureC: number = 4.0;
  public siloAvailable: boolean = true;
  public balanceTankInletElevationM: number = 2.0; // Above pump centerline (placeholder)
  public balanceTankBackpressureHeadM: number = 0.0; // Top entry = 0 extra head

  private circuitFaults: Set<string> = new Set();
  private lastOutputs: CircuitOutputs;

  constructor(pumpConfig: CentrifugalPumpConfig = DEFAULT_P_RAW_CONFIG) {
    this.pump = new CentrifugalPumpModel(pumpConfig);

    // Suction Pipe: Ø 51 mm (48 mm bore), 5 m, K = 3
    this.suctionPipe = new PipeElement({
      id: 'PIPE-SUCTION',
      lengthM: { value: 5.0, source: 'placeholder' },
      diameterMm: { value: 48.0, source: 'placeholder' },
      roughnessMm: { value: 0.0015, source: 'placeholder' },
      fittingsK: { value: 3.0, source: 'placeholder' },
    });

    // Discharge Pipe: Ø 51 mm (48 mm bore), 15 m, K = 6
    this.dischargePipe = new PipeElement({
      id: 'PIPE-DISCHARGE',
      lengthM: { value: 15.0, source: 'placeholder' },
      diameterMm: { value: 48.0, source: 'placeholder' },
      roughnessMm: { value: 0.0015, source: 'placeholder' },
      fittingsK: { value: 6.0, source: 'placeholder' },
    });

    // PV-1 Valve: Kv = 60
    this.pv1Valve = new ValveElement({
      id: 'PV-1',
      Kv: { value: 60.0, source: 'placeholder' },
      positionPct: 100,
    });

    // Static Head: net elevation difference from silo to balance tank inlet
    // Δz = z_inlet - z_silo = 2.0 - 3.0 = -1.0 m
    this.staticHead = new StaticHeadElement({
      id: 'STATIC-HEAD',
      deltaZM: { value: -1.0, source: 'placeholder' },
    });

    this.lastOutputs = {
      flowLph: 0,
      flowLpm: 0,
      suctionPressureBar: 1.01325 + (1032 * GRAVITY_M_S2 * 3.0) / 100000,
      dischargePressureBar: 1.01325 + (1032 * GRAVITY_M_S2 * 3.0) / 100000,
      pumpState: this.pump.getState(),
      alarms: [],
    };
  }

  public applyFault(faultMode: string, value?: number): void {
    if (faultMode === 'raw_supply_empty') {
      this.circuitFaults.add(faultMode);
      this.siloAvailable = false;
    } else {
      this.pump.applyFault(faultMode as PumpFaultMode, value);
    }
  }

  public clearFault(faultMode: string): void {
    if (faultMode === 'raw_supply_empty') {
      this.circuitFaults.delete(faultMode);
      this.siloAvailable = true;
    } else {
      this.pump.clearFault(faultMode as PumpFaultMode);
    }
  }

  public clearAllFaults(): void {
    this.circuitFaults.clear();
    this.siloAvailable = true;
    this.pump.clearAllFaults();
  }

  /**
   * Execute physical scan step of the supply circuit
   */
  public step(
    dt: number,
    inputs: {
      startCmd: boolean;
      speedSpPct?: number;
      pv1PositionPct: number;
      balanceTankLevelPct?: number;
      fluidTempC?: number;
    }
  ): CircuitOutputs {
    const {
      startCmd,
      speedSpPct,
      pv1PositionPct,
      fluidTempC = this.siloTemperatureC,
    } = inputs;

    const fluid: FluidState = {
      ...RAW_MILK_FLUID,
      temperatureC: fluidTempC,
    };

    // Update PV-1 position
    this.pv1Valve.positionPct = pv1PositionPct;
    const isPv1Passable = pv1PositionPct > 2;

    // Apply suction blockage fault extra K
    this.suctionPipe.fittingsK = 3.0 + this.pump.getSuctionBlockageExtraK();

    // Net static head update: (inlet elevation + backpressure) - silo surface elevation
    const effectiveInletElevM = this.balanceTankInletElevationM + this.balanceTankBackpressureHeadM;
    const netDeltaZM = effectiveInletElevM - this.siloLevelM;
    this.staticHead.deltaZM = netDeltaZM;

    // Silo suction pressure at pump inlet (absolute)
    const pAtmBar = 1.01325;
    const pSiloStaticBar = (fluid.densityKgM3 * GRAVITY_M_S2 * Math.max(0, this.siloLevelM)) / 100000;
    const pSiloAbsBar = pAtmBar + pSiloStaticBar;

    const alarms: string[] = [];

    // Dry Run check
    if (!this.siloAvailable) {
      const pumpState = this.pump.step(dt, {
        startCmd,
        speedSpPct,
        flowLph: 0,
        suctionPressureAbsBar: pAtmBar,
        fluidTempC,
        fluidDensityKgM3: fluid.densityKgM3,
        suctionPipeDiameterMm: this.suctionPipe.diameterMm,
        isSuctionEmpty: true,
      });

      alarms.push('P_RAW_DRY_RUN');

      this.lastOutputs = {
        flowLph: 0,
        flowLpm: 0,
        suctionPressureBar: pAtmBar,
        dischargePressureBar: pAtmBar,
        pumpState,
        alarms,
      };
      return this.lastOutputs;
    }

    const currentSpeedRatio = this.pump.getState().speedRatio;
    const isPumpRunning = currentSpeedRatio > 0.05 || (startCmd && !this.pump.getState().tripped);

    let solvedFlowLph = 0;
    let pSuctionBar = pSiloAbsBar;
    let pDischargeBar = pSiloAbsBar;

    if (isPumpRunning && isPv1Passable) {
      // 1. Pump is running and PV-1 is passable: solve operating point
      const elements = [
        this.suctionPipe,
        this.dischargePipe,
        this.staticHead,
        this.pv1Valve,
      ];

      const res = solveSeriesOperatingPoint(
        (q) => {
          let h = this.pump.getHeadM(q, currentSpeedRatio > 0.05 ? currentSpeedRatio : 0.05);
          // Account for cavitation degradation during operating point solve
          const pDropSuct = this.suctionPipe.pressureDropBar(q, fluid);
          const pSuctAbsBar = Math.max(0, pSiloAbsBar - pDropSuct);
          const pVapPa = CentrifugalPumpModel.getWaterVapourPressurePa(fluid.temperatureC);
          const pSuctPa = pSuctAbsBar * 100000;
          const rhoG = fluid.densityKgM3 * GRAVITY_M_S2;
          const D = this.suctionPipe.diameterMm / 1000;
          const A = (Math.PI / 4) * D * D;
          const v = A > 0 ? (q / (3600 * 1000)) / A : 0;
          const npsha = Math.max(0, (pSuctPa - pVapPa) / rhoG + (v * v) / (2 * GRAVITY_M_S2));
          const npshr = this.pump.npshrRatedM * Math.pow(q / Math.max(1, this.pump.ratedFlowLph), 2);
          if (npsha < npshr && q > 100) {
            const pen = Math.max(0, 1 - 1.5 * ((npshr - npsha) / Math.max(0.1, npshr)));
            h *= pen;
          }
          return h;
        },
        elements,
        fluid,
        {
          maxFlowLph: this.pump.ratedFlowLph * 1.5,
          toleranceLph: 1.0,
          inletPressureBar: pSiloAbsBar,
        }
      );

      if (!res.noForwardFlow) {
        solvedFlowLph = res.flowLph;
      } else {
        solvedFlowLph = 0;
      }

      // Calculate pressures
      const pSuctionDrop = this.suctionPipe.pressureDropBar(solvedFlowLph, fluid);
      pSuctionBar = Math.max(0, pSiloAbsBar - pSuctionDrop);

      const pVapPa = CentrifugalPumpModel.getWaterVapourPressurePa(fluid.temperatureC);
      const pSuctPa = pSuctionBar * 100000;
      const rhoG = fluid.densityKgM3 * GRAVITY_M_S2;
      const D = this.suctionPipe.diameterMm / 1000;
      const A = (Math.PI / 4) * D * D;
      const v = A > 0 ? (solvedFlowLph / (3600 * 1000)) / A : 0;
      const npsha = Math.max(0, (pSuctPa - pVapPa) / rhoG + (v * v) / (2 * GRAVITY_M_S2));
      const npshr = this.pump.npshrRatedM * Math.pow(solvedFlowLph / Math.max(1, this.pump.ratedFlowLph), 2);
      let pumpHeadM = this.pump.getHeadM(solvedFlowLph, currentSpeedRatio);
      if (npsha < npshr && solvedFlowLph > 100) {
        const pen = Math.max(0, 1 - 1.5 * ((npshr - npsha) / Math.max(0.1, npshr)));
        pumpHeadM *= pen;
      }
      const pumpDeltaPBar = (fluid.densityKgM3 * GRAVITY_M_S2 * pumpHeadM) / 100000;
      pDischargeBar = pSuctionBar + pumpDeltaPBar;
    } else if (isPumpRunning && !isPv1Passable) {
      // 2. PV-1 is closed while pump runs: flow = 0, discharge pressure = shut-off head
      solvedFlowLph = 0;
      pSuctionBar = pSiloAbsBar;
      const shutOffHeadM = this.pump.getHeadM(0, currentSpeedRatio);
      const shutOffDeltaPBar = (fluid.densityKgM3 * GRAVITY_M_S2 * shutOffHeadM) / 100000;
      pDischargeBar = pSuctionBar + shutOffDeltaPBar;
    } else if (!isPumpRunning && isPv1Passable) {
      // 3. Pump is stopped and PV-1 is open: compute gravity flow from static head
      // Positive head (silo > balance tank) drives flow forward; reverse head drives flow backward
      // Stopped pump adds extra resistance K = 20
      const drivingHeadM = -netDeltaZM; // z_silo - z_tank
      const isReverse = drivingHeadM < 0;
      const absDrivingHeadM = Math.abs(drivingHeadM);
      const drivingDeltaPBar = (fluid.densityKgM3 * GRAVITY_M_S2 * absDrivingHeadM) / 100000;

      // Solve gravity flow using bisection
      const pumpStoppedK = 20.0;
      const origDischargeK = this.dischargePipe.fittingsK;
      this.dischargePipe.fittingsK = 6.0 + pumpStoppedK;

      let low = 0;
      let high = 20000;
      let gravQ = 0;

      for (let i = 0; i < 50; i++) {
        gravQ = 0.5 * (low + high);
        if (high - low < 1.0) break;

        const lossBar =
          this.suctionPipe.pressureDropBar(gravQ, fluid) +
          this.dischargePipe.pressureDropBar(gravQ, fluid) +
          this.pv1Valve.pressureDropBar(gravQ, fluid);

        if (lossBar < drivingDeltaPBar) {
          low = gravQ;
        } else {
          high = gravQ;
        }
      }
      this.dischargePipe.fittingsK = origDischargeK;

      if (isReverse) {
        solvedFlowLph = -gravQ;
        alarms.push('RAW_REVERSE_FLOW');
      } else {
        solvedFlowLph = gravQ;
      }

      pSuctionBar = pSiloAbsBar;
      pDischargeBar = pSiloAbsBar;
    } else {
      // Stopped and valve closed
      solvedFlowLph = 0;
      pSuctionBar = pSiloAbsBar;
      pDischargeBar = pSiloAbsBar;
    }

    // Step centrifugal pump model
    const pumpState = this.pump.step(dt, {
      startCmd,
      speedSpPct,
      flowLph: Math.max(0, solvedFlowLph),
      suctionPressureAbsBar: pSuctionBar,
      fluidTempC,
      fluidDensityKgM3: fluid.densityKgM3,
      suctionPipeDiameterMm: this.suctionPipe.diameterMm,
      isSuctionEmpty: !this.siloAvailable,
    });

    // Collect pump alarms
    if (pumpState.deadhead) {
      alarms.push('P_RAW_DEADHEAD');
    }
    if (pumpState.cavitation) {
      alarms.push('P_RAW_CAVITATION');
    }
    if (pumpState.dryRun) {
      alarms.push('P_RAW_DRY_RUN');
    }

    this.lastOutputs = {
      flowLph: Number(solvedFlowLph.toFixed(2)),
      flowLpm: Number((solvedFlowLph / 60).toFixed(2)),
      suctionPressureBar: Number(pSuctionBar.toFixed(3)),
      dischargePressureBar: Number(pDischargeBar.toFixed(3)),
      pumpState,
      alarms,
    };

    return this.lastOutputs;
  }

  public getOutputs(): CircuitOutputs {
    return { ...this.lastOutputs };
  }
}
