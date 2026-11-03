import { describe, it, expect } from 'vitest';
import { useFatStore } from '../../../store/useFatStore';
import { useSimulationStore, type SkidId } from '../../../store/useSimulationStore';
import { computeEvidenceFingerprint } from '../../report/fingerprint';

describe('FAT Test Suite Full Regression', () => {
  const skids: SkidId[] = ['PASTEURIZER_10KLPH', 'BATCH_MIXING'];
  const timeModes: Array<'nominal' | 'measured'> = ['nominal', 'measured'];

  for (const skid of skids) {
    for (const timeMode of timeModes) {
      it(
        `runs all FAT tests for ${skid} in ${timeMode} time mode and asserts all pass`,
        async () => {
          // Select active skid in simulation store and sync FAT store scenarios
          useSimulationStore.getState().setSkid(skid);
          useFatStore.getState().syncScenarios(skid);
          useFatStore.setState({ timeAdvanceMode: timeMode });

          // Run the full FAT suite against mock drivers
          await useFatStore.getState().runAllTests();

          const results = useFatStore.getState().results;
          expect(results.length).toBeGreaterThan(0);

          const failures = results.filter((r) => !r.passed);
          if (failures.length > 0) {
            const failureSummary = failures
              .map(
                (f) =>
                  `[${f.testId}] ${f.title}:\n` +
                  f.assertions
                    .filter((a) => !a.passed)
                    .map((a) => `  - ${a.tag}: ${a.message} (expected: ${a.expected}, actual: ${a.actual})`)
                    .join('\n')
              )
              .join('\n\n');
            expect.fail(`Failed ${failures.length} test(s) on ${skid} (${timeMode}):\n${failureSummary}`);
          }

          expect(results.every((r) => r.passed)).toBe(true);
        },
        30000
      );
    }
  }

  it('fails reset precondition when PLC state is undefined or empty', async () => {
    useSimulationStore.getState().setSkid('PASTEURIZER_10KLPH');
    useFatStore.getState().syncScenarios('PASTEURIZER_10KLPH');

    // Create a mock driver without resetPrecondition method and with undefined state
    const faultyDriver: any = {
      driverName: 'FaultyMockDriver',
      status: { connected: true, driverType: 'mock' },
      inputs: {},
      outputs: {},
      readOutputs: async () => ({}),
      writeInputs: async () => {},
      resetSystem: async () => {},
      state: undefined,
    };

    await useFatStore.getState().runSingleTest('TC-P01', faultyDriver);
    const result = useFatStore.getState().results.find((r) => r.testId === 'TC-P01');
    expect(result).toBeDefined();
    expect(result?.passed).toBe(false);
    expect(result?.assertions.some((a) => a.tag === 'RESET_PRECONDITION' && !a.passed)).toBe(true);
  });

  it('records literal driverName in evidence payload when executing tests with mock driver', async () => {
    useSimulationStore.getState().setSkid('PASTEURIZER_10KLPH');
    useFatStore.getState().syncScenarios('PASTEURIZER_10KLPH');

    await useFatStore.getState().runSingleTest('TC-P01');

    const state = useFatStore.getState();
    const result = state.results.find((r) => r.testId === 'TC-P01');
    expect(result).toBeDefined();
    if (!result) throw new Error('Result not found');
    if (!result.driver) throw new Error('Driver not found');
    expect(result.driver.driverName).toBe('PasteurizerPlcDriver');
    expect(state.executionDriverInfo?.driverName).toBe('PasteurizerPlcDriver');

    const payloadObject = {
      certificateRef: state.projectSettings.certificateRef,
      customerName: state.projectSettings.customerName,
      authority: state.projectSettings.clientAuthority,
      lead: state.projectSettings.commissioningLead,
      results: state.results,
      journal: state.journal,
      driver: state.executionDriverInfo,
      timestamp: new Date().toISOString(),
    };

    const { payloadString } = await computeEvidenceFingerprint(payloadObject);
    expect(payloadString).toContain('"driverName":"PasteurizerPlcDriver"');
  });
});
