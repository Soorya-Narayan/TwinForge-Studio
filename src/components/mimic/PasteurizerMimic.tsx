/**
 * TwinForge Studio - Milk Pasteurizer 10 KLPH Process Mimic
 * Standard Continuous HTST Sanitary Thermal Process Template
 */

import React from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import {
  Play,
  Pause,
  RotateCcw,
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
  const pRaw = snapshot?.devices['P-RAW'];

  // Valves
  const pv1 = snapshot?.devices['PV-1'];
  const pv2 = snapshot?.devices['PV-2'];
  const pv4 = snapshot?.devices['PV-4'];
  const pv5 = snapshot?.devices['PV-5'];
  const pv7 = snapshot?.devices['PV-7'];
  const pv8 = snapshot?.devices['PV-8'];
  const pv9 = snapshot?.devices['PV-9'];
  const pv10 = snapshot?.devices['PV-10'];
  const pv11 = snapshot?.devices['PV-11'];
  const pv12 = snapshot?.devices['PV-12'];
  const scv1 = snapshot?.devices['SCV-1'];

  // PLC inputs / transmitter readings
  const tags = snapshot?.tags.inputs ?? {};
  const tt1 = Number(tags['TT1'] ?? 4.0);
  const tt2 = Number(tags['TT2'] ?? 65.0);
  const tt3 = Number(tags['TT3'] ?? 70.0);
  const tt4 = Number(tags['TT4'] ?? 70.0);
  const tt5 = Number(tags['TT5'] ?? 90.0);
  const tt6 = Number(tags['TT6'] ?? 95.0);
  const tt7 = Number(tags['TT7'] ?? 91.8);
  const tt8 = Number(tags['TT8'] ?? 88.0);
  const tt9 = Number(tags['TT9'] ?? 6.2);

  const pt1 = Number(tags['PT1'] ?? 0.25);
  const pt2 = Number(tags['PT2'] ?? 2.5);
  const pt3 = Number(tags['PT3'] ?? 180.0);
  const pt4 = Number(tags['PT4'] ?? 4.1);
  const pt5 = Number(tags['PT5'] ?? 2.1);
  const pt6 = Number(tags['PT6'] ?? 3.0);
  const pt7 = Number(tags['PT7'] ?? 3.0);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* SCADA Operations Toolbar */}
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
            <span style={{ color: 'var(--text-muted)' }}>HOLDING COIL (TT5):</span>
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

          {/* Quick Fault Trigger for Testing */}
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

      {/* Main SCADA Canvas - Exact 100% P&ID Architecture */}
      <div
        className="industrial-card"
        style={{
          flex: 1,
          padding: '12px 16px',
          position: 'relative',
          overflow: 'hidden',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <svg viewBox="0 0 1200 680" style={{ width: '100%', height: '100%', userSelect: 'none' }}>
          <defs>
            <pattern id="pidGrid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#f1f5f9" strokeWidth="1" />
            </pattern>

            <linearGradient id="milkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e0f2fe" />
            </linearGradient>

            <linearGradient id="hotWaterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>

          <rect width="1200" height="680" fill="url(#pidGrid)" />

          {/* ============================================================== */}
          {/* PROCESS SCHEMATIC HEADER & BORDER                              */}
          {/* ============================================================== */}
          <rect x="15" y="15" width="1170" height="650" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="15" y1="50" x2="1185" y2="50" stroke="#cbd5e1" strokeWidth="1" />

          <text x="30" y="38" fill="#0f172a" fontSize="16" fontWeight="900" letterSpacing="-0.02em">
            MILK PASTEURIZER 10 KLPH
          </text>
          <text x="300" y="36" fill="#64748b" fontSize="11" fontWeight="600">
            CONTINUOUS HTST THERMAL PROCESS & AUTOMATED FLOW DIVERSION
          </text>
          <text x="1050" y="36" fill="#0284c7" fontSize="11" fontWeight="800">
            PROCESS MIMIC
          </text>

          {/* ============================================================== */}
          {/* 1. BALANCE TANK STATION & INFEED (Bottom Center / Right)       */}
          {/* ============================================================== */}
          {/* Milk Inlet Line (Ø 51 mm) */}
          <path d="M 800 580 L 680 580 L 680 510" fill="none" stroke="#0284c7" strokeWidth="4" />
          <text x="790" y="572" fill="#0284c7" fontSize="10" fontWeight="bold">
            MILK INLET Ø 51 mm
          </text>

          {/* Raw Milk Transfer Pump */}
          <g transform="translate(730, 565)">
            <circle cx="15" cy="15" r="14" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
            <polygon points="15,6 24,15 15,24" fill={(pRaw?.speedPct ?? 0) > 0 ? '#0284c7' : '#94a3b8'} />
            <text x="15" y="38" textAnchor="middle" fill="#475569" fontSize="8" fontWeight="bold">
              RAW PUMP
            </text>
          </g>

          {/* Valve PV1 (Milk Inlet) */}
          <g transform="translate(668, 545)">
            <polygon points="0,0 24,16 24,0 0,16" fill={pv1?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <text x="32" y="12" fill="#0f172a" fontSize="9" fontWeight="bold">
              PV1
            </text>
          </g>

          {/* Water Inlet Line (Ø 51 mm) with Valve PV2 */}
          <path d="M 800 625 L 640 625 L 640 510" fill="none" stroke="#38bdf8" strokeWidth="3" />
          <text x="790" y="618" fill="#0284c7" fontSize="10" fontWeight="bold">
            WATER INLET Ø 51 mm
          </text>
          <g transform="translate(628, 595)">
            <polygon points="0,0 24,16 24,0 0,16" fill={pv2?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <text x="32" y="12" fill="#0f172a" fontSize="9" fontWeight="bold">
              PV2
            </text>
          </g>

          {/* Balance Tank Vessel */}
          <g transform="translate(590, 390)">
            <rect x="0" y="0" width="80" height="120" rx="4" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            {/* Liquid Level */}
            <rect
              x="2"
              y={118 - (116 * balLevel) / 100}
              width="76"
              height={(116 * balLevel) / 100}
              fill="url(#milkGradient)"
              stroke="#bae6fd"
            />
            <text x="40" y="-8" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">
              BALANCE TANK
            </text>
            <text x="40" y="55" textAnchor="middle" fill="#0369a1" fontSize="14" fontWeight="bold" className="mono">
              {balLevel.toFixed(1)} %
            </text>
            <text x="40" y="75" textAnchor="middle" fill="#64748b" fontSize="9" className="mono">
              LT1: {balLevel.toFixed(0)}%
            </text>

            {/* Level Switches LS1 & LS2 */}
            <circle cx="86" cy="18" r="6" fill={isLs2High ? '#dc2626' : '#94a3b8'} stroke="#334155" />
            <text x="96" y="22" fill="#64748b" fontSize="8" fontWeight="bold">
              LS2 (HI)
            </text>
            <circle cx="86" cy="100" r="6" fill={isLs1Tripped ? '#dc2626' : '#22c55e'} stroke="#334155" />
            <text x="96" y="104" fill="#64748b" fontSize="8" fontWeight="bold">
              LS1 (LO)
            </text>
          </g>

          {/* Balance Tank Suction Line (Ø 51 mm) */}
          <path d="M 590 490 L 530 490" fill="none" stroke="#0284c7" strokeWidth="4" />

          {/* TT1 & PT1 Transmitters */}
          <g transform="translate(555, 465)">
            <circle cx="10" cy="10" r="10" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
            <text x="10" y="13" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold">
              TT1
            </text>
            <text x="10" y="-4" textAnchor="middle" fill="#475569" fontSize="8" className="mono">
              {tt1.toFixed(1)}°C
            </text>
          </g>
          <g transform="translate(555, 515)">
            <circle cx="10" cy="10" r="10" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
            <text x="10" y="13" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold">
              PT1
            </text>
            <text x="10" y="30" textAnchor="middle" fill="#475569" fontSize="8" className="mono">
              {pt1.toFixed(2)} bar
            </text>
          </g>

          {/* Pipe Line Filter & NRV */}
          <g transform="translate(500, 478)">
            <rect x="0" y="0" width="24" height="24" fill="#f1f5f9" stroke="#334155" strokeWidth="1.5" />
            <line x1="4" y1="4" x2="20" y2="20" stroke="#64748b" strokeWidth="1.5" />
            <line x1="20" y1="4" x2="4" y2="20" stroke="#64748b" strokeWidth="1.5" />
            <text x="12" y="36" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="bold">
              FILTER
            </text>
          </g>

          <g transform="translate(460, 480)">
            <polygon points="0,0 20,10 0,20" fill="#ffffff" stroke="#334155" strokeWidth="1.5" />
            <line x1="20" y1="0" x2="20" y2="20" stroke="#334155" strokeWidth="2" />
            <text x="10" y="34" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="bold">
              NRV
            </text>
          </g>

          {/* Milk Feed Pump 5 HP (VFD) */}
          <path d="M 460 490 L 420 490" fill="none" stroke="#0284c7" strokeWidth="4" />
          <g transform="translate(390, 472)">
            <circle cx="18" cy="18" r="18" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            <polygon points="18,6 30,18 18,30" fill={(pFeed?.speedPct ?? 0) > 0 ? '#0284c7' : '#94a3b8'} />
            <text x="18" y="-6" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">
              MILK FEED PUMP (5 HP)
            </text>
            <text x="18" y="48" textAnchor="middle" fill="#0284c7" fontSize="9" fontWeight="bold" className="mono">
              {(pFeed?.speedPct ?? 0).toFixed(0)}% VFD
            </text>
          </g>

          {/* Flow Meter FM and PT2 at Feed Pump Discharge */}
          <path d="M 390 490 L 320 490 L 320 380" fill="none" stroke="#0284c7" strokeWidth="4" />
          <g transform="translate(340, 470)">
            <circle cx="10" cy="10" r="10" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
            <text x="10" y="13" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold">
              FM
            </text>
            <text x="10" y="32" textAnchor="middle" fill="#0369a1" fontSize="9" fontWeight="bold" className="mono">
              {fmFlowLph} LPH
            </text>
          </g>

          <g transform="translate(305, 430)">
            <circle cx="10" cy="10" r="10" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
            <text x="10" y="13" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold">
              PT2
            </text>
            <text x="-18" y="13" fill="#475569" fontSize="8" className="mono">
              {pt2.toFixed(2)} bar
            </text>
          </g>

          {/* ============================================================== */}
          {/* 2. 4-SECTION PLATE HEAT EXCHANGER (PHE) - CENTER STAGE        */}
          {/* ============================================================== */}
          <g transform="translate(180, 240)">
            {/* PHE Frame */}
            <rect x="0" y="0" width="280" height="150" rx="4" fill="#ffffff" stroke="#1e293b" strokeWidth="2.5" />

            {/* CHILLING SECTION */}
            <rect x="6" y="6" width="60" height="138" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5" />
            <text x="36" y="24" textAnchor="middle" fill="#15803d" fontSize="10" fontWeight="bold">
              CHILLING
            </text>
            <text x="36" y="40" textAnchor="middle" fill="#64748b" fontSize="8">
              Ø 63 mm
            </text>
            <text x="36" y="80" textAnchor="middle" fill="#15803d" fontSize="14" fontWeight="bold" className="mono">
              4.0 °C
            </text>
            <text x="36" y="125" textAnchor="middle" fill="#64748b" fontSize="8">
              PHE-CHILL
            </text>

            {/* REG-01 SECTION */}
            <rect x="72" y="6" width="65" height="138" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
            <text x="104" y="24" textAnchor="middle" fill="#334155" fontSize="10" fontWeight="bold">
              REG-01
            </text>
            <text x="104" y="40" textAnchor="middle" fill="#64748b" fontSize="8">
              Regeneration
            </text>
            <text x="104" y="80" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="bold" className="mono">
              28°C - 45°C
            </text>
            <text x="104" y="125" textAnchor="middle" fill="#64748b" fontSize="8">
              PHE-REG01
            </text>

            {/* REG-02 SECTION */}
            <rect x="143" y="6" width="65" height="138" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
            <text x="175" y="24" textAnchor="middle" fill="#334155" fontSize="10" fontWeight="bold">
              REG-02
            </text>
            <text x="175" y="40" textAnchor="middle" fill="#64748b" fontSize="8">
              Pre-Heating
            </text>
            <text x="175" y="80" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="bold" className="mono">
              65°C - 70°C
            </text>
            <text x="175" y="125" textAnchor="middle" fill="#64748b" fontSize="8">
              PHE-REG02
            </text>

            {/* HEATING SECTION */}
            <rect x="214" y="6" width="60" height="138" fill="#fffbeb" stroke="#fde68a" strokeWidth="1.5" />
            <text x="244" y="24" textAnchor="middle" fill="#b45309" fontSize="10" fontWeight="bold">
              HEATING
            </text>
            <text x="244" y="40" textAnchor="middle" fill="#64748b" fontSize="8">
              Hot Water
            </text>
            <text x="244" y="80" textAnchor="middle" fill="#b45309" fontSize="14" fontWeight="bold" className="mono">
              90.0 °C
            </text>
            <text x="244" y="125" textAnchor="middle" fill="#64748b" fontSize="8">
              PHE-HEAT
            </text>

            <text x="140" y="-8" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="900">
              PLATE HEAT EXCHANGER (10 KLPH 4-SECTION)
            </text>
          </g>

          {/* ============================================================== */}
          {/* 3. CREAM SEPARATOR STATION (Between REG-01 & REG-02)          */}
          {/* ============================================================== */}
          {/* Line from REG-01 down to Separator */}
          <path d="M 284 390 L 284 570 L 240 570" fill="none" stroke="#0284c7" strokeWidth="3" />
          <g transform="translate(180, 530)">
            {/* Centrifuge Separator Cone */}
            <polygon points="10,0 70,0 55,60 25,60" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            <circle cx="40" cy="20" r="12" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
            <text x="40" y="24" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
              10 KLPH
            </text>
            <text x="40" y="74" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">
              CREAM SEPARATOR
            </text>
            <text x="40" y="86" textAnchor="middle" fill="#64748b" fontSize="8">
              Capacity: 10,000 LPH
            </text>
          </g>

          {/* Separator Control Valves PV4, PV5, PV6, PV7 */}
          <g transform="translate(250, 545)">
            <polygon points="0,0 16,10 16,0 0,10" fill={pv4?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <text x="20" y="8" fill="#475569" fontSize="8" fontWeight="bold">
              PV4
            </text>
          </g>
          <g transform="translate(160, 580)">
            <polygon points="0,0 16,10 16,0 0,10" fill={pv5?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <text x="-16" y="8" fill="#475569" fontSize="8" fontWeight="bold">
              PV5
            </text>
          </g>
          <g transform="translate(130, 540)">
            <polygon points="0,0 16,10 16,0 0,10" fill="#f8fafc" stroke="#334155" strokeWidth="1.2" />
            <text x="-24" y="8" fill="#d97706" fontSize="8" fontWeight="bold">
              PV6 (Cream)
            </text>
          </g>
          {/* Separator Bypass PV7 */}
          <path d="M 284 410 L 320 410 L 320 480 L 350 480 L 350 390" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 2" />
          <g transform="translate(310, 440)">
            <polygon points="0,0 16,10 16,0 0,10" fill={pv7?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <text x="20" y="8" fill="#475569" fontSize="8" fontWeight="bold">
              PV7 (BYPASS)
            </text>
          </g>

          {/* ============================================================== */}
          {/* 4. HOMOGENIZER & BOOSTER PUMP STATION (After REG-02)          */}
          {/* ============================================================== */}
          {/* Line from REG-02 down to Homogenizer */}
          <path d="M 355 390 L 355 420 L 100 420 L 100 500" fill="none" stroke="#0284c7" strokeWidth="3" />
          <g transform="translate(50, 500)">
            <rect x="0" y="0" width="90" height="50" rx="3" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            <text x="45" y="18" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">
              HOMOGENIZER
            </text>
            <text x="45" y="32" textAnchor="middle" fill="#0284c7" fontSize="9" fontWeight="bold" className="mono">
              10 KLPH · 200 BAR
            </text>
            <text x="45" y="44" textAnchor="middle" fill="#15803d" fontSize="7" fontWeight="bold">
              SEAL WATER PROVED
            </text>
          </g>

          {/* Seal Cooling Water Line (Ø 25 mm) */}
          <path d="M 30 525 L 50 525" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 2" />
          <text x="20" y="540" fill="#0284c7" fontSize="7" fontWeight="bold">
            SEAL WATER Ø 25mm
          </text>

          {/* PT3 Homogenizer Pressure */}
          <g transform="translate(145, 485)">
            <circle cx="10" cy="10" r="10" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
            <text x="10" y="13" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold">
              PT3
            </text>
            <text x="10" y="30" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold" className="mono">
              {pt3.toFixed(0)} bar
            </text>
          </g>

          {/* Homogenizer Valves PV8 and PV9 */}
          <g transform="translate(85, 465)">
            <polygon points="0,0 16,10 16,0 0,10" fill={pv8?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <text x="20" y="8" fill="#475569" fontSize="8" fontWeight="bold">
              PV8
            </text>
          </g>
          <g transform="translate(45, 465)">
            <polygon points="0,0 16,10 16,0 0,10" fill={pv9?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <text x="-24" y="8" fill="#475569" fontSize="8" fontWeight="bold">
              PV9
            </text>
          </g>
          <text x="50" y="490" fill="#64748b" fontSize="8" className="mono">
            TT2: {tt2.toFixed(1)}°C
          </text>

          {/* Booster Pump 5 HP (VFD) */}
          <path d="M 140 525 L 140 440 L 160 440" fill="none" stroke="#0284c7" strokeWidth="3" />
          <g transform="translate(150, 425)">
            <circle cx="16" cy="16" r="16" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            <polygon points="16,6 26,16 16,26" fill={(pBoost?.speedPct ?? 0) > 0 ? '#0284c7' : '#94a3b8'} />
            <text x="16" y="44" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
              BOOSTER PUMP (5 HP)
            </text>
          </g>

          {/* PT4 Booster Discharge Pressure Transmitter */}
          <g transform="translate(180, 410)">
            <circle cx="10" cy="10" r="10" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
            <text x="10" y="13" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold">
              PT4
            </text>
            <text x="10" y="-4" textAnchor="middle" fill="#059669" fontSize="8" fontWeight="bold" className="mono">
              {pt4.toFixed(2)} bar
            </text>
          </g>

          {/* Booster discharge to Heating Section */}
          <path d="M 182 440 L 424 440 L 424 390" fill="none" stroke="#0284c7" strokeWidth="4" />
          <text x="435" y="420" fill="#64748b" fontSize="8" className="mono">
            TT4: {tt4.toFixed(1)}°C · TT3: {tt3.toFixed(1)}°C
          </text>

          {/* ============================================================== */}
          {/* 5. HEATING SECTION, HOLDING COIL & FLOW DIVERSION            */}
          {/* ============================================================== */}
          {/* Milk leaves Heating Section at 90°C -> Holding Coil */}
          <path d="M 424 240 L 424 160 L 520 160" fill="none" stroke="#d97706" strokeWidth="4" />

          {/* HOLDING COIL 20 SECONDS */}
          <g transform="translate(520, 135)">
            {/* Helical Holding Tube Loops */}
            <path
              d="M 0 25 Q 15 5 30 25 Q 45 45 60 25 Q 75 5 90 25 Q 105 45 120 25"
              fill="none"
              stroke="#0f766e"
              strokeWidth="5"
            />
            <text x="60" y="-5" textAnchor="middle" fill="#0f766e" fontSize="11" fontWeight="bold">
              HOLDING COIL (20 SEC RESIDENCE)
            </text>
            <text x="60" y="48" textAnchor="middle" fill="#64748b" fontSize="8">
              Ø 51 mm Sanitary Holding Tube
            </text>
          </g>

          {/* TT5 Pasteurization Safety Critical Interlock Transmitter */}
          <g transform="translate(650, 135)">
            <circle cx="12" cy="12" r="12" fill={isAtLegalTemp ? '#dcfce7' : '#fee2e2'} stroke={isAtLegalTemp ? '#059669' : '#dc2626'} strokeWidth="2" />
            <text x="12" y="16" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
              TT5
            </text>
            <text x="12" y="-5" textAnchor="middle" fill={isAtLegalTemp ? '#059669' : '#dc2626'} fontSize="10" fontWeight="bold" className="mono">
              {tt5.toFixed(1)} °C
            </text>
          </g>

          {/* Constant Pressure Valve CPM */}
          <g transform="translate(680, 150)">
            <rect x="0" y="0" width="18" height="18" fill="#f1f5f9" stroke="#334155" strokeWidth="1.5" />
            <text x="9" y="12" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="bold">
              CPM
            </text>
          </g>

          {/* DUAL DIVERSION VALVES: PV11 (Forward) & PV12 (Divert) */}
          {/* PV11 Forward Flow Valve */}
          <path d="M 698 160 L 750 160" fill="none" stroke={isForwardFlow ? '#059669' : '#cbd5e1'} strokeWidth="4" />
          <g transform="translate(735, 145)">
            <polygon
              points="0,0 24,15 24,0 0,15"
              fill={isForwardFlow ? '#dcfce7' : '#fee2e2'}
              stroke={isForwardFlow ? '#059669' : '#dc2626'}
              strokeWidth="2"
            />
            <text x="12" y="-6" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">
              PV11 (FORWARD)
            </text>
            <text x="12" y="28" textAnchor="middle" fill={isForwardFlow ? '#059669' : '#64748b'} fontSize="8" fontWeight="bold">
              {isForwardFlow ? 'OPEN' : 'CLOSED'}
            </text>
          </g>

          {/* PV12 Divert Flow Valve */}
          <path d="M 720 160 L 720 220" fill="none" stroke={isDiverted ? '#dc2626' : '#cbd5e1'} strokeWidth="4" />
          <g transform="translate(708, 205)">
            <polygon
              points="0,0 24,15 24,0 0,15"
              fill={pv12?.isOpen ?? isDiverted ? '#fee2e2' : '#f8fafc'}
              stroke={pv12?.isOpen ?? isDiverted ? '#dc2626' : '#94a3b8'}
              strokeWidth="2"
            />
            <text x="32" y="12" fill="#0f172a" fontSize="10" fontWeight="bold">
              PV12 (DIVERT)
            </text>
          </g>

          {/* FROM DIVERSION TO BALANCE TANK (Ø 51 mm) */}
          <path
            d="M 720 225 L 720 360 L 630 360 L 630 390"
            fill="none"
            stroke={isDiverted ? '#dc2626' : '#cbd5e1'}
            strokeWidth="3.5"
            strokeDasharray={isDiverted ? '6 3' : 'none'}
          />
          <text x="730" y="320" fill="#dc2626" fontSize="9" fontWeight="bold">
            FROM DIVERSION TO BALANCE TANK Ø 51 mm
          </text>

          {/* Forward Flow Line from PV11 through Chilling to Product Out */}
          <path
            d="M 760 160 L 980 160 L 980 320"
            fill="none"
            stroke={isForwardFlow ? '#059669' : '#cbd5e1'}
            strokeWidth="4"
          />
          <text x="860" y="152" fill="#059669" fontSize="10" fontWeight="bold">
            PASTEURIZED MILK Ø 51 mm
          </text>

          {/* Product Storage Silo */}
          <g transform="translate(930, 320)">
            <rect x="0" y="0" width="100" height="150" rx="4" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            <rect
              x="2"
              y={148 - (146 * (prodTank?.levelPct ?? 15)) / 100}
              width="96"
              height={(146 * (prodTank?.levelPct ?? 15)) / 100}
              fill="#dcfce7"
              stroke="#bbf7d0"
            />
            <rect x="0" y="-18" width="100" height="18" fill="#f1f5f9" stroke="#cbd5e1" />
            <text x="50" y="-5" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">
              STORAGE SILO
            </text>
            <text x="50" y="65" textAnchor="middle" fill="#15803d" fontSize="15" fontWeight="bold" className="mono">
              {(prodTank?.levelPct ?? 15).toFixed(0)} %
            </text>
            <text x="50" y="85" textAnchor="middle" fill="#64748b" fontSize="9">
              FINAL PRODUCT OUT
            </text>
          </g>

          {/* ============================================================== */}
          {/* 6. HOT WATER GENERATION SYSTEM & STEAM INLET (Top Left)       */}
          {/* ============================================================== */}
          <g transform="translate(200, 65)">
            <rect x="0" y="0" width="160" height="80" rx="4" fill="#fffbeb" stroke="#fde68a" strokeWidth="1.5" />
            <text x="80" y="18" textAnchor="middle" fill="#b45309" fontSize="10" fontWeight="bold">
              HOT WATER GENERATOR
            </text>
            <text x="80" y="34" textAnchor="middle" fill="#64748b" fontSize="8">
              Brazed PHE & Steam Injection
            </text>
            <text x="80" y="65" textAnchor="middle" fill="#b45309" fontSize="12" fontWeight="bold" className="mono">
              TT6: {tt6.toFixed(1)} °C
            </text>
          </g>

          {/* Steam Supply Line (1.5") with SCV1, PG1, PT7 */}
          <path d="M 120 105 L 200 105" fill="none" stroke="#d97706" strokeWidth="3" />
          <text x="80" y="98" fill="#d97706" fontSize="9" fontWeight="bold">
            STEAM INLET 1.5"
          </text>
          <g transform="translate(140, 95)">
            <polygon points="0,0 20,10 20,0 0,10" fill={scv1?.positionPct ? '#fed7aa' : '#fee2e2'} stroke="#b45309" strokeWidth="1.5" />
            <text x="10" y="-4" textAnchor="middle" fill="#b45309" fontSize="8" fontWeight="bold">
              SCV1 ({scv1?.positionPct?.toFixed(0) ?? 55}%)
            </text>
          </g>
          <g transform="translate(170, 75)">
            <circle cx="8" cy="8" r="8" fill="#ffffff" stroke="#b45309" strokeWidth="1" />
            <text x="8" y="11" textAnchor="middle" fill="#b45309" fontSize="7" fontWeight="bold">
              PG1
            </text>
            <text x="8" y="-3" textAnchor="middle" fill="#b45309" fontSize="7" className="mono">
              PT7: {pt7.toFixed(1)} bar
            </text>
          </g>

          {/* Hot Water Circulation Pump (3 HP VFD) */}
          <g transform="translate(370, 90)">
            <circle cx="15" cy="15" r="14" fill="#f8fafc" stroke="#334155" strokeWidth="1.5" />
            <polygon points="15,6 24,15 15,24" fill={(pHw?.speedPct ?? 0) > 0 ? '#f97316' : '#94a3b8'} />
            <text x="15" y="42" textAnchor="middle" fill="#b45309" fontSize="8" fontWeight="bold">
              P-HW (3 HP)
            </text>
            <text x="15" y="54" textAnchor="middle" fill="#b45309" fontSize="7" className="mono">
              PT5: {pt5.toFixed(2)}b · TT8: {tt8.toFixed(0)}°C
            </text>
          </g>
          <path d="M 360 105 L 370 105" fill="none" stroke="#f97316" strokeWidth="3" />
          <path d="M 398 105 L 440 105 L 440 240" fill="none" stroke="#f97316" strokeWidth="3" />
          <text x="450" y="170" fill="#b45309" fontSize="8" className="mono">
            TT7: {tt7.toFixed(1)}°C
          </text>

          {/* ============================================================== */}
          {/* 7. CHILLED WATER UTILITY INLET / OUTLET (Ø 63 mm)              */}
          {/* ============================================================== */}
          <g transform="translate(40, 260)">
            <path d="M 0 20 L 140 20" fill="none" stroke="#0284c7" strokeWidth="4" />
            <text x="0" y="12" fill="#0284c7" fontSize="9" fontWeight="bold">
              CHILLED WATER IN Ø 63 mm
            </text>
            <g transform="translate(70, 10)">
              <polygon points="0,0 20,10 20,0 0,10" fill={pv10?.positionPct ? '#dcfce7' : '#fee2e2'} stroke="#0284c7" strokeWidth="1.2" />
              <text x="10" y="-3" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold">
                PV10
              </text>
            </g>

            <path d="M 0 60 L 140 60" fill="none" stroke="#38bdf8" strokeWidth="4" />
            <text x="0" y="75" fill="#38bdf8" fontSize="9" fontWeight="bold">
              CHILLED WATER OUT Ø 63 mm
            </text>
            <text x="145" y="75" fill="#64748b" fontSize="8" className="mono">
              TT9: {tt9.toFixed(1)}°C · PT6: {pt6.toFixed(1)} bar
            </text>
          </g>

        </svg>

        {/* Live Engineering Telemetry Strip */}
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '8px 14px',
            background: '#f8fafc',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>FLOW: </span>
              <strong className="mono" style={{ color: '#0369a1' }}>
                {fmFlowLph} LPH
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>BALANCE TK: </span>
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
    </div>
  );
};
