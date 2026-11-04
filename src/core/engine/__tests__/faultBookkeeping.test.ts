import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsEngine } from '../PhysicsEngine';
import { milkPasteurizerSkid } from '../../templates/pasteurizerPlant';
import { useFatStore } from '../../../store/useFatStore';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { computeEvidenceFingerprint } from '../../report/fingerprint';

describe('Fault Bookkeeping & Multi-Fault Engine Tests', () => {
  let engine: PhysicsEngine;

  beforeEach(() => {
    engine = new PhysicsEngine(milkPasteurizerSkid, 100);
    useFatStore.getState().resetSuite();
  });

  it('1. seat_leak then zso_fail on PV-1: getFaults() lists both, and the valve has both', () => {
    engine.setFault({
      deviceId: 'PV-1',
      mode: 'seat_leak',
      value: 0.05,
    });

    engine.setFault({
      deviceId: 'PV-1',
      mode: 'zso_fail',
      value: 1,
    });

    const faults = engine.getFaults();
    expect(faults).toHaveLength(2);
    expect(faults.some((f) => f.deviceId === 'PV-1' && f.mode === 'seat_leak')).toBe(true);
    expect(faults.some((f) => f.deviceId === 'PV-1' && f.mode === 'zso_fail')).toBe(true);

    const valveModel = engine.getValveModel('PV-1');
    expect(valveModel).toBeDefined();
    expect(valveModel?.getFault('seat_leak')).toBeDefined();
    expect(valveModel?.getFault('seat_leak')?.value).toBe(0.05);
    expect(valveModel?.getFault('zso_fail')).toBeDefined();
    expect(valveModel?.getFault('zso_fail')?.value).toBe(1);

    expect(engine.hasFault('PV-1', 'seat_leak')).toBe(true);
    expect(engine.hasFault('PV-1', 'zso_fail')).toBe(true);
    expect(engine.getFault('PV-1', 'seat_leak')?.value).toBe(0.05);
    expect(engine.getFault('PV-1', 'zso_fail')?.value).toBe(1);

    // Verify snapshot reflects both fault alarms
    const snap = engine.tick({}, 100);
    expect(snap.alarms).toContain('FAULT_PV-1_SEAT_LEAK');
    expect(snap.alarms).toContain('FAULT_PV-1_ZSO_FAIL');
  });

  it('2. clearFault("PV-1", "zso_fail") leaves seat_leak active in both places', () => {
    engine.setFault({
      deviceId: 'PV-1',
      mode: 'seat_leak',
      value: 0.05,
    });
    engine.setFault({
      deviceId: 'PV-1',
      mode: 'zso_fail',
      value: 1,
    });

    engine.clearFault('PV-1', 'zso_fail');

    const faults = engine.getFaults();
    expect(faults).toHaveLength(1);
    expect(faults[0].deviceId).toBe('PV-1');
    expect(faults[0].mode).toBe('seat_leak');

    expect(engine.hasFault('PV-1', 'zso_fail')).toBe(false);
    expect(engine.getFault('PV-1', 'zso_fail')).toBeUndefined();
    expect(engine.hasFault('PV-1', 'seat_leak')).toBe(true);

    const valveModel = engine.getValveModel('PV-1');
    expect(valveModel?.getFault('zso_fail')).toBeUndefined();
    expect(valveModel?.getFault('seat_leak')).toBeDefined();

    const snap = engine.tick({}, 100);
    expect(snap.alarms).toContain('FAULT_PV-1_SEAT_LEAK');
    expect(snap.alarms).not.toContain('FAULT_PV-1_ZSO_FAIL');
  });

  it('3. setFault({ deviceId: "PV-1", mode: "none" }) clears both in both places', () => {
    // Inject two faults on PV-1 and one fault on P-FEED
    engine.setFault({
      deviceId: 'PV-1',
      mode: 'seat_leak',
      value: 0.05,
    });
    engine.setFault({
      deviceId: 'PV-1',
      mode: 'zso_fail',
      value: 1,
    });
    engine.setFault({
      deviceId: 'P-FEED',
      mode: 'pump_trip',
    });

    expect(engine.getFaults()).toHaveLength(3);

    // Clear all faults on PV-1
    engine.setFault({
      deviceId: 'PV-1',
      mode: 'none',
    });

    const faults = engine.getFaults();
    expect(faults).toHaveLength(1);
    expect(faults[0].deviceId).toBe('P-FEED');
    expect(faults[0].mode).toBe('pump_trip');

    expect(engine.hasFault('PV-1', 'seat_leak')).toBe(false);
    expect(engine.hasFault('PV-1', 'zso_fail')).toBe(false);

    const valveModel = engine.getValveModel('PV-1');
    expect(valveModel?.getFault('seat_leak')).toBeUndefined();
    expect(valveModel?.getFault('zso_fail')).toBeUndefined();

    const snap = engine.tick({}, 100);
    expect(snap.alarms).not.toContain('FAULT_PV-1_SEAT_LEAK');
    expect(snap.alarms).not.toContain('FAULT_PV-1_ZSO_FAIL');
    expect(snap.alarms).toContain('FAULT_P-FEED_PUMP_TRIP');
  });

  it('4. The exported FAT evidence for a test that injects two faults on one device lists both', async () => {
    useSimulationStore.getState().setSkid('PASTEURIZER_10KLPH');
    const store = useSimulationStore.getState();

    // Inject two faults on PV-1 through the store
    store.injectFault({
      deviceId: 'PV-1',
      mode: 'seat_leak',
      value: 0.08,
    });
    store.injectFault({
      deviceId: 'PV-1',
      mode: 'zso_fail',
      value: 1,
    });

    // Check store faults
    const currentFaults = useSimulationStore.getState().faults;
    expect(currentFaults).toHaveLength(2);
    expect(currentFaults.some((f) => f.deviceId === 'PV-1' && f.mode === 'seat_leak')).toBe(true);
    expect(currentFaults.some((f) => f.deviceId === 'PV-1' && f.mode === 'zso_fail')).toBe(true);

    // Check that journal entries were logged for both
    const fatState = useFatStore.getState();
    const journal = fatState.journal;
    expect(journal.some((j) => j.description.includes('seat_leak') && j.tag === 'PV-1')).toBe(true);
    expect(journal.some((j) => j.description.includes('zso_fail') && j.tag === 'PV-1')).toBe(true);

    // Build evidence payload exactly as FatReportModal does
    const payloadObject = {
      certificateRef: 'FAT-TEST-DUAL-FAULT',
      customerName: 'Dairy Co',
      authority: 'QA Lead',
      lead: 'Lead Eng',
      results: [],
      journal: journal.map(({ id: _id, ...rest }) => rest),
      driver: { driverName: 'TestDriver' },
      timestamp: new Date().toISOString(),
    };

    const { payloadString } = await computeEvidenceFingerprint(payloadObject);

    // The evidence payload JSON contains both faults in the journal
    expect(payloadString).toContain('seat_leak');
    expect(payloadString).toContain('zso_fail');
    expect(payloadString).toContain('"tag":"PV-1"');
  });

  it('5. Supports multiple simultaneous faults on PHE-HEATING and selective clearing', () => {
    engine.setFault({
      deviceId: 'PHE-HEATING',
      mode: 'fouling',
      value: 2.5,
    });
    engine.setFault({
      deviceId: 'PHE-HEATING',
      mode: 'loss_of_hot_water',
    });

    expect(engine.getFaults()).toHaveLength(2);
    expect(engine.hasFault('PHE-HEATING', 'fouling')).toBe(true);
    expect(engine.hasFault('PHE-HEATING', 'loss_of_hot_water')).toBe(true);
    expect(engine.getFault('PHE-HEATING', 'fouling')?.value).toBe(2.5);

    // Clear only fouling
    engine.clearFault('PHE-HEATING', 'fouling');
    expect(engine.hasFault('PHE-HEATING', 'fouling')).toBe(false);
    expect(engine.hasFault('PHE-HEATING', 'loss_of_hot_water')).toBe(true);
    expect(engine.getFaults()).toHaveLength(1);

    // Clear all on PHE-HEATING
    engine.setFault({
      deviceId: 'PHE-HEATING',
      mode: 'none',
    });
    expect(engine.getFaults()).toHaveLength(0);
    expect(engine.hasFault('PHE-HEATING', 'loss_of_hot_water')).toBe(false);
  });

  it('6. Utility states derive accurately from multi-fault map', () => {
    expect(engine.getFaults()).toHaveLength(0);

    engine.setFault({
      deviceId: 'UTILITIES',
      mode: 'instrument_air_loss',
    });
    engine.setFault({
      deviceId: 'UTILITIES',
      mode: 'solenoid_power_loss',
    });

    // Advance valves ticks utility derivations
    engine.tick({}, 100);
    const snap = engine.tick({}, 100);
    expect(snap.alarms).toContain('FAULT_UTILITIES_INSTRUMENT_AIR_LOSS');
    expect(snap.alarms).toContain('FAULT_UTILITIES_SOLENOID_POWER_LOSS');

    // Clear only instrument air
    engine.clearFault('UTILITIES', 'instrument_air_loss');
    expect(engine.hasFault('UTILITIES', 'instrument_air_loss')).toBe(false);
    expect(engine.hasFault('UTILITIES', 'solenoid_power_loss')).toBe(true);

    // Clear solenoid power
    engine.clearFault('UTILITIES', 'solenoid_power_loss');
    expect(engine.hasFault('UTILITIES', 'solenoid_power_loss')).toBe(false);
    expect(engine.getFaults()).toHaveLength(0);
  });
});
