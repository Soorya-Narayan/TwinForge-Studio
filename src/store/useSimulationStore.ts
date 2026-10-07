/**
 * TwinForge Studio - Simulation Store
 * Real-time state coordination for physical simulation & PLC mock.
 */

import { create } from 'zustand';
import { PhysicsEngine, type PlantTopology } from '../core/engine/PhysicsEngine';
import { MockPlcDriver } from '../core/driver/MockPlcDriver';
import { PasteurizerPlcDriver } from '../core/driver/PasteurizerPlcDriver';
import { GenericPlcDriver } from '../core/driver/GenericPlcDriver';
import { defaultMixingSkid } from '../core/templates/defaultPlant';
import { milkPasteurizerSkid } from '../core/templates/pasteurizerPlant';
import type { CustomSkidMeta } from '../core/templates/customTemplateValidator';
import type { SimulationSnapshot, DeviceFault } from '../core/engine/types';

export type SkidId = 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'CUSTOM';

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
  plc: MockPlcDriver | PasteurizerPlcDriver | GenericPlcDriver;
  running: boolean;
  speed: number; // 1x, 2x, 5x, 10x
  snapshot: SimulationSnapshot | null;
  faults: DeviceFault[];
  trendHistory: TrendDataPoint[];

  // Actions
  setSkid: (skid: SkidId) => void;
  setCustomSkid: (topology: PlantTopology, meta: CustomSkidMeta) => void;
  deleteCustomSkid: () => void;
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
const initialPlc = new PasteurizerPlcDriver();

export const useSimulationStore = create<SimulationStore>((set, get) => {
  let timerId: number | null = null;

  const tickOnce = () => {
    const { engine, plc, trendHistory, activeSkid } = get();

    // 1. PLC reads its inputs and evaluates its internal state machine
    plc.tick(100);

    // 2. Physics engine takes PLC commands and ticks physics
    const outputs = plc.readOutputs();
    const snap = engine.tick(outputs);

    // 3. Sim sensors feed back into PLC inputs
    plc.writeInputs(snap.tags.inputs);

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
  };

  const startLoop = () => {
    if (timerId !== null) clearInterval(timerId);
    const interval = Math.max(10, Math.floor(100 / get().speed));
    timerId = setInterval(() => {
      tickOnce();
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
    running: false,
    speed: 1,
    snapshot: initialSnap,
    faults: [],
    trendHistory: [],

    setSkid: (skid) => {
      stopLoop();
      const topology = skid === 'PASTEURIZER_10KLPH' ? milkPasteurizerSkid : defaultMixingSkid;
      const newEngine = new PhysicsEngine(topology);
      const newPlc = skid === 'PASTEURIZER_10KLPH' ? new PasteurizerPlcDriver() : new MockPlcDriver();
      const snap = newEngine.tick(newPlc.readOutputs());
      newPlc.writeInputs(snap.tags.inputs);
      set({ activeSkid: skid, engine: newEngine, plc: newPlc, snapshot: snap, faults: [], trendHistory: [] });
    },

    setCustomSkid: (topology: PlantTopology, meta: CustomSkidMeta) => {
      stopLoop();
      const newEngine = new PhysicsEngine(topology);
      const newPlc = new GenericPlcDriver(topology);
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
      const { plc, activeSkid } = get();
      if (activeSkid === 'PASTEURIZER_10KLPH') {
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
      stopLoop();
      tickOnce();
    },

    reset: () => {
      stopLoop();
      const { engine, plc, activeSkid } = get();
      engine.reset();
      if (activeSkid === 'PASTEURIZER_10KLPH') {
        (plc as PasteurizerPlcDriver).resetSystem();
      } else if (activeSkid === 'BATCH_MIXING') {
        (plc as MockPlcDriver).resetBatch();
      } else if (activeSkid === 'CUSTOM') {
        (plc as GenericPlcDriver).resetSystem();
      }
      const snap = engine.tick(plc.readOutputs());
      plc.writeInputs(snap.tags.inputs);
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
      const { plc, activeSkid } = get();
      if (activeSkid === 'PASTEURIZER_10KLPH') {
        (plc as PasteurizerPlcDriver).startProduction();
      } else {
        (plc as MockPlcDriver).startBatch();
      }
      if (!get().running) startLoop();
    },

    holdPlcBatch: () => {
      const { plc, activeSkid } = get();
      if (activeSkid === 'PASTEURIZER_10KLPH') {
        (plc as PasteurizerPlcDriver).divertManually();
      } else {
        (plc as MockPlcDriver).holdBatch();
      }
      tickOnce();
    },

    resumePlcBatch: () => {
      const { plc, activeSkid } = get();
      if (activeSkid === 'PASTEURIZER_10KLPH') {
        (plc as PasteurizerPlcDriver).startProduction();
      } else {
        (plc as MockPlcDriver).resumeBatch();
      }
      if (!get().running) startLoop();
    },

    abortPlcBatch: () => {
      const { plc, activeSkid } = get();
      if (activeSkid === 'PASTEURIZER_10KLPH') {
        (plc as PasteurizerPlcDriver).emergencyStop();
      } else {
        (plc as MockPlcDriver).abortBatch();
      }
      tickOnce();
    },

    setPlcMode: (mode) => {
      const { plc } = get();
      if ('mode' in plc) {
        (plc as any).mode = mode;
      }
      tickOnce();
    },

    manualOverrideOutput: (tag, value) => {
      const { plc } = get();
      plc.outputs[tag] = value;
      tickOnce();
    },
  };
});
