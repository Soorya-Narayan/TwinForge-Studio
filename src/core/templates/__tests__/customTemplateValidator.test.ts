import { describe, it, expect } from 'vitest';
import { validateCustomSkid, SAMPLE_CUSTOM_BOILERPLATE } from '../customTemplateValidator';

describe('Custom Plant Template Validator', () => {
  it('validates the sample industrial boilerplate successfully', () => {
    const res = validateCustomSkid(SAMPLE_CUSTOM_BOILERPLATE);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.stats.tankCount).toBe(3);
    expect(res.stats.valveCount).toBe(4);
    expect(res.stats.pumpCount).toBe(2);
    expect(res.stats.exchangerCount).toBe(1);
    expect(res.stats.connectionCount).toBe(10);
  });

  it('rejects null, primitive, or array root values', () => {
    expect(validateCustomSkid(null).valid).toBe(false);
    expect(validateCustomSkid(undefined).valid).toBe(false);
    expect(validateCustomSkid('invalid-json-string').valid).toBe(false);
    expect(validateCustomSkid([]).valid).toBe(false);
    expect(validateCustomSkid({}).valid).toBe(false);
  });

  it('rejects invalid or missing metadata fields', () => {
    const invalidId = {
      ...SAMPLE_CUSTOM_BOILERPLATE,
      meta: { ...SAMPLE_CUSTOM_BOILERPLATE.meta, id: '   ' },
    };
    const res1 = validateCustomSkid(invalidId);
    expect(res1.valid).toBe(false);
    expect(res1.errors.some((e) => e.includes('Missing or invalid "meta.id"'))).toBe(true);

    const invalidChars = {
      ...SAMPLE_CUSTOM_BOILERPLATE,
      meta: { ...SAMPLE_CUSTOM_BOILERPLATE.meta, id: 'CIP SKID #1!' },
    };
    const res2 = validateCustomSkid(invalidChars);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.includes('Invalid "meta.id" format'))).toBe(true);

    const missingName = {
      ...SAMPLE_CUSTOM_BOILERPLATE,
      meta: { ...SAMPLE_CUSTOM_BOILERPLATE.meta, name: '' },
    };
    const res3 = validateCustomSkid(missingName);
    expect(res3.valid).toBe(false);
    expect(res3.errors.some((e) => e.includes('Missing or invalid "meta.name"'))).toBe(true);
  });

  it('enforces component presence (tanks, pumps, connections)', () => {
    const noTanks = {
      ...SAMPLE_CUSTOM_BOILERPLATE,
      topology: { ...SAMPLE_CUSTOM_BOILERPLATE.topology, tanks: [] },
    };
    const res1 = validateCustomSkid(noTanks);
    expect(res1.valid).toBe(false);
    expect(res1.errors.some((e) => e.includes('at least 1 tank'))).toBe(true);

    const noPumps = {
      ...SAMPLE_CUSTOM_BOILERPLATE,
      topology: { ...SAMPLE_CUSTOM_BOILERPLATE.topology, pumps: [] },
    };
    const res2 = validateCustomSkid(noPumps);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.includes('at least 1 pump'))).toBe(true);

    const noConns = {
      ...SAMPLE_CUSTOM_BOILERPLATE,
      topology: { ...SAMPLE_CUSTOM_BOILERPLATE.topology, connections: [] },
    };
    const res3 = validateCustomSkid(noConns);
    expect(res3.valid).toBe(false);
    expect(res3.errors.some((e) => e.includes('at least 1 pipe connection'))).toBe(true);
  });

  it('rejects duplicate component IDs across different device types', () => {
    const dup = JSON.parse(JSON.stringify(SAMPLE_CUSTOM_BOILERPLATE));
    // Set valve ID identical to tank ID
    dup.topology.valves[0].id = dup.topology.tanks[0].id;
    const res = validateCustomSkid(dup);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('Duplicate component ID'))).toBe(true);
  });

  it('rejects duplicate SCADA tags', () => {
    const dupTag = JSON.parse(JSON.stringify(SAMPLE_CUSTOM_BOILERPLATE));
    dupTag.topology.pumps[0].tag = 'DUPLICATE_TAG';
    dupTag.topology.valves[0].tag = 'DUPLICATE_TAG';
    const res = validateCustomSkid(dupTag);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('Duplicate SCADA tag "DUPLICATE_TAG"'))).toBe(true);
  });

  it('validates tank capacity and levels strictly', () => {
    const badCapacity = JSON.parse(JSON.stringify(SAMPLE_CUSTOM_BOILERPLATE));
    badCapacity.topology.tanks[0].capacityL = -500;
    const res1 = validateCustomSkid(badCapacity);
    expect(res1.valid).toBe(false);
    expect(res1.errors.some((e) => e.includes('positive finite "capacityL"'))).toBe(true);

    const badLevel = JSON.parse(JSON.stringify(SAMPLE_CUSTOM_BOILERPLATE));
    badLevel.topology.tanks[0].initialLevelPct = 120;
    const res2 = validateCustomSkid(badLevel);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.includes('between 0 and 100%'))).toBe(true);
  });

  it('validates valve travel time and failsafe strictly', () => {
    const badTravel = JSON.parse(JSON.stringify(SAMPLE_CUSTOM_BOILERPLATE));
    badTravel.topology.valves[0].travelTimeS = 0;
    const res1 = validateCustomSkid(badTravel);
    expect(res1.valid).toBe(false);
    expect(res1.errors.some((e) => e.includes('"travelTimeS" must be a finite number > 0'))).toBe(true);

    const badFailsafe = JSON.parse(JSON.stringify(SAMPLE_CUSTOM_BOILERPLATE));
    badFailsafe.topology.valves[0].failSafe = 'invalid_state';
    const res2 = validateCustomSkid(badFailsafe);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.includes('invalid failSafe'))).toBe(true);
  });

  it('validates pump flow and ramp times strictly', () => {
    const badPump = JSON.parse(JSON.stringify(SAMPLE_CUSTOM_BOILERPLATE));
    badPump.topology.pumps[0].maxFlowLpm = -10;
    const res = validateCustomSkid(badPump);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('positive finite "maxFlowLpm"'))).toBe(true);
  });

  it('validates pipe connections referential integrity and self-loops', () => {
    const danglingFrom = JSON.parse(JSON.stringify(SAMPLE_CUSTOM_BOILERPLATE));
    danglingFrom.topology.connections[0].fromNode = 'NON_EXISTENT_DEVICE';
    const res1 = validateCustomSkid(danglingFrom);
    expect(res1.valid).toBe(false);
    expect(res1.errors.some((e) => e.includes('does not exist in any registered tank'))).toBe(true);

    const selfLoop = JSON.parse(JSON.stringify(SAMPLE_CUSTOM_BOILERPLATE));
    selfLoop.topology.connections[0].toNode = selfLoop.topology.connections[0].fromNode;
    const res2 = validateCustomSkid(selfLoop);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.includes('invalid self-referential loop'))).toBe(true);
  });

  it('emits warnings for isolated disconnected components', () => {
    const isolated = JSON.parse(JSON.stringify(SAMPLE_CUSTOM_BOILERPLATE));
    isolated.topology.tanks.push({
      id: 'TK-ORPHAN',
      tag: 'TK_ORPHAN',
      type: 'tank',
      capacityL: 1000,
      initialLevelPct: 50,
    });
    const res = validateCustomSkid(isolated);
    expect(res.valid).toBe(true);
    expect(res.warnings.some((w) => w.includes('Component "TK-ORPHAN" is disconnected'))).toBe(true);
  });
});
