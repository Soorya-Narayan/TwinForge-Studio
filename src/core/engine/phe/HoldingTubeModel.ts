/**
 * TwinForge Studio - Sanitary Holding Tube Transport Delay Line Model
 * Models the legal continuous holding coil (3-A / PMO standard).
 * Simulates true plug-flow thermal transit delay and residence time compliance.
 */

import { PHE_PHYSICAL_CONSTANTS } from './config';

export class HoldingTubeModel {
  public readonly volumeLiters: number;
  public readonly minLegalResidenceTimeS: number;

  // Discrete delay line buffer: array of { volumeL, tempC }
  private fluidSegments: { volumeL: number; tempC: number }[] = [];
  private currentExitTempC: number = 20.0;
  private currentResidenceTimeS: number = 20.0;

  constructor(
    volumeLiters: number = PHE_PHYSICAL_CONSTANTS.HOLDING_TUBE_VOLUME_L,
    minLegalResidenceTimeS: number = PHE_PHYSICAL_CONSTANTS.LEGAL_MIN_HOLDING_TIME_S,
    initialTempC: number = 20.0
  ) {
    this.volumeLiters = volumeLiters;
    this.minLegalResidenceTimeS = minLegalResidenceTimeS;
    this.currentExitTempC = initialTempC;

    // Fill holding tube with initial fluid segments
    const segmentCount = 20;
    const segVol = volumeLiters / segmentCount;
    for (let i = 0; i < segmentCount; i++) {
      this.fluidSegments.push({ volumeL: segVol, tempC: initialTempC });
    }
  }

  /**
   * Advance the holding tube by dt seconds with incoming fluid.
   * @param dtSeconds Simulation step (s)
   * @param volFlowLph Volumetric flow rate through holding coil (L/h)
   * @param inletTempC Temperature entering from the HEATING section outlet (°C)
   * @returns Current exit temperature TT5 (°C)
   */
  public step(dtSeconds: number, volFlowLph: number, inletTempC: number): number {
    const flowLps = Math.max(0, volFlowLph) / 3600.0; // Liters per second

    if (flowLps < 1e-4) {
      // Zero flow: Fluid is stagnant in holding tube.
      // Minimal convective ambient loss (ambient temp 22°C)
      const ambientTemp = 22.0;
      const coolingRate = 0.002 * dtSeconds; // Slow insulated cooling
      for (const seg of this.fluidSegments) {
        seg.tempC += (ambientTemp - seg.tempC) * coolingRate;
      }
      this.currentExitTempC = this.fluidSegments[this.fluidSegments.length - 1]?.tempC ?? inletTempC;
      this.currentResidenceTimeS = 0; // Invalid / stagnant (not infinite or NaN)
      return this.currentExitTempC;
    }

    // Dynamic residence time: Volume / Flow
    this.currentResidenceTimeS = this.volumeLiters / flowLps;

    // Push new incoming volume slice into tube entrance
    const inflowVolume = flowLps * dtSeconds;
    this.fluidSegments.unshift({ volumeL: inflowVolume, tempC: inletTempC });

    // Displace volume out of the tube exit
    let cumulativeVol = 0;
    let exitTempAccumulator = 0;
    let exitVolAccumulator = 0;

    const remainingSegments: { volumeL: number; tempC: number }[] = [];

    for (const seg of this.fluidSegments) {
      if (cumulativeVol + seg.volumeL <= this.volumeLiters) {
        remainingSegments.push(seg);
        cumulativeVol += seg.volumeL;
      } else {
        const excessVol = (cumulativeVol + seg.volumeL) - this.volumeLiters;
        const keptVol = seg.volumeL - excessVol;

        if (keptVol > 1e-5) {
          remainingSegments.push({ volumeL: keptVol, tempC: seg.tempC });
          cumulativeVol += keptVol;
        }

        exitTempAccumulator += seg.tempC * excessVol;
        exitVolAccumulator += excessVol;
      }
    }

    this.fluidSegments = remainingSegments;

    if (exitVolAccumulator > 1e-5) {
      this.currentExitTempC = exitTempAccumulator / exitVolAccumulator;
    }

    return this.currentExitTempC;
  }

  public getExitTemperature(): number {
    return this.currentExitTempC;
  }

  public getResidenceTimeSeconds(): number {
    return this.currentResidenceTimeS;
  }

  public isResidenceTimeLegal(): boolean {
    return this.currentResidenceTimeS >= this.minLegalResidenceTimeS;
  }
}
