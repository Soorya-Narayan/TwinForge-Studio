/**
 * TwinForge Studio - Milk Pasteurizer 10 KLPH Process Mimic
 * Directly mirrors Goose Industrial Solutions P&ID: GP-LACTALIS, BHOPAL-PID-PSTRZ-001 (Rev 0)
 * Client: LACTALIS, BHOPAL
 */

import React from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Play, Pause, RotateCcw, ShieldAlert } from 'lucide-react';

export const PasteurizerMimic: React.FC = () => {
  const snapshot = useSimulationStore((s) => s.snapshot);
  const running = useSimulationStore((s) => s.running);
  const speed = useSimulationStore((s) => s.speed);
  const start = useSimulationStore((s) => s.start);
  const pause = useSimulationStore((s) => s.pause);
  const reset = useSimulationStore((s) => s.reset);
  const setSpeed = useSimulationStore((s) => s.setSpeed);

  // Live readings from simulation
  const balTank = snapshot?.devices['TK-BALANCE'];
  const prodTank = snapshot?.devices['TK-PRODUCT'];
  const feedPump = snapshot?.devices['P-FEED'];
  const hxHeat = snapshot?.devices['PHE-HEATING'];
  const pv11 = snapshot?.devices['PV-11'];

  const holdingTemp = hxHeat?.temperatureC ?? 20.0;
  const isForwardLegal = holdingTemp >= 88.0 && Boolean(pv11?.isOpen);
  const isDiverted = !isForwardLegal && (feedPump?.speedPct ?? 0) > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Control Station Bar */}
      <div className="industrial-card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={running ? pause : start} className={`btn ${running ? 'btn-ghost' : 'btn-primary'}`}>
            {running ? <Pause size={14} /> : <Play size={14} />}
            {running ? 'PAUSE' : 'RUN SIMULATION'}
          </button>
          <button onClick={reset} className="btn btn-ghost" title="Reset state">
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

        {/* Pasteurizer Status Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>FLOW DIVERSION STATUS:</span>
            <span className={`badge ${isForwardLegal ? 'badge-success' : isDiverted ? 'badge-danger' : 'badge-neutral'}`}>
              {isForwardLegal ? 'FORWARD TO PRODUCT' : isDiverted ? 'DIVERTED TO BALANCE TANK' : 'STANDBY'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>HOLDING TUBE (TT3):</span>
            <span className="mono" style={{ fontWeight: 800, fontSize: 13, color: holdingTemp >= 88 ? '#059669' : '#dc2626' }}>
              {holdingTemp.toFixed(1)} °C
            </span>
          </div>
        </div>
      </div>

      {/* SVG Industrial P&ID Schematic Canvas */}
      <div className="industrial-card" style={{ flex: 1, padding: 16, position: 'relative', overflow: 'hidden', background: '#ffffff' }}>
        <svg viewBox="0 0 1020 520" style={{ width: '100%', height: '100%', userSelect: 'none' }}>
          <defs>
            <pattern id="pstrzGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <rect width="40" height="40" fill="none" />
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" strokeWidth="1" />
            </pattern>
          </defs>

          <rect width="1020" height="520" fill="url(#pstrzGrid)" />

          {/* Title Header Block */}
          <g transform="translate(30, 25)">
            <text x="0" y="0" fill="#0f172a" fontSize="15" fontWeight="900" letterSpacing="-0.01em">
              MILK PASTEURIZER 10 KLPH · P&ID
            </text>
            <text x="0" y="16" fill="#64748b" fontSize="10">
              Drawing: GP-LACTALIS, BHOPAL-PID-PSTRZ-001 · Goose Industrial Solutions
            </text>
          </g>

          {/* PIPE ROUTING */}
          {/* Raw Milk Feed Line (Balance Tank -> Feed Pump -> Reg 1 -> Reg 2 -> Heating) */}
          <path
            d="M 120 370 L 170 370 L 230 370 L 230 250 L 320 250"
            fill="none"
            stroke={(feedPump?.speedPct ?? 0) > 0 ? '#0284c7' : '#94a3b8'}
            strokeWidth="5"
            strokeLinecap="square"
          />

          {/* Forward Flow Line (Heating Section -> Holding Coil -> FDV PV-11) */}
          <path
            d="M 460 210 L 520 210 L 520 160 L 610 160"
            fill="none"
            stroke={holdingTemp >= 88 ? '#059669' : '#d97706'}
            strokeWidth="5"
            strokeLinecap="square"
          />

          {/* Legal Diversion Recycle Line (PV-11 -> Recycle Loop -> Balance Tank) */}
          <path
            d="M 640 170 L 640 430 L 100 430 L 100 370"
            fill="none"
            stroke={isDiverted ? '#dc2626' : '#cbd5e1'}
            strokeWidth="4"
            strokeDasharray={isDiverted ? '8 4' : 'none'}
          />

          {/* Forward Pasteurized Line (PV-11 -> Chilling Section -> Product Out) */}
          <path
            d="M 670 160 L 780 160 L 780 250 L 890 250 L 890 310"
            fill="none"
            stroke={isForwardLegal ? '#059669' : '#cbd5e1'}
            strokeWidth="5"
          />

          {/* 1. BALANCE TANK */}
          <g transform="translate(60, 240)">
            <rect x="0" y="0" width="80" height="130" rx="4" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
            <rect
              x="2"
              y={128 - (126 * (balTank?.levelPct ?? 75)) / 100}
              width="76"
              height={(126 * (balTank?.levelPct ?? 75)) / 100}
              fill="#e0f2fe"
              stroke="#bae6fd"
            />
            <text x="40" y="-8" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">
              BALANCE TANK
            </text>
            <text x="40" y="65" textAnchor="middle" fill="#0369a1" fontSize="14" fontWeight="bold" className="mono">
              {(balTank?.levelPct ?? 75).toFixed(0)} %
            </text>
            <text x="40" y="85" textAnchor="middle" fill="#64748b" fontSize="9">
              LT-1 / LS-1
            </text>
          </g>

          {/* 2. MILK FEED PUMP (5 HP VFD) */}
          <g transform="translate(180, 345)">
            <circle cx="20" cy="20" r="18" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
            <polygon points="20,8 32,20 20,32" fill={(feedPump?.speedPct ?? 0) > 0 ? '#0284c7' : '#64748b'} />
            <text x="20" y="-6" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">
              FEED PUMP (5 HP)
            </text>
            <text x="20" y="48" textAnchor="middle" fill="#0284c7" fontSize="9" className="mono">
              {(feedPump?.speedPct ?? 0).toFixed(0)} % VFD
            </text>
          </g>

          {/* 3. 4-SECTION PLATE HEAT EXCHANGER (PHE) */}
          <g transform="translate(320, 160)">
            <rect x="0" y="0" width="220" height="150" rx="4" fill="#ffffff" stroke="#334155" strokeWidth="2" />

            {/* CHILLING SECTION */}
            <rect x="5" y="5" width="45" height="140" fill="#f0fdf4" stroke="#86efac" />
            <text x="27" y="30" textAnchor="middle" fill="#15803d" fontSize="9" fontWeight="bold">
              CHILL
            </text>
            <text x="27" y="75" textAnchor="middle" fill="#15803d" fontSize="12" fontWeight="bold" className="mono">
              4 °C
            </text>

            {/* REG-01 SECTION */}
            <rect x="55" y="5" width="50" height="140" fill="#f8fafc" stroke="#cbd5e1" />
            <text x="80" y="30" textAnchor="middle" fill="#475569" fontSize="9" fontWeight="bold">
              REG-01
            </text>
            <text x="80" y="75" textAnchor="middle" fill="#0f172a" fontSize="11" className="mono">
              28 °C
            </text>

            {/* REG-02 SECTION */}
            <rect x="110" y="5" width="50" height="140" fill="#f8fafc" stroke="#cbd5e1" />
            <text x="135" y="30" textAnchor="middle" fill="#475569" fontSize="9" fontWeight="bold">
              REG-02
            </text>
            <text x="135" y="75" textAnchor="middle" fill="#0f172a" fontSize="11" className="mono">
              70 °C
            </text>

            {/* HEATING SECTION */}
            <rect x="165" y="5" width="50" height="140" fill="#fef3c7" stroke="#fde68a" />
            <text x="190" y="30" textAnchor="middle" fill="#b45309" fontSize="9" fontWeight="bold">
              HEATING
            </text>
            <text x="190" y="75" textAnchor="middle" fill="#b45309" fontSize="13" fontWeight="bold" className="mono">
              {holdingTemp.toFixed(1)} °C
            </text>

            <text x="110" y="-8" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="bold">
              PHE PASTEURIZER (10 KLPH)
            </text>
          </g>

          {/* 4. HOLDING COIL (20 SECONDS) */}
          <g transform="translate(540, 140)">
            {/* Holding Coil Coiling Loops */}
            <path
              d="M 0 20 Q 15 0 30 20 Q 45 40 60 20"
              fill="none"
              stroke="#0f766e"
              strokeWidth="4"
            />
            <text x="30" y="-5" textAnchor="middle" fill="#0f766e" fontSize="10" fontWeight="bold">
              HOLDING COIL (20s)
            </text>
            <rect x="10" y="30" width="40" height="16" fill="#f8fafc" stroke="#cbd5e1" rx="2" />
            <text x="30" y="42" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold" className="mono">
              TT3/TT4
            </text>
          </g>

          {/* 5. FLOW DIVERSION VALVE (FDV - PV-11) */}
          <g transform="translate(630, 140)">
            <path d="M 8 5 L 24 5 L 20 -5 L 12 -5 Z" fill="#64748b" />
            <line x1="16" y1="5" x2="16" y2="18" stroke="#475569" strokeWidth="2" />
            <polygon
              points="6,10 26,30 26,10 6,30"
              fill={isForwardLegal ? '#dcfce7' : '#fee2e2'}
              stroke={isForwardLegal ? '#059669' : '#dc2626'}
              strokeWidth="2"
            />
            <text x="16" y="-10" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">
              FDV (PV-11)
            </text>
            <text x="16" y="45" textAnchor="middle" fill={isForwardLegal ? '#059669' : '#dc2626'} fontSize="9" fontWeight="bold" className="mono">
              {isForwardLegal ? 'FORWARD' : 'DIVERTED'}
            </text>
          </g>

          {/* 6. HOT WATER GENERATION LOOP */}
          <g transform="translate(430, 360)">
            <rect x="0" y="0" width="130" height="85" rx="4" fill="#fffbeb" stroke="#fde68a" strokeWidth="1.5" />
            <text x="65" y="18" textAnchor="middle" fill="#92400e" fontSize="10" fontWeight="bold">
              HOT WATER SKID
            </text>
            <text x="65" y="40" textAnchor="middle" fill="#475569" fontSize="9">
              Steam Valve: SCV-1 (Modulating)
            </text>
            <text x="65" y="58" textAnchor="middle" fill="#475569" fontSize="9">
              Pump: P-HW (3 HP)
            </text>
            <text x="65" y="75" textAnchor="middle" fill="#b45309" fontSize="10" fontWeight="bold" className="mono">
              Loop: 95.0 °C
            </text>
          </g>

          {/* 7. HOMOGENIZER & CREAM SEPARATOR BLOCKS */}
          <g transform="translate(240, 400)">
            <rect x="0" y="0" width="100" height="40" fill="#f8fafc" stroke="#cbd5e1" rx="2" />
            <text x="50" y="16" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
              HOMOGENIZER
            </text>
            <text x="50" y="30" textAnchor="middle" fill="#64748b" fontSize="8" className="mono">
              10,000 LPH · 200 BAR
            </text>
          </g>

          {/* 8. FINISHED PASTEURIZED PRODUCT SILO */}
          <g transform="translate(850, 270)">
            <rect x="0" y="0" width="110" height="160" rx="4" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
            <rect
              x="2"
              y={158 - (156 * (prodTank?.levelPct ?? 10)) / 100}
              width="106"
              height={(156 * (prodTank?.levelPct ?? 10)) / 100}
              fill="#dcfce7"
              stroke="#bbf7d0"
            />
            <rect x="0" y="-18" width="110" height="18" fill="#f1f5f9" stroke="#cbd5e1" />
            <text x="55" y="-5" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">
              SILO (TK-PROD)
            </text>
            <text x="55" y="70" textAnchor="middle" fill="#15803d" fontSize="15" fontWeight="bold" className="mono">
              {(prodTank?.levelPct ?? 10).toFixed(0)} %
            </text>
            <text x="55" y="90" textAnchor="middle" fill="#64748b" fontSize="9">
              FINAL PRODUCT OUT
            </text>
          </g>
        </svg>

        {/* Live Safety Status Banner */}
        <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8 }}>
          <div className="industrial-card" style={{ padding: '4px 10px', fontSize: 11, background: '#f8fafc' }}>
            <span style={{ color: 'var(--text-muted)' }}>REGENERATION EFFICIENCY: </span>
            <span className="mono" style={{ fontWeight: 700, color: '#059669' }}>91.5 %</span>
          </div>
          <div className="industrial-card" style={{ padding: '4px 10px', fontSize: 11, background: '#f8fafc' }}>
            <span style={{ color: 'var(--text-muted)' }}>DIFFERENTIAL PRESSURE: </span>
            <span className="mono" style={{ fontWeight: 700, color: '#0369a1' }}>+0.75 bar (SAFE)</span>
          </div>
          {isDiverted && (
            <div className="industrial-card" style={{ padding: '4px 10px', fontSize: 11, background: '#fee2e2', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={13} color="#dc2626" />
              <span style={{ color: '#b91c1c', fontWeight: 700 }}>PASTEURIZATION LEGAL DIVERT ACTIVE</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
