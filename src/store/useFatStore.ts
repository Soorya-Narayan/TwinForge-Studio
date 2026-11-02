/**
 * TwinForge Studio - FAT Test Execution Store
 * Drives automated FAT suites, evaluates assertions, and logs scan evidence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getFatScenarios } from '../core/testgen/scenarios';
import type { TestCase, TestResult, TestAssertion, ScanHistoryRecord, TestDriverInfo } from '../core/testgen/types';
import { useSimulationStore, type SkidId } from './useSimulationStore';
import { PhysicsEngine, type PlantTopology } from '../core/engine/PhysicsEngine';
import { PasteurizerPlcDriver } from '../core/driver/PasteurizerPlcDriver';
import { MockPlcDriver } from '../core/driver/MockPlcDriver';
import { GenericPlcDriver } from '../core/driver/GenericPlcDriver';
import { milkPasteurizerSkid } from '../core/templates/pasteurizerPlant';
import { defaultMixingSkid } from '../core/templates/defaultPlant';

export interface ScanJournalEntry {
  id: string;
  scan: number;
  timeFormatted: string;
  source: 'TEST_GEN' | 'PLC' | 'SIM' | 'FAULT';
  eventType: 'COMMAND' | 'FEEDBACK' | 'INTERLOCK' | 'ASSERTION' | 'FAULT';
  description: string;
  tag?: string;
  value?: string | number | boolean;
  status?: 'PASS' | 'FAIL' | 'WARN' | 'INFO';
}

export interface ReportProjectSettings {
  certificateRef: string;
  customerName: string;
  commissioningLead?: string;
  clientAuthority?: string;
}

interface FatStore {
  scenarios: TestCase[];
  currentTestIndex: number;
  isRunningSuite: boolean;
  results: TestResult[];
  journal: ScanJournalEntry[];
  showReportModal: boolean;
  reportTimestamp: string | null;
  projectSettings: ReportProjectSettings;
  executionDriverInfo: TestDriverInfo | null;

  // Actions
  syncScenarios: (skid: SkidId) => void;
  runAllTests: () => Promise<void>;
  runSingleTest: (testId: string) => Promise<void>;
  resetSuite: () => void;
  openReportModal: () => void;
  closeReportModal: () => void;
  addJournalEntry: (entry: Omit<ScanJournalEntry, 'id'>) => void;
  setProjectSettings: (settings: Partial<ReportProjectSettings>) => void;
}

const generateAutoReportRef = (): string => {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FAT-${year}-${rand}`;
};

let journalEntrySequence = 0;

export const createIsolatedTestHarness = (
  skid: SkidId,
  customTopology?: PlantTopology | null
): {
  engine: PhysicsEngine;
  plc: PasteurizerPlcDriver | MockPlcDriver | GenericPlcDriver;
} => {
  let engine: PhysicsEngine;
  let plc: PasteurizerPlcDriver | MockPlcDriver | GenericPlcDriver;

  if (skid === 'PASTEURIZER_10KLPH') {
    engine = new PhysicsEngine(milkPasteurizerSkid);
    plc = new PasteurizerPlcDriver();
  } else if (skid === 'BATCH_MIXING') {
    engine = new PhysicsEngine(defaultMixingSkid);
    plc = new MockPlcDriver();
  } else {
    const topology = customTopology || milkPasteurizerSkid;
    engine = new PhysicsEngine(topology);
    plc = new GenericPlcDriver(topology);
  }

  return { engine, plc };
};

export const useFatStore = create<FatStore>()(
  persist(
    (set, get) => ({
      scenarios: getFatScenarios('PASTEURIZER_10KLPH'),
      currentTestIndex: -1,
      isRunningSuite: false,
      results: [],
      journal: [],
      showReportModal: false,
      reportTimestamp: null,
      executionDriverInfo: null,
      projectSettings: {
        certificateRef: generateAutoReportRef(),
        customerName: '',
        commissioningLead: 'Commissioning Lead Engineer',
        clientAuthority: 'Client Acceptance Authority',
      },

      setProjectSettings: (settings) => {
        set((state) => ({
          projectSettings: { ...state.projectSettings, ...settings },
        }));
      },

      syncScenarios: (skid: SkidId) => {
        set({
          scenarios: getFatScenarios(skid),
          currentTestIndex: -1,
          isRunningSuite: false,
          results: [],
          executionDriverInfo: null,
        });
      },

      openReportModal: () =>
        set((state) => ({
          showReportModal: true,
          reportTimestamp: new Date().toISOString(),
          projectSettings: {
            ...state.projectSettings,
            certificateRef: state.projectSettings.certificateRef || generateAutoReportRef(),
          },
        })),
      closeReportModal: () => set({ showReportModal: false }),

      addJournalEntry: (entry) => {
        journalEntrySequence += 1;
        const id = `J-${entry.scan}-${journalEntrySequence}`;
        set((state) => ({
          journal: [{ id, ...entry }, ...state.journal].slice(0, 300), // Keep recent 300 entries
        }));
      },

      resetSuite: () => {
        journalEntrySequence = 0;
        const currentSkid = useSimulationStore.getState().activeSkid;
        set((state) => ({
          scenarios: getFatScenarios(currentSkid),
          currentTestIndex: -1,
          isRunningSuite: false,
          results: [],
          journal: [],
          showReportModal: false,
          reportTimestamp: null,
          executionDriverInfo: null,
          projectSettings: state.projectSettings,
        }));
      },

  runSingleTest: async (testId: string) => {
    const simStore = useSimulationStore.getState();
    const currentSkid = simStore.activeSkid;
    const scenarios = get().scenarios.length > 0 ? get().scenarios : getFatScenarios(currentSkid);
    const test = scenarios.find((s) => s.id === testId);
    if (!test) return;

    set({ isRunningSuite: true });

    // Isolate each test with a fresh engine and PLC instance instead of live UI instances
    const { engine, plc } = createIsolatedTestHarness(currentSkid, simStore.customTopology);

    const driverName = plc.constructor?.name || 'MockPlcDriver';
    const driverType = plc.status.driverType;
    const driverDetails = driverType === 'opcua'
      ? `Real PLC via node-opcua (${(plc as any).endpointUrl || 'opc.tcp://127.0.0.1:4840'})`
      : `In-Process Mock Driver (${driverName})`;

    const driverInfo: TestDriverInfo = {
      driverName,
      driverType,
      details: driverDetails,
      endpoint: (plc as any).endpointUrl || null,
    };

    const startTime = performance.now();
    const totalScans = test.durationScans ?? 20;
    const dtMs = test.dtMs ?? 100;
    const history: ScanHistoryRecord[] = [];

    // Log start in journal
    get().addJournalEntry({
      scan: 0,
      timeFormatted: new Date().toLocaleTimeString(),
      source: 'TEST_GEN',
      eventType: 'COMMAND',
      description: `Starting Time-Based Test [${test.id}]: ${test.title} (${totalScans} scans @ ${dtMs}ms · Harness: ${driverDetails})`,
      status: 'INFO',
    });

    try {
      // Optional setup hook before stepped execution
      if (test.setup) {
        test.setup(engine, plc);
      }

      // Step engine and PLC across totalScans
      for (let step = 0; step < totalScans; step++) {
        test.stimulus(engine, plc, step, history);

        plc.tick(dtMs);
        const outputs = plc.readOutputs();
        const snap = engine.tick(outputs);
        plc.writeInputs(snap.tags.inputs);

        const interlocks: Record<string, { isOk: boolean; tripped: boolean }> = {};
        if (plc.interlocks) {
          for (const [k, v] of plc.interlocks.entries()) {
            interlocks[k] = { isOk: v.isOk, tripped: v.tripped };
          }
        }

        history.push({
          step,
          scan: snap.scan,
          timeMs: snap.timeMs,
          inputs: { ...snap.tags.inputs },
          outputs: { ...outputs },
          plcState: (plc as any).state,
          interlocks,
          snapshot: snap,
        });
      }

      // Evaluate assertions on the full resulting history
      const assertions = test.assertions(engine, plc, history);
      const passed = assertions.every((a) => a.passed);

      // Log assertions in journal with timing metadata
      for (const a of assertions) {
        const timingBadge = a.responseTimeMs !== undefined ? ` [Response Time: ${a.responseTimeMs}ms]` : '';
        get().addJournalEntry({
          scan: history[history.length - 1]?.scan ?? totalScans,
          timeFormatted: new Date().toLocaleTimeString(),
          source: 'TEST_GEN',
          eventType: 'ASSERTION',
          description: `${a.message}${timingBadge} (Tag: ${a.tag}, Expected: ${a.expected}, Actual: ${a.actual})`,
          tag: a.tag,
          value: String(a.actual),
          status: a.passed ? 'PASS' : 'FAIL',
        });
      }

      const result: TestResult = {
        testId: test.id,
        phase: test.phase,
        title: test.title,
        clause: test.clause,
        passed,
        assertions,
        timestamp: new Date().toISOString(),
        durationMs: Math.round(performance.now() - startTime),
        scansExecuted: totalScans,
        driver: driverInfo,
      };

      set((state) => ({
        results: [...state.results.filter((r) => r.testId !== test.id), result],
        executionDriverInfo: driverInfo,
      }));
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error executing scenario [${test.id}]:`, err);

      const failedAssertion: TestAssertion = {
        tag: 'SCENARIO_EXECUTION',
        expected: 'COMPLETED_WITHOUT_ERROR',
        actual: `ERROR: ${errorMsg}`,
        passed: false,
        message: `Scenario aborted with runtime exception: ${errorMsg}`,
      };

      get().addJournalEntry({
        scan: history[history.length - 1]?.scan ?? 0,
        timeFormatted: new Date().toLocaleTimeString(),
        source: 'TEST_GEN',
        eventType: 'ASSERTION',
        description: `Scenario [${test.id}] thrown runtime error: ${errorMsg}`,
        tag: 'EXCEPTION',
        value: errorMsg,
        status: 'FAIL',
      });

      const failedResult: TestResult = {
        testId: test.id,
        phase: test.phase,
        title: test.title,
        clause: test.clause,
        passed: false,
        assertions: [failedAssertion],
        timestamp: new Date().toISOString(),
        durationMs: Math.round(performance.now() - startTime),
        scansExecuted: history.length,
        driver: driverInfo,
      };

      set((state) => ({
        results: [...state.results.filter((r) => r.testId !== test.id), failedResult],
        executionDriverInfo: driverInfo,
      }));
    } finally {
      // Guaranteed teardown: clear all injected faults after each test
      // so test outcomes never depend on execution order
      if (test.teardown) {
        try {
          test.teardown(engine, plc);
        } catch (teardownErr) {
          console.warn(`Teardown error in [${test.id}]:`, teardownErr);
        }
      }
      engine.clearAllFaults();
      set({ isRunningSuite: false });
    }
  },

  runAllTests: async () => {
    const { resetSuite, runSingleTest } = get();
    resetSuite();
    const scenarios = get().scenarios;
    set({ isRunningSuite: true });

    try {
      for (let i = 0; i < scenarios.length; i++) {
        set({ currentTestIndex: i, isRunningSuite: true });
        try {
          await runSingleTest(scenarios[i].id);
        } catch (singleErr) {
          console.error(`Suite runner caught unexpected error on test [${scenarios[i].id}]:`, singleErr);
        }
        // Maintain isRunningSuite state across inter-test pauses
        if (i < scenarios.length - 1) {
          set({ isRunningSuite: true });
        }
        // Wait brief 400ms pause for visual feedback
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      set({ showReportModal: true });
    } finally {
      set({ isRunningSuite: false, currentTestIndex: -1 });
    }
  },
    }),
    {
      name: 'twinforge-fat-project-settings',
      partialize: (state) => ({
        projectSettings: state.projectSettings,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<FatStore> | undefined;
        return {
          ...currentState,
          projectSettings: {
            ...currentState.projectSettings,
            ...(persisted?.projectSettings || {}),
          },
        };
      },
    }
  )
);

