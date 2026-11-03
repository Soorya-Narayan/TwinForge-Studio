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
import type { Driver } from '../core/driver/Driver';
import { PasteurizerPlcDriver } from '../core/driver/PasteurizerPlcDriver';
import { MockPlcDriver } from '../core/driver/MockPlcDriver';
import { GenericPlcDriver } from '../core/driver/GenericPlcDriver';
import { milkPasteurizerSkid } from '../core/templates/pasteurizerPlant';
import { defaultMixingSkid } from '../core/templates/defaultPlant';

export type HarnessPlcDriver = Driver;

export interface ScanJournalEntry {
  id: string;
  scan: number;
  timeFormatted: string;
  source: 'TEST_GEN' | 'PLC' | 'SIM' | 'FAULT' | 'DRIVER';
  eventType: 'COMMAND' | 'FEEDBACK' | 'INTERLOCK' | 'ASSERTION' | 'FAULT' | 'ALARM';
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
  organization?: string;
  uploadedLogo?: string;
  isCustomRef?: boolean;
}

export const generateAutoReportRef = (): string => {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase().padStart(4, '0');
  return `FAT-${year}-${rand}`;
};

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
  scanMode: 'lockstep' | 'classic';
  timeAdvanceMode: 'measured' | 'nominal';

  // Actions
  setScanMode: (mode: 'lockstep' | 'classic') => void;
  setTimeAdvanceMode: (mode: 'measured' | 'nominal') => void;
  syncScenarios: (skid: SkidId) => void;
  runAllTests: () => Promise<void>;
  runSingleTest: (testId: string, driverOverride?: HarnessPlcDriver) => Promise<void>;
  resetSuite: () => void;
  openReportModal: () => void;
  closeReportModal: () => void;
  addJournalEntry: (entry: Omit<ScanJournalEntry, 'id'>) => void;
  setProjectSettings: (settings: Partial<ReportProjectSettings>) => void;
}

let journalEntrySequence = 0;

export const createIsolatedTestHarness = (
  skid: SkidId,
  customTopology?: PlantTopology | null,
  stepMs: number = 100,
  driverOverride?: HarnessPlcDriver
): {
  engine: PhysicsEngine;
  plc: HarnessPlcDriver;
} => {
  let engine: PhysicsEngine;
  let plc: HarnessPlcDriver;

  if (skid === 'PASTEURIZER_10KLPH') {
    engine = new PhysicsEngine(milkPasteurizerSkid, stepMs);
  } else if (skid === 'BATCH_MIXING') {
    engine = new PhysicsEngine(defaultMixingSkid, stepMs);
  } else {
    const topology = customTopology || milkPasteurizerSkid;
    engine = new PhysicsEngine(topology, stepMs);
  }

  // Wire driver for testing: only wire OPC UA driver when there is a live connected session
  const simStore = typeof useSimulationStore !== 'undefined' ? useSimulationStore.getState() : undefined;
  const liveCandidate = driverOverride ?? simStore?.plc;

  const hasLiveOpcUaSession = Boolean(
    liveCandidate &&
    liveCandidate.status?.driverType === 'opcua' &&
    liveCandidate.status?.connected &&
    ((typeof window !== 'undefined' && Boolean(window.electronAPI?.opcua)) || Boolean(liveCandidate.customApi))
  );

  if (driverOverride) {
    plc = driverOverride;
    plc.setSkid?.(skid);
  } else if (hasLiveOpcUaSession && liveCandidate) {
    plc = liveCandidate;
    plc.setSkid?.(skid);
  } else if (skid === 'PASTEURIZER_10KLPH') {
    plc = new PasteurizerPlcDriver();
  } else if (skid === 'BATCH_MIXING') {
    plc = new MockPlcDriver();
  } else {
    const topology = customTopology || milkPasteurizerSkid;
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
      scanMode: 'lockstep',
      timeAdvanceMode: 'measured',

      setScanMode: (mode) => set({ scanMode: mode }),
      setTimeAdvanceMode: (mode) => set({ timeAdvanceMode: mode }),

      projectSettings: {
        certificateRef: generateAutoReportRef(),
        isCustomRef: false,
        customerName: '',
        commissioningLead: 'Commissioning Lead Engineer',
        clientAuthority: 'Client Acceptance Authority',
      },

      setProjectSettings: (settings) => {
        set((state) => {
          const isExplicitCustom = settings.isCustomRef !== undefined
            ? settings.isCustomRef
            : (settings.certificateRef !== undefined
                ? settings.certificateRef.trim().length > 0
                : state.projectSettings.isCustomRef);
          return {
            projectSettings: {
              ...state.projectSettings,
              ...settings,
              isCustomRef: isExplicitCustom,
            },
          };
        });
      },

      syncScenarios: (skid: SkidId) => {
        journalEntrySequence = 0;
        set({
          scenarios: getFatScenarios(skid),
          currentTestIndex: -1,
          isRunningSuite: false,
          results: [],
          journal: [],
          executionDriverInfo: null,
        });
      },

      openReportModal: () =>
        set((state) => {
          const isCustom = state.projectSettings.isCustomRef;
          return {
            showReportModal: true,
            reportTimestamp: state.reportTimestamp || new Date().toISOString(),
            projectSettings: {
              ...state.projectSettings,
              certificateRef: isCustom && state.projectSettings.certificateRef
                ? state.projectSettings.certificateRef
                : (state.reportTimestamp ? state.projectSettings.certificateRef : generateAutoReportRef()),
            },
          };
        }),
      closeReportModal: () => set({ showReportModal: false }),

      addJournalEntry: (entry) => {
        journalEntrySequence += 1;
        const id = `J-${entry.scan}-${journalEntrySequence}`;
        set((state) => ({
          journal: [{ id, ...entry }, ...state.journal],
        }));
      },

      resetSuite: () => {
        journalEntrySequence = 0;
        const currentSkid = useSimulationStore.getState().activeSkid;
        const isCustom = get().projectSettings.isCustomRef;
        set((state) => ({
          scenarios: getFatScenarios(currentSkid),
          currentTestIndex: -1,
          isRunningSuite: false,
          results: [],
          journal: [],
          showReportModal: false,
          reportTimestamp: null,
          executionDriverInfo: null,
          projectSettings: {
            ...state.projectSettings,
            certificateRef: isCustom && state.projectSettings.certificateRef
              ? state.projectSettings.certificateRef
              : generateAutoReportRef(),
          },
        }));
      },

  runSingleTest: async (testId: string, driverOverride?: HarnessPlcDriver) => {
    const isPartOfSuite = get().currentTestIndex >= 0;
    const simStore = useSimulationStore.getState();
    const wasLiveRunning = isPartOfSuite ? false : simStore.running;
    if (!isPartOfSuite) {
      await simStore.setFatRunning(true);
    }

    const currentSkid = simStore.activeSkid;
    const scenarios = get().scenarios.length > 0 ? get().scenarios : getFatScenarios(currentSkid);
    const test = scenarios.find((s) => {
      return s.id === testId;
    });
    if (!test) {
      if (!isPartOfSuite) {
        simStore.setFatRunning(false);
        if (wasLiveRunning) {
          simStore.start();
        }
      }
      return;
    }

    set({ isRunningSuite: true });

    const totalScans = test.durationScans ?? 20;
    const dtMs = test.dtMs ?? 100;
    const history: ScanHistoryRecord[] = [];

    // Isolate each test with a fresh engine and PLC instance calibrated to test dtMs
    const { engine, plc } = createIsolatedTestHarness(currentSkid, simStore.customTopology, dtMs, driverOverride);

    const hasLiveElectronSession = Boolean(
      plc.status.driverType === 'opcua' &&
      plc.status.connected &&
      ((typeof window !== 'undefined' && Boolean(window.electronAPI?.opcua)) || Boolean(plc.customApi))
    );
    const isLoopbackHarness = hasLiveElectronSession && plc.isLoopbackSession?.() === true;

    const driverName = plc.driverName || 'UnknownDriver';
    const harnessEndpoint = plc.endpointUrl || 'opc.tcp://127.0.0.1:4840';
    const driverType: TestDriverInfo['driverType'] = !hasLiveElectronSession
      ? 'mock'
      : isLoopbackHarness
      ? 'opcua-loopback'
      : 'opcua';
    const driverDetails = driverType === 'opcua-loopback'
      ? `Loopback Test Server (no control logic) (${harnessEndpoint})`
      : driverType === 'opcua'
      ? `External OPC UA server via node-opcua (${harnessEndpoint})`
      : `In-Process Mock Driver (${driverName})`;
    // Both OPC UA harness kinds exchange I/O over the network, so measured time and
    // I/O timing tolerance apply to both. Only an external server may be called HIL.
    const isOpcUaHarness = driverType === 'opcua' || driverType === 'opcua-loopback';

    const scanMode = get().scanMode;
    const timeAdvanceMode = get().timeAdvanceMode ?? 'measured';
    const driverInfo: TestDriverInfo = {
      driverName,
      driverType,
      details: `${driverDetails} [${scanMode.toUpperCase()} SCAN · ${timeAdvanceMode.toUpperCase()} TIME]`,
      endpoint: plc.endpointUrl || null,
      scanMode,
      timeAdvanceMode,
    };

    const startTime = performance.now();
    let cumulativeDriftMs = 0;
    let totalIoLatencyMs = 0;

    // Log start in journal
    get().addJournalEntry({
      scan: 0,
      timeFormatted: new Date().toLocaleTimeString(),
      source: 'TEST_GEN',
      eventType: 'COMMAND',
      description: `Starting Time-Based Test [${test.id}]: ${test.title} (${totalScans} scans @ ${dtMs}ms · Scan Mode: ${scanMode.toUpperCase()} · Time Mode: ${timeAdvanceMode.toUpperCase()} · Harness: ${driverDetails})`,
      status: 'INFO',
    });

    try {
      // 0. Pre-execution Driver Connection Verification
      if (!plc.status.connected) {
        throw new Error(`PLC connection is offline (${driverDetails}). Cannot validate process control without live connection. Stale outputs discarded.`);
      }

      // 1. Reset Precondition: Command PLC reset and verify known baseline state before starting test
      // External PLCs retain operational state across tests. Command a reset and verify a known state before starting.
      const expectedResetStates = test.expectedInitialState
        ? (Array.isArray(test.expectedInitialState) ? test.expectedInitialState : [test.expectedInitialState])
        : currentSkid === 'BATCH_MIXING'
        ? ['IDLE', 'STOPPED']
        : ['STOPPED'];

      if (typeof plc.resetPrecondition === 'function') {
        await plc.resetPrecondition(expectedResetStates);
      } else {
        if (typeof plc.resetSystem === 'function') {
          await plc.resetSystem();
        } else if (typeof plc.resetBatch === 'function') {
          await plc.resetBatch();
        }
        if (typeof plc.syncOutputsFromPlc === 'function') {
          await plc.syncOutputsFromPlc();
        }
        const currentState = plc.state ?? (plc.outputs?.['PLC_STATE'] !== undefined ? String(plc.outputs['PLC_STATE']) : undefined);
        if (!currentState || !expectedResetStates.includes(currentState)) {
          throw new Error(
            `Reset precondition failed: PLC state is '${currentState || 'UNDEFINED'}', expected ${expectedResetStates.map((s) => `'${s}'`).join(' or ')} before starting test [${test.id}].`
          );
        }
      }

      get().addJournalEntry({
        scan: 0,
        timeFormatted: new Date().toLocaleTimeString(),
        source: 'DRIVER',
        eventType: 'COMMAND',
        description: `Reset precondition verified for [${test.id}]: PLC state confirmed as '${plc.state ?? 'STOPPED'}' before test execution.`,
        status: 'INFO',
      });

      // Optional setup hook before stepped execution
      if (test.setup) {
        await test.setup(engine, plc);
      }

      if (scanMode === 'lockstep') {
        // Lockstep Scan Mode:
        // 1. Initial inputs from engine merged with setup overrides
        let currentInputs = { ...engine.generatePlcInputs(), ...plc.inputs };
        await plc.writeInputs(currentInputs);

        // Step engine and PLC in lockstep across totalScans
        for (let step = 0; step < totalScans; step++) {
          if (!plc.status.connected) {
            throw new Error(`PLC connection lost during test execution at scan ${step + 1}/${totalScans} (${driverDetails}). Stale outputs discarded.`);
          }

          const stepStartTime = performance.now();

          await test.stimulus(engine, plc, step, history);

          // Sequence-number handshake for lockstep synchronization
          const seq = step + 1;
          currentInputs.SEQ = seq;

          // Step 1: Write inputs (with SEQ = n) to PLC
          await plc.writeInputs(currentInputs);

          // Step 2: Trigger PLC scan cycle
          if (typeof plc.tick === 'function') {
            await plc.tick(dtMs);
          } else {
            await new Promise((resolve) => setTimeout(resolve, dtMs));
          }

          if (!plc.status.connected) {
            throw new Error(`PLC connection lost during test execution at scan ${step + 1}/${totalScans} (${driverDetails}). Stale outputs discarded.`);
          }

          // Step 3: Wait for PLC to echo SEQ as SEQ_ACK before reading outputs
          const handshakeTimeoutMs = Math.max(3000, dtMs * 15);
          if (typeof plc.waitForSeqAck === 'function') {
            await plc.waitForSeqAck(seq, handshakeTimeoutMs);
          } else {
            const startWait = performance.now();
            let checkOutputs = await plc.readOutputs();
            while (Number(checkOutputs['SEQ_ACK']) !== seq) {
              if (!plc.status.connected) {
                throw new Error(`PLC connection lost while waiting for SEQ_ACK = ${seq} (${driverDetails}). Stale outputs discarded.`);
              }
              if (performance.now() - startWait >= handshakeTimeoutMs) {
                const actualAck = checkOutputs['SEQ_ACK'];
                throw new Error(
                  `Lockstep handshake timeout: PLC failed to acknowledge SEQ = ${seq} (received SEQ_ACK = ${actualAck !== undefined ? actualAck : 'none'}) within ${handshakeTimeoutMs}ms (${driverDetails}).`
                );
              }
              await new Promise((r) => setTimeout(r, Math.min(20, dtMs)));
              if (typeof plc.syncOutputsFromPlc === 'function') {
                await plc.syncOutputsFromPlc();
              }
              checkOutputs = await plc.readOutputs();
            }
          }

          if (!plc.status.connected) {
            throw new Error(`PLC connection lost during test execution at scan ${step + 1}/${totalScans} (${driverDetails}). Stale outputs discarded.`);
          }

          // Step 4: Read verified outputs from PLC
          const outputs = await plc.readOutputs();

          if (!plc.status.connected) {
            throw new Error(`PLC connection lost during test execution at scan ${step + 1}/${totalScans} (${driverDetails}). Stale outputs discarded.`);
          }

          // Step 5: Measure actual elapsed real time during PLC scan and I/O exchange
          const stepElapsedMs = Math.round(performance.now() - stepStartTime);
          const ioLatencyMs = Math.max(0, stepElapsedMs - dtMs);
          totalIoLatencyMs += ioLatencyMs;
          const stepDrift = stepElapsedMs - dtMs;
          cumulativeDriftMs += stepDrift;

          // Time drift compensation:
          // Use measured time only for OPC UA runs (clamped between dtMs and 2 * dtMs to prevent slow handshakes from causing unstable physics steps).
          // Mock drivers always advance by nominal dtMs since their in-process execution is ~1 ms.
          const stepDt = (isOpcUaHarness && timeAdvanceMode === 'measured')
            ? Math.min(2 * dtMs, Math.max(dtMs, stepElapsedMs))
            : dtMs;

          // Step 6: Tick the engine
          const executedInputs = { ...currentInputs };
          const snap = engine.tick(outputs, stepDt);
          currentInputs = { ...snap.tags.inputs };

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
            stepDtMs: stepDt,
            measuredElapsedMs: stepElapsedMs,
            driftMs: cumulativeDriftMs,
            inputs: executedInputs,
            outputs: { ...outputs },
            plcState: plc.state,
            interlocks,
            snapshot: snap,
          });
        }
      } else {
        // Classic Scan Mode:
        for (let step = 0; step < totalScans; step++) {
          if (!plc.status.connected) {
            throw new Error(`PLC connection lost during test execution at scan ${step + 1}/${totalScans} (${driverDetails}). Stale outputs discarded.`);
          }

          const stepStartTime = performance.now();

          await test.stimulus(engine, plc, step, history);

          if (typeof plc.tick === 'function') {
            await plc.tick(dtMs);
          }

          if (!plc.status.connected) {
            throw new Error(`PLC connection lost during test execution at scan ${step + 1}/${totalScans} (${driverDetails}). Stale outputs discarded.`);
          }

          const outputs = await plc.readOutputs();

          if (!plc.status.connected) {
            throw new Error(`PLC connection lost during test execution at scan ${step + 1}/${totalScans} (${driverDetails}). Stale outputs discarded.`);
          }

          const stepElapsedMs = Math.round(performance.now() - stepStartTime);
          const ioLatencyMs = Math.max(0, stepElapsedMs - dtMs);
          totalIoLatencyMs += ioLatencyMs;
          const stepDrift = stepElapsedMs - dtMs;
          cumulativeDriftMs += stepDrift;

          const stepDt = (isOpcUaHarness && timeAdvanceMode === 'measured')
            ? Math.min(2 * dtMs, Math.max(dtMs, stepElapsedMs))
            : dtMs;

          const snap = engine.tick(outputs, stepDt);
          await plc.writeInputs(snap.tags.inputs);

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
            stepDtMs: stepDt,
            measuredElapsedMs: stepElapsedMs,
            driftMs: cumulativeDriftMs,
            inputs: { ...snap.tags.inputs },
            outputs: { ...outputs },
            plcState: plc.state,
            interlocks,
            snapshot: snap,
          });
        }
      }

      // Evaluate assertions on the full resulting history
      const rawAssertions = test.assertions(engine, plc, history);
      const applyIoTolerance = isOpcUaHarness;
      const toleranceLabel = driverType === 'opcua-loopback'
        ? 'OPC UA I/O timing tolerance (Loopback Test Server)'
        : 'HIL timing tolerance';

      // Account for documented OPC UA I/O timing tolerance when exchanging I/O over the network
      const assertions = rawAssertions.map((a) => {
        if (a.timingLimitMs !== undefined && a.responseTimeMs !== undefined) {
          const tolerance = a.timingToleranceMs ?? (applyIoTolerance ? Math.max(50, dtMs) : 0);
          const effectiveLimit = a.timingLimitMs + (applyIoTolerance ? tolerance : 0);
          if (!a.passed && a.responseTimeMs <= effectiveLimit) {
            return {
              ...a,
              passed: true,
              message: `${a.message} (Within ${toleranceLabel}: ${a.responseTimeMs} ms <= ${a.timingLimitMs} ms + ${tolerance} ms network/scan latency)`,
            };
          }
        }
        return a;
      });
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
        timeDriftMs: Math.max(0, cumulativeDriftMs),
        avgIoLatencyMs: totalScans > 0 ? Math.round(totalIoLatencyMs / totalScans) : 0,
        timeAdvanceMode,
      };

      set((state) => ({
        results: [...state.results.filter((r) => r.testId !== test.id), result],
        executionDriverInfo: driverInfo,
      }));
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error executing scenario [${test.id}]:`, err);

      const isResetPrecondition = errorMsg.toLowerCase().includes('reset precondition');
      const isHandshakeTimeout = !isResetPrecondition && errorMsg.toLowerCase().includes('handshake timeout');
      const isConnectionLost =
        !isResetPrecondition &&
        !isHandshakeTimeout && (
          !plc.status.connected ||
          errorMsg.toLowerCase().includes('connection lost') ||
          errorMsg.toLowerCase().includes('disconnected') ||
          errorMsg.toLowerCase().includes('offline') ||
          errorMsg.toLowerCase().includes('not connected')
        );

      const failedAssertion: TestAssertion = {
        tag: isResetPrecondition
          ? 'RESET_PRECONDITION'
          : isHandshakeTimeout
          ? 'LOCKSTEP_HANDSHAKE'
          : isConnectionLost
          ? 'PLC_CONNECTION'
          : 'SCENARIO_EXECUTION',
        expected: isResetPrecondition
          ? (test.expectedInitialState ? String(test.expectedInitialState) : currentSkid === 'BATCH_MIXING' ? 'IDLE / STOPPED' : 'STOPPED')
          : isHandshakeTimeout
          ? 'SEQ_ACK == SEQ'
          : isConnectionLost
          ? 'CONNECTED'
          : 'COMPLETED_WITHOUT_ERROR',
        actual: isResetPrecondition
          ? plc.state ?? 'INVALID_STATE'
          : isHandshakeTimeout
          ? 'TIMEOUT / NO_ACK'
          : isConnectionLost
          ? 'DISCONNECTED'
          : `ERROR: ${errorMsg}`,
        passed: false,
        message: isResetPrecondition
          ? `Reset precondition failure: ${errorMsg}`
          : isHandshakeTimeout
          ? `Lockstep handshake failure: ${errorMsg}`
          : isConnectionLost
          ? `FAT Test aborted: PLC communication failure at scan ${history.length + 1}/${totalScans} (${driverDetails}). Stale outputs discarded.`
          : `Scenario aborted with runtime exception: ${errorMsg}`,
      };

      get().addJournalEntry({
        scan: history[history.length - 1]?.scan ?? history.length,
        timeFormatted: new Date().toLocaleTimeString(),
        source: isResetPrecondition || isHandshakeTimeout || isConnectionLost ? 'DRIVER' : 'TEST_GEN',
        eventType: isResetPrecondition || isHandshakeTimeout || isConnectionLost ? 'ALARM' : 'ASSERTION',
        description: isResetPrecondition
          ? `RESET PRECONDITION FAILURE on [${test.id}]: ${errorMsg}`
          : isHandshakeTimeout
          ? `LOCKSTEP HANDSHAKE TIMEOUT on [${test.id}]: ${errorMsg}`
          : isConnectionLost
          ? `COMMUNICATION FAILURE on [${test.id}]: ${errorMsg}`
          : `Scenario [${test.id}] thrown runtime error: ${errorMsg}`,
        tag: isResetPrecondition ? 'RESET_PRECONDITION' : isHandshakeTimeout ? 'LOCKSTEP_HANDSHAKE' : isConnectionLost ? 'PLC_CONNECTION' : 'EXCEPTION',
        value: isResetPrecondition ? String(plc.state ?? 'INVALID_STATE') : isHandshakeTimeout ? 'TIMEOUT' : isConnectionLost ? 'DISCONNECTED' : errorMsg,
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
          await test.teardown(engine, plc);
        } catch (teardownErr) {
          console.warn(`Teardown error in [${test.id}]:`, teardownErr);
        }
      }
      engine.clearAllFaults();
      if (!isPartOfSuite) {
        set({ isRunningSuite: false });
        useSimulationStore.getState().setFatRunning(false);
        if (wasLiveRunning) {
          useSimulationStore.getState().start();
        }
      }
    }
  },

  runAllTests: async () => {
    const { resetSuite, runSingleTest } = get();
    resetSuite();
    const scenarios = get().scenarios;
    set({ isRunningSuite: true });

    const simStore = useSimulationStore.getState();
    const wasLiveRunning = simStore.running;
    await simStore.setFatRunning(true);

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

      const isCustom = get().projectSettings.isCustomRef;
      set((state) => ({
        showReportModal: true,
        reportTimestamp: new Date().toISOString(),
        projectSettings: {
          ...state.projectSettings,
          certificateRef: isCustom && state.projectSettings.certificateRef
            ? state.projectSettings.certificateRef
            : (state.projectSettings.certificateRef || generateAutoReportRef()),
        },
      }));
    } finally {
      set({ isRunningSuite: false, currentTestIndex: -1 });
      useSimulationStore.getState().setFatRunning(false);
      if (wasLiveRunning) {
        useSimulationStore.getState().start();
      }
    }
  },
    }),
    {
      name: 'twinforge-fat-project-settings',
      partialize: (state) => ({
        scanMode: state.scanMode,
        timeAdvanceMode: state.timeAdvanceMode,
        projectSettings: {
          customerName: state.projectSettings.customerName,
          commissioningLead: state.projectSettings.commissioningLead,
          clientAuthority: state.projectSettings.clientAuthority,
          organization: state.projectSettings.organization,
          uploadedLogo: state.projectSettings.uploadedLogo,
          ...(state.projectSettings.isCustomRef
            ? {
                certificateRef: state.projectSettings.certificateRef,
                isCustomRef: true,
              }
            : {}),
        },
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as (Partial<FatStore> & { scanMode?: 'lockstep' | 'classic'; timeAdvanceMode?: 'measured' | 'nominal' }) | undefined;
        const persistedSettings = persisted?.projectSettings;
        const isCustom = Boolean(persistedSettings?.isCustomRef);
        return {
          ...currentState,
          scanMode: persisted?.scanMode || currentState.scanMode,
          timeAdvanceMode: persisted?.timeAdvanceMode || currentState.timeAdvanceMode,
          projectSettings: {
            ...currentState.projectSettings,
            ...(persistedSettings || {}),
            certificateRef: isCustom && persistedSettings?.certificateRef
              ? persistedSettings.certificateRef
              : generateAutoReportRef(),
            isCustomRef: isCustom,
          },
        };
      },
    }
  )
);

