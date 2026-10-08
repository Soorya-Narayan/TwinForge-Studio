/**
 * TwinForge Studio - Milk Pasteurizer 10 KLPH Process Mimic
 * High-Clarity Industrial P&ID SCADA Mimic.
 * Faithful reproduction of Goose Industrial Solutions / Lactalis Bhopal P&ID.
 * Precision orthogonal pipe routing, ISA-5.1 sanitary symbols, live telemetry.
 */

import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import {
  Play,
  Pause,
  RotateCcw,
  Layers,
  Thermometer,
} from 'lucide-react';
import { PheInspectorDrawer } from './PheInspectorDrawer';

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

  // Inspector drawer state
  const [isPheDrawerOpen, setIsPheDrawerOpen] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('ALL');

  // Extract simulated devices
  const balTank = snapshot?.devices['TK-BALANCE'];
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
  const tt2 = Number(tags['TT2'] ?? 45.0);
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
  const pg1 = Number(tags['PG1'] ?? 3.0);

  const fmFlowLph = Number(tags['FM'] ?? (pFeed?.speedPct ? (pFeed.speedPct / 100) * 10000 : 0));
  const balLevel = Number(tags['LT1'] ?? balTank?.levelPct ?? 75);
  const isLs1Tripped = balLevel < 15;
  const isLs2High = balLevel > 95;

  // Interlock statuses
  const isAtLegalTemp = tt5 >= 88.0;
  const isForwardFlow = isAtLegalTemp && Boolean(pv11?.isOpen ?? true);
  const isDiverted = !isForwardFlow && (pFeed?.speedPct ?? 0) > 0;
  const dpSafe = pt4 - pt2 >= 0.5;

  // PHE Dynamic Tags
  const chillTcIn = Number(tags['PHE_CHILL_TC_IN'] ?? 3.5);
  const chillTcOut = Number(tags['PHE_CHILL_TC_OUT'] ?? 6.2);
  const chillThIn = Number(tags['PHE_CHILL_TH_IN'] ?? 14.8);
  const chillThOut = Number(tags['PHE_CHILL_TH_OUT'] ?? 4.0);

  const reg1TcIn = Number(tags['PHE_REG1_TC_IN'] ?? tt1);
  const reg1TcOut = Number(tags['PHE_REG1_TC_OUT'] ?? 38.5);
  const reg1ThIn = Number(tags['PHE_REG1_TH_IN'] ?? 45.0);
  const reg1ThOut = Number(tags['PHE_REG1_TH_OUT'] ?? chillThIn);

  const reg2TcIn = Number(tags['PHE_REG2_TC_IN'] ?? reg1TcOut);
  const reg2TcOut = Number(tags['PHE_REG2_TC_OUT'] ?? 68.2);
  const reg2ThIn = Number(tags['PHE_REG2_TH_IN'] ?? tt5);
  const reg2ThOut = Number(tags['PHE_REG2_TH_OUT'] ?? reg1ThIn);

  const heatTcIn = Number(tags['PHE_HEAT_TC_IN'] ?? reg2TcOut);
  const heatTcOut = Number(tags['PHE_HEAT_TC_OUT'] ?? tt5);
  const heatThIn = Number(tags['PHE_HEAT_TH_IN'] ?? tt6);
  const heatThOut = Number(tags['PHE_HEAT_TH_OUT'] ?? (tt6 - 4.5));

  const regenEff = Number(tags['PHE_REGEN_EFF_PCT'] ?? 91.5);
  const totalDutyKw = Number(tags['PHE_TOTAL_DUTY_KW'] ?? 245.0);
  const holdingTimeS = Number(tags['PHE_HOLDING_TIME_S'] ?? 20.0);
  const pheStatus = String(tags['PHE_STATUS'] ?? 'NORMAL');

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
              {isForwardFlow ? 'PV11 FORWARD (LEGAL)' : isDiverted ? 'PV11 DIVERTED TO BALANCE' : 'STANDBY'}
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

      {/* 2. Main High-Clarity Process Mimic (P&ID Layout) */}
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
        <svg viewBox="0 0 1280 700" style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
          <defs>
            <pattern id="cleanGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f8fafc" strokeWidth="1" />
            </pattern>

            <linearGradient id="milkLevelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e0f2fe" />
            </linearGradient>

            <linearGradient id="heaterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="100%" stopColor="#fef3c7" />
            </linearGradient>
          </defs>

          <rect width="1280" height="700" fill="url(#cleanGrid)" />

          {/* ============================================================== */}
          {/* ENGINEERING DRAWING BORDER & TITLE BLOCK (Bottom Right)        */}
          {/* ============================================================== */}
          <rect x="15" y="15" width="1250" height="670" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="6 3" />
          
          {/* Title Block (Bottom Right: x=960..1255, y=595..675) */}
          <g transform="translate(960, 595)">
            <rect x="0" y="0" width="295" height="80" fill="#ffffff" stroke="#334155" strokeWidth="1.5" />
            <line x1="0" y1="26" x2="295" y2="26" stroke="#334155" strokeWidth="1" />
            <line x1="0" y1="52" x2="295" y2="52" stroke="#334155" strokeWidth="1" />
            <line x1="160" y1="26" x2="160" y2="80" stroke="#334155" strokeWidth="1" />
            
            <text x="147" y="17" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="900" letterSpacing="0.8">
              MILK PASTEURIZER 10 KLPH
            </text>
            <text x="10" y="42" fill="#475569" fontSize="8" fontWeight="bold">CLIENT:</text>
            <text x="54" y="42" fill="#0f172a" fontSize="8" fontWeight="800">LACTALIS BHOPAL</text>
            <text x="10" y="68" fill="#475569" fontSize="8" fontWeight="bold">CAPACITY:</text>
            <text x="64" y="68" fill="#0f172a" fontSize="8" fontWeight="800">10,000 LTRS / HR</text>
            
            <text x="170" y="42" fill="#475569" fontSize="8" fontWeight="bold">ENGINEERING:</text>
            <text x="170" y="68" fill="#0369a1" fontSize="8" fontWeight="900">GOOSE IND. SOLUTIONS</text>
          </g>

          {/* Top Right: SCADA WORKSTATION & CONTROL PANEL */}
          <g transform="translate(980, 35)">
            {/* SCADA Workstation */}
            <rect x="0" y="0" width="105" height="75" rx="3" fill="#f0fdf4" stroke="#16a34a" strokeWidth="1.4" />
            <text x="52" y="18" textAnchor="middle" fill="#15803d" fontSize="9" fontWeight="bold">
              NEW SCADA
            </text>
            <rect x="18" y="26" width="69" height="34" rx="2" fill="#ffffff" stroke="#16a34a" strokeWidth="1" />
            <polyline points="24,48 38,36 50,44 65,33 80,42" fill="none" stroke="#22c55e" strokeWidth="1.5" />
            <rect x="44" y="62" width="17" height="6" fill="#cbd5e1" />
            <line x1="36" y1="68" x2="69" y2="68" stroke="#334155" strokeWidth="2" />
            
            {/* Control Panel */}
            <g transform="translate(125, 0)">
              <rect x="0" y="0" width="130" height="95" rx="3" fill="#f8fafc" stroke="#16a34a" strokeWidth="1.4" />
              <text x="65" y="18" textAnchor="middle" fill="#15803d" fontSize="9" fontWeight="bold">
                CONTROL PANEL
              </text>
              <rect x="15" y="28" width="100" height="42" rx="2" fill="#dcfce7" stroke="#86efac" />
              <circle cx="35" cy="84" r="4" fill="#22c55e" />
              <circle cx="65" cy="84" r="4" fill="#eab308" />
              <circle cx="95" cy="84" r="4" fill="#ef4444" />
            </g>
          </g>

          {/* ============================================================== */}
          {/* ZONE 1: HOT WATER PREPARATION SET (Top Left: X=240..390, Y=30) */}
          {/* ============================================================== */}
          {/* Steam Header Infeed (x=130..250, y=58) */}
          <path d="M 130 58 L 250 58" fill="none" stroke="#d97706" strokeWidth="3" />
          <text x="130" y="28" fill="#d97706" fontSize="8.5" fontWeight="bold">
            STEAM INLET 1.5"
          </text>
          
          {/* PT7 Transmitter */}
          <circle cx="160" cy="40" r="7" fill="#ffffff" stroke="#d97706" strokeWidth="1" />
          <text x="160" y="43" textAnchor="middle" fill="#d97706" fontSize="6.5" fontWeight="bold">PT7</text>
          <text x="160" y="28" textAnchor="middle" fill="#b45309" fontSize="6.5" className="mono">{pt7.toFixed(1)}b</text>
          <line x1="160" y1="47" x2="160" y2="58" stroke="#d97706" strokeWidth="1" />

          {/* SCV1 Modulating Control Valve */}
          <g transform="translate(200, 58)">
            <polygon points="-9,-6 0,0 -9,6" fill={scv1?.positionPct ? '#fed7aa' : '#fee2e2'} stroke="#b45309" strokeWidth="1.2" />
            <polygon points="9,-6 0,0 9,6" fill={scv1?.positionPct ? '#fed7aa' : '#fee2e2'} stroke="#b45309" strokeWidth="1.2" />
            <line x1="0" y1="0" x2="0" y2="-7" stroke="#b45309" strokeWidth="1.2" />
            <rect x="-4" y="-11" width="8" height="4" rx="1" fill="#64748b" stroke="#b45309" strokeWidth="1" />
            <text x="0" y="16" textAnchor="middle" fill="#b45309" fontSize="8" fontWeight="bold">
              SCV1
            </text>
          </g>

          {/* PG1 Pressure Gauge */}
          <circle cx="235" cy="40" r="7" fill="#ffffff" stroke="#d97706" strokeWidth="1" />
          <text x="235" y="43" textAnchor="middle" fill="#d97706" fontSize="6.5" fontWeight="bold">PG1</text>
          <text x="235" y="28" textAnchor="middle" fill="#b45309" fontSize="6.5" className="mono">{pg1.toFixed(1)}b</text>
          <line x1="235" y1="47" x2="235" y2="58" stroke="#d97706" strokeWidth="1" />

          {/* Makeup Water Inlet (x=330, y=28 -> y=58) */}
          <path d="M 330 28 L 330 58" fill="none" stroke="#0284c7" strokeWidth="2.5" />
          <text x="330" y="22" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold">
            WATER INLET Ø 25mm
          </text>
          {/* PV8 Valve */}
          <g transform="translate(330, 42)">
            <polygon points="-6,-6 0,0 -6,6" fill={pv8?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1" transform="rotate(90)" />
            <polygon points="6,-6 0,0 6,6" fill={pv8?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1" transform="rotate(90)" />
            <text x="12" y="3" fill="#0f172a" fontSize="7" fontWeight="bold">PV8</text>
          </g>

          {/* Hot Water Heat Exchanger Column (Vertical Cylinder) */}
          <g transform="translate(250, 50)">
            <rect x="0" y="0" width="70" height="95" rx="6" fill="url(#heaterGrad)" stroke="#b45309" strokeWidth="1.5" />
            <line x1="8" y1="20" x2="62" y2="20" stroke="#fde68a" strokeWidth="2" />
            <line x1="8" y1="40" x2="62" y2="40" stroke="#fde68a" strokeWidth="2" />
            <line x1="8" y1="60" x2="62" y2="60" stroke="#fde68a" strokeWidth="2" />
            <line x1="8" y1="80" x2="62" y2="80" stroke="#fde68a" strokeWidth="2" />
            <text x="35" y="45" textAnchor="middle" fill="#92400e" fontSize="8" fontWeight="bold">
              HOT WATER SET
            </text>
            <text x="35" y="58" textAnchor="middle" fill="#b45309" fontSize="10" fontWeight="900" className="mono">
              {tt6.toFixed(1)}°C
            </text>
          </g>

          {/* Hot Water Pump 3 HP VFD (Text placed on left to avoid touching return line) */}
          <path d="M 285 145 L 285 160" fill="none" stroke="#f97316" strokeWidth="3" />
          <g transform="translate(285, 175)">
            <circle cx="0" cy="0" r="13" fill="#f8fafc" stroke="#b45309" strokeWidth="1.5" />
            <polygon points="0,-7 7,0 0,7" fill={(pHw?.speedPct ?? 0) > 0 ? '#ea580c' : '#94a3b8'} transform="rotate(90)" />
            <text x="-18" y="2" textAnchor="end" fill="#b45309" fontSize="7.5" fontWeight="bold">
              HOT WATER PUMP 3 HP
            </text>
            <text x="-18" y="12" textAnchor="end" fill="#ea580c" fontSize="7" className="mono">
              PT5: {pt5.toFixed(1)}b
            </text>
          </g>

          {/* Hot Water Supply Line into HEATING section */}
          <path d="M 285 188 L 285 210 L 330 210" fill="none" stroke="#ea580c" strokeWidth="3" />
          <circle cx="308" cy="210" r="6" fill="#ffffff" stroke="#ea580c" strokeWidth="1" />
          <text x="308" y="213" textAnchor="middle" fill="#ea580c" fontSize="6.5" fontWeight="bold">TT6</text>

          {/* Hot Water Return Line from HEATING section with TT7 and TT8 */}
          <path d="M 365 210 L 365 110 L 320 110" fill="none" stroke="#fdba74" strokeWidth="2.5" />
          <circle cx="365" cy="170" r="7" fill="#ffffff" stroke="#ea580c" strokeWidth="1" />
          <text x="365" y="173" textAnchor="middle" fill="#ea580c" fontSize="6.5" fontWeight="bold">TT7</text>
          <text x="378" y="173" textAnchor="start" fill="#ea580c" fontSize="6.5" className="mono">{tt7.toFixed(1)}°</text>

          <circle cx="365" cy="135" r="7" fill="#ffffff" stroke="#ea580c" strokeWidth="1" />
          <text x="365" y="138" textAnchor="middle" fill="#ea580c" fontSize="6.5" fontWeight="bold">TT8</text>
          <text x="378" y="138" textAnchor="start" fill="#ea580c" fontSize="6.5" className="mono">{tt8.toFixed(1)}°</text>

          {/* ============================================================== */}
          {/* ZONE 2: 4-SECTION PLATE HEAT EXCHANGER (Center: X=310..740)    */}
          {/* P&ID Section Order: HEATING | REG-02 | REG-01 | CHILLING       */}
          {/* Interactive: Click to open live Dynamic Model Inspector        */}
          {/* ============================================================== */}
          <g
            transform="translate(310, 210)"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setSelectedSectionId('ALL');
              setIsPheDrawerOpen(true);
            }}
          >
            {/* Outer Sanitary Frame */}
            <rect
              x="0"
              y="0"
              width="430"
              height="150"
              rx="5"
              fill="#ffffff"
              stroke={pheStatus === 'FOULING_CRITICAL' || pheStatus === 'CONTAMINATED_LEAK' ? '#ef4444' : '#1e293b'}
              strokeWidth="2"
            />

            {/* Header Title Bar */}
            <rect x="0" y="0" width="430" height="24" rx="4" fill="#0f172a" />
            <text x="215" y="16" textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="900" letterSpacing="0.4">
              PLATE HEAT EXCHANGER (10 KLPH 4-SECTION)
            </text>

            {/* Section 1: HEATING (Far Left, X=6..106) */}
            <g
              transform="translate(6, 28)"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSectionId('HEATING');
                setIsPheDrawerOpen(true);
              }}
            >
              <rect x="0" y="0" width="98" height="116" rx="3" fill="#fffbeb" stroke="#fde68a" strokeWidth="1.2" />
              <text x="49" y="16" textAnchor="middle" fill="#b45309" fontSize="9" fontWeight="800">
                HEATING
              </text>
              <text x="49" y="38" textAnchor="middle" fill="#b45309" fontSize="14" fontWeight="900" className="mono">
                {heatTcOut.toFixed(1)} °C
              </text>
              <text x="49" y="50" textAnchor="middle" fill="#92400e" fontSize="7.5" fontWeight="600">
                TARGET PAST. (90°C)
              </text>

              <g transform="translate(6, 64)" fontSize="7.5" className="mono">
                <text x="0" y="0" fill="#0284c7">Feed: {heatTcIn.toFixed(1)}°C</text>
                <text x="0" y="12" fill="#b45309">Out: {heatTcOut.toFixed(1)}°C</text>
                <text x="0" y="24" fill="#dc2626">HW: {heatThIn.toFixed(0)}°→{heatThOut.toFixed(0)}°</text>
              </g>
              <text x="49" y="108" textAnchor="middle" fill="#64748b" fontSize="7.5">
                PHE-HEAT
              </text>
            </g>

            {/* Section 2: REG-02 (Second from Left, X=112..212) */}
            <g
              transform="translate(112, 28)"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSectionId('REG-02');
                setIsPheDrawerOpen(true);
              }}
            >
              <rect x="0" y="0" width="98" height="116" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
              <text x="49" y="16" textAnchor="middle" fill="#334155" fontSize="9" fontWeight="800">
                REG-02
              </text>
              <text x="49" y="38" textAnchor="middle" fill="#0f172a" fontSize="14" fontWeight="800" className="mono">
                {reg2TcOut.toFixed(1)} °C
              </text>
              <text x="49" y="50" textAnchor="middle" fill="#475569" fontSize="7.5" fontWeight="600">
                PRE-HEAT 2 (70°C)
              </text>

              <g transform="translate(6, 64)" fontSize="7.5" className="mono">
                <text x="0" y="0" fill="#0284c7">Cold In: {reg2TcIn.toFixed(1)}°C</text>
                <text x="0" y="12" fill="#059669">Cold Out: {reg2TcOut.toFixed(1)}°C</text>
                <text x="0" y="24" fill="#d97706">Hot: {reg2ThIn.toFixed(0)}°→{reg2ThOut.toFixed(0)}°</text>
              </g>
              <text x="49" y="108" textAnchor="middle" fill="#64748b" fontSize="7.5">
                PHE-REG02
              </text>
            </g>

            {/* Section 3: REG-01 (Third from Left, X=218..318) */}
            <g
              transform="translate(218, 28)"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSectionId('REG-01');
                setIsPheDrawerOpen(true);
              }}
            >
              <rect x="0" y="0" width="98" height="116" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
              <text x="49" y="16" textAnchor="middle" fill="#334155" fontSize="9" fontWeight="800">
                REG-01
              </text>
              <text x="49" y="38" textAnchor="middle" fill="#0f172a" fontSize="14" fontWeight="800" className="mono">
                {reg1TcOut.toFixed(1)} °C
              </text>
              <text x="49" y="50" textAnchor="middle" fill="#475569" fontSize="7.5" fontWeight="600">
                PRE-HEAT 1 (28°-45°C)
              </text>

              <g transform="translate(6, 64)" fontSize="7.5" className="mono">
                <text x="0" y="0" fill="#0284c7">Cold In: {reg1TcIn.toFixed(1)}°C</text>
                <text x="0" y="12" fill="#059669">Cold Out: {reg1TcOut.toFixed(1)}°C</text>
                <text x="0" y="24" fill="#d97706">Hot Out: {reg1ThOut.toFixed(1)}°C</text>
              </g>
              <text x="49" y="108" textAnchor="middle" fill="#64748b" fontSize="7.5">
                PHE-REG01
              </text>
            </g>

            {/* Section 4: CHILLING (Far Right, X=324..424) */}
            <g
              transform="translate(324, 28)"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSectionId('CHILLING');
                setIsPheDrawerOpen(true);
              }}
            >
              <rect x="0" y="0" width="100" height="116" rx="3" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.2" />
              <text x="50" y="16" textAnchor="middle" fill="#15803d" fontSize="9" fontWeight="800">
                CHILLING
              </text>
              <text x="50" y="38" textAnchor="middle" fill="#15803d" fontSize="14" fontWeight="900" className="mono">
                {chillThOut.toFixed(1)} °C
              </text>
              <text x="50" y="50" textAnchor="middle" fill="#166534" fontSize="7.5" fontWeight="600">
                PRODUCT OUT (4°C)
              </text>

              <g transform="translate(6, 64)" fontSize="7.5" className="mono">
                <text x="0" y="0" fill="#0369a1">CW In: {chillTcIn.toFixed(1)}°C</text>
                <text x="0" y="12" fill="#0369a1">CW Out: {chillTcOut.toFixed(1)}°C</text>
                <text x="0" y="24" fill="#15803d">Milk In: {chillThIn.toFixed(1)}°C</text>
              </g>
              <text x="50" y="108" textAnchor="middle" fill="#64748b" fontSize="7.5">
                PHE-CHILL
              </text>
            </g>
          </g>

          {/* ============================================================== */}
          {/* ZONE 3: HOLDING COIL & FLOW DIVERSION (Left: X=60..230)        */}
          {/* ============================================================== */}
          {/* Pasteurized hot milk exits HEATING at (310, 260) -> goes left to Holding Tube */}
          <path d="M 310 260 L 150 260" fill="none" stroke="#d97706" strokeWidth="4" />
          <circle cx="210" cy="260" r="7" fill="#ffffff" stroke="#d97706" strokeWidth="1.2" />
          <text x="210" y="263" textAnchor="middle" fill="#d97706" fontSize="6.5" fontWeight="bold">TT6</text>

          {/* Holding Coil (Vertical Serpentine on the left: X=110..140, Y=255..365) */}
          <g transform="translate(125, 255)">
            <path
              d="M 15 0 L 0 0 L 0 25 L 15 25 L 15 50 L 0 50 L 0 75 L 15 75 L 15 100 L 0 100 L 0 120"
              fill="none"
              stroke="#0f766e"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x="8" y="-12" textAnchor="middle" fill="#0f766e" fontSize="8" fontWeight="bold">
              HOLDING COIL 20 SEC
            </text>
            <text x="8" y="136" textAnchor="middle" fill="#0f766e" fontSize="7.5" className="mono">
              τ = {holdingTimeS.toFixed(1)}s (Ø 63mm)
            </text>
          </g>

          {/* Leaves holding coil at (125, 375) -> turns to riser at (55, 375) -> Rises to top header at y=115 */}
          <path d="M 125 375 L 55 375 L 55 115" fill="none" stroke="#d97706" strokeWidth="4" />
          
          {/* PT3 */}
          <circle cx="55" cy="320" r="7" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
          <text x="55" y="323" textAnchor="middle" fill="#0284c7" fontSize="6.5" fontWeight="bold">PT3</text>
          <text x="42" y="323" textAnchor="end" fill="#0284c7" fontSize="6.5" className="mono">{pt3.toFixed(0)}b</text>

          {/* TT5 (Critical Safety Interlock) */}
          <g transform="translate(55, 220)">
            <circle cx="0" cy="0" r="10" fill={isAtLegalTemp ? '#dcfce7' : '#fee2e2'} stroke={isAtLegalTemp ? '#059669' : '#dc2626'} strokeWidth="2" />
            <text x="0" y="3" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="bold">TT5</text>
            <text x="-16" y="3" textAnchor="end" fill={isAtLegalTemp ? '#059669' : '#dc2626'} fontSize="9" fontWeight="bold" className="mono">
              {tt5.toFixed(1)}°C
            </text>
          </g>

          {/* Top Run: Pasteurized Milk Header across to Flow Diversion Valve & REG return */}
          <path d="M 55 115 L 770 115" fill="none" stroke={isForwardFlow ? '#059669' : '#d97706'} strokeWidth="4" />
          <text x="440" y="106" textAnchor="middle" fill={isForwardFlow ? '#059669' : '#b45309'} fontSize="9" fontWeight="bold">
            PASTEURIZED MILK LINE (90°C)
          </text>

          {/* Flow Diversion Valve Assembly (FDV / CPM) at (770, 115) */}
          <g transform="translate(770, 115)">
            <circle cx="0" cy="0" r="11" fill="#ffffff" stroke="#334155" strokeWidth="1.5" />
            <text x="0" y="3" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="900">CPM</text>
            <text x="0" y="-15" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold">PV11 (FDV)</text>
          </g>

          {/* BRANCH A: LEGAL DIVERT RETURN LINE (Drops vertically down into Balance Tank) with PV12 */}
          <path
            d="M 770 126 L 770 440"
            fill="none"
            stroke={isDiverted ? '#dc2626' : '#cbd5e1'}
            strokeWidth="3.5"
            strokeDasharray={isDiverted ? '6 3' : 'none'}
          />
          <g transform="translate(770, 260)">
            <polygon points="-8,-6 0,0 -8,6" fill={pv12?.isOpen ?? isDiverted ? '#fee2e2' : '#f8fafc'} stroke="#dc2626" strokeWidth="1.2" transform="rotate(90)" />
            <polygon points="8,-6 0,0 8,6" fill={pv12?.isOpen ?? isDiverted ? '#fee2e2' : '#f8fafc'} stroke="#dc2626" strokeWidth="1.2" transform="rotate(90)" />
            <text x="14" y="3" fill="#dc2626" fontSize="7.5" fontWeight="bold">PV12</text>
          </g>
          <text x="758" y="320" textAnchor="end" fill={isDiverted ? '#dc2626' : '#94a3b8'} fontSize="8" fontWeight="bold" transform="rotate(-90 758 320)">
            FROM DIVERSION TO BALANCE TANK
          </text>

          {/* BRANCH B: FORWARD FLOW (Enters REG-02 & REG-01 hot channels to pre-heat cold milk) */}
          <path d="M 770 115 L 790 115 L 790 185 L 470 185 L 470 210" fill="none" stroke={isForwardFlow ? '#059669' : '#94a3b8'} strokeWidth="3.5" />
          <circle cx="470" cy="185" r="5" fill="#ffffff" stroke="#059669" />

          {/* Hot pasteurized milk passes through REG-02 & REG-01 hot side, cools to ~20°C, enters CHILLING hot inlet */}
          <path d="M 570 210 L 570 185 L 660 185 L 660 210" fill="none" stroke={isForwardFlow ? '#059669' : '#94a3b8'} strokeWidth="3.5" />

          {/* ============================================================== */}
          {/* ZONE 4: CHILLED WATER & PRODUCT OUT (Right: X=690..1180)       */}
          {/* ============================================================== */}
          {/* Chilled Milk leaves CHILLING section at (700, 210) -> PV11 Product Out -> PRODUCT OUT */}
          <path d="M 700 210 L 700 170 L 1180 170" fill="none" stroke="#059669" strokeWidth="4" />
          <text x="1000" y="158" fill="#059669" fontSize="9" fontWeight="bold">
            PRODUCT OUT Ø 51 mm (4.0°C)
          </text>
          {/* Product Out Valve PV11 / CPM */}
          <g transform="translate(860, 170)">
            <polygon points="-10,-7 0,0 -10,7" fill={isForwardFlow ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <polygon points="10,-7 0,0 10,7" fill={isForwardFlow ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <line x1="0" y1="0" x2="0" y2="-8" stroke="#334155" strokeWidth="1.2" />
            <rect x="-5" y="-12" width="10" height="4" rx="1" fill="#64748b" stroke="#334155" strokeWidth="1" />
            <text x="0" y="18" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold">PV11</text>
          </g>

          {/* Chilled Water Supply Line (Enters from right at y=310, goes to CHILLING bottom port) */}
          <path d="M 1180 310 L 680 310 L 680 360" fill="none" stroke="#0284c7" strokeWidth="3" />
          <text x="1100" y="302" fill="#0284c7" fontSize="8.5" fontWeight="bold">
            CHILLED WATER IN Ø 63 mm
          </text>
          {/* WCV1 Modulating Water Control Valve */}
          <g transform="translate(900, 310)">
            <polygon points="-9,-6 0,0 -9,6" fill="#dbeafe" stroke="#0284c7" strokeWidth="1.2" />
            <polygon points="9,-6 0,0 9,6" fill="#dbeafe" stroke="#0284c7" strokeWidth="1.2" />
            <line x1="0" y1="0" x2="0" y2="-7" stroke="#0284c7" strokeWidth="1.2" />
            <rect x="-4" y="-11" width="8" height="4" rx="1" fill="#0284c7" />
            <text x="0" y="16" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold">WCV1</text>
          </g>

          {/* Chilled Water Return Line with TT9 & PT6 */}
          <path d="M 715 360 L 715 340 L 1180 340" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
          <text x="1100" y="352" fill="#0284c7" fontSize="8.5" fontWeight="bold">
            CHILLED WATER OUT Ø 63 mm
          </text>
          <circle cx="800" cy="340" r="7" fill="#ffffff" stroke="#0284c7" strokeWidth="1" />
          <text x="800" y="343" textAnchor="middle" fill="#0284c7" fontSize="6.5" fontWeight="bold">TT9</text>
          <text x="800" y="354" textAnchor="middle" fill="#0284c7" fontSize="6.5" className="mono">{tt9.toFixed(1)}°</text>

          <circle cx="835" cy="340" r="7" fill="#ffffff" stroke="#0284c7" strokeWidth="1" />
          <text x="835" y="343" textAnchor="middle" fill="#0284c7" fontSize="6.5" fontWeight="bold">PT6</text>
          <text x="835" y="354" textAnchor="middle" fill="#0284c7" fontSize="6.5" className="mono">{pt6.toFixed(1)}b</text>

          {/* ============================================================== */}
          {/* ZONE 5: BALANCE TANK & RAW MILK INLET (Right: X=800..1180)     */}
          {/* ============================================================== */}
          {/* Raw Milk Infeed Line (passes through Raw Milk Transfer Pump, PV1 -> Balance Tank) */}
          <path d="M 1180 470 L 890 470 L 890 440" fill="none" stroke="#0284c7" strokeWidth="4" />
          <text x="1110" y="462" fill="#0284c7" fontSize="8.5" fontWeight="bold">
            MILK INLET Ø 51 mm
          </text>
          {/* Raw Milk Transfer Pump */}
          <g transform="translate(1040, 470)">
            <circle cx="0" cy="0" r="11" fill="#f8fafc" stroke="#0284c7" strokeWidth="1.2" />
            <polygon points="-5,-5 5,0 -5,5" fill="#0284c7" />
            <text x="0" y="18" textAnchor="middle" fill="#0284c7" fontSize="7" fontWeight="bold">TRANSFER PUMP</text>
          </g>
          {/* PV1 Valve */}
          <g transform="translate(960, 470)">
            <polygon points="-10,-7 0,0 -10,7" fill={pv1?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <polygon points="10,-7 0,0 10,7" fill={pv1?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <line x1="0" y1="0" x2="0" y2="-8" stroke="#334155" strokeWidth="1.2" />
            <rect x="-5" y="-12" width="10" height="4" rx="1" fill="#64748b" stroke="#334155" strokeWidth="1" />
            <text x="0" y="18" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold">PV1</text>
          </g>

          {/* Water Inlet Line into Balance Tank */}
          <path d="M 1180 500 L 860 500 L 860 440" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
          <text x="1110" y="493" fill="#0284c7" fontSize="8" fontWeight="bold">
            WATER INLET Ø 51 mm
          </text>
          {/* PV2 Valve */}
          <g transform="translate(960, 500)">
            <polygon points="-8,-6 0,0 -8,6" fill={pv2?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <polygon points="8,-6 0,0 8,6" fill={pv2?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <text x="0" y="16" textAnchor="middle" fill="#0f172a" fontSize="7.5" fontWeight="bold">PV2</text>
          </g>

          {/* Balance Tank Vessel (x=800, y=440, width=90, height=110) */}
          <g transform="translate(800, 440)">
            <rect x="0" y="0" width="90" height="110" rx="4" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            <rect
              x="2"
              y={108 - (106 * balLevel) / 100}
              width="86"
              height={(106 * balLevel) / 100}
              fill="url(#milkLevelGrad)"
              stroke="#bae6fd"
            />
            <text x="45" y="-8" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="800">
              BALANCE TANK
            </text>
            <text x="45" y="50" textAnchor="middle" fill="#0369a1" fontSize="14" fontWeight="900" className="mono">
              {balLevel.toFixed(0)} %
            </text>
            <text x="45" y="68" textAnchor="middle" fill="#64748b" fontSize="8.5" className="mono">
              LT1: {balLevel.toFixed(1)}%
            </text>

            {/* Level Switches LS1 & LS2 */}
            <circle cx="94" cy="18" r="4" fill={isLs2High ? '#dc2626' : '#94a3b8'} stroke="#334155" />
            <text x="102" y="21" fill="#64748b" fontSize="7.5">LS2</text>
            <circle cx="94" cy="90" r="4" fill={isLs1Tripped ? '#dc2626' : '#22c55e'} stroke="#334155" />
            <text x="102" y="93" fill="#64748b" fontSize="7.5">LS1</text>
          </g>

          {/* Balance Tank Drain Line */}
          <path d="M 845 550 L 845 575" fill="none" stroke="#64748b" strokeWidth="2" />
          <line x1="835" y1="575" x2="855" y2="575" stroke="#64748b" strokeWidth="2" />
          <line x1="838" y1="579" x2="852" y2="579" stroke="#64748b" strokeWidth="1.5" />
          <line x1="841" y1="583" x2="849" y2="583" stroke="#64748b" strokeWidth="1" />
          <text x="860" y="580" fill="#64748b" fontSize="7">DRAIN LINE</text>

          {/* ============================================================== */}
          {/* ZONE 6: FEED PUMP SUCTION & DISCHARGE (Bottom: X=500..800)     */}
          {/* ============================================================== */}
          {/* Suction Line: Leaves Balance Tank at (820, 550) -> TT1, PT1 -> Filter -> NRV -> Feed Pump */}
          <path d="M 820 550 L 820 620 L 680 620" fill="none" stroke="#0284c7" strokeWidth="4" />
          {/* TT1 & PT1 */}
          <circle cx="790" cy="620" r="7" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
          <text x="790" y="623" textAnchor="middle" fill="#0284c7" fontSize="6.5" fontWeight="bold">TT1</text>
          <text x="790" y="635" textAnchor="middle" fill="#475569" fontSize="7" className="mono">{tt1.toFixed(1)}°</text>

          <circle cx="760" cy="620" r="7" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
          <text x="760" y="623" textAnchor="middle" fill="#0284c7" fontSize="6.5" fontWeight="bold">PT1</text>
          <text x="760" y="635" textAnchor="middle" fill="#475569" fontSize="7" className="mono">{pt1.toFixed(2)}b</text>

          {/* Pipe Line Filter */}
          <g transform="translate(720, 610)">
            <rect x="0" y="0" width="20" height="20" fill="#f1f5f9" stroke="#334155" strokeWidth="1.2" />
            <line x1="3" y1="3" x2="17" y2="17" stroke="#64748b" />
            <line x1="17" y1="3" x2="3" y2="17" stroke="#64748b" />
            <text x="10" y="30" textAnchor="middle" fill="#64748b" fontSize="6.5" fontWeight="bold">FILTER</text>
          </g>

          {/* Check Valve (NRV) */}
          <g transform="translate(695, 612)">
            <polygon points="0,0 14,8 0,16" fill="#ffffff" stroke="#334155" strokeWidth="1.2" transform="rotate(180 7 8)" />
            <line x1="0" y1="0" x2="0" y2="16" stroke="#334155" strokeWidth="1.5" />
            <text x="7" y="27" textAnchor="middle" fill="#64748b" fontSize="6.5" fontWeight="bold">NRV</text>
          </g>

          {/* Milk Feed Pump 5 HP VFD */}
          <g transform="translate(660, 620)">
            <circle cx="0" cy="0" r="16" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            <polygon points="0,-10 -10,0 0,10" fill={(pFeed?.speedPct ?? 0) > 0 ? '#0284c7' : '#94a3b8'} />
            <text x="0" y="26" textAnchor="middle" fill="#0f172a" fontSize="8.5" fontWeight="bold">
              MILK FEED PUMP
            </text>
            <text x="0" y="37" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold" className="mono">
              {(pFeed?.speedPct ?? 0).toFixed(0)}% VFD (5 HP)
            </text>
          </g>

          {/* Discharge Line from Feed Pump -> PT2 -> Flowmeter FM -> Rises into REG-01 */}
          <path d="M 644 620 L 575 620 L 575 360" fill="none" stroke="#0284c7" strokeWidth="4" />
          <circle cx="620" cy="620" r="7" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
          <text x="620" y="623" textAnchor="middle" fill="#0284c7" fontSize="6.5" fontWeight="bold">PT2</text>
          <text x="620" y="608" textAnchor="middle" fill="#475569" fontSize="7" className="mono">{pt2.toFixed(1)}b</text>

          {/* Flow Meter FM */}
          <circle cx="575" cy="530" r="8" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
          <text x="575" y="533" textAnchor="middle" fill="#0284c7" fontSize="7" fontWeight="bold">FM</text>
          <text x="592" y="533" fill="#0369a1" fontSize="8" fontWeight="bold" className="mono">
            {fmFlowLph} LPH
          </text>

          {/* ============================================================== */}
          {/* ZONE 7: SEPARATOR & HOMOGENIZER (Bottom Left: X=100..480)      */}
          {/* ============================================================== */}
          {/* Raw milk heats in REG-01 (to ~55°C), exits bottom at (545, 360) -> TT2, PV4 -> Separator */}
          <path d="M 545 360 L 545 445 L 340 445 L 340 470" fill="none" stroke="#0284c7" strokeWidth="3" />
          <circle cx="500" cy="445" r="7" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
          <text x="500" y="448" textAnchor="middle" fill="#0284c7" fontSize="6.5" fontWeight="bold">TT2</text>
          <text x="500" y="435" textAnchor="middle" fill="#0284c7" fontSize="6.5" className="mono">{tt2.toFixed(1)}°</text>

          {/* Valve PV4 */}
          <g transform="translate(420, 445)">
            <polygon points="-8,-6 0,0 -8,6" fill={pv4?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <polygon points="8,-6 0,0 8,6" fill={pv4?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.2" />
            <text x="0" y="16" textAnchor="middle" fill="#0f172a" fontSize="7.5" fontWeight="bold">PV4</text>
          </g>

          {/* Cream Separator Vessel (Capacity: 10,000 LPH) with PV10 */}
          <g transform="translate(305, 470)">
            <polygon points="10,0 70,0 55,55 25,55" fill="#f8fafc" stroke="#334155" strokeWidth="1.8" />
            <circle cx="40" cy="22" r="11" fill="#e2e8f0" stroke="#475569" strokeWidth="1.2" />
            <text x="40" y="25" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold">CPM</text>
            <text x="40" y="70" textAnchor="middle" fill="#0f172a" fontSize="8.5" fontWeight="bold">
              CREAM SEPARATOR
            </text>
            <text x="40" y="81" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="bold">
              10,000 LPH (VFD)
            </text>
            <g transform="translate(72, 22)">
              <polygon points="-4,-4 0,0 -4,4" fill={pv10?.positionPct ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1" />
              <polygon points="4,-4 0,0 4,4" fill={pv10?.positionPct ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1" />
              <text x="0" y="12" textAnchor="middle" fill="#0f172a" fontSize="6.5">PV10</text>
            </g>
          </g>

          {/* Milk travels from Separator into Homogenizer */}
          <path d="M 305 500 L 230 500" fill="none" stroke="#0284c7" strokeWidth="3" />

          {/* Homogenizer Vessel (Capacity: 10,000 LPH, 200 BAR) with PV5 */}
          <g transform="translate(140, 470)">
            <rect x="0" y="0" width="90" height="58" rx="3" fill="#f8fafc" stroke="#334155" strokeWidth="1.8" />
            <text x="45" y="18" textAnchor="middle" fill="#0f172a" fontSize="8.5" fontWeight="bold">
              HOMOGENIZER
            </text>
            <text x="45" y="32" textAnchor="middle" fill="#0284c7" fontSize="8.5" fontWeight="bold" className="mono">
              200 BAR (10 KLPH)
            </text>
            <text x="45" y="46" textAnchor="middle" fill="#15803d" fontSize="7" fontWeight="bold">
              SEAL WATER OK
            </text>
            <g transform="translate(45, -10)">
              <polygon points="-4,-4 0,0 -4,4" fill={pv5?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1" />
              <polygon points="4,-4 0,0 4,4" fill={pv5?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1" />
              <text x="0" y="-5" textAnchor="middle" fill="#0f172a" fontSize="6.5">PV5</text>
            </g>
          </g>

          {/* Seal Cooling Water Line to Homogenizer (from bottom left) */}
          <path d="M 60 515 L 140 515" fill="none" stroke="#0ea5e9" strokeWidth="2" />
          <text x="95" y="538" fill="#0ea5e9" fontSize="7" fontWeight="bold">
            SEAL WATER Ø 25mm
          </text>

          {/* Milk leaves Homogenizer -> enters REG-02 cold inlet (to heat to 70°C) */}
          <path d="M 185 470 L 185 415 L 435 415 L 435 360" fill="none" stroke="#0284c7" strokeWidth="3" />

          {/* Preheated milk leaves REG-02 at (465, 360) -> TT3 -> Booster Pump -> HEATING section */}
          <path d="M 465 360 L 465 390 L 394 390" fill="none" stroke="#0284c7" strokeWidth="3.5" />
          <circle cx="465" cy="375" r="6" fill="#ffffff" stroke="#0284c7" strokeWidth="1" />
          <text x="465" y="378" textAnchor="middle" fill="#0284c7" fontSize="6.5" fontWeight="bold">TT3</text>
          <text x="476" y="378" textAnchor="start" fill="#0284c7" fontSize="6.5" className="mono">{tt3.toFixed(1)}°</text>

          {/* Booster Pump (5 HP VFD) */}
          <g transform="translate(380, 390)">
            <circle cx="0" cy="0" r="14" fill="#f8fafc" stroke="#334155" strokeWidth="1.8" />
            <polygon points="0,-8 -8,0 0,8" fill={(pBoost?.speedPct ?? 0) > 0 ? '#0284c7' : '#94a3b8'} />
            <text x="0" y="24" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold">
              BOOSTER PUMP
            </text>
            <text x="0" y="34" textAnchor="middle" fill="#059669" fontSize="7.5" className="mono">
              PT4: {pt4.toFixed(2)}b
            </text>
          </g>

          {/* Booster Pump Discharge enters bottom of HEATING section at (340, 360) with TT4 */}
          <path d="M 366 390 L 340 390 L 340 360" fill="none" stroke="#0284c7" strokeWidth="3.5" />
          <circle cx="340" cy="375" r="6" fill="#ffffff" stroke="#0284c7" strokeWidth="1" />
          <text x="340" y="378" textAnchor="middle" fill="#0284c7" fontSize="6.5" fontWeight="bold">TT4</text>
          <text x="328" y="378" textAnchor="end" fill="#0284c7" fontSize="6.5" className="mono">{tt4.toFixed(1)}°</text>
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
                {chillThOut.toFixed(1)}°C (LEGAL)
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>REGEN EFF: </span>
              <strong className="mono" style={{ color: '#059669' }}>
                {regenEff.toFixed(1)}%
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>DUTY (Q): </span>
              <strong className="mono" style={{ color: '#b45309' }}>
                {totalDutyKw.toFixed(0)} kW
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                setSelectedSectionId('ALL');
                setIsPheDrawerOpen(true);
              }}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 4,
                background: '#e0f2fe',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              <Thermometer size={12} />
              INSPECT PHE DYNAMICS
            </button>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
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

      {/* 3. Dedicated Process Legend & Component Guide */}
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
              <div><strong>Balance Tank</strong>: 600L raw infeed buffer vessel with level switches LS1/LS2</div>
              <div><strong>PHE (Plate Heat Exchanger)</strong>: 4-section frame: HEATING | REG-02 | REG-01 | CHILLING</div>
              <div><strong>Cream Separator</strong>: Centrifugal whole-milk fractionator (10,000 LPH)</div>
              <div><strong>Homogenizer</strong>: 2-stage high-shear particle breaker (200 bar)</div>
              <div><strong>Holding Coil</strong>: 20-second sanitary residence tube for pathogen elimination</div>
              <div><strong>Hot Water Prep Set</strong>: Steam-heated pressurized water generation skid</div>
            </div>
          </div>

          {/* Column 3: Actuators & Valves */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
              Valves & Actuation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              <div><strong>PV1 / PV2</strong>: Raw milk infeed & water makeup valves</div>
              <div><strong>PV4 / PV5 / PV10</strong>: Cream separator feed, skim & control valves</div>
              <div><strong>PV8</strong>: Hot water makeup water valve</div>
              <div><strong>PV11 (FDV / CPM)</strong>: Legal pasteurization flow diversion valve</div>
              <div><strong>PV12</strong>: Safety diversion valve routing to Balance Tank</div>
              <div><strong>SCV1</strong>: Modulating steam valve controlling hot water temperature</div>
              <div><strong>WCV1</strong>: Modulating chilled water cooling regulator valve</div>
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

      {/* Dynamic Model Physical Inspection Drawer */}
      <PheInspectorDrawer
        isOpen={isPheDrawerOpen}
        onClose={() => setIsPheDrawerOpen(false)}
        initialSectionId={selectedSectionId}
      />
    </div>
  );
};
