/**
 * TwinForge Studio - Plate Heat Exchanger (PHE) Configuration & Physical Constants
 * Standard Units: SI (kg, m, s, J, W, Pa, °C) unless explicitly noted in property name.
 */

export interface PheSectionGeometry {
  id: string;
  name: string;
  plateCount: number;
  plateLengthM: number;
  plateWidthM: number;
  plateAreaPerPlateM2: number;
  channelGapM: number;
  nominalFlowRateLph: number;
  nominalH_W_per_m2_K: number;
  nominalPressureDropBar: number;
  cleanFoulingResistance_m2_K_per_W: number;
}

export const PHE_PHYSICAL_CONSTANTS = {
  // Fluid Properties: Dairy Milk (at average pasteurizer temps ~50°C)
  MILK_SPECIFIC_HEAT_J_PER_KG_K: 3930,
  MILK_DENSITY_KG_PER_M3: 1030,
  
  // Fluid Properties: Water (utilities & heating loop)
  WATER_SPECIFIC_HEAT_J_PER_KG_K: 4184,
  WATER_DENSITY_KG_PER_M3: 1000,

  // Plate Construction: AISI 316L Sanitary Stainless Steel
  PLATE_THICKNESS_M: 0.0006, // 0.6 mm
  PLATE_THERMAL_CONDUCTIVITY_W_PER_M_K: 16.0, // AISI 316L
  PLATE_DENSITY_KG_PER_M3: 8000,
  PLATE_SPECIFIC_HEAT_J_PER_KG_K: 500,

  // Legal Sanitary Standards (3-A / PMO Pasteurized Milk Ordinance)
  LEGAL_MIN_PASTEURIZATION_TEMP_C: 72.0, // High-Temperature Short-Time (HTST) minimum
  TARGET_PASTEURIZATION_TEMP_C: 88.0,    // Target setpoint on 10 KLPH skid
  LEGAL_MIN_HOLDING_TIME_S: 16.0,        // 16.0 seconds legal minimum
  HOLDING_TUBE_VOLUME_L: 55.55,          // 55.55 L / (10,000 LPH / 3600) = 20.0s at nominal flow
  LEGAL_MIN_DIFFERENTIAL_PRESSURE_BAR: 0.5, // PT4 must exceed PT2 by >= 0.5 bar

  // Fouling Kinetics: Milk protein / mineral burn-on rate
  FOULING_ACTIVATION_ENERGY_TEMP_THRESHOLD_C: 68.0,
  BASE_FOULING_GROWTH_RATE_M2_K_PER_W_S: 1.5e-8,
};

export const DEFAULT_PHE_SECTIONS_CONFIG: Record<string, PheSectionGeometry> = {
  'CHILLING': {
    id: 'CHILLING',
    name: 'Chilling Section (Product -> 4°C)',
    plateCount: 38,
    plateLengthM: 0.85,
    plateWidthM: 0.32,
    plateAreaPerPlateM2: 0.27,
    channelGapM: 0.0028,
    nominalFlowRateLph: 10000,
    nominalH_W_per_m2_K: 5800,
    nominalPressureDropBar: 0.42,
    cleanFoulingResistance_m2_K_per_W: 0.00003,
  },
  'REG-01': {
    id: 'REG-01',
    name: 'Regeneration Section 1 (Preheating 4°C -> 45°C)',
    plateCount: 56,
    plateLengthM: 0.85,
    plateWidthM: 0.32,
    plateAreaPerPlateM2: 0.27,
    channelGapM: 0.0028,
    nominalFlowRateLph: 10000,
    nominalH_W_per_m2_K: 6000,
    nominalPressureDropBar: 0.55,
    cleanFoulingResistance_m2_K_per_W: 0.00003,
  },
  'REG-02': {
    id: 'REG-02',
    name: 'Regeneration Section 2 (Preheating 45°C -> 70°C)',
    plateCount: 60,
    plateLengthM: 0.85,
    plateWidthM: 0.32,
    plateAreaPerPlateM2: 0.27,
    channelGapM: 0.0028,
    nominalFlowRateLph: 10000,
    nominalH_W_per_m2_K: 6000,
    nominalPressureDropBar: 0.60,
    cleanFoulingResistance_m2_K_per_W: 0.00004,
  },
  'HEATING': {
    id: 'HEATING',
    name: 'Heating Section (Final heating to 88°C)',
    plateCount: 46,
    plateLengthM: 0.85,
    plateWidthM: 0.32,
    plateAreaPerPlateM2: 0.27,
    channelGapM: 0.0028,
    nominalFlowRateLph: 10000,
    nominalH_W_per_m2_K: 6400,
    nominalPressureDropBar: 0.48,
    cleanFoulingResistance_m2_K_per_W: 0.00005,
  },
};
