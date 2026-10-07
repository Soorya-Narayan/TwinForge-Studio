/**
 * TwinForge Studio - Complete 4-Section Sanitary Plate Heat Exchanger Assembly
 * Integrates CHILLING | REG-01 | REG-02 | HEATING with the Sanitary Holding Coil,
 * dynamic circular regeneration thermal feedback, and pressure interlocks.
 */

import { DEFAULT_PHE_SECTIONS_CONFIG, PHE_PHYSICAL_CONSTANTS } from './config';
import { PlateSectionModel } from './PlateSectionModel';
import { HoldingTubeModel } from './HoldingTubeModel';
import type {
  PheAssemblyOverallMetrics,
  PheSectionMetrics,
  PheSimulationInputs,
} from './types';

export class PHEAssemblyModel {
  // Individual discretized plate sections
  public readonly chilling: PlateSectionModel;
  public readonly reg01: PlateSectionModel;
  public readonly reg02: PlateSectionModel;
  public readonly heating: PlateSectionModel;

  // Sanitary Holding Tube (Transport Delay Line)
  public readonly holdingTube: HoldingTubeModel;

  // Fault states & options
  public foulingMultiplier: number = 1.0;
  public plateLeakSeverityPct: number = 0; // 0 to 100%
  public lossOfHotWater: boolean = false;
  public lossOfChilledWater: boolean = false;

  // Cached overall assembly metrics
  private lastOverallMetrics: PheAssemblyOverallMetrics;

  constructor() {
    this.chilling = new PlateSectionModel(
      DEFAULT_PHE_SECTIONS_CONFIG['CHILLING'],
      { isColdMilk: false, isHotMilk: true }, // Cold: Chilled water, Hot: Pasteurized milk
      10,
      4.0
    );

    this.reg01 = new PlateSectionModel(
      DEFAULT_PHE_SECTIONS_CONFIG['REG-01'],
      { isColdMilk: true, isHotMilk: true }, // Cold: Raw milk, Hot: Return pasteurized milk
      10,
      20.0
    );

    this.reg02 = new PlateSectionModel(
      DEFAULT_PHE_SECTIONS_CONFIG['REG-02'],
      { isColdMilk: true, isHotMilk: true }, // Cold: Preheated milk, Hot: Return pasteurized milk
      10,
      45.0
    );

    this.heating = new PlateSectionModel(
      DEFAULT_PHE_SECTIONS_CONFIG['HEATING'],
      { isColdMilk: true, isHotMilk: false }, // Cold: Warm milk, Hot: Closed hot water loop
      10,
      70.0
    );

    this.holdingTube = new HoldingTubeModel(
      PHE_PHYSICAL_CONSTANTS.HOLDING_TUBE_VOLUME_L,
      PHE_PHYSICAL_CONSTANTS.LEGAL_MIN_HOLDING_TIME_S,
      70.0
    );

    this.lastOverallMetrics = this.computeInitialOverallMetrics();
  }

  public setAllCellCounts(count: number): void {
    this.chilling.setCellCount(count);
    this.reg01.setCellCount(count);
    this.reg02.setCellCount(count);
    this.heating.setCellCount(count);
  }

  public setEnableWallNodes(enable: boolean): void {
    this.chilling.enableWallNode = enable;
    this.reg01.enableWallNode = enable;
    this.reg02.enableWallNode = enable;
    this.heating.enableWallNode = enable;
  }

  public resetAllFouling(): void {
    this.chilling.resetFouling();
    this.reg01.resetFouling();
    this.reg02.resetFouling();
    this.heating.resetFouling();
  }

  /**
   * Main simulation step executed each scan cycle.
   */
  public step(dtSeconds: number, inputs: PheSimulationInputs): {
    overall: PheAssemblyOverallMetrics;
    chilling: PheSectionMetrics;
    reg01: PheSectionMetrics;
    reg02: PheSectionMetrics;
    heating: PheSectionMetrics;
  } {
    // Apply fault overrides
    const foulingMult = inputs.foulingMultiplier ?? this.foulingMultiplier;
    this.chilling.foulingMultiplier = foulingMult;
    this.reg01.foulingMultiplier = foulingMult;
    this.reg02.foulingMultiplier = foulingMult;
    this.heating.foulingMultiplier = foulingMult;

    const leakPct = inputs.plateLeakSizePct ?? this.plateLeakSeverityPct;
    const hotWaterLoss = inputs.lossOfHotWater ?? this.lossOfHotWater;
    const chilledWaterLoss = inputs.lossOfChilledWater ?? this.lossOfChilledWater;

    // 1. Hydraulic Inputs
    const feedFlowLph = Math.max(0, inputs.feedFlowRateLph);
    const rawMilkInletTemp = inputs.rawMilkTempC;

    // Hot water utility stream
    const effectiveHwFlow = hotWaterLoss ? 0 : Math.max(0, inputs.hotWaterFlowRateLph);
    const effectiveHwTemp = hotWaterLoss ? 25.0 : inputs.hotWaterSupplyTempC;

    // Chilled water utility stream
    const effectiveCwFlow = chilledWaterLoss ? 0 : Math.max(0, inputs.chilledWaterFlowRateLph);
    const effectiveCwTemp = chilledWaterLoss ? 20.0 : inputs.chilledWaterSupplyTempC;

    // 2. FORWARD COLD PATH (Pre-heating & Pasteurization)
    // 2a. Step REG-01 Cold Side: Raw milk enters at rawMilkInletTemp
    // Hot side comes from REG-02 hot outlet from previous tick
    const reg2HotOutletPrev = this.reg02.getMetrics().tempHotOutC;
    const forwardReturnFlow = inputs.isForwardFlow ? feedFlowLph : 0;

    const mReg1 = this.reg01.step(
      dtSeconds,
      feedFlowLph,        // Cold: Raw milk
      rawMilkInletTemp,
      forwardReturnFlow,  // Hot: Returning pasteurized milk from REG-02
      reg2HotOutletPrev
    );

    // 2b. Step REG-02 Cold Side: Takes cold outlet of REG-01
    // Hot side comes from holding tube exit / diversion valve
    const holdingTubeExitTempPrev = this.holdingTube.getExitTemperature();

    const mReg2 = this.reg02.step(
      dtSeconds,
      feedFlowLph,         // Cold: Milk exiting REG-01
      mReg1.tempColdOutC,
      forwardReturnFlow,   // Hot: Pasteurized milk from holding tube
      holdingTubeExitTempPrev
    );

    // 2c. Step HEATING Section: Takes cold outlet of REG-02
    // Hot side is closed hot-water loop (counterflow)
    const mHeat = this.heating.step(
      dtSeconds,
      feedFlowLph,         // Cold: Milk exiting REG-02
      mReg2.tempColdOutC,
      effectiveHwFlow,     // Hot: Hot water from steam heater
      effectiveHwTemp
    );

    // 3. HOLDING TUBE TRANSPORT DELAY
    const holdingExitTemp = this.holdingTube.step(
      dtSeconds,
      feedFlowLph,
      mHeat.tempColdOutC
    );

    // 4. CHILLING SECTION
    // Cold side: Chilled water
    // Hot side: Pasteurized milk exiting REG-01 hot side
    const reg1HotOutlet = mReg1.tempHotOutC;

    const mChill = this.chilling.step(
      dtSeconds,
      effectiveCwFlow,     // Cold: Chilled water
      effectiveCwTemp,
      forwardReturnFlow,   // Hot: Pasteurized milk exiting REG-01
      reg1HotOutlet
    );

    // 5. HYDRAULICS & PRESSURE DIFFERENTIALS
    // PT1: Balance tank suction head (bar)
    const pt1 = 0.25;

    // PT2: Feed pump discharge pressure = PT1 + pump head - section friction drops
    const feedRatio = feedFlowLph > 0 ? feedFlowLph / 10000.0 : 0;
    const pt2 = Number((pt1 + feedRatio * 2.30).toFixed(2));

    // PT4: Booster pump discharge pressure on pasteurized side
    // In normal operation, booster pump guarantees PT4 > PT2 by >= 0.5 bar
    const pt4 = Number((inputs.isForwardFlow && feedFlowLph > 1000 ? pt2 + 1.6 : 0.25).toFixed(2));
    const dpBar = Number((pt4 - pt2).toFixed(2));

    // 6. PLATE LEAK FAULT DYNAMICS
    let plateLeakFlowLpm = 0;
    let contaminationAlarm = false;
    const hasLeak = leakPct > 0;

    if (hasLeak) {
      // Flow proportional to sqrt(|dP|)
      const leakFactor = (leakPct / 100.0) * 12.0; // up to 12 L/min at 1 bar dP
      plateLeakFlowLpm = Number((leakFactor * Math.sqrt(Math.max(0.01, Math.abs(dpBar)))).toFixed(2));

      // Legal cross-contamination rule:
      // If PT4 > PT2: Clean pasteurized milk pushes into raw side (safe, no pathogens enter product).
      // If PT2 > PT4: Raw unpasteurized milk pushes into clean side (CONTAMINATION HAZARD!).
      if (pt2 > pt4 && feedFlowLph > 500) {
        contaminationAlarm = true;
      }
    }

    // 7. REGENERATION EFFICIENCY KPI
    // Efficiency = (T_reg_out - T_raw_in) / (T_past - T_raw_in)
    const rawIn = rawMilkInletTemp;
    const regOut = mReg2.tempColdOutC;
    const pastOut = holdingExitTemp;
    let regenEffPct = 0;
    if (pastOut - rawIn > 1.0) {
      regenEffPct = Math.max(0, Math.min(99.0, ((regOut - rawIn) / (pastOut - rawIn)) * 100.0));
    }

    // 8. OVERALL SYSTEM STATUS
    let overallStatus: PheAssemblyOverallMetrics['overallStatus'] = 'NORMAL';
    if (contaminationAlarm) {
      overallStatus = 'CONTAMINATION_ALERT';
    } else if (hasLeak) {
      overallStatus = 'LEAK_WARNING';
    } else if (mHeat.foulingPct > 40) {
      overallStatus = 'FOULED';
    } else if (feedFlowLph < 500) {
      overallStatus = 'LOW_FLOW';
    } else if (!inputs.isForwardFlow && feedFlowLph > 1000) {
      overallStatus = 'UNDER_TEMP_DIVERT';
    }

    const divertState: PheAssemblyOverallMetrics['divertState'] =
      feedFlowLph < 100 ? 'STOPPED' : inputs.isForwardFlow ? 'FORWARD_LEGAL' : 'DIVERTED_TO_BALANCE';

    this.lastOverallMetrics = {
      heaterOutletTempC: Number(mHeat.tempColdOutC.toFixed(2)),
      holdingTubeExitTempC: Number(holdingExitTemp.toFixed(2)),
      holdingTubeResidenceTimeS: Number(this.holdingTube.getResidenceTimeSeconds().toFixed(1)),
      isLegalHoldingTime: this.holdingTube.isResidenceTimeLegal(),

      rawMilkInletTempC: Number(rawIn.toFixed(1)),
      regenOutletTempC: Number(regOut.toFixed(1)),
      pasteurizedTempC: Number(pastOut.toFixed(1)),
      regenerationEfficiencyPct: Number(regenEffPct.toFixed(1)),

      totalHeatingDutyKW: Number(mHeat.dutyColdKW.toFixed(1)),
      totalChillingDutyKW: Number(Math.abs(mChill.dutyHotKW).toFixed(1)),
      totalRegenerationDutyKW: Number((mReg1.dutyColdKW + mReg2.dutyColdKW).toFixed(1)),

      rawPressurePT2Bar: pt2,
      pasteurizedPressurePT4Bar: pt4,
      differentialPressureBar: dpBar,
      plateLeakFlowRateLpm: plateLeakFlowLpm,
      hasPlateLeak: hasLeak,
      contaminationAlarm,

      divertState,
      overallStatus,
    };

    return {
      overall: this.lastOverallMetrics,
      chilling: mChill,
      reg01: mReg1,
      reg02: mReg2,
      heating: mHeat,
    };
  }

  public getOverallMetrics(): PheAssemblyOverallMetrics {
    return this.lastOverallMetrics;
  }

  private computeInitialOverallMetrics(): PheAssemblyOverallMetrics {
    return {
      heaterOutletTempC: 70.0,
      holdingTubeExitTempC: 70.0,
      holdingTubeResidenceTimeS: 20.0,
      isLegalHoldingTime: true,
      rawMilkInletTempC: 4.0,
      regenOutletTempC: 70.0,
      pasteurizedTempC: 70.0,
      regenerationEfficiencyPct: 0.0,
      totalHeatingDutyKW: 0,
      totalChillingDutyKW: 0,
      totalRegenerationDutyKW: 0,
      rawPressurePT2Bar: 0.25,
      pasteurizedPressurePT4Bar: 0.25,
      differentialPressureBar: 0.0,
      plateLeakFlowRateLpm: 0,
      hasPlateLeak: false,
      contaminationAlarm: false,
      divertState: 'STOPPED',
      overallStatus: 'NORMAL',
    };
  }
}
