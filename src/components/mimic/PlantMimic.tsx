/**
 * TwinForge Studio - Professional Industrial Process Mimic (Light Mode)
 * Engineered for factory control rooms, FAT testing, and process engineering.
 */

import React from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Play, Pause, RotateCcw, AlertTriangle } from 'lucide-react';

export const PlantMimic: React.FC = () => {
  const snapshot = useSimulationStore((s) => s.snapshot);
  const plc = useSimulationStore((s) => s.plc);
  const running = useSimulationStore((s) => s.running);
  const speed = useSimulationStore((s) => s.speed);
  const start = useSimulationStore((s) => s.start);
  const pause = useSimulationStore((s) => s.pause);
  const reset = useSimulationStore((s) => s.reset);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const faults = useSimulationStore((s) => s.faults);

  const startPlcBatch = useSimulationStore((s) => s.startPlcBatch);
  const abortPlcBatch = useSimulationStore((s) => s.abortPlcBatch);

  const tk100 = snapshot?.devices['TK-100'];
  const tk400 = snapshot?.devices['TK-400'];
  const tkProd = snapshot?.devices['TK-PROD'];

  const v101 = snapshot?.devices['V-101'];
  const v102 = snapshot?.devices['V-102'];
  const v400 = snapshot?.devices['V-400'];

  const p100 = snapshot?.devices['P-100'];
  const hx100 = snapshot?.devices['HX-100'];

  const isFlowingP1 = (snapshot?.paths.find((p) => p.id === 'PIPE-02')?.flowLpm ?? 0) > 0;
  const isFlowingP2 = (snapshot?.paths.find((p) => p.id === 'PIPE-06')?.flowLpm ?? 0) > 0;

  const isV101Faulted = faults.some((f) => f.deviceId === 'V-101');
  const isP100Faulted = faults.some((f) => f.deviceId === 'P-100');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Control Station Bar */}
      <div className="industrial-card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={running ? pause : start}
            className={`btn ${running ? 'btn-ghost' : 'btn-primary'}`}
          >
            {running ? <Pause size={14} /> : <Play size={14} />}
            {running ? 'PAUSE SIMULATION' : 'RUN SIMULATION'}
          </button>
          <button onClick={reset} className="btn btn-ghost" title="Reset simulation state">
            <RotateCcw size={14} />
            RESET
          </button>
          
          <div style={{ display: 'flex', gap: 2, background: '#e2e8f0', padding: 2, borderRadius: 4, marginLeft: 8 }}>
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

        {/* Batch Operating Controller */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>BATCH STATE:</span>
            <span className={`badge ${plc.state === 'COMPLETE' ? 'badge-success' : plc.state === 'ABORTED' ? 'badge-danger' : 'badge-primary'}`}>
              {plc.state}
            </span>
          </div>

          <button onClick={startPlcBatch} className="btn btn-success" disabled={plc.state === 'DOSING'}>
            START AUTO BATCH
          </button>
          <button onClick={abortPlcBatch} className="btn btn-danger">
            EMERGENCY STOP (E-STOP)
          </button>
        </div>
      </div>

      {/* Industrial P&ID Schematic Canvas */}
      <div className="industrial-card" style={{ flex: 1, padding: 16, position: 'relative', overflow: 'hidden', background: '#ffffff' }}>
        <svg viewBox="0 0 1000 500" style={{ width: '100%', height: '100%', userSelect: 'none' }}>
          <defs>
            {/* Grid Pattern */}
            <pattern id="industrialGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <rect width="40" height="40" fill="none" />
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Precision Engineering Grid */}
          <rect width="1000" height="500" fill="url(#industrialGrid)" />

          {/* PIPEWORK */}
          {/* Main Dosing Header Line */}
          <path
            d="M 170 300 L 260 300 L 360 300 L 480 300 L 600 300 L 680 300 L 680 220"
            fill="none"
            stroke={isFlowingP1 ? '#0284c7' : '#94a3b8'}
            strokeWidth="6"
            strokeLinecap="square"
            strokeLinejoin="round"
            style={{
              transition: 'stroke 0.2s ease',
              strokeDasharray: isFlowingP1 ? '10 6' : 'none',
            }}
          />

          {/* Product Discharge Header Line */}
          <path
            d="M 750 360 L 750 420 L 860 420 L 860 350"
            fill="none"
            stroke={isFlowingP2 ? '#059669' : '#94a3b8'}
            strokeWidth="6"
            strokeLinecap="square"
            strokeLinejoin="round"
            style={{
              transition: 'stroke 0.2s ease',
              strokeDasharray: isFlowingP2 ? '10 6' : 'none',
            }}
          />

          {/* VESSEL 1: TK-100 (Solution Supply Tank) */}
          <g transform="translate(70, 180)">
            <rect x="0" y="0" width="100" height="150" rx="3" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
            {/* Level Fill */}
            <rect
              x="2"
              y={148 - (146 * (tk100?.levelPct ?? 0)) / 100}
              width="96"
              height={(146 * (tk100?.levelPct ?? 0)) / 100}
              fill="#e0f2fe"
              stroke="#bae6fd"
              strokeWidth="1"
            />
            <rect x="0" y="-18" width="100" height="18" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
            <text x="50" y="-5" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">
              TK-100
            </text>
            <text x="50" y="70" textAnchor="middle" fill="#0369a1" fontSize="16" fontWeight="bold" className="mono">
              {(tk100?.levelPct ?? 0).toFixed(0)} %
            </text>
            <text x="50" y="90" textAnchor="middle" fill="#64748b" fontSize="10" className="mono">
              {(tk100?.volumeL ?? 0).toFixed(0)} L
            </text>
            <text x="50" y="110" textAnchor="middle" fill="#64748b" fontSize="9">
              SUPPLY TANK
            </text>
          </g>

          {/* VALVE 1: V-101 (Suction Block Valve) */}
          <g transform="translate(230, 275)">
            {/* Actuator Diaphragm Bonnet */}
            <path d="M 12 10 L 28 10 L 24 0 L 16 0 Z" fill="#64748b" />
            <line x1="20" y1="10" x2="20" y2="25" stroke="#475569" strokeWidth="2" />
            
            {/* Standard ASME Valve Body (Two Triangles) */}
            <polygon
              points="10,15 30,35 30,15 10,35"
              fill={isV101Faulted ? '#fee2e2' : v101?.isOpen ? '#dcfce7' : '#f1f5f9'}
              stroke={isV101Faulted ? '#dc2626' : v101?.isOpen ? '#059669' : '#475569'}
              strokeWidth="2"
            />
            <text x="20" y="-5" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">
              V-101
            </text>
            <text x="20" y="52" textAnchor="middle" fill={v101?.isOpen ? '#059669' : '#475569'} fontSize="10" fontWeight="bold" className="mono">
              {v101?.isOpen ? 'OPEN' : 'CLOSED'}
            </text>
            {isV101Faulted && (
              <text x="20" y="65" textAnchor="middle" fill="#dc2626" fontSize="9" fontWeight="bold">
                FAULT: SEIZED
              </text>
            )}
          </g>

          {/* PUMP: P-100 (Transfer Pump) */}
          <g transform="translate(330, 275)">
            <circle
              cx="25"
              cy="25"
              r="22"
              fill="#f8fafc"
              stroke={isP100Faulted ? '#dc2626' : (p100?.speedPct ?? 0) > 0 ? '#0284c7' : '#475569'}
              strokeWidth="2"
            />
            {/* Pump discharge nozzle */}
            <path d="M 37 10 L 47 10 L 47 25 Z" fill="#475569" />
            <polygon points="25,12 37,25 25,38" fill={(p100?.speedPct ?? 0) > 0 ? '#0284c7' : '#64748b'} />
            
            <text x="25" y="-8" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">
              P-100
            </text>
            <text x="25" y="62" textAnchor="middle" fill={(p100?.speedPct ?? 0) > 0 ? '#0284c7' : '#64748b'} fontSize="10" fontWeight="bold" className="mono">
              {(p100?.speedPct ?? 0).toFixed(0)} % RPM
            </text>
          </g>

          {/* HEAT EXCHANGER: HX-100 (Plate Exchanger) */}
          <g transform="translate(450, 250)">
            <rect x="0" y="0" width="70" height="100" rx="3" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
            {/* Plate Corrugations */}
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={i} x1={10 + i * 9} y1="12" x2={10 + i * 9} y2="88" stroke="#cbd5e1" strokeWidth="2" />
            ))}
            <text x="35" y="-8" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">
              HX-100
            </text>
            <rect x="5" y="112" width="60" height="18" fill="#fef3c7" stroke="#fde68a" rx="2" />
            <text x="35" y="125" textAnchor="middle" fill="#b45309" fontSize="11" fontWeight="bold" className="mono">
              {(hx100?.temperatureC ?? 20).toFixed(1)} °C
            </text>
          </g>

          {/* VALVE 2: V-102 (Discharge Block Valve) */}
          <g transform="translate(570, 275)">
            <path d="M 12 10 L 28 10 L 24 0 L 16 0 Z" fill="#64748b" />
            <line x1="20" y1="10" x2="20" y2="25" stroke="#475569" strokeWidth="2" />
            <polygon
              points="10,15 30,35 30,15 10,35"
              fill={v102?.isOpen ? '#dcfce7' : '#f1f5f9'}
              stroke={v102?.isOpen ? '#059669' : '#475569'}
              strokeWidth="2"
            />
            <text x="20" y="-5" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">
              V-102
            </text>
            <text x="20" y="52" textAnchor="middle" fill={v102?.isOpen ? '#059669' : '#475569'} fontSize="10" fontWeight="bold" className="mono">
              {v102?.isOpen ? 'OPEN' : 'CLOSED'}
            </text>
          </g>

          {/* VESSEL 2: TK-400 (Agitated Mixing Vessel) */}
          <g transform="translate(680, 150)">
            <rect x="0" y="0" width="140" height="210" rx="4" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
            {/* Liquid Level */}
            <rect
              x="2"
              y={208 - (206 * (tk400?.levelPct ?? 0)) / 100}
              width="136"
              height={(206 * (tk400?.levelPct ?? 0)) / 100}
              fill="#e0e7ff"
              stroke="#c7d2fe"
              strokeWidth="1"
            />
            {/* Agitator Motor & Shaft */}
            <rect x="55" y="-20" width="30" height="20" fill="#475569" rx="2" />
            <line x1="70" y1="0" x2="70" y2="135" stroke="#334155" strokeWidth="3" />
            <ellipse cx="70" cy="135" rx="35" ry="8" fill="#64748b" opacity={Boolean(plc.outputs['AGITATOR_CMD']) ? 0.9 : 0.4} />

            <text x="70" y="-28" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="bold">
              TK-400 (MIXER)
            </text>
            <text x="70" y="85" textAnchor="middle" fill="#4338ca" fontSize="18" fontWeight="bold" className="mono">
              {(tk400?.levelPct ?? 0).toFixed(0)} %
            </text>
            <text x="70" y="105" textAnchor="middle" fill="#475569" fontSize="11" className="mono">
              {(tk400?.volumeL ?? 0).toFixed(0)} / 1500 L
            </text>
          </g>

          {/* DISCHARGE VALVE: V-400 */}
          <g transform="translate(730, 395)">
            <polygon
              points="10,15 30,35 30,15 10,35"
              fill={v400?.isOpen ? '#dcfce7' : '#f1f5f9'}
              stroke={v400?.isOpen ? '#059669' : '#475569'}
              strokeWidth="2"
            />
            <text x="20" y="50" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">
              V-400
            </text>
          </g>

          {/* VESSEL 3: TK-PROD (Finished Product Storage) */}
          <g transform="translate(850, 240)">
            <rect x="0" y="0" width="110" height="150" rx="3" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
            <rect
              x="2"
              y={148 - (146 * (tkProd?.levelPct ?? 0)) / 100}
              width="106"
              height={(146 * (tkProd?.levelPct ?? 0)) / 100}
              fill="#dcfce7"
              stroke="#bbf7d0"
              strokeWidth="1"
            />
            <rect x="0" y="-18" width="110" height="18" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
            <text x="55" y="-5" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">
              TK-PROD
            </text>
            <text x="55" y="75" textAnchor="middle" fill="#15803d" fontSize="16" fontWeight="bold" className="mono">
              {(tkProd?.levelPct ?? 0).toFixed(0)} %
            </text>
            <text x="55" y="95" textAnchor="middle" fill="#64748b" fontSize="10">
              STORAGE
            </text>
          </g>
        </svg>

        {/* Live Instrument Readout Footer */}
        <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8 }}>
          <div className="industrial-card" style={{ padding: '4px 10px', fontSize: 11, background: '#f8fafc' }}>
            <span style={{ color: 'var(--text-muted)' }}>SCAN: </span>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{snapshot?.scan ?? 0}</span>
          </div>
          <div className="industrial-card" style={{ padding: '4px 10px', fontSize: 11, background: '#f8fafc' }}>
            <span style={{ color: 'var(--text-muted)' }}>SIMULATION TIME: </span>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
              {((snapshot?.timeMs ?? 0) / 1000).toFixed(1)} s
            </span>
          </div>
          {faults.length > 0 && (
            <div className="industrial-card" style={{ padding: '4px 10px', fontSize: 11, background: '#fee2e2', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={13} color="#dc2626" />
              <span style={{ color: '#b91c1c', fontWeight: 700 }}>{faults.length} FAULT CONDITION(S) ACTIVE</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
