/**
 * TwinForge Studio - Plate Heat Exchanger Discretized Section Model
 * High-fidelity counter-flow finite-volume engine with dynamic thermal inertia,
 * variable U-value kinetics, fouling accumulation, and adaptive sub-stepping integration.
 */

import { PHE_PHYSICAL_CONSTANTS, type PheSectionGeometry } from './config';
import type { PheCellState, PheSectionMetrics } from './types';

export interface SectionFluidSpec {
  isColdMilk: boolean;
  isHotMilk: boolean;
}

export class PlateSectionModel {
  public readonly config: PheSectionGeometry;
  public readonly fluidSpec: SectionFluidSpec;

  // Configuration options
  public cellCount: number;
  public enableWallNode: boolean = true;
  public foulingMultiplier: number = 1.0;

  // Dynamic cell states (arrays of length cellCount)
  public Tc: number[]; // Cold fluid temp (°C)
  public Th: number[]; // Hot fluid temp (°C)
  public Tw: number[]; // Wall node temp (°C)

  // Accumulated fouling resistance (m²·K / W)
  public foulingResistance: number;

  // Cached calculated metrics
  private lastMetrics: PheSectionMetrics;

  constructor(
    config: PheSectionGeometry,
    fluidSpec: SectionFluidSpec,
    cellCount: number = 10,
    initialTempC: number = 20.0
  ) {
    this.config = config;
    this.fluidSpec = fluidSpec;
    this.cellCount = cellCount;
    this.foulingResistance = config.cleanFoulingResistance_m2_K_per_W;

    this.Tc = new Array(cellCount).fill(initialTempC);
    this.Th = new Array(cellCount).fill(initialTempC);
    this.Tw = new Array(cellCount).fill(initialTempC);

    this.lastMetrics = this.computeEmptyMetrics(initialTempC);
  }

  public setCellCount(newCount: number): void {
    if (newCount === this.cellCount || newCount < 2 || newCount > 30) return;
    
    // Resample temperatures smoothly across new grid
    const oldN = this.cellCount;
    const newTc: number[] = [];
    const newTh: number[] = [];
    const newTw: number[] = [];

    for (let i = 0; i < newCount; i++) {
      const u = i / (newCount - 1);
      const oldIdx = u * (oldN - 1);
      const i0 = Math.floor(oldIdx);
      const i1 = Math.min(oldN - 1, i0 + 1);
      const frac = oldIdx - i0;

      newTc.push(this.Tc[i0] * (1 - frac) + this.Tc[i1] * frac);
      newTh.push(this.Th[i0] * (1 - frac) + this.Th[i1] * frac);
      newTw.push(this.Tw[i0] * (1 - frac) + this.Tw[i1] * frac);
    }

    this.cellCount = newCount;
    this.Tc = newTc;
    this.Th = newTh;
    this.Tw = newTw;
  }

  public resetFouling(): void {
    this.foulingResistance = this.config.cleanFoulingResistance_m2_K_per_W;
  }

  /**
   * Advance the section physics by dt seconds.
   * Uses adaptive sub-stepping to guarantee numerical stability across all simulation speeds (1x..10x).
   */
  public step(
    dtSeconds: number,
    volFlowColdLph: number,
    tempColdInC: number,
    volFlowHotLph: number,
    tempHotInC: number
  ): PheSectionMetrics {
    const N = this.cellCount;

    // 1. Fluid property lookups
    const cp_c = this.fluidSpec.isColdMilk
      ? PHE_PHYSICAL_CONSTANTS.MILK_SPECIFIC_HEAT_J_PER_KG_K
      : PHE_PHYSICAL_CONSTANTS.WATER_SPECIFIC_HEAT_J_PER_KG_K;
    const rho_c = this.fluidSpec.isColdMilk
      ? PHE_PHYSICAL_CONSTANTS.MILK_DENSITY_KG_PER_M3
      : PHE_PHYSICAL_CONSTANTS.WATER_DENSITY_KG_PER_M3;

    const cp_h = this.fluidSpec.isHotMilk
      ? PHE_PHYSICAL_CONSTANTS.MILK_SPECIFIC_HEAT_J_PER_KG_K
      : PHE_PHYSICAL_CONSTANTS.WATER_SPECIFIC_HEAT_J_PER_KG_K;
    const rho_h = this.fluidSpec.isHotMilk
      ? PHE_PHYSICAL_CONSTANTS.MILK_DENSITY_KG_PER_M3
      : PHE_PHYSICAL_CONSTANTS.WATER_DENSITY_KG_PER_M3;

    // 2. Mass flow rates (kg/s)
    const mdot_c = (Math.max(0, volFlowColdLph) / 3600000.0) * rho_c;
    const mdot_h = (Math.max(0, volFlowHotLph) / 3600000.0) * rho_h;

    // Nominal mass flows
    const mdot_nom_c = (this.config.nominalFlowRateLph / 3600000.0) * rho_c;
    const mdot_nom_h = (this.config.nominalFlowRateLph / 3600000.0) * rho_h;

    // 3. Convective heat transfer coefficients h = h_nom * (mdot / mdot_nom)^0.7
    const flowRatioCold = mdot_c > 1e-4 ? Math.min(3.0, mdot_c / mdot_nom_c) : 0;
    const flowRatioHot = mdot_h > 1e-4 ? Math.min(3.0, mdot_h / mdot_nom_h) : 0;

    // Natural convection and conduction floor when pump is stopped
    const h_c = flowRatioCold > 0
      ? this.config.nominalH_W_per_m2_K * Math.pow(flowRatioCold, 0.7)
      : 350.0; // conduction floor across narrow 2.8mm channel
    const h_h = flowRatioHot > 0
      ? this.config.nominalH_W_per_m2_K * Math.pow(flowRatioHot, 0.7)
      : 350.0;

    // Wall thermal resistance & overall U
    const t_plate = PHE_PHYSICAL_CONSTANTS.PLATE_THICKNESS_M;
    const k_plate = PHE_PHYSICAL_CONSTANTS.PLATE_THERMAL_CONDUCTIVITY_W_PER_M_K;
    const R_wall = t_plate / k_plate;

    // Overall thermal conductance
    const totalThermalResistance = (1.0 / h_c) + (1.0 / h_h) + R_wall + this.foulingResistance;
    const overallU = 1.0 / Math.max(1e-5, totalThermalResistance);

    // Geometry per cell
    const totalArea = this.config.plateCount * this.config.plateAreaPerPlateM2;
    const areaPerCell = totalArea / N;

    // Volume per channel cell (m³)
    const totalVolume = this.config.plateCount * this.config.plateAreaPerPlateM2 * this.config.channelGapM;
    const V_cell_c = totalVolume / N;
    const V_cell_h = totalVolume / N;

    // Mass capacitance per cell (J / K)
    const C_fluid_c = rho_c * V_cell_c * cp_c;
    const C_fluid_h = rho_h * V_cell_h * cp_h;

    // Wall capacitance per cell
    const plateVolumePerCell = totalArea * t_plate / N;
    const C_wall_cell = PHE_PHYSICAL_CONSTANTS.PLATE_DENSITY_KG_PER_M3 *
      plateVolumePerCell *
      PHE_PHYSICAL_CONSTANTS.PLATE_SPECIFIC_HEAT_J_PER_KG_K;

    // 4. Determine adaptive sub-stepping for unconditional stability
    // Residence time per cell (convective time constraint)
    const tau_c = mdot_c > 1e-4 ? (rho_c * V_cell_c) / mdot_c : 999.0;
    const tau_h = mdot_h > 1e-4 ? (rho_h * V_cell_h) / mdot_h : 999.0;
    const minResidenceTime = Math.min(tau_c, tau_h);

    // Courant-Friedrichs-Lewy (CFL) condition limit for upwind convection: dt <= 0.4 * min(tau)
    const maxStableDt = Math.max(0.002, Math.min(0.04, 0.45 * minResidenceTime));
    const subSteps = Math.min(40, Math.max(1, Math.ceil(dtSeconds / maxStableDt)));
    const dt_sub = dtSeconds / subSteps;

    // 5. Integrate sub-steps
    for (let step = 0; step < subSteps; step++) {
      const dTc = new Array(N).fill(0);
      const dTh = new Array(N).fill(0);
      const dTw = new Array(N).fill(0);

      for (let i = 0; i < N; i++) {
        // Upwind Convection (Cold: flows 0 -> N-1; enters at cell 0)
        const Tc_prev = i === 0 ? tempColdInC : this.Tc[i - 1];
        const convCold = mdot_c * cp_c * (Tc_prev - this.Tc[i]);

        // Upwind Convection (Hot: counterflow enters at cell N-1; flows N-1 -> 0)
        const Th_next = i === N - 1 ? tempHotInC : this.Th[i + 1];
        const convHot = mdot_h * cp_h * (Th_next - this.Th[i]);

        if (this.enableWallNode) {
          // Heat exchange with plate wall node
          const Q_h_to_w = h_h * areaPerCell * (this.Th[i] - this.Tw[i]);
          const Q_w_to_c = h_c * areaPerCell * (this.Tw[i] - this.Tc[i]);

          dTc[i] = (convCold + Q_w_to_c) / C_fluid_c;
          dTh[i] = (convHot - Q_h_to_w) / C_fluid_h;
          dTw[i] = (Q_h_to_w - Q_w_to_c) / Math.max(10.0, C_wall_cell);
        } else {
          // Direct hot-to-cold coupling via overall U
          const Q_exchange = overallU * areaPerCell * (this.Th[i] - this.Tc[i]);
          dTc[i] = (convCold + Q_exchange) / C_fluid_c;
          dTh[i] = (convHot - Q_exchange) / C_fluid_h;
        }
      }

      // Update state with Euler step, clamped to realistic bounds
      for (let i = 0; i < N; i++) {
        this.Tc[i] = Math.max(0.5, Math.min(130.0, this.Tc[i] + dTc[i] * dt_sub));
        this.Th[i] = Math.max(0.5, Math.min(130.0, this.Th[i] + dTh[i] * dt_sub));
        if (this.enableWallNode) {
          this.Tw[i] = Math.max(0.5, Math.min(130.0, this.Tw[i] + dTw[i] * dt_sub));
        } else {
          this.Tw[i] = (this.Tc[i] + this.Th[i]) / 2.0;
        }
      }
    }

    // 6. Fouling kinetics: rate accelerates at high wall temperature
    const avgWallTemp = this.Tw.reduce((sum, v) => sum + v, 0) / N;
    let tempActivationFactor = 1.0;
    if (avgWallTemp > PHE_PHYSICAL_CONSTANTS.FOULING_ACTIVATION_ENERGY_TEMP_THRESHOLD_C) {
      const deltaT = avgWallTemp - PHE_PHYSICAL_CONSTANTS.FOULING_ACTIVATION_ENERGY_TEMP_THRESHOLD_C;
      tempActivationFactor = 1.0 + Math.pow(deltaT / 10.0, 1.8);
    }
    const dR_fouling =
      PHE_PHYSICAL_CONSTANTS.BASE_FOULING_GROWTH_RATE_M2_K_PER_W_S *
      tempActivationFactor *
      this.foulingMultiplier *
      dtSeconds;
    this.foulingResistance = Math.min(0.0015, this.foulingResistance + dR_fouling);

    // 7. Hydraulics: Pressure drop dP = k * mdot^1.7 * (1 + fouling)
    const foulingPenalty = 1.0 + (this.foulingResistance / this.config.cleanFoulingResistance_m2_K_per_W - 1.0) * 0.25;
    const dP_c = this.config.nominalPressureDropBar *
      Math.pow(flowRatioCold, 1.7) *
      foulingPenalty;
    const dP_h = this.config.nominalPressureDropBar *
      Math.pow(flowRatioHot, 1.7) *
      foulingPenalty;

    // 8. Stream Outlet Temperatures
    const tempColdOutC = this.Tc[N - 1]; // Cold exits at cell N-1
    const tempHotOutC = this.Th[0];      // Hot exits at cell 0

    // 9. Heat duties (kW)
    const dutyColdKW = mdot_c * (cp_c / 1000.0) * (tempColdOutC - tempColdInC);
    const dutyHotKW = mdot_h * (cp_h / 1000.0) * (tempHotInC - tempHotOutC);
    const dutyAverageKW = (Math.abs(dutyColdKW) + Math.abs(dutyHotKW)) / 2.0;

    // Energy balance self-check error %
    let energyBalanceErrorPct = 0;
    if (dutyAverageKW > 0.5 && mdot_c > 0.1 && mdot_h > 0.1) {
      energyBalanceErrorPct = Number(
        (Math.abs(dutyHotKW - dutyColdKW) / dutyAverageKW * 100.0).toFixed(2)
      );
    }

    // 10. Analytical thermodynamic indicators: NTU, Effectiveness, LMTD
    const C_c = mdot_c * cp_c;
    const C_h = mdot_h * cp_h;
    const C_min = Math.min(C_c, C_h);
    const UA_kW_per_K = (overallU * totalArea) / 1000.0;
    const ntu = C_min > 0 ? (overallU * totalArea) / C_min : 0;

    // Counterflow Effectiveness
    let effectiveness = 0;
    if (C_min > 0 && Math.abs(tempHotInC - tempColdInC) > 0.1) {
      const Q_max_kW = (C_min / 1000.0) * (tempHotInC - tempColdInC);
      effectiveness = Math.max(0, Math.min(1.0, dutyAverageKW / Math.max(0.01, Q_max_kW)));
    }

    // LMTD calculation for counterflow
    const deltaT1 = tempHotInC - tempColdOutC;
    const deltaT2 = tempHotOutC - tempColdInC;
    let lmtd = 0;
    if (deltaT1 > 0.1 && deltaT2 > 0.1) {
      if (Math.abs(deltaT1 - deltaT2) < 0.05) {
        lmtd = (deltaT1 + deltaT2) / 2.0;
      } else {
        lmtd = (deltaT1 - deltaT2) / Math.log(deltaT1 / deltaT2);
      }
    }

    // Residence times
    const residenceTimeColdS = mdot_c > 0.01 ? (rho_c * totalVolume) / mdot_c : 0;
    const residenceTimeHotS = mdot_h > 0.01 ? (rho_h * totalVolume) / mdot_h : 0;

    // Clean vs fouled percentage
    const foulingPct = Math.min(
      100,
      ((this.foulingResistance - this.config.cleanFoulingResistance_m2_K_per_W) / 0.0004) * 100.0
    );

    // Build cell snapshot
    const cells: PheCellState[] = [];
    for (let i = 0; i < N; i++) {
      cells.push({
        index: i,
        temperatureColdC: Number(this.Tc[i].toFixed(2)),
        temperatureHotC: Number(this.Th[i].toFixed(2)),
        temperatureWallC: Number(this.Tw[i].toFixed(2)),
      });
    }

    this.lastMetrics = {
      id: this.config.id,
      name: this.config.name,
      tempColdInC: Number(tempColdInC.toFixed(2)),
      tempColdOutC: Number(tempColdOutC.toFixed(2)),
      tempHotInC: Number(tempHotInC.toFixed(2)),
      tempHotOutC: Number(tempHotOutC.toFixed(2)),
      massFlowColdKgS: Number(mdot_c.toFixed(3)),
      massFlowHotKgS: Number(mdot_h.toFixed(3)),
      volFlowColdLph: Number(volFlowColdLph.toFixed(0)),
      volFlowHotLph: Number(volFlowHotLph.toFixed(0)),
      dutyColdKW: Number(dutyColdKW.toFixed(2)),
      dutyHotKW: Number(dutyHotKW.toFixed(2)),
      dutyAverageKW: Number(dutyAverageKW.toFixed(2)),
      energyBalanceErrorPct,
      effectivenessEpsilon: Number(effectiveness.toFixed(3)),
      ntu: Number(ntu.toFixed(2)),
      lmtdC: Number(lmtd.toFixed(2)),
      uValue_W_per_m2_K: Number(overallU.toFixed(1)),
      uaValue_kW_per_K: Number(UA_kW_per_K.toFixed(2)),
      hCold_W_per_m2_K: Number(h_c.toFixed(1)),
      hHot_W_per_m2_K: Number(h_h.toFixed(1)),
      pressureDropColdBar: Number(dP_c.toFixed(3)),
      pressureDropHotBar: Number(dP_h.toFixed(3)),
      foulingResistance_m2_K_per_W: Number(this.foulingResistance.toFixed(7)),
      foulingPct: Math.max(0, Number(foulingPct.toFixed(1))),
      residenceTimeColdS: Number(residenceTimeColdS.toFixed(1)),
      residenceTimeHotS: Number(residenceTimeHotS.toFixed(1)),
      cells,
    };

    return this.lastMetrics;
  }

  public getMetrics(): PheSectionMetrics {
    return this.lastMetrics;
  }

  private computeEmptyMetrics(initTemp: number): PheSectionMetrics {
    const cells: PheCellState[] = [];
    for (let i = 0; i < this.cellCount; i++) {
      cells.push({
        index: i,
        temperatureColdC: initTemp,
        temperatureHotC: initTemp,
        temperatureWallC: initTemp,
      });
    }

    return {
      id: this.config.id,
      name: this.config.name,
      tempColdInC: initTemp,
      tempColdOutC: initTemp,
      tempHotInC: initTemp,
      tempHotOutC: initTemp,
      massFlowColdKgS: 0,
      massFlowHotKgS: 0,
      volFlowColdLph: 0,
      volFlowHotLph: 0,
      dutyColdKW: 0,
      dutyHotKW: 0,
      dutyAverageKW: 0,
      energyBalanceErrorPct: 0,
      effectivenessEpsilon: 0,
      ntu: 0,
      lmtdC: 0,
      uValue_W_per_m2_K: this.config.nominalH_W_per_m2_K / 2.0,
      uaValue_kW_per_K: 0,
      hCold_W_per_m2_K: this.config.nominalH_W_per_m2_K,
      hHot_W_per_m2_K: this.config.nominalH_W_per_m2_K,
      pressureDropColdBar: 0,
      pressureDropHotBar: 0,
      foulingResistance_m2_K_per_W: this.config.cleanFoulingResistance_m2_K_per_W,
      foulingPct: 0,
      residenceTimeColdS: 0,
      residenceTimeHotS: 0,
      cells,
    };
  }
}
