/**
 * TwinForge Studio - Deterministic Physics Engine
 * 
 * Strict physical scan loop:
 * INGEST -> ADVANCE -> RESOLVE -> FLOW -> INTEGRATE -> SENSE -> PUBLISH
 * 
 * Byte-identical determinism: Zero wall-clock calls, fixed time-step, sorted key iteration.
 */

import type {
  DevicePhysicalState,
  DeviceFault,
  PipeConnection,
  SimulationSnapshot,
  TankConfig,
  ValveConfig,
  PumpConfig,
  HeatExchangerConfig,
} from './types';

export interface PlantTopology {
  tanks: TankConfig[];
  valves: ValveConfig[];
  pumps: PumpConfig[];
  exchangers: HeatExchangerConfig[];
  connections: PipeConnection[];
}

export class PhysicsEngine {
  private readonly stepMs: number = 100;
  private scan: number = 0;
  private timeMs: number = 0;

  private topology: PlantTopology;
  private states: Map<string, DevicePhysicalState> = new Map();
  private faults: Map<string, DeviceFault> = new Map();

  // Active flow on pipe connections (connectionId -> L/min)
  private connectionFlows: Map<string, number> = new Map();

  constructor(topology: PlantTopology) {
    this.topology = topology;
    this.reset();
  }

  public reset(): void {
    this.scan = 0;
    this.timeMs = 0;
    this.states.clear();
    this.connectionFlows.clear();

    // Initialize tanks
    for (const tank of this.topology.tanks) {
      const vol = (tank.capacityL * tank.initialLevelPct) / 100;
      this.states.set(tank.id, {
        id: tank.id,
        type: 'tank',
        volumeL: vol,
        levelPct: tank.initialLevelPct,
        temperatureC: tank.initialTempC ?? 20.0,
      });
    }

    // Initialize valves (start fully closed)
    for (const valve of this.topology.valves) {
      this.states.set(valve.id, {
        id: valve.id,
        type: valve.type,
        positionPct: 0.0,
        isOpen: false,
      });
    }

    // Initialize pumps (stopped)
    for (const pump of this.topology.pumps) {
      this.states.set(pump.id, {
        id: pump.id,
        type: 'centrifugal_pump',
        speedPct: 0.0,
      });
    }

    // Initialize exchangers
    for (const hx of this.topology.exchangers) {
      this.states.set(hx.id, {
        id: hx.id,
        type: 'heat_exchanger',
        temperatureC: 20.0,
      });
    }
  }

  public setFault(fault: DeviceFault): void {
    if (fault.mode === 'none') {
      this.faults.delete(fault.deviceId);
    } else {
      this.faults.set(fault.deviceId, fault);
    }
  }

  public clearAllFaults(): void {
    this.faults.clear();
  }

  public getFaults(): DeviceFault[] {
    return Array.from(this.faults.values());
  }

  /**
   * Main scan tick
   * @param plcCommands Map of PLC output tag values (commands to devices)
   * @returns SimulationSnapshot
   */
  public tick(plcCommands: Record<string, boolean | number>): SimulationSnapshot {
    this.scan += 1;
    this.timeMs += this.stepMs;
    const dtSeconds = this.stepMs / 1000.0;

    // 1. INGEST & ADVANCE: Move actuator mechanical states
    this.advanceValves(plcCommands, dtSeconds);
    this.advancePumps(plcCommands, dtSeconds);

    // 2. RESOLVE & FLOW: Solve fluid dynamics across pipe paths
    this.solveFlowPaths();

    // 3. INTEGRATE: Update tank levels, mass balance, and thermodynamics
    this.integrateMassAndHeat(dtSeconds);

    // 4. SENSE & PUBLISH: Produce feedback inputs for PLC
    const plcInputs = this.generatePlcInputs();

    // Snapshot assembly
    const devicesRecord: Record<string, DevicePhysicalState> = {};
    for (const [id, state] of this.states.entries()) {
      devicesRecord[id] = { ...state };
    }

    const pathsList = this.topology.connections.map((c) => {
      const flow = this.connectionFlows.get(c.id) ?? 0;
      return {
        id: c.id,
        flowLpm: Number(flow.toFixed(2)),
        active: flow > 0.01,
      };
    });

    return {
      scan: this.scan,
      timeMs: this.timeMs,
      devices: devicesRecord,
      paths: pathsList,
      tags: {
        inputs: plcInputs,
        outputs: { ...plcCommands },
      },
      alarms: this.deriveAlarms(devicesRecord),
    };
  }

  private advanceValves(commands: Record<string, boolean | number>, dt: number): void {
    for (const valve of this.topology.valves) {
      const state = this.states.get(valve.id);
      if (!state) continue;

      const fault = this.faults.get(valve.id);
      if (fault?.mode === 'stuck_closed') {
        state.positionPct = 0;
        state.isOpen = false;
        continue;
      }
      if (fault?.mode === 'stuck_open') {
        state.positionPct = 100;
        state.isOpen = true;
        continue;
      }

      // Check command tag (e.g., V101_CMD or tag name directly)
      const cmdRaw = commands[`${valve.tag}_CMD`] ?? commands[valve.tag] ?? commands[valve.id];
      const targetPct = typeof cmdRaw === 'number' ? cmdRaw : cmdRaw ? 100 : 0;

      const ratePctPerSec = 100.0 / Math.max(0.1, valve.travelTimeS);
      const maxDelta = ratePctPerSec * dt;

      const current = state.positionPct ?? 0;
      let next = current;
      if (current < targetPct) {
        next = Math.min(targetPct, current + maxDelta);
      } else if (current > targetPct) {
        next = Math.max(targetPct, current - maxDelta);
      }

      state.positionPct = Number(next.toFixed(2));
      // Limit switch / ZSO proofs open at 95% or higher
      state.isOpen = state.positionPct >= (valve.passableThresholdPct ?? 90);
    }
  }

  private advancePumps(commands: Record<string, boolean | number>, dt: number): void {
    for (const pump of this.topology.pumps) {
      const state = this.states.get(pump.id);
      if (!state) continue;

      const fault = this.faults.get(pump.id);
      if (fault?.mode === 'pump_trip') {
        state.speedPct = 0;
        continue;
      }

      const cmdRaw = commands[`${pump.tag}_START`] ?? commands[pump.tag] ?? commands[pump.id];
      const running = Boolean(cmdRaw);
      const targetSpeed = running ? 100 : 0;

      const rampRate = 100.0 / Math.max(0.1, pump.rampUpTimeS);
      const maxDelta = rampRate * dt;

      const current = state.speedPct ?? 0;
      let next = current;
      if (current < targetSpeed) {
        next = Math.min(targetSpeed, current + maxDelta);
      } else if (current > targetSpeed) {
        next = Math.max(targetSpeed, current - maxDelta);
      }

      state.speedPct = Number(next.toFixed(2));
    }
  }

  private solveFlowPaths(): void {
    this.connectionFlows.clear();

    // Map device IDs to incoming and outgoing connections
    const outgoing = new Map<string, PipeConnection[]>();
    for (const conn of this.topology.connections) {
      const list = outgoing.get(conn.fromNode) ?? [];
      list.push(conn);
      outgoing.set(conn.fromNode, list);
    }

    // For every pump, find path to destination tank
    for (const pump of this.topology.pumps) {
      const pState = this.states.get(pump.id);
      if (!pState || (pState.speedPct ?? 0) <= 0) continue;

      const ratedFlow = (pump.maxFlowLpm * (pState.speedPct ?? 0)) / 100;

      // Find suction connection (incoming to pump)
      const suction = this.topology.connections.find((c) => c.toNode === pump.id);
      if (!suction) continue;

      const sourceTank = this.topology.tanks.find((t) => t.id === suction.fromNode);
      const sourceState = sourceTank ? this.states.get(sourceTank.id) : undefined;
      const sourceVolume = sourceState?.volumeL ?? 0;

      if (sourceVolume <= 0.5) {
        // Source tank empty -> no flow, risk of cavitation!
        continue;
      }

      // Check discharge paths from pump
      const dischargeConns = outgoing.get(pump.id) ?? [];
      for (const dConn of dischargeConns) {
        // Trace line forward through valves
        const pathPassable = this.tracePassability(dConn.toNode, outgoing);
        if (pathPassable) {
          this.connectionFlows.set(suction.id, ratedFlow);
          this.connectionFlows.set(dConn.id, ratedFlow);
          this.propagateFlow(dConn.toNode, ratedFlow, outgoing);
        }
      }
    }
  }

  private tracePassability(currentNodeId: string, outgoing: Map<string, PipeConnection[]>): boolean {
    const valve = this.topology.valves.find((v) => v.id === currentNodeId);
    if (valve) {
      const vState = this.states.get(valve.id);
      if (!vState?.isOpen) {
        return false;
      }
      // Follow valve outlet
      const nextConns = outgoing.get(valve.id) ?? [];
      if (nextConns.length === 0) return true;
      return nextConns.every((c) => this.tracePassability(c.toNode, outgoing));
    }

    const exchanger = this.topology.exchangers.find((hx) => hx.id === currentNodeId);
    if (exchanger) {
      const nextConns = outgoing.get(exchanger.id) ?? [];
      return nextConns.every((c) => this.tracePassability(c.toNode, outgoing));
    }

    // Destination tank reached
    return true;
  }

  private propagateFlow(nodeId: string, flow: number, outgoing: Map<string, PipeConnection[]>): void {
    const conns = outgoing.get(nodeId) ?? [];
    for (const c of conns) {
      this.connectionFlows.set(c.id, flow);
      this.propagateFlow(c.toNode, flow, outgoing);
    }
  }

  private integrateMassAndHeat(dt: number): void {
    const dtMin = dt / 60.0;

    for (const tank of this.topology.tanks) {
      const state = this.states.get(tank.id);
      if (!state) continue;

      let netFlowLpm = 0;

      // Inflow from connections entering tank
      for (const conn of this.topology.connections) {
        if (conn.toNode === tank.id) {
          const flow = this.connectionFlows.get(conn.id) ?? 0;
          netFlowLpm += flow;
        }
      }

      // Outflow from connections leaving tank
      for (const conn of this.topology.connections) {
        if (conn.fromNode === tank.id) {
          const flow = this.connectionFlows.get(conn.id) ?? 0;
          netFlowLpm -= flow;
        }
      }

      const deltaVolume = netFlowLpm * dtMin;
      const newVol = Math.max(0, Math.min(tank.capacityL, (state.volumeL ?? 0) + deltaVolume));
      state.volumeL = Number(newVol.toFixed(2));
      state.levelPct = Number(((newVol / tank.capacityL) * 100).toFixed(2));
    }

    // Heat Exchangers: simple thermodynamic approach
    for (const hx of this.topology.exchangers) {
      const state = this.states.get(hx.id);
      if (!state) continue;

      // If fluid is passing through, heat up toward steam temperature (e.g. 85°C)
      let activeFlow = 0;
      for (const conn of this.topology.connections) {
        if (conn.toNode === hx.id || conn.fromNode === hx.id) {
          activeFlow = Math.max(activeFlow, this.connectionFlows.get(conn.id) ?? 0);
        }
      }

      if (activeFlow > 0) {
        const steamTemp = 95.0; // steam header
        const currentTemp = state.temperatureC ?? 20.0;
        const heatRate = 0.05 * dt; // approach rate
        state.temperatureC = Number((currentTemp + (steamTemp - currentTemp) * heatRate).toFixed(2));
      }
    }
  }

  private generatePlcInputs(): Record<string, boolean | number> {
    const inputs: Record<string, boolean | number> = {};

    // Valves -> Open & Closed feedback (ZSO & ZSC)
    for (const valve of this.topology.valves) {
      const state = this.states.get(valve.id);
      const isOpen = Boolean(state?.isOpen);
      const isClosed = (state?.positionPct ?? 0) <= 2;

      inputs[`${valve.tag}_ZSO`] = isOpen;
      inputs[`${valve.tag}_ZSC`] = isClosed;
      inputs[`${valve.tag}_POS`] = state?.positionPct ?? 0;
    }

    // Pumps -> Running feedback
    for (const pump of this.topology.pumps) {
      const state = this.states.get(pump.id);
      const isRunning = (state?.speedPct ?? 0) > 10;
      inputs[`${pump.tag}_RUN_FB`] = isRunning;
      inputs[`${pump.tag}_SPD_ACT`] = state?.speedPct ?? 0;
    }

    // Tanks -> Level Transmitters (LT) and High/Low Level Switches (LSH/LSL)
    for (const tank of this.topology.tanks) {
      const state = this.states.get(tank.id);
      const level = state?.levelPct ?? 0;

      const fault = this.faults.get(tank.id);
      const offset = fault?.mode === 'sensor_offset' ? (fault.value ?? 0) : 0;
      const sensedLevel = Math.max(0, Math.min(100, level + offset));

      inputs[`${tank.tag}_LT`] = Number(sensedLevel.toFixed(1));
      inputs[`${tank.tag}_VOL`] = state?.volumeL ?? 0;
      inputs[`${tank.tag}_LSL`] = sensedLevel < 10; // Low level trip
      inputs[`${tank.tag}_LSH`] = sensedLevel > 90; // High level alarm
    }

    // Heat Exchanger -> Temperature Transmitter (TT)
    for (const hx of this.topology.exchangers) {
      const state = this.states.get(hx.id);
      inputs[`${hx.tag}_TT`] = state?.temperatureC ?? 20.0;
    }

    // Specialized Dairy Pasteurizer P&ID Tag Mapping (GP-LACTALIS, BHOPAL-PID-PSTRZ-001)
    if (this.topology.tanks.some((t) => t.id === 'TK-BALANCE')) {
      const balState = this.states.get('TK-BALANCE');
      const feedState = this.states.get('P-FEED');
      const boostState = this.states.get('P-BOOSTER');
      const hwState = this.states.get('P-HOTWATER');
      const heatState = this.states.get('PHE-HEATING');
      const chillState = this.states.get('PHE-CHILLING');
      const reg2State = this.states.get('PHE-REG02');

      const balLevel = balState?.levelPct ?? 75;
      const feedSpd = feedState?.speedPct ?? 0;
      const boostSpd = boostState?.speedPct ?? 0;
      const hwSpd = hwState?.speedPct ?? 0;
      const holdingTemp = heatState?.temperatureC ?? 20.0;

      // 9 Temperature Transmitters
      inputs['TT1'] = Number((balState?.temperatureC ?? 4.0).toFixed(1)); // Balance tank outlet
      inputs['TT2'] = Number((reg2State?.temperatureC ? reg2State.temperatureC - 5.0 : 65.0).toFixed(1)); // Homogenizer inlet
      inputs['TT3'] = Number((reg2State?.temperatureC ?? 70.0).toFixed(1)); // REG-02 exit
      inputs['TT4'] = Number((reg2State?.temperatureC ?? 70.0).toFixed(1)); // Heating section entrance
      inputs['TT5'] = Number(holdingTemp.toFixed(1)); // Holding coil exit (Critical safety interlock)
      inputs['TT6'] = Number((hwSpd > 10 ? 95.0 : 25.0).toFixed(1)); // Hot water supply
      inputs['TT7'] = Number((hwSpd > 10 ? 91.8 : 24.5).toFixed(1)); // Hot water return
      inputs['TT8'] = Number((hwSpd > 10 ? 88.0 : 23.0).toFixed(1)); // Steam condensate recovery
      inputs['TT9'] = Number((chillState?.temperatureC ? Math.max(4.0, chillState.temperatureC + 2.0) : 6.2).toFixed(1)); // Chilled water return

      // 7 Pressure Transmitters & Gauge
      inputs['PT1'] = Number((0.2 + (balLevel / 100) * 0.1).toFixed(2)); // Suction head (bar)
      inputs['PT2'] = Number((feedSpd > 10 ? 2.5 * (feedSpd / 100) : 0.2).toFixed(2)); // Feed pump discharge (bar)
      inputs['PT3'] = Number((feedSpd > 10 ? 180.0 : 0.0).toFixed(1)); // Homogenizer stage pressure (bar)
      inputs['PT4'] = Number((boostSpd > 10 ? 4.1 : feedSpd > 10 ? 2.3 : 0.2).toFixed(2)); // Booster pump discharge (bar)
      inputs['PT5'] = Number((hwSpd > 10 ? 2.1 : 0.0).toFixed(2)); // Hot water pump discharge (bar)
      inputs['PT6'] = 3.0; // Chilled water supply header (bar)
      inputs['PT7'] = 3.0; // Steam header supply (bar)
      inputs['PG1'] = 3.0; // Steam pressure gauge (bar)

      // Flowmeter (0 - 12,000 LPH, rated 10,000 LPH)
      inputs['FM'] = Number(((feedSpd / 100) * 10000).toFixed(0)); // LPH

      // Level Transmitters & Switches
      inputs['LT1'] = Number(balLevel.toFixed(1));
      inputs['LS1'] = balLevel < 15; // Low level switch cutoff
      inputs['LS2'] = balLevel > 95; // High level switch cutoff
    }

    return inputs;
  }

  private deriveAlarms(devices: Record<string, DevicePhysicalState>): string[] {
    const alarms: string[] = [];

    for (const tank of this.topology.tanks) {
      const state = devices[tank.id];
      if ((state?.levelPct ?? 0) > 95) {
        alarms.push(`ALARM_HI_HI_${tank.tag}_OVERFILL`);
      }
      if ((state?.levelPct ?? 0) < 5) {
        alarms.push(`ALARM_LO_LO_${tank.tag}_LOW_LEVEL`);
      }
    }

    for (const fault of this.faults.values()) {
      alarms.push(`FAULT_${fault.deviceId.toUpperCase()}_${fault.mode.toUpperCase()}`);
    }

    return alarms;
  }
}
