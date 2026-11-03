/**
 * TwinForge Studio - Simulation Store
 * Real-time state coordination for physical simulation & PLC mock.
 */

import { create } from 'zustand';
import { PhysicsEngine, type PlantTopology } from '../core/engine/PhysicsEngine';
import type { Driver } from '../core/driver/Driver';
import { MockPlcDriver } from '../core/driver/MockPlcDriver';
import { PasteurizerPlcDriver } from '../core/driver/PasteurizerPlcDriver';
import { GenericPlcDriver } from '../core/driver/GenericPlcDriver';
import { OpcUaPlcDriver, type OpcUaConnectionOptions } from '../core/driver/OpcUaPlcDriver';
import { defaultMixingSkid } from '../core/templates/defaultPlant';
import { milkPasteurizerSkid } from '../core/templates/pasteurizerPlant';
import type { CustomSkidMeta } from '../core/templates/customTemplateValidator';
import type { SimulationSnapshot, DeviceFault } from '../core/engine/types';
import {
  loadStoredTagMap,
  saveStoredTagMap,
  getDefaultTagMap,
  loadStoredTagTypeMap,
  saveStoredTagTypeMap,
  getDefaultTagTypeMap,
  type TagDataType,
} from '../core/driver/opcuaTagMap';
import {
  loadStoredInterlockDefinitions,
  saveStoredInterlockDefinitions,
  DEFAULT_INTERLOCK_DEFINITIONS,
  type InterlockDefinition,
} from '../core/driver/interlockConfig';

export type SkidId = 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'CUSTOM';
export type DriverMode = 'MOCK' | 'OPCUA';

export interface TrendDataPoint {
  timeSec: number;
  tk100Level: number;
  tk400Level: number;
  flowRate: number;
  temperature: number;
  pumpSpeed: number;
  pheRegenEff?: number;
  pheDuty?: number;
  pheDiffPress?: number;
}

interface SimulationStore {
  activeSkid: SkidId;
  customMeta: CustomSkidMeta | null;
  customTopology: PlantTopology | null;
  engine: PhysicsEngine;
  plc: Driver;
  driverMode: DriverMode;
  opcuaEndpoint: string;
  opcuaSecurityOptions?: OpcUaConnectionOptions;
  opcuaTagMap: Record<string, string>;
  opcuaTagTypes: Record<string, TagDataType>;
  interlockDefinitions: InterlockDefinition[];
  running: boolean;
  isFatRunning: boolean;
  speed: number; // 1x, 2x, 5x, 10x
  snapshot: SimulationSnapshot | null;
  faults: DeviceFault[];
  trendHistory: TrendDataPoint[];

  // Actions
  setSkid: (skid: SkidId) => void;
  setCustomSkid: (topology: PlantTopology, meta: CustomSkidMeta) => void;
  deleteCustomSkid: () => void;
  setDriverMode: (mode: DriverMode, endpointOrOptions?: string | OpcUaConnectionOptions) => Promise<void>;
  connectOpcUa: (options?: string | OpcUaConnectionOptions) => Promise<void>;
  disconnectOpcUa: () => Promise<void>;
  startLocalOpcUaServer: (port?: number) => Promise<string>;
  stopLocalOpcUaServer: () => Promise<void>;
  setOpcuaTagMap: (map: Record<string, string>) => void;
  resetOpcuaTagMap: () => void;
  setOpcuaTagType: (tag: string, dataType: TagDataType) => void;
  resetOpcuaTagTypes: () => void;
  setInterlockDefinitions: (defs: InterlockDefinition[]) => void;
  resetInterlockDefinitions: () => void;
  setFatRunning: (active: boolean) => Promise<void>;
  start: () => void;
  pause: () => void;
  step: () => void;
  reset: () => void;
  clearTrendHistory: () => void;
  setSpeed: (speed: number) => void;
  injectFault: (fault: DeviceFault) => void;
  clearFaults: () => void;
  
  // Operator Actions
  startPlcBatch: () => void;
  holdPlcBatch: () => void;
  resumePlcBatch: () => void;
  abortPlcBatch: () => void;
  setPlcMode: (mode: 'AUTO' | 'MANUAL' | 'MAINTENANCE') => void;
  manualOverrideOutput: (tag: string, value: boolean | number) => void;
}

const initialEngine = new PhysicsEngine(milkPasteurizerSkid);
const initialInterlockDefs = loadStoredInterlockDefinitions();
const initialPlc = new PasteurizerPlcDriver(initialInterlockDefs);

export const useSimulationStore = create<SimulationStore>((set, get) => {
  let timerId: number | null = null;
  let isTicking = false;
  let currentTickPromise: Promise<void> | null = null;

  const tickOnce = async () => {
    if (get().isFatRunning) return;
    if (isTicking) return;
    isTicking = true;

    const promise = (async () => {
      try {
      const { engine, plc, trendHistory, activeSkid } = get();

      // 1. PLC reads its inputs and evaluates its internal state machine
      try {
        await plc.tick?.(100);
      } catch (err: any) {
        console.warn('Simulation tick PLC error:', err?.message || String(err));
      }

      // 2. Physics engine takes PLC commands and ticks physics
      const outputs = plc.readOutputs();
      const snap = engine.tick(outputs);

      // 3. Sim sensors feed back into PLC inputs
      try {
        await plc.writeInputs(snap.tags.inputs);
      } catch (err: any) {
        console.warn('Simulation tick writeInputs error:', err?.message || String(err));
      }

    // 4. Capture Trend Data Point dynamically mapped for current skid
    let dataPoint: TrendDataPoint;
    if (activeSkid === 'PASTEURIZER_10KLPH') {
      dataPoint = {
        timeSec: Number((snap.timeMs / 1000).toFixed(1)),
        tk100Level: snap.devices['TK-BALANCE']?.levelPct ?? 0,
        tk400Level: snap.devices['TK-PRODUCT']?.levelPct ?? 0,
        flowRate: Number(snap.tags.inputs['FM'] ?? 0) / 60,
        temperature: Number(snap.tags.inputs['TT5'] ?? snap.devices['PHE-HEATING']?.temperatureC ?? 20),
        pumpSpeed: snap.devices['P-FEED']?.speedPct ?? 0,
        pheRegenEff: Number(snap.tags.inputs['PHE_REGEN_EFF_PCT'] ?? 91.5),
        pheDuty: Number(snap.tags.inputs['PHE_TOTAL_DUTY_KW'] ?? 245),
        pheDiffPress: Number(snap.tags.inputs['PT4'] ?? 4.1) - Number(snap.tags.inputs['PT2'] ?? 2.5),
      };
    } else if (activeSkid === 'BATCH_MIXING') {
      dataPoint = {
        timeSec: Number((snap.timeMs / 1000).toFixed(1)),
        tk100Level: snap.devices['TK-100']?.levelPct ?? 0,
        tk400Level: snap.devices['TK-400']?.levelPct ?? 0,
        flowRate: snap.paths.find((p) => p.id === 'PIPE-02')?.flowLpm ?? 0,
        temperature: snap.devices['HX-100']?.temperatureC ?? 20,
        pumpSpeed: snap.devices['P-100']?.speedPct ?? 0,
      };
    } else {
      // Dynamic mapping for CUSTOM skid: pick first available vessels and motive equipment
      const tanks = Object.values(snap.devices).filter((d) => d.type === 'tank');
      const pumps = Object.values(snap.devices).filter((d) => d.type === 'centrifugal_pump');
      const exchangers = Object.values(snap.devices).filter((d) => d.type === 'heat_exchanger');
      const firstActivePath = snap.paths.find((p) => (p.flowLpm ?? 0) > 0) ?? snap.paths[0];

      dataPoint = {
        timeSec: Number((snap.timeMs / 1000).toFixed(1)),
        tk100Level: tanks[0]?.levelPct ?? 0,
        tk400Level: tanks[1]?.levelPct ?? tanks[0]?.levelPct ?? 0,
        flowRate: firstActivePath?.flowLpm ?? 0,
        temperature: exchangers[0]?.temperatureC ?? tanks[0]?.temperatureC ?? 25,
        pumpSpeed: pumps[0]?.speedPct ?? 0,
      };
    }

    const nextTrend = [...trendHistory, dataPoint].slice(-600); // 60s window at 100ms

      set({ snapshot: snap, faults: engine.getFaults(), trendHistory: nextTrend });
      } finally {
        isTicking = false;
        currentTickPromise = null;
      }
    })();

    currentTickPromise = promise;
    await promise;
  };

  const startLoop = () => {
    if (get().isFatRunning) return;
    if (timerId !== null) clearInterval(timerId);
    const interval = Math.max(10, Math.floor(100 / get().speed));
    timerId = setInterval(() => {
      void tickOnce().catch((err) => {
        console.warn('Simulation tick unhandled error:', err);
      });
    }, interval) as any;
    set({ running: true });
  };

  const stopLoop = () => {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    set({ running: false });
  };

  // Perform initial tick to populate snapshot
  const initialSnap = initialEngine.tick(initialPlc.readOutputs());
  initialPlc.writeInputs(initialSnap.tags.inputs);

  return {
    activeSkid: 'PASTEURIZER_10KLPH',
    customMeta: null,
    customTopology: null,
    engine: initialEngine,
    plc: initialPlc,
    driverMode: 'MOCK',
    opcuaEndpoint: 'opc.tcp://127.0.0.1:4840',
    opcuaTagMap: loadStoredTagMap(),
    opcuaTagTypes: loadStoredTagTypeMap(),
    interlockDefinitions: initialInterlockDefs,
    running: false,
    isFatRunning: false,
    speed: 1,
    snapshot: initialSnap,
    faults: [],
    trendHistory: [],

    setDriverMode: async (mode, endpointOrOptions) => {
      stopLoop();
      const currentDefs = get().interlockDefinitions;
      const opts: OpcUaConnectionOptions = typeof endpointOrOptions === 'string'
        ? { endpointUrl: endpointOrOptions, tagMap: get().opcuaTagMap, tagTypeMap: get().opcuaTagTypes, activeSkid: get().activeSkid, interlockDefinitions: currentDefs }
        : endpointOrOptions
        ? { tagMap: get().opcuaTagMap, tagTypeMap: get().opcuaTagTypes, activeSkid: get().activeSkid, interlockDefinitions: currentDefs, ...endpointOrOptions }
        : { endpointUrl: get().opcuaEndpoint, tagMap: get().opcuaTagMap, tagTypeMap: get().opcuaTagTypes, activeSkid: get().activeSkid, interlockDefinitions: currentDefs };
      const endpoint = opts.endpointUrl || get().opcuaEndpoint;
      opts.endpointUrl = endpoint;

      if (mode === 'OPCUA') {
        const opcDriver = new OpcUaPlcDriver(opts);
        try {
          await opcDriver.connect(opts);
        } catch (err) {
          console.warn('Initial OPC UA connection attempt:', err);
        }
        const snap = get().engine.tick(opcDriver.readOutputs());
        try {
          await opcDriver.writeInputs(snap.tags.inputs);
        } catch (err) {
          console.warn('Initial OPC UA writeInputs error:', err);
        }
        set({ driverMode: 'OPCUA', opcuaEndpoint: endpoint, opcuaSecurityOptions: opts, plc: opcDriver, snapshot: snap });
      } else {
        const { activeSkid, customTopology } = get();
        let newPlc: PasteurizerPlcDriver | MockPlcDriver | GenericPlcDriver;
        if (activeSkid === 'PASTEURIZER_10KLPH') {
          newPlc = new PasteurizerPlcDriver(currentDefs);
        } else if (activeSkid === 'BATCH_MIXING') {
          newPlc = new MockPlcDriver(currentDefs);
        } else {
          newPlc = new GenericPlcDriver(customTopology || milkPasteurizerSkid);
        }
        const snap = get().engine.tick(newPlc.readOutputs());
        newPlc.writeInputs(snap.tags.inputs);
        set({ driverMode: 'MOCK', plc: newPlc, snapshot: snap });
      }
    },

    connectOpcUa: async (options) => {
      const opts: OpcUaConnectionOptions = typeof options === 'string'
        ? { endpointUrl: options }
        : options || { endpointUrl: get().opcuaEndpoint };
      const endpoint = opts.endpointUrl || get().opcuaEndpoint;
      opts.endpointUrl = endpoint;

      const { plc, driverMode } = get();
      if (driverMode === 'OPCUA' && plc instanceof OpcUaPlcDriver) {
        await plc.connect(opts);
        set({ opcuaEndpoint: endpoint, opcuaSecurityOptions: opts });
      } else {
        await get().setDriverMode('OPCUA', opts);
      }
    },

    disconnectOpcUa: async () => {
      const { plc } = get();
      if (plc instanceof OpcUaPlcDriver) {
        await plc.disconnect();
      }
    },

    startLocalOpcUaServer: async (port = 4840) => {
      const { plc } = get();
      const authOpts: OpcUaConnectionOptions = {
        endpointUrl: `opc.tcp://127.0.0.1:${port}`,
        securityMode: 'None',
        securityPolicy: 'None',
        authMode: 'Username',
        username: 'admin',
        password: 'password',
        tagMap: get().opcuaTagMap,
        tagTypeMap: get().opcuaTagTypes,
        activeSkid: get().activeSkid,
        interlockDefinitions: get().interlockDefinitions,
      };
      if (plc instanceof OpcUaPlcDriver) {
        const endpoint = await plc.startLocalServer(port);
        authOpts.endpointUrl = endpoint;
        await plc.connect(authOpts);
        set({ opcuaEndpoint: endpoint, opcuaSecurityOptions: authOpts });
        return endpoint;
      } else {
        const opcDriver = new OpcUaPlcDriver(authOpts);
        const endpoint = await opcDriver.startLocalServer(port);
        authOpts.endpointUrl = endpoint;
        await opcDriver.connect(authOpts);
        const snap = get().engine.tick(opcDriver.readOutputs());
        try {
          await opcDriver.writeInputs(snap.tags.inputs);
        } catch (err) {
          console.warn('Initial OPC UA writeInputs error:', err);
        }
        set({ driverMode: 'OPCUA', plc: opcDriver, opcuaEndpoint: endpoint, opcuaSecurityOptions: authOpts, snapshot: snap });
        return endpoint;
      }
    },

    stopLocalOpcUaServer: async () => {
      const { plc } = get();
      if (plc instanceof OpcUaPlcDriver) {
        await plc.stopLocalServer();
      }
    },

    setOpcuaTagMap: (newMap: Record<string, string>) => {
      saveStoredTagMap(newMap);
      const { plc } = get();
      if (plc instanceof OpcUaPlcDriver) {
        plc.setTagMap(newMap);
      }
      set({ opcuaTagMap: newMap });
    },

    resetOpcuaTagMap: () => {
      const defaultMap = getDefaultTagMap();
      saveStoredTagMap(defaultMap);
      const { plc } = get();
      if (plc instanceof OpcUaPlcDriver) {
        plc.setTagMap(defaultMap);
      }
      set({ opcuaTagMap: defaultMap });
    },

    setOpcuaTagType: (tag: string, dataType: TagDataType) => {
      const newTypes = { ...get().opcuaTagTypes, [tag]: dataType };
      saveStoredTagTypeMap(newTypes);
      const { plc } = get();
      if (plc instanceof OpcUaPlcDriver) {
        plc.setTagTypeMap(newTypes);
      }
      set({ opcuaTagTypes: newTypes });
    },

    resetOpcuaTagTypes: () => {
      const defaultTypes = getDefaultTagTypeMap();
      saveStoredTagTypeMap(defaultTypes);
      const { plc } = get();
      if (plc instanceof OpcUaPlcDriver) {
        plc.setTagTypeMap(defaultTypes);
      }
      set({ opcuaTagTypes: defaultTypes });
    },

    setInterlockDefinitions: (defs: InterlockDefinition[]) => {
      saveStoredInterlockDefinitions(defs);
      const { plc } = get();
      if (typeof plc.setInterlockDefinitions === 'function') {
        plc.setInterlockDefinitions(defs);
      }
      set({ interlockDefinitions: defs });
    },

    resetInterlockDefinitions: () => {
      saveStoredInterlockDefinitions(DEFAULT_INTERLOCK_DEFINITIONS);
      const { plc } = get();
      if (typeof plc.setInterlockDefinitions === 'function') {
        plc.setInterlockDefinitions(DEFAULT_INTERLOCK_DEFINITIONS);
      }
      set({ interlockDefinitions: DEFAULT_INTERLOCK_DEFINITIONS });
    },

    setFatRunning: async (active: boolean) => {
      if (active) {
        stopLoop();
        if (currentTickPromise) {
          try {
            await currentTickPromise;
          } catch (err) {
            console.warn('Error awaiting in-flight live tick before FAT:', err);
          }
        }
      }
      set({ isFatRunning: active });
    },

    setSkid: (skid) => {
      stopLoop();
      const topology = skid === 'PASTEURIZER_10KLPH' ? milkPasteurizerSkid : defaultMixingSkid;
      const newEngine = new PhysicsEngine(topology);
      const { driverMode, plc, interlockDefinitions } = get();
      let newPlc = plc;
      if (driverMode === 'OPCUA' && plc instanceof OpcUaPlcDriver) {
        plc.setSkid(skid);
      } else {
        newPlc = skid === 'PASTEURIZER_10KLPH'
          ? new PasteurizerPlcDriver(interlockDefinitions)
          : new MockPlcDriver(interlockDefinitions);
      }
      const snap = newEngine.tick(newPlc.readOutputs());
      newPlc.writeInputs(snap.tags.inputs);
      set({ activeSkid: skid, engine: newEngine, plc: newPlc, snapshot: snap, faults: [], trendHistory: [] });
    },

    setCustomSkid: (topology: PlantTopology, meta: CustomSkidMeta) => {
      stopLoop();
      const newEngine = new PhysicsEngine(topology);
      const { driverMode, plc } = get();
      let newPlc = plc;
      if (driverMode === 'OPCUA' && plc instanceof OpcUaPlcDriver) {
        plc.setSkid('CUSTOM');
      } else {
        newPlc = new GenericPlcDriver(topology);
      }
      const snap = newEngine.tick(newPlc.readOutputs());
      newPlc.writeInputs(snap.tags.inputs);
      set({
        activeSkid: 'CUSTOM',
        customMeta: meta,
        customTopology: topology,
        engine: newEngine,
        plc: newPlc,
        snapshot: snap,
        faults: [],
        trendHistory: [],
      });
    },

    deleteCustomSkid: () => {
      stopLoop();
      const { activeSkid } = get();
      if (activeSkid === 'CUSTOM') {
        get().setSkid('PASTEURIZER_10KLPH');
      }
      set({
        customMeta: null,
        customTopology: null,
      });
    },

    start: () => {
      if (get().isFatRunning) {
        console.warn('Cannot start live simulation while FAT test run is in progress.');
        return;
      }
      const { plc, activeSkid } = get();
      if (plc instanceof OpcUaPlcDriver) {
        plc.startProduction().catch((err) => console.warn('startProduction failed:', err));
      } else if (activeSkid === 'PASTEURIZER_10KLPH') {
        const pastPlc = plc as PasteurizerPlcDriver;
        if (pastPlc.state === 'STOPPED') {
          pastPlc.startProduction();
        }
      } else if (activeSkid === 'BATCH_MIXING') {
        const mockPlc = plc as MockPlcDriver;
        if (mockPlc.state === 'IDLE') {
          mockPlc.startBatch();
        }
      } else if (activeSkid === 'CUSTOM') {
        const genPlc = plc as GenericPlcDriver;
        if (genPlc.state === 'STOPPED') {
          genPlc.startProduction();
        }
      }
      startLoop();
    },

    pause: () => {
      stopLoop();
    },

    step: () => {
      if (get().isFatRunning) {
        console.warn('Cannot step live simulation while FAT test run is in progress.');
        return;
      }
      stopLoop();
      tickOnce();
    },

    reset: () => {
      stopLoop();
      const { engine, plc, activeSkid } = get();
      engine.reset();
      if (plc instanceof OpcUaPlcDriver) {
        plc.resetBatch().catch((err) => console.warn('resetBatch failed:', err));
      } else if (activeSkid === 'PASTEURIZER_10KLPH') {
        (plc as PasteurizerPlcDriver).resetSystem();
      } else if (activeSkid === 'BATCH_MIXING') {
        (plc as MockPlcDriver).resetBatch();
      } else if (activeSkid === 'CUSTOM') {
        (plc as GenericPlcDriver).resetSystem();
      }
      const snap = engine.tick(plc.readOutputs());
      const writeRes = plc.writeInputs(snap.tags.inputs);
      if (writeRes && typeof (writeRes as any).catch === 'function') {
        (writeRes as any).catch((err: any) => console.warn('writeInputs failed:', err));
      }
      set({ snapshot: snap, faults: [], trendHistory: [] });
    },

    clearTrendHistory: () => {
      set({ trendHistory: [] });
    },

    setSpeed: (speed: number) => {
      set({ speed });
      if (get().running) {
        startLoop();
      }
    },

    injectFault: (fault: DeviceFault) => {
      const { engine } = get();
      engine.setFault(fault);
      set({ faults: engine.getFaults() });
      tickOnce();
    },

    clearFaults: () => {
      const { engine } = get();
      engine.clearAllFaults();
      set({ faults: [] });
      tickOnce();
    },

    startPlcBatch: () => {
      if (get().isFatRunning) {
        console.warn('Cannot start live batch while FAT test run is in progress.');
        return;
      }
      const { plc, activeSkid } = get();
      if (plc instanceof OpcUaPlcDriver) {
        plc.startProduction().catch((err) => console.warn('startProduction failed:', err));
      } else if (activeSkid === 'PASTEURIZER_10KLPH') {
        (plc as PasteurizerPlcDriver).startProduction();
      } else {
        (plc as MockPlcDriver).startBatch();
      }
      if (!get().running) startLoop();
    },

    holdPlcBatch: () => {
      const { plc, activeSkid } = get();
      if (plc instanceof OpcUaPlcDriver) {
        plc.divertManually().catch((err) => console.warn('divertManually failed:', err));
      } else if (activeSkid === 'PASTEURIZER_10KLPH') {
        (plc as PasteurizerPlcDriver).divertManually();
      } else {
        (plc as MockPlcDriver).holdBatch();
      }
      tickOnce();
    },

    resumePlcBatch: () => {
      if (get().isFatRunning) {
        console.warn('Cannot resume live batch while FAT test run is in progress.');
        return;
      }
      const { plc, activeSkid } = get();
      if (plc instanceof OpcUaPlcDriver) {
        plc.startProduction().catch((err) => console.warn('startProduction failed:', err));
      } else if (activeSkid === 'PASTEURIZER_10KLPH') {
        (plc as PasteurizerPlcDriver).startProduction();
      } else {
        (plc as MockPlcDriver).resumeBatch();
      }
      if (!get().running) startLoop();
    },

    abortPlcBatch: () => {
      const { plc, activeSkid } = get();
      if (plc instanceof OpcUaPlcDriver) {
        plc.emergencyStop().catch((err) => console.warn('emergencyStop failed:', err));
      } else if (activeSkid === 'PASTEURIZER_10KLPH') {
        (plc as PasteurizerPlcDriver).emergencyStop();
      } else {
        (plc as MockPlcDriver).abortBatch();
      }
      tickOnce();
    },

    setPlcMode: (mode) => {
      const { plc } = get();
      if ('mode' in plc) {
        plc.mode = mode;
      }
      tickOnce();
    },

    manualOverrideOutput: (tag, value) => {
      if (get().isFatRunning) {
        console.warn('Cannot override output while FAT test run is in progress.');
        return;
      }
      const { plc } = get();
      plc.outputs[tag] = value;
      tickOnce();
    },
  };
});
