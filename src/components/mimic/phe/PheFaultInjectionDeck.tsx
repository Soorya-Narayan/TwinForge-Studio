import React from 'react';
import type { PheAssemblyOverallMetrics, PheSectionMetrics } from '../../../core/engine/phe/types';
import type { DeviceFault } from '../../../core/engine/types';
import { ShieldCheck, ShieldAlert, AlertTriangle, Flame, Snowflake, RotateCcw } from 'lucide-react';

interface PheFaultInjectionDeckProps {
  overall: PheAssemblyOverallMetrics;
  sectionsMetrics: Record<string, PheSectionMetrics>;
  faults: DeviceFault[];
  injectFault: (f: DeviceFault) => void;
  clearFault: (deviceId: string, mode: string) => void;
  onResetFouling: () => void;
}

export const PheFaultInjectionDeck: React.FC<PheFaultInjectionDeckProps> = ({
  overall,
  sectionsMetrics,
  faults,
  injectFault,
  clearFault,
  onResetFouling,
}) => {
  return (
    <>
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
              if (active) {
                clearFault('PHE-HEATING', 'plate_leak');
              } else {
                injectFault({ deviceId: 'PHE-HEATING', mode: 'plate_leak', value: 65 });
              }
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
              if (active) {
                clearFault('PHE-HEATING', 'loss_of_hot_water');
              } else {
                injectFault({ deviceId: 'PHE-HEATING', mode: 'loss_of_hot_water' });
              }
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
              if (active) {
                clearFault('PHE-HEATING', 'loss_of_chilled_water');
              } else {
                injectFault({ deviceId: 'PHE-HEATING', mode: 'loss_of_chilled_water' });
              }
            }}
            className={`btn ${faults.some((f) => f.mode === 'loss_of_chilled_water') ? 'btn-danger' : 'btn-ghost'}`}
            style={{ padding: '6px 8px', fontSize: 10 }}
          >
            <Snowflake size={12} />
            {faults.some((f) => f.mode === 'loss_of_chilled_water') ? 'RESTORE CHILL' : 'CUT CHILLED WATER'}
          </button>

          <button
            onClick={onResetFouling}
            className="btn btn-primary"
            style={{ padding: '6px 8px', fontSize: 10 }}
          >
            <RotateCcw size={12} />
            RESET CIP CLEAN
          </button>
        </div>
      </div>
    </>
  );
};
