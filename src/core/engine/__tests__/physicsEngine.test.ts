import { describe, it, expect } from 'vitest';
import { PhysicsEngine } from '../PhysicsEngine';
import { milkPasteurizerSkid } from '../../templates/pasteurizerPlant';
import { defaultMixingSkid } from '../../templates/defaultPlant';

describe('PhysicsEngine Unit Tests', () => {
  describe('Milk Pasteurizer Plant Skid', () => {
    it('initializes topology and devices cleanly', () => {
      const engine = new PhysicsEngine(milkPasteurizerSkid, 100);
      const topology = engine.getTopology();
      expect(topology.tanks.length).toBeGreaterThan(0);
      expect(topology.pumps.length).toBeGreaterThan(0);
      expect(topology.valves.length).toBeGreaterThan(0);
      expect(engine.pheAssembly).toBeDefined();

      const initialInputs = engine.generatePlcInputs();
      expect(initialInputs).toBeDefined();
      expect(initialInputs['LT1']).toBeDefined();
      expect(initialInputs['TT5']).toBeDefined();
    });

    it('advances simulation time and scan count on tick', () => {
      const engine = new PhysicsEngine(milkPasteurizerSkid, 100);
      const snap1 = engine.tick({}, 100);
      expect(snap1.scan).toBe(1);
      expect(snap1.timeMs).toBe(100);

      const snap2 = engine.tick({}, 50);
      expect(snap2.scan).toBe(2);
      expect(snap2.timeMs).toBe(150);
    });

    it('ramps up pump speed and actuates valves under PLC commands', () => {
      const engine = new PhysicsEngine(milkPasteurizerSkid, 100);

      // Issue command to start P-FEED and open PV11
      for (let i = 0; i < 15; i++) {
        engine.tick({ 'P_FEED_START': 1, 'PV11_CMD': 1 }, 100);
      }

      const snap = engine.tick({ 'P_FEED_START': 1, 'PV11_CMD': 1 }, 100);
      const feedPump = snap.devices['P-FEED'];
      expect(feedPump).toBeDefined();
      expect(feedPump.speedPct).toBeGreaterThan(50);

      const pv11 = snap.devices['PV-11'];
      expect(pv11).toBeDefined();
      expect(pv11.isOpen).toBe(true);
    });

    it('evaluates PHE thermodynamic metrics during operation', () => {
      const engine = new PhysicsEngine(milkPasteurizerSkid, 100);

      // Run 20 scans with feed pump running
      let snap = engine.tick({}, 100);
      for (let i = 0; i < 20; i++) {
        snap = engine.tick({ 'P_FEED_START': 1, 'P_HW_START': 1, 'SCV1_CMD': 100 }, 100);
      }

      expect(snap.tags.inputs['PHE_HEAT_T_COLD_OUT']).toBeDefined();
      expect(snap.tags.inputs['PHE_HOLDING_TIME_S']).toBeDefined();
      expect(snap.tags.inputs['PHE_REGEN_EFF_PCT']).toBeDefined();
    });

    it('supports fault injection, active alarms, and fault clearing', () => {
      const engine = new PhysicsEngine(milkPasteurizerSkid, 100);

      const initialSnap = engine.tick({}, 100);
      expect(initialSnap.alarms).toEqual([]);

      engine.setFault({
        deviceId: 'TT5',
        mode: 'sensor_offset',
        value: 25,
      });

      const faultSnap = engine.tick({}, 100);
      expect(faultSnap.alarms.some((a: string) => a.includes('TT5'))).toBe(true);

      engine.clearAllFaults();
      const clearedSnap = engine.tick({}, 100);
      expect(clearedSnap.alarms.filter((a: string) => a.includes('FAULT_TT5'))).toEqual([]);
    });

    it('resets physical state cleanly on engine.reset()', () => {
      const engine = new PhysicsEngine(milkPasteurizerSkid, 100);
      for (let i = 0; i < 10; i++) {
        engine.tick({ 'P_FEED_START': 1 }, 100);
      }
      expect(engine.tick({}).scan).toBe(11);

      engine.reset();
      const resetSnap = engine.tick({}, 100);
      expect(resetSnap.scan).toBe(1);
      expect(resetSnap.timeMs).toBe(100);
    });
  });

  describe('Batch Mixing Plant Skid', () => {
    it('initializes batch vessels and dosing pumps', () => {
      const engine = new PhysicsEngine(defaultMixingSkid, 100);
      const snap = engine.tick({}, 100);

      expect(snap.devices['TK-100']).toBeDefined();
      expect(snap.devices['TK-400']).toBeDefined();
      expect(snap.devices['TK-PROD']).toBeDefined();
      expect(snap.devices['P-100']).toBeDefined();
    });

    it('transfers fluid from dosing tank to mixer when pump runs with valves open', () => {
      const engine = new PhysicsEngine(defaultMixingSkid, 100);

      const initialTk100Vol = engine.tick({}, 100).devices['TK-100']?.volumeL ?? 0;
      const initialTk400Vol = engine.tick({}, 100).devices['TK-400']?.volumeL ?? 0;

      // Energize dosing pump P-100 and isolation valves V-101 and V-102 for 30 scans
      for (let i = 0; i < 30; i++) {
        engine.tick({ 'P100_START': true, 'V101_CMD': true, 'V102_CMD': true }, 100);
      }

      const snap = engine.tick({ 'P100_START': true, 'V101_CMD': true, 'V102_CMD': true }, 100);
      const finalTk100Vol = snap.devices['TK-100']?.volumeL ?? 0;
      const finalTk400Vol = snap.devices['TK-400']?.volumeL ?? 0;

      expect(finalTk100Vol).toBeLessThan(initialTk100Vol);
      expect(finalTk400Vol).toBeGreaterThan(initialTk400Vol);
    });
  });
});
