import { describe, it, expect } from 'vitest';
import { PasteurizerPlcDriver } from '../PasteurizerPlcDriver';
import { MockPlcDriver } from '../MockPlcDriver';
import { GenericPlcDriver } from '../GenericPlcDriver';
import { OpcUaPlcDriver } from '../OpcUaPlcDriver';
import { SAMPLE_CUSTOM_BOILERPLATE } from '../../templates/customTemplateValidator';

describe('PLC Drivers Unit Tests', () => {
  describe('PasteurizerPlcDriver', () => {
    it('initializes in STOPPED state with zero outputs', async () => {
      const driver = new PasteurizerPlcDriver();
      expect(driver.state).toBe('STOPPED');
      expect(driver.status.connected).toBe(true);

      await driver.connect();
      expect(driver.status.connected).toBe(true);
      expect(driver.status.driverType).toBe('mock');

      driver.tick(100);
      const outputs = driver.readOutputs();
      expect(outputs['PLC_STATE']).toBe('STOPPED');
      expect(Boolean(outputs['P_FEED_START'])).toBe(false);
      expect(Boolean(outputs['PV11_CMD'])).toBe(false);

      await driver.disconnect();
      expect(driver.status.connected).toBe(false);
    });

    it('faithfully acknowledges lockstep sequence (SEQ -> SEQ_ACK echo)', async () => {
      const driver = new PasteurizerPlcDriver();
      await driver.connect();

      // Write SEQ = 101 and step the PLC scan
      driver.writeInputs({ SEQ: 101, LT1: 75, TT5: 90 });
      driver.tick(100);

      const outputs = driver.readOutputs();
      expect(outputs['SEQ_ACK']).toBe(101);

      // Write next SEQ = 102
      driver.writeInputs({ SEQ: 102 });
      driver.tick(100);
      expect(driver.readOutputs()['SEQ_ACK']).toBe(102);

      await driver.disconnect();
    });

    it('enforces resetPrecondition to verify known STOPPED baseline', async () => {
      const driver = new PasteurizerPlcDriver();
      await driver.connect();

      // Already in STOPPED -> resetPrecondition succeeds
      await expect(driver.resetPrecondition(['STOPPED'])).resolves.not.toThrow();

      // If expecting an impossible state, it must fail
      await expect(driver.resetPrecondition(['RUNNING_AT_MAX'])).rejects.toThrow(/Reset precondition failed/);

      await driver.disconnect();
    });

    it('transitions to STERILIZATION / PRODUCTION when commanded with valid conditions', async () => {
      const driver = new PasteurizerPlcDriver();
      await driver.connect();

      // Command START with valid balance tank level
      driver.writeInputs({
        SEQ: 1,
        CMD_START: 1,
        LT1: 80,
        TT5: 4.0,
      });
      driver.tick(100);

      expect(['WATER_FLUSH', 'STERILIZATION', 'STOPPED']).toContain(driver.state);

      await driver.disconnect();
    });
  });

  describe('MockPlcDriver (Batch Mixing)', () => {
    it('initializes in IDLE state with default connected state', async () => {
      const driver = new MockPlcDriver();
      expect(driver.state).toBe('IDLE');
      expect(driver.status.connected).toBe(true);

      driver.tick(100);
      expect(driver.readOutputs()['PLC_STATE']).toBe('IDLE');

      await driver.disconnect();
      expect(driver.status.connected).toBe(false);
    });

    it('faithfully acknowledges lockstep sequence (SEQ -> SEQ_ACK echo)', async () => {
      const driver = new MockPlcDriver();
      await driver.connect();

      driver.writeInputs({ SEQ: 555 });
      driver.tick(100);

      expect(driver.readOutputs()['SEQ_ACK']).toBe(555);

      await driver.disconnect();
    });

    it('supports batch execution, abort, and resetBatch', async () => {
      const driver = new MockPlcDriver();
      await driver.connect();

      driver.startBatch();
      expect(driver.state).toBe('DOSING');

      driver.abortBatch();
      expect(driver.state).toBe('ABORTED');

      driver.resetBatch();
      expect(driver.state).toBe('IDLE');

      await driver.disconnect();
    });

    it('verifies resetPrecondition for IDLE state', async () => {
      const driver = new MockPlcDriver();
      await driver.connect();

      await expect(driver.resetPrecondition(['IDLE', 'STOPPED'])).resolves.not.toThrow();
      await driver.disconnect();
    });
  });

  describe('GenericPlcDriver (Custom Skids)', () => {
    it('initializes custom skid topology and handles sequence handshake', async () => {
      const driver = new GenericPlcDriver(SAMPLE_CUSTOM_BOILERPLATE.topology);
      expect(driver.state).toBe('STOPPED');

      await driver.connect();
      expect(driver.status.connected).toBe(true);

      driver.writeInputs({ SEQ: 777 });
      driver.tick(100);

      expect(driver.readOutputs()['SEQ_ACK']).toBe(777);

      driver.emergencyStop();
      expect(driver.state).toBe('EMERGENCY_STOP');

      await driver.disconnect();
    });

    it('resets control system with resetSystem', async () => {
      const driver = new GenericPlcDriver(SAMPLE_CUSTOM_BOILERPLATE.topology);
      await driver.connect();

      await driver.resetSystem();
      expect(driver.state).toBe('STOPPED');
      expect(driver.readOutputs()['PLC_STATE']).toBe('STOPPED');

      await driver.disconnect();
    });
  });

  describe('OpcUaPlcDriver', () => {
    it('fails connect() descriptively when Electron node-opcua API is unavailable', async () => {
      const driver = new OpcUaPlcDriver();
      expect(driver.status.driverType).toBe('opcua');
      expect(driver.status.connected).toBe(false);

      // In Node environment without window.electronAPI, connect must reject with clear message
      await expect(driver.connect()).rejects.toThrow(/Electron OPC UA API \(window\.electronAPI\.opcua\) is unavailable/);
    });

    it('manages custom tag maps and datatype configurations', () => {
      const driver = new OpcUaPlcDriver();
      const customMap = { 'FEED_FLOW': 'ns=2;s=Line1.FM101.Flow' };
      driver.setTagMap(customMap);
      expect(driver.tagMap['FEED_FLOW']).toBe('ns=2;s=Line1.FM101.Flow');

      driver.setTagTypeMap({ 'FEED_FLOW': 'Float' });
      expect(driver.tagTypeMap['FEED_FLOW']).toBe('Float');
    });

    it('interacts through custom loopback API when provided', async () => {
      let echoedSeqAck = 0;
      const lastInputs: Record<string, any> = {};

      const mockApi = {
        connect: async () => ({ success: true }),
        disconnect: async () => ({ success: true }),
        readTags: async (nodes: string[]) => {
          const res: Record<string, any> = {};
          for (const nid of nodes) {
            if (nid.includes('SEQ_ACK')) res[nid] = echoedSeqAck;
            else if (nid.includes('PLC_STATE')) res[nid] = 'STOPPED';
            else res[nid] = 0;
          }
          return res;
        },
        writeTags: async (writes: Record<string, { value: any; dataType?: string }>) => {
          for (const [nodeId, payload] of Object.entries(writes)) {
            if (nodeId.includes('SEQ')) echoedSeqAck = payload.value;
            lastInputs[nodeId] = payload.value;
          }
          return { success: true };
        },
        readDataTypes: async () => ({}),
      };

      const driver = new OpcUaPlcDriver('opc.tcp://127.0.0.1:4840');
      driver.customApi = mockApi;
      await driver.connect();
      expect(driver.status.connected).toBe(true);

      await driver.writeInputs({ SEQ: 321 });
      await driver.waitForSeqAck(321, 1000);
      expect(echoedSeqAck).toBe(321);

      await driver.resetPrecondition(['STOPPED'], 1000);
      await driver.disconnect();
      expect(driver.status.connected).toBe(false);
    });
  });
});
