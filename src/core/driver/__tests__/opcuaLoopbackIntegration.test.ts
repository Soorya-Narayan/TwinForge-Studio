import { describe, it, expect, afterAll } from 'vitest';
import { OpcUaManager } from '../../../../electron/opcuaManager';
import { OpcUaPlcDriver } from '../OpcUaPlcDriver';
import { useFatStore } from '../../../store/useFatStore';
import { getFatScenarios } from '../../testgen/scenarios';
import { computeEvidenceFingerprint } from '../../report/fingerprint';

describe('OPC UA Loopback Server Lockstep Integration', () => {
  const manager = new OpcUaManager();
  let driver: OpcUaPlcDriver | null = null;
  const testPort = 4852;

  afterAll(async () => {
    if (driver) {
      await driver.disconnect().catch(() => {});
    }
    await manager.stopLocalServer().catch(() => {});
  });

  it('rejects invalid credentials on loopback server', async () => {
    const startRes = await manager.startLocalServer(testPort);
    expect(startRes.success).toBe(true);

    const bridge = {
      connect: (opts: any) => manager.connect(opts),
      disconnect: () => manager.disconnect(),
      readTags: (tags: string[]) => manager.readTags(tags),
      readNodeDataTypes: (tags: string[]) => manager.readNodeDataTypes(tags),
      writeTags: (tags: any) => manager.writeTags(tags),
      startLocalServer: (port?: number) => manager.startLocalServer(port),
      stopLocalServer: () => manager.stopLocalServer(),
      getStatus: () => manager.getStatus(),
    };

    const badDriver = new OpcUaPlcDriver({
      endpointUrl: startRes.endpointUrl!,
      authMode: 'Username',
      username: 'admin',
      password: 'wrong_password',
    });
    badDriver.customApi = bridge;

    await expect(badDriver.connect()).rejects.toThrow();
    expect(badDriver.status.connected).toBe(false);
  }, 15000);

  it('starts loopback server, connects OPC UA driver, and completes one lockstep scan with handshake', async () => {
    const startRes = await manager.startLocalServer(testPort);
    expect(startRes.success).toBe(true);
    expect(startRes.endpointUrl).toBeDefined();

    const bridge = {
      connect: (opts: any) => manager.connect(opts),
      disconnect: () => manager.disconnect(),
      readTags: (tags: string[]) => manager.readTags(tags),
      readNodeDataTypes: (tags: string[]) => manager.readNodeDataTypes(tags),
      writeTags: (tags: any) => manager.writeTags(tags),
      startLocalServer: (port?: number) => manager.startLocalServer(port),
      stopLocalServer: () => manager.stopLocalServer(),
      getStatus: () => manager.getStatus(),
    };

    driver = new OpcUaPlcDriver({
      endpointUrl: startRes.endpointUrl!,
      authMode: 'Username',
      username: 'admin',
      password: 'admin',
    });
    driver.customApi = bridge;

    // Connect with valid credentials
    await driver.connect();
    expect(driver.status.connected).toBe(true);
    expect(driver.state).toBe('IDLE');

    // Perform one lockstep scan with handshake
    const testSeq = 101;
    await driver.writeInputs({
      SEQ: testSeq,
      TT1: 4.2,
      FM: 10000.0,
    });

    // Wait for the loopback server to echo SEQ into SEQ_ACK
    await driver.waitForSeqAck(testSeq, 5000);

    // Run lockstep scan tick
    await driver.tick(20);

    // Read outputs and verify SEQ_ACK matches
    const outputs = driver.readOutputs();
    expect(Number(outputs['SEQ_ACK'])).toBe(testSeq);

    // Disconnect and shutdown
    await driver.disconnect();
    expect(driver.status.connected).toBe(false);

    await manager.stopLocalServer();
    expect(manager.getStatus().serverRunning).toBe(false);
  }, 20000);

  it('identifies loopback session and labels driver as opcua-loopback without Real PLC claims in FAT runner and evidence', async () => {
    const loopbackPort = 4853;
    const startRes = await manager.startLocalServer(loopbackPort);
    expect(startRes.success).toBe(true);

    const bridge = {
      connect: (opts: any) => manager.connect(opts),
      disconnect: () => manager.disconnect(),
      readTags: (tags: string[]) => manager.readTags(tags),
      readNodeDataTypes: (tags: string[]) => manager.readNodeDataTypes(tags),
      writeTags: (tags: any) => manager.writeTags(tags),
      startLocalServer: (port?: number) => manager.startLocalServer(port),
      stopLocalServer: () => manager.stopLocalServer(),
      getStatus: () => manager.getStatus(),
    };

    const loopbackDriver = new OpcUaPlcDriver({
      endpointUrl: startRes.endpointUrl!,
      authMode: 'Username',
      username: 'admin',
      password: 'admin',
    });
    loopbackDriver.customApi = bridge;

    await loopbackDriver.connect();
    expect(loopbackDriver.isLoopbackSession()).toBe(true);
    expect(loopbackDriver.serverProductName).toBe('Loopback Test Server');

    const testScenario = getFatScenarios('PASTEURIZER_10KLPH')[0];
    await useFatStore.getState().runSingleTest(testScenario.id, loopbackDriver);

    const storeState = useFatStore.getState();
    const result = storeState.results.find((r) => r.testId === testScenario.id);
    expect(result).toBeDefined();
    if (!result) throw new Error('Result not found');
    if (!result.driver) throw new Error('Driver not found');
    expect(result.driver.driverType).toBe('opcua-loopback');
    expect(result.driver.details).toContain('Loopback Test Server');
    expect(result.driver.details).not.toContain('Real PLC');
    expect(storeState.executionDriverInfo?.driverType).toBe('opcua-loopback');

    // Build evidence payload like FatReportModal does and verify fingerprint
    const payloadObject = {
      certificateRef: storeState.projectSettings.certificateRef,
      customerName: storeState.projectSettings.customerName,
      authority: storeState.projectSettings.clientAuthority,
      lead: storeState.projectSettings.commissioningLead,
      results: storeState.results,
      journal: storeState.journal,
      driver: storeState.executionDriverInfo,
      timestamp: new Date().toISOString(),
    };

    const { payloadString } = await computeEvidenceFingerprint(payloadObject);
    expect(payloadString).not.toContain('Real PLC');
    expect(payloadString).toContain('opcua-loopback');
    expect(payloadString).toContain('Loopback Test Server');

    await loopbackDriver.disconnect();
    await manager.stopLocalServer();
  }, 30000);
});

