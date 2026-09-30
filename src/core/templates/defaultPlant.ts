/**
 * TwinForge Studio - Default Plant Templates
 * Pre-configured industrial skid models.
 */

import type { PlantTopology } from '../engine/PhysicsEngine';

export const defaultMixingSkid: PlantTopology = {
  tanks: [
    {
      id: 'TK-100',
      tag: 'TK100',
      type: 'tank',
      description: 'Chemical Solution Supply Tank',
      capacityL: 1000,
      initialLevelPct: 85,
      initialTempC: 22.0,
    },
    {
      id: 'TK-400',
      tag: 'TK400',
      type: 'tank',
      description: 'Main Process Mixing Tank with Agitator',
      capacityL: 1500,
      initialLevelPct: 0,
      initialTempC: 20.0,
    },
    {
      id: 'TK-PROD',
      tag: 'TKPROD',
      type: 'tank',
      description: 'Finished Product Storage Tank',
      capacityL: 5000,
      initialLevelPct: 15,
      initialTempC: 25.0,
    },
  ],
  valves: [
    {
      id: 'V-101',
      tag: 'V101',
      type: 'on_off_valve',
      description: 'TK-100 Suction Isolation Valve',
      travelTimeS: 1.5,
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
    {
      id: 'V-102',
      tag: 'V102',
      type: 'on_off_valve',
      description: 'Dosing Line Discharge Block Valve',
      travelTimeS: 1.5,
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
    {
      id: 'V-400',
      tag: 'V400_PROD',
      type: 'on_off_valve',
      description: 'TK-400 Product Discharge Valve',
      travelTimeS: 2.0,
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
  ],
  pumps: [
    {
      id: 'P-100',
      tag: 'P100',
      type: 'centrifugal_pump',
      description: 'Solution Transfer Pump (25 KLPH)',
      maxFlowLpm: 250,
      rampUpTimeS: 1.0,
    },
  ],
  exchangers: [
    {
      id: 'HX-100',
      tag: 'HX100',
      type: 'heat_exchanger',
      description: 'Steam Plate Heat Exchanger Skid',
      heatTransferCoeffUA: 5000,
      primaryMedium: 'steam',
    },
  ],
  connections: [
    { id: 'PIPE-01', fromNode: 'TK-100', toNode: 'V-101', diameterMm: 50 },
    { id: 'PIPE-02', fromNode: 'V-101', toNode: 'P-100', diameterMm: 50 },
    { id: 'PIPE-03', fromNode: 'P-100', toNode: 'HX-100', diameterMm: 50 },
    { id: 'PIPE-04', fromNode: 'HX-100', toNode: 'V-102', diameterMm: 50 },
    { id: 'PIPE-05', fromNode: 'V-102', toNode: 'TK-400', diameterMm: 50 },
    { id: 'PIPE-06', fromNode: 'TK-400', toNode: 'V-400', diameterMm: 65 },
    { id: 'PIPE-07', fromNode: 'V-400', toNode: 'TK-PROD', diameterMm: 65 },
  ],
};
