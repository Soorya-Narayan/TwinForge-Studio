/**
 * TwinForge Studio - Milk Pasteurizer 10 KLPH Process Mimic
 * High-Clarity Industrial P&ID SCADA Mimic.
 * Precision orthogonal pipe routing with zero disconnected lines,
 * standard two-way opposing-triangle valve symbols, and external legend.
 */

import React from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import {
  Play,
  Pause,
  RotateCcw,
  Layers,
} from 'lucide-react';

export const PasteurizerMimic: React.FC = () => {
  const snapshot = useSimulationStore((s) => s.snapshot);
  const running = useSimulationStore((s) => s.running);
  const speed = useSimulationStore((s) => s.speed);
  const start = useSimulationStore((s) => s.start);
  const pause = useSimulationStore((s) => s.pause);
  const reset = useSimulationStore((s) => s.reset);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const injectFault = useSimulationStore((s) => s.injectFault);
  const clearFaults = useSimulationStore((s) => s.clearFaults);
  const faults = useSimulationStore((s) => s.faults);

  // Extract simulated devices
  const balTank = snapshot?.devices['TK-BALANCE'];
  const prodTank = snapshot?.devices['TK-PRODUCT'];
  const pFeed = snapshot?.devices['P-FEED'];
  const pBoost = snapshot?.devices['P-BOOSTER'];
  const pHw = snapshot?.devices['P-HOTWATER'];

  // Valves
  const pv1 = snapshot?.devices['PV-1'];
  const pv2 = snapshot?.devices['PV-2'];
  const pv4 = snapshot?.devices['PV-4'];
  const pv5 = snapshot?.devices['PV-5'];
  const pv8 = snapshot?.devices['PV-8'];
  const pv10 = snapshot?.devices['PV-10'];
  const pv11 = snapshot?.devices['PV-11'];
  const pv12 = snapshot?.devices['PV-12'];
  const scv1 = snapshot?.devices['SCV-1'];

  // Sensor tags
  const tags = snapshot?.tags.inputs ?? {};
  const tt1 = Number(tags['TT1'] ?? 4.0);
  const tt5 = Number(tags['TT5'] ?? 90.0);
  const tt6 = Number(tags['TT6'] ?? 95.0);

  const pt1 = Number(tags['PT1'] ?? 0.25);
  const pt2 = Number(tags['PT2'] ?? 2.5);
  const pt3 = Number(tags['PT3'] ?? 180.0);
  const pt4 = Number(tags['PT4'] ?? 4.1);
  const fmFlowLph = Number(tags['FM'] ?? (pFeed?.speedPct ? (pFeed.speedPct / 100) * 10000 : 0));
  const balLevel = Number(tags['LT1'] ?? balTank?.levelPct ?? 75);
  const isLs1Tripped = balLevel < 15;
  const isLs2High = balLevel > 95;

  // Interlock statuses
  const isAtLegalTemp = tt5 >= 88.0;
  const isForwardFlow = isAtLegalTemp && Boolean(pv11?.isOpen ?? true);
  const isDiverted = !isForwardFlow && (pFeed?.speedPct ?? 0) > 0;
  const dpSafe = pt4 - pt2 >= 0.5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingBottom: 20 }}>
      {/* 1. SCADA Operator Control Toolbar */}
      <div
        className="industrial-card"
        style={{
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
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

        {/* Real-time Status Banners */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Diversion Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#f8fafc',
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
              fontSize: 11,
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>FLOW DIVERSION:</span>
            <span
              className={`badge ${isForwardFlow ? 'badge-success' : isDiverted ? 'badge-danger' : 'badge-neutral'}`}
              style={{ fontWeight: 800 }}
            >
              {isForwardFlow ? 'PV11 FORWARD (LEGAL)' : isDiverted ? 'PV12 DIVERTED TO BALANCE' : 'STANDBY'}
            </span>
          </div>

          {/* Holding Tube TT5 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#f8fafc',
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
              fontSize: 11,
            }}
          >
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#f8fafc',
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
              fontSize: 11,
            }}
          >
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

      {/* 2. Main High-Clarity Process Mimic (100% Connected Lines) */}
      <div
        className="industrial-card"
        style={{
          padding: '16px 20px',
          position: 'relative',
          background: '#ffffff',
          borderRadius: 8,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <svg viewBox="0 0 1200 560" style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
          <defs>
            <pattern id="cleanGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f8fafc" strokeWidth="1" />
            </pattern>

            <linearGradient id="milkLevelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e0f2fe" />
            </linearGradient>

            <linearGradient id="productLevelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f0fdf4" />
              <stop offset="100%" stopColor="#bbf7d0" />
            </linearGradient>
          </defs>

          <rect width="1200" height="560" fill="url(#cleanGrid)" />

          {/* ============================================================== */}
          {/* ZONE 1: RAW INFEED & BALANCE TANK (Left: X = 40..220)          */}
          {/* ============================================================== */}
          {/* Raw Milk Infeed Line (passes through PV1, turns down directly into Balance Tank) */}
          <path d="M 40 160 L 130 160 L 130 240" fill="none" stroke="#0284c7" strokeWidth="4" />
          <text x="40" y="148" fill="#0284c7" fontSize="10" fontWeight="bold">
            RAW MILK INLET (Ø 51mm)
          </text>
          {/* Valve PV1 (horizontal opposing triangles centered on pipe at x=85, y=160) */}
          <g transform="translate(85, 160)">
            <polygon points="-12,-8 0,0 -12,8" fill={pv1?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.5" />
            <polygon points="12,-8 0,0 12,8" fill={pv1?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.5" />
            <line x1="0" y1="0" x2="0" y2="-9" stroke="#334155" strokeWidth="1.5" />
            <rect x="-6" y="-14" width="12" height="5" rx="1" fill="#64748b" stroke="#334155" strokeWidth="1" />
            <text x="0" y="20" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
              PV1
            </text>
          </g>

          {/* Water Infeed Line (passes through PV2, turns down directly into Balance Tank) */}
          <path d="M 40 200 L 110 200 L 110 240" fill="none" stroke="#38bdf8" strokeWidth="3" />
          <text x="40" y="190" fill="#0284c7" fontSize="9">
            WATER INLET
          </text>
          {/* Valve PV2 (horizontal opposing triangles centered on pipe at x=75, y=200) */}
          <g transform="translate(75, 200)">
            <polygon points="-10,-7 0,0 -10,7" fill={pv2?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <polygon points="10,-7 0,0 10,7" fill={pv2?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <line x1="0" y1="0" x2="0" y2="-8" stroke="#334155" strokeWidth="1.2" />
            <rect x="-5" y="-12" width="10" height="4" rx="1" fill="#64748b" stroke="#334155" strokeWidth="1" />
            <text x="0" y="18" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold">
              PV2
            </text>
          </g>

          {/* Diverted Recirculation Line (enters top of Balance Tank at x=150, y=240) */}
          <path
            d="M 950 195 L 950 220 L 150 220 L 150 240"
            fill="none"
            stroke={isDiverted ? '#dc2626' : '#cbd5e1'}
            strokeWidth="3.5"
            strokeDasharray={isDiverted ? '6 3' : 'none'}
          />
          <text x="560" y="214" fill="#dc2626" fontSize="9" fontWeight="bold">
            RECIRCULATION LINE TO BALANCE TANK (LEGAL DIVERT)
          </text>

          {/* Balance Tank Vessel (x=90, y=240, width=80, height=120) */}
          <g transform="translate(90, 240)">
            <rect x="0" y="0" width="80" height="120" rx="4" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            <rect
              x="2"
              y={118 - (116 * balLevel) / 100}
              width="76"
              height={(116 * balLevel) / 100}
              fill="url(#milkLevelGrad)"
              stroke="#bae6fd"
            />
            <text x="40" y="-8" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="800">
              BALANCE TANK
            </text>
            <text x="40" y="55" textAnchor="middle" fill="#0369a1" fontSize="15" fontWeight="900" className="mono">
              {balLevel.toFixed(0)} %
            </text>
            <text x="40" y="75" textAnchor="middle" fill="#64748b" fontSize="9" className="mono">
              LT1: {balLevel.toFixed(1)}%
            </text>

            {/* Level Switches LS1 & LS2 */}
            <circle cx="86" cy="18" r="5" fill={isLs2High ? '#dc2626' : '#94a3b8'} stroke="#334155" />
            <text x="96" y="22" fill="#64748b" fontSize="8">
              LS2 (High)
            </text>
            <circle cx="86" cy="100" r="5" fill={isLs1Tripped ? '#dc2626' : '#22c55e'} stroke="#334155" />
            <text x="96" y="104" fill="#64748b" fontSize="8">
              LS1 (Low)
            </text>
          </g>

          {/* Suction Line: Leaves bottom of tank at (130, 360) -> Filter -> NRV -> Feed Pump */}
          <path d="M 130 360 L 130 420 L 254 420" fill="none" stroke="#0284c7" strokeWidth="4" />

          {/* TT1 & PT1 at Tank Suction */}
          <g transform="translate(145, 400)">
            <circle cx="8" cy="8" r="8" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
            <text x="8" y="11" textAnchor="middle" fill="#0284c7" fontSize="7" fontWeight="bold">
              TT1
            </text>
            <text x="8" y="-3" textAnchor="middle" fill="#475569" fontSize="8" className="mono">
              {tt1.toFixed(1)}°C
            </text>
          </g>
          <g transform="translate(170, 432)">
            <circle cx="8" cy="8" r="8" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
            <text x="8" y="11" textAnchor="middle" fill="#0284c7" fontSize="7" fontWeight="bold">
              PT1
            </text>
            <text x="8" y="24" textAnchor="middle" fill="#475569" fontSize="8" className="mono">
              {pt1.toFixed(2)}b
            </text>
          </g>

          {/* Pipe Filter (Pipe passes right through) */}
          <g transform="translate(195, 410)">
            <rect x="0" y="0" width="20" height="20" fill="#f1f5f9" stroke="#334155" strokeWidth="1.2" />
            <line x1="3" y1="3" x2="17" y2="17" stroke="#64748b" />
            <line x1="17" y1="3" x2="3" y2="17" stroke="#64748b" />
            <text x="10" y="32" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="bold">
              FILTER
            </text>
          </g>

          {/* Check Valve (NRV) */}
          <g transform="translate(225, 412)">
            <polygon points="0,0 16,8 0,16" fill="#ffffff" stroke="#334155" strokeWidth="1.2" />
            <line x1="16" y1="0" x2="16" y2="16" stroke="#334155" strokeWidth="1.5" />
            <text x="8" y="30" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="bold">
              NRV
            </text>
          </g>

          {/* Milk Feed Pump (5 HP VFD) (Suction enters at x=254, discharge leaves at x=286) */}
          <g transform="translate(270, 420)">
            <circle cx="0" cy="0" r="16" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            <polygon points="0,-10 10,0 0,10" fill={(pFeed?.speedPct ?? 0) > 0 ? '#0284c7' : '#94a3b8'} />
            <text x="0" y="28" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
              FEED PUMP
            </text>
            <text x="0" y="40" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold" className="mono">
              {(pFeed?.speedPct ?? 0).toFixed(0)}% VFD
            </text>
          </g>

          {/* Feed Pump Discharge -> Flowmeter FM -> Rises into REG-01 */}
          <path d="M 286 420 L 350 420 L 350 270 L 410 270" fill="none" stroke="#0284c7" strokeWidth="4" />
          <g transform="translate(315, 405)">
            <circle cx="9" cy="9" r="9" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
            <text x="9" y="12" textAnchor="middle" fill="#0284c7" fontSize="7" fontWeight="bold">
              FM
            </text>
            <text x="9" y="-4" textAnchor="middle" fill="#0369a1" fontSize="8" fontWeight="bold" className="mono">
              {fmFlowLph} LPH
            </text>
          </g>
          <g transform="translate(315, 435)">
            <circle cx="9" cy="9" r="9" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
            <text x="9" y="12" textAnchor="middle" fill="#0284c7" fontSize="7" fontWeight="bold">
              PT2
            </text>
            <text x="9" y="28" textAnchor="middle" fill="#475569" fontSize="8" className="mono">
              {pt2.toFixed(2)}b
            </text>
          </g>

          {/* ============================================================== */}
          {/* ZONE 2: 4-SECTION PLATE HEAT EXCHANGER (Center: X = 410..770)  */}
          {/* ============================================================== */}
          <g transform="translate(410, 140)">
            <rect x="0" y="0" width="360" height="150" rx="4" fill="#ffffff" stroke="#1e293b" strokeWidth="2" />

            {/* Section 1: Chilling */}
            <rect x="6" y="6" width="80" height="138" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.2" />
            <text x="46" y="24" textAnchor="middle" fill="#15803d" fontSize="10" fontWeight="800">
              CHILLING
            </text>
            <text x="46" y="75" textAnchor="middle" fill="#15803d" fontSize="15" fontWeight="900" className="mono">
              4.0 °C
            </text>
            <text x="46" y="125" textAnchor="middle" fill="#64748b" fontSize="8">
              PHE-CHILL
            </text>

            {/* Section 2: REG-01 */}
            <rect x="94" y="6" width="80" height="138" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
            <text x="134" y="24" textAnchor="middle" fill="#334155" fontSize="10" fontWeight="800">
              REG-01
            </text>
            <text x="134" y="75" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="700" className="mono">
              28° - 45°C
            </text>
            <text x="134" y="125" textAnchor="middle" fill="#64748b" fontSize="8">
              PHE-REG01
            </text>

            {/* Section 3: REG-02 */}
            <rect x="182" y="6" width="80" height="138" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
            <text x="222" y="24" textAnchor="middle" fill="#334155" fontSize="10" fontWeight="800">
              REG-02
            </text>
            <text x="222" y="75" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="700" className="mono">
              65° - 70°C
            </text>
            <text x="222" y="125" textAnchor="middle" fill="#64748b" fontSize="8">
              PHE-REG02
            </text>

            {/* Section 4: Heating */}
            <rect x="270" y="6" width="84" height="138" fill="#fffbeb" stroke="#fde68a" strokeWidth="1.2" />
            <text x="312" y="24" textAnchor="middle" fill="#b45309" fontSize="10" fontWeight="800">
              HEATING
            </text>
            <text x="312" y="75" textAnchor="middle" fill="#b45309" fontSize="15" fontWeight="900" className="mono">
              90.0 °C
            </text>
            <text x="312" y="125" textAnchor="middle" fill="#64748b" fontSize="8">
              PHE-HEAT
            </text>

            <text x="180" y="-8" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="900">
              PLATE HEAT EXCHANGER (10 KLPH 4-SECTION)
            </text>
          </g>

          {/* ============================================================== */}
          {/* ZONE 3: SEPARATOR & HOMOGENIZER (Below PHE: Y = 290..480)      */}
          {/* ============================================================== */}
          {/* Pipe from bottom of REG-01 (x=545, y=290) -> PV4 -> Cream Separator */}
          <path d="M 545 290 L 545 420" fill="none" stroke="#0284c7" strokeWidth="3" />
          
          {/* Valve PV4 (vertical opposing triangles centered on pipe at x=545, y=345) */}
          <g transform="translate(545, 345)">
            <polygon points="-8,-10 0,0 8,-10" fill={pv4?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <polygon points="-8,10 0,0 8,10" fill={pv4?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <line x1="0" y1="0" x2="8" y2="0" stroke="#334155" strokeWidth="1.2" />
            <rect x="8" y="-5" width="4" height="10" rx="1" fill="#64748b" stroke="#334155" strokeWidth="1" />
            <text x="-12" y="4" textAnchor="end" fill="#0f172a" fontSize="8" fontWeight="bold">
              PV4
            </text>
          </g>

          {/* Cream Separator Vessel */}
          <g transform="translate(505, 420)">
            <polygon points="10,0 70,0 55,50 25,50" fill="#f8fafc" stroke="#334155" strokeWidth="1.8" />
            <circle cx="40" cy="18" r="10" fill="#e2e8f0" stroke="#475569" strokeWidth="1.2" />
            <text x="40" y="22" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold">
              SEP
            </text>
            <text x="40" y="65" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">
              CREAM SEPARATOR
            </text>
          </g>

          {/* Skim return line from Separator (x=570, y=445) -> PV5 -> bottom of REG-02 (x=610, y=290) */}
          <path d="M 560 445 L 610 445 L 610 290" fill="none" stroke="#0284c7" strokeWidth="3" />
          
          {/* Valve PV5 (vertical opposing triangles centered on pipe at x=610, y=345) */}
          <g transform="translate(610, 345)">
            <polygon points="-8,-10 0,0 8,-10" fill={pv5?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <polygon points="-8,10 0,0 8,10" fill={pv5?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <line x1="0" y1="0" x2="8" y2="0" stroke="#334155" strokeWidth="1.2" />
            <rect x="8" y="-5" width="4" height="10" rx="1" fill="#64748b" stroke="#334155" strokeWidth="1" />
            <text x="18" y="4" textAnchor="start" fill="#0f172a" fontSize="8" fontWeight="bold">
              PV5
            </text>
          </g>

          {/* Pipe from bottom of REG-02 (x=655, y=290) -> PV8 -> Homogenizer */}
          <path d="M 655 290 L 655 420" fill="none" stroke="#0284c7" strokeWidth="3" />

          {/* Valve PV8 (vertical opposing triangles centered on pipe at x=655, y=345) */}
          <g transform="translate(655, 345)">
            <polygon points="-8,-10 0,0 8,-10" fill={pv8?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <polygon points="-8,10 0,0 8,10" fill={pv8?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <line x1="0" y1="0" x2="8" y2="0" stroke="#334155" strokeWidth="1.2" />
            <rect x="8" y="-5" width="4" height="10" rx="1" fill="#64748b" stroke="#334155" strokeWidth="1" />
            <text x="18" y="4" textAnchor="start" fill="#0f172a" fontSize="8" fontWeight="bold">
              PV8
            </text>
          </g>

          {/* Homogenizer Vessel */}
          <g transform="translate(620, 420)">
            <rect x="0" y="0" width="70" height="50" rx="3" fill="#f8fafc" stroke="#334155" strokeWidth="1.8" />
            <text x="35" y="18" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
              HOMOGENIZER
            </text>
            <text x="35" y="32" textAnchor="middle" fill="#0284c7" fontSize="9" fontWeight="bold" className="mono">
              200 BAR
            </text>
            <text x="35" y="44" textAnchor="middle" fill="#15803d" fontSize="7" fontWeight="bold">
              SEAL WATER OK
            </text>
          </g>

          {/* Pipe from Homogenizer (x=690, y=445) to Booster Pump (x=730, y=445) */}
          <path d="M 690 445 L 715 445" fill="none" stroke="#0284c7" strokeWidth="3" />

          {/* Booster Pump (5 HP VFD) (Suction at x=715, discharge at x=745) */}
          <g transform="translate(730, 445)">
            <circle cx="0" cy="0" r="15" fill="#f8fafc" stroke="#334155" strokeWidth="1.8" />
            <polygon points="0,-9 9,0 0,9" fill={(pBoost?.speedPct ?? 0) > 0 ? '#0284c7' : '#94a3b8'} />
            <text x="0" y="26" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
              BOOSTER
            </text>
            <text x="0" y="38" textAnchor="middle" fill="#059669" fontSize="8" className="mono">
              PT4: {pt4.toFixed(2)}b
            </text>
          </g>

          {/* Booster Pump Discharge -> Rises straight UP into HEATING Section (x=725, y=290) */}
          <path d="M 745 445 L 755 445 L 755 330 L 725 330 L 725 290" fill="none" stroke="#0284c7" strokeWidth="3" />

          {/* ============================================================== */}
          {/* ZONE 4: HOT WATER SKID & STEAM LINE (Top: X = 600..770, Y = 25)*/}
          {/* ============================================================== */}
          <g transform="translate(630, 25)">
            <rect x="0" y="0" width="130" height="65" rx="4" fill="#fffbeb" stroke="#fde68a" strokeWidth="1.2" />
            <text x="65" y="16" textAnchor="middle" fill="#b45309" fontSize="10" fontWeight="bold">
              HOT WATER SKID
            </text>
            <text x="65" y="32" textAnchor="middle" fill="#64748b" fontSize="8">
              Steam Heater
            </text>
            <text x="65" y="54" textAnchor="middle" fill="#b45309" fontSize="12" fontWeight="bold" className="mono">
              TT6: {tt6.toFixed(1)} °C
            </text>
          </g>

          {/* Steam supply line: (x=530, y=55) -> SCV1 -> enters Hot Water Skid at (x=630, y=55) */}
          <path d="M 530 55 L 630 55" fill="none" stroke="#d97706" strokeWidth="3" />
          <text x="530" y="46" fill="#d97706" fontSize="9" fontWeight="bold">
            STEAM 1.5"
          </text>
          {/* SCV1 Modulating Valve (horizontal opposing triangles centered on pipe at x=580, y=55) */}
          <g transform="translate(580, 55)">
            <polygon points="-10,-7 0,0 -10,7" fill={scv1?.positionPct ? '#fed7aa' : '#fee2e2'} stroke="#b45309" strokeWidth="1.2" />
            <polygon points="10,-7 0,0 10,7" fill={scv1?.positionPct ? '#fed7aa' : '#fee2e2'} stroke="#b45309" strokeWidth="1.2" />
            <line x1="0" y1="0" x2="0" y2="-8" stroke="#b45309" strokeWidth="1.2" />
            <rect x="-5" y="-12" width="10" height="4" rx="1" fill="#64748b" stroke="#b45309" strokeWidth="1" />
            <text x="0" y="18" textAnchor="middle" fill="#b45309" fontSize="8" fontWeight="bold">
              SCV1
            </text>
          </g>

          {/* Hot Water Circulation: leaves skid at (760, 55) -> P-HW -> enters HEATING section */}
          <path d="M 760 55 L 780 55" fill="none" stroke="#f97316" strokeWidth="3" />
          <g transform="translate(792, 55)">
            <circle cx="0" cy="0" r="12" fill="#f8fafc" stroke="#334155" strokeWidth="1.2" />
            <polygon points="0,-7 7,0 0,7" fill={(pHw?.speedPct ?? 0) > 0 ? '#f97316' : '#94a3b8'} />
            <text x="0" y="24" textAnchor="middle" fill="#b45309" fontSize="8" fontWeight="bold">
              P-HW
            </text>
          </g>
          <path d="M 804 55 L 820 55 L 820 180 L 770 180" fill="none" stroke="#f97316" strokeWidth="3" />

          {/* ============================================================== */}
          {/* ZONE 5: HOLDING TUBE & LEGAL DIVERSION (Right: X = 770..980)   */}
          {/* ============================================================== */}
          {/* Milk leaves HEATING section at (x=770, y=150) -> Holding Coil */}
          <path d="M 770 150 L 820 150" fill="none" stroke="#d97706" strokeWidth="4" />

          {/* Holding Coil (20s) */}
          <g transform="translate(820, 150)">
            <path d="M 0 0 Q 15 -15 30 0 Q 45 15 60 0 Q 75 -15 90 0" fill="none" stroke="#0f766e" strokeWidth="4" />
            <text x="45" y="-18" textAnchor="middle" fill="#0f766e" fontSize="9" fontWeight="bold">
              HOLDING COIL (20s)
            </text>
          </g>

          {/* Pipe from Holding Coil to Tee junction: (x=910, y=150) to (x=950, y=150) */}
          <path d="M 910 150 L 950 150" fill="none" stroke="#d97706" strokeWidth="4" />
          
          {/* TT5 Sensor (Directly on line at x=925, y=150) */}
          <g transform="translate(925, 150)">
            <circle cx="0" cy="0" r="10" fill={isAtLegalTemp ? '#dcfce7' : '#fee2e2'} stroke={isAtLegalTemp ? '#059669' : '#dc2626'} strokeWidth="2" />
            <text x="0" y="3" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="bold">
              TT5
            </text>
            <text x="0" y="-14" textAnchor="middle" fill={isAtLegalTemp ? '#059669' : '#dc2626'} fontSize="9" fontWeight="bold" className="mono">
              {tt5.toFixed(1)}°C
            </text>
          </g>

          {/* Forward Flow Line through PV11 to Silo: (x=950, y=150) -> PV11 -> Silo */}
          <path d="M 950 150 L 1060 150 L 1060 240" fill="none" stroke={isForwardFlow ? '#059669' : '#cbd5e1'} strokeWidth="4" />
          <text x="1005" y="138" textAnchor="middle" fill="#059669" fontSize="9" fontWeight="bold">
            PASTEURIZED MILK
          </text>
          
          {/* Valve PV11 (horizontal opposing triangles centered on pipe at x=980, y=150) */}
          <g transform="translate(980, 150)">
            <polygon points="-12,-8 0,0 -12,8" fill={isForwardFlow ? '#dcfce7' : '#fee2e2'} stroke={isForwardFlow ? '#059669' : '#dc2626'} strokeWidth="1.5" />
            <polygon points="12,-8 0,0 12,8" fill={isForwardFlow ? '#dcfce7' : '#fee2e2'} stroke={isForwardFlow ? '#059669' : '#dc2626'} strokeWidth="1.5" />
            <line x1="0" y1="0" x2="0" y2="-9" stroke="#334155" strokeWidth="1.5" />
            <rect x="-6" y="-14" width="12" height="5" rx="1" fill="#64748b" stroke="#334155" strokeWidth="1" />
            <text x="0" y="22" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold">
              PV11 (FWD)
            </text>
          </g>

          {/* Divert Flow Line from Tee junction down through PV12: (x=950, y=150) to (x=950, y=195) */}
          <path d="M 950 150 L 950 195" fill="none" stroke={isDiverted ? '#dc2626' : '#cbd5e1'} strokeWidth="3.5" />

          {/* Valve PV12 (vertical opposing triangles centered on pipe at x=950, y=180) */}
          <g transform="translate(950, 180)">
            <polygon points="-8,-10 0,0 8,-10" fill={pv12?.isOpen ?? isDiverted ? '#fee2e2' : '#f8fafc'} stroke={pv12?.isOpen ?? isDiverted ? '#dc2626' : '#94a3b8'} strokeWidth="1.5" />
            <polygon points="-8,10 0,0 8,10" fill={pv12?.isOpen ?? isDiverted ? '#fee2e2' : '#f8fafc'} stroke={pv12?.isOpen ?? isDiverted ? '#dc2626' : '#94a3b8'} strokeWidth="1.5" />
            <line x1="0" y1="0" x2="9" y2="0" stroke="#334155" strokeWidth="1.5" />
            <rect x="9" y="-5" width="4" height="10" rx="1" fill="#64748b" stroke="#334155" strokeWidth="1" />
            <text x="-12" y="3" textAnchor="end" fill="#dc2626" fontSize="8" fontWeight="bold">
              PV12 (DIVERT)
            </text>
          </g>

          {/* ============================================================== */}
          {/* ZONE 6: STORAGE SILO (Far Right: X = 1020..1110)               */}
          {/* ============================================================== */}
          <g transform="translate(1020, 240)">
            <rect x="0" y="0" width="80" height="130" rx="4" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            <rect
              x="2"
              y={128 - (126 * (prodTank?.levelPct ?? 15)) / 100}
              width="76"
              height={(126 * (prodTank?.levelPct ?? 15)) / 100}
              fill="url(#productLevelGrad)"
              stroke="#bbf7d0"
            />
            <text x="40" y="-8" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="800">
              STORAGE SILO
            </text>
            <text x="40" y="60" textAnchor="middle" fill="#15803d" fontSize="15" fontWeight="900" className="mono">
              {(prodTank?.levelPct ?? 15).toFixed(0)} %
            </text>
            <text x="40" y="80" textAnchor="middle" fill="#64748b" fontSize="9">
              PRODUCT OUT
            </text>
          </g>

          {/* ============================================================== */}
          {/* ZONE 7: CHILLED WATER SUPPLY (X = 330..450, Y = 100)           */}
          {/* ============================================================== */}
          <path d="M 330 100 L 450 100 L 450 140" fill="none" stroke="#0284c7" strokeWidth="3" />
          <text x="330" y="90" fill="#0284c7" fontSize="9" fontWeight="bold">
            CHILLED WATER (Ø 63mm)
          </text>
          {/* Valve PV10 (horizontal opposing triangles centered on pipe at x=380, y=100) */}
          <g transform="translate(380, 100)">
            <polygon points="-10,-7 0,0 -10,7" fill={pv10?.positionPct ? '#dcfce7' : '#fee2e2'} stroke="#0284c7" strokeWidth="1.2" />
            <polygon points="10,-7 0,0 10,7" fill={pv10?.positionPct ? '#dcfce7' : '#fee2e2'} stroke="#0284c7" strokeWidth="1.2" />
            <line x1="0" y1="0" x2="0" y2="-8" stroke="#0284c7" strokeWidth="1.2" />
            <rect x="-5" y="-12" width="10" height="4" rx="1" fill="#64748b" stroke="#0284c7" strokeWidth="1" />
            <text x="0" y="18" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold">
              PV10
            </text>
          </g>
        </svg>

        {/* Live Process Telemetry Strip */}
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 14px',
            background: '#f8fafc',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>FEED FLOW: </span>
              <strong className="mono" style={{ color: '#0369a1' }}>
                {fmFlowLph} LPH
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>BALANCE TANK: </span>
              <strong className="mono" style={{ color: '#0f172a' }}>
                {balLevel.toFixed(1)}%
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>HOMOGENIZER: </span>
              <strong className="mono" style={{ color: '#0f766e' }}>
                {pt3.toFixed(0)} BAR
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>HOT WATER: </span>
              <strong className="mono" style={{ color: '#b45309' }}>
                {tt6.toFixed(1)}°C
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>PRODUCT OUT: </span>
              <strong className="mono" style={{ color: '#15803d' }}>
                4.0°C (LEGAL)
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: '#dcfce7',
                color: '#15803d',
              }}
            >
              SANITARY PROCESS TOPOLOGY · 10 KLPH HTST
            </span>
          </div>
        </div>
      </div>

      {/* 3. Dedicated Process Legend & Component Guide (OUTSIDE the Template) */}
      <div
        className="industrial-card"
        style={{
          padding: '16px 20px',
          borderRadius: 8,
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Layers size={16} color="var(--color-primary)" />
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Process Schematic Legend & Component Directory
          </h4>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          {/* Column 1: Pipelines & Streams */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
              Pipelines & Flow Streams
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 4, background: '#0284c7', borderRadius: 2 }} />
                <span><strong>Raw / Process Milk (Ø 51 mm)</strong>: Main process stream</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 4, background: '#059669', borderRadius: 2 }} />
                <span><strong>Pasteurized Legal Product</strong>: Forward flow to Silo (4.0°C)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 3, borderTop: '3px dashed #dc2626' }} />
                <span><strong>Recirculation Divert Line</strong>: Under-temp return to Balance Tank</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 4, background: '#d97706', borderRadius: 2 }} />
                <span><strong>Heating & Steam Circuit</strong>: 1.5" Steam / 95°C Hot Water loop</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 4, background: '#38bdf8', borderRadius: 2 }} />
                <span><strong>Chilled Water & Utilities</strong>: Ø 63 mm Cooling supply (4°C)</span>
              </div>
            </div>
          </div>

          {/* Column 2: Major Equipment */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
              Major Processing Units
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              <div><strong>Balance Tank</strong>: 600L raw infeed float buffer vessel</div>
              <div><strong>PHE (Plate Heat Exchanger)</strong>: 4-stage thermal recovery & heating block</div>
              <div><strong>Cream Separator</strong>: Centrifugal whole-milk fractionator (10,000 LPH)</div>
              <div><strong>Homogenizer</strong>: 2-stage high-shear particle breaker (200 bar)</div>
              <div><strong>Holding Coil</strong>: 20-second sanitary residence tube for pathogen elimination</div>
              <div><strong>Storage Silo</strong>: Finished pasteurized milk buffer reservoir</div>
            </div>
          </div>

          {/* Column 3: Actuators & Valves */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
              Valves & Actuation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              <div><strong>PV1 / PV2</strong>: Raw milk infeed & CIP flush valves</div>
              <div><strong>PV4 / PV5</strong>: Cream separator feed & skim return</div>
              <div><strong>PV8</strong>: Homogenizer infeed isolation valve</div>
              <div><strong>PV10</strong>: Chilled water modulating cooling regulator</div>
              <div><strong>PV11 (Forward)</strong>: Legal pasteurization product forward valve</div>
              <div><strong>PV12 (Divert)</strong>: Safety diversion valve routing to Balance Tank</div>
              <div><strong>SCV1</strong>: Modulating steam valve controlling hot water temperature</div>
            </div>
          </div>

          {/* Column 4: Process Sensors & Transmitters */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
              Sensors & Safety Transmitters
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              <div><strong className="mono">TT1..TT9</strong>: Process temperature transmitters (Holding: TT5)</div>
              <div><strong className="mono">PT1..PT7</strong>: Process pressure transmitters (Homogenizer: PT3)</div>
              <div><strong className="mono">LT1</strong>: Balance tank hydrostatic continuous level sensor</div>
              <div><strong className="mono">LS1 / LS2</strong>: Dry-run pump cutoff (LS1) & overfill trip (LS2)</div>
              <div><strong className="mono">FM</strong>: Electromagnetic in-line flow meter (0–12,000 LPH)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
