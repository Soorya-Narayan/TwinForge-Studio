/**
 * TwinForge Studio - Plate Heat Exchanger (PHE) Type Definitions
 */

export interface PheCellState {
  index: number;
  temperatureColdC: number;
  temperatureHotC: number;
  temperatureWallC: number;
}

export interface PheSectionMetrics {
  id: string;
  name: string;
  
  // Stream Temperatures (°C)
  tempColdInC: number;
  tempColdOutC: number;
  tempHotInC: number;
  tempHotOutC: number;

  // Mass & Volumetric Flows
  massFlowColdKgS: number;
  massFlowHotKgS: number;
  volFlowColdLph: number;
  volFlowHotLph: number;

  // Heat Duties & Energy Balance
  dutyColdKW: number;
  dutyHotKW: number;
  dutyAverageKW: number;
  energyBalanceErrorPct: number; // |Qh - Qc| / max(0.01, Qavg) * 100%

  // Heat Transfer Performance
  effectivenessEpsilon: number; // 0 to 1
  ntu: number;
  lmtdC: number;
  uValue_W_per_m2_K: number;
  uaValue_kW_per_K: number;
  hCold_W_per_m2_K: number;
  hHot_W_per_m2_K: number;

  // Hydraulics & Fouling
  pressureDropColdBar: number;
  pressureDropHotBar: number;
  foulingResistance_m2_K_per_W: number;
  foulingPct: number; // 0 to 100%
  residenceTimeColdS: number;
  residenceTimeHotS: number;

  // Discretized Cells (Counterflow)
  cells: PheCellState[];
}

export interface PheAssemblyOverallMetrics {
  // Holding Tube Performance
  heaterOutletTempC: number;
  holdingTubeExitTempC: number; // Sensor TT5
  holdingTubeResidenceTimeS: number;
  isLegalHoldingTime: boolean;

  // Regeneration Efficiency
  rawMilkInletTempC: number;   // TT1 (~4°C)
  regenOutletTempC: number;    // Exiting REG-02 (~70°C)
  pasteurizedTempC: number;    // Exiting heater/holding tube (~88°C)
  regenerationEfficiencyPct: number; // (T_regen_out - T_raw_in) / (T_past - T_raw_in) * 100%

  // Energy & Utility Duties (kW)
  totalHeatingDutyKW: number;
  totalChillingDutyKW: number;
  totalRegenerationDutyKW: number;

  // Pressure Differentials & Cross-Contamination
  rawPressurePT2Bar: number;
  pasteurizedPressurePT4Bar: number;
  differentialPressureBar: number; // PT4 - PT2 (Must be >= 0.5 bar)
  plateLeakFlowRateLpm: number;
  hasPlateLeak: boolean;
  contaminationAlarm: boolean; // TRUE only if raw leaks into pasteurized (PT2 > PT4)

  // System Status
  divertState: 'FORWARD_LEGAL' | 'DIVERTED_TO_BALANCE' | 'STOPPED';
  overallStatus: 'NORMAL' | 'FOULED' | 'LEAK_WARNING' | 'CONTAMINATION_ALERT' | 'LOW_FLOW' | 'UNDER_TEMP_DIVERT';
}

export interface PheSimulationInputs {
  feedFlowRateLph: number;
  rawMilkTempC: number;
  hotWaterFlowRateLph: number;
  hotWaterSupplyTempC: number;
  chilledWaterFlowRateLph: number;
  chilledWaterSupplyTempC: number;
  isForwardFlow: boolean;
  foulingMultiplier?: number;
  plateLeakSizePct?: number; // 0 = no leak, 100 = full puncture
  lossOfHotWater?: boolean;
  lossOfChilledWater?: boolean;
}
