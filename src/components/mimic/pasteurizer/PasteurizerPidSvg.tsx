import React from 'react';
import { Thermometer } from 'lucide-react';
import type { DevicePhysicalState } from '../../../core/engine/types';

export interface PasteurizerPidSvgProps {
  balTank?: DevicePhysicalState;
  prodTank?: DevicePhysicalState;
  pRaw?: DevicePhysicalState;
  pFeed?: DevicePhysicalState;
  pBoost?: DevicePhysicalState;
  pHw?: DevicePhysicalState;
  pv1?: DevicePhysicalState;
  pv2?: DevicePhysicalState;
  pv4?: DevicePhysicalState;
  pv5?: DevicePhysicalState;
  pv8?: DevicePhysicalState;
  pv10?: DevicePhysicalState;
  pv11?: DevicePhysicalState;
  pv12?: DevicePhysicalState;
  scv1?: DevicePhysicalState;
  tt1: number;
  tt5: number;
  tt6: number;
  pt1: number;
  pt2: number;
  pt3: number;
  pt4: number;
  fmFlowLph: number;
  balLevel: number;
  isLs1Tripped: boolean;
  isLs2High: boolean;
  isAtLegalTemp: boolean;
  isForwardFlow: boolean;
  isDiverted: boolean;
  chillTcIn: number;
  chillTcOut: number;
  chillThIn: number;
  chillThOut: number;
  reg1TcIn: number;
  reg1TcOut: number;
  reg1ThIn: number;
  reg1ThOut: number;
  reg2TcIn: number;
  reg2TcOut: number;
  reg2ThIn: number;
  reg2ThOut: number;
  heatTcIn: number;
  heatTcOut: number;
  heatThIn: number;
  heatThOut: number;
  regenEff: number;
  totalDutyKw: number;
  holdingTimeS: number;
  pheStatus: string;
  onInspectPhe: (sectionId: string) => void;
  onInspectPump?: () => void;
}

export const PasteurizerPidSvg: React.FC<PasteurizerPidSvgProps> = ({
  balTank: _balTank,
  prodTank,
  pRaw,
  pFeed,
  pBoost,
  pHw,
  pv1,
  pv2,
  pv4,
  pv5,
  pv8,
  pv10,
  pv11: _pv11,
  pv12,
  scv1,
  tt1,
  tt5,
  tt6,
  pt1,
  pt2,
  pt3,
  pt4,
  fmFlowLph,
  balLevel,
  isLs1Tripped,
  isLs2High,
  isAtLegalTemp,
  isForwardFlow,
  isDiverted,
  chillTcIn,
  chillTcOut,
  chillThIn,
  chillThOut,
  reg1TcIn,
  reg1TcOut,
  reg1ThIn: _reg1ThIn,
  reg1ThOut,
  reg2TcIn,
  reg2TcOut,
  reg2ThIn,
  reg2ThOut,
  heatTcIn,
  heatTcOut,
  heatThIn,
  heatThOut,
  regenEff,
  totalDutyKw,
  holdingTimeS,
  pheStatus,
  onInspectPhe,
  onInspectPump,
}) => {
  return (
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
        {/* Raw Milk Infeed Line (passes from silo through P-RAW and PV1, turns down directly into Balance Tank) */}
        <path d="M 20 160 L 130 160 L 130 240" fill="none" stroke="#0284c7" strokeWidth="4" />
        <text x="20" y="132" fill="#0284c7" fontSize="9" fontWeight="bold">
          RAW SILO INFEED (Ø 51mm)
        </text>

        {/* Raw Milk Transfer Pump (P-RAW) (Suction enters at x=41, discharge leaves at x=69) */}
        <g
          transform="translate(55, 160)"
          onClick={onInspectPump}
          style={{ cursor: onInspectPump ? 'pointer' : 'default' }}
        >
          <title>Raw Milk Transfer Pump (P-RAW) - Click to Open Physical Diagnostic Suite</title>
          {/* Subtle pulse / glow ring when running */}
          {(pRaw?.isRunning || (pRaw?.speedPct ?? 0) > 10) && (
            <circle cx="0" cy="0" r="18" fill="none" stroke="#0284c7" strokeWidth="2" opacity="0.4">
              <animate attributeName="r" values="14;20;14" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite" />
            </circle>
          )}
          <circle cx="0" cy="0" r="14" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
          <polygon
            points="-3,-8 9,0 -3,8"
            fill={(pRaw?.speedPct ?? 0) > 10 ? '#0284c7' : '#94a3b8'}
          />
          {/* Motor top casing */}
          <rect x="-7" y="-18" width="14" height="4" rx="1" fill="#475569" stroke="#334155" strokeWidth="1" />
          <text x="0" y="24" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold">
            P-RAW
          </text>
          <text x="0" y="34" textAnchor="middle" fill="#0284c7" fontSize="7" fontWeight="bold" className="mono">
            {(pRaw?.speedPct ?? 0) > 10 ? 'RUNNING' : 'STOPPED'}
          </text>
          {/* Click to inspect badge */}
          <rect x="-18" y="-28" width="36" height="9" rx="2" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="0.8" />
          <text x="0" y="-21" textAnchor="middle" fill="#0369a1" fontSize="6" fontWeight="bold">
            INSPECT
          </text>
        </g>

        {/* Valve PV1 (horizontal opposing triangles centered on pipe at x=95, y=160) */}
        <g transform="translate(95, 160)">
          <polygon points="-10,-7 0,0 -10,7" fill={pv1?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.5" />
          <polygon points="10,-7 0,0 10,7" fill={pv1?.isOpen ? '#dcfce7' : '#fee2e2'} stroke="#334155" strokeWidth="1.5" />
          <line x1="0" y1="0" x2="0" y2="-8" stroke="#334155" strokeWidth="1.5" />
          <rect x="-5" y="-13" width="10" height="5" rx="1" fill="#64748b" stroke="#334155" strokeWidth="1" />
          <text x="0" y="19" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold">
            PV1
          </text>
        </g>

        {/* Water Infeed Line (passes through PV2, turns down directly into Balance Tank) */}
        <path d="M 40 200 L 110 200 L 110 240" fill="none" stroke="#38bdf8" strokeWidth="3" />
        <text x="40" y="178" fill="#0284c7" fontSize="9" fontWeight="bold">
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

        {/* Diverted Recirculation Line (routes above PHE, enters top of Balance Tank at x=150, y=240) */}
        <path
          d="M 950 195 L 950 112 L 150 112 L 150 240"
          fill="none"
          stroke={isDiverted ? '#dc2626' : '#cbd5e1'}
          strokeWidth="3.5"
          strokeDasharray={isDiverted ? '6 3' : 'none'}
        />
        <text x="560" y="104" textAnchor="middle" fill={isDiverted ? '#dc2626' : '#94a3b8'} fontSize="9" fontWeight="bold">
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
        {/* Interactive: Click to open live Dynamic Model Inspector        */}
        {/* ============================================================== */}
        <g
          transform="translate(410, 140)"
          style={{ cursor: 'pointer' }}
          onClick={() => onInspectPhe('ALL')}
        >
          {/* Outer Frame with Sanitary Border */}
          <rect
            x="0"
            y="0"
            width="360"
            height="150"
            rx="5"
            fill="#ffffff"
            stroke={pheStatus === 'FOULING_CRITICAL' || pheStatus === 'CONTAMINATED_LEAK' ? '#ef4444' : '#1e293b'}
            strokeWidth="2"
          />

          {/* Header Title Bar */}
          <rect x="0" y="0" width="360" height="24" rx="4" fill="#0f172a" />
          <text x="180" y="16" textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="900" letterSpacing="0.4">
            PLATE HEAT EXCHANGER (10 KLPH 4-SECTION)
          </text>

          {/* Section 1: Chilling */}
          <g
            transform="translate(6, 28)"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onInspectPhe('CHILLING');
            }}
          >
            <rect x="0" y="0" width="80" height="116" rx="3" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.2" />
            <text x="40" y="16" textAnchor="middle" fill="#15803d" fontSize="9" fontWeight="800">
              CHILLING
            </text>
            <text x="40" y="38" textAnchor="middle" fill="#15803d" fontSize="14" fontWeight="900" className="mono">
              {chillThOut.toFixed(1)} °C
            </text>
            <text x="40" y="50" textAnchor="middle" fill="#166534" fontSize="7.5" fontWeight="600">
              PRODUCT OUT
            </text>

            {/* Dynamic Port Temperatures */}
            <g transform="translate(6, 64)" fontSize="7.5" className="mono">
              <text x="0" y="0" fill="#0369a1">CW In: {chillTcIn.toFixed(1)}°C</text>
              <text x="0" y="12" fill="#0369a1">CW Out: {chillTcOut.toFixed(1)}°C</text>
              <text x="0" y="24" fill="#15803d">Milk In: {chillThIn.toFixed(1)}°C</text>
            </g>

            <text x="40" y="108" textAnchor="middle" fill="#64748b" fontSize="7.5">
              PHE-CHILL
            </text>
          </g>

          {/* Section 2: REG-01 */}
          <g
            transform="translate(94, 28)"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onInspectPhe('REG-01');
            }}
          >
            <rect x="0" y="0" width="80" height="116" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
            <text x="40" y="16" textAnchor="middle" fill="#334155" fontSize="9" fontWeight="800">
              REG-01
            </text>
            <text x="40" y="38" textAnchor="middle" fill="#0f172a" fontSize="14" fontWeight="800" className="mono">
              {reg1TcOut.toFixed(1)} °C
            </text>
            <text x="40" y="50" textAnchor="middle" fill="#475569" fontSize="7.5" fontWeight="600">
              PRE-HEAT 1
            </text>

            {/* Dynamic Port Temperatures */}
            <g transform="translate(6, 64)" fontSize="7.5" className="mono">
              <text x="0" y="0" fill="#0284c7">Cold In: {reg1TcIn.toFixed(1)}°C</text>
              <text x="0" y="12" fill="#059669">Cold Out: {reg1TcOut.toFixed(1)}°C</text>
              <text x="0" y="24" fill="#d97706">Hot Out: {reg1ThOut.toFixed(1)}°C</text>
            </g>

            <text x="40" y="108" textAnchor="middle" fill="#64748b" fontSize="7.5">
              PHE-REG01
            </text>
          </g>

          {/* Section 3: REG-02 */}
          <g
            transform="translate(182, 28)"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onInspectPhe('REG-02');
            }}
          >
            <rect x="0" y="0" width="80" height="116" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
            <text x="40" y="16" textAnchor="middle" fill="#334155" fontSize="9" fontWeight="800">
              REG-02
            </text>
            <text x="40" y="38" textAnchor="middle" fill="#0f172a" fontSize="14" fontWeight="800" className="mono">
              {reg2TcOut.toFixed(1)} °C
            </text>
            <text x="40" y="50" textAnchor="middle" fill="#475569" fontSize="7.5" fontWeight="600">
              PRE-HEAT 2
            </text>

            {/* Dynamic Port Temperatures */}
            <g transform="translate(6, 64)" fontSize="7.5" className="mono">
              <text x="0" y="0" fill="#0284c7">Cold In: {reg2TcIn.toFixed(1)}°C</text>
              <text x="0" y="12" fill="#059669">Cold Out: {reg2TcOut.toFixed(1)}°C</text>
              <text x="0" y="24" fill="#d97706">Hot: {reg2ThIn.toFixed(0)}°→{reg2ThOut.toFixed(0)}°</text>
            </g>

            <text x="40" y="108" textAnchor="middle" fill="#64748b" fontSize="7.5">
              PHE-REG02
            </text>
          </g>

          {/* Section 4: Heating */}
          <g
            transform="translate(270, 28)"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onInspectPhe('HEATING');
            }}
          >
            <rect x="0" y="0" width="84" height="116" rx="3" fill="#fffbeb" stroke="#fde68a" strokeWidth="1.2" />
            <text x="42" y="16" textAnchor="middle" fill="#b45309" fontSize="9" fontWeight="800">
              HEATING
            </text>
            <text x="42" y="38" textAnchor="middle" fill="#b45309" fontSize="14" fontWeight="900" className="mono">
              {heatTcOut.toFixed(1)} °C
            </text>
            <text x="42" y="50" textAnchor="middle" fill="#92400e" fontSize="7.5" fontWeight="600">
              TARGET PAST.
            </text>

            {/* Dynamic Port Temperatures */}
            <g transform="translate(6, 64)" fontSize="7.5" className="mono">
              <text x="0" y="0" fill="#0284c7">Feed: {heatTcIn.toFixed(1)}°C</text>
              <text x="0" y="12" fill="#b45309">Out: {heatTcOut.toFixed(1)}°C</text>
              <text x="0" y="24" fill="#dc2626">HW: {heatThIn.toFixed(0)}°→{heatThOut.toFixed(0)}°</text>
            </g>

            <text x="42" y="108" textAnchor="middle" fill="#64748b" fontSize="7.5">
              PHE-HEAT
            </text>
          </g>
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
          <text x="45" y="-22" textAnchor="middle" fill="#0f766e" fontSize="9" fontWeight="bold">
            HOLDING COIL (20s)
          </text>
          <text x="45" y="18" textAnchor="middle" fill="#0f766e" fontSize="8" className="mono">
            τ = {isFinite(holdingTimeS) ? `${holdingTimeS.toFixed(1)}s` : 'STAGNANT (∞)'}
          </text>
        </g>

        {/* Pipe from Holding Coil to Tee junction: (x=910, y=150) to (x=950, y=150) */}
        <path d="M 910 150 L 950 150" fill="none" stroke="#d97706" strokeWidth="4" />
        
        {/* TT5 Sensor (Directly on line at x=932, y=150) */}
        <g transform="translate(932, 150)">
          <circle cx="0" cy="0" r="10" fill={isAtLegalTemp ? '#dcfce7' : '#fee2e2'} stroke={isAtLegalTemp ? '#059669' : '#dc2626'} strokeWidth="2" />
          <text x="0" y="3" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="bold">
            TT5
          </text>
          <text x="0" y="-16" textAnchor="middle" fill={isAtLegalTemp ? '#059669' : '#dc2626'} fontSize="9" fontWeight="bold" className="mono">
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
            onClick={() => onInspectPhe('ALL')}
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
  );
};
