/**
 * TwinForge Studio - FAT Test Execution Store
 * Drives automated FAT suites, evaluates assertions, and logs scan evidence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getFatScenarios } from '../core/testgen/scenarios';
import type { TestCase, TestResult, ScanHistoryRecord } from '../core/testgen/types';
import { useSimulationStore, type SkidId } from './useSimulationStore';

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
          projectSettings: state.projectSettings,
        }));
        useSimulationStore.getState().reset();
      },

  runSingleTest: async (testId: string) => {
    const currentSkid = useSimulationStore.getState().activeSkid;
    const scenarios = getFatScenarios(currentSkid);
    const test = scenarios.find((s) => s.id === testId);
    if (!test) return;

    set({ isRunningSuite: true });
    const simStore = useSimulationStore.getState();
    const startTime = performance.now();
    const totalScans = test.durationScans ?? 20;
    const dtMs = test.dtMs ?? 100;
    const history: ScanHistoryRecord[] = [];

    // Log start in journal
    get().addJournalEntry({
      scan: simStore.snapshot?.scan ?? 0,
      timeFormatted: new Date().toLocaleTimeString(),
      source: 'TEST_GEN',
      eventType: 'COMMAND',
      description: `Starting Time-Based Test [${test.id}]: ${test.title} (${totalScans} scans @ ${dtMs}ms)`,
      status: 'INFO',
    });

    // Optional setup hook before stepped execution
    if (test.setup) {
      test.setup(simStore.engine, simStore.plc);
    }

    // Step engine and PLC across totalScans
    for (let step = 0; step < totalScans; step++) {
      test.stimulus(simStore.engine, simStore.plc, step, history);

      simStore.plc.tick(dtMs);
      const outputs = simStore.plc.readOutputs();
      const snap = simStore.engine.tick(outputs);
      simStore.plc.writeInputs(snap.tags.inputs);

      const interlocks: Record<string, { isOk: boolean; tripped: boolean }> = {};
      if (simStore.plc.interlocks) {
        for (const [k, v] of simStore.plc.interlocks.entries()) {
          interlocks[k] = { isOk: v.isOk, tripped: v.tripped };
        }
      }

      history.push({
        step,
        scan: snap.scan,
        timeMs: snap.timeMs,
        inputs: { ...snap.tags.inputs },
        outputs: { ...outputs },
        plcState: (simStore.plc as any).state,
        interlocks,
        snapshot: snap,
      });
    }

    // Update simulation store snapshot with final state from stepped run
    if (history.length > 0) {
      const finalSnap = history[history.length - 1].snapshot;
      useSimulationStore.setState({
        snapshot: finalSnap,
        faults: simStore.engine.getFaults(),
      });
    }

    // Evaluate assertions on the full resulting history
    const assertions = test.assertions(simStore.engine, simStore.plc, history);
    const passed = assertions.every((a) => a.passed);

    // Log assertions in journal with timing metadata
    for (const a of assertions) {
      const timingBadge = a.responseTimeMs !== undefined ? ` [Response Time: ${a.responseTimeMs}ms]` : '';
      get().addJournalEntry({
        scan: simStore.snapshot?.scan ?? 0,
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
    };

    set((state) => ({
      results: [...state.results.filter((r) => r.testId !== test.id), result],
      isRunningSuite: false,
    }));
  },

  runAllTests: async () => {
    const { resetSuite, runSingleTest } = get();
    resetSuite();
    const scenarios = get().scenarios;
    set({ isRunningSuite: true });

    for (let i = 0; i < scenarios.length; i++) {
      set({ currentTestIndex: i });
      await runSingleTest(scenarios[i].id);
      // Wait brief 400ms pause for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    set({ isRunningSuite: false, currentTestIndex: -1, showReportModal: true });
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

