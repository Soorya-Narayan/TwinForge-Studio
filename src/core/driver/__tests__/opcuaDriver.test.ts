import { describe, it, expect } from 'vitest';
import { OpcUaPlcDriver } from '../OpcUaPlcDriver';

describe('OpcUaPlcDriver DataType Discovery and Mapping', () => {
  it('reads node DataTypes from server at connect and uses them in writeInputs', async () => {
    let capturedPayload: Record<string, { value: any; dataType?: string }> | null = null;

    const mockApi = {
      connect: async () => ({ success: true }),
      disconnect: async () => ({ success: true }),
      readTags: async () => ({ success: true, values: {} }),
      readNodeDataTypes: async (tags: string[]) => {
        const types: Record<string, string> = {};
        for (const tag of tags) {
          if (tag.includes('TT5') || tag === 'TT5') types[tag] = 'Double';
          if (tag.includes('FM') || tag === 'FM') types[tag] = 'Int16';
        }
        return types;
      },
      writeTags: async (tags: Record<string, { value: any; dataType?: string }>) => {
        capturedPayload = tags;
        return { success: true };
      },
    };

    const driver = new OpcUaPlcDriver({
      endpointUrl: 'opc.tcp://127.0.0.1:4840',
    });
    driver.customApi = mockApi;

    await driver.connect();

    expect(driver.serverNodeDataTypes['TT5']).toBe('Double');
    expect(driver.serverNodeDataTypes['FM']).toBe('Int16');

    await driver.writeInputs({
      TT5: 72.5,
      FM: 10000,
    });

    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload!['ns=1;s=TT5']?.dataType).toBe('Double');
    expect(capturedPayload!['ns=1;s=FM']?.dataType).toBe('Int16');

    await driver.disconnect();
  });

  it('stops inferring Int32 from integer-valued numbers: defaults unknown numbers to Float and only SEQ to Int32', async () => {
    let capturedPayload: Record<string, { value: any; dataType?: string }> | null = null;

    const mockApi = {
      connect: async () => ({ success: true }),
      disconnect: async () => ({ success: true }),
      readTags: async () => ({ success: true, values: {} }),
      readNodeDataTypes: async () => ({}),
      writeTags: async (tags: Record<string, { value: any; dataType?: string }>) => {
        capturedPayload = tags;
        return { success: true };
      },
    };

    const driver = new OpcUaPlcDriver({
      endpointUrl: 'opc.tcp://127.0.0.1:4840',
    });
    driver.customApi = mockApi;
    await driver.connect();

    // CUSTOM_INT_VALUED has an integer value of 50, but is an unknown tag
    await driver.writeInputs({
      CUSTOM_INT_VALUED: 50,
      CUSTOM_FLOAT_VALUED: 23.4,
      CUSTOM_BOOL: true,
      SEQ: 1,
    });

    expect(capturedPayload).not.toBeNull();
    // Must NOT infer Int32 for integer value 50
    expect(capturedPayload!['CUSTOM_INT_VALUED']?.dataType).toBe('Float');
    expect(capturedPayload!['CUSTOM_FLOAT_VALUED']?.dataType).toBe('Float');
    expect(capturedPayload!['CUSTOM_BOOL']?.dataType).toBe('Boolean');
    // Only SEQ is Int32
    expect(capturedPayload!['ns=1;s=SEQ']?.dataType).toBe('Int32');

    await driver.disconnect();
  });
});
