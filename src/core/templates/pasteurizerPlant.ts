/**
 * TwinForge Studio - Milk Pasteurizer 10 KLPH Plant Topology
 * Continuous HTST Dairy Process Simulation Template
 * 10,000 LPH Capacity · 3-A Sanitary / PMO Standards
 */

import type { PlantTopology } from '../engine/PhysicsEngine';

export const milkPasteurizerSkid: PlantTopology = {
  tanks: [
    {
      id: 'TK-BALANCE',
      tag: 'TK_BAL',
      type: 'tank',
      description: 'Raw Milk Balance Tank with Float Level Control (LT1, LS1, LS2)',
      capacityL: 600,
      initialLevelPct: 75,
      initialTempC: 4.0, // Chilled raw milk from silos
    },
    {
      id: 'TK-PRODUCT',
      tag: 'TK_PROD',
      type: 'tank',
      description: 'Pasteurized Milk Finished Storage Silo (Product Out Ø 51 mm)',
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
      description: 'Raw Milk Inlet Valve to Balance Tank (Ø 51 mm)',
      travelTimeS: 1.0,
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
    {
      id: 'PV-2',
      tag: 'PV2',
      type: 'on_off_valve',
      description: 'Water Inlet Valve to Balance Tank (Ø 51 mm) for Water Circulation / CIP',
      travelTimeS: 1.0,
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
    {
      id: 'PV-3',
      tag: 'PV3',
      type: 'on_off_valve',
      description: 'Water Inlet to Hot Water Preparation Loop (Ø 25 mm)',
      travelTimeS: 1.0,
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
    {
      id: 'PV-4',
      tag: 'PV4',
      type: 'on_off_valve',
      description: 'Cream Separator Feed Isolation Valve (Ø 51 mm)',
      travelTimeS: 1.0,
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
    {
      id: 'PV-5',
      tag: 'PV5',
      type: 'on_off_valve',
      description: 'Cream Separator Skim Milk Return Valve (Ø 51 mm)',
      travelTimeS: 1.0,
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
    {
      id: 'PV-6',
      tag: 'PV6',
      type: 'modulating_valve',
      description: 'Cream Discharge Line Modulating Control Valve',
      travelTimeS: 1.5,
      passableThresholdPct: 10,
      failSafe: 'normally_closed',
    },
    {
      id: 'PV-7',
      tag: 'PV7',
      type: 'on_off_valve',
      description: 'Cream Separator Full Bypass Valve (Ø 51 mm)',
      travelTimeS: 1.0,
      passableThresholdPct: 90,
      failSafe: 'normally_open',
    },
    {
      id: 'PV-8',
      tag: 'PV8',
      type: 'on_off_valve',
      description: 'Homogenizer Infeed Isolation Valve (Ø 51 mm)',
      travelTimeS: 1.0,
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
    {
      id: 'PV-9',
      tag: 'PV9',
      type: 'on_off_valve',
      description: 'Homogenizer Full Bypass Valve (Ø 51 mm)',
      travelTimeS: 1.0,
      passableThresholdPct: 90,
      failSafe: 'normally_open',
    },
    {
      id: 'PV-10',
      tag: 'PV10',
      type: 'modulating_valve',
      description: 'Chilled Water Supply Modulating Control Valve (Ø 63 mm)',
      travelTimeS: 2.0,
      passableThresholdPct: 10,
      failSafe: 'normally_closed',
    },
    {
      id: 'PV-11',
      tag: 'PV11',
      type: 'on_off_valve',
      description: 'Legal Flow Diversion Valve (FDV) - Forward Flow to Regeneration / Chilling',
      travelTimeS: 0.5, // Rapid sanitary trip action
      passableThresholdPct: 90,
      failSafe: 'normally_closed',
    },
    {
      id: 'PV-12',
      tag: 'PV12',
      type: 'on_off_valve',
      description: 'Legal Flow Diversion Valve (FDV) - Divert Flow Line to Balance Tank (Ø 51 mm)',
      travelTimeS: 0.5,
      passableThresholdPct: 90,
      failSafe: 'normally_open', // Fails to divert position
    },
    {
      id: 'SCV-1',
      tag: 'SCV1',
      type: 'modulating_valve',
      description: 'Steam Modulating Control Valve (1.5") to Hot Water Generator',
      travelTimeS: 2.0,
      passableThresholdPct: 5,
      failSafe: 'normally_closed',
    },
  ],
  pumps: [
    {
      id: 'P-RAW',
      tag: 'P_RAW',
      type: 'centrifugal_pump',
      description: 'Raw Milk Transfer Pump (Feed from silos to Balance Tank)',
      maxFlowLpm: 180,
      rampUpTimeS: 1.0,
    },
    {
      id: 'P-FEED',
      tag: 'P_FEED',
      type: 'centrifugal_pump',
      description: 'Milk Feed Pump 5 HP with VFD (10,000 LPH = 166.7 L/min)',
      maxFlowLpm: 167,
      rampUpTimeS: 1.5,
    },
    {
      id: 'P-BOOSTER',
      tag: 'P_BOOST',
      type: 'centrifugal_pump',
      description: 'Regenerator Booster Pump 5 HP with VFD (Ensures positive pressure differential)',
      maxFlowLpm: 180,
      rampUpTimeS: 1.0,
    },
    {
      id: 'P-HOTWATER',
      tag: 'P_HW',
      type: 'centrifugal_pump',
      description: 'Hot Water Circulation Pump 3 HP with VFD (Closed heating loop)',
      maxFlowLpm: 220,
      rampUpTimeS: 1.0,
    },
  ],
  exchangers: [
    {
      id: 'PHE-REG01',
      tag: 'PHE_REG1',
      type: 'heat_exchanger',
      description: 'PHE Section: REG-01 (Preheating raw milk 4°C -> 28°C / 45°C via return pasteurized milk)',
      heatTransferCoeffUA: 7200,
      primaryMedium: 'hot_water',
    },
    {
      id: 'PHE-REG02',
      tag: 'PHE_REG2',
      type: 'heat_exchanger',
      description: 'PHE Section: REG-02 (Heating skim milk 45°C -> 65°C / 70°C via return pasteurized milk)',
      heatTransferCoeffUA: 7500,
      primaryMedium: 'hot_water',
    },
    {
      id: 'PHE-HEATING',
      tag: 'PHE_HEAT',
      type: 'heat_exchanger',
      description: 'PHE Section: Final Heating to 90°C Pasteurization Temp via Hot Water Loop',
      heatTransferCoeffUA: 9000,
      primaryMedium: 'hot_water',
    },
    {
      id: 'PHE-CHILLING',
      tag: 'PHE_CHILL',
      type: 'heat_exchanger',
      description: 'PHE Section: Chilling Section (Cooled to 4°C via Chilled Water Loop In/Out Ø 63 mm)',
      heatTransferCoeffUA: 6800,
      primaryMedium: 'hot_water',
    },
  ],
  connections: [
    // 1. Raw Milk Feed to Balance Tank
    { id: 'PIPE-RAW-IN', fromNode: 'P-RAW', toNode: 'PV-1', diameterMm: 51 },
    { id: 'PIPE-PV1-BAL', fromNode: 'PV-1', toNode: 'TK-BALANCE', diameterMm: 51 },
    { id: 'PIPE-WATER-IN', fromNode: 'PV-2', toNode: 'TK-BALANCE', diameterMm: 51 },
    
    // 2. Balance Tank Suction Line through Filter & NRV to Feed Pump
    { id: 'PIPE-BAL-SUCT', fromNode: 'TK-BALANCE', toNode: 'P-FEED', diameterMm: 51 },
    
    // 3. Discharge through Flow Meter FM to REG-01
    { id: 'PIPE-FEED-REG1', fromNode: 'P-FEED', toNode: 'PHE-REG01', diameterMm: 51 },
    
    // 4. From REG-01 to Cream Separator Loop
    { id: 'PIPE-REG1-SEP', fromNode: 'PHE-REG01', toNode: 'PV-4', diameterMm: 51 },
    { id: 'PIPE-REG1-BYP', fromNode: 'PHE-REG01', toNode: 'PV-7', diameterMm: 51 },
    { id: 'PIPE-SEP-REG2', fromNode: 'PV-5', toNode: 'PHE-REG02', diameterMm: 51 },
    { id: 'PIPE-BYP-REG2', fromNode: 'PV-7', toNode: 'PHE-REG02', diameterMm: 51 },
    
    // 5. From REG-02 to Homogenizer Loop
    { id: 'PIPE-REG2-HOM', fromNode: 'PHE-REG02', toNode: 'PV-8', diameterMm: 51 },
    { id: 'PIPE-REG2-HOMBYP', fromNode: 'PHE-REG02', toNode: 'PV-9', diameterMm: 51 },
    { id: 'PIPE-HOM-BOOST', fromNode: 'PV-8', toNode: 'P-BOOSTER', diameterMm: 51 },
    { id: 'PIPE-HOMBYP-BOOST', fromNode: 'PV-9', toNode: 'P-BOOSTER', diameterMm: 51 },
    
    // 6. Booster Pump to Heating PHE Section
    { id: 'PIPE-BOOST-HEAT', fromNode: 'P-BOOSTER', toNode: 'PHE-HEATING', diameterMm: 51 },
    
    // 7. Heating Section to Holding Coil (20s) and Diversion Manifold
    { id: 'PIPE-HEAT-HOLD', fromNode: 'PHE-HEATING', toNode: 'PV-11', diameterMm: 51 },
    
    // 8. Forward Flow (Legal) through REG-02 return, REG-01 return, and Chilling
    { id: 'PIPE-FDV-FWD', fromNode: 'PV-11', toNode: 'PHE-CHILLING', diameterMm: 51 },
    { id: 'PIPE-CHILL-PROD', fromNode: 'PHE-CHILLING', toNode: 'TK-PRODUCT', diameterMm: 51 },
    
    // 9. Diverted Flow (Illegal Temp) back to Balance Tank (Ø 51 mm)
    { id: 'PIPE-FDV-DIVERT', fromNode: 'PV-12', toNode: 'TK-BALANCE', diameterMm: 51 },
    
    // 10. Utilities: Hot Water Loop & Chilled Water Loop
    { id: 'PIPE-STEAM-IN', fromNode: 'SCV-1', toNode: 'PHE-HEATING', diameterMm: 38 }, // 1.5" Steam = 38mm
    { id: 'PIPE-HW-CIRC', fromNode: 'P-HOTWATER', toNode: 'PHE-HEATING', diameterMm: 51 },
    { id: 'PIPE-CHILL-WATER', fromNode: 'PV-10', toNode: 'PHE-CHILLING', diameterMm: 63 }, // Ø 63 mm
  ],
};
