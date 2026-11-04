import React from 'react';
import type { CircuitOutputs } from '../../../core/engine/circuits/RawMilkSupplyCircuit';
import type { RawMilkSupplyCircuit } from '../../../core/engine/circuits/RawMilkSupplyCircuit';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { Play, Square, Sliders, ShieldAlert, RotateCcw, AlertTriangle } from 'lucide-react';

import type { FaultMode } from '../../../core/engine/types';

interface PumpControlsCardProps {
  circuit: RawMilkSupplyCircuit;
  outputs: CircuitOutputs;
}

export const PumpControlsCard: React.FC<PumpControlsCardProps> = ({ circuit, outputs }) => {
  const manualOverrideOutput = useSimulationStore((s) => s.manualOverrideOutput);
  const setRawSiloLevel = useSimulationStore((s) => s.setRawSiloLevel);
  const injectFault = useSimulationStore((s) => s.injectFault);
  const faults = useSimulationStore((s) => s.faults);
  const snapshot = useSimulationStore((s) => s.snapshot);

  const pumpState = outputs.pumpState;
  const isRunning = pumpState.speedPct > 10;
  const pv1 = snapshot?.devices['PV-1'];
  const pv1Pos = pv1?.positionPct ?? (pv1?.isOpen ? 100 : 0);

  const isFaultActive = (deviceId: string, mode: FaultMode) => {
    return faults.some((f) => f.deviceId === deviceId && f.mode === mode);
  };

  const handleTogglePump = () => {
    manualOverrideOutput('P_RAW_START', !isRunning);
  };

  const handleTogglePv1 = () => {
    manualOverrideOutput('PV1_CMD', pv1Pos < 50);
  };

  const handleSiloLevelChange = (val: number) => {
    setRawSiloLevel(val);
  };

  const handleToggleFault = (deviceId: string, mode: FaultMode, value?: number) => {
    if (isFaultActive(deviceId, mode)) {
      injectFault({ deviceId, mode: 'none' });
    } else {
      injectFault({ deviceId, mode, value });
    }
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={16} color="var(--color-primary)" />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
            Live Operator Controls & Destructive FAT Testing
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleTogglePump}
            className={`btn ${isRunning ? 'btn-danger' : 'btn-success'}`}
            style={{ fontSize: 11, padding: '4px 10px', height: 26 }}
          >
            {isRunning ? <Square size={12} /> : <Play size={12} />}
            {isRunning ? 'STOP PUMP' : 'START PUMP'}
          </button>
        </div>
      </div>

      {/* Sliders: PV-1 Valve & Silo Level */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>PV-1 Infeed Valve</span>
            <span className="mono" style={{ fontWeight: 800, color: pv1Pos <= 2 ? '#dc2626' : '#059669' }}>
              {pv1Pos.toFixed(0)}% {pv1Pos <= 2 ? '(DEADHEAD)' : pv1Pos >= 98 ? '(OPEN)' : '(TRAVELING)'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: pv1Pos >= 98 ? '#059669' : pv1Pos <= 2 ? '#dc2626' : '#d97706',
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                Position: {pv1Pos.toFixed(0)}%
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    padding: '2px 5px',
                    borderRadius: 4,
                    background: pv1?.zso ? '#dcfce7' : '#f1f5f9',
                    color: pv1?.zso ? '#15803d' : '#94a3b8',
                    border: `1px solid ${pv1?.zso ? '#86efac' : '#e2e8f0'}`,
                  }}
                  title="ZSO: Limit Switch Open Feedback"
                >
                  ZSO {pv1?.zso ? 1 : 0}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    padding: '2px 5px',
                    borderRadius: 4,
                    background: pv1?.zsc ? '#fef3c7' : '#f1f5f9',
                    color: pv1?.zsc ? '#b45309' : '#94a3b8',
                    border: `1px solid ${pv1?.zsc ? '#fde68a' : '#e2e8f0'}`,
                  }}
                  title="ZSC: Limit Switch Closed Feedback"
                >
                  ZSC {pv1?.zsc ? 1 : 0}
                </span>
              </div>

              <button
                onClick={handleTogglePv1}
                className={`btn ${pv1Pos >= 50 ? 'btn-danger' : 'btn-success'}`}
                style={{ fontSize: 11, padding: '4px 12px', height: 26, fontWeight: 700 }}
              >
                {pv1Pos >= 50 ? 'CLOSE PV-1' : 'OPEN PV-1'}
              </button>
            </div>
          </div>

          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            Closing PV-1 while pump runs deadheads the pump and triggers <code>P_RAW_DEADHEAD</code> at 10s.
          </span>
        </div>

        <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Silo Liquid Level (Head)</span>
            <span className="mono" style={{ fontWeight: 800, color: '#0284c7' }}>
              {circuit.siloLevelM.toFixed(1)} m
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="8"
            step="0.5"
            value={circuit.siloLevelM}
            onChange={(e) => handleSiloLevelChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7' }}
          />
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            Adjusts hydrostatic suction head (+ρg·h). At 0m, tests minimum suction pressure.
          </span>
        </div>
      </div>

      {/* Fault Injection Button Deck */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
          Destructive Physical Fault Injection
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <button
            onClick={() => handleToggleFault('P-RAW', 'pump_trip')}
            className={`btn ${isFaultActive('P-RAW', 'pump_trip') ? 'btn-danger' : 'btn-ghost'}`}
            style={{ fontSize: 11, justifyContent: 'flex-start', padding: '6px 10px', height: 'auto' }}
          >
            <ShieldAlert size={14} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700 }}>Motor Electrical Trip</div>
              <div style={{ fontSize: 9, opacity: 0.8 }}>Trips contactor; coasts down on tau=3s</div>
            </div>
          </button>

          <button
            onClick={() => handleToggleFault('P-RAW', 'run_feedback_fail')}
            className={`btn ${isFaultActive('P-RAW', 'run_feedback_fail') ? 'btn-danger' : 'btn-ghost'}`}
            style={{ fontSize: 11, justifyContent: 'flex-start', padding: '6px 10px', height: 'auto' }}
          >
            <AlertTriangle size={14} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700 }}>Aux Contact Wire Break</div>
              <div style={{ fontSize: 9, opacity: 0.8 }}>P_RAW_RUN_FB fails low while running</div>
            </div>
          </button>

          <button
            onClick={() => handleToggleFault('P-RAW', 'raw_supply_empty')}
            className={`btn ${isFaultActive('P-RAW', 'raw_supply_empty') ? 'btn-danger' : 'btn-ghost'}`}
            style={{ fontSize: 11, justifyContent: 'flex-start', padding: '6px 10px', height: 'auto' }}
          >
            <RotateCcw size={14} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700 }}>Silo Dry Run Starvation</div>
              <div style={{ fontSize: 9, opacity: 0.8 }}>Empty suction; raises P_RAW_DRY_RUN</div>
            </div>
          </button>

          <button
            onClick={() => handleToggleFault('P-RAW', 'suction_blockage', 50)}
            className={`btn ${isFaultActive('P-RAW', 'suction_blockage') ? 'btn-danger' : 'btn-ghost'}`}
            style={{ fontSize: 11, justifyContent: 'flex-start', padding: '6px 10px', height: 'auto' }}
          >
            <AlertTriangle size={14} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700 }}>Suction Strainer Clog</div>
              <div style={{ fontSize: 9, opacity: 0.8 }}>Adds K=50; triggers cavitation</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
