/**
 * TwinForge Studio - Milk Pasteurizer 10 KLPH Plant Topology
 * Derived from Goose Industrial Solutions Drawing: GP-LACTALIS, BHOPAL-PID-PSTRZ-001 (Rev 0, 24.06.26)
 * Client: LACTALIS, BHOPAL
 */

import type { PlantTopology } from '../engine/PhysicsEngine';

export const milkPasteurizerSkid: PlantTopology = {
  tanks: [
    {
      id: 'TK-BALANCE',
      tag: 'TK_BAL',
      type: 'tank',
      description: 'Raw Milk Balance Tank with Float Level Control',
      capacityL: 600,
      initialLevelPct: 75,
      initialTempC: 4.0, // Chilled raw milk from silos
    },
    {
      id: 'TK-PRODUCT',
      tag: 'TK_PROD',
      type: 'tank',
      description: 'Pasteurized Milk Finished Storage Silo',
      capacityL: 10000,
      initialLevelPct: 10,
      initialTempC: 4.0,
    },
  ],
  valves: [
    {
      id: 'PV-1',
      tag: 'PV1',
      type: 'on_off_valve',
      description: 'Water / CIP Return Inlet Valve to Balance Tank',
      travelTimeS: 1.0,
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
    {
      id: 'PV-2',
      tag: 'PV2',
      type: 'on_off_valve',
      description: 'Raw Milk Inlet Valve to Balance Tank',
      travelTimeS: 1.0,
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
    {
      id: 'SCV-1',
      tag: 'SCV1',
      type: 'modulating_valve',
      description: 'Steam Modulating Control Valve to Hot Water Generator',
      travelTimeS: 2.0,
      passableThresholdPct: 10,
      failSafe: 'normally_closed',
    },
    {
      id: 'PV-11',
      tag: 'PV11',
      type: 'on_off_valve',
      description: 'Legal Flow Diversion Valve (FDV) - Divert to Balance Tank',
      travelTimeS: 0.5, // Rapid safety divert action
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
    {
      id: 'PV-8',
      tag: 'PV8',
      type: 'on_off_valve',
      description: 'Pasteurizer Forward Flow Isolation Valve to Finished Storage',
      travelTimeS: 1.0,
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
  ],
  pumps: [
    {
      id: 'P-FEED',
      tag: 'P_FEED',
      type: 'centrifugal_pump',
      description: 'Milk Feed Pump 5 HP with VFD (10,000 LPH)',
      maxFlowLpm: 167, // 10,000 LPH = 166.7 L/min
      rampUpTimeS: 1.5,
    },
    {
      id: 'P-BOOSTER',
      tag: 'P_BOOST',
      type: 'centrifugal_pump',
      description: 'Regenerator Booster Pump 5 HP (Positive Pressure Differential)',
      maxFlowLpm: 180,
      rampUpTimeS: 1.0,
    },
    {
      id: 'P-HOTWATER',
      tag: 'P_HW',
      type: 'centrifugal_pump',
      description: 'Hot Water Circulation Pump 3 HP',
      maxFlowLpm: 220,
      rampUpTimeS: 1.0,
    },
  ],
  exchangers: [
    {
      id: 'PHE-HEATING',
      tag: 'PHE_HEAT',
      type: 'heat_exchanger',
      description: 'PHE Section: Final Heating to 90°C Pasteurization Temp',
      heatTransferCoeffUA: 8500,
      primaryMedium: 'hot_water',
    },
    {
      id: 'PHE-CHILLING',
      tag: 'PHE_CHILL',
      type: 'heat_exchanger',
      description: 'PHE Section: Chilled Water Cooling to 4°C',
      heatTransferCoeffUA: 6000,
      primaryMedium: 'steam', // placeholder identifier
    },
  ],
  connections: [
    { id: 'PIPE-INLET', fromNode: 'PV-2', toNode: 'TK-BALANCE', diameterMm: 51 },
    { id: 'PIPE-FEED-SUCT', fromNode: 'TK-BALANCE', toNode: 'P-FEED', diameterMm: 51 },
    { id: 'PIPE-FEED-DISCH', fromNode: 'P-FEED', toNode: 'PHE-HEATING', diameterMm: 51 },
    { id: 'PIPE-PAST-HOLD', fromNode: 'PHE-HEATING', toNode: 'PV-11', diameterMm: 51 },
    { id: 'PIPE-FDV-FORWARD', fromNode: 'PV-11', toNode: 'PHE-CHILLING', diameterMm: 51 },
    { id: 'PIPE-CHILL-OUT', fromNode: 'PHE-CHILLING', toNode: 'PV-8', diameterMm: 51 },
    { id: 'PIPE-PROD-STORE', fromNode: 'PV-8', toNode: 'TK-PRODUCT', diameterMm: 51 },
    { id: 'PIPE-FDV-DIVERT', fromNode: 'PV-11', toNode: 'TK-BALANCE', diameterMm: 51 }, // Recycle diverted milk
  ],
};
