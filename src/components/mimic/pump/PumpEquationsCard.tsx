import React, { useState } from 'react';
import type { RawMilkSupplyCircuit } from '../../../core/engine/circuits/RawMilkSupplyCircuit';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

interface PumpEquationsCardProps {
  circuit: RawMilkSupplyCircuit;
}

export const PumpEquationsCard: React.FC<PumpEquationsCardProps> = ({ circuit }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pump = circuit.pump;
  const cfg = pump.config;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: '#f8fafc',
          border: 'none',
          borderBottom: isOpen ? '1px solid var(--border-subtle)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={16} color="var(--color-primary)" />
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
            Governing Physics & Datasheet Parameters
          </span>
        </div>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 11 }}>
          {/* Equations Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, color: '#0284c7', marginBottom: 4 }}>Pump Head Curve:</div>
              <div className="mono" style={{ fontSize: 10, color: '#334155' }}>
                H(Q, s) = s²·H₀ - s²·c₁·(Q/s)²
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                Fitted to 3 curve points: shut-off (32m), rated (24m @ 12k L/h), max (12m @ 16k L/h).
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, color: '#0284c7', marginBottom: 4 }}>Darcy-Weisbach & Swamee-Jain:</div>
              <div className="mono" style={{ fontSize: 10, color: '#334155' }}>
                ΔP = [f·(L/D) + ΣK] · (ρ·v² / 2)
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                Accounts for turbulent regime Re &gt; 4000 and pipe relative roughness (ε = 0.0015 mm).
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, color: '#0284c7', marginBottom: 4 }}>NPSHa Cavitation Boundary:</div>
              <div className="mono" style={{ fontSize: 10, color: '#334155' }}>
                NPSHa = (P_suct - P_vap)/(ρ·g) + v²/(2·g)
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                Cavitation occurs when NPSHa &lt; NPSHr, degrading head by penalty up to 100%.
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, color: '#0284c7', marginBottom: 4 }}>Motor Thermal Overload (I²t):</div>
              <div className="mono" style={{ fontSize: 10, color: '#334155' }}>
                dθ/dt = [(I/I_rated)² - 1] / τ
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                Trips contactor when θ(t) reaches 1.0 (trip at ~1.3x rated current over 10s).
              </div>
            </div>
          </div>

          {/* Datasheet Parameters Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid var(--border-strong)' }}>
                <th style={{ padding: '4px 8px' }}>Parameter</th>
                <th style={{ padding: '4px 8px' }}>Value</th>
                <th style={{ padding: '4px 8px' }}>Unit</th>
                <th style={{ padding: '4px 8px' }}>Source Field</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '4px 8px', fontWeight: 600 }}>Rated Speed</td>
                <td className="mono" style={{ padding: '4px 8px' }}>{cfg.ratedSpeedRpm?.value ?? 2900}</td>
                <td style={{ padding: '4px 8px' }}>RPM</td>
                <td style={{ padding: '4px 8px' }}><span className="badge badge-neutral" style={{ fontSize: 8 }}>{cfg.ratedSpeedRpm?.source ?? 'placeholder'}</span></td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '4px 8px', fontWeight: 600 }}>Rated Motor Power</td>
                <td className="mono" style={{ padding: '4px 8px' }}>{cfg.motor.ratedPowerKw.value}</td>
                <td style={{ padding: '4px 8px' }}>kW</td>
                <td style={{ padding: '4px 8px' }}><span className="badge badge-neutral" style={{ fontSize: 8 }}>{cfg.motor.ratedPowerKw.source}</span></td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '4px 8px', fontWeight: 600 }}>Rated Current</td>
                <td className="mono" style={{ padding: '4px 8px' }}>{cfg.motor.ratedCurrentA.value}</td>
                <td style={{ padding: '4px 8px' }}>A</td>
                <td style={{ padding: '4px 8px' }}><span className="badge badge-neutral" style={{ fontSize: 8 }}>{cfg.motor.ratedCurrentA.source}</span></td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '4px 8px', fontWeight: 600 }}>Ramp-Up Time</td>
                <td className="mono" style={{ padding: '4px 8px' }}>{cfg.motor.rampUpTimeS.value}</td>
                <td style={{ padding: '4px 8px' }}>s</td>
                <td style={{ padding: '4px 8px' }}><span className="badge badge-neutral" style={{ fontSize: 8 }}>{cfg.motor.rampUpTimeS.source}</span></td>
              </tr>
              <tr>
                <td style={{ padding: '4px 8px', fontWeight: 600 }}>Deadhead Timeout</td>
                <td className="mono" style={{ padding: '4px 8px' }}>{cfg.deadheadTimeoutS?.value ?? 10}</td>
                <td style={{ padding: '4px 8px' }}>s</td>
                <td style={{ padding: '4px 8px' }}><span className="badge badge-neutral" style={{ fontSize: 8 }}>{cfg.deadheadTimeoutS?.source ?? 'placeholder'}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
