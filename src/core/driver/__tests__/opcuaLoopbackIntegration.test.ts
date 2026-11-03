import { describe, it, expect, afterAll } from 'vitest';
import { OpcUaManager } from '../../../../electron/opcuaManager';
import { OpcUaPlcDriver } from '../OpcUaPlcDriver';

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
});
