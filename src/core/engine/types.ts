/**
 * TwinForge Studio - Core Simulation Engine Types
 * Deterministic, path-resolved industrial physical simulation.
 */

export type DeviceType = 
  | 'tank' 
  | 'on_off_valve' 
  | 'modulating_valve' 
  | 'centrifugal_pump' 
  | 'heat_exchanger' 
  | 'flow_transmitter' 
  | 'level_switch' 
  | 'temperature_transmitter'
  | 'conductivity_transmitter';

export interface BaseDeviceConfig {
  id: string;
  tag: string;
  type: DeviceType;
  description: string;
}

export interface TankConfig extends BaseDeviceConfig {
  type: 'tank';
  capacityL: number;
  initialLevelPct: number;
  initialTempC?: number;
  diameterM?: number;
  heightM?: number;
}

export interface ValveConfig extends BaseDeviceConfig {
  type: 'on_off_valve' | 'modulating_valve';
  travelTimeS: number;       // Time to transit 0% <-> 100%
  passableThresholdPct: number; // Position % above which fluid passes (default 90%)
  failSafe: 'normally_closed' | 'normally_open';
}

export interface PumpConfig extends BaseDeviceConfig {
  type: 'centrifugal_pump';
  maxFlowLpm: number;        // Maximum rated flow in liters/min
  rampUpTimeS: number;       // Time to reach 100% speed
  headM?: number;
}

export interface HeatExchangerConfig extends BaseDeviceConfig {
  type: 'heat_exchanger';
  heatTransferCoeffUA: number; // W / °C
  primaryMedium: 'steam' | 'hot_water';
}

export interface PipeConnection {
  id: string;
  fromNode: string;
  fromPort?: string;
  toNode: string;
  toPort?: string;
  diameterMm: number;
  lengthM?: number;
}

export type FaultMode = 
  | 'none'
  | 'stuck_closed'
  | 'stuck_open'
  | 'travel_delay'
  | 'pump_trip'
  | 'pump_cavitation'
  | 'sensor_offset'
  | 'wire_break';

export interface DeviceFault {
  deviceId: string;
  mode: FaultMode;
  value?: number; // e.g., offset value or stuck percentage
}

export interface DevicePhysicalState {
  id: string;
  type: DeviceType;
  positionPct?: number;      // Valves (0 - 100%)
  isOpen?: boolean;          // Valves proof
  speedPct?: number;         // Pumps (0 - 100%)
  volumeL?: number;          // Tanks
  levelPct?: number;         // Tanks (0 - 100%)
  temperatureC?: number;     // Fluid / media temp
  conductivityMs?: number;   // CIP solutions
  flowRateLpm?: number;      // Pipes / Transmitters
  pressureBar?: number;
}

export interface SimulationSnapshot {
  scan: number;
  timeMs: number;
  devices: Record<string, DevicePhysicalState>;
  paths: { id: string; flowLpm: number; active: boolean }[];
  tags: {
    inputs: Record<string, boolean | number>;  // Sim to PLC (Sensors, feedback)
    outputs: Record<string, boolean | number>; // PLC to Sim (Commands)
  };
  alarms: string[];
}
