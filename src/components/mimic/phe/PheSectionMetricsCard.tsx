import React from 'react';
import type { PheSectionMetrics } from '../../../core/engine/phe/types';

interface PheSectionMetricsCardProps {
  currentSection: PheSectionMetrics;
  plateCount: number;
  getTempColor: (t: number) => string;
}

export const PheSectionMetricsCard: React.FC<PheSectionMetricsCardProps> = ({
  currentSection,
  plateCount,
  getTempColor,
}) => {
  return (
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
            {plateCount} Plates · Counterflow N={currentSection.cells.length} Cells
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
  );
};
