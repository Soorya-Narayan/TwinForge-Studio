/**
 * TwinForge Studio - Centralized Safety Interlock Configuration
 * 
 * Defines all safety, permissive, and equipment-protection interlocks per skid.
 * Drivers read definitions (names, conditions, trip behaviors) from this configuration
 * instead of hardcoding them in driver implementations.
 */

export interface InterlockStatus {
  id: string;
  name: string;
  condition: string;
  isOk: boolean;
  tripped: boolean;
}

export interface InterlockDefinition {
  id: string;
  name: string;
  condition: string;
  skid: 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'COMMON';
  tag?: string; // Mirrored PLC register tag name (defaults to id)
  defaultOk?: boolean;
  description?: string;
}

export const DEFAULT_INTERLOCK_DEFINITIONS: InterlockDefinition[] = [
  // Pasteurizer 10k LPH Skid Interlocks (PMO/FDA 3-A Sanitary Standards)
  {
    id: 'IL-FDV',
    name: 'Legal Flow Diversion Interlock (PV11 / PV12)',
    condition: 'Holding tube temp TT5 must be >= 88.0°C for forward flow to product out; else divert to Balance Tank',
    skid: 'PASTEURIZER_10KLPH',
    tag: 'IL-FDV',
    defaultOk: false,
    description: 'Critical pasteurization legal diversion valve permissive',
  },
  {
    id: 'IL-DIFF',
    name: 'Sanitary Differential Pressure Interlock (PT4 - PT2)',
    condition: 'Booster discharge PT4 must exceed raw feed PT2 by >= 0.5 bar to prevent raw-to-pasteurized contamination',
    skid: 'PASTEURIZER_10KLPH',
    tag: 'IL-DIFF',
    defaultOk: true,
    description: 'Regeneration pressure gradient protective interlock',
  },
  {
    id: 'IL-DP',
    name: 'Regenerator Differential Pressure (PT4 - PT2)',
    condition: 'Booster discharge PT4 must exceed raw feed PT2 by >= 0.5 bar to prevent raw-to-pasteurized contamination',
    skid: 'PASTEURIZER_10KLPH',
    tag: 'IL-DP',
    defaultOk: true,
    description: 'Internal driver differential pressure alias',
  },
  {
    id: 'IL-BAL-LOW',
    name: 'Balance Tank Low Level Lockout (LS1 / LT1)',
    condition: 'Feed Pump trips if Balance Tank level < 15% to protect pump mechanical seal from cavitation',
    skid: 'PASTEURIZER_10KLPH',
    tag: 'IL-BAL-LOW',
    defaultOk: true,
    description: 'Constant level tank minimum cavitation permissive',
  },
  {
    id: 'IL-BAL-HIGH',
    name: 'Balance Tank High Level Protection (LS2)',
    condition: 'Raw milk transfer and inlet valve PV1 trip if Balance Tank level > 95% to prevent tank overflow',
    skid: 'PASTEURIZER_10KLPH',
    tag: 'IL-BAL-HIGH',
    defaultOk: true,
    description: 'Balance tank overflow safety trip',
  },
  {
    id: 'IL-SEAL',
    name: 'Homogenizer Seal Water Interlock',
    condition: 'Homogenizer locked out if Ø 25 mm seal cooling water line is unproved',
    skid: 'PASTEURIZER_10KLPH',
    tag: 'IL-SEAL',
    defaultOk: true,
    description: 'Homogenizer thermal gland water permissive',
  },

  // Batch Mixing Skid Interlocks
  {
    id: 'IL-01',
    name: 'Suction Valve Interlock (V-101 / P-100)',
    condition: 'Pump P-100 locked out unless Suction Valve V-101 is fully open (V101_ZSO proved)',
    skid: 'BATCH_MIXING',
    tag: 'IL-01',
    defaultOk: true,
    description: 'Suction valve open position feedback interlock',
  },
  {
    id: 'IL-02',
    name: 'Low Level Permissive & Runaway Trip (TK-100)',
    condition: 'Transfer pump P-100 locked out if source tank level < 8% to prevent dry-run cavitation',
    skid: 'BATCH_MIXING',
    tag: 'IL-02',
    defaultOk: true,
    description: 'Batch tank minimum operating volume permissive',
  },
  {
    id: 'IL-03',
    name: 'Overfill Protection (TK-400)',
    condition: 'Cut dosing transfer valve V-102 if destination tank level > 90% to prevent overflow',
    skid: 'BATCH_MIXING',
    tag: 'IL-03',
    defaultOk: true,
    description: 'Destination vessel overfill limit protection',
  },
  {
    id: 'IL-04',
    name: 'Thermal Limit High Safety Trip (HX-100)',
    condition: 'Cut steam modulating valve and injection heater if batch temperature > 88°C (trip: 95°C)',
    skid: 'BATCH_MIXING',
    tag: 'IL-04',
    defaultOk: true,
    description: 'In-line thermal process high temperature trip',
  },
  {
    id: 'IL-05',
    name: 'Agitator Dry-Run Protection',
    condition: 'Inhibit agitator drive motor unless tank inventory volume > 50L to protect shaft seal',
    skid: 'BATCH_MIXING',
    tag: 'IL-05',
    defaultOk: true,
    description: 'Impeller drive mechanical safety interlock',
  },
];

export const INTERLOCK_CONFIG_STORAGE_KEY = 'twinforge_interlock_definitions';

/**
 * Builds a Map of live InterlockStatus objects initialized from configuration
 * for a specific plant skid.
 */
export function createInterlocksMapForSkid(
  skid: 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'CUSTOM' | string,
  customDefinitions?: InterlockDefinition[]
): Map<string, InterlockStatus> {
  const definitions = customDefinitions ?? loadStoredInterlockDefinitions();
  const map = new Map<string, InterlockStatus>();

  for (const def of definitions) {
    if (skid === 'CUSTOM' || def.skid === 'COMMON' || def.skid === skid) {
      const isOk = def.defaultOk ?? true;
      map.set(def.id, {
        id: def.id,
        name: def.name,
        condition: def.condition,
        isOk,
        tripped: !isOk,
      });
    }
  }

  return map;
}

/**
 * Loads user-customized interlock definitions from local storage or returns defaults
 */
export function loadStoredInterlockDefinitions(): InterlockDefinition[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(INTERLOCK_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore storage parse errors and fallback
  }
  return [...DEFAULT_INTERLOCK_DEFINITIONS];
}

/**
 * Saves user-customized interlock definitions to local storage
 */
export function saveStoredInterlockDefinitions(definitions: InterlockDefinition[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(INTERLOCK_CONFIG_STORAGE_KEY, JSON.stringify(definitions));
    }
  } catch {
    // Ignore storage write errors in restricted contexts
  }
}
