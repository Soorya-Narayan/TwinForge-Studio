/**
 * TwinForge Studio - Dynamic Generic PLC Control Driver
 * Automatically maps to any user-defined custom plant topology.
 */

import type { Driver, DriverStatus } from './Driver';
import type { PlantTopology } from '../engine/PhysicsEngine';
import type { InterlockStatus } from './interlockConfig';

export type { InterlockStatus };

export class GenericPlcDriver implements Driver {
  public readonly driverName = 'GenericPlcDriver';
  public status: DriverStatus = {
    connected: true,
    driverType: 'mock',
    scanRateHz: 10,
    lastScanMs: 0,
    latencyMs: 0,
  };

  public state: 'STOPPED' | 'RUNNING' | 'EMERGENCY_STOP' = 'STOPPED';

  public inputs: Record<string, boolean | number> = {};
  public outputs: Record<string, boolean | number> = {};

  public interlocks: Map<string, InterlockStatus> = new Map();
  private topology: PlantTopology;

  constructor(topology: PlantTopology) {
    this.topology = topology;
    this.initializeRegisters();
  }

  public initializeRegisters(): void {
    this.outputs = {};
    this.interlocks.clear();

    // 1. Valves
    for (const v of this.topology.valves) {
      this.outputs[`${v.tag}_CMD`] = v.failSafe === 'normally_open' ? 100 : false;
    }

    // 2. Pumps
    for (const p of this.topology.pumps) {
      this.outputs[`${p.tag}_START`] = false;

      // Register standard pump safety interlock
      const ilId = `IL-${p.tag}`;
      this.interlocks.set(ilId, {
        id: ilId,
        name: `${p.tag} Suction & Priming Interlock`,
        condition: `Pump ${p.tag} must have active fluid supply before starting to prevent seal cavitation`,
        isOk: true,
        tripped: false,
      });
    }

    // 3. Exchangers
    for (const hx of this.topology.exchangers) {
      this.outputs[`${hx.tag}_STEAM_CMD`] = 0;
    }
  }

  public async connect(): Promise<void> {
    this.status.connected = true;
  }

  public async disconnect(): Promise<void> {
    this.status.connected = false;
  }

  public readOutputs(): Record<string, boolean | number> {
    return { ...this.outputs };
  }

  public writeInputs(inputs: Record<string, boolean | number>): void {
    this.inputs = { ...inputs };
  }

  public tick(dtMs: number): void {
    void dtMs;

    if (this.state !== 'STOPPED' && this.state !== 'EMERGENCY_STOP') {
      // Evaluate standard pump cavitation interlocks
      for (const p of this.topology.pumps) {
        const il = this.interlocks.get(`IL-${p.tag}`);
        if (!il) continue;

        // Find suction tank if directly connected
        const suction = this.topology.connections.find((c) => c.toNode === p.id);
        if (suction) {
          const levelTag = `${suction.fromNode}_LT`;
          const level = Number(this.inputs[levelTag] ?? 50);

          if (level < 5) {
            il.isOk = false;
            il.tripped = true;
            this.outputs[`${p.tag}_START`] = false; // Emergency trip
          } else {
            il.isOk = true;
          }
        }
      }
    }

    // Mirror PLC state machine token to outputs
    (this.outputs as any)['PLC_STATE'] = this.state;

    // Lockstep sequence-number handshake echo (must be at the end of scan after all outputs are computed)
    if (this.inputs['SEQ'] !== undefined) {
      this.outputs['SEQ_ACK'] = Number(this.inputs['SEQ']);
    }
  }

  public async resetPrecondition(
    expectedStates: string | string[] = ['STOPPED', 'IDLE'],
    timeoutMs: number = 3000
  ): Promise<void> {
    void timeoutMs;
    this.resetSystem();
    const validStates = Array.isArray(expectedStates) ? expectedStates : [expectedStates];
    if (!validStates.includes(this.state)) {
      throw new Error(
        `Reset precondition failed: PLC state is '${this.state}', expected ${validStates.map((s) => `'${s}'`).join(' or ')}.`
      );
    }
  }

  public waitForSeqAck(expectedSeq: number, timeoutMs: number = 3000): void {
    if (Number(this.outputs['SEQ_ACK']) !== expectedSeq) {
      throw new Error(
        `Lockstep handshake timeout: PLC failed to acknowledge SEQ = ${expectedSeq} (received SEQ_ACK = ${this.outputs['SEQ_ACK']}) within ${timeoutMs}ms`
      );
    }
  }

  public startProduction(): void {
    this.state = 'RUNNING';
    // Open all valves and engage pumps
    for (const v of this.topology.valves) {
      this.outputs[`${v.tag}_CMD`] = true;
    }
    for (const p of this.topology.pumps) {
      this.outputs[`${p.tag}_START`] = true;
    }
    for (const hx of this.topology.exchangers) {
      this.outputs[`${hx.tag}_STEAM_CMD`] = 75;
    }
  }

  public emergencyStop(): void {
    this.state = 'EMERGENCY_STOP';
    this.clearAllOutputs();
  }

  public resetSystem(): void {
    this.state = 'STOPPED';
    this.initializeRegisters();
    (this.outputs as any)['PLC_STATE'] = 'STOPPED';
    for (const il of this.interlocks.values()) {
      il.tripped = false;
      il.isOk = true;
    }
  }

  public divertManually(): void {
    // Toggle first valve
    const firstValve = this.topology.valves[0];
    if (firstValve) {
      const current = Boolean(this.outputs[`${firstValve.tag}_CMD`]);
      this.outputs[`${firstValve.tag}_CMD`] = !current;
    }
  }

  public clearAllOutputs(): void {
    for (const k of Object.keys(this.outputs)) {
      if (k === 'SEQ_ACK' || k === 'PLC_STATE') continue;
      this.outputs[k] = typeof this.outputs[k] === 'number' ? 0 : false;
    }
  }

  public clearAllCommands(): void {
    this.clearAllOutputs();
  }
}
