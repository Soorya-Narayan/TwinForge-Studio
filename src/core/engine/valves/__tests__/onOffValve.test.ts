/**
 * TwinForge Studio - On/Off Valve Model Unit Tests
 * Validates travel ramping, fail-safe mechanics, limit switches, and fault modes.
 */

import { describe, it, expect } from 'vitest';
import { OnOffValveModel } from '../OnOffValveModel';
import type { OnOffValveConfig } from '../types';

describe('OnOffValveModel Unit Tests', () => {
  const baseConfig: OnOffValveConfig = {
    id: 'PV-TEST',
    tag: 'PV_TEST',
    travelTimeS: { value: 2.0, source: 'placeholder' },
    failPosition: 'closed',
    kv: { value: 60.0, source: 'placeholder' },
    leakKvPct: { value: 0.01, source: 'placeholder' },
    zsoThresholdPct: { value: 95.0, source: 'placeholder' },
    zscThresholdPct: { value: 5.0, source: 'placeholder' },
    passableThresholdPct: { value: 90.0, source: 'placeholder' },
  };

  it('1. verifies travel: closed -> open takes travelTimeS (+-1 scan); limit switch transitions mid-travel', () => {
    const valve = new OnOffValveModel(baseConfig);
    const dt = 0.05; // 50 ms scan

    // Initially at 0%
    expect(valve.getState().positionPct).toBe(0);
    expect(valve.getState().zsc).toBe(true);
    expect(valve.getState().zso).toBe(false);
    expect(valve.getState().isOpen).toBe(false);

    let t = 0;
    let crossedZsc = false;
    let midTravelBothFalse = false;
    let reachedZso = false;

    while (t < 3.0 && valve.getState().positionPct < 100) {
      t += dt;
      const state = valve.step(dt, { command: true, instrumentAirOk: true, solenoidPowerOk: true });

      if (state.positionPct > 5.0 && !crossedZsc) {
        expect(state.zsc).toBe(false);
        crossedZsc = true;
      }
      if (state.positionPct > 10.0 && state.positionPct < 90.0) {
        if (!state.zso && !state.zsc) {
          midTravelBothFalse = true;
        }
      }
      if (state.positionPct >= 95.0 && !reachedZso) {
        expect(state.zso).toBe(true);
        reachedZso = true;
      }
    }

    expect(crossedZsc).toBe(true);
    expect(midTravelBothFalse).toBe(true);
    expect(reachedZso).toBe(true);
    expect(valve.getState().positionPct).toBe(100);
    expect(valve.getState().zso).toBe(true);
    expect(valve.getState().zsc).toBe(false);
    expect(valve.getState().isOpen).toBe(true);

    // 2.0 s travel time with 50 ms steps = 40 steps = 2.0 s
    expect(t).toBeCloseTo(2.0, 1);
  });

  it('2. verifies fail-safe: instrument air lost forces fail-closed to close and fail-open to open', () => {
    // Fail-Closed Valve
    const fcValve = new OnOffValveModel({ ...baseConfig, failPosition: 'closed' });
    // Open it fully
    for (let t = 0; t < 2.5; t += 0.1) {
      fcValve.step(0.1, { command: true, instrumentAirOk: true, solenoidPowerOk: true });
    }
    expect(fcValve.getState().positionPct).toBe(100);

    // Lose instrument air with command still TRUE
    for (let t = 0; t < 2.5; t += 0.1) {
      fcValve.step(0.1, { command: true, instrumentAirOk: false, solenoidPowerOk: true });
    }
    expect(fcValve.getState().positionPct).toBe(0);
    expect(fcValve.getState().zsc).toBe(true);

    // Restore instrument air: returns control to command (open)
    for (let t = 0; t < 2.5; t += 0.1) {
      fcValve.step(0.1, { command: true, instrumentAirOk: true, solenoidPowerOk: true });
    }
    expect(fcValve.getState().positionPct).toBe(100);

    // Fail-Open Valve
    const foValve = new OnOffValveModel({ ...baseConfig, failPosition: 'open' });
    // Command it closed
    for (let t = 0; t < 2.5; t += 0.1) {
      foValve.step(0.1, { command: false, instrumentAirOk: true, solenoidPowerOk: true });
    }
    expect(foValve.getState().positionPct).toBe(0);

    // Lose instrument air (or solenoid power) with command still FALSE
    for (let t = 0; t < 2.5; t += 0.1) {
      foValve.step(0.1, { command: false, instrumentAirOk: false, solenoidPowerOk: true });
    }
    expect(foValve.getState().positionPct).toBe(100);
    expect(foValve.getState().zso).toBe(true);
  });

  it('3. verifies stuck_open and stuck_closed hold position against command', () => {
    const valve = new OnOffValveModel(baseConfig);
    valve.applyFault('stuck_closed');

    for (let t = 0; t < 2.5; t += 0.1) {
      valve.step(0.1, { command: true, instrumentAirOk: true, solenoidPowerOk: true });
    }
    expect(valve.getState().positionPct).toBe(0);
    expect(valve.getState().zsc).toBe(true);

    valve.clearFault('stuck_closed');
    valve.applyFault('stuck_open');
    for (let t = 0; t < 2.5; t += 0.1) {
      valve.step(0.1, { command: false, instrumentAirOk: true, solenoidPowerOk: true });
    }
    expect(valve.getState().positionPct).toBe(100);
    expect(valve.getState().zso).toBe(true);
  });

  it('4. verifies travel_delay with value 3 makes travel 3x slower', () => {
    const valve = new OnOffValveModel(baseConfig);
    valve.applyFault('travel_delay', 3.0);
    const dt = 0.05;

    let t = 0;
    while (t < 10.0 && valve.getState().positionPct < 100) {
      t += dt;
      valve.step(dt, { command: true, instrumentAirOk: true, solenoidPowerOk: true });
    }

    // 2.0 s * 3 = 6.0 s
    expect(t).toBeCloseTo(6.0, 1);
    expect(valve.getState().positionPct).toBe(100);
  });

  it('5. verifies zso_fail value 0 and zsc_fail value 1 override switch feedback', () => {
    const valve = new OnOffValveModel(baseConfig);
    // Fully open valve
    for (let t = 0; t < 2.5; t += 0.1) {
      valve.step(0.1, { command: true, instrumentAirOk: true, solenoidPowerOk: true });
    }
    expect(valve.getState().positionPct).toBe(100);
    expect(valve.getState().zso).toBe(true);

    // Apply zso_fail with value 0 (stuck OFF)
    valve.applyFault('zso_fail', 0);
    expect(valve.getState().zso).toBe(false);

    // Apply zsc_fail with value 1 (stuck ON while open)
    valve.applyFault('zsc_fail', 1);
    expect(valve.getState().zsc).toBe(true);
  });

  it('6. verifies effectiveKv computation and seat_leak fault', () => {
    const valve = new OnOffValveModel(baseConfig); // kv = 60, default leak = 0.01%
    // Closed position
    expect(valve.getState().positionPct).toBe(0);
    // Default leak: 60 * 0.0001 = 0.006
    expect(valve.getEffectiveKv()).toBeCloseTo(0.006, 4);

    // Apply seat_leak fault = 2.0%
    valve.applyFault('seat_leak', 2.0);
    // Leak Kv: 60 * 0.02 = 1.2
    expect(valve.getEffectiveKv()).toBeCloseTo(1.2, 2);

    // Open valve fully -> effectiveKv reaches rated Kv = 60
    for (let t = 0; t < 2.5; t += 0.1) {
      valve.step(0.1, { command: true, instrumentAirOk: true, solenoidPowerOk: true });
    }
    expect(valve.getEffectiveKv()).toBeCloseTo(60.0, 1);
  });

  it('7. verifies actuator_air_loss isolates single valve to fail position', () => {
    const valve = new OnOffValveModel(baseConfig);
    // Open fully
    for (let t = 0; t < 2.5; t += 0.1) {
      valve.step(0.1, { command: true, instrumentAirOk: true, solenoidPowerOk: true });
    }
    expect(valve.getState().positionPct).toBe(100);

    // Global air and power are OK, but actuator air is lost locally
    valve.applyFault('actuator_air_loss');
    for (let t = 0; t < 2.5; t += 0.1) {
      valve.step(0.1, { command: true, instrumentAirOk: true, solenoidPowerOk: true });
    }
    expect(valve.getState().positionPct).toBe(0);
  });
});
