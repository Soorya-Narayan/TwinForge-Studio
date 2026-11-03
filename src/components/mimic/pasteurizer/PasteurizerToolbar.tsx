import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { DeviceFault } from '../../../core/engine/types';

interface PasteurizerToolbarProps {
  running: boolean;
  isFatRunning: boolean;
  speed: number;
  isForwardFlow: boolean;
  isDiverted: boolean;
  tt5: number;
  isAtLegalTemp: boolean;
  dpSafe: boolean;
  pt4: number;
  pt2: number;
  faults: DeviceFault[];
  start: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (s: number) => void;
  injectFault: (f: DeviceFault) => void;
  clearFaults: () => void;
}

export const PasteurizerToolbar: React.FC<PasteurizerToolbarProps> = ({
  running,
  isFatRunning,
  speed,
  isForwardFlow,
  isDiverted,
  tt5,
  isAtLegalTemp,
  dpSafe,
  pt4,
  pt2,
  faults,
  start,
  pause,
  reset,
  setSpeed,
  injectFault,
  clearFaults,
}) => {
  return (
    <div className="industrial-card scada-toolbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={running ? pause : start}
          disabled={isFatRunning}
          title={isFatRunning ? 'Live simulation paused during FAT execution' : undefined}
          className={`btn ${running ? 'btn-ghost' : 'btn-primary'}`}
        >
          {running ? <Pause size={14} /> : <Play size={14} />}
          {isFatRunning ? 'FAT RUNNING (PAUSED)' : running ? 'PAUSE' : 'RUN SIMULATION'}
        </button>
        <button onClick={reset} className="btn btn-ghost" title="Reset Simulation">
          <RotateCcw size={14} />
          RESET
        </button>

        <div className="scada-speed-group" style={{ marginLeft: 6 }}>
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 3,
                border: 'none',
                background: speed === s ? '#0284c7' : 'transparent',
                color: speed === s ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Status Banners */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Diversion Status */}
        <div className="scada-telemetry-pill">
          <span style={{ color: 'var(--text-muted)' }}>FLOW DIVERSION:</span>
          <span
            className={`badge ${isForwardFlow ? 'badge-success' : isDiverted ? 'badge-danger' : 'badge-neutral'}`}
            style={{ fontWeight: 800 }}
          >
            {isForwardFlow ? 'PV11 FORWARD (LEGAL)' : isDiverted ? 'PV12 DIVERTED TO BALANCE' : 'STANDBY'}
          </span>
        </div>

        {/* Holding Tube TT5 */}
        <div className="scada-telemetry-pill">
          <span style={{ color: 'var(--text-muted)' }}>HOLDING TUBE (TT5):</span>
          <span
            className="mono"
            style={{ fontWeight: 800, fontSize: 13, color: isAtLegalTemp ? '#059669' : '#dc2626' }}
          >
            {tt5.toFixed(1)} °C
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>(SP: 90.0°C)</span>
        </div>

        {/* Differential Pressure Check */}
        <div className="scada-telemetry-pill">
          <span style={{ color: 'var(--text-muted)' }}>DP (PT4-PT2):</span>
          <span className="mono" style={{ fontWeight: 800, color: dpSafe ? '#059669' : '#dc2626' }}>
            +{(pt4 - pt2).toFixed(2)} bar
          </span>
        </div>

        {/* Fault Simulation Actuator */}
        {faults.length === 0 ? (
          <button
            onClick={() =>
              injectFault({
                deviceId: 'PHE-HEATING',
                mode: 'sensor_offset',
                value: -15, // Drop TT5 temperature
              })
            }
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '4px 8px', color: '#b91c1c' }}
            title="Drop holding temperature to trigger safety divert"
          >
            TRIGGER DIVERT TRIP
          </button>
        ) : (
          <button
            onClick={clearFaults}
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '4px 8px', color: '#059669' }}
          >
            CLEAR TRIP
          </button>
        )}
      </div>
    </div>
  );
};
