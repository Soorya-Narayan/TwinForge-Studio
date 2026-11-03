import React from 'react';
import type { PheAssemblyOverallMetrics, PheSectionMetrics } from '../../../core/engine/phe/types';

interface PheOverallMetricsCardProps {
  overall: PheAssemblyOverallMetrics;
  sectionsMetrics: Record<string, PheSectionMetrics>;
  onSelectSection: (sectionKey: string) => void;
  getTempColor: (t: number) => string;
}

export const PheOverallMetricsCard: React.FC<PheOverallMetricsCardProps> = ({
  overall,
  sectionsMetrics,
  onSelectSection,
  getTempColor,
}) => {
  return (
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
            {isFinite(overall.holdingTubeResidenceTimeS) ? `${overall.holdingTubeResidenceTimeS.toFixed(1)}s` : 'STAGNANT (∞)'}
          </div>
          <div style={{ fontSize: 9, color: overall.isLegalHoldingTime ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
            {overall.isStagnant ? 'Zero Flow / Stagnant' : overall.isLegalHoldingTime ? 'Legal (>=16s)' : 'Under-Time Alert'}
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
                onClick={() => onSelectSection(key)}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  background: '#ffffff',
                }}
                className="hover-row"
              >
                <td style={{ padding: '6px 6px', fontWeight: 800, color: '#0284c7' }}>{key}</td>
                <td className="mono" style={{ padding: '6px 6px' }}>
                  <span style={{ color: getTempColor(m.tempColdInC) }}>{m.tempColdInC.toFixed(1)}°</span> →{' '}
                  <span style={{ color: getTempColor(m.tempColdOutC) }}>{m.tempColdOutC.toFixed(1)}°</span>
                </td>
                <td className="mono" style={{ padding: '6px 6px' }}>
                  <span style={{ color: getTempColor(m.tempHotInC) }}>{m.tempHotInC.toFixed(1)}°</span> →{' '}
                  <span style={{ color: getTempColor(m.tempHotOutC) }}>{m.tempHotOutC.toFixed(1)}°</span>
                </td>
                <td className="mono" style={{ padding: '6px 6px', fontWeight: 700 }}>
                  {m.dutyAverageKW.toFixed(1)}
                </td>
                <td className="mono" style={{ padding: '6px 6px', color: '#16a34a', fontWeight: 700 }}>
                  {(m.effectivenessEpsilon * 100).toFixed(0)}%
                </td>
                <td className="mono" style={{ padding: '6px 6px', color: 'var(--text-secondary)' }}>
                  {m.uValue_W_per_m2_K.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
