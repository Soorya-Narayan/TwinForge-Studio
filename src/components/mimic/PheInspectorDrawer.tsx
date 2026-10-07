/**
 * TwinForge Studio - High-Performance Plate Heat Exchanger Inspector Drawer
 * Industrial deep-dive diagnostic panel with live temperature profiles,
 * counter-flow cell maps, thermodynamic formulas, and destructive FAT controls.
 */

import React, { useState, useMemo } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import {
  X,
  Activity,
  Flame,
  Snowflake,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Cpu,
} from 'lucide-react';

interface PheInspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialSectionId?: string;
}

export const PheInspectorDrawer: React.FC<PheInspectorDrawerProps> = ({
  isOpen,
  onClose,
  initialSectionId = 'ALL',
}) => {
  const engine = useSimulationStore((s) => s.engine);
  const snapshot = useSimulationStore((s) => s.snapshot);
  const injectFault = useSimulationStore((s) => s.injectFault);
  const faults = useSimulationStore((s) => s.faults);

  const [selectedSection, setSelectedSection] = useState<string>(initialSectionId);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showFormulas, setShowFormulas] = useState<boolean>(true);

  // Read PHE assembly directly from engine
  const phe = engine.pheAssembly;

  const overall = useMemo(() => {
    return phe?.getOverallMetrics();
  }, [phe, snapshot]);

  const sectionsMetrics = useMemo(() => {
    if (!phe) return null;
    return {
      'CHILLING': phe.chilling.getMetrics(),
      'REG-01': phe.reg01.getMetrics(),
      'REG-02': phe.reg02.getMetrics(),
      'HEATING': phe.heating.getMetrics(),
    };
  }, [phe, snapshot]);

  if (!isOpen || !phe || !overall || !sectionsMetrics) return null;

  const currentSection = selectedSection !== 'ALL' ? sectionsMetrics[selectedSection as keyof typeof sectionsMetrics] : null;

  // Temperature color helper (4°C deep blue -> 95°C vibrant red)
  const getTempColor = (t: number) => {
    const min = 4.0;
    const max = 95.0;
    const ratio = Math.max(0, Math.min(1, (t - min) / (max - min)));
    
    // HSL interpolation: 215 (blue) -> 0 (red)
    const hue = 215 - ratio * 215;
    return `hsl(${hue}, 85%, ${ratio > 0.6 ? '48%' : '44%'})`;
  };

  // Status Badge Helper
  const renderStatusBadge = () => {
    switch (overall.overallStatus) {
      case 'CONTAMINATION_ALERT':
        return <span className="badge badge-danger"><AlertTriangle size={12} /> CONTAMINATION HAZARD (PT2 &gt; PT4)</span>;
      case 'LEAK_WARNING':
        return <span className="badge badge-warning"><ShieldAlert size={12} /> PINHOLE LEAK ACTIVE ({overall.plateLeakFlowRateLpm} L/min)</span>;
      case 'FOULED':
        return <span className="badge badge-warning"><Sliders size={12} /> PLATES FOULED (CIP REQUIRED)</span>;
      case 'UNDER_TEMP_DIVERT':
        return <span className="badge badge-danger"><Activity size={12} /> UNDER-TEMP DIVERT ({overall.holdingTubeExitTempC.toFixed(1)}°C)</span>;
      case 'LOW_FLOW':
        return <span className="badge badge-neutral">STANDBY / LOW FLOW</span>;
      default:
        return <span className="badge badge-success"><CheckCircle2 size={12} /> OPTIMAL (90% REGENERATION)</span>;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '560px',
        maxWidth: '96vw',
        background: '#ffffff',
        boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.18)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border-strong)',
      }}
    >
      {/* 1. Header Bar */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              Plate Heat Exchanger Diagnostic Suite
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {renderStatusBadge()}
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              T={((snapshot?.timeMs ?? 0) / 1000).toFixed(1)}s
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn btn-ghost"
          style={{ padding: '6px 8px', borderRadius: 4 }}
          title="Close Inspector"
        >
          <X size={16} />
        </button>
      </div>

      {/* 2. Section Selector Tabs */}
      <div
        style={{
          display: 'flex',
          background: '#e2e8f0',
          padding: 3,
          gap: 2,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {['ALL', 'CHILLING', 'REG-01', 'REG-02', 'HEATING'].map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedSection(tab)}
            style={{
              flex: 1,
              padding: '6px 4px',
              fontSize: 10,
              fontWeight: 800,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              background: selectedSection === tab ? '#ffffff' : 'transparent',
              color: selectedSection === tab ? '#0284c7' : '#64748b',
              boxShadow: selectedSection === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 3. Scrollable Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Overall Assembly KPI Cards (Shown on ALL tab) */}
        {selectedSection === 'ALL' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div className="industrial-card" style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Regen Efficiency
                </div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>
                  {overall.regenerationEfficiencyPct.toFixed(1)}%
                </div>
                <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 600 }}>Energy Recovered</div>
              </div>

              <div className="industrial-card" style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Holding Time (TT5)
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: overall.isLegalHoldingTime ? '#16a34a' : '#dc2626',
                    marginTop: 2,
                  }}
                >
                  {overall.holdingTubeResidenceTimeS.toFixed(1)}s
                </div>
                <div style={{ fontSize: 9, color: overall.isLegalHoldingTime ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {overall.isLegalHoldingTime ? 'Legal (>=16s)' : 'Under-Time Alert'}
                </div>
              </div>

              <div className="industrial-card" style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Diff Pressure (ΔP)
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: overall.differentialPressureBar >= 0.5 ? '#16a34a' : '#dc2626',
                    marginTop: 2,
                  }}
                >
                  +{overall.differentialPressureBar.toFixed(2)} b
                </div>
                <div style={{ fontSize: 9, color: overall.differentialPressureBar >= 0.5 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  PT4 ({overall.pasteurizedPressurePT4Bar}b) - PT2 ({overall.rawPressurePT2Bar}b)
                </div>
              </div>
            </div>

            {/* 4-Section Thermal Overview Table */}
            <div className="industrial-card" style={{ padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                Plate Pack Multi-Section Heat Balance
              </div>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '4px 6px' }}>Section</th>
                    <th style={{ padding: '4px 6px' }}>Cold (In/Out)</th>
                    <th style={{ padding: '4px 6px' }}>Hot (In/Out)</th>
                    <th style={{ padding: '4px 6px' }}>Duty (kW)</th>
                    <th style={{ padding: '4px 6px' }}>ε (Eff)</th>
                    <th style={{ padding: '4px 6px' }}>U (W/m²K)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sectionsMetrics).map(([key, m]) => (
                    <tr
                      key={key}
                      onClick={() => setSelectedSection(key)}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        background: '#ffffff',
                      }}
                      className="hover-row"
                    >
                      <td style={{ padding: '6px 6px', fontWeight: 800, color: '#0284c7' }}>{key}</td>
                      <td style={{ padding: '6px 6px' }} className="mono">
                        {m.tempColdInC.toFixed(1)}° → {m.tempColdOutC.toFixed(1)}°
                      </td>
                      <td style={{ padding: '6px 6px' }} className="mono">
                        {m.tempHotInC.toFixed(1)}° → {m.tempHotOutC.toFixed(1)}°
                      </td>
                      <td style={{ padding: '6px 6px', fontWeight: 700 }} className="mono">
                        {m.dutyAverageKW.toFixed(1)}
                      </td>
                      <td style={{ padding: '6px 6px' }} className="mono">{m.effectivenessEpsilon.toFixed(2)}</td>
                      <td style={{ padding: '6px 6px' }} className="mono">{m.uValue_W_per_m2_K.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Selected Section Deep-Dive (When a section is chosen) */}
        {currentSection && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Section Summary Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#f1f5f9',
                borderRadius: 4,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{currentSection.name}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  {phe[selectedSection === 'HEATING' ? 'heating' : selectedSection === 'CHILLING' ? 'chilling' : selectedSection === 'REG-01' ? 'reg01' : 'reg02'].config.plateCount} Plates · Counterflow N={currentSection.cells.length} Cells
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: '#0284c7' }}>
                  {currentSection.dutyAverageKW.toFixed(1)} kW
                </span>
                <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 700 }}>
                  Error: {currentSection.energyBalanceErrorPct.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Visual Temperature Profile Chart (Hot vs Cold Counterflow) */}
            <div className="industrial-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Discretized Temperature Profile (Counterflow Cells 0 → {currentSection.cells.length - 1})
                </span>
                <div style={{ display: 'flex', gap: 10, fontSize: 10, fontWeight: 700 }}>
                  <span style={{ color: '#dc2626' }}>● Hot Stream (Th)</span>
                  <span style={{ color: '#64748b' }}>● Wall Node (Tw)</span>
                  <span style={{ color: '#0284c7' }}>● Cold Stream (Tc)</span>
                </div>
              </div>

              {/* SVG Profile Chart */}
              <div style={{ width: '100%', height: '140px', background: '#f8fafc', borderRadius: 4, position: 'relative' }}>
                <svg width="100%" height="100%" viewBox="0 0 500 140" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  {[0, 25, 50, 75, 100].map((y) => (
                    <line key={y} x1="30" y1={120 - y} x2="480" y2={120 - y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 2" />
                  ))}

                  {/* Temperature curves */}
                  {(() => {
                    const N = currentSection.cells.length;
                    const minT = 0;
                    const maxT = 100;
                    const scaleX = (i: number) => 40 + (i / (N - 1)) * 430;
                    const scaleY = (t: number) => 125 - ((Math.max(minT, Math.min(maxT, t)) - minT) / (maxT - minT)) * 105;

                    const hotPoints = currentSection.cells.map((c, i) => `${scaleX(i)},${scaleY(c.temperatureHotC)}`).join(' ');
                    const coldPoints = currentSection.cells.map((c, i) => `${scaleX(i)},${scaleY(c.temperatureColdC)}`).join(' ');
                    const wallPoints = currentSection.cells.map((c, i) => `${scaleX(i)},${scaleY(c.temperatureWallC)}`).join(' ');

                    return (
                      <>
                        {/* Wall curve */}
                        <polyline points={wallPoints} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />
                        {/* Hot curve */}
                        <polyline points={hotPoints} fill="none" stroke="#dc2626" strokeWidth="2.5" />
                        {/* Cold curve */}
                        <polyline points={coldPoints} fill="none" stroke="#0284c7" strokeWidth="2.5" />

                        {/* Nodes */}
                        {currentSection.cells.map((c, i) => (
                          <g key={i}>
                            <circle cx={scaleX(i)} cy={scaleY(c.temperatureHotC)} r="3" fill="#dc2626" />
                            <circle cx={scaleX(i)} cy={scaleY(c.temperatureColdC)} r="3" fill="#0284c7" />
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Schematic Finite-Volume Cells (Colormap & Counterflow Flow Direction) */}
            <div className="industrial-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Finite Volume Cell Heat Exchange Matrix
                </span>
                <span style={{ fontSize: 10, color: '#64748b' }}>
                  Cold: Left → Right | Hot: Right → Left
                </span>
              </div>

              {/* Cell Bar Representation */}
              <div style={{ display: 'flex', gap: 3, width: '100%' }}>
                {currentSection.cells.map((cell) => (
                  <div
                    key={cell.index}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      alignItems: 'center',
                    }}
                  >
                    {/* Hot Cell Stream */}
                    <div
                      title={`Cell ${cell.index} Hot: ${cell.temperatureHotC}°C`}
                      style={{
                        width: '100%',
                        height: '24px',
                        borderRadius: 3,
                        background: getTempColor(cell.temperatureHotC),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: 8,
                        fontWeight: 700,
                      }}
                      className="mono"
                    >
                      {cell.temperatureHotC.toFixed(0)}°
                    </div>

                    {/* Wall Node */}
                    <div
                      title={`Cell ${cell.index} Wall: ${cell.temperatureWallC}°C`}
                      style={{
                        width: '100%',
                        height: '6px',
                        background: '#64748b',
                        borderRadius: 1,
                      }}
                    />

                    {/* Cold Cell Stream */}
                    <div
                      title={`Cell ${cell.index} Cold: ${cell.temperatureColdC}°C`}
                      style={{
                        width: '100%',
                        height: '24px',
                        borderRadius: 3,
                        background: getTempColor(cell.temperatureColdC),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: 8,
                        fontWeight: 700,
                      }}
                      className="mono"
                    >
                      {cell.temperatureColdC.toFixed(0)}°
                    </div>

                    <span className="mono" style={{ fontSize: 8, color: '#94a3b8' }}>
                      C{cell.index}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Values Diagnostic Grid */}
            <div className="industrial-card" style={{ padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                Analytical Performance Parameters
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 3 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Effectiveness (ε):</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{currentSection.effectivenessEpsilon.toFixed(3)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 3 }}>
                  <span style={{ color: 'var(--text-muted)' }}>NTU:</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{currentSection.ntu.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 3 }}>
                  <span style={{ color: 'var(--text-muted)' }}>LMTD (ΔTlm):</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{currentSection.lmtdC.toFixed(2)} °C</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 3 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Overall U:</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{currentSection.uValue_W_per_m2_K.toFixed(0)} W/m²K</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 3 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Thermal Conductance (UA):</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{currentSection.uaValue_kW_per_K.toFixed(2)} kW/K</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 3 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cold Film hc:</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{currentSection.hCold_W_per_m2_K.toFixed(0)} W/m²K</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 3 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Hot Film hh:</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{currentSection.hHot_W_per_m2_K.toFixed(0)} W/m²K</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 3 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pressure Drop (Cold):</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{currentSection.pressureDropColdBar.toFixed(3)} bar</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 3 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pressure Drop (Hot):</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{currentSection.pressureDropHotBar.toFixed(3)} bar</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 3 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fouling Resistance (Rf):</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{(currentSection.foulingResistance_m2_K_per_W * 1e4).toFixed(3)} ×10⁻⁴</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Health & Sanitation Gauge Panel */}
        <div className="industrial-card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            Sanitary Equipment Health & CIP Readiness
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Fouling Accumulation Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-muted)' }}>Plate Pack Fouling Level:</span>
                <span className="mono" style={{ fontWeight: 700, color: (sectionsMetrics['HEATING']?.foulingPct ?? 0) > 30 ? '#dc2626' : '#0284c7' }}>
                  {(sectionsMetrics['HEATING']?.foulingPct ?? 0).toFixed(1)}% {((sectionsMetrics['HEATING']?.foulingPct ?? 0) > 30 ? '(CIP DUE)' : '(CLEAN)')}
                </span>
              </div>
              <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, sectionsMetrics['HEATING']?.foulingPct ?? 0)}%`,
                    background: (sectionsMetrics['HEATING']?.foulingPct ?? 0) > 30 ? '#dc2626' : '#0284c7',
                  }}
                />
              </div>
            </div>

            {/* Cross-Contamination Risk Gauge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: overall.differentialPressureBar >= 0.5 ? '#f0fdf4' : '#fee2e2', borderRadius: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {overall.differentialPressureBar >= 0.5 ? <ShieldCheck size={16} color="#16a34a" /> : <ShieldAlert size={16} color="#dc2626" />}
                <span style={{ fontSize: 10, fontWeight: 700, color: overall.differentialPressureBar >= 0.5 ? '#15803d' : '#b91c1c' }}>
                  {overall.differentialPressureBar >= 0.5 ? 'Cross-Contamination Barrier Safe (PT4 > PT2)' : 'CRITICAL PRESSURE REVERSAL (PT2 > PT4)'}
                </span>
              </div>
              <span className="mono" style={{ fontSize: 11, fontWeight: 800 }}>
                ΔP = {overall.differentialPressureBar.toFixed(2)} bar
              </span>
            </div>
          </div>
        </div>

        {/* 5. Live FAT & Testing Controls */}
        <div className="industrial-card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            Interactive Commissioning & Fault Injection Controls
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              onClick={() => {
                const active = faults.some((f) => f.mode === 'plate_leak');
                injectFault({ deviceId: 'PHE-HEATING', mode: active ? 'none' : 'plate_leak', value: 65 });
              }}
              className={`btn ${faults.some((f) => f.mode === 'plate_leak') ? 'btn-danger' : 'btn-ghost'}`}
              style={{ padding: '6px 8px', fontSize: 10 }}
            >
              <AlertTriangle size={12} />
              {faults.some((f) => f.mode === 'plate_leak') ? 'REMOVE LEAK' : 'INJECT PLATE LEAK'}
            </button>

            <button
              onClick={() => {
                const active = faults.some((f) => f.mode === 'loss_of_hot_water');
                injectFault({ deviceId: 'PHE-HEATING', mode: active ? 'none' : 'loss_of_hot_water' });
              }}
              className={`btn ${faults.some((f) => f.mode === 'loss_of_hot_water') ? 'btn-danger' : 'btn-ghost'}`}
              style={{ padding: '6px 8px', fontSize: 10 }}
            >
              <Flame size={12} />
              {faults.some((f) => f.mode === 'loss_of_hot_water') ? 'RESTORE STEAM' : 'CUT HOT WATER'}
            </button>

            <button
              onClick={() => {
                const active = faults.some((f) => f.mode === 'loss_of_chilled_water');
                injectFault({ deviceId: 'PHE-HEATING', mode: active ? 'none' : 'loss_of_chilled_water' });
              }}
              className={`btn ${faults.some((f) => f.mode === 'loss_of_chilled_water') ? 'btn-danger' : 'btn-ghost'}`}
              style={{ padding: '6px 8px', fontSize: 10 }}
            >
              <Snowflake size={12} />
              {faults.some((f) => f.mode === 'loss_of_chilled_water') ? 'RESTORE CHILL' : 'CUT CHILLED WATER'}
            </button>

            <button
              onClick={() => {
                phe.resetAllFouling();
                injectFault({ deviceId: 'PHE-HEATING', mode: 'none' });
              }}
              className="btn btn-primary"
              style={{ padding: '6px 8px', fontSize: 10 }}
            >
              <RotateCcw size={12} />
              RESET CIP CLEAN
            </button>
          </div>
        </div>

        {/* 6. Collapsible "How it's calculated" Formulas Panel */}
        <div className="industrial-card" style={{ padding: 12 }}>
          <div
            onClick={() => setShowFormulas(!showFormulas)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>
              How It's Calculated (Live Physics Formulation)
            </span>
            {showFormulas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>

          {showFormulas && currentSection && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 10, color: '#334155' }}>
              <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4 }} className="mono">
                <strong>1. Overall Conductance (1/U):</strong>
                <div>1/U = 1/hh + 1/hc + t/k + Rf</div>
                <div style={{ color: '#0284c7', marginTop: 2 }}>
                  1/{currentSection.uValue_W_per_m2_K.toFixed(0)} = 1/{currentSection.hHot_W_per_m2_K.toFixed(0)} + 1/{currentSection.hCold_W_per_m2_K.toFixed(0)} + {(0.0006/16).toFixed(6)} + {currentSection.foulingResistance_m2_K_per_W.toFixed(6)}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4 }} className="mono">
                <strong>2. Heat Duty & Effectiveness:</strong>
                <div>Q = ε · Cmin · (Th,in - Tc,in)</div>
                <div style={{ color: '#16a34a', marginTop: 2 }}>
                  {currentSection.dutyAverageKW.toFixed(1)} kW = {currentSection.effectivenessEpsilon.toFixed(3)} × (Cmin) × ({currentSection.tempHotInC.toFixed(1)}° - {currentSection.tempColdInC.toFixed(1)}°)
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4 }} className="mono">
                <strong>3. Log Mean Temperature Difference:</strong>
                <div>ΔTlm = (ΔT1 - ΔT2) / ln(ΔT1 / ΔT2)</div>
                <div style={{ color: '#d97706', marginTop: 2 }}>
                  ΔTlm = {currentSection.lmtdC.toFixed(2)} °C
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 7. Advanced Model Configuration (Discretization & Wall-Node Toggle) */}
        <div className="industrial-card" style={{ padding: 12 }}>
          <div
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={14} color="#64748b" />
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>
                Advanced Solver Settings
              </span>
            </div>
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>

          {showAdvanced && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Cells per Section (N):</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[5, 10, 15, 20].map((n) => (
                    <button
                      key={n}
                      onClick={() => phe.setAllCellCounts(n)}
                      className={`btn ${phe.heating.cellCount === n ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ padding: '3px 8px', fontSize: 10 }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Plate-Wall Thermal Capacitance:</span>
                <button
                  onClick={() => phe.setEnableWallNodes(!phe.heating.enableWallNode)}
                  className={`btn ${phe.heating.enableWallNode ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '3px 8px', fontSize: 10 }}
                >
                  {phe.heating.enableWallNode ? 'ENABLED (3-NODE)' : 'DISABLED (DIRECT)'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
