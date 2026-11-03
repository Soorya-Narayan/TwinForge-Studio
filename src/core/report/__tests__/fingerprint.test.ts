import { describe, it, expect } from 'vitest';
import { computeEvidenceFingerprint, canonicalStringify } from '../fingerprint';

describe('Evidence Fingerprint Generator', () => {
  const basePayload = {
    certificateRef: 'FAT-2026-001',
    customerName: 'Acasia Dairy Processing Ltd.',
    commissioningLead: 'Dr. Evelyn Vance, PE',
    organization: 'TwinForge Automation Systems',
    plcPlatform: {
      driverName: 'PasteurizerPlcDriver',
      driverType: 'mock',
      scanMode: 'lockstep',
    },
    results: [
      { testId: 'TC-P01', passed: true, actual: 'STOPPED' },
      { testId: 'TC-P02', passed: true, actual: 'WATER_FLUSH' },
    ],
    timestamp: '2026-11-03T10:00:00.000Z',
  };

  it('generates a 64-character lowercase SHA-256 hex fingerprint', async () => {
    const { hexFingerprint } = await computeEvidenceFingerprint(basePayload);
    expect(hexFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces the exact same SHA-256 fingerprint for identical payloads', async () => {
    const result1 = await computeEvidenceFingerprint(basePayload);
    const result2 = await computeEvidenceFingerprint(JSON.parse(JSON.stringify(basePayload)));

    expect(result1.hexFingerprint).toBe(result2.hexFingerprint);
  });

  it('produces identical SHA-256 fingerprint regardless of key declaration order (canonical)', async () => {
    const permutedPayload = {
      timestamp: '2026-11-03T10:00:00.000Z',
      plcPlatform: {
        scanMode: 'lockstep',
        driverType: 'mock',
        driverName: 'PasteurizerPlcDriver',
      },
      results: [
        { testId: 'TC-P01', passed: true, actual: 'STOPPED' },
        { testId: 'TC-P02', passed: true, actual: 'WATER_FLUSH' },
      ],
      organization: 'TwinForge Automation Systems',
      commissioningLead: 'Dr. Evelyn Vance, PE',
      customerName: 'Acasia Dairy Processing Ltd.',
      certificateRef: 'FAT-2026-001',
    };

    const res1 = await computeEvidenceFingerprint(basePayload);
    const res2 = await computeEvidenceFingerprint(permutedPayload);

    expect(res1.hexFingerprint).toBe(res2.hexFingerprint);
    expect(canonicalStringify(basePayload)).toBe(canonicalStringify(permutedPayload));
  });

  it('produces completely different fingerprint when any field changes', async () => {
    const base = await computeEvidenceFingerprint(basePayload);

    const changedCustomer = await computeEvidenceFingerprint({
      ...basePayload,
      customerName: 'Acasia Dairy Processing Ltd (Branch 2)',
    });
    expect(changedCustomer.hexFingerprint).not.toBe(base.hexFingerprint);

    const changedTest = await computeEvidenceFingerprint({
      ...basePayload,
      results: [
        { testId: 'TC-P01', passed: false, actual: 'STOPPED' },
        { testId: 'TC-P02', passed: true, actual: 'WATER_FLUSH' },
      ],
    });
    expect(changedTest.hexFingerprint).not.toBe(base.hexFingerprint);

    const changedLead = await computeEvidenceFingerprint({
      ...basePayload,
      commissioningLead: 'John Doe',
    });
    expect(changedLead.hexFingerprint).not.toBe(base.hexFingerprint);
  });
});
