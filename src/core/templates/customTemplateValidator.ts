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

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      errors: ['Invalid template: Expected a JSON object with "meta" and "topology".'],
      warnings: [],
      stats: { tankCount: 0, valveCount: 0, pumpCount: 0, exchangerCount: 0, connectionCount: 0 },
    };
  }

  // 1. Validate Metadata
  const meta = raw.meta ?? raw;
  if (!meta.id || typeof meta.id !== 'string' || meta.id.trim() === '') {
    errors.push('Missing or invalid "meta.id": must be a non-empty string identifier (e.g. "CUSTOM_SKID_01").');
  } else if (!/^[A-Za-z0-9_-]+$/.test(meta.id.trim())) {
    errors.push(`Invalid "meta.id" format: "${meta.id}". Only alphanumeric characters, dashes, and underscores are allowed.`);
  }

  if (!meta.name || typeof meta.name !== 'string' || meta.name.trim() === '') {
    errors.push('Missing or invalid "meta.name": must be a non-empty descriptive name (e.g. "Custom Process Skid").');
  }

  // 2. Validate Topology Structure
  const topology = raw.topology ?? raw;
  if (!topology || typeof topology !== 'object' || Array.isArray(topology)) {
    return {
      valid: false,
      errors: [...errors, 'Missing or invalid "topology": must be an object defining tanks, valves, pumps, and connections.'],
      warnings,
      stats: { tankCount: 0, valveCount: 0, pumpCount: 0, exchangerCount: 0, connectionCount: 0 },
    };
  }

  if (topology.tanks !== undefined && !Array.isArray(topology.tanks)) {
    errors.push('"topology.tanks" must be an array of tank configurations.');
  }
  if (topology.valves !== undefined && !Array.isArray(topology.valves)) {
    errors.push('"topology.valves" must be an array of valve configurations.');
  }
  if (topology.pumps !== undefined && !Array.isArray(topology.pumps)) {
    errors.push('"topology.pumps" must be an array of pump configurations.');
  }
  if (topology.exchangers !== undefined && !Array.isArray(topology.exchangers)) {
    errors.push('"topology.exchangers" must be an array of heat exchanger configurations.');
  }
  if (topology.connections !== undefined && !Array.isArray(topology.connections)) {
    errors.push('"topology.connections" must be an array of pipe connections.');
  }

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
    errors.push('Topology must contain at least 1 pipe connection in "topology.connections".');
  }

  // Registry of all device IDs across all types to ensure global uniqueness
  const nodeIds = new Set<string>();
  const tagToDeviceId = new Map<string, string>();

  const registerDeviceId = (id: any, kind: string, index: number): string | null => {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      errors.push(`${kind}[${index}] is missing a valid non-empty string "id".`);
      return null;
    }
    const cleanId = id.trim();
    if (nodeIds.has(cleanId)) {
      errors.push(`Duplicate component ID "${cleanId}" in ${kind}[${index}]. Component IDs must be unique across all tanks, valves, pumps, and heat exchangers.`);
    } else {
      nodeIds.add(cleanId);
    }
    return cleanId;
  };

  const registerTag = (tag: any, deviceId: string, kind: string) => {
    if (tag === undefined || tag === null) return;
    if (typeof tag !== 'string' || tag.trim() === '') {
      errors.push(`${kind} "${deviceId}" tag must be a non-empty string.`);
      return;
    }
    const cleanTag = tag.trim();
    if (tagToDeviceId.has(cleanTag)) {
      errors.push(`Duplicate SCADA tag "${cleanTag}" assigned to both "${tagToDeviceId.get(cleanTag)}" and "${deviceId}". SCADA tags must be unique.`);
    } else {
      tagToDeviceId.set(cleanTag, deviceId);
    }
  };

  // Check Tanks
  tanks.forEach((t, i) => {
    const cleanId = registerDeviceId(t.id, 'Tank', i);
    const idLabel = cleanId || `Tank[${i}]`;

    if (t.tag) registerTag(t.tag, idLabel, 'Tank');
    else warnings.push(`Tank "${idLabel}" is missing a SCADA "tag" (defaulting to ${idLabel}).`);

    if (typeof t.capacityL !== 'number' || !Number.isFinite(t.capacityL) || t.capacityL <= 0) {
      errors.push(`Tank "${idLabel}" must have a positive finite "capacityL" (received ${t.capacityL}).`);
    }

    if (t.initialLevelPct !== undefined) {
      if (typeof t.initialLevelPct !== 'number' || !Number.isFinite(t.initialLevelPct) || t.initialLevelPct < 0 || t.initialLevelPct > 100) {
        errors.push(`Tank "${idLabel}" "initialLevelPct" must be a number between 0 and 100% (received ${t.initialLevelPct}).`);
      }
    }

    if (t.initialTempC !== undefined) {
      if (typeof t.initialTempC !== 'number' || !Number.isFinite(t.initialTempC)) {
        errors.push(`Tank "${idLabel}" "initialTempC" must be a valid finite temperature in °C (received ${t.initialTempC}).`);
      }
    }
  });

  // Check Valves
  valves.forEach((v, i) => {
    const cleanId = registerDeviceId(v.id, 'Valve', i);
    const idLabel = cleanId || `Valve[${i}]`;

    if (v.tag) registerTag(v.tag, idLabel, 'Valve');

    if (v.travelTimeS !== undefined) {
      if (typeof v.travelTimeS !== 'number' || !Number.isFinite(v.travelTimeS) || v.travelTimeS <= 0) {
        errors.push(`Valve "${idLabel}" "travelTimeS" must be a finite number > 0 (received ${v.travelTimeS}).`);
      }
    }

    if (v.passableThresholdPct !== undefined) {
      if (typeof v.passableThresholdPct !== 'number' || !Number.isFinite(v.passableThresholdPct) || v.passableThresholdPct < 0 || v.passableThresholdPct > 100) {
        errors.push(`Valve "${idLabel}" "passableThresholdPct" must be between 0 and 100% (received ${v.passableThresholdPct}).`);
      }
    }

    if (v.failSafe !== undefined && v.failSafe !== 'normally_closed' && v.failSafe !== 'normally_open') {
      errors.push(`Valve "${idLabel}" invalid failSafe: "${v.failSafe}". Must be "normally_closed" or "normally_open".`);
    }
  });

  // Check Pumps
  pumps.forEach((p, i) => {
    const cleanId = registerDeviceId(p.id, 'Pump', i);
    const idLabel = cleanId || `Pump[${i}]`;

    if (p.tag) registerTag(p.tag, idLabel, 'Pump');

    if (typeof p.maxFlowLpm !== 'number' || !Number.isFinite(p.maxFlowLpm) || p.maxFlowLpm <= 0) {
      errors.push(`Pump "${idLabel}" must have a positive finite "maxFlowLpm" (received ${p.maxFlowLpm}).`);
    }

    if (p.rampUpTimeS !== undefined) {
      if (typeof p.rampUpTimeS !== 'number' || !Number.isFinite(p.rampUpTimeS) || p.rampUpTimeS < 0) {
        errors.push(`Pump "${idLabel}" "rampUpTimeS" must be a finite non-negative number in seconds (received ${p.rampUpTimeS}).`);
      }
    }
  });

  // Check Exchangers
  exchangers.forEach((hx, i) => {
    const cleanId = registerDeviceId(hx.id, 'HeatExchanger', i);
    const idLabel = cleanId || `HeatExchanger[${i}]`;

    if (hx.tag) registerTag(hx.tag, idLabel, 'HeatExchanger');

    if (hx.heatTransferCoeffUA !== undefined) {
      if (typeof hx.heatTransferCoeffUA !== 'number' || !Number.isFinite(hx.heatTransferCoeffUA) || hx.heatTransferCoeffUA <= 0) {
        errors.push(`HeatExchanger "${idLabel}" "heatTransferCoeffUA" must be a positive finite number (received ${hx.heatTransferCoeffUA}).`);
      }
    }
  });

  // Check Pipe Connections (Referential Integrity & Graph Connectivity)
  const connectionIds = new Set<string>();
  const connectedNodes = new Set<string>();

  connections.forEach((conn, i) => {
    if (!conn.id || typeof conn.id !== 'string' || conn.id.trim() === '') {
      errors.push(`Connection[${i}] is missing a valid non-empty string "id".`);
      return;
    }
    const cleanConnId = conn.id.trim();
    if (connectionIds.has(cleanConnId)) {
      errors.push(`Duplicate connection ID "${cleanConnId}". Pipe connection IDs must be unique.`);
    } else {
      connectionIds.add(cleanConnId);
    }

    if (!conn.fromNode || typeof conn.fromNode !== 'string' || !nodeIds.has(conn.fromNode.trim())) {
      errors.push(`Connection "${cleanConnId}" fromNode "${conn.fromNode}" does not exist in any registered tank, valve, pump, or heat exchanger.`);
    } else {
      connectedNodes.add(conn.fromNode.trim());
    }

    if (!conn.toNode || typeof conn.toNode !== 'string' || !nodeIds.has(conn.toNode.trim())) {
      errors.push(`Connection "${cleanConnId}" toNode "${conn.toNode}" does not exist in any registered tank, valve, pump, or heat exchanger.`);
    } else {
      connectedNodes.add(conn.toNode.trim());
    }

    if (conn.fromNode && conn.toNode && conn.fromNode.trim() === conn.toNode.trim()) {
      errors.push(`Connection "${cleanConnId}" forms an invalid self-referential loop (fromNode "${conn.fromNode}" equals toNode). Pipes must connect two distinct components.`);
    }

    if (conn.diameterMm !== undefined) {
      if (typeof conn.diameterMm !== 'number' || !Number.isFinite(conn.diameterMm) || conn.diameterMm <= 0) {
        errors.push(`Connection "${cleanConnId}" "diameterMm" must be a positive finite number (received ${conn.diameterMm}).`);
      }
    }
  });

  // Check for disconnected components
  nodeIds.forEach((id) => {
    if (!connectedNodes.has(id)) {
      warnings.push(`Component "${id}" is disconnected: it has no incoming or outgoing pipe connections.`);
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
