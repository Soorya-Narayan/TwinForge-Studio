import React, { useState } from 'react';
import type { PheSectionMetrics } from '../../../core/engine/phe/types';
import type { PHEAssemblyModel } from '../../../core/engine/phe/PHEAssemblyModel';
import { ChevronDown, ChevronUp, Cpu } from 'lucide-react';

interface PheFormulasAccordionProps {
  currentSection: PheSectionMetrics | null;
  phe: PHEAssemblyModel;
}

export const PheFormulasAccordion: React.FC<PheFormulasAccordionProps> = ({
  currentSection,
  phe,
}) => {
  const [showFormulas, setShowFormulas] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <>
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
    </>
  );
};
