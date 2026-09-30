/**
 * TwinForge Studio - Simulation Store
 * Real-time state coordination for physical simulation & PLC mock.
 */

import { create } from 'zustand';
import { PhysicsEngine } from '../core/engine/PhysicsEngine';
import { MockPlcDriver } from '../core/driver/MockPlcDriver';
import { defaultMixingSkid } from '../core/templates/defaultPlant';
import type { SimulationSnapshot, DeviceFault } from '../core/engine/types';

export interface TrendDataPoint {
  timeSec: number;
  tk100Level: number;
  tk400Level: number;
  flowRate: number;
  temperature: number;
  pumpSpeed: number;
}

interface SimulationStore {
  engine: PhysicsEngine;
  plc: MockPlcDriver;
  running: boolean;
  speed: number; // 1x, 2x, 5x, 10x
  snapshot: SimulationSnapshot | null;
  faults: DeviceFault[];
  trendHistory: TrendDataPoint[];

  // Actions
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

const initialEngine = new PhysicsEngine(defaultMixingSkid);
const initialPlc = new MockPlcDriver();

export const useSimulationStore = create<SimulationStore>((set, get) => {
  let timerId: number | null = null;

  const tickOnce = () => {
    const { engine, plc, trendHistory } = get();

    // 1. PLC reads its inputs and evaluates its internal state machine
    plc.tick(100);

    // 2. Physics engine takes PLC commands and ticks physics
    const outputs = plc.readOutputs();
    const snap = engine.tick(outputs);

    // 3. Sim sensors feed back into PLC inputs
    plc.writeInputs(snap.tags.inputs);

    // 4. Capture Trend Data Point
    const dataPoint: TrendDataPoint = {
      timeSec: Number((snap.timeMs / 1000).toFixed(1)),
      tk100Level: snap.devices['TK-100']?.levelPct ?? 0,
      tk400Level: snap.devices['TK-400']?.levelPct ?? 0,
      flowRate: snap.paths.find((p) => p.id === 'PIPE-02')?.flowLpm ?? 0,
      temperature: snap.devices['HX-100']?.temperatureC ?? 20,
      pumpSpeed: snap.devices['P-100']?.speedPct ?? 0,
    };

    const nextTrend = [...trendHistory, dataPoint].slice(-600); // 60s window at 100ms

    set({ snapshot: snap, faults: engine.getFaults(), trendHistory: nextTrend });
  };

  const startLoop = () => {
    if (timerId !== null) clearInterval(timerId);
    const interval = Math.max(10, Math.floor(100 / get().speed));
    timerId = window.setInterval(() => {
      tickOnce();
    }, interval);
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
    engine: initialEngine,
    plc: initialPlc,
    running: false,
    speed: 1,
    snapshot: initialSnap,
    faults: [],
    trendHistory: [],

    start: () => {
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
      const { engine, plc } = get();
      engine.reset();
      plc.resetBatch();
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
      get().plc.startBatch();
      if (!get().running) startLoop();
    },

    holdPlcBatch: () => {
      get().plc.holdBatch();
      tickOnce();
    },

    resumePlcBatch: () => {
      get().plc.resumeBatch();
      if (!get().running) startLoop();
    },

    abortPlcBatch: () => {
      get().plc.abortBatch();
      tickOnce();
    },

    setPlcMode: (mode) => {
      get().plc.mode = mode;
      tickOnce();
    },

    manualOverrideOutput: (tag, value) => {
      const { plc } = get();
      plc.outputs[tag] = value;
      tickOnce();
    },
  };
});
