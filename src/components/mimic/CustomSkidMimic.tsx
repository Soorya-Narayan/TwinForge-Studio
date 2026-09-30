/**
 * TwinForge Studio - Dynamic Custom Skid Process Mimic
 * Real-time schematic rendering and operator control for user-defined plant templates.
 */

import React from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Play, Pause, RotateCcw, Activity, Power } from 'lucide-react';

export const CustomSkidMimic: React.FC = () => {
  const snapshot = useSimulationStore((s) => s.snapshot);
  const running = useSimulationStore((s) => s.running);
  const speed = useSimulationStore((s) => s.speed);
  const start = useSimulationStore((s) => s.start);
  const pause = useSimulationStore((s) => s.pause);
  const reset = useSimulationStore((s) => s.reset);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const plc = useSimulationStore((s) => s.plc);
  const customMeta = useSimulationStore((s) => s.customMeta);
  const manualOverrideOutput = useSimulationStore((s) => s.manualOverrideOutput);

  // Extract topology components from snapshot devices
  const devices = snapshot?.devices ?? {};
  const paths = snapshot?.paths ?? [];

  // Group devices by type
  const tanks = Object.values(devices).filter((d) => d.type === 'tank');
  const pumps = Object.values(devices).filter((d) => d.type === 'centrifugal_pump');
  const valves = Object.values(devices).filter((d) => d.type === 'on_off_valve' || d.type === 'modulating_valve');
  const exchangers = Object.values(devices).filter((d) => d.type === 'heat_exchanger');

  // Toggle valve
  const handleToggleValve = (tag: string, currentOpen: boolean) => {
    manualOverrideOutput(`${tag}_CMD`, !currentOpen);
  };

  // Toggle pump
  const handleTogglePump = (tag: string, currentRunning: boolean) => {
    manualOverrideOutput(`${tag}_START`, !currentRunning);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', paddingBottom: 20 }}>
      {/* 1. SCADA Operator Control Toolbar */}
      <div
        className="industrial-card"
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={running ? pause : start} className={`btn ${running ? 'btn-ghost' : 'btn-primary'}`}>
            {running ? <Pause size={14} /> : <Play size={14} />}
            {running ? 'PAUSE' : 'RUN SIMULATION'}
          </button>
          <button onClick={reset} className="btn btn-ghost" title="Reset Simulation">
            <RotateCcw size={14} />
            RESET
          </button>

          <div style={{ display: 'flex', gap: 2, background: '#e2e8f0', padding: 2, borderRadius: 4, marginLeft: 6 }}>
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

        {/* Skid Status Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-subtle)', fontSize: 11 }}>
            <span style={{ color: 'var(--text-muted)' }}>TEMPLATE:</span>
            <strong style={{ color: 'var(--color-primary)' }}>{customMeta?.name ?? 'Custom Process Skid'}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-subtle)', fontSize: 11 }}>
            <span style={{ color: 'var(--text-muted)' }}>STATE:</span>
            <span className={`badge ${running ? 'badge-success' : 'badge-neutral'}`}>
              {running ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>

          <button
            onClick={() => {
              if ('emergencyStop' in plc) {
                (plc as any).emergencyStop();
              }
            }}
            className="btn btn-danger"
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            <Power size={13} />
            E-STOP
          </button>
        </div>
      </div>

      {/* 2. Visual Plant Topology Overview */}
      <div
        className="industrial-card"
        style={{
          padding: '20px',
          background: '#ffffff',
          borderRadius: 8,
          border: '1px solid var(--border-strong)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="var(--color-primary)" />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Live Actuator & Component Matrix
            </h3>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {tanks.length} Vessels · {pumps.length} Pumps · {valves.length} Valves · {exchangers.length} Exchangers
          </span>
        </div>

        {/* Process Vessels Grid */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Process Vessels & Storage Tanks
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {tanks.map((t) => {
              const level = t.levelPct ?? 0;
              const vol = t.volumeL ?? 0;
              return (
                <div
                  key={t.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{t.id}</span>
                    <span className="mono badge badge-primary" style={{ fontSize: 10 }}>
                      {level.toFixed(1)}%
                    </span>
                  </div>

                  {/* Level Gauge Bar */}
                  <div style={{ height: 16, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', border: '1px solid #cbd5e1', position: 'relative' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${level}%`,
                        background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
                        transition: 'width 0.2s ease',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: 9,
                        fontWeight: 800,
                        color: level > 50 ? '#ffffff' : '#0f172a',
                      }}
                      className="mono"
                    >
                      {vol.toFixed(0)} L
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                    <span>Temp: {t.temperatureC ? `${t.temperatureC.toFixed(1)}°C` : '20°C'}</span>
                    <span className="mono">ID: {t.id}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pumps & Actuators Grid */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Pumps & Motive Equipment
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {pumps.map((p) => {
              const speedPct = p.speedPct ?? 0;
              const isRunning = speedPct > 5;
              const tag = p.id.replace('P-', 'P_');

              return (
                <div
                  key={p.id}
                  style={{
                    background: isRunning ? '#f0fdf4' : '#ffffff',
                    border: `1px solid ${isRunning ? '#86efac' : 'var(--border-strong)'}`,
                    borderRadius: 6,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`led ${isRunning ? 'led-run' : 'led-stop'}`} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{p.id}</span>
                    </div>
                    <span className={`badge ${isRunning ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                      {isRunning ? `${speedPct.toFixed(0)}% RPM` : 'STOPPED'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Manual Override:</span>
                    <button
                      onClick={() => handleTogglePump(tag, isRunning)}
                      className={`btn ${isRunning ? 'btn-danger' : 'btn-success'}`}
                      style={{ fontSize: 10, padding: '3px 8px' }}
                    >
                      {isRunning ? 'TRIP PUMP' : 'START PUMP'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Valves Grid */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Automated Sanitary & Block Valves
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
            {valves.map((v) => {
              const isOpen = Boolean(v.isOpen);
              const tag = v.id.replace('-', '_');

              return (
                <div
                  key={v.id}
                  onClick={() => handleToggleValve(tag, isOpen)}
                  style={{
                    background: isOpen ? '#f0fdf4' : '#ffffff',
                    border: `1px solid ${isOpen ? '#86efac' : 'var(--border-strong)'}`,
                    borderRadius: 6,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                  title="Click to toggle valve state"
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{v.id}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Pos: {(v.positionPct ?? 0).toFixed(0)}%</div>
                  </div>
                  <span className={`badge ${isOpen ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 10, fontWeight: 800 }}>
                    {isOpen ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Pipe Flow Rates */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Active Pipe Paths & Flow Dynamics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {paths.map((path) => {
              const flow = path.flowLpm ?? 0;
              const hasFlow = flow > 0.05;

              return (
                <div
                  key={path.id}
                  style={{
                    background: hasFlow ? '#f0f9ff' : '#f8fafc',
                    border: `1px solid ${hasFlow ? '#7dd3fc' : 'var(--border-subtle)'}`,
                    borderRadius: 4,
                    padding: '6px 10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 11,
                  }}
                >
                  <span className="mono" style={{ color: hasFlow ? '#0369a1' : 'var(--text-muted)', fontWeight: 600 }}>
                    {path.id}
                  </span>
                  <span className="mono" style={{ fontWeight: 800, color: hasFlow ? '#0284c7' : 'var(--text-muted)' }}>
                    {flow.toFixed(1)} L/min
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
