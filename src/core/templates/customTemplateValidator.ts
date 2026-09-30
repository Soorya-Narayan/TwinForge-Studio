/**
 * TwinForge Studio - Custom Plant Template Schema & Validator
 * Validates user-submitted custom skid JSON files against physical simulation requirements.
 */

import type { PlantTopology } from '../engine/PhysicsEngine';
import type { TankConfig, ValveConfig, PumpConfig, HeatExchangerConfig, PipeConnection } from '../engine/types';

export interface CustomSkidMeta {
  id: string;
  name: string;
  tagline?: string;
  category?: string;
  standard?: string;
  throughput?: string;
  ioCount?: string;
  description?: string;
  highlights?: string[];
  keyTags?: string[];
}

export interface CustomSkidPackage {
  meta: CustomSkidMeta;
  topology: PlantTopology;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    tankCount: number;
    valveCount: number;
    pumpCount: number;
    exchangerCount: number;
    connectionCount: number;
  };
}

/**
 * Standard industrial CIP (Clean-In-Place) skid boilerplate for customer reference.
 */
export const SAMPLE_CUSTOM_BOILERPLATE: CustomSkidPackage = {
  meta: {
    id: 'CUSTOM_CIP_SKID',
    name: 'Dual-Circuit Sanitary CIP Skid (15 KLPH)',
    tagline: 'Automated Caustic / Acid / Sanitizer Circulation & Temperature Loop',
    category: 'Sanitary Process Cleaning',
    standard: '3-A Sanitary / EHEDG Standards',
    throughput: '15,000 LPH Delivery Circuit',
    ioCount: '7 Valves · 3 Tanks · 2 Pumps · 1 PHE',
    description: 'Automated multi-tank CIP circulation system delivering controlled wash recipes (Pre-Rinse, 75°C Caustic Wash, Intermediate Rinse, 65°C Acid Descale, and Final Sanitizer Flush).',
    highlights: [
      '3 Process Reservoirs: Caustic (75°C), Fresh Rinse, and Return Buffer Vessel',
      'Plate Heat Exchanger (HEX-CIP-01) with steam regulation loop for wash heating',
      'Dual VFD Pumps: High-head Supply Pump (P-CIP-SUP) and Scavenge Return Pump (P-CIP-RET)',
      'Automated Sanitary Isolation: Supply valves PV-CAUSTIC, PV-RINSE, and loop diversion PV-DIVERT',
    ],
    keyTags: ['TK_CAUSTIC', 'TK_RINSE', 'TK_RETURN', 'P_CIP_SUP', 'P_CIP_RET', 'PV_CAUSTIC', 'PV_RINSE', 'PV_DIVERT', 'HEX_CIP_01'],
  },
  topology: {
    tanks: [
      {
        id: 'TK-CAUSTIC',
        tag: 'TK_CAUSTIC',
        type: 'tank',
        description: 'Caustic Wash Solution Tank (2.0% NaOH @ 75°C)',
        capacityL: 3000,
        initialLevelPct: 85,
        initialTempC: 75.0,
      },
      {
        id: 'TK-RINSE',
        tag: 'TK_RINSE',
        type: 'tank',
        description: 'Fresh Water / Soft Water Rinse Reservoir',
        capacityL: 4000,
        initialLevelPct: 90,
        initialTempC: 25.0,
      },
      {
        id: 'TK-RETURN',
        tag: 'TK_RETURN',
        type: 'tank',
        description: 'CIP Return & Buffer Tank',
        capacityL: 1500,
        initialLevelPct: 20,
        initialTempC: 50.0,
      },
    ],
    valves: [
      {
        id: 'PV-CAUSTIC',
        tag: 'PV_CAUSTIC',
        type: 'on_off_valve',
        description: 'Caustic Tank Supply Isolation Valve (Ø 51 mm)',
        travelTimeS: 1.0,
        passableThresholdPct: 90,
        failSafe: 'normally_closed',
      },
      {
        id: 'PV-RINSE',
        tag: 'PV_RINSE',
        type: 'on_off_valve',
        description: 'Fresh Water Supply Isolation Valve (Ø 51 mm)',
        travelTimeS: 1.0,
        passableThresholdPct: 90,
        failSafe: 'normally_closed',
      },
      {
        id: 'PV-RETURN-RECYCLE',
        tag: 'PV_REC',
        type: 'on_off_valve',
        description: 'Return Chemical Recovery Valve to Caustic Tank',
        travelTimeS: 1.2,
        passableThresholdPct: 90,
        failSafe: 'normally_closed',
      },
      {
        id: 'PV-RETURN-DRAIN',
        tag: 'PV_DRAIN',
        type: 'on_off_valve',
        description: 'Pre-Rinse Turbid Discharge to Waste Drain',
        travelTimeS: 1.0,
        passableThresholdPct: 90,
        failSafe: 'normally_closed',
      },
    ],
    pumps: [
      {
        id: 'P-SUPPLY',
        tag: 'P_SUPPLY',
        type: 'centrifugal_pump',
        description: 'High-Head CIP Supply Pressure Pump (15,000 LPH = 250 L/min)',
        maxFlowLpm: 250,
        rampUpTimeS: 1.5,
      },
      {
        id: 'P-RETURN',
        tag: 'P_RETURN',
        type: 'centrifugal_pump',
        description: 'Liquid-Ring Self-Priming CIP Return Scavenge Pump',
        maxFlowLpm: 280,
        rampUpTimeS: 1.0,
      },
    ],
    exchangers: [
      {
        id: 'HX-INLINE',
        tag: 'HX_INLINE',
        type: 'heat_exchanger',
        description: 'Shell-and-Tube Steam Wash Solution Pre-Heater (Target 75°C)',
        heatTransferCoeffUA: 8500,
        primaryMedium: 'steam',
      },
    ],
    connections: [
      { id: 'PIPE-CST-VLV', fromNode: 'TK-CAUSTIC', toNode: 'PV-CAUSTIC', diameterMm: 51 },
      { id: 'PIPE-RNS-VLV', fromNode: 'TK-RINSE', toNode: 'PV-RINSE', diameterMm: 51 },
      { id: 'PIPE-CST-SUCT', fromNode: 'PV-CAUSTIC', toNode: 'P-SUPPLY', diameterMm: 51 },
      { id: 'PIPE-RNS-SUCT', fromNode: 'PV-RINSE', toNode: 'P-SUPPLY', diameterMm: 51 },
      { id: 'PIPE-SUP-HX', fromNode: 'P-SUPPLY', toNode: 'HX-INLINE', diameterMm: 51 },
      { id: 'PIPE-HX-RETURN', fromNode: 'HX-INLINE', toNode: 'TK-RETURN', diameterMm: 51 },
      { id: 'PIPE-RET-PUMP', fromNode: 'TK-RETURN', toNode: 'P-RETURN', diameterMm: 51 },
      { id: 'PIPE-RET-REC', fromNode: 'P-RETURN', toNode: 'PV-RETURN-RECYCLE', diameterMm: 51 },
      { id: 'PIPE-REC-TANK', fromNode: 'PV-RETURN-RECYCLE', toNode: 'TK-CAUSTIC', diameterMm: 51 },
      { id: 'PIPE-RET-DRAIN', fromNode: 'P-RETURN', toNode: 'PV-RETURN-DRAIN', diameterMm: 51 },
    ],
  },
};

/**
 * Validate a raw JSON input object against TwinForge physics engine standards.
 */
export function validateCustomSkid(raw: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      errors: ['Invalid input: Expected a JSON object.'],
      warnings: [],
      stats: { tankCount: 0, valveCount: 0, pumpCount: 0, exchangerCount: 0, connectionCount: 0 },
    };
  }

  // 1. Validate Metadata
  const meta = raw.meta ?? raw;
  if (!meta.id || typeof meta.id !== 'string') {
    errors.push('Missing or invalid "meta.id" (string required, e.g. "MY_SKID_01").');
  }
  if (!meta.name || typeof meta.name !== 'string') {
    errors.push('Missing or invalid "meta.name" (e.g. "Custom Process Skid").');
  }

  // 2. Validate Topology Structure
  const topology = raw.topology ?? raw;
  const tanks: TankConfig[] = Array.isArray(topology.tanks) ? topology.tanks : [];
  const valves: ValveConfig[] = Array.isArray(topology.valves) ? topology.valves : [];
  const pumps: PumpConfig[] = Array.isArray(topology.pumps) ? topology.pumps : [];
  const exchangers: HeatExchangerConfig[] = Array.isArray(topology.exchangers) ? topology.exchangers : [];
  const connections: PipeConnection[] = Array.isArray(topology.connections) ? topology.connections : [];

  if (tanks.length === 0) {
    errors.push('Topology must contain at least 1 tank in "topology.tanks".');
  }
  if (pumps.length === 0) {
    errors.push('Topology must contain at least 1 pump in "topology.pumps" for fluid propulsion.');
  }
  if (connections.length === 0) {
    errors.push('Topology must contain pipe connections in "topology.connections".');
  }

  // Set of all node IDs to check referential integrity
  const nodeIds = new Set<string>();

  // Check Tanks
  tanks.forEach((t, i) => {
    if (!t.id) errors.push(`Tank[${i}] is missing "id".`);
    else if (nodeIds.has(t.id)) errors.push(`Duplicate component ID "${t.id}" found in tanks.`);
    else nodeIds.add(t.id);

    if (!t.tag) warnings.push(`Tank "${t.id}" is missing a short SCADA "tag" (defaulting to ${t.id}).`);
    if (typeof t.capacityL !== 'number' || t.capacityL <= 0) {
      errors.push(`Tank "${t.id}" must have a positive "capacityL" (e.g. 1000).`);
    }
    if (typeof t.initialLevelPct === 'number' && (t.initialLevelPct < 0 || t.initialLevelPct > 100)) {
      warnings.push(`Tank "${t.id}" initialLevelPct (${t.initialLevelPct}) is outside 0-100% range.`);
    }
  });

  // Check Valves
  valves.forEach((v, i) => {
    if (!v.id) errors.push(`Valve[${i}] is missing "id".`);
    else if (nodeIds.has(v.id)) errors.push(`Duplicate component ID "${v.id}" found in valves.`);
    else nodeIds.add(v.id);

    if (typeof v.travelTimeS === 'number' && v.travelTimeS <= 0) {
      warnings.push(`Valve "${v.id}" travelTimeS must be > 0 (defaulting to 1.0s).`);
    }
  });

  // Check Pumps
  pumps.forEach((p, i) => {
    if (!p.id) errors.push(`Pump[${i}] is missing "id".`);
    else if (nodeIds.has(p.id)) errors.push(`Duplicate component ID "${p.id}" found in pumps.`);
    else nodeIds.add(p.id);

    if (typeof p.maxFlowLpm !== 'number' || p.maxFlowLpm <= 0) {
      errors.push(`Pump "${p.id}" must have a positive "maxFlowLpm" (e.g. 200).`);
    }
  });

  // Check Exchangers
  exchangers.forEach((hx, i) => {
    if (!hx.id) errors.push(`HeatExchanger[${i}] is missing "id".`);
    else if (nodeIds.has(hx.id)) errors.push(`Duplicate component ID "${hx.id}" found in exchangers.`);
    else nodeIds.add(hx.id);
  });

  // Check Pipe Connections (Referential Integrity)
  const connectionIds = new Set<string>();
  connections.forEach((conn, i) => {
    if (!conn.id) errors.push(`Connection[${i}] is missing "id".`);
    else if (connectionIds.has(conn.id)) errors.push(`Duplicate connection ID "${conn.id}".`);
    else connectionIds.add(conn.id);

    if (!conn.fromNode || !nodeIds.has(conn.fromNode)) {
      errors.push(`Connection "${conn.id}" fromNode "${conn.fromNode}" does not exist in any tank, valve, pump, or exchanger.`);
    }
    if (!conn.toNode || !nodeIds.has(conn.toNode)) {
      errors.push(`Connection "${conn.id}" toNode "${conn.toNode}" does not exist in any tank, valve, pump, or exchanger.`);
    }
    if (conn.fromNode === conn.toNode) {
      warnings.push(`Connection "${conn.id}" forms a zero-length loop back to itself (${conn.fromNode}).`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      tankCount: tanks.length,
      valveCount: valves.length,
      pumpCount: pumps.length,
      exchangerCount: exchangers.length,
      connectionCount: connections.length,
    },
  };
}
