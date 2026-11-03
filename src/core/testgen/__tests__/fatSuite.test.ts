import { describe, it, expect } from 'vitest';
import { useFatStore } from '../../../store/useFatStore';
import { useSimulationStore, type SkidId } from '../../../store/useSimulationStore';

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
});
