/**
 * TwinForge Studio - FAT Test Execution Store
 * Drives automated FAT suites, evaluates assertions, and logs scan evidence.
 */

import { create } from 'zustand';
import { getFatScenarios } from '../core/testgen/scenarios';
import type { TestCase, TestResult } from '../core/testgen/types';
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

interface FatStore {
  scenarios: TestCase[];
  currentTestIndex: number;
  isRunningSuite: boolean;
  results: TestResult[];
  journal: ScanJournalEntry[];
  showReportModal: boolean;

  // Actions
  syncScenarios: (skid: SkidId) => void;
  runAllTests: () => Promise<void>;
  runSingleTest: (testId: string) => Promise<void>;
  resetSuite: () => void;
  openReportModal: () => void;
  closeReportModal: () => void;
  addJournalEntry: (entry: Omit<ScanJournalEntry, 'id'>) => void;
}

export const useFatStore = create<FatStore>((set, get) => ({
  scenarios: getFatScenarios('PASTEURIZER_10KLPH'),
  currentTestIndex: -1,
  isRunningSuite: false,
  results: [],
  journal: [],
  showReportModal: false,

  syncScenarios: (skid: SkidId) => {
    set({
      scenarios: getFatScenarios(skid),
      currentTestIndex: -1,
      isRunningSuite: false,
      results: [],
    });
  },

  openReportModal: () => set({ showReportModal: true }),
  closeReportModal: () => set({ showReportModal: false }),

  addJournalEntry: (entry) => {
    const id = `J-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    set((state) => ({
      journal: [{ id, ...entry }, ...state.journal].slice(0, 300), // Keep recent 300 entries
    }));
  },

  resetSuite: () => {
    const currentSkid = useSimulationStore.getState().activeSkid;
    set({
      scenarios: getFatScenarios(currentSkid),
      currentTestIndex: -1,
      isRunningSuite: false,
      results: [],
      journal: [],
      showReportModal: false,
    });
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

    // Log start in journal
    get().addJournalEntry({
      scan: simStore.snapshot?.scan ?? 0,
      timeFormatted: new Date().toLocaleTimeString(),
      source: 'TEST_GEN',
      eventType: 'COMMAND',
      description: `Starting Test [${test.id}]: ${test.title}`,
      status: 'INFO',
    });

    // Execute stimulus
    test.stimulus(simStore.engine, simStore.plc);

    // Evaluate assertions
    const assertions = test.assertions(simStore.engine, simStore.plc);
    const passed = assertions.every((a) => a.passed);

    // Log assertions
    for (const a of assertions) {
      get().addJournalEntry({
        scan: simStore.snapshot?.scan ?? 0,
        timeFormatted: new Date().toLocaleTimeString(),
        source: 'TEST_GEN',
        eventType: 'ASSERTION',
        description: `${a.message} (Tag: ${a.tag}, Expected: ${a.expected}, Actual: ${a.actual})`,
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
}));
