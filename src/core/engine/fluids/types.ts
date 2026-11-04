/**
 * TwinForge Studio - Shared Fluid Types
 * Composition and property definitions for liquid process fluids.
 */

export interface FluidComposition {
  waterFrac: number;    // volume fraction of plain water, 0..1
  productFrac: number;  // volume fraction of dairy product, 0..1 (waterFrac + productFrac = 1)
  fatPct: number;       // fat % by mass of the product portion
}

/**
 * Placeholder standard raw milk composition
 * 0% plain water, 100% dairy product, 4.0% fat by mass
 */
export const RAW_MILK_COMPOSITION: FluidComposition = {
  waterFrac: 0,
  productFrac: 1,
  fatPct: 4.0,
};

/**
 * Placeholder standard mains water composition
 * 100% plain water, 0% dairy product, 0% fat
 */
export const MAINS_WATER_COMPOSITION: FluidComposition = {
  waterFrac: 1,
  productFrac: 0,
  fatPct: 0,
};
