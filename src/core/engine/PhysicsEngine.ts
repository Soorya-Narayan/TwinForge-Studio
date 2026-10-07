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
import { PHEAssemblyModel } from './phe/index';

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

  // High-fidelity Plate Heat Exchanger assembly for pasteurizer skids
  public pheAssembly?: PHEAssemblyModel;

  constructor(topology: PlantTopology) {
    this.topology = topology;
    this.reset();
  }

  public reset(): void {
    this.scan = 0;
    this.timeMs = 0;
    this.states.clear();
    this.connectionFlows.clear();

    if (this.topology.tanks.some((t) => t.id === 'TK-BALANCE')) {
      this.pheAssembly = new PHEAssemblyModel();
    } else {
      this.pheAssembly = undefined;
    }

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

      let sourceTank = this.topology.tanks.find((t) => t.id === suction.fromNode);
      let suctionPassable = true;

      // If suction comes from an upstream valve (e.g. TK-100 -> V-101 -> P-100), trace back
      if (!sourceTank) {
        const upstreamValve = this.topology.valves.find((v) => v.id === suction.fromNode);
        if (upstreamValve) {
          const vState = this.states.get(upstreamValve.id);
          if (!vState?.isOpen) {
            suctionPassable = false;
          } else {
            const tankConn = this.topology.connections.find((c) => c.toNode === upstreamValve.id);
            if (tankConn) {
              sourceTank = this.topology.tanks.find((t) => t.id === tankConn.fromNode);
            }
          }
        }
      }

      if (!suctionPassable) continue;

      const sourceState = sourceTank ? this.states.get(sourceTank.id) : undefined;
      const sourceVolume = sourceState?.volumeL ?? 500; // Allow circulation/utility pumps

      if (sourceTank && sourceVolume <= 0.5) {
        // Source tank empty -> no flow, risk of cavitation!
        continue;
      }

      // Check discharge paths from pump
      const dischargeConns = outgoing.get(pump.id) ?? [];
      for (const dConn of dischargeConns) {
        // Trace line forward through valves
        const pathPassable = this.tracePassability(dConn.toNode, outgoing);
        if (pathPassable) {
          // If suction had an upstream connection (e.g. PIPE-01), set flow on it too
          const upstreamConn = suction.fromNode ? this.topology.connections.find((c) => c.toNode === suction.fromNode) : undefined;
          if (upstreamConn) {
            this.connectionFlows.set(upstreamConn.id, ratedFlow);
          }
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

    // Heat Exchangers Integration
    if (this.pheAssembly) {
      const feedPump = this.states.get('P-FEED');
      const hwPump = this.states.get('P-HOTWATER');
      const scvValve = this.states.get('SCV-1');
      const pv10Valve = this.states.get('PV-10');
      const pv11Valve = this.states.get('PV-11');
      const pv12Valve = this.states.get('PV-12');
      const balTank = this.states.get('TK-BALANCE');

      const feedPumpSpd = (feedPump?.speedPct ?? 0) / 100.0;
      const feedFlowLph = feedPumpSpd * 10000.0;

      const hwPumpSpeed = (hwPump?.speedPct ?? 0) / 100.0;
      const steamOpening = (scvValve?.positionPct ?? 0) / 100.0;
      const hwFlowLph = hwPumpSpeed * 12000.0;
      const hwSupplyTemp = hwPumpSpeed > 0.05 ? (75.0 + steamOpening * 20.0) : 25.0;

      const cwValveOpen = Boolean(pv10Valve?.isOpen ?? true);
      const cwFlowLph = cwValveOpen ? 12000.0 : 0.0;
      const cwSupplyTemp = 1.5;

      const isForward = Boolean(pv11Valve?.isOpen) && !pv12Valve?.isOpen && feedFlowLph > 500;

      // Extract fault states
      const heatFault = this.faults.get('PHE-HEATING') || this.faults.get('PHE');
      const foulingMult = heatFault?.mode === 'fouling' ? (heatFault.value ?? 3.0) : 1.0;
      const leakPct = heatFault?.mode === 'plate_leak' ? (heatFault.value ?? 50) : 0;
      const lossHw = heatFault?.mode === 'loss_of_hot_water' || hwPumpSpeed < 0.05;
      const lossCw = heatFault?.mode === 'loss_of_chilled_water' || !cwValveOpen;

      const metrics = this.pheAssembly.step(dt, {
        feedFlowRateLph: feedFlowLph,
        rawMilkTempC: balTank?.temperatureC ?? 4.0,
        hotWaterFlowRateLph: hwFlowLph,
        hotWaterSupplyTempC: hwSupplyTemp,
        chilledWaterFlowRateLph: cwFlowLph,
        chilledWaterSupplyTempC: cwSupplyTemp,
        isForwardFlow: isForward,
        foulingMultiplier: foulingMult,
        plateLeakSizePct: leakPct,
        lossOfHotWater: lossHw,
        lossOfChilledWater: lossCw,
      });

      // Update simulated device states
      const chillState = this.states.get('PHE-CHILLING');
      if (chillState) chillState.temperatureC = metrics.chilling.tempHotOutC;

      const reg1State = this.states.get('PHE-REG01');
      if (reg1State) reg1State.temperatureC = metrics.reg01.tempColdOutC;

      const reg2State = this.states.get('PHE-REG02');
      if (reg2State) reg2State.temperatureC = metrics.reg02.tempColdOutC;

      const heatState = this.states.get('PHE-HEATING');
      if (heatState) heatState.temperatureC = metrics.heating.tempColdOutC;
    } else {
      // Fallback for non-pasteurizer topologies
      for (const hx of this.topology.exchangers) {
        const state = this.states.get(hx.id);
        if (!state) continue;
        let activeFlow = 0;
        for (const conn of this.topology.connections) {
          if (conn.toNode === hx.id || conn.fromNode === hx.id) {
            activeFlow = Math.max(activeFlow, this.connectionFlows.get(conn.id) ?? 0);
          }
        }
        if (activeFlow > 0) {
          const steamTemp = 95.0;
          const currentTemp = state.temperatureC ?? 20.0;
          state.temperatureC = Number((currentTemp + (steamTemp - currentTemp) * 0.20 * dt).toFixed(2));
        }
      }
    }

    // Specialized Dairy Pasteurizer Tank Mass Dynamics
    if (this.topology.tanks.some((t) => t.id === 'TK-BALANCE')) {
      const balTank = this.states.get('TK-BALANCE');
      const prodTank = this.states.get('TK-PRODUCT');
      const pFeed = this.states.get('P-FEED');
      const pRaw = this.states.get('P-RAW');
      const pv1 = this.states.get('PV-1');
      const pv11 = this.states.get('PV-11');
      const pv12 = this.states.get('PV-12');

      const feedFlow = ((pFeed?.speedPct ?? 0) / 100) * 166.7;
      const rawFlow = (pv1?.isOpen && (pRaw?.speedPct ?? 0) > 10) ? 166.7 : 0;
      const divertFlow = pv12?.isOpen ? feedFlow : 0;
      const forwardFlow = pv11?.isOpen ? feedFlow : 0;

      // Balance Tank volume integration
      if (balTank) {
        const netBalFlow = rawFlow - feedFlow + divertFlow;
        const deltaBal = netBalFlow * dtMin;
        const newBalVol = Math.max(50, Math.min(600, (balTank.volumeL ?? 450) + deltaBal));
        balTank.volumeL = Number(newBalVol.toFixed(2));
        balTank.levelPct = Number(((newBalVol / 600) * 100).toFixed(2));
      }

      // Product Storage Silo volume integration
      if (prodTank && forwardFlow > 0) {
        const deltaProd = forwardFlow * dtMin;
        const newProdVol = Math.min(10000, (prodTank.volumeL ?? 1000) + deltaProd);
        prodTank.volumeL = Number(newProdVol.toFixed(2));
        prodTank.levelPct = Number(((newProdVol / 10000) * 100).toFixed(2));
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

      // Specialized Continuous Dairy Pasteurizer Tag Mapping (10 KLPH HTST)
    if (this.topology.tanks.some((t) => t.id === 'TK-BALANCE')) {
      const balState = this.states.get('TK-BALANCE');
      const feedState = this.states.get('P-FEED');
      const hwState = this.states.get('P-HOTWATER');

      const balLevel = balState?.levelPct ?? 75;
      const feedSpd = feedState?.speedPct ?? 0;
      const hwSpd = hwState?.speedPct ?? 0;

      const heatFault = this.faults.get('PHE-HEATING') || this.faults.get('PHE');
      const tempOffset = heatFault?.mode === 'sensor_offset' ? (heatFault.value ?? 0) : 0;

      if (this.pheAssembly) {
        const overall = this.pheAssembly.getOverallMetrics();
        const mHeat = this.pheAssembly.heating.getMetrics();
        const mReg1 = this.pheAssembly.reg01.getMetrics();
        const mReg2 = this.pheAssembly.reg02.getMetrics();
        const mChill = this.pheAssembly.chilling.getMetrics();

        const holdingTemp = Math.max(0, overall.holdingTubeExitTempC + tempOffset);

        // 9 Temperature Transmitters
        inputs['TT1'] = Number((balState?.temperatureC ?? 4.0).toFixed(1)); // Balance tank outlet
        inputs['TT2'] = Number(mReg1.tempColdOutC.toFixed(1)); // Exiting REG-01 (Homogenizer / Separator inlet)
        inputs['TT3'] = Number(mReg2.tempColdOutC.toFixed(1)); // REG-02 cold exit
        inputs['TT4'] = Number(mReg2.tempColdOutC.toFixed(1)); // Heating section entrance
        inputs['TT5'] = Number(holdingTemp.toFixed(1));        // Holding coil exit (Critical safety interlock)
        inputs['TT6'] = Number(mHeat.tempHotInC.toFixed(1));   // Hot water supply
        inputs['TT7'] = Number(mHeat.tempHotOutC.toFixed(1));  // Hot water return
        inputs['TT8'] = Number((mHeat.tempHotOutC > 30 ? mHeat.tempHotOutC - 3.8 : 22.0).toFixed(1)); // Condensate
        inputs['TT9'] = Number(mChill.tempColdOutC.toFixed(1)); // Chilled water return

        // 7 Pressure Transmitters & Gauge
        inputs['PT1'] = Number((0.2 + (balLevel / 100) * 0.1).toFixed(2)); // Suction head (bar)
        inputs['PT2'] = overall.rawPressurePT2Bar; // Feed pump discharge (bar)
        inputs['PT3'] = Number((feedSpd > 10 ? 180.0 : 0.0).toFixed(1)); // Homogenizer stage pressure (bar)
        inputs['PT4'] = overall.pasteurizedPressurePT4Bar; // Booster pump discharge (bar)
        inputs['PT5'] = Number((hwSpd > 10 ? 2.1 : 0.0).toFixed(2)); // Hot water pump discharge (bar)
        inputs['PT6'] = 3.0; // Chilled water supply header (bar)
        inputs['PT7'] = 3.0; // Steam header supply (bar)
        inputs['PG1'] = 3.0; // Steam pressure gauge (bar)

        // Publish Full PHE Section Analytics Tags
        const sections = [
          { prefix: 'PHE_HEAT', m: mHeat },
          { prefix: 'PHE_REG1', m: mReg1 },
          { prefix: 'PHE_REG2', m: mReg2 },
          { prefix: 'PHE_CHILL', m: mChill },
        ];

        for (const s of sections) {
          inputs[`${s.prefix}_T_COLD_IN`] = s.m.tempColdInC;
          inputs[`${s.prefix}_T_COLD_OUT`] = s.m.tempColdOutC;
          inputs[`${s.prefix}_T_HOT_IN`] = s.m.tempHotInC;
          inputs[`${s.prefix}_T_HOT_OUT`] = s.m.tempHotOutC;
          inputs[`${s.prefix}_Q_KW`] = s.m.dutyAverageKW;
          inputs[`${s.prefix}_EPSILON`] = s.m.effectivenessEpsilon;
          inputs[`${s.prefix}_NTU`] = s.m.ntu;
          inputs[`${s.prefix}_LMTD`] = s.m.lmtdC;
          inputs[`${s.prefix}_U`] = s.m.uValue_W_per_m2_K;
          inputs[`${s.prefix}_UA`] = s.m.uaValue_kW_per_K;
          inputs[`${s.prefix}_DP_COLD`] = s.m.pressureDropColdBar;
          inputs[`${s.prefix}_DP_HOT`] = s.m.pressureDropHotBar;
          inputs[`${s.prefix}_FOULING_PCT`] = s.m.foulingPct;
          inputs[`${s.prefix}_ENERGY_ERR`] = s.m.energyBalanceErrorPct;
        }

        // Overall Assembly KPIs
        inputs['PHE_REGEN_EFF_PCT'] = overall.regenerationEfficiencyPct;
        inputs['PHE_HOLDING_TIME_S'] = overall.holdingTubeResidenceTimeS;
        inputs['PHE_DUTY_HEAT_KW'] = overall.totalHeatingDutyKW;
        inputs['PHE_DUTY_CHILL_KW'] = overall.totalChillingDutyKW;
        inputs['PHE_DUTY_REGEN_KW'] = overall.totalRegenerationDutyKW;
        inputs['PHE_LEAK_RATE_LPM'] = overall.plateLeakFlowRateLpm;
        inputs['PHE_CONTAMINATION_ALARM'] = overall.contaminationAlarm;
      } else {
        // Fallback static estimates if pheAssembly unattached
        inputs['TT1'] = Number((balState?.temperatureC ?? 4.0).toFixed(1));
        inputs['TT2'] = 45.0;
        inputs['TT3'] = 70.0;
        inputs['TT4'] = 70.0;
        inputs['TT5'] = 88.0;
        inputs['TT6'] = 95.0;
        inputs['TT7'] = 91.8;
        inputs['TT8'] = 88.0;
        inputs['TT9'] = 6.2;
        inputs['PT1'] = 0.25;
        inputs['PT2'] = 2.5;
        inputs['PT3'] = 180.0;
        inputs['PT4'] = 4.1;
        inputs['PT5'] = 2.1;
        inputs['PT6'] = 3.0;
        inputs['PT7'] = 3.0;
        inputs['PG1'] = 3.0;
      }

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

    if (this.pheAssembly) {
      const metrics = this.pheAssembly.getOverallMetrics();
      if (metrics.contaminationAlarm) {
        alarms.push('ALARM_CRITICAL_PASTEURIZER_CROSS_CONTAMINATION');
      }
      if (!metrics.isLegalHoldingTime && metrics.holdingTubeResidenceTimeS > 0) {
        alarms.push('ALARM_LEGAL_UNDER_HOLDING_TIME');
      }
    }

    return alarms;
  }
}
